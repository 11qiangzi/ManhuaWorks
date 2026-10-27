// OpenAI (GPT / DALL-E) 实现
// 派单 16 新增: OpenAI
// baseUrl: https://api.openai.com/v1
// 协议: 完全 OpenAI 兼容（废话，就是他家）

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
    id: "gpt-4o",
    provider: "openai",
    capabilities: ["chat"],
    contextWindow: 128_000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    typicalLatencyMs: 1200,
    qualityScore: 93,
    displayName: "GPT-4o",
    description: "OpenAI 旗舰多模态模型",
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    capabilities: ["chat"],
    contextWindow: 128_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    typicalLatencyMs: 700,
    qualityScore: 82,
    displayName: "GPT-4o mini",
    description: "OpenAI 轻量快速模型",
  },
  {
    id: "o1-preview",
    provider: "openai",
    capabilities: ["chat"],
    contextWindow: 128_000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.06,
    typicalLatencyMs: 5000,
    qualityScore: 97,
    displayName: "o1-preview",
    description: "OpenAI 推理模型 (慢但强)",
  },
  {
    id: "text-embedding-3-small",
    provider: "openai",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    costPer1kInput: 0.00002,
    costPer1kOutput: 0,
    typicalLatencyMs: 200,
    qualityScore: 88,
    displayName: "text-embedding-3-small",
  },
  {
    id: "text-embedding-3-large",
    provider: "openai",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    costPer1kInput: 0.00013,
    costPer1kOutput: 0,
    typicalLatencyMs: 300,
    qualityScore: 92,
    displayName: "text-embedding-3-large",
  },
  {
    id: "dall-e-3",
    provider: "openai",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.04, // 按张 (1024x1024)
    typicalLatencyMs: 15000,
    qualityScore: 92,
    displayName: "DALL·E 3",
    description: "OpenAI 高质量图像生成",
  },
  {
    id: "sora-1.0",
    provider: "openai",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 1.0, // 按段
    typicalLatencyMs: 120_000,
    qualityScore: 88,
    displayName: "Sora",
    description: "OpenAI 文生视频模型",
  },
];

export class OpenAIProvider extends BaseProvider {
  readonly id: ProviderId = "openai";
  protected baseUrl: string = config.openaiBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "gpt-4o-mini";
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
    const modelId = req.model ?? "text-embedding-3-small";
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
    const modelId = req.model ?? "dall-e-3";
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
    // OpenAI Sora 尚未公开 API；本路由预留
    throw new ProviderError(
      this.id,
      "*",
      400,
      "openai video (sora) not exposed in this router (api not yet public)",
    );
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    // OpenAI 有 TTS (text-to-speech) 但本 router 关注 music 生成，TTS 不在本任务范围
    throw new ProviderError(
      this.id,
      "*",
      400,
      "openai audio (music) not exposed in this router (only TTS supported)",
    );
  }
}