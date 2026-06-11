/**
 * 分镜 prompt 模板（3 套：热血 / 治愈 / 悬疑）
 *
 * 设计原则：
 *   - 每套模板独立成段，喂给 LLM（OpenAI / DeepSeek / Qwen 等）做镜头拆解
 *   - 模板含导演意图、节奏曲线、镜头密度、视觉风格建议
 *   - renderStoryboardPrompt() 把变量插值后返回最终 prompt
 *
 * 模板变量：
 *   {{text}}       原始小说文本
 *   {{chapter}}    章节号
 *   {{sceneCount}} 期望场景数
 *   {{shotCount}}  期望镜头数
 *   {{style}}      风格 id
 */

export type StoryboardTone = 'hot_blooded' | 'healing' | 'mystery';

export interface StoryboardPromptTemplate {
  tone: StoryboardTone;
  name: string;
  nameZh: string;
  /** 导演侧核心指令（放在 prompt 最前以加大权重） */
  directorial: string;
  /** 节奏曲线提示 */
  pacing: string;
  /** 视觉风格提示 */
  visual: string;
  /** 输出 JSON 契约（要求 LLM 返回） */
  outputContract: string;
  /** 默认镜头密度 */
  defaultShotsPerScene: number;
  /** 镜头平均时长（秒） */
  defaultShotSec: number;
  /** 适合的 storyType id 列表 */
  compatibleStoryTypes: string[];
}

export const STORYBOARD_PROMPTS: Record<StoryboardTone, StoryboardPromptTemplate> = {
  hot_blooded: {
    tone: 'hot_blooded',
    name: 'Hot-Blooded',
    nameZh: '热血',
    directorial: [
      '🎬 导演意图：突出战斗、冲突、爆发、决心。',
      '镜头切剪凌厉，1-3s 短镜堆叠制造速度感，关键镜（爆点/特写/慢动作）反复穿插。',
      '对白用激昂短句；旁白克制；环境服务于情绪（爆炸气浪、飞溅的汗与血）。',
    ].join('\n'),
    pacing: '【节奏】开篇 5% 铺垫 → 40% 上升 → 30% 高潮密集镜（每镜 1.5-3s）→ 20% 收束长镜。',
    visual: '【视觉】高对比度、偏冷色+暖色打光（爆炸火光/技能特效），大量切镜与运动模糊。',
    outputContract: [
      '请输出严格 JSON（不含 markdown 标记）：',
      '{',
      '  "scenes": [{ "id": "s1", "location": "...", "characters": ["..."], "summary": "..." }],',
      '  "shots": [',
      '    { "id": "s1_sh1", "sceneId": "s1", "shotType": "CU|MCU|MS|MLS|LS|ECU", "cameraMove": "push|pull|pan|tilt|track|static|handoff|handheld|whiplash",',
      '      "description": "...", "durationSec": 1.5, "characters": ["..."], "dialogue": "...", "sfx": "..." }',
      '  ]',
      '}',
    ].join('\n'),
    defaultShotsPerScene: 4,
    defaultShotSec: 2.5,
    compatibleStoryTypes: ['hot_blooded_action', 'xianxia_fantasy', 'scifi_post_apocalypse'],
  },
  healing: {
    tone: 'healing',
    name: 'Healing',
    nameZh: '治愈',
    directorial: [
      '🎬 导演意图：日常、温度、陪伴、慢生活。',
      '镜头留白足，平均 4-7s 慢镜为主；多用固定机位 + 缓慢推拉；环境音（风、虫鸣、器皿）占 30% 时间。',
      '对白留半成在画面外，人物动作柔软；食物/茶饮/窗光/植物作为情绪锚点。',
    ].join('\n'),
    pacing: '【节奏】开篇 20% 慢生活铺陈 → 50% 日常细节展开 → 20% 情绪高点（安静对视/书信/拥抱）→ 10% 收束余韵。',
    visual: '【视觉】柔光、米色/薄荷绿/浅木色为主，暖色 low contrast；构图大量留白与三分线。',
    outputContract: [
      '请输出严格 JSON（不含 markdown 标记）：',
      '{',
      '  "scenes": [{ "id": "s1", "location": "...", "characters": ["..."], "summary": "...", "moodTag": "warm|cozy|nostalgic|gentle" }],',
      '  "shots": [',
      '    { "id": "s1_sh1", "sceneId": "s1", "shotType": "ECU|CU|MCU|MS|MLS|LS", "cameraMove": "static|push|pull|pan|tilt",',
      '      "description": "...", "durationSec": 5, "characters": ["..."], "dialogue": "...", "ambient": "..." }',
      '  ]',
      '}',
    ].join('\n'),
    defaultShotsPerScene: 3,
    defaultShotSec: 5.5,
    compatibleStoryTypes: ['family_warmth', 'coming_of_age', 'sweet_romance_novel'],
  },
  mystery: {
    tone: 'mystery',
    name: 'Mystery',
    nameZh: '悬疑',
    directorial: [
      '🎬 导演意图：悬念、伏笔、心理博弈、信息差。',
      '镜头偏中远景，刻意不全貌；用阴影/反射/局部特写制造不安；时长 3-5s，偶有 8s 长镜压迫。',
      '对白简短；环境细节（开关、钥匙、门缝、时钟、屏幕）作为关键线索。',
    ].join('\n'),
    pacing: '【节奏】开篇 10% 平静异常 → 50% 步步紧逼（短切 + 留白 1s）→ 25% 真相逼近（连续长镜）→ 15% 谜底呈现或反转。',
    visual: '【视觉】冷蓝/灰青色调，窗户/路灯/手电等单点光源，硬阴影；构图刻意不平衡。',
    outputContract: [
      '请输出严格 JSON（不含 markdown 标记）：',
      '{',
      '  "scenes": [{ "id": "s1", "location": "...", "characters": ["..."], "summary": "...", "tensionLevel": 1-5 }],',
      '  "shots": [',
      '    { "id": "s1_sh1", "sceneId": "s1", "shotType": "CU|MS|MLS|LS|ECU|OTS", "cameraMove": "dolly|pan|static|creep|crash-zoom",',
      '      "description": "...", "durationSec": 4, "characters": ["..."], "dialogue": "...", "clue": "..." }',
      '  ]',
      '}',
    ].join('\n'),
    defaultShotsPerScene: 3,
    defaultShotSec: 4,
    compatibleStoryTypes: ['mystery_thriller', 'horror_supernatural', 'psychological_drama'],
  },
};

export function getStoryboardPrompt(tone: StoryboardTone): StoryboardPromptTemplate {
  return STORYBOARD_PROMPTS[tone];
}

/** 根据 storyType 自动推断 tone（默认 healing） */
export function inferTone(storyType: string): StoryboardTone {
  for (const tpl of Object.values(STORYBOARD_PROMPTS)) {
    if (tpl.compatibleStoryTypes.includes(storyType)) return tpl.tone;
  }
  return 'healing';
}

/** 渲染最终 prompt：把所有变量替换 + 拼接指令 */
export function renderStoryboardPrompt(
  tone: StoryboardTone,
  vars: {
    text: string;
    chapter?: number | string;
    sceneCount?: number;
    shotCount?: number;
    style?: string;
  }
): string {
  const tpl = STORYBOARD_PROMPTS[tone];
  const header = [
    `【分镜拆解任务 · 风格：${tpl.nameZh}（${tpl.name}）】`,
    `章节号：${vars.chapter ?? '?'}`,
    `期望场景数：${vars.sceneCount ?? '自适应'}`,
    `期望镜头数：${vars.shotCount ?? '自适应'}`,
    `视觉风格：${vars.style ?? 'auto'}`,
    '',
    tpl.directorial,
    '',
    tpl.pacing,
    '',
    tpl.visual,
    '',
    tpl.outputContract,
  ].join('\n');
  return `${header}\n\n【原文】\n${vars.text}\n\n【请按上述契约输出严格 JSON】`;
}
