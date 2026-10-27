// DeepSeek（v3 / v4-pro）实现
// OpenAI 兼容协议。

import { BaseProvider, type FetchLike } from "./base.js";
import { config } from "../config.js";
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  ModelInfo,
  ProviderId,
  VideoRequest,
  VideoResponse,
  AudioRequest,
  AudioResponse,
} from "../types.js";
import { ProviderError } from "../types.js";

const MODELS: ModelInfo[] = [
  {
    id: "v3",
    provider: "deepseek",
    capabilities: ["chat"],
    contextWindow: 64_000,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    typicalLatencyMs: 700,
    qualityScore: 90,
  },
  {
    id: "v4-pro",
    provider: "deepseek",
    capabilities: ["chat"],
    contextWindow: 128_000,
    costPer1kInput: 0.0006,
    costPer1kOutput: 0.0012,
    typicalLatencyMs: 1200,
    qualityScore: 95,
  },
  {
    id: "v4-flash",
    provider: "deepseek",
    capabilities: ["chat"],
    contextWindow: 128_000,
    costPer1kInput: 0.00007,
    costPer1kOutput: 0.00014,
    typicalLatencyMs: 600,
    qualityScore: 88,
  },
];

export class DeepSeekProvider extends BaseProvider {
  readonly id: ProviderId = "deepseek";
  protected baseUrl: string = config.deepseekBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** 内部短名 → DeepSeek API 实际模型 ID */
  private toApiModel(modelId: string): string {
    if (modelId === "v4-flash" || modelId === "v3") return "deepseek-chat";
    if (modelId === "v4-pro") return "deepseek-v4-pro";
    if (modelId.startsWith("deepseek-")) return modelId;
    return `deepseek-${modelId}`;
  }

  /** 重写健康检查：DeepSeek /models 有时慢，放宽超时 */
  override async healthCheck(apiKey: string): Promise<import("../types.js").ProviderHealth> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.authHeaders(apiKey),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok || res.status === 404) {
        return { provider: this.id, healthy: true, consecutiveFailures: 0, lastCheckedAt: Date.now() };
      }
      throw new Error(`health check returned ${res.status}`);
    } catch (err) {
      return {
        provider: this.id, healthy: false, consecutiveFailures: 1,
        lastCheckedAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "v4-flash";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const apiModelId = this.toApiModel(modelId);
    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          model: apiModelId,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1024,
          top_p: req.topP,
          stream: false,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      },
      { provider: this.id, model: modelId },
    );
    const data = (await res.json()) as {
      id?: string;
      model: string;
      choices: { message: { content: string; reasoning_content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const msg = data.choices?.[0]?.message;
    // DeepSeek 推理模型会把 token 花在 reasoning_content（思维链）上。
    // content 才是最终答案；当 content 为空时，仅在 reasoning_content 内能提取到
    // 合法 JSON（数组/对象）才 fallback，避免把"思考文字"当答案返回导致上层解析失败。
    let content = msg?.content ?? "";
    if (!content && msg?.reasoning_content) {
      const rc = msg.reasoning_content;
      const arrMatch = rc.match(/\[[\s\S]*\]/);
      const objMatch = rc.match(/\{[\s\S]*\}/);
      if (arrMatch || objMatch) {
        content = arrMatch ? arrMatch[0] : objMatch![0];
      }
      // 否则 content 保持空，由上层返回更明确的错误（而非把思考文字当答案）
    }
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

    return {
      id: data.id ?? `chatcmpl-${Date.now()}`,
      model: modelId,
      provider: this.id,
      content,
      usage: { promptTokens, completionTokens, totalTokens },
      cost: this.computeCost(model, promptTokens, completionTokens),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async embed(_req: EmbeddingRequest, _apiKey: string): Promise<EmbeddingResponse> {
    throw new ProviderError(this.id, "*", 400, "deepseek does not support embeddings");
  }

  override async image(_req: ImageRequest, _apiKey: string): Promise<ImageResponse> {
    throw new ProviderError(this.id, "*", 400, "deepseek does not support image");
  }

  override async video(_req: VideoRequest, _apiKey: string): Promise<VideoResponse> {
    throw new ProviderError(this.id, "*", 400, "deepseek does not support video");
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    throw new ProviderError(this.id, "*", 400, "deepseek does not support audio");
  }
}