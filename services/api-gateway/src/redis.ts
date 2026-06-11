/**
 * Redis 单例 —— 限流器和后续缓存都靠它
 *
 * 设计要点：
 *   - 启动期 lazy 初始化：避免 ioredis 连接错误把整个进程拖死
 *   - 失败不抛：网络抖动时降级为「不限流」，但要记日志
 *   - 关闭期优雅释放：给 SIGTERM 一个收尾机会
 */

import Redis from 'ioredis';
import { loadConfig } from './config.js';

let _client: Redis | null = null;
let _connecting: Promise<Redis> | null = null;

function buildClient(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false, // 离线时不排队，立刻失败
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    reconnectOnError: () => true,
  });

  client.on('error', (err) => {
    // ioredis 在断网时会刷屏，这里只记录，不让进程退出
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[redis] error:', err.message);
    }
  });

  client.on('ready', () => {
    if (loadConfig().LOG_LEVEL === 'debug') {
      console.log('[redis] ready:', url);
    }
  });

  return client;
}

export async function getRedis(): Promise<Redis> {
  if (_client) return _client;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    const c = buildClient();
    try {
      await c.connect();
    } catch (err) {
      _connecting = null; // 允许下次重试
      throw err;
    }
    _client = c;
    _connecting = null;
    return c;
  })();

  return _connecting;
}

/** 优雅关闭 */
export async function closeRedis(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
    } catch {
      _client.disconnect();
    }
    _client = null;
  }
}
