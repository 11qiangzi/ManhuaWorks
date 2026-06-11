/**
 * useAsyncState - 封装异步状态
 *
 * 类似 VueUse useAsyncState，叠加：loading + error + retry + cancel
 *
 * 用法：
 *   const { data, error, isLoading, execute, retry, cancel } = useAsyncState(
 *     () => api.fetchUser(id),
 *     { initialValue: null, retry: 3, retryDelay: 1000 }
 *   )
 */
import { ref, shallowRef, onScopeDispose, type Ref } from 'vue'
import { fromUnknown, type AppError } from '../errors'

export interface UseAsyncStateOptions<T> {
  /** 初始值 */
  initialValue?: T
  /** 是否立即执行（默认 true） */
  immediate?: boolean
  /** 重试次数（默认 0） */
  retry?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
  /** 出错时的回调 */
  onError?: (e: AppError) => void
  /** 成功时的回调 */
  onSuccess?: (data: T) => void
}

export interface UseAsyncStateReturn<T> {
  data: Ref<T | undefined>
  error: Ref<AppError | null>
  isLoading: Ref<boolean>
  isReady: Ref<boolean>
  execute: () => Promise<T | undefined>
  retry: () => Promise<T | undefined>
  cancel: () => void
}

export function useAsyncState<T>(
  fn: () => Promise<T>,
  options: UseAsyncStateOptions<T> = {}
): UseAsyncStateReturn<T> {
  const {
    initialValue,
    immediate = true,
    retry: maxRetry = 0,
    retryDelay = 1000,
    onError,
    onSuccess
  } = options

  const data = shallowRef<T | undefined>(initialValue) as Ref<T | undefined>
  const error = ref<AppError | null>(null)
  const isLoading = ref(false)
  const isReady = ref(false)

  let abortController: AbortController | null = null
  let cancelled = false

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  async function run(attempt = 0): Promise<T | undefined> {
    if (cancelled) return undefined
    isLoading.value = true
    error.value = null
    abortController = new AbortController()
    try {
      const result = await fn()
      if (cancelled) return undefined
      data.value = result
      isReady.value = true
      onSuccess?.(result)
      return result
    } catch (e) {
      const appError = fromUnknown(e)
      if (attempt < maxRetry && appError.isRetryable() && !cancelled) {
        await sleep(retryDelay)
        return run(attempt + 1)
      }
      if (!cancelled) {
        error.value = appError
        isReady.value = true
        onError?.(appError)
      }
      return undefined
    } finally {
      if (!cancelled) {
        isLoading.value = false
      }
    }
  }

  function execute() {
    cancelled = false
    return run(0)
  }

  function retry() {
    return execute()
  }

  function cancel() {
    cancelled = true
    abortController?.abort()
    isLoading.value = false
  }

  onScopeDispose(() => {
    cancel()
  })

  if (immediate) {
    execute()
  }

  return { data, error, isLoading, isReady, execute, retry, cancel }
}
