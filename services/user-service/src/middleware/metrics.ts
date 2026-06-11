/**
 * user-service metrics middleware
 * ManhuaWorks · L2 task 11
 *
 * 装到 express，自动注入 traceId/requestId + 记录 http_requests_total/duration
 */

import express, { type Express } from 'express'
import {
  httpLoggerMiddleware,
  errorHandlerMiddleware,
  createLogger,
} from '@manhuaworks/logger'

const SERVICE = 'user-service'
const logger = createLogger(SERVICE)

export function mountMetrics(app: Express): void {
  // 1) http 访问日志 + prom-client metrics
  app.use(httpLoggerMiddleware({ service: SERVICE, logger }))

  // 2) 兜底错误处理 (放最后 — 路由之后)
  // 注：调用方应在所有路由后调用 mountErrorHandler(app)
}

/**
 * 错误处理 — 必须在所有路由之后挂载
 */
export function mountErrorHandler(app: express.Express): void {
  app.use(errorHandlerMiddleware({ service: SERVICE, logger }))
}

export { logger, SERVICE }
export default mountMetrics