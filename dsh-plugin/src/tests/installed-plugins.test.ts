import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  README_MAX_BYTES,
  isSafePkgName,
  listInstalledPlugins,
  parseSpecSource,
  readInstalledPluginReadme,
  removeInstalledPlugin,
  resolvePluginDir,
} from '../installed-plugins.js'

function makeProfile(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-profile-'))
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

function addDep(profileDir: string, deps: Record<string, string>): void {
  const pkgPath = join(profileDir, 'package.json')
  let pkg: { dependencies?: Record<string, string> } = {}
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string> }
  } catch {
    pkg = {}
  }
  pkg.dependencies = { ...(pkg.dependencies || {}), ...deps }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
}

function addPackage(profileDir: string, pkg: string, fields: Record<string, unknown>): string {
  const dir = join(profileDir, 'node_modules', pkg)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: pkg, ...fields }))
  return dir
}

test('parseSpecSource classifies github / npm / link / unknown', () => {
  assert.equal(parseSpecSource('github:owner/repo#abc1234'), 'github')
  assert.equal(parseSpecSource('https://github.com/owner/repo'), 'github')
  assert.equal(parseSpecSource('@scope/pkg@^1.0.0'), 'npm')
  assert.equal(parseSpecSource('link:/abs/path'), 'link')
  assert.equal(parseSpecSource(''), 'unknown')
})

test('isSafePkgName rejects traversal and malformed names', () => {
  assert.equal(isSafePkgName('dsh-memory'), true)
  assert.equal(isSafePkgName('@acme/dsh-web-fetch'), true)
  assert.equal(isSafePkgName('../escape'), false)
  assert.equal(isSafePkgName('..'), false)
  assert.equal(isSafePkgName('a/../b'), false)
  assert.equal(isSafePkgName(''), false)
  assert.equal(isSafePkgName('.hidden'), false)
})

test('resolvePluginDir keeps paths inside node_modules unless link: is explicit', () => {
  const profile = '/tmp/some-profile'
  assert.equal(resolvePluginDir(profile, 'dsh-memory', '^1.0.0'), join(profile, 'node_modules', 'dsh-memory'))
  assert.equal(resolvePluginDir(profile, '@acme/pkg', '^1.0.0'), join(profile, 'node_modules', '@acme', 'pkg'))
  assert.equal(resolvePluginDir(profile, '../evil', '^1.0.0'), null)
  assert.equal(resolvePluginDir(profile, 'ok', 'link:/abs/dev/pkg'), '/abs/dev/pkg')
  assert.equal(resolvePluginDir(profile, 'ok', 'link:relative/pkg'), null)
})

test('listInstalledPlugins handles github/npm/link specs and filters non-dsh deps', async () => {
  const { dir, cleanup } = makeProfile()
  try {
    // npm 来源
    addPackage(dir, 'dsh-npm-pkg', {
      version: '0.6.2',
      description: 'npm 来源插件',
      homepage: 'https://example.com/npm',
      dsh: { client: {} },
    })
    // github 来源
    addPackage(dir, 'dsh-gh-pkg', { version: '1.0.0', description: 'github 来源', dsh: true })
    // 非 dsh 依赖
    addPackage(dir, 'lodash', { version: '4.17.21', description: '工具库' })
    // link: 本地来源
    const linkDir = mkdtempSync(join(tmpdir(), 'skillhub-link-'))
    mkdirSync(join(linkDir, 'node_modules'), { recursive: true })
    writeFileSync(join(linkDir, 'node_modules', 'package.json'), JSON.stringify({
      name: 'dsh-local',
      version: '0.3.1',
      description: '本地开发插件',
      dsh: {},
    }))
    addDep(dir, {
      'dsh-npm-pkg': '^0.6.2',
      'dsh-gh-pkg': 'github:owner/repo#abc1234',
      lodash: '^4.17.21',
      'dsh-local': `link:${join(linkDir, 'node_modules')}`,
    })
    const result = await listInstalledPlugins(dir)
    assert.equal(result.items.length, 3)
    assert.equal(result.others, 1)
    const byPkg = Object.fromEntries(result.items.map((it) => [it.pkg, it]))
    assert.equal(byPkg['dsh-npm-pkg'].source, 'npm')
    assert.equal(byPkg['dsh-npm-pkg'].version, '0.6.2')
    assert.equal(byPkg['dsh-npm-pkg'].description, 'npm 来源插件')
    assert.equal(byPkg['dsh-gh-pkg'].source, 'github')
    assert.equal(byPkg['dsh-gh-pkg'].spec, 'github:owner/repo#abc1234')
    assert.equal(byPkg['dsh-local'].source, 'link')
    assert.equal(byPkg['dsh-local'].path, join(linkDir, 'node_modules'))
    assert.ok(!('lodash' in byPkg))
    rmSync(linkDir, { recursive: true, force: true })
  } finally {
    cleanup()
  }
})

test('listInstalledPlugins tolerates missing profile and broken packages', async () => {
  const missing = await listInstalledPlugins(join(tmpdir(), 'skillhub-missing-profile-xyz'))
  assert.deepEqual(missing, { items: [], others: 0, profileDir: join(tmpdir(), 'skillhub-missing-profile-xyz') })

  const { dir, cleanup } = makeProfile()
  try {
    mkdirSync(join(dir, 'node_modules', 'broken-pkg'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'broken-pkg', 'package.json'), '{ not json')
    addDep(dir, { 'broken-pkg': '^1.0.0' })
    const result = await listInstalledPlugins(dir)
    assert.deepEqual(result.items, [])
    assert.equal(result.others, 1)
  } finally {
    cleanup()
  }
})

test('readInstalledPluginReadme truncates over 64KB and marks truncated', async () => {
  const { dir, cleanup } = makeProfile()
  try {
    const pkgDir = addPackage(dir, 'dsh-big-readme', { version: '1.0.0', dsh: true })
    const big = 'x'.repeat(README_MAX_BYTES + 100)
    writeFileSync(join(pkgDir, 'README.md'), big)
    addDep(dir, { 'dsh-big-readme': '^1.0.0' })
    const result = await readInstalledPluginReadme('dsh-big-readme', dir)
    assert.equal(result.truncated, true)
    assert.equal(result.readme.length, README_MAX_BYTES)
    assert.equal(result.pkg, 'dsh-big-readme')
  } finally {
    cleanup()
  }
})

test('readInstalledPluginReadme reads markdown fallback and rejects unknown pkg', async () => {
  const { dir, cleanup } = makeProfile()
  try {
    const pkgDir = addPackage(dir, 'dsh-alt-readme', { version: '1.0.0', dsh: true })
    writeFileSync(join(pkgDir, 'README.markdown'), '# alt\n')
    addDep(dir, { 'dsh-alt-readme': '^1.0.0' })
    const result = await readInstalledPluginReadme('dsh-alt-readme', dir)
    assert.equal(result.readme, '# alt\n')
    assert.equal(result.truncated, false)
    await assert.rejects(() => readInstalledPluginReadme('not-installed', dir), /未安装该插件/)
    await assert.rejects(() => readInstalledPluginReadme('../evil', dir), /无效插件包名/)
  } finally {
    cleanup()
  }
})

test('removeInstalledPlugin runs dsh plugin remove for a profile dsh dep', async () => {
  const { dir, cleanup } = makeProfile()
  try {
    addPackage(dir, 'dsh-gone', { version: '1.0.0', dsh: true })
    addDep(dir, { 'dsh-gone': '^1.0.0' })
    const calls: string[][] = []
    const result = await removeInstalledPlugin('dsh-gone', dir, {
      runDshPlugin: async (profile, args) => {
        calls.push([profile, ...args])
        return 'removed'
      },
    })
    assert.equal(result.pkg, 'dsh-gone')
    assert.deepEqual(calls, [['web', 'remove', 'dsh-gone']])
    await assert.rejects(() => removeInstalledPlugin('missing', dir, { runDshPlugin: async () => '' }), /未安装该插件/)
    addPackage(dir, 'lodash', { version: '4.17.21' })
    addDep(dir, { lodash: '^4.17.21' })
    await assert.rejects(() => removeInstalledPlugin('lodash', dir, { runDshPlugin: async () => '' }), /不是 dsh 插件/)
  } finally {
    cleanup()
  }
})
