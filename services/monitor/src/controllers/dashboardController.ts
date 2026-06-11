import type { Request, Response } from 'express';
import { getAllLatest } from '../collectors/serviceHealth';
import { getCache } from '../collectors/metricsScraper';

export interface DashboardData {
  services: Array<{
    name: string;
    up: boolean;
    latencyMs: number;
    lastError?: string;
    statusCode?: number;
  }>;
  metricSeries: Record<string, Array<{ name: string; value: number; labels: Record<string, string> }>>;
  generatedAt: number;
}

export function dashboardOverview(_req: Request, res: Response): void {
  const health = getAllLatest();
  const cache = getCache();
  const metricSeries: DashboardData['metricSeries'] = {};
  for (const [service, metrics] of cache.entries()) {
    metricSeries[service] = metrics
      .filter((m) =>
        m.name.startsWith('manhuaworks_') &&
        !m.name.endsWith('_bucket') &&
        !m.name.endsWith('_sum') &&
        !m.name.endsWith('_count'),
      )
      .slice(0, 200)
      .map((m) => ({ name: m.name, value: m.value, labels: m.labels }));
  }
  const data: DashboardData = {
    services: [...health.values()].map((h) => ({
      name: h.service,
      up: h.up,
      latencyMs: h.latencyMs,
      lastError: h.lastError,
      statusCode: h.statusCode,
    })),
    metricSeries,
    generatedAt: Date.now(),
  };
  res.json(data);
}
