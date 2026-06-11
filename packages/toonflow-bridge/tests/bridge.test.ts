/**
 * bridge 端到端测试
 *
 * 策略：起一个本地 HTTP server（Node 原生 http）模拟 ai-orchestrator
 *       5 步 / 7 步状态机，然后让 ToonflowBridge 端到端跑一遍。
 *
 * 覆盖：
 *   - run() 同步路径（成功）
 *   - run() 同步路径（失败）
 *   - progress 5 状态触发
 *   - onProgress 回调频次
 *   - start() + handle.cancel() 路径
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { ToonflowBridge } from "../src/index.js";
import {
  mapSnapToToonflowEvent,
  mapSnapToToonflowStatus,
  mapSnapToProgress,
} from "../src/adapters/progress.js";
import { TOONFLOW_PROGRESS_HINT } from "../src/types/toonflow.js";
import type { ToonflowWorkflow, ToonflowRunRequest } from "../src/types/toonflow.js";
import type { RunSnapshot, StepResult } from "../src/types/manhua.js";

// ============================================================
// Mock ai-orchestrator
// ============================================================
interface MockState {
  runId: string;
  pollCount: number;
  done: boolean;
  fail: boolean;
}

function makeMockServer(): Promise<{
  url: string;
  state: MockState;
  close: () => Promise<void>;
}> {
  const state: MockState = { runId: "orch-mock001", pollCount: 0, done: false, fail: false };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c.toString()));
    req.on("end", () => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");

      if (url === "/health") {
        res.end(
          JSON.stringify({ status: "ok", service: "ai-orchestrator", pipelines: ["novel-to-drama"] }),
        );
        return;
      }

      if (url === "/v1/orchestrate/novel-to-drama" && req.method === "POST") {
        const snap = makeSnap(state, 0); // pending
        res.end(JSON.stringify({ runId: state.runId, status: "pending", snapshot: snap }));
        return;
      }

      const m = url.match(/^\/v1\/orchestrate\/runs\/([^/]+)$/);
      if (m && req.method === "GET") {
        state.pollCount += 1;
        let stepDone: number;
        if (state.fail) {
          stepDone = 2; // 失败在第 3 步
        } else if (state.done) {
          stepDone = 7;
        } else if (state.pollCount >= 6) {
          state.done = true;
          stepDone = 7;
        } else {
          // 渐进：每多 poll 一次，多完成 1.5 步
          stepDone = Math.min(7, Math.floor(state.pollCount * 1.5));
        }
        const snap = makeSnap(state, stepDone);
        res.end(JSON.stringify(snap));
        return;
      }

      if (url.endsWith("/cancel") && req.method === "POST") {
        res.end(JSON.stringify({ runId: state.runId, cancelled: true }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found", path: url }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        state,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

function makeStep(name: string, status: StepResult["status"]): StepResult {
  return {
    name,
    status,
    costUsd: 0.1,
    latencyMs: 100,
    startedAt: 1,
    finishedAt: status === "success" || status === "failed" ? 2 : undefined,
    attempt: 1,
  };
}

function makeSnap(state: MockState, stepsDone: number): RunSnapshot {
  const allSteps = [
    "storyboard",
    "character",
    "scene",
    "image-gen",
    "tts",
    "video-gen",
    "compose",
  ] as const;
  const steps: Record<string, StepResult> = {};
  let outputs: Record<string, unknown> | undefined;
  for (let i = 0; i < allSteps.length; i++) {
    const name = allSteps[i]!;
    if (i < stepsDone) {
      steps[name] = makeStep(name, "success");
      if (name === "compose") {
        outputs = {
          finalVideoUrl: "https://cdn.mock/mp4/final.mp4",
          runId: "compose-1",
        };
        steps[name] = { ...steps[name]!, outputs };
      }
      if (name === "image-gen") {
        steps[name] = {
          ...steps[name]!,
          outputs: {
            imageUrls: [
              "https://cdn.mock/i/1.png",
              "https://cdn.mock/i/2.png",
              "https://cdn.mock/i/3.png",
            ],
            runIds: ["img-1", "img-2", "img-3"],
          },
        };
      }
      if (name === "video-gen") {
        steps[name] = {
          ...steps[name]!,
          outputs: {
            videoUrls: [
              "https://cdn.mock/v/1.mp4",
              "https://cdn.mock/v/2.mp4",
              "https://cdn.mock/v/3.mp4",
            ],
            runIds: ["v-1", "v-2", "v-3"],
          },
        };
      }
      if (name === "tts") {
        steps[name] = { ...steps[name]!, outputs: { audioUrl: "https://cdn.mock/a.mp3", runId: "tts-1" } };
      }
    } else if (i === stepsDone) {
      steps[name] = makeStep(name, "running");
    } else {
      steps[name] = makeStep(name, "pending");
    }
  }

  const isSuccess = stepsDone >= 7;
  const isFailed = state.fail;
  // stepsDone=0 表示刚提交未启动 → pending；>0 → running
  const status: RunSnapshot["status"] = isSuccess
    ? "success"
    : isFailed
    ? "failed"
    : stepsDone === 0
    ? "pending"
    : "running";
  return {
    runId: state.runId,
    pipeline: "novel-to-drama",
    userId: "u-mock",
    tier: "pro",
    status,
    inputs: {},
    steps,
    costSummary: {
      totalCostUsd: 0.7,
      totalLatencyMs: 7000,
      stepCount: stepsDone,
      byProvider: {},
      byStep: {},
      byokCostUsd: 0,
      platformCostUsd: 0.7,
    },
    createdAt: 1,
    updatedAt: 1,
    quotaPolicy: {},
    error: isFailed ? "mock failure" : undefined,
  };
}

// ============================================================
// Tests
// ============================================================
describe("ToonflowBridge", () => {
  let server: Awaited<ReturnType<typeof makeMockServer>>;

  before(async () => {
    server = await makeMockServer();
  });

  after(async () => {
    await server.close();
  });

  it("runs end-to-end to a 'done' ToonflowJobResult", async () => {
    server.state.pollCount = 0;
    server.state.done = false;
    server.state.fail = false;

    const bridge = new ToonflowBridge({
      orchestratorUrl: server.url,
      pollIntervalMs: 5,
      timeoutMs: 10_000,
    });

    const wf: ToonflowWorkflow = {
      workflowId: "wf-e2e-1",
      version: "toonflow/1.0",
      nodes: [
        { id: "n1", kind: "input_text" },
        { id: "n2", kind: "generate_storyboard", params: { storyType: "sweet_romance_novel" } },
        { id: "n3", kind: "image_diffusion", params: { artStyle: "anime" } },
        { id: "n4", kind: "tts", params: { provider: "edge-tts" } },
        { id: "n5", kind: "video_animate", params: { durationSeconds: 60 } },
        { id: "n6", kind: "compose" },
        { id: "n7", kind: "output_mp4" },
      ],
      edges: [],
    };
    const req: ToonflowRunRequest = {
      workflowId: wf.workflowId,
      inputs: {
        text: "二十字以上的原文文本，用以让 mapper 校验通过。这是一个虚构的小段开篇。",
        chapterTitle: "测试章",
      },
    };

    const progressEvents: string[] = [];
    const result = await bridge.run(wf, req, {
      onProgress: (ev) => progressEvents.push(ev.status),
    });

    assert.equal(result.status, "done");
    assert.equal(result.finalVideoUrl, "https://cdn.mock/mp4/final.mp4");
    assert.ok(result.shots.length >= 1);
    // 至少经历 running → composing → done 三个非初态
    assert.ok(progressEvents.includes("running"));
    assert.ok(progressEvents.includes("done"));
  });

  it("surfaces a failed result with an error message", async () => {
    server.state.pollCount = 0;
    server.state.done = false;
    server.state.fail = true;

    const bridge = new ToonflowBridge({
      orchestratorUrl: server.url,
      pollIntervalMs: 5,
      timeoutMs: 10_000,
    });

    const wf: ToonflowWorkflow = {
      workflowId: "wf-e2e-2",
      version: "toonflow/1.0",
      nodes: [
        { id: "n1", kind: "input_text" },
        { id: "n2", kind: "compose" },
      ],
      edges: [],
    };
    const req: ToonflowRunRequest = {
      workflowId: wf.workflowId,
      inputs: { text: "二十字以上的原文文本，用以让 mapper 校验通过。第二条失败路径测试。" },
    };

    const result = await bridge.run(wf, req, { pushToToonflow: false });
    assert.equal(result.status, "failed");
    assert.equal(result.error, "mock failure");
  });

  it("start() returns a handle with cancel()", async () => {
    server.state.pollCount = 0;
    server.state.done = false;
    server.state.fail = false;

    const bridge = new ToonflowBridge({
      orchestratorUrl: server.url,
      pollIntervalMs: 5,
      timeoutMs: 10_000,
    });
    const wf: ToonflowWorkflow = {
      workflowId: "wf-e2e-3",
      version: "toonflow/1.0",
      nodes: [
        { id: "n1", kind: "input_text" },
        { id: "n2", kind: "compose" },
      ],
      edges: [],
    };
    const req: ToonflowRunRequest = {
      workflowId: wf.workflowId,
      inputs: { text: "二十字以上的原文文本，用以让 mapper 校验通过。第三条 cancel 测试。" },
    };

    const handle = await bridge.start(wf, req, { pushToToonflow: false });
    assert.equal(typeof handle.jobId, "string");
    assert.equal(typeof handle.runId, "string");
    await handle.cancel();
  });
});

// ============================================================
// progress mapping
// ============================================================
describe("progress mapping", () => {
  it("maps a pending snap to 'pending' with 0%", () => {
    const snap = makeSnap({ runId: "x", pollCount: 0, done: false, fail: false }, 0);
    assert.equal(mapSnapToToonflowStatus(snap), "pending");
    assert.equal(mapSnapToProgress(snap), 0);
  });

  it("maps an in-progress snap to 'running'", () => {
    const snap = makeSnap({ runId: "x", pollCount: 0, done: false, fail: false }, 3);
    assert.equal(mapSnapToToonflowStatus(snap), "running");
    const p = mapSnapToProgress(snap);
    assert.ok(p > 0 && p < 100);
  });

  it("maps compose-running to 'composing'", () => {
    const snap = makeSnap({ runId: "x", pollCount: 0, done: false, fail: false }, 6);
    // step 6 (compose) is "running"
    assert.equal(snap.steps["compose"]?.status, "running");
    assert.equal(mapSnapToToonflowStatus(snap), "composing");
  });

  it("maps a success snap to 'done' with 100", () => {
    const snap = makeSnap({ runId: "x", pollCount: 0, done: false, fail: false }, 7);
    assert.equal(mapSnapToToonflowStatus(snap), "done");
    assert.equal(mapSnapToProgress(snap), 100);
  });

  it("produces a full event with the current step name", () => {
    const snap = makeSnap({ runId: "x", pollCount: 0, done: false, fail: false }, 3);
    const ev = mapSnapToToonflowEvent("j1", "wf1", snap);
    assert.equal(ev.jobId, "j1");
    assert.equal(ev.workflowId, "wf1");
    assert.ok(typeof ev.progress === "number");
    assert.ok(typeof ev.currentNodeId === "string");
  });

  it("exposes the 5-state progress hint table", () => {
    assert.equal(TOONFLOW_PROGRESS_HINT.done, 100);
    assert.equal(TOONFLOW_PROGRESS_HINT.failed, -1);
  });
});
