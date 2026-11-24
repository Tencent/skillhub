import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export interface RuntimeProfileHost {
  get?(name: string): unknown
  profileContext?: unknown
}

export interface RuntimeProfile {
  name: string
  dir: string
  home: string
}

interface ProfileContext {
  name: string
  dir?: string
  home?: string
}

let boundHost: RuntimeProfileHost | undefined

/** DSH provides profileContext before mounting profile plugins, including Desktop. */
export function bindRuntimeProfileHost(host: RuntimeProfileHost | undefined): void {
  boundHost = host
}

export function isSafeProfileName(value: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}._ -]{0,99}$/u.test(value) && !value.includes('..') && value !== 'node_modules'
}

export function isDesktopHost(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(process.versions.electron) || env.ELECTRON_RUN_AS_NODE === '1'
    || /[\\/]@deepseek-ai[\\/]dsh-desktop-host[\\/]lib[\\/](?:index|cli)\.js$/.test(argv[1] ?? '')
}

function profileContext(host: RuntimeProfileHost | undefined): ProfileContext | undefined {
  const raw = host?.get?.('profileContext') ?? host?.profileContext
  if (!raw || typeof raw !== 'object') return undefined
  const context = raw as Record<string, unknown>
  const name = typeof context.name === 'string' ? context.name.trim() : ''
  if (!isSafeProfileName(name)) throw new Error('当前宿主的 profile 名称无效')
  return {
    name,
    dir: typeof context.dir === 'string' && isAbsolute(context.dir) ? context.dir : undefined,
    home: typeof context.home === 'string' && isAbsolute(context.home) ? context.home : undefined,
  }
}

export function dshHome(): string {
  const context = profileContext(boundHost)
  return context?.home ?? (context?.dir ? dirname(dirname(context.dir)) : undefined)
    ?? (process.env.DSH_HOME || join(homedir(), '.dsh'))
}

/** Prefer the host's actual profile over command-line hints or the legacy web default. */
export function resolveRuntimeProfile(
  explicitProfile?: string,
  input: { host?: RuntimeProfileHost; argv?: readonly string[]; electron?: boolean; home?: string } = {},
): RuntimeProfile {
  const context = profileContext(input.host ?? boundHost)
  const home = input.home ?? context?.home ?? (context?.dir ? dirname(dirname(context.dir)) : undefined)
    ?? (process.env.DSH_HOME || join(homedir(), '.dsh'))
  const argv = input.argv ?? process.argv
  const desktop = input.electron ?? isDesktopHost(argv)
  const cliEntry = /(?:^|[\\/])(?:bin\.(?:js|ts)|dsh)$/.test(argv[1] ?? '')
    || /[\\/]@deepseek-ai[\\/]dsh-desktop-host[\\/]lib[\\/]cli\.js$/.test(argv[1] ?? '')
  let name = String(explicitProfile ?? '').trim()
  if (!name) name = context?.name ?? ''
  // Desktop's internal host takes directories; its public CLI accepts profile arguments.
  if (!name && desktop && !cliEntry) name = 'desktop'
  if (!name) {
    const args = argv.slice(2)
    for (let i = 0; i < args.length && args[i] !== '--'; i++) {
      if (args[i] === '--profile') {
        name = args[i + 1] ?? ''
        if (!name || name.startsWith('-')) throw new Error('启动参数缺少 profile 名称')
        break
      }
      if (args[i].startsWith('--profile=')) {
        name = args[i].slice('--profile='.length)
        if (!name) throw new Error('启动参数缺少 profile 名称')
        break
      }
    }
    if (!name && args[0] && !args[0].startsWith('-') && args[0] !== 'plugin') name = args[0]
  }
  if (!name) name = desktop ? 'desktop' : 'web'
  if (!isSafeProfileName(name)) throw new Error(`无效 profile 名称: ${name}`)
  return { name, dir: context?.name === name && context.dir ? resolve(context.dir) : join(home, 'profiles', name), home }
}

export function currentProfileDir(profile?: string): string {
  return resolveRuntimeProfile(profile).dir
}
