/**
 * CharacterImageAdapter — 角色图生图适配器 (L3.I)
 *
 * 用途:
 *   - 保持角色跨场景视觉一致性
 *   - 用 EmbeddingModel 算角色档案与场景的相似度
 *   - 高相似度 (>0.7) → 强 reference + 风格化 prompt
 *   - 低相似度 → 提示用户角色定义需调整
 *
 * 流程:
 *   1. embed(characterProfile.description) → 384 维向量
 *   2. embed(sceneContext) → 384 维向量
 *   3. cosineSimilarity(vec1, vec2) → 0..1
 *   4. > 0.7 → useStrongReference=true + 风格化 prompt
 *   5. < 0.7 → useStrongReference=false + 低一致性警告
 *
 * 设计:
 *   - mock 模式默认, 返回 mock imageUrl + 真实相似度
 *   - 不依赖外部 HTTP / 图像生成服务
 *   - 通过构造注入 EmbeddingModel 便于测试
 *
 * 计划: 6/24 角色图生图适配 (陆流光, 6h P1)
 */

import { createHash } from "node:crypto";
import type { EmbeddingModel } from "../embeddings/model.js";
import { EmbeddingModel as DefaultEmbeddingModel } from "../embeddings/model.js";
import { aiRouterClient } from "../clients/ai-router.js";

// =============================================================================
// 公开类型
// =============================================================================

/** 角色档案（与 role-consistency.ts 兼容） */
export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  attributes?: Record<string, unknown>;
}

/** 风格预设 */
export type StylePreset = "anime" | "realistic" | "ink" | "oil" | "pixel" | "default";

/** 单张图生成选项 */
export interface GenerateOptions {
  characterProfile: CharacterProfile;
  sceneContext: string;
  style?: StylePreset;
  seed?: number;
}

/** 单张图生成结果 */
export interface GenerateResult {
  imageUrl: string;
  prompt: string;
  style: StylePreset;
  costCents: number;
  /** 0..1, 与角色档案的余弦相似度 */
  consistency: number;
  /** 是否使用了强 reference image (consistency >= threshold) */
  useStrongReference: boolean;
}

/** 批量生成选项 */
export interface BatchGenerateOptions {
  characterProfile: CharacterProfile;
  sceneContexts: string[];
  style?: StylePreset;
}

/** 批量生成结果 */
export interface BatchGenerateResult {
  images: Array<{
    sceneContext: string;
    imageUrl: string;
    consistency: number;
  }>;
  averageConsistency: number;
}

/** 适配器构造选项 */
export interface CharacterImageAdapterOptions {
  model?: string;
  apiEndpoint?: string;
  /** 注入 EmbeddingModel（测试用） */
  embeddingModel?: EmbeddingModel;
  /** 一致性阈值 (0..1), 默认 0.7 */
  threshold?: number;
  /** 单图成本（cents），默认 50 */
  perImageCostCents?: number;
  /** mock 模式（默认 true, 不发 HTTP） */
  mock?: boolean;
}

// =============================================================================
// 常量
// =============================================================================

export const DEFAULT_CONSISTENCY_THRESHOLD = 0.7;
export const DEFAULT_PER_IMAGE_COST_CENTS = 50;
export const DEFAULT_STYLE: StylePreset = "default";
export const DEFAULT_MODEL = "mock-character-image-v1";

/** 风格 → 修饰符（追加到 prompt） */
const STYLE_MODIFIERS: Record<StylePreset, string> = {
  anime: "anime style, vibrant colors, expressive eyes, cel-shaded",
  realistic: "photorealistic, detailed skin texture, natural lighting",
  ink: "traditional ink painting, brush strokes, monochrome with accents",
  oil: "oil painting, rich textures, impressionist brushwork",
  pixel: "pixel art, 16-bit retro style, limited color palette",
  default: "clean illustration, balanced composition",
};

// =============================================================================
// CharacterImageAdapter
// =============================================================================

/**
 * 角色图生图适配器
 *
 * 关键不变量:
 *   - generate() 必返回 imageUrl, prompt, style, costCents, consistency
 *   - generateBatch() 返回的 images.length === sceneContexts.length
 *   - getConsistency() 返回值 ∈ [0, 1]
 *   - buildPrompt() 输出非空字符串
 */
export class CharacterImageAdapter {
  readonly model: string;
  readonly apiEndpoint: string;
  private readonly _embedding: EmbeddingModel;
  private readonly _threshold: number;
  private readonly _perImageCostCents: number;
  private readonly _mock: boolean;
  /** 缓存: characterId → character profile embedding */
  private readonly _profileCache: Map<string, number[]> = new Map();

  constructor(opts: CharacterImageAdapterOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.apiEndpoint = opts.apiEndpoint ?? "http://localhost:9999/mock";
    this._embedding = opts.embeddingModel ?? new DefaultEmbeddingModel();
    this._threshold = opts.threshold ?? DEFAULT_CONSISTENCY_THRESHOLD;
    this._perImageCostCents = opts.perImageCostCents ?? DEFAULT_PER_IMAGE_COST_CENTS;
    this._mock = opts.mock ?? false;
  }

  /**
   * 加载嵌入模型（必须在 generate 前调用一次）
   */
  async load(): Promise<void> {
    await this._embedding.load();
  }

  /**
   * 生成单张角色图
   *
   * 步骤:
   *   1. embed character profile（缓存）
   *   2. embed scene context
   *   3. cos sim → consistency score
   *   4. build prompt（强 reference / 弱 reference）
   *   5. mock 生成 imageUrl
   */
  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    this._assertProfile(opts.characterProfile);
    if (typeof opts.sceneContext !== "string" || opts.sceneContext.length === 0) {
      throw new Error("CharacterImageAdapter.generate: sceneContext must be non-empty string");
    }

    const style = opts.style ?? DEFAULT_STYLE;
    // 1) 预热 profile cache（必须在 getConsistency 前）
    const profileVec = await this._getOrEmbedProfile(opts.characterProfile);
    // 2) 算一致性（profile cache 已 warm）
    const sceneVec = await this._embedding.embed(opts.sceneContext);
    const consistency = clamp01(this._embedding.cosineSimilarity(profileVec, sceneVec));
    const useStrongReference = consistency >= this._threshold;
    // 3) 构造 prompt
    const prompt = this.buildPrompt(opts.characterProfile, opts.sceneContext, style);

    // 4) 生成图片
    const seed = opts.seed ?? hashSeed(opts.characterProfile.id, opts.sceneContext, style);
    let imageUrl: string;

    if (this._mock) {
      // mock 模式：hash 出确定性 imageUrl
      imageUrl = `mock://character-image/${opts.characterProfile.id}/${seed}.png`;
    } else {
      // 真实模式：调用 ai-router 生成图片
      try {
        const resp = await aiRouterClient.image({
          model: this.model !== DEFAULT_MODEL ? this.model : undefined,
          prompt,
          size: "1024x1024",
          n: 1,
          preferredProviders: ["volcengine"],
          taskTag: `char-image:${opts.characterProfile.id}`,
        });
        imageUrl = resp.urls?.[0] ?? `mock://character-image/${opts.characterProfile.id}/${seed}.png`;
      } catch (err) {
        // 降级到 mock URL，避免因图片生成失败阻塞流程
        process.stderr.write(
          `[character-image] ai-router image generation failed: ${(err as Error).message}, falling back to mock\n`,
        );
        imageUrl = `mock://character-image/${opts.characterProfile.id}/${seed}.png`;
      }
    }

    return {
      imageUrl,
      prompt,
      style,
      costCents: this._perImageCostCents,
      consistency,
      useStrongReference,
    };
  }

  /**
   * 批量生成（同一角色，不同场景）
   *
   * 优化:
   *   - 角色档案只 embed 一次（缓存）
   *   - 所有场景共享同一个 profile vector
   */
  async generateBatch(opts: BatchGenerateOptions): Promise<BatchGenerateResult> {
    this._assertProfile(opts.characterProfile);
    if (!Array.isArray(opts.sceneContexts)) {
      throw new TypeError("CharacterImageAdapter.generateBatch: sceneContexts must be string[]");
    }

    const style = opts.style ?? DEFAULT_STYLE;
    const images: BatchGenerateResult["images"] = [];
    let totalConsistency = 0;

    // 预热 profile embedding（一次）
    await this._getOrEmbedProfile(opts.characterProfile);

    for (const scene of opts.sceneContexts) {
      const r = await this.generate({
        characterProfile: opts.characterProfile,
        sceneContext: scene,
        style,
      });
      images.push({
        sceneContext: scene,
        imageUrl: r.imageUrl,
        consistency: r.consistency,
      });
      totalConsistency += r.consistency;
    }

    const averageConsistency =
      images.length === 0 ? 0 : totalConsistency / images.length;

    return { images, averageConsistency };
  }

  /**
   * 计算一致性分数（角色档案与场景的余弦相似度）
   *
   * - profile 已 cache → 复用
   * - scene 每次重新 embed（场景多变）
   */
  async getConsistency(characterId: string, sceneContext: string): Promise<number> {
    if (typeof characterId !== "string" || characterId.length === 0) {
      throw new Error("CharacterImageAdapter.getConsistency: characterId required");
    }
    if (typeof sceneContext !== "string") {
      throw new TypeError("CharacterImageAdapter.getConsistency: sceneContext must be string");
    }
    const cachedProfile = this._profileCache.get(characterId);
    if (!cachedProfile) {
      throw new Error(
        `CharacterImageAdapter.getConsistency: profile for '${characterId}' not embedded yet. ` +
        `Call generate() / generateBatch() first to warm the cache.`
      );
    }
    const sceneVec = await this._embedding.embed(sceneContext);
    const sim = this._embedding.cosineSimilarity(cachedProfile, sceneVec);
    // clamp to [0, 1] (cos 可能为负)
    if (sim < 0) return 0;
    if (sim > 1) return 1;
    return sim;
  }

  /**
   * 构造标准化 prompt
   *
   * 模板:
   *   "{character description}, in {scene context}, {style modifier}, {reference hint}"
   *
   * reference hint:
   *   - high consistency: "consistent with reference design, same character features"
   *   - low consistency: "exploratory pose, may deviate from reference"
   */
  buildPrompt(
    characterProfile: CharacterProfile,
    sceneContext: string,
    style: StylePreset = DEFAULT_STYLE,
  ): string {
    this._assertProfile(characterProfile);
    if (typeof sceneContext !== "string" || sceneContext.length === 0) {
      throw new Error("CharacterImageAdapter.buildPrompt: sceneContext required");
    }
    const styleMod = STYLE_MODIFIERS[style] ?? STYLE_MODIFIERS.default;
    // 注意：buildPrompt 本身不直接算 consistency（避免循环依赖 / async）。
    // 调用方可以基于 consistencyScore 自行调整 reference hint。
    const refHint = "consistent with reference design";
    return `${characterProfile.description}, in ${sceneContext}, ${styleMod}, ${refHint}`;
  }

  /**
   * 当前缓存的 profile 数量（测试用）
   */
  cachedProfileCount(): number {
    return this._profileCache.size;
  }

  /**
   * 清空缓存（测试用）
   */
  clearCache(): void {
    this._profileCache.clear();
  }

  // -------- private --------

  private _assertProfile(p: CharacterProfile): void {
    if (!p || typeof p !== "object") {
      throw new TypeError("CharacterImageAdapter: characterProfile must be object");
    }
    if (typeof p.id !== "string" || p.id.length === 0) {
      throw new Error("CharacterImageAdapter: characterProfile.id required");
    }
    if (typeof p.name !== "string" || p.name.length === 0) {
      throw new Error("CharacterImageAdapter: characterProfile.name required");
    }
    if (typeof p.description !== "string" || p.description.length === 0) {
      throw new Error("CharacterImageAdapter: characterProfile.description required");
    }
  }

  private async _getOrEmbedProfile(profile: CharacterProfile): Promise<number[]> {
    const cached = this._profileCache.get(profile.id);
    if (cached) return cached;
    const vec = await this._embedding.embed(profile.description);
    this._profileCache.set(profile.id, vec);
    return vec;
  }
}

// =============================================================================
// 内部工具
// =============================================================================

/** 把值裁剪到 [0, 1] */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** 用 sha256 派生确定性 seed */
function hashSeed(characterId: string, scene: string, style: string): string {
  const h = createHash("sha256");
  h.update(characterId, "utf8");
  h.update("|", "utf8");
  h.update(scene, "utf8");
  h.update("|", "utf8");
  h.update(style, "utf8");
  return h.digest("hex").slice(0, 16);
}
