/**
 * 对话润色（polish-dialogue）
 *
 * 用途：把"小说式叙述对话"润色为"漫画分镜对话"——
 *  - 口语化（短句 + 语气词）
 *  - 每行带情绪标签（便于 TTS / 漫画气泡样式选择）
 *  - 修复病句、错字、拗口的表达
 *
 * 输出：{ lines: [ { speaker, text, emotion, intensity } ] }
 *
 * emotion 取值：neutral | happy | angry | sad | surprised | fearful | disgusted | embarrassed | contemptuous
 * intensity：0.0~1.0，情绪强度（影响 TTS 音量 / 气泡大小）
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';

export const PolishDialogueInputSchema = z.object({
  /** 对话原文（多行，每行可包含 "角色：台词" 格式） */
  text: z.string().min(5).max(20_000),
  /** 故事类型（影响语气基线，例如霸总 vs 少年） */
  storyType: z.string().min(1),
  /** 润色强度：light | medium | strong（影响台词改写幅度） */
  intensity: z.enum(['light', 'medium', 'strong']).optional(),
  /** 是否给每行加"语气副词"前缀（如 「他轻蔑地笑了笑……」） */
  addNarration: z.boolean().optional(),
});
export type PolishDialogueInput = z.infer<typeof PolishDialogueInputSchema>;

export type DialogueEmotion =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'fearful'
  | 'disgusted'
  | 'embarrassed'
  | 'contemptuous';

export interface PolishedDialogueLine {
  /** 说话人 */
  speaker: string;
  /** 润色后台词（短句、口语） */
  text: string;
  /** 情绪 */
  emotion: DialogueEmotion;
  /** 强度 0.0~1.0 */
  intensity: number;
  /** 可选：旁白/动作描述（仅当 addNarration=true） */
  narration?: string;
  /** 可选：原台词（如果与润色后明显不同，便于审查） */
  original?: string;
}

export interface PolishDialogueResult {
  storyType: string;
  intensity: 'light' | 'medium' | 'strong';
  lines: PolishedDialogueLine[];
  meta?: Record<string, unknown>;
}

const INTENSITY_GUIDE: Record<'light' | 'medium' | 'strong', string> = {
  light: '只修正错字、拗口、语序；尽量保留原文语感。',
  medium: '改写为更口语化的短句，必要时合并/拆分；保留核心语义。',
  strong: '大幅改写，更符合漫画气泡短促有力的风格；可以加语气词（啊 / 吧 / 嘛 / 呢）。',
};

const SYSTEM_PREFIX = '【对话润色】';
const USER_TEMPLATE = (text: string, storyType: string, intensity: string, addNarration: boolean) => `
请将以下小说对话润色为漫画分镜对话。

故事类型：${storyType}
润色强度：${intensity}
${INTENSITY_GUIDE[intensity as 'light' | 'medium' | 'strong']}
是否加旁白：${addNarration ? '是，每行台词后追加一句简短动作/神态描述（≤ 15 字）' : '否，只输出台词'}

【对话原文】
"""
${text}
"""

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "lines": [ { "speaker": "...", "text": "...", "emotion": "...", "intensity": 0.0, "narration": "..." }, ... ] }；
 3) speaker 保留原文中的角色名（如未指定，标"未知"）；
 4) text 短句、≤ 30 字；如原文超过 30 字请合理拆为多行；
 5) emotion 取值：neutral | happy | angry | sad | surprised | fearful | disgusted | embarrassed | contemptuous；
 6) intensity 0.0~1.0 的浮点；
 7) narration 可选，仅在 addNarration=true 时输出，描述动作或神态（≤ 15 字）。

【开始输出】
`;

export async function runPolishDialogue(input: PolishDialogueInput): Promise<PolishDialogueResult> {
  const intensity = input.intensity ?? 'medium';
  const system = SYSTEM_PREFIX;
  const user = USER_TEMPLATE(input.text, input.storyType, intensity, input.addNarration ?? false);

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:polish-dialogue', temperature: 0.6 }
  );

  const parsed = extractJson<{ lines?: PolishedDialogueLine[] }>(res.content);
  const lines = (parsed.lines ?? []).map((l) => ({
    ...l,
    intensity: typeof l.intensity === 'number' ? Math.max(0, Math.min(1, l.intensity)) : 0.5,
  }));

  return {
    storyType: input.storyType,
    intensity,
    lines,
    meta: res.meta,
  };
}
