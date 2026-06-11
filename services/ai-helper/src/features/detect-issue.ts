/**
 * 剧情问题检测（detect-issue）
 *
 * 用途：检测剧情文本中的逻辑漏洞、重复桥段、前后矛盾
 *
 * 三类问题：
 *  - logic：逻辑漏洞（不符合物理 / 常识 / 角色能力）
 *  - repeat：重复桥段（结构 / 台词 / 转折手法重复）
 *  - contradiction：前后矛盾（人物设定、已交代事实、关系变化）
 *
 * 输出：{ issues: [ { category, severity, location, description, suggestion } ] }
 *  - severity: low | medium | high
 *  - location: 原文中的关键句（≤ 50 字）
 *  - description: 问题简述
 *  - suggestion: 修改建议
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';
import { config } from '../config.js';

export const DetectIssueInputSchema = z.object({
  /** 待检测的剧情文本 */
  text: z.string().min(50).max(config.limits.maxInputChars),
  /** 故事类型 */
  storyType: z.string().min(1),
  /** 检测类别，默认全开 */
  categories: z.array(z.enum(['logic', 'repeat', 'contradiction'])).optional(),
  /** 已知角色设定（用于检测前后矛盾） */
  characterSheet: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        traits: z.array(z.string()).optional(),
      })
    )
    .optional(),
});
export type DetectIssueInput = z.infer<typeof DetectIssueInputSchema>;

export type IssueCategory = 'logic' | 'repeat' | 'contradiction';
export type IssueSeverity = 'low' | 'medium' | 'high';

export interface IssueReport {
  category: IssueCategory;
  severity: IssueSeverity;
  /** 关键句定位 */
  location: string;
  /** 问题简述（中文 ≤ 80 字） */
  description: string;
  /** 修改建议（中文 ≤ 120 字） */
  suggestion: string;
}

export interface DetectIssueResult {
  storyType: string;
  categories: IssueCategory[];
  issues: IssueReport[];
  /** 健康度 0~100：扣分制（high -15, medium -8, low -3），下限 0 */
  healthScore: number;
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【剧情问题检测】';
const USER_TEMPLATE = (
  text: string,
  storyType: string,
  categories: IssueCategory[],
  characterSheetJson: string
) => `
请对以下剧情文本进行问题检测，输出三类问题：逻辑漏洞（logic）、重复桥段（repeat）、前后矛盾（contradiction）。

故事类型：${storyType}
检测类别：${categories.join(', ')}
${characterSheetJson}

【剧情文本】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "issues": [ { "category": "...", "severity": "...", "location": "...", "description": "...", "suggestion": "..." }, ... ] }；
 3) category 取值：logic | repeat | contradiction；
 4) severity 取值：low | medium | high；
 5) location 用原文中的关键句定位（≤ 50 字，找不到就写"全文"）；
 6) description 简述问题（≤ 80 字）；
 7) suggestion 给出修改建议（≤ 120 字）；
 8) 如果没有发现问题，返回空数组；
 9) 不要给赞美性意见（如"剧情流畅"），只报问题。

【开始输出】
`;

function computeHealthScore(issues: IssueReport[]): number {
  let score = 100;
  for (const i of issues) {
    if (i.severity === 'high') score -= 15;
    else if (i.severity === 'medium') score -= 8;
    else score -= 3;
  }
  return Math.max(0, score);
}

export async function runDetectIssue(input: DetectIssueInput): Promise<DetectIssueResult> {
  const categories: IssueCategory[] = input.categories ?? ['logic', 'repeat', 'contradiction'];
  const charSheet = input.characterSheet ?? [];
  const characterSheetJson =
    charSheet.length > 0
      ? `已知角色设定：\n${charSheet
          .map((c) => `- ${c.name}${c.role ? `（${c.role}）` : ''}：${(c.traits ?? []).join('、') || '无'}`)
          .join('\n')}`
      : '已知角色设定：无（仅基于正文自洽性检测）';

  const system = SYSTEM_PREFIX;
  const user = USER_TEMPLATE(input.text, input.storyType, categories, characterSheetJson);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:detect-issue', temperature: 0.2 }
  );

  const parsed = extractJson<{ issues?: IssueReport[] }>(res.content);
  const issues = parsed.issues ?? [];

  return {
    storyType: input.storyType,
    categories,
    issues,
    healthScore: computeHealthScore(issues),
    meta: res.meta,
  };
}
