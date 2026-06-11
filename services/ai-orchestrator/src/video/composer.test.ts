/**
 * VideoComposer tests — L3.H
 *
 * 覆盖:
 *  1. 构造默认空
 *  2. addClip 校验 (空 id / 空 url / 空 sceneId / start>=end)
 *  3. addClip 成功 + clipCount
 *  4. addOverlay text 校验 (空 text / 范围错)
 *  5. addOverlay image 校验 (空 url / 错 opacity)
 *  6. addTransition 校验 (未知 id)
 *  7. compose 必填至少 1 clip
 *  8. compose 成功: 返回 outputUrl, duration, scenes
 *  9. compose 接受 audioTrack + subtitleTrack
 * 10. compose 校验 audio volume 范围
 * 11. 时长计算: max(endSec)
 * 12. 边界: 单 clip, duration 正确
 * 13. 重叠 clip: 总时长取 max, 不抛错
 * 14. exportProject 三种格式
 * 15. exportProject 无 clip 抛错
 * 16. exportProject 非法格式抛错
 * 17. getClips / getOverlays / getTransitions 返回副本
 * 18. reset() 清空
 */

import { describe, it, expect, beforeEach } from "vitest";
import { VideoComposer, type VideoClip, type TextOverlay, type ImageOverlay } from "./composer.js";

function makeClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: "clip-1",
    videoUrl: "mock://video/c1.mp4",
    startSec: 0,
    endSec: 5,
    sceneId: "scene-1",
    ...overrides,
  };
}

describe("VideoComposer — construction", () => {
  it("1. default: empty clips/overlays/transitions", () => {
    const c = new VideoComposer();
    expect(c.clipCount).toBe(0);
    expect(c.overlayCount).toBe(0);
    expect(c.transitionCount).toBe(0);
    expect(c.getClips()).toEqual([]);
  });
});

describe("VideoComposer — addClip", () => {
  it("2a. addClip rejects empty id", () => {
    const c = new VideoComposer();
    expect(() => c.addClip({ ...makeClip(), id: "" })).toThrow(TypeError);
  });

  it("2b. addClip rejects empty videoUrl", () => {
    const c = new VideoComposer();
    expect(() => c.addClip({ ...makeClip(), videoUrl: "" })).toThrow(TypeError);
  });

  it("2c. addClip rejects empty sceneId", () => {
    const c = new VideoComposer();
    expect(() => c.addClip({ ...makeClip(), sceneId: "" })).toThrow(TypeError);
  });

  it("2d. addClip rejects start >= end", () => {
    const c = new VideoComposer();
    expect(() => c.addClip({ ...makeClip(), startSec: 5, endSec: 5 })).toThrow(RangeError);
    expect(() => c.addClip({ ...makeClip(), startSec: 6, endSec: 5 })).toThrow(RangeError);
    expect(() => c.addClip({ ...makeClip(), startSec: -1, endSec: 5 })).toThrow(RangeError);
  });

  it("3. addClip success increments clipCount", () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" }));
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 10, sceneId: "scene-2" }));
    expect(c.clipCount).toBe(2);
  });
});

describe("VideoComposer — addOverlay", () => {
  it("4a. text overlay: empty text throws", () => {
    const c = new VideoComposer();
    const o: TextOverlay = {
      kind: "text",
      text: "",
      startSec: 0,
      endSec: 1,
      position: "bottom",
    };
    expect(() => c.addOverlay(o)).toThrow(TypeError);
  });

  it("4b. text overlay: start >= end throws", () => {
    const c = new VideoComposer();
    expect(() =>
      c.addOverlay({ kind: "text", text: "hi", startSec: 5, endSec: 5, position: "top" })
    ).toThrow(RangeError);
  });

  it("4c. text overlay success", () => {
    const c = new VideoComposer();
    c.addOverlay({
      kind: "text",
      text: "Hello",
      startSec: 1,
      endSec: 3,
      position: "bottom",
      style: { fontSize: 24, color: "#fff", bold: true },
    });
    expect(c.overlayCount).toBe(1);
  });

  it("5a. image overlay: empty url throws", () => {
    const c = new VideoComposer();
    const o: ImageOverlay = {
      kind: "image",
      imageUrl: "",
      startSec: 0,
      endSec: 1,
      opacity: 0.5,
      position: { x: 10, y: 10 },
    };
    expect(() => c.addOverlay(o)).toThrow(TypeError);
  });

  it("5b. image overlay: opacity out of [0,1] throws", () => {
    const c = new VideoComposer();
    expect(() =>
      c.addOverlay({
        kind: "image",
        imageUrl: "x",
        startSec: 0,
        endSec: 1,
        opacity: -0.1,
        position: { x: 0, y: 0 },
      })
    ).toThrow(RangeError);
    expect(() =>
      c.addOverlay({
        kind: "image",
        imageUrl: "x",
        startSec: 0,
        endSec: 1,
        opacity: 1.5,
        position: { x: 0, y: 0 },
      })
    ).toThrow(RangeError);
  });
});

describe("VideoComposer — addTransition", () => {
  it("6a. addTransition: unknown from-clip throws", () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" }));
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 10, sceneId: "s2" }));
    expect(() => c.addTransition("ghost", "b", "fade")).toThrow(/unknown from clip/);
  });

  it("6b. addTransition: unknown to-clip throws", () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" }));
    expect(() => c.addTransition("a", "ghost", "cut")).toThrow(/unknown to clip/);
  });

  it("6c. addTransition: success", () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" }));
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 10, sceneId: "s2" }));
    c.addTransition("a", "b", "dissolve", 1.0);
    expect(c.transitionCount).toBe(1);
    const ts = c.getTransitions();
    expect(ts[0].type).toBe("dissolve");
    expect(ts[0].durationSec).toBe(1.0);
  });
});

describe("VideoComposer — compose()", () => {
  it("7. compose: empty clips throws", async () => {
    const c = new VideoComposer();
    await expect(c.compose({ clips: [] })).rejects.toThrow(/at least one clip/);
  });

  it("8. compose: success returns outputUrl, duration, scenes", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" })); // 0-5
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 12, sceneId: "s2" })); // 5-12
    const r = await c.compose({ clips: c.getClips() });
    expect(r.outputUrl).toMatch(/^mock:\/\/compose\//);
    expect(r.duration).toBe(12);
    expect(r.scenes.length).toBe(2);
    expect(r.scenes[0].sceneId).toBe("scene-1");
    expect(r.scenes[1].endSec).toBe(12);
  });

  it("9. compose accepts audioTrack and subtitleTrack", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip());
    const r = await c.compose({
      clips: c.getClips(),
      audioTrack: { url: "mock://audio/bgm.mp3", startSec: 0, loop: true, volume: 0.6 },
      subtitleTrack: {
        cues: [{ text: "Hello", startSec: 0, endSec: 2 }],
      },
    });
    expect(r.duration).toBe(5);
  });

  it("10. compose: invalid audio volume throws", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip());
    await expect(
      c.compose({
        clips: c.getClips(),
        audioTrack: { url: "x", startSec: 0, loop: false, volume: 2.0 },
      })
    ).rejects.toThrow(RangeError);
  });
});

describe("VideoComposer — duration calc & overlap", () => {
  it("11. duration = max(endSec) across clips", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a", startSec: 0, endSec: 3 }));
    c.addClip(makeClip({ id: "b", startSec: 3, endSec: 8, sceneId: "s2" }));
    c.addClip(makeClip({ id: "c", startSec: 8, endSec: 15, sceneId: "s3" }));
    const r = await c.compose({ clips: c.getClips() });
    expect(r.duration).toBe(15);
  });

  it("12. single clip duration = endSec", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ startSec: 0, endSec: 7 }));
    const r = await c.compose({ clips: c.getClips() });
    expect(r.duration).toBe(7);
  });

  it("13. overlapping clips: duration = max(endSec), no throw", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a", startSec: 0, endSec: 10 }));
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 12, sceneId: "s2" }));
    const r = await c.compose({ clips: c.getClips() });
    expect(r.duration).toBe(12);
  });
});

describe("VideoComposer — exportProject()", () => {
  it("14. exportProject: three formats (mp4/webm/gif)", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ startSec: 0, endSec: 10 }));
    await c.compose({ clips: c.getClips() });
    const mp4 = await c.exportProject({ format: "mp4" });
    expect(mp4.format).toBe("mp4");
    expect(mp4.url).toMatch(/\.mp4$/);
    expect(mp4.size).toBeGreaterThan(0);
    expect(mp4.duration).toBe(10);

    const webm = await c.exportProject({ format: "webm" });
    expect(webm.format).toBe("webm");
    expect(webm.url).toMatch(/\.webm$/);

    const gif = await c.exportProject({ format: "gif" });
    expect(gif.format).toBe("gif");
    expect(gif.url).toMatch(/\.gif$/);
    // gif 应比 mp4 小 (factor 60 vs 100)
    expect(gif.size).toBeLessThan(mp4.size);
  });

  it("15. exportProject: no clips throws", async () => {
    const c = new VideoComposer();
    await expect(c.exportProject({ format: "mp4" })).rejects.toThrow(/at least one clip/);
  });

  it("16. exportProject: invalid format throws", async () => {
    const c = new VideoComposer();
    c.addClip(makeClip());
    await c.compose({ clips: c.getClips() });
    await expect(
      c.exportProject({ format: "avi" as unknown as "mp4" })
    ).rejects.toThrow(RangeError);
  });
});

describe("VideoComposer — getters and reset", () => {
  it("17. getters return copies (mutating result doesn't affect internal state)", () => {
    const c = new VideoComposer();
    c.addClip(makeClip());
    const clips = c.getClips();
    clips.pop();
    expect(c.clipCount).toBe(1);
  });

  it("18. reset() clears clips/overlays/transitions", () => {
    const c = new VideoComposer();
    c.addClip(makeClip({ id: "a" }));
    c.addClip(makeClip({ id: "b", startSec: 5, endSec: 10, sceneId: "s2" }));
    c.addOverlay({ kind: "text", text: "hi", startSec: 0, endSec: 1, position: "top" });
    c.addTransition("a", "b", "cut");
    c.reset();
    expect(c.clipCount).toBe(0);
    expect(c.overlayCount).toBe(0);
    expect(c.transitionCount).toBe(0);
  });
});
