/**
 * 鐜鍙橀噺缁熶竴鍔犺浇 (闆嗕腑鏍￠獙锛岄伩鍏嶆暎钀?
 */
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8091),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),

  USER_SERVICE_URL: z.string().url(),
  PROJECT_SERVICE_URL: z.string().url(),

  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  WS_PATH: z.string().default("/ws"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("[env] 閰嶇疆鏍￠獙澶辫触:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type AppEnv = typeof env;
