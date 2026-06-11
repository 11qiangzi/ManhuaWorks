/**
 * shots routes — 分镜 CRUD
 *
 * P0-1: project-service shots 4 端点 (CRUD+批处理)
 * 鉴权: authRequired (远程校验 user-service JWT) + projectOwnerCheck
 *
 * 端点:
 *   GET    /api/v1/projects/:id/shots        — 查分镜列表
 *   POST   /api/v1/projects/:id/shots        — 创建分镜
 *   PATCH  /api/v1/projects/:id/shots/:shotId — 更新分镜
 *   DELETE /api/v1/projects/:id/shots/:shotId — 删除分镜
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';

export const shotsRouter = Router({ mergeParams: true });

// ─── 鉴权所有端点 ───
shotsRouter.use(requireAuth());

// ─── 辅助: 校验用户是否是 project owner ───
async function checkProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const r = await pool.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  );
  if (r.rowCount === 0) return false;
  return r.rows[0].user_id === userId;
}

// ─── P0-1c: GET /api/v1/projects/:id/shots ───
shotsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    // 检查项目存在 + owner
    const isOwner = await checkProjectOwner(projectId, userId);
    if (!isOwner) {
      const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
      if (exists.rowCount === 0) {
        res.status(404).json({ code: 40400, message: '项目不存在' });
        return;
      }
      res.status(403).json({ code: 40300, message: '无权访问该项目' });
      return;
    }

    const r = await pool.query(
      `SELECT id, project_id, shot_no, title, description, duration_ms, duration_sec,
              camera, camera_angle, camera_movement, characters, dialogue, note,
              transition, style_override, status, sort_index, created_at, updated_at
       FROM shots
       WHERE project_id = $1
       ORDER BY sort_index ASC, shot_no ASC`,
      [projectId]
    );

    res.json({
      code: 0,
      message: 'ok',
      data: { items: r.rows, total: r.rowCount },
    });
  } catch (err) {
    logger.error({ err }, 'GET shots failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-1d: POST /api/v1/projects/:id/shots ───
shotsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const isOwner = await checkProjectOwner(projectId, userId);
    if (!isOwner) {
      const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
      if (exists.rowCount === 0) {
        res.status(404).json({ code: 40400, message: '项目不存在' });
        return;
      }
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    const b = req.body ?? {};
    if (b.shot_no === undefined && b.shot_number === undefined) {
      res.status(400).json({ code: 40000, message: '缺少 shot_no' });
      return;
    }

    // 自动计算 sort_index = max + 1
    const maxSort = await pool.query(
      'SELECT COALESCE(MAX(sort_index), -1) + 1 AS next_sort FROM shots WHERE project_id = $1',
      [projectId]
    );
    const nextSort = maxSort.rows[0].next_sort;

    const r = await pool.query(
      `INSERT INTO shots (project_id, shot_no, title, description, duration_ms, duration_sec,
                          camera, camera_angle, camera_movement, characters, dialogue, note,
                          transition, style_override, status, sort_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, project_id, shot_no, title, description, duration_ms, duration_sec,
                 camera, camera_angle, camera_movement, characters, dialogue, note,
                 transition, style_override, status, sort_index, created_at, updated_at`,
      [
        projectId,
        b.shot_no ?? b.shot_number ?? 1,
        b.title ?? null,
        b.description ?? null,
        b.duration_ms ?? 0,
        b.duration_sec ?? null,
        b.camera ?? b.camera_angle ?? null,
        b.camera_angle ?? null,
        b.camera_movement ?? null,
        JSON.stringify(b.characters ?? []),
        b.dialogue ?? null,
        b.note ?? null,
        b.transition ?? null,
        b.style_override ? JSON.stringify(b.style_override) : null,
        b.status ?? 0,
        nextSort,
      ]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: r.rows[0],
    });
  } catch (err: any) {
    if (err?.code === '23505') { // unique violation on (project_id, shot_no)
      res.status(409).json({ code: 40900, message: '该分镜号已存在' });
      return;
    }
    logger.error({ err }, 'POST shot failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-1e: PATCH /api/v1/projects/:id/shots/:shotId ───
shotsRouter.patch('/:shotId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, shotId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const isOwner = await checkProjectOwner(projectId, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    // 检查分镜是否存在
    const existing = await pool.query(
      'SELECT id FROM shots WHERE id = $1 AND project_id = $2',
      [shotId, projectId]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '分镜不存在' });
      return;
    }

    const b = req.body ?? {};
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    const fields: [string, string][] = [
      ['shot_no', 'shot_no'],
      ['shot_number', 'shot_no'],
      ['title', 'title'],
      ['description', 'description'],
      ['duration_ms', 'duration_ms'],
      ['duration_sec', 'duration_sec'],
      ['camera', 'camera'],
      ['camera_angle', 'camera_angle'],
      ['camera_movement', 'camera_movement'],
      ['characters', 'characters'],
      ['dialogue', 'dialogue'],
      ['note', 'note'],
      ['transition', 'transition'],
      ['status', 'status'],
      ['sort_index', 'sort_index'],
      ['sort_order', 'sort_index'],
    ];

    for (const [key, col] of fields) {
      if (b[key] !== undefined) {
        if (col === 'characters') {
          sets.push(`${col} = $${idx++}::jsonb`);
          vals.push(JSON.stringify(b[key]));
        } else {
          sets.push(`${col} = $${idx++}`);
          vals.push(b[key]);
        }
      }
    }

    // style_override separately
    if (b.style_override !== undefined) {
      sets.push(`style_override = $${idx++}::jsonb`);
      vals.push(JSON.stringify(b.style_override));
    }

    if (sets.length === 0) {
      res.status(400).json({ code: 40000, message: '无更新字段' });
      return;
    }

    sets.push(`updated_at = NOW()`);
    vals.push(shotId);
    vals.push(projectId);

    const r = await pool.query(
      `UPDATE shots SET ${sets.join(', ')} WHERE id = $${idx++} AND project_id = $${idx}
       RETURNING id, project_id, shot_no, title, description, duration_ms, duration_sec,
                 camera, camera_angle, camera_movement, characters, dialogue, note,
                 transition, style_override, status, sort_index, created_at, updated_at`,
      vals
    );

    res.json({
      code: 0,
      message: 'updated',
      data: r.rows[0],
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ code: 40900, message: '该分镜号已存在' });
      return;
    }
    logger.error({ err }, 'PATCH shot failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-1f: DELETE /api/v1/projects/:id/shots/:shotId ───
shotsRouter.delete('/:shotId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, shotId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const isOwner = await checkProjectOwner(projectId, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    const r = await pool.query(
      'DELETE FROM shots WHERE id = $1 AND project_id = $2 RETURNING id',
      [shotId, projectId]
    );
    if (r.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '分镜不存在' });
      return;
    }

    res.json({ code: 0, message: 'deleted', data: { id: shotId } });
  } catch (err) {
    logger.error({ err }, 'DELETE shot failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
