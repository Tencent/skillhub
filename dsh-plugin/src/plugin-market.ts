import { fetchJson } from './http.js'
import { fetchOpts } from './api.js'
import type { PluginConfig } from './types.js'

export type PluginScope = 'verified' | 'all'
export type PluginSort = 'stars' | 'updated'
export type PluginInstallability = 'verified' | 'unsupported'
export type PromptLocale = 'zh' | 'en'

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
    }
  } catch {
    return null
  }
}

export function createInstallPrompt(
  plugin: { owner: unknown; name: unknown; fullName?: unknown },
  options: { locale?: unknown; apiBase: string },
): string {
  const ref = parsePluginRef(plugin.owner, plugin.name)
  const fullName = String(plugin.fullName || ref.fullName).trim() || ref.fullName
  const plan = installPlanUrl(options.apiBase, ref.owner, ref.name)
  const locale: PromptLocale = options.locale === 'en' ? 'en' : 'zh'
  if (locale === 'en') {
    return [
      `Install the DSH plugin ${fullName}. `,
      `First read ${plan}. `,
      'Before execution, verify the repository, exact commit, DSH bundle manifest (dsh.bundle.patch), lifecycle scripts, and permissions. Stop and explain why if the plugin is not verified as installable. ',
      'Resolve the current profile directory before execution. If it is outside the writable sandbox, request one host permission scoped to dsh plugin for that profile before the compatibility preflight. ',
      "Follow the install plan's pnpm-store compatibility preflight and run only its normal install command or its two-step incompatible-store recovery sequence. Do not trial-and-error or pass --force to add. Do not modify DeepSeek Harness source or run pnpm install/add directly in the profile. Run a minimal startup check, then report success or failure.",
    ].join('')
  }
  return [
    `请安装 DSH 插件 ${fullName}。`,
    `先读取 ${plan} 获取安装计划。`,
    '在执行前核对仓库、精确 commit、DSH bundle 清单（dsh.bundle.patch）、生命周期脚本和权限；若插件未通过可安装性验证，请停止并说明原因。',
    '执行前确认当前 profile 目录；若目录不在沙箱可写范围，在兼容预检前一次性申请仅覆盖该 profile 的 dsh plugin 命令及目录的主机权限。',
    '先执行安装计划中的 pnpm store 兼容预检，再只执行普通安装命令，或 store 不兼容时的两步修复序列；不要先试错，也不要对 add 使用 --force。不要修改 DeepSeek Harness 源码，也不要在 profile 中直接运行 pnpm install/add。完成后运行最小启动验证，并回报成功或失败。',
  ].join('')
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

export async function listPlugins(
  cfg: PluginConfig,
  query: PluginListQuery = {},
  fetchJsonImpl: typeof fetchJson = fetchJson,
): Promise<PluginPage> {
  const url = buildPluginsUrl(cfg.apiBase, query)
  const body = await fetchJsonImpl<{ items?: unknown[]; total?: unknown; page?: unknown; pageSize?: unknown }>(
    url,
    fetchOpts(cfg),
  )
  const items = (Array.isArray(body.items) ? body.items : []).map(mapMarketPlugin).filter((it): it is MarketPlugin => !!it)
  return {
    items,
    total: Number(body.total) || items.length,
    page: Number(body.page) || pluginPage(query.page),
    pageSize: Number(body.pageSize) || pluginPageSize(query.pageSize),
    apiBase: trimBase(cfg.apiBase),
    webBase: trimBase(cfg.webBase),
  }
}
