/**
 * 智能场景分类（suggest-scene）
 *
 * 用途：输入一段场景描写（小说原文 / 分镜描述）→ 给出场景分类与光影建议
 * 输出：{ category, location, timeOfDay, weather, mood, lighting, colorPalette, imagePrompt }
 *
 * 分类维度：
 *  - location: indoor | outdoor | abstract
 *  - timeOfDay: dawn | morning | noon | afternoon | sunset | night | midnight
 *  - weather: clear | cloudy | rain | snow | fog | storm
 *  - mood: 自由标签（如 tense / romantic / melancholic / epic）
 *
 * 光影建议（lighting）会按 timeOfDay + mood 自动给出三点布光配置。
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';
import { buildSystemPrompt, buildVisualKeywords } from '../prompts/system.js';

export const SuggestSceneInputSchema = z.object({
  /** 场景原文（小说段落或分镜描述） */
  text: z.string().min(5).max(10_000),
  /** 故事类型（决定氛围判断倾向） */
  storyType: z.string().min(1),
  /** 艺术风格（影响光影 / 调色建议） */
  artStyle: z.string().min(1),
});
export type SuggestSceneInput = z.infer<typeof SuggestSceneInputSchema>;

export type SceneLocation = 'indoor' | 'outdoor' | 'abstract';
export type SceneTimeOfDay =
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'sunset'
  | 'night'
  | 'midnight';
export type SceneWeather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';

export interface SceneLighting {
  /** key light（主光）位置与色温 */
  key: string;
  /** fill light（辅光） */
  fill: string;
  /** rim light（轮廓光） */
  rim: string;
  /** 整体光强 0.0~1.0 */
  intensity: number;
}

export interface SceneClassification {
  /** 场景类型 */
  location: SceneLocation;
  /** 时间 */
  timeOfDay: SceneTimeOfDay;
  /** 天气 */
  weather: SceneWeather;
  /** 氛围（自由词） */
  mood: string[];
  /** 光影建议 */
  lighting: SceneLighting;
  /** 配色（hex 列表，3~5 个） */
  colorPalette: string[];
  /** 英文 image prompt（拼接艺术风格关键词） */
  imagePrompt: string;
  /** 简短中文解释（≤ 40 字） */
  rationale: string;
}

export interface SuggestSceneResult {
  storyType: string;
  artStyle: string;
  scene: SceneClassification;
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【场景分类 + 光影建议】';
const USER_TEMPLATE = (text: string, storyType: string, artStyle: string) => `
请分析以下场景描写，输出结构化的场景分类与光影建议。

故事类型：${storyType}
艺术风格：${artStyle}

【场景原文】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "scene": { "location": "...", "timeOfDay": "...", "weather": "...", "mood": [...], "lighting": { ... }, "colorPalette": [...], "imagePrompt": "...", "rationale": "..." } }；
 3) location 取值：indoor | outdoor | abstract；
 4) timeOfDay 取值：dawn | morning | noon | afternoon | sunset | night | midnight；
 5) weather 取值：clear | cloudy | rain | snow | fog | storm；
 6) mood 数组 2~4 个词；
 7) lighting 必须是对象：{ "key": "...", "fill": "...", "rim": "...", "intensity": 0.0~1.0 }；
 8) colorPalette 数组 3~5 个 hex 颜色；
 9) imagePrompt 用英文短句（逗号分隔关键词）；
 10) rationale 中文一句话说明判断依据。

【开始输出】
`;

export async function runSuggestScene(input: SuggestSceneInput): Promise<SuggestSceneResult> {
  const system = SYSTEM_PREFIX + '\n' + buildSystemPrompt(input.storyType, input.artStyle);
  const user = USER_TEMPLATE(input.text, input.storyType, input.artStyle);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:suggest-scene', temperature: 0.4 }
  );

  const parsed = extractJson<{ scene?: SceneClassification }>(res.content);
  const styleKw = buildVisualKeywords(input.artStyle);
  const scene: SceneClassification = {
    ...(parsed.scene ?? {
      location: 'indoor',
      timeOfDay: 'noon',
      weather: 'clear',
      mood: [],
      lighting: { key: 'top', fill: 'left', rim: 'right', intensity: 0.6 },
      colorPalette: [],
      imagePrompt: '',
      rationale: '',
    }),
    imagePrompt: (parsed.scene?.imagePrompt ?? input.text.slice(0, 80)) + `, ${styleKw.join(', ')}`,
  };

  return {
    storyType: input.storyType,
    artStyle: input.artStyle,
    scene,
    meta: res.meta,
  };
}
