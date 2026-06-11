/**
 * project-service HTTP 客户端
 *
 * 注：project-service 还没起；本客户端用"读本地 DB 项目数"做兜底，
 * 避免 billing-service 启动时因依赖缺失无法运行。
 */

import { env } from "../config/env";
import { logger } from "../config/logger";
import { query } from "../config/db";

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

async function countProjectsLocal(userId: string): Promise<number> {
  try {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects WHERE user_id = $1`,
      [userId]
    );
    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    logger.warn({ err }, "[projectClient] local count failed");
    return 0;
  }
}

export const projectClient = {
  base: env.PROJECT_SERVICE_URL,

  async listByUser(userId: string, token?: string) {
    try {
      const r = await httpRequest(
        `${this.base}/api/v1/projects?user_id=${encodeURIComponent(userId)}`,
        { method: "GET", token, timeoutMs: 4000 }
      );
      if (r.status >= 200 && r.status < 300) {
        const body = r.body as { data?: { list?: unknown[] } | unknown[] };
        if (Array.isArray(body?.data)) return body.data;
        if (body?.data && typeof body.data === "object" && "list" in body.data) {
          return (body.data as { list: unknown[] }).list ?? [];
        }
        return [];
      }
      return null;
    } catch (err) {
      logger.warn({ err }, "[projectClient] listByUser failed");
      return null;
    }
  },

  /** 统计用户项目数；远端失败则用本地 DB 兜底 */
  async countUserProjects(userId: string): Promise<number> {
    const list = await this.listByUser(userId);
    if (Array.isArray(list)) return list.length;
    return countProjectsLocal(userId);
  },

  async ping(): Promise<boolean> {
    try {
      const r = await httpRequest(`${this.base}/health`, { method: "GET", timeoutMs: 2000 });
      return r.status === 200;
    } catch {
      return false;
    }
  },
};
