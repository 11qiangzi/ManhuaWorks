/**
 * ai-orchestrator 作业编排服务
 *
 * L5-C 任务：把 L3.H 的 5 个 pipeline 包装成统一作业接口。
 * P2 扩展：新增 one-click-manga + auto-music type + steps[] + WS 进度推送。
 *
 * 暴露：
 *   GET  /health                              → buildHealthChecker().check()
 *   POST /v1/orchestrator/jobs                → 接收 {type, payload, projectId}
 *                                              返回 {jobId, status:"queued"}
 *   GET  /v1/orchestrator/jobs/:id            → 返回 {jobId, status, progress, steps, result?}
 *   GET  /ws/orchestrator/jobs/:jobId         → WebSocket 进度订阅
 *
 * 作业状态机：queued → running → succeeded / failed
 *
 * 设计：
 *   - 用 Hono 子 app 挂到现有 index.ts 的 Hono 上（共享 port 8087）
 *   - 作业存在内存 Map（单实例够用，跟现有 snapshotStore 思路一致）
 *   - 派发时直接调 PipelineRunner.start()（已有，零改动）
 *   - 错误用 4xx/5xx 显式区分：未知 type → 400，校验失败 → 400，未知 id → 404
 *   - WebSocket 通过 Node.js 内置 ws 升级
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { URL } from "url";

import { requireUser, verifyAndDecodeJwt, type AppEnv } from "./middleware/auth.js";
import { config } from "./config.js";
import { PipelineRunner, snapshotStore, type PipelineDefinition } from "./pipeline-runner.js";
import { getBinding, listTypes, tryGetBinding } from "./pipelines/registry.js";
import {
  jobEvents,
  subscribeJob,
  emitJobCompleted,
  emitJobFailed,
  type StepProgressEvent,
} from "./pipelines/job-events.js";

// ---- 作业状态机 ----

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

/** 单步骤状态（P2 扩展） */
export interface JobStep {
  step: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  previewUrl?: string;
  result?: unknown;
  error?: string;
}

export interface Job {
  jobId: string;
  type: string;
  userId: string;
  projectId?: string;
  status: JobStatus;
  /** 0-100 */
  progress: number;
  /** 总步数 */
  totalSteps?: number;
  /** 当前步骤编号 */
  currentStep?: number;
  /** 步骤列表（P2 新增） */
  steps?: JobStep[];
  result?: unknown;
  error?: string;
  payload: Record<string, unknown>;
  /** 派发到的底层 pipeline 名 */
  pipeline: string;
  /** 对应的 runId（pipeline-runner 给的） */
  runId?: string;
  /** 预估耗时（秒） */
  estimatedTime?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 持久化作业存储
 *
 * 与 snapshotStore 用相同的 "data/jobs/" 目录落盘 JSON，
 * 重启后自动加载进行中的 job，保证服务重启不丢状态。
 *
 * 生产可换 Redis，但接口已设计为可替换（同 snapshotStore 思路）。
 */
import { mkdir, readFile, writeFile, readdir, unlink } from "fs/promises";
import { join } from "path";

class JobStore {
  private map = new Map<string, Job>();
  private dir = join("data", "jobs");
  private loaded = false;

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private filePath(jobId: string): string {
    return join(this.dir, `${jobId}.json`);
  }

  /** 从磁盘加载所有已有 job（启动时调用一次） */
  async loadFromDisk(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      await this.ensureDir();
      const files = await readdir(this.dir);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(this.dir, f), "utf-8");
          const job = JSON.parse(raw) as Job;
          // 只恢复还在进行中的 job（已完成/失败的无需恢复）
          if (job.status === "queued" || job.status === "running") {
            job.status = "failed";
            job.error = "服务重启，作业终止";
          }
          this.map.set(job.jobId, job);
        } catch {
          /* skip corrupted files */
        }
      }
      process.stdout.write(
        `[job-store] loaded ${this.map.size} jobs from disk\n`,
      );
    } catch {
      /* 目录不存在等 — 首次启动 */
    }
  }

  put(job: Job): void {
    this.map.set(job.jobId, job);
    // 异步落盘（不阻塞调用方）
    void this.persist(job.jobId);
  }

  get(jobId: string): Job | undefined {
    return this.map.get(jobId);
  }

  update(jobId: string, patch: Partial<Job>): Job | undefined {
    const cur = this.map.get(jobId);
    if (!cur) return undefined;
    const next: Job = { ...cur, ...patch, updatedAt: Date.now() };
    this.map.set(jobId, next);
    // 异步落盘
    void this.persist(jobId);
    return next;
  }

  size(): number {
    return this.map.size;
  }

  /** 删除 job 文件 */
  async delete(jobId: string): Promise<void> {
    this.map.delete(jobId);
    try {
      await unlink(this.filePath(jobId));
    } catch {
      /* file might not exist */
    }
  }

  /** 异步写盘 */
  private async persist(jobId: string): Promise<void> {
    const job = this.map.get(jobId);
    if (!job) return;
    try {
      await this.ensureDir();
      await writeFile(this.filePath(jobId), JSON.stringify(job, null, 2), "utf-8");
    } catch (err) {
      process.stderr.write(
        `[job-store] persist failed for ${jobId}: ${(err as Error).message}\n`,
      );
    }
  }
}

const jobStore = new JobStore();
// 启动时从磁盘恢复 job 状态（重启不丢）
void jobStore.loadFromDisk();

/** 暴露给测试 / 排障用 */
export function getJobStore(): JobStore {
  return jobStore;
}

// ---- Zod 校验 ----

const JobCreateSchema = z.object({
  type: z.enum(["image", "character", "scene", "workflow", "decompose", "compose", "one-click-manga", "auto-music"]),
  payload: z.record(z.unknown()).default({}),
  projectId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof JobCreateSchema>;

// ---- Runner 缓存（全局注册表，与 index.ts 共享）----

import { getRunner } from "./runner-registry.js";

// ---- WS 管理 ----

/** jobId → WebSocket 集合 */
const jobWsClients = new Map<string, Set<WebSocket>>();

/**
 * 注册 WebSocket 升级路由。
 * 需要在 Hono 底层 HTTP server 上监听 upgrade 事件。
 * 调用方在 main() 启动后调用。
 */
export function installWebSocketUpgrade(server: import("http").Server | undefined): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server?.on("upgrade", (req: IncomingMessage, socket: unknown, head: Buffer) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // 只处理 /ws/orchestrator/jobs/:jobId 路径
    const wsMatch = url.pathname.match(/^\/ws\/orchestrator\/jobs\/([a-zA-Z0-9_-]+)$/);
    if (!wsMatch) return;

    const jobId = wsMatch[1];
    const job = jobStore.get(jobId);

    // JWT 校验（从 query param 或 header 取 token）
    const token =
      (url.searchParams.get("token") ?? req.headers.authorization?.replace(/^Bearer\s+/i, "")) ||
      "";

    if (!token) {
      (socket as any).destroy();
      return;
    }

    // 真实 JWT 签名验证
    // dev 模式 "none" 放行；jwt/api-key 模式需要有效 token
    if (config.auth.mode !== "none") {
      const payload = verifyAndDecodeJwt(token);
      if (!payload?.sub) {
        (socket as any).destroy();
        return;
      }

      // 验证用户有权访问该 job
      if (job && payload.sub !== job.userId && payload.tier !== "enterprise") {
        (socket as any).destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket as never, head, (ws) => {
      wss.emit("connection", ws, req, jobId);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, jobId: string) => {
    // 加入该 job 的客户端集合
    if (!jobWsClients.has(jobId)) {
      jobWsClients.set(jobId, new Set());
    }
    jobWsClients.get(jobId)!.add(ws);

    // 订阅 job 事件
    const unsub = subscribeJob(jobId, (ev: StepProgressEvent) => {
      try {
        ws.send(JSON.stringify(ev));
      } catch {
        // ws 已关闭
      }
    });

    // 发送已有状态（如果 job 存在）
    const job = jobStore.get(jobId);
    if (job) {
      ws.send(JSON.stringify({
        type: "job-status",
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        steps: job.steps,
        result: job.result,
        timestamp: Date.now(),
      }));
    }

    ws.on("close", () => {
      unsub();
      const clients = jobWsClients.get(jobId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) jobWsClients.delete(jobId);
      }
    });

    ws.on("error", () => {
      unsub();
      const clients = jobWsClients.get(jobId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) jobWsClients.delete(jobId);
      }
    });
  });

  return wss;
}

// ---- 子 Hono app ----

/**
 * 构造 orchestrator 子 app
 * 挂到主 Hono 上：`app.route("/", buildOrchestratorServer())`
 */
export function buildOrchestratorServer(opts?: { healthApp?: Hono }): Hono<AppEnv> {
  const sub = new Hono<AppEnv>();

  // GET /health — 兼容旧路径
  if (opts?.healthApp) {
    sub.route("/health", opts.healthApp);
  }

  // POST /v1/orchestrator/jobs
  sub.post("/v1/orchestrator/jobs", async (c) => {
    const user = requireUser(c);
    let body: CreateJobInput;
    try {
      body = JobCreateSchema.parse(await c.req.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: "invalid_request", detail: msg }, 400);
    }

    const binding = tryGetBinding(body.type);
    if (!binding) {
      return c.json(
        {
          error: "invalid_type",
          message: `unknown type "${body.type}", valid: ${listTypes().join(", ")}`,
        },
        400,
      );
    }

    const jobId = `job-${nanoid(12)}`;

    // 初始化 steps（P2 扩展）
    const stepDef = binding.definition.steps;
    const mainSteps = stepDef.map((s, i) => ({
      step: i + 1,
      name: s.name,
      status: "pending" as const,
    }));

    const totalSteps = mainSteps.length;
    const estimatedTime = estimateJobTime(body.type);

    const job: Job = {
      jobId,
      type: body.type,
      userId: user.userId,
      projectId: body.projectId,
      status: "queued",
      progress: 0,
      totalSteps,
      currentStep: 0,
      steps: mainSteps,
      payload: {
        ...(body.payload as Record<string, unknown>),
        _jobId: jobId, // 注入 jobId 到 payload，供 step emit 使用
      },
      pipeline: binding.pipelineName,
      estimatedTime,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobStore.put(job);

    // 立刻置 running；异步派发
    jobStore.update(jobId, { status: "running", progress: 1, currentStep: 0 });
    const runner = getRunner(binding.definition);

    runner
      .start({
        pipeline: binding.definition,
        user,
        inputs: { ...(body.payload as Record<string, unknown>), _jobId: jobId },
      })
      .then(async (snap) => {
        // 从 snapshot 重建步骤状态
        const updatedSteps = mainSteps.map((s) => {
          const snapStep = snap.steps[s.name];
          return {
            ...s,
            status: snapStep?.status === "success" ? "completed" as const
                  : snapStep?.status === "failed" ? "failed" as const
                  : "pending" as const,
            error: snapStep?.error,
          };
        });

        if (snap.status === "success") {
          const result = { runId: snap.runId, pipeline: snap.pipeline, steps: snap.steps, outputs: getStepOutputs(snap) };
          jobStore.update(jobId, {
            status: "succeeded",
            progress: 100,
            currentStep: totalSteps,
            steps: updatedSteps,
            result,
            runId: snap.runId,
          });
          emitJobCompleted(jobId, result);
        } else {
          jobStore.update(jobId, {
            status: "failed",
            progress: 0,
            steps: updatedSteps,
            error: snap.error ?? `pipeline status=${snap.status}`,
            runId: snap.runId,
          });
          emitJobFailed(jobId, snap.error ?? "unknown error");
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        jobStore.update(jobId, { status: "failed", progress: 0, error: msg });
        emitJobFailed(jobId, msg);
        process.stderr.write(`[orchestrator] job ${jobId} failed: ${msg}\n`);
      });

    // 立即返回 queued 状态
    return c.json({
      code: 0,
      message: "ok",
      data: {
        jobId,
        status: "queued",
        type: body.type,
        estimatedTime,
        createdAt: new Date(job.createdAt).toISOString(),
      },
    }, 201);
  });

  // GET /v1/orchestrator/jobs/:id/status — 前端轮询fallback (B2)
  sub.get("/v1/orchestrator/jobs/:id/status", (c) => {
    const id = c.req.param("id");
    const job = jobStore.get(id);
    if (!job) {
      return c.json({ code: 404, error: "not_found", jobId: id }, 404);
    }
    return c.json({
      code: 0,
      message: "ok",
      data: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        steps: job.steps,
      },
    });
  });

  // GET /v1/orchestrator/jobs/:id
  sub.get("/v1/orchestrator/jobs/:id", (c) => {
    const id = c.req.param("id");
    const job = jobStore.get(id);
    if (!job) {
      return c.json({ code: 404, error: "not_found", jobId: id }, 404);
    }
    return c.json({
      code: 0,
      message: "ok",
      data: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        steps: job.steps,
        result: job.result,
        error: job.error,
        pipeline: job.pipeline,
        projectId: job.projectId,
        estimatedTime: job.estimatedTime,
        createdAt: new Date(job.createdAt).toISOString(),
        updatedAt: new Date(job.updatedAt).toISOString(),
      },
    });
  });

  return sub;
}

// ---- 工具函数 ----

/** 提取 snapshot 各 step 的 outputs（用于 API 响应） */
function getStepOutputs(snap: import("./pipeline-runner.js").RunSnapshot): Record<string, unknown> {
  const outs: Record<string, unknown> = {};
  for (const [name, step] of Object.entries(snap.steps)) {
    if (step.outputs) outs[name] = step.outputs;
  }
  return outs;
}

/** 按 job type 估计耗时（秒） */
function estimateJobTime(type: string): number {
  switch (type) {
    case "one-click-manga": return 600; // 10 min
    case "auto-music": return 60;      // 1 min
    case "image": return 60;
    case "character": return 120;
    case "scene": return 120;
    case "workflow": return 600;
    case "decompose": return 60;
    case "compose": return 120;
    default: return 120;
  }
}

/** 重新导出：让 index.ts / 测试能拿到 binding（少一次 import 路径） */
export { getBinding, listTypes };
