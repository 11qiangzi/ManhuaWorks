import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ServiceEntry = z.string().regex(/^[a-z0-9-]+:https?:\/\/.+/i);

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(8092),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  SCRAPE_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  HEALTH_PROBE_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  TAIL_LOG_LINES: z.coerce.number().int().positive().default(200),
  TAIL_LOG_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  TARGET_SERVICES: z.string().default('user-service:http://localhost:3001'),

  PG_HOST: z.string().default('localhost'),
  PG_PORT: z.coerce.number().int().positive().default(5432),
  PG_USER: z.string().default('postgres'),
  PG_PASSWORD: z.string().default('postgres'),
  PG_DATABASE: z.string().default('manhuaworks'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  FEISHU_WEBHOOK_URL: z.string().optional().default(''),
  FEISHU_DEFAULT_AT: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  ALERT_EMAIL_TO: z.string().optional().default(''),

  GENERIC_WEBHOOK_URL: z.string().optional().default(''),
});

const parsed = Schema.parse(process.env);

export interface TargetService {
  name: string;
  url: string;
}

export const config = {
  ...parsed,
  get services(): TargetService[] {
    return parsed.TARGET_SERVICES.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const idx = entry.indexOf(':');
        if (idx < 0) {
          // treat as URL, name = hostname
          try {
            const u = new URL(entry.startsWith('http') ? entry : `http://${entry}`);
            return { name: u.hostname, url: entry };
          } catch {
            return null;
          }
        }
        // The first colon is the separator; the rest (which may contain ":") is the URL.
        const name = entry.slice(0, idx);
        const url = entry.slice(idx + 1);
        // basic validation
        if (!name || !url.startsWith('http')) return null;
        return { name, url };
      })
      .filter((v): v is TargetService => v !== null);
  },
};

export type AppConfig = typeof config;
