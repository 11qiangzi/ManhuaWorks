// 统一 Provider 接口
// 所有具体 Provider 继承 BaseProvider 并实现 chat/embed/image/video/audio。

import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  AudioRequest,
  AudioResponse,
  ModelInfo,
  ProviderHealth,
  ProviderId,
  TaskType,
  VideoRequest,
  VideoResponse,
} from "../types.js";
import {
  AuthError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "../types.js";

/** fetch 注入点（便于测试） */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** BaseProvider 提供：
 *  1. 公共的 fetch 封装
 *  2. 模型元数据
 *  3. 健康检查（请求 /models 或等价接口）
 *  4. usage → cost 计算
 *  5. 错误码映射 (派单 16 新增)
 */
export abstract class BaseProvider {
  abstract readonly id: ProviderId;
  protected abstract baseUrl: string;
  protected abstract models: ModelInfo[];

  constructor(protected fetchImpl: FetchLike = fetch) {}

  /** 该 provider 支持的模型 */
  getModels(): ModelInfo[] {
    return this.models;
  }

  /** 获取指定 ID 的模型 */
  getModel(modelId: string): ModelInfo | undefined {
    return this.getModels().find((m) => m.id === modelId);
  }

  /** 是否支持某任务类型 */
  supports(task: TaskType, modelId?: string): boolean {
    if (modelId) {
      const m = this.getModel(modelId);
      return !!m && m.capabilities.includes(task);
    }
    return this.getModels().some((m) => m.capabilities.includes(task));
  }

  /**
   * 用 platform key（注入）执行一次轻量调用，验证 Provider 可用。
   * 默认行为：GET 请求 baseUrl/models。子类可重写。
   */
  async healthCheck(apiKey: string): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.authHeaders(apiKey),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`health check failed: ${res.status}`);
      }
      void start;
      return {
        provider: this.id,
        healthy: true,
        consecutiveFailures: 0,
        lastCheckedAt: Date.now(),
      };
    } catch (err) {
      return {
        provider: this.id,
        healthy: false,
        consecutiveFailures: 1,
        lastCheckedAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** 鉴权头 */
  protected authHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /** usage → USD 成本 (chat) */
  protected computeCost(model: ModelInfo, promptTokens: number, completionTokens: number): number {
    const inputCost = (promptTokens / 1000) * model.costPer1kInput;
    const outputCost = (completionTokens / 1000) * model.costPer1kOutput;
    return Number((inputCost + outputCost).toFixed(6));
  }

  /* ==================================================================
   * 派单 16: 统一错误码映射工具
   * ----------------------------------------------------------------
   * 把上游 provider 抛的任意错误 / fetch 异常统一映射成我们的错误类:
   *   401 AuthError           - key 无效 / 鉴权失败
   *   429 RateLimitError      - 限流
   *   504 TimeoutError        - 超时
   *   <status> UpstreamError  - provider 其他错误
   * ================================================================== */

  /**
   * 把一个原始 fetch 调用包成统一错误抛出
   * - 401 / 403 → AuthError (401)
   * - 429       → RateLimitError (429)
   * - 5xx       → UpstreamError (status)
   * - timeout   → TimeoutError (504)
   * - 其他 4xx  → UpstreamError (status)
   */
  protected async safeFetch(
    url: string,
    init: RequestInit,
    ctx: { provider: ProviderId; model: string },
  ): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, init);
    } catch (err) {
      // fetch 异常 = 网络错误或超时（AbortSignal.timeout 会抛 DOMException）
      const msg = err instanceof Error ? err.message : String(err);
      if (/abort|timeout/i.test(msg)) {
        throw new TimeoutError(ctx.provider, ctx.model, `request timeout: ${msg}`);
      }
      throw new UpstreamError(ctx.provider, ctx.model, 502, `network error: ${msg}`);
    }
    if (res.ok) return res;

    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(ctx.provider, ctx.model, `auth failed (${res.status}): ${text}`);
    }
    if (res.status === 429) {
      throw new RateLimitError(ctx.provider, ctx.model, `rate limited: ${text}`);
    }
    if (res.status >= 500) {
      throw new UpstreamError(ctx.provider, ctx.model, res.status, `upstream ${res.status}: ${text}`);
    }
    // 其他 4xx
    throw new UpstreamError(ctx.provider, ctx.model, res.status, `upstream ${res.status}: ${text}`);
  }

  // ---- 抽象方法 ----
  abstract chat(req: ChatRequest, apiKey: string): Promise<ChatResponse>;
  abstract embed(req: EmbeddingRequest, apiKey: string): Promise<EmbeddingResponse>;
  abstract image(req: ImageRequest, apiKey: string): Promise<ImageResponse>;
  abstract video(req: VideoRequest, apiKey: string): Promise<VideoResponse>;
  /** 派单 16 新增: 音频生成 */
  abstract audio(req: AudioRequest, apiKey: string): Promise<AudioResponse>;
}