/**
 * ManhuaWorks · 4 个 Mock AI Provider + 测试辅助函数
 *
 * 目的：
 *  - 让 e2e / 单测完全脱离真实 AI 调用（省钱、稳、可重放）
 *  - 行为可预测：相同输入 → 相同输出
 *  - 可注入失败/超时/不稳定 用于压测错误恢复
 *
 * 4 个 Provider 对齐真实 ai-orchestrator 接口：
 *  1. MockLLMProvider     — 大模型（剧本拆解 / 风格提示）
 *  2. MockImageProvider   — 图像生成（Midjourney 替代）
 *  3. MockVideoProvider   — 视频生成（Runway 替代）
 *  4. MockTTSProvider     — 文字转语音（ElevenLabs 替代）
 *
 * 辅助：
 *  - makeRequest / makeAppRequest   对 Hono app 直接 fetch，绕开端口
 *  - makeWSClient                   模拟 WS 客户端（不依赖真实服务）
 *  - makeDbMock                     Drizzle 风格的 in-memory mock
 *  - signTestJwt / authHeader       鉴权 token 工厂
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { vi } from 'vitest'
import { setTimeout as sleep } from 'node:timers/promises'

/* ==================== 类型定义 ==================== */

export interface LLMRequest {
  prompt: string
  model?: 'gpt-4o' | 'claude-3.5' | 'gemini-pro'
  temperature?: number
  maxTokens?: number
  jsonSchema?: Record<string, unknown>
}

export interface LLMResponse {
  content: string
  parsed?: unknown
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  finishReason: 'stop' | 'length' | 'error'
}

export interface ImageGenRequest {
  prompt: string
  width: number
  height: number
  styleRef?: string[]
  seed?: number
}

export interface ImageGenResponse {
  images: Array<{ url: string; width: number; height: number; seed: number }>
  costCents: number
}

export interface VideoGenRequest {
  imageUrl: string
  prompt: string
  durationSec: number
  fps: number
}

export interface VideoGenResponse {
  videoUrl: string
  durationSec: number
  costCents: number
}

export interface TTSRequest {
  text: string
  voiceId: string
  speed?: number
}

export interface TTSResponse {
  audioUrl: string
  durationSec: number
  costCents: number
}

export type ProviderState = 'ok' | 'flaky' | 'fail' | 'timeout'

/* ==================== 1. Mock LLM ==================== */

export class MockLLMProvider {
  state: ProviderState = 'ok'
  fixedResponse?: LLMResponse
  callCount = 0

  async chat(req: LLMRequest): Promise<LLMResponse> {
    this.callCount += 1
    await this.simulateLatency()

    if (this.state === 'fail') throw new Error('mock-llm: simulated failure')
    if (this.state === 'timeout') await sleep(60_000)

    if (this.fixedResponse) {
      return { ...this.fixedResponse, usage: this.fixedResponse.usage }
    }

    const content = this.heuristicScript(req.prompt)
    // 默认尝试解析 JSON（当 prompt 看起来是 JSON 模式时）
    let parsed: unknown = undefined
    if (req.jsonSchema) {
      parsed = JSON.parse(content)
    } else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        parsed = JSON.parse(content)
      } catch {
        parsed = undefined
      }
    }

    return {
      content,
      parsed,
      usage: {
        promptTokens: Math.ceil(req.prompt.length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: 0,
      },
      finishReason: 'stop',
    }
  }

  private heuristicScript(prompt: string): string {
    if (prompt.includes('拆') || prompt.includes('scene')) {
      return JSON.stringify({
        scenes: [
          { index: 1, title: '开场：星际船舱', narration: '纪元 1207 年。她在近地轨道醒来。', shot: { type: 'wide', subject: '苏眀' } },
          { index: 2, title: '窗外的恒星', narration: '4 颗太阳挂在舷窗外。', shot: { type: 'pan', subject: 'space' } },
          { index: 3, title: '任务下达', narration: '指挥中心发来指令。', shot: { type: 'medium', subject: '苏眀' } },
          { index: 4, title: '准备出发', narration: '她深吸一口气。', shot: { type: 'closeup', subject: '苏眀' } },
          { index: 5, title: '跳跃', narration: '引擎轰鸣，跃入虚空。', shot: { type: 'wide', subject: 'ship' } },
        ],
      })
    }
    if (prompt.includes('summary') || prompt.includes('摘要')) {
      return '本章讲述苏眀在近地轨道醒来，收到首次远航任务。'
    }
    return `Mock response for: ${prompt.slice(0, 60)}...`
  }

  private async simulateLatency(): Promise<void> {
    if (this.state === 'flaky') {
      if (Math.random() < 0.3) await sleep(150)
    } else {
      await sleep(10)
    }
  }

  reset(): void {
    this.state = 'ok'
    this.fixedResponse = undefined
    this.callCount = 0
  }
}

/* ==================== 2. Mock Image ==================== */

export class MockImageProvider {
  state: ProviderState = 'ok'
  callCount = 0
  imagesPerCall = 1

  async generate(req: ImageGenRequest): Promise<ImageGenResponse> {
    this.callCount += 1
    await sleep(20)
    if (this.state === 'fail') throw new Error('mock-image: simulated failure')
    if (this.state === 'timeout') await sleep(60_000)

    const seed = req.seed ?? 42
    return {
      images: Array.from({ length: this.imagesPerCall }, (_, i) => ({
        url: `https://mock-cdn.manhuaworks.com/img/${seed}_${i}.png`,
        width: req.width,
        height: req.height,
        seed: seed + i,
      })),
      costCents: Math.ceil((req.width * req.height) / 10_000),
    }
  }

  reset(): void {
    this.state = 'ok'
    this.callCount = 0
    this.imagesPerCall = 1
  }
}

/* ==================== 3. Mock Video ==================== */

export class MockVideoProvider {
  state: ProviderState = 'ok'
  callCount = 0
  failAtCall?: number

  async generate(req: VideoGenRequest): Promise<VideoGenResponse> {
    this.callCount += 1
    await sleep(50)
    if (this.failAtCall && this.callCount === this.failAtCall) {
      throw new Error('mock-video: failed at configured call')
    }
    if (this.state === 'fail') throw new Error('mock-video: simulated failure')

    return {
      videoUrl: `https://mock-cdn.manhuaworks.com/video/${Date.now()}_${this.callCount}.mp4`,
      durationSec: req.durationSec,
      costCents: req.durationSec * 50,
    }
  }

  reset(): void {
    this.state = 'ok'
    this.callCount = 0
    this.failAtCall = undefined
  }
}

/* ==================== 4. Mock TTS ==================== */

export class MockTTSProvider {
  state: ProviderState = 'ok'
  callCount = 0

  async synthesize(req: TTSRequest): Promise<TTSResponse> {
    this.callCount += 1
    await sleep(15)
    if (this.state === 'fail') throw new Error('mock-tts: simulated failure')

    const durationSec = Math.max(1, Math.ceil(req.text.length / 4))
    return {
      audioUrl: `https://mock-cdn.manhuaworks.com/audio/${Date.now()}.mp3`,
      durationSec: durationSec / (req.speed ?? 1),
      costCents: Math.ceil(durationSec * 5),
    }
  }

  reset(): void {
    this.state = 'ok'
    this.callCount = 0
  }
}

/* ==================== 工厂：单例 ==================== */

export const mockLLM = new MockLLMProvider()
export const mockImage = new MockImageProvider()
export const mockVideo = new MockVideoProvider()
export const mockTTS = new MockTTSProvider()

/** 在 beforeEach 中重置所有 mock */
export function resetAllProviders(): void {
  mockLLM.reset()
  mockImage.reset()
  mockVideo.reset()
  mockTTS.reset()
}

/* ==================== Hono 测试辅助 ==================== */

/** 构造 Hono fetch 测试用 Request */
export function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return new Request(url, init)
}

/** 对 Hono app 直接 fetch，绕开 listen */
export async function makeAppRequest(
  app: { fetch: (req: Request) => Promise<Response> },
  req: Request,
): Promise<Response> {
  return app.fetch(req)
}

/** JSON 解析器（带类型守卫） */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

/* ==================== 鉴权 token 工厂 ==================== */

const TEST_JWT_SECRET = 'test-secret'

/** 用 HMAC-SHA256 签一个测试 JWT（对齐 collab-service 的 verifyJwt） */
export function signTestJwt(payload: { sub: string; role?: string; exp?: number }): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const fullPayload = {
    sub: payload.sub,
    role: payload.role ?? 'editor',
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 3600,
  }
  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerB64 = b64(header)
  const payloadB64 = b64(fullPayload)
  const data = `${headerB64}.${payloadB64}`

  const crypto = require('node:crypto') as typeof import('node:crypto')
  const sig = crypto.createHmac('sha256', TEST_JWT_SECRET).update(data).digest('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${data}.${sig}`
}

export { TEST_JWT_SECRET }

/* ==================== DB Mock ==================== */

/**
 * 极简 in-memory DB mock（用于替换 drizzle-orm 真实连接）
 */
export interface InMemoryDB {
  _tables: Record<string, Array<Record<string, unknown>>>
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

export function makeDbMock(tables: string[] = []): InMemoryDB {
  const _tables: Record<string, Array<Record<string, unknown>>> = {}
  for (const t of tables) _tables[t] = []

  return {
    _tables,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

/* ==================== WebSocket 模拟 ==================== */

export interface MockWSClient {
  sentFrames: unknown[]
  receivedFrames: unknown[]
  send: (frame: unknown) => void
  on: (cb: (frame: unknown) => void) => void
  close: () => void
  emit: (frame: unknown) => void
  history: () => unknown[]
}

/** 模拟 WS 客户端，不依赖真实端口 */
export function makeWSClient(): MockWSClient {
  let receiver: ((frame: unknown) => void) | null = null
  const sentFrames: unknown[] = []
  const receivedFrames: unknown[] = []
  return {
    sentFrames,
    receivedFrames,
    send(frame) {
      sentFrames.push(frame)
    },
    on(cb) {
      receiver = cb
    },
    close() {
      receiver = null
    },
    emit(frame) {
      receivedFrames.push(frame)
      if (receiver) receiver(frame)
    },
    history() {
      return [...sentFrames, ...receivedFrames]
    },
  }
}

/* ==================== 异步工具 ==================== */

export const wait = sleep

/** 轮询直到条件满足 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 5000, intervalMs = 50 } = options
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return
    await sleep(intervalMs)
  }
  throw new Error(`waitFor: timeout after ${timeoutMs}ms`)
}

/* ==================== 鉴权头工厂 ==================== */

export function authHeader(userId: string, role: 'admin' | 'editor' | 'viewer' = 'editor'): Record<string, string> {
  const token = signTestJwt({ sub: userId, role })
  return { Authorization: `Bearer ${token}` }
}

/* ==================== UUID 工具 ==================== */

let _idCounter = 0
export function nextId(prefix = 'id'): string {
  _idCounter += 1
  return `${prefix}_${_idCounter.toString(36)}_${Date.now().toString(36)}`
}
