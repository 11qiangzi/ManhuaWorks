/**
 * 标题生成（generate-title）
 *
 * 用途：基于内容生成 5 个候选标题，每个带"角度说明"
 * 角度覆盖：悬念型 / 情感型 / 动作型 / 反差型 / 系列型
 *
 * 输出：{ titles: [ { text, angle, hookScore, targetAudience } ] }
 *  - hookScore：0~10，模型自评"点击欲望"
 *  - targetAudience：主要读者画像（短词组）
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';

export const GenerateTitleInputSchema = z.object({
  /** 内容摘要（logline 或剧情简介） */
  summary: z.string().min(10).max(2000),
  /** 故事类型（决定标题风格） */
  storyType: z.string().min(1),
  /** 候选数量（默认 5） */
  count: z.number().int().min(1).max(10).optional(),
  /** 目标字数：≤ 8 字 / ≤ 12 字（中文标题，漫画常用 ≤ 12 字） */
  maxLength: z.number().int().min(2).max(30).optional(),
  /** 主关键词（如果用户提供，候选标题应至少 1 个包含它） */
  keywords: z.array(z.string()).max(5).optional(),
});
export type GenerateTitleInput = z.infer<typeof GenerateTitleInputSchema>;

export type TitleAngle =
  | 'suspense' // 悬念型
  | 'emotional' // 情感型
  | 'action' // 动作型
  | 'contrast' // 反差型
  | 'series' // 系列型
  | 'metaphor'; // 隐喻型

export interface TitleCandidate {
  text: string;
  angle: TitleAngle;
  hookScore: number;
  targetAudience: string;
  /** 中文短理由（≤ 20 字） */
  rationale: string;
}

export interface GenerateTitleResult {
  storyType: string;
  titles: TitleCandidate[];
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【标题生成】';
const USER_TEMPLATE = (summary: string, storyType: string, count: number, maxLength: number, keywords?: string[]) => `
请基于以下剧情简介生成 ${count} 个候选漫画标题。

故事类型：${storyType}
字数限制：≤ ${maxLength} 字
${keywords && keywords.length > 0 ? `必须包含的关键词：${keywords.join('、')}（至少 1 个候选含此关键词）` : '关键词：无强制要求'}

【剧情简介】
"""
${summary}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "titles": [ { "text": "...", "angle": "...", "hookScore": 0, "targetAudience": "...", "rationale": "..." }, ... ] }；
 3) text 是中文标题（≤ ${maxLength} 字）；
 4) angle 取值：suspense | emotional | action | contrast | series | metaphor；
 5) ${count} 个候选的 angle 应尽量不重复（如果 count > 6 可重复）；
 6) hookScore 0~10 整数，模型自评"读者点击欲望"；
 7) targetAudience 短词组，如 ["年轻女性 18-25", "泛二次元 15-30"]；
 8) rationale 一句话说明（≤ 20 字）。

【开始输出】
`;

export async function runGenerateTitle(input: GenerateTitleInput): Promise<GenerateTitleResult> {
  const count = input.count ?? 5;
  const maxLength = input.maxLength ?? 12;

  const system = SYSTEM_PREFIX;
  const user = USER_TEMPLATE(input.summary, input.storyType, count, maxLength, input.keywords);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:generate-title', temperature: 0.9 }
  );

  const parsed = extractJson<{ titles?: TitleCandidate[] }>(res.content);
  const titles = (parsed.titles ?? []).map((t) => ({
    ...t,
    hookScore: typeof t.hookScore === 'number' ? Math.max(0, Math.min(10, t.hookScore)) : 5,
  }));

  return {
    storyType: input.storyType,
    titles,
    meta: res.meta,
  };
}
