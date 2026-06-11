/**
 * mapper 双向测试
 *   - toonflow-to-novel：标准 workflow + 各种边界
 *   - novel-to-toonflow：success / failed / cancelled 三态
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { toonflowToNovel, ToonflowMappingError } from "../src/mapper/toonflow-to-novel.js";
import {
  novelToToonflow,
  NovelToToonflowError,
} from "../src/mapper/novel-to-toonflow.js";
import type { ToonflowWorkflow } from "../src/types/toonflow.js";
import type { NovelToDramaOutput, RunSnapshot } from "../src/types/manhua.js";

// ---- 工厂 ----
function baseWorkflow(overrides: Partial<ToonflowWorkflow> = {}): ToonflowWorkflow {
  return {
    workflowId: "wf-test",
    version: "toonflow/1.0",
    nodes: [
      { id: "n1", kind: "input_text" },
      { id: "n2", kind: "generate_storyboard", params: { storyType: "urban_fantasy" } },
      { id: "n3", kind: "image_diffusion", params: { artStyle: "manhua_chinese" } },
      { id: "n4", kind: "tts", params: { provider: "volcengine" } },
      { id: "n5", kind: "video_animate", params: { durationSeconds: 60 } },
      { id: "n6", kind: "compose" },
      { id: "n7", kind: "output_mp4" },
    ],
    edges: [],
    ...overrides,
  };
}

function blankSnap(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    runId: "orch-test123",
    pipeline: "novel-to-drama",
    userId: "u-1",
    tier: "pro",
    status: "success",
    inputs: {},
    steps: {},
    costSummary: {
      totalCostUsd: 0,
      totalLatencyMs: 0,
      stepCount: 0,
      byProvider: {},
      byStep: {},
      byokCostUsd: 0,
      platformCostUsd: 0,
    },
    createdAt: 1,
    updatedAt: 1,
    quotaPolicy: {},
    ...overrides,
  };
}

function successOutput(overrides: Partial<NovelToDramaOutput> = {}): NovelToDramaOutput {
  return {
    storyboardRunId: "sb-1",
    characterRunId: "ch-1",
    imageRunIds: ["img-1", "img-2", "img-3"],
    ttsRunId: "tts-1",
    videoRunIds: ["v-1", "v-2", "v-3"],
    composeRunId: "c-1",
    finalVideoUrl: "https://cdn.example.com/mp4/final.mp4",
    totalCostUsd: 1.234,
    totalLatencyMs: 60_000,
    imageUrls: [
      "https://cdn.example.com/img/1.png",
      "https://cdn.example.com/img/2.png",
      "https://cdn.example.com/img/3.png",
    ],
    videoUrls: [
      "https://cdn.example.com/v/1.mp4",
      "https://cdn.example.com/v/2.mp4",
      "https://cdn.example.com/v/3.mp4",
    ],
    audioUrl: "https://cdn.example.com/audio.mp3",
    ...overrides,
  };
}

// ============================================================
// toonflowToNovel
// ============================================================
describe("toonflowToNovel", () => {
  it("extracts text + artStyle + storyType + tts + duration from a full workflow", () => {
    const wf = baseWorkflow();
    const out = toonflowToNovel(wf, {
      text: "这是一段至少 20 个字符的原文，用于 novel-to-drama 端输入验证。",
    });

    assert.equal(out.text.length > 20, true);
    assert.equal(out.storyType, "urban_fantasy");
    assert.equal(out.artStyle, "manhua_chinese");
    assert.equal(out.ttsProvider, "volcengine");
    assert.equal(out.durationSeconds, 60);
    assert.equal(out.projectId, "wf-test");
  });

  it("falls back to defaults when nodes are missing", () => {
    const wf: ToonflowWorkflow = {
      workflowId: "wf-min",
      version: "toonflow/1.0",
      nodes: [{ id: "n1", kind: "input_text" }],
      edges: [],
    };
    const out = toonflowToNovel(wf, {
      text: "最小节点工作流，仍然要达到 20 字符以上才能让映射通过。",
    });
    assert.equal(out.storyType, "sweet_romance_novel");
    assert.equal(out.artStyle, "anime");
    assert.equal(out.ttsProvider, undefined);
    assert.equal(out.durationSeconds, undefined);
  });

  it("throws on missing / too-short text", () => {
    const wf = baseWorkflow();
    assert.throws(() => toonflowToNovel(wf, { text: "太短" }), ToonflowMappingError);
    assert.throws(() => toonflowToNovel(wf, {}), ToonflowMappingError);
  });

  it("throws on unsupported node kind", () => {
    const wf: ToonflowWorkflow = {
      workflowId: "wf-x",
      version: "toonflow/1.0",
      nodes: [
        { id: "n1", kind: "input_text" },
        { id: "n2", kind: "weird_node" as never },
      ],
      edges: [],
    };
    assert.throws(
      () => toonflowToNovel(wf, { text: "足够长的原文文本，用以满足最小字符约束的测试。" }),
      ToonflowMappingError,
    );
  });

  it("throws on out-of-range durationSeconds", () => {
    const wf = baseWorkflow({
      nodes: [
        { id: "n1", kind: "input_text" },
        { id: "n2", kind: "video_animate", params: { durationSeconds: 5 } },
      ],
    });
    assert.throws(
      () => toonflowToNovel(wf, { text: "二十字以上的文本才能通过 validator 哈" }),
      ToonflowMappingError,
    );
  });

  it("prefers runInputs.artStyle over node params when both present", () => {
    const wf = baseWorkflow();
    const out = toonflowToNovel(wf, {
      text: "二十字以上的文本才能通过 validator。",
      artStyle: "ink_painting",
    });
    assert.equal(out.artStyle, "ink_painting");
  });

  it("ignores invalid artStyle in runInputs (keeps node param value)", () => {
    const wf = baseWorkflow();
    const out = toonflowToNovel(wf, {
      text: "二十字以上的文本才能通过 validator。",
      artStyle: "not-a-style",
    });
    assert.equal(out.artStyle, "manhua_chinese");
  });
});

// ============================================================
// novelToToonflow
// ============================================================
describe("novelToToonflow", () => {
  it("maps a success snapshot to a 'done' result with shots", () => {
    const snap = blankSnap({
      status: "success",
      costSummary: { ...blankSnap().costSummary, totalCostUsd: 1.0, totalLatencyMs: 30_000 },
    });
    const out = novelToToonflow("job-1", "wf-1", snap, successOutput());
    assert.equal(out.status, "done");
    assert.equal(out.finalVideoUrl, "https://cdn.example.com/mp4/final.mp4");
    assert.equal(out.shots.length, 3);
    assert.equal(out.costUsd, 1.234);
    assert.equal(out.totalLatencyMs, 60_000);
    assert.equal(out.audioUrl, "https://cdn.example.com/audio.mp3");
  });

  it("maps a failed snapshot to 'failed' with empty shots", () => {
    const snap = blankSnap({ status: "failed", error: "compose 步炸了" });
    const out = novelToToonflow("job-2", "wf-2", snap);
    assert.equal(out.status, "failed");
    assert.equal(out.shots.length, 0);
    assert.equal(out.finalVideoUrl, "");
    assert.equal(out.error, "compose 步炸了");
  });

  it("maps a cancelled snapshot to 'failed'", () => {
    const snap = blankSnap({ status: "cancelled" });
    const out = novelToToonflow("job-3", "wf-3", snap);
    assert.equal(out.status, "failed");
  });

  it("throws on a non-terminal snapshot (running)", () => {
    const snap = blankSnap({ status: "running" });
    assert.throws(
      () => novelToToonflow("job-4", "wf-4", snap),
      NovelToToonflowError,
    );
  });

  it("throws on a success snapshot missing finalVideoUrl", () => {
    const snap = blankSnap({ status: "success" });
    const out = successOutput({ finalVideoUrl: undefined });
    assert.throws(
      () => novelToToonflow("job-5", "wf-5", snap, out),
      NovelToToonflowError,
    );
  });

  it("attaches subtitleSrt when provided", () => {
    const snap = blankSnap({ status: "success" });
    const out = novelToToonflow("job-6", "wf-6", snap, successOutput(), "1\n00:00:00,000 --> 00:00:01,000\nHi");
    assert.equal(out.subtitleSrt, "1\n00:00:00,000 --> 00:00:01,000\nHi");
  });
});
