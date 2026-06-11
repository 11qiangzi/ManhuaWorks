/**
 * ai-router HTTP 客户端
 * 统一封装 chat/embeddings/image/video 4 类调用，附带超时与错误归一化。
 */

import { config } from "../config.js";

export type RouteStrategy = "cost" | "speed" | "quality" | "failover";
export type ProviderId = "minimax" | "deepseek" | "zhipu" | "volcengine";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  strategy?: RouteStrategy;
  preferredProviders?: ProviderId[];
  useByok?: boolean;
  taskTag?: string;
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: ProviderId;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  cost: number;
  latencyMs: number;
  usedByok: boolean;
}

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

export class RouterClientError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[ai-router ${status} ${endpoint}] ${message}`);
    this.name = "RouterClientError";
  }
}

async function call<T>(endpoint: string, body: unknown, signal: AbortSignal, timeoutMs: number): Promise<T> {
  const url = `${config.aiRouter.url}${endpoint}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  // 外部 signal 透传
  signal.addEventListener("abort", () => ac.abort());

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.auth.apiKey },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new RouterClientError(resp.status, endpoint, text.slice(0, 500));
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof RouterClientError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new RouterClientError(504, endpoint, `timeout after ${timeoutMs}ms`);
    }
    throw new RouterClientError(502, endpoint, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export const aiRouterClient = {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return call<ChatResponse>("/v1/chat", req, signal ?? new AbortController().signal, config.aiRouter.timeoutMs);
  },
  async image(req: ImageRequest, signal?: AbortSignal): Promise<ImageResponse> {
    return call<ImageResponse>("/v1/image", req, signal ?? new AbortController().signal, config.aiRouter.timeoutMs);
  },
  async video(req: VideoRequest, signal?: AbortSignal): Promise<VideoResponse> {
    return call<VideoResponse>("/v1/video", req, signal ?? new AbortController().signal, config.aiRouter.timeoutMs);
  },
  async health(): Promise<unknown> {
    const url = `${config.aiRouter.url}/health`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`ai-router health ${resp.status}`);
    return resp.json();
  },
};
