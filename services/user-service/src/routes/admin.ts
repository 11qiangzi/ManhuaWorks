/**
 * admin routes — admin 用户管理 + 统计 + 审计 + 系统设置 + 内容审核 + 日志
 *
 * P0 D4 — user-service admin 端点 (派单 22B)
 * 派单 32 — 补 admin/content + admin/logs (配合 41 HTML)
 * 派单 48 P2 — 谢擎 2026-06-10: 补 dashboard/overview, dashboard/revenue,
 *              admin/users POST, analytics, analytics/export (5 新端点)
 * 鉴权: requireAuth + requireRole(Role.Admin)
 *
 * 端点 (共 11):
 *   GET    /api/v1/admin/stats        — 统计仪表盘 (P1-4a)
 *   GET    /api/v1/admin/dashboard/overview — 运营总览 (P2 新增)
 *   GET    /api/v1/admin/dashboard/revenue  — 收入趋势 (P2 新增)
 *   GET    /api/v1/admin/audit-logs   — 审计日志查询 (P1-5c)
 *   GET    /api/v1/admin/settings     — 系统配置读取 (P1-5e)
 *   PATCH  /api/v1/admin/settings     — 系统配置写入 (P1-5e)
 *   GET    /api/v1/admin/content      — 内容审核列表 (派单 32 新增)
 *   GET    /api/v1/admin/logs         — 系统日志查询 (派单 32 新增)
 *   POST   /api/v1/admin/users        — 管理员创建用户 (P2 新增)
 *   GET    /api/v1/admin/analytics    — 分析面板 (P2 新增)
 *   GET    /api/v1/admin/analytics/export — 导出分析 (P2 新增)
 *
 * DB 表:
 *   audit_logs(id, user_id, action, status, ip_address, user_agent, detail, created_at)
 *   system_settings(key varchar PK, value jsonb, updated_at)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, getUser } from '@manhuaworks/shared';
import { Role } from '../models/user';
import { query } from '../config/db';
import { z } from 'zod';
import { BadRequestError } from '@manhuaworks/shared';

export const adminRouter = Router();

// ─── 全部端点: 鉴权 + admin 角色 ───
adminRouter.use(requireAuth());
adminRouter.use(requireRole(Role.Admin));

/* ============== GET /api/v1/admin/stats ============== */
adminRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      newUsersToday,
      activeUsers7d,
    ] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE status = 1"),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users WHERE created_at >= CURRENT_DATE"
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count FROM audit_logs
         WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 1`
      ),
    ]);

    // 跨服务查询：project-service / billing-service 统计
    let totalProjects = 0;
    let totalRevenue = 0;
    try {
      const projRes = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM projects"
      );
      totalProjects = Number(projRes.rows[0]?.count ?? 0);
    } catch { /* projects 表可能在 user-service 不直接可查 */ }

    try {
      const revRes = await query<{ sum: string }>(
        `SELECT COALESCE(SUM(balance_cents), 0)::text AS sum FROM user_balances`
      );
      totalRevenue = Math.round(Number(revRes.rows[0]?.sum ?? 0) / 100);
    } catch { /* user_balances 表可能不在 user-service DB */ }

    res.json({
      code: 0,
      message: 'ok',
      data: {
        totalUsers: Number(totalUsers.rows[0]?.count ?? 0),
        newUsersToday: Number(newUsersToday.rows[0]?.count ?? 0),
        activeUsers7d: Number(activeUsers7d.rows[0]?.count ?? 0),
        totalProjects,
        totalRevenue,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /api/v1/admin/audit-logs ============== */
const AuditLogQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
});

adminRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = AuditLogQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(q.userId);
    }
    if (q.action) {
      conditions.push(`action = $${idx++}`);
      params.push(q.action);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, user_id, action, status, ip_address, user_agent, detail, created_at
         FROM audit_logs ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM audit_logs ${where}`,
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

/* ============== GET /api/v1/admin/settings ============== */
adminRouter.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query<{ key: string; value: unknown; updated_at: Date }>(
      `SELECT key, value, updated_at FROM system_settings ORDER BY key`
    );

    const settings: Record<string, unknown> = {};
    for (const row of r.rows) {
      settings[row.key] = row.value;
    }

    res.json({
      code: 0,
      message: 'ok',
      data: settings,
    });
  } catch (e) {
    next(e);
  }
});

/* ============== PATCH /api/v1/admin/settings ============== */
const SettingsBody = z.object({
  updates: z.array(z.object({
    key: z.string().min(1).max(100),
    value: z.unknown(),
  })).min(1).max(50),
});

adminRouter.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SettingsBody.parse(req.body);
    const results: Array<{ key: string; updated: boolean }> = [];

    for (const { key, value } of body.updates) {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
      results.push({ key, updated: true });
    }

    res.json({
      code: 0,
      message: 'ok',
      data: { results },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_settings_body', e.flatten()));
    }
    next(e);
  }
});

/* ============== GET /api/v1/admin/content (派单 32 — 内容审核列表) ============== */
const ContentQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
});

adminRouter.get('/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ContentQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status) {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }
    if (q.search) {
      conditions.push(`(title ILIKE $${idx} OR username ILIKE $${idx})`);
      idx++;
      params.push(`%${q.search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, user_id, username, title, type, status, flag_reason, thumbnail_url, created_at, updated_at
         FROM content_review ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM content_review ${where}`,
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

/* ============== GET /api/v1/admin/logs (派单 32 — 系统日志查询) ============== */
const LogsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  level: z.string().optional(),
  service: z.string().optional(),
  userId: z.string().uuid().optional(),
});

adminRouter.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = LogsQuery.parse(req.query);
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
    if (q.userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(q.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, service, level, message, user_id, ip_address, detail, created_at
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

/* ============== GET /api/v1/admin/dashboard/overview ============== */
adminRouter.get('/dashboard/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      activeUsers7d,
      newUsers7d,
      totalProjects,
      activeProjects,
      totalRevenue,
      todayRevenue,
      pendingRefunds,
    ] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE status = 1"),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count FROM audit_logs
         WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 1`
      ),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
      ),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM projects"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM projects WHERE status = 1"),
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS sum FROM invoices WHERE status = 'paid'`
      ).catch(() => ({ rows: [{ sum: '0' }] })),
      query<{ sum: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS sum FROM invoices WHERE status = 'paid' AND issued_at >= CURRENT_DATE`
      ).catch(() => ({ rows: [{ sum: '0' }] })),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM refunds WHERE status = 'pending'"
      ).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    const totalRev = Math.round(Number(totalRevenue.rows[0]?.sum ?? 0) / 100);
    const todayRev = Math.round(Number(todayRevenue.rows[0]?.sum ?? 0) / 100);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        users: {
          total: Number(totalUsers.rows[0]?.count ?? 0),
          active7d: Number(activeUsers7d.rows[0]?.count ?? 0),
          new7d: Number(newUsers7d.rows[0]?.count ?? 0),
        },
        projects: {
          total: Number(totalProjects.rows[0]?.count ?? 0),
          active: Number(activeProjects.rows[0]?.count ?? 0),
        },
        revenue: {
          total: totalRev,
          today: todayRev,
          pendingRefunds: Number(pendingRefunds.rows[0]?.count ?? 0),
        },
        serverTime: new Date().toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /api/v1/admin/dashboard/revenue ============== */
const RevenueQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

adminRouter.get('/dashboard/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = RevenueQuery.parse(req.query);

    // 每日收入聚合
    const daily = await query<{ date: string; amount: string; count: string }>(
      `SELECT
         DATE(issued_at) AS date,
         COALESCE(SUM(amount_cents), 0)::text AS amount,
         COUNT(*)::text AS count
       FROM invoices
       WHERE status = 'paid'
         AND issued_at >= NOW() - $1::integer * INTERVAL '1 day'
       GROUP BY DATE(issued_at)
       ORDER BY date ASC`,
      [q.days]
    ).catch(() => ({ rows: [] }));

    // 月度收入聚合
    const monthly = await query<{ month: string; amount: string }>(
      `SELECT
         TO_CHAR(issued_at, 'YYYY-MM') AS month,
         COALESCE(SUM(amount_cents), 0)::text AS amount
       FROM invoices
       WHERE status = 'paid'
         AND issued_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(issued_at, 'YYYY-MM')
       ORDER BY month ASC`
    ).catch(() => ({ rows: [] }));

    res.json({
      code: 0,
      message: 'ok',
      data: {
        daily: daily.rows.map((r) => ({
          date: r.date,
          value: Math.round(Number(r.amount) / 100),
          orders: Number(r.count),
        })),
        monthly: monthly.rows.map((r) => ({
          month: r.month,
          value: Math.round(Number(r.amount) / 100),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ============== POST /api/v1/admin/users (管理员创建用户) ============== */
const CreateUserBody = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(5).max(20).optional(),
  displayName: z.string().min(1).max(50),
  role: z.number().int().min(1).max(5).default(1),
  plan: z.enum(['free', 'pro', 'studio', 'enterprise']).default('free'),
});

adminRouter.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateUserBody.parse(req.body);

    // 检查重复
    if (body.email) {
      const dup = await query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [body.email]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        return res.status(409).json({
          code: 40900,
          message: '邮箱已被注册',
          data: { field: 'email' },
        });
      }
    }
    if (body.phone) {
      const dup = await query<{ id: string }>(
        'SELECT id FROM users WHERE phone = $1 LIMIT 1',
        [body.phone]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        return res.status(409).json({
          code: 40900,
          message: '手机号已被注册',
          data: { field: 'phone' },
        });
      }
    }

    // 创建用户（无密码，需后续设密码/验证邮箱）
    const newUser = await query<{
      id: string; email: string; phone: string; display_name: string;
      role: number; status: number; created_at: string;
    }>(
      `INSERT INTO users (email, phone, display_name, role, status)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING id, email, phone, display_name, role, status, created_at`,
      [body.email ?? null, body.phone ?? null, body.displayName, body.role]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: newUser.rows[0],
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_user_body', e.flatten()));
    }
    next(e);
  }
});

/* ============== GET /api/v1/admin/analytics ============== */
adminRouter.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 并发查询多个数据源
    const [
      userGrowth,
      planDist,
      topCallers,
      apiUsage7d,
    ] = await Promise.all([
      // 7天用户增长
      query<{ date: string; count: string }>(
        `SELECT DATE(created_at) AS date, COUNT(*)::text AS count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '14 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      ),
      // 订阅分布
      query<{ plan: string; count: string }>(
        `SELECT s.plan, COUNT(*)::text AS count
         FROM subscriptions s
         GROUP BY s.plan
         ORDER BY count DESC`
      ).catch(() => ({ rows: [] })),
      // Top API 调用者
      query<{ user_id: string; display_name: string; calls: string; total_cost: string }>(
        `SELECT
           u.id AS user_id,
           COALESCE(u.display_name, u.email) AS display_name,
           COUNT(*)::text AS calls,
           COALESCE(SUM(l.cost_usd), 0)::text AS total_cost
         FROM api_call_logs l
         JOIN users u ON u.id = l.user_id
         WHERE l.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY u.id, u.display_name, u.email
         ORDER BY calls DESC
         LIMIT 10`
      ).catch(() => ({ rows: [] })),
      // 7天 API 使用趋势
      query<{ date: string; calls: string; cost: string }>(
        `SELECT
           DATE(created_at) AS date,
           COUNT(*)::text AS calls,
           COALESCE(SUM(cost_usd), 0)::text AS cost
         FROM api_call_logs
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        userGrowth: userGrowth.rows.map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
        planDistribution: planDist.rows.map((r) => ({
          plan: r.plan,
          count: Number(r.count),
        })),
        topCallers: topCallers.rows.map((r) => ({
          userId: r.user_id,
          name: r.display_name,
          calls: Number(r.calls),
          cost: Number(Number(r.total_cost).toFixed(4)),
        })),
        apiUsage7d: apiUsage7d.rows.map((r) => ({
          date: r.date,
          calls: Number(r.calls),
          costUsd: Number(Number(r.cost).toFixed(4)),
        })),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /api/v1/admin/analytics/export ============== */
const ExportQuery = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  type: z.enum(['users', 'revenue', 'api']).default('users'),
});

adminRouter.get('/analytics/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ExportQuery.parse(req.query);

    let data: Record<string, unknown>[] = [];

    if (q.type === 'users') {
      const r = await query(
        `SELECT u.id, u.email, u.display_name AS name, u.role, u.status,
                u.created_at, s.plan
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         ORDER BY u.created_at DESC
         LIMIT 10000`
      );
      data = r.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        email: row.email ?? '',
        name: row.name ?? '',
        role: Number(row.role),
        status: Number(row.status),
        plan: row.plan ?? 'free',
        createdAt: row.created_at,
      }));
    } else if (q.type === 'revenue') {
      const r = await query(
        `SELECT i.id, i.invoice_no, u.email, i.amount_cents,
                i.currency, i.status, i.issued_at
         FROM invoices i
         LEFT JOIN users u ON u.id = i.user_id
         ORDER BY i.issued_at DESC
         LIMIT 10000`
      ).catch(() => ({ rows: [] }));
      data = r.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        invoiceNo: row.invoice_no,
        userEmail: row.email ?? '',
        amount: Math.round(Number(row.amount_cents) / 100),
        currency: row.currency,
        status: row.status,
        issuedAt: row.issued_at,
      }));
    } else {
      const r = await query(
        `SELECT l.id, u.email, l.provider, l.model, l.call_type,
                l.input_tokens, l.output_tokens, l.cost_usd, l.latency_ms,
                l.status, l.created_at
         FROM api_call_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.created_at DESC
         LIMIT 10000`
      ).catch(() => ({ rows: [] }));
      data = r.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        userEmail: row.email ?? '',
        provider: row.provider,
        model: row.model,
        callType: row.call_type,
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        costUsd: Number(Number(row.cost_usd).toFixed(6)),
        latencyMs: Number(row.latency_ms),
        status: Number(row.status),
        createdAt: row.created_at,
      }));
    }

    if (q.format === 'csv' && data.length > 0) {
      const headers = Object.keys(data[0]!);
      const csv = [
        headers.join(','),
        ...data.map((row) => headers.map((h) => JSON.stringify(String(row[h] ?? ''))).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${q.type}-export-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    }

    res.json({
      code: 0,
      message: 'ok',
      data: {
        type: q.type,
        count: data.length,
        items: data,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return next(new BadRequestError('invalid_export_params', e.flatten()));
    }
    next(e);
  }
});

export default adminRouter;
