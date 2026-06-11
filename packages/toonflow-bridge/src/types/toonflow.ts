/**
 * Toonflow 兼容层类型定义
 *
 * 背景：Toonflow 是市面上已有的「小说→漫剧」SaaS，对外契约：
 *   - 输入：ToonflowWorkflow（节点列表 + 边）
 *   - 进度：5 状态（pending / running / composing / done / failed）
 *   - 输出：ToonflowJobResult（含 mp4 URL + 分镜元数据）
 *
 * 本文件 1:1 还原 Toonflow 的对外 JSON 形态，确保桥接层是「透传 + 字段重命名」
 * 而不是字段重定义 —— 与 ai-orchestrator（W4）类型严格隔离。
 */

// ---------- Toonflow 5 状态 ----------
export type ToonflowStatus =
  | "pending"
  | "running"
  | "composing"
  | "done"
  | "failed";

/** 5 状态对应的友好进度（0-100），用于 UI fallback */
export const TOONFLOW_PROGRESS_HINT: Record<ToonflowStatus, number> = {
  pending: 0,
  running: 40,
  composing: 80,
  done: 100,
  failed: -1,
};

// ---------- 节点 / 边（Toonflow 工作流图）----------
export type ToonflowNodeKind =
  | "input_text"
  | "split_chapters"
  | "extract_characters"
  | "generate_storyboard"
  | "image_diffusion"
  | "tts"
  | "video_animate"
  | "compose"
  | "output_mp4";

export interface ToonflowNode {
  id: string;
  kind: ToonflowNodeKind;
  label?: string;
  params?: Record<string, unknown>;
}

export interface ToonflowEdge {
  from: string;
  to: string;
  /** 边上的字段映射（Toonflow 用 port 名） */
  fromPort?: string;
  toPort?: string;
}

export interface ToonflowWorkflow {
  workflowId: string;
  version: string;
  nodes: ToonflowNode[];
  edges: ToonflowEdge[];
  /** 全局默认 prompt 覆盖 */
  defaultPrompt?: string;
  /** 全局默认 L1/L2 角色（Toonflow 概念） */
  characters?: ToonflowCharacter[];
}

export interface ToonflowCharacter {
  name: string;
  description?: string;
  referenceImageUrl?: string;
}

// ---------- 触发（启动一个 run）----------
export interface ToonflowRunRequest {
  workflowId: string;
  /** 入口节点的覆盖参数（一般是 input_text） */
  inputs: {
    text?: string;
    chapterTitle?: string;
    artStyle?: string;
    storyType?: string;
  };
  /** BYOK（Bring Your Own Key）：直接走用户私有 key */
  byok?: {
    imageKey?: string;
    videoKey?: string;
    ttsKey?: string;
  };
  /** 回调：进度推到 Toonflow 自己的服务器（与 ManhuaWorks WS 并存） */
  callbackUrl?: string;
}

// ---------- 进度回调载荷 ----------
export interface ToonflowProgressEvent {
  jobId: string;
  workflowId: string;
  status: ToonflowStatus;
  progress: number;
  currentNodeId?: string;
  message?: string;
  ts: number;
}

// ---------- 输出：与 Toonflow 既有 schema 对齐 ----------
export interface ToonflowShot {
  shotId: string;
  sceneId: string;
  imageUrl: string;
  videoUrl?: string;
  dialogue?: string;
  durationMs: number;
}

export interface ToonflowJobResult {
  jobId: string;
  workflowId: string;
  status: Exclude<ToonflowStatus, "pending" | "running" | "composing">;
  /** 成品 mp4（Toonflow 端的主交付物） */
  finalVideoUrl: string;
  /** 副产物：分镜 / 静帧 / 字幕 */
  shots: ToonflowShot[];
  audioUrl?: string;
  subtitleSrt?: string;
  /** 计费信息（Toonflow 业务字段，USD） */
  costUsd: number;
  totalLatencyMs: number;
  error?: string;
}
