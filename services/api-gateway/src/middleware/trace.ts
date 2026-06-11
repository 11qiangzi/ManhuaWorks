/**
 * api-gateway — trace 中间件
 *
 * ManhuaWorks L2 task 14
 *
 * 行为：
 *  1. 从入口 HTTP 头（traceparent / tracestate / baggage）提取 W3C context
 *  2. 用 context.with() 让所有 downstream fetch / pg / redis 都能拿到这个 parent
 *     （虽然 @opentelemetry/instrumentation-http 在 undici fetch 里会自动 extract，
 *      但我们显式做一次保险 —— 也方便响应头回写 X-Trace-Id）
 *  3. 在响应头里回写 X-Trace-Id + traceparent，让前端可以拿到并加到 X-Trace-Id
 *  4. 跳过 /health / /ready / /metrics（减少噪声）
 */
import type { MiddlewareHandler } from 'hono';
import { context, propagation, defaultTextMapGetter, defaultTextMapSetter, trace, type Context } from '@opentelemetry/api';
import { extractTraceparent, getCurrentTraceId, injectTraceparent } from '@manhuaworks/logger';
import type { AppEnv } from './auth.js';

const SKIP = new Set(['/health', '/ready', '/healthz', '/readyz', '/metrics', '/favicon.ico']);

function headerToString(v: string | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Hono 中间件：读入 traceparent → 写响应头 X-Trace-Id + traceparent
 */
export const traceMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path;

  if (SKIP.has(path)) {
    return next();
  }

  // 1. extract
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.header())) {
    const first = headerToString(v as unknown as string | undefined);
    if (first !== undefined) carrier[k] = first;
  }
  const parentCtx = propagation.extract(context.active(), carrier, defaultTextMapGetter);

  // 2. 把 parent ctx 包成 active，调用 next；next 内部业务代码 / downstream
  //    fetch / pg / redis 会从这个 active ctx 派生 child span
  await context.with(parentCtx, async () => {
    await next();
  });

  // 3. 写响应头
  const tid = getCurrentTraceId();
  if (tid) {
    c.header('X-Trace-Id', tid);
    try {
      const injected = injectTraceparent({} as Record<string, string>);
      const tp = (injected as Record<string, string>).traceparent;
      const ts = (injected as Record<string, string>).tracestate;
      if (tp) c.header('traceparent', tp);
      if (ts) c.header('tracestate', ts);
    } catch {
      /* noop */
    }
  }
};

/**
 * 工具：给 fetch 注入 traceparent header（Hono / undici / node-fetch 通用）
 */
export function traceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return injectTraceparent(extra);
}

/**
 * 工具：尝试从一个可能的 traceId 字符串里取 traceId（32 字符 hex）。
 * 供 controller 把 traceId 写到 body envelope 用。
 */
export function peekTraceId(): string | undefined {
  return getCurrentTraceId();
}

// 避免 unused warnings
void trace;
void defaultTextMapSetter;
void extractTraceparent;
