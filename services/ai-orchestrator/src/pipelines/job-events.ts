/**
 * Job 进度事件总线
 *
 * 供 one-click-manga pipeline 每步完成时 emit，由 WebSocket 订阅推送到前端。
 * 基于 Node.js 内置 EventEmitter，零依赖。
 */

import { EventEmitter } from "events";

export interface StepProgressEvent {
  type: "step-completed" | "step-failed" | "job-completed" | "job-failed";
  jobId: string;
  step?: number;
  stepName?: string;
  progress?: number;
  previewUrl?: string;
  result?: unknown;
  error?: string;
  retryable?: boolean;
  timestamp: number;
}

export const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(100);

/** 每个 jobId 的监听器计数，用于自动清理 */
const listeners = new Map<string, number>();

/**
 * 订阅某个 job 的进度事件。
 * 返回 unsubscribe 函数。
 */
export function subscribeJob(
  jobId: string,
  handler: (ev: StepProgressEvent) => void,
): () => void {
  const wrapped = (ev: StepProgressEvent) => {
    if (ev.jobId === jobId) handler(ev);
  };
  jobEvents.on("job-progress", wrapped);
  const count = (listeners.get(jobId) ?? 0) + 1;
  listeners.set(jobId, count);
  return () => {
    jobEvents.off("job-progress", wrapped);
    const n = (listeners.get(jobId) ?? 1) - 1;
    if (n <= 0) listeners.delete(jobId);
    else listeners.set(jobId, n);
  };
}

/** 步骤完成 */
export function emitStepCompleted(
  jobId: string,
  step: number,
  stepName: string,
  progress: number,
  previewUrl?: string,
): void {
  jobEvents.emit("job-progress", {
    type: "step-completed",
    jobId,
    step,
    stepName,
    progress,
    previewUrl,
    timestamp: Date.now(),
  } satisfies StepProgressEvent);
}

/** 步骤失败 */
export function emitStepFailed(
  jobId: string,
  step: number,
  stepName: string,
  error: string,
  retryable = false,
): void {
  jobEvents.emit("job-progress", {
    type: "step-failed",
    jobId,
    step,
    stepName,
    error,
    retryable,
    timestamp: Date.now(),
  } satisfies StepProgressEvent);
}

/** 整体任务完成 */
export function emitJobCompleted(jobId: string, result: unknown): void {
  jobEvents.emit("job-progress", {
    type: "job-completed",
    jobId,
    result,
    timestamp: Date.now(),
  } satisfies StepProgressEvent);
}

/** 整体任务失败 */
export function emitJobFailed(jobId: string, error: string): void {
  jobEvents.emit("job-progress", {
    type: "job-failed",
    jobId,
    error,
    timestamp: Date.now(),
  } satisfies StepProgressEvent);
}
