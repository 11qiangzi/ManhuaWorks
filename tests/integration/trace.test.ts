/**
 * ManhuaWorks · W5 任务 6.7
 *
 * 跨服务链路追踪：trace_id 透传 5 服务
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

const EXPECTED_CHAIN = ['ai-router', 'ai-keys', 'workflow-engine', 'asset-service', 'ai-orchestrator']

describe('trace · x-trace-id propagates through 5 services', () => {
  it('single request spans all 5 services with same trace_id', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()

    // 模拟一个跨 5 服务的请求序列
    await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ novel: 'trace test' }),
      },
      { service: 'ai-router', traceId, collector: integration.trace },
    )
    await tracedFetch(
      `${integration.services['ai-keys'].baseUrl}/v1/keys/resolve`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      { service: 'ai-keys', traceId, collector: integration.trace },
    )
    await tracedFetch(
      `${integration.services['workflow-engine'].baseUrl}/v1/runs/start`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflowId: 'w1' }),
      },
      { service: 'workflow-engine', traceId, collector: integration.trace },
    )
    await tracedFetch(
      `${integration.services['asset-service'].baseUrl}/v1/assets`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      { service: 'asset-service', traceId, collector: integration.trace },
    )
    await tracedFetch(
      `${integration.services['ai-orchestrator'].baseUrl}/v1/tasks`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      { service: 'ai-orchestrator', traceId, collector: integration.trace },
    )

    const trace = integration.trace.end(traceId)
    expect(trace).toBeDefined()
    expect(trace!.traceId).toBe(traceId)

    const validation = integration.trace.validateFullChain(traceId, EXPECTED_CHAIN)
    expect(validation.ok).toBe(true)
    expect(validation.missing).toEqual([])

    // 验证每个 span 的 traceId 都一致
    for (const span of trace!.spans) {
      expect(span.traceId).toBe(traceId)
    }
  }, 30_000)

  it('parent-child span relationship preserved', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()
    const { newSpanId } = await import('./helpers/trace-collector')
    const parentSpanId = newSpanId()

    // 父 span：ai-router
    await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ novel: 'parent test' }),
      },
      { service: 'ai-router', traceId, spanId: parentSpanId, collector: integration.trace },
    )

    // 子 span：ai-keys 引用 router 的 spanId
    await tracedFetch(
      `${integration.services['ai-keys'].baseUrl}/v1/keys/resolve`,
      { method: 'GET', headers: { authorization: `Bearer ${token}` } },
      {
        service: 'ai-keys',
        traceId,
        parentSpanId,
        collector: integration.trace,
      },
    )

    const trace = integration.trace.get(traceId)
    expect(trace).toBeDefined()
    const childSpan = trace!.spans.find((s) => s.service === 'ai-keys')
    expect(childSpan).toBeDefined()
    expect(childSpan!.parentSpanId).toBe(parentSpanId)
  }, 15_000)

  it('different traces do not pollute each other', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'

    const traceA = newTraceId()
    const traceB = newTraceId()

    await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ novel: 'A' }),
      },
      { service: 'ai-router', traceId: traceA, collector: integration.trace },
    )
    await tracedFetch(
      `${integration.services['ai-router'].baseUrl}/v1/drama/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ novel: 'B' }),
      },
      { service: 'ai-router', traceId: traceB, collector: integration.trace },
    )

    const a = integration.trace.get(traceA)
    const b = integration.trace.get(traceB)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a!.traceId).toBe(traceA)
    expect(b!.traceId).toBe(traceB)
    expect(a!.traceId).not.toBe(b!.traceId)
  }, 15_000)
})
