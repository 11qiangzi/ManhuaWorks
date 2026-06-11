/**
 * 配置层 —— 单一事实来源（SSOT）
 *
 * 所有环境变量集中解析与校验，避免在业务代码里散落 `process.env`。
 * 设计原则：
 *   1. 启动时一次性解析并冻结（Object.freeze），运行期不可变
 *   2. 缺省值保证本地 `pnpm dev` 就能跑，不依赖 .env
 *   3. 关键变量缺失直接抛错，宁可早死也别带病上线
 */

import { z } from 'zod';

// ──────────────────────────────────────────────────────────
// 类型先行：业务代码用 `Config` 类型，配置来源是 env 或默认
// ──────────────────────────────────────────────────────────

export type Role = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/**
 * 5 级 RBAC 权限位（从低到高）
 * - L1: 创作端 C 端创作者（只读自己作品）
 * - L2: 创作端重度创作者（可发布、可组队）
 * - L3: 业务后台（运营/客服/审核）
 * - L4: 业务后台（产品负责人/超管）
 * - L5: 平台后台（技术/运维）
 *
 * RBAC 用「位掩码」实现，便于快速比较和扩展：
 * L1=1, L2=2, L3=4, L4=8, L5=16
 * 若某路由要求 L3+，检查 `(user.mask & REQUIRED) === REQUIRED`
 */
export const ROLE_BIT: Record<Role, number> = {
  L1: 1 << 0, // 1
  L2: 1 << 1, // 2
  L3: 1 << 2, // 4
  L4: 1 << 3, // 8
  L5: 1 << 4, // 16
};

export const ROLE_NAME: Record<Role, string> = {
  L1: '创作端-普通创作者',
  L2: '创作端-重度创作者',
  L3: '业务后台-运营/客服/审核',
  L4: '业务后台-产品/超管',
  L5: '平台后台-技术/运维',
};

// ──────────────────────────────────────────────────────────
// Readiness 探针：5 个后台依赖
// ──────────────────────────────────────────────────────────

export interface ReadinessTarget {
  name: string;
  url: string; // HTTP 探活地址（*不* 用于 postgres / redis 那种带协议）
  kind: 'http' | 'postgres' | 'redis';
  timeoutMs: number;
}

/**
 * 默认 5 个探针：
 *   1. postgres  —— 主库
 *   2. redis     —— 限流 / 缓存
 *   3. user-service
 *   4. project-service
 *   5. billing-service
 *
 * ai-orchestrator 是计算密集型，启动慢且自身常处于「忙碌」状态，
 * readiness 探针放到它自己的 /health 端点去判断，网关这里不绑死。
 *
 * 每个目标可单独从 env 覆盖 URL（形如 `READINESS_USER_SERVICE_URL`），
 * 自动把 `-` 替换成 `_` 并大写。
 */
export function buildReadinessTargets(env: NodeJS.ProcessEnv): ReadinessTarget[] {
  const pick = (k: string, fallback: string): string =>
    (env[k] && env[k]!.trim().length > 0) ? env[k]!.trim() : fallback;

  return [
    {
      name: 'postgres',
      url: pick('READINESS_POSTGRES_URL', 'postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks'),
      kind: 'postgres',
      timeoutMs: 1500,
    },
    {
      name: 'redis',
      url: pick('READINESS_REDIS_URL', 'redis://localhost:6379'),
      kind: 'redis',
      timeoutMs: 1000,
    },
    {
      name: 'user-service',
      url: pick('READINESS_USER_SERVICE_URL', 'http://localhost:8081/health'),
      kind: 'http',
      timeoutMs: 1500,
    },
    {
      name: 'project-service',
      url: pick('READINESS_PROJECT_SERVICE_URL', 'http://localhost:8082/health'),
      kind: 'http',
      timeoutMs: 1500,
    },
    {
      name: 'billing-service',
      url: pick('READINESS_BILLING_SERVICE_URL', 'http://localhost:8083/health'),
      kind: 'http',
      timeoutMs: 1500,
    },
  ];
}

// ──────────────────────────────────────────────────────────
// 主配置 schema
// ──────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),

  // JWT
  JWT_SECRET: z.string().min(8, 'JWT_SECRET 至少 8 位').default('change_me_in_production'),
  JWT_ISSUER: z.string().default('manhuaworks'),
  JWT_AUDIENCE: z.string().default('manhuaworks-gateway'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']).default('HS256'),

  // 限流（基于 Redis 滑动窗口）
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // 日志
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  readiness: ReadinessTarget[];
};

let _cached: AppConfig | null = null;

/**
 * 解析并缓存配置。HMR / 测试时允许重新加载（force=true）。
 */
export function loadConfig(force = false): AppConfig {
  if (_cached && !force) return _cached;

  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[config] 环境变量校验失败：\n${issues}`);
  }

  const cfg: AppConfig = Object.freeze({
    ...parsed.data,
    readiness: Object.freeze(buildReadinessTargets(process.env)) as ReadinessTarget[],
  }) as AppConfig;

  _cached = cfg;
  return cfg;
}

/** 测试用：清理缓存 */
export function _resetConfigForTest(): void {
  _cached = null;
}
