/**
 * VideoGenerationPipeline — 视频生成端到端 pipeline (L3.H)
 *
 * 计划: 6/25 视频生成 + 合成 (M1-W3 P1)
 * 用途: 把一段 script (多个 scene) 跑完 生成 → 合成 → 输出
 *
 * 设计:
 *   - 串行/并发可控 (默认 concurrent=2)
 *   - 每 scene: 调 generator.generate, 收集 clip
 *   - 全部完成后: 调 composer.compose 拼 timeline
 *   - 部分失败: continue-on-error 模式 (默认 false → throw)
 *   - 进度跟踪: projectId → { total, completed, current, percent }
 *   - 取消: projectId → 取消该 project 后续 scene
 *
 * 不依赖: 任何外部 HTTP / 视频 SDK.
 */

import { createHash } from "node:crypto";
import type { VideoGenerator, VideoGenerationResult } from "./generator.js";
import type { VideoComposer, VideoClip } from "./composer.js";

export interface SceneInput {
  sceneId: string;
  prompt: string;
  imageUrl?: string;
  durationSec?: number;
}

export interface PipelineRunOptions {
  script: SceneInput[];
  globalStyle?: string;
  audio?: { url: string; volume?: number; loop?: boolean };
  /** 并发数, 默认 2 */
  concurrent?: number;
  /** 部分失败是否继续, 默认 false */
  continueOnError?: boolean;
}

export interface SceneOutput {
  sceneId: string;
  videoUrl: string;
  status: "completed" | "failed" | "cancelled";
  error?: string;
  generationId?: string;
  durationSec?: number;
}

export interface PipelineRunResult {
  projectId: string;
  scenes: SceneOutput[];
  finalOutput: {
    url: string;
    duration: number;
    format: "mp4";
  };
  totalCostCents: number;
}

export interface PipelineProgress {
  total: number;
  completed: number;
  current: string | null;
  percent: number;
  status: "running" | "completed" | "failed" | "cancelled" | "partial";
}

/** 内部 project 状态 */
interface ProjectState {
  id: string;
  total: number;
  completed: number;
  current: string | null;
  status: PipelineProgress["status"];
  cancelled: boolean;
  abort: () => void;
}

/**
 * VideoGenerationPipeline
 *
 * 关键不变量:
 *   - projectId = sha256(script 序列化).slice(0, 16)
 *   - 进度 percent = completed / total * 100
 *   - 取消后: 该 project 的后续 scene 状态变 cancelled
 */
export class VideoGenerationPipeline {
  private readonly _generator: VideoGenerator;
  private readonly _composer: VideoComposer;
  private readonly _projects: Map<string, ProjectState> = new Map();
  private readonly _defaultConcurrent: number;

  constructor(generator: VideoGenerator, composer: VideoComposer, opts: { concurrent?: number } = {}) {
    this._generator = generator;
    this._composer = composer;
    this._defaultConcurrent = opts.concurrent ?? 2;
  }

  /**
   * projectId: 同 script → 同 id.
   */
  projectIdFor(script: SceneInput[], globalStyle?: string): string {
    const h = createHash("sha256");
    for (const s of script) {
      h.update(`${s.sceneId}|${s.prompt}|${s.imageUrl ?? ""}|${s.durationSec ?? 0};`);
    }
    if (globalStyle) h.update(`|style:${globalStyle}`);
    return h.digest("hex").slice(0, 16);
  }

  /**
   * 跑端到端 pipeline.
   * 默认并发=2, 失败抛错; continueOnError=true 时记录失败继续.
   */
  async run(opts: PipelineRunOptions): Promise<PipelineRunResult> {
    if (!Array.isArray(opts.script) || opts.script.length === 0) {
      throw new Error("run() requires non-empty script");
    }
    for (const s of opts.script) {
      if (typeof s.sceneId !== "string" || s.sceneId.length === 0) {
        throw new TypeError("every scene must have non-empty sceneId");
      }
      if (typeof s.prompt !== "string" || s.prompt.length === 0) {
        throw new TypeError(`scene ${s.sceneId} must have non-empty prompt`);
      }
    }
    const projectId = this.projectIdFor(opts.script, opts.globalStyle);
    const total = opts.script.length;
    const concurrent = opts.concurrent ?? this._defaultConcurrent;

    let abortedController: AbortController | null = null;
    const state: ProjectState = {
      id: projectId,
      total,
      completed: 0,
      current: null,
      status: "running",
      cancelled: false,
      abort: () => {
        state.cancelled = true;
        if (abortedController) abortedController.abort();
      },
    };
    this._projects.set(projectId, state);

    const sceneOutputs: SceneOutput[] = [];
    const clips: VideoClip[] = [];
    let totalCostCents = 0;
    let cursor = 0;
    let firstError: Error | null = null;

    const worker = async () => {
      while (cursor < total) {
        if (state.cancelled) return;
        const idx = cursor++;
        const scene = opts.script[idx];
        state.current = scene.sceneId;
        try {
          const result: VideoGenerationResult = scene.imageUrl
            ? await this._generator.generateFromImage({
                imageUrl: scene.imageUrl,
                prompt: scene.prompt,
                durationSec: scene.durationSec,
              })
            : await this._generator.generate({
                prompt: scene.prompt,
                durationSec: scene.durationSec,
              });
          // 如果项目已被取消, 即使任务完成也标记 cancelled (不计 cost, 不入 clips)
          if (state.cancelled) {
            sceneOutputs.push({
              sceneId: scene.sceneId,
              videoUrl: "",
              status: "cancelled",
              error: "project cancelled",
            });
            return;
          }
          sceneOutputs.push({
            sceneId: scene.sceneId,
            videoUrl: result.videoUrl,
            status: "completed",
            generationId: result.generationId,
            durationSec: result.durationSec,
          });
          clips.push({
            id: `clip-${scene.sceneId}`,
            videoUrl: result.videoUrl,
            sceneId: scene.sceneId,
            startSec: clips.reduce((acc, _, i) => acc + (sceneOutputs[i].durationSec ?? 0), 0),
            endSec:
              clips.reduce((acc, _, i) => acc + (sceneOutputs[i].durationSec ?? 0), 0) +
              result.durationSec,
          });
          totalCostCents += result.costCents;
          state.completed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("cancelled")) {
            sceneOutputs.push({
              sceneId: scene.sceneId,
              videoUrl: "",
              status: "cancelled",
              error: msg,
            });
            state.cancelled = true;
            return;
          }
          sceneOutputs.push({
            sceneId: scene.sceneId,
            videoUrl: "",
            status: "failed",
            error: msg,
          });
          if (!opts.continueOnError) {
            firstError = err instanceof Error ? err : new Error(msg);
            state.status = "failed";
            return;
          }
          state.completed++;
        }
      }
    };

    abortedController = new AbortController();
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrent, total); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // 处理状态
    if (state.cancelled) {
      state.status = sceneOutputs.every((s) => s.status === "completed")
        ? "completed"
        : "cancelled";
    } else if (firstError) {
      this._projects.delete(projectId);
      throw firstError;
    } else {
      state.status = "completed";
    }
    state.current = null;

    // 调 composer (如果没有成功的 clip, 返回空 finalOutput)
    let finalOutput: { url: string; duration: number; format: "mp4" } = {
      url: "",
      duration: 0,
      format: "mp4" as const,
    };
    if (clips.length > 0) {
      const composed = await this._composer.compose({ clips });
      finalOutput = {
        url: composed.outputUrl,
        duration: composed.duration,
        format: "mp4" as const,
      };
    }
    this._projects.delete(projectId);
    return {
      projectId,
      scenes: sceneOutputs,
      finalOutput,
      totalCostCents,
    };
  }

  /**
   * 取一个 project 的进度快照.
   */
  getProgress(projectId: string): PipelineProgress | null {
    const s = this._projects.get(projectId);
    if (!s) return null;
    return {
      total: s.total,
      completed: s.completed,
      current: s.current,
      percent: s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100),
      status: s.status,
    };
  }

  /**
   * 取消 in-flight project.
   */
  cancel(projectId: string): boolean {
    const s = this._projects.get(projectId);
    if (!s) return false;
    s.abort();
    return true;
  }
}
