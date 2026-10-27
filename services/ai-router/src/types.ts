// 共享类型：Provider / Model / Request / Response
// 不依赖任何外部包；所有模块可自由引用。

/** 供应商 ID（字符串字面量）
 *  派单 16 扩展: 加 qwen / replicate / fal / openai 4 家
 *  注: minimax 在中国市场叫 MiniMax (MiniMax), 是 OpenAI 兼容协议
 */
export type ProviderId =
  | "minimax"
  | "deepseek"
  | "zhipu"
  | "volcengine"
  | "qwen"      // 派单 16 新增: 通义千问 DashScope OpenAI 兼容
  | "replicate" // 派单 16 新增: 图像/视频 HTTP
  | "fal"       // 派单 16 新增: fal.ai Wan2.1 视频 HTTP
  | "openai"    // 派单 16 新增: GPT/DALL-E OpenAI 兼容
  | "agnes";    // Agnes AI: 图片 + 视频生成

/** 任务类型
 *  派单 16 新增: audio (音乐生成)
 */
export type TaskType = "chat" | "embeddings" | "image" | "video" | "audio";

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
  /** 显示名（可选） */
  displayName?: string;
  /** 模型描述 */
  description?: string;
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
  /** 参考图片 URL 数组，用于 image-to-image 风格保持 */
  image?: string[];
  /** 负面提示词，过滤不想要的元素 */
  negativePrompt?: string;
  /** 随机种子，用于可复现生成和角色一致性 */
  seed?: number;
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
  /** 完整 content 数组（优先使用，直传 Seedance API） */
  content?: Array<Record<string, unknown>>;
  /** 首帧图 URL，用于 image-to-video 生成（角色一致性关键） */
  firstFrameUrl?: string;
  /** 尾帧图 URL（可选，控制视频结束画面） */
  lastFrameUrl?: string;
  /** 参考图片 URL 数组 */
  referenceImages?: string[];
  /** 随机种子，用于可复现生成 */
  seed?: number;
  /** 是否生成配套音频 */
  generateAudio?: boolean;
  /** 是否返回尾帧 PNG（用于链式镜头衔接） */
  returnLastFrame?: boolean;
  /** 宽高比 */
  ratio?: string;
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface VideoResponse {
  model: string;
  provider: ProviderId;
  url: string;
  /** 尾帧 PNG URL（当 returnLastFrame=true 时返回） */
  lastFrameUrl?: string;
  cost: number;
  latencyMs: number;
  usedByok: boolean;
}

/** 音频请求（派单 16 新增 - 音乐生成）
 *  注意: 大多数音频生成 API (Suno / MiniMax music / Replicate music) 是异步任务模型
 *  本接口走 **同步阻塞** 调用，内部使用 AbortSignal.timeout 控制最长等待
 */
export interface AudioRequest {
  model?: string;
  prompt: string;
  /** 风格/情绪提示词（可选） */
  style?: string;
  /** 时长 (秒) */
  durationSeconds?: number;
  /** 是否需要歌词 (false = 纯音乐) */
  withLyrics?: boolean;
  /** 自定义歌词（可选） */
  lyrics?: string;
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface AudioResponse {
  model: string;
  provider: ProviderId;
  /** 音频 URL 或 base64 */
  url: string;
  /** 时长 (秒) */
  durationSeconds: number;
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

/* ------------------------------------------------------------------ */
/*                    统一错误类型 (派单 16 增强)                       */
/* ------------------------------------------------------------------ */

/** 通用 provider 错误基类 */
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

/** 401 - 鉴权失败 (key 无效) */
export class AuthError extends ProviderError {
  constructor(provider: ProviderId, model: string, message: string) {
    super(provider, model, 401, message);
    this.name = "AuthError";
  }
}

/** 429 - 限流 */
export class RateLimitError extends ProviderError {
  constructor(provider: ProviderId, model: string, message: string) {
    super(provider, model, 429, message);
    this.name = "RateLimitError";
  }
}

/** 500 - provider 内部错误 */
export class UpstreamError extends ProviderError {
  constructor(provider: ProviderId, model: string, status: number, message: string) {
    super(provider, model, status, message);
    this.name = "UpstreamError";
  }
}

/** 503 - provider 完全不可用 (连续失败熔断) */
export class UpstreamUnavailable extends ProviderError {
  constructor(provider: ProviderId, message: string) {
    super(provider, "*", 503, message);
    this.name = "UpstreamUnavailable";
  }
}

/** 504 - 调用超时 */
export class TimeoutError extends ProviderError {
  constructor(provider: ProviderId, model: string, message: string) {
    super(provider, model, 504, message);
    this.name = "TimeoutError";
  }
}

/** BYOK 解析结果 */
export interface ByokResolution {
  apiKey: string;
  keyId: string;
  usedByok: boolean;
}