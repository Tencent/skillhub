import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'
import { apply as applyHost } from '../host.js'
import type { Context } from '@deepseek-ai/cordis'
import type { PluginConfig } from '../types.js'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
type Props = Record<string, unknown>
type Request = { url: string; body: Record<string, unknown> }
const skill = { slug: 'pdf', name: 'PDF Assistant', description: 'Read and edit PDF files', version: '1.0.0', category: '', pageUrl: 'https://skillhub.cn/skills/pdf' }
const plugin = { owner: 'deepseek-ai', name: 'browser', fullName: 'deepseek-ai/browser', description: 'Browser automation', stars: 3, installability: 'verified' }

// Verified against deepseek-ai/deepseek-harness tag dsh-v0.2.1-rc.3:
// packages/client/ui-chat/src/client/conversation-nodes/tool.ts rootResult()
// packages/client/ui-tool/src/client/tool/ToolCallTree.tsx toolCallPhase()
// apps/desktop/src/main.ts protocol.handle() + web-document.ts forwardWebRequest()
/** Real rc.3 ToolCallTree owner props: settled tool/result fields sit in block. */
function result(toolName: string, meta?: unknown, extra: Props = {}): Props {
  return {
    phase: 'result', toolName, callId: 'call-1',
    block: { kind: 'tool-result', callId: 'call-1', name: toolName, call: { name: toolName, argsRaw: '{"query":"pdf"}' }, content: [], meta, isError: false, subCalls: [], ...extra },
  }
}

function bench(url = 'dsh-app://app/', respond: (request: Request) => unknown | Promise<unknown> = () => ({ items: [] })) {
  const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', { url })
  const globals = globalThis as unknown as Record<string, unknown>
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const set = (key: string, value: unknown) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  set('window', dom.window)
  set('document', dom.window.document)
  set('navigator', dom.window.navigator)
  set('IS_REACT_ACT_ENVIRONMENT', true)
  set('__DSH_TRANSPORT__', undefined)
  const requests: Request[] = []
  const send = async (url: string | URL | RequestInfo, init?: RequestInit) => {
    const request = { url: String(url), body: JSON.parse(String(init?.body || '{}')) as Request['body'] }
    requests.push(request)
    return Response.json(await respond(request))
  }
  set('fetch', send)
  const slots = new Map<string, React.ComponentType<Props>>()
  let body: { apply: (ctx: unknown) => void } | undefined
  Object.assign(dom.window, { __ModuleLoader__: { load: (definition: { factory: (require: NodeJS.Require) => typeof body }) => { body = definition.factory(require) } } })
  vm.runInThisContext(source, { filename: 'skillhub-client.js' })
  body!.apply({
    slots: {
      inject: (_name: string, register: () => void) => register(),
      register: (options: { name: string; key?: string; id?: string }, component: React.ComponentType<Props>) => { slots.set(options.key || options.id || options.name, component) },
    },
    sessions: {}, inject: () => {}, effect: (run: () => void) => run(),
  })
  const container = dom.window.document.getElementById('root')!
  const root: Root = createRoot(container)
  return {
    dom, container, slots, requests, send,
    async render(key: string, props: Props) {
      const component = slots.get(key)
      assert.ok(component, `tool view registered for ${key}`)
      await act(async () => { root.render(React.createElement(component, props)) })
    },
    /** Settled card results render on the Turn tail, outside the collapsed Tool group. */
    async renderCards(props: Props) {
      const block = { ...(props.block as Props), seq: 1 }
      const turn = { data: { get: (key: string) => key === "skillhub-cards" ? { results: [block] } : undefined }, end: { seq: 1 } }
      await this.render("skillhub-cards", { turn, seq: 1 })
    },
    async click(text: string) {
      const button = [...dom.window.document.querySelectorAll('button')].find((element) => element.textContent?.trim() === text)
      assert.ok(button, `button ${text} is visible`)
      await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    },
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globals[key]
      }
    },
  }
}

test('desktop tool cards render durable DSH events and surface every state', async (t) => {
  await t.test('registered Host projections round-trip to search, list, and plugin tool slots', async () => {
    const b = bench(undefined, () => ({ items: [], total: 0 }))
    try {
      const tools = new Map<string, {
        name: string
        output: { render: (args: unknown, value: unknown) => unknown; presentationMeta: (args: unknown, value: unknown) => unknown }
      }>()
      const cfg: PluginConfig = { apiBase: 'https://api.test', webBase: 'https://skillhub.cn', skillsDir: '/skills', timeoutMs: 5000, userAgent: 'test', maxResults: 12, sortBy: 'score' }
      applyHost({ tools: { register: (tool: { name: string }) => tools.set(tool.name, tool as never) }, inject: () => {} } as unknown as Context, cfg)
      for (const [name, value, title] of [
        ['skillhub_search', { query: 'pdf', items: [skill], total: 1, offset: 0, hasMore: false }, 'PDF Assistant'],
        ['skillhub_list', { skillsDir: '/skills', items: [skill] }, 'PDF Assistant'],
        ['skillhub_plugin_search', { query: '', items: [plugin], total: 1, offset: 0, hasMore: false }, 'browser'],
      ] as const) {
        const tool = tools.get(name)!
        assert.ok(tool)
        const content = tool.output.render({}, value)
        const meta = tool.output.presentationMeta({}, value)
        // This is exactly how native tool/result and PTC dispatch are projected.
        await b.renderCards(result(name, meta, { content }))
        assert.ok(b.container.textContent?.includes(title))
      }
      await new Promise<void>((resolve) => setImmediate(resolve))
    } finally { await b.close() }
  })

  await t.test('first-party persisted metadata renders search cards and interactive install', async () => {
    const b = bench(undefined, ({ body }) => body.method === 'detail' ? { card: skill } : { name: skill.name, slug: skill.slug })
    try {
      await b.renderCards(result('skillhub_search', { kind: 'skillhub-search', items: [skill] }))
      assert.match(b.container.textContent || '', /PDF Assistant/)
      assert.equal(b.requests.length, 0, 'replay does not repeat the original search')
      const card = b.container.querySelector('.sh-card')!
      await act(async () => { card.dispatchEvent(new b.dom.window.MouseEvent('click', { bubbles: true })) })
      assert.ok(b.dom.window.document.querySelector('[role="dialog"]'))
      await b.click('Install')
      assert.ok(b.requests.some(({ body }) => body.method === 'install'))
      assert.match(b.container.textContent || '', /On/)
      assert.equal(b.requests[0].url, 'dsh-app://app/skillhub', 'retain desktop authenticated protocol forwarding')
    } finally { await b.close() }
  })

  await t.test('settled results collapse to a summary in the Tool group and render on the Turn tail', async () => {
    const b = bench()
    try {
      const settled = result('skillhub_search', { items: [skill] })
      await b.render('skillhub_search', settled)
      assert.equal(b.container.textContent, '1 cards shown below the reply')
      assert.equal(b.container.querySelector('.sh-card'), null)
      await b.renderCards(settled)
      assert.match(b.container.textContent || '', /PDF Assistant/)
      await b.render('skillhub-cards', { turn: { data: { get: () => undefined }, end: { seq: 1 } }, seq: 1 })
      assert.equal(b.container.textContent, '', 'a Turn without SkillHub results adds nothing')
      assert.equal(b.requests.length, 0)
    } finally { await b.close() }
  })

  await t.test('a recorded empty result stays empty without a second live search', async () => {
    const b = bench()
    try {
      await b.render('skillhub_search', result('skillhub_search', { items: [] }))
      assert.match(b.container.textContent || '', /No results/)
      assert.equal(b.requests.length, 0)
    } finally { await b.close() }
  })

  await t.test('mixed plain text and raw JSON result blocks render without an update loop', async () => {
    const b = bench()
    try {
      const props = result('skillhub_search', undefined, { content: [{ type: 'text', text: 'Search result follows:' }, { type: 'text', text: JSON.stringify({ items: [skill] }) }] })
      await b.renderCards(props)
      await b.renderCards({ ...props })
      assert.match(b.container.textContent || '', /PDF Assistant/)
      assert.equal(b.requests.length, 0)
    } finally { await b.close() }
  })

  await t.test('preparing and running show loading; settled failure shows its recorded error', async () => {
    const b = bench()
    try {
      for (const phase of ['preparing', 'start']) {
        await b.render('skillhub_search', { phase, block: { phase, name: 'skillhub_search', argsRaw: '{' } })
        assert.match(b.container.textContent || '', /Loading/)
      }
      await b.render('skillhub_search', result('skillhub_search', undefined, { isError: true, content: [{ type: 'text', text: 'upstream unavailable' }] }))
      assert.match(b.container.querySelector('[role="alert"]')?.textContent || '', /upstream unavailable/)
      assert.equal(b.requests.length, 0, 'a failed tool must not silently retry')
    } finally { await b.close() }
  })

  await t.test('legacy result fallback uses shell transport and preserves search filters', async () => {
    const b = bench(undefined, () => ({ items: [skill] }))
    try {
      Object.assign(globalThis, { __DSH_TRANSPORT__: { fetch: b.send } })
      await b.render('skillhub_search', result('skillhub_search', undefined, { call: { argsRaw: JSON.stringify({ query: 'pdf', category: 'office-efficiency', sortBy: 'stars', offset: 4, limit: 2 }) } }))
      assert.match(b.container.textContent || '', /PDF Assistant/)
      assert.deepEqual(b.requests, [{ url: 'skillhub', body: { method: 'search', query: 'pdf', category: 'office-efficiency', sortBy: 'stars', offset: 4, limit: 2 } }])
    } finally { await b.close() }
  })

  await t.test('web proxy mount is preserved and network failures remain visible', async () => {
    const b = bench('https://example.com/dsh/', () => { throw new Error('offline') })
    try {
      await b.render('skillhub_search', result('skillhub_search'))
      assert.equal(b.requests[0].url, 'https://example.com/dsh/skillhub')
      assert.match(b.container.querySelector('[role="alert"]')?.textContent || '', /offline/)
    } finally { await b.close() }
  })

  await t.test('lists render raw metadata, empty states, and recover legacy results', async () => {
    const b = bench(undefined, () => ({ skillsDir: '/skills', items: [skill] }))
    try {
      await b.renderCards(result('skillhub_list', { skillsDir: '/skills', items: [skill] }))
      assert.match(b.container.textContent || '', /PDF Assistant/)
      assert.equal(b.requests.length, 0)
      await b.renderCards(result('skillhub_list', { items: [] }))
      assert.match(b.container.textContent || '', /No skills installed/)
      await b.renderCards(result('skillhub_list'))
      assert.match(b.container.textContent || '', /PDF Assistant/)
      assert.equal(b.requests[0].body.method, 'list')
    } finally { await b.close() }
  })

  await t.test('plugin replay stays local and desktop install offers a manual restart', async () => {
    const b = bench(undefined, ({ body }) => body.method === 'pluginInstallPlan' ? { source: 'github:deepseek-ai/browser#abc', profile: 'desktop' } : { boot: 'boot-1' })
    try {
      await b.renderCards(result('skillhub_plugin_search', { items: [plugin] }))
      assert.match(b.container.textContent || '', /browser/)
      assert.ok(!b.requests.some(({ body }) => body.method === 'plugins'))
      await b.click('Details')
      assert.match(b.dom.window.document.body.textContent || '', /--profile "desktop" add/)
      await b.click('Close')
      await b.click('Install')
      assert.match(b.container.textContent || '', /Quit and reopen DeepSeek Harness/)
      assert.ok(![...b.container.querySelectorAll('button')].some((button) => button.textContent === 'Restart now'))
      assert.ok(!b.requests.some(({ body }) => body.method === 'pluginRestart'))
    } finally { await b.close() }
  })

  await t.test('legacy plugin fallback forwards offset and leaves page-local skip to the Host', async () => {
    const b = bench(undefined, ({ body }) => body.method === 'pluginSearch' ? { items: [plugin] } : {})
    try {
      await b.render('skillhub_plugin_search', result('skillhub_plugin_search', undefined, { call: { argsRaw: JSON.stringify({ query: 'browser', offset: 3, category: 'web-tools', sort: 'updated' }) } }))
      const search = b.requests.find(({ body }) => body.method === 'pluginSearch')!
      assert.deepEqual(search.body, { method: 'pluginSearch', query: 'browser', offset: 3, category: 'web-tools', sort: 'updated' })
      assert.ok(!('page' in search.body) && !('limit' in search.body), 'Host config controls omitted limit')
      assert.match(b.container.textContent || '', /browser/)
    } finally { await b.close() }
  })

  await t.test('historical plugins keep their content while local installed flags change', async () => {
    const b = bench(undefined, ({ body }) => body.method === 'pluginInstalled'
      ? { items: [{ fullName: 'deepseek-ai/browser', installed: true }, { fullName: 'other/old', installed: false }] }
      : {})
    try {
      const old = { owner: 'other', name: 'old', fullName: 'other/old', installed: true, description: 'Keep this old description', installability: 'verified' }
      await b.renderCards(result('skillhub_plugin_search', { items: [{ ...plugin, description: 'Recorded description' }, old] }))
      const cards = [...b.container.querySelectorAll('.sh-card')]
      assert.equal(cards.length, 2)
      assert.match(cards[0].textContent || '', /Recorded description/)
      assert.match(cards[0].textContent || '', /Installed/)
      assert.match(cards[1].textContent || '', /Keep this old description/)
      assert.ok(!cards[1].textContent?.includes('Installed'))
      const request = b.requests.find(({ body }) => body.method === 'pluginInstalled')!
      assert.deepEqual(request.body.plugins, [{ owner: 'deepseek-ai', name: 'browser' }, { owner: 'other', name: 'old' }])
      assert.ok(!b.requests.some(({ body }) => body.method === 'plugins' || body.method === 'pluginSearch'))
    } finally { await b.close() }
  })

  await t.test('background local-state failures do not hide replayed plugin cards', async () => {
    const b = bench(undefined, ({ body }) => { if (body.method === 'pluginInstalled') throw new Error('profile temporarily unavailable'); return {} })
    try {
      await b.renderCards(result('skillhub_plugin_search', { items: [{ ...plugin, installed: true }] }))
      assert.match(b.container.textContent || '', /browser.*Installed/s)
      assert.equal(b.container.querySelector('[role="alert"]'), null)
    } finally { await b.close() }
  })

  await t.test('late local-state replies cannot revert a successful in-card install', async () => {
    let reply: ((value: unknown) => void) | undefined
    const b = bench(undefined, ({ body }) => body.method === 'pluginInstalled'
      ? new Promise((resolve) => { reply = resolve }) : {})
    try {
      await b.renderCards(result('skillhub_plugin_search', { items: [plugin] }))
      await b.click('Install')
      await act(async () => { reply?.({ items: [{ fullName: plugin.fullName, installed: false }] }) })
      assert.match(b.container.textContent || '', /browser.*Installed/s)
      assert.ok(![...b.container.querySelectorAll('button')].some((button) => button.textContent === 'Install'))
    } finally { await b.close() }
  })

  await t.test('settings expose automatic/current profile and preserve an explicit target', async () => {
    const b = bench(undefined, ({ body }) => body.method === 'config' ? { apiBase: 'https://api.skillhub.cn', skillsDir: '/skills', profile: 'desktop', activeProfile: 'desktop', maxResults: 12, timeoutMs: 5000, sortBy: 'score' } : {})
    try {
      await b.render('skillhub', {})
      await b.click('SkillHubSearch API, install directory, and result count.')
      const input = b.container.querySelector<HTMLInputElement>('#sh-profile')
      assert.equal(input?.value, 'desktop')
      assert.match(b.container.textContent || '', /Current target: desktop/)
    } finally { await b.close() }
  })
})
