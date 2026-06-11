/**
 * @manhuaworks/ui
 *
 * ManhuaWorks 4 前端共享 UI 基础设施：
 *  - 错误处理（5 类错误 + 30+ 错误码 + 全局捕获 + ErrorBoundary）
 *  - Loading（14 类）
 *  - Toast（4 类型 + 5 位置 + 队列）
 *  - 通知（站内消息）
 *
 * 用法：
 *   import { useToast, useLoading, installGlobalErrorHandler, AppError } from '@manhuaworks/ui'
 */
export * from './errors'
export * from './composables'
export * from './stores'
export * from './components'
