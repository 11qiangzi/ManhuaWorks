import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'manhuaworks-monitor' });
try {
  collectDefaultMetrics({ register: registry });
} catch {
  // collectDefaultMetrics may fail if some collectors already exist; safe to ignore.
}

export const alertsFired = new Counter({
  name: 'manhuaworks_monitor_alerts_fired_total',
  help: 'Total alerts fired',
  labelNames: ['service', 'rule', 'severity', 'channel'],
  registers: [registry],
});

export const alertsResolved = new Counter({
  name: 'manhuaworks_monitor_alerts_resolved_total',
  help: 'Total alerts resolved',
  labelNames: ['service', 'rule', 'severity'],
  registers: [registry],
});

export const activeAlerts = new Gauge({
  name: 'manhuaworks_monitor_active_alerts',
  help: 'Currently firing alerts',
  labelNames: ['service', 'rule', 'severity'],
  registers: [registry],
});

export const scrapeErrors = new Counter({
  name: 'manhuaworks_monitor_scrape_errors_total',
  help: 'Errors while scraping /metrics',
  labelNames: ['service', 'kind'],
  registers: [registry],
});

export const serviceUp = new Gauge({
  name: 'manhuaworks_monitor_service_up',
  help: '1 if last health probe succeeded, 0 otherwise',
  labelNames: ['service'],
  registers: [registry],
});

export const serviceLatencyMs = new Histogram({
  name: 'manhuaworks_monitor_service_probe_latency_ms',
  help: 'Health probe latency in ms',
  labelNames: ['service'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const scrapesTotal = new Counter({
  name: 'manhuaworks_monitor_scrapes_total',
  help: 'Successful Prometheus scrapes',
  labelNames: ['service'],
  registers: [registry],
});
