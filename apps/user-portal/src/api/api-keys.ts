/**
 * api-keys — BYOK API Key 管理
 * 千机工坊 · M1-W4 · L4-A BYOK UI
 *
 * **后端真实契约** (L3.D 验证):
 *   - base: /api/v1/user/api-keys
 *   - GET  list: GET  /api/v1/user/api-keys         → ApiKeyRow[]
 *   - POST create: POST /api/v1/user/api-keys        body {provider, apiKey, alias?} → ApiKeyRow
 *   - GET  reveal: GET  /api/v1/user/api-keys/:id/reveal → {apiKey: '明文'}
 *   - DELETE: DELETE /api/v1/user/api-keys/:id
 *   - 鉴权: Authorization: Bearer <jwt>
 *   - envelope: { code: 0=ok, message, data }
 *   - 列字段: { id, userId, provider, keyFingerprint, lastFour, createdAt, lastUsedAt, revokedAt }
 *   - **reveal 真返回明文 (L3.D AES-256-GCM 解密), 一次性, 前端 30s 弹窗**
 *   - 响应字段是 camelCase (跟 L3.D 源文件一致)
 *
 * 5 个 provider: openai / anthropic / google / deepseek / minimax
 */

const BASE = '/api/v1/user/api-keys'

/* ------------------------------------------------------------------ */
/*                            类型                                     */
/* ------------------------------------------------------------------ */

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'minimax'

export interface ProviderMeta {
  id: ProviderId
  name: string
  logo: string
  color: string
  placeholder: string
  prefix: string
}

/** 后端 List/Create 响应的 ApiKey 行 (camelCase) */
export interface ApiKeyRow {
  id: string
  userId: string
  provider: string
  keyFingerprint: string
  lastFour: string
  createdAt: number
  lastUsedAt: number | null
  revokedAt: number | null
}

/** 后端 reveal 响应 */
export interface RevealKeyResp {
  apiKey: string
}

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class ApiKeyError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiKeyError'
    this.status = status
    this.code = code
  }
}

/* ------------------------------------------------------------------ */
/*                            Provider 元数据                           */
/* ------------------------------------------------------------------ */

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    logo: '🤖',
    color: '#10a37f',
    placeholder: 'sk-...',
    prefix: 'sk-'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '🧠',
    color: '#d97706',
    placeholder: 'sk-ant-...',
    prefix: 'sk-ant-'
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    logo: '🔍',
    color: '#4285f4',
    placeholder: 'AIza...',
    prefix: 'AIza'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '💡',
    color: '#5b21b6',
    placeholder: 'sk-...',
    prefix: 'sk-'
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax M-Series',
    logo: '⚡',
    color: '#a8302b',
    placeholder: 'mm-...',
    prefix: 'mm-'
  }
}

export const PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'google', 'deepseek', 'minimax']

/* ------------------------------------------------------------------ */
/*                            工具                                     */
/* ------------------------------------------------------------------ */

function authHeaders(): Record<string, string> {
  try {
    const t = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
    return t ? { Authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders() }
}

async function parseEnvelope<T>(resp: Response): Promise<T> {
  const text = await resp.text()
  let body: ApiEnvelope<T> | null = null
  if (text) {
    try { body = JSON.parse(text) as ApiEnvelope<T> } catch { /* non-JSON */ }
  }
  if (!resp.ok) {
    const code = body?.code ?? resp.status
    const message = body?.message ?? resp.statusText ?? 'request_failed'
    throw new ApiKeyError(resp.status, String(code), message)
  }
  if (body && body.code !== 0) {
    throw new ApiKeyError(resp.status, String(body.code), body.message || 'business_error')
  }
  if (!body) return undefined as unknown as T
  return body.data
}

/* ------------------------------------------------------------------ */
/*                            4 个动作 (真实契约)                        */
/* ------------------------------------------------------------------ */

/** GET /api/v1/user/api-keys  —— 列出当前用户所有 key (不含明文) */
export async function fetchApiKeys(): Promise<ApiKeyRow[]> {
  const resp = await fetch(BASE, { method: 'GET', headers: authHeaders() })
  return parseEnvelope<ApiKeyRow[]>(resp)
}

/** POST /api/v1/user/api-keys  —— 新增 key (后端会查重, 同 provider 覆盖) */
export async function createApiKey(
  provider: ProviderId,
  apiKey: string,
  label?: string
): Promise<ApiKeyRow> {
  const body: Record<string, string> = { provider, apiKey }
  if (label && label.trim()) body.alias = label.trim()
  const resp = await fetch(BASE, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  })
  return parseEnvelope<ApiKeyRow>(resp)
}

/** DELETE /api/v1/user/api-keys/:id  —— 删除/吊销 */
export async function deleteApiKey(id: string): Promise<{ id: string }> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  return parseEnvelope<{ id: string }>(resp)
}

/**
 * GET /api/v1/user/api-keys/:id/reveal  —— **真返回明文** (L3.D 后端一次性解密)
 *
 * ⚠️ 后端会标记 key 为已 reveal, reveal count +1
 * ⚠️ 前端必须 30s 倒计时自动关弹窗, 不持久化明文
 * ⚠️ 复制后立即清理 localStorage 缓存
 */
export async function revealApiKey(id: string): Promise<RevealKeyResp> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(id)}/reveal`, {
    method: 'GET',
    headers: authHeaders()
  })
  return parseEnvelope<RevealKeyResp>(resp)
}

/* ------------------------------------------------------------------ */
/*                            派生工具                                  */
/* ------------------------------------------------------------------ */

/** masked key 显示: prefix + *** + lastFour (前端合成, 后端 lastFour 字段) */
export function maskedDisplay(row: ApiKeyRow): string {
  const meta = PROVIDER_META[row.provider as ProviderId]
  const prefix = meta?.prefix ?? '***'
  return `${prefix}***${row.lastFour}`
}

/** lastUsedAt 友好显示 (毫秒时间戳) */
export function formatLastUsed(ts: number | null): string {
  if (!ts) return '从未使用'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '未知'
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const day = Math.floor(h / 24)
  if (day < 30) return `${day} 天前`
  return d.toISOString().slice(0, 10)
}

/** KPI: 已用 / 总额 (来自 UserProfile 后续接) */
export function creditsKpi(used?: number, total?: number): { used: number; total: number; percent: number } {
  const u = used ?? 0
  const t = total ?? 0
  return { used: u, total: t, percent: t > 0 ? Math.min(100, Math.round((u / t) * 100)) : 0 }
}

/** 5 provider 中已配置的数量 */
export function countConfigured(rows: ApiKeyRow[]): { configured: number; unconfigured: number } {
  const configuredSet = new Set(rows.map((r) => r.provider))
  const configured = PROVIDER_IDS.filter((p) => configuredSet.has(p)).length
  return { configured, unconfigured: PROVIDER_IDS.length - configured }
}
