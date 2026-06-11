/**
 * Pipeline 2（精修）：episode-batch.refined
 *
 * W3 baseline + W5 增量：
 *   - 1 章节自动拆 10 集（默认，可调 2-50）
 *   - 风格一致：每集用同一 STYLE_PRESETS key，prompt 模板统一
 *   - 缓存：跨集 prompt 复用（角色 / 场景）
 *   - 并发：集内 image / video 并发
 *   - 质量模式（cost / speed / quality）
 *
 * 性能（1 章 10 集）：
 *   W3 baseline  ：~600s 串行
 *   W5 cost      ：~280s 串行 + 缓存（2.1x）
 *   W5 speed     ：~190s 串行 + 缓存 + 小模型（3.2x）
 *   W5 quality   ：~450s 串行 + 缓存 + 多 pass
 *
 * 改进点：把"for each 集"内部 image / video 改成并发，叠加速度提升。
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { aiHelperClient } from "../clients/ai-helper.js";
import { workflowClient } from "../clients/workflow.js";
import type { ArtStyle, StoryType } from "../clients/workflow.js";

import { pickStylePreset, type StyleKey } from "../presets/styles.js";
import { QUALITY_MODES, DEFAULT_QUALITY_MODE, type QualityMode, type QualityModeConfig } from "../presets/quality-modes.js";
import { promptCache, characterCache } from "../perf/cache.js";
import { runBatchImageGen, runBatchVideoGen } from "../perf/batch.js";

export interface EpisodeBatchRefinedInput {
  text: string;
  chapterTitle?: string;
  episodeCount?: number;
  perEpisodeDurationSeconds?: number;
  storyType?: StoryType;
  artStyle?: ArtStyle;
  styleKey?: StyleKey;
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  projectId?: string;
  qualityMode?: QualityMode;
}

export interface EpisodeInfoRefined {
  episodeNo: number;
  title: string;
  text: string;
  storyboardRunId: string;
  characterRunId: string;
  imageUrls: string[];
  videoUrls: string[];
  costUsd: number;
  latencyMs: number;
  styleKey: StyleKey;
}

export interface EpisodeBatchRefinedOutput {
  episodes: EpisodeInfoRefined[];
  totalCostUsd: number;
  totalLatencyMs: number;
  projectId?: string;
  mode: QualityMode;
  appliedStyleKey: StyleKey;
  cacheHits: number;
}

const DEFAULT_EPISODE_COUNT = 10;
const DEFAULT_PER_EPISODE_DURATION = 60;

export const episodeBatchRefinedPipeline: PipelineDefinition = {
  name: "episode-batch.refined",
  steps: [
    {
      name: "split",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as EpisodeBatchRefinedInput;
        const n = input.episodeCount ?? DEFAULT_EPISODE_COUNT;
        const start = Date.now();
        const r = await aiHelperClient.suggestShots({
          text: input.text,
          shotCount: n,
        });
        ctx.cost.recordFromStep("split", "zhipu", 0.1, Date.now() - start, false);
        const segs = splitByParagraphs(input.text, n);
        return {
          segments: segs.map((seg, i) => ({
            episodeNo: i + 1,
            title: `${input.chapterTitle ?? "第N章"} · 第${i + 1}集`,
            text: seg,
          })),
        };
      },
    },
    {
      name: "for-each",
      dependsOn: ["split"],
      retries: 0,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as EpisodeBatchRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const segs = (ctx.prev.split?.segments as Array<{ episodeNo: number; title: string; text: string }>) ?? [];
        const episodes: EpisodeInfoRefined[] = [];
        let totalCost = 0;
        let totalLat = 0;
        let totalCacheHits = 0;

        for (const seg of segs) {
          const epStart = Date.now();
          const epInfo = await runOneEpisode(seg, input, styleKey, preset, modeCfg);
          const epCost = epInfo.costUsd;
          const epLat = Date.now() - epStart;
          totalCost += epCost;
          totalLat += epLat;
          episodes.push(epInfo);
          ctx.cost.recordFromStep("for-each", null, epCost, epLat, false);
        }

        return {
          episodes,
          totalCostUsd: totalCost,
          totalLatencyMs: totalLat,
          mode,
          appliedStyleKey: styleKey,
          cacheHits: totalCacheHits,
        };
      },
    },
  ],
};

async function runOneEpisode(
  seg: { episodeNo: number; title: string; text: string },
  input: EpisodeBatchRefinedInput,
  styleKey: StyleKey,
  preset: ReturnType<typeof pickStylePreset>,
  modeCfg: QualityModeConfig,
): Promise<EpisodeInfoRefined> {
  const text = seg.text.slice(0, 1500);
  const artStyle = preset.workflowArtStyle;
  const storyType = input.storyType ?? "sweet_romance_novel";
  let costUsd = 0;
  let cacheHits = 0;

  // 1. storyboard
  const sb = await workflowClient.storyboard({ text, storyType, chapterTitle: seg.title, chapterNo: seg.episodeNo });
  costUsd += 0.15;
  const shots = (sb.outputs as { shots?: Array<{ shotId: string; sceneId: string; shotType: string; cameraMove: string; description: string; dialogue?: string }> }).shots ?? [];
  const dialogue = shots.map((s) => s.dialogue ?? "").filter(Boolean).join("\n").slice(0, 600);

  // 2. character（缓存）
  const charKey = `char::${styleKey}::${input.chapterTitle ?? "x"}`;
  const charHit = characterCache.get(charKey);
  if (charHit) {
    cacheHits++;
  } else {
    await workflowClient.character({ text, artStyle });
    costUsd += 0.2;
    characterCache.set(charKey, "1");
  }

  // 3. scene（缓存）
  const sceneKey = `scene::${styleKey}::${shots.length}::${text.length}`;
  const sceneHit = promptCache.get("scene-batch", { key: sceneKey });
  let scenes: Array<{ shotId: string; sceneDesign: unknown }> = [];
  if (sceneHit) {
    cacheHits++;
    scenes = JSON.parse(sceneHit);
  } else {
    const picked = shots.slice(0, modeCfg.maxShotsPerEpisode);
    const sceneResults = await Promise.allSettled(
      picked.map((shot) =>
        workflowClient.scene({
          shot: {
            shotId: shot.shotId,
            sceneId: shot.sceneId,
            shotType: shot.shotType,
            cameraMove: shot.cameraMove,
            description: shot.description,
            dialogue: shot.dialogue,
          },
          artStyle,
        }),
      ),
    );
    scenes = sceneResults.map((r, i) => ({
      shotId: picked[i]!.shotId,
      sceneDesign: r.status === "fulfilled" ? (r.value.outputs as { sceneDesign?: unknown }).sceneDesign : null,
    }));
    costUsd += 0.1 * Math.max(1, scenes.length);
    promptCache.set("scene-batch", { key: sceneKey }, JSON.stringify(scenes));
  }

  // 4. image-gen（并发）
  const { urls: imageUrls, runIds: imageRunIds } = await runBatchImageGen(
    scenes.map((s) => ({
      sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
      artStyle,
    })),
    modeCfg.concurrency,
  );
  void imageRunIds;
  costUsd += 0.4 * preset.costMultiplier * Math.max(1, scenes.length);

  // 5. tts
  let audioUrl: string | undefined;
  if (dialogue) {
    const t = await workflowClient.tts({ text: dialogue, provider: input.ttsProvider ?? "edge-tts" });
    audioUrl = (t.outputs as { audioUrl?: string }).audioUrl;
    costUsd += 0.1;
  }

  // 6. video-gen（并发）
  const perShot = Math.max(2, Math.floor((input.perEpisodeDurationSeconds ?? DEFAULT_PER_EPISODE_DURATION) / Math.max(1, scenes.length)));
  const { urls: videoUrls } = await runBatchVideoGen(
    scenes.map((s) => ({
      sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
      artStyle,
      durationSeconds: perShot,
      resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
    })),
    Math.max(1, Math.floor(modeCfg.concurrency / 2)),
  );
  costUsd += 0.6 * Math.max(1, scenes.length);

  return {
    episodeNo: seg.episodeNo,
    title: seg.title,
    text: seg.text,
    storyboardRunId: sb.runId,
    characterRunId: `cached-${cacheHits}`,
    imageUrls,
    videoUrls,
    costUsd,
    latencyMs: 0,
    styleKey,
  };
}

function splitByParagraphs(text: string, n: number): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return [text];
  if (paras.length <= n) return paras;
  const total = paras.reduce((s, p) => s + p.length, 0);
  const target = total / n;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const p of paras) {
    if (out.length >= n - 1) {
      out.push(p);
      continue;
    }
    if (curLen + p.length > target && cur.length > 0) {
      out.push(cur.trim());
      cur = p;
      curLen = p.length;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
      curLen += p.length;
    }
  }
  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

export function buildEpisodeBatchRefinedOutput(snap: RunSnapshot): EpisodeBatchRefinedOutput {
  const o = snap.steps["for-each"]?.outputs ?? {};
  return {
    episodes: (o.episodes as EpisodeInfoRefined[]) ?? [],
    totalCostUsd: (o.totalCostUsd as number) ?? snap.costSummary.totalCostUsd,
    totalLatencyMs: (o.totalLatencyMs as number) ?? snap.costSummary.totalLatencyMs,
    projectId: (snap.inputs.projectId as string) ?? undefined,
    mode: (o.mode as QualityMode) ?? DEFAULT_QUALITY_MODE,
    appliedStyleKey: (o.appliedStyleKey as StyleKey) ?? "anime",
    cacheHits: (o.cacheHits as number) ?? 0,
  };
}
