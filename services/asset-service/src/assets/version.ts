/**
 * 资产版本管理
 *
 * 每次生成/编辑 → 自动创建一份快照到 asset_versions。
 * 支持列出历史版本、查看特定版本、与当前版本做 diff。
 *
 * 路由：
 *  POST   /v1/assets/:id/versions              创建快照（手动或被工作流回调）
 *  GET    /v1/assets/:id/versions              版本列表（分页）
 *  GET    /v1/assets/:id/versions/:vNo         某版本详情
 *  POST   /v1/assets/:id/versions/:vNo/restore 恢复到该版本
 *  POST   /v1/assets/:id/versions/:vNo/diff    与当前版本 diff
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets, assetVersions } from '../db/schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';

export const versionRoute = new Hono();
versionRoute.use('*', authMiddleware);

/* ------------------- POST 创建快照 ------------------- */
const createSchema = z.object({
  fileUrl: z.string().optional(),
  thumbUrl: z.string().optional(),
  snapshot: z.record(z.string(), z.unknown()).default({}),
  changeNote: z.string().max(500).optional(),
});

versionRoute.post('/v1/assets/:id/versions', async (c) => {
  const auth = c.get('auth');
  const assetId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  // 找资产
  const arows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  const a = arows[0];
  if (!a) return c.json({ error: 'not_found' }, 404);
  if (a.ownerId !== auth.subject && auth.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }

  const nextVersion = a.currentVersion + 1;

  // 写版本
  const ins = await db
    .insert(assetVersions)
    .values({
      assetId,
      versionNo: nextVersion,
      fileUrl: parsed.data.fileUrl ?? a.fileUrl,
      thumbUrl: parsed.data.thumbUrl ?? a.thumbUrl,
      snapshot: parsed.data.snapshot,
      changeNote: parsed.data.changeNote,
      createdBy: auth.subject,
    })
    .returning();

  // 更新 assets.currentVersion
  await db
    .update(assets)
    .set({ currentVersion: nextVersion, updatedAt: new Date() } as any)
    .where(eq(assets.id, assetId));

  return c.json({ created: true, version: ins[0] }, 201);
});

/* ------------------- GET 版本列表 ------------------- */
versionRoute.get('/v1/assets/:id/versions', async (c) => {
  const assetId = c.req.param('id');
  const page = Math.max(1, Number(c.req.query('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') ?? '20')));
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select()
    .from(assetVersions)
    .where(eq(assetVersions.assetId, assetId))
    .orderBy(desc(assetVersions.versionNo))
    .limit(pageSize)
    .offset(offset);

  return c.json({ list: rows, page, page_size: pageSize });
});

/* ------------------- GET 单版本 ------------------- */
versionRoute.get('/v1/assets/:id/versions/:vNo', async (c) => {
  const assetId = c.req.param('id');
  const vNo = Number(c.req.param('vNo'));
  if (!Number.isInteger(vNo) || vNo < 1) return c.json({ error: 'bad_request' }, 400);
  const rows = await db
    .select()
    .from(assetVersions)
    .where(and(eq(assetVersions.assetId, assetId), eq(assetVersions.versionNo, vNo)))
    .limit(1);
  const v = rows[0];
  if (!v) return c.json({ error: 'not_found' }, 404);
  return c.json(v);
});

/* ------------------- POST 恢复到某版本 ------------------- */
versionRoute.post('/v1/assets/:id/versions/:vNo/restore', async (c) => {
  const auth = c.get('auth');
  const assetId = c.req.param('id');
  const vNo = Number(c.req.param('vNo'));
  if (!Number.isInteger(vNo) || vNo < 1) return c.json({ error: 'bad_request' }, 400);

  const arows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  const a = arows[0];
  if (!a) return c.json({ error: 'not_found' }, 404);
  if (a.ownerId !== auth.subject && auth.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }

  const vrows = await db
    .select()
    .from(assetVersions)
    .where(and(eq(assetVersions.assetId, assetId), eq(assetVersions.versionNo, vNo)))
    .limit(1);
  const v = vrows[0];
  if (!v) return c.json({ error: 'not_found' }, 404);

  // 把当前文件 / 缩略图 / snapshot 覆盖回 assets
  const upd = await db
    .update(assets)
    .set({
      fileUrl: v.fileUrl,
      thumbUrl: v.thumbUrl,
      meta: v.snapshot as any,
      updatedAt: new Date(),
    } as any)
    .where(eq(assets.id, assetId))
    .returning();
  return c.json({ restored: true, asset: upd[0] });
});

/* ------------------- POST diff ------------------- */
versionRoute.post('/v1/assets/:id/versions/:vNo/diff', async (c) => {
  const assetId = c.req.param('id');
  const vNo = Number(c.req.param('vNo'));
  if (!Number.isInteger(vNo) || vNo < 1) return c.json({ error: 'bad_request' }, 400);

  // 当前版本（assets 的 fileUrl/thumbUrl/snapshot）
  const arows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  const a = arows[0];
  if (!a) return c.json({ error: 'not_found' }, 404);

  // 指定版本
  const vrows = await db
    .select()
    .from(assetVersions)
    .where(and(eq(assetVersions.assetId, assetId), eq(assetVersions.versionNo, vNo)))
    .limit(1);
  const v = vrows[0];
  if (!v) return c.json({ error: 'not_found' }, 404);

  // 简单 key-level diff（snapshot 是 jsonb）
  const before = (v.snapshot ?? {}) as Record<string, unknown>;
  const after = (a.meta ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: Array<{ key: string; before: unknown; after: unknown; changed: boolean }> = [];
  for (const k of keys) {
    diff.push({
      key: k,
      before: before[k],
      after: after[k],
      changed: JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    });
  }

  return c.json({
    from: { versionNo: v.versionNo, fileUrl: v.fileUrl, thumbUrl: v.thumbUrl, createdAt: v.createdAt },
    to: { versionNo: a.currentVersion, fileUrl: a.fileUrl, thumbUrl: a.thumbUrl, updatedAt: a.updatedAt },
    diff,
    fileChanged: v.fileUrl !== a.fileUrl,
    thumbChanged: v.thumbUrl !== a.thumbUrl,
  });
});
