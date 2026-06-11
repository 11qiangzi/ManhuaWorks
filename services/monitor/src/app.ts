import express, { Express } from 'express';
import { createLogger, httpLoggerMiddleware, errorHandlerMiddleware } from '@manhuaworks/logger';
import { buildRoutes } from './routes';
import { AlertManager } from './alerts/alertManager';
import { feishuChannel } from './alerts/channels/feishu';
import { emailChannel } from './alerts/channels/email';
import { webhookChannel } from './alerts/channels/webhook';
import { config } from './config';
import { InMemoryAlertHistory } from './alertHistory';
import { sharedLogTailer } from './collectors/logTailer';
import type { RuleContext, ServiceTarget, ServiceHealthSnapshot, ScapedMetric, DbStats, RedisStats, LogErrorCount } from './types';
import { thresholdRules } from './rules/thresholdRules';
import { anomalyRules } from './rules/anomalyRules';
import { probeAll } from './collectors/serviceHealth';
import { scrapeAll } from './collectors/metricsScraper';
import { collectDbStats } from './collectors/dbStats';
import { collectRedisStats } from './collectors/redisStats';
import { probeService } from './collectors/serviceHealth';
import { scrapeServiceMetrics } from './collectors/metricsScraper';
import { scrapeErrors } from './registry';

export interface AppDeps {
  services?: ServiceTarget[];
  logger?: ReturnType<typeof createLogger>;
  history?: InMemoryAlertHistory;
  logTailer?: typeof sharedLogTailer;
}

export interface BuiltApp {
  app: Express;
  alertManager: AlertManager;
  history: InMemoryAlertHistory;
  ruleEngineLoop: () => Promise<void>;
  startCollectors: () => Promise<void>;
  stopCollectors: () => Promise<void>;
}

export function buildApp(deps: AppDeps = {}): BuiltApp {
  const logger = deps.logger ?? createLogger('monitor');
  const history = deps.history ?? new InMemoryAlertHistory();
  const logTailer = deps.logTailer ?? sharedLogTailer;
  const services = deps.services ?? config.services;

  const channels = [
    feishuChannel({ webhookUrl: config.FEISHU_WEBHOOK_URL, defaultAtMobiles: config.FEISHU_DEFAULT_AT ? [config.FEISHU_DEFAULT_AT] : [] }),
    emailChannel({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
      password: config.SMTP_PASSWORD,
      from: config.SMTP_USER || 'monitor@manhuaworks.local',
      to: config.ALERT_EMAIL_TO,
    }),
    webhookChannel({ url: config.GENERIC_WEBHOOK_URL }),
  ];

  const alertManager = new AlertManager({
    channels,
    criticalChannels: [],
    logger,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(httpLoggerMiddleware({ service: 'monitor', logger, skipPaths: ['/health', '/metrics'] }));
  app.use(buildRoutes(alertManager));
  app.use(errorHandlerMiddleware({ service: 'monitor', logger }));

  // ---- collector / rule engine loop ----

  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let lastHealth = new Map<string, ServiceHealthSnapshot>();
  let lastMetrics = new Map<string, ScapedMetric[]>();
  let lastLogErrors: LogErrorCount = { total: 0, byService: new Map(), byKind: new Map() };

  async function runOnce(): Promise<void> {
    const [health, metrics, logErrs, db, redis] = await Promise.all([
      probeAll(services),
      scrapeAll(services),
      logTailer.poll(),
      collectDbStats(),
      collectRedisStats(),
    ]);
    lastHealth = health;
    lastMetrics = metrics;
    lastLogErrors = logErrs;

    const ctx: RuleContext = {
      services,
      serviceHealth: health,
      metrics,
      dbStats: db,
      redisStats: redis,
      logErrors: logErrs,
      history,
    };

    const allRules = [...thresholdRules, ...anomalyRules];
    const firedKeys = new Set<string>();
    for (const rule of allRules) {
      try {
        const r = await rule.evaluate(ctx);
        if (r) {
          const key = `${r.labels?.service ?? 'unknown'}::${rule.id}`;
          firedKeys.add(key);
          await alertManager.submit(rule, r);
        }
      } catch (err) {
        scrapeErrors.inc({ service: 'monitor', kind: 'rule' });
        logger.error({ err: (err as Error).message, rule: rule.id }, 'rule_evaluation_failed');
      }
    }

    // Resolve alerts that are no longer firing.
    for (const active of alertManager.listActive()) {
      const key = `${active.service}::${active.rule}`;
      if (!firedKeys.has(key)) {
        await alertManager.resolve(active.rule, active.service);
      }
    }
  }

  async function startCollectors(): Promise<void> {
    if (running) return;
    running = true;
    await logTailer.init(services.map((s) => s.name));
    // First pass
    await runOnce();
    timer = setInterval(() => {
      runOnce().catch((err) => logger.error({ err: (err as Error).message }, 'collector_loop_error'));
    }, Math.max(2000, config.SCRAPE_INTERVAL_MS));
  }

  async function stopCollectors(): Promise<void> {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    app,
    alertManager,
    history,
    ruleEngineLoop: runOnce,
    startCollectors,
    stopCollectors,
  };
}

// Re-exports for tests
export { probeService, scrapeServiceMetrics };
