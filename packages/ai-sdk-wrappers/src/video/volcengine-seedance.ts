/**
 * 火山方舟 Seedance 2.0 视频生成
 *
 * 端点：
 *   POST  /contents/generations/tasks  （提交）
 *   GET   /contents/generations/tasks/{id}  （查询）
 *
 * 提交参数：{ model, content: [{ type: "text", text: prompt }] }
 *           透传 parameters: { ratio, duration, resolution, ... }
 *
 * 状态码：0=成功；其他看 msg
 */

import type {
  Image2VideoRequest,
  Text2VideoRequest,
  VideoProvider,
  VideoTask,
} from './base.js';
import {
  NotSupportedVideoError,
  VideoError,
  fetchVideoBuffer,
  pollUntilDone,
} from './base.js';

export interface VolcengineSeedanceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

interface RawSubmit {
  id?: string;
  task_id?: string;
  base_resp?: { status_code?: number; status_msg?: string };
}

interface RawPoll {
  id?: string;
  task_id?: string;
  status?: string;
  content?: { video_url?: string };
  error?: { code?: string; message?: string };
  base_resp?: { status_code?: number; status_msg?: string };
}

const STATUS_MAP: Record<string, VideoTask['status']> = {
  queued: 'queued',
  running: 'running',
  in_progress: 'running',
  succeeded: 'succeeded',
  success: 'succeeded',
  failed: 'failed',
  fail: 'failed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

export class VolcengineSeedanceProvider implements VideoProvider {
  readonly id = 'volcengine-seedance';
  readonly model: string;
  readonly supportsImage2Video = true;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(config: VolcengineSeedanceConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'doubao-seedance-2-0-pro-250528';
    this.baseUrl = (config.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.pollIntervalMs = config.pollIntervalMs ?? 5_000;
  }

  async text2video(req: Text2VideoRequest): Promise<VideoTask> {
    return this.submit([{ type: 'text', text: req.prompt }], req);
  }

  async image2video(req: Image2VideoRequest): Promise<VideoTask> {
    if (!req.firstFrame) {
      throw new VideoError(this.id, 'missing firstFrame', 'image2video requires firstFrame');
    }
    const content: { type: string; text?: string; image_url?: { url: string } }[] = [
      { type: 'text', text: req.prompt },
      { type: 'image_url', image_url: { url: req.firstFrame } },
    ];
    if (req.lastFrame) {
      content.push({ type: 'image_url', image_url: { url: req.lastFrame } });
    }
    return this.submit(content, req);
  }

  async poll(taskId: string): Promise<VideoTask> {
    try {
      const res = await fetch(`${this.baseUrl}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const raw = (await res.json()) as RawPoll;
      if (raw.base_resp?.status_code && raw.base_resp.status_code !== 0) {
        throw new Error(raw.base_resp.status_msg ?? 'volcengine poll error');
      }
      const id = raw.id ?? raw.task_id ?? taskId;
      const status = STATUS_MAP[(raw.status ?? '').toLowerCase()] ?? 'running';
      const task: VideoTask = {
        taskId: id,
        provider: this.id,
        status,
        raw,
      };
      if (status === 'succeeded' && raw.content?.video_url) {
        task.videoUrl = raw.content.video_url;
        task.mimeType = 'video/mp4';
      }
      if (status === 'failed' && raw.error?.message) {
        task.errorMessage = raw.error.message;
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
    content: { type: string; text?: string; image_url?: { url: string } }[],
    req: Text2VideoRequest | Image2VideoRequest,
  ): Promise<VideoTask> {
    try {
      const parameters: Record<string, unknown> = {};
      if (req.aspect && req.aspect !== 'auto') parameters.ratio = req.aspect;
      if (req.resolution) parameters.resolution = req.resolution;
      if (req.durationSec) parameters.duration = req.durationSec;
      if (req.fps) parameters.fps = req.fps;
      if (typeof req.seed === 'number') parameters.seed = req.seed;
      if (typeof req.consistency === 'number') parameters.consistency = req.consistency;
      if (req.negativePrompt) parameters.negative_prompt = req.negativePrompt;
      Object.assign(parameters, req.extra ?? {});

      const body = { model: this.model, content, parameters };

      const res = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
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
        throw new Error(raw.base_resp.status_msg ?? 'volcengine submit error');
      }
      const taskId = raw.id ?? raw.task_id;
      if (!taskId) {
        throw new Error('volcengine submit returned no task id');
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

export function createVolcengineSeedance(config: VolcengineSeedanceConfig): VolcengineSeedanceProvider {
  return new VolcengineSeedanceProvider(config);
}

// keep import satisfied
void NotSupportedVideoError;
