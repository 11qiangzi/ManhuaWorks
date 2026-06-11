// 调用日志：模型/延迟/成本/用户/任务类型
// 输出到 stdout（JSON 行）+ 可选注入到外部 sink。

import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import type { AppEnv } from "./auth.js";

export interface CallLogEntry {
  requestId: string;
  userId: string;
  task: string;
  provider: string;
  model: string;
  latencyMs: number;
  cost: number;
  usedByok: boolean;
  status: number;
  error?: string;
  ts: number;
}

const sinks: ((entry: CallLogEntry) => void)[] = [
  (e) => {
    // 默认 stdout JSON
    process.stdout.write(JSON.stringify({ type: "ai_call", ...e }) + "\n");
  },
];

export function addLogSink(fn: (entry: CallLogEntry) => void): void {
  sinks.push(fn);
}

export function logCall(entry: Omit<CallLogEntry, "ts" | "requestId"> & { requestId?: string }): void {
  const full: CallLogEntry = {
    requestId: entry.requestId ?? randomUUID(),
    ts: Date.now(),
    userId: entry.userId,
    task: entry.task,
    provider: entry.provider,
    model: entry.model,
    latencyMs: entry.latencyMs,
    cost: entry.cost,
    usedByok: entry.usedByok,
    status: entry.status,
    error: entry.error,
  };
  for (const s of sinks) {
    try {
      s(full);
    } catch {
      // 静默吞掉 sink 异常
    }
  }
}

/** 给请求注入 requestId，并记录访问结束 */
export const loggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const start = Date.now();
  let status = 200;
  try {
    await next();
    status = c.res.status;
  } catch (err) {
    status = 500;
    throw err;
  } finally {
    const user = c.get("user");
    process.stdout.write(
      JSON.stringify({
        type: "http_access",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status,
        userId: user?.userId,
        latencyMs: Date.now() - start,
        ts: Date.now(),
      }) + "\n",
    );
  }
});
