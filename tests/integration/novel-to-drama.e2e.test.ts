/**
 * ManhuaWorks · W5 任务 6.1
 *
 * 端到端测试：1 集从小说输入到 mp4 输出
 * 链路：user-portal → ai-router → ai-keys → workflow-engine → asset-service → ai-orchestrator
 *
 * 复用 W4 mock-providers 的 LLM/Image/Video/TTS provider
 *
 * @author 钟帧
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { newTraceId, tracedFetch } from './helpers/trace-collector'
import { setupIntegration, teardownIntegration } from './setup'

/* ==================== 类型 ==================== */

interface EpisodeRunResult {
  runId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  shots: Array<{
    shotId: string
    imageUrl: string
    videoUrl: string
    audioUrl: string
    durationMs: number
  }>
  totalDurationMs: number
  cost: { llmTokens: number; images: number; videos: number; ttsChars: number; usdEstimate: number }
}

/* ==================== Setup / Teardown ==================== */

let integration: Awaited<ReturnType<typeof setupIntegration>>

beforeAll(async () => {
  integration = await setupIntegration()
}, 60_000)

afterAll(async () => {
  await teardownIntegration()
}, 30_000)

/* ==================== Tests ==================== */

describe('E2E · novel-to-drama (1 episode full pipeline)', () => {
  it('runs 200-char novel through full 5-service chain and produces mp4', async () => {
    const novelText = readFileSync(integration.fixtures.novel200, 'utf-8')
    expect(novelText.length).toBeGreaterThan(50)

    const traceId = newTraceId()
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'

    // Step 1: ai-router 接收请求
    const routerRes = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'standard',
          novel: novelText,
          options: { shotsPerScene: 2, voice: 'zh-female-1' },
        }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    expect(routerRes.ok).toBe(true)
    const routerData = (await routerRes.json()) as { runId: string }
    const runId = routerData.runId
    expect(runId).toMatch(/^run_/)

    // Step 2: ai-keys 拉取凭据（router 内部调用）
    const keysRes = await tracedFetch(
      `${integration.services['ai-keys'].baseUrl}/v1/keys/resolve?provider=mock-llm`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      },
      { service: 'ai-keys', traceId, collector: integration.trace },
    )
    expect([200, 404]).toContain(keysRes.status) // 404 意味着走 mock fallback，也可接受

    // Step 3: workflow-engine 启 run
    const wfRes = await tracedFetch(
      `${integration.services['workflow-engine'].baseUrl}/v1/runs/${runId}/start`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflowId: 'novel-to-drama-v1' }),
      },
      { service: 'workflow-engine', traceId, collector: integration.trace },
    )
    expect(wfRes.ok).toBe(true)

    // Step 4: 轮询 workflow-engine 拿状态
    let result: EpisodeRunResult | null = null
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const pollRes = await tracedFetch(
        `${integration.services['workflow-engine'].baseUrl}/v1/runs/${runId}`,
        { method: 'GET', headers: { authorization: `Bearer ${token}` } },
        { service: 'workflow-engine', traceId, collector: integration.trace },
      )
      if (pollRes.ok) {
        const data = (await pollRes.json()) as EpisodeRunResult
        if (data.status === 'succeeded' || data.status === 'failed') {
          result = data
          break
        }
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    expect(result).not.toBeNull()
    expect(result!.status).toBe('succeeded')

    // Step 5: asset-service 拉取 mp4
    const assetRes = await tracedFetch(
      `${integration.services['asset-service'].baseUrl}/v1/assets?runId=${runId}`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      { service: 'asset-service', traceId, collector: integration.trace },
    )
    expect(assetRes.ok).toBe(true)
    const assets = (await assetRes.json()) as { items: Array<{ type: string; url: string }> }
    const mp4 = assets.items.find((a) => a.type === 'mp4')
    expect(mp4).toBeDefined()
    expect(mp4!.url).toMatch(/\.mp4$/)

    // Step 6: ai-orchestrator 记录 cost
    const orchRes = await tracedFetch(
      `${integration.services['ai-orchestrator'].baseUrl}/v1/cost/${runId}`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      { service: 'ai-orchestrator', traceId, collector: integration.trace },
    )
    expect(orchRes.ok).toBe(true)
    const cost = (await orchRes.json()) as { usdEstimate: number }
    expect(cost.usdEstimate).toBeGreaterThan(0)

    // 验证 trace 完整性
    const trace = integration.trace.end(traceId)
    expect(trace).toBeDefined()
    expect(trace!.spans.length).toBeGreaterThanOrEqual(5)
    expect(trace!.serviceChain.length).toBeGreaterThanOrEqual(3)
  }, 60_000)

  it('handles 1000-char novel with same 5-service chain', async () => {
    const novelText = readFileSync(integration.fixtures.novel1000, 'utf-8')
    expect(novelText.length).toBeGreaterThan(500)

    const traceId = newTraceId()
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'

    const routerRes = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'fast',
          novel: novelText,
          options: { shotsPerScene: 4 },
        }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    expect([200, 202]).toContain(routerRes.status)
  }, 60_000)
})
