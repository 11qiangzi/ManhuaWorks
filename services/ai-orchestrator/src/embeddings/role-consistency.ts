/**
 * RoleConsistencyChecker — 角色一致性检查 (L3.F 核心)
 *
 * 用途:
 *   - 漫剧生成时, 校验新生成的对话/动作是否与角色画像一致
 *   - 检测角色"漂移": 历史段落相似度 < threshold → 视为漂移
 *
 * 设计:
 *   - 角色画像 description 一次性 embed 存进 VectorStore
 *   - checkConsistency:
 *       - 指定 characterId: 算 newText vs 角色画像 cos
 *       - 不指定: 在角色库 topK 检索, 命中即"最像该角色"
 *   - findDrift:
 *       - 用角色历史描述的均值 embedding 作为 baseline
 *       - 新文本 cos < threshold 视为漂移
 *
 * 不依赖: any external service.
 */

import type { EmbeddingModel } from "./model.js";
import type { VectorStore } from "./store.js";

export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  attributes?: Record<string, unknown>;
  /** 可选外部传入, 否则从 description 自动 embed */
  embedding?: number[];
}

export interface MatchedCharacter {
  id: string;
  name: string;
  score: number;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  /** 0..1, 越高越一致 */
  score: number;
  /** 命中时附带 */
  matchedCharacter?: MatchedCharacter;
}

export interface DriftResult {
  drifted: boolean;
  /** 当前文本与 baseline 的 cos */
  score: number;
  /** baseline 的平均 cos (历史一致性参考) */
  historyAvg: number;
}

export interface ConsistencyOptions {
  characterId?: string;
  topK?: number;
  /** 0..1, 默认 0.7 */
  threshold?: number;
}

export const DEFAULT_CONSISTENCY_THRESHOLD = 0.7;
export const DEFAULT_DRIFT_THRESHOLD = 0.7;
export const DEFAULT_TOP_K = 3;

/**
 * RoleConsistencyChecker
 *
 * 关键不变量:
 *   - 同 id 第二次 addCharacter → 覆盖
 *   - checkConsistency 返回值包含至少 score 字段
 *   - findDrift 的 historyAvg ∈ [0, 1]
 */
export class RoleConsistencyChecker {
  private readonly _model: EmbeddingModel;
  private readonly _store: VectorStore;
  /** 存 attributes 全文, store 只存 description */
  private readonly _profiles: Map<string, CharacterProfile> = new Map();
  /** 角色的历史描述累积, 用于 findDrift 计算 baseline */
  private readonly _history: Map<string, string[]> = new Map();

  constructor(model: EmbeddingModel, store: VectorStore) {
    this._model = model;
    this._store = store;
  }

  /**
   * 添加/更新一个角色.
   * 内部: 走 model.embed + store.add.
   * 同 id 二次调用: 覆盖 (含 attributes / description / history 重置? 不重置)
   */
  async addCharacter(profile: CharacterProfile): Promise<void> {
    if (!profile || typeof profile.id !== "string" || profile.id.length === 0) {
      throw new TypeError("addCharacter: profile.id must be non-empty string");
    }
    if (typeof profile.name !== "string") {
      throw new TypeError("addCharacter: profile.name must be string");
    }
    if (typeof profile.description !== "string") {
      throw new TypeError("addCharacter: profile.description must be string");
    }
    // 优先用传入的 embedding, 否则走 model
    const embedding = profile.embedding ?? (await this._model.embed(profile.description));
    if (!Array.isArray(embedding) || embedding.length !== this._model.dim) {
      throw new RangeError(
        `addCharacter: embedding dim ${embedding.length} != model dim ${this._model.dim}`,
      );
    }
    this._profiles.set(profile.id, { ...profile, embedding: embedding.slice() });
    await this._store.add(profile.id, profile.description, {
      kind: "character",
      name: profile.name,
    });
  }

  /**
   * 取角色. 找不到返回 undefined.
   * 返回浅拷贝, embedding 不可被外部 mutate.
   */
  getCharacter(id: string): CharacterProfile | undefined {
    const p = this._profiles.get(id);
    if (!p) return undefined;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      attributes: p.attributes ? { ...p.attributes } : undefined,
      embedding: p.embedding ? p.embedding.slice() : undefined,
    };
  }

  /** 列出所有角色 id */
  listCharacters(): string[] {
    return Array.from(this._profiles.keys());
  }

  /** 角色数量 */
  characterCount(): number {
    return this._profiles.size;
  }

  /**
   * 删除角色.
   */
  removeCharacter(id: string): boolean {
    this._store.remove(id);
    this._history.delete(id);
    return this._profiles.delete(id);
  }

  /**
   * 推入一条角色历史 (用于 findDrift).
   */
  recordHistory(characterId: string, text: string): void {
    if (typeof text !== "string" || text.length === 0) return;
    if (!this._history.has(characterId)) this._history.set(characterId, []);
    this._history.get(characterId)!.push(text);
  }

  /**
   * 角色历史条数.
   */
  historyCount(characterId: string): number {
    return this._history.get(characterId)?.length ?? 0;
  }

  /**
   * 检查一致性.
   *
   * - opts.characterId: 直接算 vs 指定角色
   * - 不给: topK 检索, 取最像的
   *
   * 返回 score = cos(newText, 命中角色 description).
   * isConsistent = score >= threshold (默认 0.7).
   */
  async checkConsistency(
    newText: string,
    opts: ConsistencyOptions = {},
  ): Promise<ConsistencyResult> {
    if (typeof newText !== "string") {
      throw new TypeError("checkConsistency: newText must be string");
    }
    if (this._profiles.size === 0) {
      return { isConsistent: false, score: 0 };
    }
    const threshold = opts.threshold ?? DEFAULT_CONSISTENCY_THRESHOLD;
    const qv = await this._model.embed(newText);

    if (opts.characterId) {
      const profile = this._profiles.get(opts.characterId);
      if (!profile || !profile.embedding) {
        return { isConsistent: false, score: 0 };
      }
      const score = this._model.cosineSimilarity(qv, profile.embedding);
      return {
        isConsistent: score >= threshold,
        score,
        matchedCharacter: {
          id: profile.id,
          name: profile.name,
          score,
        },
      };
    }

    // 不指定 characterId → topK 检索
    const topK = opts.topK ?? DEFAULT_TOP_K;
    const hits = this._store.findSimilar(qv, { topK, threshold: 0 });
    if (hits.length === 0) {
      return { isConsistent: false, score: 0 };
    }
    const top = hits[0]!;
    const matched = this._profiles.get(top.id);
    if (!matched) {
      return { isConsistent: false, score: top.score };
    }
    return {
      isConsistent: top.score >= threshold,
      score: top.score,
      matchedCharacter: {
        id: matched.id,
        name: matched.name,
        score: top.score,
      },
    };
  }

  /**
   * 漂移检测.
   *
   * 拿历史片段的平均 embedding 当 baseline, 算 text vs baseline 的 cos.
   * historyAvg = baseline 内部各历史片段的 cos 均值.
   * score < threshold → drifted.
   */
  async findDrift(
    text: string,
    characterId: string,
    threshold: number = DEFAULT_DRIFT_THRESHOLD,
  ): Promise<DriftResult> {
    if (typeof text !== "string") {
      throw new TypeError("findDrift: text must be string");
    }
    if (!this._profiles.has(characterId)) {
      return { drifted: true, score: 0, historyAvg: 0 };
    }
    const hist = this._history.get(characterId) ?? [];
    if (hist.length === 0) {
      // 没有历史 → 没法做漂移检测, 视作不漂移
      return { drifted: false, score: 1, historyAvg: 1 };
    }
    // 平均 embedding
    const histVecs: number[][] = [];
    for (const h of hist) {
      histVecs.push(await this._model.embed(h));
    }
    const dim = this._model.dim;
    const baseline = new Array<number>(dim).fill(0);
    for (const v of histVecs) {
      for (let i = 0; i < dim; i++) baseline[i]! += v[i]!;
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      baseline[i] = baseline[i]! / histVecs.length;
      norm += baseline[i]! * baseline[i]!;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) baseline[i] = baseline[i]! / norm;

    // 算 text vs baseline
    const tv = await this._model.embed(text);
    const score = this._model.cosineSimilarity(tv, baseline);

    // historyAvg: 各历史片段两两 cos 的平均 (用 baseline 当中心)
    let historySum = 0;
    for (const v of histVecs) {
      historySum += this._model.cosineSimilarity(v, baseline);
    }
    const historyAvg = historySum / histVecs.length;

    return {
      drifted: score < threshold,
      score,
      historyAvg,
    };
  }
}
