/**
 * Postgres 连接池
 *  - 单例 pool
 *  - 提供 query / withTransaction
 */
import pg from "pg";
import { env } from "./env.js";
import { logger } from "./logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  logger.error({ err }, "pg pool 异常");
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params as never);
  const ms = Date.now() - start;
  if (ms > 200) {
    logger.warn({ ms, text: text.slice(0, 80) }, "慢查询");
  }
  return res;
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    return r.rows[0]?.ok === 1;
  } catch (err) {
    logger.error({ err }, "pingDb 失败");
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
