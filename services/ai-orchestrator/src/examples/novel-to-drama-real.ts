/**
 * 真实模式跑：调 4 个真 AI provider（ai-router / workflow-engine / asset-service / ai-keys-service）
 *
 * 跑通 1 集 60s 漫剧。
 *
 * 用法：
 *   # 真模式（需要 ai-router / workflow / asset / byok 4 个服务在线 + 各自的 API key）
 *   tsx src/examples/novel-to-drama-real.ts
 *
 *   # 演示模式（不依赖外网，走 mock 演示）
 *   MOCK=1 tsx src/examples/novel-to-drama-real.ts
 *
 * 需要的真实环境变量（可放 .env）：
 *   AI_ROUTER_URL          默认 http://localhost:8082
 *   WORKFLOW_ENGINE_URL    默认 http://localhost:8084
 *   ASSET_SERVICE_URL      默认 http://localhost:8085
 *   AI_KEYS_SERVICE_URL    默认 http://localhost:8083
 *   AUTH_API_KEY           默认 dev-ai-orchestrator-key
 *
 * 4 个 provider 的 API key 在 ai-router 侧配置（OPENAI_API_KEY / ZHIPU_API_KEY / VOLCENGINE_ACCESS_KEY / DEEPSEEK_API_KEY）。
 */

import { aiRouterClient } from "../clients/ai-router.js";
import { byokClient } from "../clients/byok.js";
import { workflowClient } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

import { buildInput, isMock, loadDemoNovel, makeUser, printRunResult, runOnce, ensureEnv } from "./run-novel-to-drama.js";
import { installMocks, uninstallMocks } from "../e2e/test-helpers/mock-providers.js";

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  novel-to-drama-real（真实 4-provider 链路）          ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  const env = ensureEnv();
  if (env.mode === "real" && !env.ok) {
    console.log(`❌ 缺少环境变量: ${env.missing.join(", ")}`);
    console.log("   或设置 MOCK=1 走 mock 模式");
    process.exit(1);
  }

  if (isMock()) {
    installMocks();
    console.log("🧪 mock 模式（不依赖外网）");
  } else {
    console.log("🌐 真实模式（4 个 provider 在线）");
    // 健康检查
    try {
      await Promise.all([
        aiRouterClient.health(),
        workflowClient.health(),
        assetClient.health(),
        byokClient.health(),
      ]);
      console.log("✅ 4 个依赖服务健康检查通过");
    } catch (err) {
      console.error("❌ 健康检查失败:", (err as Error).message);
      process.exit(1);
    }
  }

  try {
    const text = await loadDemoNovel();
    console.log(`\n📖 加载样本小说：${text.length} 字节`);

    const user = makeUser("pro", false);
    const input = buildInput({
      text,
      chapterTitle: "便利店之夜-真模式",
      projectId: "demo-real-project",
    });

    const result = await runOnce(input, user);
    printRunResult(result);

    if (result.snap.status !== "success") {
      console.error("\n❌ pipeline failed:", result.snap.error);
      process.exit(1);
    }
    console.log("\n🎉 完成！");
  } finally {
    if (isMock()) uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[novel-to-drama-real] fatal:", err);
  if (isMock()) uninstallMocks();
  process.exit(1);
});
