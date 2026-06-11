/**
 * 11 套艺术风格资产（导入自 Toonflow）
 *
 * 路由：
 *  GET    /v1/assets/art-styles            列表
 *  GET    /v1/assets/art-styles/:id        详情
 *  POST   /v1/assets/art-styles            新增（admin）
 *  PATCH  /v1/assets/art-styles/:id        更新（admin）
 *  DELETE /v1/assets/art-styles/:id        删除（admin）
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface ArtStyle {
  id: string;
  name: string;
  nameZh: string;
  visualKeywords: string[];
  prefixPrompt: string;
  palette: string[];
  bestFor: string[];
  compositionRules: string[];
  /** 视觉锚点（图像模型一致性参考） */
  visualAnchors?: {
    /** 主色 */
    primary: string;
    /** 辅色 */
    secondary?: string;
    /** 线稿类型 */
    lineType: 'clean' | 'rough' | 'ink' | 'none';
    /** 渲染引擎偏好 */
    renderEngine?: '2d' | '3d' | 'live2d' | 'realphoto';
  };
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: '2d_90s_japanese_anime',
    name: '2D 90s Japanese Anime',
    nameZh: '2D 90年代日式动漫',
    visualKeywords: ['cel-shaded', 'vibrant', '90s anime', 'hand-drawn'],
    prefixPrompt: '90s japanese anime style, cel-shaded, hand-drawn, vibrant colors, expressive eyes, dynamic poses, ',
    palette: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72CF'],
    bestFor: ['hot_blooded_action', 'xianxia_fantasy', 'coming_of_age'],
    compositionRules: ['speed lines for action', 'sweat drops for emotion', 'large expressive eyes'],
    visualAnchors: { primary: '#FF6B6B', lineType: 'clean', renderEngine: '2d' },
  },
  {
    id: '2d_chinese_guofeng',
    name: '2D Chinese Guofeng',
    nameZh: '2D 中国国风',
    visualKeywords: ['guofeng', 'ink wash', 'traditional chinese', 'hanfu'],
    prefixPrompt: 'chinese guofeng style, ink wash painting, traditional hanfu, flowing silk, mountain landscape, ',
    palette: ['#8B4513', '#D4AF37', '#2F4F4F', '#CD853F', '#DC143C'],
    bestFor: ['xianxia_fantasy', 'historical_epic'],
    compositionRules: ['flowing silk ribbons', 'ink wash backgrounds', 'calligraphy text'],
    visualAnchors: { primary: '#D4AF37', lineType: 'ink', renderEngine: '2d' },
  },
  {
    id: '2d_flat_design',
    name: '2D Flat Design',
    nameZh: '2D 扁平设计',
    visualKeywords: ['flat design', 'minimal', 'vector', 'clean lines'],
    prefixPrompt: 'flat design illustration, minimal, vector art, clean lines, solid colors, no shading, ',
    palette: ['#FFB6C1', '#87CEEB', '#98FB98', '#FFD700', '#DDA0DD'],
    bestFor: ['comedy_humor', 'family_warmth'],
    compositionRules: ['no gradients', 'geometric shapes', 'bold outlines'],
    visualAnchors: { primary: '#87CEEB', lineType: 'clean', renderEngine: '2d' },
  },
  {
    id: '2d_mature_urban_romance',
    name: '2D Mature Urban Romance',
    nameZh: '2D 都市成熟言情',
    visualKeywords: ['modern shoujo', 'urban', 'fashionable', 'sophisticated'],
    prefixPrompt: 'modern urban romance anime style, fashionable characters, city backdrop, soft lighting, ',
    palette: ['#FFB7C5', '#E6E6FA', '#F0E68C', '#DDA0DD', '#AFEEEE'],
    bestFor: ['sweet_romance_novel', 'urban_workplace_drama'],
    compositionRules: ['soft lighting', 'fashionable outfits', 'city skylines'],
    visualAnchors: { primary: '#FFB7C5', lineType: 'clean', renderEngine: '2d' },
  },
  {
    id: '3d_anime_render',
    name: '3D Anime Render',
    nameZh: '3D 动漫渲染',
    visualKeywords: ['3d anime', 'unreal engine', 'subsurface scattering', 'cinematic'],
    prefixPrompt: '3d anime render, unreal engine 5, cinematic lighting, subsurface scattering, detailed, ',
    palette: ['#FF1493', '#00CED1', '#FFD700', '#9370DB', '#FF6347'],
    bestFor: ['hot_blooded_action', 'scifi_post_apocalypse'],
    compositionRules: ['volumetric lighting', 'depth of field', 'realistic materials'],
    visualAnchors: { primary: '#FF1493', lineType: 'clean', renderEngine: '3d' },
  },
  {
    id: '3d_chinese_traditional',
    name: '3D Chinese Traditional',
    nameZh: '3D 中国传统',
    visualKeywords: ['3d guofeng', 'traditional chinese', 'ornate', 'pavilion'],
    prefixPrompt: '3d chinese traditional style, ornate pavilions, red lanterns, traditional architecture, ',
    palette: ['#8B0000', '#FFD700', '#006400', '#4B0082', '#FF8C00'],
    bestFor: ['xianxia_fantasy', 'historical_epic'],
    compositionRules: ['ornate carvings', 'red lanterns', 'traditional roofs'],
    visualAnchors: { primary: '#FFD700', lineType: 'clean', renderEngine: '3d' },
  },
  {
    id: '3d_clay_stopmotion',
    name: '3D Clay Stopmotion',
    nameZh: '3D 黏土定格',
    visualKeywords: ['claymation', 'stopmotion', 'textured', 'playful'],
    prefixPrompt: '3d claymation stopmotion style, textured clay, fingerprints visible, playful, ',
    palette: ['#F4A460', '#DEB887', '#8B4513', '#FFA07A', '#CD853F'],
    bestFor: ['family_warmth', 'comedy_humor', 'coming_of_age'],
    compositionRules: ['visible fingerprints', 'clay texture', 'miniature sets'],
    visualAnchors: { primary: '#F4A460', lineType: 'rough', renderEngine: '3d' },
  },
  {
    id: '3d_guofeng_cyber',
    name: '3D Guofeng Cyber',
    nameZh: '3D 国风赛博',
    visualKeywords: ['guofeng cyberpunk', 'neon', 'hanfu', 'futuristic'],
    prefixPrompt: 'guofeng cyberpunk style, neon lights, hanfu meets tech, futuristic oriental city, ',
    palette: ['#FF00FF', '#00FFFF', '#FFD700', '#FF1493', '#9B30FF'],
    bestFor: ['scifi_post_apocalypse', 'xianxia_fantasy'],
    compositionRules: ['neon signs with chinese characters', 'hanfu + tech implants', 'rain reflections'],
    visualAnchors: { primary: '#FF00FF', secondary: '#00FFFF', lineType: 'clean', renderEngine: '3d' },
  },
  {
    id: 'realpeople_ancient_chinese',
    name: 'Real People Ancient Chinese',
    nameZh: '真人古风',
    visualKeywords: ['realistic', 'ancient chinese', 'cosplay', 'period drama'],
    prefixPrompt: 'realistic ancient chinese style, period drama, traditional hanfu, cinematic, ',
    palette: ['#8B4513', '#D4AF37', '#800020', '#2F4F4F', '#CD853F'],
    bestFor: ['historical_epic', 'xianxia_fantasy'],
    compositionRules: ['period-accurate costumes', 'natural lighting', 'film grain'],
    visualAnchors: { primary: '#D4AF37', lineType: 'none', renderEngine: 'realphoto' },
  },
  {
    id: 'realpeople_modern_city',
    name: 'Real People Modern City',
    nameZh: '真人现代都市',
    visualKeywords: ['realistic', 'modern city', 'urban', 'natural'],
    prefixPrompt: 'realistic modern city style, urban environment, natural lighting, ',
    palette: ['#708090', '#A9A9A9', '#2F4F4F', '#D2691E', '#8B4513'],
    bestFor: ['urban_workplace_drama', 'sweet_romance_novel'],
    compositionRules: ['shallow depth of field', 'urban backgrounds', 'natural expressions'],
    visualAnchors: { primary: '#708090', lineType: 'none', renderEngine: 'realphoto' },
  },
  {
    id: 'realpeople_urban_modern',
    name: 'Real People Urban Modern',
    nameZh: '真人时尚现代',
    visualKeywords: ['realistic', 'fashionable', 'modern', 'stylish'],
    prefixPrompt: 'realistic urban modern style, fashionable, stylish outfits, contemporary, ',
    palette: ['#000000', '#FFFFFF', '#C0C0C0', '#DC143C', '#4169E1'],
    bestFor: ['urban_workplace_drama', 'sweet_romance_novel'],
    compositionRules: ['fashion magazine style', 'clean compositions', 'monochrome accents'],
    visualAnchors: { primary: '#000000', secondary: '#FFFFFF', lineType: 'none', renderEngine: 'realphoto' },
  },
];

export function getArtStyle(id: string): ArtStyle | undefined {
  return ART_STYLES.find((s) => s.id === id);
}

/* ============================================================ */
/*                        HTTP 路由                              */
/* ============================================================ */
export const artStylesRoute = new Hono();
artStylesRoute.use('*', authMiddleware);

artStylesRoute.get('/', (c) => {
  return c.json({
    total: ART_STYLES.length,
    list: ART_STYLES.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      palette: s.palette,
      bestFor: s.bestFor,
      visualAnchors: s.visualAnchors,
    })),
  });
});

artStylesRoute.get('/:id', (c) => {
  const id = c.req.param('id');
  const s = getArtStyle(id);
  if (!s) return c.json({ error: 'not_found' }, 404);
  return c.json(s);
});

const upsertSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  nameZh: z.string().min(1).max(200).optional(),
  visualKeywords: z.array(z.string()).optional(),
  prefixPrompt: z.string().optional(),
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional(),
  bestFor: z.array(z.string()).optional(),
  compositionRules: z.array(z.string()).optional(),
  visualAnchors: z
    .object({
      primary: z.string(),
      secondary: z.string().optional(),
      lineType: z.enum(['clean', 'rough', 'ink', 'none']),
      renderEngine: z.enum(['2d', '3d', 'live2d', 'realphoto']).optional(),
    })
    .optional(),
});

function requireAdmin(c: import('hono').Context): boolean {
  return c.get('auth').role === 'admin';
}

artStylesRoute.post('/', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const id = parsed.data.id ?? `style_${nanoid(10)}`;
  const exists = ART_STYLES.find((s) => s.id === id);
  const newRecord: ArtStyle = {
    id,
    name: parsed.data.name,
    nameZh: parsed.data.nameZh ?? id,
    visualKeywords: parsed.data.visualKeywords ?? [],
    prefixPrompt: parsed.data.prefixPrompt ?? '',
    palette: parsed.data.palette ?? [],
    bestFor: parsed.data.bestFor ?? [],
    compositionRules: parsed.data.compositionRules ?? [],
    visualAnchors: parsed.data.visualAnchors,
  };
  if (!exists) ART_STYLES.push(newRecord);
  try {
    await db.insert(assets).values({
      ownerId: c.get('auth').subject,
      kind: 'episode',
      name: newRecord.nameZh,
      description: newRecord.prefixPrompt.slice(0, 200),
      meta: { assetKind: 'art_style', payload: newRecord },
      isPublic: true,
      shelfLevel: 'global',
      tags: ['art_style', id],
    });
  } catch {
    // 静默
  }
  return c.json({ created: true, artStyle: newRecord }, 201);
});

artStylesRoute.patch('/:id', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = upsertSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const idx = ART_STYLES.findIndex((s) => s.id === id);
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  const cur = ART_STYLES[idx]!;
  const merged: ArtStyle = {
    ...cur,
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.nameZh ? { nameZh: parsed.data.nameZh } : {}),
    ...(parsed.data.visualKeywords ? { visualKeywords: parsed.data.visualKeywords } : {}),
    ...(parsed.data.prefixPrompt ? { prefixPrompt: parsed.data.prefixPrompt } : {}),
    ...(parsed.data.palette ? { palette: parsed.data.palette } : {}),
    ...(parsed.data.bestFor ? { bestFor: parsed.data.bestFor } : {}),
    ...(parsed.data.compositionRules ? { compositionRules: parsed.data.compositionRules } : {}),
    ...(parsed.data.visualAnchors ? { visualAnchors: parsed.data.visualAnchors } : {}),
  };
  ART_STYLES[idx] = merged;
  return c.json({ updated: true, artStyle: merged });
});

artStylesRoute.delete('/:id', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.param('id');
  const idx = ART_STYLES.findIndex((s) => s.id === id);
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  const removed = ART_STYLES[idx];
  ART_STYLES.splice(idx, 1);
  try {
    if (removed) {
      await db
        .delete(assets)
        .where(and(eq(assets.kind, 'episode'), eq(assets.name, removed.nameZh)));
    }
  } catch {
    // 静默
  }
  return c.json({ deleted: true, id });
});
