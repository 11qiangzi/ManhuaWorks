/**
 * ManhuaWorks 微信小程序 - 后端 API 客户端
 *
 * 后端契约 (从 services/user-service/src/{routes/index.ts,authService.ts,api-key.repo.ts} 抄录, 2026-06-09 10:36)
 *   监听: http://127.0.0.1:8088
 *   前缀: /api/v1
 *   统一响应外壳: { code: 0, message: string, data?: T }   (非 0 = 业务错)
 *
 *   关键端点 (本客户端用到):
 *     POST /auth/register     注册并登录
 *        body:  { email: string, password: string, display_name?: string }
 *        resp:  { code:0, message:'created', data: TokenPair }            201
 *
 *     POST /auth/login        邮箱/手机号 + 密码登录
 *        body:  { email?: string, phone?: string, password: string, totp?: string }
 *        resp:  { code:0, message:'ok', data: TokenPair }                  200
 *
 *     GET  /me                获取当前用户
 *        resp:  { code:0, message:'ok', data: PublicUser }                 200
 *
 *     GET  /user/api-keys     列出我的 BYOK Key (camelCase)
 *        resp:  { code:0, message:'ok', data: ApiKeyPublic[] }             200
 *
 *     GET  /user/api-keys/:id/reveal   一次性显示明文
 *        resp:  { code:0, message:'ok', data: { apiKey: string } }         200
 *
 *   TokenPair 形状 (snake_case, 来自 authService.ts):
 *     { access_token, refresh_token, expires_in, token_type: 'Bearer', user: PublicUser }
 *
 *   PublicUser 形状 (snake_case, 来自 models/user.ts):
 *     { id, phone, email, display_name, avatar_url, role, status, created_at, updated_at }
 *
 *   ApiKeyPublic 形状 (camelCase, 来自 repos/api-key.repo.ts):
 *     { id, userId, provider, keyFingerprint, lastFour, createdAt, lastUsedAt, revokedAt }
 *
 *   Authorization: 'Bearer <access_token>'  (services/user-service/src/middleware/auth.ts)
 */

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

/* ─────────────── 类型契约 (1:1 镜像后端) ─────────────── */

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: 'Bearer'
  user: PublicUser
}

export interface PublicUser {
  id: string
  phone: string | null
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: number
  status: number
  created_at?: string
  updated_at?: string
}

export interface ApiKeyRow {
  id: string
  userId: string
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'minimax'
  keyFingerprint: string
  lastFour: string
  createdAt: number
  lastUsedAt: number | null
  revokedAt: number | null
}

export interface Envelope<T> {
  code: number
  message: string
  data?: T
}

/* ─────────────── Token 存储 (解耦 axios 拦截器) ─────────────── */

const TOKEN_KEY = 'mw_access_token'

/** 微信小程序: 用 uni.setStorageSync; 其他环境降级到 localStorage */
function readToken(): string | null {
  try {
    // @ts-expect-error - uni 在运行时由 taro 注入
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      // @ts-expect-error - uni 在运行时由 taro 注入
      return uni.getStorageSync(TOKEN_KEY) || null
    }
  } catch {
    // uni 不可用 (单测环境)
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

function writeToken(token: string | null): void {
  try {
    // @ts-expect-error - uni 在运行时由 taro 注入
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      // @ts-expect-error - uni 在运行时由 taro 注入
      uni.setStorageSync(TOKEN_KEY, token ?? '')
      return
    }
  } catch {
    // uni 不可用
  }
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }
}

/** 401 跳转登录页 - 用回调注入, 避免循环依赖 */
type LoginRedirect = () => void
let onUnauthorized: LoginRedirect = () => {
  // 默认: 清 token, 业务层可覆盖 (见 setUnauthorizedHandler)
  writeToken(null)
}

export function setUnauthorizedHandler(fn: LoginRedirect): LoginRedirect {
  onUnauthorized = fn
  return fn
}

/* ─────────────── axios 实例 ─────────────── */

const BASE_URL = 'http://127.0.0.1:8088/api/v1'

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' }
})

// 请求拦截: 自动塞 Bearer
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = readToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// 响应拦截: 解 envelope + 401 跳登录
http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<Envelope<unknown>>) => {
    if (err.response?.status === 401) {
      writeToken(null)
      onUnauthorized()
    }
    return Promise.reject(err)
  }
)

/* ─────────────── 4 端点封装 (真实契约) ─────────────── */

export interface RegisterInput {
  email: string
  password: string
  display_name?: string
}

export interface LoginInput {
  email?: string
  phone?: string
  password: string
  totp?: string
}

/** 从 axios 错误中抠后端 message, 透传给业务层 */
function extractApiError(e: unknown, fallback: string): Error {
  if (e instanceof Error && e.message) return e
  const ax = e as AxiosError<Envelope<unknown>>
  const msg = ax?.response?.data?.message
  if (msg) return new Error(msg)
  if (ax?.response?.status) return new Error(`http_${ax.response.status}`)
  return new Error(fallback)
}

export async function register(input: RegisterInput): Promise<TokenPair> {
  try {
    const { data } = await http.post<Envelope<TokenPair>>('/auth/register', input)
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'register_failed')
    }
    return data.data
  } catch (e) {
    throw extractApiError(e, 'register_failed')
  }
}

export async function login(input: LoginInput): Promise<TokenPair> {
  try {
    const { data } = await http.post<Envelope<TokenPair>>('/auth/login', input)
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'login_failed')
    }
    return data.data
  } catch (e) {
    throw extractApiError(e, 'login_failed')
  }
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  try {
    const { data } = await http.get<Envelope<ApiKeyRow[]>>('/user/api-keys')
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'list_api_keys_failed')
    }
    return data.data
  } catch (e) {
    throw extractApiError(e, 'list_api_keys_failed')
  }
}

export async function revealApiKey(id: string): Promise<string> {
  try {
    const { data } = await http.get<Envelope<{ apiKey: string }>>(
      `/user/api-keys/${encodeURIComponent(id)}/reveal`
    )
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'reveal_api_key_failed')
    }
    return data.data.apiKey
  } catch (e) {
    throw extractApiError(e, 'reveal_api_key_failed')
  }
}

/* ─────────────── 工具: 暴露给 store 用 ─────────────── */

export const tokenStore = {
  get: readToken,
  set: writeToken,
  clear: () => writeToken(null)
}
