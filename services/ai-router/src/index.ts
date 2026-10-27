// AI Router 服务入口
// 端口 8082，挂在 API 网关之后
// 派单 16 扩展: 加 /v1/audio /v1/providers /v1/test 端点 + 8 家 provider
// 派单 16: 统一错误码 401/429/500/503/504

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";
import path from "path";
import { readFile, stat } from "fs/promises";

import { config } from "./config.js";
import { keyStore } from "./keys/store.js";
import { byokResolver } from "./keys/byok.js";
import { keyManager } from "./keys/manager.js";
import { registry } from "./router/registry.js";
import { withFailover, runHealthCheck } from "./router/failover.js";
import { requestCache, RequestCache } from "./cache/request-cache.js";

import { authMiddleware, trustInternalMiddleware, type AppEnv } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/ratelimit.js";
import { loggerMiddleware, logCall } from "./middleware/logger.js";

import {
  AuthError,
  ProviderError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
  UpstreamUnavailable,
  type ChatRequest,
  type ChatResponse,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type ImageRequest,
  type ImageResponse,
  type VideoRequest,
  type VideoResponse,
  type AudioRequest,
  type AudioResponse,
  type ProviderId,
} from "./types.js";

const app = new Hono<AppEnv>();

// ---- 全局中间件 ----
app.use("*", loggerMiddleware);

// ---- 持久化文件静态服务 ----
// URL 持久化后的图片/视频/关键帧通过此路由访问。
//
// 注意（根因修复）：原先使用 @hono/node-server/serve-static + 相对 root，
// 在 Windows 下会出现「HTTP 200 + image/jpeg 头，但响应体为 0 字节」的 bug
// （相对 root 路径解析异常）。这导致所有持久化图片/视频在浏览器中加载失败，
// 表现正是「有视角标签、但图片渲染不出来 / 破图」。
// 现改为显式绝对路径流式传输：读取目录与 url-persistence 写入目录严格一致，
// 并增加目录穿越防护，确保 Content-Length 与真实字节数一致。
const PERSIST_ROOT = path.resolve(config.persistenceStorageDir);

const STATIC_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
};

app.use("/persisted/*", async (c) => {
  // 去掉查询参数（支持前端 ?v=xxx 缓存破坏，服务端忽略）
  const subPath = decodeURIComponent(c.req.path.replace(/^\/persisted\/?/, "").split("?")[0]);
  if (!subPath) return c.body("Not Found", 404);

  const absPath = path.resolve(PERSIST_ROOT, subPath);
  // 目录穿越防护：必须仍在持久化根目录内
  if (absPath !== PERSIST_ROOT && !absPath.startsWith(PERSIST_ROOT + path.sep)) {
    return c.body("Forbidden", 403);
  }

  let info;
  try {
    info = await stat(absPath);
  } catch {
    return c.body("Not Found", 404);
  }
  if (!info.isFile()) return c.body("Not Found", 404);

  const ext = path.extname(absPath).toLowerCase();
  const mime = STATIC_MIME[ext] ?? "application/octet-stream";

  // 注意：@hono/node-server 对 Web ReadableStream 的流式响应会写出 0 字节，
  // 因此这里直接 readFile 为 Buffer 返回，确保 Content-Length 与真实字节一致。
  const buf = await readFile(absPath);
  console.log("[persisted] serve %s size=%d bytes", absPath, buf.length);

  return c.body(buf, 200, {
    "Content-Type": mime,
    "Content-Length": String(buf.length),
    // no-store：彻底禁止浏览器/CDN 缓存（之前 no-cache 仍允许带验证的缓存，
    // 导致旧 0 字节响应在某些浏览器中无法被刷新）。
    "Cache-Control": "no-store, must-revalidate",
    "ETag": `"${buf.length}-${info.mtimeMs}"`,
    "Accept-Ranges": "bytes",
    "X-Content-Length": String(buf.length),
  });
});

// ---- Zod 校验 schema ----
const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
});

// 派单 16 扩展: 8 家 provider
const AllProviders = [
  "minimax", "deepseek", "zhipu", "volcengine",
  "qwen", "replicate", "fal", "openai", "agnes",
] as const;

const ChatBodySchema = z.object({
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(AllProviders)).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

const EmbedBodySchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string()).min(1)]),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(AllProviders)).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

const ImageBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  size: z.string().optional(),
  n: z.number().int().min(1).max(4).optional(),
  image: z.array(z.string()).nullable().optional(),
  negativePrompt: z.string().optional(),
  seed: z.number().int().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(AllProviders)).optional(),
  useByok: z.boolean().nullable().optional(),
  taskTag: z.string().optional(),
});

const VideoBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  resolution: z.string().optional(),
  content: z.array(z.record(z.unknown())).optional(),
  firstFrameUrl: z.string().optional(),
  lastFrameUrl: z.string().optional(),
  referenceImages: z.array(z.string()).nullable().optional(),
  seed: z.number().int().optional(),
  generateAudio: z.boolean().optional(),
  returnLastFrame: z.boolean().optional(),
  ratio: z.string().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(AllProviders)).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

// 派单 16 新增: 音频请求 schema
const AudioBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  style: z.string().optional(),
  durationSeconds: z.number().int().min(1).max(300).optional(),
  withLyrics: z.boolean().optional(),
  lyrics: z.string().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(AllProviders)).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

// 派单 16 新增: 测试连通性 schema
const TestKeySchema = z.object({
  provider: z.enum(AllProviders),
  apiKey: z.string().min(8),
});

// ---- 健康检查（公开） ----
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ai-router",
    port: config.port,
    providers: registry.allHealth(),
    cacheSize: 0,
    timestamp: Date.now(),
  });
});

// ---- 受保护路由：auth + rate limit ----
const protectedApp = new Hono<AppEnv>();
protectedApp.use("*", trustInternalMiddleware);
protectedApp.use("*", authMiddleware);
protectedApp.use("*", rateLimitMiddleware);

// protectedApp 自己的 notFound — 不存在路径返 404 而不是被 auth 拦截
// 注: Hono 中 middleware 在 notFound 之前调用，所以 /v1/foo 走到 auth 返 401 是预期行为
// 只处理路由被识别为 未匹配 的情况
protectedApp.notFound((c) => {
  return c.json(
    { error: "not found", code: "not_found", path: c.req.path },
    404,
  );
});

/* ==================================================================
 * 派单 16 新增: GET /v1/providers
 *   列所有支持的 provider + model (公开信息，前端 BYOK 设置页用)
 *   注意: 不需要鉴权 (但放在 protectedApp 也行) - 这里放公开路由
 * ================================================================== */
app.get("/v1/providers", (c) => {
  const out = registry.all().map((p) => ({
    id: p.id,
    name: providerDisplayName(p.id),
    models: p.getModels().map((m) => ({
      id: m.id,
      displayName: m.displayName ?? m.id,
      capabilities: m.capabilities,
      contextWindow: m.contextWindow,
      costPer1kInput: m.costPer1kInput,
      costPer1kOutput: m.costPer1kOutput,
      typicalLatencyMs: m.typicalLatencyMs,
      qualityScore: m.qualityScore,
      description: m.description,
    })),
    healthy: registry.isHealthy(p.id),
  }));
  return c.json({ providers: out, count: out.length });
});

/* ==================================================================
 * 派单 16 新增: POST /v1/test
 *   测试一个 (provider, apiKey) 组合是否有效
 *   不走鉴权 (BYOK 设置页要让用户先测，再让用户登录保存)
 * ================================================================== */
app.post("/v1/test", async (c) => {
  const body = TestKeySchema.parse(await c.req.json());
  const provider = registry.get(body.provider);
  if (!provider) {
    return c.json({ ok: false, status: 404, error: "unknown provider" }, 404);
  }
  const start = Date.now();
  try {
    const health = await provider.healthCheck(body.apiKey);
    return c.json({
      ok: health.healthy,
      status: health.healthy ? 200 : 503,
      provider: body.provider,
      latencyMs: Date.now() - start,
      consecutiveFailures: health.consecutiveFailures,
      lastError: health.lastError,
    });
  } catch (err) {
    return c.json(
      {
        ok: false,
        status: 500,
        provider: body.provider,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

// ---- POST /v1/chat ----
protectedApp.post("/v1/chat", async (c) => {
  const user = c.get("user")!;
  const body = ChatBodySchema.parse(await c.req.json());

  const cacheKey = RequestCache.keyFor("chat", {
    model: body.model ?? null,
    strategy: body.strategy ?? "balanced",
    preferred: body.preferredProviders ?? [],
    messages: body.messages,
    temperature: body.temperature ?? null,
    maxTokens: body.maxTokens ?? null,
    topP: body.topP ?? null,
  });
  const cached = await requestCache.get<ChatResponse>(cacheKey);
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const req: ChatRequest = {
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    topP: body.topP,
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok,
    taskTag: body.taskTag,
  };

  const { value, attempts } = await withFailover(
    {
      task: "chat",
      strategy: req.strategy,
      preferredProviders: req.preferredProviders,
      requestedModel: req.model,
    },
    async (provider, modelId) => {
      const key = await byokResolver.resolve({ providerId: provider, userId: user.userId });
      const providerInst = registry.get(provider);
      if (!providerInst) throw new ProviderError(provider, modelId, 500, "provider not found");
      const resp = await providerInst.chat({ ...req, model: modelId }, key.apiKey);
      resp.usedByok = key.usedByok;
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  await requestCache.set(cacheKey, value);

  logCall({
    requestId: c.get("requestId"),
    userId: user.userId,
    task: body.taskTag ?? "chat",
    provider: value.provider,
    model: value.model,
    latencyMs: value.latencyMs,
    cost: value.cost,
    usedByok: value.usedByok,
    status: 200,
  });

  return c.json({ ...value, attempts });
});

// ---- POST /v1/embeddings ----
protectedApp.post("/v1/embeddings", async (c) => {
  const user = c.get("user")!;
  const body = EmbedBodySchema.parse(await c.req.json());

  const cacheKey = RequestCache.keyFor("embed", {
    model: body.model ?? null,
    strategy: body.strategy ?? "balanced",
    input: body.input,
  });
  const cached = await requestCache.get<EmbeddingResponse>(cacheKey);
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const req: EmbeddingRequest = {
    model: body.model,
    input: body.input,
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok,
    taskTag: body.taskTag,
  };

  const { value } = await withFailover(
    {
      task: "embeddings",
      strategy: req.strategy,
      preferredProviders: req.preferredProviders,
      requestedModel: req.model,
    },
    async (provider, modelId) => {
      const key = await byokResolver.resolve({ providerId: provider, userId: user.userId });
      const providerInst = registry.get(provider);
      if (!providerInst) throw new ProviderError(provider, modelId, 500, "provider not found");
      const resp = await providerInst.embed({ ...req, model: modelId }, key.apiKey);
      resp.usedByok = key.usedByok;
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  await requestCache.set(cacheKey, value);

  logCall({
    requestId: c.get("requestId"),
    userId: user.userId,
    task: body.taskTag ?? "embeddings",
    provider: value.provider,
    model: value.model,
    latencyMs: value.latencyMs,
    cost: value.cost,
    usedByok: value.usedByok,
    status: 200,
  });

  return c.json(value);
});

// ---- POST /v1/image ----
protectedApp.post("/v1/image", async (c) => {
  const user = c.get("user")!;
  const body = ImageBodySchema.parse(await c.req.json());

  const cacheKey = RequestCache.keyFor("image", {
    model: body.model ?? null,
    strategy: body.strategy ?? "balanced",
    prompt: body.prompt,
    size: body.size ?? null,
    n: body.n ?? 1,
    image: body.image ?? null,
    seed: body.seed ?? null,
    negativePrompt: body.negativePrompt ?? null,
  });
  const cached = await requestCache.get<ImageResponse>(cacheKey);
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const req: ImageRequest = {
    model: body.model,
    prompt: body.prompt,
    size: body.size,
    n: body.n,
    image: body.image ?? undefined,
    negativePrompt: body.negativePrompt,
    seed: body.seed,
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok ?? undefined,
    taskTag: body.taskTag,
  };

  const { value } = await withFailover(
    {
      task: "image",
      strategy: req.strategy,
      preferredProviders: req.preferredProviders,
      requestedModel: req.model,
    },
    async (provider, modelId) => {
      const key = await byokResolver.resolve({ providerId: provider, userId: user.userId });
      const providerInst = registry.get(provider);
      if (!providerInst) throw new ProviderError(provider, modelId, 500, "provider not found");
      const resp = await providerInst.image({ ...req, model: modelId }, key.apiKey);
      resp.usedByok = key.usedByok;
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  await requestCache.set(cacheKey, value);

  logCall({
    requestId: c.get("requestId"),
    userId: user.userId,
    task: body.taskTag ?? "image",
    provider: value.provider,
    model: value.model,
    latencyMs: value.latencyMs,
    cost: value.cost,
    usedByok: value.usedByok,
    status: 200,
  });

  return c.json(value);
});

// ---- POST /v1/video ----
protectedApp.post("/v1/video", async (c) => {
  const user = c.get("user")!;
  const body = VideoBodySchema.parse(await c.req.json());

  const cacheKey = RequestCache.keyFor("video", {
    model: body.model ?? null,
    strategy: body.strategy ?? "balanced",
    prompt: body.prompt,
    duration: body.durationSeconds ?? null,
    resolution: body.resolution ?? null,
    firstFrameUrl: body.firstFrameUrl ?? null,
    lastFrameUrl: body.lastFrameUrl ?? null,
    referenceImages: body.referenceImages ?? null,
    seed: body.seed ?? null,
    generateAudio: body.generateAudio ?? null,
    returnLastFrame: body.returnLastFrame ?? null,
    ratio: body.ratio ?? null,
    content: body.content ?? null,
  });
  const cached = await requestCache.get<VideoResponse>(cacheKey);
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const req: VideoRequest = {
    model: body.model,
    prompt: body.prompt,
    durationSeconds: body.durationSeconds,
    resolution: body.resolution,
    content: body.content,
    firstFrameUrl: body.firstFrameUrl,
    lastFrameUrl: body.lastFrameUrl,
    referenceImages: body.referenceImages ?? undefined,
    seed: body.seed,
    generateAudio: body.generateAudio,
    returnLastFrame: body.returnLastFrame,
    ratio: body.ratio,
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok,
    taskTag: body.taskTag,
  };

  const { value } = await withFailover(
    {
      task: "video",
      strategy: req.strategy,
      preferredProviders: req.preferredProviders,
      requestedModel: req.model,
    },
    async (provider, modelId) => {
      const key = await byokResolver.resolve({ providerId: provider, userId: user.userId });
      const providerInst = registry.get(provider);
      if (!providerInst) throw new ProviderError(provider, modelId, 500, "provider not found");
      const resp = await providerInst.video({ ...req, model: modelId }, key.apiKey);
      resp.usedByok = key.usedByok;
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  await requestCache.set(cacheKey, value);

  logCall({
    requestId: c.get("requestId"),
    userId: user.userId,
    task: body.taskTag ?? "video",
    provider: value.provider,
    model: value.model,
    latencyMs: value.latencyMs,
    cost: value.cost,
    usedByok: value.usedByok,
    status: 200,
  });

  return c.json(value);
});

// ---- POST /v1/ai/consistent-keyframe (一致性关键帧生成) ----
protectedApp.post("/v1/ai/consistent-keyframe", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const {
    prompt,
    referenceImages,
    model = "flux-kontext-pro",
    width = 1280,
    height = 720,
    faceSwap = false,
    faceSwapSource,
    negativePrompt,
    seed,
  } = body;

  if (!prompt || !referenceImages?.length) {
    return c.json({ error: { message: "prompt and referenceImages required" } }, 400);
  }

  // 通过 BYOK 解析 Replicate API Key（优先用户自有 key，回落平台 key）
  const { apiKey, usedByok } = await byokResolver.resolve({
    providerId: "replicate",
    userId: user.userId,
  });

  const replicateProvider = registry.get("replicate") as import("./providers/replicate.js").ReplicateProvider;
  const result = await replicateProvider.generateConsistentImage(
    {
      prompt,
      referenceImages,
      model,
      width,
      height,
      faceSwap,
      faceSwapSource,
      negativePrompt,
      seed,
    },
    apiKey,
  );

  // URL 持久化
  const { getUrlPersistence } = await import("./services/url-persistence.js");
  const persistedUrl = await getUrlPersistence().persist(result.imageUrl, "keyframe");

  logCall({
    requestId: c.get("requestId") ?? "",
    userId: user.userId,
    task: "consistent-keyframe",
    provider: "replicate",
    model: result.model,
    latencyMs: result.latencyMs,
    cost: result.cost,
    status: 200,
    usedByok,
  });

  return c.json({
    keyframeUrl: persistedUrl,
    mode: result.faceSwapped ? "faceswap-enhanced" : "consistency",
    model: result.model,
    cost: result.cost,
    generationMs: result.latencyMs,
    cached: false,
  });
});

// ---- POST /v1/audio (派单 16 新增) ----
protectedApp.post("/v1/audio", async (c) => {
  const user = c.get("user")!;
  const body = AudioBodySchema.parse(await c.req.json());

  const req: AudioRequest = {
    model: body.model,
    prompt: body.prompt,
    style: body.style,
    durationSeconds: body.durationSeconds,
    withLyrics: body.withLyrics,
    lyrics: body.lyrics,
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok,
    taskTag: body.taskTag,
  };

  const { value } = await withFailover(
    {
      task: "audio",
      strategy: req.strategy,
      preferredProviders: req.preferredProviders,
      requestedModel: req.model,
    },
    async (provider, modelId) => {
      const key = await byokResolver.resolve({ providerId: provider, userId: user.userId });
      const providerInst = registry.get(provider);
      if (!providerInst) throw new ProviderError(provider, modelId, 500, "provider not found");
      const resp = await providerInst.audio(req, key.apiKey);
      resp.usedByok = key.usedByok;
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  // 音频生成不缓存（异步，每次结果不同）

  logCall({
    requestId: c.get("requestId"),
    userId: user.userId,
    task: body.taskTag ?? "audio",
    provider: value.provider,
    model: value.model,
    latencyMs: value.latencyMs,
    cost: value.cost,
    usedByok: value.usedByok,
    status: 200,
  });

  return c.json(value);
});

// ---- BYOK 管理（简单实现，admin/user 路径） ----
const ByokAddSchema = z.object({
  providerId: z.enum(AllProviders),
  apiKey: z.string().min(8),
  label: z.string().optional(),
});

protectedApp.post("/v1/keys/byok", async (c) => {
  const user = c.get("user")!;
  const body = ByokAddSchema.parse(await c.req.json());
  await byokResolver.addByok({
    userId: user.userId,
    providerId: body.providerId,
    apiKey: body.apiKey,
    label: body.label,
  });
  return c.json({ ok: true });
});

// 列出用户的所有 BYOK 密钥（脱敏显示）
protectedApp.get("/v1/keys/byok", async (c) => {
  const user = c.get("user")!;
  const allProviderIds: ProviderId[] = ["minimax", "deepseek", "zhipu", "volcengine", "qwen", "openai", "replicate", "fal"];
  const allKeys: any[] = [];
  for (const pid of allProviderIds) {
    try {
      const keys = await keyStore.list({ providerId: pid, ownerUserId: user.userId });
      for (const k of keys) {
        allKeys.push({
          id: k.id,
          providerId: k.providerId,
          label: k.label,
          maskedKey: k.apiKey
            ? `${k.apiKey.slice(0, 4)}...${k.apiKey.slice(-4)}`
            : "****",
          lastUsedAt: k.lastUsedAt,
          monthlyUsageUsd: k.monthlyUsageUsd,
          enabled: k.enabled,
          createdAt: k.createdAt,
        });
      }
    } catch { /* skip provider if no table */ }
  }
  return c.json({ keys: allKeys });
});

protectedApp.delete("/v1/keys/byok/:keyId", async (c) => {
  const user = c.get("user")!;
  const keyId = c.req.param("keyId");
  await byokResolver.removeByok({ userId: user.userId, keyId });
  return c.json({ ok: true });
});

// ---- POST /v1/merge-av (最终导出：视频 + 配音合并) ----
protectedApp.post("/v1/merge-av", async (c) => {
  const body = await c.req.json();
  const { videoUrl, audioSegments, bgmUrl, bgmVolume } = body;

  if (!videoUrl) {
    return c.json({ error: { message: "videoUrl required" } }, 400);
  }

  try {
    const { getVideoComposer } = await import("./services/video-compose.js");
    const composer = getVideoComposer();
    const result = await composer.mergeVideoAudio({
      videoUrl,
      audioSegments: audioSegments || [],
      bgmUrl,
      bgmVolume,
    });

    logCall({
      requestId: c.get("requestId") ?? "",
      userId: c.get("user")?.userId ?? "internal",
      task: "merge-av",
      provider: "local",
      model: "ffmpeg",
      latencyMs: 0,
      cost: 0,
      status: 200,
      usedByok: false,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[merge-av] Failed:", err);
    return c.json({ error: { message: err.message || "merge failed" } }, 500);
  }
});

// ---- POST /v1/compose (视频合成：多镜头拼接 + 转场) ----
protectedApp.post("/v1/compose", async (c) => {
  const body = await c.req.json();
  const { shots, outputFormat, resolution } = body;

  if (!shots?.length) {
    return c.json({ error: { message: "shots array required" } }, 400);
  }

  const { getVideoComposer } = await import("./services/video-compose.js");
  const composer = getVideoComposer();

  try {
    const result = await composer.compose({
      shots: shots.map((s: any) => ({
        videoUrl: s.videoUrl,
        transition: s.transition || "cut",
        duration: s.duration,
      })),
      outputFormat: outputFormat || "mp4",
      resolution: resolution || "720p",
    });

    logCall({
      requestId: c.get("requestId") ?? "",
      userId: c.get("user")?.userId ?? "internal",
      task: "compose",
      provider: "local",
      model: "ffmpeg",
      latencyMs: 0,
      cost: 0,
      status: 200,
      usedByok: false,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[compose] Failed:", err);
    return c.json({ error: { message: err.message || "compose failed" } }, 500);
  }
});

// ---- POST /v1/enhance-video (画质提升：FFmpeg 超分 + 锐化) ----
protectedApp.post("/v1/enhance-video", async (c) => {
  const body = await c.req.json();
  const { videoUrl, method } = body;

  if (!videoUrl) {
    return c.json({ error: { message: "videoUrl required" } }, 400);
  }

  const validMethods = ["upscale", "sharpen", "both"];
  if (method && !validMethods.includes(method)) {
    return c.json({ error: { message: `method must be one of: ${validMethods.join(", ")}` } }, 400);
  }

  const startTime = Date.now();

  try {
    const { getVideoEnhancer } = await import("./services/video-enhance.js");
    const enhancer = getVideoEnhancer();
    const result = await enhancer.enhance({ videoUrl, method: method || "both" });

    logCall({
      requestId: c.get("requestId") ?? "",
      userId: c.get("user")?.userId ?? "internal",
      task: "enhance-video",
      provider: "local",
      model: "ffmpeg",
      latencyMs: Date.now() - startTime,
      cost: 0,
      status: 200,
      usedByok: false,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[enhance-video] Failed:", err);
    return c.json({ error: { message: err.message || "enhance failed" } }, 500);
  }
});

// ---- POST /v1/tts (文字转语音) ----
protectedApp.post("/v1/tts", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const { text, voiceId, provider, speed, pitch, format } = body;

  if (!text || !voiceId) {
    return c.json({ error: { message: "text and voiceId required" } }, 400);
  }

  try {
    const { getTtsService } = await import("./services/tts-service.js");
    const tts = getTtsService();
    const result = await tts.synthesize({ text, voiceId, provider, speed, pitch, format });

    logCall({
      requestId: c.get("requestId") ?? "",
      userId: user.userId,
      task: "tts",
      provider: result.provider,
      model: result.voiceId,
      latencyMs: 0,
      cost: 0,
      status: 200,
      usedByok: false,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[tts] Failed:", err);
    return c.json({ error: { message: err.message || "TTS synthesis failed" } }, 500);
  }
});

// ---- POST /v1/upload/audio (用户上传音频持久化) ----
protectedApp.post("/v1/upload/audio", async (c) => {
  const body = await c.req.parseBody();
  const file = body["audio"] as File | undefined;

  if (!file) {
    return c.json({ error: { message: "audio file required" } }, 400);
  }

  const { randomUUID } = await import("crypto");
  const { existsSync, mkdirSync, writeFileSync } = await import("fs");
  const { join, extname } = await import("path");
  const { config: cfg } = await import("./config.js");

  const audioDir = join(cfg.persistenceStorageDir, "audio");
  if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });

  const ext = extname(file.name) || ".mp3";
  const filename = `upload_${randomUUID().slice(0, 8)}${ext}`;
  const filePath = join(audioDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(filePath, buffer);

  return c.json({
    url: `${cfg.persistenceBaseUrl}/audio/${filename}`,
    filename: file.name,
    size: buffer.length,
  });
});

// ---- Admin 路径：手动健康检查 ----
protectedApp.post("/v1/admin/health/:provider", async (c) => {
  const provider = c.req.param("provider") as ProviderId;
  const platformKey = process.env[`${provider.toUpperCase()}_API_KEY`] ?? "test-key";
  const ok = await runHealthCheck(provider, platformKey);
  return c.json({ provider, healthy: ok });
});

// 挂载
app.route("/", protectedApp);

// protectedApp 自己的 notFound (不受保护的路径会走外层 app.notFound)
protectedApp.notFound((c) => {
  return c.json(
    { error: "not found", code: "not_found", path: c.req.path },
    404,
  );
});

/* ==================================================================
 * 派单 16: 统一错误处理 — 把 Provider 错误映射成 HTTP 标准状态码
 *   AuthError           → 401  (key 无效)
 *   RateLimitError      → 429  (限流)
 *   TimeoutError        → 504  (超时)
 *   UpstreamUnavailable → 503  (provider 完全不可用)
 *   UpstreamError       → 502/500  (其他 upstream 错)
 *   其他 ZodError       → 400
 *   其他                → 500
 * ================================================================== */
app.onError((err, c) => {
  process.stderr.write(`[ai-router] error: ${err.message}\n`);

  // 401: 鉴权失败
  if (err instanceof AuthError) {
    return c.json(
      {
        error: "invalid api key",
        code: "auth_failed",
        provider: err.provider,
        model: err.model,
        message: err.message,
      },
      401,
    );
  }

  // 429: 限流
  if (err instanceof RateLimitError) {
    return c.json(
      {
        error: "rate limited by provider",
        code: "rate_limited",
        provider: err.provider,
        model: err.model,
        message: err.message,
      },
      429,
    );
  }

  // 504: 超时
  if (err instanceof TimeoutError) {
    return c.json(
      {
        error: "request timeout",
        code: "timeout",
        provider: err.provider,
        model: err.model,
        message: err.message,
      },
      504,
    );
  }

  // 503: provider 不可用
  if (err instanceof UpstreamUnavailable) {
    return c.json(
      {
        error: "upstream provider unavailable",
        code: "upstream_unavailable",
        provider: err.provider,
        message: err.message,
      },
      503,
    );
  }

  // ProviderError (通用 5xx)
  if (err instanceof ProviderError) {
    const httpStatus = err.status >= 500 ? 502 : err.status;
    return c.json(
      {
        error: "upstream provider error",
        code: "upstream_error",
        provider: err.provider,
        model: err.model,
        upstreamStatus: err.status,
        message: err.message,
      },
      httpStatus as 400 | 401 | 402 | 403 | 404 | 500 | 502 | 503 | 504,
    );
  }

  // UpstreamError (502/500)
  if (err instanceof UpstreamError) {
    return c.json(
      {
        error: "upstream provider error",
        code: "upstream_error",
        message: err.message,
      },
      (err.status >= 500 ? 502 : err.status) as 400 | 401 | 402 | 403 | 404 | 500 | 502 | 503 | 504,
    );
  }

  // 校验错误
  if (err.name === "ZodError") {
    return c.json({ error: "invalid request", code: "bad_request", detail: err.message }, 400);
  }

  // 兜底
  return c.json(
    { error: err.message, code: "internal_error" },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    { error: "not found", code: "not_found", path: c.req.path },
    404,
  );
});

/** Provider 显示名 (派单 16: 给前端 /v1/providers 端点用) */
function providerDisplayName(id: ProviderId): string {
  switch (id) {
    case "minimax": return "MiniMax";
    case "deepseek": return "DeepSeek";
    case "zhipu": return "智谱 GLM";
    case "volcengine": return "火山方舟";
    case "qwen": return "通义千问 (DashScope)";
    case "openai": return "OpenAI";
    case "replicate": return "Replicate";
    case "fal": return "fal.ai";
    case "agnes": return "Agnes AI";
  }
}

// ---- 启动 ----
async function main(): Promise<void> {
  // 初始化 key store（异步，失败不回滚到内存）
  try {
    await keyStore.init();
  } catch (err) {
    process.stderr.write(`[ai-router] keyStore.init failed: ${(err as Error).message}\n`);
  }

  serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      const addr = `${info.address}:${info.port}`;
      process.stdout.write(`[ai-router] listening on http://${addr}\n`);
      process.stdout.write(`[ai-router] providers=${registry.all().length} (${registry.all().map((p) => p.id).join(", ")})\n`);
    },
  );

  // 每 90s 重置熔断：让长时间 unhealthy 的 provider 重新进入半开路（允许一次试探）
  setInterval(() => {
    const now = Date.now();
    for (const h of registry.allHealth()) {
      if (!h.healthy && now - h.lastCheckedAt > 90_000) {
        registry.setHealth({ ...h, healthy: true, consecutiveFailures: 0, lastCheckedAt: 0 });
        process.stderr.write(`[ai-router] circuit-breaker reset: provider=${h.provider}\n`);
      }
    }
  }, 90_000);

  process.stdout.write(`[ai-router] ready port=${config.port} env=${config.nodeEnv}\n`);
}

void main();