import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { withDefaults } from '../config-store.js'
import { installSkill, installedSlugs, listInstalled, normalizeZipFiles, parseFrontmatter, parseVersion, safeRelPath, skillDir, statSkillDir, uninstallSkill } from '../install.js'
import { unzipToFiles } from '../unzip.js'
import { makeDeflatedZip, makeDescriptorZip } from './helpers/zip.js'
import type { PluginConfig } from '../types.js'

test('safeRelPath rejects traversal', () => {
  assert.equal(safeRelPath('SKILL.md'), 'SKILL.md')
  assert.equal(safeRelPath('references/api.md'), 'references/api.md')
  assert.throws(() => safeRelPath('../etc/passwd'), /不安全路径/)
  assert.throws(() => safeRelPath('/abs'), /不安全路径/)
  assert.throws(() => safeRelPath('foo/../bar'), /不安全路径/)
  assert.throws(() => safeRelPath(''), /空路径/)
})

test('parseVersion strips v prefix and rejects junk', () => {
  assert.equal(parseVersion(''), '')
  assert.equal(parseVersion('v1.0.0'), '1.0.0')
  assert.equal(parseVersion('1.2.3'), '1.2.3')
  assert.throws(() => parseVersion('../x'), /无效版本/)
  assert.throws(() => parseVersion('1 0'), /无效版本/)
})

test('install fetches specified version via zip download', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-ver-'))
  const urls: string[] = []
  const zip = makeZip({
    'SKILL.md': '---\nname: tianji\nversion: 1.0.0\n---\n',
  })
  const result = await installSkill('tianji', testCfg(dir), {
    fetchBytes: async (url: string) => {
      urls.push(String(url))
      return { body: zip, contentType: 'application/zip' }
    },
  }, undefined, 'v1.0.0')
  assert.equal(urls.length, 1)
  assert.match(urls[0], /\/api\/v1\/download\?slug=tianji&version=1\.0\.0&source=dsh$/)
  assert.equal(result.version, '1.0.0')
  await rm(dir, { recursive: true, force: true })
})

test('skillDir stays inside skills root', () => {
  const root = '/tmp/skills-root'
  assert.equal(skillDir(root, 'pdf-ocr-md'), join(root, 'pdf-ocr-md'))
  assert.throws(() => skillDir(root, '../escape'), /无效 slug/)
})

test('parseFrontmatter reads name and description', () => {
  const meta = parseFrontmatter('---\nname: demo\ndescription: "hello"\nversion: 1.0.0\n---\n# body\n')
  assert.equal(meta.name, 'demo')
  assert.equal(meta.description, 'hello')
  assert.equal(meta.version, '1.0.0')
})

test('parseFrontmatter accepts CRLF and ignores missing fences', () => {
  const meta = parseFrontmatter('---\r\nname: crlf\r\n---\r\nbody')
  assert.equal(meta.name, 'crlf')
  assert.deepEqual(parseFrontmatter('# no frontmatter\n'), {})
})

test('parseFrontmatter reads YAML | and > block scalars', () => {
  const literal = parseFrontmatter(
    '---\nname: ima-skill\ndescription: |\n  统一的 IMA 技能。\n  支持笔记和知识库。\nhomepage: https://ima.qq.com\n---\n# body\n',
  )
  assert.equal(literal.name, 'ima-skill')
  assert.equal(literal.description, '统一的 IMA 技能。\n支持笔记和知识库。')
  const folded = parseFrontmatter('---\ndescription: >\n  one line\n  continues here\n\n  next para\n---\n')
  assert.equal(folded.description, 'one line continues here\nnext para')
  const emptyBlock = parseFrontmatter('---\nname: x\ndescription: |\nversion: 1\n---\n')
  assert.equal(emptyBlock.name, 'x')
  assert.equal(emptyBlock.version, '1')
  assert.equal(emptyBlock.description, undefined)
})

test('install requires SKILL.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-test-'))
  const cfg = testCfg(dir)
  const zip = makeZip({ 'notes.txt': 'x' })
  await assert.rejects(
    () => installSkill('empty-skill', cfg, {
      fetchBytes: async () => ({ body: zip, contentType: 'application/zip' }),
    }),
    /缺少 SKILL.md/,
  )
  await rm(dir, { recursive: true, force: true })
})

test('atomic install and uninstall', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-test-'))
  const cfg = testCfg(dir)
  const zip = makeZip({
    'SKILL.md': '---\nname: demo-skill\ndescription: test skill\n---\n# Demo\n',
    'references/api.md': '# api\n',
  })
  const result = await installSkill('demo-skill', cfg, {
    fetchBytes: async () => ({ body: zip, contentType: 'application/zip' }),
  })
  assert.equal(result.slug, 'demo-skill')
  assert.equal(result.name, 'demo-skill')
  assert.equal(result.files, 2)
  const skillMd = await readFile(join(dir, 'demo-skill', 'SKILL.md'), 'utf8')
  assert.match(skillMd, /test skill/)
  const listed = await listInstalled(dir)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].slug, 'demo-skill')
  const slugs = await installedSlugs(dir)
  assert.equal(slugs.has('demo-skill'), true)
  await uninstallSkill('demo-skill', dir)
  assert.equal((await listInstalled(dir)).length, 0)
  await rm(dir, { recursive: true, force: true })
})

test('uninstall refuses directory without SKILL.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-test-'))
  await assert.rejects(() => uninstallSkill('missing', dir), /未安装或不含 SKILL.md/)
  await rm(dir, { recursive: true, force: true })
})

test('install uses zip download API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-test-'))
  const cfg = testCfg(dir)
  const zip = makeZip({
    'pack/SKILL.md': '---\nname: zip-skill\ndescription: from zip\n---\n',
    'pack/notes.md': 'hi',
  })
  const result = await installSkill('zip-skill', cfg, {
    fetchBytes: async (url) => {
      assert.match(String(url), /\/api\/v1\/download\?slug=zip-skill&source=dsh$/)
      return { body: zip, contentType: 'application/zip' }
    },
  })
  assert.equal(result.name, 'zip-skill')
  const listed = await listInstalled(dir)
  assert.equal(listed[0].name, 'zip-skill')
  await rm(dir, { recursive: true, force: true })
})

test('install accepts octet-stream zip by magic bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-magic-'))
  const zip = makeZip({ 'SKILL.md': '---\nname: magic\n---\n' })
  const result = await installSkill('magic', testCfg(dir), {
    fetchBytes: async () => ({ body: zip, contentType: 'application/octet-stream' }),
  })
  assert.equal(result.name, 'magic')
  await rm(dir, { recursive: true, force: true })
})

test('install rejects non-zip download', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-html-'))
  await assert.rejects(
    () => installSkill('bad', testCfg(dir), {
      fetchBytes: async () => ({ body: Buffer.from('<html>nope</html>'), contentType: 'text/html' }),
    }),
    /不是 zip/,
  )
  await rm(dir, { recursive: true, force: true })
})

test('install rejects zip path traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-trav-'))
  const zip = makeZip({
    'SKILL.md': '---\nname: evil\n---\n',
    '../escape.txt': 'nope',
  })
  await assert.rejects(
    () => installSkill('evil', testCfg(dir), {
      fetchBytes: async () => ({ body: zip, contentType: 'application/zip' }),
    }),
    /不安全路径/,
  )
  await rm(dir, { recursive: true, force: true })
})

test('listInstalled skips files, hidden dirs, and folders without SKILL.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-list-'))
  await writeFile(join(dir, 'notes.txt'), 'x')
  await mkdir(join(dir, '.tmp-hidden'), { recursive: true })
  await mkdir(join(dir, 'empty'), { recursive: true })
  await mkdir(join(dir, 'ok'), { recursive: true })
  await writeFile(join(dir, 'ok', 'SKILL.md'), '---\nname: ok\n---\n')
  const listed = await listInstalled(dir)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].slug, 'ok')
  assert.deepEqual(await listInstalled(join(dir, 'missing-root')), [])
  await rm(dir, { recursive: true, force: true })
})

test('listInstalled returns local meta stats with files/totalBytes/mtimeMs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-meta-'))
  await mkdir(join(dir, 'demo'), { recursive: true })
  await mkdir(join(dir, 'demo', 'refs'), { recursive: true })
  await writeFile(join(dir, 'demo', 'SKILL.md'), '---\nname: demo\nversion: 1.0.0\n---\n')
  await writeFile(join(dir, 'demo', 'refs', 'a.md'), 'aaaa')
  await writeFile(join(dir, 'demo', 'refs', 'b.md'), 'bb')
  const listed = await listInstalled(dir)
  assert.equal(listed.length, 1)
  const it = listed[0]
  assert.equal(it.slug, 'demo')
  assert.equal(it.files, 3)
  assert.equal(it.totalBytes, 4 + 2 + '---\nname: demo\nversion: 1.0.0\n---\n'.length)
  assert.ok(it.mtimeMs > 0)
  assert.equal(it.truncated, false)
  await rm(dir, { recursive: true, force: true })
})

test('statSkillDir truncates when the file limit is reached', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-trunc-'))
  await mkdir(join(dir, 'deep'), { recursive: true })
  for (let i = 0; i < 5; i++) await writeFile(join(dir, 'deep', `f${i}.txt`), 'x')
  const stat = await statSkillDir(dir, 3)
  assert.equal(stat.files, 3)
  assert.equal(stat.truncated, true)
  await rm(dir, { recursive: true, force: true })
})

test('statSkillDir tolerates broken directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-broken-'))
  const stat = await statSkillDir(dir)
  assert.deepEqual(stat, { files: 0, totalBytes: 0, mtimeMs: 0, truncated: false })
  await rm(dir, { recursive: true, force: true })
})

test('normalizeZipFiles strips a shared top directory', () => {
  const files = normalizeZipFiles({
    'pack/SKILL.md': Buffer.from('a'),
    'pack/refs/t.md': Buffer.from('b'),
  })
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'refs/t.md'])
})

test('unzipToFiles reads stored and deflated entries', () => {
  const files = unzipToFiles(makeZip({ 'a.txt': 'hello', 'dir/b.txt': 'world' }))
  assert.equal(files['a.txt'].toString(), 'hello')
  assert.equal(files['dir/b.txt'].toString(), 'world')
})

test('unzipToFiles reads data-descriptor zip from central directory', () => {
  const files = unzipToFiles(makeDescriptorZip({
    'SKILL.md': '---\nname: report\n---\nbody',
    'references/t.md': 'tpl',
  }))
  assert.equal(files['SKILL.md'].toString(), '---\nname: report\n---\nbody')
  assert.equal(files['references/t.md'].toString(), 'tpl')
})

function testCfg(skillsDir: string): PluginConfig {
  return withDefaults({ skillsDir, timeoutMs: 5000, userAgent: 'test' })
}

function makeZip(files: Record<string, string>): Buffer {
  return makeDeflatedZip(files)
}

