/**
 * Offline demo mode (EXPO_PUBLIC_DEMO=1): the app answers its own API
 * calls from data recorded by scripts/capture-demo-data.py, so a build
 * works with no server and no network. Never enabled in real builds.
 *
 * Recorded dates are moved forward by the time since recording, so
 * "2h ago" and due dates stay as they were when the data was captured.
 * Writes (acknowledging an alert, marking read) change the in-memory
 * copy so the app reacts, and are forgotten when it restarts.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1'

type Store = Record<string, unknown>

let store: Store | null = null

function shift(value: unknown, deltaMs: number): unknown {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return new Date(new Date(value).getTime() + deltaMs).toISOString()
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(new Date(`${value}T00:00:00Z`).getTime() + deltaMs).toISOString().slice(0, 10)
    }
    return value
  }
  if (Array.isArray(value)) return value.map((v) => shift(v, deltaMs))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shift(v, deltaMs)]))
  }
  return value
}

function load(): Store {
  if (!store) {
    const file = require('../assets/demo/fixtures.json') as { capturedAt: string; responses: Store }
    store = shift(file.responses, Date.now() - new Date(file.capturedAt).getTime()) as Store
  }
  return store
}

function results(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) return data
  const r = (data as { results?: unknown })?.results
  return Array.isArray(r) ? (r as Record<string, unknown>[]) : null
}

const PAGING = new Set(['page', 'page_size', 'all', 'ordering', 'unread', 'days'])

/** Narrow a recorded list by the request's filters (status=..., search=...). */
function filtered(data: unknown, params: URLSearchParams): unknown {
  const list = results(data)
  if (!list) return data
  let out = list
  params.forEach((value, key) => {
    if (PAGING.has(key)) return
    if (key === 'search') {
      const q = value.toLowerCase()
      out = out.filter((item) => JSON.stringify(item).toLowerCase().includes(q))
    } else {
      out = out.filter((item) => !(key in item) || String(item[key]) === value)
    }
  })
  if (params.get('unread') === '1') out = out.filter((item) => item.is_read === false)
  return Array.isArray(data) ? out : { ...(data as object), count: out.length, next: null, previous: null, results: out }
}

function split(config: InternalAxiosRequestConfig): { path: string; params: URLSearchParams } {
  const url = new URL(config.url ?? '', 'http://demo.local')
  const params = new URLSearchParams(url.search)
  Object.entries(config.params ?? {}).forEach(([k, v]) => v != null && params.set(k, String(v)))
  return { path: url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`, params }
}

function find(path: string): unknown {
  const s = load()
  if (path in s) return s[path]
  // A recorded list stored under one query (e.g. ?page_size=100) answers any query on that path.
  const key = Object.keys(s).find((k) => k.split('?')[0] === path)
  return key ? s[key] : undefined
}

/** Apply a write to every recorded copy of the record it targets. */
function write(path: string, method: string, body?: unknown): unknown {
  const s = load()
  const ack = path.match(/^\/api\/v1\/alerts\/(\d+)\/acknowledge\/$/)
  const read = path.match(/^\/api\/v1\/notifications\/(\d+)\/read\/$/)
  const touch = (pred: (r: Record<string, unknown>) => boolean, patch: Record<string, unknown>) => {
    Object.values(s).forEach((data) => results(data)?.forEach((r) => pred(r) && Object.assign(r, patch)))
  }
  const chat = path.match(/^\/api\/v1\/chat\/conversations\/(\d+)\/messages\/$/)
  if (chat && body) {
    const conv = s[`/api/v1/chat/conversations/${chat[1]}/`] as { messages?: Record<string, unknown>[] } | undefined
    const me = s['/api/v1/accounts/me/'] as { id?: number; first_name?: string; last_name?: string } | undefined
    const message = {
      id: Date.now(), sender_id: me?.id ?? null, sender_name: `${me?.first_name ?? ''} ${me?.last_name ?? ''}`.trim(),
      content: String((body as { content?: unknown }).content ?? ''), is_system: false, created_at: new Date().toISOString(),
    }
    conv?.messages?.push(message)
    return message
  }
  const pay = path.match(/^\/api\/v1\/invoices\/(\d+)\/pay\/$/)
  if (pay) {
    const paid = { status: 'PAID', paid_at: new Date().toISOString() }
    touch((r) => String(r.id) === pay[1] && 'invoice_number' in r, paid)
    const detail = s[`/api/v1/invoices/${pay[1]}/`] as Record<string, unknown> | undefined
    if (detail) Object.assign(detail, paid)
    return { detail: 'Payment started.' }
  }
  if ((path === '/api/v1/accounts/me/' || path === '/api/v1/accounts/notification-prefs/') && body && typeof body === 'object') {
    const target = (s[path] ?? (s[path] = {})) as Record<string, unknown>
    Object.assign(target, body)
    return target
  }
  if (ack) touch((r) => String(r.id) === ack[1] && 'acknowledged' in r, { acknowledged: true })
  else if (read) touch((r) => String(r.id) === read[1] && 'is_read' in r, { is_read: true })
  else if (path === '/api/v1/notifications/mark-all-read/') touch((r) => 'is_read' in r && 'title' in r, { is_read: true })
  else if (path === '/api/auth/token/' || path === '/api/auth/token/refresh/') {
    return { access: 'demo-access', refresh: 'demo-refresh' }
  }
  return method === 'delete' ? null : { detail: 'ok' }
}

export const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const { path, params } = split(config)
  let status = 200
  let data: unknown
  if (method === 'get' || method === 'options' || method === 'head') {
    if (path === '/api/health/') data = { status: 'ok', service: 'CargoTrack demo' }
    else {
      const found = find(path)
      if (found === undefined) {
        status = 404
        data = { detail: 'Not available in the offline demo.' }
      } else data = filtered(found, params)
    }
  } else {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || 'null') : config.data
    data = write(path, method, body)
  }
  const response: AxiosResponse = { data, status, statusText: status === 200 ? 'OK' : 'Not Found', headers: {}, config, request: {} }
  if (status >= 400) {
    const err = Object.assign(new Error(`Request failed with status code ${status}`), { config, response, isAxiosError: true })
    throw err
  }
  return response
}
