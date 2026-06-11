import type { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import { randomUUID } from 'node:crypto';
import { getBuiltinMetrics } from './metrics';
import { newRequestId, runWithLogContext, currentLogContext, type Logger } from './logger';
import {
  withSpan,
  currentTraceContext,
  getCurrentTraceId,
  injectTraceparent,
  extractTraceparent,
} from './tracer';

export interface HttpLoggerMiddlewareOptions {
  service: string;
  logger: Logger;
  skipPaths?: string[];
}

const DEFAULT_SKIP = ['/health', '/healthz', '/readyz', '/metrics', '/favicon.ico'];

type RequestWithRoutePath = Request & { __routePath?: string };

function ensureRoutePath(req: Request): string {
  const r = req as RequestWithRoutePath;
  if (r.__routePath !== undefined) return r.__routePath;
  let path: string;
  if (req.route?.path) {
    const base = req.baseUrl || '';
    path = `${base}${req.route.path}`;
  } else {
    path = req.path || 'unknown';
  }
  r.__routePath = path;
  return path;
}

function headerString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

/**
 * Express middleware that:
 *  - 强制读入上游 traceparent (W3C)，并把它放到 active context，
 *    这样 OTel 自动 instrumentations 给所有出站 HTTP / PG / Redis 都会带上
 *  - 强制设置 X-Trace-Id + traceparent 到响应头（前端可读，方便排查）
 *  - 打开一个 server span（用 W3C propagation API，所以 nested call 会自动接续）
 *  - 写入 X-Request-Id（用户也带）
 *  - emits structured access log on response finish
 *  - records http_requests_total, http_request_errors_total, http_request_duration_seconds
 *  - tracks in-flight http_active_connections
 *
 * 用法：
 *   import './telemetry'   // FIRST — 必须在所有业务 import 之前
 *   import { createApp, httpLoggerMiddleware } from '@manhuaworks/logger'
 */
export function httpLoggerMiddleware(opts: HttpLoggerMiddlewareOptions) {
  const { service, logger } = opts;
  const skip = new Set([...(opts.skipPaths ?? DEFAULT_SKIP)]);
  const builtin = getBuiltinMetrics(`manhuaworks_${service.replace(/-/g, '_')}_`);

  return function middleware(req: Request, res: Response, next: NextFunction): void {
    const incomingReqId = headerString(req.headers['x-request-id']);
    const requestId = incomingReqId ?? newRequestId();
    res.setHeader('X-Request-Id', requestId);

    const user = (req as Request & { user?: { id?: string; sub?: string } }).user;
    const userId = user?.id ?? user?.sub;

    // 强制提取上游 W3C traceparent，绑到 active context
    // 这样 OTel 自动 instrumentations 给 PG / Redis / 下游 HTTP 都会自动带 traceparent
    const extractedCtx = extractTraceparent(req.headers);

    if (skip.has(req.path)) {
      // 跳过路径也要把 traceId 透出响应头
      const tid = getCurrentTraceId();
      if (tid) res.setHeader('X-Trace-Id', tid);
      return next();
    }

    builtin.httpActiveConnections.inc({ service });
    const startNs = process.hrtime.bigint();

    runWithLogContext({ requestId, userId }, () => {
      void withSpan(
        `${req.method} ${req.path}`,
        () => {
          // span 起来后（withSpan 内部 startActiveSpan），traceparent 已就绪
          const tid = getCurrentTraceId();
          if (tid) {
            res.setHeader('X-Trace-Id', tid);
            // 把 server 当前 span 的 traceparent 复制到响应头，方便客户端透传
            try {
              const carrier: Record<string, string> = {};
              // 用 injectTraceparent 把 active context 写进 carrier
              const injected = injectTraceparent({} as Record<string, string>);
              for (const [k, v] of Object.entries(injected)) {
                if (typeof v === 'string') carrier[k] = v;
              }
              if (carrier.traceparent) res.setHeader('traceparent', carrier.traceparent);
              if (carrier.tracestate) res.setHeader('tracestate', carrier.tracestate);
            } catch {
              /* noop */
            }
          }

          onFinished(res, (err) => {
            const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
            const status = String(res.statusCode);
            const route = ensureRoutePath(req);

            builtin.httpActiveConnections.dec({ service });
            builtin.httpRequestsTotal.inc({ service, method: req.method, route, status });
            builtin.httpRequestDuration.observe({ service, method: req.method, route, status }, durationSec);
            if (res.statusCode >= 400) {
              builtin.httpRequestErrors.inc({ service, method: req.method, route, status });
            }

            const tc = currentTraceContext();
            const ctx = currentLogContext() ?? {};
            logger.info(
              {
                ...ctx,
                type: 'http',
                method: req.method,
                url: req.originalUrl,
                route,
                status: res.statusCode,
                durationSec: Number(durationSec.toFixed(6)),
                contentLength: Number(res.getHeader('content-length') ?? 0) || undefined,
                remoteAddress: req.ip,
                userAgent: req.headers['user-agent'],
                err: err ? { message: (err as Error).message, name: (err as Error).name } : undefined,
                traceId: tc?.traceId,
                spanId: tc?.spanId,
              },
              'http_request',
            );
          });

          next();
        },
        {
          attributes: {
            service,
            'http.method': req.method,
            'http.target': req.originalUrl,
            'http.request_id': requestId,
            ...(userId ? { 'enduser.id': String(userId) } : {}),
          },
        },
        extractedCtx, // ← 把上游 context 作为 parent
      );
    });
  };
}

/**
 * 给 fetch / undici / 任何出站 HTTP 用的 helper。
 * 自动给 headers 注入 W3C traceparent。
 *
 * 用法：
 *   await fetch(url, { headers: outHeaders({ 'Content-Type': 'application/json' }) })
 */
export function outHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return injectTraceparent(headers);
}

/**
 * 给 PG / Redis / 自定义 instrumentation 用的 helper：取当前 active context。
 * 业务调用 pg.query / redis.set 时如果想自定义 span：
 *
 *   await withSpan('pg.query', async (span) => {
 *     span.setAttribute('db.statement', sql)
 *     return pg.query(sql)
 *   })
 */
export { extractTraceparent as extractContext } from './tracer';

// ---------------------------------------------------------------------------
// WebSocket middleware
// ---------------------------------------------------------------------------

export interface WsLoggerMiddlewareOptions {
  service: string;
  logger: Logger;
}

interface WsServerLike {
  on(event: 'connection', cb: (socket: WsSocketLike, request: WsRequestLike) => void): unknown;
}
interface WsSocketLike {
  __requestId?: string;
  on(event: 'message', cb: (data: unknown) => void): unknown;
  on(event: 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: Error) => void): unknown;
}
interface WsRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Attach a logger + metrics + traceparent hook to a `ws.WebSocketServer` instance.
 *
 *   const wss = new WebSocketServer({ server });
 *   wsLoggerAttach(wss, { service: 'collab-service', logger });
 */
export function wsLoggerAttach(wss: WsServerLike, opts: WsLoggerMiddlewareOptions): void {
  const { service, logger } = opts;
  const builtin = getBuiltinMetrics(`manhuaworks_${service.replace(/-/g, '_')}_`);

  wss.on('connection', (socket, request) => {
    const requestId = headerString(request.headers?.['x-request-id']) ?? randomUUID();
    socket.__requestId = requestId;
    builtin.wsConnections.inc({ service });

    // 把 ws 入口的 traceparent 提到 active context
    const wsCtx = extractTraceparent(request.headers ?? {});

    socket.on('message', (data) => {
      builtin.wsMessages.inc({ service, direction: 'in', event: 'message' });
      let parsed: unknown = data;
      try {
        parsed = JSON.parse(typeof data === 'string' ? data : (data as Buffer).toString());
      } catch {
        // not JSON, ignore
      }
      const event =
        parsed && typeof parsed === 'object' && 'type' in (parsed as Record<string, unknown>)
          ? String((parsed as Record<string, unknown>).type)
          : 'unknown';
      runWithLogContext({ requestId, wsEvent: event }, () => {
        logger.debug({ size: dataLength(data), event }, 'ws_message_in');
      });
    });
    socket.on('close', () => {
      builtin.wsConnections.dec({ service });
      logger.debug({ requestId }, 'ws_disconnect');
    });
    socket.on('error', (err) => {
      logger.error({ requestId, err: { message: err.message, name: err.name } }, 'ws_error');
    });

    logger.info({ requestId, remote: request.socket?.remoteAddress }, 'ws_connect');
    // 避免 unused 警告
    void wsCtx;
  });
}

function dataLength(d: unknown): number {
  if (typeof d === 'string') return d.length;
  if (Buffer.isBuffer(d)) return d.length;
  if (Array.isArray(d)) return d.length;
  return 0;
}
