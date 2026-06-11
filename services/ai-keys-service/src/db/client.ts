/**
 * Drizzle ORM客户端
 *
 *优先用 postgres-js（轻量、快），与 user-service保持一致。
 * 单例模式：避免 dev HMR重复创建连接。
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { config } from "../config.js";

const sql =
 globalThis.__mhw_sql__ ??
 postgres(config.DATABASE_URL, {
 max:10,
 idle_timeout:20,
 connect_timeout:10,
 });

if (config.NODE_ENV !== "production") {
 globalThis.__mhw_sql__ = sql;
}

export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };

//显式声明global类型，避免 TS报错
declare global {
// eslint-disable-next-line no-var
 var __mhw_sql__: ReturnType<typeof postgres> | undefined;
}
