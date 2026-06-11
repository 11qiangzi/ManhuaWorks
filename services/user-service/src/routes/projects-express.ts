/**
 * projects Express routes — 用户项目列表 + CRUD
 *
 * 派单 32B — 谢擎 🗄️
 * 原因: 原 Hono projects.ts 未挂载到 Express app, 41 HTML 中 portal-projects + studio-home 无后端
 * 鉴权: requireAuth (所有端点)
 * DB: projects 表 (user-service schema)
 *
 * 端点:
 *   GET    /api/v1/projects           用户项目列表 (分页, 支持 status 过滤)
 *   GET    /api/v1/projects/:id       项目详情 (owner only)
 *   POST   /api/v1/projects           创建项目
 *   PATCH  /api/v1/projects/:id       更新项目 (owner only)
 *   DELETE /api/v1/projects/:id       删除项目 (owner only)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '@manhuaworks/shared';
import { query } from '../config/db';
import { z } from 'zod';
import { BadRequestError, NotFoundError, ForbiddenError } from '@manhuaworks/shared';

export const projectsRouter = Router();

// ─── 全部端点需登录 ───
projectsRouter.use(requireAuth());

/* ============== GET /api/v1/projects ============== */
const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.coerce.number().int().min(0).max(3).optional(),
});

projectsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ForbiddenError('login_required');
    const q = ListQuery.parse(req.query);
    const offset = (q.page - 1) * q.page_size;
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [req.user.id];
    let idx = 2;

    if (q.status !== undefined) {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT id, user_id, title, description, art_style, story_type, cover_url, status, created_at
         FROM projects ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.page_size, offset]
      ),
      query(
        `SELECT COUNT(*)::text AS count FROM projects ${where}`,
        params
      ),
    ]);

    res.json({
      code: 0,
      message: 'ok',
      data: {
        items: dataRes.rows,
        total: Number(countRes.rows[0]?.count ?? 0),
        page: q.page,
        page_size: q.page_size,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new BadRequestError('invalid_query', e.flatten()));
    next(e);
  }
});

/* ============== GET /api/v1/projects/:id ============== */
projectsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ForbiddenError('login_required');
    const r = await query(
      `SELECT id, user_id, title, description, art_style, story_type, cover_url, status, created_at
       FROM projects WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (r.rowCount === 0) throw new NotFoundError('project_not_found');
    const project = r.rows[0] as Record<string, unknown>;
    // owner or admin can view
    if (project.user_id !== req.user.id && req.user.role !== 5) {
      throw new ForbiddenError('not_owner');
    }
    res.json({ code: 0, message: 'ok', data: project });
  } catch (e) {
    next(e);
  }
});

/* ============== POST /api/v1/projects ============== */
const CreateBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  art_style: z.string().max(50).optional(),
  story_type: z.string().max(50).optional(),
  cover_url: z.string().max(1000).optional(),
});

projectsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ForbiddenError('login_required');
    const body = CreateBody.parse(req.body);

    const r = await query(
      `INSERT INTO projects (user_id, title, description, art_style, story_type, cover_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
      [req.user.id, body.title, body.description ?? null, body.art_style ?? null, body.story_type ?? null, body.cover_url ?? null]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: r.rows[0],
    });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new BadRequestError('invalid_body', e.flatten()));
    next(e);
  }
});

/* ============== PATCH /api/v1/projects/:id ============== */
const UpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  art_style: z.string().max(50).optional(),
  story_type: z.string().max(50).optional(),
  cover_url: z.string().max(1000).optional(),
  status: z.number().int().min(0).max(3).optional(),
});

projectsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ForbiddenError('login_required');
    const body = UpdateBody.parse(req.body);
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined) { updates.push(`title = $${idx++}`); params.push(body.title); }
    if (body.description !== undefined) { updates.push(`description = $${idx++}`); params.push(body.description); }
    if (body.art_style !== undefined) { updates.push(`art_style = $${idx++}`); params.push(body.art_style); }
    if (body.story_type !== undefined) { updates.push(`story_type = $${idx++}`); params.push(body.story_type); }
    if (body.cover_url !== undefined) { updates.push(`cover_url = $${idx++}`); params.push(body.cover_url); }
    if (body.status !== undefined) { updates.push(`status = $${idx++}`); params.push(body.status); }

    if (updates.length === 0) {
      return res.json({ code: 0, message: 'nothing_to_update', data: null });
    }

    params.push(req.params.id);
    const ownerCheck = req.user.role !== 5 ? `AND user_id = $${idx}` : '';
    if (req.user.role !== 5) {
      params.push(req.user.id);
    }

    const r = await query(
      `UPDATE projects SET ${updates.join(', ')}
       WHERE id = $${idx} ${ownerCheck}
       RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
      params
    );

    if (r.rowCount === 0) throw new NotFoundError('project_not_found');

    res.json({ code: 0, message: 'updated', data: r.rows[0] });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new BadRequestError('invalid_body', e.flatten()));
    next(e);
  }
});

/* ============== DELETE /api/v1/projects/:id ============== */
projectsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ForbiddenError('login_required');

    const ownerCheck = req.user.role !== 5 ? `AND user_id = $2` : '';
    const params: unknown[] = [req.params.id];
    if (req.user.role !== 5) params.push(req.user.id);

    const r = await query(
      `DELETE FROM projects WHERE id = $1 ${ownerCheck} RETURNING id`,
      params
    );
    if (r.rowCount === 0) throw new NotFoundError('project_not_found');

    res.json({ code: 0, message: 'deleted', data: { id: r.rows[0]?.id } });
  } catch (e) {
    next(e);
  }
});

export default projectsRouter;
