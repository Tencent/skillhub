import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, win32 } from 'node:path'
import test from 'node:test'
import {
  addDshPlugin,
  cmdCommandLine,
  dshArgv,
  isPrepareBlocked,
  isSafePluginTarget,
  nodeExecutable,
  pluginArgsFor,
  preparePluginArgs,
  progress,
  publicInstallStatus,
  quoteCmdArg,
  rewritePnpmError,
  runCommand,
  runDshPlugin,
  withDangerouslyAllowAllBuilds,
  writeDangerouslyAllowAllBuilds,
} from '../dsh-cli.js'

test('dshArgv reuses the launching CLI entry', () => {
  const fromSource = dshArgv({
    argv: [process.execPath, '/tmp/dsh/src/bin.ts'],
    execArgv: ['--import', 'tsx/esm'],
    execPath: '/usr/bin/node',
    argv0: 'node',
    platform: 'linux',
  })
  assert.equal(fromSource.file, '/usr/bin/node')
  assert.deepEqual(fromSource.args, ['--import', 'tsx/esm', '/tmp/dsh/src/bin.ts'])
  assert.equal(fromSource.cwd, '/tmp/dsh/src')
  assert.equal(fromSource.viaShell, false)

  const fromPath = dshArgv({
    argv: [process.execPath, '/tmp/app.js'],
    execPath: process.execPath,
    platform: 'linux',
  })
  assert.equal(fromPath.file, 'dsh')
  assert.deepEqual(fromPath.args, [])
  assert.equal(fromPath.viaShell, false)

  const win = dshArgv({ argv: [process.execPath, 'index.js'], platform: 'win32' })
  assert.equal(win.file, 'dsh')
  assert.equal(win.viaShell, true)
})

test('dshArgv recognizes bin.js and a trailing dsh entry', () => {
  const binJs = dshArgv({ argv: ['node', '/opt/dsh/bin.js'], execArgv: [], execPath: '/opt/node', argv0: 'node', platform: 'linux' })
  assert.equal(binJs.file, '/opt/node')
  assert.deepEqual(binJs.args, ['/opt/dsh/bin.js'])
  const dshBin = dshArgv({ argv: ['node', '/usr/local/bin/dsh'], execArgv: [], execPath: '/usr/bin/node', argv0: 'node', platform: 'linux' })
  assert.equal(dshBin.file, '/usr/bin/node')
  assert.deepEqual(dshBin.args, ['/usr/local/bin/dsh'])
})

test('dshArgv locates the Desktop CLI carrier beside the host and runs Electron in Node mode', async () => {
  const root = mkdtempSync(join(tmpdir(), 'skillhub 桌面 runtime-'))
  try {
    const runtime = join(root, 'resources', 'app.asar', 'dsh')
    const host = join(runtime, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'index.js')
    const cli = join(dirname(host), 'cli.js')
    mkdirSync(dirname(host), { recursive: true })
    writeFileSync(cli, "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), node: process.env.ELECTRON_RUN_AS_NODE }))")
    const launch = dshArgv({
      argv: [process.execPath, host, runtime, root], execArgv: ['--inspect=127.0.0.1:9230'],
      execPath: process.execPath, electron: true,
    })
    assert.equal(launch.file, process.execPath)
    assert.deepEqual(launch.args, ['--expose-internals', cli])
    assert.deepEqual(launch.env, { ELECTRON_RUN_AS_NODE: '1' })
    assert.equal(launch.cwd, undefined, 'an ASAR directory cannot be used as a child process cwd')
    assert.equal(launch.viaShell, false)
    const out = await runDshPlugin('web', ['add', '@scope/plugin'], { dshArgv: () => launch, profileDir: root })
    assert.deepEqual(JSON.parse(out), {
      args: ['plugin', '--profile', 'web', 'add', '@scope/plugin', '--reporter=ndjson'], node: '1',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dshArgv finds packaged Windows and macOS Desktop runtimes with spaces and Chinese paths', () => {
  const resources = 'C:\\Program Files\\深度求索\\resources'
  const cli = win32.join(resources, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
  const executable = 'C:\\Program Files\\深度求索\\DeepSeek Harness.exe'
  const windows = dshArgv({
    argv: [executable, win32.join(resources, 'app.asar', 'lib', 'main.js')],
    execPath: executable, electron: true, platform: 'win32', pathExists: (path) => path === cli,
  })
  assert.equal(windows.file, executable)
  assert.deepEqual(windows.args, ['--expose-internals', cli])
  assert.deepEqual(windows.env, { ELECTRON_RUN_AS_NODE: '1' })
  assert.equal(windows.viaShell, false)
  const macCli = '/Applications/深度 求索.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'
  const mac = dshArgv({
    argv: [], execPath: '/Applications/深度 求索.app/Contents/MacOS/DeepSeek Harness',
    electron: true, platform: 'darwin', pathExists: (path) => path === macCli,
  })
  assert.deepEqual(mac.args, ['--expose-internals', macCli])
})

test('dshArgv rejects Desktop runtimes without the official CLI carrier', () => {
  const root = '/desktop/runtime'
  const host = `${root}/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js`
  const cli = `${root}/node_modules/@deepseek-ai/dsh/lib/bin.js`
  assert.throws(() => dshArgv({
    argv: ['/desktop/electron', host, root], execPath: '/desktop/electron', platform: 'linux',
    electron: false, pathExists: (path) => path === cli,
  }), /请升级或重新安装 DeepSeek Harness 桌面版/)
  assert.throws(() => dshArgv({
    argv: [], execPath: '/desktop/electron', platform: 'linux', env: { ELECTRON_RUN_AS_NODE: '1' },
    resourcesPath: '/custom/resources', pathExists: () => false,
  }), /无法定位桌面宿主内置的 dsh CLI/)
})

test('dshArgv preserves direct Windows CLI paths and avoids ASAR working directories', () => {
  const executable = 'C:\\Program Files\\DeepSeek Harness.exe'
  const entry = 'C:\\Program Files\\resources\\app.asar\\dsh\\lib\\bin.js'
  const launch = dshArgv({
    argv: [executable, entry], execArgv: ['--expose-internals'], execPath: executable,
    electron: true, platform: 'win32',
  })
  assert.deepEqual(launch.args, ['--expose-internals', entry])
  assert.equal(launch.cwd, undefined)
  assert.deepEqual(launch.env, { ELECTRON_RUN_AS_NODE: '1' })
})

test('nodeExecutable prefers an existing absolute argv0', () => {
  assert.equal(nodeExecutable(process.execPath, '/not-used'), process.execPath)
  assert.equal(nodeExecutable('node', '/usr/bin/node'), '/usr/bin/node')
  assert.equal(nodeExecutable('', '/usr/bin/node'), '/usr/bin/node')
  const root = mkdtempSync(join(tmpdir(), 'skillhub-node-shim-'))
  try {
    const shim = join(root, 'node.cmd')
    writeFileSync(shim, '@echo off\r\n')
    assert.equal(nodeExecutable(shim, process.execPath), process.execPath)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('pluginArgsFor injects -w only at a workspace root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-ws-'))
  try {
    assert.deepEqual(pluginArgsFor(dir, ['add', 'pkg']), ['add', 'pkg'])
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n')
    assert.deepEqual(pluginArgsFor(dir, ['add', 'pkg']), ['add', '-w', 'pkg'])
    assert.deepEqual(pluginArgsFor(dir, ['remove', 'pkg']), ['remove', '-w', 'pkg'])
    assert.deepEqual(pluginArgsFor(dir, ['install']), ['install'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('isSafePluginTarget allows github pins and rejects metacharacters', () => {
  assert.equal(isSafePluginTarget('github:liustack/modlens#cb481974e1154afffd3835689284d3d28e57c7e1'), true)
  assert.equal(isSafePluginTarget('@cocofhu/skillhub'), true)
  assert.equal(isSafePluginTarget('skillhub-plugin'), true)
  assert.equal(isSafePluginTarget('--no-frozen-lockfile'), true)
  assert.equal(isSafePluginTarget('foo;rm'), false)
  assert.equal(isSafePluginTarget('a b'), false)
})

test('quoteCmdArg and cmdCommandLine quote cmd metacharacters', () => {
  assert.equal(quoteCmdArg('plain'), 'plain')
  assert.equal(quoteCmdArg(''), '""')
  assert.equal(quoteCmdArg('a b'), '"a b"')
  assert.equal(quoteCmdArg('say "hi"'), '"say ""hi"""')
  assert.equal(cmdCommandLine(['dsh', 'plugin', 'add', 'github:o/n#abc']), 'dsh plugin add github:o/n#abc')
})

test('rewritePnpmError maps known pnpm traps', () => {
  assert.match(rewritePnpmError(new Error('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED')).message, /构建脚本/)
  assert.match(rewritePnpmError(new Error('needs to execute build scripts')).message, /dangerouslyAllowAllBuilds/)
  assert.match(rewritePnpmError(new Error('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF')).message, /不同主版本/)
  const other = new Error('nope')
  assert.equal(rewritePnpmError(other), other)
  assert.equal(rewritePnpmError('raw').message, 'raw')
})

test('withDangerouslyAllowAllBuilds is idempotent and flips false to true', () => {
  assert.equal(withDangerouslyAllowAllBuilds(''), 'dangerouslyAllowAllBuilds: true\n')
  assert.equal(
    withDangerouslyAllowAllBuilds('packages:\n  - .\n'),
    'packages:\n  - .\n\ndangerouslyAllowAllBuilds: true\n',
  )
  const allowed = 'packages:\n  - .\n\ndangerouslyAllowAllBuilds: true\n'
  assert.equal(withDangerouslyAllowAllBuilds(allowed), allowed)
  assert.equal(
    withDangerouslyAllowAllBuilds('dangerouslyAllowAllBuilds: false\n'),
    'dangerouslyAllowAllBuilds: true\n',
  )
  const created = mkdtempSync(join(tmpdir(), 'skillhub-allow-create-'))
  try {
    assert.equal(writeDangerouslyAllowAllBuilds(created), true)
    assert.match(readFileSync(join(created, 'pnpm-workspace.yaml'), 'utf8'), /dangerouslyAllowAllBuilds: true/)
  } finally {
    rmSync(created, { recursive: true, force: true })
  }
})

test('runDshPlugin spawns dsh plugin add with the pinned source', async () => {
  const seen: { file: string; args: string[] }[] = []
  const log = await runDshPlugin('web', ['add', 'github:o/n#abcdef0'], {
    runCommand: async (file, args) => {
      seen.push({ file, args })
      return 'ok'
    },
    dshArgv: () => ({ file: 'dsh', args: [], cwd: '/tmp', viaShell: false }),
    profileDir: '/tmp/no-workspace',
  })
  assert.equal(log, 'ok')
  assert.deepEqual(seen[0], { file: 'dsh', args: ['plugin', '--profile', 'web', 'add', 'github:o/n#abcdef0', '--reporter=ndjson'] })
})

test('runDshPlugin injects -w when the profile is a workspace', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-profile-'))
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n')
    let args: string[] = []
    await runDshPlugin('web', ['add', '@scope/pkg'], {
      runCommand: async (_file, argv) => {
        args = argv
        return ''
      },
      dshArgv: () => ({ file: '/usr/bin/node', args: ['/opt/dsh/bin.js'], cwd: '/opt/dsh', viaShell: false }),
      profileDir: dir,
    })
    assert.deepEqual(args, ['/opt/dsh/bin.js', 'plugin', '--profile', 'web', 'add', '-w', '@scope/pkg', '--reporter=ndjson'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runDshPlugin rejects unsafe profiles and unsafe targets', async () => {
  await assert.rejects(() => runDshPlugin('../desktop', ['add', 'pkg']), /profile/)
  await assert.rejects(() => runDshPlugin('web', ['add', 'pkg && reboot']), /不安全/)
})

test('addDshPlugin retries once after a hoist-pattern failure', async () => {
  const seen: string[][] = []
  let n = 0
  const log = await addDshPlugin('github:o/n#abcdef0', {
    runDshPlugin: async (profile, args) => {
      seen.push([profile, ...args])
      n += 1
      if (n === 1) throw new Error('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF in modules')
      return 'rebuilt'
    },
  })
  assert.equal(log, 'rebuilt')
  assert.deepEqual(seen, [
    ['web', 'add', 'github:o/n#abcdef0'],
    ['web', 'install', '--no-frozen-lockfile'],
    ['web', 'add', 'github:o/n#abcdef0'],
  ])
})

test('addDshPlugin allows prepare scripts and retries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-allow-'))
  try {
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
    const seen: string[][] = []
    let n = 0
    const log = await addDshPlugin('github:o/n#abcdef0', {
      profileDir: dir,
      runDshPlugin: async (profile, args) => {
        seen.push([profile, ...args])
        n += 1
        if (n === 1) throw new Error('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED needs to execute build scripts')
        return 'allowed'
      },
    })
    assert.equal(log, 'allowed')
    assert.deepEqual(seen, [
      ['web', 'add', 'github:o/n#abcdef0'],
      ['web', 'add', 'github:o/n#abcdef0'],
    ])
    assert.match(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8'), /dangerouslyAllowAllBuilds: true/)
    assert.equal(writeDangerouslyAllowAllBuilds(dir), false)
    assert.equal(isPrepareBlocked('ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: esbuild'), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('addDshPlugin rewrites leftover hoist and prepare errors', async () => {
  await assert.rejects(
    () => addDshPlugin('github:o/n#abcdef0', {
      allowAllBuilds: () => undefined,
      runDshPlugin: async () => {
        throw new Error('The git-hosted package "x@1" needs to execute build scripts')
      },
    }),
    /构建脚本/,
  )
  await assert.rejects(
    () => addDshPlugin('github:o/n#abcdef0', {
      runDshPlugin: async (_profile, args) => {
        if (args[0] === 'install') return 'ok'
        throw new Error('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF still')
      },
    }),
    /不同主版本/,
  )
})

test('addDshPlugin allows prepare after a hoist rebuild', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-hoist-allow-'))
  try {
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
    let adds = 0
    const log = await addDshPlugin('github:o/n#abcdef0', {
      profileDir: dir,
      runDshPlugin: async (_profile, args) => {
        if (args[0] === 'install') return 'rebuilt'
        adds += 1
        if (adds === 1) throw new Error('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF in modules')
        if (adds === 2) throw new Error('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED')
        return 'allowed'
      },
    })
    assert.equal(log, 'allowed')
    assert.equal(adds, 3)
    assert.match(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8'), /dangerouslyAllowAllBuilds: true/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runCommand captures stdout and rejects non-zero exit', async () => {
  const out = await runCommand(process.execPath, ['-e', "process.stdout.write('hello')"], {
    cwd: process.cwd(),
    timeoutMs: 5000,
  })
  assert.equal(out, 'hello')
  await assert.rejects(
    () => runCommand(process.execPath, ['-e', 'process.exit(2)'], { cwd: process.cwd(), timeoutMs: 5000 }),
    /exit 2/,
  )
})

test('runCommand times out and can be aborted', async () => {
  await assert.rejects(
    () => runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], { cwd: process.cwd(), timeoutMs: 80 }),
    /命令超时/,
  )
  await assert.rejects(
    () => runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], {
      cwd: process.cwd(),
      timeoutMs: 80,
      detached: true,
    }),
    /命令超时/,
  )
  const ctrl = new AbortController()
  const pending = runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], {
    cwd: process.cwd(),
    timeoutMs: 5000,
    signal: ctrl.signal,
  })
  ctrl.abort()
  await assert.rejects(pending, /命令已取消/)
})

test('runCommand surfaces stderr and spawn errors', async () => {
  await assert.rejects(
    () => runCommand(process.execPath, ['-e', "process.stderr.write('boom'); process.exit(1)"], {
      cwd: process.cwd(),
      timeoutMs: 5000,
    }),
    /boom/,
  )
  await assert.rejects(
    () => runCommand('/no/such/skillhub-dsh-binary', [], { cwd: process.cwd(), timeoutMs: 1000 }),
    /ENOENT|no such|not found/i,
  )
})

test('preparePluginArgs appends the ndjson reporter to mutating commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-ndjson-'))
  try {
    assert.deepEqual(preparePluginArgs(dir, ['add', 'pkg']), ['add', 'pkg', '--reporter=ndjson'])
    assert.deepEqual(preparePluginArgs(dir, ['install', '--no-frozen-lockfile']), ['install', '--no-frozen-lockfile', '--reporter=ndjson'])
    assert.deepEqual(preparePluginArgs(dir, ['list']), ['list'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runDshPlugin feeds ndjson chunks into live install status', async () => {
  await runDshPlugin('web', ['add', 'github:o/n#abcdef0'], {
    runCommand: async (_file, _args, opts) => {
      opts?.onChunk?.('Progress: fetching\n')
      opts?.onChunk?.('{"name":"pnpm:stage"')
      opts?.onChunk?.(',"stage":"resolution_started"}\n\n')
      opts?.onChunk?.('{"name":"pnpm:fetching-progress","packageId":"esbuild@1","size":100,"downloaded":40}\n')
      opts?.onChunk?.('{"name":"pnpm","level":"error","err":{"message":"nope"}}\n')
      assert.equal(progress.active, true)
      assert.equal(progress.lastLine, 'Progress: fetching')
      assert.equal(progress.phase, 'downloading')
      assert.equal(progress.downloaded, 40)
      assert.equal(progress.error, 'nope')
      assert.ok(publicInstallStatus().seconds >= 0)
      return 'ok'
    },
    dshArgv: () => ({ file: 'dsh', args: [], cwd: '/tmp', viaShell: false }),
    profileDir: '/tmp/no-workspace',
  })
  assert.equal(progress.active, false)
  const status = publicInstallStatus()
  assert.equal(status.ndjson, true)
  assert.equal(status.boot.split('-').length, 2)
  assert.equal(status.phase, 'downloading')
})

test('runDshPlugin records the rejection reason into install status (D2)', async () => {
  await assert.rejects(
    () => runDshPlugin('web', ['add', 'github:o/n#abcdef0'], {
      runCommand: async () => {
        throw new Error('命令超时 900000ms')
      },
      dshArgv: () => ({ file: 'dsh', args: [], cwd: '/tmp', viaShell: false }),
      profileDir: '/tmp/no-workspace',
    }),
    /命令超时/,
  )
  const status = publicInstallStatus()
  assert.equal(status.active, false)
  assert.equal(status.error, '命令超时 900000ms')
  // 下一次安装开始时错误应被重置
  await runDshPlugin('web', ['add', 'github:o/n#abcdef0'], {
    runCommand: async () => 'ok',
    dshArgv: () => ({ file: 'dsh', args: [], cwd: '/tmp', viaShell: false }),
    profileDir: '/tmp/no-workspace',
  })
  assert.equal(publicInstallStatus().error, null)
})

test('runCommand forwards stdout and stderr chunks to onChunk', async () => {
  const seen: string[] = []
  const out = await runCommand(
    process.execPath,
    ['-e', "process.stdout.write('chunk-a'); process.stderr.write('chunk-b')"],
    {
      cwd: process.cwd(),
      timeoutMs: 5000,
      onChunk: (text) => seen.push(text),
    },
  )
  assert.match(out, /chunk-a/)
  assert.match(out, /chunk-b/)
  assert.equal(seen.join(''), out)
})

test('runCommand decodes split UTF-8 characters independently on stdout and stderr', async () => {
  const seen: string[] = []
  const script = [
    "const out = Buffer.from('中文🚀'), err = Buffer.from('错误信息')",
    'process.stdout.write(out.subarray(0, 1))',
    'process.stderr.write(err.subarray(0, 2))',
    'setTimeout(() => { process.stdout.write(out.subarray(1)); process.stderr.write(err.subarray(2)) }, 50)',
  ].join('; ')
  const out = await runCommand(process.execPath, ['-e', script], { timeoutMs: 5000, onChunk: (chunk) => seen.push(chunk) })
  assert.match(out, /中文🚀/u)
  assert.match(out, /错误信息/u)
  assert.equal(out.includes('\uFFFD'), false)
  assert.equal(seen.join(''), out)
})

test('Windows shell launches a cmd shim from a Chinese path and preserves arguments', { skip: process.platform !== 'win32' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'skillhub 中文 shell-'))
  try {
    const shim = join(root, 'dsh shim.cmd')
    writeFileSync(shim, '@echo off\r\n"%SKILLHUB_TEST_NODE%" "%~dp0capture.cjs" %*\r\n')
    writeFileSync(join(root, 'capture.cjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)))')
    const args = ['plugin', '--profile', 'desktop', '中文 路径', '']
    const out = await runCommand(shim, args, {
      timeoutMs: 5000, viaShell: true, env: { SKILLHUB_TEST_NODE: process.execPath },
    })
    assert.deepEqual(JSON.parse(out), args)
    await assert.rejects(
      () => runCommand('skillhub-不存在的命令', [], { timeoutMs: 5000, viaShell: true }),
      (error: Error) => {
        assert.match(error.message, /skillhub-不存在的命令/u)
        assert.equal(error.message.includes('\uFFFD'), false)
        return true
      },
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

