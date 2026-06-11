/**
 * BYOK 模式跑：用户用自己 key + 成本直接扣到用户配额
 *
 * 流程：
 *   1. 用户在 ai-keys-service 注册自己的 OpenAI/Volcengine Key
 *   2. ai-router 看到 useByok=true，调用时带 X-User-Key
 *   3. 成本记到用户自己的 key（不走平台）
 *   4. cost-tracker 把 cost 同步记入 ai-keys-service 的用户额度
 *
 * mock 模式：用 mockAiRouter 设置 useByok=true，costMultiplier=0.7 模拟"用户批发价"
 *
 * 用法：
 *   MOCK=1 tsx src/examples/byok-run.ts
 */

import { buildInput, isMock, loadDemoNovel, makeUser, printRunResult, runOnce } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks, setMockOptions, getUsageLog } from "../e2e/test-helpers/mock-providers.js";
import { byokClient } from "../clients/byok.js";

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  byok-run（BYOK 模式：用户用自己的 key）                ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  const user = makeUser("pro", true); // byokEnabled = true
  console.log(`👤 用户: ${user.userId} (byokEnabled=${user.byokEnabled})`);

  if (isMock()) {
    installMocks();
    setMockOptions({ costMultiplier: 0.7 }); // 模拟批发价 7 折
    console.log("🧪 mock 模式 + costMultiplier=0.7（BYOK 批发价）");
  } else {
    console.log("🌐 真实模式：用户用自己 key，调真 ai-router");
    // 1) 查询用户配额
    try {
      const quota = await byokClient.quota(user.userId);
      console.log(`💰 用户配额: $${quota.monthlyRemainingUsd.toFixed(2)} / $${quota.monthlyQuotaUsd.toFixed(2)} (剩余/总额)`);
    } catch (err) {
      console.log(`⚠️  配额查询失败: ${(err as Error).message}`);
    }
  }

  try {
    const text = await loadDemoNovel();
    const input = buildInput({
      text,
      chapterTitle: "便利店之夜-BYOK",
      projectId: "byok-demo-project",
    });

    const result = await runOnce(input, user);
    printRunResult(result);

    // 列出 mock 模式下记录的"扣费明细"
    if (isMock()) {
      console.log("\n─────── BYOK 扣费明细（mock 模式） ───────");
      const log = getUsageLog();
      let total = 0;
      for (const e of log) {
        total += e.costUsd;
        console.log(`  ${e.providerId.padEnd(12)} $${e.costUsd.toFixed(4)}  runId=${e.runId}`);
      }
      console.log(`  ────────────────────────`);
      console.log(`  合计扣费: $${total.toFixed(4)} (已扣到用户 ${user.userId} 配额)`);
    } else {
      console.log("\n✅ 成本已通过 byokClient.recordUsage 同步到 ai-keys-service");
    }
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[byok-run] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
