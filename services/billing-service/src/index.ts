/**
 * billing-service 鍏ュ彛
 *  - Express + helmet + cors + pino-http
 *  - 绔彛 8090
 *  - 鍚姩鏃跺缓琛?+ 鍚姩閰嶉鑷姩閲嶇疆 cron
 */

import "dotenv/config";
import "./telemetry"; // MUST be first 鈥?OpenTelemetry SDK init

import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { closePool, getPool, initSchema } from "./config/db";
import { quotaService } from "./services/quotaService";
import { userClient } from "./clients/userClient";
import { projectClient } from "./clients/projectClient";
import { seedOnBoot } from "./seed";

async function main(): Promise<void> {
  // 1) 鍏堣繛涓€涓嬪簱锛宖ail-fast
  try {
    await getPool().query("SELECT 1");
    logger.info("[boot] db connected");
  } catch (err) {
    logger.error({ err }, "[boot] db connect failed");
    process.exit(1);
  }

  // 2) 建表 (idempotent)
  await initSchema();

  // 2.5) 婕旂ず璐﹀彿 + 浣欓 seed锛圠5-D锛屽箓绛夛紝澶辫触涓嶉樆濉烇級
  void seedOnBoot();

  // 3) 鍚厤棰?cron
  const stopCron = quotaService.startResetCron(env.QUOTA_RESET_INTERVAL_SEC);

  // 4) 鎺竴涓嬪閮ㄦ湇鍔★紙涓嶉樆濉炲惎鍔級
  void (async () => {
    const [u, p] = await Promise.all([userClient.ping(), projectClient.ping()]);
    logger.info({ user: u, project: p }, "[boot] upstream probes");
  })();

  // 5) 璧?HTTP
  const app = createApp();
  const server = app.listen(env.PORT, process.env.HOST ?? "0.0.0.0", () => {
    logger.info(
      `[boot] listening on http://127.0.0.1:${env.PORT} (env=${env.NODE_ENV})`
    );
  });

  // 浼橀泤鍋滄満
  const shutdown = (signal: string) => {
    logger.info(`[boot] received ${signal}, shutting down...`);
    stopCron();
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "[boot] unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "[boot] uncaughtException");
  });
}

main().catch((err) => {
  logger.error({ err }, "[boot] fatal");
  process.exit(1);
});
