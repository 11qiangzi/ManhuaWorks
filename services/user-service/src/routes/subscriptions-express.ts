/**
 * subscriptions Express routes — 用户订阅查询 + 管理
 *
 * 派单 32B — 谢擎 🗄️
 * 原因: 原 Hono subscriptions.ts 未挂载到 Express app, 41 HTML 中 portal-settings 无后端
 * 鉴权: requireAuth
 * DB: subscriptions 表 (user-service schema)
 *
 * 端点:
 *   GET    /api/v1/subscriptions/me     当前用户订阅
 *   POST   /api/v1/subscriptions/me     创建/升级订阅
 *   PATCH  /api/v1/subscriptions/me/renew 续费
 *   DELETE /api/v1/subscriptions/me     退订
 *   GET    /api/v1/subscriptions        全部订阅 (admin)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@manhuaworks/shared';
import { query } from '../config/db';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '@manhuaworks/shared';

export const subscriptionsRouter = Router();

// ─── 全部端点需登录 ───
subscriptionsRouter.use(requireAuth());

/* ============== GET /api/v1/subscriptions/me ============== */
subscriptionsRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const r = await query(
      `SELECT id, user_id, plan, started_at, expires_at, auto_renew, created_at
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    );

    if (r.rowCount === 0) {
      // Auto-create default free subscription
      const created = await query(
        `INSERT INTO subscriptions (user_id, plan, auto_renew, started_at)
         VALUES ($1, 'free', false, NOW())
         RETURNING id, user_id, plan, started_at, expires_at, auto_renew, created_at`,
        [req.user.id]
      );
      return res.json({ code: 0, message: 'ok', data: created.rows[0] });
    }

    res.json({ code: 0, message: 'ok', data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

/* ============== POST /api/v1/subscriptions/me (升级/创建) ============== */
const UpsertBody = z.object({
  plan: z.enum(['free', 'pro', 'team']),
  auto_renew: z.boolean().optional(),
});

subscriptionsRouter.post('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const body = UpsertBody.parse(req.body);

    const r = await query(
      `INSERT INTO subscriptions (user_id, plan, auto_renew, started_at, expires_at)
       VALUES ($1, $2, $3, NOW(), CASE WHEN $2 = 'free' THEN NULL ELSE NOW() + INTERVAL '1 month' END)
       ON CONFLICT (user_id) DO UPDATE
       SET plan = $2, auto_renew = $3,
           started_at = CASE WHEN subscriptions.plan = $2 THEN subscriptions.started_at ELSE NOW() END,
           expires_at = CASE WHEN $2 = 'free' THEN NULL ELSE NOW() + INTERVAL '1 month' END
       RETURNING id, user_id, plan, started_at, expires_at, auto_renew, created_at`,
      [req.user.id, body.plan, body.auto_renew ?? false]
    );

    res.json({ code: 0, message: 'updated', data: r.rows[0] });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new BadRequestError('invalid_plan', e.flatten()));
    next(e);
  }
});

/* ============== PATCH /api/v1/subscriptions/me/renew ============== */
subscriptionsRouter.patch('/me/renew', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const r = await query(
      `UPDATE subscriptions
       SET auto_renew = true, expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + INTERVAL '1 month'
       WHERE user_id = $1
       RETURNING id, user_id, plan, started_at, expires_at, auto_renew, created_at`,
      [req.user.id]
    );

    if (r.rowCount === 0) throw new NotFoundError('subscription_not_found');
    res.json({ code: 0, message: 'renewed', data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

/* ============== DELETE /api/v1/subscriptions/me ============== */
subscriptionsRouter.delete('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const r = await query(
      `UPDATE subscriptions
       SET plan = 'free', auto_renew = false, expires_at = NULL
       WHERE user_id = $1
       RETURNING id, user_id, plan, started_at, expires_at, auto_renew, created_at`,
      [req.user.id]
    );

    if (r.rowCount === 0) throw new NotFoundError('subscription_not_found');
    res.json({ code: 0, message: 'cancelled', data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /api/v1/subscriptions (admin) ============== */
subscriptionsRouter.get('/', requireRole(4), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT s.id, s.user_id, s.plan, s.started_at, s.expires_at, s.auto_renew, s.created_at,
              u.email, u.display_name
       FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id
       ORDER BY u.email`
    );
    res.json({ code: 0, message: 'ok', data: { items: r.rows, total: r.rowCount } });
  } catch (e) {
    next(e);
  }
});

export default subscriptionsRouter;
