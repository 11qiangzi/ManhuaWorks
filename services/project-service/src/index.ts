/**
 * project-service 启动入口（最小化）
 */
import "dotenv/config";
import http from "node:http";
import { createApp } from "./app";
import { logger } from "./config/logger";
import { bootstrapTables, closeDb, pingDb } from "./config/db";

const PORT = Number(process.env.PORT ?? 8089);
const HOST = process.env.HOST ?? "127.0.0.1";

async function bootstrap(): Promise<void> {
  const dbOk = await pingDb();
  logger.info({ dbOk }, "project-service db ping");
  // 建扩展表（project_versions / project_members / project_tags / shots）
  try {
    await bootstrapTables();
  } catch (err) {
    logger.warn({ err }, "bootstrap tables skipped/failed (可能已存在或 ping 失败)");
  }
  const app = createApp();
  const server = http.createServer(app);

  // 派单 25: keep-alive timeout 配长一点, 减少并发下连接重建
  server.keepAliveTimeout = 65_000; // 65s
  server.headersTimeout = 66_000;   // 66s (需 > keepAliveTimeout)

  server.listen(PORT, HOST, () => {
    logger.info({ port: PORT, host: HOST }, `project-service listening on http://${HOST}:${PORT}`);

    // 派单 25: 启动后自温 (预热 DB 连接池, 避免首次请求 748ms 冷启动)
    const warmupUrl = `http://${HOST}:${PORT}/health`;
    http.get(warmupUrl, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        logger.info({ status: res.statusCode, body: body.slice(0, 120) }, 'warmup /health done');
      });
    }).on('error', (e) => {
      logger.warn({ err: e.message }, 'warmup /health failed (non-blocking)');
    });
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error({ err }, "bootstrap failed");
  process.exit(1);
});
