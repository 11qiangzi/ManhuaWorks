import { Pool } from 'pg';
import type { DbStats } from '../types';
import { config } from '../config';
import { withSpan } from '@manhuaworks/logger';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.PG_HOST,
      port: config.PG_PORT,
      user: config.PG_USER,
      password: config.PG_PASSWORD,
      database: config.PG_DATABASE,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 3_000,
    });
    pool.on('error', () => {
      // connection-level errors are handled per-query
    });
  }
  return pool;
}

const EMPTY: DbStats = {
  connected: false,
  connectionCount: 0,
  maxConnections: 0,
  slowQueries: 0,
  databaseSizeMb: 0,
  tableSizes: [],
  error: 'not queried',
};

/**
 * Collect a snapshot of postgres health.
 * If the connection fails, returns `connected: false` with the error message.
 *
 * ManhuaWorks L2 task 14：每次 PG 查询都开一个 `monitor.db.query` span，
 * 父 span `monitor.db.collect` 包裹整轮抓取。
 * 因为 OTel `instrumentation-pg` 默认开启，这些 span 会自动 trace 到 PG 协议层。
 */
export async function collectDbStats(): Promise<DbStats> {
  return withSpan('monitor.db.collect', async (span) => {
    const p = getPool();
    try {
      // Connection / max
      const [settings, current, sizes] = await Promise.all([
        withSpan('monitor.db.query', (s) => {
          s.setAttribute('db.system', 'postgresql');
          s.setAttribute('db.statement', 'SHOW max_connections');
          return p.query<{ max_conn: string }>(`SHOW max_connections`);
        }),
        withSpan('monitor.db.query', (s) => {
          s.setAttribute('db.system', 'postgresql');
          s.setAttribute('db.statement', 'SELECT count(*)::text FROM pg_stat_activity');
          return p.query<{ count: string }>(`SELECT count(*)::text FROM pg_stat_activity`);
        }),
        withSpan('monitor.db.query', (s) => {
          s.setAttribute('db.system', 'postgresql');
          s.setAttribute('db.statement', 'SELECT ... FROM pg_stat_user_tables LIMIT 20');
          return p.query<{ table_name: string; size_mb: string }>(
            `SELECT relname AS table_name,
                    pg_total_relation_size(relid)/1024.0/1024.0 AS size_mb
               FROM pg_stat_user_tables
              ORDER BY pg_total_relation_size(relid) DESC
              LIMIT 20`,
          );
        }),
      ]);

      const maxConn = Number(settings.rows[0]?.max_conn ?? '100');
      const connCount = Number(current.rows[0]?.count ?? '0');

      // Database size
      const sizeRes = await withSpan('monitor.db.query', (s) => {
        s.setAttribute('db.system', 'postgresql');
        s.setAttribute('db.statement', 'SELECT pg_database_size(...)');
        return p.query<{ size_mb: string }>(
          `SELECT pg_database_size(current_database())/1024.0/1024.0 AS size_mb`,
        );
      });
      const databaseSizeMb = Number(sizeRes.rows[0]?.size_mb ?? '0');

      // Slow queries (those running > 1s)
      const slowRes = await withSpan('monitor.db.query', (s) => {
        s.setAttribute('db.system', 'postgresql');
        s.setAttribute('db.statement', 'SELECT count(*) FROM pg_stat_activity WHERE ... > 1s');
        return p.query<{ count: string }>(
          `SELECT count(*)::text FROM pg_stat_activity
            WHERE state='active'
              AND now()-query_start > interval '1 second'`,
        );
      });
      const slowQueries = Number(slowRes.rows[0]?.count ?? '0');

      span.setAttribute('db.connected', true);
      span.setAttribute('db.connection_count', connCount);
      span.setAttribute('db.max_connections', maxConn);
      span.setAttribute('db.slow_queries', slowQueries);
      span.setAttribute('db.size_mb', databaseSizeMb);

      return {
        connected: true,
        connectionCount: connCount,
        maxConnections: maxConn,
        slowQueries,
        databaseSizeMb,
        tableSizes: sizes.rows.map((r) => ({ table: r.table_name, sizeMb: Number(r.size_mb) })),
      };
    } catch (err) {
      span.setAttribute('db.connected', false);
      span.recordException(err as Error);
      return { ...EMPTY, error: (err as Error).message };
    }
  });
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
