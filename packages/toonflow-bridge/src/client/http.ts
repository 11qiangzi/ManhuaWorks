/**
 * ai-orchestrator HTTP 客户端
 *
 * 对应 ai-orchestrator 端契约（services/ai-orchestrator/src/index.ts）：
 *   POST /v1/orchestrate/novel-to-drama   → 启动一个 run
 *   GET  /v1/orchestrate/runs/:runId     → 轮询 / 取终态
 *   POST /v1/orchestrate/runs/:runId/cancel
 *   POST /v1/orchestrate/runs/:runId/resume
 *   GET  /v1/orchestrate/health          → 连通性检查
 *
 * 使用 Node 20+ 自带 fetch（无 undici 依赖）。
 */

import type { NovelToDramaInput, RunSnapshot, UserTier } from "../types/manhua.js";

export interface OrchestratorHttpOptions {
  baseUrl: string;
  /** API Key 或 JWT；按 ai-orchestrator 的 auth 中间件约定：Bearer */
  token?: string;
  /** 单次请求超时（ms），默认 30000 */
  timeoutMs?: number;
  /** 调试日志 */
  logger?: (line: string) => void;
}

export class OrchestratorHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = "OrchestratorHttpError";
  }
}

export interface StartNovelToDramaResponse {
  runId: string;
  status: RunSnapshot["status"];
  snapshot: RunSnapshot;
}

export class OrchestratorClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;

  constructor(opts: OrchestratorHttpOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.log = opts.logger ?? (() => {});
  }

  /** GET /health —— 启动前可用此连通性检查 */
  async health(): Promise<{ status: string; service: string; pipelines: string[] }> {
    const res = await this.request<{ status: string; service: string; pipelines: string[] }>(
      "GET",
      "/health",
    );
    return res;
  }

  /** POST /v1/orchestrate/novel-to-drama —— 启动一个 7 步 pipeline */
  async startNovelToDrama(
    input: NovelToDramaInput,
  ): Promise<StartNovelToDramaResponse> {
    return this.request<StartNovelToDramaResponse>(
      "POST",
      "/v1/orchestrate/novel-to-drama",
      input as unknown as Record<string, unknown>,
    );
  }

  /** GET /v1/orchestrate/runs/:runId —— 取一次状态 */
  async getRun(runId: string): Promise<RunSnapshot> {
    return this.request<RunSnapshot>("GET", `/v1/orchestrate/runs/${encodeURIComponent(runId)}`);
  }

  /** POST .../cancel */
  async cancelRun(runId: string): Promise<{ runId: string; cancelled: boolean }> {
    return this.request<{ runId: string; cancelled: boolean }>(
      "POST",
      `/v1/orchestrate/runs/${encodeURIComponent(runId)}/cancel`,
    );
  }

  /** POST .../resume */
  async resumeRun(runId: string): Promise<{ runId: string; resumed: boolean; snapshot: RunSnapshot }> {
    return this.request<{ runId: string; resumed: boolean; snapshot: RunSnapshot }>(
      "POST",
      `/v1/orchestrate/runs/${encodeURIComponent(runId)}/resume`,
    );
  }

  // ---- 工具方法 ----
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.token) headers["authorization"] = `Bearer ${this.token}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      this.log(`[orch-http] ${method} ${url}`);
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new OrchestratorHttpError(
          res.status,
          text,
          `orchestrator ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`,
        );
      }
      // 一些 200 路径返回空 body（resume/cancel）但实际都有 JSON
      return (text ? JSON.parse(text) : ({} as unknown)) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 便捷工厂 */
export function createOrchestratorClient(opts: {
  baseUrl?: string;
  token?: string;
  userTier?: UserTier;
}): OrchestratorClient {
  const baseUrl = opts.baseUrl ?? process.env.ORCHESTRATOR_URL ?? "http://127.0.0.1:8087";
  return new OrchestratorClient({ baseUrl, token: opts.token });
}
