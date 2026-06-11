/**
 * ManhuaWorks · 集成测试 trace 收集器
 *
 * 用途：
 *  - 跨 5 服务追踪 trace_id 透传
 *  - 收集每次 fetch 的 span（服务 + 路径 + 耗时 + 状态）
 *  - 验证 trace 完整性：5 服务全链路 trace_id 一致
 *
 * 复用 W4 mock-providers 的 setTimeout 模式，纯离线。
 *
 * @author 钟帧
 * @updated 2026-06-08
 */

import { nanoid } from 'nanoid'

export interface TraceSpan {
  service: string
  method: string
  path: string
  status: number
  latencyMs: number
  traceId: string
  spanId: string
  parentSpanId?: string
  startedAt: number
  endedAt: number
  error?: string
}

export interface CollectedTrace {
  traceId: string
  spans: TraceSpan[]
  startedAt: number
  endedAt: number
  totalLatencyMs: number
  serviceChain: string[]
}

/* ==================== Trace ID 生成 ==================== */

export function newTraceId(): string {
  return `tr-${nanoid(16)}`
}

export function newSpanId(): string {
  return `sp-${nanoid(10)}`
}

/* ==================== Trace 收集器 ==================== */

export class TraceCollector {
  private traces = new Map<string, CollectedTrace>()

  /**
   * 开始一个新 trace
   */
  start(traceId = newTraceId()): string {
    if (this.traces.has(traceId)) {
      return traceId
    }
    this.traces.set(traceId, {
      traceId,
      spans: [],
      startedAt: Date.now(),
      endedAt: 0,
      totalLatencyMs: 0,
      serviceChain: [],
    })
    return traceId
  }

  /**
   * 记录一个 span
   */
  addSpan(span: TraceSpan): void {
    const trace = this.traces.get(span.traceId)
    if (!trace) {
      this.start(span.traceId)
    }
    const t = this.traces.get(span.traceId)!
    t.spans.push(span)
    if (!t.serviceChain.includes(span.service)) {
      t.serviceChain.push(span.service)
    }
  }

  /**
   * 结束 trace
   */
  end(traceId: string): CollectedTrace | undefined {
    const trace = this.traces.get(traceId)
    if (!trace) return undefined
    trace.endedAt = Date.now()
    trace.totalLatencyMs = trace.endedAt - trace.startedAt
    return trace
  }

  /**
   * 取出 trace
   */
  get(traceId: string): CollectedTrace | undefined {
    return this.traces.get(traceId)
  }

  /**
   * 全部 trace
   */
  all(): CollectedTrace[] {
    return Array.from(this.traces.values())
  }

  /**
   * 清空
   */
  reset(): void {
    this.traces.clear()
  }

  /**
   * 验证 trace 完整性：5 服务全链路 trace_id 一致
   */
  validateFullChain(traceId: string, expectedServices: string[]): {
    ok: boolean
    missing: string[]
    extras: string[]
  } {
    const trace = this.traces.get(traceId)
    if (!trace) {
      return { ok: false, missing: expectedServices, extras: [] }
    }
    const actual = new Set(trace.serviceChain)
    const missing = expectedServices.filter((s) => !actual.has(s))
    const extras = trace.serviceChain.filter((s) => !expectedServices.includes(s))
    return { ok: missing.length === 0, missing, extras }
  }
}

/* ==================== 带 trace 的 fetch 包装 ==================== */

export interface TracedFetchOptions {
  service: string
  traceId: string
  parentSpanId?: string
  method?: string
  path?: string
}

/**
 * 封装 fetch，自动注入 trace header + 记录 span
 */
export async function tracedFetch(
  url: string,
  init: RequestInit = {},
  ctx: TracedFetchOptions & { collector: TraceCollector },
): Promise<Response> {
  const { service, traceId, parentSpanId, collector, method, path } = ctx
  const spanId = newSpanId()
  const startedAt = Date.now()

  // 注入 trace header
  const headers = new Headers(init.headers)
  headers.set('x-trace-id', traceId)
  headers.set('x-span-id', spanId)
  if (parentSpanId) headers.set('x-parent-span-id', parentSpanId)

  const actualMethod = (init.method ?? 'GET').toUpperCase()
  const actualPath = path ?? new URL(url).pathname

  try {
    const res = await fetch(url, { ...init, headers })
    const endedAt = Date.now()
    collector.addSpan({
      service,
      method: actualMethod,
      path: actualPath,
      status: res.status,
      latencyMs: endedAt - startedAt,
      traceId,
      spanId,
      parentSpanId,
      startedAt,
      endedAt,
    })
    return res
  } catch (err) {
    const endedAt = Date.now()
    collector.addSpan({
      service,
      method: actualMethod,
      path: actualPath,
      status: 0,
      latencyMs: endedAt - startedAt,
      traceId,
      spanId,
      parentSpanId,
      startedAt,
      endedAt,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
