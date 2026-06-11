/**
 * Pipeline 1：novel-to-drama
 * 粘贴小说 → 7 步骤 → 1 集 60s 漫剧
 *
 * 步骤：
 *   1. storyboard    文本 → 分镜列表（场景/镜头/对话）
 *   2. character     提取角色并生成形象描述
 *   3. scene         取前 N 个镜头生成场景设计
 *   4. image-gen     场景 → 出图
 *   5. tts           台词 → 配音
 *   6. video-gen     静帧 → 视频
 *   7. compose       视频+音频 → 合成
 */

import type { PipelineDefinition } from "../pipeline-runner.js";
import { workflowClient, type ArtStyle, type StoryType } from "../clients/workflow.js";
import type { StepContext } from "../pipeline-runner.js";

export interface NovelToDramaInput {
  /** 小说文本（一段即可；长文会自动截取前 1500 字） */
  text: string;
  /** 剧情类型（默认 sweet_romance_novel） */
  storyType?: StoryType;
  /** 艺术风格（默认 anime） */
  artStyle?: ArtStyle;
  /** 章节标题（可选） */
  chapterTitle?: string;
  /** 目标时长（秒，默认 60） */
  durationSeconds?: number;
  /** 配音供应商（默认 edge-tts，最便宜） */
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  /** 项目 ID（落 asset 用） */
  projectId?: string;
}

export interface NovelToDramaOutput {
  storyboardRunId: string;
  characterRunId: string;
  imageRunIds: string[];
  ttsRunId: string;
  videoRunIds: string[];
  composeRunId?: string;
  /** 最终视频 URL（如 compose 成功） */
  finalVideoUrl?: string;
  /** 总耗时 */
  totalCostUsd: number;
  totalLatencyMs: number;
  imageUrls: string[];
  videoUrls: string[];
  audioUrl?: string;
}

const DEFAULT_STORY_TYPE: StoryType = "sweet_romance_novel";
const DEFAULT_ART_STYLE: ArtStyle = "anime";
const DEFAULT_TTS = "edge-tts" as const;
const DEFAULT_DURATION = 60;

/** 1 集 60s 漫剧，镜头数 = duration / 5s/shot */
function shotCount(duration: number): number {
  return Math.max(6, Math.min(24, Math.ceil(duration / 5)));
}

export const novelToDramaPipeline: PipelineDefinition = {
  name: "novel-to-drama",
  steps: [
    {
      name: "storyboard",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const text = input.text.slice(0, 1500);
        const start = Date.now();
        const r = await workflowClient.storyboard({
          text,
          storyType: input.storyType ?? DEFAULT_STORY_TYPE,
          chapterTitle: input.chapterTitle,
          chapterNo: undefined,
        });
        ctx.cost.recordFromStep("storyboard", "zhipu", 0.15, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "character",
      dependsOn: ["storyboard"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const text = (ctx.prev.storyboard?.text as string) ?? input.text.slice(0, 1500);
        const start = Date.now();
        const r = await workflowClient.character({
          text,
          artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
        });
        ctx.cost.recordFromStep("character", "zhipu", 0.2, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "scene",
      dependsOn: ["storyboard", "character"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const shots = (ctx.prev.storyboard?.shots as Array<{
          shotId: string;
          sceneId: string;
          shotType: string;
          cameraMove: string;
          description: string;
          dialogue?: string;
        }>) ?? [];
        const n = shotCount(input.durationSeconds ?? DEFAULT_DURATION);
        const picked = shots.slice(0, n);
        // 串行调用 scene workflow（生产可并发）
        const out: Array<{ shotId: string; sceneDesign: unknown; runId: string }> = [];
        for (const shot of picked) {
          const r = await workflowClient.scene({
            shot: {
              shotId: shot.shotId,
              sceneId: shot.sceneId,
              shotType: shot.shotType,
              cameraMove: shot.cameraMove,
              description: shot.description,
              dialogue: shot.dialogue,
            },
            artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
          });
          out.push({ shotId: shot.shotId, sceneDesign: (r.outputs as Record<string, unknown>).sceneDesign, runId: r.runId });
        }
        ctx.cost.recordFromStep("scene", "zhipu", 0.1, 0, false);
        return { scenes: out, pickedShotIds: picked.map((p) => p.shotId) };
      },
    },
    {
      name: "image-gen",
      dependsOn: ["scene"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const scenes = (ctx.prev.scene?.scenes as Array<{ shotId: string; sceneDesign: unknown }>) ?? [];
        const start = Date.now();
        const urls: string[] = [];
        const runIds: string[] = [];
        for (const s of scenes) {
          const r = await workflowClient.imageGen({
            sceneDesign: s.sceneDesign as { location: string; description: string; characters: string[]; mood: string },
            artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
          });
          const outs = r.outputs as { urls?: string[] };
          if (outs.urls) urls.push(...outs.urls);
          runIds.push(r.runId);
        }
        ctx.cost.recordFromStep("image-gen", "volcengine", 0.4 * Math.max(1, scenes.length), Date.now() - start, false);
        return { imageUrls: urls, runIds };
      },
    },
    {
      name: "tts",
      dependsOn: ["storyboard", "scene"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const shots = (ctx.prev.storyboard?.shots as Array<{ shotId: string; dialogue?: string }>) ?? [];
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
        const input = ctx.inputs as unknown as NovelToDramaInput;
        const scenes = (ctx.prev.scene?.scenes as Array<{ shotId: string; sceneDesign: unknown }>) ?? [];
        const imageUrls = (ctx.prev["image-gen"]?.imageUrls as string[]) ?? [];
        const start = Date.now();
        const urls: string[] = [];
        const runIds: string[] = [];
        const perShot = Math.max(2, Math.floor((input.durationSeconds ?? DEFAULT_DURATION) / scenes.length));
        for (let i = 0; i < scenes.length; i++) {
          const r = await workflowClient.videoGen({
            sceneDesign: scenes[i].sceneDesign as { location: string; description: string; characters: string[]; mood: string },
            artStyle: input.artStyle ?? DEFAULT_ART_STYLE,
            durationSeconds: perShot,
            resolution: "720p",
          });
          const outs = r.outputs as { url?: string };
          if (outs.url) urls.push(outs.url);
          runIds.push(r.runId);
        }
        // imageUrls 与 videoUrls 数量可能不一致，做个兜底
        void imageUrls;
        ctx.cost.recordFromStep("video-gen", "volcengine", 0.6 * Math.max(1, scenes.length), Date.now() - start, false);
        return { videoUrls: urls, runIds };
      },
    },
    {
      name: "compose",
      dependsOn: ["storyboard", "video-gen", "tts"],
      retries: 0,
      optional: true, // compose 失败不影响"已有镜头视频"
      run: async (ctx: StepContext) => {
        const videoUrls = (ctx.prev["video-gen"]?.videoUrls as string[]) ?? [];
        if (videoUrls.length === 0) {
          return { skipped: true, reason: "no videos to compose" };
        }
        const audioUrl = ctx.prev.tts?.audioUrl as string | undefined;
        const subtitleText = (ctx.prev.storyboard?.shots as Array<{ dialogue?: string }>)
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

/** 把 snapshot 的 step outputs 整理成 NovelToDramaOutput（用于 HTTP 响应） */
export function buildNovelToDramaOutput(snap: import("../pipeline-runner.js").RunSnapshot): NovelToDramaOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
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
  };
}
