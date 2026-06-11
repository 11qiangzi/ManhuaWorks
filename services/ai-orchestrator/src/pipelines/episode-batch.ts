/**
 * Pipeline 2：episode-batch
 * 1 章小说 → 自动拆 10 集 → 每集跑 novel-to-drama 子流水线
 *
 * 设计：
 *   - step "split"：按段落/标点切分长文为 N 段（默认 10 段）
 *   - step "for each segment"：对每段调 novelToDramaPipeline（嵌套 run）
 *
 * 为简单实现，"for each" 写成单步：每段串行跑完整 7 步子流水线
 * （生产可并发，但为了计费/quota 透明，串行更易管理）。
 */

import type { PipelineDefinition, StepContext } from "../pipeline-runner.js";
import { aiHelperClient } from "../clients/ai-helper.js";
import { workflowClient, type ArtStyle, type StoryType } from "../clients/workflow.js";
import type { NovelToDramaInput } from "./novel-to-drama.js";

export interface EpisodeBatchInput {
  /** 完整章节文本（建议 3000-15000 字） */
  text: string;
  /** 章节标题 */
  chapterTitle?: string;
  /** 集数（默认 10） */
  episodeCount?: number;
  /** 每集时长（默认 60s） */
  perEpisodeDurationSeconds?: number;
  /** 剧情类型 */
  storyType?: StoryType;
  /** 艺术风格 */
  artStyle?: ArtStyle;
  /** 配音供应商 */
  ttsProvider?: NovelToDramaInput["ttsProvider"];
  /** 项目 ID */
  projectId?: string;
}

export interface EpisodeInfo {
  episodeNo: number;
  title: string;
  text: string;
  storyboardRunId: string;
  characterRunId: string;
  imageUrls: string[];
  videoUrls: string[];
  costUsd: number;
  latencyMs: number;
}

export interface EpisodeBatchOutput {
  episodes: EpisodeInfo[];
  totalCostUsd: number;
  totalLatencyMs: number;
  projectId?: string;
}

const DEFAULT_EPISODE_COUNT = 10;
const DEFAULT_PER_EPISODE_DURATION = 60;

export const episodeBatchPipeline: PipelineDefinition = {
  name: "episode-batch",
  steps: [
    {
      name: "split",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as EpisodeBatchInput;
        const n = input.episodeCount ?? DEFAULT_EPISODE_COUNT;
        const start = Date.now();
        const r = await aiHelperClient.suggestShots({
          text: input.text,
          shotCount: n,
        });
        ctx.cost.recordFromStep("split", "zhipu", 0.1, Date.now() - start, false);
        // suggestShots 返回的每条 description 当成"剧情边界"，用 paragraph split 兜底
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
        const input = ctx.inputs as unknown as EpisodeBatchInput;
        const segs = (ctx.prev.split?.segments as Array<{ episodeNo: number; title: string; text: string }>) ?? [];
        const episodes: EpisodeInfo[] = [];
        let totalCost = 0;
        let totalLat = 0;

        for (const seg of segs) {
          const epStart = Date.now();
          // 子流水线内联：storyboard → character → scene → image → tts → video → compose
          const epInfo = await runOneEpisode(seg, input);
          const epCost = epInfo.costUsd;
          const epLat = Date.now() - epStart;
          totalCost += epCost;
          totalLat += epLat;
          episodes.push(epInfo);
          ctx.cost.recordFromStep("for-each", null, epCost, epLat, false);
        }

        return { episodes, totalCostUsd: totalCost, totalLatencyMs: totalLat };
      },
    },
  ],
};

async function runOneEpisode(
  seg: { episodeNo: number; title: string; text: string },
  input: EpisodeBatchInput,
): Promise<EpisodeInfo> {
  const text = seg.text.slice(0, 1500);
  const artStyle = input.artStyle ?? "anime";
  const storyType = input.storyType ?? "sweet_romance_novel";
  let costUsd = 0;

  // 1. storyboard
  const sb = await workflowClient.storyboard({ text, storyType, chapterTitle: seg.title, chapterNo: seg.episodeNo });
  costUsd += 0.15;
  const shots = (sb.outputs as { shots?: Array<Record<string, unknown>> }).shots ?? [];
  const dialogue = shots.map((s) => s.dialogue ?? "").filter(Boolean).join("\n").slice(0, 600);

  // 2. character
  const ch = await workflowClient.character({ text, artStyle });
  costUsd += 0.2;

  // 3. scene
  const picked = shots.slice(0, 6);
  const scenes: Array<unknown> = [];
  for (const shot of picked) {
    const s = shot as Record<string, unknown>;
    const sc = await workflowClient.scene({
      shot: {
        shotId: (s.shotId as string) ?? `s${scenes.length}`,
        sceneId: (s.sceneId as string) ?? `sc${scenes.length}`,
        shotType: (s.shotType as string) ?? "MS",
        cameraMove: (s.cameraMove as string) ?? "static",
        description: (s.description as string) ?? "",
        dialogue: (s.dialogue as string) ?? "",
      },
      artStyle,
    });
    scenes.push((sc.outputs as Record<string, unknown>).sceneDesign);
  }
  costUsd += 0.1 * Math.max(1, scenes.length);

  // 4. image-gen
  const imageUrls: string[] = [];
  for (const sd of scenes) {
    const ig = await workflowClient.imageGen({
      sceneDesign: sd as { location: string; description: string; characters: string[]; mood: string },
      artStyle,
    });
    const outs = ig.outputs as { urls?: string[] };
    if (outs.urls) imageUrls.push(...outs.urls);
  }
  costUsd += 0.4 * Math.max(1, scenes.length);

  // 5. tts
  let audioUrl: string | undefined;
  if (dialogue) {
    const t = await workflowClient.tts({ text: dialogue, provider: input.ttsProvider ?? "edge-tts" });
    audioUrl = (t.outputs as { audioUrl?: string }).audioUrl;
    costUsd += 0.1;
  }

  // 6. video-gen
  const videoUrls: string[] = [];
  const perShot = Math.max(2, Math.floor((input.perEpisodeDurationSeconds ?? DEFAULT_PER_EPISODE_DURATION) / Math.max(1, scenes.length)));
  for (const sd of scenes) {
    const vg = await workflowClient.videoGen({
      sceneDesign: sd as { location: string; description: string; characters: string[]; mood: string },
      artStyle,
      durationSeconds: perShot,
      resolution: "720p",
    });
    const u = (vg.outputs as { url?: string }).url;
    if (u) videoUrls.push(u);
  }
  costUsd += 0.6 * Math.max(1, scenes.length);

  return {
    episodeNo: seg.episodeNo,
    title: seg.title,
    text: seg.text,
    storyboardRunId: sb.runId,
    characterRunId: ch.runId,
    imageUrls,
    videoUrls,
    costUsd,
    latencyMs: 0, // 由外层累计
  };
}

/** 兜底：按段落/句号切分为 N 段 */
function splitByParagraphs(text: string, n: number): string[] {
  // 先按空行切
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return [text];
  if (paras.length <= n) return paras;

  // 把段落聚合到 N 段（按字符数尽量均分）
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

export function buildEpisodeBatchOutput(snap: import("../pipeline-runner.js").RunSnapshot): EpisodeBatchOutput {
  const o = snap.steps["for-each"]?.outputs ?? {};
  return {
    episodes: (o.episodes as EpisodeInfo[]) ?? [],
    totalCostUsd: (o.totalCostUsd as number) ?? snap.costSummary.totalCostUsd,
    totalLatencyMs: (o.totalLatencyMs as number) ?? snap.costSummary.totalLatencyMs,
    projectId: (snap.inputs.projectId as string) ?? undefined,
  };
}
