// 统一 Provider 接口
// 所有具体 Provider 继承 BaseProvider 并实现 chat/embed/image/video。

import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  ModelInfo,
  ProviderHealth,
  ProviderId,
  TaskType,
  VideoRequest,
  VideoResponse,
} from "../types.js";
import { ProviderError } from "../types.js";

/** fetch 注入点（便于测试） */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** BaseProvider 提供：
 *  1. 公共的 fetch 封装
 *  2. 模型元数据
 *  3. 健康检查（请求 /models 或等价接口）
 *  4. usage → cost 计算
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
    return this.models.find((m) => m.id === modelId);
  }

  /** 是否支持某任务类型 */
  supports(task: TaskType, modelId?: string): boolean {
    if (modelId) {
      const m = this.getModel(modelId);
      return !!m && m.capabilities.includes(task);
    }
    return this.models.some((m) => m.capabilities.includes(task));
  }

  /**
   * 用 platform key（注入）执行一次轻量调用，验证 Provider 可用。
   * 默认行为：head 请求 baseUrl。子类可重写。
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
        throw new ProviderError(this.id, "*", res.status, `health check failed: ${res.status}`);
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

  /** usage → USD 成本 */
  protected computeCost(model: ModelInfo, promptTokens: number, completionTokens: number): number {
    const inputCost = (promptTokens / 1000) * model.costPer1kInput;
    const outputCost = (completionTokens / 1000) * model.costPer1kOutput;
    return Number((inputCost + outputCost).toFixed(6));
  }

  // ---- 抽象方法 ----
  abstract chat(req: ChatRequest, apiKey: string): Promise<ChatResponse>;
  abstract embed(req: EmbeddingRequest, apiKey: string): Promise<EmbeddingResponse>;
  abstract image(req: ImageRequest, apiKey: string): Promise<ImageResponse>;
  abstract video(req: VideoRequest, apiKey: string): Promise<VideoResponse>;
}
