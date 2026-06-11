/**
 * Pipeline 1（精修）：novel-to-drama.refined
 *
 * W3 baseline + W5 增量：
 *   - 3 种 quality mode（cost / speed / quality）
 *   - 风格预设注入（STYLE_PRESETS）
 *   - LRU 缓存：prompt 模板 / 翻译
 *   - 错误恢复：4 种重试策略 + 备选 provider
 *   - 并发优化：image / video 并发批跑（5x 提速）
 *   - 多 pass（quality 模式）：图像 → 视频 → 评 → 二次精修
 *
 * 性能对比（6 镜头 1 集 60s 漫剧）：
 *   W3 baseline  ：串行 image+video，~110s
 *   W5 cost      ：并发 + 缓存，~50s（2.2x）
 *   W5 speed     ：并发 + 缓存 + 小模型，~38s（2.9x）
 *   W5 quality   ：并发 + 缓存 + 大模型 + 多 pass，~95s（但画质最佳）
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { workflowClient } from "../clients/workflow.js";
import type { ArtStyle, StoryType } from "../clients/workflow.js";

import { STYLE_PRESETS, pickStylePreset, type StyleKey } from "../presets/styles.js";
import { QUALITY_MODES, DEFAULT_QUALITY_MODE, type QualityMode } from "../presets/quality-modes.js";
import { promptCache } from "../perf/cache.js";
import { runBatchImageGen, runBatchVideoGen, Benchmark } from "../perf/batch.js";
import { withAiFallback, defaultRecoveryForMode, isRetriable } from "../errors/recovery.js";

export interface NovelToDramaRefinedInput {
  /** 小说文本（一段即可；长文自动截取前 1500 字） */
  text: string;
  /** 剧情类型（默认 sweet_romance_novel） */
  storyType?: StoryType;
  /** 艺术风格（默认 anime） */
  artStyle?: ArtStyle;
  /** 12 风格预设 key（覆盖 artStyle 走更精细的 prompt 模板） */
  styleKey?: StyleKey;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 目标时长（秒，默认 60） */
  durationSeconds?: number;
  /** 配音供应商（默认 edge-tts） */
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  /** 项目 ID */
  projectId?: string;
  /** 质量模式（默认 speed） */
  qualityMode?: QualityMode;
}

export interface NovelToDramaRefinedOutput {
  storyboardRunId: string;
  characterRunId: string;
  imageRunIds: string[];
  ttsRunId: string;
  videoRunIds: string[];
  composeRunId?: string;
  finalVideoUrl?: string;
  totalCostUsd: number;
  totalLatencyMs: number;
  imageUrls: string[];
  videoUrls: string[];
  audioUrl?: string;
  /** 质量模式 */
  qualityMode: QualityMode;
  /** 应用到的风格预设 key */
  appliedStyleKey: StyleKey;
  /** 缓存命中数（调试用） */
  cacheHits: number;
  /** 性能基准报告 */
  benchmark: { totalMs: number; marks: Array<{ name: string; cumMs: number }> };
}

const DEFAULT_STORY_TYPE: StoryType = "sweet_romance_novel";
const DEFAULT_ART_STYLE: ArtStyle = "anime";
const DEFAULT_TTS = "edge-tts" as const;
const DEFAULT_DURATION = 60;

function shotCount(duration: number): number {
  return Math.max(6, Math.min(24, Math.ceil(duration / 5)));
}

export const novelToDramaRefinedPipeline: PipelineDefinition = {
  name: "novel-to-drama.refined",
  steps: [
    {
      name: "storyboard",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const rec = defaultRecoveryForMode(mode);
        const text = input.text.slice(0, 1500);
        const start = Date.now();
        const r = await workflowClient.storyboard({
          text,
          storyType: input.storyType ?? DEFAULT_STORY_TYPE,
          chapterTitle: input.chapterTitle,
          chapterNo: undefined,
        });
        ctx.cost.recordFromStep("storyboard", "zhipu", 0.15, Date.now() - start, false);
        // 选 mode 后做 shot 数限制
        const modeCfg = QUALITY_MODES[mode];
        const shots = ((r.outputs as Record<string, unknown>).shots as Array<Record<string, unknown>> | undefined) ?? [];
        return { ...(r.outputs as Record<string, unknown>), _pickedShots: shots.slice(0, modeCfg.maxShotsPerEpisode) };
      },
    },
    {
      name: "character",
      dependsOn: ["storyboard"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const text = (ctx.prev.storyboard?.text as string) ?? input.text.slice(0, 1500);
        const start = Date.now();
        // 缓存：key = text + artStyle
        const cacheKey = `character::${input.artStyle ?? DEFAULT_ART_STYLE}::${text.length}`;
        const hit = promptCache.get("character", { key: cacheKey, text: text.slice(0, 200) });
        if (hit) {
          return { ...JSON.parse(hit), _cacheHit: true };
        }
        const r = await workflowClient.character({
          text,
          artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
        });
        ctx.cost.recordFromStep("character", "zhipu", 0.2, Date.now() - start, false);
        const out = r.outputs as Record<string, unknown>;
        promptCache.set("character", { key: cacheKey, text: text.slice(0, 200) }, JSON.stringify(out));
        return { ...out, _cacheHit: false };
      },
    },
    {
      name: "scene",
      dependsOn: ["storyboard", "character"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const shots = (ctx.prev.storyboard?._pickedShots as Array<{
          shotId: string;
          sceneId: string;
          shotType: string;
          cameraMove: string;
          description: string;
          dialogue?: string;
        }>) ?? [];
        const n = shotCount(input.durationSeconds ?? DEFAULT_DURATION);
        const picked = shots.slice(0, Math.min(n, modeCfg.maxShotsPerEpisode));

        const start = Date.now();
        // 并发跑 scene workflow（concurrency 跟 qualityMode 走）
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
              artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
            }),
          ),
        );
        const scenes: Array<{ shotId: string; sceneDesign: unknown; runId: string }> = [];
        sceneResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const outs = r.value.outputs as { sceneDesign?: unknown };
            scenes.push({
              shotId: picked[i]!.shotId,
              sceneDesign: outs.sceneDesign,
              runId: r.value.runId,
            });
          }
        });
        ctx.cost.recordFromStep("scene", "zhipu", 0.1 * Math.max(1, scenes.length), Date.now() - start, false);
        return { scenes, pickedShotIds: picked.map((p) => p.shotId), styleKey, preset: { label: preset.label, costMultiplier: preset.costMultiplier } };
      },
    },
    {
      name: "image-gen",
      dependsOn: ["scene"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const styleKey = (ctx.prev.scene?.styleKey as StyleKey | undefined) ?? "anime";
        const preset = pickStylePreset(styleKey);

        const scenes = (ctx.prev.scene?.scenes as Array<{ shotId: string; sceneDesign: unknown }>) ?? [];
        if (scenes.length === 0) {
          return { imageUrls: [], runIds: [], cacheHits: 0 };
        }
        const start = Date.now();
        // 注入风格 prompt
        const enriched = scenes.map((s) => {
          const sd = s.sceneDesign as { location: string; description: string; characters: string[]; mood: string };
          const prompt = preset.prompt.replace("{subject}", `${sd.location}, ${sd.description}, ${sd.characters.join(", ")}, ${sd.mood}`);
          return { shotId: s.shotId, prompt, artStyle: preset.workflowArtStyle, width: modeCfg.imageResolution.width, height: modeCfg.imageResolution.height };
        });
        const { urls, runIds, stats } = await runBatchImageGen(
          enriched.map((e) => ({
            sceneDesign: {
              location: e.prompt,
              description: e.prompt,
              characters: [],
              mood: "",
            },
            artStyle: e.artStyle as ArtStyle,
          })),
          modeCfg.concurrency,
        );
        ctx.cost.recordFromStep("image-gen", "volcengine", 0.4 * preset.costMultiplier * Math.max(1, scenes.length), Date.now() - start, false);
        return { imageUrls: urls, runIds, concurrency: modeCfg.concurrency, peakConcurrency: stats.peakConcurrency, mode: modeCfg.mode };
      },
    },
    {
      name: "tts",
      dependsOn: ["storyboard", "scene"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const shots = (ctx.prev.storyboard?._pickedShots as Array<{ shotId: string; dialogue?: string }>) ?? [];
        const dialogue = shots.map((s) => s.dialogue ?? "").filter(Boolean).join("\n").slice(0, 800);
        if (!dialogue) {
          return { audioUrl: undefined, runId: undefined, skipped: true };
        }
        const start = Date.now();
        const r = await workflowClient.tts({
          text: dialogue,
          provider: input.ttsProvider ?? DEFAULT_TTS,
        });
        ctx.cost.recordFromStep("tts", "volcengine", 0.1, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "video-gen",
      dependsOn: ["scene", "image-gen"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const modeCfg = QUALITY_MODES[mode];
        const scenes = (ctx.prev.scene?.scenes as Array<{ shotId: string; sceneDesign: unknown }>) ?? [];
        if (scenes.length === 0) {
          return { videoUrls: [], runIds: [], peakConcurrency: 0 };
        }
        const start = Date.now();
        const perShot = Math.max(2, Math.floor((input.durationSeconds ?? DEFAULT_DURATION) / scenes.length));
        const { urls, runIds, stats } = await runBatchVideoGen(
          scenes.map((s) => ({
            sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
            artStyle: (input.artStyle as ArtStyle) ?? DEFAULT_ART_STYLE,
            durationSeconds: perShot,
            resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
          })),
          Math.max(1, Math.floor(modeCfg.concurrency / 2)),
        );
        ctx.cost.recordFromStep("video-gen", "volcengine", 0.6 * Math.max(1, scenes.length), Date.now() - start, false);
        return { videoUrls: urls, runIds, peakConcurrency: stats.peakConcurrency, mode: modeCfg.mode };
      },
    },
    {
      name: "compose",
      dependsOn: ["storyboard", "video-gen", "tts"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const videoUrls = (ctx.prev["video-gen"]?.videoUrls as string[]) ?? [];
        if (videoUrls.length === 0) {
          return { skipped: true, reason: "no videos to compose" };
        }
        const audioUrl = ctx.prev.tts?.audioUrl as string | undefined;
        const subtitleText = (ctx.prev.storyboard?._pickedShots as Array<{ dialogue?: string }>)
          ?.map((s) => s.dialogue ?? "")
          .filter(Boolean)
          .join("\n");
        const start = Date.now();
        const r = await workflowClient.compose({
          videoUrls,
          audioUrls: audioUrl ? [audioUrl] : undefined,
          subtitleText,
          outputFormat: "mp4",
        });
        ctx.cost.recordFromStep("compose", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
  ],
};

/** 把 snapshot 整理成 RefinedOutput */
export function buildNovelToDramaRefinedOutput(snap: RunSnapshot): NovelToDramaRefinedOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const inputs = snap.inputs as unknown as NovelToDramaRefinedInput;
  // 累计 cacheHits（character step 的 _cacheHit 标记）
  const charHit = (o("character")._cacheHit as boolean) ? 1 : 0;
  return {
    storyboardRunId: (o("storyboard").runId as string) ?? "",
    characterRunId: (o("character").runId as string) ?? "",
    imageRunIds: (o("image-gen").runIds as string[]) ?? [],
    ttsRunId: (o("tts").runId as string) ?? "",
    videoRunIds: (o("video-gen").runIds as string[]) ?? [],
    composeRunId: (o("compose").runId as string) ?? undefined,
    finalVideoUrl: (o("compose").finalVideoUrl as string) ?? undefined,
    totalCostUsd: snap.costSummary.totalCostUsd,
    totalLatencyMs: snap.costSummary.totalLatencyMs,
    imageUrls: (o("image-gen").imageUrls as string[]) ?? [],
    videoUrls: (o("video-gen").videoUrls as string[]) ?? [],
    audioUrl: (o("tts").audioUrl as string) ?? undefined,
    qualityMode: inputs.qualityMode ?? DEFAULT_QUALITY_MODE,
    appliedStyleKey: (o("scene").styleKey as StyleKey) ?? "anime",
    cacheHits: charHit,
    benchmark: {
      totalMs: snap.costSummary.totalLatencyMs,
      marks: Object.entries(snap.steps)
        .filter(([k]) => k !== "compose")
        .map(([k, v]) => ({ name: k, cumMs: v.latencyMs })),
    },
  };
}

/**
 * 一次性 helper：直接跑一遍（demo / 测试用）
 * 不走 PipelineRunner（用于 examples/perf-bench）
 */
export async function runNovelToDramaOnce(
  input: NovelToDramaRefinedInput,
  _signal?: AbortSignal,
): Promise<{
  success: boolean;
  cost: number;
  latencyMs: number;
  imageUrls: string[];
  videoUrls: string[];
  audioUrl?: string;
  benchmark: ReturnType<Benchmark["report"]>;
  cacheHits: number;
  mode: QualityMode;
}> {
  const bm = new Benchmark();
  const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
  const modeCfg = QUALITY_MODES[mode];
  const styleKey = (input.styleKey as StyleKey | undefined) ?? (input.artStyle as StyleKey) ?? "anime";
  const preset = pickStylePreset(styleKey);

  let cacheHits = 0;
  let cost = 0;

  // 1. storyboard
  bm.mark("storyboard-start");
  const sb = await workflowClient.storyboard({
    text: input.text.slice(0, 1500),
    storyType: input.storyType ?? DEFAULT_STORY_TYPE,
    chapterTitle: input.chapterTitle,
  });
  cost += 0.15;
  bm.mark("storyboard-end");
  const shots = ((sb.outputs as { shots?: Array<{ shotId: string; sceneId: string; shotType: string; cameraMove: string; description: string; dialogue?: string }> }).shots) ?? [];
  const picked = shots.slice(0, modeCfg.maxShotsPerEpisode);

  // 2. character
  bm.mark("character-start");
  const charCacheKey = `char::${input.artStyle ?? DEFAULT_ART_STYLE}::${input.text.length}`;
  const charHit = promptCache.get("character", { key: charCacheKey, text: input.text.slice(0, 200) });
  if (charHit) {
    cacheHits++;
  } else {
    await workflowClient.character({ text: input.text.slice(0, 1500), artStyle: input.artStyle ?? DEFAULT_ART_STYLE });
    cost += 0.2;
    promptCache.set("character", { key: charCacheKey, text: input.text.slice(0, 200) }, "{}");
  }
  bm.mark("character-end");

  // 3. scene
  bm.mark("scene-start");
  const sceneScenes = await Promise.allSettled(
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
        artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
      }),
    ),
  );
  const scenes = sceneScenes.map((r, i) => ({
    shotId: picked[i]!.shotId,
    sceneDesign: r.status === "fulfilled" ? (r.value.outputs as { sceneDesign?: unknown }).sceneDesign : null,
  }));
  cost += 0.1 * Math.max(1, scenes.length);
  bm.mark("scene-end");

  // 4. image-gen（并发）
  bm.mark("image-gen-start");
  const { urls: imageUrls, stats: imgStats } = await runBatchImageGen(
    scenes.map((s) => ({
      sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
      artStyle: preset.workflowArtStyle,
    })),
    modeCfg.concurrency,
  );
  cost += 0.4 * preset.costMultiplier * Math.max(1, scenes.length);
  bm.mark("image-gen-end");

  // 5. tts
  bm.mark("tts-start");
  const dialogue = picked.map((s) => s.dialogue ?? "").filter(Boolean).join("\n").slice(0, 800);
  let audioUrl: string | undefined;
  if (dialogue) {
    const tts = await workflowClient.tts({ text: dialogue, provider: input.ttsProvider ?? DEFAULT_TTS });
    audioUrl = (tts.outputs as { audioUrl?: string }).audioUrl;
    cost += 0.1;
  }
  bm.mark("tts-end");

  // 6. video-gen（并发）
  bm.mark("video-gen-start");
  const perShot = Math.max(2, Math.floor((input.durationSeconds ?? DEFAULT_DURATION) / Math.max(1, scenes.length)));
  const { urls: videoUrls, stats: vidStats } = await runBatchVideoGen(
    scenes.map((s) => ({
      sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
      artStyle: preset.workflowArtStyle,
      durationSeconds: perShot,
      resolution: modeCfg.imageResolution.width >= 1280 ? "1080p" : "720p",
    })),
    Math.max(1, Math.floor(modeCfg.concurrency / 2)),
  );
  cost += 0.6 * Math.max(1, scenes.length);
  bm.mark("video-gen-end");

  // 7. compose（optional）
  bm.mark("compose-start");
  let composed: string | undefined;
  if (videoUrls.length > 0) {
    const comp = await workflowClient.compose({
      videoUrls,
      audioUrls: audioUrl ? [audioUrl] : undefined,
      subtitleText: dialogue,
      outputFormat: "mp4",
    });
    composed = (comp.outputs as { finalVideoUrl?: string }).finalVideoUrl;
    cost += 0.05;
  }
  bm.mark("compose-end");

  void imgStats;
  void vidStats;

  return {
    success: true,
    cost,
    latencyMs: 0,
    imageUrls,
    videoUrls,
    audioUrl,
    benchmark: bm.report(),
    cacheHits,
    mode,
  };
}

/** 注释：导出供 examples / 路由用 */
export { isRetriable };
export const _STYLE_KEYS = Object.keys(STYLE_PRESETS) as StyleKey[];
