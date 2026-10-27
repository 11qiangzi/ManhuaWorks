/**
 * 参考图档案：统一多视角参考图存储
 *
 * 为 6 大创作模块提供角色/场景/产品一致性参考图管理。
 *
 * 路由（挂载于 /v1/reference-images）：
 *  GET    /                        查询某实体的参考图列表
 *  POST   /                        新建单条参考图
 *  POST   /batch                   批量新建参考图
 *  GET    /project/:projectId/summary  项目参考图摘要统计
 *  PATCH  /:id                     更新参考图
 *  DELETE /:id                     删除参考图
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import {
  referenceImages,
  refEntityTypes,
  refImageTypes,
  type RefEntityType,
  type RefImageType,
} from '../db/schema.js';

export const referenceImagesRoute = new Hono();
referenceImagesRoute.use('*', authMiddleware);

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const entityTypeEnum = z.enum(refEntityTypes as unknown as [string, ...string[]]);
const imageTypeEnum = z.enum(refImageTypes as unknown as [string, ...string[]]);

const listQuerySchema = z.object({
  projectId: z.string().uuid(),
  entityType: entityTypeEnum.optional(),
  entityId: z.string().optional(),
});

const createSchema = z.object({
  projectId: z.string().uuid(),
  entityType: entityTypeEnum,
  entityId: z.string().min(1).max(200),
  imageUrl: z.string().min(1),
  imageType: imageTypeEnum.default('front'),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

const patchSchema = z.object({
  imageUrl: z.string().min(1).optional(),
  imageType: imageTypeEnum.optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const batchImageSchema = z.object({
  imageUrl: z.string().min(1),
  imageType: imageTypeEnum.default('front'),
  description: z.string().optional(),
});

const batchCreateSchema = z.object({
  projectId: z.string().uuid(),
  entityType: entityTypeEnum,
  entityId: z.string().min(1).max(200),
  images: z.array(batchImageSchema).min(1).max(50),
});

/* ------------------------------------------------------------------ */
/*  GET / — 查询某实体的参考图列表                                       */
/* ------------------------------------------------------------------ */
referenceImagesRoute.get('/', async (c) => {
  const query = c.req.query();
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json(
      { code: 1, message: 'bad_request', issues: parsed.error.flatten() },
      400
    );
  }

  const { projectId, entityType, entityId } = parsed.data;

  const conditions = [eq(referenceImages.projectId, projectId)];
  if (entityType) conditions.push(eq(referenceImages.entityType, entityType as RefEntityType));
  if (entityId) conditions.push(eq(referenceImages.entityId, entityId));

  const items = await db
    .select()
    .from(referenceImages)
    .where(and(...conditions))
    .orderBy(referenceImages.sortOrder, referenceImages.createdAt);

  return c.json({
    code: 0,
    message: 'ok',
    data: { items, total: items.length },
  });
});

/* ------------------------------------------------------------------ */
/*  POST /batch — 批量创建参考图（放在 /:id 之前，避免路由冲突）          */
/* ------------------------------------------------------------------ */
referenceImagesRoute.post('/batch', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = batchCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 1, message: 'bad_request', issues: parsed.error.flatten() },
      400
    );
  }

  const { projectId, entityType, entityId, images } = parsed.data;

  const rows = images.map((img, idx) => ({
    projectId,
    entityType: entityType as RefEntityType,
    entityId,
    imageUrl: img.imageUrl,
    imageType: (img.imageType ?? 'front') as RefImageType,
    description: img.description ?? null,
    sortOrder: idx,
    createdBy: auth.subject,
  }));

  const inserted = await db.insert(referenceImages).values(rows).returning();

  return c.json({
    code: 0,
    message: 'ok',
    data: { created: inserted.length, items: inserted },
  }, 201);
});

/* ------------------------------------------------------------------ */
/*  GET /project/:projectId/summary — 项目参考图摘要统计                  */
/* ------------------------------------------------------------------ */
referenceImagesRoute.get('/project/:projectId/summary', async (c) => {
  const projectId = c.req.param('projectId');
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return c.json({ code: 1, message: 'invalid projectId' }, 400);
  }

  // Aggregate: group by entity_type, entity_id → count images
  const rows = await db
    .select({
      entityType: referenceImages.entityType,
      entityId: referenceImages.entityId,
      count: sql<number>`count(*)::int`,
    })
    .from(referenceImages)
    .where(eq(referenceImages.projectId, projectId))
    .groupBy(referenceImages.entityType, referenceImages.entityId);

  // Build summary buckets
  const characters: Array<{ name: string; count: number }> = [];
  const scenes: Array<{ name: string; count: number }> = [];
  const products: Array<{ name: string; count: number }> = [];
  const styles: Array<{ name: string; count: number }> = [];
  let total = 0;

  for (const row of rows) {
    const entry = { name: row.entityId, count: row.count };
    total += row.count;
    switch (row.entityType) {
      case 'character':
        characters.push(entry);
        break;
      case 'scene':
        scenes.push(entry);
        break;
      case 'product':
        products.push(entry);
        break;
      case 'style':
        styles.push(entry);
        break;
    }
  }

  return c.json({
    code: 0,
    message: 'ok',
    data: { characters, scenes, products, styles, total },
  });
});

/* ------------------------------------------------------------------ */
/*  POST / — 新建单条参考图                                              */
/* ------------------------------------------------------------------ */
referenceImagesRoute.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 1, message: 'bad_request', issues: parsed.error.flatten() },
      400
    );
  }

  const data = parsed.data;

  const inserted = await db
    .insert(referenceImages)
    .values({
      projectId: data.projectId,
      entityType: data.entityType as RefEntityType,
      entityId: data.entityId,
      imageUrl: data.imageUrl,
      imageType: (data.imageType ?? 'front') as RefImageType,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdBy: auth.subject,
    })
    .returning();

  return c.json(
    { code: 0, message: 'ok', data: inserted[0] },
    201
  );
});

/* ------------------------------------------------------------------ */
/*  PATCH /:id — 更新参考图                                              */
/* ------------------------------------------------------------------ */
referenceImagesRoute.patch('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ code: 1, message: 'invalid id' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 1, message: 'bad_request', issues: parsed.error.flatten() },
      400
    );
  }

  // Check existence
  const existing = await db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.id, id))
    .limit(1);
  if (!existing[0]) {
    return c.json({ code: 1, message: 'not_found' }, 404);
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.imageUrl !== undefined) patch.imageUrl = parsed.data.imageUrl;
  if (parsed.data.imageType !== undefined) patch.imageType = parsed.data.imageType;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;

  if (Object.keys(patch).length === 0) {
    return c.json({ code: 0, message: 'ok', data: existing[0] });
  }

  const updated = await db
    .update(referenceImages)
    .set(patch)
    .where(eq(referenceImages.id, id))
    .returning();

  return c.json({ code: 0, message: 'ok', data: updated[0] });
});

/* ------------------------------------------------------------------ */
/*  DELETE /:id — 删除参考图                                             */
/* ------------------------------------------------------------------ */
referenceImagesRoute.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ code: 1, message: 'invalid id' }, 400);
  }

  const existing = await db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.id, id))
    .limit(1);
  if (!existing[0]) {
    return c.json({ code: 1, message: 'not_found' }, 404);
  }

  // Permission: creator or admin
  const cur = existing[0];
  if (cur.createdBy && cur.createdBy !== auth.subject && auth.role !== 'admin') {
    return c.json({ code: 1, message: 'forbidden' }, 403);
  }

  await db.delete(referenceImages).where(eq(referenceImages.id, id));

  return c.json({ code: 0, message: 'deleted' });
});
