/**
 * Pipeline 统一执行器
 * 封装：
 *   - 状态机（pending → running → success / failed / cancelled）
 *   - 步骤串联（带依赖 + 重试 + 跳过）
 *   - 成本追踪（注入 CostTracker）
 *   - 快照（run 状态 + 步骤 outputs，方便 resume）
 *   - 异常补偿：失败步骤保留输出 + 错误信息，resume 时可指定 fromStep
 *
 * 内存存储为主（单实例）；生产可换 Redis，但接口已抽象为 SnapshotStore。
 */

import { nanoid } from "nanoid";
import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { config } from "./config.js";
import { CostTracker } from "./cost-tracker.js";
import { checkQuota, type QuotaPolicy, type QuotaDenialReason } from "./quota.js";
import type { AuthUser, UserTier } from "./middleware/auth.js";

export type QuotaKind = "tokens" | "images" | "videos";

/** Map step name → quota kind for billing consumption */
function getQuotaKind(stepName: string): QuotaKind {
  const imageSteps = new Set(["image-gen", "detect-style", "regen-frames"]);
  const videoSteps = new Set(["video-gen", "rerender-videos", "regen-videos"]);
  if (imageSteps.has(stepName)) return "images";
  if (videoSteps.has(stepName)) return "videos";
  return "tokens";
}

/**
 * 配额消耗调用
 * - free/pro 用户：strict 模式 → 失败抛错阻断 pipeline
 * - business/enterprise 用户：best-effort 模式 → 失败仅 log 不阻断
 */
async function consumeQuota(
  userId: string,
  stepName: string,
  amount: number,
  userTier: string,
): Promise<void> {
  const kind = getQuotaKind(stepName);
  const isStrict = userTier === "free" || userTier === "pro";
  try {
    const res = await fetch(`${config.billing.url}/api/v1/quota/consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({ kind, amount }),
      signal: AbortSignal.timeout(config.billing.timeoutMs),
    });
    if (!res.ok) {
      const msg = `[quota-consume] billing-service returned ${res.status} for user=${userId} step=${stepName} kind=${kind}`;
      process.stderr.write(`${msg}\n`);
      if (isStrict) {
        throw new Error(`配额消耗失败: ${res.status}`);
      }
    }
  } catch (err) {
    const msg = `[quota-consume] failed for user=${userId} step=${stepName}: ${(err as Error).message}`;
    process.stderr.write(`${msg}\n`);
    if (isStrict) {
      throw err;
    }
  }
}

export type RunStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface PipelineStep {
  /** 步骤名（在 pipeline 内唯一） */
  name: string;
  /** 执行函数：拿到上游 outputs + 上下文，返回本步 outputs */
  run: (ctx: StepContext) => Promise<Record<string, unknown>>;
  /** 是否允许失败（true 则失败不中断 pipeline） */
  optional?: boolean;
  /** 重试次数（默认 0） */
  retries?: number;
  /** 依赖的步骤名（必须全部成功） */
  dependsOn?: string[];
}

export interface StepContext {
  runId: string;
  user: AuthUser;
  pipeline: string;
  inputs: Record<string, unknown>;
  /** 上游步骤输出（按名） */
  prev: Record<string, Record<string, unknown>>;
  /** 成本追踪器 */
  cost: CostTracker;
  /** 步骤级 abort signal（cancel 时触发） */
  signal: AbortSignal;
}

export interface StepResult {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  outputs?: Record<string, unknown>;
  error?: string;
  costUsd: number;
  latencyMs: number;
  startedAt: number;
  finishedAt?: number;
  attempt: number;
}

export interface PipelineDefinition {
  name: string;
  steps: PipelineStep[];
}

export interface RunSnapshot {
  runId: string;
  pipeline: string;
  userId: string;
  tier: UserTier;
  status: RunStatus;
  inputs: Record<string, unknown>;
  steps: Record<string, StepResult>;
  costSummary: ReturnType<CostTracker["summarize"]>;
  createdAt: number;
  updatedAt: number;
  quotaPolicy: QuotaPolicy;
  quotaDenial?: { reason: QuotaDenialReason; detail: string };
  error?: string;
}

export interface SnapshotStore {
  save(snap: RunSnapshot): Promise<void>;
  load(runId: string): Promise<RunSnapshot | null>;
  delete(runId: string): Promise<void>;
  listActive(): Promise<RunSnapshot[]>;
  listByUser(userId: string, limit?: number): Promise<RunSnapshot[]>;
}

/** File-based snapshot store — persists each run as a JSON file under data/snapshots/ */
class FileSnapshotStore implements SnapshotStore {
  private dir = join("data", "snapshots");

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private filePath(runId: string): string {
    return join(this.dir, `${runId}.json`);
  }

  async save(snap: RunSnapshot): Promise<void> {
    await this.ensureDir();
    snap.updatedAt = Date.now();
    await writeFile(this.filePath(snap.runId), JSON.stringify(snap, null, 2), "utf-8");
  }

  async load(runId: string): Promise<RunSnapshot | null> {
    try {
      const raw = await readFile(this.filePath(runId), "utf-8");
      return JSON.parse(raw) as RunSnapshot;
    } catch {
      return null;
    }
  }

  async delete(runId: string): Promise<void> {
    try {
      await unlink(this.filePath(runId));
    } catch {
      /* ignore if file does not exist */
    }
  }

  async listActive(): Promise<RunSnapshot[]> {
    const all = await this.loadAll();
    return all.filter((s) => s.status === "running" || s.status === "pending");
  }

  async listByUser(userId: string, limit = 50): Promise<RunSnapshot[]> {
    const all = await this.loadAll();
    return all
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  private async loadAll(): Promise<RunSnapshot[]> {
    await this.ensureDir();
    try {
      const files = await readdir(this.dir);
      const results: RunSnapshot[] = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(this.dir, f), "utf-8");
          results.push(JSON.parse(raw) as RunSnapshot);
        } catch {
          /* skip corrupted files */
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}

export const snapshotStore: SnapshotStore = new FileSnapshotStore();

export interface StartRunInput {
  pipeline: PipelineDefinition;
  user: AuthUser;
  inputs: Record<string, unknown>;
  /** 预扣配额（已用），用于 quota 校验 */
  monthlyUsedUsd?: number;
  /** 用户当前在飞 run 数 */
  activeRuns?: number;
}

export class PipelineRunner {
  private ac = new AbortController();
  private inFlight: Promise<RunSnapshot> | null = null;

  constructor(private readonly def: PipelineDefinition) {}

  /** 开始一次 run */
  async start(input: StartRunInput): Promise<RunSnapshot> {
    if (this.inFlight) return this.inFlight;

    const runId = `orch-${nanoid(12)}`;
    const now = Date.now();

    // 预 quota 校验
    const quota = checkQuota({
      tier: input.user.tier,
      pipeline: this.def.name,
      estimatedCostUsd: estimatePipelineCost(this.def),
      activeRuns: input.activeRuns ?? 0,
      monthlyUsed: input.monthlyUsedUsd ?? 0,
    });

    const snap: RunSnapshot = {
      runId,
      pipeline: this.def.name,
      userId: input.user.userId,
      tier: input.user.tier,
      status: "pending",
      inputs: input.inputs,
      steps: Object.fromEntries(this.def.steps.map((s) => [s.name, blankStep(s.name)])),
      costSummary: blankSummary(),
      createdAt: now,
      updatedAt: now,
      quotaPolicy: quota.ok ? quota.policy : quota.policy,
    };

    if (!quota.ok) {
      snap.status = "failed";
      snap.quotaDenial = { reason: quota.reason, detail: quota.detail };
      snap.error = `quota denied: ${quota.reason} (${quota.detail})`;
      await snapshotStore.save(snap);
      return snap;
    }

    await snapshotStore.save(snap);
    this.inFlight = this.execute(runId, input).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** 取消 in-flight run */
  cancel(): void {
    this.ac.abort();
  }

  private async execute(runId: string, input: StartRunInput): Promise<RunSnapshot> {
    const snap = await snapshotStore.load(runId);
    if (!snap) throw new Error(`snapshot missing: ${runId}`);

    snap.status = "running";
    await snapshotStore.save(snap);

    const cost = new CostTracker({ runId, userId: input.user.userId });
    const stepOutputs: Record<string, Record<string, unknown>> = {};
    const stepDefs = this.def.steps;

    try {
      for (const step of stepDefs) {
        if (this.ac.signal.aborted) {
          snap.steps[step.name].status = "skipped";
          snap.steps[step.name].error = "cancelled";
          continue;
        }

        // 依赖未完成 → 跳过
        if (step.dependsOn && step.dependsOn.length > 0) {
          const depsFailed = step.dependsOn.some((d) => snap.steps[d]?.status === "failed");
          if (depsFailed) {
            snap.steps[step.name].status = "skipped";
            snap.steps[step.name].error = "dependency failed";
            continue;
          }
        }

        // 超 maxSteps 防御
        if (Object.keys(snap.steps).length > config.pipeline.maxSteps) {
          throw new Error(`exceeded maxSteps ${config.pipeline.maxSteps}`);
        }

        const prev: Record<string, Record<string, unknown>> = {};
        if (step.dependsOn) {
          for (const d of step.dependsOn) prev[d] = stepOutputs[d] ?? {};
        }

        const ctx: StepContext = {
          runId,
          user: input.user,
          pipeline: this.def.name,
          inputs: input.inputs,
          prev,
          cost,
          signal: this.ac.signal,
        };

        const result = await runStepWithRetry(step, ctx, snap);
        if (result.status === "success" && result.outputs) {
          stepOutputs[step.name] = result.outputs;
          // 消耗配额（free/pro 严格模式，business/enterprise best-effort）
          void consumeQuota(input.user.userId, step.name, 1, input.user.tier);
        }
        if (result.status === "failed" && !step.optional) {
          snap.status = "failed";
          snap.error = `step '${step.name}' failed: ${result.error}`;
          snap.costSummary = cost.summarize();
          await snapshotStore.save(snap);
          return snap;
        }
      }

      // 全部跑完
      const hasFatal = Object.values(snap.steps).some((s) => s.status === "failed");
      snap.status = this.ac.signal.aborted ? "cancelled" : hasFatal ? "failed" : "success";
      snap.costSummary = cost.summarize();
      await snapshotStore.save(snap);
      return snap;
    } catch (err) {
      snap.status = "failed";
      snap.error = (err as Error).message;
      snap.costSummary = cost.summarize();
      await snapshotStore.save(snap);
      return snap;
    }
  }
}

async function runStepWithRetry(
  step: PipelineStep,
  ctx: StepContext,
  snap: RunSnapshot,
): Promise<StepResult> {
  const maxAttempts = (step.retries ?? 0) + 1;
  const result = snap.steps[step.name];
  result.status = "running";
  result.startedAt = Date.now();
  result.attempt = 1;
  await snapshotStore.save(snap);

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result.attempt = attempt;
    try {
      const start = Date.now();
      const outputs = await step.run(ctx);
      const lat = Date.now() - start;
      result.outputs = outputs;
      result.latencyMs = lat;
      result.status = "success";
      result.finishedAt = Date.now();
      await snapshotStore.save(snap);
      return result;
    } catch (err) {
      lastErr = err as Error;
      process.stderr.write(
        `[pipeline ${ctx.runId}] step '${step.name}' attempt ${attempt}/${maxAttempts} failed: ${lastErr.message}\n`,
      );
      if (attempt < maxAttempts) {
        await sleep(Math.min(2000, 200 * 2 ** (attempt - 1)));
      }
    }
  }
  result.status = "failed";
  result.error = lastErr?.message ?? "unknown";
  result.finishedAt = Date.now();
  await snapshotStore.save(snap);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function blankStep(name: string): StepResult {
  return {
    name,
    status: "pending",
    costUsd: 0,
    latencyMs: 0,
    startedAt: 0,
    attempt: 0,
  };
}

function blankSummary(): RunSnapshot["costSummary"] {
  return {
    totalCostUsd: 0,
    totalLatencyMs: 0,
    stepCount: 0,
    byProvider: {},
    byStep: {},
    byokCostUsd: 0,
    platformCostUsd: 0,
  };
}

/** 估算 pipeline 总成本（粗略累加每步的固定系数） */
function estimatePipelineCost(def: PipelineDefinition): number {
  // 每个 step 默认 0.1，image/video 类重 0.4
  const weights: Record<string, number> = {
    storyboard: 0.15,
    character: 0.2,
    scene: 0.1,
    "image-gen": 0.4,
    tts: 0.1,
    "video-gen": 0.6,
    compose: 0.05,
    split: 0,
    "pick-shots": 0,
    "translate-audio": 0.2,
    "burn-subtitle": 0.05,
    "extract-roles": 0.15,
    "rebuild-characters": 0.3,
    "regen-videos": 0.6,
    "detect-style": 0.1,
    "regen-frames": 0.4,
    "rerender-videos": 0.6,
  };
  return def.steps.reduce((sum, s) => sum + (weights[s.name] ?? 0.1), 0);
}
