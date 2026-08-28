import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fetchOpts, parseSlug } from './api.js'
import { fetchBytes } from './http.js'
import { unzipToFiles } from './unzip.js'
import type { InstalledSkill, InstalledSkillMeta, InstallResult, PluginConfig, SkillMetaStat } from './types.js'

export interface InstallDeps {
  fetchBytes: typeof fetchBytes
}

const defaultDeps: InstallDeps = { fetchBytes }

/** 单技能目录统计的截断上限:超过该文件数即停止深扫并标记 truncated。 */
export const SKILL_STAT_MAX_FILES = 2000

export function safeRelPath(raw: string): string {
  const path = String(raw || '').replace(/\\/g, '/')
  if (!path) throw new Error('空路径')
  if (path.startsWith('/') || /(?:^|\/)\.\.(?:\/|$)/.test(path) || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`不安全路径 ${raw}`)
  }
  return path
}

export function skillDir(skillsDir: string, slug: string): string {
  const root = resolve(skillsDir)
  const target = resolve(root, parseSlug(slug))
  const rel = relative(root, target)
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..')) throw new Error('拒绝路径穿越')
  return target
}

export function parseVersion(raw: unknown): string {
  const v = String(raw || '').trim().replace(/^v/i, '')
  if (!v) return ''
  if (!/^[0-9a-z][0-9a-z._+-]{0,31}$/i.test(v)) throw new Error('无效版本')
  return v
}

export async function installSkill(slug: string, cfg: PluginConfig, deps: InstallDeps = defaultDeps, signal?: AbortSignal, version?: string): Promise<InstallResult> {
  const id = parseSlug(slug)
  const requested = parseVersion(version)
  const files = await downloadSkillFiles(id, cfg, deps, signal, requested)
  if (!files['SKILL.md']) throw new Error(`技能 ${id} 缺少 SKILL.md`)
  const target = skillDir(cfg.skillsDir, id)
  await mkdir(cfg.skillsDir, { recursive: true })
  const staging = await mkdtemp(join(cfg.skillsDir, `.tmp-${id}-`))
  try {
    for (const [path, body] of Object.entries(files)) {
      const rel = safeRelPath(path)
      const dest = join(staging, rel)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, body)
    }
    await rm(target, { recursive: true, force: true })
    await rename(staging, target)
  } catch (err) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined)
    throw err
  }
  const meta = parseFrontmatter(files['SKILL.md'].toString('utf8'))
  return {
    slug: id,
    name: meta.name || id,
    version: meta.version || requested,
    path: target,
    files: Object.keys(files).length,
  }
}

async function downloadSkillFiles(slug: string, cfg: PluginConfig, deps: InstallDeps = defaultDeps, signal?: AbortSignal, version?: string): Promise<Record<string, Buffer>> {
  const id = parseSlug(slug)
  const ver = parseVersion(version)
  const zipUrl = `${cfg.apiBase.replace(/\/$/, '')}/api/v1/download?slug=${encodeURIComponent(id)}${ver ? `&version=${encodeURIComponent(ver)}` : ''}&source=dsh`
  const { body, contentType } = await deps.fetchBytes(zipUrl, fetchOpts(cfg), signal)
  if (!/zip|octet-stream/i.test(contentType) && body.subarray(0, 2).toString() !== 'PK') {
    throw new Error(`SkillHub download 不是 zip: ${id}`)
  }
  return normalizeZipFiles(unzipToFiles(body))
}

export function normalizeZipFiles(files: Record<string, Buffer>): Record<string, Buffer> {
  const keys = Object.keys(files)
  const prefix = commonTopDir(keys)
  const out: Record<string, Buffer> = {}
  for (const [path, body] of Object.entries(files)) {
    const rel = prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path
    if (!rel || rel.endsWith('/')) continue
    out[safeRelPath(rel)] = body
  }
  return out
}

export async function listInstalled(skillsDir: string): Promise<InstalledSkillMeta[]> {
  const root = resolve(skillsDir)
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const out: InstalledSkillMeta[] = []
  for (const name of entries.sort()) {
    if (name.startsWith('.')) continue
    const dir = join(root, name)
    try {
      const st = await stat(dir)
      if (!st.isDirectory()) continue
      const skillMd = join(dir, 'SKILL.md')
      const text = await readFile(skillMd, 'utf8')
      const meta = parseFrontmatter(text)
      const metaStat = await statSkillDir(dir)
      out.push({
        slug: name,
        name: meta.name || name,
        description: meta.description || '',
        version: meta.version,
        path: dir,
        ...metaStat,
      })
    } catch {
      continue
    }
  }
  return out
}

/**
 * 统计技能目录的文件数 / 总字节数 / 最新 mtime。
 * 超过 SKILL_STAT_MAX_FILES 时停止深扫并标记 truncated;单目录损坏时返回 0 值统计,不抛错。
 */
export async function statSkillDir(dir: string, maxFiles: number = SKILL_STAT_MAX_FILES): Promise<SkillMetaStat> {
  const out: SkillMetaStat = { files: 0, totalBytes: 0, mtimeMs: 0, truncated: false }
  const queue: string[] = [dir]
  while (queue.length) {
    const cur = queue.shift() as string
    let entries
    try {
      entries = await readdir(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = join(cur, ent.name)
      try {
        if (ent.isDirectory()) {
          queue.push(full)
          continue
        }
        if (!ent.isFile()) continue
        const st = await stat(full)
        out.files += 1
        out.totalBytes += st.size
        out.mtimeMs = Math.max(out.mtimeMs, st.mtimeMs)
      } catch {
        continue
      }
      if (out.files >= maxFiles) {
        out.truncated = true
        return out
      }
    }
  }
  return out
}

export async function installedSlugs(skillsDir: string): Promise<Set<string>> {
  return new Set((await listInstalled(skillsDir)).map((it) => it.slug))
}

export async function uninstallSkill(slug: string, skillsDir: string): Promise<{ slug: string; path: string }> {
  const id = parseSlug(slug)
  const target = skillDir(skillsDir, id)
  let hasSkill = false
  try {
    await readFile(join(target, 'SKILL.md'))
    hasSkill = true
  } catch {
    hasSkill = false
  }
  if (!hasSkill) throw new Error(`未安装或不含 SKILL.md: ${id}`)
  await rm(target, { recursive: true, force: true })
  return { slug: id, path: target }
}

export function parseFrontmatter(text: string): { name?: string; description?: string; version?: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const lines = match[1].split(/\r?\n/)
  const out: { name?: string; description?: string; version?: string } = {}
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(name|description|version)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1] as 'name' | 'description' | 'version'
    const raw = m[2].trim()
    const block = raw.match(/^([>|])[+-]?\d*$/)
    let value: string
    if (block) {
      const body: string[] = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (next.trim() !== '' && !/^\s/.test(next)) break
        body.push(next)
        i += 1
      }
      value = decodeYamlBlock(block[1] as '|' | '>', body)
    } else {
      value = unquoteYamlScalar(raw)
    }
    if (value) out[key] = value
  }
  return out
}

function unquoteYamlScalar(raw: string): string {
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1)
  }
  return raw
}

/** YAML `|` keeps newlines; `>` folds them. Indent is stripped; trailing blank lines dropped. */
function decodeYamlBlock(style: '|' | '>', body: string[]): string {
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  const nonempty = body.filter((line) => line.trim() !== '')
  const minIndent = nonempty.length
    ? Math.min(...nonempty.map((line) => (line.match(/^(\s*)/)?.[1].length ?? 0)))
    : 0
  const stripped = body.map((line) => line.slice(Math.min(minIndent, line.length)))
  if (style === '>') {
    const paras: string[] = []
    let cur: string[] = []
    for (const line of stripped) {
      if (line.trim() === '') {
        if (cur.length) {
          paras.push(cur.join(' '))
          cur = []
        }
        continue
      }
      cur.push(line.trimEnd())
    }
    if (cur.length) paras.push(cur.join(' '))
    return paras.join('\n').trim()
  }
  return stripped.join('\n').trim()
}

function commonTopDir(paths: string[]): string {
  if (!paths.length) return ''
  const first = paths[0].replace(/\\/g, '/').split('/')[0]
  if (!first || first.includes('.')) return ''
  return paths.every((p) => p.replace(/\\/g, '/').startsWith(`${first}/`)) ? `${first}/` : ''
}
