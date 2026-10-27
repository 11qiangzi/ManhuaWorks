/**
 * Pipeline: decompose
 * 小说文本 → 节拍拆分 → 镜头组合 → 分镜脚本
 *
 * 步骤：
 *   1. beat-split     文本 → 节拍列表（情感/动作/对话）
 *   2. shot-compose   节拍 → 镜头组合（景别/运镜/时长）
 *   3. storyboard     镜头 → 完整分镜脚本
 */

import type { PipelineDefinition } from "../pipeline-runner.js";
import { workflowClient, type ArtStyle, type StoryType } from "../clients/workflow.js";
import type { StepContext } from "../pipeline-runner.js";

export interface DecomposeInput {
  /** 小说文本（长文自动截取前 2000 字） */
  text: string;
  /** 剧情类型（默认 sweet_romance_novel） */
  storyType?: StoryType;
  /** 艺术风格（默认 anime） */
  artStyle?: ArtStyle;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 目标时长（秒，默认 60） */
  durationSeconds?: number;
  /** 项目 ID */
  projectId?: string;
}

export interface DecomposeOutput {
  beatSplitRunId: string;
  shotComposeRunId: string;
  storyboardRunId: string;
  totalCostUsd: number;
  totalLatencyMs: number;
  beats: Array<{
    beatId: string;
    type: "action" | "dialogue" | "emotion" | "transition";
    description: string;
    duration: number;
  }>;
  shots: Array<{
    shotId: string;
    sceneId: string;
    shotType: string;
    cameraMove: string;
    description: string;
    dialogue?: string;
    duration: number;
  }>;
  storyboardUrl?: string;
}

const DEFAULT_STORY_TYPE: StoryType = "sweet_romance_novel";
const DEFAULT_ART_STYLE: ArtStyle = "anime";
const DEFAULT_DURATION = 60;

/** 1 集 60s 漫剧，镜头数 = duration / 5s/shot */
function shotCount(duration: number): number {
  return Math.max(6, Math.min(24, Math.ceil(duration / 5)));
}

export const decomposePipeline: PipelineDefinition = {
  name: "decompose",
  steps: [
    {
      name: "beat-split",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as DecomposeInput;
        const text = input.text.slice(0, 2000);
        const start = Date.now();
        const r = await workflowClient.beatSplit({
          text,
          storyType: input.storyType ?? DEFAULT_STORY_TYPE,
          chapterTitle: input.chapterTitle,
        });
        ctx.cost.recordFromStep("beat-split", "zhipu", 0.12, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "shot-compose",
      dependsOn: ["beat-split"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as DecomposeInput;
        const beats = (ctx.prev["beat-split"]?.beats as Array<{
          beatId: string;
          type: string;
          description: string;
          duration: number;
        }>) ?? [];
        const n = shotCount(input.durationSeconds ?? DEFAULT_DURATION);
        const start = Date.now();
        const r = await workflowClient.shotCompose({
          beats,
          targetShotCount: n,
          artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
        });
        ctx.cost.recordFromStep("shot-compose", "zhipu", 0.18, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "storyboard",
      dependsOn: ["shot-compose"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as DecomposeInput;
        const shots = (ctx.prev["shot-compose"]?.shots as Array<{
          shotId: string;
          sceneId: string;
          shotType: string;
          cameraMove: string;
          description: string;
          dialogue?: string;
          duration: number;
        }>) ?? [];
        const start = Date.now();
        const r = await workflowClient.storyboard({
          text: input.text.slice(0, 1500),
          storyType: input.storyType ?? DEFAULT_STORY_TYPE,
          chapterTitle: input.chapterTitle,
          chapterNo: undefined,
        });
        ctx.cost.recordFromStep("storyboard", "zhipu", 0.15, Date.now() - start, false);
        return {
          ...(r.outputs as Record<string, unknown>),
          shots,
          shotCount: shots.length,
        };
      },
    },
  ],
};

/** 把 snapshot 的 step outputs 整理成 DecomposeOutput（用于 HTTP 响应） */
export function buildDecomposeOutput(snap: import("../pipeline-runner.js").RunSnapshot): DecomposeOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  return {
    beatSplitRunId: (o("beat-split").runId as string) ?? "",
    shotComposeRunId: (o("shot-compose").runId as string) ?? "",
    storyboardRunId: (o("storyboard").runId as string) ?? "",
    totalCostUsd: snap.costSummary.totalCostUsd,
    totalLatencyMs: snap.costSummary.totalLatencyMs,
    beats: (o("beat-split").beats as DecomposeOutput["beats"]) ?? [],
    shots: (o("storyboard").shots as DecomposeOutput["shots"]) ?? [],
    storyboardUrl: (o("storyboard").storyboardUrl as string) ?? undefined,
  };
}
