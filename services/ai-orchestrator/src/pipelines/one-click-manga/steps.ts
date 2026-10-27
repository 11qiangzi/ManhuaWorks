/**
 * one-click-manga 步骤运行器
 * 每个函数对应 pipeline 的一个步骤，从 one-click-manga.ts 拆出
 */
import type { StepContext } from "../../pipeline-runner.js";
import { workflowClient } from "../../clients/workflow.js";
import { aiRouterClient } from "../../clients/ai-router.js";
import { aiHelperClient } from "../../clients/ai-helper.js";
import { assetClient, type AssetKind } from "../../clients/asset.js";
import { emitStepCompleted, emitStepFailed } from "../job-events.js";
import {
  type OneClickMangaInput,
  DEFAULT_STORY_TYPE, DEFAULT_ART_STYLE, DEFAULT_DURATION, DEFAULT_EPISODE_COUNT,
  STEP_NAMES, progressPct, MAX_INPUT_MEDIUM, MAX_INPUT_FULL,
  MAX_INPUT_CHAR_FRAGMENT, MAX_TTS_DIALOGUE, MAX_INPUT_SNIPPET,
  MAX_SHOTS_PER_STEP, mapMoodToMusicStyle,
} from "./constants.js";

// ---- 辅助函数 ----

async function saveAsset(
  projectId: string | undefined,
  kind: AssetKind,
  payload: Record<string, unknown>,
  tags: string[] = [],
): Promise<string | undefined> {
  if (!projectId) return undefined;
  try {
    const r = await assetClient.create({ kind, projectId, payload, tags });
    return r.asset.id;
  } catch (err) {
    process.stderr.write(`[one-click-manga] asset save failed kind=${kind}: ${(err as Error).message}\n`);
    return undefined;
  }
}

function getJobId(ctx: StepContext): string {
  return (ctx.inputs as Record<string, unknown>)._jobId as string ?? "";
}

// ===================================================================
// Step 1: novel-to-drama
// ===================================================================
export async function step1NovelToDrama(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const text = input.text.slice(0, MAX_INPUT_MEDIUM);
  const storyType = input.storyType ?? DEFAULT_STORY_TYPE;
  const artStyle = input.artStyle ?? DEFAULT_ART_STYLE;
  const start = Date.now();

  const sb = await workflowClient.storyboard({ text, storyType, chapterTitle: undefined, chapterNo: undefined });
  const shots = (sb.outputs as { shots?: Array<Record<string, unknown>> }).shots ?? [];
  const ch = await workflowClient.character({ text, artStyle });
  const characters = (ch.outputs as { characters?: Array<{ name: string }> }).characters ?? [];
  const picked = shots.slice(0, MAX_SHOTS_PER_STEP);
  const scenes: unknown[] = [];
  for (const shot of picked) {
    const s = shot as Record<string, unknown>;
    const sc = await workflowClient.scene({ shot: { shotId: (s.shotId as string) ?? `s${scenes.length}`, sceneId: (s.sceneId as string) ?? `sc${scenes.length}`, shotType: (s.shotType as string) ?? "MS", cameraMove: (s.cameraMove as string) ?? "static", description: (s.description as string) ?? "", dialogue: (s.dialogue as string) ?? "" }, artStyle });
    scenes.push((sc.outputs as Record<string, unknown>).sceneDesign);
  }
  const imageUrls: string[] = [];
  for (const sd of scenes) {
    const ig = await workflowClient.imageGen({ sceneDesign: sd as { location: string; description: string; characters: string[]; mood: string }, artStyle });
    const outs = ig.outputs as { urls?: string[] };
    if (outs.urls) imageUrls.push(...outs.urls);
  }
  const dialogue = shots.map((s) => (s as Record<string, unknown>).dialogue ?? "").filter(Boolean).join("\n").slice(0, MAX_TTS_DIALOGUE);
  let audioUrl: string | undefined;
  if (dialogue) {
    const t = await workflowClient.tts({ text: dialogue, provider: input.ttsProvider ?? "edge-tts" });
    audioUrl = (t.outputs as { audioUrl?: string }).audioUrl;
  }
  const videoUrls: string[] = [];
  const perShot = Math.max(2, Math.floor((input.durationSeconds ?? DEFAULT_DURATION) / Math.max(1, scenes.length)));
  for (const sd of scenes) {
    const vg = await workflowClient.videoGen({ sceneDesign: sd as { location: string; description: string; characters: string[]; mood: string }, artStyle, durationSeconds: perShot, resolution: "720p" });
    const u = (vg.outputs as { url?: string }).url;
    if (u) videoUrls.push(u);
  }
  ctx.cost.recordFromStep("step-1-novel-to-drama", "volcengine", 1.2, Date.now() - start, false);
  const charNames = characters.map((c) => (c as { name: string }).name);
  await saveAsset(input.projectId, "drama", { shots: picked, characters: charNames, imageUrls, videoUrls, audioUrl }, ["pipeline", "step-1"]);
  emitStepCompleted(getJobId(ctx), 1, STEP_NAMES[1], progressPct(1), imageUrls[0]);
  return { shots, characters, charNames, scenes, imageUrls, videoUrls, audioUrl, storyboardRunId: sb.runId, characterRunId: ch.runId };
}

// ===================================================================
// Step 2: character-extract
// ===================================================================
export async function step2CharacterExtract(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const artStyle = input.artStyle ?? DEFAULT_ART_STYLE;
  const out1 = ctx.prev["step-1-novel-to-drama"] ?? {};
  const charNames = (out1.charNames as string[]) ?? [];
  const text = input.text.slice(0, MAX_INPUT_MEDIUM);
  const start = Date.now();
  const charResults: Array<{ name: string; imageUrls: string[]; description: string }> = [];
  for (const name of charNames) {
    const ch = await workflowClient.character({ text: `${name}: ${text.slice(0, MAX_INPUT_CHAR_FRAGMENT)}`, artStyle, characterHints: [name] });
    const outs = ch.outputs as { imageUrls?: string[]; description?: string };
    charResults.push({ name, imageUrls: outs.imageUrls ?? [], description: outs.description ?? "" });
  }
  ctx.cost.recordFromStep("step-2-character-extract", "volcengine", 0.3 * Math.max(1, charNames.length), Date.now() - start, false);
  await saveAsset(input.projectId, "character", { characters: charResults, sourceText: text.slice(0, MAX_INPUT_SNIPPET) }, ["pipeline", "step-2"]);
  const firstImage = charResults.find((c) => c.imageUrls.length > 0)?.imageUrls[0];
  emitStepCompleted(getJobId(ctx), 2, STEP_NAMES[2], progressPct(2), firstImage);
  return { characters: charResults, charNames };
}

// ===================================================================
// Step 3: style-analysis
// ===================================================================
export async function step3StyleAnalysis(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const text = input.text.slice(0, MAX_INPUT_FULL);
  const start = Date.now();
  const r = await aiHelperClient.rewrite({ text: `从以下小说片段中分析其艺术风格和情绪基调，只输出JSON: { "mood": "xxx", "suggestedStyle": "xxx", "description": "xxx" }\n\n${text}`, instruction: "分析艺术风格并返回JSON" });
  const styleData = (r as { data?: string }).data ?? "";
  let parsed: { mood?: string; suggestedStyle?: string; description?: string };
  try { parsed = JSON.parse(styleData); } catch { parsed = { mood: "neutral", suggestedStyle: input.artStyle ?? DEFAULT_ART_STYLE, description: styleData.slice(0, MAX_INPUT_SNIPPET) }; }
  ctx.cost.recordFromStep("step-3-style-analysis", "zhipu", 0.1, Date.now() - start, false);
  await saveAsset(input.projectId, "scene", { styleAnalysis: parsed, artStyle: input.artStyle ?? DEFAULT_ART_STYLE }, ["pipeline", "step-3"]);
  emitStepCompleted(getJobId(ctx), 3, STEP_NAMES[3], progressPct(3));
  return { styleAnalysis: parsed };
}

// ===================================================================
// Step 4: decompose
// ===================================================================
export async function step4Decompose(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const text = input.text.slice(0, MAX_INPUT_FULL);
  const storyType = input.storyType ?? DEFAULT_STORY_TYPE;
  const artStyle = input.artStyle ?? DEFAULT_ART_STYLE;
  const start = Date.now();
  const beats = await workflowClient.beatSplit({ text, storyType, chapterTitle: undefined });
  const n = Math.max(6, Math.min(24, Math.ceil((input.durationSeconds ?? DEFAULT_DURATION) / 5)));
  const beatList = (beats.outputs as { beats?: Array<{ beatId: string; type: string; description: string; duration: number }> }).beats ?? [];
  const shots = await workflowClient.shotCompose({ beats: beatList, targetShotCount: n, artStyle });
  const sb = await workflowClient.storyboard({ text: text.slice(0, MAX_INPUT_MEDIUM), storyType, chapterTitle: undefined, chapterNo: undefined });
  const finalShots = (shots.outputs as { shots?: Array<Record<string, unknown>> }).shots ?? [];
  ctx.cost.recordFromStep("step-4-decompose", "zhipu", 0.45, Date.now() - start, false);
  await saveAsset(input.projectId, "storyboard", { beats: beatList, shots: finalShots }, ["pipeline", "step-4"]);
  emitStepCompleted(getJobId(ctx), 4, STEP_NAMES[4], progressPct(4));
  return { beats: beatList, shots: finalShots, shotCount: finalShots.length };
}

// ===================================================================
// Step 5: image-batch
// ===================================================================
export async function step5ImageBatch(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const artStyle = input.artStyle ?? DEFAULT_ART_STYLE;
  const shots = (ctx.prev["step-4-decompose"]?.shots as Array<Record<string, unknown>>) ?? [];
  if (shots.length === 0) {
    emitStepCompleted(getJobId(ctx), 5, STEP_NAMES[5], progressPct(5));
    return { imageUrls: [], shotCount: 0, skipped: true };
  }
  const start = Date.now();
  const urls: string[] = [];
  const perEpisode = input.episodeCount ?? DEFAULT_EPISODE_COUNT;
  const batchSize = Math.ceil(shots.length / Math.max(1, perEpisode));
  for (let batch = 0; batch < Math.min(perEpisode, Math.ceil(shots.length / batchSize)); batch++) {
    const batchShots = shots.slice(batch * batchSize, (batch + 1) * batchSize);
    for (const shot of batchShots) {
      const s = shot as Record<string, unknown>;
      const ig = await workflowClient.imageGen({ sceneDesign: { location: (s.location as string) ?? "unknown", description: (s.description as string) ?? "", characters: (s.characters as string[]) ?? [], mood: (s.mood as string) ?? "neutral" }, artStyle });
      const outs = ig.outputs as { urls?: string[] };
      if (outs.urls) urls.push(...outs.urls);
    }
  }
  ctx.cost.recordFromStep("step-5-image-batch", "volcengine", 0.4 * Math.max(1, shots.length), Date.now() - start, false);
  await saveAsset(input.projectId, "image", { imageUrls: urls, shotCount: shots.length }, ["pipeline", "step-5"]);
  emitStepCompleted(getJobId(ctx), 5, STEP_NAMES[5], progressPct(5), urls[0]);
  return { imageUrls: urls, shotCount: shots.length };
}

// ===================================================================
// Step 6: compose-video
// ===================================================================
export async function step6ComposeVideo(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const artStyle = input.artStyle ?? DEFAULT_ART_STYLE;
  const imageUrls = (ctx.prev["step-5-image-batch"]?.imageUrls as string[]) ?? [];
  const shots = (ctx.prev["step-4-decompose"]?.shots as Array<Record<string, unknown>>) ?? [];
  const audioUrl = ctx.prev["step-1-novel-to-drama"]?.audioUrl as string | undefined;
  if (imageUrls.length === 0) {
    emitStepCompleted(getJobId(ctx), 6, STEP_NAMES[6], progressPct(6));
    return { videoUrl: undefined, skipped: true, reason: "no images" };
  }
  const start = Date.now();
  const segmentUrls: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const shot = shots[i] as Record<string, unknown> | undefined;
    const vg = await workflowClient.videoGen({ sceneDesign: { location: (shot?.description as string) ?? "scene", description: (shot?.description as string) ?? "", characters: [], mood: "neutral" }, artStyle, durationSeconds: 5, resolution: "720p", sourceImageUrl: imageUrls[i] });
    const u = (vg.outputs as { url?: string }).url;
    if (u) segmentUrls.push(u);
  }
  let finalVideoUrl: string | undefined;
  if (segmentUrls.length > 0) {
    try {
      const compose = await workflowClient.compose({ videoUrls: segmentUrls, audioUrls: audioUrl ? [audioUrl] : undefined, outputFormat: "mp4", transitions: { type: "fade", duration: 0.5 } });
      finalVideoUrl = (compose.outputs as { finalVideoUrl?: string }).finalVideoUrl;
    } catch (err) { process.stderr.write(`[one-click-manga] compose failed: ${(err as Error).message}\n`); }
  }
  ctx.cost.recordFromStep("step-6-compose-video", "volcengine", 0.6 * Math.max(1, imageUrls.length), Date.now() - start, false);
  await saveAsset(input.projectId, "video", { finalVideoUrl, segmentUrls, imageCount: imageUrls.length }, ["pipeline", "step-6"]);
  emitStepCompleted(getJobId(ctx), 6, STEP_NAMES[6], progressPct(6), finalVideoUrl);
  return { finalVideoUrl, segmentUrls, segmentCount: segmentUrls.length };
}

// ===================================================================
// Step 7: auto-music
// ===================================================================
export async function step7AutoMusic(ctx: StepContext) {
  const input = ctx.inputs as unknown as OneClickMangaInput;
  const styleAnalysis = ctx.prev["step-3-style-analysis"]?.styleAnalysis as { mood?: string; description?: string } | undefined;
  const mood = styleAnalysis?.mood ?? "neutral";
  const sceneDesc = styleAnalysis?.description ?? input.text.slice(0, MAX_INPUT_CHAR_FRAGMENT);
  const start = Date.now();
  try {
    const r = await aiRouterClient.audio({ prompt: `场景：${sceneDesc}`, mood, style: input.musicStyle ?? mapMoodToMusicStyle(mood), durationSeconds: input.durationSeconds ?? DEFAULT_DURATION, taskTag: "one-click-manga" }, ctx.signal);
    ctx.cost.recordFromStep("step-7-auto-music", r.provider, r.cost, Date.now() - start, false);
    await saveAsset(input.projectId, "audio", { musicUrl: r.url, durationSeconds: r.durationSeconds, provider: r.provider, mood }, ["pipeline", "step-7"]);
    emitStepCompleted(getJobId(ctx), 7, STEP_NAMES[7], 100, r.url);
    return { musicUrl: r.url, durationSeconds: r.durationSeconds, provider: r.provider, model: r.model };
  } catch (err) {
    process.stderr.write(`[one-click-manga] auto-music failed: ${(err as Error).message}\n`);
    emitStepFailed(getJobId(ctx), 7, STEP_NAMES[7], (err as Error).message, true);
    emitStepCompleted(getJobId(ctx), 7, STEP_NAMES[7], 100);
    return { musicUrl: undefined, skipped: true, error: (err as Error).message };
  }
}
