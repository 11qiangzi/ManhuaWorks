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
];

export class DeepSeekProvider extends BaseProvider {
  readonly id: ProviderId = "deepseek";
  protected baseUrl: string = config.deepseekBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "v3";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 1024,
        top_p: req.topP,
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(this.id, modelId, res.status, `chat failed: ${text}`);
    }
    const data = (await res.json()) as {
      id?: string;
      model: string;
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
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
}
