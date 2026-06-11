/**
 * Mock ai-orchestrator
 * --------------------
 * 100% 兼容 toonflow-bridge 的 HTTP 契约，但不真跑 AI pipeline：
 *   - POST /v1/orchestrate/novel-to-drama  → 启动一个 run
 *   - GET  /v1/orchestrate/runs/:runId    → 返回 RunSnapshot
 *   - GET  /v1/orchestrate/health         → 健康检查
 *   - POST /v1/orchestrate/runs/:runId/cancel
 *
 * 行为：起 run 后，立刻进入 running 状态，按 1.5s/step 的节奏推进
 *      7 个 step（storyboard → character → scene → image-gen → tts → video-gen → compose），
 *      最终把 finalVideoUrl 指到 outputs/demo-episode-01.mp4（bridge 产出的真实 mp4）。
 *
 * 端口：8090（避开 8083-8088 的正式服务区间）
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import type {
  CostSummary,
  RunSnapshot,
  RunStatus,
  StepResult,
} from "@manhuaworks/toonflow-bridge";

const PORT = parseInt(process.env.MOCK_ORCH_PORT ?? "8090", 10);
const FINAL_VIDEO_URL = process.env.MOCK_FINAL_VIDEO_URL ??
  `http://127.0.0.1:${PORT}/output/demo-episode-01.mp4`;
const STEP_INTERVAL_MS = parseInt(process.env.MOCK_STEP_INTERVAL_MS ?? "1500", 10);
const TOTAL_COST_USD = 0.42;

interface RunRecord {
  runId: string;
  userId: string;
  tier: RunSnapshot["tier"];
  pipeline: string;
  inputs: Record<string, unknown>;
  status: RunStatus;
  steps: Record<string, StepResult>;
  costSummary: CostSummary;
  createdAt: number;
  updatedAt: number;
  error?: string;
  timer: NodeJS.Timeout | null;
  currentStepIdx: number;
  startedAt: number;
}

const PIPELINE_STEPS = [
  "storyboard",
  "character",
  "scene",
  "image-gen",
  "tts",
  "video-gen",
  "compose",
] as const;
type PipelineStep = (typeof PIPELINE_STEPS)[number];

const STAGE_COSTS: Record<PipelineStep, number> = {
  storyboard: 0.02,
  character: 0.04,
  scene: 0.05,
  "image-gen": 0.12,
  tts: 0.04,
  "video-gen": 0.12,
  compose: 0.03,
};

const runs = new Map<string, RunRecord>();

function nowMs(): number {
  return Date.now();
}

function log(line: string): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[mock-orch ${ts}] ${line}\n`);
}

function emptySteps(): Record<string, StepResult> {
  const out: Record<string, StepResult> = {};
  for (const s of PIPELINE_STEPS) {
    out[s] = {
      name: s,
      status: "pending",
      costUsd: 0,
      latencyMs: 0,
      startedAt: 0,
      attempt: 0,
    };
  }
  return out;
}

function zeroCost(): CostSummary {
  return {
    totalCostUsd: 0,
    totalLatencyMs: 0,
    stepCount: PIPELINE_STEPS.length,
    byProvider: {},
    byStep: {},
    byokCostUsd: 0,
    platformCostUsd: 0,
  };
}

function buildStepOutputs(
  step: PipelineStep,
  runId: string,
): Record<string, unknown> {
  const base = { runId };
  switch (step) {
    case "storyboard":
      return { ...base, shotCount: 5, chapterTitle: "启明号 · 重返地球" };
    case "character":
      return { ...base, characters: ["林启", "素问（AI）"] };
    case "scene":
      return { ...base, sceneCount: 3 };
    case "image-gen":
      return {
        ...base,
        imageUrls: [
          "http://127.0.0.1:8090/output/shot-1.png",
          "http://127.0.0.1:8090/output/shot-2.png",
          "http://127.0.0.1:8090/output/shot-3.png",
          "http://127.0.0.1:8090/output/shot-4.png",
          "http://127.0.0.1:8090/output/shot-5.png",
        ],
        runIds: ["img-1", "img-2", "img-3", "img-4", "img-5"],
      };
    case "tts":
      return {
        ...base,
        audioUrl: "http://127.0.0.1:8090/output/narration.mp3",
        durationMs: 60_000,
      };
    case "video-gen":
      return {
        ...base,
        videoUrls: [
          "http://127.0.0.1:8090/output/clip-1.mp4",
          "http://127.0.0.1:8090/output/clip-2.mp4",
          "http://127.0.0.1:8090/output/clip-3.mp4",
          "http://127.0.0.1:8090/output/clip-4.mp4",
          "http://127.0.0.1:8090/output/clip-5.mp4",
        ],
        runIds: ["vid-1", "vid-2", "vid-3", "vid-4", "vid-5"],
      };
    case "compose":
      return {
        ...base,
        finalVideoUrl: FINAL_VIDEO_URL,
        durationSeconds: 60,
      };
  }
}

function advanceRun(rec: RunRecord): void {
  // 已是终态则不再推进
  if (rec.status === "success" || rec.status === "failed" || rec.status === "cancelled") {
    return;
  }

  const idx = rec.currentStepIdx;
  if (idx >= PIPELINE_STEPS.length) {
    // 全部完成
    rec.status = "success";
    rec.updatedAt = nowMs();
    rec.costSummary.totalLatencyMs = rec.updatedAt - rec.startedAt;
    log(`runId=${rec.runId} status=success totalLatencyMs=${rec.costSummary.totalLatencyMs}`);
    return;
  }

  const stepName = PIPELINE_STEPS[idx]!;
  const step = rec.steps[stepName]!;
  const stepStart = nowMs();

  if (step.status === "pending") {
    // 进入 running
    step.status = "running";
    step.startedAt = stepStart;
    step.attempt += 1;
    rec.status = "running";
    rec.updatedAt = stepStart;
    log(`runId=${rec.runId} step=${stepName} status=running`);
  } else if (step.status === "running") {
    // 完成当前 step，进入下一个
    step.status = "success";
    step.finishedAt = nowMs();
    step.latencyMs = step.finishedAt - step.startedAt;
    step.costUsd = STAGE_COSTS[stepName];
    step.outputs = buildStepOutputs(stepName, rec.runId);
    rec.costSummary.totalCostUsd += step.costUsd;
    rec.costSummary.byStep[stepName] = step.costUsd;
    rec.costSummary.byProvider["mock"] =
      (rec.costSummary.byProvider["mock"] ?? 0) + step.costUsd;
    rec.costSummary.platformCostUsd = rec.costSummary.totalCostUsd;
    rec.updatedAt = step.finishedAt;
    log(
      `runId=${rec.runId} step=${stepName} status=success cost=$${step.costUsd.toFixed(2)} latencyMs=${step.latencyMs}`,
    );
    rec.currentStepIdx += 1;
  }

  // 排下一拍
  rec.timer = setTimeout(() => advanceRun(rec), STEP_INTERVAL_MS);
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf-8");
        resolveBody(text ? JSON.parse(text) : {});
      } catch (err) {
        rejectBody(err);
      }
    });
    req.on("error", rejectBody);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function snapshotOf(rec: RunRecord): RunSnapshot {
  return {
    runId: rec.runId,
    pipeline: rec.pipeline,
    userId: rec.userId,
    tier: rec.tier,
    status: rec.status,
    inputs: rec.inputs,
    steps: rec.steps,
    costSummary: rec.costSummary,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    quotaPolicy: null,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const method = req.method ?? "GET";

  // 静默掉浏览器噪音
  if (method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (method === "GET" && url.pathname === "/v1/orchestrate/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "mock-ai-orchestrator",
      pipelines: ["novel-to-drama"],
    });
    return;
  }

  // 启动一个 run
  if (method === "POST" && url.pathname === "/v1/orchestrate/novel-to-drama") {
    let body: Record<string, unknown> = {};
    try {
      body = (await readJson(req)) as Record<string, unknown>;
    } catch (err) {
      sendJson(res, 400, { error: "invalid json", detail: (err as Error).message });
      return;
    }
    const runId = `run_${randomUUID().slice(0, 8)}`;
    const now = nowMs();
    const rec: RunRecord = {
      runId,
      userId: "demo-user",
      tier: "pro",
      pipeline: "novel-to-drama",
      inputs: body,
      status: "pending",
      steps: emptySteps(),
      costSummary: zeroCost(),
      createdAt: now,
      updatedAt: now,
      timer: null,
      currentStepIdx: 0,
      startedAt: now,
    };
    runs.set(runId, rec);
    log(`runId=${runId} start text.len=${String(body.text ?? "").length}`);
    // 立刻推进
    advanceRun(rec);
    sendJson(res, 200, {
      runId,
      status: rec.status,
      snapshot: snapshotOf(rec),
    });
    return;
  }

  // 查 run
  const runMatch = /^\/v1\/orchestrate\/runs\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (method === "GET" && runMatch) {
    const runId = runMatch[1]!;
    const rec = runs.get(runId);
    if (!rec) {
      sendJson(res, 404, { error: "run not found", runId });
      return;
    }
    sendJson(res, 200, snapshotOf(rec));
    return;
  }

  // 取消
  const cancelMatch = /^\/v1\/orchestrate\/runs\/([A-Za-z0-9_-]+)\/cancel$/.exec(url.pathname);
  if (method === "POST" && cancelMatch) {
    const runId = cancelMatch[1]!;
    const rec = runs.get(runId);
    if (!rec) {
      sendJson(res, 404, { error: "run not found", runId });
      return;
    }
    if (rec.timer) clearTimeout(rec.timer);
    rec.status = "cancelled";
    rec.updatedAt = nowMs();
    sendJson(res, 200, { runId, cancelled: true });
    return;
  }

  // 让 bridge 的 ws client 不会因 /output/* 路径报 500
  if (method === "GET" && url.pathname.startsWith("/output/")) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("mock placeholder (real demo mp4 lives in outputs/, not served here)");
    return;
  }

  sendJson(res, 404, { error: "not found", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`mock ai-orchestrator listening on http://127.0.0.1:${PORT}`);
  log(`  finalVideoUrl = ${FINAL_VIDEO_URL}`);
  log(`  step interval = ${STEP_INTERVAL_MS}ms`);
  log(`  expected total = ~${(STEP_INTERVAL_MS * PIPELINE_STEPS.length * 2 / 1000).toFixed(1)}s`);
});

process.on("SIGINT", () => {
  log("SIGINT, shutting down");
  for (const rec of runs.values()) {
    if (rec.timer) clearTimeout(rec.timer);
  }
  server.close(() => process.exit(0));
});
