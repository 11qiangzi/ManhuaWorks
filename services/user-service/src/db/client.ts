/**
 * Drizzle ORM 客户端
 *
 * 优先用 postgres-js（轻量、快），fallback 到 pg（Node 池）。
 * 注意：这里导出的 db 即可用于 service 层。
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks";

// 单例：避免 HMR/dev 重复创建连接
declare global {
  // eslint-disable-next-line no-var
  var __mhw_sql__: ReturnType<typeof postgres> | undefined;
}

const sql =
  globalThis.__mhw_sql__ ??
  postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__mhw_sql__ = sql;
}

export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };
