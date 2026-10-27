/**
 * archive routes — 项目归档切换
 *
 * 端点 (挂在 /api/v1/projects/:id/archive 下):
 *   POST / — 切换归档状态 (status 0↔3)
 *
 * status 约定: 0=draft, 1=active, 2=paused, 3=archived
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';

export const archiveRouter = Router({ mergeParams: true });

// ─── 鉴权所有端点 ───
archiveRouter.use(requireAuth());

// ─── POST /api/v1/projects/:id/archive — 切换归档 ───
archiveRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    // 检查项目存在 + 获取当前状态和 owner
    const projectResult = await pool.query(
      'SELECT id, user_id, status FROM projects WHERE id = $1',
      [projectId],
    );
    if (projectResult.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    const project = projectResult.rows[0];

    // 仅项目 owner 可以归档/取消归档
    if (project.user_id !== userId) {
      res.status(403).json({ code: 40300, message: '仅项目创建者可操作归档' });
      return;
    }

    // 切换: archived(3) → draft(0), 其他 → archived(3)
    const newStatus = project.status === 3 ? 0 : 3;

    const r = await pool.query(
      `UPDATE projects SET status = $2 WHERE id = $1
       RETURNING id, user_id, title, description, art_style, story_type, cover_url, status, created_at`,
      [projectId, newStatus],
    );

    const action = newStatus === 3 ? 'archived' : 'unarchived';
    logger.info({ projectId, action }, `project ${action}`);

    res.json({
      code: 0,
      message: action,
      data: r.rows[0],
    });
  } catch (err) {
    logger.error({ err }, 'POST archive toggle failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
