/**
 * byok API 客户端（BYOK = Bring Your Own Key）
 * ManhuaWorks · W2 创作者工作台
 *
 * 后端：user-service 服务的 api_keys 表（通过 api-gateway :8080 /v1/users 代理）
 * 加密：后端用 AES-256-GCM 加密存储（参考 schema.ts: apiKeys.keyEncrypted/keyIv）
 *
 * 4 家供应商：openai / anthropic / google / stability
 */

import axios, { type AxiosInstance } from 'axios'
import type { Provider } from './ai-router'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** Key 健康状态 */
export type KeyStatus = 'valid' | 'expiring' | 'invalid' | 'unset' | 'unknown'

/** API Key 记录（脱敏展示） */
export interface ByokKey {
  id: string
  provider: Provider
  /** 用户自定义别名 */
  keyAlias: string
  /** 脱敏后的 Key（sk-***ab12） */
  maskedKey: string
  status: KeyStatus
  /** 上次使用时间 */
  lastUsedAt: string | null
  createdAt: string
  /** 距过期天数（如果 provider 支持 key 过期） */
  expiresInDays?: number
}

/** 测试连通性结果 */
export interface KeyTestResult {
  ok: boolean
  status: KeyStatus
  /** 延迟 ms */
  latencyMs: number
  /** 错误信息 */
  error?: string
  /** 余额/限额（如果 provider 返回） */
  quota?: {
    used: number
    total: number
    unit: 'USD' | 'tokens' | 'images'
  }
}

/** 创建 Key 请求 */
export interface CreateKeyRequest {
  provider: Provider
  keyAlias: string
  /** 原始 Key（明文，仅传输一次） */
  apiKey: string
}

export interface CreateKeyResponse {
  id: string
  maskedKey: string
  status: KeyStatus
}

/* ------------------------------------------------------------------ */
/*                            API 客户端                                */
/* ------------------------------------------------------------------ */

const BASE = '/v1/users/api-keys'

function getToken(): string | null {
  try { return localStorage.getItem('token') } catch { return null }
}

const client: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' }
})

client.interceptors.request.use((cfg) => {
  const token = getToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

function unwrap<T>(res: unknown): T {
  const body = res as { data: { code: number; data: T; message: string } }
  if (body?.data?.code !== 0) {
    throw new Error(body?.data?.message ?? '请求失败')
  }
  return body.data.data
}

/* -------- 业务接口 -------- */

/** 列出当前用户的所有 API Key（脱敏） */
export async function listKeys(): Promise<ByokKey[]> {
  const res = await client.get('/')
  return unwrap<ByokKey[]>(res)
}

/** 新增 API Key（明文 key 仅传输一次） */
export async function createKey(req: CreateKeyRequest): Promise<CreateKeyResponse> {
  const res = await client.post('/', req)
  return unwrap<CreateKeyResponse>(res)
}

/** 删除 API Key */
export async function deleteKey(id: string): Promise<{ deleted: boolean }> {
  const res = await client.delete(`/${id}`)
  return unwrap<{ deleted: boolean }>(res)
}

/** 测试 Key 连通性（调 provider 试 ping 接口） */
export async function testKey(id: string): Promise<KeyTestResult> {
  const res = await client.post(`/${id}/test`)
  return unwrap<KeyTestResult>(res)
}

/** 重命名 Key 别名 */
export async function renameKey(id: string, keyAlias: string): Promise<{ id: string; keyAlias: string }> {
  const res = await client.patch(`/${id}`, { key_alias: keyAlias })
  return unwrap<{ id: string; keyAlias: string }>(res)
}

/* ------------------------------------------------------------------ */
/*                          工具函数                                    */
/* ------------------------------------------------------------------ */

/** 脱敏展示：sk-proj-...-xyz123 → sk-***-xyz123 */
export function maskKey(raw: string, provider: Provider): string {
  if (!raw) return ''
  // 大部分 provider 的 key 都有固定前缀
  const prefix =
    provider === 'openai' ? 'sk-' :
    provider === 'anthropic' ? 'sk-ant-' :
    provider === 'google' ? 'AIza' :
    provider === 'stability' ? 'sk-' :
    ''
  const tail = raw.slice(-4)
  if (prefix && raw.startsWith(prefix)) {
    return `${prefix}***${tail}`
  }
  return `***${tail}`
}

/** 本地校验：粗略判断 key 格式 */
export function validateKeyFormat(provider: Provider, raw: string): { ok: boolean; reason?: string } {
  if (!raw || raw.length < 10) {
    return { ok: false, reason: 'Key 长度太短（至少 10 字符）' }
  }
  if (provider === 'openai' && !raw.startsWith('sk-')) {
    return { ok: false, reason: 'OpenAI Key 应以 "sk-" 开头' }
  }
  if (provider === 'anthropic' && !raw.startsWith('sk-ant-')) {
    return { ok: false, reason: 'Anthropic Key 应以 "sk-ant-" 开头' }
  }
  if (provider === 'google' && !raw.startsWith('AIza')) {
    return { ok: false, reason: 'Google Key 应以 "AIza" 开头' }
  }
  if (provider === 'stability' && !raw.startsWith('sk-')) {
    return { ok: false, reason: 'Stability Key 应以 "sk-" 开头' }
  }
  return { ok: true }
}

/** Key 状态对应的颜色变量名 */
export function keyStatusVar(status: KeyStatus): string {
  switch (status) {
    case 'valid': return '--success'
    case 'expiring': return '--warning'
    case 'invalid': return '--danger'
    case 'unset': return '--text-secondary'
    case 'unknown':
    default: return '--text-secondary'
  }
}

/** Key 状态显示文本 */
export function keyStatusText(status: KeyStatus): string {
  switch (status) {
    case 'valid': return '有效'
    case 'expiring': return '即将过期'
    case 'invalid': return '无效'
    case 'unset': return '未设置'
    case 'unknown':
    default: return '未知'
  }
}
