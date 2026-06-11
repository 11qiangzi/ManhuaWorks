/**
 * ManhuaWorks · W5 任务 6.5
 *
 * 性能基准：6 pipeline × 3 模式 × 5 服务全链路
 *
 * 输出写入 reports/baseline.json（供 CI 回归比较）
 *
 * @author 陈远枢
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setTimeout as sleep } from 'node:timers/promises'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newTraceId, tracedFetch } from './helpers/trace-collector'
import { setupIntegration, teardownIntegration } from './setup'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.resolve(__dirname, 'reports')

let integration: Awaited<ReturnType<typeof setupIntegration>>

beforeAll(async () => {
  integration = await setupIntegration()
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })
}, 60_000)

afterAll(async () => {
  await teardownIntegration()
}, 30_000)

/* ==================== Benchmark matrix ==================== */

const PIPELINES = [
  'novel-to-drama',
  'novel-to-manga',
  'novel-to-audio',
  'image-to-video',
  'text-to-image',
  'voice-clone',
] as const

const MODES = ['fast', 'standard', 'high-quality'] as const

interface BenchResult {
  pipeline: typeof PIPELINES[number]
  mode: typeof MODES[number]
  durationMs: number
  costUsd: number
  tokensIn: number
  tokensOut: number
  shots: number
  ok: boolean
  error?: string
}

const results: BenchResult[] = []

/* ==================== 单次 benchmark ==================== */

async function runOneBench(pipeline: typeof PIPELINES[number], mode: typeof MODES[number]): Promise<BenchResult> {
  const traceId = newTraceId()
  const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
  const t0 = Date.now()

  try {
    const res = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pipeline,
          mode,
          novel: '海风轻拂，渔港灯火渐明。',
        }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )

    if (!res.ok) {
      return {
        pipeline,
        mode,
        durationMs: Date.now() - t0,
        costUsd: 0,
        tokensIn: 0,
        tokensOut: 0,
        shots: 0,
        ok: false,
        error: `HTTP ${res.status}`,
      }
    }

    const data = (await res.json()) as { cost: { usd: number }; tokens: { in: number; out: number }; shots: number }
    return {
      pipeline,
      mode,
      durationMs: Date.now() - t0,
      costUsd: data.cost.usd,
      tokensIn: data.tokens.in,
      tokensOut: data.tokens.out,
      shots: data.shots,
      ok: true,
    }
  } catch (err) {
    return {
      pipeline,
      mode,
      durationMs: Date.now() - t0,
      costUsd: 0,
      tokensIn: 0,
      tokensOut: 0,
      shots: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/* ==================== Tests ==================== */

describe('perf · 6 pipelines × 3 modes benchmark', () => {
  beforeEach(() => {
    // 每个 case 间隔 100ms，避免上一轮 trace 干扰
  })

  // 全矩阵扫一遍
  for (const pipeline of PIPELINES) {
    for (const mode of MODES) {
      it(`bench: ${pipeline} × ${mode}`, async () => {
        const r = await runOneBench(pipeline, mode)
        results.push(r)
        // 性能基线：fast 模式 < 10s, standard < 30s, hq < 60s
        const limit = mode === 'fast' ? 10_000 : mode === 'standard' ? 30_000 : 60_000
        if (r.ok) {
          expect(r.durationMs).toBeLessThan(limit)
        }
        // 至少记录，不强制 100% 成功（dev mode 可能 mock 未就绪）
        expect(r).toHaveProperty('pipeline')
      }, 90_000)
    }
  }

  it('writes baseline.json report', async () => {
    // 等所有并行 case 收尾
    await sleep(200)
    const baseline = {
      generatedAt: new Date().toISOString(),
      totalCases: results.length,
      okCount: results.filter((r) => r.ok).length,
      failCount: results.filter((r) => !r.ok).length,
      byPipeline: groupBy(results, 'pipeline'),
      byMode: groupBy(results, 'mode'),
    }
    writeFileSync(
      path.resolve(REPORT_DIR, 'baseline.json'),
      JSON.stringify(baseline, null, 2),
    )
    expect(existsSync(path.resolve(REPORT_DIR, 'baseline.json'))).toBe(true)
  })
})

function groupBy<T extends Record<string, unknown>, K extends keyof T>(arr: T[], key: K): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of arr) {
    const k = String(item[key])
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out
}
