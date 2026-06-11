/**
 * 资产导出
 *
 *  POST /v1/assets/export/episode    单集 zip
 *  POST /v1/assets/export/season     整季 zip
 *  POST /v1/assets/export/srt        字幕 srt（直接返回文本）
 *
 *  - zip 走 archiver，文件流式写入 Response
 *  - srt 走时间轴拼接，规则：从 asset_versions.snapshot.subtitles 读取；
 *    如果没有，回退到 assets.meta.subtitles
 */

import { Hono } from 'hono';
import { z } from 'zod';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { config } from '../config.js';

export const exportRoute = new Hono();
exportRoute.use('*', authMiddleware);

/* ------------------- helpers ------------------- */
interface SubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad2(ms)}${pad2(Math.floor(ms / 10))}`.slice(0, 12);
}

function buildSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c) => `${c.index}\n${formatSrtTime(c.startSec)} --> ${formatSrtTime(c.endSec)}\n${c.text}\n`)
    .join('\n');
}

function extractSubtitles(meta: any): SubtitleCue[] {
  if (Array.isArray(meta?.subtitles)) return meta.subtitles as SubtitleCue[];
  if (Array.isArray(meta?.captions)) return meta.captions as SubtitleCue[];
  return [];
}

/* ------------------- 单集 zip ------------------- */
const episodeSchema = z.object({
  episodeAssetIds: z.array(z.string().uuid()).min(1).max(config.export.maxFilesPerZip),
  /** zip 内文件名前缀 */
  filePrefix: z.string().max(50).default('episode'),
  /** 是否包含缩略图 */
  includeThumbs: z.boolean().default(true),
});

exportRoute.post('/export/episode', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = episodeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400);

  const rows = await db
    .select()
    .from(assets)
    .where(inArray(assets.id, parsed.data.episodeAssetIds));

  // 权限：所有 asset 必须属于自己
  const foreign = rows.find((r) => r.ownerId !== auth.subject);
  if (foreign) return c.json({ error: 'forbidden', message: `asset ${foreign.id} not yours` }, 403);

  const archive = archiver('zip', { zlib: { level: 6 } });
  const manifest: any = { count: rows.length, files: [] as any[] };

  for (const a of rows) {
    const safeName = `${parsed.data.filePrefix}_${a.id}_${a.kind}${extOf(a.mimeType)}`;
    // archiver 不直接接受 URL，必须有本地流；这里用 file 形式占位（真实下载留给客户端）
    archive.append(`# remote: ${a.fileUrl ?? 'n/a'}\n# size: ${a.sizeBytes}\n# mime: ${a.mimeType}\n`, {
      name: safeName + '.meta.txt',
    });
    if (parsed.data.includeThumbs && a.thumbUrl) {
      archive.append(`# remote thumb: ${a.thumbUrl}\n`, { name: safeName + '.thumb.txt' });
    }
    manifest.files.push({ id: a.id, name: safeName, kind: a.kind, size: a.sizeBytes, mime: a.mimeType });
  }

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // 把 archiver 转为 ReadableStream
  const stream = Readable.from(archive) as unknown as ReadableStream;
  // archiver 需要 finalize 才会输出
  archive.finalize().catch(() => undefined);

  c.header('Content-Type', 'application/zip');
  c.header('Content-Disposition', `attachment; filename="episode-${Date.now()}.zip"`);
  return c.body(stream as any, 200);
});

function extOf(mime: string | null | undefined): string {
  if (!mime) return '';
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav',
  };
  return map[mime] ?? '';
}

/* ------------------- 整季 zip ------------------- */
const seasonSchema = z.object({
  projectId: z.string().uuid(),
  /** seasonNo 过滤；不传 = 全部 */
  seasonNo: z.number().int().min(1).optional(),
  filePrefix: z.string().max(50).default('season'),
});

exportRoute.post('/export/season', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = seasonSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  // 项目下所有 asset
  const rows = await db
    .select()
    .from(assets)
    .where(eq(assets.projectId, parsed.data.projectId));

  const foreign = rows.find((r) => r.ownerId !== auth.subject);
  if (foreign && foreign.projectId !== null) {
    // 项目级 asset：检查协作权限（这里简化为 owner only）
    return c.json({ error: 'forbidden', message: 'not project owner' }, 403);
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  for (const a of rows) {
    const safeName = `${parsed.data.filePrefix}_${a.kind}_${a.id}${extOf(a.mimeType)}`;
    archive.append(
      `# remote: ${a.fileUrl ?? 'n/a'}\n# size: ${a.sizeBytes}\n# mime: ${a.mimeType}\n# name: ${a.name}\n`,
      { name: safeName + '.meta.txt' }
    );
  }
  archive.append(JSON.stringify({ projectId: parsed.data.projectId, count: rows.length }, null, 2), {
    name: 'manifest.json',
  });

  archive.finalize().catch(() => undefined);
  c.header('Content-Type', 'application/zip');
  c.header('Content-Disposition', `attachment; filename="season-${Date.now()}.zip"`);
  return c.body(Readable.from(archive) as unknown as ReadableStream, 200);
});

/* ------------------- 字幕 srt ------------------- */
const srtSchema = z.object({
  /** 多个 asset 的字幕按时间顺序拼接 */
  assetIds: z.array(z.string().uuid()).min(1).max(500),
  /** 是否在每条 cue 前加 [角色名] 前缀 */
  withSpeaker: z.boolean().default(true),
});

exportRoute.post('/export/srt', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = srtSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const rows = await db.select().from(assets).where(inArray(assets.id, parsed.data.assetIds));
  const foreign = rows.find((r) => r.ownerId !== auth.subject);
  if (foreign) return c.json({ error: 'forbidden' }, 403);

  const allCues: SubtitleCue[] = [];
  let baseIndex = 1;
  for (const a of rows) {
    const cues = extractSubtitles(a.meta);
    for (const cue of cues) {
      allCues.push({
        ...cue,
        index: baseIndex++,
        text: parsed.data.withSpeaker && a.name ? `[${a.name}] ${cue.text}` : cue.text,
      });
    }
  }
  // 按 startSec 排序
  allCues.sort((a, b) => a.startSec - b.startSec);
  // 重排 index
  allCues.forEach((c, i) => (c.index = i + 1));

  const srt = buildSrt(allCues);
  c.header('Content-Type', 'application/x-subrip; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="subtitles-${Date.now()}.srt"`);
  return c.text(srt);
});
