/**
 * ai-orchestrator 健康检查
 *
 * L5-C 任务入生产第一步：把现有 GET /health 抽成可复用模块，
 * 新增 deps 检查（ai-router / asset / workflow / ai-helper 这 4 个下游）。
 *
 * 设计原则：
 *   - 不引第三方（沿用 L3.H 的 fetch + AbortController）
 *   - 每个下游 5s 超时；任一不通 → ok=false
 *   - 失败也算"有响应"，方便灰度
 *   - 单实例内存版（无 Redis/Postgres/aiSdk pool —— 这服务是纯编排器）
 */

import { config } from "./config.js";

export type DepStatus = "up" | "down" | "skipped";

export interface HealthDeps {
  redis?: DepStatus;
  postgres?: DepStatus;
  aiSdk?: DepStatus;
  /** 任意额外下游（ai-router / asset / workflow / ai-helper） */
  [name: string]: DepStatus | undefined;
}

export interface HealthReport {
  ok: boolean;
  service: string;
  version: string;
  uptime: number;
  env: string;
  port: number;
  time: string;
  deps: HealthDeps;
}

const SERVICE_NAME = "ai-orchestrator";
const SERVICE_VERSION = "0.5.0";
const STARTED_AT = Date.now();

/** 单次 HTTP ping + 5s 超时 */
async function ping(url: string, timeoutMs: number): Promise<DepStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      // 多数健康端点不需要 body；显式给个轻 header
      headers: { "user-agent": `${SERVICE_NAME}-health/1.0` },
    });
    // 任何 HTTP 响应（哪怕 401/404）说明服务在跑
    return res.status < 600 ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

export interface HealthCheckerOptions {
  /** 注入 fetch（测试用） */
  fetchImpl?: typeof fetch;
  /** 注入配置（测试用） */
  configOverride?: typeof config;
  /** 跳过下游（CI 环境） */
  skipDeps?: boolean;
  /** 启动时间（测试用） */
  startedAt?: number;
}

/** 工厂：构造一个 health checker。check() 是同步返回 Promise<HealthReport> */
export function buildHealthChecker(opts: HealthCheckerOptions = {}) {
  const f: typeof fetch = opts.fetchImpl ?? fetch;
  const cfg = opts.configOverride ?? config;
  const started: number = opts.startedAt ?? STARTED_AT;
  const skip: boolean = opts.skipDeps === true;

  async function check(): Promise<HealthReport> {
    const deps: HealthDeps = {
      redis: "skipped",
      postgres: "skipped",
      aiSdk: "skipped",
    };

    if (!skip) {
      // 跑 4 个下游；并行抢时间
      const [aiRouter, workflow, asset, aiHelper] = await Promise.all([
        ping(`${cfg.aiRouter.url}/health`, cfg.aiRouter.timeoutMs),
        ping(`${cfg.workflow.url}/health`, cfg.workflow.timeoutMs),
        ping(`${cfg.asset.url}/health`, cfg.asset.timeoutMs),
        ping(`${cfg.aiHelper.url}/health`, cfg.aiHelper.timeoutMs),
      ]);
      deps.aiRouter = aiRouter;
      deps.workflow = workflow;
      deps.asset = asset;
      deps.aiHelper = aiHelper;
    }

    // 真正关键依赖（这服务纯编排，没有 redis/postgres/aiSdk pool）始终 skipped
    // 任何一个非 skipped 的 dep 是 down → ok=false
    const allDeps = Object.values(deps).filter((v): v is DepStatus => v !== undefined);
    const allUp = allDeps.every((d) => d === "up" || d === "skipped");

    return {
      ok: allUp,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime: Date.now() - started,
      env: cfg.env,
      port: cfg.port,
      time: new Date().toISOString(),
      deps,
    };
  }

  return { check };
}
