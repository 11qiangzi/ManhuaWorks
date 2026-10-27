// Agnes AI 实现（图片 + 视频生成）
// OpenAI 兼容协议，Base URL https://apihub.agnes-ai.com/v1
//
// 图片:  POST /images/generations        -> { data: [{ url }] }
//   - 文生图: 直接传 prompt
//   - 图生图: 必须加 tags:["img2img"] + extra_body.image:[urls]，否则按文生图处理
// 视频:  POST /videos (异步)             -> { task_id | id, status:"queued" }
//        GET  /videos/{task_id} 轮询      -> status: completed 时取 remixed_from_video_id
//   - 注意: 视频 URL 在 remixed_from_video_id 字段（非 video_url / url）

import { BaseProvider, type FetchLike } from "./base.js";
import { config } from "../config.js";
import { readFile } from "fs/promises";
import { join, extname } from "path";
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
    id: "agnes-image-2.1-flash",
    provider: "agnes",
    capabilities: ["image"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0, // 免费额度
    typicalLatencyMs: 9000,
    qualityScore: 90,
    displayName: "Agnes Image 2.1 Flash",
    description: "Agnes AI 文生图 / 图生图，支持 1K-4K 分辨率",
  },
  {
    id: "agnes-video-v2.0",
    provider: "agnes",
    capabilities: ["video"],
    contextWindow: 0,
    costPer1kInput: 0,
    costPer1kOutput: 0, // 免费额度
    typicalLatencyMs: 150_000,
    qualityScore: 88,
    displayName: "Agnes Video V2.0",
    description: "Agnes AI 文生视频 / 图生视频 / 关键帧动画（异步任务）",
  },
];

// ---------------------------------------------------------------------------
// 参考图解析：前端传来的参考图都是本机持久化的相对 URL（/persisted/...），
// 或经 vite 代理的 http://host/persisted/...。Agnes 远端服务器无法访问这些
// 本机地址，必须把文件读出来转成 base64 data URI 再发送。
// 远程绝对 URL（如 agnes 自己的 platform-outputs 域名）原样返回即可。
// ---------------------------------------------------------------------------
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeFromPath(p: string): string {
  return MIME_BY_EXT[extname(p).toLowerCase()] ?? "image/jpeg";
}

/** 把 /persisted/... 或 http(s)://host/persisted/... 解析为本地文件路径 */
function persistedUrlToLocal(u: string): string | null {
  const m = u.match(/\/persisted\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  return join(config.persistenceStorageDir, m[1]);
}

async function urlToSendable(u: string): Promise<string> {
  const local = persistedUrlToLocal(u);
  if (local) {
    try {
      const buf = await readFile(local);
      return `data:${mimeFromPath(local)};base64,${buf.toString("base64")}`;
    } catch {
      // 读不到就退回原值（让上游报错以暴露问题，而不是静默用错误数据）
      return u;
    }
  }
  return u; // 远程 URL / data: URI 原样
}

async function resolveReferenceImages(urls?: string[]): Promise<string[] | undefined> {
  if (!urls || urls.length === 0) return undefined;
  return Promise.all(urls.map(urlToSendable));
}

// ---------------------------------------------------------------------------
// 并发信号量：agnes 的图片接口有很小的并发上限（实测约 2），超出即返回
// 502 "image queue is full"。这里在后端侧做客户端限流，保证同时打到 agnes
// 的图片请求不超过 LIMIT 个，其余在进程内排队等待，从根本上避免触发 502。
// ---------------------------------------------------------------------------
class Semaphore {
  private permits: number;
  private waiters: Array<() => void> = [];
  constructor(permits: number) {
    this.permits = permits;
  }
  acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }
  release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.permits++;
  }
}

// 允许同时向 agnes 发起的图片请求数（留 1 个余量，避免踩到上游硬上限）
const AGNES_IMAGE_CONCURRENCY = 2;
const agnesImageSemaphore = new Semaphore(AGNES_IMAGE_CONCURRENCY);

export class AgnesProvider extends BaseProvider {
  readonly id: ProviderId = "agnes";
  protected baseUrl: string = config.agnesBaseUrl;
  protected override models: ModelInfo[] = MODELS;

  constructor(fetchImpl?: FetchLike) {
    super(fetchImpl);
  }

  /** 重写健康检查：agnostics /models 不一定存在，直接标记健康避免误熔断 */
  override async healthCheck(_apiKey: string): Promise<import("../types.js").ProviderHealth> {
    return {
      provider: this.id,
      healthy: true,
      consecutiveFailures: 0,
      lastCheckedAt: Date.now(),
    };
  }

  override async chat(_req: ChatRequest, _apiKey: string): Promise<ChatResponse> {
    throw new ProviderError(this.id, "*", 400, "agnes chat not exposed in this router");
  }

  override async embed(_req: EmbeddingRequest, _apiKey: string): Promise<EmbeddingResponse> {
    throw new ProviderError(this.id, "*", 400, "agnes embeddings not exposed in this router");
  }

  override async image(req: ImageRequest, apiKey: string): Promise<ImageResponse> {
    const modelId = req.model ?? "agnes-image-2.1-flash";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const refs = await resolveReferenceImages(req.image);

    const apiBody: Record<string, unknown> = {
      model: modelId,
      prompt: req.prompt,
      size: req.size && /^\d+x\d+$/.test(req.size) ? req.size : "1024x1024",
      n: req.n ?? 1,
    };
    if (req.negativePrompt) {
      apiBody.negative_prompt = req.negativePrompt;
    }
    // 注意：agnes-image 模型不接受 seed 参数，传了会 422 Invalid request，故忽略。
    // 角色一致性改由 img2img 参考图（下方 refs）保证。
    // if (req.seed != null) { apiBody.seed = req.seed; }
    // 图生图：必须显式声明 img2img 标签，否则模型当作文生图处理
    if (refs && refs.length > 0) {
      apiBody.tags = ["img2img"];
      apiBody.extra_body = { image: refs };
    }

    const start = Date.now();
    // 并发限流：保证同时打到 agnes 的图片请求不超过上限，避免触发 "image queue is full" 502
    await agnesImageSemaphore.acquire();
    try {
    // 重试：agnes 在并发/负载高时会返回 502 "image queue is full, please retry later"
    // 或 503/429。这类错误是可重试的，退避后重试通常即可成功，避免前端视角图退化成 wide。
    const MAX_RETRIES = 4;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // 退避：2s, 4s, 8s, 8s（队列满时给上游喘息时间）
      if (attempt > 0) {
        const backoff = Math.min(2 ** attempt * 1000, 8000);
        await new Promise((r) => setTimeout(r, backoff));
      }
      try {
        const res = await this.safeFetch(
          `${this.baseUrl}/images/generations`,
          {
            method: "POST",
            headers: this.authHeaders(apiKey),
            body: JSON.stringify(apiBody),
            signal: AbortSignal.timeout(300_000),
          },
          { provider: this.id, model: modelId },
        );

        const data = (await res.json()) as { data?: Array<{ url?: string }> };
        const urls = (data.data ?? [])
          .map((d) => d.url)
          .filter((u): u is string => typeof u === "string" && u.length > 0);

        if (urls.length === 0) {
          throw new ProviderError(this.id, modelId, 500, "Agnes returned no image URLs");
        }

        // URL 持久化：下载临时 URL 到本地存储（persistMany 内部也会对下载失败重试）
        const { getUrlPersistence } = await import("../services/url-persistence.js");
        const persistedUrls = await getUrlPersistence().persistMany(urls, "image");

        return {
          model: modelId,
          provider: this.id,
          urls: persistedUrls,
          cost: Number((urls.length * model.costPer1kOutput).toFixed(6)),
          latencyMs: Date.now() - start,
          usedByok: false,
        };
      } catch (err: any) {
        const status = err?.status;
        const msg = String(err?.message || "");
        const retryable =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          /queue is full|rate limit|please retry|try again later|timeout|abort|server (busy|error)|internal error|upstream/i.test(msg);
        if (!retryable || attempt === MAX_RETRIES) throw err;
        lastErr = err;
        // 继续下一次重试
      }
    }
    throw lastErr ?? new ProviderError(this.id, modelId, 500, "agnes image failed after retries");
    } finally {
      agnesImageSemaphore.release();
    }
  }

  override async video(req: VideoRequest, apiKey: string): Promise<VideoResponse> {
    const modelId = req.model ?? "agnes-video-v2.0";
    const model = this.getModel(modelId);
    if (!model) throw new ProviderError(this.id, modelId, 400, `unknown model ${modelId}`);

    const frameRate = 24;
    const duration = req.durationSeconds ?? 5;
    // num_frames 必须满足 8n+1 且 <= 441 (约 18s 上限)
    let numFrames = Math.round((duration * frameRate) / 8) * 8 + 1;
    numFrames = Math.max(9, Math.min(441, numFrames));

    const apiBody: Record<string, unknown> = {
      model: modelId,
      prompt: req.prompt,
      num_frames: numFrames,
      frame_rate: frameRate,
      width: 1152,
      height: 768,
    };

    // 图生视频：首帧图（相对路径转 base64，agnes 无法访问本机）
    if (req.firstFrameUrl) {
      const firstFrame = (await resolveReferenceImages([req.firstFrameUrl]))?.[0];
      apiBody.image = firstFrame ?? req.firstFrameUrl;
      apiBody.mode = "ti2vid";
    } else if (req.referenceImages && req.referenceImages.length > 0) {
      // 多图 / 关键帧动画
      const refs = await resolveReferenceImages(req.referenceImages);
      apiBody.extra_body = { mode: "keyframes", image: refs ?? req.referenceImages };
    }

    const start = Date.now();
    const headers = this.authHeaders(apiKey);

    // 1. 创建异步任务
    const createRes = await this.safeFetch(
      `${this.baseUrl}/videos`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(apiBody),
        signal: AbortSignal.timeout(30_000),
      },
      { provider: this.id, model: modelId },
    );
    const createData = (await createRes.json()) as { id?: string; task_id?: string };
    const taskId = createData.task_id ?? createData.id;
    if (!taskId) {
      throw new ProviderError(this.id, modelId, 500, "Agnes video task creation failed: no task ID returned");
    }

    // 2. 轮询任务状态
    // Agnes 免费档较慢，最长等待 10 分钟
    const POLL_INTERVAL = 10_000;
    const POLL_TIMEOUT = 600_000;
    const deadline = Date.now() + POLL_TIMEOUT;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const pollRes = await this.safeFetch(
        `${this.baseUrl}/videos/${taskId}`,
        {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(15_000),
        },
        { provider: this.id, model: modelId },
      );
      const task = (await pollRes.json()) as {
        status?: string;
        internal_status?: string;
        progress?: number;
        remixed_from_video_id?: string;
        video_url?: string;
        url?: string;
        error?: { message?: string } | string;
        metadata?: { url?: string; size_mapping?: unknown };
      };

      // 兼容两种状态字段命名（status / internal_status）
      const st = (task.status ?? task.internal_status ?? "").toLowerCase();
      // Agnes v2.0 把视频 URL 放在 metadata.url 里（而非顶层 video_url/url）
      const rawUrl = task.remixed_from_video_id ?? task.video_url ?? task.url ?? task.metadata?.url;

      if (st === "failed") {
        const errMsg =
          typeof task.error === "string"
            ? task.error
            : (task.error?.message ?? "video generation failed");
        throw new ProviderError(this.id, modelId, 500, `Agnes video task failed: ${errMsg}`);
      }

      // 完成判定：状态为 completed，或已返回视频 URL
      if (st === "completed" || rawUrl) {
        if (!rawUrl) {
          throw new ProviderError(this.id, modelId, 500, "Agnes video completed but no URL returned");
        }
        // URL 持久化：下载临时 URL 到本地存储
        const { getUrlPersistence } = await import("../services/url-persistence.js");
        const persistedUrl = await getUrlPersistence().persist(rawUrl, "video");
        return {
          model: modelId,
          provider: this.id,
          url: persistedUrl,
          cost: model.costPer1kOutput,
          latencyMs: Date.now() - start,
          usedByok: false,
        };
      }
      // queued / inference / in_progress → 继续轮询
    }

    throw new ProviderError(this.id, modelId, 504, `Agnes video task ${taskId} timed out after ${POLL_TIMEOUT / 1000}s`);
  }

  override async audio(_req: AudioRequest, _apiKey: string): Promise<AudioResponse> {
    // 音乐生成按需求由 doubao / MiniMax 负责，agnes 不暴露音频
    throw new ProviderError(this.id, "*", 400, "agnes audio not used in this router (music handled by doubao/minimax)");
  }
}
