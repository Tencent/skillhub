/**
 * Spawn `dsh plugin` from the host process. Do not use the agent's sandboxed
 * shell: it cannot write the profile directory.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { dshHome } from './config-store.js'
import { createProgressTracker, type ProgressPhase } from './ndjson.js'

export const WEB_PROFILE = 'web'
export const INSTALL_TIMEOUT_MS = Number(process.env.SKILLHUB_INSTALL_TIMEOUT_MS) || 15 * 60 * 1000

const TARGET_RE = /^[A-Za-z0-9@:./_#+-]+$/
const CMD_METACHARS = /[\s"&|<>^()%!]/
const NDJSON_COMMANDS = new Set(['add', 'remove', 'install'])

export type PluginRunner = (profile: string, pluginArgs: string[]) => Promise<string>

export interface DshArgv {
  file: string
  args: string[]
  cwd: string | undefined
  viaShell: boolean
}

export interface RunCommandOptions {
  cwd?: string
  timeoutMs: number
  signal?: AbortSignal
  env?: NodeJS.ProcessEnv
  viaShell?: boolean
  detached?: boolean
  onChunk?: (text: string) => void
}

export interface InstallProgress {
  active: boolean
  target: string
  startedAt: number
  lastLine: string
  phase: ProgressPhase
  done: number
  total: number | null
  currentPackage: string | null
  downloaded: number | null
  size: number | null
  ndjson: boolean
  error: string | null
}

export const progress: InstallProgress = {
  active: false,
  target: '',
  startedAt: 0,
  lastLine: '',
  phase: null,
  done: 0,
  total: null,
  currentPackage: null,
  downloaded: null,
  size: null,
  ndjson: false,
  error: null,
}

export const BOOT_ID = `${String(process.pid)}-${String(Date.now())}`

export function webProfileDir(): string {
  return join(dshHome(), 'profiles', WEB_PROFILE)
}

export function isSafePluginTarget(target: string): boolean {
  return TARGET_RE.test(target)
}

export function quoteCmdArg(arg: string): string {
  if (!CMD_METACHARS.test(arg)) return arg
  return `"${arg.replace(/"/g, '""')}"`
}

export function cmdCommandLine(argv: readonly string[]): string {
  return argv.map(quoteCmdArg).join(' ')
}

export function dshArgv(input: {
  argv?: readonly string[]
  execArgv?: readonly string[]
  execPath?: string
  argv0?: string
  platform?: NodeJS.Platform
} = {}): DshArgv {
  const argv = input.argv ?? process.argv
  const execArgv = input.execArgv ?? process.execArgv
  const execPath = input.execPath ?? process.execPath
  const argv0 = input.argv0 ?? process.argv0
  const platform = input.platform ?? process.platform
  const node = nodeExecutable(argv0, execPath)
  const entry = argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: node, args: [...execArgv, abs], cwd: dirname(abs), viaShell: false }
  }
  return { file: 'dsh', args: [], cwd: undefined, viaShell: platform === 'win32' }
}

export function nodeExecutable(argv0: string | undefined = process.argv0, execPath: string = process.execPath): string {
  if (argv0 !== undefined && argv0 !== '' && isAbsolute(argv0) && existsSync(argv0)) return argv0
  return execPath
}

/** pnpm 9 needs -w at a workspace root; every major rejects -w outside one. */
export function pluginArgsFor(profileDirectory: string, pluginArgs: readonly string[]): string[] {
  const args = [...pluginArgs]
  if (args[0] !== 'add' && args[0] !== 'remove') return args
  if (!existsSync(join(profileDirectory, 'pnpm-workspace.yaml'))) return args
  return [args[0], '-w', ...args.slice(1)]
}

export function preparePluginArgs(profileDirectory: string, pluginArgs: readonly string[]): string[] {
  const args = pluginArgsFor(profileDirectory, pluginArgs)
  const command = args[0]
  if (command !== undefined && NDJSON_COMMANDS.has(command)) return [...args, '--reporter=ndjson']
  return args
}

export function publicInstallStatus(): {
  active: boolean
  target: string
  seconds: number
  lastLine: string
  phase: ProgressPhase
  done: number
  total: number | null
  currentPackage: string | null
  downloaded: number | null
  size: number | null
  ndjson: boolean
  error: string | null
  boot: string
} {
  return {
    active: progress.active,
    target: progress.target,
    seconds: progress.active ? Math.round((Date.now() - progress.startedAt) / 1000) : 0,
    lastLine: progress.lastLine,
    phase: progress.phase,
    done: progress.done,
    total: progress.total,
    currentPackage: progress.currentPackage,
    downloaded: progress.downloaded,
    size: progress.size,
    ndjson: progress.ndjson,
    error: progress.error,
    boot: BOOT_ID,
  }
}

export function isPrepareBlocked(text: string): boolean {
  return /needs to execute build scripts|allowBuilds|ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED|ERR_PNPM_IGNORED_BUILDS/i.test(text)
}

export function withDangerouslyAllowAllBuilds(yaml: string): string {
  if (/(?:^|\n)dangerouslyAllowAllBuilds:\s*true\s*(?:\n|$)/.test(yaml)) return yaml
  if (/(?:^|\n)dangerouslyAllowAllBuilds:\s*/m.test(yaml)) {
    return yaml.replace(/^dangerouslyAllowAllBuilds:\s*.*$/m, 'dangerouslyAllowAllBuilds: true')
  }
  if (yaml.trim() === '') return 'dangerouslyAllowAllBuilds: true\n'
  return `${yaml.replace(/\s*$/u, '\n')}\ndangerouslyAllowAllBuilds: true\n`
}

export function writeDangerouslyAllowAllBuilds(profileDirectory: string): boolean {
  const file = join(profileDirectory, 'pnpm-workspace.yaml')
  let yaml = ''
  try {
    yaml = readFileSync(file, 'utf8')
  } catch {
    /* created below */
  }
  const next = withDangerouslyAllowAllBuilds(yaml)
  if (next === yaml) return false
  mkdirSync(profileDirectory, { recursive: true })
  writeFileSync(file, next)
  return true
}

export function rewritePnpmError(err: unknown): Error {
  const text = err instanceof Error ? err.message : String(err)
  if (isPrepareBlocked(text)) {
    return new Error('该插件需要构建脚本（prepare），pnpm 默认拦截。广场安装会写入 profile 的 dangerouslyAllowAllBuilds 并重试；若仍失败请检查 web profile 是否可写。')
  }
  if (/ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF/.test(text)) {
    return new Error('当前 profile 的 node_modules 由不同主版本的 pnpm 生成，安装前需要先重建依赖。')
  }
  return err instanceof Error ? err : new Error(text)
}

export async function runDshPlugin(
  profile: string,
  pluginArgs: string[],
  deps: {
    runCommand?: typeof runCommand
    dshArgv?: typeof dshArgv
    profileDir?: string
  } = {},
): Promise<string> {
  if (profile !== WEB_PROFILE) throw new Error('仅支持 web profile')
  const target = pluginArgs[pluginArgs.length - 1] ?? ''
  if (!isSafePluginTarget(target)) throw new Error(`拒绝不安全的安装目标: ${target}`)
  const argv = (deps.dshArgv ?? dshArgv)()
  const prepared = preparePluginArgs(deps.profileDir ?? webProfileDir(), pluginArgs)
  const tracker = beginProgress(target)
  const feed = makeProgressFeeder(tracker)
  const run = deps.runCommand ?? runCommand
  try {
    return await run(argv.file, [...argv.args, 'plugin', '--profile', profile, ...prepared], {
      cwd: argv.cwd,
      timeoutMs: INSTALL_TIMEOUT_MS,
      env: { CI: 'true' },
      viaShell: argv.viaShell,
      detached: process.platform !== 'win32',
      onChunk: (text) => {
        feed(text)
        syncProgress(tracker)
      },
    })
  } catch (err) {
    // 超时/失败时也把原因写入状态端点，轮询侧才能看到错误终态（progress.error 仅由 ndjson 同步时才被赋值）
    const text = err instanceof Error ? err.message : String(err)
    if (progress.error === null) progress.error = text.slice(0, 800)
    throw err
  } finally {
    progress.active = false
  }
}

export async function addDshPlugin(
  source: string,
  deps: {
    runDshPlugin?: PluginRunner
    profileDir?: string
    allowAllBuilds?: (profileDirectory: string) => void
  } = {},
): Promise<string> {
  const run = deps.runDshPlugin ?? runDshPlugin
  const allowAllBuilds = deps.allowAllBuilds ?? writeDangerouslyAllowAllBuilds
  const retryAfterPrepare = async (err: unknown): Promise<string> => {
    const text = err instanceof Error ? err.message : String(err)
    if (!isPrepareBlocked(text)) throw rewritePnpmError(err)
    allowAllBuilds(deps.profileDir ?? webProfileDir())
    try {
      return await run(WEB_PROFILE, ['add', source])
    } catch (retryErr) {
      throw rewritePnpmError(retryErr)
    }
  }
  try {
    return await run(WEB_PROFILE, ['add', source])
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (text.includes('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF')) {
      await run(WEB_PROFILE, ['install', '--no-frozen-lockfile'])
      try {
        return await run(WEB_PROFILE, ['add', source])
      } catch (retryErr) {
        return await retryAfterPrepare(retryErr)
      }
    }
    return await retryAfterPrepare(err)
  }
}

export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawnShim(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env, CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      viaShell: options.viaShell === true,
      detached: options.detached === true && process.platform !== 'win32',
    })
    let out = ''
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      if (err) reject(err)
      else resolvePromise(out)
    }
    const timer = setTimeout(() => {
      killChild(child)
      finish(new Error(`命令超时 ${options.timeoutMs}ms`))
    }, options.timeoutMs)
    const onAbort = () => {
      killChild(child)
      finish(new Error('命令已取消'))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      out = (out + text).slice(-256 * 1024)
      options.onChunk?.(text)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      out = (out + text).slice(-256 * 1024)
      options.onChunk?.(text)
    })
    child.on('error', (err) => finish(err))
    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(`命令失败 (exit ${code}): ${out.trim().slice(-800) || 'no output'}`))
    })
  })
}

type SpawnShimOptions = SpawnOptions & { viaShell?: boolean }

function spawnShim(file: string, args: readonly string[], options: SpawnShimOptions): ChildProcess {
  const { viaShell = false, ...spawnOptions } = options
  if (!viaShell || process.platform !== 'win32') {
    return spawn(file, [...args], { ...spawnOptions, shell: false })
  }
  const comspec = process.env.ComSpec ?? 'cmd.exe'
  return spawn(comspec, ['/d', '/s', '/c', `"${cmdCommandLine([file, ...args])}"`], {
    ...spawnOptions,
    shell: false,
    windowsVerbatimArguments: true,
  })
}

function killChild(child: ChildProcess): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGTERM')
      return
    } catch {
      /* fall through */
    }
  }
  try {
    child.kill('SIGTERM')
  } catch {
    /* already gone */
  }
}

function beginProgress(target: string): ReturnType<typeof createProgressTracker> {
  progress.active = true
  progress.target = target
  progress.startedAt = Date.now()
  progress.lastLine = ''
  progress.phase = null
  progress.done = 0
  progress.total = null
  progress.currentPackage = null
  progress.downloaded = null
  progress.size = null
  progress.ndjson = false
  progress.error = null
  return createProgressTracker()
}

function makeProgressFeeder(tracker: ReturnType<typeof createProgressTracker>): (chunk: string) => void {
  let lineBuffer = ''
  return (chunk: string): void => {
    lineBuffer += chunk
    let nl: number
    while ((nl = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, nl)
      lineBuffer = lineBuffer.slice(nl + 1)
      const trimmed = line.trim()
      if (trimmed === '') continue
      tracker.feed(trimmed)
      if (!trimmed.startsWith('{')) progress.lastLine = trimmed.slice(0, 200)
    }
  }
}

function syncProgress(tracker: ReturnType<typeof createProgressTracker>): void {
  const snap = tracker.snapshot
  progress.phase = snap.phase
  progress.done = snap.done
  progress.total = snap.total
  progress.currentPackage = snap.currentPackage
  progress.downloaded = snap.downloaded
  progress.size = snap.size
  progress.ndjson = snap.seen
  if (snap.error !== null) progress.error = snap.error
}
