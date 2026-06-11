import pino, { Logger as PinoLogger, LoggerOptions as PinoLoggerOptions, DestinationStream } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { trace, context } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';

export interface LoggerOptions {
  level?: string;
  pretty?: boolean;
  base?: Record<string, unknown>;
  redactPaths?: string[];
}

export interface LogContext {
  traceId?: string;
  spanId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

const contextStore = new AsyncLocalStorage<LogContext>();

/**
 * Inject a log context for the duration of `fn`.
 * Anything logged inside (even async) will pick up these fields.
 */
export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  const merged: LogContext = { ...(contextStore.getStore() ?? {}), ...ctx };
  return contextStore.run(merged, fn);
}

export function currentLogContext(): LogContext | undefined {
  return contextStore.getStore();
}

export function setLogContextField(key: string, value: unknown): void {
  const ctx = contextStore.getStore();
  if (ctx) ctx[key] = value;
}

function deriveTraceContext(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const sc = span.spanContext();
  if (!sc || !sc.traceId) return {};
  return { traceId: sc.traceId, spanId: sc.spanId };
}

export function createLogger(service: string, options: LoggerOptions = {}): PinoLogger {
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';
  const isDev = process.env.NODE_ENV !== 'production';
  const pretty = options.pretty ?? isDev;

  const base: Record<string, unknown> = {
    service,
    pid: process.pid,
    ...(options.base ?? {}),
  };

  const redact = options.redactPaths ?? [
    'password',
    '*.password',
    'token',
    '*.token',
    'authorization',
    '*.authorization',
    'cookie',
    '*.cookie',
  ];

  const pinoOptions: PinoLoggerOptions = {
    level,
    base,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact,
    mixin() {
      const ctx = contextStore.getStore();
      const tc = deriveTraceContext();
      return {
        ...(ctx ?? {}),
        ...(tc.traceId ? { traceId: tc.traceId } : {}),
        ...(tc.spanId ? { spanId: tc.spanId } : {}),
      };
    },
  };

  if (pretty) {
    const dest: DestinationStream = {
      write(msg: string) {
        process.stdout.write(msg);
      },
    } as DestinationStream;
    return pino(
      {
        ...pinoOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
            singleLine: false,
            destination: dest,
          },
        },
      },
      dest,
    );
  }

  return pino(pinoOptions);
}

export function newRequestId(): string {
  return randomUUID();
}

export function loggerWithContext(logger: PinoLogger, ctx: LogContext): PinoLogger {
  return logger.child(ctx) as PinoLogger;
}

export type Logger = PinoLogger;
