/**
 * 环境变量集中管理 + 启动校验
 */

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`[env] missing required env: ${name}`);
  }
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`[env] ${name} must be a number, got: ${raw}`);
  }
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export const env = {
  NODE_ENV: opt("NODE_ENV", "development"),
  PORT: num("PORT", 8090),

  DB_HOST: opt("DB_HOST", "127.0.0.1"),
  DB_PORT: num("DB_PORT", 5432),
  DB_USER: opt("DB_USER", "mhw"),
  DB_PASSWORD: opt("DB_PASSWORD", "mhw_dev_password_2026"),
  DB_NAME: opt("DB_NAME", "manhuaworks"),
  DB_POOL_MAX: num("DB_POOL_MAX", 10),
  DB_POOL_IDLE_MS: num("DB_POOL_IDLE_MS", 20000),
  DB_CONNECT_TIMEOUT_MS: num("DB_CONNECT_TIMEOUT_MS", 10000),

  JWT_SECRET: req("JWT_SECRET", "change_me_in_production_billing"),
  JWT_EXPIRES_IN: opt("JWT_EXPIRES_IN", "7d"),
  JWT_ISSUER: opt("JWT_ISSUER", "manhuaworks"),
  JWT_AUDIENCE: opt("JWT_AUDIENCE", "manhuaworks-api"),

  USER_SERVICE_URL: opt("USER_SERVICE_URL", "http://localhost:8088"),
  PROJECT_SERVICE_URL: opt("PROJECT_SERVICE_URL", "http://localhost:8089"),

  QUOTA_RESET_INTERVAL_SEC: num("QUOTA_RESET_INTERVAL_SEC", 3600),
  PAYMENT_SANDBOX: bool("PAYMENT_SANDBOX", true),

  isProd: process.env.NODE_ENV === "production",
} as const;

export type Env = typeof env;
