/**
 * projects routes — 用户级项目操作
 *
 * 端点 (挂在 /api/v1/projects 下):
 *   PATCH  /:id — 项目创建者更新 title/description/art_style/status
 *   DELETE /:id — 项目创建者删除项目 (默认软删除, ?hard=true 硬删除)
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '@manhuaworks/shared';
import { z } from 'zod';
import { logger } from '../config/logger';
import * as projectRepo from '../repositories/projectRepository';

export const projectsRouter = Router({ mergeParams: true });

// ─── 鉴权所有端点 ───
projectsRouter.use(requireAuth());

/* ============== PATCH /projects/:id — 用户更新自己的项目 ============== */
const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  artStyle: z.string().max(50).optional().nullable(),
  status: z.number().int().min(0).max(3).optional(),
});

projectsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 仅项目 owner 可以更新
    if (project.user_id !== userId) {
      res.status(403).json({ code: 40300, message: '仅项目创建者可更新项目' });
      return;
    }

    const body = PatchBody.parse(req.body);

    // 映射 camelCase → snake_case (与 projectRepo.update 入参一致)
    const updated = await projectRepo.update(projectId, {
      title: body.title,
      description: body.description,
      art_style: body.artStyle,
      status: body.status,
    });

    logger.info({ projectId, updates: Object.keys(body) }, '[user] project updated');

    res.json({
      code: 0,
      message: 'updated',
      data: updated,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ code: 40000, message: '无效请求体', detail: e.flatten() });
      return;
    }
    logger.error({ err: e }, 'PATCH project failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

/* ============== DELETE /projects/:id — 用户删除自己的项目 ============== */
projectsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 仅项目 owner 可以删除
    if (project.user_id !== userId) {
      res.status(403).json({ code: 40300, message: '仅项目创建者可删除项目' });
      return;
    }

    const hard = req.query.hard === 'true';

    if (hard) {
      // 硬删除 (CASCADE 会删除关联的 shots, scenes, characters 等)
      const deleted = await projectRepo.hardDelete(projectId);
      if (!deleted) {
        res.status(404).json({ code: 40400, message: '项目不存在' });
        return;
      }
      logger.info({ projectId, hard: true }, '[user] project deleted');
      res.json({
        code: 0,
        message: 'deleted',
        data: { id: projectId },
      });
    } else {
      // 软删除: status 置为 3 (归档)
      const deleted = await projectRepo.softDelete(projectId);
      if (!deleted) {
        // 已经是归档状态
        res.status(400).json({ code: 40000, message: '项目已归档' });
        return;
      }
      logger.info({ projectId, hard: false }, '[user] project soft-deleted');
      res.json({
        code: 0,
        message: 'archived',
        data: { id: projectId },
      });
    }
  } catch (err) {
    logger.error({ err }, 'DELETE project failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
