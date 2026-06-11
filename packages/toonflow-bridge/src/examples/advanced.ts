/**
 * 高级用例：自定义 prompt + BYOK
 *
 * 演示：
 *   - 自定义 workflow 节点 label / params（含自定义 L1 角色、负面 prompt）
 *   - BYOK（Bring Your Own Key）：用户自带 image / video / tts key
 *   - 通过 callbackUrl + WS 双重进度回推
 *   - 显式 start() 拿 handle,订阅 onProgress,再 waitForResult()
 *
 * 启动前提：同 basic.ts
 *
 * 运行：
 *   pnpm --filter @manhuaworks/toonflow-bridge example:advanced
 */

import { ToonflowBridge } from "../index.js";
import type {
  ToonflowCharacter,
  ToonflowRunRequest,
  ToonflowWorkflow,
} from "../types/toonflow.js";

const characters: ToonflowCharacter[] = [
  {
    name: "林启",
    description: "考古助理，28 岁，沉静寡言，灰色长款风衣",
    referenceImageUrl: "https://cdn.example.com/refs/linqi.png",
  },
  {
    name: "江晓月",
    description: "大学讲师，27 岁，温婉，左腕一串琥珀珠",
    referenceImageUrl: "https://cdn.example.com/refs/jiangxy.png",
  },
];

const workflow: ToonflowWorkflow = {
  workflowId: "wf-advanced-007",
  version: "toonflow/1.0",
  defaultPrompt: "末日机甲 · 第二章",
  characters,
  nodes: [
    {
      id: "n1",
      kind: "input_text",
      label: "末日机甲第二章原文",
      params: {
        negativePrompt: "lowres, blurry, deformed hands, extra fingers",
      },
    },
    {
      id: "n2",
      kind: "extract_characters",
      label: "提取 L1 角色",
      params: { characterHints: characters.map((c) => c.name) },
    },
    {
      id: "n3",
      kind: "generate_storyboard",
      label: "分镜（机甲）",
      params: { storyType: "scifi_mecha" },
    },
    {
      id: "n4",
      kind: "image_diffusion",
      label: "出图（赛博朋克）",
      params: {
        artStyle: "manhua_chinese",
        negativePrompt: "watermark, text, low quality",
        steps: 30,
        cfgScale: 7.5,
      },
    },
    {
      id: "n5",
      kind: "tts",
      label: "TTS（火山）",
      params: { provider: "volcengine", voice: "BV001_streaming" },
    },
    {
      id: "n6",
      kind: "video_animate",
      label: "动起来（4 秒/镜）",
      params: { durationSeconds: 90, motionStrength: 0.6 },
    },
    {
      id: "n7",
      kind: "compose",
      label: "合成 mp4",
      params: { resolution: "1080p", fps: 30 },
    },
    { id: "n8", kind: "output_mp4", params: {} },
  ],
  edges: [
    { from: "n1", to: "n2" },
    { from: "n1", to: "n3" },
    { from: "n2", to: "n3", fromPort: "characters", toPort: "characters" },
    { from: "n3", to: "n4", fromPort: "shots", toPort: "shots" },
    { from: "n4", to: "n6", fromPort: "images", toPort: "images" },
    { from: "n5", to: "n6", fromPort: "audio", toPort: "audio" },
    { from: "n6", to: "n7" },
    { from: "n7", to: "n8" },
  ],
};

const request: ToonflowRunRequest = {
  workflowId: workflow.workflowId,
  inputs: {
    text: [
      "破晓前，灰雾还没散。林启把校准仪塞回背包，瞥了一眼腕上的琥珀珠 ——",
      "「读数 0.973。」「偏差在阈值内。」",
      "江晓月摘下护目镜，呼出的白气被风一卷就没了。她说：'回去吧，今天不适合'。",
    ].join(""),
    chapterTitle: "末日机甲 · 第二章 · 灰雾校准",
  },
  byok: {
    imageKey: process.env.USER_IMAGE_KEY ?? "sk-user-image-xxx",
    videoKey: process.env.USER_VIDEO_KEY ?? "sk-user-video-xxx",
    ttsKey: process.env.USER_TTS_KEY ?? "sk-user-tts-xxx",
  },
  callbackUrl: "https://toonflow.example.com/cb/abc123",
};

async function main(): Promise<void> {
  const bridge = new ToonflowBridge({
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? "http://127.0.0.1:8087",
    orchestratorToken: process.env.ORCH_TOKEN,
    toonflowWsUrl: process.env.TOONFLOW_WS_URL, // 例如 wss://toonflow.example.com
    toonflowToken: process.env.TOONFLOW_TOKEN,
    pollIntervalMs: 3_000,
    timeoutMs: 30 * 60_000,
    logger: (line) => process.stdout.write(`[bridge] ${line}\n`),
  });

  process.stdout.write("[advanced] starting (BYOK + WS)...\n");
  const handle = await bridge.start(workflow, request, {
    onProgress: (ev) => {
      process.stdout.write(
        `[progress] ${ev.status.padEnd(10)} ${String(ev.progress).padStart(4)}% step=${ev.currentNodeId ?? "-"}\n`,
      );
    },
  });
  process.stdout.write(`[advanced] jobId=${handle.jobId} runId=${handle.runId}\n`);

  // 主线程可以同时做别的事，比如心跳、UI 更新、调用 handle.latestSnapshot() 等
  const pingInterval = setInterval(async () => {
    try {
      const snap = await handle.latestSnapshot();
      process.stdout.write(`[heartbeat] runId=${handle.runId} snapshot.status=${(snap as { status?: string }).status}\n`);
    } catch {
      /* swallow */
    }
  }, 15_000);

  try {
    const result = await handle.waitForResult();
    process.stdout.write("\n=== ToonflowJobResult ===\n");
    process.stdout.write(`finalVideoUrl: ${result.finalVideoUrl}\n`);
    process.stdout.write(`shots:         ${result.shots.length}\n`);
    process.stdout.write(`cost:          $${result.costUsd.toFixed(4)}\n`);
    process.stdout.write(`latency:       ${(result.totalLatencyMs / 1000).toFixed(1)}s\n`);
  } finally {
    clearInterval(pingInterval);
  }
}

main().catch((err) => {
  process.stderr.write(`[advanced] failed: ${err.stack ?? err.message}\n`);
  process.exit(1);
});
