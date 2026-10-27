/**
 * ManhuaWorks API Gateway —— 主入口
 *
 * 职责：
 *   1. 启动 Hono，监听 8080
 *   2. 挂载全局中间件：CORS、日志、限流、鉴权
 *   3. 暴露 /health、/ready
 *   4. 后续业务路由由各个后端服务接入（这里留个 /v1 占位）
 *
 * 退出策略：
 *   - SIGTERM / SIGINT → 优雅关闭：停 listen → 关 Redis → exit 0
 */

import './telemetry.js'; // MUST be first — OpenTelemetry SDK init (instrumentation hooks module load)
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { loadConfig } from './config.js';
import { closeRedis } from './redis.js';
import healthRoute from './routes/health.js';
import { jwtAuth, requireAuth, requireRole, signToken } from './middleware/auth.js';
import { rateLimit } from './middleware/ratelimit.js';
import { traceMiddleware, traceHeaders, peekTraceId } from './middleware/trace.js';
import type { AppEnv } from './middleware/auth.js';

const cfg = loadConfig();
const app = new Hono<AppEnv>();

// ──────────────────────────────────────────────────────────
// 全局中间件
// ──────────────────────────────────────────────────────────

// 链路追踪：最优先，读入 traceparent + 写响应头 X-Trace-Id
app.use('*', traceMiddleware);

app.use('*', honoLogger());
app.use('*', cors({ origin: cfg.CORS_ORIGIN }));

// 鉴权：仅解析 token，不强制
app.use('*', jwtAuth);

// 全局限流（per identity per minute）
app.use('*', rateLimit({ bucket: 'global' }));

// ──────────────────────────────────────────────────────────
// 探活路由（不消耗限流配额的话可以挂到 router 后面，
//   但实际上 K8s 探活要算进限流也无伤大雅，先保持一致）
// ──────────────────────────────────────────────────────────

app.route('/', healthRoute);

// ──────────────────────────────────────────────────────────
// Dev 工具：本地签 token（生产环境不存在此路由 —— 由 env 控制）
// ──────────────────────────────────────────────────────────

if (cfg.NODE_ENV !== 'production') {
  app.post('/dev/token', async (c) => {
    // Hono Node Adapter 下 c.req.json() 兼容 json / form-urlencoded
    let body: any = {};
    try {
      const contentType = c.req.header('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else {
        body = await c.req.parseBody();
      }
    } catch {
      body = {};
    }
    const sub = (body.sub as string) || 'usr_dev';
    const role = (body.role as 'L1' | 'L2' | 'L3' | 'L4' | 'L5') || 'L1';
    const ttl = Number(body.ttlSec ?? 3600);
    const token = await signToken({ sub, role, ttlSec: ttl });
    return c.json({ token, sub, role, ttlSec: ttl });
  });
}

// ──────────────────────────────────────────────────────────
// 业务路由占位（每个服务一个前缀，proxy 到对应业务服务）
// ──────────────────────────────────────────────────────────

// 简单代理：把 /v1/users/* 转给 user-service（:8081），其它同理
// 这里用 Hono 的 fetch 转发，配置化便于以后扩展
// 注意：路由必须**先于** /v1/admin/* 等其他业务路由注册，否则会被 /v1/* 兜底
const SERVICE_UPSTREAM: Record<string, { target: string; prefix: string }> = {
  '/v1/users':    { target: process.env.USER_SERVICE_URL      ?? 'http://localhost:8081', prefix: '/v1/users' },
  '/v1/projects': { target: process.env.PROJECT_SERVICE_URL  ?? 'http://localhost:8082', prefix: '/v1/projects' },
  '/v1/billing':  { target: process.env.BILLING_SERVICE_URL  ?? 'http://localhost:8083', prefix: '/v1/billing' },
  '/v1/ai':       { target: process.env.AI_ORCHESTRATOR_URL  ?? 'http://localhost:8084', prefix: '/v1/ai' },
  '/v1/collab':    { target: process.env.COLLAB_SERVICE_URL    ?? 'http://localhost:8091', prefix: '/v1/collab' },
  '/v1/assets':    { target: process.env.ASSET_SERVICE_URL     ?? 'http://localhost:8085', prefix: '/v1/assets' },
  '/v1/workflows': { target: process.env.WORKFLOW_ENGINE_URL   ?? 'http://localhost:8084', prefix: '/v1/workflows' },
};

function buildProxyHandler(serviceKey: string) {
  return async (c: any) => {
    const upstream = SERVICE_UPSTREAM[serviceKey]!;
    const target = upstream.target.replace(/\/+$/, '') + new URL(c.req.url).pathname + new URL(c.req.url).search;
    try {
      const headers = new Headers(c.req.raw.headers);
      const user = c.get('user');
      if (user) {
        headers.set('x-user-id', user.sub);
        headers.set('x-user-role', user.role);
      }
      headers.delete('host');
      headers.delete('content-length');

      const init: RequestInit = {
        method: c.req.method,
        headers: traceHeaders(Object.fromEntries(headers.entries())),
        body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.raw.arrayBuffer(),
        redirect: 'manual',
      };
      const upstreamRes = await fetch(target, init);
      const buf = await upstreamRes.arrayBuffer();

      // 在响应头里写 X-Trace-Id，让前端可以拿到（前端会从这读出来 console.log 便于调试）
      const resHeaders = new Headers(upstreamRes.headers);
      const tid = peekTraceId();
      if (tid) resHeaders.set('X-Trace-Id', tid);
      return new Response(buf, { status: upstreamRes.status, headers: resHeaders });
    } catch (err) {
      return c.json(
        {
          error: 'upstream_unavailable',
          message: `上游服务 ${serviceKey} 不可达`,
          detail: (err as Error).message,
        },
        502,
      );
    }
  };
}

// 按 serviceKey 分别挂载（顺序：先 ALL 代理路由，再 admin 演示路由）
// Hono v4 的 RegExpRouter 语法：通配用 `/v1/users/*` 这种（不是 path-to-regexp v6 的 {/*any}）
for (const key of Object.keys(SERVICE_UPSTREAM)) {
  const pattern = SERVICE_UPSTREAM[key]!.prefix + '/*';
  app.all(pattern, requireAuth, buildProxyHandler(key));
}

// 演示路由：受 RBAC 保护，便于本地手测
app.get('/v1/admin/ping', requireAuth, requireRole('L3'), (c) => {
  const u = c.get('user')!;
  return c.json({ pong: true, user: u });
});

// ──────────────────────────────────────────────────────────
// 错误兜底
// ──────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404));

app.onError((err, c) => {
  console.error('[gateway] unhandled error:', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

// ──────────────────────────────────────────────────────────
// 启动
// ──────────────────────────────────────────────────────────

const server = serve({ fetch: app.fetch, port: cfg.PORT, hostname: cfg.HOST }, (info) => {
  console.log(`[gateway] listening on http://${info.address}:${info.port}  env=${cfg.NODE_ENV}`);
  console.log(`[gateway] readiness targets: ${cfg.readiness.map((t) => t.name).join(', ')}`);
});

const shutdown = async (signal: string) => {
  console.log(`[gateway] received ${signal}, shutting down...`);
  server.close();
  await closeRedis().catch(() => undefined);
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
