/**
 * RoleConsistencyChecker tests — L3.F
 *
 * 覆盖 (15+ tests):
 *  1. addCharacter 成功
 *  2. addCharacter 抛错 (id 空 / name 非字符串 / description 非字符串)
 *  3. addCharacter 二次 add 同 id 覆盖
 *  4. getCharacter 找不到返 undefined
 *  5. removeCharacter
 *  6. checkConsistency 指定 characterId 匹配
 *  7. checkConsistency 指定 characterId 不匹配 (低于阈值)
 *  8. checkConsistency 不指定 → 找最像角色
 *  9. checkConsistency 找不到时 score=0
 * 10. findDrift 无历史 → 不算漂移
 * 11. findDrift 历史一致 → 不漂移
 * 12. findDrift 历史不一致 → 漂移
 * 13. recordHistory + historyCount
 * 14. characterCount / listCharacters
 * 15. addCharacter 传入预 embedding 可用
 * 16. addCharacter 抛错 (embedding dim 不匹配)
 * 17. checkConsistency 非字符串 text 抛错
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EmbeddingModel } from "./model.js";
import { VectorStore } from "./store.js";
import {
  RoleConsistencyChecker,
  DEFAULT_CONSISTENCY_THRESHOLD,
} from "./role-consistency.js";

describe("RoleConsistencyChecker — CRUD", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  let c: RoleConsistencyChecker;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
    c = new RoleConsistencyChecker(m, s);
  });

  it("1. addCharacter + getCharacter roundtrip", async () => {
    await c.addCharacter({
      id: "linqi",
      name: "林启",
      description: "考古助理, 在灰星废墟里挖掘",
      attributes: { age: 28, faction: "human" },
    });
    const p = c.getCharacter("linqi");
    expect(p).toBeDefined();
    expect(p!.name).toBe("林启");
    expect(p!.description).toBe("考古助理, 在灰星废墟里挖掘");
    expect(p!.attributes).toEqual({ age: 28, faction: "human" });
    expect(p!.embedding).toBeDefined();
    expect(p!.embedding).toHaveLength(384);
  });

  it("2. addCharacter throws on invalid id", async () => {
    await expect(
      c.addCharacter({ id: "", name: "x", description: "y" }),
    ).rejects.toThrow(/id/);
  });

  it("3. addCharacter throws on non-string name", async () => {
    await expect(
      c.addCharacter({
        id: "ok",
        name: 42 as unknown as string,
        description: "y",
      }),
    ).rejects.toThrow(/name/);
  });

  it("4. addCharacter throws on non-string description", async () => {
    await expect(
      c.addCharacter({
        id: "ok",
        name: "x",
        description: 1 as unknown as string,
      }),
    ).rejects.toThrow(/description/);
  });

  it("5. addCharacter 2nd time with same id overwrites", async () => {
    await c.addCharacter({ id: "a", name: "A1", description: "old" });
    await c.addCharacter({ id: "a", name: "A2", description: "new" });
    expect(c.characterCount()).toBe(1);
    expect(c.getCharacter("a")!.name).toBe("A2");
    expect(c.getCharacter("a")!.description).toBe("new");
  });

  it("6. getCharacter returns undefined for unknown id", () => {
    expect(c.getCharacter("ghost")).toBeUndefined();
  });

  it("7. removeCharacter removes from store and profiles", async () => {
    await c.addCharacter({ id: "x", name: "X", description: "X desc" });
    expect(c.removeCharacter("x")).toBe(true);
    expect(c.getCharacter("x")).toBeUndefined();
    expect(c.removeCharacter("x")).toBe(false);
  });

  it("8. characterCount and listCharacters reflect state", async () => {
    expect(c.characterCount()).toBe(0);
    expect(c.listCharacters()).toEqual([]);
    await c.addCharacter({ id: "a", name: "A", description: "a" });
    await c.addCharacter({ id: "b", name: "B", description: "b" });
    expect(c.characterCount()).toBe(2);
    expect(c.listCharacters().sort()).toEqual(["a", "b"]);
  });
});

describe("RoleConsistencyChecker — checkConsistency", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  let c: RoleConsistencyChecker;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
    c = new RoleConsistencyChecker(m, s);
    await c.addCharacter({
      id: "linqi",
      name: "林启",
      description: "考古助理, 在灰星的废墟里小心挖掘, 性格冷静",
    });
    await c.addCharacter({
      id: "shen",
      name: "沈昭",
      description: "天穹议员, 主张强硬的扩张政策, 性格激进",
    });
  });

  it("9. checkConsistency with characterId returns score and matchedCharacter", async () => {
    const r = await c.checkConsistency("林启在废墟中挖掘文物", {
      characterId: "linqi",
      threshold: 0.0,
    });
    expect(r.matchedCharacter).toBeDefined();
    expect(r.matchedCharacter!.id).toBe("linqi");
    expect(r.matchedCharacter!.name).toBe("林启");
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("10. checkConsistency with high threshold returns isConsistent=false", async () => {
    const r = await c.checkConsistency("完全无关的句子 xyz", {
      characterId: "linqi",
      threshold: 0.999999,
    });
    expect(r.isConsistent).toBe(false);
    expect(r.matchedCharacter).toBeDefined();
  });

  it("11. checkConsistency without characterId finds best match", async () => {
    const r = await c.checkConsistency("沈昭正在议会发言", {
      topK: 1,
      threshold: 0.0,
    });
    expect(r.matchedCharacter).toBeDefined();
    expect(r.matchedCharacter!.id).toBe("shen");
  });

  it("12. checkConsistency with unknown characterId returns score=0", async () => {
    const r = await c.checkConsistency("anything", {
      characterId: "ghost",
      threshold: 0.5,
    });
    expect(r.score).toBe(0);
    expect(r.isConsistent).toBe(false);
  });

  it("13. checkConsistency with non-string text throws", async () => {
    await expect(
      c.checkConsistency(123 as unknown as string),
    ).rejects.toThrow(/newText|text|string/i);
  });

  it("14. checkConsistency on empty checker returns score=0", async () => {
    const empty = new RoleConsistencyChecker(m, new VectorStore(m));
    const r = await empty.checkConsistency("anything");
    expect(r.isConsistent).toBe(false);
    expect(r.score).toBe(0);
  });
});

describe("RoleConsistencyChecker — findDrift", () => {
  let m: EmbeddingModel;
  let s: VectorStore;
  let c: RoleConsistencyChecker;
  beforeEach(async () => {
    m = new EmbeddingModel();
    await m.load();
    s = new VectorStore(m);
    c = new RoleConsistencyChecker(m, s);
    await c.addCharacter({
      id: "linqi",
      name: "林启",
      description: "考古助理, 冷静理性",
    });
  });

  it("15. findDrift with no history returns drifted=false", async () => {
    const r = await c.findDrift("anything", "linqi");
    expect(r.drifted).toBe(false);
    expect(r.historyAvg).toBe(1);
  });

  it("16. findDrift with consistent history and a low-enough threshold returns drifted=false", async () => {
    c.recordHistory("linqi", "林启在废墟中寻找文物");
    c.recordHistory("linqi", "林启冷静地分析数据");
    c.recordHistory("linqi", "林启在基地里整理报告");
    // threshold=-1 时, 任何 score (含负) 都不算漂移
    const r = await c.findDrift("林启的考古工作", "linqi", -1);
    expect(r.drifted).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(-1);
    expect(r.score).toBeLessThanOrEqual(1);
    // historyAvg ∈ [0, 1] (cos 与 baseline 的均值)
    expect(r.historyAvg).toBeGreaterThanOrEqual(0);
    expect(r.historyAvg).toBeLessThanOrEqual(1);
  });

  it("17. findDrift with inconsistent text returns drifted=true (high threshold)", async () => {
    c.recordHistory("linqi", "history-A-1");
    c.recordHistory("linqi", "history-A-2");
    const r = await c.findDrift("some-different-text-zzz-99", "linqi", 0.9999);
    expect(r.drifted).toBe(true);
    expect(r.score).toBeLessThan(0.9999);
  });

  it("18. findDrift with unknown character returns drifted=true", async () => {
    const r = await c.findDrift("anything", "ghost");
    expect(r.drifted).toBe(true);
    expect(r.score).toBe(0);
  });

  it("19. recordHistory + historyCount", () => {
    expect(c.historyCount("linqi")).toBe(0);
    c.recordHistory("linqi", "t1");
    c.recordHistory("linqi", "t2");
    c.recordHistory("linqi", "");
    expect(c.historyCount("linqi")).toBe(2); // 空串被忽略
  });
});

describe("RoleConsistencyChecker — pre-embedding", () => {
  it("20. addCharacter with pre-supplied embedding works", async () => {
    const m = new EmbeddingModel();
    await m.load();
    const s = new VectorStore(m);
    const c = new RoleConsistencyChecker(m, s);
    const pre = await m.embed("pre-embed");
    await c.addCharacter({
      id: "p",
      name: "P",
      description: "pre-embed",
      embedding: pre,
    });
    const got = c.getCharacter("p");
    expect(got!.embedding).toEqual(pre);
  });

  it("21. addCharacter rejects wrong-dim embedding", async () => {
    const m = new EmbeddingModel();
    await m.load();
    const s = new VectorStore(m);
    const c = new RoleConsistencyChecker(m, s);
    await expect(
      c.addCharacter({
        id: "p",
        name: "P",
        description: "x",
        embedding: new Array<number>(128).fill(0),
      }),
    ).rejects.toThrow(/dim/);
  });
});
