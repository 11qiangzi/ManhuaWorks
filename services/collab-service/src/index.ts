/**
 * collab-service 鍏ュ彛
 *  - 鍚姩 HTTP + WebSocket
 *  - 浼橀泤鍏抽棴
 */
import "./telemetry"; // MUST be first 鈥?OpenTelemetry SDK init
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createApp } from "./app.js";
import { attachWebSocket } from "./ws/server.js";
import { closeDb } from "./config/db.js";
import { closeRedis } from "./config/redis.js";

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  attachWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(env.PORT, env.HOST ?? "0.0.0.0", () => {
      logger.info(
        { port: env.PORT, wsPath: env.WS_PATH, env: env.NODE_ENV },
        `collab-service 宸插惎鍔?:${env.PORT} (WS: ${env.WS_PATH})`
      );
      resolve();
    });
  });

  // 优雅关闭
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "[graceful-shutdown] start");
    server.close(() => {
      logger.info("HTTP server closed");
    });
    try {
      await closeDb();
      await closeRedis();
    } catch (err) {
      logger.warn({ err }, "[shutdown-error] close resource");
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, "鍚姩澶辫触");
  process.exit(1);
});
