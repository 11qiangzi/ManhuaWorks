/**
 * scenes routes — 场景 CRUD
 *
 * P0-2: project-service scenes 4 端点 (CRUD)
 * 鉴权: authRequired + projectOwnerCheck
 *
 * 端点:
 *   GET    /api/v1/scenes?projectId=xxx  — 按项目查场景列表
 *   POST   /api/v1/scenes                — 创建场景
 *   PATCH  /api/v1/scenes/:id            — 更新场景
 *   DELETE /api/v1/scenes/:id            — 删除场景
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';

export const scenesRouter = Router();

// ─── 鉴权所有端点 ───
scenesRouter.use(requireAuth());

// ─── 辅助: 校验 project owner ───
async function checkProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const r = await pool.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  );
  if (r.rowCount === 0) return false;
  return r.rows[0].user_id === userId;
}

// ─── P0-2c: GET /api/v1/scenes?projectId=xxx ───
scenesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const projectId = req.query.projectId as string;
    if (!projectId) {
      res.status(400).json({ code: 40000, message: '缺少 projectId 参数' });
      return;
    }

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
      `SELECT id, project_id, name, description, scene_type,
              light_color_temp, light_brightness, light_preset,
              prompt, thumbnail_url, tags, created_at, updated_at
       FROM scenes
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json({
      code: 0,
      message: 'ok',
      data: { items: r.rows, total: r.rowCount },
    });
  } catch (err) {
    logger.error({ err }, 'GET scenes failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-2d: POST /api/v1/scenes ───
scenesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const b = req.body ?? {};
    const projectId = b.projectId;
    if (!projectId) {
      res.status(400).json({ code: 40000, message: '缺少 projectId' });
      return;
    }
    if (!b.name) {
      res.status(400).json({ code: 40000, message: '缺少场景名称' });
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

    const r = await pool.query(
      `INSERT INTO scenes (project_id, name, description, scene_type,
                           light_color_temp, light_brightness, light_preset,
                           prompt, thumbnail_url, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, project_id, name, description, scene_type,
                 light_color_temp, light_brightness, light_preset,
                 prompt, thumbnail_url, tags, created_at, updated_at`,
      [
        projectId,
        b.name,
        b.description ?? null,
        b.scene_type ?? 'indoor',
        b.light_color_temp ?? 5500,
        b.light_brightness ?? 1.0,
        b.light_preset ?? null,
        b.prompt ?? null,
        b.thumbnail_url ?? null,
        JSON.stringify(b.tags ?? []),
      ]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'POST scene failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-2e: PATCH /api/v1/scenes/:id ───
scenesRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;

    // 查 scene 归属
    const scene = await pool.query(
      'SELECT project_id FROM scenes WHERE id = $1',
      [id]
    );
    if (scene.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '场景不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(scene.rows[0].project_id, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    const b = req.body ?? {};
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    const fields: [string, string][] = [
      ['name', 'name'],
      ['description', 'description'],
      ['scene_type', 'scene_type'],
      ['light_color_temp', 'light_color_temp'],
      ['light_brightness', 'light_brightness'],
      ['light_preset', 'light_preset'],
      ['prompt', 'prompt'],
      ['thumbnail_url', 'thumbnail_url'],
    ];

    for (const [key, col] of fields) {
      if (b[key] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        vals.push(b[key]);
      }
    }

    if (b.tags !== undefined) {
      sets.push(`tags = $${idx++}::jsonb`);
      vals.push(JSON.stringify(b.tags));
    }

    if (sets.length === 0) {
      res.status(400).json({ code: 40000, message: '无更新字段' });
      return;
    }

    sets.push('updated_at = NOW()');
    vals.push(id);

    const r = await pool.query(
      `UPDATE scenes SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, project_id, name, description, scene_type,
                 light_color_temp, light_brightness, light_preset,
                 prompt, thumbnail_url, tags, created_at, updated_at`,
      vals
    );

    res.json({
      code: 0,
      message: 'updated',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'PATCH scene failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-2f: DELETE /api/v1/scenes/:id ───
scenesRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;
    const scene = await pool.query(
      'SELECT project_id FROM scenes WHERE id = $1',
      [id]
    );
    if (scene.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '场景不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(scene.rows[0].project_id, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    const r = await pool.query(
      'DELETE FROM scenes WHERE id = $1 RETURNING id',
      [id]
    );

    res.json({ code: 0, message: 'deleted', data: { id } });
  } catch (err) {
    logger.error({ err }, 'DELETE scene failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
