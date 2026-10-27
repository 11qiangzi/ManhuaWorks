/**
 * 共享工作流类型 — studio + ai-orchestrator 共用
 * L3.C 任务（工作流节点执行引擎 + studio UI 接入）
 *
 * 设计原则：
 *   - 与 studio 现有 types/workflow.ts 解耦：这套是"引擎契约"，studio
 *     的 types/workflow.ts 是"画布 UI 模型"（带端口/分类等 UI 概念）。
 *   - 引擎只关心节点 id/type/params/dependsOn 即可渲染执行图。
 */

// =============================================================================
// 节点类型枚举（6 种 pipeline 节点 — 全部对应 ai-orchestrator 的 6 个 pipeline）
// =============================================================================

export type NodeType =
  | "translate"
  | "character-replace"
  | "episode-batch"
  | "style-transfer"
  | "novel-to-drama"
  | "multi-character"
  | "decompose"
  | "compose-video";

/** 8 个 NodeType 列表（用于 UI 调色板/校验） */
export const NODE_TYPES: ReadonlyArray<NodeType> = [
  "translate",
  "character-replace",
  "episode-batch",
  "style-transfer",
  "novel-to-drama",
  "multi-character",
  "decompose",
  "compose-video",
] as const;

/** NodeType → 友好 label（中文） */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  translate: "自动翻译",
  "character-replace": "角色替换",
  "episode-batch": "分集批处理",
  "style-transfer": "风格迁移",
  "novel-to-drama": "小说转漫剧",
  "multi-character": "多角色替换",
  decompose: "小说拆解",
  "compose-video": "视频合成",
};

/** NodeType → 主题色 token */
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  translate: "blue",
  "character-replace": "purple",
  "episode-batch": "cyan",
  "style-transfer": "pink",
  "novel-to-drama": "amber",
  "multi-character": "violet",
  decompose: "emerald",
  "compose-video": "rose",
};

/** NodeType → SVG 图标名（studio UI 查找） */
export const NODE_TYPE_ICONS: Record<NodeType, string> = {
  translate: "translate",
  "character-replace": "character",
  "episode-batch": "batch",
  "style-transfer": "palette",
  "novel-to-drama": "drama",
  "multi-character": "multi",
  decompose: "scissors",
  "compose-video": "film",
};

// =============================================================================
// 节点 / 边 / 工作流
// =============================================================================

export type NodeStatus =
  | "idle"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export interface WorkflowNode {
  /** 节点 id（在 workflow 内唯一） */
  id: string;
  /** 节点类型（决定走哪个 pipeline） */
  type: NodeType;
  /** 节点参数（透传给对应 pipeline 的 Input） */
  params: Record<string, unknown>;
  /** 依赖的节点 id 列表（必须先执行完） */
  dependsOn?: string[];
  /** 显示位置（可选，画布用） */
  position?: { x: number; y: number };
  /** 节点显示名（可选） */
  label?: string;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  /** 可选条件表达式（condition 为 false 的边会被跳过） */
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** ISO 时间戳（毫秒） */
  createdAt?: number;
  updatedAt?: number;
  version?: number;
}

// =============================================================================
// 执行结果
// =============================================================================

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  startedAt?: number;
  finishedAt?: number;
  output?: Record<string, unknown>;
  error?: string;
  attempts: number;
  latencyMs: number;
}

export interface LayerExecutionResult {
  /** 层序号（0 = 最先执行的层） */
  layer: number;
  /** 该层节点结果（key = nodeId） */
  nodes: Record<string, NodeExecutionResult>;
  status: "succeeded" | "partial" | "failed";
  durationMs: number;
}

export type ExecutionStatus = "succeeded" | "partial" | "failed";

export interface ExecutionResult {
  workflowId: string;
  status: ExecutionStatus;
  layers: LayerExecutionResult[];
  durationMs: number;
  failedNodes: string[];
  startedAt: number;
  finishedAt?: number;
  /** 整体错误信息（如 quota 拒绝） */
  error?: string;
}
