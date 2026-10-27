// fal.ai 实现
// 派单 16 新增: Wan2.1 视频 + 其他 fal.run 模型
// baseUrl: https://fal.run
// 协议: fal.run/<model-id> 走 model-specific HTTP API
// 鉴权: Authorization: Key <api-key>

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
    id: "fal-ai/wan-t2v",
    provider: "fal",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5, // 按段
    typicalLatencyMs: 180_000,
    qualityScore: 85,
    displayName: "Wan2.1 T2V (阿里)",
    description: "fal.ai 上的阿里 Wan2.1 文生视频",
  },
  {
    id: "fal-ai/wan-i2v",
    provider: "fal",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.6,
    typicalLatencyMs: 180_000,
    qualityScore: 84,
    displayName: "Wan2.1 I2V (阿里)",
    description: "fal.ai 上的阿里 Wan2.1 图生视频",
  },
  {
    id: "fal-ai/flux-pro/v1.1",
    provider: "fal",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.05, // 按张
    typicalLatencyMs: 8000,
    qualityScore: 92,
    displayName: "Flux Pro v1.1",
    description: "fal.ai 上的 Flux Pro",
  },
  {
    id: "fal-ai/minimax-video-01",
    provider: "fal",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5,
    typicalLatencyMs: 180_000,
    qualityScore: 82,
    displayName: "MiniMax Video-01",
    description: "fal.ai 上的 MiniMax 视频",
  },
];

export class FalProvider extends BaseProvider {
  readonly id: ProviderId = "fal";
  protected baseUrl: string = config.falBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** fal.ai 鉴权是 `Key` 不是 `Bearer` */
  protected override authHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // fal.ai 不主推 chat/embed，本路由不暴露
  override async chat(_req: ChatRequest, _apiKey: string): Promise<ChatResponse> {
    throw new ProviderError(this.id, "*", 400, "fal does not support chat in this router");
  }
  override async embed(_req: EmbeddingRequest, _apiKey: string): Promise<EmbeddingResponse> {
    throw new ProviderError(this.id, "*", 400, "fal does not support embeddings");
  }

  /** fal.run 同步调用: POST https://fal.run/<model-id> 直接返回结果 */
  private async runSync(
    modelId: string,
    apiKey: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);
    const res = await this.safeFetch(
      `${this.baseUrl}/${modelId}`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(config.longTaskTimeoutMs),
      },
      { provider: this.id, model: modelId },
    );
    return await res.json();
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "fal-ai/flux-pro/v1.1";
    const start = Date.now();
    const data = (await this.runSync(modelId, apiKey, {
      prompt: req.prompt,
      image_size: req.size ?? "landscape_4_3",
      num_images: req.n ?? 1,
    })) as { images?: { url: string }[]; image?: { url: string } };
    const urls = data.images?.map((x) => x.url) ?? (data.image ? [data.image.url] : []);
    return {
      model: modelId,
      provider: this.id,
      urls,
      cost: Number(((urls.length || 1) * 0.05).toFixed(6)),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "fal-ai/wan-t2v";
    const start = Date.now();
    const data = (await this.runSync(modelId, apiKey, {
      prompt: req.prompt,
      num_frames: Math.max(81, (req.durationSeconds ?? 5) * 16), // ~16fps
    })) as { video?: { url: string }; url?: string };
    const url = data.video?.url ?? data.url ?? "";
    return {
      model: modelId,
      provider: this.id,
      url,
      cost: 0.5,
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    throw new ProviderError(this.id, "*", 400, "fal does not support audio in this router");
  }
}