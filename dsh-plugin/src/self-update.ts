import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshHome } from './config-store.js'
import { fetchJson } from './http.js'
import type { FetchOptions } from './types.js'

export const PLUGIN_REPO = 'Tencent/skillhub'
export const PLUGIN_PACKAGE = '@tencent/skillhub'
export const PLUGIN_GITHUB_SPEC = `github:${PLUGIN_REPO}`

export interface ReleaseInfo {
  tag: string
  version: string
  htmlUrl: string
  name: string
}

export interface UpdateStatus {
  currentVersion: string
  latest?: ReleaseInfo
  upToDate: boolean
  source: 'link' | 'github' | 'unknown'
  profileDir: string
  canUpdate: boolean
  message?: string
}

export interface UpdateResult extends UpdateStatus {
  updated: boolean
  restartedHint: boolean
  log?: string
}

export interface UpdateDeps {
  fetchJson: typeof fetchJson
  runCommand: typeof runCommand
  readPackageJson: typeof readPackageJson
  readProfilePackage: typeof readProfilePackage
  profileDir: () => string
}

const defaultDeps: UpdateDeps = {
  fetchJson,
  runCommand,
  readPackageJson,
  readProfilePackage,
  profileDir: webProfileDir,
}

export function webProfileDir(): string {
  return join(dshHome(), 'profiles', 'web')
}

export function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

export function readPackageJson(root = packageRoot()): { name?: string; version?: string } {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string; version?: string }
}

export function readProfilePackage(profileDir = webProfileDir()): { dependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
}

export function normalizeVersion(raw: string): string {
  return String(raw || '').trim().replace(/^v/i, '')
}

export function parseReleaseTag(tag: string): string {
  const version = normalizeVersion(tag)
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`无效 release 标签: ${tag}`)
  return version
}

export function compareSemver(a: string, b: string): number {
  const pa = normalizeVersion(a).split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0)
  const pb = normalizeVersion(b).split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

export function detectSource(spec: string | undefined): UpdateStatus['source'] {
  const value = String(spec || '')
  if (/^link:/i.test(value) || value.startsWith('file:')) return 'link'
  if (/github:Tencent\/skillhub/i.test(value) || /github\.com\/Tencent\/skillhub/i.test(value)) return 'github'
  return 'unknown'
}

export async function fetchLatestRelease(
  opts: FetchOptions,
  deps: Pick<UpdateDeps, 'fetchJson'> = defaultDeps,
  signal?: AbortSignal,
): Promise<ReleaseInfo> {
  const url = `https://api.github.com/repos/${PLUGIN_REPO}/releases/latest`
  const raw = await deps.fetchJson<{ tag_name?: string; html_url?: string; name?: string }>(url, opts, signal)
  const tag = String(raw.tag_name || '').trim()
  const version = parseReleaseTag(tag)
  return {
    tag: tag.startsWith('v') ? tag : `v${version}`,
    version,
    htmlUrl: String(raw.html_url || `https://github.com/${PLUGIN_REPO}/releases/tag/${tag}`),
    name: String(raw.name || tag),
  }
}

export async function getUpdateStatus(
  opts: FetchOptions,
  deps: UpdateDeps = defaultDeps,
  signal?: AbortSignal,
): Promise<UpdateStatus> {
  const profileDir = deps.profileDir()
  const pkg = deps.readPackageJson()
  const currentVersion = normalizeVersion(pkg.version || '0.0.0') || '0.0.0'
  let source: UpdateStatus['source'] = 'unknown'
  try {
    const profile = deps.readProfilePackage(profileDir)
    source = detectSource(profile.dependencies?.[PLUGIN_PACKAGE] || profile.dependencies?.skillhub)
  } catch {
    source = 'unknown'
  }
  const latest = await fetchLatestRelease(opts, deps, signal)
  const upToDate = compareSemver(currentVersion, latest.version) >= 0 && source !== 'link'
  const canUpdate = source === 'link' || compareSemver(currentVersion, latest.version) < 0
  let message: string | undefined
  if (source === 'link') message = '当前是本地开发链接，更新会改成 GitHub release 安装'
  else if (upToDate) message = '已是最新 release'
  return {
    currentVersion,
    latest,
    upToDate,
    source,
    profileDir,
    canUpdate,
    message,
  }
}

export async function updateToLatestRelease(
  opts: FetchOptions,
  deps: UpdateDeps = defaultDeps,
  signal?: AbortSignal,
): Promise<UpdateResult> {
  const status = await getUpdateStatus(opts, deps, signal)
  if (!status.latest) throw new Error('未找到最新 release')
  if (!status.canUpdate) {
    return { ...status, updated: false, restartedHint: false }
  }
  const spec = `${PLUGIN_GITHUB_SPEC}#${status.latest.tag}`
  const log = await deps.runCommand('npx', ['--yes', '@deepseek-ai/dsh', 'plugin', '--profile', 'web', 'add', spec], {
    cwd: status.profileDir,
    timeoutMs: Math.max(opts.timeoutMs, 120000),
    signal,
  })
  const after = deps.readPackageJson()
  return {
    ...status,
    currentVersion: normalizeVersion(after.version || status.latest.version),
    source: 'github',
    upToDate: true,
    canUpdate: false,
    updated: true,
    restartedHint: true,
    message: `已更新到 ${status.latest.tag}，请重启 dsh web 并强制刷新浏览器`,
    log: log.slice(-4000),
  }
}

export async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env, CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      if (err) reject(err)
      else resolve(out)
    }
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error(`更新超时 ${options.timeoutMs}ms`))
    }, options.timeoutMs)
    const onAbort = () => {
      child.kill('SIGTERM')
      finish(new Error('更新已取消'))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', (chunk) => { out += String(chunk) })
    child.stderr.on('data', (chunk) => { out += String(chunk) })
    child.on('error', (err) => finish(err))
    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(`更新失败 (exit ${code}): ${out.trim().slice(-800) || 'no output'}`))
    })
  })
}
