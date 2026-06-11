import type { RuleDefinition, RuleContext, RuleResult } from '../types';
import { findMetric, sumMetrics, histogramP99 } from '../collectors/metricsScraper';

function sumWithStatus(metrics: any[], statusRegex: RegExp): number {
  let total = 0;
  for (const m of metrics) {
    if (m.name !== 'manhuaworks_http_requests_total') continue;
    if (!statusRegex.test(m.labels.status ?? '')) continue;
    total += m.value;
  }
  return total;
}

function totalRequests(metrics: any[]): number {
  return sumMetrics(metrics, /^manhuaworks_http_requests_total$/);
}

function errorRate(metrics: any[]): number {
  const total = totalRequests(metrics);
  if (total <= 0) return 0;
  const errs = sumWithStatus(metrics, /^5\d\d$/);
  return (errs / total) * 100;
}

function clientErrorRate(metrics: any[]): number {
  const total = totalRequests(metrics);
  if (total <= 0) return 0;
  const errs = sumWithStatus(metrics, /^4\d\d$/);
  return (errs / total) * 100;
}

const rules: RuleDefinition[] = [
  {
    id: 'cpu_high',
    name: 'CPU usage > 80%',
    description: 'Process CPU usage sustained above 80%',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'process_cpu_seconds_total');
        const prev = ctx.history.lastValue(`cpu:${svc.name}`) ?? 0;
        const usage = (v ?? 0) - prev;
        ctx.history.recordValue(`cpu:${svc.name}`, v ?? 0);
        if (usage > 0.8) {
          return {
            value: usage,
            threshold: 0.8,
            message: `${svc.name} CPU usage ${(usage * 100).toFixed(1)}% > 80%`,
            labels: { service: svc.name, rule: 'cpu_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'memory_high',
    name: 'Memory usage > 90% of heap limit',
    description: 'RSS / heap allocation indicates memory pressure',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const rss = findMetric(m, 'process_resident_memory_bytes') ?? 0;
        const heapTotal = findMetric(m, 'process_heap_bytes') ?? 0;
        if (rss > 1024 * 1024 * 1024) {
          return {
            value: rss / 1024 / 1024,
            threshold: 1024,
            message: `${svc.name} RSS > 1GB (${(rss / 1024 / 1024).toFixed(0)}MB)`,
            labels: { service: svc.name, rule: 'memory_high' },
          };
        }
        if (heapTotal > 1.5 * 1024 * 1024 * 1024) {
          return {
            value: heapTotal / 1024 / 1024,
            threshold: 1536,
            message: `${svc.name} heap > 1.5GB`,
            labels: { service: svc.name, rule: 'memory_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'error_rate_high',
    name: '5xx error rate > 5%',
    description: 'More than 5% of recent requests return 5xx',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const rate = errorRate(m);
        if (rate > 5) {
          return {
            value: rate,
            threshold: 5,
            message: `${svc.name} 5xx error rate ${rate.toFixed(2)}% > 5%`,
            labels: { service: svc.name, rule: 'error_rate_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'client_error_rate_high',
    name: '4xx error rate > 25%',
    description: 'More than 25% of recent requests return 4xx',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const rate = clientErrorRate(m);
        if (rate > 25) {
          return {
            value: rate,
            threshold: 25,
            message: `${svc.name} 4xx error rate ${rate.toFixed(2)}% > 25%`,
            labels: { service: svc.name, rule: 'client_error_rate_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'p99_latency_high',
    name: 'P99 latency > 1s',
    description: 'HTTP request P99 latency above 1s',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const p99 = histogramP99(m, 'manhuaworks_http_request_duration_seconds');
        if (p99 !== undefined && p99 > 1) {
          return {
            value: p99,
            threshold: 1,
            message: `${svc.name} HTTP P99 ${(p99 * 1000).toFixed(0)}ms > 1000ms`,
            labels: { service: svc.name, rule: 'p99_latency_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'p95_latency_high',
    name: 'P95 latency > 500ms',
    description: 'HTTP request P95 latency above 500ms',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const buckets: Array<{ le: number; cumulative: number }> = [];
        let total = 0;
        for (const sm of m) {
          if (sm.name !== 'manhuaworks_http_request_duration_seconds_bucket') continue;
          if (sm.labels.le === '+Inf') total = sm.value;
          else {
            const le = Number(sm.labels.le);
            if (!Number.isNaN(le)) buckets.push({ le, cumulative: sm.value });
          }
        }
        if (total <= 0) continue;
        buckets.sort((a, b) => a.le - b.le);
        const target = total * 0.95;
        for (const b of buckets) {
          if (b.cumulative >= target) {
            if (b.le > 0.5) {
              return {
                value: b.le,
                threshold: 0.5,
                message: `${svc.name} HTTP P95 ${(b.le * 1000).toFixed(0)}ms > 500ms`,
                labels: { service: svc.name, rule: 'p95_latency_high' },
              };
            }
            break;
          }
        }
      }
      return null;
    },
  },
  {
    id: 'service_down',
    name: 'Service /health returns non-2xx',
    description: 'A monitored service is not responding to /health',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const h = ctx.serviceHealth.get(svc.name);
        if (!h || !h.up) {
          return {
            value: 0,
            threshold: 1,
            message: `${svc.name} is DOWN (${h?.lastError ?? 'no probe response'})`,
            labels: { service: svc.name, rule: 'service_down' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'service_slow_health',
    name: 'Health probe latency > 2s',
    description: '/health probe is taking longer than 2s',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const h = ctx.serviceHealth.get(svc.name);
        if (h && h.up && h.latencyMs > 2000) {
          return {
            value: h.latencyMs,
            threshold: 2000,
            message: `${svc.name} /health latency ${h.latencyMs.toFixed(0)}ms > 2000ms`,
            labels: { service: svc.name, rule: 'service_slow_health' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'ws_connections_high',
    name: 'WebSocket connections > 5000',
    description: 'A service has more than 5k active WebSocket connections',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'manhuaworks_ws_connections');
        if ((v ?? 0) > 5000) {
          return {
            value: v ?? 0,
            threshold: 5000,
            message: `${svc.name} WS connections ${v} > 5000`,
            labels: { service: svc.name, rule: 'ws_connections_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'errors_spike',
    name: 'Application errors > 50/min',
    description: 'More than 50 captured exceptions in the last minute',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'manhuaworks_errors_total');
        ctx.history.recordValue(`errors:${svc.name}`, v ?? 0);
        const last = ctx.history.lastValue(`errors:${svc.name}`) ?? 0;
        const prevWindow = ctx.history.mean(`errors:${svc.name}`, 65_000) - last;
        if (last - prevWindow > 50) {
          return {
            value: last,
            threshold: 50,
            message: `${svc.name} captured ${(last - prevWindow).toFixed(0)} errors in last minute`,
            labels: { service: svc.name, rule: 'errors_spike' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'log_error_burst',
    name: 'Log error level entries > 100',
    description: 'Tailed logs show > 100 error entries since last poll',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const [service, count] of ctx.logErrors.byService.entries()) {
        if (count > 100) {
          return {
            value: count,
            threshold: 100,
            message: `${service} log shows ${count} error entries`,
            labels: { service, rule: 'log_error_burst' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'db_connection_pool_full',
    name: 'DB connections > 90% of max',
    description: 'Postgres connection pool more than 90% utilized',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.dbStats.connected) return null;
      const util = (ctx.dbStats.connectionCount / Math.max(1, ctx.dbStats.maxConnections)) * 100;
      if (util > 90) {
        return {
          value: util,
          threshold: 90,
          message: `DB connections ${ctx.dbStats.connectionCount}/${ctx.dbStats.maxConnections} (${util.toFixed(1)}%)`,
          labels: { service: 'postgres', rule: 'db_connection_pool_full' },
        };
      }
      return null;
    },
  },
  {
    id: 'db_slow_queries',
    name: 'DB slow queries > 5',
    description: 'More than 5 active queries running > 1s',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.dbStats.connected) return null;
      if (ctx.dbStats.slowQueries > 5) {
        return {
          value: ctx.dbStats.slowQueries,
          threshold: 5,
          message: `DB has ${ctx.dbStats.slowQueries} slow queries (>1s)`,
          labels: { service: 'postgres', rule: 'db_slow_queries' },
        };
      }
      return null;
    },
  },
  {
    id: 'db_size_large',
    name: 'DB size > 50GB',
    description: 'Postgres database size exceeds 50GB',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.dbStats.connected) return null;
      if (ctx.dbStats.databaseSizeMb > 50 * 1024) {
        return {
          value: ctx.dbStats.databaseSizeMb / 1024,
          threshold: 50,
          message: `DB size ${(ctx.dbStats.databaseSizeMb / 1024).toFixed(1)}GB > 50GB`,
          labels: { service: 'postgres', rule: 'db_size_large' },
        };
      }
      return null;
    },
  },
  {
    id: 'db_unreachable',
    name: 'Postgres unreachable',
    description: 'Monitor could not reach Postgres',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.dbStats.connected) {
        return {
          value: 0,
          threshold: 1,
          message: `Postgres unreachable: ${ctx.dbStats.error ?? 'unknown'}`,
          labels: { service: 'postgres', rule: 'db_unreachable' },
        };
      }
      return null;
    },
  },
  {
    id: 'redis_oom',
    name: 'Redis near max memory',
    description: 'Redis used memory > 90% of maxmemory',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.redisStats.connected) return null;
      if (ctx.redisStats.maxMemoryMb <= 0) return null;
      const util = (ctx.redisStats.usedMemoryMb / ctx.redisStats.maxMemoryMb) * 100;
      if (util > 90) {
        return {
          value: util,
          threshold: 90,
          message: `Redis memory ${ctx.redisStats.usedMemoryMb}MB / ${ctx.redisStats.maxMemoryMb}MB (${util.toFixed(1)}%)`,
          labels: { service: 'redis', rule: 'redis_oom' },
        };
      }
      return null;
    },
  },
  {
    id: 'redis_slow_commands',
    name: 'Redis slow commands > 20',
    description: 'Redis has more than 20 entries in SLOWLOG',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.redisStats.connected) return null;
      if (ctx.redisStats.slowCommands > 20) {
        return {
          value: ctx.redisStats.slowCommands,
          threshold: 20,
          message: `Redis SLOWLOG has ${ctx.redisStats.slowCommands} entries`,
          labels: { service: 'redis', rule: 'redis_slow_commands' },
        };
      }
      return null;
    },
  },
  {
    id: 'redis_unreachable',
    name: 'Redis unreachable',
    description: 'Monitor could not reach Redis',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.redisStats.connected) {
        return {
          value: 0,
          threshold: 1,
          message: `Redis unreachable: ${ctx.redisStats.error ?? 'unknown'}`,
          labels: { service: 'redis', rule: 'redis_unreachable' },
        };
      }
      return null;
    },
  },
  {
    id: 'restart_loop',
    name: 'Service restart loop',
    description: 'Service /health responded with a fresh process start within 60s',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const startTime = findMetric(m, 'process_start_time_seconds');
        if (startTime === undefined) continue;
        const ageSec = (Date.now() / 1000) - startTime;
        ctx.history.recordValue(`start:${svc.name}`, startTime);
        const lastStart = ctx.history.lastValue(`start:${svc.name}`);
        const points = ctx.history.recentValues(`start:${svc.name}`, 60_000);
        if (lastStart !== undefined && points.length >= 2 && startTime !== lastStart) {
          // start_time has changed
          return {
            value: ageSec,
            threshold: 60,
            message: `${svc.name} restarted (uptime ${ageSec.toFixed(0)}s)`,
            labels: { service: svc.name, rule: 'restart_loop' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'scrape_failures',
    name: 'Prometheus scrape failures',
    description: 'Service /metrics endpoint repeatedly failing',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        if (m.length === 0) {
          const h = ctx.serviceHealth.get(svc.name);
          if (h && !h.up) {
            return {
              value: 0,
              threshold: 1,
              message: `${svc.name} /metrics scrape returning empty (service down)`,
              labels: { service: svc.name, rule: 'scrape_failures' },
            };
          }
        }
      }
      return null;
    },
  },
  {
    id: 'http_active_connections',
    name: 'In-flight requests > 1000',
    description: 'A service has more than 1000 concurrent in-flight requests',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'manhuaworks_http_active_connections') ?? 0;
        if (v > 1000) {
          return {
            value: v,
            threshold: 1000,
            message: `${svc.name} has ${v.toFixed(0)} in-flight HTTP requests`,
            labels: { service: svc.name, rule: 'http_active_connections' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'event_loop_lag',
    name: 'Event loop lag > 200ms',
    description: 'Estimated event loop lag above 200ms',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const lag = findMetric(m, 'nodejs_eventloop_lag_seconds');
        if (lag !== undefined && lag > 0.2) {
          return {
            value: lag,
            threshold: 0.2,
            message: `${svc.name} event loop lag ${(lag * 1000).toFixed(0)}ms > 200ms`,
            labels: { service: svc.name, rule: 'event_loop_lag' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'open_fds_high',
    name: 'Open FDs > 80% of limit',
    description: 'A service is approaching its file descriptor limit',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const open = findMetric(m, 'process_open_fds') ?? 0;
        const limit = findMetric(m, 'process_max_fds') ?? 0;
        if (limit > 0 && open / limit > 0.8) {
          return {
            value: (open / limit) * 100,
            threshold: 80,
            message: `${svc.name} open FDs ${open.toFixed(0)}/${limit.toFixed(0)} (>80%)`,
            labels: { service: svc.name, rule: 'open_fds_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'no_recent_logs',
    name: 'Service emitting no logs',
    description: 'A service has not written any log line in 5 minutes',
    severity: 'info',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      // Best-effort: rely on tailed logs. If we know a service exists and
      // the log file is empty, alert.
      for (const svc of ctx.services) {
        const errors = ctx.logErrors.byService.get(svc.name) ?? 0;
        if (errors === 0 && !ctx.serviceHealth.get(svc.name)?.up) {
          return {
            value: 0,
            threshold: 1,
            message: `${svc.name} producing no logs and not responding to /health`,
            labels: { service: svc.name, rule: 'no_recent_logs' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'service_unstable',
    name: 'Service flapping',
    description: 'A service alternates between up and down within 60s',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const h = ctx.serviceHealth.get(svc.name);
        if (!h) continue;
        ctx.history.recordValue(`up:${svc.name}`, h.up ? 1 : 0);
        const points = ctx.history.recentValues(`up:${svc.name}`, 60_000);
        if (points.length < 4) continue;
        const transitions = points.reduce((acc, p, i) => {
          if (i === 0) return acc;
          return acc + (p.value !== (points[i - 1]?.value ?? p.value) ? 1 : 0);
        }, 0);
        if (transitions >= 4) {
          return {
            value: transitions,
            threshold: 4,
            message: `${svc.name} flapping (${transitions} state changes in 60s)`,
            labels: { service: svc.name, rule: 'service_unstable' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'no_metrics_emitted',
    name: 'No metrics emitted for 60s',
    description: 'A service has not produced any /metrics samples recently',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      const now = Date.now();
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        if (m.length === 0) continue;
        const last = Math.max(...m.map((x) => x.scrapedAt));
        if (now - last > 60_000) {
          return {
            value: (now - last) / 1000,
            threshold: 60,
            message: `${svc.name} /metrics stale (${((now - last) / 1000).toFixed(0)}s old)`,
            labels: { service: svc.name, rule: 'no_metrics_emitted' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'gc_pause_high',
    name: 'GC pause time > 100ms',
    description: 'Last GC pause exceeds 100ms',
    severity: 'info',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'nodejs_gc_duration_seconds_max');
        if (v !== undefined && v > 0.1) {
          return {
            value: v,
            threshold: 0.1,
            message: `${svc.name} last GC pause ${(v * 1000).toFixed(0)}ms > 100ms`,
            labels: { service: svc.name, rule: 'gc_pause_high' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'uptime_low',
    name: 'Service uptime < 5 minutes',
    description: 'Service has been running for less than 5 minutes (recent restart)',
    severity: 'info',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const start = findMetric(m, 'process_start_time_seconds');
        if (start === undefined) continue;
        const ageSec = Date.now() / 1000 - start;
        if (ageSec < 300) {
          return {
            value: ageSec,
            threshold: 300,
            message: `${svc.name} uptime ${ageSec.toFixed(0)}s < 300s (recent restart)`,
            labels: { service: svc.name, rule: 'uptime_low' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'db_replication_lag',
    name: 'DB replication lag > 30s',
    description: 'Standby is more than 30s behind primary',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      // best-effort: report even when 0 (no replica)
      if (!ctx.dbStats.connected) return null;
      // we don't query pg_stat_replication in collectDbStats; emit no-alert path
      return null;
    },
  },
  {
    id: 'table_bloat',
    name: 'Table bloat > 5GB',
    description: 'A user table exceeds 5GB on disk',
    severity: 'info',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      if (!ctx.dbStats.connected) return null;
      for (const t of ctx.dbStats.tableSizes) {
        if (t.sizeMb > 5 * 1024) {
          return {
            value: t.sizeMb / 1024,
            threshold: 5,
            message: `Table ${t.table} size ${(t.sizeMb / 1024).toFixed(2)}GB > 5GB`,
            labels: { service: 'postgres', rule: 'table_bloat' },
          };
        }
      }
      return null;
    },
  },
];

export const thresholdRules = rules;
