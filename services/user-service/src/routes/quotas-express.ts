/**
 * quotas Express routes — 用户配额查询 + 消费
 *
 * 派单 32B — 谢擎 🗄️
 * 原因: 原 Hono quotas.ts 未挂载到 Express app, 41 HTML 中 portal-dashboard 无后端
 * 鉴权: requireAuth
 * DB: quotas 表 (user-service schema)
 *
 * 端点:
 *   GET    /api/v1/quotas/me        当前用户配额
 *   POST   /api/v1/quotas/me/consume 消费配额 (内部/Billing 回调)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@manhuaworks/shared';
import { query } from '../config/db';
import { z } from 'zod';
import { BadRequestError, NotFoundError } from '@manhuaworks/shared';

export const quotasRouter = Router();

// ─── 全部端点需登录 ───
quotasRouter.use(requireAuth());

/* ============== GET /api/v1/quotas/me ============== */
quotasRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const r = await query(
      `SELECT id, user_id, monthly_tokens, used_tokens, monthly_images, used_images,
              monthly_videos, used_videos, reset_at
       FROM quotas WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    );

    if (r.rowCount === 0) {
      // Auto-create quota row for new users
      const created = await query(
        `INSERT INTO quotas (user_id, monthly_tokens, used_tokens, monthly_images, used_images,
          monthly_videos, used_videos, reset_at)
         VALUES ($1, 100000, 0, 50, 0, 10, 0, NOW() + INTERVAL '1 month')
         RETURNING id, user_id, monthly_tokens, used_tokens, monthly_images, used_images,
                   monthly_videos, used_videos, reset_at`,
        [req.user.id]
      );
      return res.json({ code: 0, message: 'ok', data: created.rows[0] });
    }

    res.json({ code: 0, message: 'ok', data: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /api/v1/quotas (admin) ============== */
quotasRouter.get('/', requireRole(4), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT q.id, q.user_id, q.monthly_tokens, q.used_tokens, q.monthly_images, q.used_images,
              q.monthly_videos, q.used_videos, q.reset_at, u.email, u.display_name
       FROM quotas q LEFT JOIN users u ON q.user_id = u.id
       ORDER BY u.email`
    );
    res.json({ code: 0, message: 'ok', data: { items: r.rows, total: r.rowCount } });
  } catch (e) {
    next(e);
  }
});

/* ============== POST /api/v1/quotas/me/consume (内部用) ============== */
const ConsumeBody = z.object({
  tokens: z.number().int().min(0).default(0),
  images: z.number().int().min(0).default(0),
  videos: z.number().int().min(0).default(0),
});

quotasRouter.post('/me/consume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new NotFoundError('login_required');
    const body = ConsumeBody.parse(req.body);

    const r = await query(
      `UPDATE quotas
       SET used_tokens = used_tokens + $2,
           used_images = used_images + $3,
           used_videos = used_videos + $4
       WHERE user_id = $1
       RETURNING id, user_id, monthly_tokens, used_tokens, monthly_images, used_images,
                 monthly_videos, used_videos, reset_at`,
      [req.user.id, body.tokens, body.images, body.videos]
    );

    if (r.rowCount === 0) throw new NotFoundError('quota_not_found');

    res.json({ code: 0, message: 'consumed', data: r.rows[0] });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new BadRequestError('invalid_body', e.flatten()));
    next(e);
  }
});

export default quotasRouter;
