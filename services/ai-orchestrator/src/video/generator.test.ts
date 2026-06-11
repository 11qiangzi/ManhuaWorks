/**
 * VideoGenerator tests — L3.H
 *
 * 覆盖:
 *  1. 默认配置
 *  2. 自定义 fps / duration / resolution / provider
 *  3. generationIdFor 确定性 (同 prompt + seed → 同 id)
 *  4. generationIdFor imageUrl 参与 hash
 *  5. getCostEstimate duration * cost
 *  6. getCostEstimate 非法 duration 抛错
 *  7. generate() 必填 prompt 抛错
 *  8. generate() duration 范围校验
 *  9. generate() 成功 (延迟很短, 走 fast path)
 * 10. generate() 返回结构字段
 * 11. generate() 同样 prompt + seed → 同样 generationId
 * 12. generate() frames = duration * fps
 * 13. generateFromImage() 必填 imageUrl / prompt 抛错
 * 14. generateFromImage() 成功 (fast path)
 * 15. cancel() 取消 in-flight
 * 16. cancel() 未知 id → false
 * 17. cancel() 完成后 → false
 * 18. 队列管理 (并发多任务, inFlightCount 正确)
 * 19. 失败重试: failRate=1 → reject
 * 20. 批处理: 多次 generate 互不干扰
 * 21. 超时: delay > 0 不会瞬间 resolve
 * 22. provider 默认值
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  VideoGenerator,
  DEFAULT_FPS,
  DEFAULT_DURATION_SEC,
  DEFAULT_PROVIDER,
  DEFAULT_RESOLUTION,
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  COST_PER_SECOND_CENTS,
} from "./generator.js";

function makeFastGenerator(overrides: Partial<ConstructorParameters<typeof VideoGenerator>[0]> = {}) {
  return new VideoGenerator({
    latencyRangeMs: [1, 5],
    ...overrides,
  });
}

describe("VideoGenerator — construction", () => {
  it("1. defaults: fps=24, duration=5, resolution=1080p, provider=mock-atlas-seedance", () => {
    const g = new VideoGenerator();
    expect(g.fps).toBe(DEFAULT_FPS);
    expect(g.fps).toBe(24);
    expect(g.defaultDuration).toBe(DEFAULT_DURATION_SEC);
    expect(g.defaultDuration).toBe(5);
    expect(g.resolution).toEqual(DEFAULT_RESOLUTION);
    expect(g.resolution.width).toBe(1920);
    expect(g.resolution.height).toBe(1080);
    expect(g.provider).toBe(DEFAULT_PROVIDER);
  });

  it("2. custom config overrides defaults", () => {
    const g = new VideoGenerator({
      fps: 30,
      defaultDuration: 10,
      resolution: { width: 1280, height: 720 },
      provider: "mock-runway",
      costPerSecondCents: 7,
    });
    expect(g.fps).toBe(30);
    expect(g.defaultDuration).toBe(10);
    expect(g.resolution).toEqual({ width: 1280, height: 720 });
    expect(g.provider).toBe("mock-runway");
    expect(g.costPerSecondCents).toBe(7);
  });
});

describe("VideoGenerator — getCostEstimate", () => {
  it("5. cost = ceil(duration * costPerSecond)", () => {
    const g = new VideoGenerator({ costPerSecondCents: 4 });
    expect(g.getCostEstimate(5)).toBe(20);
    expect(g.getCostEstimate(1)).toBe(4);
    expect(g.getCostEstimate(15)).toBe(60);
  });

  it("5b. default cost = 4 cents/sec", () => {
    const g = new VideoGenerator();
    expect(g.costPerSecondCents).toBe(COST_PER_SECOND_CENTS);
    expect(g.getCostEstimate(10)).toBe(40);
  });

  it("6. invalid duration throws", () => {
    const g = new VideoGenerator();
    expect(() => g.getCostEstimate(0)).toThrow(RangeError);
    expect(() => g.getCostEstimate(-1)).toThrow(RangeError);
    expect(() => g.getCostEstimate(NaN)).toThrow(RangeError);
    expect(() => g.getCostEstimate(Infinity)).toThrow(RangeError);
  });
});

describe("VideoGenerator — generationIdFor", () => {
  it("3. same prompt + seed → same id", () => {
    const g = new VideoGenerator();
    const a = g.generationIdFor({ prompt: "a cat walking", seed: 42 });
    const b = g.generationIdFor({ prompt: "a cat walking", seed: 42 });
    expect(a).toBe(b);
    expect(a.length).toBe(16);
  });

  it("3b. different seed → different id", () => {
    const g = new VideoGenerator();
    const a = g.generationIdFor({ prompt: "x", seed: 1 });
    const b = g.generationIdFor({ prompt: "x", seed: 2 });
    expect(a).not.toBe(b);
  });

  it("4. imageUrl participates in hash", () => {
    const g = new VideoGenerator();
    const a = g.generationIdFor({ prompt: "x", seed: 1, imageUrl: "img-a" });
    const b = g.generationIdFor({ prompt: "x", seed: 1, imageUrl: "img-b" });
    expect(a).not.toBe(b);
  });
});

describe("VideoGenerator — generate()", () => {
  it("7. empty prompt throws", async () => {
    const g = makeFastGenerator();
    await expect(g.generate({ prompt: "" })).rejects.toThrow(TypeError);
  });

  it("8. duration out of range throws", async () => {
    const g = makeFastGenerator();
    await expect(
      g.generate({ prompt: "x", durationSec: MIN_DURATION_SEC - 1 })
    ).rejects.toThrow(RangeError);
    await expect(
      g.generate({ prompt: "x", durationSec: MAX_DURATION_SEC + 1 })
    ).rejects.toThrow(RangeError);
  });

  it("9. generate() resolves with valid result (fast path)", async () => {
    const g = makeFastGenerator();
    const r = await g.generate({ prompt: "manhua battle scene", durationSec: 3, seed: 7 });
    expect(r.generationId).toBe(g.generationIdFor({ prompt: "manhua battle scene", seed: 7 }));
    expect(r.videoUrl).toMatch(/^mock:\/\/video\/.+\.mp4$/);
    expect(r.status).toBe("completed");
  });

  it("10. result has all required fields", async () => {
    const g = makeFastGenerator({ fps: 30, resolution: { width: 1280, height: 720 } });
    const r = await g.generate({ prompt: "p", durationSec: 4 });
    expect(r.durationSec).toBe(4);
    expect(r.frames).toBe(120); // 4 * 30
    expect(r.width).toBe(1280);
    expect(r.height).toBe(720);
    expect(r.costCents).toBe(16);
    expect(r.provider).toBe(DEFAULT_PROVIDER);
    expect(typeof r.seed).toBe("number");
  });

  it("11. same prompt + seed → same generationId across calls", async () => {
    const g = makeFastGenerator();
    const a = await g.generate({ prompt: "same", durationSec: 2, seed: 99 });
    const b = await g.generate({ prompt: "same", durationSec: 2, seed: 99 });
    expect(a.generationId).toBe(b.generationId);
  });

  it("12. frames = durationSec * fps", async () => {
    const g = makeFastGenerator({ fps: 60 });
    const r = await g.generate({ prompt: "p", durationSec: 2 });
    expect(r.frames).toBe(120);
  });
});

describe("VideoGenerator — generateFromImage()", () => {
  it("13. empty imageUrl / prompt throws", async () => {
    const g = makeFastGenerator();
    await expect(
      g.generateFromImage({ imageUrl: "", prompt: "x" })
    ).rejects.toThrow(TypeError);
    await expect(
      g.generateFromImage({ imageUrl: "img://a", prompt: "" })
    ).rejects.toThrow(TypeError);
  });

  it("14. generateFromImage() succeeds with imageUrl", async () => {
    const g = makeFastGenerator();
    const r = await g.generateFromImage({
      imageUrl: "https://cdn.example/character.png",
      prompt: "character walks forward",
      durationSec: 4,
      motion: "medium",
    });
    expect(r.videoUrl).toMatch(/^mock:\/\/video\//);
    expect(r.durationSec).toBe(4);
    expect(r.status).toBe("completed");
  });
});

describe("VideoGenerator — cancel", () => {
  it("15. cancel() rejects in-flight task", async () => {
    const g = new VideoGenerator({ latencyRangeMs: [100, 150] });
    const p = g.generate({ prompt: "slow", durationSec: 5 });
    // 等任务进队列
    await new Promise((r) => setTimeout(r, 20));
    // 从 totalTaskCount 推断: 唯一的 task id 就是 totalTaskCount-1 那个
    // 简单做法: 试试 inFlightCount > 0 的任意 in-flight, 通过内部 _tasks 取
    const tasks = (g as unknown as { _tasks: Map<string, { status: string }> })._tasks;
    let id: string | null = null;
    for (const [k, v] of tasks.entries()) {
      if (v.status === "running") {
        id = k;
        break;
      }
    }
    expect(id).not.toBeNull();
    const ok = await g.cancel(id as string);
    expect(ok).toBe(true);
    await expect(p).rejects.toThrow(/cancelled/);
  }, 10000);

  it("16. cancel() unknown id returns false", async () => {
    const g = new VideoGenerator();
    const ok = await g.cancel("nonexistent-id-1234");
    expect(ok).toBe(false);
  });

  it("17. cancel() on completed task returns false", async () => {
    const g = makeFastGenerator();
    const r = await g.generate({ prompt: "p", durationSec: 2 });
    const ok = await g.cancel(r.generationId);
    expect(ok).toBe(false);
  });
});

describe("VideoGenerator — queue & batch", () => {
  it("18. multiple concurrent tasks tracked in inFlightCount", async () => {
    const g = new VideoGenerator({ latencyRangeMs: [50, 80] });
    const p1 = g.generate({ prompt: "a", durationSec: 2 });
    const p2 = g.generate({ prompt: "b", durationSec: 2 });
    const p3 = g.generate({ prompt: "c", durationSec: 2 });
    // 给 setTimeout 一点时间把任务注册到 map
    await new Promise((r) => setTimeout(r, 10));
    expect(g.inFlightCount).toBe(3);
    await Promise.all([p1, p2, p3]);
    expect(g.inFlightCount).toBe(0);
    expect(g.totalTaskCount).toBe(3);
  });

  it("20. batch: 5 scenes all complete with distinct generationIds", async () => {
    const g = makeFastGenerator();
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        g.generate({ prompt: `scene-${i}`, durationSec: 2, seed: i })
      )
    );
    const ids = new Set(results.map((r) => r.generationId));
    expect(ids.size).toBe(5);
    expect(g.totalTaskCount).toBe(5);
  });
});

describe("VideoGenerator — failure modes", () => {
  it("19. failRate=1 always rejects", async () => {
    const g = new VideoGenerator({ latencyRangeMs: [1, 5], failRate: 1 });
    await expect(g.generate({ prompt: "p", durationSec: 1 })).rejects.toThrow(
      /mock generation failed/
    );
  });

  it("21. delay is > 0 (不会瞬间 resolve)", async () => {
    const g = new VideoGenerator({ latencyRangeMs: [30, 50] });
    const start = Date.now();
    await g.generate({ prompt: "p", durationSec: 1 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(20);
  });
});

describe("VideoGenerator — provider default", () => {
  it("22. provider defaults to mock-atlas-seedance", () => {
    const g = new VideoGenerator();
    expect(g.provider).toBe("mock-atlas-seedance");
  });
});
