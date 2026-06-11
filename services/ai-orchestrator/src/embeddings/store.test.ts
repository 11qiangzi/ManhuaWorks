/**
 * VectorStore tests — L3.F
 *
 * 覆盖 (10 tests):
 *  1. add + size
 *  2. add 后 get 返回正确 (vector/text/metadata)
 *  3. add 重复 id → 覆盖 (含 vector 更新)
 *  4. add 空 id / 非字符串 → 抛
 *  5. remove 删除一条, 再查 size 减 1
 *  6. remove 不存在的 id → false, 不抛
 *  7. search topK 降序
 *  8. search threshold 过滤低分
 *  9. search 空 query 处理
 * 10. addBatch 原子 (一条失败整批回滚)
 * 11. findSimilar 预嵌入向量查询
 * 12. maxSize 限制
 * 13. clear/ids/has/isEmpty
 * 14. findSimilar dim 校验
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EmbeddingModel } from "./model.js";
import { VectorStore } from "./store.js";

describe("VectorStore — basic CRUD", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
  });

  it("1. add + size + isEmpty", async () => {
    expect(s.isEmpty()).toBe(true);
    expect(s.size()).toBe(0);
    await s.add("a", "alpha text");
    expect(s.isEmpty()).toBe(false);
    expect(s.size()).toBe(1);
  });

  it("2. get() returns record with vector/text/metadata", async () => {
    await s.add("x", "林启在废墟里", { role: "lead", chapter: 1 });
    const r = s.get("x");
    expect(r).toBeDefined();
    expect(r!.id).toBe("x");
    expect(r!.text).toBe("林启在废墟里");
    expect(r!.vector).toHaveLength(384);
    expect(r!.metadata).toEqual({ role: "lead", chapter: 1 });
  });

  it("3. get() returns shallow copy (mutate doesn't affect store)", async () => {
    await s.add("k", "k-text", { tag: "v1" });
    const r = s.get("k")!;
    r.text = "MUTATED";
    r.metadata.tag = "v2";
    const r2 = s.get("k")!;
    expect(r2.text).toBe("k-text");
    expect(r2.metadata.tag).toBe("v1");
  });

  it("4. add() with empty id throws", async () => {
    await expect(s.add("", "text")).rejects.toThrow(/id/);
  });

  it("5. add() with non-string id throws", async () => {
    await expect(s.add(123 as unknown as string, "text")).rejects.toThrow(/id/);
  });

  it("6. add() with non-string text throws", async () => {
    await expect(s.add("ok", 42 as unknown as string)).rejects.toThrow(/text/);
  });

  it("7. has() returns true/false", async () => {
    await s.add("a", "alpha");
    expect(s.has("a")).toBe(true);
    expect(s.has("nope")).toBe(false);
  });

  it("8. remove() deletes a record and returns true", async () => {
    await s.add("a", "alpha");
    await s.add("b", "beta");
    expect(s.remove("a")).toBe(true);
    expect(s.size()).toBe(1);
    expect(s.get("a")).toBeUndefined();
  });

  it("9. remove() of non-existent id returns false, doesn't throw", () => {
    expect(s.remove("ghost")).toBe(false);
  });

  it("10. clear() empties store, ids() reflects", async () => {
    await s.add("a", "alpha");
    await s.add("b", "beta");
    s.clear();
    expect(s.size()).toBe(0);
    expect(s.ids()).toEqual([]);
  });

  it("11. duplicate add() overwrites (vector and metadata refreshed)", async () => {
    await s.add("a", "first", { v: 1 });
    await s.add("a", "second", { v: 2 });
    expect(s.size()).toBe(1);
    const r = s.get("a")!;
    expect(r.text).toBe("second");
    expect(r.metadata.v).toBe(2);
  });
});

describe("VectorStore — search", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
    await s.add("a", "林启是一个考古助理");
    await s.add("b", "灰星上的远古文明");
    await s.add("c", "地球基地的早晨");
  });

  it("12. search() returns results sorted by score desc", async () => {
    const hits = await s.search("林启");
    expect(hits.length).toBeGreaterThan(0);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.score).toBeLessThanOrEqual(hits[i - 1]!.score);
    }
    for (const h of hits) {
      expect(h.id).toBeDefined();
      expect(typeof h.text).toBe("string");
      expect(typeof h.score).toBe("number");
    }
  });

  it("13. search() with topK=2 returns at most 2", async () => {
    const hits = await s.search("test", { topK: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("14. search() with high threshold filters out low scores", async () => {
    const hits = await s.search("test", { threshold: 0.999999 });
    // mock 嵌入 cos < 1, 应该全部被过滤
    expect(hits).toEqual([]);
  });

  it("15. search() with non-string query throws", async () => {
    await expect(s.search(123 as unknown as string)).rejects.toThrow(/query/);
  });

  it("16. search() on empty store returns []", async () => {
    const empty = new VectorStore(m);
    const hits = await empty.search("anything");
    expect(hits).toEqual([]);
  });
});

describe("VectorStore — findSimilar (pre-embedded)", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
    await s.add("a", "alpha");
    await s.add("b", "beta");
  });

  it("17. findSimilar() with pre-embedded vector returns topK", async () => {
    const qv = await m.embed("alpha");
    const hits = s.findSimilar(qv, { topK: 1 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe("a");
    expect(hits[0]!.score).toBeCloseTo(1, 5);
  });

  it("18. findSimilar() with non-array embedding throws", () => {
    expect(() => s.findSimilar("nope" as unknown as number[])).toThrow(/number/);
  });

  it("19. findSimilar() with wrong dim throws", () => {
    const bad = new Array<number>(128).fill(0);
    expect(() => s.findSimilar(bad)).toThrow(/dim/);
  });

  it("20. findSimilar() with topK=0 returns []", async () => {
    const qv = await m.embed("alpha");
    expect(s.findSimilar(qv, { topK: 0 })).toEqual([]);
  });
});

describe("VectorStore — batch & capacity", () => {
  let m: EmbeddingModel;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
  });

  it("21. addBatch() adds multiple records", async () => {
    const s = new VectorStore(m);
    await s.addBatch([
      { id: "1", text: "t1" },
      { id: "2", text: "t2" },
      { id: "3", text: "t3", metadata: { k: "v" } },
    ]);
    expect(s.size()).toBe(3);
  });

  it("22. addBatch() rolls back on failure", async () => {
    const s = new VectorStore(m);
    await s.add("pre-existing", "preexisting");
    await expect(
      s.addBatch([
        { id: "ok", text: "ok" },
        { id: "", text: "bad" }, // ← 应该让 batch 失败
      ]),
    ).rejects.toThrow();
    // rollback → pre-existing 还在, ok 不在
    expect(s.has("pre-existing")).toBe(true);
    expect(s.has("ok")).toBe(false);
  });

  it("23. maxSize=2 rejects 3rd add with new id", async () => {
    const s = new VectorStore(m, { maxSize: 2 });
    await s.add("1", "a");
    await s.add("2", "b");
    await expect(s.add("3", "c")).rejects.toThrow(/max size/);
    // 覆盖已有的 id 仍允许
    await s.add("1", "a2");
    expect(s.get("1")!.text).toBe("a2");
  });
});
