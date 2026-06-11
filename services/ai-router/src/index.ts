// AI Router 服务入口
// 端口 8082，挂在 API 网关之后

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";

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

import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  VideoRequest,
  VideoResponse,
  ProviderId,
} from "./types.js";

const app = new Hono<AppEnv>();

// ---- 全局中间件 ----
app.use("*", loggerMiddleware);

// ---- Zod 校验 schema ----
const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
});

const ChatBodySchema = z.object({
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(["minimax", "deepseek", "zhipu", "volcengine"])).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

const EmbedBodySchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string()).min(1)]),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(["minimax", "deepseek", "zhipu", "volcengine"])).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

const ImageBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  size: z.string().optional(),
  n: z.number().int().min(1).max(4).optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(["minimax", "deepseek", "zhipu", "volcengine"])).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

const VideoBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  resolution: z.string().optional(),
  strategy: z.enum(["cost", "speed", "quality", "failover"]).optional(),
  preferredProviders: z.array(z.enum(["minimax", "deepseek", "zhipu", "volcengine"])).optional(),
  useByok: z.boolean().optional(),
  taskTag: z.string().optional(),
});

// ---- 健康检查（公开） ----
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "ai-router",
    port: config.port,
    providers: registry.allHealth(),
    cacheSize: 0, // async; 简化不阻塞
    timestamp: Date.now(),
  });
});

// ---- 受保护路由：auth + rate limit ----
const protectedApp = new Hono<AppEnv>();
protectedApp.use("*", trustInternalMiddleware);
protectedApp.use("*", authMiddleware);
protectedApp.use("*", rateLimitMiddleware);

// ---- POST /v1/chat ----
protectedApp.post("/v1/chat", async (c) => {
  const user = c.get("user")!;
  const body = ChatBodySchema.parse(await c.req.json());

  // 缓存键：模型 + messages + strategy
  const cacheKey = RequestCache.keyFor("chat", {
    model: body.model ?? null,
    strategy: body.strategy ?? "balanced",
    preferred: body.preferredProviders ?? [],
    messages: body.messages,
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
      if (!providerInst) throw new Error(`provider not found: ${provider}`);
      const resp = await providerInst.chat({ ...req, model: modelId }, key.apiKey);
      // 标记 usedByok
      resp.usedByok = key.usedByok;
      // 记账
      await keyManager.recordUsage(key.keyId, resp.cost);
      return resp;
    },
  );

  await requestCache.set(cacheKey, value);

  // 调用日志
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
      if (!providerInst) throw new Error(`provider not found: ${provider}`);
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
    strategy: body.strategy,
    preferredProviders: body.preferredProviders as ProviderId[] | undefined,
    useByok: body.useByok,
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
      if (!providerInst) throw new Error(`provider not found: ${provider}`);
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
      if (!providerInst) throw new Error(`provider not found: ${provider}`);
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

// ---- BYOK 管理（简单实现，admin/user 路径） ----
const ByokAddSchema = z.object({
  providerId: z.enum(["minimax", "deepseek", "zhipu", "volcengine"]),
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

protectedApp.delete("/v1/keys/byok/:keyId", async (c) => {
  const user = c.get("user")!;
  const keyId = c.req.param("keyId");
  await byokResolver.removeByok({ userId: user.userId, keyId });
  return c.json({ ok: true });
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

// ---- 错误处理 ----
app.onError((err, c) => {
  process.stderr.write(`[ai-router] error: ${err.message}\n`);
  if (err.name === "ZodError") {
    return c.json({ error: "invalid request", detail: err.message }, 400);
  }
  return c.json({ error: err.message }, 500);
});

app.notFound((c) => {
  return c.json({ error: "not found", path: c.req.path }, 404);
});

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
    },
  );
  process.stdout.write(`[ai-router] ready port=${config.port} env=${config.nodeEnv}\n`);
}

void main();
