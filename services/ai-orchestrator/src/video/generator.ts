/**
 * VideoGenerator — 视频生成器 (L3.H)
 *
 * 计划: 6/25 视频生成 + 合成 (M1-W3 P1)
 * 用途: 把静态图像 (角色 + 场景) + 字幕/旁白合成成 5-15s 漫剧片段
 *
 * 设计:
 *   - mock 实现: 不依赖任何视频 SDK / 真 Atlas Cloud Seedance
 *   - 用 setTimeout 模拟 4-8s 生成时间
 *   - 生成 mock video URL: `mock://video/{generationId}.mp4`
 *   - 支持: text-to-video, image-to-video, cancel, cost estimate
 *   - 队列: 内部维护 in-flight 任务, 支持 cancel
 *   - 确定性: 同 seed + 同 prompt → 同 generationId (用于测试)
 *
 * 不依赖: ffmpeg, sharp, fluent-ffmpeg, 任何视频 SDK.
 */

import { createHash } from "node:crypto";

/** 默认配置 */
export const DEFAULT_FPS = 24;
export const DEFAULT_DURATION_SEC = 5;
export const DEFAULT_RESOLUTION = { width: 1920, height: 1080 } as const;
export const DEFAULT_PROVIDER = "mock-atlas-seedance";
export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 60;
export const COST_PER_SECOND_CENTS = 4; // mock 价格

export type VideoProvider = "mock-atlas-seedance" | "mock-replicate" | "mock-runway";

export interface VideoGeneratorOptions {
  provider?: VideoProvider;
  fps?: number;
  defaultDuration?: number;
  resolution?: { width: number; height: number };
  /** 自定义 cost per second, 默认 4 cents */
  costPerSecondCents?: number;
  /** 模拟生成延迟范围 [minMs, maxMs], 默认 [4000, 8000] */
  latencyRangeMs?: [number, number];
  /** 强制失败率 0..1, 测试用, 默认 0 */
  failRate?: number;
}

export interface GenerateOptions {
  prompt: string;
  durationSec?: number;
  seed?: number;
  style?: string;
}

export interface ImageToVideoOptions {
  imageUrl: string;
  prompt: string;
  durationSec?: number;
  /** 运动幅度: low | medium | high, 默认 medium */
  motion?: "low" | "medium" | "high";
}

export interface VideoGenerationResult {
  generationId: string;
  videoUrl: string;
  durationSec: number;
  frames: number;
  width: number;
  height: number;
  costCents: number;
  provider: VideoProvider;
  seed: number;
  status: "completed";
}

/** 内部任务状态 */
interface InFlightTask {
  id: string;
  prompt: string;
  durationSec: number;
  status: "running" | "completed" | "cancelled" | "failed";
  result?: VideoGenerationResult;
  error?: string;
  cancel: () => void;
}

/**
 * VideoGenerator
 *
 * 关键不变量:
 *   - 同一 prompt + seed → 同一 generationId (deterministic)
 *   - costCents = durationSec * costPerSecondCents
 *   - frames = durationSec * fps
 *   - cancel 后任务标记 cancelled, 不会 resolve
 */
export class VideoGenerator {
  readonly provider: VideoProvider;
  readonly fps: number;
  readonly defaultDuration: number;
  readonly resolution: { width: number; height: number };
  readonly costPerSecondCents: number;
  readonly latencyRangeMs: [number, number];
  readonly failRate: number;

  private _tasks: Map<string, InFlightTask> = new Map();
  private _taskCounter = 0;

  constructor(opts: VideoGeneratorOptions = {}) {
    this.provider = opts.provider ?? DEFAULT_PROVIDER;
    this.fps = opts.fps ?? DEFAULT_FPS;
    this.defaultDuration = opts.defaultDuration ?? DEFAULT_DURATION_SEC;
    this.resolution = opts.resolution ?? { ...DEFAULT_RESOLUTION };
    this.costPerSecondCents = opts.costPerSecondCents ?? COST_PER_SECOND_CENTS;
    this.latencyRangeMs = opts.latencyRangeMs ?? [4000, 8000];
    this.failRate = opts.failRate ?? 0;
  }

  /**
   * 估算成本 (cents). durationSec 必须 > 0.
   */
  getCostEstimate(durationSec: number): number {
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new RangeError(`durationSec must be > 0, got ${durationSec}`);
    }
    return Math.ceil(durationSec * this.costPerSecondCents);
  }

  /**
   * 生成 generationId. 同 prompt + seed → 同 id.
   */
  generationIdFor(opts: { prompt: string; seed?: number; imageUrl?: string }): string {
    const seed = opts.seed ?? 0;
    const h = createHash("sha256");
    h.update(opts.prompt);
    h.update("|");
    h.update(String(seed));
    if (opts.imageUrl) {
      h.update("|");
      h.update(opts.imageUrl);
    }
    return h.digest("hex").slice(0, 16);
  }

  /**
   * Text-to-video generation.
   */
  async generate(opts: GenerateOptions): Promise<VideoGenerationResult> {
    if (typeof opts.prompt !== "string" || opts.prompt.length === 0) {
      throw new TypeError("generate() requires non-empty prompt");
    }
    const durationSec = opts.durationSec ?? this.defaultDuration;
    this._assertDuration(durationSec);
    const seed = opts.seed ?? Date.now();
    const id = this.generationIdFor({ prompt: opts.prompt, seed });
    return this._runGeneration(id, opts.prompt, durationSec, seed);
  }

  /**
   * Image-to-video generation.
   */
  async generateFromImage(opts: ImageToVideoOptions): Promise<VideoGenerationResult> {
    if (typeof opts.imageUrl !== "string" || opts.imageUrl.length === 0) {
      throw new TypeError("generateFromImage() requires non-empty imageUrl");
    }
    if (typeof opts.prompt !== "string" || opts.prompt.length === 0) {
      throw new TypeError("generateFromImage() requires non-empty prompt");
    }
    const durationSec = opts.durationSec ?? this.defaultDuration;
    this._assertDuration(durationSec);
    const seed = Date.now();
    const id = this.generationIdFor({
      prompt: opts.prompt,
      seed,
      imageUrl: opts.imageUrl,
    });
    return this._runGeneration(id, opts.prompt, durationSec, seed);
  }

  /**
   * 取消 in-flight 任务. 已完成的任务返回 false.
   */
  async cancel(generationId: string): Promise<boolean> {
    const task = this._tasks.get(generationId);
    if (!task) return false;
    if (task.status !== "running") return false;
    task.cancel();
    return true;
  }

  /**
   * 内部: 跑一次生成.
   */
  private _runGeneration(
    id: string,
    prompt: string,
    durationSec: number,
    seed: number
  ): Promise<VideoGenerationResult> {
    return new Promise<VideoGenerationResult>((resolve, reject) => {
      const [minMs, maxMs] = this.latencyRangeMs;
      const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      let cancelled = false;

      const finalizeCancel = () => {
        const t = this._tasks.get(id);
        if (t) t.status = "cancelled";
        reject(new Error(`generation ${id} cancelled`));
      };

      const timer = setTimeout(() => {
        if (cancelled) {
          finalizeCancel();
          return;
        }
        // 模拟失败
        if (this.failRate > 0 && Math.random() < this.failRate) {
          const t = this._tasks.get(id);
          if (t) {
            t.status = "failed";
            t.error = "mock random failure";
          }
          reject(new Error(`mock generation failed for ${id}`));
          return;
        }
        const frames = Math.round(durationSec * this.fps);
        const result: VideoGenerationResult = {
          generationId: id,
          videoUrl: `mock://video/${id}.mp4`,
          durationSec,
          frames,
          width: this.resolution.width,
          height: this.resolution.height,
          costCents: this.getCostEstimate(durationSec),
          provider: this.provider,
          seed,
          status: "completed",
        };
        const t = this._tasks.get(id);
        if (t) {
          t.status = "completed";
          t.result = result;
        }
        resolve(result);
      }, delay);

      const task: InFlightTask = {
        id,
        prompt,
        durationSec,
        status: "running",
        cancel: () => {
          cancelled = true;
          clearTimeout(timer);
          // clearTimeout 后 setTimeout 回调不会跑, 必须主动 reject
          finalizeCancel();
        },
      };
      this._tasks.set(id, task);
      this._taskCounter++;
    });
  }

  private _assertDuration(durationSec: number): void {
    if (!Number.isFinite(durationSec)) {
      throw new RangeError(`durationSec must be finite, got ${durationSec}`);
    }
    if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
      throw new RangeError(
        `durationSec must be in [${MIN_DURATION_SEC}, ${MAX_DURATION_SEC}], got ${durationSec}`
      );
    }
  }

  /** 测试/调试: 当前 in-flight 任务数 */
  get inFlightCount(): number {
    let n = 0;
    for (const t of this._tasks.values()) {
      if (t.status === "running") n++;
    }
    return n;
  }

  /** 测试/调试: 总任务数 */
  get totalTaskCount(): number {
    return this._taskCounter;
  }

  /** 测试: 拿一个任务的当前状态 */
  getTaskStatus(generationId: string): InFlightTask["status"] | undefined {
    return this._tasks.get(generationId)?.status;
  }
}
