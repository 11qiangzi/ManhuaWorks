import type { Request, Response } from 'express';
import { getAllLatest } from '../collectors/serviceHealth';
import { collectDbStats } from '../collectors/dbStats';
import { collectRedisStats } from '../collectors/redisStats';

export async function healthOverview(_req: Request, res: Response): Promise<void> {
  const services = getAllLatest();
  const summary = [...services.values()].map((s) => ({
    service: s.service,
    up: s.up,
    latencyMs: s.latencyMs,
    lastError: s.lastError,
    statusCode: s.statusCode,
    checkedAt: s.checkedAt,
  }));
  res.json({
    status: 'ok',
    services: summary,
    uptimeSec: process.uptime(),
    pid: process.pid,
    ts: Date.now(),
  });
}

export async function healthDeep(_req: Request, res: Response): Promise<void> {
  const [db, redis] = await Promise.all([collectDbStats(), collectRedisStats()]);
  res.json({
    status: 'ok',
    db: { connected: db.connected, connectionCount: db.connectionCount, maxConnections: db.maxConnections, slowQueries: db.slowQueries, error: db.error },
    redis: { connected: redis.connected, usedMemoryMb: redis.usedMemoryMb, maxMemoryMb: redis.maxMemoryMb, slowCommands: redis.slowCommands, error: redis.error },
    ts: Date.now(),
  });
}
