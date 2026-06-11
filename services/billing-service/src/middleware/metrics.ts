/**
 * billing-service metrics middleware
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

const SERVICE = 'billing-service'
const logger = createLogger(SERVICE)

export function mountMetrics(app: Express): void {
  app.use(httpLoggerMiddleware({ service: SERVICE, logger }))
}

export function mountErrorHandler(app: express.Express): void {
  app.use(errorHandlerMiddleware({ service: SERVICE, logger }))
}

export { logger, SERVICE }
export default mountMetrics