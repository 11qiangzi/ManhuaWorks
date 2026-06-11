/**
 * 全局异常捕获
 *
 * 三层捕获：
 *  1. window.onerror — 同步运行时错误
 *  2. unhandledrejection — 未捕获 Promise 拒绝
 *  3. Vue app.config.errorHandler — 组件渲染/事件错误
 *
 * 用法：
 *   import { installGlobalErrorHandler } from '@manhuaworks/ui'
 *   installGlobalErrorHandler(app, { onError })
 */
import type { App } from 'vue'
import { fromUnknown, AppError } from '../errors'
import { useToast } from './useToast'

export interface ErrorHandlerOptions {
  /** 自定义处理（覆盖默认 toast 行为） */
  onError?: (err: AppError, source: 'window' | 'unhandledrejection' | 'vue' | 'manual') => void
  /** 是否输出到控制台（默认 true） */
  consoleLog?: boolean
  /** 是否显示 toast（默认 true） */
  toast?: boolean
  /** 是否上报到远程（默认 false） */
  report?: (err: AppError) => void | Promise<void>
}

let installed = false
let prevHandler: (event: ErrorEvent) => void
let prevRejectionHandler: (event: PromiseRejectionEvent) => void

/**
 * 安装全局异常捕获
 * 多次调用是安全的，会忽略后续调用并发出警告
 */
export function installGlobalErrorHandler(
  app: App,
  options: ErrorHandlerOptions = {}
): () => void {
  if (installed) {
    if (typeof console !== 'undefined') {
      console.warn('[useErrorHandler] already installed, skipping')
    }
    return () => {
      /* noop */
    }
  }
  installed = true

  const {
    onError,
    consoleLog = true,
    toast: enableToast = true,
    report
  } = options

  function handle(err: unknown, source: 'window' | 'unhandledrejection' | 'vue' | 'manual') {
    const appError = fromUnknown(err)
    if (consoleLog) {
      // eslint-disable-next-line no-console
      console.error(`[${source}]`, appError.code, appError.message, appError)
    }
    if (onError) {
      try {
        onError(appError, source)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[useErrorHandler] onError threw', e)
      }
    } else if (enableToast) {
      // 默认行为：toast 提示
      try {
        const t = useToast()
        t.error(appError.message, { title: '系统错误' })
      } catch {
        // 在测试环境或 toast 不可用时静默
      }
    }
    if (report) {
      Promise.resolve(report(appError)).catch(() => {
        /* noop */
      })
    }
  }

  // 1. window.onerror
  prevHandler = (event: ErrorEvent) => {
    handle(event.error ?? event.message, 'window')
    event.preventDefault?.()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('error', prevHandler)
  }

  // 2. unhandledrejection
  prevRejectionHandler = (event: PromiseRejectionEvent) => {
    handle(event.reason, 'unhandledrejection')
    event.preventDefault?.()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', prevRejectionHandler)
  }

  // 3. Vue errorHandler
  const prevVueHandler = app.config.errorHandler
  app.config.errorHandler = (err, _instance, info) => {
    handle(err instanceof Error ? err : new Error(String(err) + ` (${info})`), 'vue')
    if (prevVueHandler && typeof prevVueHandler === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(prevVueHandler as any)(err, _instance, info)
    }
  }

  // 返回卸载函数
  return function uninstall() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', prevHandler)
      window.removeEventListener('unhandledrejection', prevRejectionHandler)
    }
    app.config.errorHandler = prevVueHandler
    installed = false
  }
}

/**
 * 在组件内使用全局错误处理
 */
export function useErrorHandler() {
  function report(err: unknown) {
    const appError = fromUnknown(err)
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[manual]', appError)
    }
    try {
      const t = useToast()
      t.error(appError.message, { title: '错误' })
    } catch {
      // ignore
    }
  }

  return { report, fromUnknown }
}
