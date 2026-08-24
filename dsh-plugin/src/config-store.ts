import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { PluginConfig, SortBy } from './types.js'

const SORTS: SortBy[] = ['score', 'downloads', 'stars', 'installs', 'updated_at']

export function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function defaultSkillsDir(): string {
  return join(dshHome(), 'skills')
}

export function overlayPath(): string {
  return join(dshHome(), 'skillhub.json')
}

export function sanitizeSortBy(raw: unknown, fallback: SortBy = 'score'): SortBy {
  const value = String(raw || '').trim() as SortBy
  return SORTS.includes(value) ? value : fallback
}

export function publicConfig(cfg: PluginConfig): Omit<PluginConfig, 'userAgent'> {
  return {
    apiBase: cfg.apiBase,
    webBase: cfg.webBase,
    skillsDir: cfg.skillsDir,
    timeoutMs: cfg.timeoutMs,
    maxResults: cfg.maxResults,
    sortBy: cfg.sortBy,
  }
}

export function readOverlay(): Partial<PluginConfig> {
  try {
    const raw = JSON.parse(readFileSync(overlayPath(), 'utf8')) as Record<string, unknown>
    return sanitizePatch(raw)
  } catch {
    return {}
  }
}

export function writeOverlay(cfg: PluginConfig): void {
  const path = overlayPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(publicConfig(cfg), null, 2)}\n`)
}

export function sanitizePatch(raw: Record<string, unknown>): Partial<PluginConfig> {
  const out: Partial<PluginConfig> = {}
  if (typeof raw.apiBase === 'string' && /^https?:\/\//i.test(raw.apiBase.trim())) out.apiBase = raw.apiBase.trim().replace(/\/$/, '')
  if (typeof raw.webBase === 'string' && /^https?:\/\//i.test(raw.webBase.trim())) out.webBase = raw.webBase.trim().replace(/\/$/, '')
  if (typeof raw.skillsDir === 'string' && raw.skillsDir.trim()) out.skillsDir = raw.skillsDir.trim()
  if (typeof raw.userAgent === 'string' && raw.userAgent.trim()) out.userAgent = raw.userAgent.trim()
  const timeout = Number(raw.timeoutMs)
  if (Number.isFinite(timeout) && timeout >= 3000) out.timeoutMs = Math.min(timeout, 120000)
  const max = Number(raw.maxResults)
  if (Number.isFinite(max) && max >= 1) out.maxResults = Math.min(Math.floor(max), 80)
  if (raw.sortBy !== undefined) out.sortBy = sanitizeSortBy(raw.sortBy)
  return out
}

export function assignConfig(live: PluginConfig, patch: Partial<PluginConfig>): PluginConfig {
  if (patch.apiBase) live.apiBase = patch.apiBase
  if (patch.webBase) live.webBase = patch.webBase
  if (patch.skillsDir) live.skillsDir = patch.skillsDir
  if (patch.userAgent) live.userAgent = patch.userAgent
  if (patch.timeoutMs != null) live.timeoutMs = patch.timeoutMs
  if (patch.maxResults != null) live.maxResults = patch.maxResults
  if (patch.sortBy) live.sortBy = patch.sortBy
  return live
}

export function withDefaults(config: Partial<PluginConfig>): PluginConfig {
  return {
    apiBase: config.apiBase || 'https://api.skillhub.cn',
    webBase: config.webBase || 'https://skillhub.cn',
    skillsDir: config.skillsDir || defaultSkillsDir(),
    timeoutMs: config.timeoutMs || 20000,
    userAgent: config.userAgent || 'Mozilla/5.0 (compatible; skillhub/0.1)',
    maxResults: config.maxResults || 12,
    sortBy: sanitizeSortBy(config.sortBy, 'score'),
  }
}
