/**
 * 12 套故事类型资产（导入自 Toonflow）
 * 与 workflow-engine/src/assets/story-types.ts 数据保持一致；本服务承担 CRUD。
 *
 * 路由：
 *  GET    /v1/assets/story-types          列表
 *  GET    /v1/assets/story-types/:id      详情
 *  POST   /v1/assets/story-types          新增（admin）
 *  PATCH  /v1/assets/story-types/:id      更新（admin）
 *  DELETE /v1/assets/story-types/:id      删除（admin）
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

export interface StoryType {
  id: string;
  name: string;
  nameZh: string;
  directorialNotes: string[];
  promptTemplate: string;
  shotsPerChapter: { min: number; max: number };
  typicalShotSec: number;
  bgmMoods: string[];
}

/** 12 套故事类型（与 workflow-engine 一致；后续可挪到独立 assets 包） */
export const STORY_TYPES: StoryType[] = [
  {
    id: 'sweet_romance_novel',
    name: 'Sweet Romance Novel',
    nameZh: '甜宠言情',
    directorialNotes: [
      '双人对话镜占比 50%+，突出眼神/微表情',
      '慢节奏：每镜 4-6s，留白 1-2s',
      '粉/暖色调为主，光线偏柔',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：甜宠言情。每镜需包含：场景、人物动作、表情、对白、镜头语言（特写/中景/全景）。',
    shotsPerChapter: { min: 8, max: 16 },
    typicalShotSec: 5,
    bgmMoods: ['romantic', 'warm', 'soft'],
  },
  {
    id: 'urban_workplace_drama',
    name: 'Urban Workplace Drama',
    nameZh: '都市职场',
    directorialNotes: [
      '会议室/办公场景为主，强调权力关系空间感',
      '快剪对话 2-3s/镜，制造紧张节奏',
      '冷色调 + 顶光/侧光',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：都市职场。突出办公室政治、上下级对峙。',
    shotsPerChapter: { min: 10, max: 20 },
    typicalShotSec: 3,
    bgmMoods: ['tense', 'professional', 'dramatic'],
  },
  {
    id: 'xianxia_fantasy',
    name: 'Xianxia Fantasy',
    nameZh: '仙侠玄幻',
    directorialNotes: [
      '法术特效镜必备，粒子流/光剑/阵法',
      '远景大全景占比 30%+，构建仙侠世界观',
      '冷青/紫调，光线来自法术光晕',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：仙侠玄幻。突出法术、飞剑、阵法、世界观。',
    shotsPerChapter: { min: 12, max: 24 },
    typicalShotSec: 6,
    bgmMoods: ['epic', 'mystical', 'heroic'],
  },
  {
    id: 'historical_epic',
    name: 'Historical Epic',
    nameZh: '历史史诗',
    directorialNotes: [
      '千军万马大全景 + 人物特写交叉',
      '战争镜头多（6-8s），文戏紧凑（3-4s）',
      '暖黄/土褐色调，仿古画质感',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：历史史诗。突出战争、朝堂、家国。',
    shotsPerChapter: { min: 14, max: 28 },
    typicalShotSec: 5,
    bgmMoods: ['epic', 'solemn', 'majestic'],
  },
  {
    id: 'mystery_thriller',
    name: 'Mystery Thriller',
    nameZh: '悬疑推理',
    directorialNotes: [
      '大量推镜 + 主观视角，揭示线索',
      '阴影面积 ≥40%，制造不安',
      '冷蓝/灰黑调，单一强光源',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：悬疑推理。突出线索、伏笔、心理博弈。',
    shotsPerChapter: { min: 10, max: 18 },
    typicalShotSec: 4,
    bgmMoods: ['suspense', 'mysterious', 'dark'],
  },
  {
    id: 'horror_supernatural',
    name: 'Horror Supernatural',
    nameZh: '恐怖灵异',
    directorialNotes: [
      'jump-scare 镜：静→动强烈反差',
      '暗部 ≥60%，手电筒/烛光为主要光源',
      '高对比度、冷青/惨白',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：恐怖灵异。突出惊吓点、心理恐惧、异象。',
    shotsPerChapter: { min: 8, max: 16 },
    typicalShotSec: 4,
    bgmMoods: ['horror', 'eerie', 'tense'],
  },
  {
    id: 'hot_blooded_action',
    name: 'Hot-Blooded Action',
    nameZh: '热血战斗',
    directorialNotes: [
      '战斗镜 2-3s 极速剪辑，冲击感强',
      '多角度（俯/仰/POV）',
      '高饱和度，红/橙/金为主',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：热血战斗。突出打斗、热血、友情。',
    shotsPerChapter: { min: 14, max: 26 },
    typicalShotSec: 3,
    bgmMoods: ['intense', 'epic', 'energetic'],
  },
  {
    id: 'scifi_post_apocalypse',
    name: 'Sci-Fi Post-Apocalypse',
    nameZh: '废土科幻',
    directorialNotes: [
      '废土大全景 + 机械特写',
      '工业灰/锈红/荧光绿',
      '机件、HUD、机械义体细节多',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：废土科幻。突出机械、荒原、生存。',
    shotsPerChapter: { min: 10, max: 20 },
    typicalShotSec: 5,
    bgmMoods: ['industrial', 'tense', 'futuristic'],
  },
  {
    id: 'psychological_drama',
    name: 'Psychological Drama',
    nameZh: '心理剧情',
    directorialNotes: [
      '特写面部微表情 ≥50%',
      '长镜头 6-10s，给观众思考时间',
      '低饱和度、单色调为主',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：心理剧情。突出内心戏、人物关系、心理转折。',
    shotsPerChapter: { min: 6, max: 12 },
    typicalShotSec: 7,
    bgmMoods: ['melancholic', 'intimate', 'subtle'],
  },
  {
    id: 'family_warmth',
    name: 'Family Warmth',
    nameZh: '家庭温情',
    directorialNotes: [
      '群戏多，餐桌/客厅/医院常见场景',
      '节奏舒缓 5-7s/镜',
      '暖橙/米白，自然光为主',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：家庭温情。突出亲情、陪伴、琐碎中的感动。',
    shotsPerChapter: { min: 6, max: 12 },
    typicalShotSec: 6,
    bgmMoods: ['warm', 'gentle', 'nostalgic'],
  },
  {
    id: 'coming_of_age',
    name: 'Coming of Age',
    nameZh: '青春成长',
    directorialNotes: [
      '校园 + 户外，光影明亮',
      '运动镜头（跑/骑车）多',
      '青绿/天蓝/暖黄',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：青春成长。突出友情、初恋、叛逆、梦想。',
    shotsPerChapter: { min: 8, max: 14 },
    typicalShotSec: 4,
    bgmMoods: ['youthful', 'hopeful', 'bittersweet'],
  },
  {
    id: 'comedy_humor',
    name: 'Comedy Humor',
    nameZh: '喜剧搞笑',
    directorialNotes: [
      '节奏快 2-4s/镜，留白给笑点',
      '夸张表演 + 字幕特效',
      '高饱和度，纯色背景多',
    ],
    promptTemplate: '将以下小说片段拆为 N 个漫画分镜，类型：喜剧搞笑。突出笑点、夸张、反转。',
    shotsPerChapter: { min: 10, max: 18 },
    typicalShotSec: 3,
    bgmMoods: ['comedic', 'playful', 'upbeat'],
  },
];

export function getStoryType(id: string): StoryType | undefined {
  return STORY_TYPES.find((s) => s.id === id);
}

/* ------------------- 4 套 prompt 库 ------------------- */
export interface PromptLib {
  id: string;
  name: string;
  nameZh: string;
  /** 提示词模板 */
  template: string;
  /** 适用步骤：storyboard / character / scene / image / tts / video / compose */
  appliesTo: string[];
}

export const PROMPT_LIBS: PromptLib[] = [
  {
    id: 'novel_to_storyboard',
    name: 'Novel → Storyboard',
    nameZh: '小说 → 分镜',
    template: '你是漫改导演。把以下小说片段拆成 {N} 个分镜，每个分镜输出 JSON：{scene, characters[], action, dialogue, shotType, durationSec, emotion}。',
    appliesTo: ['storyboard'],
  },
  {
    id: 'storyboard_to_character',
    name: 'Storyboard → Character Design',
    nameZh: '分镜 → 角色设计',
    template: '根据分镜中的角色描述，输出角色卡 JSON：{name, age, gender, appearance, clothing, personality, distinctiveFeatures}。',
    appliesTo: ['character'],
  },
  {
    id: 'storyboard_to_scene',
    name: 'Storyboard → Scene Design',
    nameZh: '分镜 → 场景设计',
    template: '根据分镜中的场景描述，输出场景卡 JSON：{location, timeOfDay, weather, lighting, props, palette, mood}。',
    appliesTo: ['scene'],
  },
  {
    id: 'compose_shot_list',
    name: 'Compose Shot List',
    nameZh: '合成镜头清单',
    template: '把所有分镜的画面 / 视频 / 音频 / 字幕整合为最终成片。镜头顺序：{shotOrder}；背景音乐情绪：{mood}；总时长：{totalSec}s。',
    appliesTo: ['compose'],
  },
];

/* ============================================================ */
/*                        HTTP 路由                              */
/* ============================================================ */
export const storyTypesRoute = new Hono();
storyTypesRoute.use('*', authMiddleware);

/* GET /v1/assets/story-types */
storyTypesRoute.get('/', (c) => {
  return c.json({
    total: STORY_TYPES.length,
    list: STORY_TYPES.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      shotsPerChapter: s.shotsPerChapter,
      typicalShotSec: s.typicalShotSec,
      bgmMoods: s.bgmMoods,
    })),
  });
});

/* GET /v1/assets/story-types/:id */
storyTypesRoute.get('/:id', (c) => {
  const id = c.req.param('id');
  const s = getStoryType(id);
  if (!s) return c.json({ error: 'not_found' }, 404);
  return c.json(s);
});

/* ----------------- CRUD：存到 assets 表（kind=character 之外的"提示词资产"复用 episode） ----------------- */
const upsertSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  nameZh: z.string().min(1).max(200).optional(),
  directorialNotes: z.array(z.string()).optional(),
  promptTemplate: z.string().min(1).optional(),
  shotsPerChapter: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).optional(),
  typicalShotSec: z.number().int().min(1).optional(),
  bgmMoods: z.array(z.string()).optional(),
});

function requireAdmin(c: import('hono').Context): boolean {
  const auth = c.get('auth');
  return auth.role === 'admin';
}

/* POST /v1/assets/story-types */
storyTypesRoute.post('/', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden', message: 'admin only' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const id = parsed.data.id ?? `story_${nanoid(10)}`;

  // 内存集合 + 数据库记录
  const exists = STORY_TYPES.find((s) => s.id === id);
  const newRecord: StoryType = {
    id,
    name: parsed.data.name,
    nameZh: parsed.data.nameZh ?? id,
    directorialNotes: parsed.data.directorialNotes ?? [],
    promptTemplate: parsed.data.promptTemplate ?? '请补充分镜提示词模板',
    shotsPerChapter: parsed.data.shotsPerChapter ?? { min: 8, max: 16 },
    typicalShotSec: parsed.data.typicalShotSec ?? 5,
    bgmMoods: parsed.data.bgmMoods ?? [],
  };
  if (!exists) STORY_TYPES.push(newRecord);
  // 数据库留痕（作为 episode 类型资产，meta.kind = 'story_type'）
  try {
    await db.insert(assets).values({
      ownerId: c.get('auth').subject,
      kind: 'episode',
      name: newRecord.nameZh,
      description: newRecord.promptTemplate,
      meta: { assetKind: 'story_type', payload: newRecord },
      isPublic: true,
      shelfLevel: 'global',
      tags: ['story_type', id],
    });
  } catch {
    // 数据库不可用时不影响内存注册
  }
  return c.json({ created: true, storyType: newRecord }, 201);
});

/* PATCH /v1/assets/story-types/:id */
storyTypesRoute.patch('/:id', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = upsertSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const idx = STORY_TYPES.findIndex((s) => s.id === id);
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  const cur = STORY_TYPES[idx]!;
  const merged: StoryType = {
    ...cur,
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.nameZh ? { nameZh: parsed.data.nameZh } : {}),
    ...(parsed.data.directorialNotes ? { directorialNotes: parsed.data.directorialNotes } : {}),
    ...(parsed.data.promptTemplate ? { promptTemplate: parsed.data.promptTemplate } : {}),
    ...(parsed.data.shotsPerChapter ? { shotsPerChapter: parsed.data.shotsPerChapter } : {}),
    ...(parsed.data.typicalShotSec !== undefined ? { typicalShotSec: parsed.data.typicalShotSec } : {}),
    ...(parsed.data.bgmMoods ? { bgmMoods: parsed.data.bgmMoods } : {}),
  };
  STORY_TYPES[idx] = merged;
  return c.json({ updated: true, storyType: merged });
});

/* DELETE /v1/assets/story-types/:id */
storyTypesRoute.delete('/:id', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.param('id');
  const idx = STORY_TYPES.findIndex((s) => s.id === id);
  if (idx < 0) return c.json({ error: 'not_found' }, 404);
  STORY_TYPES.splice(idx, 1);
  // 数据库同步
  try {
    await db
      .delete(assets)
      .where(and(eq(assets.kind, 'episode'), eq(assets.name, STORY_TYPES[idx]?.nameZh ?? id)));
  } catch {
    // 静默
  }
  return c.json({ deleted: true, id });
});
