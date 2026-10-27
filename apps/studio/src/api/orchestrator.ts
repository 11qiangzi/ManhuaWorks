// =============================================================================
// orchestrator.ts — 调 ai-orchestrator 启 run
// W5 任务 3
// =============================================================================

import type { Workflow, WorkflowRun, DebugEvent } from '../types/workflow'

/** orchestrator 服务地址（Vite 代理 / 环境变量覆盖）
 * 默认走 vite proxy（/api → http://localhost:8087），生产部署由反向代理兜底
 */
const BASE_URL: string =
  (import.meta.env?.VITE_ORCHESTRATOR_URL as string | undefined) ??
  ''

/** 启动一个工作流运行 */
export async function startRun(workflow: Workflow): Promise<WorkflowRun> {
  const resp = await fetch(`${BASE_URL}/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId: workflow.id,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`startRun failed: ${resp.status} ${text}`)
  }
  return await resp.json() as WorkflowRun
}

/** 取消运行 */
export async function cancelRun(runId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/runs/${runId}/cancel`, { method: 'POST' })
}

/** 拉运行状态（一次性） */
export async function getRun(runId: string): Promise<WorkflowRun> {
  const resp = await fetch(`${BASE_URL}/api/v1/runs/${runId}`)
  if (!resp.ok) throw new Error(`getRun failed: ${resp.status}`)
  return await resp.json() as WorkflowRun
}

/** 订阅运行事件（WebSocket + 自动重连） */
export function subscribeRun(
  runId: string,
  onEvent: (e: DebugEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const wsBase = BASE_URL.replace(/^http/, 'ws')
  const url = `${wsBase}/ws/runs/${runId}`

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000
  let attempts = 0
  let cancelled = false
  const MAX_DELAY = 30_000

  function connect() {
    if (cancelled) return
    ws = new WebSocket(url)
    ws.onopen = () => {
      reconnectDelay = 1000
      attempts = 0
    }
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as DebugEvent
        // 收到 run-finished 或 run-cancelled 后停止重连
        if (data.type === 'run-finished' || data.type === 'run-cancelled') {
          cancelled = true
        }
        onEvent(data)
      } catch (err) {
        console.error('subscribeRun parse error', err)
      }
    }
    ws.onerror = (e) => {
      console.error('subscribeRun ws error', e)
      onError?.(e)
    }
    ws.onclose = () => {
      if (cancelled) return
      attempts++
      const jitter = Math.random() * 400 - 200
      const delay = Math.min(reconnectDelay + jitter, MAX_DELAY)
      console.info(`subscribeRun reconnecting in ${Math.round(delay)}ms (attempt ${attempts})`)
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY)
        connect()
      }, delay)
    }
  }

  connect()

  return () => {
    cancelled = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) ws.close()
  }
}

/** 保存工作流（draft） */
export async function saveWorkflow(workflow: Workflow): Promise<{ id: string }> {
  const resp = await fetch(`${BASE_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  if (!resp.ok) throw new Error(`saveWorkflow failed: ${resp.status}`)
  return await resp.json() as { id: string }
}

/** 加载工作流 */
export async function loadWorkflow(id: string): Promise<Workflow> {
  const resp = await fetch(`${BASE_URL}/api/v1/workflows/${id}`)
  if (!resp.ok) throw new Error(`loadWorkflow failed: ${resp.status}`)
  return await resp.json() as Workflow
}

/** 列出已保存工作流 */
export async function listWorkflows(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
  const resp = await fetch(`${BASE_URL}/api/v1/workflows`)
  if (!resp.ok) throw new Error(`listWorkflows failed: ${resp.status}`)
  return await resp.json() as Array<{ id: string; name: string; updatedAt: number }>
}
