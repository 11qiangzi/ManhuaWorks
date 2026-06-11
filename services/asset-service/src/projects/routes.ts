/**
 * 项目空间 CRUD
 *
 *  GET    /v1/projects                        列表（分页 + 过滤）
 *  GET    /v1/projects/:id                    详情
 *  POST   /v1/projects                        创建
 *  PATCH  /v1/projects/:id                    更新
 *  DELETE /v1/projects/:id                    删除
 *
 * 注意：本服务扩展 user-service 的 projects 表（projects_ext 1:1）。
 *       业务字段（storyType / artStyle / visualAnchors / 季/集）都在 projects_ext。
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, count, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { projectsExt, projectMembers } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { hasProjectAccess } from './collaboration.js';

export const projectsRoute = new Hono();
projectsRoute.use('*', authMiddleware);

/* ------------------- Schemas ------------------- */
const createSchema = z.object({
  projectId: z.string().uuid().optional(),  // 关联 user-service.projects.id；不传则自建占位
  ownerId: z.string().uuid(),                // 项目所有者（user-service.users.id）
  title: z.string().min(1).max(200).optional(),
  storyType: z.string().max(50).optional(),
  artStyle: z.string().max(50).optional(),
  visualAnchors: z.record(z.string(), z.unknown()).optional(),
  collabPolicy: z.record(z.string(), z.unknown()).optional(),
  seasonNo: z.number().int().min(1).default(1),
  episodeCount: z.number().int().min(0).default(0),
  tags: z.array(z.string()).max(50).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  storyType: z.string().max(50).optional(),
  artStyle: z.string().max(50).optional(),
  visualAnchors: z.record(z.string(), z.unknown()).optional(),
  collabPolicy: z.record(z.string(), z.unknown()).optional(),
  seasonNo: z.number().int().min(1).optional(),
  episodeCount: z.number().int().min(0).optional(),
  tags: z.array(z.string()).max(50).optional(),
});

/* ------------------- GET / 列表 ------------------- */
projectsRoute.get('/', async (c) => {
  const auth = c.get('auth');
  const page = Math.max(1, Number(c.req.query('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') ?? '20')));
  const storyType = c.req.query('story_type');
  const artStyle = c.req.query('art_style');
  const offset = (page - 1) * pageSize;

  // 我作为 owner 或 member 的项目
  const conds: ReturnType<typeof eq>[] = [];
  conds.push(eq(projectsExt.ownerId, auth.subject));
  if (storyType) conds.push(eq(projectsExt.storyType, storyType));
  if (artStyle) conds.push(eq(projectsExt.artStyle, artStyle));

  // 协作项目（distinct + union）
  const memberOf = db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, auth.subject), eq(projectMembers.status, 'accepted')));

  const condsOr = [eq(projectsExt.ownerId, auth.subject), sql`${projectsExt.projectId} IN (${memberOf})`];

  const whereClause = and(
    storyType ? eq(projectsExt.storyType, storyType) : undefined,
    artStyle ? eq(projectsExt.artStyle, artStyle) : undefined,
    or(...condsOr)
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(projectsExt)
      .where(whereClause)
      .orderBy(desc(projectsExt.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(projectsExt).where(whereClause),
  ]);

  return c.json({
    list: rows,
    page,
    page_size: pageSize,
    total: Number(totalRow[0]?.value ?? 0),
  });
});

/* ------------------- GET /:id ------------------- */
projectsRoute.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const rows = await db.select().from(projectsExt).where(eq(projectsExt.id, id)).limit(1);
  const p = rows[0];
  if (!p) return c.json({ error: 'not_found' }, 404);

  // 权限：owner 或协作成员
  const access = await hasProjectAccess(p.id, auth.subject, ['owner', 'editor', 'viewer', 'commenter']);
  if (!access) return c.json({ error: 'forbidden' }, 403);

  return c.json(p);
});

/* ------------------- POST / ------------------- */
projectsRoute.post('/', async (c) => {
  const auth = c.get('auth');
  // 只允许 admin / editor 自己创建
  if (auth.role === 'viewer' || auth.role === 'anonymous') {
    return c.json({ error: 'forbidden', message: 'viewer cannot create projects' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400);
  }

  // projectId 不传时生成一个占位 uuid（让 user-service 后续可以接管；这里用 nano 短码辅助可读性）
  const projectId = parsed.data.projectId ?? `${nanoid(12)}`;

  const inserted = await db
    .insert(projectsExt)
    .values({
      projectId,
      ownerId: parsed.data.ownerId,
      storyType: parsed.data.storyType,
      artStyle: parsed.data.artStyle,
      visualAnchors: parsed.data.visualAnchors ?? {},
      collabPolicy: parsed.data.collabPolicy ?? {},
      seasonNo: parsed.data.seasonNo,
      episodeCount: parsed.data.episodeCount,
      tags: parsed.data.tags ?? [],
    })
    .returning();
  return c.json({ created: true, project: inserted[0] }, 201);
});

/* ------------------- PATCH /:id ------------------- */
projectsRoute.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400);
  }

  // 权限：owner 或 editor
  const access = await hasProjectAccess(id, auth.subject, ['owner', 'editor']);
  if (!access) return c.json({ error: 'forbidden' }, 403);

  // 锁定项目不允许编辑
  const cur = await db.select().from(projectsExt).where(eq(projectsExt.id, id)).limit(1);
  const curRow = cur[0];
  if (!curRow) return c.json({ error: 'not_found' }, 404);
  if (curRow.lockedAtVersion > 0 && access.role !== 'owner') {
    return c.json({ error: 'locked', message: 'project is locked, only owner can edit' }, 423);
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title; // title 不在 ext 表，留作兼容
  if (parsed.data.storyType !== undefined) patch.storyType = parsed.data.storyType;
  if (parsed.data.artStyle !== undefined) patch.artStyle = parsed.data.artStyle;
  if (parsed.data.visualAnchors !== undefined) patch.visualAnchors = parsed.data.visualAnchors;
  if (parsed.data.collabPolicy !== undefined) patch.collabPolicy = parsed.data.collabPolicy;
  if (parsed.data.seasonNo !== undefined) patch.seasonNo = parsed.data.seasonNo;
  if (parsed.data.episodeCount !== undefined) patch.episodeCount = parsed.data.episodeCount;
  if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
  if (Object.keys(patch).length === 0) return c.json({ error: 'empty_patch' }, 400);

  const updated = await db
    .update(projectsExt)
    .set(patch as any)
    .where(eq(projectsExt.id, id))
    .returning();
  return c.json({ updated: true, project: updated[0] });
});

/* ------------------- DELETE /:id ------------------- */
projectsRoute.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');

  const access = await hasProjectAccess(id, auth.subject, ['owner']);
  if (!access) return c.json({ error: 'forbidden', message: 'only owner can delete' }, 403);

  const deleted = await db
    .delete(projectsExt)
    .where(eq(projectsExt.id, id))
    .returning({ id: projectsExt.id });
  if (deleted.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ deleted: true, id: deleted[0]?.id });
});
