/**
 * ManhuaWorks ai-orchestrator — 端到端示例
 *
 * 跑通一条 novel-to-drama 流水线：1 集 60s 漫剧
 *   1) 准备 BYOK + 路由客户端
 *   2) 准备一个 mock AuthUser（生产环境来自 middleware/auth）
 *   3) 调 PipelineRunner.start()
 *   4) 等待完成，输出 runId / status / cost / 时长 / 输出
 *
 * 用法：
 *   tsx src/examples/runtime.ts          # 真路由
 *   MOCK=1 tsx src/examples/runtime.ts   # 不调上游，只跑本地流水线
 */

import { nanoid } from "nanoid";

import { aiRouterClient } from "../clients/ai-router.js";
import { byokClient } from "../clients/byok.js";
import { novelToDramaPipeline, buildNovelToDramaOutput, type NovelToDramaInput } from "../pipelines/novel-to-drama.js";
import { PipelineRunner, snapshotStore } from "../pipeline-runner.js";
import type { AuthUser } from "../middleware/auth.js";

const MOCK = process.env.MOCK === "1";
const SAMPLE_TEXT = "夜色中的便利店亮着冷白光，林夏攥着辞职信推门进去，看见货架尽头站着一个穿黑色风衣的男人，正低头翻一包薄荷糖。";

async function main(): Promise<void> {
  console.log("[example] boot ai-orchestrator runtime", { mock: MOCK });

  // 1) 健康检查 + BYOK
  if (!MOCK) {
    await aiRouterClient.health();
    await byokClient.listByok("demo-user");
  }

  // 2) mock 用户
  const user: AuthUser = {
    userId: `u-${nanoid(8)}`,
    tier: "pro",
  };

  // 3) 构造输入 + 启 run
  const input: NovelToDramaInput = {
    text: SAMPLE_TEXT,
    chapterTitle: "便利店之夜",
    storyType: "urban_fantasy",
    artStyle: "manhua_chinese",
    durationSeconds: 60,
    ttsProvider: "edge-tts",
  };

  const runner = new PipelineRunner(novelToDramaPipeline);
  const t0 = Date.now();
  const snap = await runner.start({ pipeline: novelToDramaPipeline, user, inputs: input as unknown as Record<string, unknown> });
  const elapsedMs = Date.now() - t0;

  // 4) 输出
  const out = snap.status === "success" ? buildNovelToDramaOutput(snap) : null;
  console.log(JSON.stringify({
    runId: snap.runId,
    pipeline: snap.pipeline,
    status: snap.status,
    elapsedMs,
    cost: snap.costSummary.totalCostUsd,
    stepCount: Object.keys(snap.steps).length,
    output: out,
  }, null, 2));

  // 5) 从 snapshotStore 复现一遍（验证可恢复）
  const reloaded = await snapshotStore.load(snap.runId);
  if (!reloaded) throw new Error("snapshot lost — store not durable");

  if (snap.status !== "success") process.exit(1);
}

main().catch((err) => {
  console.error("[example] failed:", err);
  process.exit(1);
});
