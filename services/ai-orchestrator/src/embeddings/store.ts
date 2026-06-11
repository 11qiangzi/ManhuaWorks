/**
 * VectorStore — 内存向量存储 (L3.F)
 *
 * 用途:
 *   - 给角色一致性检查 (role-consistency.ts) 用作角色库
 *   - 给 RAG / 检索提供最简 topK 查询
 *
 * 设计:
 *   - 内存 (Map) + O(N) 线性扫描
 *   - 不依赖外部数据库 / 文件
 *   - topK 用 partial sort (O(N log K))
 *   - 阈值过滤: score < threshold 直接丢弃
 *
 * 不依赖: any DB / vector index library, 纯 TS.
 */

import type { EmbeddingModel } from "./model.js";

export interface VectorRecord {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
}

export interface SearchHit {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  topK?: number;
  /** 0..1, 低于此分视为不相关. 默认 0.0 (不过滤) */
  threshold?: number;
}

export interface StoreOptions {
  /** 容量上限, 0 = 无限制. 默认 0 */
  maxSize?: number;
}

export const DEFAULT_TOP_K = 5;
export const DEFAULT_MAX_SIZE = 0;

/**
 * VectorStore
 *
 * 关键不变量:
 *   - id 唯一 (重复 add 覆盖)
 *   - 搜索结果按 score 降序
 *   - 不存 null/undefined 记录
 */
export class VectorStore {
  private readonly _records: Map<string, VectorRecord> = new Map();
  private readonly _model: EmbeddingModel;
  private readonly _maxSize: number;

  constructor(model: EmbeddingModel, opts: StoreOptions = {}) {
    this._model = model;
    this._maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
  }

  /** 当前存储条数 */
  size(): number {
    return this._records.size;
  }

  /** 是否空 */
  isEmpty(): boolean {
    return this._records.size === 0;
  }

  /** 清空 */
  clear(): void {
    this._records.clear();
  }

  /** 列出所有 id */
  ids(): string[] {
    return Array.from(this._records.keys());
  }

  /**
   * 添加一条记录.
   * - 内部走 model.embed, 因此 model 必须 load 过
   * - 同 id 重复 add → 覆盖 (含 vector)
   * - 超过 maxSize → 抛错 (不会偷偷丢老数据)
   */
  async add(
    id: string,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError("VectorStore.add: id must be non-empty string");
    }
    if (typeof text !== "string") {
      throw new TypeError("VectorStore.add: text must be string");
    }
    if (
      this._maxSize > 0 &&
      !this._records.has(id) &&
      this._records.size >= this._maxSize
    ) {
      throw new RangeError(
        `VectorStore.add: max size (${this._maxSize}) reached`,
      );
    }
    const vector = await this._model.embed(text);
    this._records.set(id, {
      id,
      vector,
      text,
      metadata: { ...metadata },
    });
  }

  /**
   * 批量 add.
   * 任意一条失败 → 整批回滚 (不写一半)
   */
  async addBatch(
    items: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>,
  ): Promise<void> {
    const snapshot = new Map(this._records);
    try {
      for (const it of items) {
        await this.add(it.id, it.text, it.metadata ?? {});
      }
    } catch (err) {
      // rollback
      this._records.clear();
      for (const [k, v] of snapshot) this._records.set(k, v);
      throw err;
    }
  }

  /** 取一条. 找不到返回 undefined. */
  get(id: string): VectorRecord | undefined {
    const r = this._records.get(id);
    if (!r) return undefined;
    // 返回浅拷贝, 防止外部 mutate
    return {
      id: r.id,
      vector: r.vector.slice(),
      text: r.text,
      metadata: { ...r.metadata },
    };
  }

  /** 是否存在 */
  has(id: string): boolean {
    return this._records.has(id);
  }

  /**
   * 删除一条.
   * 找不到 → 返回 false (不抛)
   */
  remove(id: string): boolean {
    return this._records.delete(id);
  }

  /**
   * 文本搜索: 把 query 走 embed, 然后 topK 检索.
   */
  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    if (typeof query !== "string") {
      throw new TypeError("VectorStore.search: query must be string");
    }
    const qv = await this._model.embed(query);
    return this.findSimilar(qv, opts);
  }

  /**
   * 预嵌入向量检索: 直接 topK.
   * 用于外部已经 embed 过的场景.
   */
  findSimilar(embedding: number[], opts: SearchOptions = {}): SearchHit[] {
    if (!Array.isArray(embedding)) {
      throw new TypeError("VectorStore.findSimilar: embedding must be number[]");
    }
    if (embedding.length !== this._model.dim) {
      throw new RangeError(
        `VectorStore.findSimilar: embedding dim ${embedding.length} != model dim ${this._model.dim}`,
      );
    }
    const topK = opts.topK ?? DEFAULT_TOP_K;
    if (topK <= 0) return [];
    const threshold = opts.threshold ?? 0;

    // 全量打分
    const scored: SearchHit[] = [];
    for (const rec of this._records.values()) {
      const score = this._model.cosineSimilarity(embedding, rec.vector);
      if (score >= threshold) {
        scored.push({
          id: rec.id,
          text: rec.text,
          score,
          metadata: { ...rec.metadata },
        });
      }
    }

    // partial sort: 降序取前 topK
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
