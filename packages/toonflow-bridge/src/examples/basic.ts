/**
 * 基础用例：5 步生成 1 集
 *
 * 演示最简用法：
 *   - 构造一个 Toonflow workflow（5 个核心节点）
 *   - 启动 bridge.run()
 *   - 同步等待 ToonflowJobResult
 *
 * 启动前提：
 *   - ai-orchestrator 跑在 http://127.0.0.1:8087（或设 ORCHESTRATOR_URL）
 *   - 设 ORCH_TOKEN（如果 ai-orchestrator 启用了 auth）
 *
 * 运行：
 *   pnpm --filter @manhuaworks/toonflow-bridge example:basic
 */

import { ToonflowBridge } from "../index.js";
import type {
  ToonflowRunRequest,
  ToonflowWorkflow,
} from "../types/toonflow.js";

const workflow: ToonflowWorkflow = {
  workflowId: "wf-basic-001",
  version: "toonflow/1.0",
  defaultPrompt: "第 1 章 · 雨夜重逢",
  nodes: [
    { id: "n1", kind: "input_text", label: "用户原文", params: {} },
    { id: "n2", kind: "generate_storyboard", params: { storyType: "sweet_romance_novel" } },
    { id: "n3", kind: "image_diffusion", params: { artStyle: "anime" } },
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

const request: ToonflowRunRequest = {
  workflowId: workflow.workflowId,
  inputs: {
    text: [
      "雨夜的便利店，灯光昏黄。她刚收完货架，手机屏幕忽然亮起 ——",
      "「好久不见。」",
      "三年了。名字没换，头像没换，签名档却多了一句：今夜有雨，别来。",
    ].join(""),
    chapterTitle: "第 1 章 · 雨夜重逢",
  },
};

async function main(): Promise<void> {
  const bridge = new ToonflowBridge({
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? "http://127.0.0.1:8087",
    orchestratorToken: process.env.ORCH_TOKEN,
    // toonflowWsUrl 留空 → 不推送，单纯 onProgress 回调
    logger: (line) => process.stdout.write(`[bridge] ${line}\n`),
  });

  process.stdout.write("[basic] starting...\n");
  const result = await bridge.run(workflow, request, {
    timeoutMs: 10 * 60_000,
    onProgress: (ev) => {
      process.stdout.write(
        `[progress] ${ev.status} ${ev.progress}% step=${ev.currentNodeId ?? "-"}\n`,
      );
    },
  });

  process.stdout.write("\n=== ToonflowJobResult ===\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`[basic] failed: ${err.stack ?? err.message}\n`);
  process.exit(1);
});
