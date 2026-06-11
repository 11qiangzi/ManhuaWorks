/**
 * 远程嵌入：调 4 家供应商嵌入端点
 *
 * - MiniMax  → embeddings v1
 * - 火山方舟 → multimodal-embedding-v1
 * - 智谱     → embedding-2
 * - DeepSeek → text-embedding（兼容 OpenAI 格式）
 *
 * 不依赖 Node 18+ 之外的运行时；fetch 直接使用。
 */

import type { EmbeddingOptions, EmbeddingProvider, EmbeddingVector } from './base.js';
import { EmbeddingError } from './base.js';

export type RemoteProviderId = 'minimax' | 'volcengine' | 'zhipu' | 'deepseek';

export interface RemoteEmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** 覆盖默认维度（与实际模型对齐） */
  dim?: number;
  /** 请求超时（ms），默认 30000 */
  timeoutMs?: number;
}

export class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly id: RemoteProviderId;
  readonly model: string;
  readonly dim: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(id: RemoteProviderId, config: RemoteEmbeddingConfig) {
    this.id = id;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 30_000;

    const defaults = DEFAULTS[id];
    this.model = config.model ?? defaults.model;
    this.dim = config.dim ?? defaults.dim;
    this.baseUrl = (config.baseUrl ?? defaults.baseUrl).replace(/\/+$/, '');
  }

  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingVector> {
    const [vec] = await this.embedBatch([text], options);
    return vec!;
  }

  async embedBatch(texts: string[], _options: EmbeddingOptions = {}): Promise<EmbeddingVector[]> {
    try {
      const url = `${this.baseUrl}${PATHS[this.id]}`;
      const body = REQUEST_BUILDERS[this.id](this.model, texts);
      const headers = REQUEST_HEADERS[this.id](this.apiKey);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
      }

      const data = (await res.json()) as unknown;
      return PARSERS[this.id](data, texts, this.id, this.model);
    } catch (err) {
      throw new EmbeddingError(this.id, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 4 家供应商差异：baseUrl / 模型 / 维度 / 路径 / 请求构建 / 解析
// ─────────────────────────────────────────────────────────────

interface Defaults {
  baseUrl: string;
  model: string;
  dim: number;
}

const DEFAULTS: Record<RemoteProviderId, Defaults> = {
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'embo-01',
    dim: 1536,
  },
  volcengine: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-embedding-text-240715',
    dim: 1024,
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'embedding-2',
    dim: 1024,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-embed',
    dim: 1024,
  },
};

const PATHS: Record<RemoteProviderId, string> = {
  minimax: '/embeddings',
  volcengine: '/embeddings/multimodal',
  zhipu: '/embeddings',
  deepseek: '/embeddings',
};

function buildOpenAIStyle(model: string, input: string[]): unknown {
  return { model, input };
}

function buildVolcengine(model: string, input: string[]): unknown {
  return {
    model,
    input: input.map((text) => ({ type: 'text', text })),
  };
}

const REQUEST_BUILDERS: Record<RemoteProviderId, (model: string, input: string[]) => unknown> = {
  minimax: buildOpenAIStyle,
  volcengine: buildVolcengine,
  zhipu: buildOpenAIStyle,
  deepseek: buildOpenAIStyle,
};

const REQUEST_HEADERS: Record<RemoteProviderId, (apiKey: string) => Record<string, string>> = {
  minimax: (k) => ({ Authorization: `Bearer ${k}` }),
  volcengine: (k) => ({ Authorization: `Bearer ${k}` }),
  zhipu: (k) => ({ Authorization: `Bearer ${k}` }),
  deepseek: (k) => ({ Authorization: `Bearer ${k}` }),
};

interface EmbeddingItem {
  embedding: number[];
  index?: number;
}

function parseOpenAI(data: unknown, texts: string[], id: string, model: string): EmbeddingVector[] {
  const list = (data as { data: EmbeddingItem[] }).data;
  if (!Array.isArray(list)) {
    throw new Error('Unexpected response shape: missing data[]');
  }
  // 兼容乱序返回：按 index 排序
  const sorted = [...list].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((item, i) => ({
    values: item.embedding,
    dim: item.embedding.length,
    provider: id,
    model,
    text: texts[i] ?? '',
  }));
}

function parseVolcengine(data: unknown, texts: string[], id: string, model: string): EmbeddingVector[] {
  // 火山方舟 multimodal-embedding 返回 { data: { embedding: number[] }[] }
  const list = (data as { data: { embedding: number[] }[] }).data;
  if (!Array.isArray(list)) {
    throw new Error('Unexpected volcengine response shape');
  }
  return list.map((item, i) => ({
    values: item.embedding,
    dim: item.embedding.length,
    provider: id,
    model,
    text: texts[i] ?? '',
  }));
}

const PARSERS: Record<RemoteProviderId, typeof parseOpenAI> = {
  minimax: parseOpenAI,
  volcengine: parseVolcengine,
  zhipu: parseOpenAI,
  deepseek: parseOpenAI,
};

export function createRemoteEmbedding(
  id: RemoteProviderId,
  config: RemoteEmbeddingConfig,
): RemoteEmbeddingProvider {
  return new RemoteEmbeddingProvider(id, config);
}
