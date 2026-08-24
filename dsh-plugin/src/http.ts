import type { FetchOptions } from './types.js'

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions, signal?: AbortSignal): Promise<T> {
  const res = await request(url, options, signal)
  return res.json() as Promise<T>
}

export async function fetchBytes(url: string, options: FetchOptions, signal?: AbortSignal): Promise<{ body: Buffer; contentType: string }> {
  const res = await request(url, options, signal)
  const buf = Buffer.from(await res.arrayBuffer())
  return { body: buf, contentType: res.headers.get('content-type') || 'application/octet-stream' }
}

async function request(url: string, options: FetchOptions, signal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': options.userAgent, accept: '*/*' },
      redirect: 'follow',
    })
    if (!res.ok) throw new HttpError(`HTTP ${res.status} ${url}`, res.status)
    return res
  } catch (err) {
    if (err instanceof HttpError) throw err
    const name = err instanceof Error ? err.name : ''
    if (name === 'AbortError') throw new HttpError(`timeout ${options.timeoutMs}ms ${url}`)
    throw new HttpError(err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
