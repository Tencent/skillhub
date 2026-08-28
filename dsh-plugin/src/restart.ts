/**
 * Self-restart: relaunch the DSH invocation that booted this host so a
 * freshly installed plugin loads without leaving the UI.
 *
 * Safety: same-origin browser request (Origin matches Host or
 * X-Forwarded-Host). Loopback without proxy headers still passes. Reverse
 * proxies (Tencent Cloud path prefix, LAN HTTPS) set X-Forwarded-For, so
 * those headers must not by themselves reject a same-origin UI click.
 *
 * Supervised hosts: systemd KillMode=control-group reaps a detached helper
 * when this process exits, and Restart=on-failure does not bring the unit
 * back after SIGTERM. Ask systemd to restart the unit instead of respawning
 * `dsh web` ourselves.
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dshArgv, nodeExecutable } from './dsh-cli.js'

function headerString(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = String(value || '').trim()
  return trimmed === '' ? undefined : trimmed.split(',')[0]!.trim()
}

function parseHost(raw: string): { hostname: string; port: string } | null {
  try {
    const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`)
    return { hostname: parsed.hostname.toLowerCase(), port: parsed.port }
  } catch {
    return null
  }
}

function isLoopbackHost(host: string): boolean {
  const parsed = parseHost(host)
  if (parsed === null) return false
  return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1'
}

function hostsMatch(originHost: string, candidate: string): boolean {
  const a = parseHost(originHost)
  const b = parseHost(candidate)
  if (a === null || b === null) return false
  if (a.hostname !== b.hostname) return false
  if (a.port !== '' && b.port !== '' && a.port !== b.port) return false
  return true
}

export function servingPort(request: Pick<IncomingMessage, 'headers'>): number | null {
  const host = headerString(request.headers.host)
  if (host === undefined || !isLoopbackHost(host)) return null
  const match = /:(\d{1,5})$/u.exec(host)
  if (match === null) return null
  const port = Number(match[1])
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null
}

export function trustedRestartRequest(request: Pick<IncomingMessage, 'headers' | 'socket'>): boolean {
  const origin = headerString(request.headers.origin)
  if (origin === undefined) return false
  let from: string
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    from = parsed.host
  } catch {
    return false
  }
  const host = headerString(request.headers.host)
  const forwardedHost = headerString(request.headers['x-forwarded-host'])
  const candidates = [host, forwardedHost].filter((value): value is string => value !== undefined)
  return candidates.some((candidate) => hostsMatch(from, candidate))
}

export function restartLaunch(): { file: string; args: string[]; cwd: string; viaShell: boolean } {
  const launch = dshArgv()
  return {
    ...launch,
    args: [...launch.args, ...process.argv.slice(2)],
    cwd: launch.cwd ?? process.cwd(),
  }
}

export function respawnInvocation(
  launch: { file: string; args: string[]; viaShell: boolean },
  platform: NodeJS.Platform = process.platform,
): { file: string; args: string[]; viaShell: boolean; detached: boolean } {
  if (platform !== 'win32') {
    return { file: launch.file, args: launch.args, viaShell: launch.viaShell, detached: true }
  }
  const quote = (part: string): string => `'${part.replace(/'/g, "''")}'`
  return {
    file: 'powershell.exe',
    args: ['-NoProfile', '-WindowStyle', 'Hidden', '-Command',
      [`& ${quote(launch.file)}`, ...launch.args.map(quote)].join(' ')],
    viaShell: false,
    detached: false,
  }
}

export interface RestartResult {
  pid: number
  helperPid: number | undefined
  logOut: string
  logErr: string
  via: 'helper' | 'systemd'
}

export function readProcCgroup(
  readFile: (path: string, encoding: 'utf8') => string = (path, encoding) => readFileSync(path, encoding),
): string {
  try {
    return readFile('/proc/self/cgroup', 'utf8')
  } catch {
    return ''
  }
}

export function systemdUnitName(cgroupText: string): string | null {
  for (const line of cgroupText.split(/\r?\n/u)) {
    if (line.trim() === '') continue
    const path = line.includes(':') ? line.slice(line.lastIndexOf(':') + 1) : line
    const parts = path.split('/').filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]!
      if (!part.endsWith('.service')) continue
      if (/^user@\d+\.service$/u.test(part)) continue
      return part
    }
  }
  return null
}

export function systemdRestartArgv(opts: { cgroup: string; uid: number }): { file: string; args: string[] } | null {
  const unit = systemdUnitName(opts.cgroup)
  if (unit === null) return null
  if (opts.cgroup.includes('/user.slice/')) {
    return { file: 'systemctl', args: ['--user', 'restart', '--no-block', unit] }
  }
  if (opts.uid === 0) {
    return { file: 'systemctl', args: ['restart', '--no-block', unit] }
  }
  return { file: 'sudo', args: ['-n', 'systemctl', 'restart', '--no-block', unit] }
}

export function restartHelperSource(
  spawned: { file: string; args: string[]; viaShell: boolean; detached: boolean },
  launch: { cwd: string },
  logs: { out: string; err: string },
  port: number | null,
): string {
  return [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    "const net = require('node:net')",
    `const file = ${JSON.stringify(spawned.file)}`,
    `const args = ${JSON.stringify(spawned.args)}`,
    `const cwd = ${JSON.stringify(launch.cwd)}`,
    `const viaShell = ${JSON.stringify(spawned.viaShell)}`,
    `const detached = ${JSON.stringify(spawned.detached)}`,
    `const logOut = ${JSON.stringify(logs.out)}`,
    `const logErr = ${JSON.stringify(logs.err)}`,
    `const port = ${JSON.stringify(port)}`,
    'const sleep = (ms) => new Promise(r => setTimeout(r, ms))',
    'const note = (line) => { try { fs.appendFileSync(logErr, `[skillhub] ${line}\\n`) } catch {} }',
    'const listening = () => new Promise((resolve) => {',
    '  const probe = net.connect({ host: "127.0.0.1", port })',
    '  const done = (value) => { probe.destroy(); resolve(value) }',
    '  probe.on("connect", () => done(true))',
    '  probe.on("error", () => done(false))',
    '  setTimeout(() => done(false), 500)',
    '})',
    'const main = async () => {',
    '  if (port) {',
    '    const until = Date.now() + 30000',
    '    while (Date.now() < until && await listening()) await sleep(250)',
    '    if (await listening()) note(`port ${port} was still in use after 30s; starting anyway`)',
    '    await sleep(300)',
    '  } else {',
    '    await sleep(1500)',
    '  }',
    '  let child',
    '  try {',
    '    const out = fs.openSync(logOut, "a")',
    '    const err = fs.openSync(logErr, "a")',
    '    child = spawn(file, args, { cwd, detached, stdio: ["ignore", out, err], env: process.env, shell: viaShell })',
    '    child.on("error", (error) => note(`could not start the replacement: ${error && error.message ? error.message : error}`))',
    '    child.unref()',
    '  } catch (error) {',
    '    note(`could not start the replacement: ${error && error.message ? error.message : error}`)',
    '    return',
    '  }',
    '  if (!port) { await sleep(3000); return }',
    '  const upBy = Date.now() + 20000',
    '  while (Date.now() < upBy && !(await listening())) await sleep(500)',
    '  if (!(await listening())) note(`the replacement did not bind port ${port} within 20s — see the output log beside this one`)',
    '}',
    'main()',
  ].join('\n')
}

export function scheduleRestart(
  port: number | null = null,
  deps: {
    spawn?: typeof spawn
    nodeExecutable?: typeof nodeExecutable
    restartLaunch?: typeof restartLaunch
    kill?: typeof process.kill
    setTimeout?: typeof setTimeout
    pid?: number
    cgroup?: string
    uid?: number
  } = {},
): RestartResult {
  const pid = deps.pid ?? process.pid
  const systemd = systemdRestartArgv({
    cgroup: deps.cgroup ?? readProcCgroup(),
    uid: deps.uid ?? (typeof process.getuid === 'function' ? process.getuid() : 1),
  })
  if (systemd !== null) {
    ;(deps.setTimeout ?? setTimeout)(() => {
      const helper = (deps.spawn ?? spawn)(systemd.file, systemd.args, {
        detached: true,
        stdio: 'ignore',
        env: process.env,
      })
      helper.unref()
    }, 500)
    return { pid, helperPid: undefined, logOut: '', logErr: '', via: 'systemd' }
  }
  const launch = (deps.restartLaunch ?? restartLaunch)()
  const spawned = respawnInvocation(launch)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logOut = join(tmpdir(), `skillhub-restart-${stamp}.out.log`)
  const logErr = join(tmpdir(), `skillhub-restart-${stamp}.err.log`)
  const helper = (deps.spawn ?? spawn)(
    (deps.nodeExecutable ?? nodeExecutable)(),
    ['-e', restartHelperSource(spawned, launch, { out: logOut, err: logErr }, port)],
    {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    },
  )
  helper.unref()
  ;(deps.setTimeout ?? setTimeout)(() => (deps.kill ?? process.kill)(pid, 'SIGTERM'), 500)
  return { pid, helperPid: helper.pid, logOut, logErr, via: 'helper' }
}
