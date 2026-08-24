import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { collectQueries, fetchSkillCard, flattenDetail, mapIntegrity, mapSecurityReports, mapSkill, mergeBySlug, pageFromOffset, parseSearchResponse, parseSlug, searchSkills } from '../api.js'
import { categoryLabel, parseCategory } from '../categories.js'
import { withDefaults } from '../config-store.js'
import type { PluginConfig, SkillHubListResponse } from '../types.js'

const dir = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(dir, 'fixtures/skills-search.json'), 'utf8')) as SkillHubListResponse

test('parseSearchResponse maps SkillHub list payload', () => {
  const parsed = parseSearchResponse(fixture, 'https://skillhub.cn')
  assert.equal(parsed.total, 2633)
  assert.equal(parsed.items.length, 2)
  assert.equal(parsed.items[0].slug, 'pdf-image-text-extractor')
  assert.equal(parsed.items[0].name, 'PDF和图片文字提取')
  assert.equal(parsed.items[0].categoryLabel, '办公效率')
  assert.equal(parsed.items[0].pageUrl, 'https://skillhub.cn/skills/pdf-image-text-extractor')
  assert.equal(parsed.items[0].id, '@user_5f9c21aa/pdf-image-text-extractor')
  assert.equal(parsed.items[0].installed, false)
  assert.equal(parsed.items[0].verified, true)
  assert.equal(parsed.items[0].publisherName, 'tencent-ima')
})

test('parseSearchResponse marks installed slugs', () => {
  const parsed = parseSearchResponse(fixture, 'https://skillhub.cn', new Set(['pdf-ocr-md']))
  assert.equal(parsed.items[1].installed, true)
  assert.equal(parsed.items[0].installed, false)
})

test('parseSearchResponse rejects non-zero code', () => {
  assert.throws(() => parseSearchResponse({ code: 1, message: 'fail' }, 'https://skillhub.cn'), /fail/)
})

test('mapSkill skips empty slug', () => {
  assert.equal(mapSkill({ name: 'x' }, 'https://skillhub.cn'), null)
})

test('pageFromOffset converts offset to page', () => {
  assert.deepEqual(pageFromOffset(0, 12), { page: 1, pageSize: 12, skip: 0 })
  assert.deepEqual(pageFromOffset(12, 12), { page: 2, pageSize: 12, skip: 0 })
  assert.deepEqual(pageFromOffset(5, 12), { page: 1, pageSize: 12, skip: 5 })
})

test('parseSlug accepts canonical names', () => {
  assert.equal(parseSlug('@user_290ac21c/find-skill-skillhub'), 'find-skill-skillhub')
  assert.equal(parseSlug('pdf-ocr-md'), 'pdf-ocr-md')
  assert.throws(() => parseSlug('../etc'), /无效 slug/)
  assert.throws(() => parseSlug(''), /无效 slug/)
})

test('category helpers', () => {
  assert.equal(categoryLabel('ai-agent'), 'AI Agent')
  assert.equal(parseCategory('office-efficiency'), 'office-efficiency')
  assert.equal(parseCategory('nope'), undefined)
})

test('searchSkills paginates and reports hasMore', async () => {
  const cfg = testCfg()
  let seen = ''
  const result = await searchSkills('pdf', {
    cfg,
    limit: 2,
    offset: 0,
    fetchJsonImpl: async <T>(url: string) => {
      seen = String(url)
      return fixture as T
    },
  })
  assert.match(seen, /keyword=pdf/)
  assert.match(seen, /sortBy=score/)
  assert.match(seen, /page=1/)
  assert.equal(result.items.length, 2)
  assert.equal(result.total, 2633)
  assert.equal(result.hasMore, true)
  assert.equal(result.query, 'pdf')
  assert.deepEqual(result.queries, ['pdf'])
})

test('collectQueries keeps the main keyword and unique synonyms', () => {
  assert.deepEqual(collectQueries('PDF', ['pdf', '文档', 'x']), ['PDF', '文档'])
  assert.deepEqual(collectQueries('周报', '周报, weekly | 日报'), ['周报', 'weekly', '日报'])
})

test('mergeBySlug dedupes and prefers higher downloads', () => {
  const a = { slug: 'me-skill', name: 'A', downloads: 10, stars: 1 } as never
  const b = { slug: 'me-skill', name: 'B', downloads: 99, stars: 0 } as never
  const c = { slug: 'other', name: 'C', downloads: 5, stars: 9 } as never
  const merged = mergeBySlug([[a, c], [b]])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].slug, 'me-skill')
  assert.equal(merged[0].name, 'B')
  assert.equal(merged[1].slug, 'other')
})

test('searchSkills merges extra queries into one result', async () => {
  const cfg = testCfg()
  const extra: SkillHubListResponse = JSON.parse(JSON.stringify(fixture))
  extra.data!.total = 1
  extra.data!.skills = [{
    ...extra.data!.skills![0],
    slug: 'weekly-report',
    name: '周报助手',
    downloads: 9,
    stars: 1,
    namespace: { canonicalName: '@u/weekly-report', handle: 'u', publicSlug: 'weekly-report' },
  }]
  const seen: string[] = []
  const result = await searchSkills('pdf', {
    cfg,
    queries: ['周报'],
    limit: 12,
    fetchJsonImpl: async <T>(url: string) => {
      seen.push(String(url))
      return (url.includes('keyword=%E5%91%A8%E6%8A%A5') ? extra : fixture) as T
    },
  })
  assert.equal(seen.length, 2)
  assert.equal(result.query, 'pdf')
  assert.deepEqual(result.queries, ['pdf', '周报'])
  assert.equal(result.items.length, 3)
  assert.deepEqual(result.items.map((it) => it.slug).sort(), ['pdf-image-text-extractor', 'pdf-ocr-md', 'weekly-report'])
})

test('flattenDetail reads nested stats from v1 skill payload', () => {
  const card = mapSkill(flattenDetail({
    slug: 'tianji',
    latestVersion: { version: '1.0.1' },
    namespace: { canonicalName: '@clawhub_moonrailgun/tianji', handle: 'clawhub_moonrailgun', publicSlug: 'tianji' },
    owner: { handle: 'moonrailgun' },
    publisher: { name: 'tencent-ima', verified: true },
    securityReports: {
      keen: { status: 'benign', statusText: '安全，无风险', reportUrl: 'https://tix.qq.com/search/skill?keyword=abc' },
      sanbu: { status: 'suspicious', statusText: '可疑，存在潜在风险', reportUrl: 'https://static.cloudsec.tencent.com/report.html' },
    },
    skill: {
      slug: 'tianji',
      displayName: 'Tianji',
      summary_zh: '查询网站分析',
      category: 'data-analysis',
      stats: { downloads: 1131, stars: 1, installs: 31 },
    },
  }), 'https://skillhub.cn')
  assert.equal(card?.slug, 'tianji')
  assert.equal(card?.name, 'Tianji')
  assert.equal(card?.downloads, 1131)
  assert.equal(card?.stars, 1)
  assert.equal(card?.installs, 31)
  assert.equal(card?.version, '1.0.1')
  assert.equal(card?.categoryLabel, '数据分析')
  assert.equal(card?.verified, true)
  assert.equal(card?.publisherName, 'tencent-ima')
  assert.equal(card?.security?.keen?.status, 'benign')
  assert.equal(card?.security?.sanbu?.status, 'suspicious')
  assert.match(card?.security?.keen?.reportUrl || '', /^https:\/\/tix\.qq\.com\//)
})

test('fetchSkillCard maps /api/v1/skills/:slug', async () => {
  const cfg = testCfg()
  let seen = ''
  const card = await fetchSkillCard('tianji', cfg, new Set(['tianji']), undefined, async <T>(url: string) => {
    seen = String(url)
    if (String(url).includes('/signature')) {
      return { signed: true, content_hash: 'ab'.repeat(32), signature: 'sig==' } as T
    }
    return {
      slug: 'tianji',
      latestVersion: { version: '1.0.1' },
      skill: { slug: 'tianji', displayName: 'Tianji', stats: { downloads: 1131, stars: 1, installs: 31 } },
    } as T
  })
  assert.match(seen, /\/signature$/)
  assert.equal(card?.downloads, 1131)
  assert.equal(card?.installed, true)
  assert.equal(card?.integrity?.signed, true)
  assert.equal(card?.integrity?.contentHash, 'ab'.repeat(32))
})

test('fetchSkillCard returns null when remote fails', async () => {
  const cfg = testCfg()
  const card = await fetchSkillCard('tianji', cfg, undefined, undefined, async () => {
    throw new Error('offline')
  })
  assert.equal(card, null)
})

test('mapSecurityReports keeps visible lab reports and drops others', () => {
  const mapped = mapSecurityReports({
    keen: { status: 'benign', statusText: '安全，无风险', reportUrl: 'https://tix.qq.com/r' },
    sanbu: { status: 'queued', statusText: '排队中', reportUrl: 'https://example.com/r' },
  })
  assert.equal(mapped?.keen?.status, 'benign')
  assert.equal(mapped?.sanbu, undefined)
})

test('mapIntegrity requires hash or signature', () => {
  assert.equal(mapIntegrity({}), undefined)
  assert.equal(mapIntegrity({ signed: true, content_hash: 'deadbeef', signature: 'abc' })?.signed, true)
  assert.equal(mapIntegrity({ signed: false, content_hash: 'deadbeef' })?.signed, false)
})

test('mapSecurityReports drops javascript and traversal URLs', () => {
  const mapped = mapSecurityReports({
    keen: { status: 'malicious', statusText: 'bad', reportUrl: 'https://evil.example/../x' },
    sanbu: { status: 'scanning', statusText: 'scan', reportUrl: 'https://lab.example/r' },
  })
  assert.equal(mapped?.keen?.status, 'malicious')
  assert.equal(mapped?.keen?.reportUrl, undefined)
  assert.equal(mapped?.sanbu?.reportUrl, 'https://lab.example/r')
})

test('searchSkills falls back to popular when keyword is empty of hits', async () => {
  const empty: SkillHubListResponse = { code: 0, data: { skills: [], total: 0 } }
  const result = await searchSkills('no-such-skill', {
    cfg: testCfg(),
    limit: 12,
    fetchJsonImpl: async <T>(url: string) => {
      if (String(url).includes('keyword=')) return empty as T
      return fixture as T
    },
  })
  assert.equal(result.fallback, true)
  assert.equal(result.query, 'no-such-skill')
  assert.ok(result.items.length > 0)
})

test('searchSkills paginates with offset', async () => {
  const result = await searchSkills('pdf', {
    cfg: testCfg(),
    limit: 12,
    offset: 1,
    fetchJsonImpl: async <T>(url: string) => {
      assert.match(String(url), /page=1/)
      return fixture as T
    },
  })
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].slug, 'pdf-ocr-md')
  assert.equal(result.offset, 1)
})

test('parseSlug rejects backslash and null bytes', () => {
  assert.throws(() => parseSlug('a\\b'), /无效 slug/)
  assert.throws(() => parseSlug('abc\0'), /无效 slug/)
})

test('collectQueries drops short tokens and caps at four', () => {
  assert.deepEqual(collectQueries('a'), [])
  assert.equal(collectQueries('主词', ['aa', 'bb', 'cc', 'dd', 'ee']).length, 4)
})

function testCfg(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return withDefaults({ timeoutMs: 5000, userAgent: 'test', skillsDir: '/tmp/skills', ...overrides })
}
