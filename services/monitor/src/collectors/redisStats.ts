import Redis from 'ioredis';
import type { RedisStats } from '../types';
import { config } from '../config';

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    });
    client.on('error', () => {
      // swallow; surfaced via collect
    });
  }
  return client;
}

const EMPTY: RedisStats = {
  connected: false,
  usedMemoryMb: 0,
  maxMemoryMb: 0,
  connectedClients: 0,
  slowCommands: 0,
  error: 'not queried',
};

export async function collectRedisStats(): Promise<RedisStats> {
  const c = getClient();
  try {
    if (c.status === 'wait' || c.status === 'end') {
      await c.connect();
    }
    const [info, clients, slowlog] = await Promise.all([
      c.info('memory'),
      c.info('clients'),
      (c as unknown as { slowlog: (cmd: 'get' | 'len' | 'reset', n?: number) => Promise<unknown> }).slowlog('get', 50),
    ]);
    const memUsed = parseInfo(info, 'used_memory');
    const memMax = parseInfo(info, 'maxmemory');
    const conn = parseInfo(clients, 'connected_clients');
    return {
      connected: true,
      usedMemoryMb: bytesToMb(memUsed),
      maxMemoryMb: bytesToMb(memMax),
      connectedClients: conn,
      slowCommands: Array.isArray(slowlog) ? slowlog.length : 0,
    };
  } catch (err) {
    return { ...EMPTY, error: (err as Error).message };
  }
}

function parseInfo(info: string, key: string): number {
  for (const line of info.split('\n')) {
    if (line.startsWith(`${key}:`)) {
      const v = line.slice(key.length + 1).trim();
      return Number(v);
    }
  }
  return 0;
}

function bytesToMb(b: number): number {
  return Math.round((b / 1024 / 1024) * 100) / 100;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    client.disconnect();
    client = null;
  }
}
