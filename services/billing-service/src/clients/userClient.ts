/**
 * user-service HTTP 客户端
 * 用 node:http（不引新依赖），失败时降级
 */

import { env } from "../config/env";
import { logger } from "../config/logger";

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

async function httpRequest(
  url: string,
  opts: FetchOptions = {}
): Promise<{ status: number; body: unknown }> {
  const u = new URL(url);
  const isHttps = u.protocol === "https:";
  const lib = isHttps ? await import("node:https") : await import("node:http");
  const data = opts.body ? JSON.stringify(opts.body) : undefined;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (data) headers["Content-Length"] = String(Buffer.byteLength(data));

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: opts.method ?? "GET",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          let parsed: unknown = text;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            /* keep text */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      }
    );
    req.on("error", reject);
    const t = setTimeout(() => req.destroy(new Error("timeout")), opts.timeoutMs ?? 5000);
    req.on("close", () => clearTimeout(t));
    if (data) req.write(data);
    req.end();
  });
}

export const userClient = {
  base: env.USER_SERVICE_URL,

  /** 拉一个用户基本信息（用于跨服务校验） */
  async getUser(userId: string, token?: string) {
    try {
      const r = await httpRequest(`${this.base}/api/v1/users/${userId}`, {
        method: "GET",
        token,
        timeoutMs: 4000,
      });
      if (r.status >= 200 && r.status < 300) {
        const body = r.body as { data?: unknown };
        return body?.data ?? null;
      }
      logger.warn({ status: r.status }, "[userClient] getUser non-2xx");
      return null;
    } catch (err) {
      logger.warn({ err }, "[userClient] getUser failed");
      return null;
    }
  },

  /** 健康检查 */
  async ping(): Promise<boolean> {
    try {
      const r = await httpRequest(`${this.base}/health`, { method: "GET", timeoutMs: 2000 });
      return r.status === 200;
    } catch {
      return false;
    }
  },
};
