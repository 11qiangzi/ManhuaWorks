/**
 * AI Generation Task Manager
 *
 * 统一管理所有 AI 生成任务（image/video/audio/tts）的生命周期：
 *   - 提交任务到各 provider (Seedance, Seedream, MiniMax, etc.)
 *   - 指数退避轮询结果
 *   - 结果落库到本地存储（video URL 24h 过期）
 *   - 请求去重（相同 prompt+params = 相同 hash）
 *   - WebSocket 推送实时状态更新（预留接口）
 *
 * PostgreSQL 持久化实现 (generation_tasks 表)。
 */

import { createHash } from "node:crypto";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { generationTasks } from "./db/schema.js";
import type { GenerationTaskRow } from "./db/schema.js";
import { aiRouterClient, type ProviderId } from "./clients/ai-router.js";

// ====================================================================
// Types
// ====================================================================

export type TaskType = "image" | "video" | "audio" | "tts";
export type Provider = "seedream" | "seedance" | "minimax" | "volcengine" | "suno" | "openai";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "expired" | "cancelled";

export interface CraftPrompt {
  context?: string;
  reference?: string;
  action?: string;
  framing?: string;
  timing?: string;
}

export interface ReferenceImage {
  url: string;
  role: string;
}

export interface GenerationRequest {
  userId: string;
  projectId?: string;
  taskType: TaskType;
  provider: Provider;
  model?: string;
  prompt: string;
  craftPrompt?: CraftPrompt;
  referenceImages?: ReferenceImage[];
  parameters: Record<string, unknown>;
}

export interface GenerationTask {
  id: string;
  userId: string;
  projectId?: string;

  taskType: TaskType;
  provider: Provider;
  model?: string;

  prompt: string;
  craftPrompt?: CraftPrompt;
  referenceImages?: ReferenceImage[];
  parameters: Record<string, unknown>;

  requestHash: string;

  providerTaskId?: string;
  status: TaskStatus;
  progress: number;
  errorMessage?: string;
  errorCode?: string;

  resultUrl?: string;
  resultStoredUrl?: string;
  resultMetadata?: Record<string, unknown>;
  lastFrameUrl?: string;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  updatedAt: string;
}

/** WebSocket 推送回调（由调用方注入） */
export type StatusPushCallback = (taskId: string, status: TaskStatus, progress: number) => void;

// ====================================================================
// Row → DTO Mapper
// ====================================================================

function rowToTask(row: GenerationTaskRow): GenerationTask {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId ?? undefined,
    taskType: row.taskType,
    provider: row.provider,
    model: row.model ?? undefined,
    prompt: row.prompt,
    craftPrompt: (row.craftPrompt as CraftPrompt) ?? undefined,
    referenceImages: (row.referenceImages as ReferenceImage[]) ?? undefined,
    parameters: (row.parameters as Record<string, unknown>) ?? {},
    requestHash: row.requestHash,
    providerTaskId: row.providerTaskId ?? undefined,
    status: row.status,
    progress: row.progress ?? 0,
    errorMessage: row.errorMessage ?? undefined,
    errorCode: row.errorCode ?? undefined,
    resultUrl: row.resultUrl ?? undefined,
    resultStoredUrl: row.resultStoredUrl ?? undefined,
    resultMetadata: (row.resultMetadata as Record<string, unknown>) ?? undefined,
    lastFrameUrl: row.lastFrameUrl ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    startedAt: row.startedAt?.toISOString() ?? undefined,
    completedAt: row.completedAt?.toISOString() ?? undefined,
    expiresAt: row.expiresAt?.toISOString() ?? undefined,
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ====================================================================
// Request Hash
// ====================================================================

/**
 * 计算请求去重 hash: SHA256(prompt + JSON.stringify(parameters) + userId)
 */
function computeRequestHash(prompt: string, parameters: Record<string, unknown>, userId: string): string {
  const raw = prompt + JSON.stringify(parameters) + userId;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// ====================================================================
// Provider Layer — 通过 ai-router 调用真实 AI 服务
// ====================================================================

interface ProviderSubmitResult {
  providerTaskId: string;
}

interface ProviderPollResult {
  status: "running" | "succeeded" | "failed";
  progress: number;
  resultUrl?: string;
  resultMetadata?: Record<string, unknown>;
  lastFrameUrl?: string;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * 异步任务结果缓存：providerTaskId → Promise<结果>
 * 桥接 ai-router 同步 API 与 submit+poll 异步模式
 */
interface ResolvedResult {
  resultUrl: string;
  resultMetadata: Record<string, unknown>;
  lastFrameUrl?: string;
}

const pendingPromises = new Map<string, Promise<ResolvedResult>>();

/**
 * Provider 映射：orchestrator provider → ai-router preferredProviders
 */
function mapProviderToRouter(provider: Provider): { preferredProviders?: ProviderId[] } {
  switch (provider) {
    case "seedream":
    case "seedance":
    case "volcengine":
      return { preferredProviders: ["volcengine"] };
    case "minimax":
      return { preferredProviders: ["minimax"] };
    // openai/suno: 不在 ai-router 当前 provider 列表中，使用默认路由策略
    default:
      return {};
  }
}

/**
 * 提交任务到 ai-router（真实 AI 服务调用）。
 *
 * 流程：
 *   1. 根据 taskType 调用对应的 ai-router 端点（image/video/audio/chat）
 *   2. 异步执行，立即返回 providerTaskId
 *   3. 后台 promise 完成后存入 pendingPromises，等待 poll 取结果
 */
async function submitToProvider(req: GenerationRequest): Promise<ProviderSubmitResult> {
  const providerTaskId = `${req.provider}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  process.stdout.write(
    `[generation] submit to ${req.provider} via ai-router: taskType=${req.taskType} model=${req.model ?? "default"} ` +
    `prompt="${req.prompt.slice(0, 80)}${req.prompt.length > 80 ? "..." : ""}" → providerTaskId=${providerTaskId}\n`,
  );

  // 构造 ai-router 请求参数
  const routerOpts = mapProviderToRouter(req.provider);
  const params = req.parameters ?? {};

  // 在后台异步执行 ai-router 调用（不阻塞 submit 返回）
  const resultPromise = (async (): Promise<ResolvedResult> => {
    switch (req.taskType) {
      case "image": {
        const resp = await aiRouterClient.image({
          model: req.model,
          prompt: req.prompt,
          size: (params.size as string) ?? "1024x1024",
          n: (params.n as number) ?? 1,
          ...routerOpts,
          taskTag: `gen-task:${providerTaskId}`,
        });
        const url = resp.urls?.[0] ?? "";
        return {
          resultUrl: url,
          resultMetadata: {
            provider: resp.provider,
            model: resp.model,
            cost: resp.cost,
            latencyMs: resp.latencyMs,
            urls: resp.urls,
          },
        };
      }
      case "video": {
        const resp = await aiRouterClient.video({
          model: req.model,
          prompt: req.prompt,
          durationSeconds: (params.durationSeconds as number) ?? 5,
          resolution: (params.resolution as string) ?? "1280x720",
          ...routerOpts,
          taskTag: `gen-task:${providerTaskId}`,
        });
        return {
          resultUrl: resp.url,
          resultMetadata: {
            provider: resp.provider,
            model: resp.model,
            cost: resp.cost,
            latencyMs: resp.latencyMs,
          },
        };
      }
      case "audio":
      case "tts": {
        const resp = await aiRouterClient.audio({
          model: req.model,
          prompt: req.prompt,
          style: (params.style as string) ?? undefined,
          durationSeconds: (params.durationSeconds as number) ?? undefined,
          ...routerOpts,
          taskTag: `gen-task:${providerTaskId}`,
        });
        return {
          resultUrl: resp.url,
          resultMetadata: {
            provider: resp.provider,
            model: resp.model,
            cost: resp.cost,
            latencyMs: resp.latencyMs,
            durationSeconds: resp.durationSeconds,
          },
        };
      }
      default:
        throw new Error(`Unsupported task type: ${req.taskType}`);
    }
  })();

  // 存储 promise，供后续 poll 取结果
  pendingPromises.set(providerTaskId, resultPromise);

  return { providerTaskId };
}

/**
 * 轮询 ai-router 异步结果。
 *
 * 桥接逻辑：
 *   - 如果 promise 尚未 resolve → 返回 running(50%)
 *   - 如果 promise 已 resolve → 返回 succeeded(100%) + 结果
 *   - 如果 promise rejected → 返回 failed + 错误信息
 */
async function pollProvider(providerTaskId: string): Promise<ProviderPollResult> {
  const promise = pendingPromises.get(providerTaskId);

  if (!promise) {
    // 可能是服务重启后遗留的任务，promise 已丢失
    return {
      status: "failed",
      progress: 0,
      errorMessage: "Provider task promise lost (possible server restart)",
      errorCode: "PROMISE_LOST",
    };
  }

  // 用 Promise.race 做非阻塞检查
  const result = await Promise.race([
    promise.then(
      (r) => ({ settled: true as const, value: r }),
      (e) => ({ settled: true as const, error: e instanceof Error ? e : new Error(String(e)) }),
    ),
    Promise.resolve({ settled: false as const }),
  ]);

  if (!result.settled) {
    return { status: "running", progress: 50 };
  }

  // 结果已出，清理 promise 缓存
  pendingPromises.delete(providerTaskId);

  if ("error" in result) {
    return {
      status: "failed",
      progress: 0,
      errorMessage: result.error.message,
      errorCode: "AI_ROUTER_FAILED",
    };
  }

  const resolved = result.value;
  return {
    status: "succeeded",
    progress: 100,
    resultUrl: resolved.resultUrl,
    resultMetadata: resolved.resultMetadata,
    lastFrameUrl: resolved.lastFrameUrl,
  };
}

/**
 * 结果落库：当前直接返回原始 URL。
 * TODO: 后续实现下载到 OSS/CDN 持久化存储。
 */
async function storeResultLocally(resultUrl: string, _providerTaskId: string): Promise<string> {
  process.stdout.write(
    `[generation] result URL: ${resultUrl} (OSS upload not yet implemented, returning provider URL)\n`,
  );
  return resultUrl;
}

// ====================================================================
// Status Push (WebSocket placeholder)
// ====================================================================

let statusPushCallback: StatusPushCallback | null = null;

/**
 * 注册 WebSocket 推送回调。
 * 调用方（如 HTTP server 或 WS server）可注入实现，实现实时状态推送。
 */
export function setStatusPushCallback(cb: StatusPushCallback | null): void {
  statusPushCallback = cb;
}

function pushStatus(taskId: string, status: TaskStatus, progress: number): void {
  if (statusPushCallback) {
    try {
      statusPushCallback(taskId, status, progress);
    } catch {
      // 推送失败不影响主流程
    }
  }
}

// ====================================================================
// Core API (PostgreSQL-backed)
// ====================================================================

/**
 * 提交生成任务。
 *
 * 1. 计算 request_hash 去重
 * 2. 检查是否存在相同活跃任务 → 复用
 * 3. 创建新任务记录
 * 4. 提交到 provider
 * 5. 返回任务记录
 */
export async function submitTask(req: GenerationRequest): Promise<GenerationTask> {
  // 1. Compute hash
  const requestHash = computeRequestHash(req.prompt, req.parameters, req.userId);

  // 2. Check dedup — look for existing active task with same hash
  const [existing] = await db
    .select()
    .from(generationTasks)
    .where(
      and(
        eq(generationTasks.requestHash, requestHash),
        inArray(generationTasks.status, ["queued", "running", "succeeded"]),
      ),
    )
    .limit(1);

  if (existing) {
    process.stdout.write(
      `[generation] dedup hit: returning existing task ${existing.id} (status=${existing.status})\n`,
    );
    return rowToTask(existing);
  }

  // 3. Create task record in DB
  const [inserted] = await db
    .insert(generationTasks)
    .values({
      userId: req.userId,
      projectId: req.projectId ?? null,
      taskType: req.taskType,
      provider: req.provider,
      model: req.model ?? null,
      prompt: req.prompt,
      craftPrompt: req.craftPrompt ?? undefined,
      referenceImages: req.referenceImages ?? undefined,
      parameters: req.parameters,
      requestHash,
      status: "queued",
      progress: 0,
    })
    .returning();

  const task = rowToTask(inserted);

  // 4. Submit to provider
  try {
    const { providerTaskId } = await submitToProvider(req);

    const [updated] = await db
      .update(generationTasks)
      .set({
        providerTaskId,
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(generationTasks.id, task.id))
      .returning();

    pushStatus(task.id, "running", 0);

    return rowToTask(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [updated] = await db
      .update(generationTasks)
      .set({
        status: "failed",
        errorMessage: message,
        errorCode: "PROVIDER_SUBMIT_FAILED",
      })
      .where(eq(generationTasks.id, task.id))
      .returning();

    pushStatus(task.id, "failed", 0);
    return rowToTask(updated);
  }
}

/**
 * 获取单个任务。
 */
export async function getTask(taskId: string): Promise<GenerationTask | null> {
  const [row] = await db
    .select()
    .from(generationTasks)
    .where(eq(generationTasks.id, taskId))
    .limit(1);
  return row ? rowToTask(row) : null;
}

/**
 * 列出用户任务（支持 project/status/分页过滤）。
 */
export async function listTasks(
  userId: string,
  opts: { projectId?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: GenerationTask[]; total: number }> {
  const conditions = [eq(generationTasks.userId, userId)];
  if (opts.projectId) {
    conditions.push(eq(generationTasks.projectId, opts.projectId));
  }
  if (opts.status) {
    conditions.push(eq(generationTasks.status, opts.status as TaskStatus));
  }

  const where = and(...conditions);
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(generationTasks)
      .where(where)
      .orderBy(desc(generationTasks.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(generationTasks)
      .where(where),
  ]);

  return {
    items: items.map(rowToTask),
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * 取消任务。
 * 只有 queued/running 状态的任务可以被取消。
 */
export async function cancelTask(taskId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(generationTasks)
    .set({
      status: "cancelled" as TaskStatus,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(generationTasks.id, taskId),
        eq(generationTasks.userId, userId),
        inArray(generationTasks.status, ["queued", "running"]),
      ),
    )
    .returning();

  if (result.length === 0) return false;

  const task = rowToTask(result[0]);
  process.stdout.write(`[generation] task ${taskId} cancelled by user ${userId}\n`);
  pushStatus(taskId, "cancelled", task.progress);

  return true;
}

/**
 * 轮询并更新单个任务状态。
 *
 * 1. 查询 provider 获取最新状态
 * 2. 更新本地记录
 * 3. 成功时下载结果到本地存储
 * 4. 视频类型时记录 last_frame_url
 */
export async function pollAndUpdate(taskId: string): Promise<GenerationTask> {
  const [row] = await db
    .select()
    .from(generationTasks)
    .where(eq(generationTasks.id, taskId))
    .limit(1);

  if (!row) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const task = rowToTask(row);

  if (task.status !== "queued" && task.status !== "running") {
    return task;
  }

  if (!task.providerTaskId) {
    throw new Error(`Task ${taskId} has no providerTaskId, cannot poll`);
  }

  try {
    const result = await pollProvider(task.providerTaskId);

    if (result.status === "running") {
      const [updated] = await db
        .update(generationTasks)
        .set({ progress: result.progress })
        .where(eq(generationTasks.id, taskId))
        .returning();
      pushStatus(taskId, "running", result.progress);
      return rowToTask(updated);
    }

    if (result.status === "succeeded") {
      let resultStoredUrl: string | undefined;

      // Download result to local storage
      if (result.resultUrl) {
        resultStoredUrl = await storeResultLocally(result.resultUrl, task.providerTaskId);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

      const [updated] = await db
        .update(generationTasks)
        .set({
          status: "succeeded",
          progress: 100,
          completedAt: new Date(),
          expiresAt,
          resultUrl: result.resultUrl ?? null,
          resultStoredUrl: resultStoredUrl ?? null,
          resultMetadata: result.resultMetadata ?? undefined,
          lastFrameUrl: task.taskType === "video" ? (result.lastFrameUrl ?? null) : null,
        })
        .where(eq(generationTasks.id, taskId))
        .returning();

      pushStatus(taskId, "succeeded", 100);
      return rowToTask(updated);
    }

    // failed
    const [updated] = await db
      .update(generationTasks)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: result.errorMessage ?? "Provider reported failure",
        errorCode: result.errorCode ?? "PROVIDER_FAILED",
      })
      .where(eq(generationTasks.id, taskId))
      .returning();

    pushStatus(taskId, "failed", result.progress);
    return rowToTask(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[generation] poll error for task ${taskId}: ${message}\n`);
    // Don't fail the task on poll errors — they may be transient
    return task;
  }
}

// ====================================================================
// Background Poller (exponential backoff)
// ====================================================================

interface PollerOptions {
  /** 初始轮询间隔 (ms), 默认 2000 */
  initialIntervalMs?: number;
  /** 最大轮询间隔 (ms), 默认 60000 */
  maxIntervalMs?: number;
  /** 退避乘数, 默认 1.5 */
  backoffMultiplier?: number;
}

let pollerTimer: ReturnType<typeof setInterval> | null = null;
let pollerRunning = false;

/**
 * 启动后台轮询器。
 * 定期扫描所有活跃任务，执行 pollAndUpdate。
 * 使用指数退避避免过度请求 provider。
 */
export function startBackgroundPoller(opts: PollerOptions = {}): void {
  if (pollerRunning) return;
  pollerRunning = true;

  const initialMs = opts.initialIntervalMs ?? 2_000;
  const maxMs = opts.maxIntervalMs ?? 60_000;
  const multiplier = opts.backoffMultiplier ?? 1.5;

  /** 每个任务的连续 poll 次数（用于计算退避） */
  const taskPollCounts = new Map<string, number>();

  async function tick(): Promise<void> {
    // Query active tasks from DB using partial index
    let activeRows: GenerationTaskRow[];
    try {
      activeRows = await db
        .select()
        .from(generationTasks)
        .where(inArray(generationTasks.status, ["queued", "running"]));
    } catch {
      // DB connection issue — skip this tick
      return;
    }

    for (const row of activeRows) {
      const task = rowToTask(row);
      const count = taskPollCounts.get(task.id) ?? 0;
      const interval = Math.min(initialMs * Math.pow(multiplier, count), maxMs);
      const elapsed = Date.now() - new Date(task.updatedAt).getTime();

      if (elapsed >= interval) {
        taskPollCounts.set(task.id, count + 1);
        try {
          const updated = await pollAndUpdate(task.id);
          // 任务完成后清除计数
          if (updated.status !== "queued" && updated.status !== "running") {
            taskPollCounts.delete(task.id);
          }
        } catch {
          // pollAndUpdate handles its own errors
        }
      }
    }
  }

  // Run tick every second; each task manages its own backoff
  pollerTimer = setInterval(() => {
    void tick();
  }, 1000);

  process.stdout.write(
    `[generation] background poller started (initial=${initialMs}ms, max=${maxMs}ms, multiplier=${multiplier})\n`,
  );
}

/**
 * 停止后台轮询器。
 */
export function stopBackgroundPoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
  }
  pollerRunning = false;
  process.stdout.write(`[generation] background poller stopped\n`);
}

// ====================================================================
// Exports for testing
// ====================================================================

export { computeRequestHash as _computeRequestHash };
