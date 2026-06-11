/**
 * Drizzle ORM 客户端
 *
 * 与 user-service 的 client.ts 保持一致的口径，方便后续统一迁移到共享的
 * `@manhuaworks/db` 包（先在本服务内复用模式）。
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config.js';

// 单例：避免 HMR/dev 重复创建连接
declare global {
  // eslint-disable-next-line no-var
  var __mhw_asset_sql__: ReturnType<typeof postgres> | undefined;
}

const sql =
  globalThis.__mhw_asset_sql__ ??
  postgres(config.db.url, {
    max: config.db.max,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (config.env !== 'production') {
  globalThis.__mhw_asset_sql__ = sql;
}

export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };
