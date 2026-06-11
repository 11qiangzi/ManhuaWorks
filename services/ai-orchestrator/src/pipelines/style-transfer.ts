/**
 * Pipeline 3：style-transfer
 * 已有视频/分镜 → 检测当前风格 → 套新艺术风格 → 重出图/重渲染 → 烧回视频
 *
 * 步骤：
 *   1. detect-style    分析当前风格（ai-helper 视觉/文本混合）
 *   2. regen-frames    用新艺术风格重新出图
 *   3. rerender-videos 静帧→视频
 *   4. compose         烧回原视频（替换轨道）
 */

import type { PipelineDefinition, StepContext } from "../pipeline-runner.js";
import { aiHelperClient } from "../clients/ai-helper.js";
import { workflowClient, type ArtStyle } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

export interface StyleTransferInput {
  /** 原始资产 ID（asset-service 里的 video / storyboard） */
  sourceAssetId: string;
  /** 原剧集分镜（asset-service 取，或调用方直传） */
  shots?: Array<{
    shotId: string;
    sceneId: string;
    location: string;
    description: string;
    characters: string[];
    mood: string;
    shotType: string;
    cameraMove: string;
  }>;
  /** 目标新艺术风格 */
  targetArtStyle: ArtStyle;
  /** 原视频 URL（用于最后烧回） */
  sourceVideoUrl?: string;
  /** 项目 ID */
  projectId?: string;
}

export interface StyleTransferOutput {
  detectedStyle: ArtStyle | string;
  targetStyle: ArtStyle;
  regeneratedImageUrls: string[];
  regeneratedVideoUrls: string[];
  finalVideoUrl?: string;
  costUsd: number;
  latencyMs: number;
}

export const styleTransferPipeline: PipelineDefinition = {
  name: "style-transfer",
  steps: [
    {
      name: "detect-style",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferInput;
        // 取源资产元信息
        const asset = await assetClient.get(input.sourceAssetId);
        const start = Date.now();
        // 用 ai-helper 做风格识别（基于元数据 + payload）
        const payload = JSON.stringify(asset).slice(0, 2000);
        const r = await aiHelperClient.rewrite({
          text: payload,
          instruction: "从以下漫剧元数据中识别当前艺术风格，只输出英文枚举：anime / manhua_chinese / realistic_3d / watercolor / pixel / ink_painting / comic_western / unknown",
        });
        ctx.cost.recordFromStep("detect-style", "zhipu", 0.1, Date.now() - start, false);
        const detected = (r.data ?? "unknown").trim();
        return { detectedStyle: detected };
      },
    },
    {
      name: "regen-frames",
      dependsOn: ["detect-style"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferInput;
        const detected = (ctx.prev["detect-style"]?.detectedStyle as string) ?? "unknown";
        const shots = input.shots ?? [];
        if (shots.length === 0) {
          return { imageUrls: [], runIds: [], detectedStyle: detected };
        }
        const start = Date.now();
        const urls: string[] = [];
        const runIds: string[] = [];
        for (const shot of shots) {
          const r = await workflowClient.imageGen({
            sceneDesign: {
              location: shot.location,
              description: shot.description,
              characters: shot.characters,
              mood: shot.mood,
            },
            artStyle: input.targetArtStyle,
          });
          const outs = r.outputs as { urls?: string[] };
          if (outs.urls) urls.push(...outs.urls);
          runIds.push(r.runId);
        }
        ctx.cost.recordFromStep("regen-frames", "volcengine", 0.4 * Math.max(1, shots.length), Date.now() - start, false);
        return { imageUrls: urls, runIds, detectedStyle: detected };
      },
    },
    {
      name: "rerender-videos",
      dependsOn: ["regen-frames"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferInput;
        const shots = input.shots ?? [];
        const imageUrls = (ctx.prev["regen-frames"]?.imageUrls as string[]) ?? [];
        if (shots.length === 0 || imageUrls.length === 0) {
          return { videoUrls: [] };
        }
        const start = Date.now();
        const urls: string[] = [];
        for (let i = 0; i < shots.length; i++) {
          const r = await workflowClient.videoGen({
            sceneDesign: {
              location: shots[i].location,
              description: shots[i].description,
              characters: shots[i].characters,
              mood: shots[i].mood,
            },
            artStyle: input.targetArtStyle,
            durationSeconds: 5,
            resolution: "720p",
          });
          const u = (r.outputs as { url?: string }).url;
          if (u) urls.push(u);
        }
        ctx.cost.recordFromStep("rerender-videos", "volcengine", 0.6 * Math.max(1, shots.length), Date.now() - start, false);
        return { videoUrls: urls };
      },
    },
    {
      name: "compose",
      dependsOn: ["rerender-videos"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const videoUrls = (ctx.prev["rerender-videos"]?.videoUrls as string[]) ?? [];
        if (videoUrls.length === 0) {
          return { skipped: true };
        }
        const start = Date.now();
        const r = await workflowClient.compose({
          videoUrls,
          outputFormat: "mp4",
        });
        ctx.cost.recordFromStep("compose", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
  ],
};

export function buildStyleTransferOutput(snap: import("../pipeline-runner.js").RunSnapshot): StyleTransferOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  return {
    detectedStyle: (o("detect-style").detectedStyle as string) ?? "unknown",
    targetStyle: ((snap.inputs as unknown as StyleTransferInput).targetArtStyle as ArtStyle) ?? "anime",
    regeneratedImageUrls: (o("regen-frames").imageUrls as string[]) ?? [],
    regeneratedVideoUrls: (o("rerender-videos").videoUrls as string[]) ?? [],
    finalVideoUrl: (o("compose").finalVideoUrl as string) ?? undefined,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
  };
}
