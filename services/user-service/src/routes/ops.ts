/**
 * ops routes — 运维端点 (健康检查 + 指标 + 服务列表 + 日志 + 告警 + 事件)
 *
 * P0 D4 — user-service ops 端点 (派单 22B)
 * 派单 32 — 补 ops/logs (配合 41 HTML)
 * 派单 48 P2 — 谢擎 2026-06-10: 补 overview, status, incidents,
 *              alerts, alerts/resolve, metrics/live, metrics/history (7 新端点)
 * 鉴权: requireAuth + requireRole(Role.Admin)
 *
 * 端点 (共 11):
 *   GET /api/v1/ops/health           — 5 核心服务心跳 (P1-6b)
 *   GET /api/v1/ops/metrics          — 各服务 /metrics 聚合 (P1-6c)
 *   GET /api/v1/ops/services         — 服务列表 + 端口 + 状态 (P1-6d)
 *   GET /api/v1/ops/logs             — 运维日志中心 (派单 32 新增)
 *   GET /api/v1/ops/overview         — 运维总览 (P2 新增)
 *   GET /api/v1/ops/status           — 实时系统状态 (P2 新增)
 *   GET /api/v1/ops/incidents        — 事件列表 (P2 新增)
 *   GET /api/v1/ops/alerts           — 告警列表 (P2 新增)
 *   POST /api/v1/ops/alerts/resolve  — 解决告警 (P2 新增)
 *   GET /api/v1/ops/metrics/live     — 实时指标 (P2 新增)
 *   GET /api/v1/ops/metrics/history  — 历史指标 (P2 新增)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@manhuaworks/shared';
import { Role } from '../models/user';
import { query } from '../config/db';
import { z } from 'zod';
import { BadRequestError } from '@manhuaworks/shared';

export const opsRouter = Router();

// ─── 全部端点: 鉴权 + admin ───
opsRouter.use(requireAuth());
opsRouter.use(requireRole(Role.Admin));

/** 服务注册表 */
const SERVICES: Array<{ name: string; host: string; port: number; description: string }> = [
  { name: 'user-service',    host: '127.0.0.1', port: 8088, description: '用户/鉴权/订阅/项目权限' },
  { name: 'project-service', host: '127.0.0.1', port: 8089, description: '项目/场景/分镜/角色' },
  { name: 'collab-service',  host: '127.0.0.1', port: 8091, description: '协作/团队/邀请/评论' },
  { name: 'billing-service', host: '127.0.0.1', port: 8090, description: '充值/计费/订单' },
  { name: 'ai-orchestrator', host: '127.0.0.1', port: 8087, description: 'AI 任务调度' },
];

/** 22D 谢擎: 单服务健康检查 (2s 超时, 不抛) */
async function checkServiceHealth(svc: { name: string; host: string; port: number }): Promise<{
  service: string;
  up: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2000);
    const resp = await fetch(`http://${svc.host}:${svc.port}/health`, {
      signal: ac.signal,
    });
    clearTimeout(timer);
    const up = resp.status >= 200 && resp.status < 400;
    return {
      service: svc.name,
      up,
      latencyMs: Date.now() - start,
      error: up ? undefined : `HTTP ${resp.status}`,
    };
  } catch (e: unknown) {
    const err = e as Error;
    return {
      service: svc.name,
      up: false,
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'timeout (2s)' : err.message,
    };
  }
}

/* ============== GET /api/v1/ops/health ============== */
opsRouter.get('/health', async (_req: Request, res: Response) => {
  // 22D 谢擎: Promise.allSettled 并行检查, 防串行 5×2s=10s 超时
  const settled = await Promise.allSettled(
    SERVICES.map((svc) => checkServiceHealth(svc))
  );
  const results = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { service: 'unknown', up: false, latencyMs: 0, error: String(r.reason) }
  );

  const allUp = results.every((r) => r.up);

  res.json({
    code: 0,
    message: allUp ? 'all_healthy' : 'some_services_down',
    data: {
      services: results,
      summary: {
        total: results.length,
        up: results.filter((r) => r.up).length,
        down: results.filter((r) => !r.up).length,
      },
    },
  });
});

/* ============== GET /api/v1/ops/services ============== */
opsRouter.get('/services', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      items: SERVICES,
      total: SERVICES.length,
    },
  });
});

/* ============== GET /api/v1/ops/metrics ============== */
opsRouter.get('/metrics', async (_req: Request, res: Response) => {
  // 22D 谢擎: Promise.allSettled 并行, 2s 超时
  const settled = await Promise.allSettled(
    SERVICES.map(async (svc) => {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 2000);
        const resp = await fetch(`http://${svc.host}:${svc.port}/metrics`, {
          signal: ac.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const text = await resp.text();
          try {
            return { service: svc.name, port: svc.port, available: true, data: JSON.parse(text) };
          } catch {
            return { service: svc.name, port: svc.port, available: true, data: { raw: text.slice(0, 500) } };
          }
        }
        return { service: svc.name, port: svc.port, available: false, error: `HTTP ${resp.status}` };
      } catch (e: unknown) {
        return { service: svc.name, port: svc.port, available: false, error: (e as Error).message };
      }
    })
  );

  const results = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { service: 'unknown', port: 0, available: false, error: String(r.reason) }
  );

  res.json({
    code: 0,
    message: 'ok',
    data: { services: results },
  });
});

/* ============== GET /api/v1/ops/logs (派单 32 — 运维日志中心) ============== */
const OpsLogsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  level: z.string().optional(),
  service: z.string().optional(),
});

opsRouter.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = OpsLogsQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.level) {
      conditions.push(`level = $${idx++}`);
      params.push(q.level.toUpperCase());
    }
    if (q.service) {
      conditions.push(`service = $${idx++}`);
      params.push(q.service);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, service, level, message, detail, created_at
         FROM system_logs ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM system_logs ${where}`,
        params
      ),
    ]);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        items: dataRes.rows,
        total: Number(countRes.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =============================================================
 * P2 新增端点 (派单 48 — 谢擎 2026-06-10)
 * ============================================================= */

/* ============== GET /api/v1/ops/overview ============== */
opsRouter.get('/overview', async (_req: Request, res: Response) => {
  // 并行检查所有服务健康状态
  const settled = await Promise.allSettled(
    SERVICES.map((svc) => checkServiceHealth(svc))
  );
  const healthResults = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { service: 'unknown', up: false, latencyMs: 0, error: String(r.reason) }
  );

  const upCount = healthResults.filter((r) => r.up).length;
  const allUp = upCount === SERVICES.length;

  // 从 DB 读取一些系统指标
  let dbStats = {
    totalUsers: 0,
    totalProjects: 0,
    logs24h: 0,
  };
  try {
    const [u, p, l] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM projects"),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM system_logs WHERE created_at >= NOW() - INTERVAL '24 hours'"
      ),
    ]);
    dbStats = {
      totalUsers: Number(u.rows[0]?.count ?? 0),
      totalProjects: Number(p.rows[0]?.count ?? 0),
      logs24h: Number(l.rows[0]?.count ?? 0),
    };
  } catch { /* DB 不可达时使用默认值 */ }

  res.json({
    code: 0,
    message: allUp ? 'all_healthy' : 'degraded',
    data: {
      health: {
        status: allUp ? 'healthy' : 'degraded',
        services: healthResults,
        summary: { total: SERVICES.length, up: upCount, down: SERVICES.length - upCount },
      },
      stats: dbStats,
      serverTime: new Date().toISOString(),
    },
  });
});

/* ============== GET /api/v1/ops/status ============== */
opsRouter.get('/status', async (_req: Request, res: Response) => {
  const settled = await Promise.allSettled(
    SERVICES.map(async (svc) => {
      const h = await checkServiceHealth(svc);
      return {
        name: svc.name,
        port: svc.port,
        up: h.up,
        latencyMs: h.latencyMs,
        error: h.error,
        lastCheck: new Date().toISOString(),
      };
    })
  );

  const services = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', port: 0, up: false, latencyMs: 0, error: String(r.reason), lastCheck: new Date().toISOString() }
  );

  const upCount = services.filter((s) => s.up).length;
  res.json({
    code: 0,
    message: 'ok',
    data: {
      overall: upCount === SERVICES.length ? 'operational' : upCount > 0 ? 'degraded' : 'down',
      services,
      checkedAt: new Date().toISOString(),
    },
  });
});

/* ============== GET /api/v1/ops/incidents ============== */
const IncidentsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'resolved', 'all']).default('all'),
  severity: z.enum(['critical', 'major', 'minor', 'all']).default('all'),
});

opsRouter.get('/incidents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = IncidentsQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }
    if (q.severity !== 'all') {
      conditions.push(`severity = $${idx++}`);
      params.push(q.severity);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, title, severity, status, service, description, created_at, resolved_at
         FROM incidents ${where}
         ORDER BY
           CASE severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 END,
           created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::text AS count FROM incidents ${where}`,
        params
      ).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        items: dataRes.rows,
        total: Number(countRes.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_incidents_query', e.flatten()));
    }
    next(e);
  }
});

/* ============== GET /api/v1/ops/alerts ============== */
const AlertsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  level: z.enum(['error', 'warn', 'info', 'all']).default('all'),
  resolved: z.coerce.boolean().optional(),
});

opsRouter.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = AlertsQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.level !== 'all') {
      conditions.push(`level = $${idx++}`);
      params.push(q.level);
    }
    if (q.resolved !== undefined) {
      conditions.push(`resolved = $${idx++}`);
      params.push(q.resolved);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, service, level, title, detail, resolved, created_at, resolved_at
         FROM alerts ${where}
         ORDER BY
           CASE level WHEN 'error' THEN 1 WHEN 'warn' THEN 2 WHEN 'info' THEN 3 END,
           created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::text AS count FROM alerts ${where}`,
        params
      ).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        items: dataRes.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          level: r.level,
          title: r.title,
          detail: r.detail,
          service: r.service ?? 'system',
          resolved: r.resolved,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at ?? null,
        })),
        total: Number(countRes.rows[0]?.count ?? 0),
        limit: q.limit,
        offset: q.offset,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_alerts_query', e.flatten()));
    }
    next(e);
  }
});

/* ============== POST /api/v1/ops/alerts/resolve ============== */
const ResolveAlertBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

opsRouter.post('/alerts/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ResolveAlertBody.parse(req.body);
    const now = new Date().toISOString();

    const placeholders = body.ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `UPDATE alerts
       SET resolved = true, resolved_at = $${body.ids.length + 1}
       WHERE id IN (${placeholders}) AND resolved = false
       RETURNING id`,
      [...body.ids, now]
    ).catch(() => ({ rows: [] }));

    res.json({
      code: 0,
      message: 'resolved',
      data: {
        resolved: result.rows.map((r: Record<string, unknown>) => r.id),
        count: result.rowCount ?? 0,
        resolvedAt: now,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_resolve_body', e.flatten()));
    }
    next(e);
  }
});

/* ============== GET /api/v1/ops/metrics/live ============== */
opsRouter.get('/metrics/live', async (_req: Request, res: Response) => {
  // 实时指标快照：DB 连接池 + 最近1分钟的请求统计
  const [
    dbPool,
    recentLogs,
    recentApiCalls,
  ] = await Promise.all([
    query<{ active: string; idle: string; waiting: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE state = 'active')::text AS active,
         COUNT(*) FILTER (WHERE state = 'idle')::text AS idle,
         COUNT(*) FILTER (WHERE wait_event IS NOT NULL)::text AS waiting
       FROM pg_stat_activity
       WHERE backend_type = 'client backend'`
    ),
    query<{ level: string; count: string }>(
      `SELECT level, COUNT(*)::text AS count
       FROM system_logs
       WHERE created_at >= NOW() - INTERVAL '5 minutes'
       GROUP BY level`
    ).catch(() => ({ rows: [] })),
    query<{ count: string; avg_latency: string }>(
      `SELECT
         COUNT(*)::text AS count,
         COALESCE(AVG(latency_ms), 0)::text AS avg_latency
       FROM api_call_logs
       WHERE created_at >= NOW() - INTERVAL '1 minute'`
    ).catch(() => ({ rows: [{ count: '0', avg_latency: '0' }] })),
  ]);

  const totalConnections = Number(dbPool.rows[0]?.active ?? 0) + Number(dbPool.rows[0]?.idle ?? 0);

  res.json({
    code: 0,
    message: 'ok',
    data: {
      database: {
        activeConnections: Number(dbPool.rows[0]?.active ?? 0),
        idleConnections: Number(dbPool.rows[0]?.idle ?? 0),
        waitingQueries: Number(dbPool.rows[0]?.waiting ?? 0),
        totalConnections,
      },
      logs5m: recentLogs.rows.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
        acc[String(r.level)] = Number(r.count);
        return acc;
      }, {}),
      apiCalls1m: {
        count: Number(recentApiCalls.rows[0]?.count ?? 0),
        avgLatencyMs: Math.round(Number(recentApiCalls.rows[0]?.avg_latency ?? 0)),
      },
      sampledAt: new Date().toISOString(),
    },
  });
});

/* ============== GET /api/v1/ops/metrics/history ============== */
const MetricsHistoryQuery = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
  resolution: z.enum(['1m', '5m', '1h']).default('1h'),
});

opsRouter.get('/metrics/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = MetricsHistoryQuery.parse(req.query);

    const intervalMap: Record<string, string> = {
      '1m': '1 minute',
      '5m': '5 minutes',
      '1h': '1 hour',
    };
    const truncMap: Record<string, string> = {
      '1m': 'minute',
      '5m': 'minute',
      '1h': 'hour',
    };

    const interval = intervalMap[q.resolution] ?? '1 hour';
    const trunc = truncMap[q.resolution] ?? 'hour';

    // 历史 API 调用趋势
    const apiTrend = await query<{ bucket: string; calls: string; avg_latency: string; errors: string }>(
      `SELECT
         DATE_TRUNC('${trunc}', created_at) AS bucket,
         COUNT(*)::text AS calls,
         COALESCE(AVG(latency_ms), 0)::text AS avg_latency,
         COUNT(*) FILTER (WHERE status != 0)::text AS errors
       FROM api_call_logs
       WHERE created_at >= NOW() - $1::integer * INTERVAL '${interval}'
       GROUP BY DATE_TRUNC('${trunc}', created_at)
       ORDER BY bucket ASC`,
      [q.hours]
    ).catch(() => ({ rows: [] }));

    // 历史日志趋势
    const logTrend = await query<{ bucket: string; level: string; count: string }>(
      `SELECT
         DATE_TRUNC('${trunc}', created_at) AS bucket,
         level,
         COUNT(*)::text AS count
       FROM system_logs
       WHERE created_at >= NOW() - $1::integer * INTERVAL '${interval}'
       GROUP BY DATE_TRUNC('${trunc}', created_at), level
       ORDER BY bucket ASC`,
      [q.hours]
    ).catch(() => ({ rows: [] }));

    // 将日志数据按 bucket 聚合
    const logByBucket: Record<string, Record<string, number>> = {};
    for (const r of logTrend.rows) {
      const b = String(r.bucket);
      if (!logByBucket[b]) logByBucket[b] = {};
      logByBucket[b]![String(r.level)] = Number(r.count);
    }

    res.json({
      code: 0,
      message: 'ok',
      data: {
        apiTrend: apiTrend.rows.map((r: Record<string, unknown>) => ({
          bucket: r.bucket,
          calls: Number(r.calls),
          avgLatencyMs: Math.round(Number(r.avg_latency)),
          errors: Number(r.errors),
        })),
        logTrend: Object.entries(logByBucket).map(([bucket, levels]) => ({
          bucket,
          ...levels,
        })).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))),
        resolution: q.resolution,
        hours: q.hours,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_metrics_history', e.flatten()));
    }
    next(e);
  }
});

export default opsRouter;
