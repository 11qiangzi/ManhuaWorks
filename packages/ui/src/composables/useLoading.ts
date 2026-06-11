/**
 * 14 类 Loading 状态
 *
 * 1.  page          - 整页加载（路由切换）
 * 2.  section       - 区域加载（页面局部）
 * 3.  table         - 表格加载
 * 4.  button        - 按钮加载（防重复提交）
 * 5.  form          - 表单提交加载
 * 6.  inline        - 行内加载
 * 7.  modal         - 弹窗加载
 * 8.  drawer        - 抽屉加载
 * 9.  skeleton      - 骨架屏（占位）
 * 10. infinite      - 无限滚动加载
 * 11. pull-refresh  - 下拉刷新
 * 12. upload        - 上传进度
 * 13. progress      - 进度条（确定）
 * 14. indeterminate - 不确定进度条
 *
 * 用法：
 *   const loading = useLoading()
 *   loading.start('button', 'submitBtn')
 *   await api.submit()
 *   loading.stop('submitBtn')
 */
import { reactive, computed, type ComputedRef } from 'vue'
import type { AppError } from '../errors'

export type LoadingType =
  | 'page'
  | 'section'
  | 'table'
  | 'button'
  | 'form'
  | 'inline'
  | 'modal'
  | 'drawer'
  | 'skeleton'
  | 'infinite'
  | 'pull-refresh'
  | 'upload'
  | 'progress'
  | 'indeterminate'

export interface LoadingEntry {
  type: LoadingType
  key: string
  active: boolean
  message?: string
  /** 0-100 进度 */
  progress: number
  startedAt: number
  finishedAt?: number
  error?: AppError | null
  meta?: Record<string, unknown>
}

export interface UseLoadingReturn {
  states: Record<string, LoadingEntry>
  isLoading: (key: string) => boolean
  isAnyLoading: ComputedRef<boolean>
  activeKeys: ComputedRef<string[]>
  start: (
    type: LoadingType,
    key: string,
    options?: { message?: string; meta?: Record<string, unknown> }
  ) => void
  stop: (key: string) => void
  setProgress: (key: string, progress: number) => void
  setMessage: (key: string, message: string) => void
  setError: (key: string, error: AppError | null) => void
  withLoading: <T>(
    type: LoadingType,
    key: string,
    fn: () => Promise<T>,
    options?: { onError?: (e: unknown) => void; message?: string }
  ) => Promise<T>
  clear: () => void
}

export function useLoading(): UseLoadingReturn {
  const states = reactive<Record<string, LoadingEntry>>({})

  function isLoading(key: string): boolean {
    return states[key]?.active ?? false
  }

  const isAnyLoading = computed(() =>
    Object.values(states).some((s) => s.active)
  )

  const activeKeys = computed(() =>
    Object.values(states)
      .filter((s) => s.active)
      .map((s) => s.key)
  )

  function start(
    type: LoadingType,
    key: string,
    options: { message?: string; meta?: Record<string, unknown> } = {}
  ) {
    states[key] = {
      type,
      key,
      active: true,
      message: options.message,
      progress: type === 'progress' ? 0 : -1,
      startedAt: Date.now(),
      error: null,
      meta: options.meta
    }
  }

  function stop(key: string) {
    const entry = states[key]
    if (entry) {
      entry.active = false
      entry.finishedAt = Date.now()
      // 不删除 entry，保留历史（如需查看进度）
      // 通过 clear() 显式清理
    }
  }

  function setProgress(key: string, progress: number) {
    const entry = states[key]
    if (entry) {
      entry.progress = Math.max(0, Math.min(100, progress))
    }
  }

  function setMessage(key: string, message: string) {
    const entry = states[key]
    if (entry) {
      entry.message = message
    }
  }

  function setError(key: string, error: AppError | null) {
    const entry = states[key]
    if (entry) {
      entry.error = error
    }
  }

  async function withLoading<T>(
    type: LoadingType,
    key: string,
    fn: () => Promise<T>,
    options: { onError?: (e: unknown) => void; message?: string } = {}
  ): Promise<T> {
    start(type, key, { message: options.message })
    try {
      const result = await fn()
      stop(key)
      return result
    } catch (e) {
      const entry = states[key]
      if (entry) {
        entry.active = false
        entry.finishedAt = Date.now()
      }
      if (options.onError) {
        options.onError(e)
      } else {
        throw e
      }
      throw e
    }
  }

  function clear() {
    for (const k of Object.keys(states)) {
      delete states[k]
    }
  }

  return {
    states,
    isLoading,
    isAnyLoading,
    activeKeys,
    start,
    stop,
    setProgress,
    setMessage,
    setError,
    withLoading,
    clear
  }
}
