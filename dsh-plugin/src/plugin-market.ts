import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchOpts } from './api.js'
import { addDshPlugin, webProfileDir, type PluginRunner } from './dsh-cli.js'
import { fetchBytes, fetchJson, HttpError } from './http.js'
import type { PluginConfig } from './types.js'

export type PluginScope = 'verified' | 'all'
export type PluginSort = 'stars' | 'updated'
export type PluginInstallability = 'verified' | 'unsupported'

/** Plugin 一级类目，与 Skill 的 `categories.ts` 无关。非法 key 会让目录接口 400。 */
export const PLUGIN_CATEGORIES: Record<string, string> = {
  'fun-dressup': '趣味换装',
  'web-tools': '联网工具',
  memory: '记忆',
  'agent-workflow': 'Agent 工作流',
  'model-inference': '模型推理',
  client: '客户端',
  'admin-security': '管理安全',
}

export const PLUGIN_CATEGORY_KEYS = Object.keys(PLUGIN_CATEGORIES)

export interface PluginCategory {
  key: string
  displayName: string
}

export interface MarketPlugin {
  owner: string
  name: string
  fullName: string
  description: string
  stars: number
  categoryKey: string
  installability: PluginInstallability
  repositoryUrl: string
  avatarUrl: string
  installed: boolean
}

export interface PluginListQuery {
  q?: unknown
  scope?: unknown
  category?: unknown
  sort?: unknown
  page?: unknown
  pageSize?: unknown
}

export interface PluginPage {
  items: MarketPlugin[]
  total: number
  page: number
  pageSize: number
  apiBase: string
  webBase: string
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/

export function parsePluginRef(owner: unknown, name: unknown): { owner: string; name: string; fullName: string } {
  const o = String(owner || '').trim()
  const n = String(name || '').trim()
  if (!OWNER_RE.test(o)) throw new Error('无效插件 owner')
  if (!NAME_RE.test(n)) throw new Error('无效插件 name')
  return { owner: o, name: n, fullName: `${o}/${n}` }
}

export function parsePluginCategory(raw: unknown): string | undefined {
  const key = String(raw || '').trim()
  if (!key) return undefined
  return PLUGIN_CATEGORY_KEYS.includes(key) ? key : undefined
}

export function sanitizePluginScope(raw: unknown): PluginScope {
  return raw === 'all' ? 'all' : 'verified'
}

export function sanitizePluginSort(raw: unknown): PluginSort {
  return raw === 'updated' ? 'updated' : 'stars'
}

function pluginPageSize(raw: unknown): number {
  const n = Math.floor(Number(raw) || 24)
  return Math.max(1, Math.min(100, n))
}

function pluginPage(raw: unknown): number {
  const n = Math.floor(Number(raw) || 1)
  return Math.max(1, n)
}

function trimBase(raw: string): string {
  return String(raw || '').replace(/\/$/, '')
}

export function installPlanUrl(apiBase: string, owner: string, name: string): string {
  const ref = parsePluginRef(owner, name)
  return `${trimBase(apiBase)}/api/v1/plugins/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}/install-plan`
}

export function pluginCategoriesUrl(apiBase: string): string {
  return `${trimBase(apiBase)}/api/v1/plugins/categories`
}

export function sanitizePluginAvatarUrl(raw: unknown): string {
  const url = String(raw || '').trim()
  if (!/^https:\/\//i.test(url) || url.length > 500 || /[\s<>"'`]/.test(url)) return ''
  return url
}

export function buildPluginsUrl(apiBase: string, query: PluginListQuery = {}): string {
  const params = new URLSearchParams()
  const q = String(query.q || '').trim()
  if (q) params.set('q', q)
  params.set('scope', sanitizePluginScope(query.scope))
  params.set('sort', sanitizePluginSort(query.sort))
  const category = parsePluginCategory(query.category)
  if (category) params.set('category', category)
  params.set('page', String(pluginPage(query.page)))
  params.set('page_size', String(pluginPageSize(query.pageSize)))
  return `${trimBase(apiBase)}/api/v1/plugins?${params.toString()}`
}

export function mapMarketPlugin(raw: unknown): MarketPlugin | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  try {
    const ref = parsePluginRef(r.owner, r.name)
    const repo = String(r.repositoryUrl || '')
    return {
      owner: ref.owner,
      name: ref.name,
      fullName: String(r.fullName || ref.fullName).slice(0, 200),
      description: String(r.description || '').slice(0, 500),
      stars: Number(r.stars) || 0,
      categoryKey: parsePluginCategory(r.categoryKey) || '',
      installability: r.installability === 'verified' ? 'verified' : 'unsupported',
      repositoryUrl: /^https:\/\/github\.com\//i.test(repo) ? repo.slice(0, 300) : '',
      avatarUrl: sanitizePluginAvatarUrl(r.avatarUrl),
      installed: false,
    }
  } catch {
    return null
  }
}

const GITHUB_PIN = /^github:([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100})#([0-9a-f]{7,40})$/i
const GITHUB_REPO = /(?:^github:|^https:\/\/github\.com\/)([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100})(?:\.git)?(?:#|$)/i

export function githubRepoFromSpec(spec: string): string | null {
  const matched = GITHUB_REPO.exec(String(spec || '').trim())
  if (!matched) return null
  return matched[1].replace(/\.git$/i, '').toLowerCase()
}

export function readInstalledPlugins(profileDir: string = webProfileDir()): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as { dependencies?: unknown }
    if (!raw.dependencies || typeof raw.dependencies !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [name, spec] of Object.entries(raw.dependencies as Record<string, unknown>)) {
      if (typeof spec === 'string' && spec !== '') out[name] = spec
    }
    return out
  } catch {
    return {}
  }
}

export function isMarketPluginInstalled(
  plugin: Pick<MarketPlugin, 'owner' | 'name' | 'fullName' | 'repositoryUrl'>,
  installed: Record<string, string>,
): boolean {
  const aliases = new Set([
    `${plugin.owner}/${plugin.name}`.toLowerCase(),
    plugin.fullName.toLowerCase(),
  ])
  const fromUrl = githubRepoFromSpec(plugin.repositoryUrl)
  if (fromUrl) aliases.add(fromUrl)
  let npmNameHit = false
  for (const [pkg, spec] of Object.entries(installed)) {
    const repo = githubRepoFromSpec(spec)
    if (repo && aliases.has(repo)) return true
    if (packageNameMatches(pkg, plugin)) {
      if (repo && !aliases.has(repo)) continue
      npmNameHit = true
    }
  }
  return npmNameHit
}

function packageNameMatches(pkg: string, plugin: Pick<MarketPlugin, 'owner' | 'name'>): boolean {
  const lower = pkg.toLowerCase()
  const name = plugin.name.toLowerCase()
  if (lower === name) return true
  if (lower === `@${plugin.owner.toLowerCase()}/${name}`) return true
  const bare = lower.includes('/') ? lower.slice(lower.lastIndexOf('/') + 1) : lower
  return bare === name
}

export interface InstallPlan {
  source: string
  command?: string
  profile?: string
  plugin?: {
    fullName?: string
    headSha?: string
    repositoryUrl?: string
  }
}

export interface PluginInstallResult {
  fullName: string
  source: string
  restartedHint: boolean
  log: string
}

export interface PluginInstallDeps {
  fetchJson: typeof fetchJson
  fetchBytes: typeof fetchBytes
  runDshPlugin: PluginRunner
  profileDir: string
}

/** 从 cordis.patch.yml 文本提取 loader 条目 id(只取 `- id:` 行,不解析完整 YAML)。 */
export function patchEntryIds(yaml: string): string[] {
  const ids: string[] = []
  for (const m of String(yaml || '').matchAll(/^[ \t]*-[ \t]*id:[ \t]*['"]?([A-Za-z0-9@._/-]+)['"]?[ \t]*$/gm)) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

/** 收集 web profile 已安装各包 cordis.patch.yml 声明的 loader id → 持有包名。 */
export function collectInstalledPatchIds(profileDir: string = webProfileDir()): Map<string, string> {
  const out = new Map<string, string>()
  for (const pkg of Object.keys(readInstalledPlugins(profileDir))) {
    try {
      const raw = readFileSync(join(profileDir, 'node_modules', pkg, 'cordis.patch.yml'), 'utf8')
      for (const id of patchEntryIds(raw)) if (!out.has(id)) out.set(id, pkg)
    } catch {
      // 该包没有 cordis.patch.yml,不参与组合
    }
  }
  return out
}

/** 拉取待装插件(github pinned 规格)仓库根部的 cordis.patch.yml 条目 id;仓库没有该文件时返回空。 */
export async function fetchPatchIdsFromSource(
  source: string,
  cfg: PluginConfig,
  fetchBytesImpl: typeof fetchBytes = fetchBytes,
): Promise<string[]> {
  const pin = GITHUB_PIN.exec(String(source || '').trim())
  if (!pin) return []
  const url = `https://raw.githubusercontent.com/${pin[1]}/${pin[2]}/cordis.patch.yml`
  try {
    const { body } = await fetchBytesImpl(url, fetchOpts(cfg))
    return patchEntryIds(body.toString('utf8'))
  } catch (err) {
    if (err instanceof HttpError && /^HTTP 404/.test(err.message)) return []
    throw err
  }
}

/**
 * loader id 冲突预检:两个 bundle 的 cordis.patch.yml 声明相同 id 时,
 * 宿主重启后 cordis 会以 duplicate loader entry id 拒绝整个插件树,dsh web 起不来。
 * 安装前拦下,避免把宿主打进无法启动的状态。返回 null 表示无冲突。
 */
export async function findPatchIdConflict(
  source: string,
  cfg: PluginConfig,
  deps: { fetchBytesImpl?: typeof fetchBytes; profileDir?: string } = {},
): Promise<{ id: string; holder: string } | null> {
  const incoming = await fetchPatchIdsFromSource(source, cfg, deps.fetchBytesImpl)
  if (!incoming.length) return null
  const profileDir = deps.profileDir ?? webProfileDir()
  const installed = collectInstalledPatchIds(profileDir)
  const installedSpecs = readInstalledPlugins(profileDir)
  const sourceRepo = githubRepoFromSpec(source)
  for (const id of incoming) {
    const holder = installed.get(id)
    if (!holder) continue
    // 同一个仓库重装/升级不冲突(pnpm 覆盖同一份依赖)
    const holderRepo = githubRepoFromSpec(installedSpecs[holder] || '')
    if (holderRepo && sourceRepo && holderRepo === sourceRepo) continue
    return { id, holder }
  }
  return null
}

let installChain = Promise.resolve()
let installBusy = 0

export function isPluginInstallBusy(): boolean {
  return installBusy > 0
}

export function withPluginInstallLock<T>(fn: () => Promise<T>): Promise<T> {
  const guarded = async (): Promise<T> => {
    installBusy += 1
    try {
      return await fn()
    } finally {
      installBusy -= 1
    }
  }
  const run = installChain.then(guarded, guarded)
  installChain = run.then(() => undefined, () => undefined)
  return run
}

export function resolveInstallSource(
  raw: unknown,
  expected: { owner: string; name: string; fullName: string },
): string {
  if (!raw || typeof raw !== 'object') throw new Error('安装计划无效')
  const plan = raw as Record<string, unknown>
  const command = String(plan.command || '')
  if (/(?:^|\s)--force(?:\s|$)/.test(command) || /(?:^|\s)-f(?:\s|$)/.test(command)) {
    throw new Error('拒绝带 --force 的安装计划')
  }
  const profile = String(plan.profile || 'web').trim() || 'web'
  if (profile !== 'web') throw new Error('仅支持 web profile')
  let source = String(plan.source || '').trim()
  if (!source) {
    const matched = /^dsh plugin --profile web add (\S+)$/.exec(command.trim())
    if (!matched) throw new Error('安装计划没有可用的 source')
    source = matched[1]
  }
  const pin = GITHUB_PIN.exec(source)
  if (!pin) throw new Error('安装计划 source 不是 pinned github 规格')
  const repo = pin[1]
  const sha = pin[2]
  const expectedRepo = `${expected.owner}/${expected.name}`
  if (repo.toLowerCase() !== expectedRepo.toLowerCase()) {
    throw new Error('安装计划仓库与所选插件不一致')
  }
  const plugin = plan.plugin && typeof plan.plugin === 'object' ? plan.plugin as Record<string, unknown> : {}
  const fullName = String(plugin.fullName || '').trim()
  if (fullName && fullName.toLowerCase() !== expectedRepo.toLowerCase() && fullName.toLowerCase() !== expected.fullName.toLowerCase()) {
    throw new Error('安装计划 fullName 与所选插件不一致')
  }
  const headSha = String(plugin.headSha || '').trim()
  if (headSha && headSha.toLowerCase() !== sha.toLowerCase()) {
    const a = headSha.toLowerCase()
    const b = sha.toLowerCase()
    if (!a.startsWith(b) && !b.startsWith(a)) throw new Error('安装计划 commit 与 source 不一致')
  }
  const repoUrl = String(plugin.repositoryUrl || '').trim()
  if (repoUrl) {
    const ok = new RegExp(
      `^https://github\\.com/${escapeRegExp(expected.owner)}/${escapeRegExp(expected.name)}(?:\\.git)?/?$`,
      'i',
    ).test(repoUrl)
    if (!ok) throw new Error('安装计划仓库地址与所选插件不一致')
  }
  return source
}

export async function fetchInstallPlan(
  cfg: PluginConfig,
  owner: unknown,
  name: unknown,
  fetchJsonImpl: typeof fetchJson = fetchJson,
): Promise<unknown> {
  const ref = parsePluginRef(owner, name)
  return fetchJsonImpl(installPlanUrl(cfg.apiBase, ref.owner, ref.name), fetchOpts(cfg))
}

export async function installMarketPlugin(
  plugin: { owner: unknown; name: unknown; fullName?: unknown },
  cfg: PluginConfig,
  deps: Partial<PluginInstallDeps> = {},
): Promise<PluginInstallResult> {
  const fetchImpl = deps.fetchJson ?? fetchJson
  const ref = parsePluginRef(plugin.owner, plugin.name)
  const plan = await fetchInstallPlan(cfg, ref.owner, ref.name, fetchImpl)
  const source = resolveInstallSource(plan, ref)
  const conflict = await findPatchIdConflict(source, cfg, { fetchBytesImpl: deps.fetchBytes, profileDir: deps.profileDir })
  if (conflict) {
    throw new Error(`插件加载 id「${conflict.id}」与已安装的 ${conflict.holder} 冲突,继续安装会让 dsh web 无法启动,已拒绝。请先卸载 ${conflict.holder}。`)
  }
  const log = await addDshPlugin(source, deps.runDshPlugin ? { runDshPlugin: deps.runDshPlugin } : {})
  return {
    fullName: ref.fullName,
    source,
    restartedHint: true,
    log: log.slice(-4000),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function fallbackPluginCategories(): PluginCategory[] {
  return PLUGIN_CATEGORY_KEYS.map((key) => ({ key, displayName: PLUGIN_CATEGORIES[key] }))
}

export function mapPluginCategory(raw: unknown): PluginCategory | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const key = parsePluginCategory(r.key)
  if (!key) return null
  const displayName = String(r.displayName || PLUGIN_CATEGORIES[key] || key).trim().slice(0, 40)
  return { key, displayName: displayName || PLUGIN_CATEGORIES[key] }
}

export async function listPluginCategories(
  cfg: PluginConfig,
  fetchJsonImpl: typeof fetchJson = fetchJson,
): Promise<PluginCategory[]> {
  const url = pluginCategoriesUrl(cfg.apiBase)
  try {
    const body = await fetchJsonImpl<{ items?: unknown[] }>(url, fetchOpts(cfg))
    const items = (Array.isArray(body.items) ? body.items : []).map(mapPluginCategory).filter((it): it is PluginCategory => !!it)
    return items.length ? items : fallbackPluginCategories()
  } catch {
    return fallbackPluginCategories()
  }
}

export interface PluginSearchResult {
  query: string
  category?: string
  sort: PluginSort
  items: MarketPlugin[]
  total: number
  offset: number
  hasMore: boolean
}

/** 把 Agent 工具的 offset/limit 映射为目录 API 的 page/pageSize（含页内 skip，offset 未对齐 pageSize 时避免重复返回整页）。 */
export function pluginPaging(
  offset: unknown,
  limit: unknown,
  fallbackLimit: number,
): { page: number; pageSize: number; offset: number; skip: number } {
  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const explicit = Math.floor(Number(limit))
  const size = Number.isFinite(explicit) && explicit > 0 ? Math.min(100, explicit) : Math.max(1, Math.floor(fallbackLimit) || 24)
  return { page: Math.floor(off / size) + 1, pageSize: size, offset: off, skip: off % size }
}

/** 聊天内插件搜索：offset 翻页 + 已安装标注，供 skillhub_plugin_search 工具复用。 */
export async function searchMarketPlugins(
  cfg: PluginConfig,
  opts: { q?: unknown; category?: unknown; sort?: unknown; limit?: unknown; offset?: unknown } = {},
  fetchJsonImpl: typeof fetchJson = fetchJson,
  installedMap: Record<string, string> = readInstalledPlugins(),
): Promise<PluginSearchResult> {
  const paging = pluginPaging(opts.offset, opts.limit, cfg.maxResults)
  const category = parsePluginCategory(opts.category)
  const sort = sanitizePluginSort(opts.sort)
  const page = await listPlugins(cfg, {
    q: opts.q,
    scope: 'verified',
    category,
    sort,
    page: paging.page,
    pageSize: paging.pageSize,
  }, fetchJsonImpl, installedMap)
  // offset 未按 pageSize 对齐时（如已展示 3 张、默认 pageSize=12），页内 skip 切掉已展示部分，绝不重复返回
  const items = paging.skip > 0 ? page.items.slice(paging.skip) : page.items
  return {
    query: String(opts.q || '').trim(),
    category,
    sort,
    items,
    total: page.total,
    offset: paging.offset,
    hasMore: paging.offset + items.length < page.total,
  }
}

export async function listPlugins(
  cfg: PluginConfig,
  query: PluginListQuery = {},
  fetchJsonImpl: typeof fetchJson = fetchJson,
  installedMap: Record<string, string> = readInstalledPlugins(),
): Promise<PluginPage> {
  const url = buildPluginsUrl(cfg.apiBase, query)
  const body = await fetchJsonImpl<{ items?: unknown[]; total?: unknown; page?: unknown; pageSize?: unknown }>(
    url,
    fetchOpts(cfg),
  )
  const items = (Array.isArray(body.items) ? body.items : [])
    .map(mapMarketPlugin)
    .filter((it): it is MarketPlugin => !!it)
    .map((it) => ({ ...it, installed: isMarketPluginInstalled(it, installedMap) }))
  return {
    items,
    total: Number(body.total) || items.length,
    page: Number(body.page) || pluginPage(query.page),
    pageSize: Number(body.pageSize) || pluginPageSize(query.pageSize),
    apiBase: trimBase(cfg.apiBase),
    webBase: trimBase(cfg.webBase),
  }
}
