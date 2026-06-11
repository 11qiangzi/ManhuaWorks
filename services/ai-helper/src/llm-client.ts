/**
 * 共享 LLM 客户端
 *
 * 8 个 feature 都通过这个客户端调用 ai-router 的 OpenAI 兼容 chat 接口。
 * 为什么不直接 axios：
 *  - 统一超时 / 错误处理 / 日志格式
 *  - 统一注入 taskTag 便于 ai-router 做成本归因
 *  - 统一 JSON 解析降级（LLM 偶发返回非严格 JSON）
 */

import { config } from './config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCallOptions {
  /** 任务 tag，注入 ai-router 用于成本归因 */
  taskTag?: string;
  /** 覆盖默认 temperature */
  temperature?: number;
  /** 覆盖默认 model */
  model?: string;
  /** 最大 token */
  maxTokens?: number;
  /** 超时 ms */
  timeoutMs?: number;
}

export interface ChatCallResult {
  content: string;
  /** 原始 LLM 响应（如有 provider/model 信息） */
  meta?: {
    model?: string;
    provider?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  };
}

export class LLMError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/** 调一次 chat completion（非流式） */
export async function callChat(
  messages: ChatMessage[],
  options: ChatCallOptions = {}
): Promise<ChatCallResult> {
  const url = `${config.aiRouter.url.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model: options.model ?? config.aiRouter.defaultModel,
    messages,
    temperature: options.temperature ?? config.aiRouter.temperature,
    max_tokens: options.maxTokens,
  };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), options.timeoutMs ?? config.aiRouter.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ai-router 自己的服务间调用由 trustInternalMiddleware 放行；
        // 这里沿用调用方提供的 X-API-Key（如果有），便于按调用方归因。
        ...(options.taskTag ? { 'X-Task-Tag': options.taskTag } : {}),
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    if (!res.ok) {
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text().catch(() => null);
      }
      throw new LLMError(res.status, errBody, `ai-router chat failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      provider?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) {
      throw new LLMError(502, data, 'empty content from ai-router');
    }

    return {
      content,
      meta: {
        model: data.model,
        provider: data.provider,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      },
    };
  } finally {
    clearTimeout(t);
  }
}

/** 尝试从 LLM 输出中提取 JSON（容忍 ```json 围栏、前后杂文本） */
export function extractJson<T = unknown>(raw: string): T {
  // 1) 直接 parse
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* 继续 */
  }

  // 2) 提取 ```json ... ``` 围栏
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* 继续 */
    }
  }

  // 3) 抓取第一个 { ... } 块
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = trimmed.slice(first, last + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* 继续 */
    }
  }

  // 4) 抓取第一个 [ ... ] 块
  const firstArr = trimmed.indexOf('[');
  const lastArr = trimmed.lastIndexOf(']');
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    const candidate = trimmed.slice(firstArr, lastArr + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* 继续 */
    }
  }

  throw new Error('LLM output is not valid JSON');
}

/** 计算 string 字符数（中文友好） */
export function countChars(s: string): number {
  return Array.from(s).length;
}
