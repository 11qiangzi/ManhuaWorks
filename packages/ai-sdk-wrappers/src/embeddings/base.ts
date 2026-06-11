/**
 * 嵌入模型统一接口
 *
 * 所有 EmbeddingProvider 必须实现 embed（单文本）/ embedBatch（批量）
 * 统一输出 number[]（384/768/1024/1536/3072 维由具体实现决定）。
 */

export interface EmbeddingVector {
  /** 浮点向量，维度由模型决定 */
  values: number[];
  /** 实际维度 */
  dim: number;
  /** 来源 provider id */
  provider: string;
  /** 模型标识 */
  model: string;
  /** 输入文本（截断前），便于审计 */
  text: string;
}

export interface EmbeddingOptions {
  /** 批处理大小，默认 32 */
  batchSize?: number;
  /** 是否归一化（L2 norm = 1），默认 true */
  normalize?: boolean;
  /** 截断长度（token 近似），超出截断 */
  maxLength?: number;
  /** 透传 provider 自定义参数 */
  extra?: Record<string, unknown>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dim: number;

  embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingVector>;
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingVector[]>;
}

export class EmbeddingError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause: unknown,
    message?: string,
  ) {
    super(message ?? `Embedding provider [${provider}] failed: ${String(cause)}`);
    this.name = 'EmbeddingError';
  }
}
