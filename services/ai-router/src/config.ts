// 环境变量 + 默认值
// 所有模块从这里读配置，禁用在业务代码里直接 process.env。

function readString(name: string, fallback: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

function readNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function readInt(name: string, fallback: number): number {
  return Math.floor(readNumber(name, fallback));
}

export const config = {
  port: readInt("PORT", 8082),
  host: readString("HOST", "0.0.0.0"),
  nodeEnv: readString("NODE_ENV", "development"),

  // 依赖服务
  databaseUrl: readString("DATABASE_URL", ""),
  redisUrl: readString("REDIS_URL", ""),

  // 鉴权
  jwtSecret: readString("JWT_SECRET", "dev-secret-change-me"),

  // 加密（API Key 存储用） - 32 字节 hex (64 chars)
  encryptionKey: readString("ENCRYPTION_KEY", ""),

  // 行为
  cacheTtlSeconds: readInt("CACHE_TTL_SECONDS", 1800), // 30 分钟
  rateLimitPerMin: readInt("RATE_LIMIT_PER_MIN", 60),
  failoverThreshold: readInt("FAILOVER_THRESHOLD", 3),

  // Provider 默认 base URL（可被环境变量覆盖）
  minimaxBaseUrl: readString("MINIMAX_BASE_URL", "https://api.minimax.chat/v1"),
  deepseekBaseUrl: readString("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
  zhipuBaseUrl: readString("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
  volcengineBaseUrl: readString("VOLCENGINE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
} as const;

export type AppConfig = typeof config;
