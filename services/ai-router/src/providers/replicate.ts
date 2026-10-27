// Replicate 实现
// 派单 16 新增: 图像/视频/音频 HTTP
// baseUrl: https://api.replicate.com/v1
// 协议: HTTP POST /predictions → 异步 → GET /predictions/{id} 轮询
// 鉴权: Authorization: Token <api-key>

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
    id: "stability-ai/sdxl",
    provider: "replicate",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.0125, // 约 $0.0125 / 张
    typicalLatencyMs: 10000,
    qualityScore: 82,
    displayName: "SDXL (Stability AI)",
    description: "Replicate 跑 SDXL，OpenAI 协议之外的补充",
  },
  {
    id: "black-forest-labs/flux-schnell",
    provider: "replicate",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.003, // Flux Schnell 最便宜
    typicalLatencyMs: 5000,
    qualityScore: 88,
    displayName: "Flux Schnell",
    description: "Flux 快速模型，质量高 + 便宜",
  },
  {
    id: "minimax/video-01",
    provider: "replicate",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5, // 按次
    typicalLatencyMs: 120_000,
    qualityScore: 82,
    displayName: "MiniMax Video-01",
    description: "Replicate 上的 MiniMax 视频模型",
  },
  {
    id: "tencent/hunyuan-video",
    provider: "replicate",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 1.5,
    typicalLatencyMs: 180_000,
    qualityScore: 86,
    displayName: "Hunyuan Video (腾讯混元)",
    description: "腾讯混元视频模型",
  },
  {
    id: "meta/musicgen",
    provider: "replicate",
    capabilities: ["audio"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.05,
    typicalLatencyMs: 30_000,
    qualityScore: 78,
    displayName: "Meta MusicGen",
    description: "Meta 音乐生成模型",
  },
];

export class ReplicateProvider extends BaseProvider {
  readonly id: ProviderId = "replicate";
  protected baseUrl: string = config.replicateBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** Replicate 鉴权头是 `Token` 不是 `Bearer` */
  protected override authHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // 文本/embed Replicate 不主推，本路由不暴露
  override async chat(_req: ChatRequest, _apiKey: string): Promise<ChatResponse> {
    throw new ProviderError(this.id, "*", 400, "replicate does not support chat in this router");
  }
  override async embed(_req: EmbeddingRequest, _apiKey: string): Promise<EmbeddingResponse> {
    throw new ProviderError(this.id, "*", 400, "replicate does not support embeddings");
  }

  /** 提交 + 轮询的通用同步逻辑 (Replicate 走异步) */
  private async runPrediction(
    modelId: string,
    apiKey: string,
    input: Record<string, unknown>,
  ): Promise<{ output: unknown; urls?: string[]; costUsd: number }> {
    // 注意：一致性模型（flux-kontext-pro 等）不在 MODELS[] 注册表里，
    // 只在 CONSISTENCY_MODELS 中定义。这里不做严格校验，让 API 端返回真实错误。
    const start = Date.now();

    // 1) POST /models/{id}/predictions
    // 所有模型 id 均为 owner/name 格式，使用 /models/{id}/predictions 端点。
    // （Replicate 的 /predictions 端点要求 version 哈希且不允许 model 字段，会返回 422）
    const url = `${this.baseUrl}/models/${modelId}/predictions`;
    const submitRes = await this.safeFetch(
      url,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
    const submitData = (await submitRes.json()) as {
      id: string;
      urls?: { get?: string };
    };
    const predictionId = submitData.id;

    // 2) GET /predictions/{id} 轮询
    const deadline = start + config.longTaskTimeoutMs;
    let lastStatus = "starting";
    while (Date.now() < deadline) {
      await sleep(3_000);
      const pollRes = await this.safeFetch(
        `${this.baseUrl}/predictions/${predictionId}`,
        {
          method: "GET",
          headers: this.authHeaders(apiKey),
          signal: AbortSignal.timeout(15_000),
        },
        { provider: this.id, model: modelId },
      );
      const pollData = (await pollRes.json()) as {
        status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
        output?: unknown;
        error?: string;
      };
      lastStatus = pollData.status;
      if (pollData.status === "succeeded") {
        const output = pollData.output;
        const urls = Array.isArray(output) ? (output as string[]) : output ? [String(output)] : [];
        return { output, urls, costUsd: this.getModel(modelId)?.costPer1kOutput ?? 0.01 };
      }
      if (pollData.status === "failed" || pollData.status === "canceled") {
        throw new ProviderError(
          this.id,
          modelId,
          500,
          `replicate ${pollData.status}: ${pollData.error ?? "unknown"}`,
        );
      }
    }
    throw new ProviderError(this.id, modelId, 504, `replicate prediction timeout (last=${lastStatus})`);
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "stability-ai/sdxl";
    const start = Date.now();
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      width: parseInt((req.size ?? "1024x1024").split("x")[0] ?? "1024", 10),
      height: parseInt((req.size ?? "1024x1024").split("x")[1] ?? "1024", 10),
    };
    const result = await this.runPrediction(modelId, apiKey, input);
    return {
      model: modelId,
      provider: this.id,
      urls: result.urls ?? [],
      cost: Number(((result.urls?.length ?? 0) * 0.0125).toFixed(6)),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "minimax/video-01";
    const start = Date.now();
    const result = await this.runPrediction(modelId, apiKey, {
      prompt: req.prompt,
      duration: req.durationSeconds ?? 5,
    });
    const url = result.urls?.[0] ?? "";
    return {
      model: modelId,
      provider: this.id,
      url,
      cost: 0.5,
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async audio(req: AudioRequest, apiKey: string): Promise<AudioResponse> {
    const modelId = req.model ?? "meta/musicgen";
    const start = Date.now();
    const result = await this.runPrediction(modelId, apiKey, {
      prompt: req.prompt,
      duration: req.durationSeconds ?? 8,
    });
    const url = result.urls?.[0] ?? "";
    return {
      model: modelId,
      provider: this.id,
      url,
      durationSeconds: req.durationSeconds ?? 8,
      cost: 0.05,
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  // ─── 一致性关键帧生成 ───

  /** 一致性模型配置 */
  private static CONSISTENCY_MODELS = {
    "flux-kontext-pro": {
      id: "black-forest-labs/flux-kontext-pro",
      costPerImage: 0.08,
    },
    "ideogram-character": {
      id: "ideogram-ai/ideogram-character",
      costPerImage: 0.05,
    },
    "infinite-you": {
      id: "zsxkib/infinite-you",
      costPerImage: 0.038,
    },
    "instant-id": {
      id: "grandlineai/instant-id-artistic",
      costPerImage: 0.035,
    },
    "face-swap": {
      id: "codeplugtech/face-swap",
      costPerImage: 0.006,
    },
  } as const;

  /**
   * 生成人脸一致性关键帧图片
   *
   * 流程：
   * 1. 使用一致性模型生成基础关键帧（人脸锁定）
   * 2. 可选：叠加 Face-Swap 做精细人脸替换
   */
  async generateConsistentImage(
    params: {
      prompt: string;
      referenceImages: string[];
      model?: keyof typeof ReplicateProvider.CONSISTENCY_MODELS;
      width?: number;
      height?: number;
      faceSwap?: boolean;
      faceSwapSource?: string;
      negativePrompt?: string;
      seed?: number;
    },
    apiKey: string,
  ): Promise<{
    imageUrl: string;
    model: string;
    cost: number;
    latencyMs: number;
    faceSwapped: boolean;
  }> {
    const start = Date.now();
    const modelKey = params.model ?? "flux-kontext-pro";
    const modelConfig = ReplicateProvider.CONSISTENCY_MODELS[modelKey];
    const width = params.width ?? 1280;
    const height = params.height ?? 720;

    const refImage = params.referenceImages[0];
    if (!refImage) {
      throw new ProviderError(this.id, "*", 400, "At least 1 reference image required for consistency keyframe");
    }

    // 构造模型特定输入
    let input: Record<string, unknown>;
    let modelId: string;

    switch (modelKey) {
      case "flux-kontext-pro":
        modelId = modelConfig.id;
        input = {
          prompt: params.prompt,
          input_image: refImage,
          aspect_ratio: `${width}:${height}`,
          output_format: "png",
          safety_tolerance: 2,
          ...(params.seed != null && { seed: params.seed }),
        };
        break;

      case "ideogram-character":
        modelId = modelConfig.id;
        input = {
          prompt: params.prompt,
          character_reference_image: refImage,
          aspect_ratio: "16:9",
          style_type: "realistic",
          ...(params.seed != null && { seed: params.seed }),
        };
        break;

      case "infinite-you":
        modelId = modelConfig.id;
        input = {
          prompt: params.prompt,
          id_image: params.referenceImages[0],
          width,
          height,
          num_steps: 30,
          guidance_scale: 7.5,
          ...(params.seed != null && { seed: params.seed }),
        };
        break;

      case "instant-id":
        modelId = modelConfig.id;
        input = {
          prompt: params.prompt,
          image: refImage,
          width,
          height,
          num_inference_steps: 30,
          ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
          ...(params.seed != null && { seed: params.seed }),
        };
        break;

      default:
        throw new ProviderError(this.id, "*", 400, `Unknown consistency model: ${modelKey}`);
    }

    const result = await this.runPrediction(modelId, apiKey, input);
    let imageUrl = result.urls?.[0] ?? "";

    if (!imageUrl) {
      throw new ProviderError(this.id, modelId, 502, "Consistency model returned no image");
    }

    let totalCost = modelConfig.costPerImage;
    let faceSwapped = false;

    // 可选：Face-Swap 后处理
    if (params.faceSwap && params.faceSwapSource) {
      try {
        const swapConfig = ReplicateProvider.CONSISTENCY_MODELS["face-swap"];
        const swapResult = await this.runPrediction(swapConfig.id, apiKey, {
          swap_image: params.faceSwapSource,
          input_image: imageUrl,
        });
        if (swapResult.urls?.[0]) {
          imageUrl = swapResult.urls[0];
          faceSwapped = true;
          totalCost += swapConfig.costPerImage;
        }
      } catch (err) {
        // Face-Swap 失败不阻断，降级为不使用 Face-Swap 的结果
        console.warn("[replicate] Face-Swap post-processing failed, using base keyframe:", err);
      }
    }

    return {
      imageUrl,
      model: modelId,
      cost: totalCost,
      latencyMs: Date.now() - start,
      faceSwapped,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}