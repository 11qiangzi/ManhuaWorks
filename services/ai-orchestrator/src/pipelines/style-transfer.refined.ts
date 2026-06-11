/**
 * Pipeline 3（精修）：style-transfer.refined
 *
 * W3 baseline + W5 增量：
 *   - 12 风格预设（STYLE_PRESETS）
 *   - 风格混合（mixStylePrompts）
 *   - 后期参数应用（StylePostProcess → compose 时透传）
 *   - 错误恢复（recovery.ts）
 *   - 并发 image / video
 *   - 缓存：style prompt
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { aiHelperClient } from "../clients/ai-helper.js";
import { workflowClient } from "../clients/workflow.js";
import type { ArtStyle } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

import { STYLE_PRESETS, pickStylePreset, mixStylePrompts, canMixStyles, type StyleKey, type StylePreset } from "../presets/styles.js";
import { QUALITY_MODES, DEFAULT_QUALITY_MODE, type QualityMode } from "../presets/quality-modes.js";
import { promptCache } from "../perf/cache.js";
import { runBatchImageGen, runBatchVideoGen } from "../perf/batch.js";
import { defaultRecoveryForMode, withAiFallback } from "../errors/recovery.js";

export interface StyleTransferRefinedInput {
  sourceAssetId: string;
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
  /** 目标新艺术风格（12 风格之一） */
  targetStyleKey: StyleKey;
  /** 可选：第二种风格（混合风格） */
  secondaryStyleKey?: StyleKey;
  /** 混合权重（0..1，0.5=对半；default 0.5） */
  mixWeight?: number;
  /** 原视频 URL（最后烧回） */
  sourceVideoUrl?: string;
  /** 项目 ID */
  projectId?: string;
  /** 质量模式 */
  qualityMode?: QualityMode;
}

export interface StyleTransferRefinedOutput {
  detectedStyle: ArtStyle | string;
  targetStyle: StyleKey;
  secondaryStyle?: StyleKey;
  mixedPrompt: string;
  regeneratedImageUrls: string[];
  regeneratedVideoUrls: string[];
  finalVideoUrl?: string;
  costUsd: number;
  latencyMs: number;
  mode: QualityMode;
  /** 应用到的后期参数（debug） */
  postProcess: StylePreset["postProcess"];
  cacheHits: number;
}

export const styleTransferRefinedPipeline: PipelineDefinition = {
  name: "style-transfer.refined",
  steps: [
    {
      name: "detect-style",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferRefinedInput;
        const asset = await assetClient.get(input.sourceAssetId);
        const start = Date.now();
        const payload = JSON.stringify(asset).slice(0, 2000);
        // 缓存
        const hit = promptCache.get("style-detect", { key: input.sourceAssetId, payload: payload.slice(0, 100) });
        if (hit) {
          return { detectedStyle: hit, _cacheHit: true };
        }
        const r = await aiHelperClient.rewrite({
          text: payload,
          instruction: "从以下漫剧元数据中识别当前艺术风格，只输出英文枚举：anime / manhua_chinese / realistic_3d / watercolor / pixel / ink_painting / comic_western / unknown",
        });
        ctx.cost.recordFromStep("detect-style", "zhipu", 0.1, Date.now() - start, false);
        const detected = (r.data ?? "unknown").trim();
        promptCache.set("style-detect", { key: input.sourceAssetId, payload: payload.slice(0, 100) }, detected);
        return { detectedStyle: detected, _cacheHit: false };
      },
    },
    {
      name: "regen-frames",
      dependsOn: ["detect-style"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const detected = (ctx.prev["detect-style"]?.detectedStyle as string) ?? "unknown";
        const shots = input.shots ?? [];
        if (shots.length === 0) {
          return { imageUrls: [], runIds: [], detectedStyle: detected, targetStyle: input.targetStyleKey };
        }

        const preset = pickStylePreset(input.targetStyleKey);
        let mixedPrompt = preset.prompt;
        if (input.secondaryStyleKey && canMixStyles(input.targetStyleKey, input.secondaryStyleKey)) {
          mixedPrompt = mixStylePrompts(input.targetStyleKey, input.secondaryStyleKey, input.mixWeight ?? 0.5);
        } else if (input.secondaryStyleKey) {
          // 不可混合，fallback 到 primary
          mixedPrompt = preset.prompt;
        }

        const start = Date.now();
        const inputs = shots.map((shot) => {
          const subject = `${shot.location}, ${shot.description}, ${shot.characters.join(", ")}, ${shot.mood}`;
          const fullPrompt = mixedPrompt.replace("{subject}", subject);
          return {
            sceneDesign: {
              location: shot.location,
              description: fullPrompt,
              characters: shot.characters,
              mood: shot.mood,
            },
            artStyle: preset.workflowArtStyle,
          };
        });
        const { urls, runIds, stats } = await runBatchImageGen(inputs, modeCfg.concurrency);
        ctx.cost.recordFromStep("regen-frames", "volcengine", 0.4 * preset.costMultiplier * Math.max(1, shots.length), Date.now() - start, false);
        return {
          imageUrls: urls,
          runIds,
          detectedStyle: detected,
          targetStyle: input.targetStyleKey,
          secondaryStyle: input.secondaryStyleKey,
          mixedPrompt,
          postProcess: preset.postProcess,
          peakConcurrency: stats.peakConcurrency,
        };
      },
    },
    {
      name: "rerender-videos",
      dependsOn: ["regen-frames"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as StyleTransferRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const shots = input.shots ?? [];
        if (shots.length === 0) return { videoUrls: [], runIds: [] };
        const start = Date.now();
        const preset = pickStylePreset(input.targetStyleKey);
        const inputs = shots.map((shot) => ({
          sceneDesign: {
            location: shot.location,
            description: shot.description,
            characters: shot.characters,
            mood: shot.mood,
          },
          artStyle: preset.workflowArtStyle,
          durationSeconds: preset.recommendedDuration,
          resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
        }));
        const { urls, runIds, stats } = await runBatchVideoGen(inputs, Math.max(1, Math.floor(modeCfg.concurrency / 2)));
        ctx.cost.recordFromStep("rerender-videos", "volcengine", 0.6 * preset.costMultiplier * Math.max(1, shots.length), Date.now() - start, false);
        return { videoUrls: urls, runIds, peakConcurrency: stats.peakConcurrency };
      },
    },
    {
      name: "compose",
      dependsOn: ["rerender-videos"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const videoUrls = (ctx.prev["rerender-videos"]?.videoUrls as string[]) ?? [];
        if (videoUrls.length === 0) return { skipped: true };
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

export function buildStyleTransferRefinedOutput(snap: RunSnapshot): StyleTransferRefinedOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const inputs = snap.inputs as unknown as StyleTransferRefinedInput;
  const cacheHit = (o("detect-style")._cacheHit as boolean) ? 1 : 0;
  return {
    detectedStyle: (o("detect-style").detectedStyle as string) ?? "unknown",
    targetStyle: ((o("regen-frames").targetStyle as StyleKey) ?? inputs.targetStyleKey) ?? "anime",
    secondaryStyle: o("regen-frames").secondaryStyle as StyleKey | undefined,
    mixedPrompt: (o("regen-frames").mixedPrompt as string) ?? "",
    regeneratedImageUrls: (o("regen-frames").imageUrls as string[]) ?? [],
    regeneratedVideoUrls: (o("rerender-videos").videoUrls as string[]) ?? [],
    finalVideoUrl: (o("compose").finalVideoUrl as string) ?? undefined,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
    mode: inputs.qualityMode ?? DEFAULT_QUALITY_MODE,
    postProcess: (o("regen-frames").postProcess as StylePreset["postProcess"]) ?? STYLE_PRESETS.anime.postProcess,
    cacheHits: cacheHit,
  };
}
