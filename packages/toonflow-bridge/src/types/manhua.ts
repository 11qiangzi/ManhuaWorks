/**
 * ManhuaWorks 端类型 —— 镜像自 ai-orchestrator（W3/W4 已交付）。
 *
 * 复用策略说明：
 *   - 任务要求「复用 ai-orchestrator 类型（不重写）」
 *   - 当前 ai-orchestrator 的 src/index.ts 尚未 re-export 类型（其 main 指向
 *     dist/index.js 也没有 declaration 输出），从子路径 import 不可靠
 *   - 因此本文件采用「同步镜像」策略：字段名 / 字段顺序 / 字段类型与
 *     services/ai-orchestrator/src/pipeline-runner.ts + cost-tracker.ts
 *     + pipelines/novel-to-drama.ts 严格一致
 *   - 后续 W6 修复 ai-orchestrator exports（加 `export type` 块 + declaration
 *     输出）后，本文件改为 `export type { ... } from "@manhuaworks/ai-orchestrator"`,
 *     即可实现真正的零拷贝复用
 *
 * 「7 步骤」是 ai-orchestrator 中 novel-to-drama pipeline 的固定步骤名。
 * 详见 src/adapters/progress.ts 的映射表。
 */

// ---- 与 ai-orchestrator/src/middleware/auth.ts 同步 ----
export type UserTier = "guest" | "free" | "pro" | "business" | "enterprise";

export interface AuthUser {
  userId: string;
  tier: UserTier;
  byokEnabled?: boolean;
}

// ---- 与 ai-orchestrator/src/clients/workflow.ts 同步 ----
export type StoryType =
  | "sweet_romance_novel"
  | "urban_fantasy"
  | "wuxia_martial"
  | "scifi_mecha"
  | "school_life"
  | "mystery_suspense"
  | "isekai";

export type ArtStyle =
  | "anime"
  | "manhua_chinese"
  | "realistic_3d"
  | "watercolor"
  | "pixel"
  | "ink_painting"
  | "comic_western";

// ---- 与 ai-orchestrator/src/cost-tracker.ts 同步 ----
export interface CostSummary {
  totalCostUsd: number;
  totalLatencyMs: number;
  stepCount: number;
  byProvider: Record<string, number>;
  byStep: Record<string, number>;
  byokCostUsd: number;
  platformCostUsd: number;
}

// ---- 与 ai-orchestrator/src/pipeline-runner.ts 同步 ----
export type RunStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface StepResult {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  outputs?: Record<string, unknown>;
  error?: string;
  costUsd: number;
  latencyMs: number;
  startedAt: number;
  finishedAt?: number;
  attempt: number;
}

export interface RunSnapshot {
  runId: string;
  pipeline: string;
  userId: string;
  tier: UserTier;
  status: RunStatus;
  inputs: Record<string, unknown>;
  steps: Record<string, StepResult>;
  costSummary: CostSummary;
  createdAt: number;
  updatedAt: number;
  quotaPolicy: unknown;
  quotaDenial?: { reason: string; detail: string };
  error?: string;
}

// ---- 与 ai-orchestrator/src/pipelines/novel-to-drama.ts 同步 ----
export interface NovelToDramaInput {
  text: string;
  storyType?: StoryType;
  artStyle?: ArtStyle;
  chapterTitle?: string;
  durationSeconds?: number;
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  projectId?: string;
}

export interface NovelToDramaOutput {
  storyboardRunId: string;
  characterRunId: string;
  imageRunIds: string[];
  ttsRunId: string;
  videoRunIds: string[];
  composeRunId?: string;
  finalVideoUrl?: string;
  totalCostUsd: number;
  totalLatencyMs: number;
  imageUrls: string[];
  videoUrls: string[];
  audioUrl?: string;
}

/** ManhuaWorks 端 7 步骤的固定名（来自 novel-to-drama pipeline） */
export const MANHUA_PIPELINE_STEPS = [
  "storyboard",
  "character",
  "scene",
  "image-gen",
  "tts",
  "video-gen",
  "compose",
] as const;

export type ManhuaPipelineStep = (typeof MANHUA_PIPELINE_STEPS)[number];

export const MANHUA_PIPELINE_NAME = "novel-to-drama" as const;
