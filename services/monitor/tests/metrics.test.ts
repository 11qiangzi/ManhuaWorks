import { describe, it, expect } from 'vitest';
import { parsePromText, findMetric, sumMetrics, histogramP99 } from '../src/collectors/metricsScraper';
import { AlertDedup, dedupKey } from '../src/alerts/dedup';
import { InMemoryAlertHistory } from '../src/alertHistory';
import { thresholdRules } from '../src/rules/thresholdRules';
import { anomalyRules } from '../src/rules/anomalyRules';

describe('parsePromText', () => {
  it('parses unlabelled counters', () => {
    const text = '# HELP foo help\n# TYPE foo counter\nfoo 12\nbar 3.5\n';
    const out = parsePromText(text, 'svc', 1);
    expect(out.find((x) => x.name === 'foo')?.value).toBe(12);
    expect(out.find((x) => x.name === 'bar')?.value).toBe(3.5);
  });

  it('parses labelled counters', () => {
    const text = 'req_total{method="GET",status="200"} 10\nreq_total{method="GET",status="500"} 2\n';
    const out = parsePromText(text, 'svc', 1);
    const get = out.filter((x) => x.labels.method === 'GET');
    expect(get.length).toBe(2);
  });

  it('parses labelled gauges with quoted commas', () => {
    const text = 'gauge{label="a,b"} 7\n';
    const out = parsePromText(text, 'svc', 1);
    const m = out[0];
    expect(m?.labels.label).toBe('a,b');
  });

  it('skips comments and blank lines', () => {
    const text = '# HELP\n# TYPE foo gauge\n\nfoo 5\n';
    const out = parsePromText(text, 'svc', 1);
    expect(out.length).toBe(1);
  });
});

describe('findMetric / sumMetrics / histogramP99', () => {
  const metrics: Array<{ service: string; name: string; value: number; labels: Record<string, string>; scrapedAt: number }> = [
    { service: 'svc', name: 'foo_total', value: 5, labels: { kind: 'a' }, scrapedAt: 1 },
    { service: 'svc', name: 'foo_total', value: 7, labels: { kind: 'b' }, scrapedAt: 1 },
    { service: 'svc', name: 'foo_total', value: 9, labels: { kind: 'a' }, scrapedAt: 2 },
    { service: 'svc', name: 'bar', value: 3, labels: {}, scrapedAt: 1 },
    { service: 'svc', name: 'http_request_duration_seconds_bucket', value: 10, labels: { le: '0.5' }, scrapedAt: 1 },
    { service: 'svc', name: 'http_request_duration_seconds_bucket', value: 90, labels: { le: '1' }, scrapedAt: 1 },
    { service: 'svc', name: 'http_request_duration_seconds_bucket', value: 100, labels: { le: '+Inf' }, scrapedAt: 1 },
  ];

  it('findMetric picks most recent by default', () => {
    expect(findMetric(metrics, 'foo_total', { kind: 'a' })).toBe(9);
  });

  it('findMetric returns undefined when not found', () => {
    expect(findMetric(metrics, 'baz')).toBeUndefined();
  });

  it('sumMetrics matches by regex', () => {
    expect(sumMetrics(metrics, /^foo_/)).toBe(21);
  });

  it('histogramP99 returns bucket just above 99th', () => {
    expect(histogramP99(metrics, 'http_request_duration_seconds')).toBe(1);
  });
});

describe('AlertDedup', () => {
  it('dedupKey is stable', () => {
    expect(dedupKey({ rule: 'a', service: 's' })).toBe('s::a');
  });

  it('observe fires on first call, repeats after', () => {
    const d = new AlertDedup(60_000);
    expect(d.observe({ rule: 'r', service: 's' })).toBe('fire');
    expect(d.observe({ rule: 'r', service: 's' })).toBe('repeat');
  });

  it('re-notify after interval', () => {
    const d = new AlertDedup(1);
    expect(d.observe({ rule: 'r', service: 's' })).toBe('fire');
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(d.observe({ rule: 'r', service: 's' })).toBe('re-notify');
        resolve();
      }, 5);
    });
  });

  it('resolve removes the entry', () => {
    const d = new AlertDedup(60_000);
    d.observe({ rule: 'r', service: 's' });
    expect(d.resolve({ rule: 'r', service: 's' })).toBe('s::r');
    expect(d.resolve({ rule: 'r', service: 's' })).toBeUndefined();
  });
});

describe('InMemoryAlertHistory', () => {
  it('records and retrieves last value', () => {
    const h = new InMemoryAlertHistory();
    h.recordValue('k', 5, 1);
    h.recordValue('k', 7, 2);
    expect(h.lastValue('k')).toBe(7);
  });

  it('zScore returns 0 for too few points', () => {
    const h = new InMemoryAlertHistory();
    h.recordValue('k', 1, 1);
    expect(h.zScore('k', 1000)).toBe(0);
  });

  it('zScore is 0 when stdev is 0', () => {
    const h = new InMemoryAlertHistory();
    for (let i = 0; i < 20; i++) h.recordValue('k', 5, i);
    expect(h.zScore('k', 1000)).toBe(0);
  });

  it('zScore spikes with a sudden jump', () => {
    const h = new InMemoryAlertHistory();
    const now = Date.now();
    for (let i = 0; i < 30; i++) h.recordValue('k', 10, now - (30 - i) * 1000);
    h.recordValue('k', 100, now);
    const z = h.zScore('k', 60_000);
    expect(z).toBeGreaterThan(5);
  });
});

describe('thresholdRules', () => {
  it('has 30+ rules', () => {
    expect(thresholdRules.length).toBeGreaterThanOrEqual(30);
  });

  it('every rule has id, severity, evaluate', () => {
    for (const r of thresholdRules) {
      expect(r.id).toBeTypeOf('string');
      expect(r.severity).toMatch(/info|warning|critical/);
      expect(typeof r.evaluate).toBe('function');
    }
  });

  it('service_down rule fires when health map is missing entries', async () => {
    const r = thresholdRules.find((x) => x.id === 'service_down')!;
    const result = await r.evaluate({
      services: [{ name: 'svc', url: 'http://x' }],
      serviceHealth: new Map([['svc', { service: 'svc', up: false, latencyMs: 1, checkedAt: 1, lastError: 'down' }]]),
      metrics: new Map(),
      dbStats: { connected: false, connectionCount: 0, maxConnections: 0, slowQueries: 0, databaseSizeMb: 0, tableSizes: [] },
      redisStats: { connected: false, usedMemoryMb: 0, maxMemoryMb: 0, connectedClients: 0, slowCommands: 0 },
      logErrors: { total: 0, byService: new Map(), byKind: new Map() },
      history: new InMemoryAlertHistory(),
    });
    expect(result).not.toBeNull();
    expect(result?.message).toContain('DOWN');
  });
});

describe('anomalyRules', () => {
  it('has at least 5 rules', () => {
    expect(anomalyRules.length).toBeGreaterThanOrEqual(5);
  });

  it('qps_drop rule fires with a sudden drop', async () => {
    const r = anomalyRules.find((x) => x.id === 'qps_drop')!;
    const h = new InMemoryAlertHistory();
    const now = Date.now();
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'manhuaworks_http_requests_total', value: 0, labels: {}, scrapedAt: now }]],
    ]);
    // build a baseline of 30 stable points at 100, then drop to 0
    for (let i = 0; i < 30; i++) h.recordValue('qps:svc', 100, now - (30 - i) * 1000);
    h.recordValue('qps:svc', 0, now);
    const out = await r.evaluate({
      services: [{ name: 'svc', url: 'http://x' }],
      serviceHealth: new Map(),
      metrics,
      dbStats: { connected: false, connectionCount: 0, maxConnections: 0, slowQueries: 0, databaseSizeMb: 0, tableSizes: [] },
      redisStats: { connected: false, usedMemoryMb: 0, maxMemoryMb: 0, connectedClients: 0, slowCommands: 0 },
      logErrors: { total: 0, byService: new Map(), byKind: new Map() },
      history: h,
    });
    expect(out).not.toBeNull();
  });
});
