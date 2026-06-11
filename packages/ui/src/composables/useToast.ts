/**
 * useToast - 快捷操作包装
 *
 * 用法：
 *   const toast = useToast()
 *   toast.success('保存成功')
 *   toast.error('网络异常', { title: '错误' })
 *   toast.promise(api.submit(), { loading: '提交中', success: '成功', error: '失败' })
 */
import { useToastStore, type AddToastOptions, type ToastPosition } from '../stores/toast'

export interface PromiseMessages {
  loading: string
  success: string | ((v: unknown) => string)
  error: string | ((e: unknown) => string)
}

export interface UseToastReturn {
  success: (message: string, options?: AddToastOptions) => string
  error: (message: string, options?: AddToastOptions) => string
  warning: (message: string, options?: AddToastOptions) => string
  info: (message: string, options?: AddToastOptions) => string
  loading: (message: string, options?: AddToastOptions) => string
  custom: (message: string, options?: AddToastOptions) => string
  promise: <T>(p: Promise<T>, messages: PromiseMessages, options?: AddToastOptions) => Promise<T>
  dismiss: (id: string) => void
  clear: () => void
  setPosition: (pos: ToastPosition) => void
}

export function useToast(): UseToastReturn {
  const store = useToastStore()
  let defaultPosition: ToastPosition = 'top-right'

  function success(message: string, options: AddToastOptions = {}): string {
    return store.add('success', message, { ...options, position: options.position ?? defaultPosition })
  }

  function error(message: string, options: AddToastOptions = {}): string {
    return store.add('error', message, { ...options, position: options.position ?? defaultPosition })
  }

  function warning(message: string, options: AddToastOptions = {}): string {
    return store.add('warning', message, { ...options, position: options.position ?? defaultPosition })
  }

  function info(message: string, options: AddToastOptions = {}): string {
    return store.add('info', message, { ...options, position: options.position ?? defaultPosition })
  }

  function loading(message: string, options: AddToastOptions = {}): string {
    return store.add('loading', message, {
      ...options,
      position: options.position ?? defaultPosition,
      persistent: true,
      duration: 0
    })
  }

  function custom(message: string, options: AddToastOptions = {}): string {
    return store.add('info', message, { ...options, position: options.position ?? defaultPosition })
  }

  async function promise<T>(
    p: Promise<T>,
    messages: PromiseMessages,
    options: AddToastOptions = {}
  ): Promise<T> {
    const id = loading(messages.loading, options)
    try {
      const result = await p
      const successMsg =
        typeof messages.success === 'function' ? messages.success(result) : messages.success
      store.update(id, {
        type: 'success',
        message: successMsg,
        persistent: false,
        duration: 3000,
        promiseStatus: 'fulfilled'
      })
      // 自动消失
      scheduleRemove(id, 3000)
      return result
    } catch (e) {
      const errorMsg =
        typeof messages.error === 'function' ? messages.error(e) : messages.error
      store.update(id, {
        type: 'error',
        message: errorMsg,
        persistent: false,
        duration: 5000,
        promiseStatus: 'rejected'
      })
      scheduleRemove(id, 5000)
      throw e
    }
  }

  function scheduleRemove(id: string, ms: number) {
    if (ms <= 0) return
    setTimeout(() => store.remove(id), ms)
  }

  function dismiss(id: string) {
    store.remove(id)
  }

  function clear() {
    store.clear()
  }

  function setPosition(pos: ToastPosition) {
    defaultPosition = pos
  }

  return {
    success,
    error,
    warning,
    info,
    loading,
    custom,
    promise,
    dismiss,
    clear,
    setPosition
  }
}
