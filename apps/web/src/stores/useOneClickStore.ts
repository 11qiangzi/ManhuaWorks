/**
 * useOneClickStore.ts — 一键创作状态管理
 *
 * 林染 · P2 Phase B1 · 2026-06-21
 *
 * 管理一键模式完整生命周期：
 *   input → generating → result
 *
 * 数据流：
 *   1. startJob(text, options) → POST /api/v1/orchestrator/jobs
 *   2. subscribe(jobId) → WebSocket + 3s 轮询 fallback
 *   3. 每步推送 → 更新 steps[] + progress + currentStep
 *   4. job-completed → stage='result' + 填充 result
 *   5. cancelJob() → 发送取消指令 + 断开连接
 *   6. reset() → 回到 input 阶段
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// =========================================================================
// 类型定义
// =========================================================================

export interface OneClickStylePreset {
  key: string
  label: string
  description: string
  color: string
}

export interface OneClickAspectOption {
  key: string
  label: string
  icon: string
  description: string
}

export interface OneClickJobOptions {
  text: string
  style: string
  aspectRatio: string
  episodeCount: number
  language?: string
}

export interface StepState {
  step: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  previewUrl?: string
  error?: string
  retryable?: boolean
}

export interface JobResult {
  videoUrl?: string
  duration?: number
  projectId?: string
  costEstimate?: {
    tokens?: number
    images?: number
    videos?: number
  }
}

export type OneClickStage = 'input' | 'generating' | 'result'

// =========================================================================
// 风格预设 & 画幅选项（共享数据）
// =========================================================================

export const STYLE_PRESETS: OneClickStylePreset[] = [
  { key: 'anime-realistic', label: '日漫写实', description: '新海诚风格，细腻光影', color: '#7DD3FC' },
  { key: 'anime-classic', label: '经典日漫', description: '90年代赛璐珞风格', color: '#F472B6' },
  { key: 'chinese-ink', label: '水墨国风', description: '中国传统水墨意境', color: '#A78BFA' },
  { key: 'comic-graphic', label: '美漫图像', description: '漫威/DC 风格分镜', color: '#FB923C' },
  { key: '3d-cinematic', label: '3D 电影级', description: '皮克斯/迪士尼质感', color: '#34D399' },
  { key: 'sketch-line', label: '线稿手绘', description: '铅笔素描风格', color: '#FBBF24' },
]

export const ASPECT_OPTIONS: OneClickAspectOption[] = [
  { key: '16:9', label: '宽屏 16:9', icon: '▬', description: '横屏视频，适合B站/YouTube' },
  { key: '9:16', label: '竖屏 9:16', icon: '▮', description: '竖屏视频，适合抖音/快手' },
]

export const STEP_NAMES = [
  '角色提取',
  '场景设定',
  '风格分析',
  '分镜生成',
  '图像生成',
  '视频生成',
  '配乐合成',
]

// =========================================================================
// Store
// =========================================================================

export const useOneClickStore = defineStore('oneClick', () => {
  // ---------- state ----------
  const jobId = ref<string | null>(null)
  const stage = ref<OneClickStage>('input')
  const progress = ref(0)               // 0–100
  const currentStep = ref(0)            // 0–7
  const steps = ref<StepState[]>([])
  const result = ref<JobResult | null>(null)
  const error = ref<string | null>(null)
  const isSubmitting = ref(false)

  // mock 模式：后端API未就绪时用 mock 数据模拟联调
  const useMock = ref(import.meta.env.VITE_USE_MOCK === 'true')

  // WS + polling 引用
  let ws: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let cancelled = false

  // ---------- computed ----------
  const isGenerating = computed(() => stage.value === 'generating')
  const currentStepName = computed(() => {
    const idx = currentStep.value
    if (idx > 0 && idx <= STEP_NAMES.length) {
      return STEP_NAMES[idx - 1]
    }
    return ''
  })
  const hasError = computed(() => error.value !== null)
  const currentStepData = computed(() => {
    return steps.value.find(s => s.step === currentStep.value) || null
  })

  // ---------- helpers ----------
  function buildWsUrl(id: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${window.location.hostname}/ws/orchestrator/jobs/${id}`
  }

  function buildApiUrl(path: string): string {
    // 走 Vite proxy → ai-orchestrator:8088
    return `/api/v1/orchestrator${path}`
  }

  // ---------- WS 连接 ----------
  function connectWebSocket(id: string) {
    if (ws) {
      try { ws.close() } catch { /* noop */ }
    }

    const url = buildWsUrl(id)
    ws = new WebSocket(url)

    ws.onopen = () => {
      console.info('[OneClickStore] WebSocket connected', id)
    }

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        handleWsMessage(msg)
      } catch (err) {
        console.error('[OneClickStore] WS parse error', err)
      }
    }

    ws.onerror = () => {
      console.warn('[OneClickStore] WebSocket error, falling back to polling')
    }

    ws.onclose = () => {
      if (!cancelled && stage.value === 'generating') {
        // 非预期关闭 → 启动轮询 fallback
        console.info('[OneClickStore] WS closed, starting poll fallback')
        startPolling(id)
      }
    }
  }

  function handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'step-completed':
        progress.value = msg.progress ?? Math.round((msg.step / 7) * 100)
        currentStep.value = msg.step
        updateStep(msg.step, 'completed', msg.stepName, msg.previewUrl)
        // 如果某步有预览 URL，更新当前步骤的 previewUrl
        if (msg.previewUrl) {
          const s = steps.value.find(s => s.step === msg.step)
          if (s) s.previewUrl = msg.previewUrl
        }
        break

      case 'step-failed':
        updateStep(msg.step, 'failed', msg.stepName, undefined, msg.error, msg.retryable)
        error.value = msg.error ?? `步骤 ${msg.step} 失败`
        break

      case 'job-completed':
        stage.value = 'result'
        progress.value = 100
        currentStep.value = 7
        // 标记所有步骤完成
        steps.value.forEach(s => { if (s.status !== 'failed') s.status = 'completed' })
        result.value = msg.result ?? {}
        cleanup()
        break

      case 'job-failed':
        error.value = msg.error ?? '任务执行失败'
        // 标记当前步骤失败
        if (msg.failedStep) {
          updateStep(msg.failedStep, 'failed', undefined, undefined, msg.error)
        }
        cleanup()
        break

      default:
        break
    }
  }

  function updateStep(
    stepNum: number,
    status: StepState['status'],
    name?: string,
    previewUrl?: string,
    errMsg?: string,
    retryable?: boolean
  ) {
    const existing = steps.value.find(s => s.step === stepNum)
    if (existing) {
      existing.status = status
      if (name) existing.name = name
      if (previewUrl) existing.previewUrl = previewUrl
      if (errMsg) existing.error = errMsg
      if (retryable !== undefined) existing.retryable = retryable
    } else {
      steps.value.push({
        step: stepNum,
        name: name ?? STEP_NAMES[stepNum - 1] ?? `步骤 ${stepNum}`,
        status,
        previewUrl,
        error: errMsg,
        retryable,
      })
    }
  }

  // ---------- 轮询 fallback ----------
  function startPolling(id: string) {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (cancelled) return
      try {
        const resp = await fetch(buildApiUrl(`/jobs/${encodeURIComponent(id)}/status`))
        if (!resp.ok) return
        const data = await resp.json()
        if (data.status && stage.value === 'generating') {
          if (data.progress !== undefined) progress.value = data.progress
          if (data.currentStep !== undefined) currentStep.value = data.currentStep
          if (data.steps) {
            data.steps.forEach((s: any) => {
              updateStep(s.step, s.status, s.name, s.previewUrl)
            })
          }
          if (data.status === 'succeeded') {
            stage.value = 'result'
            result.value = data.result
            progress.value = 100
            cleanup()
          } else if (data.status === 'failed') {
            error.value = data.error ?? '任务执行失败'
            cleanup()
          }
        }
      } catch {
        // 网络错误，静默重试
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function cleanup() {
    if (ws) {
      try { ws.close() } catch { /* noop */ }
      ws = null
    }
    stopPolling()
  }

  // ---------- 公开方法 ----------

  // =======================================================================
  // Mock 模式：模拟 7 步进度（后端 API 未就绪时）
  // =======================================================================

  let mockTimer: ReturnType<typeof setTimeout> | null = null

  async function startJobMock(text: string, options: Omit<OneClickJobOptions, 'text'>) {
    // 生成 fake jobId
    const fakeJobId = `mock-job-${Date.now()}`
    jobId.value = fakeJobId
    stage.value = 'generating'
    isSubmitting.value = false

    // 模拟 7 步，每步 1.2 秒延迟
    for (let stepNum = 1; stepNum <= 7; stepNum++) {
      if (cancelled) return fakeJobId

      // 标记为 running
      updateStep(stepNum, 'running')
      currentStep.value = stepNum
      progress.value = Math.round((stepNum / 7) * 100)

      await new Promise<void>((resolve) => {
        mockTimer = setTimeout(resolve, 1200)
      })

      if (cancelled) return fakeJobId

      // 标记为 completed（可选 previewUrl）
      const previewUrl = stepNum <= 6
        ? `https://picsum.photos/seed/${fakeJobId}-step${stepNum}/400/300`
        : undefined
      updateStep(stepNum, 'completed', STEP_NAMES[stepNum - 1], previewUrl)
      progress.value = Math.round(((stepNum) / 7) * 100)
    }

    // 全部完成
    stage.value = 'result'
    progress.value = 100
    currentStep.value = 7
    result.value = {
      videoUrl: `https://picsum.photos/seed/${fakeJobId}-final/640/360`,
      duration: 90,
      projectId: 'mock-proj-001',
      costEstimate: { tokens: 50000, images: 7, videos: 1 },
    }
    // 清理 mock timer
    mockTimer = null
    return fakeJobId
  }

  function cancelMock() {
    if (mockTimer) {
      clearTimeout(mockTimer)
      mockTimer = null
    }
  }

  /** 切换 mock 模式 */
  function toggleMock() {
    useMock.value = !useMock.value
  }

  // =======================================================================
  // 公开方法
  // =======================================================================

  /** 启动一键创作 job */
  async function startJob(text: string, options: Omit<OneClickJobOptions, 'text'>) {
    cancelled = false
    isSubmitting.value = true
    error.value = null

    // 初始化步骤
    steps.value = STEP_NAMES.map((name, i) => ({
      step: i + 1,
      name,
      status: 'pending' as const,
    }))
    progress.value = 0
    currentStep.value = 0
    result.value = null

    // mock 模式
    if (useMock.value) {
      try {
        return await startJobMock(text, options)
      } catch (err) {
        isSubmitting.value = false
        error.value = err instanceof Error ? err.message : 'Mock 模拟失败'
        throw err
      }
    }

    try {
      const resp = await fetch(buildApiUrl('/jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'one-click-manga',
          payload: {
            text,
            style: options.style,
            aspectRatio: options.aspectRatio,
            episodeCount: options.episodeCount,
            language: options.language ?? 'zh-CN',
          },
        }),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.message ?? `请求失败 (${resp.status})`)
      }

      const data = await resp.json()
      jobId.value = data.jobId
      stage.value = 'generating'
      isSubmitting.value = false

      // 尝试 WebSocket 连接
      connectWebSocket(data.jobId)

      return data.jobId
    } catch (err) {
      isSubmitting.value = false
      error.value = err instanceof Error ? err.message : '启动失败'
      throw err
    }
  }

  /** 取消当前 job */
  async function cancelJob() {
    cancelled = true
    cancelMock()
    cleanup()

    if (jobId.value) {
      try {
        await fetch(buildApiUrl(`/jobs/${jobId.value}/cancel`), { method: 'POST' })
      } catch {
        // 取消请求失败也继续清理
      }
    }

    jobId.value = null
    stage.value = 'input'
    progress.value = 0
    currentStep.value = 0
    steps.value = []
    error.value = null
  }

  /** 重置到输入阶段 */
  function reset() {
    cancelled = true
    cancelMock()
    cleanup()

    jobId.value = null
    stage.value = 'input'
    progress.value = 0
    currentStep.value = 0
    steps.value = []
    result.value = null
    error.value = null
    isSubmitting.value = false
  }

  /** 重试失败步骤 */
  async function retryFailedStep(stepNum: number) {
    if (!jobId.value) return
    error.value = null

    // 标记该步骤为 pending + running
    updateStep(stepNum, 'running')

    try {
      await fetch(buildApiUrl(`/jobs/${jobId.value}/retry`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepNum }),
      })
    } catch {
      // 重试请求失败，继续等待 WS/轮询推送
    }
  }

  return {
    // state
    jobId,
    stage,
    progress,
    currentStep,
    steps,
    result,
    error,
    isSubmitting,
    useMock,
    // computed
    isGenerating,
    currentStepName,
    hasError,
    currentStepData,
    // methods
    startJob,
    cancelJob,
    reset,
    retryFailedStep,
    toggleMock,
  }
})
