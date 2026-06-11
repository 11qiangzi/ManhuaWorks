/**
 * 环境变量集中管理 + 启动校验
 * 缺关键配置就 fail-fast，避免运行时才报错。
 */

function require(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`[env] missing required env: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: Number(optional("PORT", "8081")),

  DATABASE_URL: optional(
    "DATABASE_URL",
    "postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks"
  ),

  JWT_SECRET: require("JWT_SECRET", "change_me_in_production"),
  JWT_EXPIRES_IN: optional("JWT_EXPIRES_IN", "7d"), // 7 天

  // 短信：内存 mock（生产替换为阿里云/腾讯云 SDK）
  SMS_MOCK: optional("SMS_MOCK", "true"),
  SMS_CODE_TTL_SEC: Number(optional("SMS_CODE_TTL_SEC", "300")), // 5 分钟
  SMS_RATE_LIMIT_PER_HOUR: Number(optional("SMS_RATE_LIMIT_PER_HOUR", "5")),

  // 配额自动重置：cron 周期（秒），默认 1 小时巡检一次
  QUOTA_RESET_INTERVAL_SEC: Number(optional("QUOTA_RESET_INTERVAL_SEC", "3600")),

  isProd: process.env.NODE_ENV === "production",
} as const;
