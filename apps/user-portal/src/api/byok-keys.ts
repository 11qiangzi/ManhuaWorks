/**
 * byok-keys — 派单 17 BYOK API (用户自带 Key)
 *
 * **后端真实契约** (派单 17):
 *   - base: /api/v1/user/byok-keys
 *   - GET    /                   → UserApiKeyRow[] (脱敏, 不含 apiKeyEncrypted)
 *   - POST   /                   body { provider, apiKey, baseUrl?, nickname, isDefault? } → UserApiKeyRow
 *   - PATCH  /:id                body { nickname?, isDefault? } → UserApiKeyRow
 *   - DELETE /:id                → { id }
 *   - POST   /:id/test           → TestResult { status: 'ok' | 'invalid' | 'rate_limited', latencyMs, hint? }
 *   - 鉴权: Authorization: Bearer <jwt>
 *   - envelope: { code: 0=ok, message, data }
 *   - 限流: POST /:id/test 用 X-RateLimit-* 头, 60/h/key
 *   - 6 provider: deepseek / openai / replicate / qianwen / zhipu / fal
 *
 * 与 api/keys.ts (派单 16) 的区别:
 *   - provider 集合不同: 派单 16 是 openai/anthropic/google/deepseek/minimax,
 *     派单 17 是 deepseek/openai/replicate/qianwen/zhipu/fal
 *   - 表不同: 派单 16 走 api_keys 表 + in-memory repo, 派单 17 走 user_api_keys PG 表
 *   - 派单 17 有 test 端点 + PATCH 端点 (派单 16 没有)
 *   - 派单 17 用 baseUrl (用户自定义 BaseURL, OpenAI 兼容代理)
 */

const BASE = '/api/v1/user/byok-keys'

/* ------------------------------------------------------------------ */
/*                            类型                                     */
/* ------------------------------------------------------------------ */

export type ByokProviderId =
  | 'deepseek'
  | 'openai'
  | 'replicate'
  | 'qianwen'
  | 'zhipu'
  | 'fal'

export interface ByokProviderMeta {
  id: ByokProviderId
  name: string
  logo: string
  color: string
  description: string
  prefix: string
  placeholder: string
  defaultBaseUrl: string
  testPath: string
}

/** 6 provider 元数据 (派单 17) */
export const BYOK_PROVIDER_META: Record<ByokProviderId, ByokProviderMeta> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '🐋',
    color: '#5b21b6',
    description: '国产开源大模型, 性价比最高, 适合中文创作',
    prefix: 'sk-',
    placeholder: 'sk-...',
    defaultBaseUrl: 'https://api.deepseek.com',
    testPath: '/models',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    logo: '🤖',
    color: '#10a37f',
    description: 'GPT-4o / o1 / Sora 全家桶, 国际标准',
    prefix: 'sk-',
    placeholder: 'sk-...',
    defaultBaseUrl: 'https://api.openai.com',
    testPath: '/v1/models',
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    logo: '🌀',
    color: '#f59e0b',
    description: '开源模型云跑平台, 图片/视频/音频模型库',
    prefix: 'r8_',
    placeholder: 'r8_...',
    defaultBaseUrl: 'https://api.replicate.com',
    testPath: '/v1/models',
  },
  qianwen: {
    id: 'qianwen',
    name: '通义千问',
    logo: '🌥️',
    color: '#ff6a00',
    description: '阿里云 DashScope, 兼容 OpenAI, Qwen3 全系',
    prefix: 'sk-',
    placeholder: 'sk-...',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    testPath: '/compatible-mode/v1/models',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 GLM',
    logo: '🧠',
    color: '#3b82f6',
    description: 'GLM-4 / CogVideoX, 国产多模态',
    prefix: '',
    placeholder: '智谱 API key',
    defaultBaseUrl: 'https://open.bigmodel.cn',
    testPath: '/api/paas/v4/models',
  },
  fal: {
    id: 'fal',
    name: 'fal.ai',
    logo: '⚡',
    color: '#a855f7',
    description: '快速图片生成, FLUX/SDXL/视频模型',
    prefix: '',
    placeholder: 'fal key (key_id:key_secret)',
    defaultBaseUrl: 'https://fal.run',
    testPath: '/models',
  },
}

export const BYOK_PROVIDER_IDS: ByokProviderId[] = [
  'deepseek',
  'openai',
  'replicate',
  'qianwen',
  'zhipu',
  'fal',
]

/** 后端 list/create/patch 响应行 (camelCase, 不含 apiKeyEncrypted) */
export interface ByokKeyRow {
  id: string
  userId: string
  provider: string
  baseUrl: string | null
  nickname: string
  isDefault: number  // 0 / 1
  lastUsedAt: string | null
  lastTestAt: string | null
  lastTestStatus: string | null
  createdAt: string
  updatedAt: string
}

/** 后端 test 响应 */
export interface ByokTestResult {
  status: 'ok' | 'invalid' | 'rate_limited'
  latencyMs: number
  provider: string
  hint?: string
  testedAt?: string
}

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class ByokKeyError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ByokKeyError'
    this.status = status
    this.code = code
  }
}

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
    throw new ByokKeyError(resp.status, String(code), message)
  }
  if (body && body.code !== 0) {
    throw new ByokKeyError(resp.status, String(body.code), body.message || 'business_error')
  }
  if (!body) return undefined as unknown as T
  return body.data
}

/* ------------------------------------------------------------------ */
/*                            5 个动作                                  */
/* ------------------------------------------------------------------ */

/** GET / — 列表 (脱敏) */
export async function fetchByokKeys(): Promise<ByokKeyRow[]> {
  const resp = await fetch(BASE, { method: 'GET', headers: authHeaders() })
  return parseEnvelope<ByokKeyRow[]>(resp)
}

/** POST / — 新增 */
export interface AddByokKeyParams {
  provider: ByokProviderId
  apiKey: string
  nickname: string
  baseUrl?: string
  isDefault?: boolean
}

export async function createByokKey(p: AddByokKeyParams): Promise<ByokKeyRow> {
  const body: Record<string, unknown> = {
    provider: p.provider,
    apiKey: p.apiKey,
    nickname: p.nickname,
  }
  if (p.baseUrl) body.baseUrl = p.baseUrl
  if (p.isDefault) body.isDefault = true
  const resp = await fetch(BASE, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  })
  return parseEnvelope<ByokKeyRow>(resp)
}

/** PATCH /:id — 改 nickname / isDefault */
export interface PatchByokKeyParams {
  nickname?: string
  isDefault?: boolean
}

export async function patchByokKey(id: string, p: PatchByokKeyParams): Promise<ByokKeyRow> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(p),
  })
  return parseEnvelope<ByokKeyRow>(resp)
}

/** DELETE /:id — 硬删 */
export async function deleteByokKey(id: string): Promise<{ id: string }> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return parseEnvelope<{ id: string }>(resp)
}

/** POST /:id/test — 测 key 有效性 */
export async function testByokKey(id: string): Promise<ByokTestResult> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    headers: authHeaders(),
  })
  // /test 端点 4xx 也返 ByokTestResult (status: invalid), 429 返 rate_limited
  // 统一走 envelope 解析, 失败时抛 ByokKeyError (限流场景)
  if (resp.status === 429) {
    throw new ByokKeyError(429, '42901', 'rate_limited')
  }
  return parseEnvelope<ByokTestResult>(resp)
}

/* ------------------------------------------------------------------ */
/*                            派生工具                                  */
/* ------------------------------------------------------------------ */

/** 状态 → UI 友好描述 */
export function testStatusText(status: string | null): string {
  switch (status) {
    case 'ok': return '✅ 有效'
    case 'invalid': return '❌ 无效'
    case 'rate_limited': return '⏱ 被限流'
    default: return '🕐 未测试'
  }
}

/** 时间戳友好显示 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** lastTestStatus 颜色 (CSS 变量名) */
export function testStatusColor(status: string | null): string {
  switch (status) {
    case 'ok': return '#10b981'
    case 'invalid': return '#ef4444'
    case 'rate_limited': return '#f59e0b'
    default: return 'var(--text-secondary)'
  }
}
