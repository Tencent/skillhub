import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLUGIN_NPM_NAME,
  compareSemver,
  detectSource,
  fetchLatestRelease,
  getUpdateStatus,
  normalizeVersion,
  parseReleaseTag,
  updateToLatestRelease,
} from '../self-update.js'

test('parseReleaseTag accepts v-prefixed semver', () => {
  assert.equal(parseReleaseTag('v0.1.0'), '0.1.0')
  assert.equal(parseReleaseTag('1.2.3'), '1.2.3')
  assert.throws(() => parseReleaseTag('latest'), /无效 release/)
  assert.throws(() => parseReleaseTag('v1.0'), /无效 release/)
})

test('compareSemver orders versions', () => {
  assert.equal(compareSemver('0.1.0', '0.1.0'), 0)
  assert.equal(compareSemver('0.2.0', '0.1.9'), 1)
  assert.equal(compareSemver('v0.1.0', '0.1.1'), -1)
  assert.equal(normalizeVersion('v1.0.0'), '1.0.0')
})

test('detectSource recognizes link, npm, and github specs', () => {
  assert.equal(detectSource('link:/root/workspace/skillhub'), 'link')
  assert.equal(detectSource('github:cocofhu/skillhub#v0.1.0'), 'github')
  assert.equal(detectSource('github:Tencent/skillhub#v0.2.18&path:dsh-plugin'), 'github')
  assert.equal(detectSource('https://github.com/cocofhu/skillhub.git#v0.1.0'), 'github')
  assert.equal(detectSource('1.0.0'), 'npm')
  assert.equal(detectSource('^0.2.17'), 'npm')
  assert.equal(detectSource('latest'), 'npm')
  assert.equal(detectSource('github:someone/else#v1.0.0'), 'unknown')
})

test('fetchLatestRelease maps GitHub payload', async () => {
  const release = await fetchLatestRelease({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({
      tag_name: 'v0.1.0',
      html_url: 'https://github.com/Tencent/skillhub/releases/tag/v0.1.0',
      name: 'v0.1.0',
    }) as T,
  })
  assert.equal(release.tag, 'v0.1.0')
  assert.equal(release.version, '0.1.0')
})

test('getUpdateStatus marks github install up to date', async () => {
  const status = await getUpdateStatus({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.1.0' }) as T,
    runDshPlugin: async () => '',
    readPackageJson: () => ({ version: '0.1.0' }),
    readProfilePackage: () => ({ dependencies: { skillhub: 'github:cocofhu/skillhub#v0.1.0' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(status.upToDate, true)
  assert.equal(status.canUpdate, false)
  assert.equal(status.source, 'github')
})

test('getUpdateStatus allows updating from older github install', async () => {
  const status = await getUpdateStatus({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.2.0' }) as T,
    runDshPlugin: async () => '',
    readPackageJson: () => ({ version: '0.1.0' }),
    readProfilePackage: () => ({ dependencies: { skillhub: 'github:cocofhu/skillhub#v0.1.0' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(status.canUpdate, true)
  assert.equal(status.latest?.version, '0.2.0')
})

test('updateToLatestRelease installs the release version from npm', async () => {
  const seen: string[][] = []
  const result = await updateToLatestRelease({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.2.0' }) as T,
    runDshPlugin: async (profile, args) => {
      seen.push([profile, ...args])
      return 'ok'
    },
    readPackageJson: () => ({ version: seen.length ? '0.2.0' : '0.1.0' }),
    readProfilePackage: () => ({ dependencies: { skillhub: 'github:cocofhu/skillhub#v0.1.0' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(result.updated, true)
  assert.equal(result.restartedHint, true)
  assert.equal(result.source, 'npm')
  assert.deepEqual(seen, [['web', 'add', `${PLUGIN_NPM_NAME}@0.2.0`]])
})

test('updateToLatestRelease removes the plugin installed under a legacy name', async () => {
  const seen: string[][] = []
  const result = await updateToLatestRelease({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.2.18' }) as T,
    runDshPlugin: async (profile, args) => {
      seen.push([profile, ...args])
      return 'ok;'
    },
    readPackageJson: () => ({ name: '@cocofhu/skillhub', version: seen.length ? '0.2.18' : '0.2.17' }),
    readProfilePackage: () => ({ dependencies: { '@cocofhu/skillhub': '0.2.17' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(result.updated, true)
  assert.deepEqual(seen, [['web', 'add', 'skillhub-plugin@0.2.18'], ['web', 'remove', '@cocofhu/skillhub']])
  assert.equal(result.log, 'ok;ok;')
})

test('updateToLatestRelease no-ops when already latest', async () => {
  const result = await updateToLatestRelease({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.1.0' }) as T,
    runDshPlugin: async () => {
      throw new Error('should not run')
    },
    readPackageJson: () => ({ version: '0.1.0' }),
    readProfilePackage: () => ({ dependencies: { skillhub: 'github:cocofhu/skillhub#v0.1.0' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(result.updated, false)
  assert.equal(result.canUpdate, false)
})

test('getUpdateStatus warns when profile uses local link', async () => {
  const status = await getUpdateStatus({ timeoutMs: 1000, userAgent: 't' }, {
    fetchJson: async <T>() => ({ tag_name: 'v0.1.0' }) as T,
    runDshPlugin: async () => '',
    readPackageJson: () => ({ version: '0.1.0' }),
    readProfilePackage: () => ({ dependencies: { skillhub: 'link:/tmp/skillhub' } }),
    profileDir: () => '/tmp/profile-web',
  })
  assert.equal(status.source, 'link')
  assert.equal(status.canUpdate, true)
  assert.match(status.message || '', /本地开发链接/)
})

test('runCommand is re-exported from the CLI helper', async () => {
  const { runCommand } = await import('../self-update.js')
  const out = await runCommand(process.execPath, ['-e', "process.stdout.write('hello')"], {
    cwd: process.cwd(),
    timeoutMs: 5000,
  })
  assert.equal(out, 'hello')
})

test('package helpers read local package.json', async () => {
  const { packageRoot, readPackageJson, webProfileDir } = await import('../self-update.js')
  const pkg = readPackageJson(packageRoot())
  assert.equal(pkg.name, 'skillhub-plugin')
  assert.match(pkg.version || '', /^\d+\.\d+\.\d+/)
  assert.match(webProfileDir(), /profiles\/web$/)
})
