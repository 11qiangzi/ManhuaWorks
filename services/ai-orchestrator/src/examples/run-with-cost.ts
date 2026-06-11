/**
 * 成本模式跑：成本最优策略 + 输出成本明细
 *
 * 策略：
 *   - 文本/分镜 → deepseek (cheapest chat)
 *   - 图像 → deepseek (如果支持) / volcengine
 *   - 视频 → volcengine (cost-effective video)
 *   - TTS → edge-tts (免费)
 *
 * 输出：成本明细 + 与"质量模式"对比的预期节省
 *
 * 用法：
 *   MOCK=1 tsx src/examples/run-with-cost.ts
 */

import { buildInput, isMock, loadDemoNovel, makeUser, printRunResult, runOnce } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks, setMockOptions } from "../e2e/test-helpers/mock-providers.js";
import { calculateBill, formatBill, DEFAULT_RATES } from "../e2e/test-helpers/cost-calculator.js";
import type { ProviderId } from "../clients/ai-router.js";

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  run-with-cost（成本最优策略）                         ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  // 成本路由：每步强制 cheapest provider
  const costRoute: Partial<Record<string, ProviderId>> = {
    storyboard: "deepseek",
    character: "deepseek",
    scene: "deepseek",
    "image-gen": "deepseek",
    tts: "edge-tts" as ProviderId, // edge-tts 不是 ProviderId 而是 TTSProvider；用 volcengine 兜底
    "video-gen": "volcengine",
  };

  if (isMock()) {
    installMocks();
    setMockOptions({ routeOverride: costRoute, costMultiplier: 0.6 });
    console.log("🧪 mock 模式 + costMultiplier=0.6（模拟成本优化）");
  } else {
    console.log("🌐 真实模式：成本路由 → deepseek / volcengine");
  }

  try {
    const text = await loadDemoNovel();
    const user = makeUser("pro", false);
    const input = buildInput({ text, chapterTitle: "便利店之夜-成本模式" });

    const result = await runOnce(input, user);
    printRunResult(result);

    // 估算"质量模式"的成本作对比
    const qualityEstimatedUsd = Object.keys(DEFAULT_RATES).reduce(
      (s, step) => s + (DEFAULT_RATES[step as keyof typeof DEFAULT_RATES]?.minimax ?? 0.5),
      0,
    );
    const savedUsd = Math.max(0, qualityEstimatedUsd - result.snap.costSummary.totalCostUsd);
    const savedPct = qualityEstimatedUsd > 0 ? (savedUsd / qualityEstimatedUsd) * 100 : 0;

    console.log("\n─────── 成本对比 ───────");
    console.log(`成本模式总成本 : $${result.snap.costSummary.totalCostUsd.toFixed(4)}`);
    console.log(`质量模式估算   : $${qualityEstimatedUsd.toFixed(4)} (minimax rates)`);
    console.log(`节省           : $${savedUsd.toFixed(4)} (${savedPct.toFixed(1)}%)`);
    console.log("\n" + formatBill(result.bill));
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[run-with-cost] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
