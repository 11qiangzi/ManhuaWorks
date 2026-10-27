/**
 * ai-orchestrator 配置
 * 所有可调参数集中在这里，禁用在业务代码里直接 process.env。
 */

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const str = (v: string | undefined, fallback: string): string => {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : fallback;
};

export const config = {
  /** HTTP 端口 */
  port: num(process.env.PORT, 8087),

  /** 运行环境 */
  env: str(process.env.NODE_ENV, "development"),

  /** 依赖服务地址 */
  aiRouter: {
    url: str(process.env.AI_ROUTER_URL, "http://localhost:8082"),
    timeoutMs: num(process.env.AI_ROUTER_TIMEOUT_MS, 120_000),
  },
  workflow: {
    url: str(process.env.WORKFLOW_ENGINE_URL, "http://localhost:8084"),
    timeoutMs: num(process.env.WORKFLOW_TIMEOUT_MS, 600_000),
  },
  aiHelper: {
    url: str(process.env.AI_HELPER_URL, "http://localhost:8086"),
    timeoutMs: num(process.env.AI_HELPER_TIMEOUT_MS, 60_000),
  },
  asset: {
    url: str(process.env.ASSET_SERVICE_URL, "http://localhost:8085"),
    timeoutMs: num(process.env.ASSET_TIMEOUT_MS, 30_000),
  },
  byok: {
    url: str(process.env.AI_KEYS_SERVICE_URL, "http://localhost:8083"),
    timeoutMs: num(process.env.AI_KEYS_TIMEOUT_MS, 15_000),
  },
  billing: {
    url: str(process.env.BILLING_SERVICE_URL, "http://localhost:8088"),
    timeoutMs: num(process.env.BILLING_TIMEOUT_MS, 10_000),
  },

  /** 数据库 */
  db: {
    url: str(process.env.DATABASE_URL, "postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks"),
    max: num(process.env.DB_MAX, 10),
  },

  /** 鉴权 */
  auth: {
    mode: str(process.env.AUTH_MODE, "api-key") as "api-key" | "jwt" | "none",
    apiKey: str(process.env.AUTH_API_KEY, "dev-ai-orchestrator-key"),
    jwtSecret: str(process.env.AUTH_JWT_SECRET, "dev-jwt-secret-change-me"),
  },

  /** Pipeline 行为 */
  pipeline: {
    /** 状态快照保留秒数（24h） */
    snapshotTtlSec: num(process.env.PIPELINE_SNAPSHOT_TTL, 86_400),
    /** 单 run 最大步骤数（防爆栈） */
    maxSteps: num(process.env.PIPELINE_MAX_STEPS, 64),
    /** 重试次数 */
    maxRetries: num(process.env.PIPELINE_MAX_RETRIES, 2),
  },
} as const;

export type AppConfig = typeof config;
