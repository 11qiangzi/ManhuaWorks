import './telemetry'; // MUST be first — OpenTelemetry SDK init
import 'dotenv/config';
import { createApp } from './app';
import { closeDb, pingDb } from './config/db';
import { logger } from './config/logger';

const PORT = Number(process.env.PORT ?? 8088);
const HOST = '0.0.0.0';

async function bootstrap() {
  const app = createApp();

  const dbOk = await pingDb();
  if (!dbOk) {
    logger.warn('DB ping failed at startup; will keep serving /health with degraded status');
  } else {
    logger.info('DB connected');
  }

  const server = app.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST }, `user-service listening on http://${HOST}:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandledRejection');
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed');
  process.exit(1);
});
