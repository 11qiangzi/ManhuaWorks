/**
 * BYOK vs 平台配额对比
 *
 * 跑同一段小说，分别用：
 *   模式 A: 平台配额（costMultiplier=1.0）
 *   模式 B: BYOK 模式（costMultiplier=0.7，批发价 7 折）
 *
 * 输出：成本对比表 + 节省百分比
 *
 * 用法：
 *   MOCK=1 tsx src/examples/byok-vs-platform.ts
 */

import { buildInput, isMock, loadDemoNovel, makeUser, runOnce, printRunResult } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks, setMockOptions, resetMockState } from "../e2e/test-helpers/mock-providers.js";
import { compareBills, formatBill } from "../e2e/test-helpers/cost-calculator.js";

interface ComparisonRow {
  step: string;
  platformUsd: number;
  byokUsd: number;
  diffUsd: number;
  diffPct: number;
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  byok-vs-platform（BYOK vs 平台配额 对比）            ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  if (isMock()) {
    installMocks();
  }

  try {
    const text = await loadDemoNovel();
    const projectId = "byok-vs-platform-project";

    // ---- 模式 A: 平台 ----
    console.log("\n🌐 模式 A: 平台配额（costMultiplier=1.0）");
    resetMockState();
    setMockOptions({ costMultiplier: 1.0 });
    const userA = makeUser("pro", false);
    const inputA = buildInput({ text, chapterTitle: "BYOK vs Platform (A)", projectId });
    const resultA = await runOnce(inputA, userA);
    printRunResult(resultA);

    // ---- 模式 B: BYOK ----
    console.log("\n🔑 模式 B: BYOK（costMultiplier=0.7，批发价）");
    resetMockState();
    setMockOptions({ costMultiplier: 0.7 });
    const userB = makeUser("pro", true);
    const inputB = buildInput({ text, chapterTitle: "BYOK vs Platform (B)", projectId });
    const resultB = await runOnce(inputB, userB);
    printRunResult(resultB);

    // ---- 对比 ----
    const cmp = compareBills(resultA.bill, resultB.bill);
    console.log("\n═══════ 成本对比表 ═══════");
    const rows: ComparisonRow[] = [];
    const allSteps = new Set([
      ...Object.keys(resultA.bill.byStep),
      ...Object.keys(resultB.bill.byStep),
    ]);
    for (const step of allSteps) {
      const a = resultA.bill.byStep[step] ?? 0;
      const b = resultB.bill.byStep[step] ?? 0;
      const diff = a - b;
      const pct = a > 0 ? (diff / a) * 100 : 0;
      rows.push({ step, platformUsd: a, byokUsd: b, diffUsd: diff, diffPct: pct });
    }
    rows.sort((x, y) => y.platformUsd - x.platformUsd);

    console.log("┌────────────────┬──────────────┬──────────────┬──────────────┬──────────┐");
    console.log("│ Step           │ Platform     │ BYOK         │ Diff (USD)   │ Saved %  │");
    console.log("├────────────────┼──────────────┼──────────────┼──────────────┼──────────┤");
    for (const r of rows) {
      const saved = r.diffUsd > 0 ? "💰" : r.diffUsd < 0 ? "📈" : "  ";
      console.log(
        `│ ${r.step.padEnd(14)} │ $${r.platformUsd.toFixed(4).padStart(10)} │ $${r.byokUsd.toFixed(4).padStart(10)} │ $${r.diffUsd.toFixed(4).padStart(10)} ${saved} │ ${r.diffPct.toFixed(1).padStart(5)}% │`,
      );
    }
    console.log("├────────────────┼──────────────┼──────────────┼──────────────┼──────────┤");
    console.log(
      `│ TOTAL          │ $${resultA.bill.totalUsd.toFixed(4).padStart(10)} │ $${resultB.bill.totalUsd.toFixed(4).padStart(10)} │ $${cmp.diffUsd.toFixed(4).padStart(10)} ${cmp.aIsCheaper ? "💰" : "📈"} │ ${cmp.diffPct.toFixed(1).padStart(5)}% │`,
    );
    console.log("└────────────────┴──────────────┴──────────────┴──────────────┴──────────┘");
    console.log(`\n胜出: ${cmp.winner === "b" ? "BYOK ✅" : cmp.winner === "a" ? "Platform ✅" : "平局"}`);
    console.log(`节省: $${cmp.diffUsd.toFixed(4)} (${cmp.diffPct.toFixed(1)}%)`);

    console.log("\n模式 A 账单:\n" + formatBill(resultA.bill));
    console.log("\n模式 B 账单:\n" + formatBill(resultB.bill));
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[byok-vs-platform] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
