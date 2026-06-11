/**
 * ManhuaWorks · W5 任务 6.2
 *
 * BYOK (Bring Your Own Key) 端到端：
 *  - 用户填 key → 调 router → router 路由到正确 provider
 *
 * @author 钟帧
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

describe('E2E · BYOK flow', () => {
  it('user saves OpenAI key → router picks OpenAI provider', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()

    // 1) 用户填 key
    const saveRes = await tracedFetch(
      `${integration.services['ai-keys'].baseUrl}/v1/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-test-byok-openai-xxxxx',
          label: 'my-openai-key',
        }),
      },
      { service: 'ai-keys', traceId, collector: integration.trace },
    )
    expect(saveRes.ok).toBe(true)
    const saved = (await saveRes.json()) as { keyId: string; provider: string }
    expect(saved.provider).toBe('openai')
    expect(saved.keyId).toMatch(/^key_/)

    // 2) 调 router（带 BYOK hint）
    const routeRes = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/route`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          task: 'llm',
          prompt: 'hello',
          byok: { openai: saved.keyId },
        }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    expect(routeRes.ok).toBe(true)
    const routed = (await routeRes.json()) as { provider: string; usedByok: boolean }
    expect(routed.provider).toBe('openai')
    expect(routed.usedByok).toBe(true)

    // 3) 验证 router 调用了 ai-keys 解析凭据
    const trace = integration.trace.get(traceId)
    expect(trace).toBeDefined()
    expect(trace!.serviceChain).toContain('ai-keys')
    expect(trace!.serviceChain).toContain('ai-router')
  }, 30_000)

  it('without BYOK → router falls back to mock provider', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()

    const routeRes = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/route`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ task: 'llm', prompt: 'fallback test' }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    expect(routeRes.ok).toBe(true)
    const routed = (await routeRes.json()) as { provider: string; usedByok: boolean }
    expect(routed.usedByok).toBe(false)
    expect(routed.provider).toMatch(/mock|system/)
  }, 30_000)

  it('routes Anthropic BYOK key correctly', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()

    const saveRes = await tracedFetch(
      `${integration.services['ai-keys'].baseUrl}/v1/keys`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'anthropic',
          apiKey: 'sk-ant-test-xxxxx',
        }),
      },
      { service: 'ai-keys', traceId, collector: integration.trace },
    )
    const { keyId } = (await saveRes.json()) as { keyId: string }

    const routeRes = await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/route`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ task: 'llm', prompt: 'anthropic test', byok: { anthropic: keyId } }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    expect(routeRes.ok).toBe(true)
    const routed = (await routeRes.json()) as { provider: string }
    expect(routed.provider).toBe('anthropic')
  }, 30_000)
})
