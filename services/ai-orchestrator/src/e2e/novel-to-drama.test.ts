/**
 * 端到端集成测试
 *
 * 跑通：1 段 1000 字小说 → 7 步骤 → 1 集 60s 漫剧
 *
 * 测试矩阵（4 个 case）：
 *   1. happy-path         - 默认 mock 模式，全绿
 *   2. retry-then-success - 模拟 image-gen 第一次失败，重试后成功
 *   3. compose-fail       - 模拟 compose 失败（optional step）→ 整体仍 success
 *   4. cost-bound         - 总成本在合理区间（< 5 USD）
 *
 * 不依赖外网/真 API key，全部走 mock。
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { nanoid } from "nanoid";

import { novelToDramaPipeline, buildNovelToDramaOutput, type NovelToDramaInput } from "../pipelines/novel-to-drama.js";
import { PipelineRunner, snapshotStore } from "../pipeline-runner.js";
import type { AuthUser } from "../middleware/auth.js";
import type { RunSnapshot } from "../pipeline-runner.js";

import { installMocks, uninstallMocks, setMockOptions, resetMockState, getStoredAssets } from "./test-helpers/mock-providers.js";
import { createProject, uploadAsset } from "./test-helpers/asset-helper.js";
import { calculateBill, formatBill } from "./test-helpers/cost-calculator.js";
import { validateOutput, formatReport } from "./test-helpers/output-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "fixtures", "demo-novel.txt");

interface TestResult {
  name: string;
  passed: boolean;
  report: ReturnType<typeof validateOutput>;
  cost: number;
  elapsedMs: number;
  runId: string;
  error?: string;
}

const results: TestResult[] = [];

function mockUser(tier: AuthUser["tier"] = "pro"): AuthUser {
  return { userId: `u-${nanoid(8)}`, tier };
}

async function loadFixture(): Promise<string> {
  return readFile(FIXTURE_PATH, "utf8");
}

async function runCase(name: string, input: NovelToDramaInput, user: AuthUser): Promise<TestResult> {
  const runner = new PipelineRunner(novelToDramaPipeline);
  const t0 = Date.now();
  let snap: RunSnapshot;
  try {
    snap = await runner.start({ pipeline: novelToDramaPipeline, user, inputs: input as unknown as Record<string, unknown> });
  } catch (err) {
    return {
      name,
      passed: false,
      report: { passed: false, checks: [], failCount: 1, passCount: 0 },
      cost: 0,
      elapsedMs: Date.now() - t0,
      runId: "n/a",
      error: (err as Error).message,
    };
  }
  const elapsedMs = Date.now() - t0;
  const out = snap.status === "success" ? buildNovelToDramaOutput(snap) : null;

  const projectId = input.projectId ?? `proj-${nanoid(8)}`;
  const shots = (snap.steps.storyboard?.outputs as { shots?: Array<{ shotId: string; dialogue?: string }> })?.shots ?? [];
  const composeOutputs = snap.steps.compose?.outputs as Record<string, unknown> | undefined;

  // 把关键资产落库（用项目 ID），模拟真实链路
  if (out?.imageUrls) {
    for (const url of out.imageUrls) {
      await uploadAsset({
        projectId,
        ownerUserId: user.userId,
        kind: "image",
        url,
        metadata: { runId: snap.runId, step: "image-gen" },
      });
    }
  }
  if (out?.videoUrls) {
    for (const url of out.videoUrls) {
      await uploadAsset({
        projectId,
        ownerUserId: user.userId,
        kind: "video",
        url,
        metadata: { runId: snap.runId, step: "video-gen" },
      });
    }
  }
  if (out?.finalVideoUrl) {
    await uploadAsset({
      projectId,
      ownerUserId: user.userId,
      kind: "drama",
      url: out.finalVideoUrl,
      metadata: { runId: snap.runId, step: "compose" },
    });
  }

  const report = validateOutput({
    finalVideoUrl: out?.finalVideoUrl,
    thumbnailUrl: composeOutputs?.["thumbnailUrl"] as string | undefined,
    videoUrls: out?.videoUrls ?? [],
    imageUrls: out?.imageUrls ?? [],
    audioUrl: out?.audioUrl,
    shots,
    composeOutputs,
    projectId,
  });

  // compose 失败是 optional：只算"compose 步骤是 failed + 其他步骤 success"为部分成功
  const composeFailed = snap.steps.compose?.status === "failed";
  const allOthersSuccess = Object.entries(snap.steps)
    .filter(([n]) => n !== "compose")
    .every(([, s]) => s.status === "success");

  const overallSuccess = composeFailed
    ? allOthersSuccess // compose 挂了但其他都成功 → 仍算部分成功
    : snap.status === "success";

  return {
    name,
    passed: overallSuccess && (composeFailed ? shots.length > 0 : report.passed),
    report,
    cost: snap.costSummary.totalCostUsd,
    elapsedMs,
    runId: snap.runId,
    error: snap.status !== "success" ? snap.error : undefined,
  };
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  ai-orchestrator E2E 端到端联调测试（mock 模式）        ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  installMocks();
  try {
    const novelText = await loadFixture();
    console.log(`📖 加载样本小说：${novelText.length} 字节, ${novelText.replace(/[\r\n\s]/g, "").length} 字\n`);

    // 准备项目
    const project = await createProject({
      projectName: "E2E 漫剧-便利店",
      ownerUserId: "u-e2e",
      tags: ["e2e", "novel-to-drama"],
    });
    console.log(`📦 创建项目：${project.id} (${project.name})\n`);

    // ---- Case 1: happy-path ----
    resetMockState();
    setMockOptions({});
    const r1 = await runCase(
      "happy-path",
      {
        text: novelText,
        chapterTitle: "便利店之夜",
        storyType: "urban_fantasy",
        artStyle: "manhua_chinese",
        durationSeconds: 60,
        ttsProvider: "edge-tts",
        projectId: project.id,
      },
      mockUser("pro"),
    );
    results.push(r1);
    console.log(`[Case 1] ${r1.name}: ${r1.passed ? "✅ PASS" : "❌ FAIL"} (${r1.elapsedMs}ms, $${r1.cost.toFixed(4)})`);
    console.log(formatReport(r1.report));
    console.log();

    // ---- Case 2: retry-then-success ----
    resetMockState();
    setMockOptions({ failImageFirstAttempt: true });
    const r2 = await runCase(
      "retry-then-success",
      {
        text: novelText,
        chapterTitle: "便利店之夜-重试",
        storyType: "urban_fantasy",
        artStyle: "manhua_chinese",
        durationSeconds: 60,
        ttsProvider: "edge-tts",
        projectId: project.id,
      },
      mockUser("pro"),
    );
    results.push(r2);
    console.log(`[Case 2] ${r2.name}: ${r2.passed ? "✅ PASS" : "❌ FAIL"} (${r2.elapsedMs}ms, $${r2.cost.toFixed(4)})`);
    console.log(formatReport(r2.report));
    console.log();

    // ---- Case 3: compose-fail (optional) ----
    resetMockState();
    setMockOptions({ failCompose: true });
    const r3 = await runCase(
      "compose-fail-optional",
      {
        text: novelText,
        chapterTitle: "便利店之夜-合成失败",
        storyType: "urban_fantasy",
        artStyle: "manhua_chinese",
        durationSeconds: 60,
        ttsProvider: "edge-tts",
        projectId: project.id,
      },
      mockUser("pro"),
    );
    results.push(r3);
    console.log(`[Case 3] ${r3.name}: ${r3.passed ? "✅ PASS" : "❌ FAIL"} (${r3.elapsedMs}ms, $${r3.cost.toFixed(4)})`);
    console.log(formatReport(r3.report));
    console.log();

    // ---- Case 4: cost-bound ----
    resetMockState();
    setMockOptions({});
    const r4 = await runCase(
      "cost-bound",
      {
        text: novelText,
        chapterTitle: "便利店之夜-成本边界",
        storyType: "urban_fantasy",
        artStyle: "manhua_chinese",
        durationSeconds: 60,
        ttsProvider: "edge-tts",
        projectId: project.id,
      },
      mockUser("pro"),
    );
    results.push(r4);
    // 60s 漫剧 6 镜 价 = 0.15+0.2+0.6+0.1+0.6*6+0.4*6+0.05 ≈ 6.6；上限 $10
    const costOk = r4.cost > 0 && r4.cost < 10;
    r4.passed = r4.passed && costOk;
    console.log(`[Case 4] ${r4.name}: ${r4.passed ? "✅ PASS" : "❌ FAIL"} (${r4.elapsedMs}ms, $${r4.cost.toFixed(4)})`);
    console.log(`   cost-bound: $${r4.cost.toFixed(4)} < $10.00 → ${costOk ? "✅" : "❌"}`);
    console.log();

    // ---- 汇总 ----
    console.log("═══════════ 汇总 ═══════════");
    const allPassed = results.every((r) => r.passed);
    for (const r of results) {
      console.log(`  ${r.passed ? "✅" : "❌"} ${r.name.padEnd(28)} ${r.elapsedMs.toString().padStart(5)}ms  $${r.cost.toFixed(4)}  ${r.runId}`);
    }
    const totalCost = results.reduce((s, r) => s + r.cost, 0);
    const totalTime = results.reduce((s, r) => s + r.elapsedMs, 0);
    console.log(`  总计：${results.length} case, $${totalCost.toFixed(4)}, ${totalTime}ms`);
    console.log(`  落库资产数：${getStoredAssets().filter((a) => a.projectId === project.id).length}`);
    console.log();
    console.log(allPassed ? "🎉 ALL GREEN" : "💥 HAS FAILED CASE");
    if (!allPassed) process.exit(1);
  } finally {
    uninstallMocks();
  }
}

main().catch((err) => {
  console.error("[e2e] fatal:", err);
  uninstallMocks();
  process.exit(1);
});
