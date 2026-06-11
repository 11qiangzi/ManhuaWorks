/**
 * 资产上传
 * - 支持图片 / 视频 / 音频
 * - 默认落本地（/tmp/mhw-assets 或 LOCAL_STORAGE_DIR），可切换 S3/MinIO
 * - multipart/form-data 接收；Hono 原生 c.req.parseBody() 处理
 *
 * 路由：
 *  POST   /v1/assets/upload          上传
 *  GET    /v1/assets/:id             资产详情
 *  DELETE /v1/assets/:id             删除
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets, type AssetKind } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

export const uploadRoute = new Hono();
uploadRoute.use('*', authMiddleware);

/* ------------------- helpers ------------------- */
function isAllowedMime(mime: string, kind: 'image' | 'video' | 'audio'): boolean {
  if (kind === 'image') return (config.upload.allowedImageMimes as readonly string[]).includes(mime);
  if (kind === 'video') return (config.upload.allowedVideoMimes as readonly string[]).includes(mime);
  return (config.upload.allowedAudioMimes as readonly string[]).includes(mime);
}

function inferKind(mime: string): 'image' | 'video' | 'audio' | null {
  if ((config.upload.allowedImageMimes as readonly string[]).includes(mime)) return 'image';
  if ((config.upload.allowedVideoMimes as readonly string[]).includes(mime)) return 'video';
  if ((config.upload.allowedAudioMimes as readonly string[]).includes(mime)) return 'audio';
  return null;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/x-m4a': '.m4a',
  };
  return map[mime] ?? '.bin';
}

/** S3 兼容上传；未配置时返回 null，回退到本地存储 */
async function uploadToS3(
  key: string,
  body: Buffer,
  mime: string
): Promise<{ url: string } | null> {
  if (!config.s3.enabled || !config.s3.endpoint) return null;
  // 简化 PUT 请求：实际生产建议用 @aws-sdk/client-s3
  const url = `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${key}`;
  const auth =
    'AWS4-HMAC-SHA256 Credential=' +
    `${config.s3.accessKey}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${config.s3.region}/s3/aws4_request`;
  // 这里只构造签名占位（生产由 SDK 完成）；不阻塞主流程
  void auth;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body,
    });
    if (!res.ok) return null;
    return { url };
  } catch {
    return null;
  }
}

async function uploadToLocal(
  ownerId: string,
  ext: string,
  body: Buffer
): Promise<{ url: string; filePath: string }> {
  const key = `${ownerId}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${nanoid(16)}${ext}`;
  const filePath = path.join(config.storage.localDir, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body);
  return {
    filePath,
    url: `${config.storage.publicBaseUrl.replace(/\/$/, '')}/${key}`,
  };
}

/* ------------------- POST /v1/assets/upload ------------------- */
const metaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  kind: z.enum(['image', 'video', 'audio', 'character', 'scene', 'shot', 'episode']).optional(),
  projectId: z.string().uuid().optional(),
  shelfLevel: z.enum(['user', 'project', 'global']).default('user'),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).max(50).optional(),
});

uploadRoute.post('/upload', async (c) => {
  const auth = c.get('auth');
  const formData = await c.req.parseBody();
  const file = formData['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'bad_request', message: 'file field is required' }, 400);
  }
  if (file.size > config.upload.maxSizeMb * 1024 * 1024) {
    return c.json({ error: 'too_large', message: `max ${config.upload.maxSizeMb}MB` }, 413);
  }

  // 解析 metadata
  const metaRaw = formData['meta'];
  let meta: z.input<typeof metaSchema> = {};
  if (typeof metaRaw === 'string') {
    try {
      meta = metaSchema.parse(JSON.parse(metaRaw));
    } catch (e) {
      return c.json({ error: 'bad_request', message: 'invalid meta', detail: String(e) }, 400);
    }
  }

  const mime = file.type || 'application/octet-stream';
  const inferred = inferKind(mime);
  const kind: AssetKind = (meta.kind ?? inferred ?? 'image') as AssetKind;
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    if (!isAllowedMime(mime, kind)) {
      return c.json({ error: 'bad_mime', message: `${mime} not allowed for ${kind}` }, 415);
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mime);

  // 优先 S3，否则本地
  const s3Res = await uploadToS3(`${auth.subject}/${nanoid(16)}${ext}`, buf, mime);
  let fileUrl: string;
  if (s3Res) {
    fileUrl = s3Res.url;
  } else {
    const local = await uploadToLocal(auth.subject, ext, buf);
    fileUrl = local.url;
  }

  // 入库
  const ins = await db
    .insert(assets)
    .values({
      ownerId: auth.subject,
      projectId: meta.projectId ?? null,
      kind,
      name: meta.name ?? file.name,
      description: meta.description ?? null,
      fileUrl,
      sizeBytes: file.size,
      mimeType: mime,
      shelfLevel: meta.shelfLevel,
      isPublic: meta.isPublic,
      tags: meta.tags ?? [],
    })
    .returning();
  return c.json({ uploaded: true, asset: ins[0] }, 201);
});

/* ------------------- GET /v1/assets/:id ------------------- */
uploadRoute.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  const a = rows[0];
  if (!a) return c.json({ error: 'not_found' }, 404);
  // 权限：自己的 或 public
  if (a.ownerId !== auth.subject && !a.isPublic) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return c.json(a);
});

/* ------------------- DELETE /v1/assets/:id ------------------- */
uploadRoute.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  const a = rows[0];
  if (!a) return c.json({ error: 'not_found' }, 404);
  if (a.ownerId !== auth.subject) return c.json({ error: 'forbidden' }, 403);

  await db.delete(assets).where(eq(assets.id, id));
  return c.json({ deleted: true, id });
});
