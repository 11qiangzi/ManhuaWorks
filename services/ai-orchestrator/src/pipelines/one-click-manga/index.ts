/**
 * Pipeline: one-click-manga
 * 一键创作：文本 → 7 步全自动编排 → 视频成品
 *
 * 7 步流程：
 *   1. novel-to-drama   → 小说→剧本（角色/场景/分镜/配音/视频/合成）
 *   2. character-replace → 角色一致性提取
 *   3. style-transfer    → 风格分析
 *   4. decompose         → 分镜拆分
 *   5. episode-batch     → 图像批量生成
 *   6. compose-video     → 视频合成
 *   7. auto-music        → 配乐生成
 *
 * 每步完成后通过 WebSocket 推送进度事件，中间产物暂存到 asset-service。
 *
 * 步骤实现已拆分到 one-click-manga/steps.ts
 * 类型+常量拆分到 one-click-manga/constants.ts
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../../pipeline-runner.js";
import { emitStepCompleted } from "../job-events.js";
import {
  step1NovelToDrama, step2CharacterExtract, step3StyleAnalysis,
  step4Decompose, step5ImageBatch, step6ComposeVideo, step7AutoMusic,
} from "./steps.js";
import {
  type OneClickMangaInput, type OneClickMangaOutput, type StepResult,
  STEP_NAMES, TOTAL_STEPS, MAX_INPUT_SHORT, mapMoodToMusicStyle,
  DEFAULT_STORY_TYPE, DEFAULT_ART_STYLE, DEFAULT_DURATION, DEFAULT_EPISODE_COUNT,
} from "./constants.js";

// ---- Pipeline 定义 ----

export const oneClickMangaPipeline: PipelineDefinition = {
  name: "one-click-manga",
  steps: [
    { name: "step-1-novel-to-drama",  retries: 1, run: step1NovelToDrama },
    { name: "step-2-character-extract", retries: 1, dependsOn: ["step-1-novel-to-drama"], run: step2CharacterExtract },
    { name: "step-3-style-analysis",   retries: 1, dependsOn: ["step-1-novel-to-drama"], run: step3StyleAnalysis },
    { name: "step-4-decompose",        retries: 1, dependsOn: ["step-1-novel-to-drama", "step-3-style-analysis"], run: step4Decompose },
    { name: "step-5-image-batch",      retries: 1, dependsOn: ["step-4-decompose", "step-2-character-extract"], run: step5ImageBatch },
    { name: "step-6-compose-video",    retries: 1, dependsOn: ["step-5-image-batch", "step-4-decompose", "step-1-novel-to-drama"], run: step6ComposeVideo },
    { name: "step-7-auto-music",       retries: 1, dependsOn: ["step-6-compose-video", "step-3-style-analysis"], optional: true, run: step7AutoMusic },
  ],
};

// ---- 输出构建 ----

/** 把 snapshot 的 step outputs 整理成 OneClickMangaOutput（用于 HTTP 响应） */
export function buildOneClickMangaOutput(snap: RunSnapshot): OneClickMangaOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const stepNames = ["novel-to-drama","character-extract","style-analysis","decompose","image-batch","compose-video","auto-music"];
  const steps: StepResult[] = [];
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const stepName = `step-${i}-${stepNames[i-1]}`;
    const stepResult = snap.steps[stepName];
    steps.push({
      step: i,
      name: STEP_NAMES[i],
      status: stepResult?.status === "success" ? "completed" as const : "failed" as const,
      previewUrl: (stepResult?.outputs?.imageUrls as string[])?.[0]
        ?? (stepResult?.outputs?.finalVideoUrl as string)
        ?? (stepResult?.outputs?.musicUrl as string),
      error: stepResult?.error,
    });
  }
  const out1 = o("step-1-novel-to-drama");
  return {
    plan: {
      text: (snap.inputs.text as string)?.slice(0, MAX_INPUT_SHORT),
      storyType: (snap.inputs.storyType as string) ?? DEFAULT_STORY_TYPE,
      artStyle: (snap.inputs.artStyle as string) ?? DEFAULT_ART_STYLE,
      aspectRatio: (snap.inputs.aspectRatio as string) ?? "16:9",
      episodeCount: (snap.inputs.episodeCount as number) ?? DEFAULT_EPISODE_COUNT,
      durationSeconds: (snap.inputs.durationSeconds as number) ?? DEFAULT_DURATION,
    },
    storyboardShotCount: (out1.shots as Array<unknown>)?.length ?? 0,
    characterNames: (out1.charNames as string[]) ?? [],
    styleDescription: (o("step-3-style-analysis").styleAnalysis as { description?: string })?.description ?? "",
    videoUrl: o("step-6-compose-video").finalVideoUrl as string | undefined,
    musicUrl: o("step-7-auto-music").musicUrl as string | undefined,
    steps,
    totalCostUsd: snap.costSummary.totalCostUsd,
    totalLatencyMs: snap.costSummary.totalLatencyMs,
  };
}

// 重新导出类型和常量供外部使用
export type { OneClickMangaInput, OneClickMangaOutput, StepResult } from "./constants.js";
export {
  DEFAULT_STORY_TYPE, DEFAULT_ART_STYLE, DEFAULT_DURATION, DEFAULT_EPISODE_COUNT,
  STEP_NAMES, TOTAL_STEPS,
  MAX_INPUT_FULL, MAX_INPUT_MEDIUM, MAX_INPUT_CHAR_FRAGMENT,
  MAX_TTS_DIALOGUE, MAX_INPUT_SNIPPET, MAX_INPUT_SHORT, MAX_SHOTS_PER_STEP,
  progressPct, mapMoodToMusicStyle,
} from "./constants.js";
