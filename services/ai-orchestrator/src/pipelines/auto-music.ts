/**
 * Pipeline: auto-music
 * 输入场景描述/情感标签 → 调用 ai-router /audio → 返回配乐 URL
 *
 * 步骤：
 *   1. music-gen    根据场景描述 + 情感标签生成配乐
 *
 * 输入格式：
 *   { sceneDescription, moodTags, style, durationSeconds, projectId }
 *
 * 输出格式：
 *   { musicUrl, durationSeconds, provider, costUsd }
 */

import type { PipelineDefinition, StepContext } from "../pipeline-runner.js";
import { aiRouterClient } from "../clients/ai-router.js";

export interface AutoMusicInput {
  /** 场景描述（用于匹配情绪） */
  sceneDescription: string;
  /** 情感标签（逗号分隔或数组） */
  moodTags?: string | string[];
  /** 音乐风格 */
  style?: "epic" | "emotional" | "tense" | "relaxing" | "upbeat";
  /** 目标时长（秒，默认 60） */
  durationSeconds?: number;
  /** 项目 ID */
  projectId?: string;
}

export interface AutoMusicOutput {
  musicUrl?: string;
  durationSeconds: number;
  provider: string;
  model: string;
  costUsd: number;
  latencyMs: number;
}

const DEFAULT_DURATION = 60;
const DEFAULT_STYLE = "emotional" as const;

export const autoMusicPipeline: PipelineDefinition = {
  name: "auto-music",
  steps: [
    {
      name: "music-gen",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoMusicInput;
        const moodTags = Array.isArray(input.moodTags)
          ? input.moodTags.join(", ")
          : (input.moodTags ?? input.sceneDescription ?? "peaceful");

        const prompt = [
          `场景：${input.sceneDescription.slice(0, 500)}`,
          `情感：${moodTags.slice(0, 200)}`,
          `风格：${input.style ?? DEFAULT_STYLE}`,
        ].join("; ");

        const start = Date.now();
        const r = await aiRouterClient.audio(
          {
            prompt,
            style: input.style ?? DEFAULT_STYLE,
            durationSeconds: input.durationSeconds ?? DEFAULT_DURATION,
            taskTag: "auto-music",
          },
          ctx.signal,
        );

        ctx.cost.recordFromStep("music-gen", r.provider, r.cost, Date.now() - start, false);

        return {
          musicUrl: r.url,
          durationSeconds: r.durationSeconds,
          provider: r.provider,
          model: r.model,
          costUsd: r.cost,
          latencyMs: r.latencyMs,
        };
      },
    },
  ],
};

/** 把 snapshot 的 step outputs 整理成 AutoMusicOutput */
export function buildAutoMusicOutput(
  snap: import("../pipeline-runner.js").RunSnapshot,
): AutoMusicOutput {
  const o = snap.steps["music-gen"]?.outputs ?? {};
  return {
    musicUrl: (o.musicUrl as string) ?? undefined,
    durationSeconds: (o.durationSeconds as number) ?? DEFAULT_DURATION,
    provider: (o.provider as string) ?? "unknown",
    model: (o.model as string) ?? "unknown",
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
  };
}
