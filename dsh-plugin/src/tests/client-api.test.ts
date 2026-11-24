import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { withDefaults } from '../config-store.js'
import { handleApi } from '../local-api.js'
import { bindRuntimeProfileHost } from '../runtime-profile.js'

async function fixture(t: TestContext) {
  const home = mkdtempSync(join(tmpdir(), 'skillhub-client-api-'))
  const desktop = join(home, 'profiles', 'desktop')
  const custom = join(home, 'profiles', 'custom')
  for (const dir of [desktop, custom]) mkdirSync(dir, { recursive: true })
  writeFileSync(join(desktop, 'package.json'), JSON.stringify({ dependencies: { 'desktop-only': '^1.0.0' } }))
  writeFileSync(join(custom, 'package.json'), JSON.stringify({ dependencies: { alias: 'github:owner/installed#abcdef0', 'same-name': 'github:someone-else/same-name#abcdef0', '@owner/npm-plugin': '^1.0.0' } }))
  bindRuntimeProfileHost({ profileContext: { name: 'desktop', dir: desktop, home } })
  const upstream: URL[] = []
  const cfg = withDefaults({ profile: 'custom', maxResults: 5 })
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/v1/plugins')) {
      const url = new URL(req.url, 'http://localhost')
      upstream.push(url)
      const names = Number(url.searchParams.get('page')) === 2 ? ['f', 'g', 'h', 'i', 'j'] : ['a', 'b', 'c', 'd', 'e']
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ items: names.map((name) => ({ owner: 'owner', name, installability: 'verified' })), total: 10 }))
    } else void handleApi(req, res, cfg)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  cfg.apiBase = `http://127.0.0.1:${address.port}`
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
    bindRuntimeProfileHost(undefined)
    rmSync(home, { recursive: true, force: true })
  })
  return {
    upstream,
    async post(body: Record<string, unknown>) {
      const response = await fetch(`${cfg.apiBase}/skillhub`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json() as { items: { fullName: string; installed: boolean }[]; offset: number }
      return { response, data }
    },
  }
}

test('legacy plugin card API reuses host paging including offset skip and configured default limit', async (t) => {
  const b = await fixture(t)
  const first = await b.post({ method: 'pluginSearch', query: 'browser', category: 'web-tools', sort: 'updated', offset: 3 })
  assert.equal(first.response.status, 200)
  assert.deepEqual(first.data.items.map((item) => item.fullName), ['owner/d', 'owner/e'])
  assert.equal(first.data.offset, 3)
  assert.equal(b.upstream[0].searchParams.get('page_size'), '5')
  assert.equal(b.upstream[0].searchParams.get('page'), '1')
  assert.equal(b.upstream[0].searchParams.get('sort'), 'updated')
  assert.equal(b.upstream[0].searchParams.get('category'), 'web-tools')
  const second = await b.post({ method: 'pluginSearch', query: 'browser', offset: 5 })
  assert.deepEqual(second.data.items.map((item) => item.fullName), ['owner/f', 'owner/g', 'owner/h', 'owner/i', 'owner/j'])
  assert.equal(b.upstream[1].searchParams.get('page'), '2')
})

test('historical card installed status reads only the configured local profile', async (t) => {
  const b = await fixture(t)
  const { response, data } = await b.post({ method: 'pluginInstalled', plugins: [
    { owner: 'owner', name: 'installed' },
    { owner: 'owner', name: 'npm-plugin' },
    { owner: 'owner', name: 'desktop-only' },
    { owner: 'owner', name: 'same-name' },
  ] })
  assert.equal(response.status, 200)
  assert.deepEqual(data.items, [
    { fullName: 'owner/installed', installed: true },
    { fullName: 'owner/npm-plugin', installed: true },
    { fullName: 'owner/desktop-only', installed: false },
    { fullName: 'owner/same-name', installed: false },
  ])
  assert.equal(b.upstream.length, 0, 'installed checks never query the remote marketplace')
})

test('local installed-status requests bound ref count and reject malformed refs', async (t) => {
  const b = await fixture(t)
  for (const plugins of [null, Array.from({ length: 101 }, () => ({ owner: 'owner', name: 'plugin' })), [{ owner: '../owner', name: 'plugin' }], [null]]) {
    assert.equal((await b.post({ method: 'pluginInstalled', plugins })).response.status, 400)
  }
  assert.equal((await b.post({ method: 'pluginInstalled', plugins: [] })).response.status, 200)
  assert.equal(b.upstream.length, 0)
})
