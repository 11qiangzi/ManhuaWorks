import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { logger } from './logger';

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

if (!config.connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool(config);

pool.on('error', (err) => {
  logger.error({ err }, 'pg pool error');
});

export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    return r.rows[0]?.ok === 1;
  } catch (err) {
    logger.error({ err }, 'db ping failed');
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

/** 谢擎 22D: 补 query 包装函数 (admin/ops 共用, 前缺导致 5 个 500) */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as never);
}
