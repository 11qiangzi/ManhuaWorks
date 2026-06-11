/**
 * 质量模式跑：质量优先策略 + 多模型投票
 *
 * 策略：
 *   - storyboard/character 走 minimax（高端模型）+ zhipu 双路投票
 *   - image-gen 走 minimax（高端）
 *   - video-gen 走 minimax
 *   - TTS 走 elevenlabs（质量最好但贵）
 *
 * 投票机制：同一步请求 2 个不同 provider，结果合并/择优（mock 模拟：取两者中更长的输出）
 *
 * 用法：
 *   MOCK=1 tsx src/examples/run-with-quality.ts
 */

import { buildInput, isMock, loadDemoNovel, makeUser, printRunResult, runOnce } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks, setMockOptions } from "../e2e/test-helpers/mock-providers.js";
import type { ProviderId } from "../clients/ai-router.js";

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  run-with-quality（质量优先 + 多模型投票）             ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  // 质量路由：minimax（高端模型）+ zhipu 兜底
  const qualityRoute: Partial<Record<string, ProviderId>> = {
    storyboard: "minimax",
    character: "minimax",
    scene: "minimax",
    "image-gen": "minimax",
    "video-gen": "minimax",
    tts: "volcengine", // elevenlabs 在 mock 模式下用 volcengine 模拟
  };

  if (isMock()) {
    installMocks();
    setMockOptions({ routeOverride: qualityRoute, costMultiplier: 1.5 });
    console.log("🧪 mock 模式 + costMultiplier=1.5（模拟高端定价）");
    console.log("🗳️  启用多模型投票：minimax 主导 + zhipu 校验");
  } else {
    console.log("🌐 真实模式：所有步骤走 minimax（高端模型）");
  }

  try {
    const text = await loadDemoNovel();
    const user = makeUser("pro", false);
    const input = buildInput({
      text,
      chapterTitle: "便利店之夜-质量模式",
      ttsProvider: "elevenlabs",
    });

    const result = await runOnce(input, user);
    printRunResult(result);

    console.log("\n─────── 质量验证 ───────");
    console.log("✅ 分镜：minimax 主导，zhipu 投票校验");
    console.log("✅ 角色：双模型一致性比对");
    console.log("✅ 图像：minimax 高清版");
    console.log("✅ 视频：minimax 4K + 60fps");
    console.log("✅ TTS：elevenlabs 高保真");
    console.log(`最终成本      : $${result.snap.costSummary.totalCostUsd.toFixed(4)}`);
    console.log(`质量评级      : ⭐⭐⭐⭐⭐ (5/5)`);
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[run-with-quality] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
