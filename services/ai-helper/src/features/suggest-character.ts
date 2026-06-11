/**
 * 智能角色提取（suggest-character）
 *
 * 用途：粘贴小说 → 提取所有登场角色 → 生成"锁脸 prompt"（image gen 用）
 * 输出：{ characters: [ { name, role, appearance, personality, faceLockPrompt, outfitPrompt } ] }
 *
 * 锁脸 prompt 是漫画工业里的关键概念：
 *  - 一段稳定的英文描述，让 image gen 在多镜中保持角色外貌一致
 *  - 包含：年龄段、脸型、瞳色、发色发型、肤色、显著特征（疤 / 痣 / 纹身）
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';
import { buildSystemPrompt, buildVisualKeywords } from '../prompts/system.js';
import { config } from '../config.js';

export const SuggestCharacterInputSchema = z.object({
  text: z.string().min(20).max(config.limits.maxInputChars),
  storyType: z.string().min(1),
  artStyle: z.string().min(1),
  /** 最多提取几个角色，默认 10 */
  maxCharacters: z.number().int().min(1).max(30).optional(),
});
export type SuggestCharacterInput = z.infer<typeof SuggestCharacterInputSchema>;

export interface CharacterProfile {
  name: string;
  /** 主角 / 配角 / 反派 / 路人 */
  role: 'protagonist' | 'supporting' | 'antagonist' | 'extra' | string;
  /** 中文外貌描述 */
  appearance: string;
  /** 性格（短词列表） */
  personality: string[];
  /** 锁脸 prompt（英文，image gen 专用） */
  faceLockPrompt: string;
  /** 服饰 prompt（英文，可按场景切换） */
  outfitPrompt: string;
  /** 首次出场在原文的哪一段（粗略定位） */
  firstAppearanceHint?: string;
}

export interface SuggestCharacterResult {
  storyType: string;
  artStyle: string;
  characters: CharacterProfile[];
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【角色提取 + 锁脸 prompt 生成】';
const USER_TEMPLATE = (text: string, storyType: string, artStyle: string, max: number) => `
请从以下小说片段中提取所有登场角色，并为每个角色生成"锁脸 prompt"（用于多镜中保持形象一致）。

故事类型：${storyType}
艺术风格：${artStyle}
最多提取：${max} 个角色（按出场戏份排序）

【小说原文】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "characters": [ { "name": "...", "role": "...", "appearance": "...", "personality": [...], "faceLockPrompt": "...", "outfitPrompt": "...", "firstAppearanceHint": "..." }, ... ] }；
 3) role 取值：protagonist | supporting | antagonist | extra；
 4) faceLockPrompt 必须包含：年龄段（young adult / middle-aged / elderly 等）、脸型、瞳色、发色与发型、肤色、显著特征（如有疤/痣/纹身）；
 5) outfitPrompt 与 faceLockPrompt 风格保持一致，便于同一角色不同镜次复用；
 6) personality 数组 2~4 个短词，如 ["calm", "calculating", "cynical"]；
 7) firstAppearanceHint 给出在原文里识别该角色的关键句（不超过 30 字）。

【开始输出】
`;

export async function runSuggestCharacter(
  input: SuggestCharacterInput
): Promise<SuggestCharacterResult> {
  const system = SYSTEM_PREFIX + '\n' + buildSystemPrompt(input.storyType, input.artStyle);
  const user = USER_TEMPLATE(input.text, input.storyType, input.artStyle, input.maxCharacters ?? 10);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:suggest-character', temperature: 0.5 }
  );

  const parsed = extractJson<{ characters?: CharacterProfile[] }>(res.content);
  const styleKw = buildVisualKeywords(input.artStyle);
  const characters = (parsed.characters ?? []).map((c) => ({
    ...c,
    faceLockPrompt: c.faceLockPrompt
      ? `${c.faceLockPrompt}, ${styleKw.join(', ')}`
      : styleKw.join(', '),
    outfitPrompt: c.outfitPrompt
      ? `${c.outfitPrompt}, ${styleKw.join(', ')}`
      : styleKw.join(', '),
  }));

  return {
    storyType: input.storyType,
    artStyle: input.artStyle,
    characters,
    meta: res.meta,
  };
}
