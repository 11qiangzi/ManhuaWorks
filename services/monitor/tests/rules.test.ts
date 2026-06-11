import { describe, it, expect } from 'vitest';
import { thresholdRules } from '../src/rules/thresholdRules';
import { InMemoryAlertHistory } from '../src/alertHistory';
import type { RuleContext } from '../src/types';

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    services: [{ name: 'svc', url: 'http://x' }],
    serviceHealth: new Map(),
    metrics: new Map(),
    dbStats: { connected: false, connectionCount: 0, maxConnections: 0, slowQueries: 0, databaseSizeMb: 0, tableSizes: [] },
    redisStats: { connected: false, usedMemoryMb: 0, maxMemoryMb: 0, connectedClients: 0, slowCommands: 0 },
    logErrors: { total: 0, byService: new Map(), byKind: new Map() },
    history: new InMemoryAlertHistory(),
    ...overrides,
  };
}

describe('individual threshold rules', () => {
  it('p99_latency_high fires when p99 > 1s', async () => {
    const r = thresholdRules.find((x) => x.id === 'p99_latency_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 5, labels: { le: '0.5' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 50, labels: { le: '1' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 100, labels: { le: '2' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 100, labels: { le: '+Inf' }, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('p99_latency_high does not fire when p99 < 1s', async () => {
    const r = thresholdRules.find((x) => x.id === 'p99_latency_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 100, labels: { le: '0.5' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 100, labels: { le: '1' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_request_duration_seconds_bucket', value: 100, labels: { le: '+Inf' }, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).toBeNull();
  });

  it('error_rate_high fires when 5xx > 5%', async () => {
    const r = thresholdRules.find((x) => x.id === 'error_rate_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 1, labels: { status: '200' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 9, labels: { status: '500' }, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('error_rate_high does not fire when 5xx < 5%', async () => {
    const r = thresholdRules.find((x) => x.id === 'error_rate_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 100, labels: { status: '200' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 2, labels: { status: '500' }, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).toBeNull();
  });

  it('memory_high fires when RSS > 1GB', async () => {
    const r = thresholdRules.find((x) => x.id === 'memory_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'process_resident_memory_bytes', value: 2 * 1024 * 1024 * 1024, labels: {}, scrapedAt: 1 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('db_connection_pool_full fires when > 90%', async () => {
    const r = thresholdRules.find((x) => x.id === 'db_connection_pool_full')!;
    const out = await r.evaluate(makeCtx({
      dbStats: { connected: true, connectionCount: 95, maxConnections: 100, slowQueries: 0, databaseSizeMb: 0, tableSizes: [] },
    }));
    expect(out).not.toBeNull();
  });

  it('db_connection_pool_full does not fire when < 90%', async () => {
    const r = thresholdRules.find((x) => x.id === 'db_connection_pool_full')!;
    const out = await r.evaluate(makeCtx({
      dbStats: { connected: true, connectionCount: 50, maxConnections: 100, slowQueries: 0, databaseSizeMb: 0, tableSizes: [] },
    }));
    expect(out).toBeNull();
  });

  it('db_unreachable fires when connected=false', async () => {
    const r = thresholdRules.find((x) => x.id === 'db_unreachable')!;
    const out = await r.evaluate(makeCtx({
      dbStats: { connected: false, connectionCount: 0, maxConnections: 0, slowQueries: 0, databaseSizeMb: 0, tableSizes: [], error: 'ECONNREFUSED' },
    }));
    expect(out).not.toBeNull();
    expect(out?.message).toContain('ECONNREFUSED');
  });

  it('redis_oom fires when > 90%', async () => {
    const r = thresholdRules.find((x) => x.id === 'redis_oom')!;
    const out = await r.evaluate(makeCtx({
      redisStats: { connected: true, usedMemoryMb: 95, maxMemoryMb: 100, connectedClients: 0, slowCommands: 0 },
    }));
    expect(out).not.toBeNull();
  });

  it('redis_oom does not fire when no maxmemory set', async () => {
    const r = thresholdRules.find((x) => x.id === 'redis_oom')!;
    const out = await r.evaluate(makeCtx({
      redisStats: { connected: true, usedMemoryMb: 95, maxMemoryMb: 0, connectedClients: 0, slowCommands: 0 },
    }));
    expect(out).toBeNull();
  });

  it('event_loop_lag fires when > 200ms', async () => {
    const r = thresholdRules.find((x) => x.id === 'event_loop_lag')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'nodejs_eventloop_lag_seconds', value: 0.5, labels: {}, scrapedAt: 1 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('log_error_burst fires when service has > 100 errors', async () => {
    const r = thresholdRules.find((x) => x.id === 'log_error_burst')!;
    const byService = new Map<string, number>([['svc', 150]]);
    const out = await r.evaluate(makeCtx({ logErrors: { total: 150, byService, byKind: new Map() } }));
    expect(out).not.toBeNull();
  });

  it('service_slow_health fires when latency > 2s', async () => {
    const r = thresholdRules.find((x) => x.id === 'service_slow_health')!;
    const serviceHealth = new Map([
      ['svc', { service: 'svc', up: true, latencyMs: 3000, checkedAt: 1 }],
    ]);
    const out = await r.evaluate(makeCtx({ serviceHealth }));
    expect(out).not.toBeNull();
  });

  it('service_down fires when health up=false', async () => {
    const r = thresholdRules.find((x) => x.id === 'service_down')!;
    const serviceHealth = new Map([
      ['svc', { service: 'svc', up: false, latencyMs: 0, checkedAt: 1, lastError: 'connect ECONNREFUSED' }],
    ]);
    const out = await r.evaluate(makeCtx({ serviceHealth }));
    expect(out).not.toBeNull();
    expect(out?.message).toContain('connect ECONNREFUSED');
  });

  it('gc_pause_high fires when > 100ms', async () => {
    const r = thresholdRules.find((x) => x.id === 'gc_pause_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'nodejs_gc_duration_seconds_max', value: 0.2, labels: {}, scrapedAt: 1 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('open_fds_high fires when > 80%', async () => {
    const r = thresholdRules.find((x) => x.id === 'open_fds_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'process_open_fds', value: 900, labels: {}, scrapedAt: 1 },
        { service: 'svc', name: 'process_max_fds', value: 1000, labels: {}, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('uptime_low fires when ageSec < 300', async () => {
    const r = thresholdRules.find((x) => x.id === 'uptime_low')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'process_start_time_seconds', value: Date.now() / 1000 - 60, labels: {}, scrapedAt: 1 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('client_error_rate_high fires when 4xx > 25%', async () => {
    const r = thresholdRules.find((x) => x.id === 'client_error_rate_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 1, labels: { status: '200' }, scrapedAt: 1 },
        { service: 'svc', name: 'manhuaworks_http_requests_total', value: 9, labels: { status: '404' }, scrapedAt: 1 },
      ]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('ws_connections_high fires when > 5000', async () => {
    const r = thresholdRules.find((x) => x.id === 'ws_connections_high')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'manhuaworks_ws_connections', value: 6000, labels: {}, scrapedAt: 1 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });

  it('no_metrics_emitted fires when last sample > 60s old', async () => {
    const r = thresholdRules.find((x) => x.id === 'no_metrics_emitted')!;
    const metrics = new Map<string, any[]>([
      ['svc', [{ service: 'svc', name: 'foo', value: 1, labels: {}, scrapedAt: Date.now() - 120_000 }]],
    ]);
    const out = await r.evaluate(makeCtx({ metrics }));
    expect(out).not.toBeNull();
  });
});
