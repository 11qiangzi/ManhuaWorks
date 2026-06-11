/**
 * ManhuaWorks · W5 任务 6.6
 *
 * 负载测试：5 服务 50 并发 + 错误率 < 1%
 *
 * @author 陈远枢
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { newTraceId, tracedFetch } from './helpers/trace-collector'
import { setupIntegration, teardownIntegration } from './setup'

let integration: Awaited<ReturnType<typeof setupIntegration>>

beforeAll(async () => {
  integration = await setupIntegration()
}, 60_000)

afterAll(async () => {
  await teardownIntegration()
}, 30_000)

/* ==================== 负载配置 ==================== */

const CONCURRENCY = 50
const TARGET_ERROR_RATE = 0.01 // 1%
const RAMP_UP_MS = 5_000

interface LoadResult {
  total: number
  success: number
  failed: number
  errorRate: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  rps: number
  durationMs: number
}

/* ==================== 并发执行 ==================== */

async function runConcurrent(
  baseUrl: string,
  path: string,
  n: number,
): Promise<LoadResult> {
  const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
  const traceId = newTraceId()

  const start = Date.now()
  const latencies: number[] = []
  let success = 0
  let failed = 0

  // 错峰启动（ramp-up）
  const tasks: Array<Promise<void>> = []
  for (let i = 0; i < n; i += 1) {
    const delay = (i / n) * RAMP_UP_MS
    tasks.push(
      (async () => {
        await new Promise((r) => setTimeout(r, delay))
        const t0 = Date.now()
        try {
          const res = await tracedFetch(
            `${baseUrl}${path}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
              body: JSON.stringify({ prompt: `load-test-${i}`, mode: 'fast' }),
            },
            { service: 'ai-router', traceId, collector: integration.trace },
          )
          latencies.push(Date.now() - t0)
          if (res.ok) success += 1
          else failed += 1
        } catch {
          failed += 1
        }
      })(),
    )
  }

  await Promise.all(tasks)
  const durationMs = Date.now() - start

  latencies.sort((a, b) => a - b)
  const p = (q: number) => latencies[Math.min(Math.floor(latencies.length * q), latencies.length - 1)] ?? 0

  return {
    total: n,
    success,
    failed,
    errorRate: failed / n,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
    p99Ms: p(0.99),
    maxMs: latencies[latencies.length - 1] ?? 0,
    rps: (n / durationMs) * 1000,
    durationMs,
  }
}

/* ==================== Tests ==================== */

describe('load · 5 services × 50 concurrent (error rate < 1%)', () => {
  it('ai-router handles 50 concurrent with < 1% error', async () => {
    const r = await runConcurrent(
      integration.services['ai-router'].baseUrl,
      '/v1/drama/run',
      CONCURRENCY,
    )
    console.log('[test-debug][load] ai-router', r)
    expect(r.errorRate).toBeLessThan(TARGET_ERROR_RATE)
    expect(r.p95Ms).toBeLessThan(5_000)
  }, 60_000)

  it('ai-keys handles 50 concurrent reads with < 1% error', async () => {
    const r = await runConcurrent(
      integration.services['ai-keys'].baseUrl,
      '/v1/keys/list',
      CONCURRENCY,
    )
    console.log('[test-debug][load] ai-keys', r)
    expect(r.errorRate).toBeLessThan(TARGET_ERROR_RATE)
  }, 60_000)

  it('workflow-engine handles 50 concurrent with < 1% error', async () => {
    const r = await runConcurrent(
      integration.services['workflow-engine'].baseUrl,
      '/v1/workflows/list',
      CONCURRENCY,
    )
    console.log('[test-debug][load] workflow-engine', r)
    expect(r.errorRate).toBeLessThan(TARGET_ERROR_RATE)
  }, 60_000)

  it('asset-service handles 50 concurrent with < 1% error', async () => {
    const r = await runConcurrent(
      integration.services['asset-service'].baseUrl,
      '/v1/assets/list',
      CONCURRENCY,
    )
    console.log('[test-debug][load] asset-service', r)
    expect(r.errorRate).toBeLessThan(TARGET_ERROR_RATE)
  }, 60_000)

  it('ai-orchestrator handles 50 concurrent with < 1% error', async () => {
    const r = await runConcurrent(
      integration.services['ai-orchestrator'].baseUrl,
      '/v1/tasks/list',
      CONCURRENCY,
    )
    console.log('[test-debug][load] ai-orchestrator', r)
    expect(r.errorRate).toBeLessThan(TARGET_ERROR_RATE)
  }, 60_000)
})
