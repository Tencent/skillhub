import { fetchOpts, parseSlug } from './api.js'
import { fetchJson } from './http.js'
import type { PluginConfig } from './types.js'

export const TRACE_DIMS = [
  { key: 'trust', letter: 'T', name: '可信任度' },
  { key: 'reliability', letter: 'R', name: '可靠性' },
  { key: 'adaptability', letter: 'A', name: '适用性' },
  { key: 'convention', letter: 'C', name: '规范性' },
  { key: 'effectiveness', letter: 'E', name: '有效性' },
] as const

export interface DetailDeps {
  fetchJson: typeof fetchJson
}

const defaultDeps: DetailDeps = { fetchJson }

export function dimScore(dim: unknown): number | null {
  if (!dim || typeof dim !== 'object') return null
  const items = (dim as { items?: Record<string, { score?: unknown }> }).items
  const scores = Object.values(items || {}).map((it) => Number(it?.score)).filter((n) => Number.isFinite(n))
  if (!scores.length) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

export function overallScore(dimensions: Record<string, unknown> | undefined): number | null {
  const scores = TRACE_DIMS.map((d) => dimScore(dimensions?.[d.key])).filter((n): n is number => n != null)
  if (!scores.length) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

export async function fetchEvalScore(
  slug: string,
  cfg: PluginConfig,
  deps: DetailDeps = defaultDeps,
  signal?: AbortSignal,
): Promise<number | null> {
  const id = parseSlug(slug)
  try {
    const raw = await deps.fetchJson<EvalRaw>(url(cfg, id, 'evaluation'), fetchOpts(cfg), signal)
    return overallScore(raw.dimensions)
  } catch {
    return null
  }
}

export async function fetchSkillTab(
  slug: string,
  tab: string,
  cfg: PluginConfig,
  deps: DetailDeps = defaultDeps,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const id = parseSlug(slug)
  if (tab === 'versions') {
    const raw = await deps.fetchJson<VersionList>(url(cfg, id, 'versions'), fetchOpts(cfg), signal)
    return {
      tab,
      versions: (raw.versions || []).slice(0, 40).map((v) => ({
        version: String(v.version || ''),
        changelog: String(v.changelog || '').slice(0, 500),
        createdAt: Number(v.createdAt) || 0,
      })),
    }
  }
  if (tab === 'evaluation') {
    try {
      const raw = await deps.fetchJson<EvalRaw>(url(cfg, id, 'evaluation'), fetchOpts(cfg), signal)
      return { tab, evaluation: sanitizeEval(raw) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/404|not found/i.test(msg)) return { tab, evaluation: null }
      throw err
    }
  }
  throw new Error(`未知 tab: ${tab}`)
}

function sanitizeEval(raw: EvalRaw): Record<string, unknown> {
  const dimensions: Record<string, unknown> = {}
  for (const dim of TRACE_DIMS) {
    const src = raw.dimensions?.[dim.key]
    if (!src || typeof src !== 'object') continue
    const items: Record<string, unknown> = {}
    for (const [key, it] of Object.entries(src.items || {})) {
      items[key] = { score: Number(it?.score) || 0, userReason: String(it?.userReason || '').slice(0, 400) }
    }
    dimensions[dim.key] = {
      score: dimScore(src),
      userReason: String(src.userReason || '').slice(0, 1200),
      items,
    }
  }
  return {
    userSummary: String(raw.userSummary || raw.summary || '').slice(0, 1200),
    score: overallScore(raw.dimensions),
    dimensions,
  }
}

function url(cfg: PluginConfig, slug: string, suffix: string): string {
  return `${cfg.apiBase.replace(/\/$/, '')}/api/v1/skills/${encodeURIComponent(slug)}/${suffix}`
}

interface VersionList {
  versions?: Array<{ version?: string; changelog?: string; createdAt?: number }>
}

interface EvalRaw {
  summary?: string
  userSummary?: string
  dimensions?: Record<string, { userReason?: string; items?: Record<string, { score?: number; userReason?: string }> }>
}
