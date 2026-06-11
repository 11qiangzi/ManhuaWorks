/**
 * 剧情续写（continue-plot）
 *
 * 用途：基于前 N 集大纲 → 推下一集（episode）的大纲
 * 输入：
 *  - episodes: 前置集大纲列表（每集 { title, summary, keyEvents? }）
 *  - targetEpisode: 目标集号（默认 = episodes.length + 1）
 * 输出：{ episode: { title, logline, acts, cliffhanger, keyShots, characterArcs } }
 *
 * 设计：
 *  - 强制"三幕结构"（建置 / 对抗 / 收束），每幕列 1~3 个 beat
 *  - 末尾必须给"cliffhanger"——下一集的开场钩子
 *  - 同时给"keyShots"——本集最值得做画面的 3~5 个分镜点
 */

import { z } from 'zod';
import { callChat, extractJson } from '../llm-client.js';
import { config } from '../config.js';

export const ContinuePlotInputSchema = z.object({
  /** 前置集大纲 */
  episodes: z
    .array(
      z.object({
        episode: z.number().int().positive(),
        title: z.string().min(1),
        summary: z.string().min(5),
        keyEvents: z.array(z.string()).optional(),
      })
    )
    .min(1)
    .max(config.limits.maxEpisodesForContinue),
  /** 故事类型（决定续写倾向） */
  storyType: z.string().min(1),
  /** 艺术风格（影响关键分镜的氛围建议） */
  artStyle: z.string().min(1),
  /** 目标集号（默认 = episodes.length + 1） */
  targetEpisode: z.number().int().positive().optional(),
  /** 主线索（用户额外指定，LLM 优先围绕这条线续） */
  mainThread: z.string().max(200).optional(),
  /** 本集预期时长（分钟），影响 acts 数量 */
  targetDurationMin: z.number().int().min(1).max(60).optional(),
});
export type ContinuePlotInput = z.infer<typeof ContinuePlotInputSchema>;

export interface PlotBeat {
  /** 幕/节拍（act1 / act2a / act2b / act3 等） */
  beat: string;
  /** 一句话描述 */
  description: string;
  /** 涉及角色 */
  characters: string[];
}

export interface EpisodeOutline {
  episode: number;
  title: string;
  /** 一句话剧情简介（logline） */
  logline: string;
  /** 三幕/节拍列表 */
  acts: PlotBeat[];
  /** 集末钩子 */
  cliffhanger: string;
  /** 本集最值得做画面的分镜点（3~5 条） */
  keyShots: string[];
  /** 角色弧光（哪些角色本集有变化） */
  characterArcs: { name: string; change: string }[];
}

export interface ContinuePlotResult {
  storyType: string;
  artStyle: string;
  episode: EpisodeOutline;
  /** 前情摘要（基于 episodes 自动生成，可用于持久化） */
  recap: string;
  meta?: Record<string, unknown>;
}

const SYSTEM_PREFIX = '【剧情续写】';
const USER_TEMPLATE = (
  episodesJson: string,
  storyType: string,
  artStyle: string,
  targetEp: number,
  mainThread: string | undefined,
  targetDurationMin: number | undefined
) => `
你是漫改剧编剧。请基于以下前情大纲，续写第 ${targetEp} 集。

故事类型：${storyType}
艺术风格：${artStyle}
目标时长：${targetDurationMin ?? 3} 分钟（一集 3 分钟是漫改短剧常规）
${mainThread ? `本集主线索：${mainThread}` : '本集主线索：由你从前情中推断的最自然走向'}

【前情大纲（已按集号排序）】
${episodesJson}

【输出要求】
 1) 仅输出 JSON；
 2) 顶层结构：{ "episode": { "episode": ${targetEp}, "title": "...", "logline": "...", "acts": [ ... ], "cliffhanger": "...", "keyShots": [ ... ], "characterArcs": [ ... ] }, "recap": "..." }；
 3) 强制三幕：acts 至少 3 个 beat，建置（act1）/ 对抗（act2）/ 收束（act3），可拆 act2a/act2b；
 4) cliffhanger 必须有"钩子"（悬念 / 反转 / 抉择 / 揭露），便于下一集开场；
 5) keyShots 3~5 个本集最值得做画面的镜头点（中文短句）；
 6) characterArcs 列出本集有变化的核心角色；
 7) recap 用 80~150 字总结前情（仅供下游模块使用，可存数据库）。

【开始输出】
`;

function buildEpisodesContext(episodes: ContinuePlotInput['episodes']): string {
  return episodes
    .map(
      (e) =>
        `第 ${e.episode} 集《${e.title}》：${e.summary}${
          e.keyEvents && e.keyEvents.length > 0
            ? `\n  关键事件：\n    - ${e.keyEvents.join('\n    - ')}`
            : ''
        }`
    )
    .join('\n\n');
}

export async function runContinuePlot(input: ContinuePlotInput): Promise<ContinuePlotResult> {
  const targetEpisode = input.targetEpisode ?? (input.episodes.at(-1)?.episode ?? 0) + 1;

  const system = SYSTEM_PREFIX;
  const user = USER_TEMPLATE(
    buildEpisodesContext(input.episodes),
    input.storyType,
    input.artStyle,
    targetEpisode,
    input.mainThread,
    input.targetDurationMin
  );

  const res = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { taskTag: 'helper:continue-plot', temperature: 0.8 }
  );

  const parsed = extractJson<{ episode?: EpisodeOutline; recap?: string }>(res.content);

  const episode: EpisodeOutline = {
    episode: targetEpisode,
    title: parsed.episode?.title ?? `第 ${targetEpisode} 集`,
    logline: parsed.episode?.logline ?? '',
    acts: parsed.episode?.acts ?? [],
    cliffhanger: parsed.episode?.cliffhanger ?? '',
    keyShots: parsed.episode?.keyShots ?? [],
    characterArcs: parsed.episode?.characterArcs ?? [],
  };

  return {
    storyType: input.storyType,
    artStyle: input.artStyle,
    episode,
    recap: parsed.recap ?? '',
    meta: res.meta,
  };
}
