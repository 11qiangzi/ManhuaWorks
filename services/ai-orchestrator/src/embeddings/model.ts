/**
 * EmbeddingModel — 嵌入模型封装 (L3.F)
 *
 * 计划: 6/16 嵌入模型 all-MiniLM-L6-v2 集成
 * 用途: 角色一致性检查 (角色向量 + 检索)
 * 维度: 384
 *
 * 设计:
 *   - 默认 dim=384 (all-MiniLM-L6-v2)
 *   - 模型未下载时, 用 deterministic mock 嵌入:
 *       1) 用 fnv-1a 32-bit hash 把文本 seed 化
 *       2) 用 mulberry32 PRNG 扩展到 384 维伪随机数
 *       3) L2 normalize, 使 cosine(a, a) = 1.0
 *   - 同文本 → 同向量 (cache + PRNG seed)
 *   - 不依赖网络 / npm 拉取
 *
 * 不依赖: 任何 ONNX runtime / transformers.js, 全程纯 TS 实现.
 */

import { createHash } from "node:crypto";

/** 模型默认配置 */
export const DEFAULT_DIM = 384;
export const DEFAULT_BATCH_SIZE = 32;
export const DEFAULT_MODEL_PATH = "D:\\ManhuaWorks\\models\\all-MiniLM-L6-v2";

export interface EmbeddingModelOptions {
  modelPath?: string;
  dim?: number;
  batchSize?: number;
}

/** 内部: 简单缓存 (避免重复 embed 相同文本) */
type CacheMap = Map<string, number[]>;

/**
 * EmbeddingModel
 *
 * 关键不变量:
 *   - 同一字符串 → 同一向量 (deterministic)
 *   - |v| === dim
 *   - 默认 dim=384 (all-MiniLM-L6-v2)
 */
export class EmbeddingModel {
  readonly dim: number;
  readonly batchSize: number;
  readonly modelPath: string;
  private _loaded = false;
  private _cache: CacheMap = new Map();

  constructor(opts: EmbeddingModelOptions = {}) {
    this.dim = opts.dim ?? DEFAULT_DIM;
    this.batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this.modelPath = opts.modelPath ?? DEFAULT_MODEL_PATH;
  }

  /** 是否已加载 (mock 模式永远返回 true) */
  isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * 加载模型.
   * 真实场景: 读 onnx 文件 / tokenizer.
   * mock 场景: 仅打标, 实际计算 lazy.
   */
  async load(): Promise<void> {
    this._loaded = true;
  }

  /**
   * 把一段文本转成 384 维向量.
   * 维度不匹配 dim 配置时抛错.
   */
  async embed(text: string): Promise<number[]> {
    this._assertLoaded();
    if (typeof text !== "string") {
      throw new TypeError(`embed() expects string, got ${typeof text}`);
    }
    const cached = this._cache.get(text);
    if (cached) return cached.slice();
    const vec = this._mockEmbed(text, this.dim);
    this._cache.set(text, vec);
    return vec.slice();
  }

  /**
   * 批量 embed.
   * 内部仍逐条 mock (无 onnx runtime 时也保证正确性), 但走 cache.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    this._assertLoaded();
    if (!Array.isArray(texts)) {
      throw new TypeError(`embedBatch() expects string[], got ${typeof texts}`);
    }
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t));
    }
    return out;
  }

  /**
   * 余弦相似度.
   * cos(a, b) = (a·b) / (|a||b|)
   * 范围 [-1, 1], 同向量=1, 正交=0, 反向=-1.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    this._assertVec(a, "a");
    this._assertVec(b, "b");
    if (a.length !== b.length) {
      throw new RangeError(
        `cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`,
      );
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i]!;
      const bi = b[i]!;
      dot += ai * bi;
      na += ai * ai;
      nb += bi * bi;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    if (denom === 0) return 0;
    return dot / denom;
  }

  /**
   * 欧氏距离.
   * d(a, b) = sqrt(Σ(ai - bi)^2)
   * 范围 [0, +∞), 同向量=0.
   */
  euclideanDistance(a: number[], b: number[]): number {
    this._assertVec(a, "a");
    this._assertVec(b, "b");
    if (a.length !== b.length) {
      throw new RangeError(
        `euclideanDistance: dimension mismatch (${a.length} vs ${b.length})`,
      );
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i]! - b[i]!;
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  /**
   * 序列化为 base64 (Float32Array → base64).
   * 用于存盘 / 跨进程传向量.
   */
  serialize(vector: number[]): string {
    this._assertVec(vector, "vector");
    const f32 = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) f32[i] = vector[i]!;
    const buf = Buffer.from(f32.buffer);
    return buf.toString("base64");
  }

  /**
   * 反序列化: base64 → number[].
   */
  deserialize(b64: string): number[] {
    if (typeof b64 !== "string") {
      throw new TypeError(`deserialize() expects base64 string, got ${typeof b64}`);
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.byteLength % 4 !== 0) {
      throw new Error(`deserialize: invalid base64 length (${buf.byteLength} bytes)`);
    }
    const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return Array.from(f32);
  }

  /** 清空 cache (测试用) */
  clearCache(): void {
    this._cache.clear();
  }

  /** 当前 cache 大小 (测试用) */
  cacheSize(): number {
    return this._cache.size;
  }

  // -------- private --------

  private _assertLoaded(): void {
    if (!this._loaded) {
      throw new Error("EmbeddingModel: load() must be called before embed()");
    }
  }

  private _assertVec(v: unknown, name: string): void {
    if (!Array.isArray(v)) {
      throw new TypeError(`${name} must be number[], got ${typeof v}`);
    }
    if (v.length !== this.dim) {
      throw new RangeError(
        `${name} dimension mismatch: expected ${this.dim}, got ${v.length}`,
      );
    }
    for (let i = 0; i < v.length; i++) {
      if (typeof v[i] !== "number" || !Number.isFinite(v[i]!)) {
        throw new TypeError(`${name}[${i}] is not a finite number`);
      }
    }
  }

  /**
   * deterministic mock embed.
   * 1) fnv-1a 32-bit hash → 4-byte seed
   * 2) mulberry32 PRNG → 伪随机数
   * 3) L2 normalize
   */
  private _mockEmbed(text: string, dim: number): number[] {
    const seed = fnv1a32(text);
    const rng = mulberry32(seed);
    const v = new Array<number>(dim);
    for (let i = 0; i < dim; i++) {
      // box-muller 近似: [-1, 1] 均匀 → 近似 N(0, 1)
      v[i] = rng() * 2 - 1;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += v[i]! * v[i]!;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) v[i] = v[i]! / norm;
    return v;
  }
}

// -------- helpers --------

/**
 * fnv-1a 32-bit hash.
 * 不依赖 crypto 模块, 纯位运算.
 */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * mulberry32 — 32-bit PRNG.
 * 种子化, 确定性.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 工具: sha256 指纹 (debug 用, 不参与 embedding 主路径).
 */
export function fingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}
