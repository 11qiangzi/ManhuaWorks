/**
 * ai-orchestrator 作业编排服务
 *
 * L5-C 任务：把 L3.H 的 5 个 pipeline 包装成 4 个统一作业接口。
 * 暴露：
 *   GET  /health                              → buildHealthChecker().check()
 *   POST /v1/orchestrator/jobs                → 接收 {type, payload, projectId}
 *                                              返回 {jobId, status:"queued"}
 *   GET  /v1/orchestrator/jobs/:id            → 返回 {jobId, status, progress, result?}
 *
 * 作业状态机：queued → running → succeeded / failed
 *
 * 设计：
 *   - 用 Hono 子 app 挂到现有 index.ts 的 Hono 上（共享 port 8087）
 *   - 作业存在内存 Map（单实例够用，跟现有 snapshotStore 思路一致）
 *   - 派发时直接调 PipelineRunner.start()（已有，零改动）
 *   - 错误用 4xx/5xx 显式区分：未知 type → 500，校验失败 → 400，未知 id → 404
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireUser, type AppEnv } from "./middleware/auth.js";
import { PipelineRunner, snapshotStore, type PipelineDefinition } from "./pipeline-runner.js";
import { getBinding, listTypes, tryGetBinding } from "./pipelines/registry.js";

// ---- 作业状态机 ----

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  jobId: string;
  type: string;
  projectId?: string;
  status: JobStatus;
  /** 0-100 */
  progress: number;
  result?: unknown;
  error?: string;
  payload: Record<string, unknown>;
  /** 派发到的底层 pipeline 名 */
  pipeline: string;
  /** 对应的 runId（pipeline-runner 给的） */
  runId?: string;
  createdAt: number;
  updatedAt: number;
}

/** 内存作业表（单实例；多实例换 Redis，跟现有 snapshotStore 同思路） */
class JobStore {
  private map = new Map<string, Job>();

  put(job: Job): void {
    this.map.set(job.jobId, job);
  }

  get(jobId: string): Job | undefined {
    return this.map.get(jobId);
  }

  update(jobId: string, patch: Partial<Job>): Job | undefined {
    const cur = this.map.get(jobId);
    if (!cur) return undefined;
    const next: Job = { ...cur, ...patch, updatedAt: Date.now() };
    this.map.set(jobId, next);
    return next;
  }

  size(): number {
    return this.map.size;
  }
}

const jobStore = new JobStore();

/** 暴露给测试 / 排障用 */
export function getJobStore(): JobStore {
  return jobStore;
}

// ---- Zod 校验 ----

const JobCreateSchema = z.object({
  type: z.enum(["image", "character", "scene", "workflow"]),
  payload: z.record(z.unknown()).default({}),
  projectId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof JobCreateSchema>;

// ---- Runner 缓存（按 pipeline 名）----

const runners = new Map<string, PipelineRunner>();

function getRunner(p: PipelineDefinition): PipelineRunner {
  let r = runners.get(p.name);
  if (!r) {
    r = new PipelineRunner(p);
    runners.set(p.name, r);
  }
  return r;
}

// ---- 子 Hono app ----

/**
 * 构造 orchestrator 子 app
 * 挂到主 Hono 上：`app.route("/", buildOrchestratorServer())`
 */
export function buildOrchestratorServer(opts?: { healthApp?: Hono }): Hono<AppEnv> {
  const sub = new Hono<AppEnv>();

  // GET /health — 兼容旧路径（index.ts 已有自己的 /health，这里再挂一份做 orchestrator 专用）
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
        500,
      );
    }

    const jobId = `job-${nanoid(12)}`;
    const job: Job = {
      jobId,
      type: body.type,
      projectId: body.projectId,
      status: "queued",
      progress: 0,
      payload: body.payload as Record<string, unknown>,
      pipeline: binding.pipelineName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobStore.put(job);

    // 立刻置 running；同步派发（PipelineRunner.start 在内部走 async）
    jobStore.update(jobId, { status: "running", progress: 1 });
    const runner = getRunner(binding.definition);

    runner
      .start({
        pipeline: binding.definition,
        user,
        inputs: body.payload as Record<string, unknown>,
      })
      .then(async (snap) => {
        // 成功 → succeeded + 携带 result
        if (snap.status === "success") {
          jobStore.update(jobId, {
            status: "succeeded",
            progress: 100,
            result: { runId: snap.runId, pipeline: snap.pipeline, steps: snap.steps },
            runId: snap.runId,
          });
        } else {
          jobStore.update(jobId, {
            status: "failed",
            progress: 0,
            error: snap.error ?? `pipeline status=${snap.status}`,
            runId: snap.runId,
          });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        jobStore.update(jobId, { status: "failed", progress: 0, error: msg });
        process.stderr.write(`[orchestrator] job ${jobId} failed: ${msg}\n`);
      });

    // 立即返回 queued 状态（任务派发中）
    return c.json({ jobId, status: "queued" }, 201);
  });

  // GET /v1/orchestrator/jobs/:id
  sub.get("/v1/orchestrator/jobs/:id", (c) => {
    const id = c.req.param("id");
    const job = jobStore.get(id);
    if (!job) {
      return c.json({ error: "not_found", jobId: id }, 404);
    }
    return c.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      pipeline: job.pipeline,
      type: job.type,
      updatedAt: new Date(job.updatedAt).toISOString(),
    });
  });

  return sub;
}

/** 重新导出：让 index.ts / 测试能拿到 binding（少一次 import 路径） */
export { getBinding, listTypes };
