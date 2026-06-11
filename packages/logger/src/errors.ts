import type { Request, Response, NextFunction } from 'express';
import { getBuiltinMetrics } from './metrics';
import { runWithLogContext, currentLogContext, type Logger } from './logger';
import { currentTraceContext } from './tracer';

export interface ErrorHandlerOptions {
  service: string;
  logger: Logger;
  /** Map errors to status codes. Defaults to 500 unless err has `.status` or `.statusCode`. */
  statusOf?: (err: unknown) => number;
  /** Optional sink (Sentry/OTel). Called after logging. */
  reportError?: (err: Error, ctx: Record<string, unknown>) => void | Promise<void>;
}

function defaultStatusOf(err: unknown): number {
  if (!err) return 500;
  const e = err as { status?: number; statusCode?: number; status_code?: number };
  return e.status ?? e.statusCode ?? e.status_code ?? 500;
}

function isHttpErrorLike(err: unknown): err is Error {
  return err instanceof Error;
}

/**
 * Express error-handling middleware. Use AFTER all routes.
 *
 *   app.use(errorHandlerMiddleware({ service, logger }));
 */
export function errorHandlerMiddleware(opts: ErrorHandlerOptions) {
  const { service, logger, statusOf = defaultStatusOf, reportError } = opts;
  const builtin = getBuiltinMetrics(`manhuaworks_${service.replace(/-/g, '_')}_`);

  return function middleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const e = isHttpErrorLike(err) ? err : new Error(String(err));
    const status = statusOf(err);
    const requestId =
      (res.getHeader('X-Request-Id') as string | undefined) ??
      (req.headers['x-request-id'] as string | undefined);

    const kind =
      status >= 500 ? 'unhandled' : status >= 400 ? 'client_error' : 'other';
    builtin.errorsTotal.inc({ service, kind });

    const tc = currentTraceContext();
    const ctx = currentLogContext() ?? {};

    runWithLogContext({ ...ctx, requestId }, () => {
      logger.error(
        {
          ...ctx,
          err: {
            message: e.message,
            name: e.name,
            stack: e.stack,
            code: (e as { code?: string }).code,
          },
          status,
          method: req.method,
          url: req.originalUrl,
          traceId: tc?.traceId,
          spanId: tc?.spanId,
          requestId,
          type: 'http_error',
        },
        'http_request_error',
      );
    });

    if (reportError) {
      Promise.resolve(
        reportError(e, {
          service,
          status,
          requestId,
          url: req.originalUrl,
          method: req.method,
          traceId: tc?.traceId,
          spanId: tc?.spanId,
        }),
      ).catch(() => {
        /* swallow */
      });
    }

    if (res.headersSent) {
      return;
    }

    res.status(status).json({
      error: {
        message: status >= 500 ? 'internal_error' : e.message,
        code: (e as { code?: string }).code,
        requestId,
        traceId: tc?.traceId,
      },
    });
  };
}

/**
 * Wrap an async route handler to ensure thrown errors reach the express
 * error handler (Express 4 doesn't await async handlers by default).
 */
export function asyncRoute<TReq extends Request = Request, TRes extends Response = Response>(
  fn: (req: TReq, res: TRes, next: NextFunction) => Promise<unknown> | unknown,
): (req: TReq, res: TRes, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export interface CapturedError {
  err: Error;
  context: Record<string, unknown>;
}

/**
 * Capture an exception from anywhere (e.g. inside a cron, queue consumer).
 */
export function captureException(
  err: unknown,
  ctx: Record<string, unknown> = {},
  logger?: Logger,
  service = 'unknown',
): CapturedError {
  const e = err instanceof Error ? err : new Error(String(err));
  if (logger) {
    logger.error({ err: { message: e.message, name: e.name, stack: e.stack }, ...ctx }, 'exception_captured');
  }
  try {
    getBuiltinMetrics(`manhuaworks_${service.replace(/-/g, '_')}_`).errorsTotal.inc({
      service,
      kind: 'unhandled',
    });
  } catch {
    /* ignore */
  }
  return { err: e, context: ctx };
}
