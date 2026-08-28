import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'
import { clamp, searchSkills } from './api.js'
import { CATEGORY_KEYS, categoryLabel, parseCategory } from './categories.js'
import { assignConfig, readOverlay, sanitizeSortBy, withDefaults } from './config-store.js'
import { installSkill, installedSlugs, listInstalled, uninstallSkill } from './install.js'
import { handleApi, handleIcon } from './local-api.js'
import {
  INSTALL_TIMEOUT_MS,
} from './dsh-cli.js'
import { bindLoaderHost, type LoaderHost } from './live-plugin.js'
import {
  PLUGIN_CATEGORY_KEYS,
  installMarketPlugin,
  searchMarketPlugins,
  pluginPaging,
  withPluginInstallLock,
  type PluginInstallResult,
  type PluginSearchResult,
} from './plugin-market.js'
import type { InstallResult, InstalledSkill, PluginConfig, SearchResult, SortBy } from './types.js'

export const name = 'skillhub'
export const inject = ['tools']

export interface Config extends PluginConfig {}

export const Config: Schema<Config> = Schema.object({
  apiBase: Schema.string().default('https://api.skillhub.cn').description('SkillHub API'),
  webBase: Schema.string().default('https://skillhub.cn').description('技能主页'),
  skillsDir: Schema.string().description('安装目录，默认 $DSH_HOME/skills'),
  timeoutMs: Schema.number().default(20000).description('上游请求超时（毫秒）'),
  userAgent: Schema.string().default('Mozilla/5.0 (compatible; skillhub/0.1)').description('请求 UA'),
  maxResults: Schema.number().default(12).description('搜索结果上限'),
  sortBy: Schema.union(['score', 'downloads', 'stars', 'installs', 'updated_at'] as const).default('score').description('默认排序'),
})

export function apply(ctx: Context, config: Config): void {
  bindLoaderHost(ctx as unknown as LoaderHost)
  const cfg = withDefaults(config)
  assignConfig(cfg, readOverlay())

  ctx.tools.register(defineTool({
    name: 'skillhub_search',
    description:
      'Search SkillHub and show clickable skill cards. ALWAYS call this instead of web_search, skill-catalog, load_skill, or bash when the user wants to find/recommend/browse skills. Call EXACTLY ONCE per user message. You extract the search topic: pass a real keyword (PDF, 周报), not the user\'s whole sentence. Omit query to browse popular skills. For 还有吗, reuse the previous query with offset = cards already shown. After cards appear, reply with AT MOST one short sentence.',
    parameters: {
      query: { type: 'string', description: 'Main keyword, e.g. PDF or 周报. Optional when category is set.' },
      queries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional extra keywords/synonyms for this SAME call. Merged into one card group. Do not make extra skillhub_search calls.',
      },
      category: {
        type: 'string',
        description: `Optional first-level category: ${CATEGORY_KEYS.join(', ')}`,
      },
      sortBy: { type: 'string', description: 'score, downloads, stars, installs, updated_at. Default score.' },
      limit: { type: 'number', description: 'Cards in this batch. Default from config.' },
      offset: { type: 'number', description: 'Skip this many already-shown cards when the user wants more.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderSearch(value as unknown as SearchResult) }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-search', ...(value as object) }),
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `SkillHub · ${String(args.query || args.category || '浏览')}`,
      kind: 'search',
      content: [],
    }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? 'SkillHub 搜索失败' : `SkillHub · ${(meta as SearchResult | undefined)?.items?.length ?? 0} 条`,
      content: [],
    }),
    timeoutMs: cfg.timeoutMs + 5000,
    async execute(args, exec) {
      const query = String(args.query || '').trim()
      const category = parseCategory(args.category)
      const installed = await installedSlugs(cfg.skillsDir)
      const explicit = Number(args.limit)
      const limit = Number.isFinite(explicit) && explicit > 0 ? clamp(explicit, 1, 80) : cfg.maxResults
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
      const sortBy = sanitizeSortBy(args.sortBy, query ? cfg.sortBy : 'downloads') as SortBy
      return cloneJson(await searchSkills(query, {
        cfg,
        queries: args.queries,
        category,
        sortBy,
        limit,
        offset,
        installed,
        signal: exec.signal,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skillhub_install',
    description:
      'Install a SkillHub skill into the configured skills directory after the user chooses one. Pass the slug from skillhub_search. Do not print CLI commands. After success, say the skill is installed.',
    parameters: {
      slug: { type: 'string', required: true, description: 'Skill slug from search, e.g. pdf-ocr-md' },
      version: { type: 'string', description: 'Optional exact version such as 1.0.0. Default is latest.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderInstall(value as unknown as InstallResult) }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-install', ...(value as object) }),
    },
    presentCall: (args) => ({ card: 'generic', title: `安装 · ${args.slug}`, kind: 'search', content: [] }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? '安装失败' : `已安装 · ${(meta as InstallResult | undefined)?.name || ''}`,
      content: [],
    }),
    timeoutMs: cfg.timeoutMs + 15000,
    async execute(args, exec) {
      return cloneJson(await installSkill(String(args.slug || ''), cfg, undefined, exec.signal, args.version ? String(args.version) : undefined))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skillhub_plugin_search',
    description:
      'Search DeepSeek Harness (DSH) plugins and show clickable plugin cards. ALWAYS call this instead of web_search or bash when the user wants to find/recommend/browse DSH plugins (插件). Call EXACTLY ONCE per user message. You extract the search topic: pass a real keyword (浏览器自动化, browser), not the user\'s whole sentence. Omit query to browse popular plugins. For 还有吗 / "more?", you MUST reuse the previous query AND pass offset = number of cards already shown — calling again with offset=0 re-shows the SAME cards and is strictly forbidden. After cards appear, reply with AT MOST one short sentence.',
    parameters: {
      query: { type: 'string', description: 'Main keyword, e.g. 浏览器自动化 or browser. Optional when category is set.' },
      category: {
        type: 'string',
        description: `Optional first-level plugin category: ${PLUGIN_CATEGORY_KEYS.join(', ')}`,
      },
      sort: { type: 'string', description: 'stars or updated. Default stars.' },
      limit: { type: 'number', description: 'Cards in this batch. Default from config.' },
      offset: { type: 'number', description: 'Skip this many already-shown cards when the user wants more.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderPluginSearch(value as unknown as PluginSearchResult) }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-plugin-search', ...(value as object) }),
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `SkillHub 插件 · ${String(args.query || args.category || '浏览')}`,
      kind: 'search',
      content: [],
    }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? '插件搜索失败' : `SkillHub 插件 · ${(meta as PluginSearchResult | undefined)?.items?.length ?? 0} 款`,
      content: [],
    }),
    timeoutMs: cfg.timeoutMs + 5000,
    async execute(args) {
      return cloneJson(await searchMarketPlugins(cfg, {
        q: args.query,
        category: args.category,
        sort: args.sort,
        limit: args.limit,
        offset: args.offset,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skillhub_plugin_install',
    description:
      'Install a DeepSeek Harness (DSH) plugin into the current web profile after the user names one (装第一个 / 安装 dsh-browser). Pass owner and name from skillhub_plugin_search results. Runs the same install-plan checks as the plugin market. Do not print CLI commands. After success, tell the user to restart dsh web.',
    parameters: {
      owner: { type: 'string', required: true, description: 'Plugin owner from search, e.g. deepseek-ai' },
      name: { type: 'string', required: true, description: 'Plugin name from search, e.g. dsh-browser' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderPluginInstall(value as unknown as PluginInstallResult) }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-plugin-install', ...(value as object) }),
    },
    presentCall: (args) => ({ card: 'generic', title: `安装插件 · ${args.owner}/${args.name}`, kind: 'search', content: [] }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? '插件安装失败' : `已装插件 · ${(meta as PluginInstallResult | undefined)?.fullName || ''}`,
      content: [],
    }),
    timeoutMs: INSTALL_TIMEOUT_MS + 60000,
    async execute(args) {
      return cloneJson(await withPluginInstallLock(() => installMarketPlugin({
        owner: args.owner,
        name: args.name,
      }, cfg)))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skillhub_list',
    description: 'List skills already installed in the SkillHub plugin skills directory. Use when the user asks what skills are installed or to manage local skills.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderList(value as unknown as { items: InstalledSkill[]; skillsDir: string }) }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-list', ...(value as object) }),
    },
    presentCall: () => ({ card: 'generic', title: '已装技能', kind: 'search', content: [] }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? '列出失败' : `已装 · ${(meta as { items?: InstalledSkill[] } | undefined)?.items?.length ?? 0} 个`,
      content: [],
    }),
    async execute() {
      const items = await listInstalled(cfg.skillsDir)
      return cloneJson({ skillsDir: cfg.skillsDir, items })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'skillhub_uninstall',
    description: 'Uninstall a locally installed skill by slug. Only removes a directory under the configured skills directory that contains SKILL.md.',
    parameters: {
      slug: { type: 'string', required: true, description: 'Installed skill directory name / slug' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: `已卸载 ${(value as { slug: string }).slug}` }],
      presentationMeta: (_args, value) => ({ kind: 'skillhub-uninstall', ...(value as object) }),
    },
    presentCall: (args) => ({ card: 'generic', title: `卸载 · ${args.slug}`, content: [] }),
    presentResult: (_args, { isError, meta }) => ({
      card: 'generic',
      title: isError ? '卸载失败' : `已卸载 · ${(meta as { slug?: string } | undefined)?.slug || ''}`,
      content: [],
    }),
    async execute(args) {
      return cloneJson(await uninstallSkill(String(args.slug || ''), cfg.skillsDir))
    },
  }))

  ctx.inject(['systemPrompt'], (c) => {
    const prompt = (c as unknown as {
      systemPrompt: {
        section: (section: { name: string; order: number; text: string | (() => string) }) => void
      }
    }).systemPrompt
    prompt.section({
      name: 'tool:skillhub',
      order: 210,
      text: [
        'Finding / recommending / browsing Agent Skills or SkillHub skills: you MUST call skillhub_search. Never web_search, skill-catalog, load_skill, bash, or SKILL.md dump. Never print skillhub install, curl, or sh -c.',
        'You decide the keyword. Extract a real topic from the user; do not paste their whole sentence as query. No topic / just 好玩 有趣 推荐 → omit query to browse. 还有吗 → same previous query + offset. One call per user message.',
        'Do not say 点卡片查看 unless skillhub_search has already returned cards in this turn.',
        'After cards appear, reply with AT MOST one short sentence. Do NOT list skills or write essays.',
        'Install only after the user chooses a card: skillhub_install with that slug. Then one short sentence.',
        `Categories: ${CATEGORY_KEYS.map((k) => `${k}=${categoryLabel(k)}`).join(', ')}.`,
        'For installed skills, call skillhub_list / skillhub_uninstall.',
        'Finding / recommending / browsing DeepSeek Harness (DSH) plugins (插件): you MUST call skillhub_plugin_search, never web_search, bash, or printing install commands. One call per user message; extract a real keyword. 还有吗 → same previous query + offset. After plugin cards appear, reply with AT MOST one short sentence.',
        `Plugin categories: ${PLUGIN_CATEGORY_KEYS.join(', ')}.`,
        'Install a plugin only after the user names one from the cards: skillhub_plugin_install with its owner and name. Then one short sentence reminding them to restart dsh web. Never print dsh plugin / npm / curl commands.',
      ].join(' '),
    })
  })

  ctx.inject(['webServer'], (c) => {
    const server = (c as unknown as { webServer: { register: (route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }) => void } }).webServer
    server.register({ kind: 'exact', path: '/skillhub', handler: (req, res) => handleApi(req, res, cfg) })
    server.register({ kind: 'exact', path: '/skillhub/icon', handler: (req, res) => handleIcon(req, res, cfg) })
  })

  // 插件配置页按 Host settings 命名空间分发 settings.plugin.item。
  // 不登记 skillhub 的话，客户端卡片永远不会被 dispatch。
  ctx.inject(['settings'], (c) => {
    const settings = (c as unknown as {
      settings: { register: (ns: string, schema: typeof Config, options?: { base?: Config }) => void }
    }).settings
    settings.register('skillhub', Config, { base: config })
  })

  // 启动自检:验证「还有吗」offset 分页不再重复返回已展示卡片(D1 回归保护)。
  // fire-and-forget,失败只记日志,不影响插件加载。
  void selfCheckPluginPaging(cfg)
}

/** 启动自检:pluginPaging 页内 skip + 真实 API 两页零重复。fetchJsonImpl 仅测试注入用。 */
export async function selfCheckPluginPaging(
  cfg: PluginConfig,
  fetchJsonImpl?: Parameters<typeof searchMarketPlugins>[2],
): Promise<boolean> {
  try {
    const paging = pluginPaging(3, undefined, cfg.maxResults)
    if (paging.skip !== 3 || paging.page !== 1) {
      console.error(`[skillhub] self-check FAILED: pluginPaging(3) 应得 skip=3/page=1, 实际 skip=${paging.skip} page=${paging.page}`)
      return false
    }
    const first = await searchMarketPlugins(cfg, { q: 'agent', limit: 5, offset: 0 }, fetchJsonImpl)
    const second = await searchMarketPlugins(cfg, { q: 'agent', limit: 5, offset: first.items.length }, fetchJsonImpl)
    const shown = new Set(first.items.map((it) => it.fullName))
    const dup = second.items.filter((it) => shown.has(it.fullName))
    if (dup.length) {
      console.error(`[skillhub] self-check FAILED: 「还有吗」分页重复返回 ${dup.length} 张已展示卡片: ${dup.map((it) => it.fullName).join(', ')}`)
      return false
    }
    console.log(`[skillhub] self-check ok: 插件分页两页零重复(${first.items.length}+${second.items.length} 条, total=${first.total})`)
    return true
  } catch (err) {
    console.warn(`[skillhub] self-check 未完成(网络/配置原因,不影响使用): ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

function cloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

export function renderSearch(result: SearchResult): string {
  if (!result.items?.length) return '没有找到相关技能。对用户只说一句：没找到，可以换个词再搜。不要写长文。'
  const lines = result.items.map((it, i) => `${i + 1}. ${it.name}${it.installed ? '（已安装）' : ''} · ${it.slug}`)
  const start = result.offset || 0
  const shown = start + result.items.length
  const more = result.hasMore
    ? `用户若问还有吗，立刻再调用 skillhub_search 一次，query 仍为「${result.query}」，offset=${shown}。`
    : '已经全部列出。'
  const note = result.fallback ? '本次是热门浏览（原关键词没有结果或没有更多）。' : ''
  return [
    `卡片已展示 ${result.items.length} 条（内部序号，禁止复述给用户）：`,
    lines.join('\n'),
    `${note}对用户最多回一句短话。禁止清单和长文。不要再调用 skillhub_search。${more}`,
  ].join('\n')
}

export function renderInstall(result: InstallResult): string {
  return `✅ ${result.name} 已安装到 ${result.path}。新对话即可被 skill 工具发现。不要打印安装命令。`
}

export function renderList(result: { items: InstalledSkill[]; skillsDir: string }): string {
  if (!result.items?.length) return `还没有安装技能。目录：${result.skillsDir}`
  const lines = result.items.map((it, i) => `${i + 1}. ${it.name} (${it.slug})${it.version ? ` v${it.version}` : ''}`)
  return `已安装 ${result.items.length} 个技能（${result.skillsDir}）：\n${lines.join('\n')}`
}

export function renderPluginSearch(result: PluginSearchResult): string {
  if (!result.items?.length) {
    if ((result.offset || 0) > 0) return '本页没有新的插件了。对用户只说一句：没有了，前面都列过了。不要写长文。绝对禁止再次调用 skillhub_plugin_search。'
    return '没有找到相关插件。对用户只说一句：没找到，可以换个词再搜。不要写长文。'
  }
  const lines = result.items.map((it, i) => `${i + 1}. ${it.owner}/${it.name}${it.installed ? '（已安装）' : ''}`)
  const start = result.offset || 0
  const shown = start + result.items.length
  const more = result.hasMore
    ? `用户若问还有吗，立刻再调用 skillhub_plugin_search 一次，query 仍为「${result.query}」且必须带 offset=${shown}。不带 offset 或 offset=0 会把上面这 ${result.items.length} 张卡片原样再展示一遍，属于严重错误，绝对禁止。`
    : `已经全部列出。用户再问还有吗时，直接回答"没有了，前面都列过了"，绝对禁止再次调用 skillhub_plugin_search。`
  return [
    `插件卡片已展示 ${result.items.length} 条（内部序号，禁止复述给用户）：`,
    lines.join('\n'),
    `对用户最多回一句短话。禁止清单和长文。不要再调用 skillhub_plugin_search。用户点名安装时才调 skillhub_plugin_install（owner+name）。${more}`,
  ].join('\n')
}

export function renderPluginInstall(result: PluginInstallResult): string {
  return `✅ ${result.fullName} 已安装，请重启 dsh web 后生效。对用户只说一句含重启提示的短话。不要打印安装命令。`
}
