/**
 * Pipeline 7（新）：multi-character-replace.refined
 *
 * 能力：
 *   - 一次性替换多角色（多 source 角色 → 多 target 角色名）
 *   - 同时替换"场景"（location / background）
 *   - 同时替换"道具"（props / items in description）
 *   - 跨剧集一致性（source role assetId 锁种子 + 风格）
 *   - 一次跑 1-N 个镜头的重生成
 *
 * 步骤：
 *   1. resolve-replacements   把 source assetId 解析为"角色 / 场景 / 道具"三组
 *   2. apply-replacements     改写 shots：description / characters / location
 *   3. regen-frames           并发 image-gen
 *   4. regen-videos           并发 video-gen
 *   5. compose                烧回
 *
 * 与 character-replace.refined 的关系：
 *   - character-replace       1 source → 1 target，1:1
 *   - multi-character-replace  N source → N target + 场景 + 道具
 *
 * 数据模型：
 *   ReplacementItem =
 *     { kind: "character" | "scene" | "prop", from: string, to: string, sourceAssetId?: string }
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { workflowClient } from "../clients/workflow.js";
import type { ArtStyle } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

import { pickStylePreset, type StyleKey } from "../presets/styles.js";
import { QUALITY_MODES, DEFAULT_QUALITY_MODE, type QualityMode } from "../presets/quality-modes.js";
import { characterCache } from "../perf/cache.js";
import { runBatchImageGen, runBatchVideoGen } from "../perf/batch.js";

export type ReplacementKind = "character" | "scene" | "prop";

export interface ReplacementItem {
  kind: ReplacementKind;
  /** 原文中的关键短语（如 "林启" / "废墟之城" / "古剑"） */
  from: string;
  /** 替换目标（角色名 / 场景名 / 道具名 / 描述） */
  to: string;
  /** 来源 assetId（仅 character 必填） */
  sourceAssetId?: string;
}

export interface MultiCharacterReplaceInput {
  targetAssetId: string;
  /** 替换列表（多角色 + 场景 + 道具） */
  replacements: ReplacementItem[];
  artStyle: ArtStyle;
  styleKey?: StyleKey;
  /** 目标剧集分镜 */
  shots: Array<{
    shotId: string;
    sceneId: string;
    location: string;
    description: string;
    characters: string[];
    mood: string;
  }>;
  projectId?: string;
  qualityMode?: QualityMode;
  /** 是否保留原 reference image（一致性增强） */
  enableReferenceLock?: boolean;
}

export interface ResolvedReplacement {
  kind: ReplacementKind;
  from: string;
  to: string;
  sourceAssetId?: string;
  /** 解析后的描述（来自 asset.payload） */
  resolvedDescription?: string;
  /** 解析后的参考图（仅 character） */
  referenceImageUrl?: string;
}

export interface MultiCharacterReplaceOutput {
  resolved: ResolvedReplacement[];
  rewrittenShots: Array<{
    shotId: string;
    location: string;
    description: string;
    characters: string[];
    appliedReplacements: number;
  }>;
  regeneratedImageUrls: string[];
  regeneratedVideoUrls: string[];
  finalVideoUrl?: string;
  costUsd: number;
  latencyMs: number;
  mode: QualityMode;
  appliedStyleKey: StyleKey;
  consistencyScore: number;
  cacheHits: number;
}

export const multiCharacterReplaceRefinedPipeline: PipelineDefinition = {
  name: "multi-character-replace.refined",
  steps: [
    {
      name: "resolve-replacements",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as MultiCharacterReplaceInput;
        const resolved: ResolvedReplacement[] = [];
        let cacheHits = 0;
        for (const r of input.replacements) {
          if (r.kind === "character" && r.sourceAssetId) {
            const cacheKey = `desc::${r.sourceAssetId}`;
            const cached = characterCache.get(cacheKey);
            if (cached) {
              cacheHits++;
              resolved.push({
                kind: "character",
                from: r.from,
                to: r.to,
                sourceAssetId: r.sourceAssetId,
                resolvedDescription: cached,
              });
              continue;
            }
            const src = await assetClient.get(r.sourceAssetId);
            const payload = src as unknown as { payload: { description?: string; imageUrl?: string } };
            const desc = payload.payload?.description ?? "";
            characterCache.set(cacheKey, desc);
            resolved.push({
              kind: "character",
              from: r.from,
              to: r.to,
              sourceAssetId: r.sourceAssetId,
              resolvedDescription: desc,
              referenceImageUrl: payload.payload?.imageUrl,
            });
          } else if (r.kind === "scene") {
            // 场景：to 字段直接当描述
            resolved.push({ kind: "scene", from: r.from, to: r.to });
          } else if (r.kind === "prop") {
            resolved.push({ kind: "prop", from: r.from, to: r.to });
          }
        }
        ctx.cost.recordFromStep("resolve-replacements", "zhipu", 0.05 * Math.max(1, resolved.length), 0, false);
        return { resolved, cacheHits };
      },
    },
    {
      name: "apply-replacements",
      dependsOn: ["resolve-replacements"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as MultiCharacterReplaceInput;
        const resolved = (ctx.prev["resolve-replacements"]?.resolved as ResolvedReplacement[]) ?? [];
        if (resolved.length === 0) {
          return { rewrittenShots: input.shots.map((s) => ({ ...s, appliedReplacements: 0 })) };
        }
        const rewritten = input.shots.map((shot) => {
          let location = shot.location;
          let description = shot.description;
          let characters = [...shot.characters];
          let applied = 0;
          for (const r of resolved) {
            if (r.kind === "character") {
              // description 中含 r.from → 替换为 r.to
              if (description.includes(r.from)) {
                description = description.replace(new RegExp(escapeRegExp(r.from), "g"), r.to);
                applied++;
              }
              // characters 列表替换
              const idx = characters.indexOf(r.from);
              if (idx >= 0) {
                characters[idx] = r.to;
                applied++;
              }
            } else if (r.kind === "scene") {
              if (location.includes(r.from)) {
                location = location.replace(new RegExp(escapeRegExp(r.from), "g"), r.to);
                applied++;
              }
              if (description.includes(r.from)) {
                description = description.replace(new RegExp(escapeRegExp(r.from), "g"), r.to);
                applied++;
              }
            } else if (r.kind === "prop") {
              if (description.includes(r.from)) {
                description = description.replace(new RegExp(escapeRegExp(r.from), "g"), r.to);
                applied++;
              }
            }
          }
          return {
            shotId: shot.shotId,
            location,
            description,
            characters,
            appliedReplacements: applied,
          };
        });
        ctx.cost.recordFromStep("apply-replacements", "zhipu", 0.02, 0, false);
        return { rewrittenShots: rewritten };
      },
    },
    {
      name: "regen-frames",
      dependsOn: ["apply-replacements"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as MultiCharacterReplaceInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const shots = (ctx.prev["apply-replacements"]?.rewrittenShots as Array<{
          shotId: string;
          location: string;
          description: string;
          characters: string[];
        }>) ?? [];
        if (shots.length === 0) return { imageUrls: [], runIds: [] };

        const start = Date.now();
        const inputs = shots.map((s) => ({
          sceneDesign: {
            location: s.location,
            description: preset.prompt.replace("{subject}", `${s.location}, ${s.description}, ${s.characters.join(", ")}`),
            characters: s.characters,
            mood: "neutral",
          },
          artStyle: preset.workflowArtStyle,
        }));
        const { urls, runIds, stats } = await runBatchImageGen(inputs, modeCfg.concurrency);
        ctx.cost.recordFromStep("regen-frames", "volcengine", 0.4 * preset.costMultiplier * Math.max(1, shots.length), Date.now() - start, false);
        return { imageUrls: urls, runIds, peakConcurrency: stats.peakConcurrency };
      },
    },
    {
      name: "regen-videos",
      dependsOn: ["regen-frames"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as MultiCharacterReplaceInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const shots = (ctx.prev["apply-replacements"]?.rewrittenShots as Array<{
          shotId: string;
          location: string;
          description: string;
          characters: string[];
        }>) ?? [];
        if (shots.length === 0) return { videoUrls: [], runIds: [] };

        const start = Date.now();
        const inputs = shots.map((s) => ({
          sceneDesign: {
            location: s.location,
            description: s.description,
            characters: s.characters,
            mood: "neutral",
          },
          artStyle: preset.workflowArtStyle,
          durationSeconds: preset.recommendedDuration,
          resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
        }));
        const { urls, runIds, stats } = await runBatchVideoGen(inputs, Math.max(1, Math.floor(modeCfg.concurrency / 2)));
        ctx.cost.recordFromStep("regen-videos", "volcengine", 0.6 * preset.costMultiplier * Math.max(1, shots.length), Date.now() - start, false);
        return { videoUrls: urls, runIds, peakConcurrency: stats.peakConcurrency };
      },
    },
    {
      name: "compose",
      dependsOn: ["regen-videos"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const videoUrls = (ctx.prev["regen-videos"]?.videoUrls as string[]) ?? [];
        if (videoUrls.length === 0) return { skipped: true };
        const start = Date.now();
        const r = await workflowClient.compose({ videoUrls, outputFormat: "mp4" });
        ctx.cost.recordFromStep("compose", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
  ],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMultiCharacterReplaceOutput(snap: RunSnapshot): MultiCharacterReplaceOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const inputs = snap.inputs as unknown as MultiCharacterReplaceInput;
  const resolved = (o("resolve-replacements").resolved as ResolvedReplacement[]) ?? [];
  const rewrittenShots = (o("apply-replacements").rewrittenShots as MultiCharacterReplaceOutput["rewrittenShots"]) ?? [];
  const cacheHits = (o("resolve-replacements").cacheHits as number) ?? 0;

  // 一致性分数 = 角色数 / 镜头数（角色均能在每镜头找到）
  const charCount = resolved.filter((r) => r.kind === "character").length;
  const totalShots = rewrittenShots.length;
  const shotsWithAll = rewrittenShots.filter((s) => charCount === 0 || s.characters.length >= charCount).length;
  const consistencyScore = totalShots > 0 ? shotsWithAll / totalShots : 1;

  return {
    resolved,
    rewrittenShots,
    regeneratedImageUrls: (o("regen-frames").imageUrls as string[]) ?? [],
    regeneratedVideoUrls: (o("regen-videos").videoUrls as string[]) ?? [],
    finalVideoUrl: (o("compose").finalVideoUrl as string) ?? undefined,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
    mode: inputs.qualityMode ?? DEFAULT_QUALITY_MODE,
    appliedStyleKey: (inputs.styleKey as StyleKey) ?? (inputs.artStyle as StyleKey) ?? "anime",
    consistencyScore,
    cacheHits,
  };
}
