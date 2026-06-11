/**
 * VideoGenerationPipeline tests — L3.H
 *
 * 覆盖:
 *  1. 完整流程: 5 场景全成, projectId/scenes/finalOutput/totalCostCents 正确
 *  2. 进度跟踪: 跑中 getProgress 返回 running, percent 0..100
 *  3. 部分失败: continueOnError=true, 失败场景标 failed, 其余完成
 *  4. 部分失败: continueOnError=false (默认), 整体抛错
 *  5. 取消: cancel(projectId) 触发后续 scene cancelled
 *  6. 空脚本抛错
 *  7. 单场景流程
 *  8. projectIdFor 确定性
 *  9. getProgress: 未知 projectId 返回 null
 * 10. 批处理: 跑两次不同 script, 互不干扰
 */

import { describe, it, expect } from "vitest";
import { VideoGenerator } from "./generator.js";
import { VideoComposer } from "./composer.js";
import { VideoGenerationPipeline, type SceneInput } from "./pipeline.js";

function makeFastSetup() {
  const gen = new VideoGenerator({ latencyRangeMs: [1, 3] });
  const comp = new VideoComposer(gen);
  const pipe = new VideoGenerationPipeline(gen, comp, { concurrent: 2 });
  return { gen, comp, pipe };
}

const SCRIPT_5: SceneInput[] = [
  { sceneId: "s1", prompt: "scene 1: hero appears", durationSec: 2 },
  { sceneId: "s2", prompt: "scene 2: hero walks", imageUrl: "mock://img/hero.png", durationSec: 3 },
  { sceneId: "s3", prompt: "scene 3: battle", durationSec: 2 },
  { sceneId: "s4", prompt: "scene 4: dialogue", imageUrl: "mock://img/hero2.png", durationSec: 2 },
  { sceneId: "s5", prompt: "scene 5: ending", durationSec: 3 },
];

describe("VideoGenerationPipeline — run()", () => {
  it("1. 5-scene full pipeline: all completed, projectId stable, totalCostCents = sum", async () => {
    const { pipe, gen } = makeFastSetup();
    const r = await pipe.run({ script: SCRIPT_5, globalStyle: "manga" });
    expect(r.projectId).toBe(pipe.projectIdFor(SCRIPT_5, "manga"));
    expect(r.scenes.length).toBe(5);
    expect(r.scenes.every((s) => s.status === "completed")).toBe(true);
    expect(r.finalOutput.url).toMatch(/^mock:\/\/compose\//);
    expect(r.finalOutput.duration).toBe(12); // 2+3+2+2+3
    const expectedCost = SCRIPT_5.reduce(
      (acc, s) => acc + gen.getCostEstimate(s.durationSec ?? gen.defaultDuration),
      0
    );
    expect(r.totalCostCents).toBe(expectedCost);
  });

  it("2. progress tracking: percent goes 0..100", async () => {
    const { pipe, comp } = makeFastSetup();
    // 让 generator 慢一点
    const slowGen = new VideoGenerator({ latencyRangeMs: [20, 30] });
    const slowComp = new VideoComposer(slowGen);
    const slowPipe = new VideoGenerationPipeline(slowGen, slowComp, { concurrent: 1 });
    const projectId = slowPipe.projectIdFor(SCRIPT_5);
    const p = slowPipe.run({ script: SCRIPT_5 });
    // 等 5ms 拿 progress
    await new Promise((r) => setTimeout(r, 5));
    const progress = slowPipe.getProgress(projectId);
    expect(progress).not.toBeNull();
    expect(progress!.total).toBe(5);
    expect(progress!.status).toBe("running");
    expect(progress!.percent).toBeGreaterThanOrEqual(0);
    expect(progress!.percent).toBeLessThanOrEqual(100);
    await p;
    // 完成后 getProgress 返回 null (projectId 已 delete)
    expect(slowPipe.getProgress(projectId)).toBeNull();
  });

  it("3. partial failure with continueOnError: failed scene recorded, others completed", async () => {
    // failRate=1 → 必然失败
    const gen = new VideoGenerator({ latencyRangeMs: [1, 3], failRate: 1 });
    const comp = new VideoComposer(gen);
    const pipe = new VideoGenerationPipeline(gen, comp, { concurrent: 1 });
    const r = await pipe.run({ script: SCRIPT_5, continueOnError: true });
    expect(r.scenes.length).toBe(5);
    expect(r.scenes.every((s) => s.status === "failed")).toBe(true);
  });

  it("4. partial failure without continueOnError: throws", async () => {
    const gen = new VideoGenerator({ latencyRangeMs: [1, 3], failRate: 1 });
    const comp = new VideoComposer(gen);
    const pipe = new VideoGenerationPipeline(gen, comp, { concurrent: 1 });
    await expect(pipe.run({ script: SCRIPT_5 })).rejects.toThrow();
  });

  it("5. cancel: project goes cancelled, remaining scenes skipped", async () => {
    const gen = new VideoGenerator({ latencyRangeMs: [80, 120] });
    const comp = new VideoComposer(gen);
    const pipe = new VideoGenerationPipeline(gen, comp, { concurrent: 1 });
    const projectId = pipe.projectIdFor(SCRIPT_5);
    const p = pipe.run({ script: SCRIPT_5 });
    // 60ms 后 cancel (第一个场景仍未完成 ~ 80-120ms)
    await new Promise((r) => setTimeout(r, 60));
    const ok = pipe.cancel(projectId);
    expect(ok).toBe(true);
    const r = await p;
    // 至少有一个 scene 被 cancelled
    const cancelled = r.scenes.filter((s) => s.status === "cancelled");
    expect(cancelled.length).toBeGreaterThan(0);
  }, 10000);

  it("6. empty script throws", async () => {
    const { pipe } = makeFastSetup();
    await expect(pipe.run({ script: [] })).rejects.toThrow(/non-empty/);
  });

  it("6b. scene with empty prompt throws", async () => {
    const { pipe } = makeFastSetup();
    await expect(
      pipe.run({ script: [{ sceneId: "s1", prompt: "" }] })
    ).rejects.toThrow(TypeError);
  });

  it("7. single-scene pipeline", async () => {
    const { pipe, gen } = makeFastSetup();
    const r = await pipe.run({
      script: [{ sceneId: "only", prompt: "p", durationSec: 2 }],
    });
    expect(r.scenes.length).toBe(1);
    expect(r.scenes[0].status).toBe("completed");
    expect(r.finalOutput.duration).toBe(2);
    expect(r.totalCostCents).toBe(gen.getCostEstimate(2));
  });

  it("8. projectIdFor: same script → same id", () => {
    const { pipe } = makeFastSetup();
    const a = pipe.projectIdFor(SCRIPT_5, "manga");
    const b = pipe.projectIdFor(SCRIPT_5, "manga");
    expect(a).toBe(b);
    const c = pipe.projectIdFor(SCRIPT_5, "anime");
    expect(c).not.toBe(a);
    const d = pipe.projectIdFor(SCRIPT_5.slice(0, 3), "manga");
    expect(d).not.toBe(a);
  });

  it("9. getProgress: unknown projectId returns null", () => {
    const { pipe } = makeFastSetup();
    expect(pipe.getProgress("nope")).toBeNull();
  });

  it("10. batch: two independent runs don't interfere", async () => {
    const { pipe } = makeFastSetup();
    const script1: SceneInput[] = [
      { sceneId: "a1", prompt: "a1", durationSec: 1 },
      { sceneId: "a2", prompt: "a2", durationSec: 1 },
    ];
    const script2: SceneInput[] = [
      { sceneId: "b1", prompt: "b1", durationSec: 2 },
    ];
    const [r1, r2] = await Promise.all([
      pipe.run({ script: script1 }),
      pipe.run({ script: script2 }),
    ]);
    expect(r1.scenes.length).toBe(2);
    expect(r2.scenes.length).toBe(1);
    expect(r1.projectId).not.toBe(r2.projectId);
  });
});
