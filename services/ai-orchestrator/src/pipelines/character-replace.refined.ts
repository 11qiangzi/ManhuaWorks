/**
 * Pipeline 4（精修）：character-replace.refined
 *
 * W3 baseline + W5 增量：
 *   - 多角色批量替换（一次 N 个角色）
 *   - 一致性增强：character hint 锁定 seed + reference image
 *   - 风格预设（STYLE_PRESETS）注入
 *   - 缓存：角色描述 / 角色图片
 *   - 并发：image / video 批量
 *
 * 与 multi-character-replace 的区别：
 *   - character-replace.refined  ：聚焦"角色替换"，1 个 source 替换 1 个 target
 *   - multi-character-replace   ：同时替换多角色 + 场景 + 道具
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { workflowClient } from "../clients/workflow.js";
import type { ArtStyle } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

import { pickStylePreset, type StyleKey } from "../presets/styles.js";
import { QUALITY_MODES, DEFAULT_QUALITY_MODE, type QualityMode } from "../presets/quality-modes.js";
import { characterCache, promptCache } from "../perf/cache.js";
import { runBatchImageGen, runBatchVideoGen } from "../perf/batch.js";

export interface CharacterReplaceRefinedInput {
  /** 目标剧集 ID（asset-service） */
  targetAssetId: string;
  /** 角色替换列表 */
  replacements: Array<{
    targetCharacterName: string;
    sourceCharacterAssetId: string;
  }>;
  /** 艺术风格 */
  artStyle: ArtStyle;
  /** 12 风格预设 key */
  styleKey?: StyleKey;
  /** 目标剧集分镜 */
  shots?: Array<{
    shotId: string;
    sceneId: string;
    location: string;
    description: string;
    characters: string[];
    mood: string;
  }>;
  /** 项目 ID */
  projectId?: string;
  /** 质量模式（默认 speed） */
  qualityMode?: QualityMode;
  /** 是否启用 reference image 锁定（一致性增强） */
  enableReferenceLock?: boolean;
}

export interface CharacterReplaceRefinedOutput {
  extractedRoles: Array<{ name: string; description: string; sourceAssetId: string; imageUrl?: string }>;
  rebuiltImageUrls: string[];
  regenVideoUrls: string[];
  consistencyScore: number;
  costUsd: number;
  latencyMs: number;
  mode: QualityMode;
  appliedStyleKey: StyleKey;
  cacheHits: number;
}

export const characterReplaceRefinedPipeline: PipelineDefinition = {
  name: "character-replace.refined",
  steps: [
    {
      name: "extract-roles",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceRefinedInput;
        const target = await assetClient.listByProject(input.projectId ?? "", "character");
        const sourceRoles: Array<{ name: string; description: string; sourceAssetId: string; cachedDescription?: boolean }> = [];
        for (const r of input.replacements) {
          // 缓存：角色描述（按 assetId）
          const cacheKey = `desc::${r.sourceCharacterAssetId}`;
          const hit = characterCache.get(cacheKey);
          if (hit) {
            sourceRoles.push({
              name: r.targetCharacterName,
              description: hit,
              sourceAssetId: r.sourceCharacterAssetId,
              cachedDescription: true,
            });
            continue;
          }
          const src = await assetClient.get(r.sourceCharacterAssetId);
          const payload = src as unknown as { payload: { name?: string; description?: string; imageUrl?: string } };
          const desc = payload.payload?.description ?? "";
          characterCache.set(cacheKey, desc);
          sourceRoles.push({
            name: r.targetCharacterName,
            description: desc,
            sourceAssetId: r.sourceCharacterAssetId,
            cachedDescription: false,
          });
        }
        ctx.cost.recordFromStep("extract-roles", "zhipu", 0.05 * Math.max(1, sourceRoles.length), 0, false);
        return {
          roles: sourceRoles,
          targetCharCount: target.assets.length,
          cacheHits: sourceRoles.filter((r) => r.cachedDescription).length,
        };
      },
    },
    {
      name: "rebuild-characters",
      dependsOn: ["extract-roles"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const roles = (ctx.prev["extract-roles"]?.roles as Array<{ name: string; description: string; sourceAssetId: string }>) ?? [];
        if (roles.length === 0) return { imageUrls: [], consistencyHints: [] };

        const start = Date.now();
        // 并发生成角色图（一个角色一张）
        const inputs = roles.map((r) => ({
          sceneDesign: {
            location: "character sheet, neutral background",
            description: preset.prompt.replace("{subject}", `${r.name}, ${r.description}`),
            characters: [r.name],
            mood: "neutral",
          },
          artStyle: preset.workflowArtStyle,
        }));
        const { urls, runIds, stats } = await runBatchImageGen(inputs, modeCfg.concurrency);
        ctx.cost.recordFromStep("rebuild-characters", "volcengine", 0.3 * preset.costMultiplier * Math.max(1, roles.length), Date.now() - start, false);

        // 构造一致性 hints（每角色 → 参考图 URL）
        const consistencyHints = roles.map((r, i) => ({
          name: r.name,
          imageUrl: urls[i] ?? "",
          sourceAssetId: r.sourceAssetId,
        }));

        return { imageUrls: urls, runIds, consistencyHints, peakConcurrency: stats.peakConcurrency };
      },
    },
    {
      name: "regen-videos",
      dependsOn: ["rebuild-characters"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const shots = input.shots ?? [];
        if (shots.length === 0) return { videoUrls: [], runIds: [] };

        const start = Date.now();
        const newCharMap = new Map(
          ((ctx.prev["rebuild-characters"]?.consistencyHints as Array<{ name: string; imageUrl: string }>) ?? []).map(
            (h) => [h.name, h.imageUrl],
          ),
        );
        const newDescMap = new Map(
          ((ctx.prev["extract-roles"]?.roles as Array<{ name: string; description: string }>) ?? []).map(
            (r) => [r.name, r.description],
          ),
        );

        const inputs = shots.map((shot) => {
          // 替换描述里的"角色名" → "角色描述"
          const desc = shot.description.replace(
            new RegExp(`(${Array.from(newDescMap.keys()).join("|")})`, "g"),
            (m) => newDescMap.get(m) ?? m,
          );
          return {
            sceneDesign: {
              location: shot.location,
              description: desc,
              characters: shot.characters.map((c) => newCharMap.get(c) ?? newDescMap.get(c) ?? c),
              mood: shot.mood,
            },
            artStyle: (input.artStyle as ArtStyle) ?? "anime",
            durationSeconds: 5,
            resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
          };
        });
        const { urls, runIds, stats } = await runBatchVideoGen(inputs, Math.max(1, Math.floor(modeCfg.concurrency / 2)));
        ctx.cost.recordFromStep("regen-videos", "volcengine", 0.6 * Math.max(1, shots.length), Date.now() - start, false);
        return { videoUrls: urls, runIds, peakConcurrency: stats.peakConcurrency };
      },
    },
  ],
};

export function buildCharacterReplaceRefinedOutput(snap: RunSnapshot): CharacterReplaceRefinedOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const inputs = snap.inputs as unknown as CharacterReplaceRefinedInput;
  const cacheHits = (o("extract-roles").cacheHits as number) ?? 0;
  const consistencyHints = (o("rebuild-characters").consistencyHints as Array<{ name: string; imageUrl: string }>) ?? [];
  // 一致性分数：consistencyHints 全部有 imageUrl = 1.0，否则按比例
  const totalRoles = (o("extract-roles").roles as Array<unknown>)?.length ?? 0;
  const withImage = consistencyHints.filter((h) => h.imageUrl).length;
  return {
    extractedRoles: ((o("extract-roles").roles as Array<{ name: string; description: string; sourceAssetId: string }>) ?? []).map(
      (r) => ({
        name: r.name,
        description: r.description,
        sourceAssetId: r.sourceAssetId,
        imageUrl: consistencyHints.find((h) => h.name === r.name)?.imageUrl,
      }),
    ),
    rebuiltImageUrls: (o("rebuild-characters").imageUrls as string[]) ?? [],
    regenVideoUrls: (o("regen-videos").videoUrls as string[]) ?? [],
    consistencyScore: totalRoles > 0 ? withImage / totalRoles : 0,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
    mode: inputs.qualityMode ?? DEFAULT_QUALITY_MODE,
    appliedStyleKey: (inputs.styleKey as StyleKey) ?? (inputs.artStyle as StyleKey) ?? "anime",
    cacheHits,
  };
}
