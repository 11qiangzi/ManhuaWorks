// 智谱 GLM（glm-4 / glm-4v）实现
// 智谱使用 Bearer 鉴权，协议基本 OpenAI 兼容。

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
    id: "glm-4",
    provider: "zhipu",
    capabilities: ["chat", "embeddings"],
    contextWindow: 128_000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0001,
    typicalLatencyMs: 550,
    qualityScore: 86,
  },
  {
    id: "glm-4v",
    provider: "zhipu",
    capabilities: ["chat"], // 视觉理解
    contextWindow: 32_000,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0002,
    typicalLatencyMs: 900,
    qualityScore: 87,
  },
  {
    id: "cogview-3",
    provider: "zhipu",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.025, // 按张
    typicalLatencyMs: 15000,
    qualityScore: 84,
  },
];

export class ZhipuProvider extends BaseProvider {
  readonly id: ProviderId = "zhipu";
  protected baseUrl: string = config.zhipuBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "glm-4";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/chat/completions`,
      {
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
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      },
      { provider: this.id, model: modelId },
    );
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
    const modelId = req.model ?? "glm-4";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({ model: modelId, input: req.input }),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
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
    const modelId = req.model ?? "cogview-3";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/images/generations`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          prompt: req.prompt,
          size: req.size ?? "1024x1024",
          n: req.n ?? 1,
        }),
        signal: AbortSignal.timeout(120_000),
      },
      { provider: this.id, model: modelId },
    );
    const data = (await res.json()) as { data: { url?: string; b64_json?: string }[] };
    const urls = data.data.map((d) => d.url ?? `data:image/png;base64,${d.b64_json}`);
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
    throw new ProviderError(this.id, "*", 400, "zhipu does not support video");
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    throw new ProviderError(this.id, "*", 400, "zhipu does not support audio");
  }
}