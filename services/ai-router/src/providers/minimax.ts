// MiniMax（M3 / M2.7 / image-01 / music-01）实现
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
    costPer1kOutput: 0.02, // 按张计费
    typicalLatencyMs: 8000,
    qualityScore: 85,
  },
  {
    id: "music-01",
    provider: "minimax",
    capabilities: ["audio"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.1, // 按首计费
    typicalLatencyMs: 60_000,
    qualityScore: 80,
  },
  {
    id: "video-01",
    provider: "minimax",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0.5, // 按次计费
    typicalLatencyMs: 120_000,
    qualityScore: 78,
    description: "MiniMax 视频生成，效果次于 Seedance 2.0",
  },
];

export class MiniMaxProvider extends BaseProvider {
  readonly id: ProviderId = "minimax";
  protected baseUrl: string = config.minimaxBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** 重写健康检查：MiniMax /models 端点常返回 404/500，放宽判定 */
  override async healthCheck(apiKey: string): Promise<import("../types.js").ProviderHealth> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.authHeaders(apiKey),
        signal: AbortSignal.timeout(10_000),
      });
      // 任何 HTTP 响应(含 404/500)都视为连通
      void res;
      return { provider: this.id, healthy: true, consecutiveFailures: 0, lastCheckedAt: Date.now() };
    } catch (err) {
      // 仅网络错误 / 超时判定为不健康
      return {
        provider: this.id, healthy: false, consecutiveFailures: 1,
        lastCheckedAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  override async chat(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
    const modelId = req.model ?? "M2.7";
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
    const modelId = req.model ?? "M2.7";
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
    const modelId = req.model ?? "image-01";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    // Convert pixel size (e.g. "1024x1024") to aspect_ratio format
    let aspectRatio = "1:1";
    if (req.size) {
      const [w, h] = req.size.split("x").map(Number);
      if (w && h) {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const g = gcd(w, h);
        aspectRatio = `${w / g}:${h / g}`;
      }
    }

    const start = Date.now();
    const res = await this.safeFetch(
      `${this.baseUrl}/image_generation`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          prompt: req.prompt,
          aspect_ratio: aspectRatio,
          response_format: "base64",
          n: req.n ?? 1,
        }),
        signal: AbortSignal.timeout(120_000),
      },
      { provider: this.id, model: modelId },
    );
    const data = (await res.json()) as {
      data: ({ url?: string; b64_json?: string; image_base64?: string })[];
      image_base64?: string[];
    };

    // MiniMax may return base64 images in different formats
    let urls: string[];
    if (data.image_base64 && Array.isArray(data.image_base64)) {
      urls = data.image_base64.map((b64) => `data:image/jpeg;base64,${b64}`);
    } else if (data.data) {
      urls = data.data.map((d) => {
        if (d.url) return d.url;
        const b64 = d.b64_json ?? d.image_base64;
        return b64 ? `data:image/jpeg;base64,${b64}` : "";
      }).filter(Boolean);
    } else {
      urls = [];
    }

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

  /** MiniMax video-01 视频生成（效果次于火山 Seedance 2.0）
   *  异步任务：先 POST /video_generation 拿 task_id，再轮询
   */
  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "video-01";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    // 1) 提交任务
    const submitRes = await this.safeFetch(
      `${this.baseUrl}/video_generation`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          prompt: req.prompt,
          duration: req.durationSeconds ?? 5,
          resolution: req.resolution ?? "720p",
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
    const submitData = (await submitRes.json()) as { task_id?: string; id?: string };
    const taskId = submitData.task_id ?? submitData.id;
    if (!taskId) {
      throw new ProviderError(this.id, modelId, 500, "video submit returned no task id");
    }

    // 2) 轮询直到完成（5s 间隔）
    const deadline = start + config.longTaskTimeoutMs;
    let url = "";
    while (Date.now() < deadline) {
      await sleep(5_000);
      const pollRes = await this.safeFetch(
        `${this.baseUrl}/video_generation/${taskId}`,
        {
          method: "GET",
          headers: this.authHeaders(apiKey),
          signal: AbortSignal.timeout(15_000),
        },
        { provider: this.id, model: modelId },
      );
      const pollData = (await pollRes.json()) as {
        status: "Processing" | "Success" | "Failed";
        video_url?: string;
        url?: string;
        error?: string;
      };
      if (pollData.status === "Success") {
        url = pollData.video_url ?? pollData.url ?? "";
        if (!url) throw new ProviderError(this.id, modelId, 500, "video succeeded but no url");
        break;
      }
      if (pollData.status === "Failed") {
        throw new ProviderError(this.id, modelId, 500, `video failed: ${pollData.error ?? "unknown"}`);
      }
    }
    if (!url) {
      throw new ProviderError(this.id, modelId, 504, "video task timeout");
    }

    return {
      model: modelId,
      provider: this.id,
      url,
      cost: model.costPer1kOutput,
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }

  /** 派单 16 新增: 音频生成 (MiniMax music-01)
   *  MiniMax music-01 是异步任务: 先 POST /audio/generations 拿 taskId，再轮询
   *  本实现走同步阻塞，内部最长等 longTaskTimeoutMs
   */
  override async audio(req: AudioRequest, apiKey: string): Promise<AudioResponse> {
    const modelId = req.model ?? "music-01";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const start = Date.now();
    // 1) 提交任务
    const submitRes = await this.safeFetch(
      `${this.baseUrl}/audio/generations`,
      {
        method: "POST",
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          prompt: req.prompt,
          lyrics: req.lyrics,
          duration: req.durationSeconds ?? 30,
          instrumental: req.withLyrics === false,
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
    const submitData = (await submitRes.json()) as { task_id?: string; id?: string };
    const taskId = submitData.task_id ?? submitData.id;
    if (!taskId) {
      throw new ProviderError(this.id, modelId, 500, "audio submit returned no task id");
    }

    // 2) 轮询直到完成 (5s 间隔)
    const deadline = start + config.longTaskTimeoutMs;
    let url = "";
    while (Date.now() < deadline) {
      await sleep(5_000);
      const pollRes = await this.safeFetch(
        `${this.baseUrl}/audio/generations/${taskId}`,
        {
          method: "GET",
          headers: this.authHeaders(apiKey),
          signal: AbortSignal.timeout(15_000),
        },
        { provider: this.id, model: modelId },
      );
      const pollData = (await pollRes.json()) as {
        status: "queued" | "running" | "succeeded" | "failed";
        audio_url?: string;
        url?: string;
        error?: string;
      };
      if (pollData.status === "succeeded") {
        url = pollData.audio_url ?? pollData.url ?? "";
        if (!url) throw new ProviderError(this.id, modelId, 500, "audio succeeded but no url");
        break;
      }
      if (pollData.status === "failed") {
        throw new ProviderError(this.id, modelId, 500, `audio failed: ${pollData.error ?? "unknown"}`);
      }
    }
    if (!url) {
      throw new ProviderError(this.id, modelId, 504, "audio task timeout");
    }

    return {
      model: modelId,
      provider: this.id,
      url,
      durationSeconds: req.durationSeconds ?? 30,
      cost: Number(model.costPer1kOutput.toFixed(6)),
      latencyMs: Date.now() - start,
      usedByok: false,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}