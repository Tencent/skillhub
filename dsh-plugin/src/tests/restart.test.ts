import assert from 'node:assert/strict'
import test from 'node:test'
import {
  readProcCgroup,
  respawnInvocation,
  restartHelperSource,
  restartLaunch,
  scheduleRestart,
  servingPort,
  systemdRestartArgv,
  systemdUnitName,
  trustedRestartRequest,
} from '../restart.js'

test('servingPort reads loopback Host and ignores public proxy ports', () => {
  assert.equal(servingPort({ headers: { host: '127.0.0.1:3080' } }), 3080)
  assert.equal(servingPort({ headers: { host: 'localhost:3081' } }), 3081)
  assert.equal(servingPort({ headers: { host: 'localhost' } }), null)
  assert.equal(servingPort({ headers: {} }), null)
  assert.equal(servingPort({ headers: { host: '127.0.0.1:99999' } }), null)
  assert.equal(servingPort({ headers: { host: '127.0.0.1:0' } }), null)
  assert.equal(servingPort({ headers: { host: '43.160.246.58:34073' } }), null)
})

test('trustedRestartRequest accepts same-origin UI clicks, including reverse proxies', () => {
  const ok = { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }
  const req = (headers: Record<string, string>, remoteAddress = '127.0.0.1') =>
    ({ headers, socket: { remoteAddress } }) as Parameters<typeof trustedRestartRequest>[0]
  assert.equal(trustedRestartRequest(req(ok)), true)
  assert.equal(trustedRestartRequest(req(ok, '::1')), true)
  assert.equal(trustedRestartRequest(req(ok, '::ffff:127.0.0.1')), true)
  assert.equal(trustedRestartRequest(req(ok, '192.168.1.5')), true)
  assert.equal(trustedRestartRequest(req({ ...ok, forwarded: 'for=1.2.3.4' })), true)
  assert.equal(trustedRestartRequest(req({ ...ok, 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4' })), true)
  assert.equal(trustedRestartRequest(req({
    host: '127.0.0.1:3080',
    origin: 'https://43.160.246.58:34073',
    'x-forwarded-host': '43.160.246.58:34073',
    'x-forwarded-for': '1.2.3.4',
  }, '10.0.0.2')), true)
  assert.equal(trustedRestartRequest(req({
    host: '43.160.246.58:34073',
    origin: 'https://43.160.246.58:34073',
    'x-forwarded-for': '1.2.3.4',
  })), true)
  assert.equal(trustedRestartRequest(req({
    host: '127.0.0.1:3080',
    origin: 'https://43.160.246.58:34073',
    'x-forwarded-host': '43.160.246.58',
  })), true)
  assert.equal(trustedRestartRequest(req({ host: '127.0.0.1:3080' })), false)
  assert.equal(trustedRestartRequest(req({ ...ok, origin: 'http://evil.example' })), false)
  assert.equal(trustedRestartRequest(req({ ...ok, origin: 'not a url' })), false)
  assert.equal(trustedRestartRequest(req({ ...ok, origin: 'file://127.0.0.1:3080' })), false)
  assert.equal(trustedRestartRequest(req({ origin: 'http://127.0.0.1:3080' })), false)
  assert.equal(trustedRestartRequest({ headers: ok, socket: {} } as Parameters<typeof trustedRestartRequest>[0]), true)
})

test('respawnInvocation wraps win32 in hidden PowerShell and keeps POSIX detached', () => {
  const launch = { file: 'C:\\Program Files\\nodejs\\node.exe', args: ['bin.js', 'web'], viaShell: false }
  const win = respawnInvocation(launch, 'win32')
  assert.equal(win.file, 'powershell.exe')
  assert.deepEqual(win.args.slice(0, 4), ['-NoProfile', '-WindowStyle', 'Hidden', '-Command'])
  assert.equal(win.args[4], "& 'C:\\Program Files\\nodejs\\node.exe' 'bin.js' 'web'")
  assert.equal(win.detached, false)
  const quoted = respawnInvocation({ file: "C:\\it's here\\dsh.cmd", args: [], viaShell: true }, 'win32')
  assert.equal(quoted.args[4], "& 'C:\\it''s here\\dsh.cmd'")
  assert.deepEqual(respawnInvocation({ file: 'node', args: ['bin.ts'], viaShell: false }, 'linux'), {
    file: 'node',
    args: ['bin.ts'],
    viaShell: false,
    detached: true,
  })
})

test('restartHelperSource waits for the port and names skillhub in logs', () => {
  const src = restartHelperSource(
    { file: 'node', args: ['bin.js'], viaShell: false, detached: true },
    { cwd: '/tmp' },
    { out: '/tmp/out.log', err: '/tmp/err.log' },
    3080,
  )
  assert.match(src, /\[skillhub\]/)
  assert.match(src, /port/)
  assert.match(src, /3080/)
  assert.match(src, /net\.connect/)
  const noPort = restartHelperSource(
    { file: 'node', args: ['bin.js'], viaShell: false, detached: true },
    { cwd: '/tmp' },
    { out: '/tmp/out.log', err: '/tmp/err.log' },
    null,
  )
  assert.match(noPort, /await sleep\(1500\)/)
})

test('restartLaunch reuses the current process cwd', () => {
  const launch = restartLaunch()
  assert.ok(launch.file)
  assert.ok(Array.isArray(launch.args))
  assert.equal(typeof launch.cwd, 'string')
})

test('scheduleRestart spawns a helper then SIGTERMs the host later', () => {
  const timeouts: Array<{ fn: () => void; ms: number }> = []
  let killed: { pid: number; signal: NodeJS.Signals } | undefined
  let unrefed = false
  const spawned: { file: string; args: string[] }[] = []
  const result = scheduleRestart(3080, {
    spawn: ((file: string, args: string[]) => {
      spawned.push({ file, args })
      return { pid: 77, unref() { unrefed = true } }
    }) as typeof import('node:child_process').spawn,
    nodeExecutable: () => '/usr/bin/node',
    restartLaunch: () => ({ file: 'node', args: ['bin.js', 'web'], cwd: '/tmp', viaShell: false }),
    kill: ((pid: number, signal?: NodeJS.Signals) => {
      killed = { pid, signal: signal ?? 'SIGTERM' }
      return true
    }) as typeof process.kill,
    setTimeout: ((fn: () => void, ms?: number) => {
      timeouts.push({ fn, ms: Number(ms) })
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout,
    pid: 1234,
    cgroup: '',
  })
  assert.equal(result.pid, 1234)
  assert.equal(result.via, 'helper')
  assert.equal(result.helperPid, 77)
  assert.match(result.logOut, /skillhub-restart-/)
  assert.match(result.logErr, /skillhub-restart-/)
  assert.equal(unrefed, true)
  assert.equal(spawned[0]?.file, '/usr/bin/node')
  assert.equal(spawned[0]?.args[0], '-e')
  assert.match(String(spawned[0]?.args[1]), /3080/)
  assert.equal(timeouts[0]?.ms, 500)
  assert.equal(killed, undefined)
  timeouts[0]?.fn()
  assert.deepEqual(killed, { pid: 1234, signal: 'SIGTERM' })
})

test('systemdUnitName reads the innermost service and skips user@', () => {
  assert.equal(systemdUnitName('0::/system.slice/deepseek-harness.service\n'), 'deepseek-harness.service')
  assert.equal(
    systemdUnitName('1:name=systemd:/system.slice/deepseek-harness.service'),
    'deepseek-harness.service',
  )
  assert.equal(
    systemdUnitName('0::/user.slice/user-1000.slice/user@1000.service/app.slice/dsh.service'),
    'dsh.service',
  )
  assert.equal(systemdUnitName('0::/user.slice/user-1000.slice/user@1000.service'), null)
  assert.equal(systemdUnitName('0::/docker/0123456789abcdef'), null)
  assert.equal(systemdUnitName(''), null)
})

test('systemdRestartArgv uses passwordless sudo for system units', () => {
  const system = '0::/system.slice/deepseek-harness.service'
  assert.deepEqual(systemdRestartArgv({ cgroup: system, uid: 1000 }), {
    file: 'sudo',
    args: ['-n', 'systemctl', 'restart', '--no-block', 'deepseek-harness.service'],
  })
  assert.deepEqual(systemdRestartArgv({ cgroup: system, uid: 0 }), {
    file: 'systemctl',
    args: ['restart', '--no-block', 'deepseek-harness.service'],
  })
  assert.deepEqual(systemdRestartArgv({
    cgroup: '0::/user.slice/user-1000.slice/user@1000.service/app.slice/dsh.service',
    uid: 1000,
  }), {
    file: 'systemctl',
    args: ['--user', 'restart', '--no-block', 'dsh.service'],
  })
  assert.equal(systemdRestartArgv({ cgroup: '', uid: 1000 }), null)
})

test('scheduleRestart asks systemd to restart the unit and does not SIGTERM', () => {
  const timeouts: Array<{ fn: () => void; ms: number }> = []
  let killed: { pid: number; signal: NodeJS.Signals } | undefined
  let unrefed = false
  const spawned: { file: string; args: string[] }[] = []
  const result = scheduleRestart(3080, {
    spawn: ((file: string, args: string[]) => {
      spawned.push({ file, args })
      return { pid: 88, unref() { unrefed = true } }
    }) as typeof import('node:child_process').spawn,
    kill: ((pid: number, signal?: NodeJS.Signals) => {
      killed = { pid, signal: signal ?? 'SIGTERM' }
      return true
    }) as typeof process.kill,
    setTimeout: ((fn: () => void, ms?: number) => {
      timeouts.push({ fn, ms: Number(ms) })
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout,
    pid: 1234,
    uid: 1000,
    cgroup: '0::/system.slice/deepseek-harness.service',
  })
  assert.equal(result.via, 'systemd')
  assert.equal(result.helperPid, undefined)
  assert.equal(result.logOut, '')
  assert.equal(spawned.length, 0)
  assert.equal(killed, undefined)
  timeouts[0]?.fn()
  assert.deepEqual(spawned[0], {
    file: 'sudo',
    args: ['-n', 'systemctl', 'restart', '--no-block', 'deepseek-harness.service'],
  })
  assert.equal(unrefed, true)
  assert.equal(killed, undefined)
})

test('readProcCgroup returns empty when /proc/self/cgroup is missing', () => {
  assert.equal(readProcCgroup(() => { throw new Error('ENOENT') }), '')
  assert.equal(readProcCgroup(() => '0::/system.slice/foo.service\n'), '0::/system.slice/foo.service\n')
})
