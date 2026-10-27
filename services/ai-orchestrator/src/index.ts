/**
 * ManhuaWorks ai-orchestrator 入口
 *
 * 端口 8087
 * 路由�? *   GET  /health
 *   POST /v1/orchestrate/novel-to-drama
 *   POST /v1/orchestrate/episode-batch
 *   POST /v1/orchestrate/style-transfer
 *   POST /v1/orchestrate/character-replace
 *   POST /v1/orchestrate/auto-translate
 *   GET  /v1/orchestrate/runs
 *   GET  /v1/orchestrate/runs/:runId
 *   POST /v1/orchestrate/runs/:runId/cancel
 *   POST /v1/orchestrate/runs/:runId/resume
 *   POST /v1/generation/submit
 *   GET  /v1/generation
 *   GET  /v1/generation/:taskId
 *   POST /v1/generation/:taskId/cancel
 *   POST /v1/craft-prompt/build
 *   GET  /v1/craft-prompt/camera-movements
 *   GET  /v1/craft-prompt/mood-presets
 *   GET  /v1/reference-images
 *   POST /v1/reference-images
 *   DELETE /v1/reference-images/:id
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { config } from "./config.js";
import { ErrorCodes } from "@manhuaworks/shared";
import { authMiddleware, requestIdMiddleware, loggerMiddleware, type AppEnv, requireUser } from "./middleware/auth.js";
import {
  PipelineRunner,
  snapshotStore,
  type PipelineDefinition,
  type RunSnapshot,
} from "./pipeline-runner.js";
import { COST_ESTIMATES, estimateCost } from "./quota.js";

import { novelToDramaPipeline, buildNovelToDramaOutput, type NovelToDramaInput } from "./pipelines/novel-to-drama.js";
import { episodeBatchPipeline, buildEpisodeBatchOutput, type EpisodeBatchInput } from "./pipelines/episode-batch.js";
import { styleTransferPipeline, buildStyleTransferOutput, type StyleTransferInput } from "./pipelines/style-transfer.js";
import { characterReplacePipeline, buildCharacterReplaceOutput, type CharacterReplaceInput } from "./pipelines/character-replace.js";
import { autoTranslatePipeline, buildAutoTranslateOutput, type AutoTranslateInput } from "./pipelines/auto-translate.js";
import { oneClickMangaPipeline, buildOneClickMangaOutput, type OneClickMangaInput } from "./pipelines/one-click-manga.js";
import { autoMusicPipeline, buildAutoMusicOutput, type AutoMusicInput } from "./pipelines/auto-music.js";
import { buildHealthChecker, type HealthReport } from "./health.js";
import { buildOrchestratorServer, getJobStore, listTypes, getBinding, installWebSocketUpgrade, type Job } from "./orchestrator-server.js";

// ---- 六大模块P0 创作API（派单51：谢擎）----
import { storyRoutes } from "./routes/creative-story.js";
import { animationRoutes } from "./routes/creative-animation.js";
import { promoRoutes } from "./routes/creative-promo.js";
import { shortVideoRoutes } from "./routes/creative-short-video.js";
import { musicRoutes } from "./routes/creative-music.js";
// P1 (派单53): 广告图模块

import { adImageRoutes } from "./routes/creative-ad-image.js";
import { craftPromptRoutes } from "./routes/craft-prompt.js";
import { referenceImageRoutes } from "./routes/reference-images.js";
import {
  submitTask as genSubmitTask,
  getTask as genGetTask,
  listTasks as genListTasks,
  cancelTask as genCancelTask,
  startBackgroundPoller,
  stopBackgroundPoller,
} from "./generation-task-manager.js";

const app = new Hono<AppEnv>();
const jobStore = getJobStore();
const healthChecker = buildHealthChecker();

// ---- 全局中间�?----
app.use("*", requestIdMiddleware);
app.use("*", loggerMiddleware);

// ---- 健康检查（公开�?----
// ---- 健康检查（公开）----
// 升级版 buildHealthChecker（带 deps 检查，5s 超时）—— 任一 dep down 则 ok=false
app.get("/health", async (c) => {
  const report: HealthReport = await healthChecker.check();
  return c.json(report, report.ok ? 200 : 503);
});

// ---- 鉴权 ----
app.use("/v1/*", authMiddleware);

// ---- BYOK (D5b) ----
import { byokClient } from "./clients/byok.js";

app.get("/v1/ai/byok", async (c) => {
  const user = requireUser(c);
  try {
    const [keys, quota] = await Promise.all([
      byokClient.listByok(user.userId),
      byokClient.quota(user.userId),
    ]);
    return c.json({
      code: 0,
      message: "ok",
      data: {
        userId: user.userId,
        keys: keys.keys ?? [],
        keyCount: keys.count ?? 0,
        quota,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ code: ErrorCodes.SERVICE_UNAVAILABLE, message: "byok服务暂不可用" }, 502);
  }
});

app.get("/v1/ai/byok/quota", async (c) => {
  const user = requireUser(c);
  try {
    const quota = await byokClient.quota(user.userId);
    return c.json({ code: 0, message: "ok", data: quota });
  } catch (err) {
    return c.json({ code: ErrorCodes.SERVICE_UNAVAILABLE, message: "byok服务暂不可用" }, 502);
  }
});

// ---- 六大模块P0 创作API（派单51：谢擎）----
// 故事模块：灵感+模板+世界观+逐章生成
app.route("/v1/creative/story", storyRoutes);
// 动画模块：多模式分析（小说/角色/结构化/空白→角色+场景+分镜）
app.route("/v1/creative/animation", animationRoutes);
// 宣传片模块：智能Brief + 多脚本方案A/B/C
app.route("/v1/creative/promo", promoRoutes);
// 短视频模块：商品链接解析
app.route("/v1/creative/short-video", shortVideoRoutes);
// 配乐模块：视频分析配乐 + 音乐需求翻译
app.route("/v1/creative/music", musicRoutes);
// P1 (派单53): 广告图模块 — 纯文案海报prompt生成

app.route("/v1/creative/ad-image", adImageRoutes);
// CRAFT 提示词构建器
app.route("/v1/craft-prompt", craftPromptRoutes);
// 参考图管理
app.route("/v1/reference-images", referenceImageRoutes);

// ---- 维护 runner 句柄（全局注册表，与 orchestrator-server 共享）----
import { getRunner, findRunner } from "./runner-registry.js";

// ---- Zod 校验 schema ----
const NovelToDramaSchema = z.object({
  text: z.string().min(20).max(20_000),
  storyType: z.enum(["sweet_romance_novel", "urban_fantasy", "wuxia_martial", "scifi_mecha", "school_life", "mystery_suspense", "isekai"]).optional(),
  artStyle: z.enum(["anime", "manhua_chinese", "realistic_3d", "watercolor", "pixel", "ink_painting", "comic_western"]).optional(),
  chapterTitle: z.string().max(200).optional(),
  durationSeconds: z.number().int().min(15).max(180).optional(),
  ttsProvider: z.enum(["edge-tts", "volcengine", "aliyun", "elevenlabs"]).optional(),
  projectId: z.string().optional(),
});

const EpisodeBatchSchema = z.object({
  text: z.string().min(50).max(80_000),
  chapterTitle: z.string().max(200).optional(),
  episodeCount: z.number().int().min(2).max(50).optional(),
  perEpisodeDurationSeconds: z.number().int().min(15).max(120).optional(),
  storyType: z.enum(["sweet_romance_novel", "urban_fantasy", "wuxia_martial", "scifi_mecha", "school_life", "mystery_suspense", "isekai"]).optional(),
  artStyle: z.enum(["anime", "manhua_chinese", "realistic_3d", "watercolor", "pixel", "ink_painting", "comic_western"]).optional(),
  ttsProvider: z.enum(["edge-tts", "volcengine", "aliyun", "elevenlabs"]).optional(),
  projectId: z.string().optional(),
});

const StyleTransferSchema = z.object({
  sourceAssetId: z.string().min(1),
  shots: z
    .array(
      z.object({
        shotId: z.string(),
        sceneId: z.string(),
        location: z.string(),
        description: z.string(),
        characters: z.array(z.string()),
        mood: z.string(),
        shotType: z.string().optional(),
        cameraMove: z.string().optional(),
      }),
    )
    .optional(),
  targetArtStyle: z.enum(["anime", "manhua_chinese", "realistic_3d", "watercolor", "pixel", "ink_painting", "comic_western"]),
  sourceVideoUrl: z.string().url().optional(),
  projectId: z.string().optional(),
});

const CharacterReplaceSchema = z.object({
  targetAssetId: z.string().min(1),
  replacements: z
    .array(
      z.object({
        targetCharacterName: z.string().min(1),
        sourceCharacterAssetId: z.string().min(1),
      }),
    )
    .min(1),
  artStyle: z.enum(["anime", "manhua_chinese", "realistic_3d", "watercolor", "pixel", "ink_painting", "comic_western"]),
  shots: z
    .array(
      z.object({
        shotId: z.string(),
        sceneId: z.string(),
        location: z.string(),
        description: z.string(),
        characters: z.array(z.string()),
        mood: z.string(),
      }),
    )
    .optional(),
  projectId: z.string().optional(),
});

const AutoTranslateSchema = z.object({
  sourceAssetId: z.string().min(1),
  shots: z
    .array(z.object({ shotId: z.string(), dialogue: z.string().optional() }))
    .optional(),
  subtitleSrt: z.string().optional(),
  targetLanguage: z.enum(["en", "ja", "ko", "es"]),
  ttsProvider: z.enum(["volcengine", "aliyun", "elevenlabs"]).optional(),
  burnInPlace: z.boolean().optional(),
  projectId: z.string().optional(),
});

// ---- 5 �?pipeline 端点 ----
app.post("/v1/orchestrate/novel-to-drama", async (c) => {
  const user = requireUser(c);
  const body = NovelToDramaSchema.parse(await c.req.json()) as NovelToDramaInput;
  const runner = getRunner(novelToDramaPipeline);
  const snap = await runner.start({ pipeline: novelToDramaPipeline, user, inputs: body as unknown as Record<string, unknown> });
  return c.json(serializeSnap(snap, buildNovelToDramaOutput), snap.status === "failed" ? 402 : 200);
});

app.post("/v1/orchestrate/episode-batch", async (c) => {
  const user = requireUser(c);
  const body = EpisodeBatchSchema.parse(await c.req.json()) as EpisodeBatchInput;
  const runner = getRunner(episodeBatchPipeline);
  const snap = await runner.start({ pipeline: episodeBatchPipeline, user, inputs: body as unknown as Record<string, unknown> });
  return c.json(serializeSnap(snap, buildEpisodeBatchOutput), snap.status === "failed" ? 402 : 200);
});

app.post("/v1/orchestrate/style-transfer", async (c) => {
  const user = requireUser(c);
  const body = StyleTransferSchema.parse(await c.req.json()) as StyleTransferInput;
  const runner = getRunner(styleTransferPipeline);
  const snap = await runner.start({ pipeline: styleTransferPipeline, user, inputs: body as unknown as Record<string, unknown> });
  return c.json(serializeSnap(snap, buildStyleTransferOutput), snap.status === "failed" ? 402 : 200);
});

app.post("/v1/orchestrate/character-replace", async (c) => {
  const user = requireUser(c);
  const body = CharacterReplaceSchema.parse(await c.req.json()) as CharacterReplaceInput;
  const runner = getRunner(characterReplacePipeline);
  const snap = await runner.start({ pipeline: characterReplacePipeline, user, inputs: body as unknown as Record<string, unknown> });
  return c.json(serializeSnap(snap, buildCharacterReplaceOutput), snap.status === "failed" ? 402 : 200);
});

app.post("/v1/orchestrate/auto-translate", async (c) => {
  const user = requireUser(c);
  const body = AutoTranslateSchema.parse(await c.req.json()) as AutoTranslateInput;
  const runner = getRunner(autoTranslatePipeline);
  const snap = await runner.start({ pipeline: autoTranslatePipeline, user, inputs: body as unknown as Record<string, unknown> });
  return c.json(serializeSnap(snap, buildAutoTranslateOutput), snap.status === "failed" ? 402 : 200);
});

// ---- 状态查�?/ 取消 / 续跑 ----
app.get("/v1/orchestrate/runs", async (c) => {
  const user = requireUser(c);
  const q = c.req.query();
  const all = q.all === "1";
  const limit = Math.min(Number(q.limit) || 50, 200);
  const list = all ? await snapshotStore.listActive() : await snapshotStore.listByUser(user.userId, limit);
  return c.json({ code: 0, message: "ok", data: { items: list, total: list.length, limit } });
});

app.get("/v1/orchestrate/runs/:runId", async (c) => {
  const user = requireUser(c);
  const runId = c.req.param("runId");
  const snap = await snapshotStore.load(runId);
  if (!snap) return c.json({ code: ErrorCodes.NOT_FOUND, message: "资源不存在" }, 404);
  if (snap.userId !== user.userId && user.tier !== "enterprise") {
    return c.json({ code: ErrorCodes.FORBIDDEN, message: "无权访问" }, 403);
  }
  return c.json({ code: 0, message: "ok", data: snap });
});

app.post("/v1/orchestrate/runs/:runId/cancel", async (c) => {
  const user = requireUser(c);
  const runId = c.req.param("runId");
  const snap = await snapshotStore.load(runId);
  if (!snap) return c.json({ code: ErrorCodes.NOT_FOUND, message: "资源不存在" }, 404);
  if (snap.userId !== user.userId && user.tier !== "enterprise") {
    return c.json({ code: ErrorCodes.FORBIDDEN, message: "无权访问" }, 403);
  }
  const runner = findRunner(snap.pipeline);
  if (runner) runner.cancel();
  snap.status = "cancelled";
  await snapshotStore.save(snap);
  return c.json({ code: 0, message: "ok", data: { runId, cancelled: true } });
});

app.post("/v1/orchestrate/runs/:runId/resume", async (c) => {
  const user = requireUser(c);
  const runId = c.req.param("runId");
  const snap = await snapshotStore.load(runId);
  if (!snap) return c.json({ code: ErrorCodes.NOT_FOUND, message: "资源不存在" }, 404);
  if (snap.status !== "failed") {
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: `status is ${snap.status}, not resumable` }, 400);
  }
  const def = PIPELINE_MAP[snap.pipeline];
  if (!def) return c.json({ code: ErrorCodes.BAD_REQUEST, message: "unknown_pipeline" }, 400);
  const runner = new PipelineRunner(def);
  const newSnap = await runner.start({ pipeline: def, user, inputs: snap.inputs });
  return c.json({ code: 0, message: "ok", data: { runId: newSnap.runId, resumed: true, snapshot: newSnap } });
});

// ---- 元信�?----
app.get("/v1/orchestrate/cost-table", (c) => {
  return c.json({ code: 0, message: "ok", data: { costs: COST_ESTIMATES } });
});

app.get("/v1/orchestrate/pipelines", (c) => {
  return c.json({ code: 0, message: "ok", data: { pipelines: [
      { name: "novel-to-drama", description: "Novel to Drama Pipeline", cost: estimateCost("novel-to-drama") },
      { name: "episode-batch", description: "Episode Batch Pipeline", cost: estimateCost("episode-batch") },
      { name: "style-transfer", description: "Style Transfer Pipeline", cost: estimateCost("style-transfer") },
      { name: "character-replace", description: "Character Replace Pipeline", cost: estimateCost("character-replace") },
      { name: "auto-translate", description: "Auto Translate Pipeline", cost: estimateCost("auto-translate") },
      { name: "one-click-manga", description: "P2: One-Click Manga Pipeline (7-step auto)", cost: estimateCost("one-click-manga") },
      { name: "auto-music", description: "P2: Auto Music Pipeline (scene → BGM)", cost: estimateCost("auto-music") },
    ] } });
});

// ---- Orchestrator Jobs (LEG-006 P1) ----
// Direct routes to avoid sub-app routing issues
app.post("/v1/orchestrator/jobs", async (c) => {
  const user = requireUser(c);
  const JobCreateSchema = z.object({
    type: z.enum(["image", "character", "scene", "workflow", "decompose", "compose", "one-click-manga", "auto-music"]),
    payload: z.record(z.unknown()).default({}),
    projectId: z.string().optional(),
  });
  let body: z.infer<typeof JobCreateSchema>;
  try {
    body = JobCreateSchema.parse(await c.req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: msg }, 400);
  }
  let binding;
  try { binding = getBinding(body.type); } catch { binding = null; }
  if (!binding) {
    const valid = listTypes().join(", ");
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: `unknown type "${body.type}", valid: ${valid}` }, 400);
  }
  const jobId = `job-${nanoid(12)}`;
  const job: Job = {
    jobId, type: body.type, userId: user.userId, projectId: body.projectId,
    status: "queued", progress: 0,
    payload: { ...(body.payload as Record<string, unknown>), _jobId: jobId },
    pipeline: binding.pipelineName,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  jobStore.put(job);
  return c.json({ code: 0, message: "ok", data: { jobId, status: "queued", type: body.type } }, 201);
});

app.get("/v1/orchestrator/jobs", (c) => {
  return c.json({ code: 0, message: "ok", data: { count: jobStore.size() } });
});

app.get("/v1/orchestrator/jobs/:id", (c) => {
  const id = c.req.param("id");
  const job = jobStore.get(id);
  if (!job) return c.json({ code: ErrorCodes.NOT_FOUND, message: "资源不存在" }, 404);
  return c.json({ code: 0, message: "ok", data: {
    jobId: job.jobId, type: job.type, status: job.status,
    progress: job.progress, currentStep: job.currentStep, totalSteps: job.totalSteps,
    steps: job.steps, result: job.result, error: job.error,
    pipeline: job.pipeline, projectId: job.projectId,
    estimatedTime: job.estimatedTime,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  } });
});

// ---- Generation Task API ----

const GenerationSubmitSchema = z.object({
  taskType: z.enum(["image", "video", "audio", "tts"]),
  provider: z.enum(["seedream", "seedance", "minimax", "volcengine", "suno", "openai"]),
  model: z.string().max(50).optional(),
  prompt: z.string().min(1).max(5000),
  craftPrompt: z
    .object({
      context: z.string().optional(),
      reference: z.string().optional(),
      action: z.string().optional(),
      framing: z.string().optional(),
      timing: z.string().optional(),
    })
    .optional(),
  referenceImages: z
    .array(z.object({ url: z.string(), role: z.string() }))
    .optional(),
  parameters: z.record(z.unknown()).default({}),
  projectId: z.string().optional(),
});

app.post("/v1/generation/submit", async (c) => {
  const user = requireUser(c);
  let body: z.infer<typeof GenerationSubmitSchema>;
  try {
    body = GenerationSubmitSchema.parse(await c.req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: msg }, 400);
  }

  try {
    const task = await genSubmitTask({
      userId: user.userId,
      projectId: body.projectId,
      taskType: body.taskType,
      provider: body.provider,
      model: body.model,
      prompt: body.prompt,
      craftPrompt: body.craftPrompt,
      referenceImages: body.referenceImages,
      parameters: body.parameters,
    });

    return c.json({
      code: 0,
      message: "ok",
      data: {
        taskId: task.id,
        status: task.status,
        requestHash: task.requestHash,
      },
    }, task.status === "failed" ? 502 : 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ code: ErrorCodes.INTERNAL_ERROR, message: msg }, 500);
  }
});

app.get("/v1/generation", async (c) => {
  const user = requireUser(c);
  const q = c.req.query();
  const result = await genListTasks(user.userId, {
    projectId: q.projectId || undefined,
    status: q.status || undefined,
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
  });
  return c.json({ code: 0, message: "ok", data: { items: result.items, total: result.total } });
});

app.get("/v1/generation/:taskId", async (c) => {
  const user = requireUser(c);
  const taskId = c.req.param("taskId");
  const task = await genGetTask(taskId);
  if (!task) {
    return c.json({ code: ErrorCodes.NOT_FOUND, message: "任务不存在" }, 404);
  }
  if (task.userId !== user.userId && user.tier !== "enterprise") {
    return c.json({ code: ErrorCodes.FORBIDDEN, message: "无权访问" }, 403);
  }
  return c.json({ code: 0, message: "ok", data: task });
});

app.post("/v1/generation/:taskId/cancel", async (c) => {
  const user = requireUser(c);
  const taskId = c.req.param("taskId");
  const cancelled = await genCancelTask(taskId, user.userId);
  if (!cancelled) {
    const task = await genGetTask(taskId);
    if (!task) {
      return c.json({ code: ErrorCodes.NOT_FOUND, message: "任务不存在" }, 404);
    }
    if (task.userId !== user.userId) {
      return c.json({ code: ErrorCodes.FORBIDDEN, message: "无权访问" }, 403);
    }
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: `任务状态为 ${task.status}，无法取消` }, 400);
  }
  return c.json({ code: 0, message: "cancelled" });
});

// ---- 错误处理 ----
app.onError((err, c) => {
  process.stderr.write(`[ai-orchestrator] error: ${err.message}\n`);
  if (err.name === "ZodError") {
    return c.json({ code: ErrorCodes.BAD_REQUEST, message: err.message }, 400);
  }
  return c.json({ code: ErrorCodes.INTERNAL_ERROR, message: err.message }, 500);
});

app.notFound((c) => c.json({ code: ErrorCodes.NOT_FOUND, message: "资源不存在" }, 404));

// ---- 工具：序列化 snapshot + 业务输出 ----
function serializeSnap<T>(
  snap: RunSnapshot,
  buildOutput: (s: RunSnapshot) => T,
): Record<string, unknown> {
  const base = {
    runId: snap.runId,
    pipeline: snap.pipeline,
    status: snap.status,
    steps: snap.steps,
    cost: snap.costSummary,
    error: snap.error,
    quotaDenial: snap.quotaDenial,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
  };
  if (snap.status === "success") {
    return { code: 0, message: "ok", data: { ...base, output: buildOutput(snap) } };
  }
  if (snap.status === "failed") {
    return { code: ErrorCodes.PAYMENT_FAILED, message: snap.error ?? "pipeline执行失败", data: base };
  }
  return { code: 0, message: "ok", data: base };
}

const PIPELINE_MAP: Record<string, PipelineDefinition> = {
  "novel-to-drama": novelToDramaPipeline,
  "episode-batch": episodeBatchPipeline,
  "style-transfer": styleTransferPipeline,
  "character-replace": characterReplacePipeline,
  "auto-translate": autoTranslatePipeline,
  "one-click-manga": oneClickMangaPipeline,
  "auto-music": autoMusicPipeline,
};

// ---- 启动 ----
async function main(): Promise<void> {
  // 挂 orchestrator-server 到主 app（共享 port 8087）
  app.route("/", buildOrchestratorServer());

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: "0.0.0.0",
    },
    (info) => {
      process.stdout.write(`[ai-orchestrator] listening on http://0.0.0.0:${info.port}\n`);
    },
  );

  // P2: 安装 WebSocket 升级路由（一键创作进度推送）
  installWebSocketUpgrade(server as unknown as import("http").Server);
  process.stdout.write(`[ai-orchestrator] WebSocket upgrade installed at /ws/orchestrator/jobs/:jobId\n`);
  process.stdout.write(
    `[ai-orchestrator] ready port=${config.port} env=${config.env} pipelines=${Object.keys(PIPELINE_MAP).join(",")}\n`,
  );
  process.stdout.write(
    `[ai-orchestrator] orchestrator-server mounted at /v1/orchestrator (jobs=${getJobStore().size()})\n`,
  );

  // Start generation task background poller
  startBackgroundPoller();
}

void main();

// ---- 优雅关闭 ----
// SIGTERM (k8s / docker stop) �?SIGINT (Ctrl+C) 都收
// 关停顺序：停 HTTP server（拒绝新请求）→ 快照落盘（in-memory 已经是同步的）→ exit 0
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`[ai-orchestrator] received ${signal}, shutting down...\n`);
  try {
    // Stop generation task background poller
    stopBackgroundPoller();
    // 等所�?job 自然结束（简单实现：5s 硬超时）
    const jobCount = getJobStore().size();
    if (jobCount > 0) {
      process.stdout.write(`[ai-orchestrator] waiting for ${jobCount} jobs to drain...\n`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    process.stdout.write(`[ai-orchestrator] goodbye\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`[ai-orchestrator] shutdown error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
