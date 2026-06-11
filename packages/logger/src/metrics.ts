import client, { Registry, Counter as PCounter, Gauge as PGauge, Histogram as PHistogram, Summary as PSummary, collectDefaultMetrics } from 'prom-client';

export interface MetricLabels {
  [key: string]: string | number | boolean;
}

export interface MetricsRegistry {
  registry: Registry;
  counter(name: string, help: string, labelNames?: string[]): PCounter<string>;
  gauge(name: string, help: string, labelNames?: string[]): PGauge<string>;
  histogram(name: string, help: string, labelNames?: string[], buckets?: number[]): PHistogram<string>;
  summary(name: string, help: string, labelNames?: string[], percentiles?: number[]): PSummary<string>;
  contentType(): string;
  serialize(): Promise<string>;
  reset(): void;
}

let defaultRegistry: Registry | null = null;

function getDefaultRegistry(): Registry {
  if (!defaultRegistry) {
    defaultRegistry = new Registry();
    defaultRegistry.setDefaultLabels({ app: 'manhuaworks' });
    try {
      collectDefaultMetrics({ register: defaultRegistry });
    } catch {
      // ignore: collectDefaultMetrics may already be registered in some envs
    }
  }
  return defaultRegistry;
}

export function makeRegistry(prefix = 'manhuaworks_'): MetricsRegistry {
  const registry = new Registry();
  registry.setDefaultLabels({ app: 'manhuaworks' });

  const wrap = (name: string) => `${prefix}${name}`;

  return {
    registry,
    counter(name, help, labelNames = []) {
      return new client.Counter({ name: wrap(name), help, labelNames, registers: [registry] });
    },
    gauge(name, help, labelNames = []) {
      return new client.Gauge({ name: wrap(name), help, labelNames, registers: [registry] });
    },
    histogram(name, help, labelNames = [], buckets) {
      return new client.Histogram({
        name: wrap(name),
        help,
        labelNames,
        buckets: buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [registry],
      });
    },
    summary(name, help, labelNames = [], percentiles = [0.5, 0.9, 0.95, 0.99]) {
      return new client.Summary({
        name: wrap(name),
        help,
        labelNames,
        percentiles,
        registers: [registry],
      });
    },
    contentType() {
      return registry.contentType;
    },
    async serialize() {
      return registry.metrics();
    },
    reset() {
      registry.resetMetrics();
    },
  };
}

export const metrics: MetricsRegistry = (() => {
  const r = getDefaultRegistry();
  return makeRegistry('manhuaworks_');
})();

export function registry(): Registry {
  return getDefaultRegistry();
}

export { client };
export type { PCounter as Counter, PGauge as Gauge, PHistogram as Histogram, PSummary as Summary };

// ---------------------------------------------------------------------------
// Predefined metrics used by express/ws middleware
// ---------------------------------------------------------------------------

export interface BuiltinMetrics {
  httpRequestsTotal: PCounter<string>;
  httpRequestErrors: PCounter<string>;
  httpRequestDuration: PHistogram<string>;
  httpActiveConnections: PGauge<string>;
  wsConnections: PGauge<string>;
  wsMessages: PCounter<string>;
  errorsTotal: PCounter<string>;
}

let builtins: BuiltinMetrics | null = null;

export function getBuiltinMetrics(prefix = 'manhuaworks_'): BuiltinMetrics {
  if (builtins) return builtins;
  const reg = makeRegistry(prefix);
  builtins = {
    httpRequestsTotal: reg.counter(
      'http_requests_total',
      'Total HTTP requests handled',
      ['service', 'method', 'route', 'status'],
    ),
    httpRequestErrors: reg.counter(
      'http_request_errors_total',
      'HTTP requests resulting in 4xx/5xx',
      ['service', 'method', 'route', 'status'],
    ),
    httpRequestDuration: reg.histogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['service', 'method', 'route', 'status'],
    ),
    httpActiveConnections: reg.gauge(
      'http_active_connections',
      'Number of in-flight HTTP requests',
      ['service'],
    ),
    wsConnections: reg.gauge('ws_connections', 'Active WebSocket connections', ['service']),
    wsMessages: reg.counter('ws_messages_total', 'WebSocket messages received/sent', ['service', 'direction', 'event']),
    errorsTotal: reg.counter('errors_total', 'Captured exceptions', ['service', 'kind']),
  };
  return builtins;
}
