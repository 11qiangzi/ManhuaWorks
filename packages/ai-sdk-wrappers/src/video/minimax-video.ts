/**
 * MiniMax 视频 API
 *
 * 端点：https://api.minimax.chat/v1/video/generation
 *       https://api.minimax.chat/v1/video/generation/retrieve?task_id=...
 *
 * 提交：{ model, prompt, first_frame_image? }
 * 查询：GET  ?task_id=xxx
 * 状态：Queueing / Processing / Success / Failure
 */

import type {
  Image2VideoRequest,
  Text2VideoRequest,
  VideoProvider,
  VideoTask,
} from './base.js';
import { VideoError, fetchVideoBuffer, pollUntilDone } from './base.js';

export interface MiniMaxVideoConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

interface RawSubmit {
  task_id?: string;
  base_resp?: { status_code?: number; status_msg?: string };
}

interface RawPoll {
  task_id?: string;
  status?: string;
  file_id?: string;
  // 成功后直接给 download url
  video_url?: string;
  download_url?: string;
  base_resp?: { status_code?: number; status_msg?: string };
}

const STATUS_MAP: Record<string, VideoTask['status']> = {
  queueing: 'queued',
  queued: 'queued',
  processing: 'running',
  running: 'running',
  in_progress: 'running',
  success: 'succeeded',
  succeeded: 'succeeded',
  failure: 'failed',
  failed: 'failed',
};

export class MiniMaxVideoProvider implements VideoProvider {
  readonly id = 'minimax-video';
  readonly model: string;
  readonly supportsImage2Video = true;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(config: MiniMaxVideoConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'video-01';
    this.baseUrl = (config.baseUrl ?? 'https://api.minimax.chat/v1').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.pollIntervalMs = config.pollIntervalMs ?? 5_000;
  }

  async text2video(req: Text2VideoRequest): Promise<VideoTask> {
    return this.submit(req.prompt, undefined, req);
  }

  async image2video(req: Image2VideoRequest): Promise<VideoTask> {
    if (!req.firstFrame) {
      throw new VideoError(this.id, 'missing firstFrame');
    }
    return this.submit(req.prompt, req.firstFrame, req);
  }

  async poll(taskId: string): Promise<VideoTask> {
    try {
      const url = `${this.baseUrl}/video/generation/retrieve?task_id=${encodeURIComponent(taskId)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const raw = (await res.json()) as RawPoll;
      if (raw.base_resp?.status_code && raw.base_resp.status_code !== 0) {
        throw new Error(raw.base_resp.status_msg ?? 'minimax poll error');
      }
      const status = STATUS_MAP[(raw.status ?? '').toLowerCase()] ?? 'running';
      const task: VideoTask = {
        taskId: raw.task_id ?? taskId,
        provider: this.id,
        status,
        raw,
      };
      const url2 = raw.video_url ?? raw.download_url;
      if (status === 'succeeded' && url2) {
        task.videoUrl = url2;
        task.mimeType = 'video/mp4';
      }
      return task;
    } catch (err) {
      throw new VideoError(this.id, err);
    }
  }

  async waitForCompletion(taskId: string, timeoutMs?: number, pollIntervalMs?: number): Promise<VideoTask> {
    const t = timeoutMs ?? 5 * 60_000;
    const p = pollIntervalMs ?? this.pollIntervalMs;
    const final = await pollUntilDone(() => this.poll(taskId), t, p);
    if (final.status === 'succeeded' && final.videoUrl && !final.videoBinary) {
      const { buf, mime } = await fetchVideoBuffer(final.videoUrl);
      final.videoBinary = buf;
      final.mimeType = mime;
    }
    return final;
  }

  private async submit(
    prompt: string,
    firstFrame: string | undefined,
    req: Text2VideoRequest | Image2VideoRequest,
  ): Promise<VideoTask> {
    try {
      const body: Record<string, unknown> = { model: this.model, prompt };
      if (firstFrame) {
        body.first_frame_image = firstFrame;
      }
      if (req.aspect && req.aspect !== 'auto') body.aspect_ratio = req.aspect;
      if (req.resolution) body.resolution = req.resolution;
      if (req.durationSec) body.duration = req.durationSec;
      if (typeof req.seed === 'number') body.seed = req.seed;
      if (req.negativePrompt) body.negative_prompt = req.negativePrompt;
      Object.assign(body, req.extra ?? {});

      const res = await fetch(`${this.baseUrl}/video/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const raw = (await res.json()) as RawSubmit;
      if (raw.base_resp?.status_code && raw.base_resp.status_code !== 0) {
        throw new Error(raw.base_resp.status_msg ?? 'minimax submit error');
      }
      const taskId = raw.task_id;
      if (!taskId) {
        throw new Error('minimax submit returned no task_id');
      }
      return {
        taskId,
        provider: this.id,
        status: 'queued',
        raw,
      };
    } catch (err) {
      if (err instanceof VideoError) throw err;
      throw new VideoError(this.id, err);
    }
  }
}

export function createMiniMaxVideo(config: MiniMaxVideoConfig): MiniMaxVideoProvider {
  return new MiniMaxVideoProvider(config);
}
