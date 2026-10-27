/**
 * members routes — 项目协作者管理
 *
 * 端点 (挂在 /api/v1/projects/:id/members 下):
 *   GET    /             — 查询项目成员列表
 *   POST   /             — 邀请/添加成员 (body: { email, role })
 *   DELETE /:userId       — 移除成员
 *   PUT    /:userId/role  — 更新成员角色 (body: { role })
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../config/logger';
import { requireAuth } from '@manhuaworks/shared';
import { MEMBER_ROLES, type MemberRole } from '../models/projectMember';
import * as memberRepo from '../repositories/memberRepository';

export const membersRouter = Router({ mergeParams: true });

// ─── 鉴权所有端点 ───
membersRouter.use(requireAuth());

// ─── 辅助: 校验项目是否存在 + 返回 owner ───
async function getProjectOwner(projectId: string): Promise<string | null> {
  const r = await pool.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId],
  );
  if (r.rowCount === 0) return null;
  return r.rows[0].user_id;
}

// ─── GET /api/v1/projects/:id/members ───
membersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const owner = await getProjectOwner(projectId);
    if (owner === null) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 检查当前用户是否为项目 owner 或成员
    if (owner !== userId) {
      const membership = await memberRepo.findOne(projectId, userId);
      if (!membership) {
        res.status(403).json({ code: 40300, message: '无权访问该项目' });
        return;
      }
    }

    const members = await memberRepo.listByProject(projectId);

    res.json({
      code: 0,
      message: 'ok',
      data: { items: members, total: members.length },
    });
  } catch (err) {
    logger.error({ err }, 'GET members failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── POST /api/v1/projects/:id/members ───
membersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const owner = await getProjectOwner(projectId);
    if (owner === null) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 仅项目 owner 可以添加成员
    if (owner !== userId) {
      res.status(403).json({ code: 40300, message: '仅项目创建者可添加成员' });
      return;
    }

    const b = req.body ?? {};
    const { email, role } = b;

    if (!email) {
      res.status(400).json({ code: 40000, message: '缺少 email' });
      return;
    }

    const memberRole: MemberRole = role ?? 'viewer';
    if (!MEMBER_ROLES.includes(memberRole)) {
      res.status(400).json({ code: 40000, message: `无效角色，可选: ${MEMBER_ROLES.join(', ')}` });
      return;
    }

    // 通过 email 查找用户 (跨服务共享 users 表)
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    if (userResult.rowCount === 0) {
      res.status(404).json({ code: 40400, message: '用户不存在' });
      return;
    }
    const targetUserId = userResult.rows[0].id;

    // 检查是否已经是成员
    const existing = await memberRepo.findOne(projectId, targetUserId);
    if (existing) {
      res.status(409).json({ code: 40900, message: '该用户已是项目成员' });
      return;
    }

    const member = await memberRepo.insert({
      project_id: projectId,
      user_id: targetUserId,
      role: memberRole,
    });

    res.status(201).json({
      code: 0,
      message: 'created',
      data: member,
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ code: 40900, message: '该用户已是项目成员' });
      return;
    }
    logger.error({ err }, 'POST member failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── DELETE /api/v1/projects/:id/members/:userId ───
membersRouter.delete('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, userId: targetUserId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const owner = await getProjectOwner(projectId);
    if (owner === null) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 仅项目 owner 或本人可以移除
    if (owner !== userId && targetUserId !== userId) {
      res.status(403).json({ code: 40300, message: '无权移除该成员' });
      return;
    }

    // 不允许移除项目 owner
    if (targetUserId === owner) {
      res.status(400).json({ code: 40000, message: '不能移除项目创建者' });
      return;
    }

    const removed = await memberRepo.remove(projectId, targetUserId);
    if (!removed) {
      res.status(404).json({ code: 40400, message: '成员不存在' });
      return;
    }

    res.json({ code: 0, message: 'deleted', data: { userId: targetUserId } });
  } catch (err) {
    logger.error({ err }, 'DELETE member failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});

// ─── PUT /api/v1/projects/:id/members/:userId/role ───
membersRouter.put('/:userId/role', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId, userId: targetUserId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 40100, message: '未登录' });
      return;
    }

    const owner = await getProjectOwner(projectId);
    if (owner === null) {
      res.status(404).json({ code: 40400, message: '项目不存在' });
      return;
    }

    // 仅项目 owner 可以修改角色
    if (owner !== userId) {
      res.status(403).json({ code: 40300, message: '仅项目创建者可修改成员角色' });
      return;
    }

    // 不能修改 owner 自己的角色
    if (targetUserId === owner) {
      res.status(400).json({ code: 40000, message: '不能修改项目创建者角色' });
      return;
    }

    const b = req.body ?? {};
    const { role } = b;

    if (!role) {
      res.status(400).json({ code: 40000, message: '缺少 role' });
      return;
    }

    if (!MEMBER_ROLES.includes(role)) {
      res.status(400).json({ code: 40000, message: `无效角色，可选: ${MEMBER_ROLES.join(', ')}` });
      return;
    }

    const updated = await memberRepo.updateRole(projectId, targetUserId, { role });
    if (!updated) {
      res.status(404).json({ code: 40400, message: '成员不存在' });
      return;
    }

    res.json({
      code: 0,
      message: 'updated',
      data: updated,
    });
  } catch (err) {
    logger.error({ err }, 'PUT member role failed');
    res.status(500).json({ code: 50000, message: '服务器内部错误' });
  }
});
