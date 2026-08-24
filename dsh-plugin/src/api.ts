import { categoryLabel, parseCategory } from './categories.js'
import { fetchJson } from './http.js'
import { sanitizeSortBy } from './config-store.js'
import type {
  FetchOptions,
  PluginConfig,
  SearchResult,
  SecurityReport,
  SecurityReports,
  SecurityStatus,
  SkillCard,
  SkillHubDetailRaw,
  SkillHubListResponse,
  SkillHubSkillRaw,
  SkillIntegrity,
  SortBy,
} from './types.js'

export function parseSlug(raw: string): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('\0')) throw new Error('无效 slug')
  const s = trimmed.replace(/^@/, '')
  const slug = s.includes('/') ? s.split('/').filter(Boolean).pop() || '' : s
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(slug)) throw new Error('无效 slug')
  return slug.toLowerCase()
}

export function flattenDetail(raw: SkillHubDetailRaw | null | undefined): SkillHubSkillRaw {
  const skill = raw?.skill || {}
  const stats = skill.stats || {}
  return {
    slug: String(skill.slug || raw?.slug || ''),
    name: String(skill.displayName || skill.name || ''),
    description: String(skill.summary || skill.description || ''),
    description_zh: String(skill.summary_zh || skill.description_zh || ''),
    category: String(skill.category || ''),
    downloads: Number(stats.downloads ?? skill.downloads) || 0,
    stars: Number(stats.stars ?? skill.stars) || 0,
    installs: Number(stats.installs ?? skill.installs) || 0,
    version: String(raw?.latestVersion?.version || skill.version || ''),
    iconUrl: skill.iconUrl,
    ownerName: raw?.owner?.handle || skill.ownerName,
    publisher: raw?.publisher || skill.publisher,
    namespace: raw?.namespace || skill.namespace,
    securityReports: raw?.securityReports || skill.securityReports,
  }
}

export async function fetchSkillCard(
  slug: string,
  cfg: PluginConfig,
  installed?: Set<string>,
  signal?: AbortSignal,
  fetchJsonImpl?: typeof fetchJson,
): Promise<SkillCard | null> {
  const id = parseSlug(slug)
  const fetchImpl = fetchJsonImpl || fetchJson
  const url = `${cfg.apiBase.replace(/\/$/, '')}/api/v1/skills/${encodeURIComponent(id)}`
  try {
    const raw = await fetchImpl<SkillHubDetailRaw>(url, fetchOpts(cfg), signal)
    const card = mapSkill(flattenDetail(raw), cfg.webBase, installed)
    if (!card?.version) return card
    try {
      const sigUrl = `${cfg.apiBase.replace(/\/$/, '')}/api/v1/open/skills/${encodeURIComponent(id)}/versions/${encodeURIComponent(card.version)}/signature`
      const integrity = mapIntegrity(await fetchImpl<unknown>(sigUrl, fetchOpts(cfg), signal))
      if (integrity) card.integrity = integrity
    } catch { /* signature is optional */ }
    return card
  } catch {
    return null
  }
}

export function mapSkill(raw: SkillHubSkillRaw, webBase: string, installed?: Set<string>): SkillCard | null {
  const slug = String(raw.slug || raw.namespace?.publicSlug || '').trim()
  if (!slug) return null
  const name = String(raw.name || slug).trim()
  const description = String(raw.description_zh || raw.description || '').trim()
  const category = String(raw.category || '').trim()
  const id = String(raw.namespace?.canonicalName || `@${raw.ownerName || 'skill'}/${slug}`)
  const card: SkillCard = {
    id,
    slug,
    name,
    description,
    category,
    categoryLabel: categoryLabel(category),
    version: String(raw.version || '').trim(),
    downloads: Number(raw.downloads) || 0,
    stars: Number(raw.stars) || 0,
    installs: Number(raw.installs) || 0,
    pageUrl: `${webBase.replace(/\/$/, '')}/skills/${encodeURIComponent(slug)}`,
    owner: raw.ownerName || raw.namespace?.handle,
    installed: installed?.has(slug) || false,
  }
  if (raw.iconUrl) card.iconUrl = String(raw.iconUrl)
  const publisher = raw.publisher
  if (publisher?.verified) {
    card.verified = true
    const pubName = String(publisher.name || '').trim()
    if (pubName) card.publisherName = pubName
  }
  const security = mapSecurityReports(raw.securityReports)
  if (security) card.security = security
  return card
}

const VISIBLE_SECURITY = new Set<string>(['benign', 'scanning', 'suspicious', 'malicious'])

export function mapSecurityReports(raw: unknown): SecurityReports | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: SecurityReports = {}
  const keen = mapSecurityReport(src.keen)
  const sanbu = mapSecurityReport(src.sanbu)
  if (keen) out.keen = keen
  if (sanbu) out.sanbu = sanbu
  return out.keen || out.sanbu ? out : undefined
}

function mapSecurityReport(raw: unknown): SecurityReport | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { status?: unknown; statusText?: unknown; reportUrl?: unknown }
  const status = String(r.status || '').toLowerCase()
  if (!VISIBLE_SECURITY.has(status)) return undefined
  const report: SecurityReport = {
    status: status as SecurityStatus,
    statusText: String(r.statusText || '').slice(0, 80),
  }
  const url = String(r.reportUrl || '')
  if (/^https:\/\//i.test(url) && !url.includes('..')) report.reportUrl = url
  return report
}

export function mapIntegrity(raw: unknown): SkillIntegrity | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { signed?: unknown; content_hash?: unknown; signature?: unknown }
  const contentHash = String(r.content_hash || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 64)
  const signature = String(r.signature || '').replace(/\s+/g, '').slice(0, 200)
  if (!contentHash && !signature) return undefined
  return {
    signed: r.signed === true && !!signature,
    contentHash: contentHash || undefined,
    signature: signature || undefined,
  }
}

export function parseSearchResponse(body: SkillHubListResponse, webBase: string, installed?: Set<string>): { items: SkillCard[]; total: number } {
  if (body.code !== 0 || !body.data) throw new Error(body.message || 'SkillHub 返回错误')
  const items: SkillCard[] = []
  for (const raw of body.data.skills || []) {
    const card = mapSkill(raw, webBase, installed)
    if (card) items.push(card)
  }
  return { items, total: Number(body.data.total) || items.length }
}

export function collectQueries(query: string, extra?: unknown): string[] {
  const out: string[] = []
  const add = (raw: unknown) => {
    const t = String(raw || '').trim()
    if (t.length < 2) return
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return
    out.push(t)
  }
  add(query)
  if (Array.isArray(extra)) extra.forEach(add)
  else if (typeof extra === 'string') extra.split(/[,，、|]/).forEach(add)
  return out.slice(0, 4)
}

export function mergeBySlug(groups: SkillCard[][]): SkillCard[] {
  const seen = new Map<string, SkillCard>()
  for (const items of groups) {
    for (const it of items) {
      const prev = seen.get(it.slug)
      if (!prev || it.downloads > prev.downloads) seen.set(it.slug, it)
    }
  }
  return [...seen.values()].sort((a, b) => (b.downloads - a.downloads) || (b.stars - a.stars))
}

export function pageFromOffset(offset: number, limit: number): { page: number; pageSize: number; skip: number } {
  const pageSize = Math.max(1, Math.min(100, Math.floor(limit) || 12))
  const off = Math.max(0, Math.floor(offset) || 0)
  return {
    page: Math.floor(off / pageSize) + 1,
    pageSize,
    skip: off % pageSize,
  }
}

export async function searchSkills(
  query: string,
  options: {
    cfg: PluginConfig
    queries?: unknown
    category?: string
    sortBy?: SortBy
    limit?: number
    offset?: number
    installed?: Set<string>
    signal?: AbortSignal
    fetchJsonImpl?: typeof fetchJson
  },
): Promise<SearchResult> {
  const cfg = options.cfg
  const limit = clamp(options.limit ?? cfg.maxResults, 1, 80)
  const offset = Math.max(0, Math.floor(options.offset || 0))
  const category = parseCategory(options.category)
  const keywords = collectQueries(query, options.queries)
  const browsing = keywords.length === 0
  const sortBy = sanitizeSortBy(options.sortBy, browsing ? 'downloads' : cfg.sortBy)
  const fetchImpl = options.fetchJsonImpl || fetchJson
  const pageOpts = {
    cfg,
    category,
    sortBy,
    installed: options.installed,
    signal: options.signal,
    fetchImpl,
  }

  const single = async (keyword: string, off: number) => {
    const { page, pageSize, skip } = pageFromOffset(off, limit)
    const parsed = await fetchPage(keyword, { ...pageOpts, page, pageSize })
    const items = parsed.items.slice(skip, skip + limit)
    return {
      query: keyword,
      queries: keyword ? [keyword] : [],
      category,
      sortBy,
      items,
      total: parsed.total,
      offset: off,
      hasMore: off + items.length < parsed.total,
    } satisfies SearchResult
  }

  if (offset > 0 || keywords.length <= 1) {
    const first = await single(keywords[0] || '', offset)
    if (first.items.length) return first
    const popular = await single('', 0)
    return { ...popular, query: keywords[0] || '', fallback: true }
  }

  const pageSize = clamp(Math.max(limit, 12), 1, 40)
  const pages = await Promise.all(keywords.map((keyword) => fetchPage(keyword, { ...pageOpts, page: 1, pageSize })))
  const merged = mergeBySlug(pages.map((p) => p.items))
  const items = merged.slice(0, limit)
  if (items.length) {
    return {
      query: keywords[0],
      queries: keywords,
      category,
      sortBy,
      items,
      total: Math.max(merged.length, ...pages.map((p) => p.total)),
      offset: 0,
      hasMore: pages.some((p) => p.total > items.length) || merged.length > items.length,
    }
  }
  const popular = await single('', 0)
  return { ...popular, query: keywords[0] || '', fallback: true }
}

async function fetchPage(
  keyword: string,
  options: {
    cfg: PluginConfig
    category?: string
    sortBy: SortBy
    page: number
    pageSize: number
    installed?: Set<string>
    signal?: AbortSignal
    fetchImpl: typeof fetchJson
  },
): Promise<{ items: SkillCard[]; total: number }> {
  const params = new URLSearchParams()
  if (keyword) params.set('keyword', keyword)
  if (options.category) params.set('category', options.category)
  params.set('sortBy', options.sortBy)
  params.set('order', 'desc')
  params.set('page', String(options.page))
  params.set('pageSize', String(options.pageSize))
  const url = `${options.cfg.apiBase.replace(/\/$/, '')}/api/skills?${params.toString()}`
  const body = await options.fetchImpl<SkillHubListResponse>(url, fetchOpts(options.cfg), options.signal)
  return parseSearchResponse(body, options.cfg.webBase, options.installed)
}

export function fetchOpts(cfg: Pick<PluginConfig, 'timeoutMs' | 'userAgent'>): FetchOptions {
  return { timeoutMs: cfg.timeoutMs, userAgent: cfg.userAgent }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
