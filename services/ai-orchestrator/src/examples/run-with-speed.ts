/**
 * 速度模式跑：速度优先策略 + 限时 60s
 *
 * 策略：
 *   - 全用 volcengine（国内最快）
 *   - 短上下文（截前 800 字）
 *   - 限单步超时 10s，整体限时 60s
 *   - 并行 image-gen / video-gen（mock 模拟并行延迟降低）
 *
 * 用法：
 *   MOCK=1 tsx src/examples/run-with-speed.ts
 */

import { buildInput, isMock, loadDemoNovel, makeUser, printRunResult, runOnce } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks, setMockOptions } from "../e2e/test-helpers/mock-providers.js";
import type { ProviderId } from "../clients/ai-router.js";

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  run-with-speed（速度优先策略）                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  const DEADLINE_MS = 60_000;
  const speedRoute: Partial<Record<string, ProviderId>> = {
    storyboard: "volcengine",
    character: "volcengine",
    scene: "volcengine",
    "image-gen": "volcengine",
    "video-gen": "volcengine",
    tts: "volcengine",
  };

  if (isMock()) {
    installMocks();
    setMockOptions({ routeOverride: speedRoute, latencyMs: 2 });
    console.log("🧪 mock 模式 + latencyMs=2（模拟极速）");
  } else {
    console.log("🌐 真实模式：所有步骤走 volcengine（限 60s 内完成）");
  }

  const startTime = Date.now();

  try {
    const text = await loadDemoNovel();
    const user = makeUser("pro", false);
    // 截短文本提速度
    const input = buildInput({
      text: text.slice(0, 800),
      chapterTitle: "便利店之夜-速度模式",
      durationSeconds: 30, // 30s 更短
    });

    const result = await runOnce(input, user);
    const totalMs = Date.now() - startTime;
    printRunResult(result);

    const withinDeadline = totalMs <= DEADLINE_MS;
    console.log("\n─────── 速度验证 ───────");
    console.log(`总耗时        : ${totalMs}ms`);
    console.log(`Deadline      : ${DEADLINE_MS}ms`);
    console.log(`Within limit  : ${withinDeadline ? "✅" : "❌ 超时"}`);
    console.log(`吞吐量        : ${(60_000 / Math.max(1, totalMs)).toFixed(2)} 集/分钟`);

    if (!withinDeadline) {
      console.error("❌ 超过 60s deadline");
      process.exit(1);
    }
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[run-with-speed] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
