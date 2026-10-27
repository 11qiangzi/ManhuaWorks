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
  AudioRequest,
  AudioResponse,
} from "../types.js";
import { ProviderError } from "../types.js";

const MODELS: ModelInfo[] = [
  {
    id: "doubao-seedream-4-5-251128",
    provider: "volcengine",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.018, // 按张
    typicalLatencyMs: 10000,
    qualityScore: 84,
  },
  {
    id: "doubao-seedance-2-0-260128",
    provider: "volcengine",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5, // 按次
    typicalLatencyMs: 60_000,
    qualityScore: 80,
    description: "Seedance 2.0 视频生成，效果优于 MiniMax video-01",
  },
];

export class VolcengineProvider extends BaseProvider {
  readonly id: ProviderId = "volcengine";
  protected baseUrl: string = config.volcengineBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** 重写健康检查：火山方舟 /models 端点不存在(404)，直接标记健康 */
  override async healthCheck(_apiKey: string): Promise<import("../types.js").ProviderHealth> {
    return {
      provider: this.id,
      healthy: true,
      consecutiveFailures: 0,
      lastCheckedAt: Date.now(),
    };
  }

  override async chat(_req: ChatRequest, _apiKey: string): Promise<ChatResponse> {
    throw new ProviderError(this.id, "*", 400, "volcengine chat not configured — use DeepSeek for text generation");
  }

  override async embed(_req: EmbeddingRequest, _apiKey: string): Promise<EmbeddingResponse> {
    throw new ProviderError(this.id, "*", 400, "volcengine embeddings not exposed in this router");
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "doubao-seedream-4-5-251128";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    // Volcengine requires minimum 3,686,400 pixels (e.g. 1920x1920)
    const size = req.size && parseInt(req.size) >= 1920 ? req.size : "2048x2048";

    // Build request body with optional reference images, negative prompt, and seed
    const apiBody: Record<string, unknown> = {
      model: modelId,
      prompt: req.prompt,
      size,
      n: req.n ?? 1,
      response_format: "url",
      watermark: false,
      stream: false,
    };
    if (req.image && req.image.length > 0) {
      apiBody.image = req.image;
    }
    if (req.negativePrompt) {
      apiBody.negative_prompt = req.negativePrompt;
    }
    if (req.seed != null) {
      apiBody.seed = req.seed;
    }

    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/images/generations`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify(apiBody),
        signal: AbortSignal.timeout(180_000),
      },
      { provider: this.id, model: modelId },
    );
    const data = (await res.json()) as { data: { url: string }[] };
    const urls = data.data.map((d) => d.url);
    const n = urls.length;

    // URL 持久化：下载 TOS 临时 URL 到本地存储
    const { getUrlPersistence } = await import("../services/url-persistence.js");
    const persistedUrls = await getUrlPersistence().persistMany(urls, "image");

    return {
      model: modelId,
      provider: this.id,
      urls: persistedUrls,
      cost: Number((n * model.costPer1kOutput).toFixed(6)),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "doubao-seedance-2-0-260128";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    // 1. Build content array — prefer passthrough from frontend, else construct
    const content: Array<Record<string, unknown>> = req.content
      ? [...req.content]
      : [{ type: "text", text: req.prompt }];

    // 2. If no passthrough content, add first/last frame (legacy mode)
    if (!req.content) {
      if (req.firstFrameUrl) {
        content.push({
          type: "image_url",
          role: "first_frame",
          image_url: { url: req.firstFrameUrl },
        });
      }
      if (req.lastFrameUrl) {
        content.push({
          type: "image_url",
          role: "last_frame",
          image_url: { url: req.lastFrameUrl },
        });
      }
    }

    // 3. Inject reference images into content array (works in both modes)
    if (req.referenceImages?.length) {
      for (const url of req.referenceImages) {
        content.push({
          type: "image_url",
          role: "reference_image",
          image_url: { url },
        });
      }
    }

    // 4. Build API body — Seedance 2.0 uses top-level fields
    const apiBody: Record<string, unknown> = {
      model: modelId,
      content,
      duration: req.durationSeconds ?? 5,
      resolution: req.resolution ?? "720p",
      generate_audio: req.generateAudio ?? false,
      return_last_frame: req.returnLastFrame ?? false,
      ...(req.ratio ? { ratio: req.ratio } : {}),
      ...(req.seed != null ? { seed: req.seed } : {}),
    };

    const start = Date.now();
    const headers = this.authHeaders(apiKey);

    // 5. Create async task
    const createRes = await this.safeFetch(
      `${this.baseUrl}/contents/generations/tasks`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(apiBody),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
    const createData = (await createRes.json()) as { id?: string };
    const taskId = createData.id;
    if (!taskId) {
      throw new ProviderError(this.id, modelId, 500, "Seedance task creation failed: no task ID returned");
    }

    // 6. Poll task status (every 10s, max 5 minutes)
    const POLL_INTERVAL = 10_000;
    const POLL_TIMEOUT = 300_000;
    const deadline = Date.now() + POLL_TIMEOUT;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      let task: {
        id?: string;
        status?: string;
        content?: { video_url?: string; last_frame_url?: string };
        error?: { code?: string; message?: string };
      };
      try {
        const queryRes = await this.safeFetch(
          `${this.baseUrl}/contents/generations/tasks/${taskId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(15_000),
          },
          { provider: this.id, model: modelId },
        );
        task = (await queryRes.json()) as typeof task;
      } catch (pollErr) {
        // Retry once on transient network errors
        console.warn('[volcengine] poll transient error, retrying...', pollErr);
        await new Promise(r => setTimeout(r, 2000));
        const queryRes = await this.safeFetch(
          `${this.baseUrl}/contents/generations/tasks/${taskId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(15_000),
          },
          { provider: this.id, model: modelId },
        );
        task = (await queryRes.json()) as typeof task;
      }

      switch (task.status) {
        case "succeeded": {
          const url = task.content?.video_url ?? "";
          const lastFrameUrl = task.content?.last_frame_url ?? undefined;

          // URL 持久化：下载 TOS 临时 URL 到本地存储
          const { getUrlPersistence } = await import("../services/url-persistence.js");
          const persistence = getUrlPersistence();
          const persistedUrl = await persistence.persist(url, "video");
          const persistedLastFrame = lastFrameUrl
            ? await persistence.persist(lastFrameUrl, "keyframe")
            : undefined;

          return {
            model: modelId,
            provider: this.id,
            url: persistedUrl,
            lastFrameUrl: persistedLastFrame,
            cost: model.costPer1kOutput,
            latencyMs: Date.now() - start,
            usedByok: false,
          };
        }
        case "failed": {
          const errMsg = task.error?.message ?? "video generation failed";
          throw new ProviderError(this.id, modelId, 500, `Seedance task failed: ${errMsg}`);
        }
        case "expired":
          throw new ProviderError(this.id, modelId, 504, "Seedance task expired");
        case "cancelled":
          throw new ProviderError(this.id, modelId, 499, "Seedance task cancelled");
        // queued, processing → keep polling
      }
    }

    throw new ProviderError(this.id, modelId, 504, `Seedance task ${taskId} timed out after ${POLL_TIMEOUT / 1000}s`);
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    throw new ProviderError(this.id, "*", 400, "volcengine does not support audio in this router");
  }
}