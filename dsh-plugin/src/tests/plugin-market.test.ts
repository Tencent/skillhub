import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { withDefaults } from '../config-store.js'
import { HttpError } from '../http.js'
import {
  buildPluginsUrl,
  collectInstalledPatchIds,
  fetchInstallPlan,
  fetchPatchIdsFromSource,
  fallbackPluginCategories,
  findPatchIdConflict,
  installMarketPlugin,
  installPlanUrl,
  listPluginCategories,
  listPlugins,
  mapMarketPlugin,
  mapPluginCategory,
  parsePluginCategory,
  patchEntryIds,
  pluginPaging,
  searchMarketPlugins,
  parsePluginRef,
  pluginCategoriesUrl,
  resolveInstallSource,
  sanitizePluginAvatarUrl,
  sanitizePluginScope,
  sanitizePluginSort,
  githubRepoFromSpec,
  isMarketPluginInstalled,
  isPluginInstallBusy,
  readInstalledPlugins,
  withPluginInstallLock,
} from '../plugin-market.js'

test('parsePluginRef accepts GitHub owner/name', () => {
  assert.deepEqual(parsePluginRef('Tencent', 'skillhub'), { owner: 'Tencent', name: 'skillhub', fullName: 'Tencent/skillhub' })
  assert.throws(() => parsePluginRef('../x', 'n'), /无效插件 owner/)
  assert.throws(() => parsePluginRef('o', 'a/b'), /无效插件 name/)
})

test('sanitizePluginScope and sort default safely', () => {
  assert.equal(sanitizePluginScope('all'), 'all')
  assert.equal(sanitizePluginScope('nope'), 'verified')
  assert.equal(sanitizePluginSort('updated'), 'updated')
  assert.equal(sanitizePluginSort('trending'), 'stars')
})

test('parsePluginCategory only accepts plugin keys, not skill keys', () => {
  assert.equal(parsePluginCategory('web-tools'), 'web-tools')
  assert.equal(parsePluginCategory('fun-dressup'), 'fun-dressup')
  assert.equal(parsePluginCategory('office-efficiency'), undefined)
  assert.equal(parsePluginCategory('ai-agent'), undefined)
  assert.equal(parsePluginCategory(''), undefined)
})

test('buildPluginsUrl forwards filters to /api/v1/plugins', () => {
  const url = buildPluginsUrl('https://api.skillhub.cn/', {
    q: 'sidebar',
    scope: 'all',
    category: 'web-tools',
    sort: 'updated',
    page: 2,
    pageSize: 24,
  })
  assert.match(url, /^https:\/\/api\.skillhub\.cn\/api\/v1\/plugins\?/)
  assert.match(url, /q=sidebar/)
  assert.match(url, /scope=all/)
  assert.match(url, /category=web-tools/)
  assert.match(url, /sort=updated/)
  assert.match(url, /page=2/)
  assert.match(url, /page_size=24/)
})

test('buildPluginsUrl omits blank query, unknown category, and skill category keys', () => {
  const url = buildPluginsUrl('https://api.skillhub.cn', { q: '  ', category: 'office-efficiency', scope: 'verified' })
  assert.doesNotMatch(url, /[?&]q=/)
  assert.doesNotMatch(url, /category=/)
  assert.match(url, /scope=verified/)
  assert.match(url, /sort=stars/)
})

test('mapMarketPlugin keeps verified plugins and drops bad refs', () => {
  const ok = mapMarketPlugin({
    owner: 'liustack',
    name: 'modlens',
    fullName: 'liustack/modlens',
    description: 'vision plugin',
    stars: 12,
    categoryKey: 'web-tools',
    installability: 'verified',
    repositoryUrl: 'https://github.com/liustack/modlens',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
  })
  assert.equal(ok?.installability, 'verified')
  assert.equal(ok?.categoryKey, 'web-tools')
  assert.equal(ok?.repositoryUrl, 'https://github.com/liustack/modlens')
  assert.equal(ok?.avatarUrl, 'https://avatars.githubusercontent.com/u/1?v=4')
  assert.equal(ok?.installed, false)
  assert.equal(mapMarketPlugin({ owner: '../x', name: 'n' }), null)
  assert.equal(mapMarketPlugin({ owner: 'o', name: 'n', installability: 'candidate' })?.installability, 'unsupported')
  assert.equal(mapMarketPlugin({
    owner: 'o',
    name: 'n',
    categoryKey: 'office-efficiency',
    repositoryUrl: 'https://github.com/o/n',
    avatarUrl: 'http://insecure.example/a.png',
  })?.categoryKey, '')
  assert.equal(mapMarketPlugin({
    owner: 'o',
    name: 'n',
    avatarUrl: 'javascript:alert(1)',
  })?.avatarUrl, '')
})

test('resolveInstallSource accepts pinned github plan', () => {
  const sha = 'cb481974e1154afffd3835689284d3d28e57c7e1'
  const source = resolveInstallSource({
    command: `dsh plugin --profile web add github:liustack/modlens#${sha}`,
    plugin: {
      fullName: 'liustack/modlens',
      headSha: sha,
      repositoryUrl: 'https://github.com/liustack/modlens',
    },
    profile: 'web',
    source: `github:liustack/modlens#${sha}`,
  }, { owner: 'liustack', name: 'modlens', fullName: 'liustack/modlens' })
  assert.equal(source, `github:liustack/modlens#${sha}`)
})

test('resolveInstallSource is case-insensitive for GitHub names', () => {
  const sha = '1f93efe85360560e3da49726d7a55af659e771fe'
  const source = resolveInstallSource({
    source: `github:ccch1mneyyy/dsh-tui#${sha}`,
    plugin: { fullName: 'ccch1mneyyy/dsh-tui', headSha: sha, repositoryUrl: 'https://github.com/ccch1mneyyy/dsh-TUI' },
  }, { owner: 'ccch1mneyyy', name: 'dsh-TUI', fullName: 'ccch1mneyyy/dsh-TUI' })
  assert.equal(source, `github:ccch1mneyyy/dsh-tui#${sha}`)
})

test('resolveInstallSource accepts .git URLs and short SHA prefixes', () => {
  const sha = 'abcdef0'
  const expected = { owner: 'o', name: 'n', fullName: 'o/n' }
  assert.equal(resolveInstallSource({
    source: `github:o/n#${sha}`,
    plugin: { headSha: 'abcdef0123456789', repositoryUrl: 'https://github.com/o/n.git/' },
  }, expected), `github:o/n#${sha}`)
  assert.throws(() => resolveInstallSource({ source: `github:o/n#${sha}`, command: 'dsh plugin add -f pkg' }, expected), /-f|--force/)
})

test('resolveInstallSource can parse command when source is missing', () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const source = resolveInstallSource({
    command: `dsh plugin --profile web add github:o/n#${sha}`,
  }, { owner: 'o', name: 'n', fullName: 'o/n' })
  assert.equal(source, `github:o/n#${sha}`)
})

test('resolveInstallSource rejects force, other profile, and mismatched repo', () => {
  const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const expected = { owner: 'o', name: 'n', fullName: 'o/n' }
  assert.throws(() => resolveInstallSource(null, expected), /安装计划无效/)
  assert.throws(() => resolveInstallSource({ source: `github:o/n#${sha}`, command: 'dsh plugin --profile web add --force github:o/n' }, expected), /--force/)
  assert.throws(() => resolveInstallSource({ source: `github:o/n#${sha}`, profile: 'desktop' }, expected), /web profile/)
  assert.throws(() => resolveInstallSource({ source: `github:evil/n#${sha}` }, expected), /仓库与所选插件不一致/)
  assert.throws(() => resolveInstallSource({ source: `github:o/n#${sha}`, plugin: { fullName: 'evil/n' } }, expected), /fullName/)
  assert.throws(() => resolveInstallSource({
    source: `github:o/n#${sha}`,
    plugin: { headSha: 'cccccccccccccccccccccccccccccccccccccccc' },
  }, expected), /commit/)
  assert.throws(() => resolveInstallSource({
    source: `github:o/n#${sha}`,
    plugin: { repositoryUrl: 'https://github.com/evil/n' },
  }, expected), /仓库地址/)
  assert.throws(() => resolveInstallSource({ command: 'echo hi' }, expected), /没有可用的 source/)
  assert.throws(() => resolveInstallSource({ source: 'npm:left-pad' }, expected), /pinned github/)
})

test('installMarketPlugin fetches the plan then runs dsh plugin add', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const sha = 'dddddddddddddddddddddddddddddddddddddddd'
  let seenUrl = ''
  const seen: string[][] = []
  const result = await installMarketPlugin({ owner: 'liustack', name: 'modlens' }, cfg, {
    fetchJson: async <T>(url: string) => {
      seenUrl = url
      return {
        source: `github:liustack/modlens#${sha}`,
        plugin: { fullName: 'liustack/modlens', headSha: sha, repositoryUrl: 'https://github.com/liustack/modlens' },
        command: `dsh plugin --profile web add github:liustack/modlens#${sha}`,
        profile: 'web',
      } as T
    },
    fetchBytes: async () => {
      throw new HttpError('HTTP 404 https://raw.githubusercontent.com/x', 404)
    },
    runDshPlugin: async (profile, args) => {
      seen.push([profile, ...args])
      return 'installed ok'
    },
  })
  assert.equal(seenUrl, 'https://api.skillhub.cn/api/v1/plugins/liustack/modlens/install-plan')
  assert.deepEqual(seen, [['web', 'add', `github:liustack/modlens#${sha}`]])
  assert.equal(result.restartedHint, true)
  assert.equal(result.source, `github:liustack/modlens#${sha}`)
})

test('fetchInstallPlan hits install-plan URL', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn/' })
  const body = await fetchInstallPlan(cfg, 'o', 'n', async <T>(url: string) => {
    assert.equal(url, 'https://api.skillhub.cn/api/v1/plugins/o/n/install-plan')
    return { source: 'github:o/n#abcdef0' } as T
  })
  assert.equal((body as { source: string }).source, 'github:o/n#abcdef0')
})

test('withPluginInstallLock runs installs one at a time', async () => {
  const order: string[] = []
  const first = withPluginInstallLock(async () => {
    await new Promise((r) => setTimeout(r, 30))
    assert.equal(isPluginInstallBusy(), true)
    order.push('a')
    return 1
  })
  const second = withPluginInstallLock(async () => {
    order.push('b')
    return 2
  })
  assert.deepEqual(await Promise.all([first, second]), [1, 2])
  assert.deepEqual(order, ['a', 'b'])
  const failed = withPluginInstallLock(async () => {
    throw new Error('nope')
  })
  const afterFail = withPluginInstallLock(async () => 'ok')
  await assert.rejects(failed, /nope/)
  assert.equal(await afterFail, 'ok')
  assert.equal(isPluginInstallBusy(), false)
})

test('installMarketPlugin does not spawn when the plan is for another repo', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  await assert.rejects(
    () => installMarketPlugin({ owner: 'o', name: 'n' }, cfg, {
      fetchJson: async <T>() => ({ source: 'github:evil/n#abcdef0' }) as T,
      runDshPlugin: async () => {
        throw new Error('should not run')
      },
    }),
    /仓库与所选插件不一致/,
  )
})

test('patchEntryIds extracts loader ids from cordis.patch.yml', () => {
  const a = '- insert:\n    - id: genui\n      name: \'@omdsh-dev/dsh-genui\'\n'
  assert.deepEqual(patchEntryIds(a), ['genui'])
  const b = '# comment\n- insert:\n    - id: skillhub\n      name: \'@tencent/skillhub\'\n    - id: skillhub\n      name: dup\n'
  assert.deepEqual(patchEntryIds(b), ['skillhub'])
  assert.deepEqual(patchEntryIds(''), [])
  assert.deepEqual(patchEntryIds('- insert:\n    - name: no-id-here\n'), [])
})

test('collectInstalledPatchIds reads patch files of installed deps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-ids-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: { '@tencent/skillhub': 'link:/x', 'dsh-plugin-genui': 'github:a/b#59fa47b' },
    }))
    mkdirSync(join(dir, 'node_modules', '@tencent', 'skillhub'), { recursive: true })
    mkdirSync(join(dir, 'node_modules', 'dsh-plugin-genui'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', '@tencent', 'skillhub', 'cordis.patch.yml'), '- insert:\n    - id: skillhub\n      name: x\n')
    writeFileSync(join(dir, 'node_modules', 'dsh-plugin-genui', 'cordis.patch.yml'), '- insert:\n    - id: genui\n      name: y\n')
    const ids = collectInstalledPatchIds(dir)
    assert.equal(ids.get('skillhub'), '@tencent/skillhub')
    assert.equal(ids.get('genui'), 'dsh-plugin-genui')
    assert.equal(ids.size, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('fetchPatchIdsFromSource reads the pinned raw patch and tolerates 404', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const sha = 'a'.repeat(40)
  let seen = ''
  const ids = await fetchPatchIdsFromSource(`github:o/n#${sha}`, cfg, async (url: string) => {
    seen = url
    return { body: Buffer.from('- insert:\n    - id: demo\n      name: x\n'), contentType: 'text/plain' }
  })
  assert.equal(seen, `https://raw.githubusercontent.com/o/n/${sha}/cordis.patch.yml`)
  assert.deepEqual(ids, ['demo'])
  const none = await fetchPatchIdsFromSource(`github:o/n#${sha}`, cfg, async () => {
    throw new HttpError('HTTP 404 https://raw.githubusercontent.com/o/n/x/cordis.patch.yml', 404)
  })
  assert.deepEqual(none, [])
  assert.deepEqual(await fetchPatchIdsFromSource('npm:left-pad', cfg), [])
})

test('findPatchIdConflict flags a duplicate loader id but allows same-repo reinstall', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-conflict-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: { 'dsh-plugin-genui': 'github:pengyue-polaron/deepseek-harness-genui#59fa47b01281bf34dd1234f153ae60d2dc30a759' },
    }))
    mkdirSync(join(dir, 'node_modules', 'dsh-plugin-genui'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'dsh-plugin-genui', 'cordis.patch.yml'), '- insert:\n    - id: genui\n      name: dsh-plugin-genui\n')
    const patch = async () => ({ body: Buffer.from('- insert:\n    - id: genui\n      name: \'@omdsh-dev/dsh-genui\'\n'), contentType: 'text/plain' })
    // 另一个仓库、同一个 loader id → 冲突
    const conflict = await findPatchIdConflict(
      'github:omdsh-dev/dsh-genui#1ca5da4eb9394972cce2c1ccacfedc22eec3166b',
      cfg,
      { fetchBytesImpl: patch, profileDir: dir },
    )
    assert.deepEqual(conflict, { id: 'genui', holder: 'dsh-plugin-genui' })
    // 同仓库重装/升级 → 放行
    const same = await findPatchIdConflict(
      'github:pengyue-polaron/deepseek-harness-genui#59fa47b01281bf34dd1234f153ae60d2dc30a759',
      cfg,
      { fetchBytesImpl: patch, profileDir: dir },
    )
    assert.equal(same, null)
    // 无 patch 的插件 → 放行
    const bare = await findPatchIdConflict(
      'github:omdsh-dev/dsh-genui#1ca5da4eb9394972cce2c1ccacfedc22eec3166b',
      cfg,
      { fetchBytesImpl: async () => { throw new HttpError('HTTP 404 x', 404) }, profileDir: dir },
    )
    assert.equal(bare, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('installMarketPlugin refuses to install when the loader id conflicts', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-refuse-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: { 'dsh-plugin-genui': 'github:pengyue-polaron/deepseek-harness-genui#59fa47b01281bf34dd1234f153ae60d2dc30a759' },
    }))
    mkdirSync(join(dir, 'node_modules', 'dsh-plugin-genui'), { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'dsh-plugin-genui', 'cordis.patch.yml'), '- insert:\n    - id: genui\n      name: dsh-plugin-genui\n')
    const sha = '1ca5da4eb9394972cce2c1ccacfedc22eec3166b'
    await assert.rejects(
      () => installMarketPlugin({ owner: 'omdsh-dev', name: 'dsh-genui' }, cfg, {
        fetchJson: async <T>() => ({ source: `github:omdsh-dev/dsh-genui#${sha}` }) as T,
        fetchBytes: async () => ({ body: Buffer.from('- insert:\n    - id: genui\n      name: \'@omdsh-dev/dsh-genui\'\n'), contentType: 'text/plain' }),
        profileDir: dir,
        runDshPlugin: async () => {
          throw new Error('should not run')
        },
      }),
      /加载 id「genui」与已安装的 dsh-plugin-genui 冲突/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('installPlanUrl encodes owner/name', () => {
  assert.equal(
    installPlanUrl('https://api.skillhub.cn', 'o', 'n'),
    'https://api.skillhub.cn/api/v1/plugins/o/n/install-plan',
  )
})

test('sanitizePluginAvatarUrl keeps https images and drops junk', () => {
  assert.equal(sanitizePluginAvatarUrl('https://cdn.example/a.png'), 'https://cdn.example/a.png')
  assert.equal(sanitizePluginAvatarUrl('http://cdn.example/a.png'), '')
  assert.equal(sanitizePluginAvatarUrl('javascript:alert(1)'), '')
  assert.equal(sanitizePluginAvatarUrl('https://x.example/a.png "onload='), '')
})

test('listPlugins maps catalog payload and returns webBase', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn', webBase: 'https://skillhub.cn' })
  let seen = ''
  const page = await listPlugins(cfg, { q: 'mod', scope: 'verified', pageSize: 24 }, async <T>(url: string) => {
    seen = url
    return {
      total: 1,
      page: 1,
      pageSize: 24,
      items: [{
        owner: 'liustack',
        name: 'modlens',
        fullName: 'liustack/modlens',
        description: 'vision',
        stars: 10,
        categoryKey: 'web-tools',
        installability: 'verified',
        repositoryUrl: 'https://github.com/liustack/modlens',
        avatarUrl: 'https://cdn.example/modlens.png',
      }],
    } as T
  }, {})
  assert.match(seen, /https:\/\/api\.skillhub\.cn\/api\/v1\/plugins\?/)
  assert.match(seen, /q=mod/)
  assert.match(seen, /scope=verified/)
  assert.match(seen, /page_size=24/)
  assert.equal(page.total, 1)
  assert.equal(page.webBase, 'https://skillhub.cn')
  assert.equal(page.apiBase, 'https://api.skillhub.cn')
  assert.equal(page.items[0].name, 'modlens')
  assert.equal(page.items[0].avatarUrl, 'https://cdn.example/modlens.png')
  assert.equal(page.items[0].installed, false)
})

test('githubRepoFromSpec reads pinned github and https specs', () => {
  assert.equal(githubRepoFromSpec('github:ganyuanran/aegis#d5bda9fb9df0f94587283954f1c155816abe9002'), 'ganyuanran/aegis')
  assert.equal(githubRepoFromSpec('github:Tencent/skillhub#feat/plaza-host-plugin-install'), 'tencent/skillhub')
  assert.equal(githubRepoFromSpec('https://github.com/ganyuanran/aegis.git'), 'ganyuanran/aegis')
  assert.equal(githubRepoFromSpec('^1.2.3'), null)
  assert.equal(githubRepoFromSpec('link:/tmp/skillhub'), null)
})

test('isMarketPluginInstalled matches the profile github spec', () => {
  const plugin = {
    owner: 'GanyuanRan',
    name: 'Aegis',
    fullName: 'ganyuanran/aegis',
    repositoryUrl: 'https://github.com/GanyuanRan/Aegis',
  }
  assert.equal(isMarketPluginInstalled(plugin, { aegis: 'github:ganyuanran/aegis#abcdef0' }), true)
  assert.equal(isMarketPluginInstalled(plugin, { aegis: 'github:GanYuanRan/Aegis#abcdef0' }), true)
  assert.equal(isMarketPluginInstalled({ ...plugin, repositoryUrl: '' }, { other: 'github:ganyuanran/aegis#abcdef0' }), true)
  assert.equal(isMarketPluginInstalled(plugin, { aegis: '^1.0.0' }), true)
  assert.equal(isMarketPluginInstalled(plugin, { '@ganyuanran/aegis': '^1.0.0' }), true)
  assert.equal(isMarketPluginInstalled(plugin, { other: 'github:evil/aegis#abcdef0' }), false)
  assert.equal(isMarketPluginInstalled(plugin, { aegis: 'github:evil/aegis#abcdef0' }), false)
})

test('listPlugins marks plugins already in the profile', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const page = await listPlugins(cfg, {}, async <T>() => ({
    items: [
      { owner: 'GanyuanRan', name: 'Aegis', fullName: 'ganyuanran/aegis', installability: 'verified', repositoryUrl: 'https://github.com/GanyuanRan/Aegis' },
      { owner: 'liustack', name: 'modlens', fullName: 'liustack/modlens', installability: 'verified' },
    ],
  } as T), {
    aegis: 'github:ganyuanran/aegis#d5bda9fb9df0f94587283954f1c155816abe9002',
  })
  assert.equal(page.items[0].installed, true)
  assert.equal(page.items[1].installed, false)
})

test('readInstalledPlugins reads profile dependencies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillhub-profile-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      dependencies: {
        aegis: 'github:ganyuanran/aegis#abcdef0',
        skip: 1,
      },
    }))
    assert.deepEqual(readInstalledPlugins(dir), { aegis: 'github:ganyuanran/aegis#abcdef0' })
    writeFileSync(join(dir, 'package.json'), '{}')
    assert.deepEqual(readInstalledPlugins(dir), {})
    assert.deepEqual(readInstalledPlugins(join(dir, 'missing')), {})
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pluginCategoriesUrl hits /api/v1/plugins/categories', () => {
  assert.equal(pluginCategoriesUrl('https://api.skillhub.cn/'), 'https://api.skillhub.cn/api/v1/plugins/categories')
})

test('mapPluginCategory drops skill keys', () => {
  assert.deepEqual(mapPluginCategory({ key: 'memory', displayName: '记忆' }), { key: 'memory', displayName: '记忆' })
  assert.equal(mapPluginCategory({ key: 'office-efficiency', displayName: '办公效率' }), null)
  assert.equal(fallbackPluginCategories().length, 7)
  assert.equal(fallbackPluginCategories()[0].key, 'fun-dressup')
})

test('listPluginCategories uses catalog payload and falls back', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  const items = await listPluginCategories(cfg, async <T>(url: string) => {
    assert.equal(url, 'https://api.skillhub.cn/api/v1/plugins/categories')
    return { items: [{ key: 'web-tools', displayName: '联网工具' }, { key: 'office-efficiency', displayName: 'nope' }] } as T
  })
  assert.deepEqual(items, [{ key: 'web-tools', displayName: '联网工具' }])
  const fallback = await listPluginCategories(cfg, async () => {
    throw new Error('offline')
  })
  assert.equal(fallback.length, 7)
})

test('pluginPaging maps offset/limit to catalog page/pageSize with in-page skip', () => {
  assert.deepEqual(pluginPaging(0, undefined, 12), { page: 1, pageSize: 12, offset: 0, skip: 0 })
  assert.deepEqual(pluginPaging(12, 12, 12), { page: 2, pageSize: 12, offset: 12, skip: 0 })
  assert.deepEqual(pluginPaging(24, undefined, 12), { page: 3, pageSize: 12, offset: 24, skip: 0 })
  assert.deepEqual(pluginPaging(-5, 0, 24), { page: 1, pageSize: 24, offset: 0, skip: 0 })
  assert.deepEqual(pluginPaging(48, 200, 24), { page: 1, pageSize: 100, offset: 48, skip: 48 })
  assert.deepEqual(pluginPaging('12', '12', 12), { page: 2, pageSize: 12, offset: 12, skip: 0 })
  // 未对齐 pageSize 的 offset：落回第 1 页且需要页内 skip（缺陷 D1 回归用例）
  assert.deepEqual(pluginPaging(3, undefined, 12), { page: 1, pageSize: 12, offset: 3, skip: 3 })
  assert.deepEqual(pluginPaging(15, undefined, 12), { page: 2, pageSize: 12, offset: 15, skip: 3 })
})

test('searchMarketPlugins maps filters, marks installed, and computes hasMore', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn' })
  let seen = ''
  const result = await searchMarketPlugins(cfg, {
    q: '浏览器',
    category: 'web-tools',
    sort: 'updated',
    limit: 2,
    offset: 2,
  }, async <T>(url: string) => {
    seen = url
    return {
      total: 5,
      page: 2,
      pageSize: 2,
      items: [
        { owner: 'deepseek-ai', name: 'dsh-browser', fullName: 'deepseek-ai/dsh-browser', installability: 'verified', repositoryUrl: 'https://github.com/deepseek-ai/dsh-browser' },
        { owner: 'GanyuanRan', name: 'Aegis', fullName: 'ganyuanran/aegis', installability: 'verified', repositoryUrl: 'https://github.com/GanyuanRan/Aegis' },
      ],
    } as T
  }, { dsh_browser: 'github:deepseek-ai/dsh-browser#9f2c1a4' })
  assert.match(seen, /q=%E6%B5%8F%E8%A7%88%E5%99%A8/)
  assert.match(seen, /category=web-tools/)
  assert.match(seen, /sort=updated/)
  assert.match(seen, /scope=verified/)
  assert.match(seen, /page=2/)
  assert.match(seen, /page_size=2/)
  assert.equal(result.query, '浏览器')
  assert.equal(result.category, 'web-tools')
  assert.equal(result.sort, 'updated')
  assert.equal(result.offset, 2)
  assert.equal(result.total, 5)
  assert.equal(result.hasMore, true)
  assert.equal(result.items[0].installed, true)
  assert.equal(result.items[1].installed, false)
})

test('searchMarketPlugins marks the last page and defaults paging', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn', maxResults: 12 })
  let seen = ''
  const result = await searchMarketPlugins(cfg, {}, async <T>(url: string) => {
    seen = url
    return {
      total: 1,
      page: 1,
      pageSize: 12,
      items: [
        { owner: 'o', name: 'n', fullName: 'o/n', installability: 'verified' },
      ],
    } as T
  }, {})
  assert.match(seen, /page=1/)
  assert.match(seen, /page_size=12/)
  assert.doesNotMatch(seen, /q=/)
  assert.doesNotMatch(seen, /category=/)
  assert.equal(result.query, '')
  assert.equal(result.category, undefined)
  assert.equal(result.sort, 'stars')
  assert.equal(result.hasMore, false)
})

test('searchMarketPlugins skips already-shown cards when offset is misaligned with pageSize (D1)', async () => {
  const cfg = withDefaults({ apiBase: 'https://api.skillhub.cn', maxResults: 12 })
  let seen = ''
  const mkItem = (i: number) => ({ owner: 'o', name: `p${i}`, fullName: `o/p${i}`, installability: 'verified' })
  // 场景 1：total=3、已展示 3 张，offset=3 落回第 1 页 → 切片后为空且 hasMore=false（不再重复整页）
  const exhausted = await searchMarketPlugins(cfg, { q: '浏览器自动化', offset: 3 }, async <T>(url: string) => {
    seen = url
    return { total: 3, page: 1, pageSize: 12, items: [mkItem(1), mkItem(2), mkItem(3)] } as T
  }, {})
  assert.match(seen, /page=1/)
  assert.equal(exhausted.offset, 3)
  assert.deepEqual(exhausted.items, [])
  assert.equal(exhausted.hasMore, false)
  // 场景 2：offset=5、pageSize=12、目录返回整页 12 条 → 只返回第 6 条起的 7 条，不与已展示重复
  const misaligned = await searchMarketPlugins(cfg, { q: 'browser', offset: 5 }, async <T>() => {
    return { total: 40, page: 1, pageSize: 12, items: Array.from({ length: 12 }, (_v, i) => mkItem(i + 1)) } as T
  }, {})
  assert.equal(misaligned.offset, 5)
  assert.equal(misaligned.items.length, 7)
  assert.deepEqual(misaligned.items.map((it) => it.name), ['p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'])
  assert.equal(misaligned.hasMore, true)
})
