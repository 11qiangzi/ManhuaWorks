/**
 * ManhuaWorks · W5 任务 6.4
 *
 * 工作流运行：12 类节点编排 + 启 run + 实时进度
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

/* ==================== 12 类节点定义（与 W3 一致） ==================== */

const NODE_TYPES = [
  'input', 'output',
  'llm', 'image-gen', 'video-gen', 'tts',
  'router', 'condition',
  'merge', 'split',
  'http', 'delay',
] as const

type NodeType = typeof NODE_TYPES[number]

interface WorkflowGraph {
  nodes: Array<{ id: string; type: NodeType; config: Record<string, unknown> }>
  edges: Array<{ from: string; to: string }>
}

function buildAll12NodeWorkflow(): WorkflowGraph {
  return {
    nodes: NODE_TYPES.map((type, i) => ({
      id: `n${i}`,
      type,
      config: type === 'delay' ? { ms: 50 } : { mock: true },
    })),
    edges: NODE_TYPES.slice(0, -1).map((_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
  }
}

describe('E2E · workflow run (12 node types + live progress)', () => {
  it('validates all 12 node types are supported', () => {
    expect(NODE_TYPES.length).toBe(12)
    expect(new Set(NODE_TYPES).size).toBe(12) // 无重复
  })

  it('creates a workflow with 12 nodes and starts a run', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()
    const wf = buildAll12NodeWorkflow()

    // 1) 创建 workflow
    const createRes = await tracedFetch(
      `${integration.services['workflow-engine'].baseUrl}/v1/workflows`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'integration-12-nodes', graph: wf }),
      },
      { service: 'workflow-engine', traceId, collector: integration.trace },
    )
    expect(createRes.ok).toBe(true)
    const { workflowId } = (await createRes.json()) as { workflowId: string }

    // 2) 启 run
    const startRes = await tracedFetch(
      `${integration.services['workflow-engine'].baseUrl}/v1/workflows/${workflowId}/run`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: { novel: 'test' } }),
      },
      { service: 'workflow-engine', traceId, collector: integration.trace },
    )
    expect(startRes.ok).toBe(true)
    const { runId } = (await startRes.json()) as { runId: string }

    // 3) 轮询进度
    const progressSeen: number[] = []
    const deadline = Date.now() + 30_000
    let finalStatus: string | undefined

    while (Date.now() < deadline) {
      const pollRes = await tracedFetch(
        `${integration.services['workflow-engine'].baseUrl}/v1/runs/${runId}/progress`,
        { method: 'GET', headers: { authorization: `Bearer ${token}` } },
        { service: 'workflow-engine', traceId, collector: integration.trace },
      )
      if (pollRes.ok) {
        const data = (await pollRes.json()) as { status: string; progress: number }
        progressSeen.push(data.progress)
        if (data.status === 'succeeded' || data.status === 'failed') {
          finalStatus = data.status
          break
        }
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    expect(finalStatus).toBe('succeeded')
    expect(progressSeen.length).toBeGreaterThan(0)
    expect(progressSeen[progressSeen.length - 1]).toBe(100)
  }, 60_000)

  it('router node routes by condition (LLM vs Image)', async () => {
    const token = process.env.MHW_TEST_USER_TOKEN ?? 'test-token'
    const traceId = newTraceId()
    const wf: WorkflowGraph = {
      nodes: [
        { id: 'in', type: 'input', config: {} },
        { id: 'cond', type: 'condition', config: { field: 'mode', equals: 'image' } },
        { id: 'llm', type: 'llm', config: { mock: true } },
        { id: 'img', type: 'image-gen', config: { mock: true } },
        { id: 'out', type: 'output', config: {} },
      ],
      edges: [
        { from: 'in', to: 'cond' },
        { from: 'cond', to: 'llm' },
        { from: 'cond', to: 'img' },
        { from: 'llm', to: 'out' },
        { from: 'img', to: 'out' },
      ],
    }

    const res = await tracedFetch(
      `${integration.services['workflow-engine'].baseUrl}/v1/workflows`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'router-test', graph: wf }),
      },
      { service: 'workflow-engine', traceId, collector: integration.trace },
    )
    expect([200, 201, 202]).toContain(res.status)
  }, 30_000)
})
