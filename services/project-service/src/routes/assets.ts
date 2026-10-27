/**
 * assets routes — 素材资产 CRUD（武器 / 道具 / 饰品 / 特效·技能）
 *
 * 合一表 + category 子类型：weapon | prop | accessory | effect
 * 鉴权: requireAuth + checkProjectOwner（与 characters/scenes 一致）
 *
 * 端点:
 *   GET    /api/v1/assets?projectId=xxx&category=weapon — 按项目/分类查资产列表
 *   POST   /api/v1/assets                          — 创建资产
 *   PATCH  /api/v1/assets/:id                       — 更新资产
 *   DELETE /api/v1/assets/:id                       — 删除资产
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';

export const assetsRouter = Router();

// ─── 鉴权所有端点 ───
assetsRouter.use(requireAuth());

// ─── 辅助: 校验 project owner ───
async function checkProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const r = await pool.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  );
  if (r.rowCount === 0) return false;
  return r.rows[0].user_id === userId;
}

const SELECT_COLS = `id, project_id, category, name, description,
       prompt, thumbnail_url, video_url, tags, created_at, updated_at`;

// ─── GET /api/v1/assets?projectId=xxx&category=yyy ───
assetsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
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

    const category = req.query.category as string | undefined;
    let sql = `SELECT ${SELECT_COLS} FROM assets WHERE project_id = $1`;
    const params: unknown[] = [projectId];
    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }
    sql += ' ORDER BY created_at DESC';

    const r = await pool.query(sql, params);

    res.json({
      code: 0,
      message: 'ok',
      data: { items: r.rows, total: r.rowCount },
    });
  } catch (err) {
    logger.error({ err }, 'GET assets failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── POST /api/v1/assets ───
assetsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ code: 40000, message: '缺少资产名称' });
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

    const category = ['weapon', 'prop', 'accessory', 'effect'].includes(b.category)
      ? b.category
      : 'prop';

    const r = await pool.query(
      `INSERT INTO assets (project_id, category, name, description, prompt, thumbnail_url, video_url, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${SELECT_COLS}`,
      [
        projectId,
        category,
        b.name,
        b.description ?? null,
        b.prompt ?? null,
        b.thumbnail_url ?? null,
        b.video_url ?? null,
        JSON.stringify(b.tags ?? []),
      ]
    );

    res.status(201).json({
      code: 0,
      message: 'created',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'POST asset failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── PATCH /api/v1/assets/:id ───
assetsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;

    const asset = await pool.query(
      'SELECT project_id FROM assets WHERE id = $1',
      [id]
    );
    if (asset.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '资产不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(asset.rows[0].project_id, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    const b = req.body ?? {};
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    const fields: [string, string][] = [
      ['category', 'category'],
      ['name', 'name'],
      ['description', 'description'],
      ['prompt', 'prompt'],
      ['thumbnail_url', 'thumbnail_url'],
      ['video_url', 'video_url'],
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
      `UPDATE assets SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING ${SELECT_COLS}`,
      vals
    );

    res.json({
      code: 0,
      message: 'updated',
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'PATCH asset failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── DELETE /api/v1/assets/:id ───
assetsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const { id } = req.params;
    const asset = await pool.query(
      'SELECT project_id FROM assets WHERE id = $1',
      [id]
    );
    if (asset.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '资产不存在' });
      return;
    }

    const isOwner = await checkProjectOwner(asset.rows[0].project_id, userId);
    if (!isOwner) {
      res.status(403).json({ code: 40300, message: '无权操作该项目' });
      return;
    }

    await pool.query('DELETE FROM assets WHERE id = $1', [id]);

    res.json({ code: 0, message: 'deleted', data: { id } });
  } catch (err) {
    logger.error({ err }, 'DELETE asset failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
