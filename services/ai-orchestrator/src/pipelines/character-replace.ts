/**
 * Pipeline 4：character-replace
 * 跨剧集复用同一角色：A 剧集的角色描述 → 在 B 剧集中替换某角色 → 一致性重生成
 *
 * 步骤：
 *   1. extract-roles     从原剧集提取所有角色描述（来自 asset-service）
 *   2. rebuild-characters 用 sourceCharacterId 重新生成角色图（保证一致性）
 *   3. regen-videos      用新角色重渲染视频
 */

import type { PipelineDefinition, StepContext } from "../pipeline-runner.js";
import { workflowClient, type ArtStyle } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

export interface CharacterReplaceInput {
  /** 目标剧集 ID（asset-service） */
  targetAssetId: string;
  /** 目标剧集的角色替换列表：{ 原角色名 → 新角色来源 assetId } */
  replacements: Array<{
    /** 目标剧集中的角色名 */
    targetCharacterName: string;
    /** 来源角色 assetId（来自其他剧集） */
    sourceCharacterAssetId: string;
  }>;
  /** 艺术风格 */
  artStyle: ArtStyle;
  /** 目标剧集分镜（asset-service 取，或调用方直传） */
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
}

export interface CharacterReplaceOutput {
  extractedRoles: Array<{ name: string; description: string }>;
  rebuiltImageUrls: string[];
  regenVideoUrls: string[];
  costUsd: number;
  latencyMs: number;
}

export const characterReplacePipeline: PipelineDefinition = {
  name: "character-replace",
  steps: [
    {
      name: "extract-roles",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceInput;
        // 1) 拿目标剧集下的所有 character 资产
        const target = await assetClient.listByProject(input.projectId ?? "", "character");
        const targetChars = target.assets;

        // 2) 拿每个 source 角色的元数据
        const sourceRoles: Array<{ name: string; description: string; sourceAssetId: string }> = [];
        for (const r of input.replacements) {
          const src = await assetClient.get(r.sourceCharacterAssetId);
          const payload = src as unknown as { payload: { name?: string; description?: string } };
          sourceRoles.push({
            name: r.targetCharacterName,
            description: payload.payload?.description ?? "",
            sourceAssetId: r.sourceCharacterAssetId,
          });
        }

        ctx.cost.recordFromStep("extract-roles", "zhipu", 0.1, 0, false);
        return {
          roles: sourceRoles,
          targetCharCount: targetChars.length,
        };
      },
    },
    {
      name: "rebuild-characters",
      dependsOn: ["extract-roles"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceInput;
        const roles = (ctx.prev["extract-roles"]?.roles as Array<{ name: string; description: string; sourceAssetId: string }>) ?? [];
        if (roles.length === 0) {
          return { imageUrls: [] };
        }
        const start = Date.now();
        const urls: string[] = [];
        for (const role of roles) {
          // 用 character workflow 重建（内部会调 image-gen）
          const r = await workflowClient.character({
            text: role.description,
            artStyle: input.artStyle,
            characterHints: [role.name],
          });
          const outs = r.outputs as { imageUrls?: string[] };
          if (outs.imageUrls) urls.push(...outs.imageUrls);
        }
        ctx.cost.recordFromStep("rebuild-characters", "volcengine", 0.3 * Math.max(1, roles.length), Date.now() - start, false);
        return { imageUrls: urls };
      },
    },
    {
      name: "regen-videos",
      dependsOn: ["rebuild-characters"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as CharacterReplaceInput;
        const shots = input.shots ?? [];
        if (shots.length === 0) {
          return { videoUrls: [] };
        }
        const start = Date.now();
        const urls: string[] = [];
        // 把原 characters 列表里的"待替换"角色名替换成新角色描述
        const newCharMap = new Map(
          ((ctx.prev["extract-roles"]?.roles as Array<{ name: string; description: string }>) ?? []).map(
            (r) => [r.name, r.description],
          ),
        );
        for (const shot of shots) {
          const desc = shot.description.replace(
            new RegExp(`(${Array.from(newCharMap.keys()).join("|")})`, "g"),
            (m) => newCharMap.get(m) ?? m,
          );
          const r = await workflowClient.videoGen({
            sceneDesign: {
              location: shot.location,
              description: desc,
              characters: shot.characters.map((c) => newCharMap.get(c) ?? c),
              mood: shot.mood,
            },
            artStyle: input.artStyle,
            durationSeconds: 5,
            resolution: "720p",
          });
          const u = (r.outputs as { url?: string }).url;
          if (u) urls.push(u);
        }
        ctx.cost.recordFromStep("regen-videos", "volcengine", 0.6 * Math.max(1, shots.length), Date.now() - start, false);
        return { videoUrls: urls };
      },
    },
  ],
};

export function buildCharacterReplaceOutput(snap: import("../pipeline-runner.js").RunSnapshot): CharacterReplaceOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  return {
    extractedRoles: (o("extract-roles").roles as Array<{ name: string; description: string }>) ?? [],
    rebuiltImageUrls: (o("rebuild-characters").imageUrls as string[]) ?? [],
    regenVideoUrls: (o("regen-videos").videoUrls as string[]) ?? [],
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
  };
}
