import './telemetry'; // MUST be first — OpenTelemetry SDK init
import { config } from './config';
import { buildApp } from './app';
import { createLogger } from '@manhuaworks/logger';

const logger = createLogger('monitor');

async function main(): Promise<void> {
  const { app, startCollectors, stopCollectors } = buildApp();
  await startCollectors();

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'monitor_listening');
  });

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'shutting_down');
    server.close();
    await stopCollectors();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err: (err as Error).message }, 'fatal');
  process.exit(1);
});
