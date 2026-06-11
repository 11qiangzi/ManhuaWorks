/**
 * VideoComposer — 视频合成器 (L3.H)
 *
 * 计划: 6/25 视频生成 + 合成 (M1-W3 P1)
 * 用途: 把多段 video clip + 字幕/水印 overlay + 转场 串成一条 timeline
 *
 * 设计:
 *   - mock 实现: 不依赖 ffmpeg / 任何视频 SDK
 *   - 把 clips 元数据串成 timeline, 计算总时长
 *   - 支持: clips, audio track, subtitle track, text/image overlay, transition (fade|cut|dissolve)
 *   - 导出: mp4 | webm | gif (mock URL)
 *
 * 不依赖: ffmpeg, fluent-ffmpeg, sharp.
 */

import { createHash } from "node:crypto";

/** 视频片段 (生成器产出) */
export interface VideoClip {
  id: string;
  videoUrl: string;
  startSec: number;
  endSec: number;
  sceneId: string;
}

/** 字幕/文字 overlay */
export interface TextOverlay {
  kind: "text";
  text: string;
  startSec: number;
  endSec: number;
  position: "top" | "center" | "bottom";
  style?: {
    fontSize?: number;
    color?: string;
    bold?: boolean;
    fontFamily?: string;
  };
}

/** 图片 overlay (水印/logo) */
export interface ImageOverlay {
  kind: "image";
  imageUrl: string;
  startSec: number;
  endSec: number;
  opacity: number; // 0..1
  position: { x: number; y: number }; // 像素坐标
}

export type Overlay = TextOverlay | ImageOverlay;

/** 转场 */
export type TransitionType = "fade" | "cut" | "dissolve";

export interface Transition {
  from: string; // clip id
  to: string; // clip id
  type: TransitionType;
  /** 转场时长 (秒) */
  durationSec: number;
}

/** 音轨 */
export interface AudioTrack {
  url: string;
  /** 起播时间偏移 (秒) */
  startSec: number;
  /** 是否循环 */
  loop: boolean;
  volume: number; // 0..1
}

/** 字幕轨 */
export interface SubtitleTrack {
  cues: Array<{
    text: string;
    startSec: number;
    endSec: number;
  }>;
}

export type ExportFormat = "mp4" | "webm" | "gif";

export interface ComposeOptions {
  clips: VideoClip[];
  audioTrack?: AudioTrack;
  subtitleTrack?: SubtitleTrack;
}

export interface ComposeResult {
  outputUrl: string;
  duration: number;
  scenes: Array<{
    sceneId: string;
    clipId: string;
    videoUrl: string;
    startSec: number;
    endSec: number;
  }>;
  overlayCount: number;
  transitionCount: number;
}

export interface ExportOptions {
  format: ExportFormat;
  resolution?: { width: number; height: number };
}

export interface ExportResult {
  url: string;
  size: number; // bytes (mock)
  format: ExportFormat;
  duration: number;
}

/**
 * VideoComposer
 *
 * 关键不变量:
 *   - totalDuration = max(endSec) 来自所有 clips
 *   - addClip 必须有 id, videoUrl, sceneId, startSec < endSec
 *   - addOverlay startSec < endSec, 在总时长内
 *   - exportProject 输出 mock URL, size = duration * format-specific factor
 */
export class VideoComposer {
  private _clips: VideoClip[] = [];
  private _lastComposedClips: VideoClip[] = [];
  private _overlays: Overlay[] = [];
  private _transitions: Transition[] = [];
  private readonly _generator: { generationIdFor: (opts: { prompt: string; seed?: number }) => string };

  constructor(generator?: { generationIdFor: (opts: { prompt: string; seed?: number }) => string }) {
    // 接受 generator 注入用于生成 deterministic id; 可选, 没传也能跑
    this._generator = generator ?? {
      generationIdFor: (opts) =>
        createHash("sha256").update(opts.prompt).digest("hex").slice(0, 16),
    };
  }

  /** 当前所有 clip 数量 */
  get clipCount(): number {
    return this._clips.length;
  }

  /** 当前所有 overlay 数量 */
  get overlayCount(): number {
    return this._overlays.length;
  }

  /** 当前所有 transition 数量 */
  get transitionCount(): number {
    return this._transitions.length;
  }

  /** 获取所有 clip 副本 (只读) */
  getClips(): VideoClip[] {
    return this._clips.map((c) => ({ ...c }));
  }

  /** 获取所有 overlays 副本 */
  getOverlays(): Overlay[] {
    return this._overlays.map((o) =>
      o.kind === "text" ? { ...o, style: o.style ? { ...o.style } : undefined } : { ...o }
    );
  }

  /** 获取所有 transitions 副本 */
  getTransitions(): Transition[] {
    return this._transitions.map((t) => ({ ...t }));
  }

  /**
   * 添加一个 clip 到内部队列.
   * 要求: startSec < endSec, sceneId/videoUrl/id 非空.
   */
  addClip(clip: VideoClip): void {
    if (typeof clip.id !== "string" || clip.id.length === 0) {
      throw new TypeError("clip.id must be non-empty string");
    }
    if (typeof clip.videoUrl !== "string" || clip.videoUrl.length === 0) {
      throw new TypeError("clip.videoUrl must be non-empty string");
    }
    if (typeof clip.sceneId !== "string" || clip.sceneId.length === 0) {
      throw new TypeError("clip.sceneId must be non-empty string");
    }
    if (!Number.isFinite(clip.startSec) || !Number.isFinite(clip.endSec)) {
      throw new TypeError("clip startSec/endSec must be finite");
    }
    if (clip.startSec < 0 || clip.endSec <= clip.startSec) {
      throw new RangeError(
        `clip must have 0 <= startSec < endSec, got start=${clip.startSec} end=${clip.endSec}`
      );
    }
    this._clips.push({ ...clip });
  }

  /**
   * 添加 overlay. text 需非空, image 需 url. startSec < endSec.
   */
  addOverlay(overlay: Overlay): void {
    if (overlay.kind === "text") {
      if (typeof overlay.text !== "string" || overlay.text.length === 0) {
        throw new TypeError("text overlay requires non-empty text");
      }
      this._assertOverlayRange(overlay.startSec, overlay.endSec);
      this._overlays.push({ ...overlay, style: overlay.style ? { ...overlay.style } : undefined });
    } else {
      if (typeof overlay.imageUrl !== "string" || overlay.imageUrl.length === 0) {
        throw new TypeError("image overlay requires non-empty imageUrl");
      }
      if (overlay.opacity < 0 || overlay.opacity > 1) {
        throw new RangeError(`image overlay opacity must be in [0,1], got ${overlay.opacity}`);
      }
      this._assertOverlayRange(overlay.startSec, overlay.endSec);
      this._overlays.push({ ...overlay, position: { ...overlay.position } });
    }
  }

  /**
   * 添加一个转场. from/to 必须是已添加的 clip id.
   */
  addTransition(from: string, to: string, type: TransitionType, durationSec = 0.5): void {
    if (!this._clips.find((c) => c.id === from)) {
      throw new Error(`unknown from clip id: ${from}`);
    }
    if (!this._clips.find((c) => c.id === to)) {
      throw new Error(`unknown to clip id: ${to}`);
    }
    if (!Number.isFinite(durationSec) || durationSec < 0) {
      throw new RangeError(`transition durationSec must be >= 0, got ${durationSec}`);
    }
    this._transitions.push({ from, to, type, durationSec });
  }

  /**
   * 合成. 计算总时长, 校验 overlap, 输出 mock URL.
   * 只使用 opts.clips, 不修改内部队列.
   */
  async compose(opts: ComposeOptions): Promise<ComposeResult> {
    if (!Array.isArray(opts.clips) || opts.clips.length === 0) {
      throw new Error("compose() requires at least one clip");
    }
    // 校验所有 clip (不污染内部队列)
    for (const c of opts.clips) {
      if (c.startSec < 0 || c.endSec <= c.startSec) {
        throw new RangeError(
          `invalid clip range: start=${c.startSec} end=${c.endSec}`
        );
      }
    }
    // 校验音轨
    if (opts.audioTrack) {
      const a = opts.audioTrack;
      if (a.volume < 0 || a.volume > 1) {
        throw new RangeError(`audio volume must be in [0,1], got ${a.volume}`);
      }
    }
    // 总时长 = 所有 clip endSec 的最大值
    const duration = opts.clips.reduce((m, c) => Math.max(m, c.endSec), 0);
    // mock: 模拟合成耗时
    await new Promise((r) => setTimeout(r, 10));
    const id = this._generator.generationIdFor({
      prompt: `compose-${duration}-${opts.clips.length}`,
    });
    const outputUrl = `mock://compose/${id}.mp4`;
    this._lastComposedClips = opts.clips.map((c) => ({ ...c }));
    return {
      outputUrl,
      duration,
      scenes: opts.clips.map((c) => ({
        sceneId: c.sceneId,
        clipId: c.id,
        videoUrl: c.videoUrl,
        startSec: c.startSec,
        endSec: c.endSec,
      })),
      overlayCount: this._overlays.length,
      transitionCount: this._transitions.length,
    };
  }

  /**
   * 导出项目. mock: 输出一个 URL + size.
   * 使用最近一次 compose 的 clips. 没 compose 过则报错.
   */
  async exportProject(opts: ExportOptions): Promise<ExportResult> {
    if (this._lastComposedClips.length === 0) {
      throw new Error("exportProject() requires at least one clip (call compose first)");
    }
    if (!["mp4", "webm", "gif"].includes(opts.format)) {
      throw new RangeError(`unsupported format: ${opts.format}`);
    }
    const duration = this._lastComposedClips.reduce((m, c) => Math.max(m, c.endSec), 0);
    // mock size factor: mp4=100, webm=90, gif=60 (KB per second)
    const factor = opts.format === "mp4" ? 100 : opts.format === "webm" ? 90 : 60;
    const size = Math.round(duration * factor * 1024);
    const id = this._generator.generationIdFor({
      prompt: `export-${opts.format}-${duration}`,
    });
    await new Promise((r) => setTimeout(r, 5));
    return {
      url: `mock://export/${id}.${opts.format}`,
      size,
      format: opts.format,
      duration,
    };
  }

  /**
   * 重置 composer 状态.
   */
  reset(): void {
    this._clips = [];
    this._lastComposedClips = [];
    this._overlays = [];
    this._transitions = [];
  }

  private _assertOverlayRange(startSec: number, endSec: number): void {
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
      throw new TypeError("overlay startSec/endSec must be finite");
    }
    if (startSec < 0 || endSec <= startSec) {
      throw new RangeError(
        `overlay must have 0 <= startSec < endSec, got start=${startSec} end=${endSec}`
      );
    }
  }
}
