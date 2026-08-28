import assert from 'node:assert/strict'
import test from 'node:test'
import { escapeHtml, renderMarkdown, safeHref } from '../markdown.js'

test('escapeHtml encodes markup', () => {
  assert.equal(escapeHtml('<script>"x"&'), '&lt;script&gt;&quot;x&quot;&amp;')
})

test('safeHref allows http(s) mailto hash and drops javascript', () => {
  assert.equal(safeHref('https://skillhub.cn/x'), 'https://skillhub.cn/x')
  assert.equal(safeHref('mailto:a@b.c'), 'mailto:a@b.c')
  assert.equal(safeHref('#toc'), '#toc')
  assert.equal(safeHref('javascript:alert(1)'), '')
  assert.equal(safeHref('data:text/html,x'), '')
})

test('renderMarkdown headings lists code tables and inline', () => {
  const html = renderMarkdown([
    '# skillhub',
    '',
    'DeepSeek [SkillHub](https://skillhub.cn) 插件。',
    '',
    '## 目录',
    '',
    '- 功能',
    '- 安装',
    '',
    '| 工具 | 作用 |',
    '| --- | --- |',
    '| `skillhub_search` | 搜索 |',
    '',
    '```sh',
    'dsh plugin add @tencent/skillhub',
    '```',
    '',
    '**bold** and *em*',
  ].join('\n'))
  assert.match(html, /<h1>skillhub<\/h1>/)
  assert.match(html, /<a href="https:\/\/skillhub\.cn" target="_blank" rel="noopener noreferrer">SkillHub<\/a>/)
  assert.match(html, /<h2>目录<\/h2>/)
  assert.match(html, /<ul><li>功能<\/li><li>安装<\/li><\/ul>/)
  assert.match(html, /<th>工具<\/th>/)
  assert.match(html, /<td><code>skillhub_search<\/code><\/td>/)
  assert.match(html, /<pre><code>dsh plugin add @tencent\/skillhub<\/code><\/pre>/)
  assert.match(html, /<strong>bold<\/strong>/)
  assert.match(html, /<em>em<\/em>/)
})

test('renderMarkdown sanitizes raw html and unsafe urls', () => {
  const html = renderMarkdown('Hello <script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![y](javascript:alert(1))')
  assert.doesNotMatch(html, /<script>/i)
  assert.doesNotMatch(html, /alert\(1\)/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /<p>/)
})

test('renderMarkdown allows safe github html blocks and drops relative hrefs', () => {
  const html = renderMarkdown([
    '<p align="center">',
    '  <a href="https://example.com">',
    '    <img src="https://img.shields.io/badge/x-y" alt="x" />',
    '  </a>',
    '</p>',
    '<h1 align="center">whale-girl</h1>',
    '<p align="center"><a href="README.zh.md">中文</a> | English</p>',
    '',
    '## Installation',
    '',
    'Official **bundle plugin**.',
  ].join('\n'))
  assert.match(html, /<p align="center">/)
  assert.match(html, /<h1 align="center">whale-girl<\/h1>/)
  assert.match(html, /<img src="https:\/\/img\.shields\.io\/badge\/x-y" alt="x" \/>/)
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">/)
  assert.doesNotMatch(html, /href="README\.zh\.md"/)
  assert.match(html, /<span>中文<\/span>/)
  assert.match(html, /<h2>Installation<\/h2>/)
  assert.doesNotMatch(html, /&lt;p/)
  assert.doesNotMatch(html, /onerror/i)
})

test('sanitizeHtml drops event handlers and unsafe images', () => {
  const html = renderMarkdown('<img src="https://x.test/a.png" onerror="alert(1)" alt="x">\n\n<img src="javascript:alert(1)">')
  assert.match(html, /<img src="https:\/\/x\.test\/a\.png" alt="x" \/>/)
  assert.doesNotMatch(html, /onerror/i)
  assert.doesNotMatch(html, /javascript:/)
})

test('renderMarkdown keeps html inside fenced code escaped', () => {
  const html = renderMarkdown('```html\n<script>alert(1)</script>\n```')
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/i)
})

test('renderMarkdown renders linked badge images', () => {
  const html = renderMarkdown('[![CI](https://img.shields.io/badge/ci-ok)](https://github.com/Tencent/skillhub)')
  assert.match(html, /<a href="https:\/\/github\.com\/Tencent\/skillhub"[^>]*>/)
  assert.match(html, /<img src="https:\/\/img\.shields\.io\/badge\/ci-ok" alt="CI" \/>/)
})
