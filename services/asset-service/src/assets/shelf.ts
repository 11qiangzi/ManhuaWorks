/**
 * 资产货架：3 级
 *
 *  GET  /v1/shelf                       我的货架（user）
 *  GET  /v1/shelf/project/:projectId    项目级货架
 *  GET  /v1/shelf/global                全局公共货架
 *
 * 统一支持：
 *  - 分页（page / page_size）
 *  - 类型过滤（kind）
 *  - 标签过滤（tag）
 *  - 关键词搜索（q，name + description）
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { and, desc, eq, or, ilike, sql } from 'drizzle-orm';
import { config } from '../config.js';

export const shelfRoute = new Hono();
shelfRoute.use('*', authMiddleware);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(config.shelf.maxPageSize).default(20),
  kind: z.enum(['image', 'video', 'audio', 'character', 'scene', 'shot', 'episode']).optional(),
  tag: z.string().max(50).optional(),
  q: z.string().max(200).optional(),
});

async function fetchShelf(whereConds: ReturnType<typeof eq>[], q: z.infer<typeof querySchema>) {
  const offset = (q.page - 1) * q.pageSize;
  const where = and(...whereConds);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(q.pageSize)
      .offset(offset),
    db.select({ value: sql<number>`count(*)::int` }).from(assets).where(where),
  ]);
  return { list: rows, page: q.page, page_size: q.pageSize, total: Number(totalRow[0]?.value ?? 0) };
}

/* GET /v1/shelf — 用户级（owner = 自己） */
shelfRoute.get('/', async (c) => {
  const auth = c.get('auth');
  const q = querySchema.parse({
    page: c.req.query('page') ?? undefined,
    pageSize: c.req.query('page_size') ?? undefined,
    kind: c.req.query('kind') ?? undefined,
    tag: c.req.query('tag') ?? undefined,
    q: c.req.query('q') ?? undefined,
  });

  const conds: any[] = [eq(assets.ownerId, auth.subject), eq(assets.shelfLevel, 'user')];
  if (q.kind) conds.push(eq(assets.kind, q.kind));
  if (q.tag) conds.push(sql`${assets.tags} @> ${JSON.stringify([q.tag])}::jsonb`);
  if (q.q) conds.push(or(ilike(assets.name, `%${q.q}%`), ilike(assets.description, `%${q.q}%`)));

  return c.json(await fetchShelf(conds, q));
});

/* GET /v1/shelf/project/:projectId — 项目级 */
shelfRoute.get('/project/:projectId', async (c) => {
  const auth = c.get('auth');
  const projectId = c.req.param('projectId');
  const q = querySchema.parse({
    page: c.req.query('page') ?? undefined,
    pageSize: c.req.query('page_size') ?? undefined,
    kind: c.req.query('kind') ?? undefined,
    tag: c.req.query('tag') ?? undefined,
    q: c.req.query('q') ?? undefined,
  });

  const conds: any[] = [eq(assets.projectId, projectId), eq(assets.shelfLevel, 'project')];
  if (q.kind) conds.push(eq(assets.kind, q.kind));
  if (q.tag) conds.push(sql`${assets.tags} @> ${JSON.stringify([q.tag])}::jsonb`);
  if (q.q) conds.push(or(ilike(assets.name, `%${q.q}%`), ilike(assets.description, `%${q.q}%`)));

  // 权限：项目 owner / 协作成员
  // 简化：自己创建的或公开的项目级
  conds.push(or(eq(assets.ownerId, auth.subject), eq(assets.isPublic, true)));
  return c.json(await fetchShelf(conds, q));
});

/* GET /v1/shelf/global — 全局公共 */
shelfRoute.get('/global', async (c) => {
  const q = querySchema.parse({
    page: c.req.query('page') ?? undefined,
    pageSize: c.req.query('page_size') ?? undefined,
    kind: c.req.query('kind') ?? undefined,
    tag: c.req.query('tag') ?? undefined,
    q: c.req.query('q') ?? undefined,
  });

  const conds: any[] = [eq(assets.shelfLevel, 'global'), eq(assets.isPublic, true)];
  if (q.kind) conds.push(eq(assets.kind, q.kind));
  if (q.tag) conds.push(sql`${assets.tags} @> ${JSON.stringify([q.tag])}::jsonb`);
  if (q.q) conds.push(or(ilike(assets.name, `%${q.q}%`), ilike(assets.description, `%${q.q}%`)));

  return c.json(await fetchShelf(conds, q));
});
