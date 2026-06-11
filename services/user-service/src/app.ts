import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { router } from './routes';
import { errorHandler, notFoundHandler } from '@manhuaworks/shared';
import { rateLimit } from '@manhuaworks/shared/middleware/rate-limit';
import { healthRouter } from '@manhuaworks/shared';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 全局限流: 50 req/min/IP (派单 62 API-006 下调)
  app.use(rateLimit({ windowMs: 60_000, maxRequests: 50 }));
  app.use(pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }));

  app.get('/', (_req, res) => {
    res.json({
      code: 0,
      message: 'ManhuaWorks user-service',
      data: { service: 'user-service', version: '0.2.0' },
    });
  });

  // 标准化健康检查 (liveness / readiness / full)
  app.use('/health', healthRouter({
    service: 'user-service',
    version: '0.3.0',
    dbCheck: async () => {
      try {
        const { pool } = await import('./config/db');
        await pool.query('SELECT 1');
        return true;
      } catch { return false; }
    },
  }));

  app.use('/api/v1', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
