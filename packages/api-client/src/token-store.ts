/**
 * ManhuaWorks · api-client
 * tokenStore — localStorage 持久化的单例 token 管理
 *
 * 下游 import：
 *   import { tokenStore } from '@manhuaworks/api-client'
 *   tokenStore.get() / set() / clear() / getRefresh() / setRefresh() / clearAll()
 *   tokenStore.getToken() / setToken() / clearToken()
 *   tokenStore.getRefreshToken() / setRefreshToken()
 *   tokenStore.isAuthenticated()
 */

const ACCESS_KEY = 'mhw.access_token'
const REFRESH_KEY = 'mhw.refresh_token'
const USER_KEY = 'mhw.user'

/** 兼容 SSR / node 测试环境：无 localStorage 时不抛 */
function hasStorage(): boolean {
  try {
    return typeof globalThis !== 'undefined' && !!globalThis.localStorage
  } catch {
    return false
  }
}

function safeGet(key: string): string | null {
  if (!hasStorage()) return null
  try {
    return globalThis.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (!hasStorage()) return
  try {
    globalThis.localStorage.setItem(key, value)
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function safeRemove(key: string): void {
  if (!hasStorage()) return
  try {
    globalThis.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export interface TokenStore {
  /* --- 短名（下游主用） --- */
  get(): string | null
  set(token: string | null): void
  clear(): void
  getRefresh(): string | null
  setRefresh(token: string | null): void
  clearAll(): void

  /* --- 任务规范的全名 --- */
  getToken(): string | null
  setToken(token: string | null): void
  clearToken(): void
  getRefreshToken(): string | null
  setRefreshToken(token: string | null): void
  isAuthenticated(): boolean

  /* --- 附带 user 快照 --- */
  getUser<T = unknown>(): T | null
  setUser<T = unknown>(user: T | null): void

  /* --- 事件订阅（业务方监听登录/登出） --- */
  subscribe(listener: (state: { access: string | null; refresh: string | null }) => void): () => void
}

class TokenStoreImpl implements TokenStore {
  private listeners = new Set<(s: { access: string | null; refresh: string | null }) => void>()

  private emit(): void {
    const snapshot = { access: this.get(), refresh: this.getRefresh() }
    for (const fn of this.listeners) {
      try { fn(snapshot) } catch { /* listener 异常不影响主流程 */ }
    }
  }

  /* short names */
  get(): string | null { return safeGet(ACCESS_KEY) }
  set(token: string | null): void {
    if (token == null) safeRemove(ACCESS_KEY)
    else safeSet(ACCESS_KEY, token)
    this.emit()
  }
  clear(): void {
    safeRemove(ACCESS_KEY)
    this.emit()
  }
  getRefresh(): string | null { return safeGet(REFRESH_KEY) }
  setRefresh(token: string | null): void {
    if (token == null) safeRemove(REFRESH_KEY)
    else safeSet(REFRESH_KEY, token)
    this.emit()
  }
  clearAll(): void {
    safeRemove(ACCESS_KEY)
    safeRemove(REFRESH_KEY)
    safeRemove(USER_KEY)
    this.emit()
  }

  /* full names (alias) */
  getToken(): string | null { return this.get() }
  setToken(token: string | null): void { this.set(token) }
  clearToken(): void { this.clear() }
  getRefreshToken(): string | null { return this.getRefresh() }
  setRefreshToken(token: string | null): void { this.setRefresh(token) }
  isAuthenticated(): boolean { return !!this.get() }

  /* user 快照 */
  getUser<T = unknown>(): T | null {
    const raw = safeGet(USER_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  }
  setUser<T = unknown>(user: T | null): void {
    if (user == null) safeRemove(USER_KEY)
    else safeSet(USER_KEY, JSON.stringify(user))
  }

  /* events */
  subscribe(listener: (state: { access: string | null; refresh: string | null }) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}

/** 单例 */
export const tokenStore: TokenStore = new TokenStoreImpl()
