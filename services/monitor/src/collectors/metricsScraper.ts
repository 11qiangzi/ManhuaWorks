import type { ServiceTarget, ScapedMetric } from '../types';
import { scrapesTotal, scrapeErrors } from '../registry';
import { withSpan, outHeaders } from '@manhuaworks/logger';

const CACHE = new Map<string, ScapedMetric[]>();

/**
 * Parse a prom-client text exposition format into a flat metric list.
 * Sufficient for the metric names we care about; ignores histograms
 * (those need a different parser).
 */
export function parsePromText(text: string, service: string, scrapedAt: number): ScapedMetric[] {
  const out: ScapedMetric[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Match: name{labels} value [timestamp]
    const m = /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([0-9eE+\-.]+)/.exec(trimmed)
      ?? /^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([0-9eE+\-.]+)/.exec(trimmed);
    if (!m) continue;
    if (m.length === 4) {
      const [, name, labelStr, value] = m;
      const labels: Record<string, string> = {};
      if (labelStr) {
        for (const part of splitLabels(labelStr)) {
          const eq = part.indexOf('=');
          if (eq > 0) {
            const k = part.slice(0, eq).trim();
            const v = part.slice(eq + 1).trim().replace(/^"|"$/g, '');
            labels[k] = v;
          }
        }
      }
      out.push({ service, name: name ?? '', value: Number(value), labels, scrapedAt });
    } else if (m.length === 3) {
      const [, name, value] = m;
      out.push({ service, name: name ?? '', value: Number(value), labels: {}, scrapedAt });
    }
  }
  return out;
}

function splitLabels(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== '\\') inQ = !inQ;
    if (!inQ) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === ',' && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * Scrape a service's /metrics endpoint. Resolves to an empty list on failure.
 *
 * ManhuaWorks L2 task 14：每次抓取会开一个 `monitor.scrape` span，
 * 自动注入到 Jaeger。span 属性：
 *   - service.name
 *   - scrape.url
 *   - scrape.duration_ms
 *   - scrape.metric_count
 *   - scrape.ok (true/false)
 */
export async function scrapeServiceMetrics(target: ServiceTarget, timeoutMs = 5000): Promise<ScapedMetric[]> {
  const url = `${target.url.replace(/\/$/, '')}/metrics`;
  return withSpan(
    'monitor.scrape',
    async (span) => {
      span.setAttribute('service.name', target.name);
      span.setAttribute('scrape.url', url);
      span.setAttribute('scrape.timeout_ms', timeoutMs);

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const startMs = Date.now();
      try {
        // outHeaders() 会自动注入 W3C traceparent 到 fetch headers
        // @opentelemetry/instrumentation-http 同时也会监听全局 fetch；
        // 我们显式注入避免依赖 fetch instrumentation 启用。
        const res = await fetch(url, {
          signal: controller.signal,
          headers: outHeaders({ Accept: 'text/plain' }),
        });
        const durationMs = Date.now() - startMs;
        span.setAttribute('scrape.duration_ms', durationMs);
        span.setAttribute('scrape.status_code', res.status);
        if (!res.ok) {
          span.setAttribute('scrape.ok', false);
          scrapeErrors.inc({ service: target.name, kind: 'http' });
          return CACHE.get(target.name) ?? [];
        }
        const text = await res.text();
        const parsed = parsePromText(text, target.name, Date.now());
        CACHE.set(target.name, parsed);
        span.setAttribute('scrape.ok', true);
        span.setAttribute('scrape.metric_count', parsed.length);
        scrapesTotal.inc({ service: target.name });
        return parsed;
      } catch (err) {
        const durationMs = Date.now() - startMs;
        span.setAttribute('scrape.duration_ms', durationMs);
        span.setAttribute('scrape.ok', false);
        span.recordException(err as Error);
        scrapeErrors.inc({ service: target.name, kind: 'fetch' });
        return CACHE.get(target.name) ?? [];
      } finally {
        clearTimeout(t);
      }
    },
  );
}

/**
 * Scrape all services in parallel and aggregate into a service-keyed map.
 * 整个一轮抓取也开一个父 span `monitor.scrape_all`。
 */
export async function scrapeAll(services: ServiceTarget[]): Promise<Map<string, ScapedMetric[]>> {
  const { withSpan } = await import('@manhuaworks/logger');
  return withSpan('monitor.scrape_all', async (span) => {
    span.setAttribute('scrape.service_count', services.length);
    const startMs = Date.now();
    const lists = await Promise.all(services.map((s) => scrapeServiceMetrics(s)));
    span.setAttribute('scrape.duration_ms', Date.now() - startMs);
    const out = new Map<string, ScapedMetric[]>();
    services.forEach((s, i) => out.set(s.name, lists[i] ?? []));
    return out;
  });
}

/**
 * Find a metric value in a service's most recent scrape.
 */
export function findMetric(metrics: ScapedMetric[], name: string, labels?: Record<string, string>): number | undefined {
  let best: ScapedMetric | undefined;
  for (const m of metrics) {
    if (m.name !== name) continue;
    if (labels) {
      const match = Object.entries(labels).every(([k, v]) => m.labels[k] === v);
      if (!match) continue;
    }
    if (!best || m.scrapedAt > best.scrapedAt) best = m;
  }
  return best?.value;
}

/**
 * Sum all metric samples that match the given name pattern (regex).
 */
export function sumMetrics(metrics: ScapedMetric[], namePattern: RegExp): number {
  let total = 0;
  for (const m of metrics) {
    if (namePattern.test(m.name)) total += m.value;
  }
  return total;
}

/**
 * Compute P99 latency from histogram bucket metrics.
 * The bucket names look like: foo_bucket{le="0.5"} 42
 * We read the cumulative buckets and pick the one just above P99.
 */
export function histogramP99(metrics: ScapedMetric[], baseName: string): number | undefined {
  const buckets: Array<{ le: number; cumulative: number }> = [];
  let total = 0;
  for (const m of metrics) {
    if (m.name === `${baseName}_bucket` && 'le' in m.labels) {
      const leStr = m.labels.le;
      if (leStr === '+Inf') {
        total = m.value;
      } else {
        const le = Number(leStr);
        if (!Number.isNaN(le)) buckets.push({ le, cumulative: m.value });
      }
    }
  }
  if (buckets.length === 0) return undefined;
  buckets.sort((a, b) => a.le - b.le);
  const target = total * 0.99;
  for (const b of buckets) {
    if (b.cumulative >= target) return b.le;
  }
  return buckets[buckets.length - 1]?.le;
}

export function getCache(): Map<string, ScapedMetric[]> {
  return CACHE;
}
