import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { assignConfig, publicConfig, readOverlay, sanitizePatch, withDefaults, writeOverlay } from '../config-store.js'
import { addDshPlugin, runDshPlugin } from '../dsh-cli.js'
import { listInstalledPlugins, readInstalledPluginReadme, removeInstalledPlugin } from '../installed-plugins.js'
import { handleApi } from '../local-api.js'
import { installMarketPlugin, listPlugins, resolveInstallSource, searchMarketPlugins } from '../plugin-market.js'
import { bindRuntimeProfileHost, currentProfileDir, dshHome, isDesktopHost, resolveRuntimeProfile } from '../runtime-profile.js'
import { updateToLatestRelease } from '../self-update.js'

function fixture(t: TestContext) {
  const home = mkdtempSync(join(tmpdir(), 'skillhub-profiles-'))
  const desktop = join(home, 'profiles', 'desktop')
  const custom = join(home, 'profiles', 'custom')
  const web = join(home, 'profiles', 'web')
  for (const [dir, name] of [[desktop, 'desktop-plugin'], [custom, 'custom-plugin'], [web, 'web-plugin']]) {
    const pkgDir = join(dir, 'node_modules', name)
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { [name]: '^1.0.0' } }))
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name, version: '1.0.0', dsh: true }))
    writeFileSync(join(pkgDir, 'README.md'), `# ${name}`)
  }
  bindRuntimeProfileHost({ get: (name) => name === 'profileContext' ? { name: 'desktop', dir: desktop, home } : undefined })
  t.after(() => {
    bindRuntimeProfileHost(undefined)
    rmSync(home, { recursive: true, force: true })
  })
  return { home, desktop, custom, web }
}

test('runtime profile uses the launcher context and preserves its home and directory', (t) => {
  const { home, desktop, custom } = fixture(t)
  assert.deepEqual(resolveRuntimeProfile(undefined, { argv: ['node', 'bin.js', '--profile', 'web'] }), { name: 'desktop', dir: desktop, home })
  assert.equal(dshHome(), home)
  assert.equal(currentProfileDir(), desktop)
  assert.deepEqual(resolveRuntimeProfile('custom'), { name: 'custom', dir: custom, home })
  assert.throws(() => resolveRuntimeProfile('../web'), /无效 profile/)
  assert.throws(() => resolveRuntimeProfile(undefined, { host: { profileContext: { name: '../web' } } }), /profile 名称无效/)
})

test('runtime profile supports CLI selections and detects Desktop without a bound host', () => {
  const home = join(tmpdir(), 'skillhub-profile-fallback')
  const input = { host: {}, home, electron: false }
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', '--profile', 'team-web'] }).name, 'team-web')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', '--profile=custom'] }).name, 'custom')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', 'custom'] }).name, 'custom')
  assert.equal(resolveRuntimeProfile('团队 工作区', { ...input, argv: [] }).name, '团队 工作区')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', 'web', '--', '--profile', 'other'] }).name, 'web')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js'] }).name, 'web')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', 'index.js'], electron: true }).name, 'desktop')
  assert.equal(isDesktopHost(['electron', '/app/@deepseek-ai/dsh-desktop-host/lib/index.js'], {}), true)
  assert.equal(isDesktopHost(['node', 'bin.js'], { ELECTRON_RUN_AS_NODE: '1' }), true)
  assert.equal(resolveRuntimeProfile(undefined, {
    host: {}, home,
    argv: ['electron', '/app/@deepseek-ai/dsh-desktop-host/lib/index.js', '/app/runtime', '/projects/example'],
  }).name, 'desktop')
  assert.throws(() => resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', '--profile', '../web'] }), /无效 profile/)
  assert.throws(() => resolveRuntimeProfile(undefined, { ...input, argv: ['node', 'bin.js', '--profile'] }), /缺少 profile/)
  assert.throws(() => resolveRuntimeProfile('node_modules', input), /无效 profile/)
})

test('plugin mutations refuse a host directory that the CLI cannot address', async (t) => {
  const { home } = fixture(t)
  bindRuntimeProfileHost({ profileContext: { name: 'desktop', home, dir: join(home, 'elsewhere', 'desktop') } })
  let spawned = false
  await assert.rejects(runDshPlugin('desktop', ['add', 'pkg'], {
    dshArgv: () => ({ file: 'dsh', args: [], cwd: undefined, viaShell: false }),
    runCommand: async () => { spawned = true; return '' },
  }), /目标目录不一致/)
  assert.equal(spawned, false)
})

test('Electron public CLI honors profile arguments while the internal Desktop host takes directories', () => {
  const input = { host: {}, electron: true, home: join(tmpdir(), 'skillhub-electron-profiles') }
  const carrier = '/runtime/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', carrier, '--profile', 'custom'] }).name, 'custom')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', carrier, 'web'] }).name, 'web')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', '/runtime/dsh/lib/bin.js', '--profile=custom'] }).name, 'custom')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', carrier] }).name, 'desktop')
  const internal = carrier.replace('cli.js', 'index.js')
  assert.equal(resolveRuntimeProfile(undefined, { ...input, argv: ['electron', internal, '/runtime', '/project'] }).name, 'desktop')
})

test('profile settings persist explicit selections and allow returning to automatic selection', (t) => {
  fixture(t)
  const cfg = withDefaults({ profile: 'custom' })
  assert.equal(publicConfig(cfg).activeProfile, 'custom')
  writeOverlay(cfg)
  assert.equal(readOverlay().profile, 'custom')
  assert.deepEqual(sanitizePatch({ profile: '../web' }), {})
  assignConfig(cfg, sanitizePatch({ profile: ' ' }))
  assert.equal(cfg.profile, '')
  assert.equal(publicConfig(cfg).activeProfile, 'desktop')
  writeOverlay(cfg)
  assert.equal(readOverlay().profile, '')
})

test('installed plugins, README, and uninstall all default to the running Desktop profile', async (t) => {
  const { desktop, custom } = fixture(t)
  const installed = await listInstalledPlugins()
  assert.equal(installed.profileDir, desktop)
  assert.deepEqual(installed.items.map((item) => item.pkg), ['desktop-plugin'])
  assert.equal((await readInstalledPluginReadme('desktop-plugin')).readme, '# desktop-plugin')
  await assert.rejects(readInstalledPluginReadme('web-plugin'), /未安装该插件/)
  const calls: string[][] = []
  await removeInstalledPlugin('desktop-plugin', undefined, {
    runDshPlugin: async (profile, args) => { calls.push([profile, ...args]); return '' },
  })
  await removeInstalledPlugin('custom-plugin', custom, {
    profile: 'custom',
    runDshPlugin: async (profile, args) => { calls.push([profile, ...args]); return '' },
  })
  assert.deepEqual(calls, [['desktop', 'remove', 'desktop-plugin'], ['custom', 'remove', 'custom-plugin']])
})

test('market listings and chat badges use the configured profile instead of the web profile', async (t) => {
  fixture(t)
  const cfg = withDefaults({ profile: 'custom' })
  const fetchJson = async <T>() => ({ items: [{ owner: 'owner', name: 'custom-plugin' }, { owner: 'owner', name: 'desktop-plugin' }], total: 2 }) as T
  for (const result of [await listPlugins(cfg, {}, fetchJson), await searchMarketPlugins(cfg, {}, fetchJson)]) {
    assert.deepEqual(result.items.map((item) => item.installed), [true, false])
  }
})

test('a marketplace plan cannot choose the installation profile', async (t) => {
  fixture(t)
  const calls: string[][] = []
  const source = 'github:owner/plugin#abcdef0'
  assert.equal(resolveInstallSource({ command: `dsh plugin --profile desktop add ${source}` }, { owner: 'owner', name: 'plugin', fullName: 'owner/plugin' }), source)
  assert.equal(resolveInstallSource({ command: `dsh plugin --profile "团队 工作区" add ${source}` }, { owner: 'owner', name: 'plugin', fullName: 'owner/plugin' }), source)
  const result = await installMarketPlugin({ owner: 'owner', name: 'plugin' }, withDefaults({}), {
    fetchJson: async <T>() => ({ source, profile: 'web' }) as T,
    fetchBytes: async () => ({ body: Buffer.from(''), contentType: 'text/plain' }),
    runDshPlugin: async (profile, args) => { calls.push([profile, ...args]); return 'installed' },
  })
  assert.equal(result.source, source)
  assert.deepEqual(calls, [['desktop', 'add', source]])
})

test('Desktop hoist and prepare retries stay in the same profile and update its build policy', async (t) => {
  const { desktop, web } = fixture(t)
  writeFileSync(join(web, 'pnpm-workspace.yaml'), 'packages: []\n')
  const calls: string[][] = []
  await addDshPlugin('github:owner/plugin#abcdef0', {
    runDshPlugin: async (profile, args) => {
      calls.push([profile, ...args])
      if (calls.length === 1) throw new Error('ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF')
      if (calls.length === 3) throw new Error('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED')
      return 'ok'
    },
  })
  assert.deepEqual(calls.map((call) => call[0]), ['desktop', 'desktop', 'desktop', 'desktop'])
  assert.deepEqual(calls[1], ['desktop', 'install', '--no-frozen-lockfile'])
  assert.match(readFileSync(join(desktop, 'pnpm-workspace.yaml'), 'utf8'), /dangerouslyAllowAllBuilds: true/)
  assert.equal(readFileSync(join(web, 'pnpm-workspace.yaml'), 'utf8'), 'packages: []\n')
  let forwarded: string[] = []
  await runDshPlugin('desktop', ['add', 'pkg'], {
    dshArgv: () => ({ file: 'dsh', args: [], cwd: undefined, viaShell: false }),
    runCommand: async (_command, args, options) => {
      forwarded = args
      assert.equal(options.env?.DSH_HOME, dshHome())
      return ''
    },
  })
  assert.deepEqual(forwarded, ['plugin', '--profile', 'desktop', 'add', '-w', 'pkg', '--reporter=ndjson'])
})

test('self-update reads the current package name in the selected profile and updates that profile', async (t) => {
  const { custom } = fixture(t)
  writeFileSync(join(custom, 'package.json'), JSON.stringify({ dependencies: { 'skillhub-plugin': 'link:/dev/skillhub' } }))
  const calls: string[][] = []
  const result = await updateToLatestRelease({ timeoutMs: 1000, userAgent: 'test' }, {
    profile: 'custom',
    fetchJson: async <T>() => ({ tag_name: 'v0.2.16' }) as T,
    readPackageJson: () => ({ name: 'skillhub-plugin', version: '0.2.16' }),
    runDshPlugin: async (profile, args) => { calls.push([profile, ...args]); return 'updated' },
  })
  assert.equal(result.updated, true)
  assert.equal(result.profileDir, custom)
  assert.deepEqual(calls, [['custom', 'add', 'skillhub-plugin@0.2.16']])
})

test('local API uses an explicit profile for installed plugins, README, and settings', async (t) => {
  const { custom } = fixture(t)
  const cfg = withDefaults({ profile: 'custom' })
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/v1/plugins/')) {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ source: 'github:owner/plugin#abcdef0', profile: 'web' }))
      return
    }
    void handleApi(req, res, cfg)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  cfg.apiBase = base
  const installed = await (await fetch(`${base}/?method=installedPlugins`)).json() as { profileDir: string; items: { pkg: string }[] }
  assert.equal(installed.profileDir, custom)
  assert.deepEqual(installed.items.map((item) => item.pkg), ['custom-plugin'])
  const readme = await (await fetch(`${base}/?method=pluginReadme&pkg=custom-plugin`)).json() as { readme: string }
  assert.equal(readme.readme, '# custom-plugin')
  const settings = await (await fetch(`${base}/?method=config`)).json() as { activeProfile: string }
  assert.equal(settings.activeProfile, 'custom')
  const plan = await (await fetch(`${base}/?method=pluginInstallPlan&owner=owner&name=plugin`)).json() as { source: string; profile: string }
  assert.equal(plan.profile, 'custom')
  assert.equal(plan.source, 'github:owner/plugin#abcdef0')
})
