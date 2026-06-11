/**
 * project-service admin routes — 管理员项目操作 (派单 48 P2 — 谢擎 2026-06-10)
 *
 * 鉴权: requireAuth + requireRole(5) (admin)
 *
 * 端点:
 *   GET    /api/v1/admin/projects          — 管理员项目列表 (全量, 含过滤)
 *   POST   /api/v1/admin/projects          — 管理员创建项目
 *   PUT    /api/v1/admin/projects/:id      — 管理员更新项目
 *   DELETE /api/v1/admin/projects/:id      — 管理员删除项目
 *   GET    /api/v1/admin/projects/:id      — 管理员查看单个项目详情
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '@manhuaworks/shared';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { z } from 'zod';

export const adminRouter = Router();

// ─── 全部端点: 鉴权 + admin ───
adminRouter.use(requireAuth());
adminRouter.use(requireRole(5));

/* ============== GET /admin/projects — 管理员项目列表 ============== */
const ListQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.coerce.number().int().min(0).max(3).optional(),
  search: z.string().optional(),
  userId: z.string().uuid().optional(),
});

adminRouter.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ListQuery.parse(req.query);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.status !== undefined) {
      conditions.push(`p.status = $${idx++}`);
      params.push(q.status);
    }
    if (q.search) {
      conditions.push(`p.title ILIKE $${idx++}`);
      params.push(`%${q.search}%`);
    }
    if (q.userId) {
      conditions.push(`p.user_id = $${idx++}`);
      params.push(q.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.id, p.user_id, p.title, p.description, p.art_style,
                p.story_type, p.cover_url, p.status, p.created_at,
                u.display_name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*) FROM shots s WHERE s.project_id = p.id)::int AS shot_count
         FROM projects p
         LEFT JOIN users u ON u.id = p.user_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, q.limit, q.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::text AS count FROM projects p ${where}`,
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
    if (e instanceof z.ZodError) {
      return res.status(400).json({ code: 40000, message: '无效查询参数', detail: e.flatten() });
    }
    next(e);
  }
});

/* ============== POST /admin/projects — 管理员创建项目 ============== */
const CreateBody = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  artStyle: z.string().max(50).optional(),
  storyType: z.string().max(50).optional(),
  coverUrl: z.string().url().optional(),
  status: z.number().int().min(0).max(3).default(0),
});

adminRouter.post('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateBody.parse(req.body);

    // 校验用户是否存在
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 LIMIT 1',
      [body.userId]
    );
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ code: 40400, message: '用户不存在' });
    }

    const result = await pool.query(
      `INSERT INTO projects (user_id, title, description, art_style, story_type, cover_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
      [body.userId, body.title, body.description ?? null, body.artStyle ?? null,
       body.storyType ?? null, body.coverUrl ?? null, body.status]
    );

    logger.info({ projectId: result.rows[0]?.id, adminCreated: true }, '[admin] project created');

    res.status(201).json({
      code: 0,
      message: 'created',
      data: result.rows[0],
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ code: 40000, message: '无效请求体', detail: e.flatten() });
    }
    next(e);
  }
});

/* ============== PUT /admin/projects/:id — 管理员更新项目 ============== */
const UpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  artStyle: z.string().max(50).optional().nullable(),
  storyType: z.string().max(50).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  status: z.number().int().min(0).max(3).optional(),
  userId: z.string().uuid().optional(), // 允许转移项目归属
});

adminRouter.put('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = UpdateBody.parse(req.body);

    // 检查项目是否存在
    const existing = await pool.query(
      'SELECT id FROM projects WHERE id = $1 LIMIT 1',
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ code: 40400, message: '项目不存在' });
    }

    // 构建动态 UPDATE
    const setters: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined) { setters.push(`title = $${idx++}`); params.push(body.title); }
    if (body.description !== undefined) { setters.push(`description = $${idx++}`); params.push(body.description); }
    if (body.artStyle !== undefined) { setters.push(`art_style = $${idx++}`); params.push(body.artStyle); }
    if (body.storyType !== undefined) { setters.push(`story_type = $${idx++}`); params.push(body.storyType); }
    if (body.coverUrl !== undefined) { setters.push(`cover_url = $${idx++}`); params.push(body.coverUrl); }
    if (body.status !== undefined) { setters.push(`status = $${idx++}`); params.push(body.status); }
    if (body.userId !== undefined) {
      // 校验新用户
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [body.userId]);
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ code: 40400, message: '目标用户不存在' });
      }
      setters.push(`user_id = $${idx++}`);
      params.push(body.userId);
    }

    if (setters.length === 0) {
      return res.status(400).json({ code: 40000, message: '没有要更新的字段' });
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE projects SET ${setters.join(', ')} WHERE id = $${idx}
       RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
      params
    );

    logger.info({ projectId: id, updates: Object.keys(body) }, '[admin] project updated');

    res.json({
      code: 0,
      message: 'updated',
      data: result.rows[0],
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ code: 40000, message: '无效请求体', detail: e.flatten() });
    }
    next(e);
  }
});

/* ============== DELETE /admin/projects/:id — 管理员删除项目 ============== */
adminRouter.delete('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id, title FROM projects WHERE id = $1 LIMIT 1',
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ code: 40400, message: '项目不存在' });
    }

    // CASCADE 会自动删除关联的 shots, scenes, characters, versions, members, tags
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);

    logger.info({ projectId: id, title: existing.rows[0]?.title }, '[admin] project deleted');

    res.json({
      code: 0,
      message: 'deleted',
      data: { id, title: existing.rows[0]?.title },
    });
  } catch (e) {
    next(e);
  }
});

/* ============== GET /admin/projects/:id — 管理员查看项目详情 ============== */
adminRouter.get('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [project, stats] = await Promise.all([
      pool.query(
        `SELECT p.*, u.display_name AS owner_name, u.email AS owner_email
         FROM projects p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM shots WHERE project_id = $1)::int AS shots,
           (SELECT COUNT(*) FROM scenes WHERE project_id = $1)::int AS scenes,
           (SELECT COUNT(*) FROM characters WHERE project_id = $1)::int AS characters,
           (SELECT COUNT(*) FROM project_versions WHERE project_id = $1)::int AS versions`,
        [id]
      ),
    ]);

    if (project.rowCount === 0) {
      return res.status(404).json({ code: 40400, message: '项目不存在' });
    }

    res.json({
      code: 0,
      message: 'ok',
      data: {
        ...project.rows[0],
        stats: stats.rows[0],
      },
    });
  } catch (e) {
    next(e);
  }
});

export default adminRouter;
