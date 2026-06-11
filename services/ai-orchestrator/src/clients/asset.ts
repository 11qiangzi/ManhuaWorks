/**
 * asset-service HTTP 客户端
 * 用于落库分镜、角色、剧集、最终视频，拿到 assetId 便于后续查询/授权。
 */

import { config } from "../config.js";

export type AssetKind =
  | "storyboard"
  | "character"
  | "scene"
  | "image"
  | "audio"
  | "video"
  | "subtitle"
  | "episode"
  | "drama";

export interface CreateAssetRequest {
  kind: AssetKind;
  /** 关联的项目 ID */
  projectId: string;
  /** 关联的用户 ID（运行时可省，从 auth 注入） */
  userId?: string;
  /** 资产本身的内容/URL/元数据 */
  payload: Record<string, unknown>;
  /** 标签/角色/剧集等 */
  tags?: string[];
  /** 公开性 */
  visibility?: "private" | "team" | "public";
}

export interface AssetSummary {
  id: string;
  kind: AssetKind;
  projectId: string;
  userId: string;
  url?: string;
  createdAt: number;
  updatedAt: number;
}

export class AssetClientError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[asset ${status} ${endpoint}] ${message}`);
    this.name = "AssetClientError";
  }
}

async function call<T>(endpoint: string, method: "GET" | "POST", body?: unknown, timeoutMs?: number): Promise<T> {
  const url = `${config.asset.url}${endpoint}`;
  const ms = timeoutMs ?? config.asset.timeoutMs;
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
      throw new AssetClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof AssetClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new AssetClientError(504, endpoint, `timeout after ${ms}ms`);
    }
    throw new AssetClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export const assetClient = {
  create(req: CreateAssetRequest) {
    return call<{ ok: true; asset: AssetSummary }>("/v1/assets", "POST", req);
  },
  get(id: string) {
    return call<AssetSummary>(`/v1/assets/${encodeURIComponent(id)}`, "GET");
  },
  listByProject(projectId: string, kind?: AssetKind) {
    const q = new URLSearchParams({ projectId });
    if (kind) q.set("kind", kind);
    return call<{ count: number; assets: AssetSummary[] }>(`/v1/assets?${q.toString()}`, "GET");
  },
  async health(): Promise<unknown> {
    const resp = await fetch(`${config.asset.url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`asset health ${resp.status}`);
    return resp.json();
  },
};
