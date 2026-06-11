import type { RuleDefinition, RuleContext, RuleResult } from '../types';
import { findMetric, sumMetrics } from '../collectors/metricsScraper';

const Z_THRESHOLD = 2.5; // 2.5σ is "unusual"

function totalRequests(metrics: any[]): number {
  return sumMetrics(metrics, /^manhuaworks_http_requests_total$/);
}

const rules: RuleDefinition[] = [
  {
    id: 'qps_drop',
    name: 'Request volume sudden drop',
    description: 'QPS dropped by more than 3σ vs recent baseline',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = totalRequests(m);
        ctx.history.recordValue(`qps:${svc.name}`, v);
        const z = ctx.history.zScore(`qps:${svc.name}`, 5 * 60_000);
        if (z < -Z_THRESHOLD) {
          return {
            value: z,
            threshold: -Z_THRESHOLD,
            message: `${svc.name} QPS z-score ${z.toFixed(2)} (sudden drop)`,
            labels: { service: svc.name, rule: 'qps_drop' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'qps_spike',
    name: 'Request volume sudden spike',
    description: 'QPS jumped by more than 3σ vs recent baseline',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = totalRequests(m);
        ctx.history.recordValue(`qps:${svc.name}`, v);
        const z = ctx.history.zScore(`qps:${svc.name}`, 5 * 60_000);
        if (z > Z_THRESHOLD) {
          return {
            value: z,
            threshold: Z_THRESHOLD,
            message: `${svc.name} QPS z-score ${z.toFixed(2)} (sudden spike)`,
            labels: { service: svc.name, rule: 'qps_spike' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'error_rate_jump',
    name: 'Error rate sudden jump',
    description: '5xx error rate jumped vs recent baseline',
    severity: 'critical',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const total = totalRequests(m);
        if (total <= 0) continue;
        const errs = m
          .filter((x) => x.name === 'manhuaworks_http_requests_total' && /^5\d\d$/.test(x.labels.status ?? ''))
          .reduce((s, x) => s + x.value, 0);
        const rate = (errs / total) * 100;
        ctx.history.recordValue(`err5xx:${svc.name}`, rate);
        const z = ctx.history.zScore(`err5xx:${svc.name}`, 5 * 60_000);
        if (z > Z_THRESHOLD) {
          return {
            value: rate,
            threshold: 0,
            message: `${svc.name} 5xx rate ${rate.toFixed(2)}% z=${z.toFixed(2)}`,
            labels: { service: svc.name, rule: 'error_rate_jump' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'p99_jump',
    name: 'P99 latency sudden jump',
    description: 'P99 latency increased vs recent baseline',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        // Use sum/avg of bucket sum as a cheap proxy when histogram quantiles
        // aren't directly available.
        const total = sumMetrics(m, /^manhuaworks_http_request_duration_seconds_sum$/);
        const count = sumMetrics(m, /^manhuaworks_http_request_duration_seconds_count$/);
        if (count <= 0) continue;
        const avg = total / count;
        ctx.history.recordValue(`avgLatency:${svc.name}`, avg);
        const z = ctx.history.zScore(`avgLatency:${svc.name}`, 5 * 60_000);
        if (z > Z_THRESHOLD) {
          return {
            value: avg,
            threshold: 0,
            message: `${svc.name} avg latency ${(avg * 1000).toFixed(0)}ms z=${z.toFixed(2)}`,
            labels: { service: svc.name, rule: 'p99_jump' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'error_counter_jump',
    name: 'Errors captured sudden jump',
    description: 'Captured exception counter spiked vs baseline',
    severity: 'warning',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const svc of ctx.services) {
        const m = ctx.metrics.get(svc.name) ?? [];
        const v = findMetric(m, 'manhuaworks_errors_total') ?? 0;
        ctx.history.recordValue(`errs:${svc.name}`, v);
        const z = ctx.history.zScore(`errs:${svc.name}`, 5 * 60_000);
        if (z > Z_THRESHOLD) {
          return {
            value: v,
            threshold: 0,
            message: `${svc.name} errors counter ${v} z=${z.toFixed(2)}`,
            labels: { service: svc.name, rule: 'error_counter_jump' },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'log_volume_anomaly',
    name: 'Log volume anomaly',
    description: 'Log error volume deviates from baseline',
    severity: 'info',
    async evaluate(ctx: RuleContext): Promise<RuleResult | null> {
      for (const [service, count] of ctx.logErrors.byService.entries()) {
        ctx.history.recordValue(`logerr:${service}`, count);
        const z = ctx.history.zScore(`logerr:${service}`, 10 * 60_000);
        if (z > Z_THRESHOLD) {
          return {
            value: count,
            threshold: 0,
            message: `${service} log error count ${count} z=${z.toFixed(2)}`,
            labels: { service, rule: 'log_volume_anomaly' },
          };
        }
      }
      return null;
    },
  },
];

export const anomalyRules = rules;
