// 通义千问 (DashScope OpenAI 兼容模式) 实现
// 派单 16 新增: 通义千问
// baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
// 协议: 完全 OpenAI 兼容，可直接复用 chat completions / images

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
    id: "qwen-plus",
    provider: "qwen",
    capabilities: ["chat"],
    contextWindow: 131_072,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.002,
    typicalLatencyMs: 1500,
    qualityScore: 90,
    displayName: "通义千问 Plus",
    description: "通义千问主力模型，效果/成本平衡",
  },
  {
    id: "qwen-max",
    provider: "qwen",
    capabilities: ["chat"],
    contextWindow: 32_768,
    costPer1kInput: 0.02,
    costPer1kOutput: 0.06,
    typicalLatencyMs: 2500,
    qualityScore: 94,
    displayName: "通义千问 Max",
    description: "通义千问最强模型",
  },
  {
    id: "qwen-vl-plus",
    provider: "qwen",
    capabilities: ["chat"], // 视觉理解
    contextWindow: 32_768,
    costPer1kInput: 0.0015,
    costPer1kOutput: 0.0045,
    typicalLatencyMs: 2000,
    qualityScore: 89,
    displayName: "通义千问 VL Plus",
    description: "通义千问视觉理解模型",
  },
  {
    id: "text-embedding-v3",
    provider: "qwen",
    capabilities: ["embeddings"],
    contextWindow: 8192,
    costPer1kInput: 0.0007,
    costPer1kOutput: 0,
    typicalLatencyMs: 300,
    qualityScore: 87,
    displayName: "通义千问文本向量化 v3",
  },
  {
    id: "wanx-v1",
    provider: "qwen",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.025, // 按张
    typicalLatencyMs: 12000,
    qualityScore: 85,
    displayName: "通义万相 v1",
    description: "通义千问图像生成",
  },
];

export class QwenProvider extends BaseProvider {
  readonly id: ProviderId = "qwen";
  protected baseUrl: string = config.qwenBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "qwen-plus";
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
    const modelId = req.model ?? "text-embedding-v3";
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
    const modelId = req.model ?? "wanx-v1";
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
    // 通义有 wan2.1 但走的是 DashScope 异步 API（不是 OpenAI 兼容），本 router 暂不支持
    throw new ProviderError(
      this.id,
      "*",
      400,
      "qwen video not exposed in this router (use DashScope async API directly)",
    );
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    throw new ProviderError(this.id, "*", 400, "qwen does not support audio in this router");
  }
}