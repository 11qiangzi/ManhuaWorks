/**
 * 角色锁脸：4 角度头像 + 跨场景一致性
 *
 * 角色锁定的目标：让同一个角色在所有镜头里保持一致（脸型/服装/色板/IP-Adapter 参考）。
 *
 * 路由：
 *  POST   /v1/assets/lock-face                 锁定一个角色（4 角度头像）
 *  GET    /v1/assets/lock-face/:characterId    获取锁定档案
 *  PATCH  /v1/assets/lock-face/:characterId    更新某个角度或视觉锚点
 *  DELETE /v1/assets/lock-face/:characterId    解锁
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assetLocks, lockFaceAngles, type LockFaceAngle } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

export const lockFaceRoute = new Hono();
lockFaceRoute.use('*', authMiddleware);

function allAngles(value: Record<string, string>): value is Record<LockFaceAngle, string> {
  return lockFaceAngles.every((a) => typeof value[a] === 'string' && value[a]!.length > 0);
}

const lockSchema = z.object({
  characterId: z.string().uuid(),                  // 关联 assets.id (kind='character')
  characterName: z.string().min(1).max(100),
  faceAngles: z.object({
    front: z.string().url().or(z.string().startsWith('/')),
    left: z.string().url().or(z.string().startsWith('/')),
    right: z.string().url().or(z.string().startsWith('/')),
    back: z.string().url().or(z.string().startsWith('/')),
  }),
  visualAnchors: z.record(z.string(), z.unknown()).default({}),
  referenceEmbedding: z.string().optional(),        // IP-Adapter / 384d 向量（base64）
  projectId: z.string().uuid().optional(),
});

/* POST /v1/assets/lock-face */
lockFaceRoute.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400);

  // 校验 4 角度都有
  if (!allAngles(parsed.data.faceAngles)) {
    return c.json({ error: 'bad_request', message: 'all 4 angles required' }, 400);
  }

  // upsert
  const existing = await db
    .select()
    .from(assetLocks)
    .where(eq(assetLocks.characterId, parsed.data.characterId))
    .limit(1);
  const ex = existing[0];

  if (ex) {
    const upd = await db
      .update(assetLocks)
      .set({
        characterName: parsed.data.characterName,
        faceAngles: parsed.data.faceAngles,
        visualAnchors: parsed.data.visualAnchors,
        referenceEmbedding: parsed.data.referenceEmbedding ?? null,
        projectId: parsed.data.projectId ?? ex.projectId,
      } as any)
      .where(eq(assetLocks.characterId, parsed.data.characterId))
      .returning();
    return c.json({ locked: true, lock: upd[0] });
  }

  const ins = await db
    .insert(assetLocks)
    .values({
      characterId: parsed.data.characterId,
      characterName: parsed.data.characterName,
      faceAngles: parsed.data.faceAngles,
      visualAnchors: parsed.data.visualAnchors,
      referenceEmbedding: parsed.data.referenceEmbedding ?? null,
      projectId: parsed.data.projectId ?? null,
      createdBy: auth.subject,
    } as any)
    .returning();
  return c.json({ locked: true, lock: ins[0] }, 201);
});

/* GET /v1/assets/lock-face/:characterId */
lockFaceRoute.get('/:characterId', async (c) => {
  const cid = c.req.param('characterId');
  const rows = await db.select().from(assetLocks).where(eq(assetLocks.characterId, cid)).limit(1);
  const r = rows[0];
  if (!r) return c.json({ error: 'not_found' }, 404);
  return c.json(r);
});

/* PATCH /v1/assets/lock-face/:characterId */
const patchSchema = z.object({
  characterName: z.string().min(1).max(100).optional(),
  faceAngles: z
    .object({
      front: z.string().optional(),
      left: z.string().optional(),
      right: z.string().optional(),
      back: z.string().optional(),
    })
    .optional(),
  visualAnchors: z.record(z.string(), z.unknown()).optional(),
  referenceEmbedding: z.string().optional(),
});

lockFaceRoute.patch('/:characterId', async (c) => {
  const auth = c.get('auth');
  const cid = c.req.param('characterId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  // 权限：仅创建者可改
  const rows = await db.select().from(assetLocks).where(eq(assetLocks.characterId, cid)).limit(1);
  const cur = rows[0];
  if (!cur) return c.json({ error: 'not_found' }, 404);
  if (cur.createdBy !== auth.subject && auth.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.characterName) patch.characterName = parsed.data.characterName;
  if (parsed.data.faceAngles) {
    const merged = { ...cur.faceAngles, ...parsed.data.faceAngles };
    if (!allAngles(merged)) {
      return c.json({ error: 'bad_request', message: 'all 4 angles still required' }, 400);
    }
    patch.faceAngles = merged;
  }
  if (parsed.data.visualAnchors) patch.visualAnchors = parsed.data.visualAnchors;
  if (parsed.data.referenceEmbedding) patch.referenceEmbedding = parsed.data.referenceEmbedding;

  const upd = await db
    .update(assetLocks)
    .set(patch as any)
    .where(eq(assetLocks.characterId, cid))
    .returning();
  return c.json({ updated: true, lock: upd[0] });
});

/* DELETE /v1/assets/lock-face/:characterId */
lockFaceRoute.delete('/:characterId', async (c) => {
  const auth = c.get('auth');
  const cid = c.req.param('characterId');
  const rows = await db.select().from(assetLocks).where(eq(assetLocks.characterId, cid)).limit(1);
  const cur = rows[0];
  if (!cur) return c.json({ error: 'not_found' }, 404);
  if (cur.createdBy !== auth.subject && auth.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }
  await db.delete(assetLocks).where(eq(assetLocks.characterId, cid));
  return c.json({ unlocked: true, characterId: cid });
});

/* 暴露给上层（workflow-engine 同步调用） */
export { lockFaceAngles };
