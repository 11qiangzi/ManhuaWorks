/**
 * ManhuaWorks ai-keys-service入口
 *
 * - Hono框架 + @hono/node-server
 * -监听8083
 * -路由：
 * /health
 * /v1/keys/*
 * -启动时拉起 rotation cron
 * -优雅停机（SIGINT/SIGTERM）
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { config } from "./config.js";
import keysRoute from "./keys/routes.js";
import { startRotationCron } from "./keys/rotation.js";

const app = new Hono();

/* ───────────────── 全局中间件 ───────────────── */
app.use("*", logger());
app.use(
 "*",
 cors({
 origin: (origin) => origin ?? "*",
 allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
 allowHeaders: ["Content-Type", "Authorization"],
 credentials: true,
 })
);

/* ───────────────── 健康检查 ───────────────── */
app.get("/health", (c) =>
 c.json({
 code:0,
 message:"ok",
 data: {
 service:"ai-keys-service",
 version:"0.1.0",
 uptime_sec: Math.floor(process.uptime()),
 env: config.NODE_ENV,
 ts: new Date().toISOString(),
 },
 })
);

/* ─────────────────业务路由 ───────────────── */
const v1 = new Hono();
v1.route("/keys", keysRoute);
app.route("/v1", v1);

/* ─────────────────根路径 ───────────────── */
app.get("/", (c) =>
 c.json({
 code:0,
 message:"ManhuaWorks ai-keys-service",
 data: {
 service:"ai-keys-service",
 endpoints: [
 "GET /health",
 "POST /v1/keys",
 "GET /v1/keys",
 "GET /v1/keys/:id",
 "PATCH /v1/keys/:id",
 "DELETE /v1/keys/:id",
 "POST /v1/keys/:id/validate",
 "POST /v1/keys/:id/rotate",
 ],
 },
 })
);

/* ─────────────────错误兜底 ───────────────── */
app.notFound((c) =>
 c.json({ code:404, message:"not_found", path: c.req.path },404)
);

app.onError((err, c) => {
 // eslint-disable-next-line no-console
 console.error("[ai-keys-service] unhandled error:", err);
 return c.json(
 {
 code:500,
 message:"internal_error",
 detail: config.isProd ? undefined : String(err?.message ?? err),
 },
500
 );
});

/* ─────────────────启动 ───────────────── */
const stopCron = startRotationCron();

const server = serve(
 {
 fetch: app.fetch,
 port: config.PORT,
 hostname:"0.0.0.0",
 },
 (info) => {
 // eslint-disable-next-line no-console
 console.log(
 `[ai-keys-service] listening on http://0.0.0.0:${info.port} (env=${config.NODE_ENV})`
 );
 }
);

/* ─────────────────优雅停机 ───────────────── */
const shutdown = (signal: string) => {
 // eslint-disable-next-line no-console
 console.log(`[ai-keys-service] received ${signal}, shutting down...`);
 stopCron();
 server.close(() => process.exit(0));
 //兜底：5 秒强制退出
 setTimeout(() => process.exit(1),5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
