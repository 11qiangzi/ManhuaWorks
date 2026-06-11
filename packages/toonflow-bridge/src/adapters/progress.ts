/**
 * adapters/progress: Toonflow 5 状态 ↔ ManhuaWorks 7 步骤 映射
 *
 * 映射规则（v1）：
 *
 *  Toonflow 5 状态  │  含义                   │ 对应 ManhuaWorks 步骤
 *  ─────────────────┼─────────────────────────┼──────────────────────────────
 *  pending          │ 已提交未启动            │ (snapshot.status='pending')
 *  running          │ 步骤执行中              │ storyboard/character/scene/
 *                   │                         │   image-gen/tts/video-gen
 *  composing        │ 合成中                  │ compose
 *  done             │ 终态-成功               │ snapshot.status='success'
 *  failed           │ 终态-失败               │ snapshot.status='failed'/'cancelled'
 *
 * 同时 7 步骤 → 进度百分比的近似映射（各步按经验时长加权）：
 *   storyboard 0.10 / character 0.10 / scene 0.10 / image-gen 0.20
 *   tts 0.05 / video-gen 0.30 / compose 0.15  = 1.0
 *
 * 「running + 哪一步在跑」由 snap.steps[*].status 推断。
 */

import type { ToonflowProgressEvent, ToonflowStatus } from "../types/toonflow.js";
import { TOONFLOW_PROGRESS_HINT } from "../types/toonflow.js";
import {
  MANHUA_PIPELINE_STEPS,
  type ManhuaPipelineStep,
  type RunSnapshot,
  type StepResult,
} from "../types/manhua.js";

const STEP_WEIGHT: Record<ManhuaPipelineStep, number> = {
  storyboard: 0.1,
  character: 0.1,
  scene: 0.1,
  "image-gen": 0.2,
  tts: 0.05,
  "video-gen": 0.3,
  compose: 0.15,
};

/** 找出当前正在跑（或最近完成）的步骤 */
function currentStep(snap: RunSnapshot): {
  step: ManhuaPipelineStep;
  state: "running" | "success" | "failed" | "skipped" | "pending";
} {
  for (const name of MANHUA_PIPELINE_STEPS) {
    const s: StepResult | undefined = snap.steps[name];
    if (!s) continue;
    if (s.status === "running") return { step: name, state: "running" };
  }
  // 没在跑就找最近一个
  for (let i = MANHUA_PIPELINE_STEPS.length - 1; i >= 0; i--) {
    const name = MANHUA_PIPELINE_STEPS[i]!;
    const s = snap.steps[name];
    if (!s) continue;
    if (s.status === "success" || s.status === "failed" || s.status === "skipped") {
      return { step: name, state: s.status };
    }
  }
  return { step: "storyboard", state: "pending" };
}

/** snap → toonflow status */
export function mapSnapToToonflowStatus(snap: RunSnapshot): ToonflowStatus {
  switch (snap.status) {
    case "pending":
      return "pending";
    case "running": {
      const compose = snap.steps["compose"];
      if (compose && (compose.status === "running" || compose.status === "success")) {
        return "composing";
      }
      return "running";
    }
    case "success":
      return "done";
    case "failed":
    case "cancelled":
      return "failed";
  }
}

/** snap → 进度百分比（0-100）*/
export function mapSnapToProgress(snap: RunSnapshot): number {
  const status = mapSnapToToonflowStatus(snap);
  if (status === "done") return 100;
  if (status === "failed") return -1;
  if (status === "pending") return 0;

  // running / composing：按完成步骤累加权重
  let acc = 0;
  for (const name of MANHUA_PIPELINE_STEPS) {
    const s = snap.steps[name];
    if (!s) continue;
    if (s.status === "success") {
      acc += STEP_WEIGHT[name];
    } else if (s.status === "running") {
      // 当前步骤按 50% 算
      acc += STEP_WEIGHT[name] * 0.5;
      break;
    } else if (s.status === "failed" || s.status === "skipped") {
      // 失败/跳过，权重清零（不计入已完成）
      break;
    } else {
      // pending：未开始
      break;
    }
  }
  return Math.min(99, Math.round(acc * 100));
}

/** 完整事件：snap → ToonflowProgressEvent */
export function mapSnapToToonflowEvent(
  jobId: string,
  workflowId: string,
  snap: RunSnapshot,
): ToonflowProgressEvent {
  const status = mapSnapToToonflowStatus(snap);
  const progress = mapSnapToProgress(snap);
  const { step } = currentStep(snap);
  return {
    jobId,
    workflowId,
    status,
    progress,
    currentNodeId: step,
    message: status === "failed" ? snap.error : undefined,
    ts: Date.now(),
  };
}

/** 反向工具：Toonflow 状态 → 字面 fallback（极少用，留给单元测试） */
export function toonflowStatusHint(s: ToonflowStatus): number {
  return TOONFLOW_PROGRESS_HINT[s];
}
