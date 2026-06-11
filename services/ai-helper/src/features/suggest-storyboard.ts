/**
 * 智能分镜推荐（suggest-storyboard）
 *
 * 用途：用户粘贴一段小说正文 → 自动建议漫画分镜（panel 列表）
 * 输出：JSON 数组，每项含 { index, shot, panelDesc, imagePrompt, dialogue?, sfx?, camera }
 *
 * 设计：
 *  - 严格按"漫画分镜"维度拆解（不是电影分镜）：强调"一格一信息"
 *  - 同时给出 imagePrompt（英文，可直接喂给 image-gen）和 panelDesc（中文，给用户看）
 *  - 单次输入超 12000 字符时分段（防止 prompt 过长）
 */

import { z } from 'zod';
import { callChat, extractJson, countChars } from '../llm-client.js';
import { buildSystemPrompt, buildVisualKeywords } from '../prompts/system.js';
import { config } from '../config.js';

export const SuggestStoryboardInputSchema = z.object({
  text: z.string().min(20).max(config.limits.maxInputChars),
  storyType: z.string().min(1),
  artStyle: z.string().min(1),
  /** 目标分镜数（1~30），缺省让 LLM 决定 */
  panelCount: z.number().int().min(1).max(30).optional(),
  /** 是否只输出分镜，不生成 imagePrompt（用于不想消耗 prompt 配额的场景） */
  skipImagePrompt: z.boolean().optional(),
});
export type SuggestStoryboardInput = z.infer<typeof SuggestStoryboardInputSchema>;

export interface StoryboardPanel {
  index: number;
  /** 一句话中文分镜描述 */
  panelDesc: string;
  /** 镜头类型（中景/特写/俯视/仰视/全景…） */
  camera: string;
  /** 角色在画面中的站位 / 动作 */
  action: string;
  /** 对白（可选，结构化带情绪标签） */
  dialogue?: { speaker: string; text: string; emotion?: string }[];
  /** 拟声词（可选） */
  sfx?: string[];
  /** 英文 image prompt（拼接艺术风格关键词） */
  imagePrompt: string;
}

export interface SuggestStoryboardResult {
  storyType: string;
  artStyle: string;
  panelCount: number;
  panels: StoryboardPanel[];
  /** LLM 元信息 */
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【分镜推荐】';
const USER_TEMPLATE = (text: string, storyType: string, artStyle: string, panelCount?: number) => `
请将以下小说片段改写为漫画分镜。

故事类型：${storyType}
艺术风格：${artStyle}
${panelCount ? `目标分镜数：${panelCount}` : '目标分镜数：由你根据文本长度决定（每 80~150 字对应 1 个分镜）'}

【小说原文】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON，不要任何解释；
 2) 顶层结构：{ "panels": [ { "index": 1, "panelDesc": "...", "camera": "...", "action": "...", "dialogue": [...], "sfx": [...], "imagePrompt": "..." }, ... ] }；
 3) camera 取值：extreme-close-up | close-up | medium | long | full | wide | over-shoulder | bird-eye | worm-eye | dutch-angle；
 4) dialogue 数组（无对白可省略），每个元素：{ "speaker": "角色名", "text": "台词", "emotion": "情绪标签" }；
 5) sfx 数组（无拟声可省略），元素是英文大写拟声词，如 ["BAM", "CRACK"]；
 6) imagePrompt 用英文短句（逗号分隔关键词），${panelCount && panelCount > 0 ? `${panelCount} 张图保持视觉风格一致` : '风格保持一致'}。

【开始输出】
`;

export async function runSuggestStoryboard(
  input: SuggestStoryboardInput
): Promise<SuggestStoryboardResult> {
  // 简单分段（按段落 \n\n 切，最长 6000 字一段）
  const chars = countChars(input.text);
  if (chars > 6000) {
    // 直接一次喂，过长就交给 LLM 自行裁剪重点（生产环境应该分块递归合并）
    console.warn(`[suggest-storyboard] input too long (${chars} chars), may degrade quality`);
  }

  const system = SYSTEM_PREFIX + '\n' + buildSystemPrompt(input.storyType, input.artStyle);
  const user = USER_TEMPLATE(input.text, input.storyType, input.artStyle, input.panelCount);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:suggest-storyboard', temperature: 0.7 }
  );

  const parsed = extractJson<{ panels?: StoryboardPanel[] }>(res.content);
  let panels = Array.isArray(parsed.panels) ? parsed.panels : [];

  // 补全 imagePrompt 的艺术风格关键词
  const styleKw = buildVisualKeywords(input.artStyle);
  panels = panels.map((p) => ({
    ...p,
    imagePrompt: p.imagePrompt?.includes(',')
      ? `${p.imagePrompt}, ${styleKw.join(', ')}`
      : `${p.imagePrompt ?? p.panelDesc}, ${styleKw.join(', ')}`,
  }));

  // 如果用户选择 skipImagePrompt，移除所有 imagePrompt 字段
  if (input.skipImagePrompt) {
    panels = panels.map((p) => ({ ...p, imagePrompt: '' }));
  }

  // 补全 index
  panels = panels.map((p, i) => ({ ...p, index: p.index ?? i + 1 }));

  return {
    storyType: input.storyType,
    artStyle: input.artStyle,
    panelCount: panels.length,
    panels,
    meta: res.meta,
  };
}
