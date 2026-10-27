/**
 * studio · generation-task Pinia store — AI 生成任务管理
 *
 * 数据来源: api.generation (submit/get/list/cancel @ /v1/generation)
 * 任务类型: image / video / audio / tts
 * 状态流: queued → running → succeeded/failed/expired/cancelled
 *
 * 设计原则:
 *   1. 真 API 优先 — 后端未启动时优雅降级为空列表 + 错误提示
 *   2. 乐观取消 — 先更新 UI 再发请求,失败回滚
 *   3. 自动刷新 — 活跃任务每 3s 轮询一次状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  GenerationTask,
  GenerationSubmitRequest,
  GenerationStatus,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useGenerationStore = defineStore('generation', () => {
  const api = getApi()

  // ---------- state ----------
  const tasks = ref<GenerationTask[]>([])
  const current = ref<GenerationTask | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  // ---------- getters ----------
  const active = computed(() =>
    tasks.value.filter(t => t.status === 'queued' || t.status === 'running')
  )
  const completed = computed(() =>
    tasks.value.filter(t => t.status === 'succeeded')
  )
  const failed = computed(() =>
    tasks.value.filter(t => t.status === 'failed')
  )

  const statusCounts = computed(() => {
    const c: Record<string, number> = { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0, expired: 0 }
    for (const t of tasks.value) {
      c[t.status] = (c[t.status] ?? 0) + 1
    }
    return c
  })

  // ---------- actions ----------

  /** 加载任务列表 (支持 project/status 过滤, reset=true 重置到第 1 页) */
  async function loadList(opts: {
    projectId?: string
    status?: GenerationStatus
    reset?: boolean
  } = {}): Promise<void> {
    if (opts.reset) {
      page.value = 1
      tasks.value = []
    }
    loading.value = true
    error.value = null
    try {
      const result = await api.generation.list({
        projectId: opts.projectId,
        status: opts.status,
        page: page.value,
        pageSize: pageSize.value,
      })
      if (opts.reset) {
        tasks.value = result.items
      } else {
        tasks.value = [...tasks.value, ...result.items]
      }
      total.value = result.total
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载生成任务失败'
      if (opts.reset) tasks.value = []
    } finally {
      loading.value = false
    }
  }

  /** 加载更多 (分页) */
  async function loadMore(): Promise<void> {
    if (tasks.value.length >= total.value) return
    page.value += 1
    await loadList()
  }

  /** 加载单个任务详情 */
  async function loadOne(taskId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      current.value = await api.generation.get(taskId)
      // 同步回列表
      const idx = tasks.value.findIndex(t => t.id === taskId)
      if (idx >= 0) tasks.value[idx] = current.value
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载任务详情失败'
    } finally {
      loading.value = false
    }
  }

  /** 提交新任务 */
  async function submit(req: GenerationSubmitRequest): Promise<{ taskId: string; status: string; requestHash: string }> {
    loading.value = true
    error.value = null
    try {
      const result = await api.generation.submit(req)
      // 刷新列表以包含新任务
      await loadList({ reset: true })
      return result
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '提交任务失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 取消任务 (乐观更新 + 回滚) */
  async function cancel(taskId: string): Promise<void> {
    error.value = null
    const idx = tasks.value.findIndex(t => t.id === taskId)
    const snapshot = idx >= 0 ? { ...tasks.value[idx] } : null
    if (idx >= 0) {
      tasks.value[idx] = { ...tasks.value[idx], status: 'cancelled' }
    }
    try {
      await api.generation.cancel(taskId)
    } catch (e) {
      // 回滚
      if (idx >= 0 && snapshot) tasks.value[idx] = snapshot
      error.value = e instanceof ApiError ? e.userMessage : '取消失败'
      throw e
    }
  }

  /** 刷新单个任务状态 */
  async function refreshTask(taskId: string): Promise<void> {
    try {
      const task = await api.generation.get(taskId)
      const idx = tasks.value.findIndex(t => t.id === taskId)
      if (idx >= 0) tasks.value[idx] = task
      if (current.value?.id === taskId) current.value = task
    } catch {
      // 静默失败
    }
  }

  // ---------- 自动刷新 ----------
  let pollTimer: ReturnType<typeof setInterval> | null = null

  /** 启动活跃任务自动轮询 (默认 3s) */
  function startAutoRefresh(intervalMs = 3000): void {
    stopAutoRefresh()
    pollTimer = setInterval(async () => {
      const activeIds = active.value.map(t => t.id as string)
      for (const id of activeIds) {
        await refreshTask(id)
      }
    }, intervalMs)
  }

  /** 停止自动轮询 */
  function stopAutoRefresh(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // state
    tasks, current, loading, error, total, page, pageSize,
    // getters
    active, completed, failed, statusCounts,
    // actions
    loadList, loadMore, loadOne, submit, cancel,
    refreshTask, startAutoRefresh, stopAutoRefresh, clearError,
  }
})
