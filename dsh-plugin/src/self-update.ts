import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDshPlugin } from './dsh-cli.js'
import { fetchJson } from './http.js'
import { currentProfileDir, resolveRuntimeProfile } from './runtime-profile.js'
import type { FetchOptions } from './types.js'

export { runCommand, webProfileDir } from './dsh-cli.js'

export const PLUGIN_REPO = 'Tencent/skillhub'
export const PLUGIN_NPM_NAME = 'skillhub-plugin'
/** Earlier package names of this plugin; an update replaces them with PLUGIN_NPM_NAME. */
export const LEGACY_PACKAGE_NAMES = ['@cocofhu/skillhub', '@tencent/skillhub']

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
  source: 'link' | 'npm' | 'github' | 'unknown'
  profileDir: string
  profile: string
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
  runDshPlugin: typeof runDshPlugin
  readPackageJson: typeof readPackageJson
  readProfilePackage: typeof readProfilePackage
  profileDir: () => string
  profile?: string
}

const defaultDeps: UpdateDeps = {
  fetchJson,
  runDshPlugin,
  readPackageJson,
  readProfilePackage,
  profileDir: currentProfileDir,
}

export function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

export function readPackageJson(root = packageRoot()): { name?: string; version?: string } {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string; version?: string }
}

export function readProfilePackage(profileDir = currentProfileDir()): { dependencies?: Record<string, string> } {
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
  if (/github[:.](com\/)?(cocofhu|tencent)\/skillhub/i.test(value)) return 'github'
  if (/^(npm:)?[~^]?\d+\.\d+\.\d+/.test(value) || /^(npm:)?(latest|\*)$/.test(value)) return 'npm'
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
  deps: Partial<UpdateDeps> = {},
  signal?: AbortSignal,
): Promise<UpdateStatus> {
  const runtime = resolveRuntimeProfile(deps.profile)
  const profileDir = deps.profileDir?.() ?? runtime.dir
  const pkg = (deps.readPackageJson ?? readPackageJson)()
  const currentVersion = normalizeVersion(pkg.version || '0.0.0') || '0.0.0'
  let source: UpdateStatus['source'] = 'unknown'
  try {
    const profile = (deps.readProfilePackage ?? readProfilePackage)(profileDir)
    const names = [pkg.name, PLUGIN_NPM_NAME, ...LEGACY_PACKAGE_NAMES, 'skillhub'].filter((name): name is string => Boolean(name))
    const spec = names.map((name) => profile.dependencies?.[name]).find((value) => value !== undefined)
    source = detectSource(spec)
  } catch {
    source = 'unknown'
  }
  const latest = await fetchLatestRelease(opts, { fetchJson: deps.fetchJson ?? fetchJson }, signal)
  const upToDate = compareSemver(currentVersion, latest.version) >= 0 && source !== 'link'
  const canUpdate = source === 'link' || compareSemver(currentVersion, latest.version) < 0
  let message: string | undefined
  if (source === 'link') message = `当前是本地开发链接，更新会改成从 npm 安装 ${PLUGIN_NPM_NAME}`
  else if (upToDate) message = '已是最新 release'
  return {
    currentVersion,
    latest,
    upToDate,
    source,
    profileDir,
    profile: runtime.name,
    canUpdate,
    message,
  }
}

export async function updateToLatestRelease(
  opts: FetchOptions,
  deps: Partial<UpdateDeps> = {},
  signal?: AbortSignal,
): Promise<UpdateResult> {
  const status = await getUpdateStatus(opts, deps, signal)
  if (!status.latest) throw new Error('未找到最新 release')
  if (!status.canUpdate) {
    return { ...status, updated: false, restartedHint: false }
  }
  const run = deps.runDshPlugin ?? runDshPlugin
  const before = (deps.readPackageJson ?? readPackageJson)()
  let log = await run(status.profile, ['add', `${PLUGIN_NPM_NAME}@${status.latest.version}`])
  // A profile holding the plugin under an earlier name would otherwise load it twice.
  if (before.name && before.name !== PLUGIN_NPM_NAME && LEGACY_PACKAGE_NAMES.includes(before.name)) {
    log += await run(status.profile, ['remove', before.name])
  }
  const after = (deps.readPackageJson ?? readPackageJson)()
  return {
    ...status,
    currentVersion: normalizeVersion(after.version || status.latest.version),
    source: 'npm',
    upToDate: true,
    canUpdate: false,
    updated: true,
    restartedHint: true,
    message: `已更新到 ${status.latest.tag}，请重启当前宿主并刷新界面`,
    log: log.slice(-4000),
  }
}
