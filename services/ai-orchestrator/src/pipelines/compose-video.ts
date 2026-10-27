/**
 * Pipeline: compose-video
 * 分镜静帧 + 配音 → 视频片段 → 合成输出
 *
 * 步骤：
 *   1. segment-gen    静帧 → 视频片段（每镜头）
 *   2. audio-align    配音对齐（TTS/BGM 时间轴）
 *   3. subtitle-burn  字幕烧录
 *   4. final-compose  片段拼接 + 转场 → 最终视频
 */

import type { PipelineDefinition } from "../pipeline-runner.js";
import { workflowClient, type ArtStyle } from "../clients/workflow.js";
import type { StepContext } from "../pipeline-runner.js";

export interface ComposeVideoInput {
  /** 分镜图片 URL 列表 */
  imageUrls: string[];
  /** 分镜元数据（镜头时长、对话等） */
  shots: Array<{
    shotId: string;
    sceneId: string;
    shotType: string;
    cameraMove: string;
    description: string;
    dialogue?: string;
    duration: number;
  }>;
  /** 配音音频 URL（可选） */
  audioUrl?: string;
  /** BGM URL（可选） */
  bgmUrl?: string;
  /** 艺术风格（默认 anime） */
  artStyle?: ArtStyle;
  /** 目标分辨率（默认 720p） */
  resolution?: "480p" | "720p" | "1080p";
  /** 输出格式（默认 mp4） */
  outputFormat?: "mp4" | "webm";
  /** 项目 ID */
  projectId?: string;
}

export interface ComposeVideoOutput {
  segmentRunIds: string[];
  audioAlignRunId?: string;
  subtitleRunId?: string;
  composeRunId?: string;
  totalCostUsd: number;
  totalLatencyMs: number;
  segmentUrls: string[];
  finalVideoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds: number;
}

const DEFAULT_ART_STYLE: ArtStyle = "anime";
const DEFAULT_RESOLUTION = "720p" as const;
const DEFAULT_FORMAT = "mp4" as const;

export const composeVideoPipeline: PipelineDefinition = {
  name: "compose-video",
  steps: [
    {
      name: "segment-gen",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as ComposeVideoInput;
        const start = Date.now();
        const urls: string[] = [];
        const runIds: string[] = [];

        for (let i = 0; i < input.imageUrls.length; i++) {
          const shot = input.shots[i];
          const r = await workflowClient.videoGen({
            sceneDesign: {
              location: shot?.description ?? "scene",
              description: shot?.description ?? "",
              characters: [],
              mood: "neutral",
            },
            artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
            durationSeconds: shot?.duration ?? 5,
            resolution: input.resolution ?? DEFAULT_RESOLUTION,
            sourceImageUrl: input.imageUrls[i],
          });
          const outs = r.outputs as { url?: string };
          if (outs.url) urls.push(outs.url);
          runIds.push(r.runId);
        }

        ctx.cost.recordFromStep(
          "segment-gen",
          "volcengine",
          0.5 * Math.max(1, input.imageUrls.length),
          Date.now() - start,
          false,
        );
        return { segmentUrls: urls, runIds };
      },
    },
    {
      name: "audio-align",
      dependsOn: ["segment-gen"],
      retries: 1,
      optional: true,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as ComposeVideoInput;
        if (!input.audioUrl && !input.bgmUrl) {
          return { skipped: true, reason: "no audio to align" };
        }
        const segmentUrls = (ctx.prev["segment-gen"]?.segmentUrls as string[]) ?? [];
        const start = Date.now();
        const r = await workflowClient.audioAlign({
          segmentUrls,
          audioUrl: input.audioUrl,
          bgmUrl: input.bgmUrl,
          shots: input.shots,
        });
        ctx.cost.recordFromStep("audio-align", "volcengine", 0.08, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "subtitle-burn",
      dependsOn: ["segment-gen", "audio-align"],
      retries: 1,
      optional: true,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as ComposeVideoInput;
        const segmentUrls = (ctx.prev["segment-gen"]?.segmentUrls as string[]) ?? [];
        const dialogueText = input.shots
          .map((s) => s.dialogue ?? "")
          .filter(Boolean)
          .join("\n");
        if (!dialogueText) {
          return { skipped: true, reason: "no dialogue to burn", segmentUrls };
        }
        const start = Date.now();
        const r = await workflowClient.subtitleBurn({
          segmentUrls,
          subtitleText: dialogueText,
          style: {
            position: "bottom",
            fontSize: 24,
            color: "#ffffff",
            outline: true,
          },
        });
        ctx.cost.recordFromStep("subtitle-burn", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "final-compose",
      dependsOn: ["segment-gen", "audio-align", "subtitle-burn"],
      retries: 0,
      run: async (ctx: StepContext) => {
        const segmentUrls = (ctx.prev["subtitle-burn"]?.segmentUrls as string[])
          ?? (ctx.prev["segment-gen"]?.segmentUrls as string[])
          ?? [];
        if (segmentUrls.length === 0) {
          return { skipped: true, reason: "no segments to compose" };
        }
        const audioUrl = ctx.prev["audio-align"]?.alignedAudioUrl as string | undefined;
        const input = ctx.inputs as unknown as ComposeVideoInput;
        const start = Date.now();
        const r = await workflowClient.compose({
          videoUrls: segmentUrls,
          audioUrls: audioUrl ? [audioUrl] : input.audioUrl ? [input.audioUrl] : undefined,
          subtitleText: undefined, // already burned in subtitle-burn step
          outputFormat: (input.outputFormat === 'webm' ? 'mp4' : (input.outputFormat ?? DEFAULT_FORMAT)) as 'mp4' | undefined,
          transitions: { type: "fade", duration: 0.5 },
        });
        ctx.cost.recordFromStep("final-compose", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
  ],
};

/** 把 snapshot 的 step outputs 整理成 ComposeVideoOutput */
export function buildComposeVideoOutput(snap: import("../pipeline-runner.js").RunSnapshot): ComposeVideoOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const input = snap.inputs as unknown as ComposeVideoInput;
  const totalDuration = input.shots.reduce((sum, s) => sum + (s.duration ?? 5), 0);
  return {
    segmentRunIds: (o("segment-gen").runIds as string[]) ?? [],
    audioAlignRunId: (o("audio-align").runId as string) ?? undefined,
    subtitleRunId: (o("subtitle-burn").runId as string) ?? undefined,
    composeRunId: (o("final-compose").runId as string) ?? undefined,
    totalCostUsd: snap.costSummary.totalCostUsd,
    totalLatencyMs: snap.costSummary.totalLatencyMs,
    segmentUrls: (o("segment-gen").segmentUrls as string[]) ?? [],
    finalVideoUrl: (o("final-compose").finalVideoUrl as string) ?? undefined,
    thumbnailUrl: (o("final-compose").thumbnailUrl as string) ?? undefined,
    durationSeconds: totalDuration,
  };
}
