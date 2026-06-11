/**
 * CharacterImageAdapter tests — L3.I
 *
 * 覆盖:
 *  1. 单图生成返回完整字段
 *  2. 批量生成 scenes 数量匹配
 *  3. 一致性分数在 [0,1]
 *  4. prompt 构造含角色描述 + 场景 + 风格
 *  5. 嵌入复用 (cache 命中)
 *  6. 低一致性 warning (useStrongReference=false)
 *  7. 批量生成性能 (50 场景 < 5s)
 *  8. 不同风格产出不同 prompt
 *  9. profile 缓存: 第二次 generate 不重 embed
 * 10. 错误: sceneContext 空
 * 11. 错误: characterProfile 缺字段
 * 12. cachedProfileCount / clearCache
 * 13. getConsistency 走缓存但要求 profile 先 warm
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EmbeddingModel } from "../embeddings/model.js";
import {
  CharacterImageAdapter,
  DEFAULT_CONSISTENCY_THRESHOLD,
  DEFAULT_PER_IMAGE_COST_CENTS,
  DEFAULT_STYLE,
  type CharacterProfile,
  type StylePreset,
} from "./character-image.js";

const ALICE: CharacterProfile = {
  id: "alice",
  name: "Alice",
  description: "young woman, long silver hair, blue eyes, white dress, kind smile",
};

const BOB: CharacterProfile = {
  id: "bob",
  name: "Bob",
  description: "tall man, short black hair, brown coat, stern expression",
};

describe("CharacterImageAdapter — construction", () => {
  it("1. default opts: threshold=0.7, cost=50 cents, style=default, mock=true", () => {
    const a = new CharacterImageAdapter();
    expect(a.model).toBe("mock-character-image-v1");
    expect(a.cachedProfileCount()).toBe(0);
    // 阈值/成本常量
    expect(DEFAULT_CONSISTENCY_THRESHOLD).toBe(0.7);
    expect(DEFAULT_PER_IMAGE_COST_CENTS).toBe(50);
    expect(DEFAULT_STYLE).toBe("default");
  });

  it("2. custom opts override defaults", () => {
    const a = new CharacterImageAdapter({
      threshold: 0.85,
      perImageCostCents: 100,
      model: "custom-model-v2",
    });
    expect(a.model).toBe("custom-model-v2");
    // 内部字段不直接导出，但通过行为验证
    // 跑一次 generate 后看 costCents
    return a.load().then(async () => {
      const r = await a.generate({ characterProfile: ALICE, sceneContext: "forest" });
      expect(r.costCents).toBe(100);
    });
  });
});

describe("CharacterImageAdapter — generate (single)", () => {
  let adapter: CharacterImageAdapter;
  let emb: EmbeddingModel;

  beforeEach(async () => {
    emb = new EmbeddingModel();
    await emb.load();
    adapter = new CharacterImageAdapter({ embeddingModel: emb });
    await adapter.load();
  });

  it("3. generate returns full result: imageUrl, prompt, style, costCents, consistency, useStrongReference", async () => {
    const r = await adapter.generate({ characterProfile: ALICE, sceneContext: "standing in a flower garden" });
    expect(r).toMatchObject({
      imageUrl: expect.any(String),
      prompt: expect.any(String),
      style: "default",
      costCents: 50,
      consistency: expect.any(Number),
      useStrongReference: expect.any(Boolean),
    });
    expect(r.imageUrl).toMatch(/^mock:\/\/character-image\/alice\//);
    expect(r.consistency).toBeGreaterThanOrEqual(0);
    expect(r.consistency).toBeLessThanOrEqual(1);
  });

  it("4. generate with style produces different prompt modifier", async () => {
    const rAnime = await adapter.generate({ characterProfile: ALICE, sceneContext: "scene", style: "anime" });
    const rReal = await adapter.generate({ characterProfile: ALICE, sceneContext: "scene", style: "realistic" });
    expect(rAnime.style).toBe("anime");
    expect(rReal.style).toBe("realistic");
    expect(rAnime.prompt).toContain("anime style");
    expect(rReal.prompt).toContain("photorealistic");
    expect(rAnime.prompt).not.toBe(rReal.prompt);
  });

  it("5. generate is deterministic with seed (same inputs → same imageUrl)", async () => {
    const r1 = await adapter.generate({ characterProfile: ALICE, sceneContext: "scene A", seed: 42 });
    const r2 = await adapter.generate({ characterProfile: ALICE, sceneContext: "scene A", seed: 42 });
    expect(r1.imageUrl).toBe(r2.imageUrl);
  });

  it("6. generate throws on empty sceneContext", async () => {
    await expect(adapter.generate({ characterProfile: ALICE, sceneContext: "" }))
      .rejects.toThrow(/sceneContext/);
  });

  it("7. generate throws on missing characterProfile fields", async () => {
    await expect(adapter.generate({ characterProfile: { ...ALICE, description: "" }, sceneContext: "x" }))
      .rejects.toThrow(/description/);
    await expect(adapter.generate({ characterProfile: { ...ALICE, id: "" }, sceneContext: "x" }))
      .rejects.toThrow(/id/);
    await expect(adapter.generate({ characterProfile: { ...ALICE, name: "" }, sceneContext: "x" }))
      .rejects.toThrow(/name/);
  });
});

describe("CharacterImageAdapter — generateBatch", () => {
  let adapter: CharacterImageAdapter;
  let emb: EmbeddingModel;

  beforeEach(async () => {
    emb = new EmbeddingModel();
    await emb.load();
    adapter = new CharacterImageAdapter({ embeddingModel: emb });
    await adapter.load();
  });

  it("8. batch generates one image per scene + averageConsistency", async () => {
    const scenes = ["forest", "castle", "beach", "city", "space station"];
    const r = await adapter.generateBatch({ characterProfile: BOB, sceneContexts: scenes });
    expect(r.images).toHaveLength(5);
    for (const img of r.images) {
      expect(img.sceneContext).toBeTruthy();
      expect(img.imageUrl).toMatch(/^mock:\/\/character-image\/bob\//);
      expect(img.consistency).toBeGreaterThanOrEqual(0);
      expect(img.consistency).toBeLessThanOrEqual(1);
    }
    // averageConsistency ∈ [0,1]
    expect(r.averageConsistency).toBeGreaterThanOrEqual(0);
    expect(r.averageConsistency).toBeLessThanOrEqual(1);
    // 平均值应等于各场景 consistency 的算术平均
    const expectedAvg = r.images.reduce((s, i) => s + i.consistency, 0) / r.images.length;
    expect(r.averageConsistency).toBeCloseTo(expectedAvg, 6);
  });

  it("9. batch performance: 50 scenes < 5s", async () => {
    const scenes = Array.from({ length: 50 }, (_, i) => `scene number ${i} in a fantasy world`);
    const start = Date.now();
    const r = await adapter.generateBatch({ characterProfile: ALICE, sceneContexts: scenes });
    const elapsed = Date.now() - start;
    expect(r.images).toHaveLength(50);
    expect(elapsed).toBeLessThan(5000);
  });

  it("10. batch throws on non-array sceneContexts", async () => {
    await expect(adapter.generateBatch({ characterProfile: ALICE, sceneContexts: "not-array" as unknown as string[] }))
      .rejects.toThrow(/sceneContexts/);
  });
});

describe("CharacterImageAdapter — consistency & cache", () => {
  let adapter: CharacterImageAdapter;
  let emb: EmbeddingModel;

  beforeEach(async () => {
    emb = new EmbeddingModel();
    await emb.load();
    adapter = new CharacterImageAdapter({ embeddingModel: emb, threshold: 0.5 });
    await adapter.load();
  });

  it("11. embedding reuse: profile embedded once, reused across generate calls", async () => {
    // 第一次 generate 触发 embed
    await adapter.generate({ characterProfile: ALICE, sceneContext: "scene 1" });
    expect(adapter.cachedProfileCount()).toBe(1);
    // 第二次同角色 → 命中 cache
    await adapter.generate({ characterProfile: ALICE, sceneContext: "scene 2" });
    expect(adapter.cachedProfileCount()).toBe(1);
    // 不同角色 → 新增
    await adapter.generate({ characterProfile: BOB, sceneContext: "scene 3" });
    expect(adapter.cachedProfileCount()).toBe(2);
  });

  it("12. clearCache empties profile cache", async () => {
    await adapter.generate({ characterProfile: ALICE, sceneContext: "x" });
    expect(adapter.cachedProfileCount()).toBe(1);
    adapter.clearCache();
    expect(adapter.cachedProfileCount()).toBe(0);
  });

  it("13. getConsistency requires warm cache (throws if not embedded)", async () => {
    // 未调用 generate 前
    await expect(adapter.getConsistency("alice", "any scene"))
      .rejects.toThrow(/not embedded/);
    // 调一次 generate 预热
    await adapter.generate({ characterProfile: ALICE, sceneContext: "warmup" });
    // 现在可以调
    const c = await adapter.getConsistency("alice", "another scene");
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("14. low consistency (high threshold) → useStrongReference=false", async () => {
    // 阈值设到 0.99，几乎不可能达成
    const strict = new CharacterImageAdapter({ embeddingModel: emb, threshold: 0.99 });
    await strict.load();
    const r = await strict.generate({ characterProfile: ALICE, sceneContext: "totally different scene" });
    expect(r.useStrongReference).toBe(false);
    // 同一 character，threshold=0 → 必为 true
    const loose = new CharacterImageAdapter({ embeddingModel: emb, threshold: 0 });
    await loose.load();
    const r2 = await loose.generate({ characterProfile: ALICE, sceneContext: "any scene" });
    expect(r2.useStrongReference).toBe(true);
  });
});

describe("CharacterImageAdapter — buildPrompt", () => {
  it("15. buildPrompt includes description + scene + style modifier", () => {
    const adapter = new CharacterImageAdapter();
    const styles: StylePreset[] = ["anime", "realistic", "ink", "oil", "pixel", "default"];
    for (const style of styles) {
      const prompt = adapter.buildPrompt(ALICE, "in a moonlit garden", style);
      expect(prompt).toContain(ALICE.description);
      expect(prompt).toContain("in a moonlit garden");
      expect(prompt.length).toBeGreaterThan(20);
    }
  });

  it("16. buildPrompt different styles produce different strings", () => {
    const adapter = new CharacterImageAdapter();
    const p1 = adapter.buildPrompt(ALICE, "scene", "anime");
    const p2 = adapter.buildPrompt(ALICE, "scene", "ink");
    expect(p1).not.toBe(p2);
  });

  it("17. buildPrompt throws on empty inputs", () => {
    const adapter = new CharacterImageAdapter();
    expect(() => adapter.buildPrompt(ALICE, "")).toThrow(/sceneContext/);
    expect(() => adapter.buildPrompt({ ...ALICE, description: "" }, "x")).toThrow(/description/);
  });
});
