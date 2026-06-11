import { Request, Response } from 'express';
import { pingDb } from '../config/db';

export async function health(_req: Request, res: Response): Promise<void> {
  const dbOk = await pingDb();
  res.status(dbOk ? 200 : 503).json({
    code: dbOk ? 0 : 'degraded',
    message: dbOk ? 'ok' : 'degraded',
    data: {
      service: 'user-service',
      version: '0.2.0',
      uptime_sec: Math.floor(process.uptime()),
      db: dbOk ? 'up' : 'down',
      ts: new Date().toISOString(),
    },
  });
}
