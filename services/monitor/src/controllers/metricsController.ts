import type { Request, Response } from 'express';
import { registry } from '../registry';

export async function metricsEndpoint(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
