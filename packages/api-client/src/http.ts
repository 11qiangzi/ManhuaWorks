/**
 * ManhuaWorks · api-client
 * http — fetch wrapper
 *   - JWT 自动注入 (Authorization: Bearer)
 *   - 401 自动 refresh（重试一次）
 *   - 通用 3 次重试（GET / 网络抖动）
 *   - 30s 超时（AbortController）
 *   - 错误统一抛 ApiError
 */

import { ApiError, ErrorCode, NetworkError } from './errors.js'
import { tokenStore } from './token-store.js'
import type {
  ApiRequestOptions, HttpMethod, HttpModule, CreateApiClientOptions,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const RETRYABLE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET'])
const RETRY_BASE_DELAY_MS = 200

interface HttpInnerOptions {
  method: HttpMethod
  path: string
  body?: unknown
  query?: Record<string, unknown>
  opts: ApiRequestOptions
}

export interface HttpRuntime {
  http: HttpModule
  setAccessToken: (token: string | null) => void
  /** 当前 baseURL（auth-lost / token-update 监听用） */
  baseURL: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && (v as object).constructor === Object
}

/* ── P0-1 / P0-2: 响应信封剥离 + 字段映射 ───────────────────── */

/** 后端 status 数字 → 前端 DTO 字符串枚举 */
const PROJECT_STATUS_MAP: Record<number, string> = { 0: 'active', 1: 'active', 2: 'archived', 3: 'deleted' }
const SHOT_STATUS_MAP: Record<number, string> = { 0: 'draft', 1: 'wip', 2: 'review', 3: 'done', 4: 'archived' }

/** 剥离 {code, message, data} 信封 + 分页字段统一 + 实体字段映射 */
function unwrapApiResponse(data: unknown, path: string): unknown {
  if (!isPlainObject(data)) return data

  // 1) 信封剥离: {code:0, data:{...}} → data 部分
  let body: unknown = data
  if ('code' in data && 'data' in data) {
    body = data.data
  }

  // 2) 分页规范化: items → list
  if (isPlainObject(body) && !Array.isArray(body) && 'items' in body && Array.isArray((body as any).items)) {
    body = { ...body, list: (body as any).items }
  }

  // 3) 实体字段映射
  if (Array.isArray(body)) {
    return body.map((item: unknown) => mapFields(item, path))
  }
  if (isPlainObject(body)) {
    // 分页响应里的 list 数组
    if ('list' in body && Array.isArray((body as any).list)) {
      return { ...(body as object), list: ((body as any).list as unknown[]).map((item: unknown) => mapFields(item, path)) }
    }
    // 单实体响应
    return mapFields(body, path)
  }
  return body
}

/** 根据路径判断实体类型，做字段映射 */
function mapFields(item: unknown, path: string): unknown {
  if (!isPlainObject(item)) return item
  const obj = { ...item } as Record<string, unknown>

  // Project 字段映射
  if (path.includes('/projects') && !path.includes('/shots') && !path.includes('/characters') && !path.includes('/scenes')) {
    if ('title' in obj && !('name' in obj)) obj.name = obj.title
    if ('user_id' in obj && !('owner_id' in obj)) obj.owner_id = obj.user_id
    if (typeof obj.status === 'number') obj.status = PROJECT_STATUS_MAP[obj.status as number] ?? 'active'
    // 前端 DTO 要求的默认值
    if (!('visibility' in obj)) obj.visibility = 'private'
    if (!('shot_count' in obj)) obj.shot_count = 0
    if (!('member_count' in obj)) obj.member_count = 0
  }

  // Shot 字段映射
  if (path.includes('/shots')) {
    if ('title' in obj && !('name' in obj)) obj.name = obj.title
    if ('sort_index' in obj && !('order_index' in obj)) obj.order_index = obj.sort_index
    if ('shot_no' in obj && !('order_index' in obj)) obj.order_index = obj.shot_no
    if (typeof obj.status === 'number') obj.status = SHOT_STATUS_MAP[obj.status as number] ?? 'draft'
  }

  // Login 响应：后端 {token, user:{...}} 没有 refresh_token / expires_in
  if (path.includes('/auth/login') || path.includes('/auth/register')) {
    if (!('refresh_token' in obj)) obj.refresh_token = ''
    if (!('expires_in' in obj)) obj.expires_in = 3600
  }

  return obj
}

function buildQuery(q?: Record<string, unknown>): string {
  if (!q) return ''
  const parts: string[] = []
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`)
    } else if (v instanceof Date) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.toISOString())}`)
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(() => resolve(), ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

function shouldRetry(status: number, err: unknown, attempt: number, max: number, method: HttpMethod): boolean {
  if (attempt >= max) return false
  if (!RETRYABLE_METHODS.has(method)) return false
  if (err instanceof NetworkError) return true
  if (status === 0) return true
  if (status === 408 || status === 429) return true
  if (status >= 500 && status < 600) return true
  return false
}

export function createHttp(opts: CreateApiClientOptions): HttpRuntime {
  const baseURL = (opts.baseURL ?? '/api').replace(/\/+$/, '')
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const fetchImpl: typeof fetch = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (() => { throw new NetworkError(ErrorCode.NETWORK_UNKNOWN, 'fetch unavailable') }) as unknown as typeof fetch)
  const refreshHandler = opts.refreshHandler
  const onAuthLost = opts.onAuthLost

  /** refresh 期间单飞，避免并发 401 触发多次刷新 */
  let inflightRefresh: Promise<string | null> | null = null

  async function doRefresh(): Promise<string | null> {
    if (!refreshHandler) return null
    if (!inflightRefresh) {
      inflightRefresh = (async () => {
        try { return await refreshHandler() } catch { return null } finally {
          // 下一轮请求可重新尝试
          setTimeout(() => { inflightRefresh = null }, 0)
        }
      })()
    }
    return inflightRefresh
  }

  async function rawRequest(
    method: HttpMethod,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
    userOpts: ApiRequestOptions = {},
  ): Promise<Response> {
    const url = `${baseURL}${path.startsWith('/') ? path : `/${path}`}${buildQuery(query)}`
    const controller = new AbortController()
    const outerSignal = userOpts.signal
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    let abortedByTimeout = false

    if (outerSignal) {
      if (outerSignal.aborted) controller.abort()
      else outerSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    timeoutHandle = setTimeout(() => {
      abortedByTimeout = true
      controller.abort()
    }, userOpts.timeoutMs ?? timeoutMs)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(userOpts.headers ?? {}),
    }
    const token = tokenStore.get()
    if (token && !userOpts.skipAuth) {
      headers.Authorization = `Bearer ${token}`
    }
    let payload: BodyInit | undefined
    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        payload = body
      } else if (typeof body === 'string' || body instanceof Blob || body instanceof ArrayBuffer) {
        payload = body as BodyInit
      } else {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
        payload = JSON.stringify(body)
      }
    }

    let resp: Response
    try {
      resp = await fetchImpl(url, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
        credentials: 'include',
      })
    } catch (e) {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (abortedByTimeout || (e instanceof DOMException && e.name === 'AbortError')) {
        throw new NetworkError(ErrorCode.NETWORK_TIMEOUT, '请求超时')
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new NetworkError(ErrorCode.NETWORK_ABORTED, '请求已取消', e)
      }
      throw new NetworkError(ErrorCode.NETWORK_UNKNOWN, e instanceof Error ? e.message : '网络异常', e)
    }
    if (timeoutHandle) clearTimeout(timeoutHandle)
    return resp
  }

  async function parseBody(resp: Response, path: string): Promise<unknown> {
    const ct = resp.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        const raw = await resp.json()
        return unwrapApiResponse(raw, path)
      } catch { return null }
    }
    const text = await resp.text().catch(() => '')
    return text || null
  }

  async function executeWithRetry(inner: HttpInnerOptions): Promise<unknown> {
    const { method, path, body, query, opts } = inner
    let attempt = 0
    let lastErr: unknown = null
    let lastStatus = 0

    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      try {
        const resp = await rawRequest(method, path, body, query, opts)
        if (resp.ok) {
          // 204 / 空 body
          if (resp.status === 204) return null
          return await parseBody(resp, inner.path)
        }

        // 401 → 自动 refresh + 重试一次
        if (resp.status === 401 && !opts.skipAuth) {
          const newToken = await doRefresh()
          if (newToken) {
            tokenStore.set(newToken)
            // 重试一次
            const retryResp = await rawRequest(method, path, body, query, { ...opts, skipAuth: false })
            if (retryResp.ok) {
              if (retryResp.status === 204) return null
              return await parseBody(retryResp, inner.path)
            }
            if (retryResp.status === 401) {
              // refresh 后仍 401 → 认证失效
              tokenStore.clearAll()
              try { onAuthLost?.() } catch { /* noop */ }
              const body401 = await parseBody(retryResp, inner.path)
              if (opts.swallow401) return null
              throw ApiError.fromResponse(401, body401)
            }
            const body2 = await parseBody(retryResp, inner.path)
            throw ApiError.fromResponse(retryResp.status, body2)
          }
          tokenStore.clearAll()
          try { onAuthLost?.() } catch { /* noop */ }
          const body401 = await parseBody(resp, inner.path)
          if (opts.swallow401) return null
          throw ApiError.fromResponse(401, body401)
        }

        lastStatus = resp.status
        if (shouldRetry(resp.status, null, attempt, maxRetries, method)) {
          attempt += 1
          lastErr = null
          await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), opts.signal)
          continue
        }

        const errBody = await parseBody(resp, inner.path)
        if (opts.swallow401 && resp.status === 401) return null
        throw ApiError.fromResponse(resp.status, errBody)
      } catch (e) {
        lastErr = e
        if (e instanceof ApiError) {
          // ApiError 已被分类，决定是否重试
          const status = e.status
          if (shouldRetry(status, e, attempt, maxRetries, method)) {
            attempt += 1
            await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), opts.signal)
            continue
          }
          throw e
        }
        // 非 ApiError：网络层错误
        if (shouldRetry(lastStatus, e, attempt, maxRetries, method)) {
          attempt += 1
          await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), opts.signal)
          continue
        }
        throw e
      }
    }
    // unreachable
    /* c8 ignore next 3 */
    void lastErr
  }

  function request<T>(method: HttpMethod, path: string, opts: ApiRequestOptions = {}): Promise<T> {
    return executeWithRetry({ method, path, body: undefined, query: undefined, opts }) as Promise<T>
  }

  const http: HttpModule = {
    get: <T = unknown>(path: string, query?: Record<string, unknown>, opts?: ApiRequestOptions) =>
      executeWithRetry({ method: 'GET', path, body: undefined, query, opts: opts ?? {} }) as Promise<T>,
    post: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
      executeWithRetry({ method: 'POST', path, body, query: undefined, opts: opts ?? {} }) as Promise<T>,
    put: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
      executeWithRetry({ method: 'PUT', path, body, query: undefined, opts: opts ?? {} }) as Promise<T>,
    patch: <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
      executeWithRetry({ method: 'PATCH', path, body, query: undefined, opts: opts ?? {} }) as Promise<T>,
    delete: <T = unknown>(path: string, opts?: ApiRequestOptions) =>
      executeWithRetry({ method: 'DELETE', path, body: undefined, query: undefined, opts: opts ?? {} }) as Promise<T>,
    request: <T = unknown>(method: HttpMethod, path: string, opts?: ApiRequestOptions) =>
      request<T>(method, path, opts ?? {}),
  }

  return {
    http,
    baseURL,
    setAccessToken: (t: string | null) => { tokenStore.set(t) },
  }
}

/* re-export for tests / 兼容 */
export { isPlainObject }
