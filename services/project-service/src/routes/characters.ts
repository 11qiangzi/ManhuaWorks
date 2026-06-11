/**
 * characters routes — 角色 CRUD
 *
 * P0-3: project-service characters 补全 PATCH/DELETE + GET/POST
 * 鉴权: authRequired + projectOwnerCheck
 *
 * 端点:
 *   GET    /api/v1/characters?projectId=xxx — 按项目查角色列表
 *   POST   /api/v1/characters               — 创建角色
 *   PATCH  /api/v1/characters/:id           — 更新角色 (P0-3a)
 *   DELETE /api/v1/characters/:id           — 删除角色 (P0-3b)
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';

export const charactersRouter = Router();

// ─── 鉴权所有端点 ───
charactersRouter.use(requireAuth());

// ─── 辅助: 校验 project owner ───
async function checkProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const r = await pool.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  );
  if (r.rowCount === 0) return false;
  return r.rows[0].user_id === userId;
}

// ─── GET /api/v1/characters?projectId=xxx ───
charactersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
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
      `SELECT id, project_id, name, archetype, description,
              tags, prompt, thumbnail_url, created_at, updated_at
       FROM characters
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
    logger.error({ err }, 'GET characters failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── POST /api/v1/characters ───
charactersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ code: 40000, message: '缺少角色名称' });
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
      `INSERT INTO characters (project_id, name, archetype, description, tags, prompt, thumbnail_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, project_id, name, archetype, description,
                 tags, prompt, thumbnail_url, created_at, updated_at`,
      [
        projectId,
        b.name,
        b.archetype ?? null,
        b.description ?? null,
        JSON.stringify(b.tags ?? []),
        b.prompt ?? null,
        b.thumbnail_url ?? null,
      ]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'POST character failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-3a: PATCH /api/v1/characters/:id ───
charactersRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;

    const char = await pool.query(
      'SELECT project_id FROM characters WHERE id = $1',
      [id]
    );
    if (char.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '角色不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(char.rows[0].project_id, userId);
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
      ['archetype', 'archetype'],
      ['description', 'description'],
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
      `UPDATE characters SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, project_id, name, archetype, description,
                 tags, prompt, thumbnail_url, created_at, updated_at`,
      vals
    );

    res.json({
      code: 0,
      message: 'updated',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'PATCH character failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── P0-3b: DELETE /api/v1/characters/:id ───
charactersRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;
    const char = await pool.query(
      'SELECT project_id FROM characters WHERE id = $1',
      [id]
    );
    if (char.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '角色不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(char.rows[0].project_id, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    await pool.query('DELETE FROM characters WHERE id = $1', [id]);

    res.json({ code: 0, message: 'deleted', data: { id } });
  } catch (err) {
    logger.error({ err }, 'DELETE character failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
