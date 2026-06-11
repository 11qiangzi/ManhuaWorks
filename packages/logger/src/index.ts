/**
 * @manhuaworks/logger
 *
 * Structured logging (pino) + OpenTelemetry tracer + prom-client metrics
 * + express/ws middleware (traceId/spanId/requestId/userId).
 *
 * Public surface:
 *   - createLogger(service, options)
 *   - tracer / getTracer / withSpan / currentTraceContext
 *   - metrics / register / counter / gauge / histogram / summary
 *   - httpLoggerMiddleware (express)
 *   - wsLoggerMiddleware (ws server)
 *   - errorHandlerMiddleware (express)
 *   - captureException(logger, metrics)
 */

export * from './logger';
export * from './tracer';
export * from './metrics';
export * from './middleware';
export * from './errors';

export type { Logger, LoggerOptions } from './logger';
export type { Span, TraceContext } from './tracer';
export type {
  Counter,
  Gauge,
  Histogram,
  Summary,
  MetricLabels,
  MetricsRegistry,
} from './metrics';
