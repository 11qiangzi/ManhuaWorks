// 共享类型：Provider / Model / Request / Response
// 不依赖任何外部包；所有模块可自由引用。

/** 供应商 ID（字符串字面量） */
export type ProviderId = "minimax" | "deepseek" | "zhipu" | "volcengine";

/** 任务类型 */
export type TaskType = "chat" | "embeddings" | "image" | "video";

/** 路由策略 */
export type RouteStrategy = "cost" | "speed" | "quality" | "failover";

/** 模型能力描述 */
export interface ModelInfo {
  /** 模型 ID（如 M3、v3、glm-4） */
  id: string;
  /** 所属 Provider */
  provider: ProviderId;
  /** 支持的任务类型 */
  capabilities: TaskType[];
  /** 上下文窗口（token） */
  contextWindow: number;
  /** 每千 token 输入成本（美元） */
  costPer1kInput: number;
  /** 每千 token 输出成本（美元） */
  costPer1kOutput: number;
  /** 典型延迟（毫秒，仅作参考） */
  typicalLatencyMs: number;
  /** 质量评分 0-100，越高质量越好 */
  qualityScore: number;
}

/** 聊天消息 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

/** 聊天请求 */
export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  /** 路由策略 */
  strategy?: RouteStrategy;
  /** 用户偏好 Provider（按优先级排序） */
  preferredProviders?: ProviderId[];
  /** 用户是否使用 BYOK（如果未指定，由 BYOK 层决定） */
  useByok?: boolean;
  /** 任务上下文标签，用于日志/统计 */
  taskTag?: string;
}

/** 聊天响应 */
export interface ChatResponse {
  id: string;
  model: string;
  provider: ProviderId;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  latencyMs: number;
  /** 实际是否走了 BYOK */
  usedByok: boolean;
}

/** 嵌入请求 */
export interface EmbeddingRequest {
  model?: string;
  input: string | string[];
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface EmbeddingResponse {
  model: string;
  provider: ProviderId;
  embeddings: number[][];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
  cost: number;
  latencyMs: number;
  usedByok: boolean;
}

/** 图像请求 */
export interface ImageRequest {
  model?: string;
  prompt: string;
  size?: string;
  n?: number;
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface ImageResponse {
  model: string;
  provider: ProviderId;
  urls: string[];
  cost: number;
  latencyMs: number;
  usedByok: boolean;
}

/** 视频请求 */
export interface VideoRequest {
  model?: string;
  prompt: string;
  durationSeconds?: number;
  resolution?: string;
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface VideoResponse {
  model: string;
  provider: ProviderId;
  url: string;
  cost: number;
  latencyMs: number;
  usedByok: boolean;
}

/** Provider 健康状态 */
export interface ProviderHealth {
  provider: ProviderId;
  healthy: boolean;
  consecutiveFailures: number;
  lastCheckedAt: number;
  lastError?: string;
}

/** Key 摘要（不包含明文） */
export interface KeySummary {
  id: string;
  providerId: ProviderId;
  ownerUserId: string | null; // null 表示平台共享 Key
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
  /** 月用量（USD） */
  monthlyUsageUsd: number;
  /** 是否启用 */
  enabled: boolean;
}

/** 统一错误类型 */
export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    public model: string,
    public status: number,
    message: string,
    public cause?: unknown,
  ) {
    super(`[${provider}:${model}] ${message}`);
    this.name = "ProviderError";
  }
}

/** BYOK 解析结果 */
export interface ByokResolution {
  apiKey: string;
  keyId: string;
  usedByok: boolean;
}
