/**
 * Spawn `dsh plugin` from the host process. Do not use the agent's sandboxed
 * shell: it cannot write the profile directory.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, posix, resolve, win32 } from 'node:path'
import { currentProfileDir, dshHome, isSafeProfileName, resolveRuntimeProfile } from './runtime-profile.js'
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
  env?: NodeJS.ProcessEnv
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

export { currentProfileDir } from './runtime-profile.js'

export function isSafePluginTarget(target: string): boolean {
  return TARGET_RE.test(target)
}

export function quoteCmdArg(arg: string): string {
  if (arg !== '' && !CMD_METACHARS.test(arg)) return arg
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
  electron?: boolean
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
  pathExists?: (path: string) => boolean
} = {}): DshArgv {
  const argv = input.argv ?? process.argv
  const execArgv = input.execArgv ?? process.execArgv
  const execPath = input.execPath ?? process.execPath
  const argv0 = input.argv0 ?? process.argv0
  const platform = input.platform ?? process.platform
  const path = platform === 'win32' ? win32 : posix
  const env = input.env ?? process.env
  const electron = input.electron ?? (Boolean(process.versions.electron) || env.ELECTRON_RUN_AS_NODE === '1')
  const node = electron ? execPath : nodeExecutable(argv0, execPath)
  const entry = argv[1]
  const nodeEnv = electron ? { ELECTRON_RUN_AS_NODE: '1' } : undefined
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = path.resolve(entry)
    return {
      file: node, args: [...execArgv, abs], cwd: /\.asar[\\/]/u.test(abs) ? undefined : path.dirname(abs),
      viaShell: false, ...(nodeEnv === undefined ? {} : { env: nodeEnv }),
    }
  }
  const desktopHost = entry !== undefined
    && /[\\/]@deepseek-ai[\\/]dsh-desktop-host[\\/]lib[\\/](?:index|cli)\.js$/u.test(entry)
  if (electron || desktopHost) {
    const roots: string[] = []
    const candidates: string[] = []
    if (desktopHost && entry !== undefined) {
      candidates.push(path.join(path.dirname(path.resolve(entry)), 'cli.js'))
      roots.push(path.resolve(path.dirname(entry), '../../../..'))
      if (argv[2] !== undefined && path.isAbsolute(argv[2])) roots.unshift(argv[2])
    }
    const resources = input.resourcesPath
      ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
      ?? (platform === 'darwin'
        ? path.resolve(path.dirname(execPath), '../Resources')
        : path.join(path.dirname(execPath), 'resources'))
    roots.push(path.join(resources, 'app.asar', 'dsh'), path.join(resources, 'dsh'))
    for (const root of roots) {
      candidates.push(path.join(root, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js'))
    }
    // Only the official Desktop carrier preserves bundled pnpm and grants
    // reserved-profile access. The ordinary dsh bin rejects `desktop`.
    const cli = candidates.find(input.pathExists ?? existsSync)
    if (cli === undefined) throw new Error('无法定位桌面宿主内置的 dsh CLI 管理入口，请升级或重新安装 DeepSeek Harness 桌面版。')
    return { file: execPath, args: ['--expose-internals', cli], cwd: undefined, viaShell: false, env: { ELECTRON_RUN_AS_NODE: '1' } }
  }
  return { file: 'dsh', args: [], cwd: undefined, viaShell: platform === 'win32' }
}

export function nodeExecutable(argv0: string | undefined = process.argv0, execPath: string = process.execPath): string {
  if (argv0 !== undefined && argv0 !== '' && !/\.(?:cmd|bat)$/iu.test(argv0) && isAbsolute(argv0) && existsSync(argv0)) return argv0
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
    return new Error('该插件需要构建脚本（prepare），pnpm 默认拦截。广场安装会写入 profile 的 dangerouslyAllowAllBuilds 并重试；若仍失败请检查当前 profile 是否可写。')
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
  if (!isSafeProfileName(profile)) throw new Error(`无效 profile 名称: ${profile}`)
  const target = pluginArgs[pluginArgs.length - 1] ?? ''
  if (!isSafePluginTarget(target)) throw new Error(`拒绝不安全的安装目标: ${target}`)
  const runtime = resolveRuntimeProfile(profile)
  const actualDir = resolve(runtime.dir)
  const cliDir = resolve(runtime.home, 'profiles', profile)
  if (process.platform === 'win32' ? actualDir.toLowerCase() !== cliDir.toLowerCase() : actualDir !== cliDir) {
    throw new Error(`当前 profile 目录 ${runtime.dir} 与 dsh CLI 的目标目录不一致，已取消操作`)
  }
  const argv = (deps.dshArgv ?? dshArgv)()
  const prepared = preparePluginArgs(deps.profileDir ?? runtime.dir, pluginArgs)
  const tracker = beginProgress(target)
  const feed = makeProgressFeeder(tracker)
  const run = deps.runCommand ?? runCommand
  try {
    return await run(argv.file, [...argv.args, 'plugin', '--profile', profile, ...prepared], {
      cwd: argv.cwd,
      timeoutMs: INSTALL_TIMEOUT_MS,
      env: { ...argv.env, CI: 'true', DSH_HOME: runtime.home },
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
    profile?: string
  } = {},
): Promise<string> {
  const run = deps.runDshPlugin ?? runDshPlugin
  const profile = resolveRuntimeProfile(deps.profile).name
  const allowAllBuilds = deps.allowAllBuilds ?? writeDangerouslyAllowAllBuilds
  const retryAfterPrepare = async (err: unknown): Promise<string> => {
    const text = err instanceof Error ? err.message : String(err)
    if (!isPrepareBlocked(text)) throw rewritePnpmError(err)
    allowAllBuilds(deps.profileDir ?? currentProfileDir(profile))
    try {
      return await run(profile, ['add', source])
    } catch (retryErr) {
      throw rewritePnpmError(retryErr)
    }
  }
  try {
    return await run(profile, ['add', source])
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (text.includes('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF')) {
      await run(profile, ['install', '--no-frozen-lockfile'])
      try {
        return await run(profile, ['add', source])
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
    // Readable's UTF-8 decoder retains partial multibyte characters between chunks.
    // stdout and stderr need independent decoder state.
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (text: string) => {
      out = (out + text).slice(-256 * 1024)
      options.onChunk?.(text)
    })
    child.stderr?.on('data', (text: string) => {
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
  // cmd diagnostics otherwise use the system OEM code page (CP936 on Chinese
  // Windows), while Node/pnpm emit UTF-8. Select one encoding before execution.
  return spawn(comspec, ['/d', '/v:off', '/s', '/c', `"chcp 65001>nul && ${cmdCommandLine([file, ...args])}"`], {
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
