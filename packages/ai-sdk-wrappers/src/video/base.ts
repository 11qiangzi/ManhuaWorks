/**
 * 视频模型统一接口：text2video / image2video
 *
 * 视频生成通常分两步：
 *  1. submit() 返回 taskId
 *  2. poll() / waitForCompletion() 轮询直到 done
 *
 * 各家供应商时延差异大（10 秒~5 分钟），所以接口统一为异步任务。
 */

export type VideoAspect = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | 'auto';
export type VideoResolution = '480p' | '720p' | '1080p';

export interface VideoRequestCommon {
  prompt: string;
  negativePrompt?: string;
  aspect?: VideoAspect;
  resolution?: VideoResolution;
  durationSec?: number;
  fps?: number;
  seed?: number;
  /** 一致性（人物/场景），透传 provider */
  consistency?: number;
  extra?: Record<string, unknown>;
}

export interface Text2VideoRequest extends VideoRequestCommon {}

export interface Image2VideoRequest extends VideoRequestCommon {
  /** base64 编码首帧图 或 URL */
  firstFrame: string;
  /** 末帧图（部分供应商支持） */
  lastFrame?: string;
}

export type VideoStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface VideoTask {
  taskId: string;
  provider: string;
  status: VideoStatus;
  /** 已就绪时填写 */
  videoUrl?: string;
  /** 视频二进制（returnBinary 时） */
  videoBinary?: Buffer;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  errorMessage?: string;
  /** 原始响应（debug 用） */
  raw?: unknown;
}

export interface VideoProvider {
  readonly id: string;
  readonly model: string;
  /** 是否支持 image2video */
  readonly supportsImage2Video: boolean;

  text2video(req: Text2VideoRequest): Promise<VideoTask>;
  image2video(req: Image2VideoRequest): Promise<VideoTask>;
  poll(taskId: string): Promise<VideoTask>;
  /** 阻塞等到成功/失败，超时由 timeoutMs 控制 */
  waitForCompletion(taskId: string, timeoutMs?: number, pollIntervalMs?: number): Promise<VideoTask>;
}

export class VideoError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause: unknown,
    message?: string,
  ) {
    super(message ?? `Video provider [${provider}] failed: ${String(cause)}`);
    this.name = 'VideoError';
  }
}

export class NotSupportedVideoError extends Error {
  constructor(public readonly provider: string) {
    super(`Video provider [${provider}] does not support image2video`);
    this.name = 'NotSupportedVideoError';
  }
}

export async function fetchVideoBuffer(url: string, timeoutMs = 120_000): Promise<{ buf: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Fetch video failed: HTTP ${res.status}`);
  }
  const mime = res.headers.get('content-type') ?? 'video/mp4';
  const ab = await res.arrayBuffer();
  return { buf: Buffer.from(ab), mime };
}

// 通用轮询实现：provider 实现 poll()，业务方用这个
export async function pollUntilDone(
  pollFn: () => Promise<VideoTask>,
  timeoutMs = 5 * 60_000,
  intervalMs = 5_000,
): Promise<VideoTask> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await pollFn();
    if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'canceled') {
      return task;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new VideoError('unknown', 'timeout', `Polling timed out after ${timeoutMs}ms`);
}
