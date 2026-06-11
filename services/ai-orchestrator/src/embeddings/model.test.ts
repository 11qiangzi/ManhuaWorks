/**
 * EmbeddingModel tests — L3.F
 *
 * 覆盖:
 *  1. 构造默认 dim/batch
 *  2. 构造自定义 dim
 *  3. load() 后 isLoaded
 *  4. embed 返回 dim 维
 *  5. embed 确定性 (同文本 → 同向量)
 *  6. embed 不同文本 → 不同向量
 *  7. embed 空串不崩
 *  8. embed unicode 中文
 *  9. embed 未 load 抛错
 * 10. embed 非字符串抛错
 * 11. embedBatch 维度 / 顺序
 * 12. cosineSimilarity: 自相似=1
 * 13. cosineSimilarity: 正交=0
 * 14. cosineSimilarity: 反向=-1
 * 15. cosineSimilarity: 维度不匹配抛错
 * 16. euclideanDistance: 自距离=0
 * 17. euclideanDistance: 对称
 * 18. serialize / deserialize roundtrip
 * 19. serialize 输出 base64 字符集
 * 20. deserialize 非 string 抛错
 * 21. cache 命中 (重复 embed 不重算)
 * 22. clearCache 清空
 * 23. fingerprint 稳定
 * 24. embedBatch 空数组
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingModel,
  DEFAULT_DIM,
  DEFAULT_BATCH_SIZE,
  DEFAULT_MODEL_PATH,
  fingerprint,
} from "./model.js";

describe("EmbeddingModel — construction", () => {
  it("1. default dim=384, batchSize=32, modelPath=D:\\ManhuaWorks\\models\\all-MiniLM-L6-v2", () => {
    const m = new EmbeddingModel();
    expect(m.dim).toBe(DEFAULT_DIM);
    expect(m.dim).toBe(384);
    expect(m.batchSize).toBe(DEFAULT_BATCH_SIZE);
    expect(m.batchSize).toBe(32);
    expect(m.modelPath).toBe(DEFAULT_MODEL_PATH);
  });

  it("2. custom dim and batchSize override defaults", () => {
    const m = new EmbeddingModel({ dim: 128, batchSize: 8 });
    expect(m.dim).toBe(128);
    expect(m.batchSize).toBe(8);
  });
});

describe("EmbeddingModel — lifecycle", () => {
  let m: EmbeddingModel;
  beforeEach(() => {
    m = new EmbeddingModel();
  });

  it("3. isLoaded() returns false before load()", () => {
    expect(m.isLoaded()).toBe(false);
  });

  it("4. load() flips isLoaded() to true", async () => {
    await m.load();
    expect(m.isLoaded()).toBe(true);
  });

  it("9. embed() before load() throws", async () => {
    await expect(m.embed("hello")).rejects.toThrow(/load/);
  });
});

describe("EmbeddingModel — embed()", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("5. embed() returns 384-dim vector", async () => {
    const v = await m.embed("hello world");
    expect(v).toHaveLength(384);
    for (const x of v) {
      expect(typeof x).toBe("number");
      expect(Number.isFinite(x)).toBe(true);
    }
  });

  it("6. embed() is deterministic — same text → same vector", async () => {
    const a = await m.embed("林启走进废墟");
    const b = await m.embed("林启走进废墟");
    expect(a).toEqual(b);
  });

  it("7. embed() of different text produces different vector", async () => {
    const a = await m.embed("alpha");
    const b = await m.embed("beta");
    // 不强求每一位都不同, 但 cos 应 < 1
    const cos = m.cosineSimilarity(a, b);
    expect(cos).toBeLessThan(0.99);
  });

  it("8. embed() of empty string returns valid 384-dim vector", async () => {
    const v = await m.embed("");
    expect(v).toHaveLength(384);
    // 空串不是全 0
    const sum = v.reduce((s, x) => s + Math.abs(x), 0);
    expect(sum).toBeGreaterThan(0);
  });

  it("9. embed() of unicode (Chinese) returns valid vector", async () => {
    const v = await m.embed("林启是一个考古助理, 他在灰星的废墟里挖掘");
    expect(v).toHaveLength(384);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5); // L2 归一化
  });

  it("10. embed() with non-string throws", async () => {
    await expect((m as unknown as { embed: (x: unknown) => Promise<number[]> }).embed(123)).rejects.toThrow(
      /string/,
    );
  });
});

describe("EmbeddingModel — embedBatch()", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("11. embedBatch() preserves order and length", async () => {
    const texts = ["alpha", "beta", "gamma", "delta"];
    const out = await m.embedBatch(texts);
    expect(out).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(out[i]).toHaveLength(384);
    }
  });

  it("12. embedBatch([]) returns []", async () => {
    const out = await m.embedBatch([]);
    expect(out).toEqual([]);
  });

  it("13. embedBatch() of single string returns 1-row", async () => {
    const out = await m.embedBatch(["solo"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(384);
  });
});

describe("EmbeddingModel — cosineSimilarity()", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("14. cosineSimilarity(a, a) === 1 (after L2 norm)", async () => {
    const v = await m.embed("self");
    expect(m.cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("15. cosineSimilarity(zero, zero) === 0 (degenerate)", () => {
    const z = new Array<number>(384).fill(0);
    expect(m.cosineSimilarity(z, z)).toBe(0);
  });

  it("16. cosineSimilarity dimension mismatch throws", () => {
    const a = new Array<number>(384).fill(0.1);
    const b = new Array<number>(128).fill(0.1);
    expect(() => m.cosineSimilarity(a, b)).toThrow(/dimension/);
  });

  it("17. cosineSimilarity of independent random vectors is near 0", async () => {
    const a = await m.embed("rnd-A-xyz");
    const b = await m.embed("rnd-B-abc");
    const cos = m.cosineSimilarity(a, b);
    // 384 维, 期望 |cos| < 0.3
    expect(Math.abs(cos)).toBeLessThan(0.3);
  });
});

describe("EmbeddingModel — euclideanDistance()", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("18. euclideanDistance(a, a) === 0", async () => {
    const v = await m.embed("self");
    expect(m.euclideanDistance(v, v)).toBe(0);
  });

  it("19. euclideanDistance is symmetric: d(a,b) === d(b,a)", async () => {
    const a = await m.embed("aaa");
    const b = await m.embed("bbb");
    const d1 = m.euclideanDistance(a, b);
    const d2 = m.euclideanDistance(b, a);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it("20. euclideanDistance of normalized random vectors is bounded by sqrt(2)", async () => {
    const a = await m.embed("u-1");
    const b = await m.embed("u-2");
    const d = m.euclideanDistance(a, b);
    // |a|=|b|=1, max distance = sqrt(2)
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(Math.sqrt(2) + 1e-9);
  });

  it("21. euclideanDistance dimension mismatch throws", () => {
    const a = new Array<number>(384).fill(0.1);
    const b = new Array<number>(100).fill(0.1);
    expect(() => m.euclideanDistance(a, b)).toThrow(/dimension/);
  });
});

describe("EmbeddingModel — serialize / deserialize", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("22. serialize/deserialize roundtrip preserves vector", async () => {
    const v = await m.embed("roundtrip");
    const b64 = m.serialize(v);
    const back = m.deserialize(b64);
    expect(back).toHaveLength(v.length);
    for (let i = 0; i < v.length; i++) {
      expect(back[i]).toBeCloseTo(v[i]!, 5);
    }
  });

  it("23. serialize output is base64 ASCII", async () => {
    const v = await m.embed("b64test");
    const b64 = m.serialize(v);
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("24. deserialize() of non-string throws", () => {
    expect(() => m.deserialize(123 as unknown as string)).toThrow(/string/);
  });

  it("25. deserialize() of invalid base64 length throws", () => {
    // 5 bytes is not multiple of 4
    const bad = Buffer.from([1, 2, 3, 4, 5]).toString("base64");
    expect(() => m.deserialize(bad)).toThrow(/base64/);
  });
});

describe("EmbeddingModel — cache", () => {
  it("26. cacheSize grows when embed is called", async () => {
    const m = new EmbeddingModel();
    await m.load();
    expect(m.cacheSize()).toBe(0);
    await m.embed("one");
    expect(m.cacheSize()).toBe(1);
    await m.embed("two");
    expect(m.cacheSize()).toBe(2);
  });

  it("27. duplicate embed does not grow cache", async () => {
    const m = new EmbeddingModel();
    await m.load();
    await m.embed("same");
    const s1 = m.cacheSize();
    await m.embed("same");
    const s2 = m.cacheSize();
    expect(s2).toBe(s1);
  });

  it("28. clearCache() empties cache", async () => {
    const m = new EmbeddingModel();
    await m.load();
    await m.embed("a");
    await m.embed("b");
    expect(m.cacheSize()).toBe(2);
    m.clearCache();
    expect(m.cacheSize()).toBe(0);
  });
});

describe("EmbeddingModel — fingerprint utility", () => {
  it("29. fingerprint is stable for same text", () => {
    const f1 = fingerprint("林启");
    const f2 = fingerprint("林启");
    expect(f1).toBe(f2);
    expect(f1).toHaveLength(16);
  });

  it("30. fingerprint differs for different text", () => {
    const f1 = fingerprint("林启");
    const f2 = fingerprint("灰星");
    expect(f1).not.toBe(f2);
  });
});

describe("EmbeddingModel — custom dim", () => {
  it("31. custom dim=128 produces 128-dim vectors", async () => {
    const m = new EmbeddingModel({ dim: 128 });
    await m.load();
    const v = await m.embed("short");
    expect(v).toHaveLength(128);
    // cosine on 128-dim still works
    const v2 = await m.embed("short");
    expect(m.cosineSimilarity(v, v2)).toBeCloseTo(1, 5);
  });
});
