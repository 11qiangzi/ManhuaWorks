/**
 * ai-keys-service HTTP 客户端
 * 用于查询用户是否开启了 BYOK、配额用量、剩余预算。
 * orchestrator 不直接拿明文 Key，只读元数据。
 */

import { config } from "../config.js";

export interface KeySummary {
  id: string;
  providerId: string;
  ownerUserId: string | null;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
  monthlyUsageUsd: number;
  enabled: boolean;
}

export interface QuotaInfo {
  userId: string;
  tier: string;
  /** 月度配额（USD），-1 表示无限 */
  monthlyQuotaUsd: number;
  /** 已用（USD） */
  monthlyUsedUsd: number;
  /** 剩余（USD），-1 表示无限 */
  monthlyRemainingUsd: number;
  /** 重置时间戳（ms） */
  resetAt: number;
}

export class ByokClientError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[ai-keys ${status} ${endpoint}] ${message}`);
    this.name = "ByokClientError";
  }
}

async function call<T>(endpoint: string, method: "GET" | "POST", body?: unknown, timeoutMs?: number): Promise<T> {
  const url = `${config.byok.url}${endpoint}`;
  const ms = timeoutMs ?? config.byok.timeoutMs;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const resp = await fetch(url, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${config.auth.apiKey}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new ByokClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof ByokClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ByokClientError(504, endpoint, `timeout after ${ms}ms`);
    }
    throw new ByokClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export const byokClient = {
  /** 列出用户的 BYOK Keys（仅元数据，不含明文） */
  listByok(userId: string) {
    return call<{ count: number; keys: KeySummary[] }>(`/v1/keys?ownerUserId=${encodeURIComponent(userId)}&byok=true`, "GET");
  },
  /** 查询用户配额（USD / 月） */
  quota(userId: string) {
    return call<QuotaInfo>(`/v1/keys/quota?userId=${encodeURIComponent(userId)}`, "GET");
  },
  /** 记账（orchestrator 同步调用，避免 ai-router 内异步丢失） */
  recordUsage(userId: string, providerId: string, costUsd: number, runId: string) {
    return call<{ ok: true }>("/v1/keys/usage", "POST", {
      userId,
      providerId,
      costUsd,
      runId,
      ts: Date.now(),
    });
  },
  async health(): Promise<unknown> {
    const resp = await fetch(`${config.byok.url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`ai-keys health ${resp.status}`);
    return resp.json();
  },
};
