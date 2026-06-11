// MiniMax（M3 / M2.7 / image-01）实现
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
    id: "M3",
    provider: "minimax",
    capabilities: ["chat", "embeddings"],
    contextWindow: 128_000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0002,
    typicalLatencyMs: 600,
    qualityScore: 88,
  },
  {
    id: "M2.7",
    provider: "minimax",
    capabilities: ["chat", "embeddings"],
    contextWindow: 64_000,
    costPer1kInput: 0.00005,
    costPer1kOutput: 0.0001,
    typicalLatencyMs: 450,
    qualityScore: 80,
  },
  {
    id: "image-01",
    provider: "minimax",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.02, // 按张计费，统一放在 output 字段
    typicalLatencyMs: 8000,
    qualityScore: 85,
  },
];

export class MiniMaxProvider extends BaseProvider {
  readonly id: ProviderId = "minimax";
  protected baseUrl: string = config.minimaxBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "M3";
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

  override async embed(req: EmbeddingRequest, apiKey: string): Promise<EmbeddingResponse> {
    const modelId = req.model ?? "M2.7";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({ model: modelId, input: req.input }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(this.id, modelId, res.status, `embed failed: ${text}`);
    }
    const data = (await res.json()) as {
      model: string;
      data: { embedding: number[] }[];
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    const embeddings = data.data.map((d) => d.embedding);
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? promptTokens;

    return {
      model: modelId,
      provider: this.id,
      embeddings,
      usage: { promptTokens, totalTokens },
      cost: this.computeCost(model, promptTokens, 0),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "image-01";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.fetchImpl(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        prompt: req.prompt,
        size: req.size ?? "1024x1024",
        n: req.n ?? 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(this.id, modelId, res.status, `image failed: ${text}`);
    }
    const data = (await res.json()) as { data: { url: string }[] };
    const urls = data.data.map((d) => d.url);
    const n = urls.length;

    return {
      model: modelId,
      provider: this.id,
      urls,
      cost: Number((n * model.costPer1kOutput).toFixed(6)),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async video(_req: VideoRequest, _apiKey: string): Promise<VideoResponse> {
    throw new ProviderError(this.id, "*", 400, "minimax does not support video");
  }
}
