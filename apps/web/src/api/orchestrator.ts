// =============================================================================
// orchestrator.ts — 调 ai-orchestrator (8087)
// W5 任务 3 + P2 C1 一键创作 Job API
//
// 已合并 orchestrator-jobs.ts 中的 job 接口。
// 旧 workflow run 保留向后兼容，新代码统一走 job 接口。
// =============================================================================

import type { Workflow, WorkflowRun, DebugEvent } from '../types/studio'
import { tokenStore } from '@manhuaworks/api-client'
import { getToken } from '@/utils/auth'

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

// =============================================================================
// 一键创作 Job API（合并自 orchestrator-jobs.ts）
// 新代码统一走以下接口
// =============================================================================

/** 风格预设 key */
export type StyleKey = 'anime-realistic' | 'anime-classic' | 'chinese-ink' | 'comic-graphic' | '3d-cinematic' | 'sketch-line'

/** 画幅 */
export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1'

/** 步骤状态 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 单步骤 */
export interface JobStep {
  step: number
  name: string
  status: StepStatus
  previewUrl?: string
  error?: string
  result?: unknown
}

/** Job 状态 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** Job 完整数据 */
export interface JobData {
  jobId: string
  type: string
  status: JobStatus
  progress: number
  currentStep?: number
  totalSteps?: number
  steps?: JobStep[]
  result?: {
    runId?: string
    outputs?: Record<string, unknown>
    videoUrl?: string
    musicUrl?: string
    projectId?: string
  }
  error?: string
  pipeline?: string
  projectId?: string
  estimatedTime?: number
  createdAt?: string
  updatedAt?: string
}

/** 提交 Job 请求参数 */
export interface CreateJobParams {
  type: 'one-click-manga' | 'auto-music'
  payload: {
    text: string
    style?: StyleKey
    aspectRatio?: AspectRatio
    episodeCount?: number
    language?: string
  }
  projectId?: string
}

/** 提交响应 */
export interface CreateJobResponse {
  code: number
  message: string
  data: {
    jobId: string
    status: string
    type: string
    estimatedTime?: number
    createdAt?: string
  }
}

/** 获取 Job 状态响应 */
export interface GetJobResponse {
  code: number
  message: string
  data: JobData
}

/** 提交一键创作 Job */
export async function createJob(params: CreateJobParams): Promise<CreateJobResponse> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${BASE_URL}/api/v1/orchestrator/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.message || `提交失败 (${resp.status})`)
  return json as CreateJobResponse
}

/** 查询 Job 状态 */
export async function getJob(jobId: string): Promise<GetJobResponse> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${BASE_URL}/api/v1/orchestrator/jobs/${jobId}`, { headers })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.message || `查询失败 (${resp.status})`)
  return json as GetJobResponse
}

/** 查询 Job 状态（轻量轮询，仅进度） */
export async function getJobStatus(jobId: string): Promise<GetJobResponse> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${BASE_URL}/api/v1/orchestrator/jobs/${jobId}/status`, { headers })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.message || `查询失败 (${resp.status})`)
  return json as GetJobResponse
}

/** 获取中间产物（项目级） */
export async function getIntermediates(projectId: string) {
  const token = tokenStore.get()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/intermediates`, { headers })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.message || `查询中间产物失败 (${resp.status})`)
  return json
}

/** WebSocket URL 构造 */
export function getJobWsUrl(jobId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const token = getToken() ?? ''
  return `${proto}://${window.location.hostname}:8087/ws/orchestrator/jobs/${jobId}?token=${token}`
}
