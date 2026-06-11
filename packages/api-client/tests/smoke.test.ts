/**
 * ManhuaWorks 路 api-client
 * smoke.test.ts 鈥?鐪熷疄鎺ラ€氭祴璇? *
 * 涓嶄緷璧栦换浣曞閮ㄥ寘銆傜敤涓€涓畝鏄?in-memory mock 楠岃瘉锛? *   1. login 鎴愬姛 + token 鎸佷箙鍖? *   2. GET /users/me 鎼哄甫 Authorization
 *   3. 401 鈫?瑙﹀彂 refreshHandler 鈫?閲嶈瘯鎴愬姛
 *   4. 422 鎶?ValidationError
 *   5. WebSocket 杩炴帴 + send/on 璺敱
 */

import { strict as assert } from 'node:assert'
import { test, expect } from 'vitest'

import {
  createApiClient,
  ApiError,
  ErrorCode,
  isApiError,
  tokenStore,
  ValidationError,
  AuthError,
  NetworkError,
} from '../src/index.js'

/* ---------------------------------------------------------------- *
 * In-memory fetch + WS mock
 * ---------------------------------------------------------------- */
type RouteHandler = (ctx: {
  method: string
  url: string
  body: any
  headers: Record<string, string>
}) => { status: number; body: any }

class MockTransport {
  routes = new Map<string, RouteHandler>()
  calls: Array<{ method: string; url: string }> = []
  setRoute(method: string, path: RegExp, h: RouteHandler): void {
    this.routes.set(`${method} ${path.source}`, { method, path, h } as unknown as RouteHandler)
  }
  reset(): void { this.routes.clear(); this.calls = [] }
}

function makeFetch(t: MockTransport): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const url = typeof input === 'string' ? input : (input as URL).toString()
    t.calls.push({ method, url })
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = init.headers as Record<string, string>
      for (const k of Object.keys(h)) headers[k.toLowerCase()] = h[k]
    }
    let body: any = undefined
    if (init?.body) {
      try { body = JSON.parse(String(init.body)) } catch { body = init.body }
    }
    for (const [, route] of Array.from(t.routes.entries())) {
      const r = route as unknown as { method: string; path: RegExp; h: RouteHandler }
      if (r.method !== method) continue
      if (!r.path.test(new URL(url, 'http://x').pathname)) continue
      const result = r.h({ method, url, body, headers })
      return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'no route' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  static CLOSED = 3
  readyState = 0
  url: string
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null
  onclose: ((ev: any) => void) | null = null
  sent: string[] = []
  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.(new Event('open'))
    }, 0)
  }
  send(data: string): void { this.sent.push(data) }
  close(): void { this.readyState = 3; this.onclose?.(new Event('close')) }
  // 娴嬭瘯杈呭姪
  fakeServerMessage(env: any): void {
    this.onmessage?.({ data: JSON.stringify(env) })
  }
}

/* ---------------------------------------------------------------- *
 * 1. login + token 鎸佷箙鍖? * ---------------------------------------------------------------- */
test('smoke: login persists token via tokenStore', async () => {
  const t = new MockTransport()
  t.routes.set('POST /auth/login', {
    method: 'POST', path: /\/auth\/login$/,
    h: () => ({ status: 200, body: {
      user: { id: 'u1', email: 'a@b.com', display_name: 'A', role: 0, status: 1, created_at: '2026-01-01T00:00:00Z' },
      token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600,
    } }),
  } as unknown as RouteHandler)
  const api = createApiClient({ baseURL: 'http://x', fetchImpl: makeFetch(t) })
  const r = await api.auth.loginByPassword({ email: 'a@b.com', password: 'pw' })
  assert.equal(r.token, 'access-1')
  assert.equal(tokenStore.get(), 'access-1')
  assert.equal(tokenStore.getRefresh(), 'refresh-1')
})

/* ---------------------------------------------------------------- *
 * 2. GET /users/me 鎼哄甫 Authorization
 * ---------------------------------------------------------------- */
test('smoke: GET /users/me carries Authorization header', async () => {
  const t = new MockTransport()
  tokenStore.set('seed-token')
  let sawAuth: string | null = null
  t.routes.set('GET /users/me', {
    method: 'GET', path: /\/users\/me$/,
    h: (ctx) => { sawAuth = ctx.headers['authorization'] ?? null
      return { status: 200, body: { id: 'u1', email: 'a@b.com', display_name: 'A', role: 0, status: 1, created_at: '2026-01-01T00:00:00Z' } } },
  } as unknown as RouteHandler)
  const api = createApiClient({ baseURL: 'http://x', fetchImpl: makeFetch(t) })
  const u = await api.users.me()
  assert.equal(u.id, 'u1')
  assert.equal(sawAuth, 'Bearer seed-token')
  tokenStore.clear()
})

/* ---------------------------------------------------------------- *
 * 3. 401 鈫?refreshHandler 鈫?閲嶈瘯鎴愬姛
 * ---------------------------------------------------------------- */
test('smoke: 401 triggers refreshHandler and retries', async () => {
  const t = new MockTransport()
  tokenStore.set('old-token')
  let callCount = 0
  t.routes.set('GET /users/me', {
    method: 'GET', path: /\/users\/me$/,
    h: () => {
      callCount += 1
      if (callCount === 1) return { status: 401, body: { code: 'TOKEN_EXPIRED' } }
      return { status: 200, body: { id: 'u1', email: 'a@b.com', display_name: 'A', role: 0, status: 1, created_at: '2026-01-01T00:00:00Z' } }
    },
  } as unknown as RouteHandler)

  const api = createApiClient({
    baseURL: 'http://x',
    fetchImpl: makeFetch(t),
    refreshHandler: async () => {
      // 妯℃嫙涓氬姟灞傝皟 users.refresh 鎷挎柊 token
      const r = await api.users.refresh({ refresh_token: tokenStore.getRefresh() ?? 'r' })
      return r.token
    },
  })
  // 璁?refresh 璺敱涓嶆姏锛氱粰涓€涓复鏃惰矾鐢?
  t.routes.set('POST /auth/refresh', {
    method: 'POST', path: /\/auth\/refresh$/,
    h: () => ({ status: 200, body: { token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 } }),
  } as unknown as RouteHandler)
  tokenStore.setRefresh('r')
  const u = await api.users.me()
  assert.equal(u.id, 'u1')
  assert.equal(tokenStore.get(), 'new-token')
  assert.equal(callCount, 2)
  tokenStore.clear()
})

/* ---------------------------------------------------------------- *
 * 4. 422 鎶?ValidationError
 * ---------------------------------------------------------------- */
test('smoke: 422 throws ValidationError with category validation', async () => {
  const t = new MockTransport()
  t.routes.set('POST /auth/login', {
    method: 'POST', path: /\/auth\/login$/,
    h: () => ({ status: 422, body: { code: 'VALIDATION_FAILED', message: 'bad', details: [{ field: 'email' }] } }),
  } as unknown as RouteHandler)
  const api = createApiClient({ baseURL: 'http://x', fetchImpl: makeFetch(t) })
  let caught: unknown = null
  try { await api.auth.loginByPassword({ email: '', password: '' }) } catch (e) { caught = e }
  assert.ok(isApiError(caught))
  assert.ok(caught instanceof ValidationError)
  assert.equal((caught as ApiError).code, ErrorCode.VALIDATION_FAILED)
  assert.equal((caught as ApiError).category, 'validation')
  assert.equal((caught as ApiError).status, 422)
})

/* ---------------------------------------------------------------- *
 * 5. WebSocket 杩炴帴 + send/on 璺敱
 * ---------------------------------------------------------------- */
test('smoke: WebSocket connects and dispatches messages', async () => {
  MockWebSocket.instances = []
  const sock = (await import('../src/index.js')).createApiClient({
    baseURL: 'http://localhost:8080/api',
    WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
  }).collab.socket('proj-1')

  // 绛?onopen 寮傛瑙﹀彂
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(sock.state, 'open')

  const seen: any[] = []
  sock.on('cursor', (env) => { seen.push(env) })
  sock.send('cursor', { x: 1, y: 2, target_type: 'shot', target_id: 's1' })

  // 鎵惧埌 mock ws 瀹炰緥锛屾ā鎷熸湇鍔＄鍙戝洖
  const m = MockWebSocket.instances[0]
  assert.ok(m, 'mock ws exists')
  m.fakeServerMessage({ type: 'cursor', project_id: 'proj-1', user_id: 'u2', ts: 1, data: { x: 9, y: 8, target_type: 'shot', target_id: 's1' } })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].data.x, 9)

  sock.close()
})

/* ---------------------------------------------------------------- *
 * 6. ErrorCode 瑕嗙洊 鈮?0
 * ---------------------------------------------------------------- */
test('smoke: ErrorCode exports 鈮?0 codes', () => {
  const codes = Object.values(ErrorCode)
  assert.ok(codes.length >= 30, `expected 鈮?0 codes, got ${codes.length}`)
  for (const c of ['USER_NOT_FOUND', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'VALIDATION_FAILED', 'RATE_LIMITED', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRED', 'COLLAB_CONFLICT']) {
    assert.ok(codes.includes(c as any), `missing ${c}`)
  }
})

/* ---------------------------------------------------------------- *
 * 7. ApiError base 瀛楁
 * ---------------------------------------------------------------- */
test('smoke: ApiError exposes code/message/status/category/userMessage', () => {
  const e = new ApiError({ code: 'X', message: 'm', status: 400 })
  assert.equal(e.code, 'X')
  assert.equal(e.message, 'm')
  assert.equal(e.status, 400)
  assert.equal(e.category, 'validation')
  assert.equal(e.userMessage, 'm')
})

/* ---------------------------------------------------------------- *
 * 8. 閿欒瀛愮被鍙瘑鍒? * ---------------------------------------------------------------- */
test('smoke: error subclasses are distinguishable', () => {
  const ne = new NetworkError('NETWORK_OFFLINE', 'offline')
  const ae = new AuthError('INVALID_CREDENTIALS', 'bad')
  const ve = new ValidationError('VALIDATION_FAILED', 'bad')
  const be = new (class extends ApiError { constructor() { super({ code: 'X', message: 'm', status: 409 }); this.name = 'BusinessError' } })()
  assert.ok(ne instanceof NetworkError)
  assert.ok(ae instanceof AuthError)
  assert.ok(ve instanceof ValidationError)
  assert.ok(be instanceof ApiError)
  assert.equal(be.status, 409)
})
