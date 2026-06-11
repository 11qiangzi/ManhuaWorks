/**
 * collab-service metrics middleware
 * ManhuaWorks · L2 task 11
 *
 * 装到 express + ws，自动注入 traceId/requestId + 记录 http_requests_total/duration
 * + ws 连接数 + 消息计数
 */

import express, { type Express } from 'express'
import {
  httpLoggerMiddleware,
  errorHandlerMiddleware,
  wsLoggerAttach,
  createLogger,
} from '@manhuaworks/logger'
import type { WebSocketServer } from 'ws'

const SERVICE = 'collab-service'
const logger = createLogger(SERVICE)

export function mountMetrics(app: Express): void {
  app.use(httpLoggerMiddleware({ service: SERVICE, logger }))
}

export function mountErrorHandler(app: express.Express): void {
  app.use(errorHandlerMiddleware({ service: SERVICE, logger }))
}

/**
 * 装到 ws.WebSocketServer — 自动记录 ws 连接/消息
 */
export function mountWsMetrics(wss: WebSocketServer): void {
  wsLoggerAttach(wss, { service: SERVICE, logger })
}

export { logger, SERVICE }
export default mountMetrics