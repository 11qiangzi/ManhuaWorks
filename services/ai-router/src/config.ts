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
  /** 派单 16: provider 调用默认超时 (ms) — 视频/音频异步任务会更长。
   *  默认 180s：DeepSeek v4-pro 分镜生成（带长篇小说上下文）实测 >60s，原 60s 阈值会触发 aborted-timeout，故上调。 */
  requestTimeoutMs: readInt("REQUEST_TIMEOUT_MS", 180_000),
  /** 派单 16: 长任务超时 (视频/音频)，单次最多等这么久 */
  longTaskTimeoutMs: readInt("LONG_TASK_TIMEOUT_MS", 300_000),

  // Provider 默认 base URL（可被环境变量覆盖）
  minimaxBaseUrl: readString("MINIMAX_BASE_URL", "https://api.minimaxi.com/v1"),
  deepseekBaseUrl: readString("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
  zhipuBaseUrl: readString("ZHIPU_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
  volcengineBaseUrl: readString("VOLCENGINE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
  // 派单 16 新增: 通义千问 (DashScope OpenAI 兼容模式)
  qwenBaseUrl: readString("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
  // 派单 16 新增: OpenAI
  openaiBaseUrl: readString("OPENAI_BASE_URL", "https://api.openai.com/v1"),
  // 派单 16 新增: Replicate (图像/视频/音频 HTTP)
  replicateBaseUrl: readString("REPLICATE_BASE_URL", "https://api.replicate.com/v1"),
  // 派单 16 新增: fal.ai (Wan2.1 视频 HTTP)
  falBaseUrl: readString("FAL_BASE_URL", "https://fal.run"),
  // Agnes AI (图片 + 视频生成，OpenAI 兼容)
  agnesBaseUrl: readString("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1"),

  // URL 持久化（火山引擎 TOS URL 24h 过期 → 下载到本地存储）
  persistenceEnabled: readString("PERSISTENCE_ENABLED", "true") === "true",
  persistenceStorageDir: readString("PERSISTENCE_STORAGE_DIR", "./data/persisted"),
  persistenceBaseUrl: readString("PERSISTENCE_BASE_URL", "/persisted"),
} as const;

export type AppConfig = typeof config;