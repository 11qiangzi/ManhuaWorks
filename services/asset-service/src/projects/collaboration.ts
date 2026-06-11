/**
 * 多人协作：邀请 / 权限 / 版本锁定
 *
 *  GET    /v1/projects/:id/members                成员列表
 *  POST   /v1/projects/:id/members                邀请
 *  PATCH  /v1/projects/:id/members/:userId        更新角色
 *  DELETE /v1/projects/:id/members/:userId        移除
 *  POST   /v1/projects/:id/lock                   锁定（owner 才能锁）
 *  POST   /v1/projects/:id/unlock                 解锁
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectsExt, projectMembers, type MemberRole } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

export const collaborationRoute = new Hono();
collaborationRoute.use('*', authMiddleware);

/* ------------------- 权限检查辅助 ------------------- */
export interface ProjectAccess {
  /** 是否具备某种角色 */
  role: MemberRole;
}

export async function hasProjectAccess(
  projectExtId: string,
  userId: string,
  allowedRoles: MemberRole[] = ['owner', 'editor', 'viewer', 'commenter']
): Promise<ProjectAccess | null> {
  // 先查 owner
  const p = await db
    .select({ ownerId: projectsExt.ownerId, lockedAtVersion: projectsExt.lockedAtVersion, lockedBy: projectsExt.lockedBy })
    .from(projectsExt)
    .where(eq(projectsExt.id, projectExtId))
    .limit(1);
  const row = p[0];
  if (!row) return null;

  if (row.ownerId === userId) {
    return { role: 'owner' };
  }

  // 协作成员
  const m = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectExtId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.status, 'accepted')
      )
    )
    .limit(1);
  const mrow = m[0];
  if (!mrow) return null;
  if (!allowedRoles.includes(mrow.role)) return null;
  return { role: mrow.role };
}

/* ------------------- 成员列表 ------------------- */
collaborationRoute.get('/:id/members', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const access = await hasProjectAccess(projectId, auth.subject);
  if (!access) return c.json({ error: 'forbidden' }, 403);

  const rows = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  return c.json({ list: rows, count: rows.length });
});

/* ------------------- 邀请 ------------------- */
const inviteSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['editor', 'viewer', 'commenter']).default('viewer'),
});

collaborationRoute.post('/:id/members', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const access = await hasProjectAccess(projectId, auth.subject, ['owner', 'editor']);
  if (!access) return c.json({ error: 'forbidden', message: 'only owner/editor can invite' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  // 已存在则更新
  const existing = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parsed.data.userId)))
    .limit(1);
  const ex = existing[0];

  if (ex) {
    const upd = await db
      .update(projectMembers)
      .set({
        role: parsed.data.role,
        status: 'pending',
        invitedBy: auth.subject,
      })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parsed.data.userId)))
      .returning();
    return c.json({ invited: true, member: upd[0] });
  }

  const ins = await db
    .insert(projectMembers)
    .values({
      projectId,
      userId: parsed.data.userId,
      role: parsed.data.role,
      invitedBy: auth.subject,
      status: 'pending',
    })
    .returning();
  return c.json({ invited: true, member: ins[0] }, 201);
});

/* ------------------- 更新角色 ------------------- */
const updateRoleSchema = z.object({
  role: z.enum(['editor', 'viewer', 'commenter']),
  status: z.enum(['pending', 'accepted', 'revoked']).optional(),
});

collaborationRoute.patch('/:id/members/:userId', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const userId = c.req.param('userId');
  const access = await hasProjectAccess(projectId, auth.subject, ['owner', 'editor']);
  if (!access) return c.json({ error: 'forbidden' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const patch: Record<string, unknown> = { role: parsed.data.role };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.status === 'accepted' && !body.accepted_at) {
    patch.acceptedAt = new Date();
  }

  const upd = await db
    .update(projectMembers)
    .set(patch as any)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning();
  if (upd.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ updated: true, member: upd[0] });
});

/* ------------------- 移除 ------------------- */
collaborationRoute.delete('/:id/members/:userId', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const userId = c.req.param('userId');
  const access = await hasProjectAccess(projectId, auth.subject, ['owner', 'editor']);
  if (!access) return c.json({ error: 'forbidden' }, 403);

  const del = await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning({ userId: projectMembers.userId });
  if (del.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ removed: true, userId: del[0]?.userId });
});

/* ------------------- 锁定 / 解锁 ------------------- */
const lockSchema = z.object({
  versionNo: z.number().int().min(1).optional(),  // 不传 = 锁当前最新
  reason: z.string().max(500).optional(),
});

collaborationRoute.post('/:id/lock', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const access = await hasProjectAccess(projectId, auth.subject, ['owner']);
  if (!access) return c.json({ error: 'forbidden', message: 'only owner can lock' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const targetVersion = parsed.data.versionNo ?? 1;
  const upd = await db
    .update(projectsExt)
    .set({
      lockedAtVersion: targetVersion,
      lockedBy: auth.subject,
      lockedAt: new Date(),
    } as any)
    .where(eq(projectsExt.id, projectId))
    .returning();
  if (upd.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ locked: true, project: upd[0] });
});

collaborationRoute.post('/:id/unlock', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('id');
  const access = await hasProjectAccess(projectId, auth.subject, ['owner']);
  if (!access) return c.json({ error: 'forbidden', message: 'only owner can unlock' }, 403);

  const upd = await db
    .update(projectsExt)
    .set({
      lockedAtVersion: 0,
      lockedBy: null,
      lockedAt: null,
    } as any)
    .where(eq(projectsExt.id, projectId))
    .returning();
  if (upd.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ unlocked: true, project: upd[0] });
});
