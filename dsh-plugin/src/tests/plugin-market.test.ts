import assert from 'node:assert/strict'
import test from 'node:test'
import { withDefaults } from '../config-store.js'
import {
  buildPluginsUrl,
  createInstallPrompt,
  fallbackPluginCategories,
  installPlanUrl,
  listPluginCategories,
  listPlugins,
  mapMarketPlugin,
  mapPluginCategory,
  parsePluginCategory,
  parsePluginRef,
  pluginCategoriesUrl,
  sanitizePluginAvatarUrl,
  sanitizePluginScope,
  sanitizePluginSort,
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

test('createInstallPrompt zh includes install-plan and forbids force/pnpm', () => {
  const prompt = createInstallPrompt(
    { owner: 'liustack', name: 'modlens', fullName: 'liustack/modlens' },
    { locale: 'zh', apiBase: 'https://api.skillhub.cn' },
  )
  assert.match(prompt, /https:\/\/api\.skillhub\.cn\/api\/v1\/plugins\/liustack\/modlens\/install-plan/)
  assert.match(prompt, /精确 commit/)
  assert.match(prompt, /dsh\.bundle\.patch/)
  assert.match(prompt, /pnpm store/)
  assert.match(prompt, /两步修复序列/)
  assert.match(prompt, /不要对 add 使用 --force/)
  assert.match(prompt, /不要修改 DeepSeek Harness 源码/)
  assert.match(prompt, /不要在 profile 中直接运行 pnpm install\/add/)
  assert.doesNotMatch(prompt, /dsh-hub\.cc/)
})

test('createInstallPrompt en includes install-plan and forbids force/pnpm', () => {
  const prompt = createInstallPrompt(
    { owner: 'liustack', name: 'modlens' },
    { locale: 'en', apiBase: 'https://api.skillhub.cn/' },
  )
  assert.match(prompt, /Install the DSH plugin liustack\/modlens/)
  assert.match(prompt, /\/install-plan/)
  assert.match(prompt, /exact commit/)
  assert.match(prompt, /dsh\.bundle\.patch/)
  assert.match(prompt, /pnpm-store/)
  assert.match(prompt, /two-step/)
  assert.match(prompt, /do not trial-and-error or pass --force to add/i)
  assert.match(prompt, /Do not modify DeepSeek Harness source/)
  assert.match(prompt, /pnpm install\/add/)
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
  })
  assert.match(seen, /https:\/\/api\.skillhub\.cn\/api\/v1\/plugins\?/)
  assert.match(seen, /q=mod/)
  assert.match(seen, /scope=verified/)
  assert.match(seen, /page_size=24/)
  assert.equal(page.total, 1)
  assert.equal(page.webBase, 'https://skillhub.cn')
  assert.equal(page.apiBase, 'https://api.skillhub.cn')
  assert.equal(page.items[0].name, 'modlens')
  assert.equal(page.items[0].avatarUrl, 'https://cdn.example/modlens.png')
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
