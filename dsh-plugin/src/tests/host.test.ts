import assert from 'node:assert/strict'
import test from 'node:test'
import { renderInstall, renderList, renderPluginInstall, renderPluginSearch, renderSearch, selfCheckPluginPaging } from '../host.js'
import type { MarketPlugin, PluginSearchResult } from '../plugin-market.js'
import type { InstalledSkill, PluginConfig, SearchResult, SkillCard } from '../types.js'

const baseCfg: PluginConfig = {
  apiBase: 'https://api.skillhub.cn',
  webBase: 'https://skillhub.cn',
  skillsDir: '/tmp/skills',
  timeoutMs: 5000,
  userAgent: 'skillhub-test',
  maxResults: 12,
  sortBy: 'score',
}

function card(partial: Partial<SkillCard>): SkillCard {
  return {
    id: '@u/demo',
    slug: 'demo',
    name: 'Demo',
    description: '',
    category: '',
    categoryLabel: '',
    version: '1.0.0',
    downloads: 0,
    stars: 0,
    installs: 0,
    pageUrl: 'https://skillhub.cn/skills/demo',
    ...partial,
  }
}

test('renderSearch asks for a short empty reply', () => {
  const text = renderSearch({
    query: 'pdf',
    sortBy: 'score',
    items: [],
    total: 0,
    offset: 0,
    hasMore: false,
  })
  assert.match(text, /没有找到/)
  assert.match(text, /不要写长文/)
})

test('renderSearch lists cards and forbids restating them', () => {
  const result: SearchResult = {
    query: '周报',
    sortBy: 'downloads',
    items: [card({ name: '周报助手', slug: 'weekly', installed: true })],
    total: 1,
    offset: 0,
    hasMore: true,
  }
  const text = renderSearch(result)
  assert.match(text, /周报助手（已安装）/)
  assert.match(text, /禁止复述给用户/)
  assert.match(text, /offset=1/)
  assert.doesNotMatch(text, /curl/)
})

test('renderInstall does not print install commands', () => {
  const text = renderInstall({
    slug: 'demo',
    name: 'Demo',
    version: '1.0.0',
    path: '/tmp/skills/demo',
    files: 2,
  })
  assert.match(text, /Demo 已安装/)
  assert.match(text, /不要打印安装命令/)
  assert.doesNotMatch(text, /skillhub install|curl/)
})

function plugin(partial: Partial<MarketPlugin>): MarketPlugin {
  return {
    owner: 'liustack',
    name: 'modlens',
    fullName: 'liustack/modlens',
    description: 'vision plugin',
    stars: 12,
    categoryKey: 'web-tools',
    installability: 'verified',
    repositoryUrl: 'https://github.com/liustack/modlens',
    avatarUrl: '',
    installed: false,
    ...partial,
  }
}

test('renderPluginSearch asks for a short empty reply', () => {
  const text = renderPluginSearch({
    query: '浏览器',
    sort: 'stars',
    items: [],
    total: 0,
    offset: 0,
    hasMore: false,
  })
  assert.match(text, /没有找到相关插件/)
  assert.match(text, /不要写长文/)
})

test('renderPluginSearch says nothing more when an offset page is empty (D1)', () => {
  const text = renderPluginSearch({
    query: '浏览器自动化',
    sort: 'stars',
    items: [],
    total: 3,
    offset: 3,
    hasMore: false,
  })
  assert.match(text, /没有了/)
  assert.doesNotMatch(text, /没有找到相关插件/)
  assert.match(text, /不要写长文/)
})

test('renderPluginSearch lists plugins, marks installed, and pages with offset', () => {
  const result: PluginSearchResult = {
    query: '浏览器自动化',
    category: 'web-tools',
    sort: 'stars',
    items: [
      plugin({ owner: 'deepseek-ai', name: 'dsh-browser', fullName: 'deepseek-ai/dsh-browser' }),
      plugin({ owner: 'liustack', name: 'modlens', installed: true }),
    ],
    total: 5,
    offset: 2,
    hasMore: true,
  }
  const text = renderPluginSearch(result)
  assert.match(text, /deepseek-ai\/dsh-browser$/m)
  assert.match(text, /liustack\/modlens（已安装）/)
  assert.match(text, /禁止复述给用户/)
  assert.match(text, /offset=4/)
  assert.match(text, /skillhub_plugin_install（owner\+name）/)
  assert.doesNotMatch(text, /dsh plugin|curl|npm /)
})

test('renderPluginSearch says everything is listed when hasMore is false', () => {
  const text = renderPluginSearch({
    query: '',
    sort: 'stars',
    items: [plugin({})],
    total: 1,
    offset: 0,
    hasMore: false,
  })
  assert.match(text, /已经全部列出/)
  assert.match(text, /绝对禁止再次调用 skillhub_plugin_search/)
  assert.doesNotMatch(text, /offset=/)
})

test('renderPluginSearch forbids re-calling without offset when more pages exist', () => {
  const text = renderPluginSearch({
    query: '浏览器自动化',
    sort: 'stars',
    items: [plugin({}), plugin({ name: 'b', fullName: 'o/b' }), plugin({ name: 'c', fullName: 'o/c' })],
    total: 3,
    offset: 0,
    hasMore: true,
  })
  assert.match(text, /必须带 offset=3/)
  assert.match(text, /offset=0 会把上面这 3 张卡片原样再展示一遍/)
  assert.match(text, /绝对禁止/)
})

test('selfCheckPluginPaging passes when two offset pages do not overlap', async () => {
  const pages: Record<string, unknown> = {}
  const mk = (names: string[], total: number) => ({
    items: names.map((n) => ({ owner: 'o', name: n, fullName: `o/${n}`, description: '', stars: 1, categoryKey: 'web-tools', installability: 'verified', repositoryUrl: 'https://github.com/o/x', avatarUrl: '' })),
    total,
  })
  // 第一页 5 条(offset=0),第二页请求 page=2(offset=5 对齐),返回全新 5 条
  const fetchJson = async (url: string) => {
    if (/page=2/.test(url)) return mk(['f', 'g', 'h', 'i', 'j'], 10)
    return mk(['a', 'b', 'c', 'd', 'e'], 10)
  }
  const ok = await selfCheckPluginPaging({ ...baseCfg, maxResults: 5 }, fetchJson as never)
  assert.equal(ok, true)
})

test('selfCheckPluginPaging fails when the second page repeats shown cards (D1 regression)', async () => {
  const mk = (names: string[]) => ({
    items: names.map((n) => ({ owner: 'o', name: n, fullName: `o/${n}`, description: '', stars: 1, categoryKey: 'web-tools', installability: 'verified', repositoryUrl: 'https://github.com/o/x', avatarUrl: '' })),
    total: 10,
  })
  // 模拟缺陷:第二页把第一页原样返回
  const fetchJson = async () => mk(['a', 'b', 'c', 'd', 'e'])
  const ok = await selfCheckPluginPaging({ ...baseCfg, maxResults: 5 }, fetchJson as never)
  assert.equal(ok, false)
})

test('selfCheckPluginPaging reports failure instead of throwing when the API is unreachable', async () => {
  const fetchJson = async () => { throw new Error('network down') }
  const ok = await selfCheckPluginPaging({ ...baseCfg, maxResults: 5 }, fetchJson as never)
  assert.equal(ok, false)
})

test('renderPluginInstall reminds about restart and prints no commands', () => {
  const text = renderPluginInstall({
    fullName: 'deepseek-ai/dsh-browser',
    source: 'github:deepseek-ai/dsh-browser#9f2c1a4',
    restartedHint: true,
    log: '',
  })
  assert.match(text, /deepseek-ai\/dsh-browser 已安装/)
  assert.match(text, /重启 dsh web/)
  assert.match(text, /不要打印安装命令/)
  assert.doesNotMatch(text, /dsh plugin|curl|npm /)
})

test('renderList handles empty and versioned skills', () => {
  assert.match(renderList({ items: [], skillsDir: '/tmp/skills' }), /还没有安装技能/)
  const items: InstalledSkill[] = [
    { slug: 'demo', name: 'Demo', description: '', version: '1.2.0', path: '/tmp/skills/demo' },
  ]
  assert.match(renderList({ items, skillsDir: '/tmp/skills' }), /Demo \(demo\) v1\.2\.0/)
})
