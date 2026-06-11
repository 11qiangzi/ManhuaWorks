/**
 * WS 握手 smoke 测试
 *  - 启动 in-process 监听:0 (随机端口)
 *  - 客户端用 ws 连, 期望收到 system/connected
 *  - 退出
 *
 * 用法: tsx tests/ws-smoke.ts (需先 npm run dev 启服务 或 单元内自启)
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import { WebSocket as WSClient } from "ws";
import { config as loadEnv } from "dotenv";
loadEnv();

import { createApp } from "../src/app.js";
import { attachWebSocket } from "../src/ws/server.js";
import { logger } from "../src/config/logger.js";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 18091);
  const app = createApp();
  const server = http.createServer(app);
  attachWebSocket(server);

  await new Promise<void>((resolve) => server.listen(port, resolve));
  logger.info({ port }, "[smoke] 服务启动");

  const secret = process.env.JWT_SECRET ?? "mhw_collab_jwt_secret_dev_only_change_in_prod_2026";
  const userId = "00000000-0000-0000-0000-000000000999";
  const token = jwt.sign({ sub: userId, role: 1 }, secret, { expiresIn: "1h" });

  const url = `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`;
  const client = new WSClient(url);

  const result = await new Promise<{ ok: boolean; got?: unknown }>((resolve) => {
    const t = setTimeout(() => resolve({ ok: false }), 5000);
    client.on("open", () => {
      client.send(JSON.stringify({ type: "ping" }));
    });
    client.on("message", (data) => {
      try {
        const env = JSON.parse(data.toString());
        if (env.type === "system" && env.event === "connected") {
          clearTimeout(t);
          resolve({ ok: true, got: env });
        }
      } catch {
        // ignore
      }
    });
    client.on("error", (err) => {
      clearTimeout(t);
      resolve({ ok: false });
      logger.warn({ err }, "[smoke] ws error");
    });
  });

  client.close();
  server.close();

  if (!result.ok) {
    logger.error("[smoke] ❌ WS 握手未收到 system/connected");
    process.exit(1);
  }
  logger.info({ got: result.got }, "[smoke] ✅ WS 握手成功");
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[smoke] fatal:", err);
  process.exit(1);
});
