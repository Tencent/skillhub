/** GitHub-flavored subset for local README preview. HTML is allowlisted; only http(s)/mailto/# links. */

const PLACE = '\u0000'

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'center', 'code', 'del', 'details', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'ins', 'kbd', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
])
const VOID_TAGS = new Set(['br', 'hr', 'img'])
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base', 'svg', 'math',
  'video', 'audio', 'canvas', 'noscript', 'template', 'textarea', 'applet', 'frame', 'frameset',
])

export function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function safeHref(raw: string): string {
  const url = String(raw || '').trim()
  if (/^https?:\/\//i.test(url) || /^mailto:[^\s]+$/i.test(url)) return url
  if (/^#[^\s:]*$/.test(url)) return url
  return ''
}

export function renderMarkdown(src: string): string {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] as string
    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i] as string)) {
        body.push(lines[i] as string)
        i += 1
      }
      if (i < lines.length) i += 1
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }
    if (isHtmlBlockLine(line)) {
      const body: string[] = []
      while (i < lines.length && (lines[i] as string).trim() !== '') {
        body.push(lines[i] as string)
        i += 1
      }
      out.push(sanitizeHtml(body.join('\n')))
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const n = heading[1]!.length
      out.push(`<h${n}>${inlineMd(heading[2] || '')}</h${n}>`)
      i += 1
      continue
    }
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1] as string)) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i] as string) && !isTableSep(lines[i] as string)) {
        rows.push(splitRow(lines[i] as string))
        i += 1
      }
      const th = header.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')
      const trs = rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`).join('')
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`)
      continue
    }
    if (/^\s*(\*\*\*|---|___)\s*$/.test(line)) {
      out.push('<hr />')
      i += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i] as string)) {
        body.push((lines[i] as string).replace(/^>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${inlineMd(body.join('\n'))}</blockquote>`)
      continue
    }
    if (/^\s*[-*+]\s+\S/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+\S/.test(lines[i] as string)) {
        items.push(`<li>${inlineMd((lines[i] as string).replace(/^\s*[-*+]\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^\s*\d+\.\s+\S/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+\S/.test(lines[i] as string)) {
        items.push(`<li>${inlineMd((lines[i] as string).replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i += 1
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    if (line.trim() === '') {
      i += 1
      continue
    }
    const para: string[] = []
    while (i < lines.length && (lines[i] as string).trim() !== '' && !isBlockStart(lines[i] as string)) {
      para.push(lines[i] as string)
      i += 1
    }
    out.push(`<p>${inlineMd(para.join(' '))}</p>`)
  }
  return out.join('')
}

function isHtmlBlockLine(line: string): boolean {
  return /^\s*<\/?[a-zA-Z][\w-]*(\s|\/?>)/.test(line)
}

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line)
    || /^#{1,6}\s/.test(line)
    || /^\s*(\*\*\*|---|___)\s*$/.test(line)
    || /^>\s?/.test(line)
    || /^\s*[-*+]\s+\S/.test(line)
    || /^\s*\d+\.\s+\S/.test(line)
    || (/^\s*\|.+\|\s*$/.test(line))
    || isHtmlBlockLine(line)
  )
}

function isTableSep(line: string): boolean {
  return /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((cell) => cell.trim())
}

function inlineMd(text: string): string {
  const slots: string[] = []
  const hold = (html: string): string => {
    const key = `${PLACE}${slots.length}${PLACE}`
    slots.push(html)
    return key
  }
  let s = String(text || '')
  s = s.replace(/\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt, img, href) => {
    const src = safeHref(String(img))
    const dest = safeHref(String(href))
    if (!src || !/^https?:\/\//i.test(src)) return hold(escapeHtml(String(alt || '')))
    const imgTag = `<img src="${escapeHtml(src)}" alt="${escapeHtml(String(alt || ''))}" />`
    if (!dest) return hold(imgTag)
    return hold(`<a href="${escapeHtml(dest)}" target="_blank" rel="noopener noreferrer">${imgTag}</a>`)
  })
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt, url) => {
    const src = safeHref(String(url))
    if (!src || !/^https?:\/\//i.test(src)) return hold(escapeHtml(String(alt || '')))
    return hold(`<img src="${escapeHtml(src)}" alt="${escapeHtml(String(alt || ''))}" />`)
  })
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label, url) => {
    const href = safeHref(String(url))
    if (!href) return hold(escapeHtml(String(label)))
    return hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(label))}</a>`)
  })
  s = s.replace(/`([^`]+)`/g, (_m, code) => hold(`<code>${escapeHtml(String(code))}</code>`))
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, body) => hold(`<strong>${escapeHtml(String(body))}</strong>`))
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, prefix, body) => `${prefix}${hold(`<em>${escapeHtml(String(body))}</em>`)}`)
  s = sanitizeHtml(s)
  return s.replace(/\u0000(\d+)\u0000/g, (_m, idx) => slots[Number(idx)] || '')
}

export function sanitizeHtml(raw: string): string {
  const s = String(raw || '')
  let out = ''
  let i = 0
  let dropping: string | null = null
  const aStack: Array<'a' | 'span'> = []
  while (i < s.length) {
    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4)
      i = end < 0 ? s.length : end + 3
      continue
    }
    if (s[i] === '<') {
      const rest = s.slice(i)
      const m = rest.match(/^<\/?([a-zA-Z][\w:-]*)\b[^>]*>/)
      if (m) {
        const token = m[0]
        const tag = m[1]!.toLowerCase()
        const isClose = token.startsWith('</')
        i += token.length
        if (dropping) {
          if (isClose && tag === dropping) dropping = null
          continue
        }
        if (DROP_WITH_CONTENT.has(tag)) {
          if (!isClose) dropping = tag
          continue
        }
        if (!ALLOWED_TAGS.has(tag)) continue
        out += rewriteTag(tag, token, isClose, aStack)
        continue
      }
      out += '&lt;'
      i += 1
      continue
    }
    const next = s.indexOf('<', i)
    const text = next < 0 ? s.slice(i) : s.slice(i, next)
    if (!dropping) out += escapeHtml(text)
    i = next < 0 ? s.length : next
  }
  return out
}

function rewriteTag(tag: string, token: string, isClose: boolean, aStack: Array<'a' | 'span'>): string {
  if (isClose) {
    if (tag === 'a') return `</${aStack.pop() || 'span'}>`
    return `</${tag}>`
  }
  if (VOID_TAGS.has(tag) || /\/\s*>$/.test(token)) {
    const attrs = filterAttrs(tag, parseAttrs(token))
    if (attrs === null) return ''
    return `<${tag}${attrs} />`
  }
  if (tag === 'a') {
    const parsed = parseAttrs(token)
    const href = safeHref(parsed.href || '')
    if (!href) {
      aStack.push('span')
      return '<span>'
    }
    aStack.push('a')
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`
  }
  const attrs = filterAttrs(tag, parseAttrs(token))
  if (attrs === null) return ''
  return `<${tag}${attrs}>`
}

function parseAttrs(token: string): Record<string, string> {
  const inner = token.replace(/^<\/?[a-zA-Z][\w:-]*/, '').replace(/\/?\s*>$/, '')
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner))) {
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

function filterAttrs(tag: string, attrs: Record<string, string>): string | null {
  const parts: string[] = []
  const align = String(attrs.align || '').toLowerCase()
  if (align && /^(center|left|right|justify)$/.test(align)) parts.push(`align="${align}"`)
  if (attrs.title) parts.push(`title="${escapeHtml(attrs.title)}"`)
  if (tag === 'img') {
    const src = safeHref(attrs.src || '')
    if (!src || !/^https?:\/\//i.test(src)) return null
    parts.push(`src="${escapeHtml(src)}"`)
    parts.push(`alt="${escapeHtml(attrs.alt || '')}"`)
    pushSize(parts, 'width', attrs.width)
    pushSize(parts, 'height', attrs.height)
  }
  if (tag === 'td' || tag === 'th') {
    if (attrs.colspan && /^\d{1,2}$/.test(attrs.colspan)) parts.push(`colspan="${attrs.colspan}"`)
    if (attrs.rowspan && /^\d{1,2}$/.test(attrs.rowspan)) parts.push(`rowspan="${attrs.rowspan}"`)
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

function pushSize(parts: string[], name: string, raw: string | undefined): void {
  const v = String(raw || '')
  if (/^\d{1,4}(?:px|%)?$/.test(v)) parts.push(`${name}="${escapeHtml(v)}"`)
}
