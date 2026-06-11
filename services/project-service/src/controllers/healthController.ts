/**
 * ManhuaWorks project-service — Health Controller
 * 2026-06-08 谢擎 L2-task-12
 *
 * 端点：GET /health
 *  - 200: 进程 + DB OK（Redis 可选：未配置或连接失败时不影响 200）
 *  - 503: 进程或 DB 不可用
 *  - 200 但带 `deps.redis: 'skipped' | 'up' | 'down'`
 *
 * 设计：
 *  - project-service 当前没有 ioredis 依赖（与 collab-service 不同）
 *  - 如果未来引入 Redis，需要在 src/config/redis.ts 中实现 pingRedis()
 *  - 当前实现：尝试 dynamic import('ioredis')，失败则标 'skipped'
 */
import type { Request, Response } from 'express';
import { pingDb } from '../config/db';

type RedisStatus = 'up' | 'down' | 'skipped';

/**
 * 尝试探测 Redis。可选：失败时返回 'skipped'，不算整体 503。
 */
async function pingRedis(): Promise<RedisStatus> {
  // 1) 显式开关：没设置 REDIS_URL 就跳过
  if (!process.env.REDIS_URL) return 'skipped';

  // 2) 尝试 dynamic import（如果 package.json 没装 ioredis，会失败）
  try {
    // @ts-ignore — dynamic import，类型缺失也无所谓
    const mod = await import('ioredis').catch(() => null);
    if (!mod) return 'skipped';
    const Redis = mod.default ?? mod;
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
    });
    try {
      await client.connect();
      const r = await client.ping();
      await client.quit().catch(() => {});
      return r === 'PONG' ? 'up' : 'down';
    } catch {
      client.disconnect();
      return 'down';
    }
  } catch {
    return 'skipped';
  }
}

export async function health(_req: Request, res: Response): Promise<void> {
  const [dbOk, redisStatus] = await Promise.all([pingDb(), pingRedis()]);
  const ok = dbOk && redisStatus !== 'down';
  res.status(ok ? 200 : 503).json({
    code: ok ? 0 : 'degraded',
    message: ok ? 'ok' : 'degraded',
    data: {
      service: 'project-service',
      version: '0.1.0',
      uptime_sec: Math.floor(process.uptime()),
      memory: {
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      deps: {
        postgres: dbOk ? 'up' : 'down',
        redis: redisStatus,
      },
      ts: new Date().toISOString(),
    },
  });
}
