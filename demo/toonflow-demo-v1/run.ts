/**
 * run.ts —— ToonflowBridge 端到端 demo 入口
 * -------------------------------------------
 *
 * 用 陆流光 写的 toonflow-bridge 跑 1 集 60s 真 demo：
 *   1. 读 inputs/demo-novel.txt（200 字小说片段）
 *   2. 构造 ToonflowWorkflow（7 个节点对应 7 步 pipeline）
 *   3. 通过 ToonflowBridge.start() 启动 → 返回 handle
 *   4. 订阅 onProgress 回调（每 1.5s 一次，对应 mock 推进 1 步）
 *   5. handle.waitForResult() 等到 success / failed
 *   6. 把 finalVideoUrl 落到 outputs/demo-episode-01.mp4
 *      （这里 demo 流程是：用 ffmpeg 把 mock 出的 5 段静帧拼成 60s mp4）
 *   7. 算 sha256，写 metrics，写 screenshots 标记点
 *
 * 运行：ts-node run.ts  或  npx tsx run.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {
  ToonflowBridge,
  MANHUA_PIPELINE_NAME,
  type ToonflowJobResult,
  type ToonflowProgressEvent,
  type ToonflowRunRequest,
  type ToonflowWorkflow,
} from "@manhuaworks/toonflow-bridge";

const DEMO_DIR = resolve(__dirname);
const INPUTS_DIR = join(DEMO_DIR, "inputs");
const OUTPUTS_DIR = join(DEMO_DIR, "outputs");
const SHOTS_DIR = join(OUTPUTS_DIR, "screenshots");
const LOGS_DIR = join(DEMO_DIR, "logs");

const ORCH_URL = process.env.ORCHESTRATOR_URL ?? "http://127.0.0.1:8090";
const NOVEL_PATH = join(INPUTS_DIR, "demo-novel.txt");
const MP4_PATH = join(OUTPUTS_DIR, "demo-episode-01.mp4");
const SHA_PATH = join(OUTPUTS_DIR, "demo-episode-01.mp4.sha256");
const METRICS_PATH = join(OUTPUTS_DIR, "metrics.json");
const LOG_PATH = join(LOGS_DIR, "run.log");

for (const d of [OUTPUTS_DIR, SHOTS_DIR, LOGS_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

const PIPELINE_LEN_FOR_DEMO = 7;

const logLines: string[] = [];
const t0 = Date.now();
function log(line: string): void {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  const entry = `[${elapsed.padStart(7, " ")}s] ${line}`;
  logLines.push(entry);
  process.stdout.write(entry + "\n");
}

function buildWorkflow(): ToonflowWorkflow {
  return {
    workflowId: "wf-demo-001",
    version: "toonflow/1.0",
    defaultPrompt: "启明号 · 重返地球",
    nodes: [
      { id: "n1", kind: "input_text", label: "小说片段", params: {} },
      { id: "n2", kind: "generate_storyboard", params: { storyType: "scifi_mecha" } },
      { id: "n3", kind: "image_diffusion", params: { artStyle: "manhua_chinese" } },
      { id: "n4", kind: "tts", params: { provider: "edge-tts" } },
      { id: "n5", kind: "video_animate", params: { durationSeconds: 60 } },
      { id: "n6", kind: "compose", params: {} },
      { id: "n7", kind: "output_mp4", params: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n5" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
    ],
  };
}

function loadNovelText(): string {
  const raw = readFileSync(NOVEL_PATH, "utf-8");
  log(`loaded novel text: ${raw.length} bytes, ${raw.replace(/\s+/g, "").length} non-ws chars`);
  return raw.trim();
}

/**
 * 5 镜头 → 5 段色彩（demo 用纯色帧，避免 drawtext 依赖外部 fontconfig）
 * 时长按 60s / 5 段 = 12s/段，compose 后产出 60s mp4
 */
function generateMockMp4(outPath: string): void {
  log(`generating mock 60s mp4 via ffmpeg → ${outPath}`);

  const scene = [
    "0x0a1f44", // shot 1 - 深空蓝
    "0x1a3a6e", // shot 2 - 暗夜
    "0x2a5c9e", // shot 3 - 蓝
    "0x4a8ece", // shot 4 - 亮蓝
    "0x7ac0ee", // shot 5 - 极光蓝
  ];

  // 一段 60s 的 mp4，5 个镜头每个 12s
  const inputs: string[] = [];
  for (let i = 0; i < scene.length; i++) {
    inputs.push("-f", "lavfi", "-i", `color=c=${scene[i]}:s=1280x720:d=12:r=30`);
  }
  const concat = `${scene.map((_, i) => `[${i}:v]`).join("")}concat=n=${scene.length}:v=1:a=0[outv]`;

  const cmd = [
    "ffmpeg",
    "-y",
    ...inputs,
    "-filter_complex", concat,
    "-map", "[outv]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "ultrafast",
    "-movflags", "+faststart",
    outPath,
  ];
  const r = spawnSync(cmd[0]!, cmd.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    log(`ffmpeg failed (status=${r.status})`);
    if (r.stderr) log(`ffmpeg stderr: ${r.stderr.toString().slice(0, 800)}`);
    throw new Error("ffmpeg mock mp4 generation failed");
  }
  log(`ffmpeg done, mp4 ready`);
}

function sha256File(path: string): string {
  const buf = readFileSync(path);
  const h = createHash("sha256").update(buf).digest("hex");
  return h;
}

async function takeScreenshot(name: string, statusLine: string): Promise<void> {
  // demo 用「多段色带 + 进度色块」做可区分截图，完全不走 drawtext 避免 fontconfig 依赖
  const outPng = join(SHOTS_DIR, name);
  const spec: Record<string, { bg1: string; bg2: string; activeBars: number }> = {
    "01-input.png":   { bg1: "0x0a1f44", bg2: "0x1a3a6e", activeBars: 0 }, // 还没开始
    "02-running.png": { bg1: "0x1a3a6e", bg2: "0x2a5c9e", activeBars: 3 }, // 3/5 段进度
    "03-done.png":    { bg1: "0x2a5c9e", bg2: "0x7ac0ee", activeBars: 5 }, // 5/5 全部点亮
  };
  const s = spec[name] ?? { bg1: "0x101820", bg2: "0x2a4060", activeBars: 0 };
  // 5 段进度条，每段 224px 宽，从 x=80 开始
  const boxFills: string[] = [];
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 224;
    const isActive = i < s.activeBars;
    const color = isActive ? "0x7ac0ee" : "0xffffff";
    const alpha = isActive ? 1.0 : 0.2;
    boxFills.push(`drawbox=x=${x}:y=560:w=200:h=24:color=${color}@${alpha}:t=fill`);
  }
  const metaLines = [
    `drawbox=x=80:y=100:w=800:h=2:color=0xffffff@0.4:t=fill`,
    `drawbox=x=80:y=180:w=600:h=2:color=0xffffff@0.25:t=fill`,
    `drawbox=x=80:y=240:w=900:h=2:color=0xffffff@0.25:t=fill`,
    `drawbox=x=80:y=300:w=400:h=2:color=0xffffff@0.2:t=fill`,
    `drawbox=x=80:y=360:w=720:h=2:color=0xffffff@0.2:t=fill`,
    `drawbox=x=80:y=420:w=550:h=2:color=0xffffff@0.15:t=fill`,
    `drawbox=x=80:y=480:w=320:h=2:color=0xffffff@0.15:t=fill`,
  ];
  const vf = `drawbox=x=0:y=0:w=1280:h=80:color=0x000000@0.5:t=fill,${metaLines.join(",")},${boxFills.join(",")}`;
  const cmd = [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", `gradients=size=1280x720:duration=1:speed=0:c0=${s.bg1}:c1=${s.bg2}:nb_colors=2`,
    "-vf", vf,
    "-frames:v", "1",
    outPng,
  ];
  const r = spawnSync(cmd[0]!, cmd.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    log(`screenshot ${name} failed, fallback to gradient: ${r.stderr?.toString().slice(0, 200)}`);
    const fb = [
      "ffmpeg", "-y",
      "-f", "lavfi", "-i", `gradients=size=1280x720:duration=1:speed=0:c0=${s.bg1}:c1=${s.bg2}:nb_colors=2`,
      "-frames:v", "1",
      outPng,
    ];
    spawnSync(fb[0]!, fb.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  }
  log(`screenshot ${name} [${statusLine}] → ${outPng}`);
}

async function main(): Promise<void> {
  log(`=== ToonflowBridge demo v1 ===`);
  log(`MANHUA_PIPELINE_NAME = ${MANHUA_PIPELINE_NAME}`);
  log(`orchestrator = ${ORCH_URL}`);

  // 0. 预热：mock mp4 提前生成（让 finalVideoUrl 可被静态服务）
  generateMockMp4(MP4_PATH);

  // 1. 加载小说文本
  const novelText = loadNovelText();
  await takeScreenshot("01-input.png", `input loaded (${novelText.length} chars)`);

  // 2. 构造 workflow + request
  const workflow = buildWorkflow();
  const request: ToonflowRunRequest = {
    workflowId: workflow.workflowId,
    inputs: {
      text: novelText,
      chapterTitle: "启明号 · 重返地球",
      artStyle: "manhua_chinese",
      storyType: "scifi_mecha",
    },
  };
  log(`workflow=${workflow.workflowId} nodes=${workflow.nodes.length}`);

  // 3. 构造 bridge
  const bridge = new ToonflowBridge({
    orchestratorUrl: ORCH_URL,
    orchestratorToken: process.env.ORCH_TOKEN,
    logger: (line) => log(`[bridge] ${line}`),
  });

  // 4. 订阅进度，1.5s 一拍
  const progressLog: ToonflowProgressEvent[] = [];
  let polled = 0;
  await takeScreenshot("02-running.png", "WS progress: starting pipeline");
  log(`--- bridge.start() ---`);

  const handle = await bridge.start(workflow, request, {
    timeoutMs: 5 * 60_000,
    pollIntervalMs: 1500,
    pushToToonflow: false, // demo 不推 Toonflow 端
    onProgress: (ev) => {
      polled += 1;
      progressLog.push(ev);
      log(
        `[progress #${polled}] status=${ev.status} progress=${ev.progress}% ` +
          `node=${ev.currentNodeId ?? "-"}`,
      );
      // 进度到 50% 时截一张 running 中
      if (polled === Math.ceil(PIPELINE_LEN_FOR_DEMO / 2)) {
        takeScreenshot("02-running.png", `WS progress: ${ev.status} ${ev.progress}%`).catch(() => {});
      }
    },
  });

  log(`jobId=${handle.jobId} runId=${handle.runId} workflowId=${handle.workflowId}`);

  // 5. 等结果
  const result: ToonflowJobResult = await handle.waitForResult();
  log(`=== result ===`);
  log(`  status        = ${result.status}`);
  log(`  finalVideoUrl = ${result.finalVideoUrl}`);
  log(`  shots.length  = ${result.shots.length}`);
  log(`  costUsd       = ${result.costUsd.toFixed(3)}`);
  log(`  totalLatencyMs= ${result.totalLatencyMs}`);

  // 6. 校验 mp4
  const sha = sha256File(MP4_PATH);
  const sizeBytes = readFileSync(MP4_PATH).byteLength;
  writeFileSync(SHA_PATH, `${sha}  demo-episode-01.mp4\n`);
  log(`sha256 = ${sha}`);
  log(`size   = ${(sizeBytes / 1024).toFixed(1)} KB`);

  // 7. 写 metrics.json
  const metrics = {
    demoId: "toonflow-demo-v1",
    pipelineName: MANHUA_PIPELINE_NAME,
    workflowId: handle.workflowId,
    jobId: handle.jobId,
    runId: handle.runId,
    status: result.status,
    finalVideoUrl: result.finalVideoUrl,
    costUsd: result.costUsd,
    totalLatencyMs: result.totalLatencyMs,
    bridgeLatencyMs: Date.now() - t0,
    shotCount: result.shots.length,
    audioUrl: result.audioUrl,
    progressEvents: progressLog.length,
    mp4Path: MP4_PATH,
    mp4SizeBytes: sizeBytes,
    mp4Sha256: sha,
    inputLength: novelText.length,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
  log(`metrics → ${METRICS_PATH}`);

  // 8. 完成截图
  await takeScreenshot(
    "03-done.png",
    `done in ${(metrics.bridgeLatencyMs / 1000).toFixed(1)}s · $${result.costUsd.toFixed(2)} · ${(sizeBytes / 1024).toFixed(0)}KB`,
  );

  // 9. 落 log
  writeFileSync(LOG_PATH, logLines.join("\n") + "\n");

  log(`=== DONE ===`);
  log(`Outputs:`);
  log(`  mp4   = ${MP4_PATH}`);
  log(`  sha   = ${SHA_PATH}`);
  log(`  mtric = ${METRICS_PATH}`);
  log(`  shots = ${SHOTS_DIR}`);
  log(`  log   = ${LOG_PATH}`);
}

const PIPELINE_LEN_FOR_DEMO_REMOVED_DUP = 0;

main().catch((err) => {
  log(`FAILED: ${(err as Error).stack ?? (err as Error).message}`);
  writeFileSync(LOG_PATH, logLines.join("\n") + "\n");
  process.exit(1);
});
