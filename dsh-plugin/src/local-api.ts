import type { IncomingMessage, ServerResponse } from 'node:http'
import { clamp, fetchSkillCard, parseSlug, searchSkills } from './api.js'
import { parseCategory } from './categories.js'
import { assignConfig, publicConfig, sanitizePatch, sanitizeSortBy, writeOverlay } from './config-store.js'
import { BOOT_ID, progress, publicInstallStatus } from './dsh-cli.js'
import { fetchBytes } from './http.js'
import { installSkill, installedSlugs, listInstalled, uninstallSkill } from './install.js'
import { listInstalledPlugins, readInstalledPluginReadme, removeInstalledPlugin } from './installed-plugins.js'
import { loaderHost, setLivePluginDisabled } from './live-plugin.js'
import { renderMarkdown } from './markdown.js'
import {
  fetchInstallPlan,
  installMarketPlugin,
  isPluginInstallBusy,
  listPluginCategories,
  listPlugins,
  parsePluginRef,
  resolveInstallSource,
  withPluginInstallLock,
} from './plugin-market.js'
import { scheduleRestart, servingPort, trustedRestartRequest } from './restart.js'
import { fetchEvalScore, fetchSkillTab } from './skill-detail.js'
import { getUpdateStatus, updateToLatestRelease } from './self-update.js'
import type { PluginConfig, SkillCard } from './types.js'

let restarting = false

export async function handleApi(req: IncomingMessage, res: ServerResponse, cfg: PluginConfig): Promise<void> {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const body = req.method === 'POST' ? await readBody(req) : {}
    const method = String(body.method || url.searchParams.get('method') || 'search')
    if (method === 'search') {
      const query = String(body.query || url.searchParams.get('query') || '').trim()
      const category = parseCategory(body.category || url.searchParams.get('category'))
      const explicit = Number(body.limit)
      const limit = Number.isFinite(explicit) && explicit > 0 ? clamp(explicit, 1, 80) : cfg.maxResults
      const offset = Math.max(0, Math.floor(Number(body.offset) || 0))
      const installed = await installedSlugs(cfg.skillsDir)
      const result = await searchSkills(query, {
        cfg,
        queries: body.queries,
        category,
        sortBy: sanitizeSortBy(body.sortBy, query ? cfg.sortBy : 'downloads'),
        limit,
        offset,
        installed,
      })
      await attachRatings(result.items, cfg)
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'install') {
      const slug = String(body.slug || url.searchParams.get('slug') || '').trim()
      if (!slug) return sendJson(res, 400, { ok: false, error: '缺少 slug' })
      const version = String(body.version || url.searchParams.get('version') || '').trim()
      const result = await installSkill(slug, cfg, undefined, undefined, version || undefined)
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'list') {
      const items = await listInstalled(cfg.skillsDir)
      return sendJson(res, 200, { ok: true, skillsDir: cfg.skillsDir, items })
    }
    if (method === 'uninstall') {
      const slug = String(body.slug || url.searchParams.get('slug') || '').trim()
      if (!slug) return sendJson(res, 400, { ok: false, error: '缺少 slug' })
      const result = await uninstallSkill(slug, cfg.skillsDir)
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'config') {
      if (body.save) {
        assignConfig(cfg, sanitizePatch(body))
        writeOverlay(cfg)
      }
      return sendJson(res, 200, { ok: true, ...publicConfig(cfg) })
    }
    if (method === 'updateCheck') {
      const status = await getUpdateStatus({ timeoutMs: Math.min(cfg.timeoutMs, 20000), userAgent: cfg.userAgent })
      return sendJson(res, 200, { ok: true, ...status })
    }
    if (method === 'update') {
      const result = await updateToLatestRelease({
        timeoutMs: Math.max(cfg.timeoutMs, 120000),
        userAgent: cfg.userAgent,
      })
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'pluginCategories') {
      const items = await listPluginCategories(cfg)
      return sendJson(res, 200, { ok: true, items })
    }
    if (method === 'installedPlugins') {
      const result = await listInstalledPlugins()
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'pluginReadme') {
      const pkg = String(body.pkg || url.searchParams.get('pkg') || '').trim()
      if (!pkg) return sendJson(res, 400, { ok: false, error: '缺少 pkg' })
      const result = await readInstalledPluginReadme(pkg)
      return sendJson(res, 200, { ok: true, ...result, html: renderMarkdown(result.readme) })
    }
    if (method === 'pluginUninstall') {
      const pkg = String(body.pkg || url.searchParams.get('pkg') || '').trim()
      if (!pkg) return sendJson(res, 400, { ok: false, error: '缺少 pkg' })
      const result = await withPluginInstallLock(async () => {
        // Drop the live loader fiber first so client-modules stops serving
        // /plugins/<pkg>/client.js before dsh plugin remove deletes the files.
        const live = await setLivePluginDisabled(pkg, true, loaderHost())
        try {
          const removed = await removeInstalledPlugin(pkg)
          return { ...removed, restart: true }
        } catch (err) {
          if (live) await setLivePluginDisabled(pkg, false, loaderHost()).catch(() => false)
          throw err
        }
      })
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'plugins') {
      const result = await listPlugins(cfg, {
        q: body.q ?? body.query ?? url.searchParams.get('q'),
        scope: body.scope ?? url.searchParams.get('scope'),
        category: body.category ?? url.searchParams.get('category'),
        sort: body.sort ?? url.searchParams.get('sort'),
        page: body.page ?? url.searchParams.get('page'),
        pageSize: body.pageSize ?? body.limit ?? url.searchParams.get('page_size') ?? url.searchParams.get('pageSize'),
      })
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'pluginInstallPlan') {
      const ref = parsePluginRef(body.owner ?? url.searchParams.get('owner'), body.name ?? url.searchParams.get('name'))
      const plan = await fetchInstallPlan(cfg, ref.owner, ref.name)
      const source = resolveInstallSource(plan, ref)
      const plugin = (plan && typeof plan === 'object' ? (plan as { plugin?: { repositoryUrl?: unknown } }).plugin : undefined) || {}
      return sendJson(res, 200, { ok: true, source, repositoryUrl: String(plugin.repositoryUrl || '') })
    }
    if (method === 'pluginInstall') {
      const result = await withPluginInstallLock(() => installMarketPlugin(
        {
          owner: body.owner ?? url.searchParams.get('owner'),
          name: body.name ?? url.searchParams.get('name'),
          fullName: body.fullName ?? url.searchParams.get('fullName'),
        },
        cfg,
      ))
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (method === 'pluginInstallStatus') {
      return sendJson(res, 200, {
        ok: true,
        ...publicInstallStatus(),
        busy: isPluginInstallBusy() || progress.active,
        restart: true,
        boot: BOOT_ID,
      })
    }
    if (method === 'pluginRestart') {
      if (!trustedRestartRequest(req)) return sendJson(res, 403, { ok: false, error: 'restart is limited to same-origin requests' })
      if (isPluginInstallBusy() || progress.active) return sendJson(res, 409, { ok: false, error: 'cannot restart while a plugin operation is running' })
      if (restarting) return sendJson(res, 409, { ok: false, error: 'restart already scheduled' })
      restarting = true
      try {
        const result = scheduleRestart(servingPort(req))
        return sendJson(res, 202, { ok: true, pid: result.pid, helperPid: result.helperPid, via: result.via })
      } catch (err) {
        restarting = false
        throw err
      }
    }
    if (method === 'detail') {
      const slug = parseSlug(String(body.slug || url.searchParams.get('slug') || ''))
      const installed = await installedSlugs(cfg.skillsDir)
      const [card, rating] = await Promise.all([
        fetchSkillCard(slug, cfg, installed),
        fetchEvalScore(slug, cfg),
      ])
      if (card && rating != null) card.rating = rating
      return sendJson(res, 200, {
        ok: true,
        slug,
        installed: installed.has(slug),
        version: card?.version || '',
        card,
      })
    }
    if (method === 'skillTab') {
      const slug = parseSlug(String(body.slug || url.searchParams.get('slug') || ''))
      const tab = String(body.tab || url.searchParams.get('tab') || '').trim()
      if (!tab) return sendJson(res, 400, { ok: false, error: '缺少 tab' })
      const result = await fetchSkillTab(slug, tab, cfg)
      return sendJson(res, 200, { ok: true, slug, ...result })
    }
    sendJson(res, 400, { ok: false, error: 'unknown method' })
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

export async function handleIcon(req: IncomingMessage, res: ServerResponse, cfg: PluginConfig): Promise<void> {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const target = url.searchParams.get('url') || ''
    if (!/^https:\/\//i.test(target)) {
      res.statusCode = 400
      res.end('bad url')
      return
    }
    const { body, contentType } = await fetchBytes(target, { timeoutMs: Math.min(cfg.timeoutMs, 15000), userAgent: cfg.userAgent })
    res.statusCode = 200
    res.setHeader('content-type', contentType.startsWith('image/') ? contentType : 'image/png')
    res.setHeader('cache-control', 'public, max-age=3600')
    res.end(body)
  } catch (err) {
    res.statusCode = 502
    res.end(err instanceof Error ? err.message : 'icon failed')
  }
}

async function attachRatings(items: SkillCard[], cfg: PluginConfig): Promise<void> {
  await Promise.all(items.slice(0, 24).map(async (it) => {
    const rating = await fetchEvalScore(it.slug, cfg)
    if (rating != null) it.rating = rating
  }))
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
