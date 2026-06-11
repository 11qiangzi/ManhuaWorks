import { performance } from 'node:perf_hooks';
import type { ServiceTarget, ServiceHealthSnapshot } from '../types';
import { serviceUp, serviceLatencyMs } from '../registry';

const HISTORY = new Map<string, ServiceHealthSnapshot>();

/**
 * Probe a single service's /health endpoint.
 * Resolves to a snapshot regardless of result.
 */
export async function probeService(target: ServiceTarget, timeoutMs = 3000): Promise<ServiceHealthSnapshot> {
  const url = `${target.url.replace(/\/$/, '')}/health`;
  const start = performance.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, method: 'GET' });
    const latency = performance.now() - start;
    const up = res.status >= 200 && res.status < 500; // 4xx is still "up" (wrong route)
    const snap: ServiceHealthSnapshot = {
      service: target.name,
      up,
      latencyMs: latency,
      lastError: up ? undefined : `HTTP ${res.status}`,
      statusCode: res.status,
      checkedAt: Date.now(),
    };
    HISTORY.set(target.name, snap);
    serviceUp.set({ service: target.name }, up ? 1 : 0);
    serviceLatencyMs.observe({ service: target.name }, latency);
    return snap;
  } catch (err) {
    const latency = performance.now() - start;
    const snap: ServiceHealthSnapshot = {
      service: target.name,
      up: false,
      latencyMs: latency,
      lastError: (err as Error).message,
      checkedAt: Date.now(),
    };
    HISTORY.set(target.name, snap);
    serviceUp.set({ service: target.name }, 0);
    serviceLatencyMs.observe({ service: target.name }, latency);
    return snap;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe all configured services in parallel.
 */
export async function probeAll(services: ServiceTarget[]): Promise<Map<string, ServiceHealthSnapshot>> {
  const results = await Promise.all(services.map((s) => probeService(s)));
  const map = new Map<string, ServiceHealthSnapshot>();
  for (const r of results) map.set(r.service, r);
  return map;
}

export function getLatestHealth(service: string): ServiceHealthSnapshot | undefined {
  return HISTORY.get(service);
}

export function getAllLatest(): Map<string, ServiceHealthSnapshot> {
  return new Map(HISTORY);
}
