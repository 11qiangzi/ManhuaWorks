// 火山方舟（doubao-pro / doubao-seedream / doubao-seedance）实现
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
    id: "doubao-pro",
    provider: "volcengine",
    capabilities: ["chat"],
    contextWindow: 32_000,
    costPer1kInput: 0.00008,
    costPer1kOutput: 0.00008,
    typicalLatencyMs: 500,
    qualityScore: 82,
  },
  {
    id: "doubao-seedream",
    provider: "volcengine",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.018, // 按张
    typicalLatencyMs: 10000,
    qualityScore: 84,
  },
  {
    id: "doubao-seedance",
    provider: "volcengine",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5, // 按次
    typicalLatencyMs: 60_000,
    qualityScore: 80,
  },
];

export class VolcengineProvider extends BaseProvider {
  readonly id: ProviderId = "volcengine";
  protected baseUrl: string = config.volcengineBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "doubao-pro";
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
    throw new ProviderError(this.id, "*", 400, "volcengine embeddings not exposed in this router");
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "doubao-seedream";
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
      signal: AbortSignal.timeout(180_000),
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

  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "doubao-seedance";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    const res = await this.fetchImpl(`${this.baseUrl}/contents/generations/tasks`, {
      method: "POST",
      headers: this.authHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        content: [{ type: "text", text: req.prompt }],
        parameters: {
          duration: req.durationSeconds ?? 5,
          resolution: req.resolution ?? "720p",
        },
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(this.id, modelId, res.status, `video failed: ${text}`);
    }
    const data = (await res.json()) as { data?: { content_url?: string }; content_url?: string };
    const url = data.data?.content_url ?? data.content_url ?? "";

    return {
      model: modelId,
      provider: this.id,
      url,
      cost: model.costPer1kOutput,
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }
}
