/**
 * ai-router API 客户端
 * ManhuaWorks · W2 创作者工作台
 *
 * 后端：ai-orchestrator 服务（通过 api-gateway :8080 /v1/ai 代理）
 * 鉴权：Bearer JWT（从 localStorage 读）
 *
 * 4 家供应商统一调用：openai / anthropic / google / stability
 * 路由层做：负载均衡 / 故障转移 / 成本计算 / 限流
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

/** AI 服务供应商 */
export type Provider = 'openai' | 'anthropic' | 'google' | 'stability'

/** 调用类型 */
export type CallType = 'text' | 'image' | 'video' | 'embed'

/** 供应商元数据 */
export interface ProviderMeta {
  id: Provider
  name: string
  logo: string
  /** 输入价 (USD/1K tokens)，文字模型 */
  inputPricePer1k: number
  /** 输出价 (USD/1K tokens)，文字模型 */
  outputPricePer1k: number
  /** 图片价 (USD/张) */
  imagePricePerUnit?: number
  /** 视频价 (USD/秒) */
  videoPricePerSecond?: number
  /** 平均延迟 (ms) */
  avgLatencyMs: number
  /** 质量评分 0-100 */
  qualityScore: number
  /** 是否默认启用 */
  enabled: boolean
}

/** 单个模型 */
export interface ModelMeta {
  id: string
  provider: Provider
  name: string
  /** 支持的调用类型 */
  capabilities: CallType[]
  /** 上下文长度 (tokens) */
  contextLength: number
  /** 输入价 USD/1k */
  inputPricePer1k: number
  /** 输出价 USD/1k */
  outputPricePer1k: number
  /** 描述 */
  description: string
}

/** 4 供应商 + 主流模型 — 静态元数据 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🟢',
    inputPricePer1k: 0.0025,
    outputPricePer1k: 0.01,
    imagePricePerUnit: 0.04,
    avgLatencyMs: 1200,
    qualityScore: 92,
    enabled: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '🟣',
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    avgLatencyMs: 1500,
    qualityScore: 95,
    enabled: true
  },
  {
    id: 'google',
    name: 'Google AI',
    logo: '🔵',
    inputPricePer1k: 0.001,
    outputPricePer1k: 0.002,
    imagePricePerUnit: 0.02,
    avgLatencyMs: 800,
    qualityScore: 88,
    enabled: true
  },
  {
    id: 'stability',
    name: 'Stability AI',
    logo: '🟡',
    inputPricePer1k: 0.002,
    outputPricePer1k: 0.002,
    imagePricePerUnit: 0.03,
    avgLatencyMs: 3000,
    qualityScore: 85,
    enabled: true
  }
]

export const MODELS: ModelMeta[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    capabilities: ['text', 'image'],
    contextLength: 128000,
    inputPricePer1k: 0.0025,
    outputPricePer1k: 0.01,
    description: '多模态旗舰 · 速度快 · 性价比高'
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o mini',
    capabilities: ['text'],
    contextLength: 128000,
    inputPricePer1k: 0.00015,
    outputPricePer1k: 0.0006,
    description: '轻量快速 · 适合续写/改稿'
  },
  {
    id: 'dall-e-3',
    provider: 'openai',
    name: 'DALL·E 3',
    capabilities: ['image'],
    contextLength: 0,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    description: '高质量图片生成 · 1024×1024 起'
  },
  {
    id: 'claude-3.5-sonnet',
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    capabilities: ['text'],
    contextLength: 200000,
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    description: '长文写作首选 · 文学性强'
  },
  {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    name: 'Claude 3 Haiku',
    capabilities: ['text'],
    contextLength: 200000,
    inputPricePer1k: 0.00025,
    outputPricePer1k: 0.00125,
    description: '快速 · 便宜 · 短文本专用'
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    name: 'Gemini 1.5 Pro',
    capabilities: ['text', 'image', 'video'],
    contextLength: 1000000,
    inputPricePer1k: 0.00125,
    outputPricePer1k: 0.005,
    description: '超长上下文 · 多模态'
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    name: 'Gemini 1.5 Flash',
    capabilities: ['text', 'image'],
    contextLength: 1000000,
    inputPricePer1k: 0.000075,
    outputPricePer1k: 0.0003,
    description: '极速 · 超便宜 · 日常任务'
  },
  {
    id: 'stable-diffusion-3',
    provider: 'stability',
    name: 'SD 3 Large',
    capabilities: ['image'],
    contextLength: 0,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    description: '开源底模 · 风格化能力强'
  }
]

/** 单步生成结果 */
export interface GenerationStep {
  step: string
  status: 'pending' | 'running' | 'done' | 'failed'
  startedAt?: string
  finishedAt?: string
  message?: string
}

/** 实时进度事件（WebSocket） */
export interface ProgressEvent {
  jobId: string
  /** 0-100 */
  progress: number
  /** 当前步骤索引 */
  currentStep: number
  /** 总步骤数 */
  totalSteps: number
  /** 步骤状态 */
  steps: GenerationStep[]
  /** 当前步骤的日志 */
  log?: string
  /** 已用成本 (USD) */
  costUsd: number
  /** 整体状态 */
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  error?: string
  /** 生成产物（成功后才有） */
  outputs?: {
    images?: string[]
    texts?: string[]
    videos?: string[]
  }
}

/** 启动生成任务 */
export interface CreateJobRequest {
  projectId: string
  callType: CallType
  /** 选用的供应商（不指定则由路由自动选） */
  provider?: Provider
  /** 选用的模型 */
  model: string
  /** 小说文本 / 提示词 */
  prompt: string
  /** 风格提示词（可选） */
  stylePrompt?: string
  /** 期望产物数（图片/视频） */
  count?: number
}

export interface CreateJobResponse {
  jobId: string
  /** WebSocket URL，订阅实时进度 */
  wsUrl: string
  /** 预估成本 (USD) */
  estimatedCostUsd: number
}

/** 成本估算请求 */
export interface CostEstimateRequest {
  provider: Provider
  model: string
  inputTokens: number
  outputTokens: number
  /** 图片数（仅 image 类型） */
  imageCount?: number
  /** 视频秒数（仅 video 类型） */
  videoSeconds?: number
}

export interface CostEstimateResponse {
  costUsd: number
  breakdown: {
    inputCost: number
    outputCost: number
    imageCost: number
    videoCost: number
  }
}

/** 故障转移状态 */
export interface FailoverStatus {
  primary: Provider
  primaryHealthy: boolean
  fallbacks: Array<{
    provider: Provider
    healthy: boolean
    latencyMs: number
  }>
  /** 24h 内的故障切换次数 */
  failoverCount24h: number
  /** 24h 内主 provider 故障率 */
  primaryErrorRate: number
}

/* ------------------------------------------------------------------ */
/*                            API 客户端                                */
/* ------------------------------------------------------------------ */

const BASE = '/v1/ai'

function getToken(): string | null {
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
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

client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      // token 失效：清掉本地、跳登录
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } catch { /* noop */ }
    }
    return Promise.reject(err)
  }
)

/** 解包 {code, message, data} 格式 */
function unwrap<T>(res: unknown): T {
  const body = res as { data: { code: number; data: T; message: string } }
  if (body?.data?.code !== 0) {
    throw new Error(body?.data?.message ?? '请求失败')
  }
  return body.data.data
}

/* -------- 业务接口 -------- */

/** 启动生成任务 */
export async function createJob(req: CreateJobRequest): Promise<CreateJobResponse> {
  const res = await client.post('/jobs', req)
  return unwrap<CreateJobResponse>(res)
}

/** 取消生成任务 */
export async function cancelJob(jobId: string): Promise<{ cancelled: boolean }> {
  const res = await client.post(`/jobs/${jobId}/cancel`)
  return unwrap<{ cancelled: boolean }>(res)
}

/** 查询任务最终结果（轮询用） */
export async function getJobResult(jobId: string): Promise<ProgressEvent> {
  const res = await client.get(`/jobs/${jobId}`)
  return unwrap<ProgressEvent>(res)
}

/** 成本估算 */
export async function estimateCost(req: CostEstimateRequest): Promise<CostEstimateResponse> {
  const res = await client.post('/estimate', req)
  return unwrap<CostEstimateResponse>(res)
}

/** 故障转移状态 */
export async function getFailoverStatus(): Promise<FailoverStatus> {
  const res = await client.get('/failover/status')
  return unwrap<FailoverStatus>(res)
}

/** 健康检查（公开，无需鉴权） */
export async function ping(): Promise<{ ok: boolean; service: string }> {
  const res = await axios.get('/v1/ai/ping', { timeout: 5000 })
  return res.data
}

/* ------------------------------------------------------------------ */
/*                          WebSocket 客户端                            */
/* ------------------------------------------------------------------ */

/**
 * 订阅实时进度
 * @param jobId 任务 ID
 * @param onEvent 事件回调
 * @returns unsubscribe
 */
export function subscribeProgress(
  jobId: string,
  onEvent: (ev: ProgressEvent) => void,
  onError?: (err: Event) => void
): () => void {
  // 1) 计算 WS URL：把 http(s) 替换成 ws(s)
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const token = getToken() ?? ''
  const wsUrl = `${proto}://${window.location.host}${BASE}/jobs/${jobId}/ws?token=${encodeURIComponent(token)}`

  let ws: WebSocket | null = null
  let closed = false
  let retryCount = 0
  let retryTimer: number | null = null

  function connect() {
    if (closed) return
    try {
      ws = new WebSocket(wsUrl)
    } catch (err) {
      console.error('[ai-router] WebSocket 构造失败', err)
      onError?.(err as Event)
      scheduleRetry()
      return
    }

    ws.onmessage = (msg) => {
      try {
        const ev: ProgressEvent = JSON.parse(msg.data)
        onEvent(ev)
      } catch (err) {
        console.warn('[ai-router] WS 消息解析失败', err)
      }
    }

    ws.onerror = (err) => {
      onError?.(err)
    }

    ws.onclose = () => {
      if (closed) return
      scheduleRetry()
    }
  }

  function scheduleRetry() {
    if (closed) return
    retryCount += 1
    // 指数退避：1s / 2s / 4s / 8s，上限 30s
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryCount - 1, 4))
    retryTimer = window.setTimeout(connect, delay)
  }

  connect()

  return function unsubscribe() {
    closed = true
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
    if (ws) {
      try { ws.close() } catch { /* noop */ }
      ws = null
    }
  }
}

/* ------------------------------------------------------------------ */
/*                          纯函数：本地计算                            */
/* ------------------------------------------------------------------ */

/** 本地成本计算（无需后端） */
export function localEstimate(req: CostEstimateRequest): CostEstimateResponse {
  const m = MODELS.find((x) => x.id === req.model)
  const p = PROVIDERS.find((x) => x.id === req.provider)
  const inputPrice = m?.inputPricePer1k ?? p?.inputPricePer1k ?? 0
  const outputPrice = m?.outputPricePer1k ?? p?.outputPricePer1k ?? 0
  const imgPrice = p?.imagePricePerUnit ?? 0
  const vidPrice = p?.videoPricePerSecond ?? 0
  const inputCost = (req.inputTokens / 1000) * inputPrice
  const outputCost = (req.outputTokens / 1000) * outputPrice
  const imageCost = (req.imageCount ?? 0) * imgPrice
  const videoCost = (req.videoSeconds ?? 0) * vidPrice
  return {
    costUsd: inputCost + outputCost + imageCost + videoCost,
    breakdown: { inputCost, outputCost, imageCost, videoCost }
  }
}

/** 估算文本 token 数（粗略：英文 ~ 4 字符/token，中文 ~ 1.5 字符/token） */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const cnChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const enChars = text.length - cnChars
  return Math.ceil(cnChars / 1.5 + enChars / 4)
}
