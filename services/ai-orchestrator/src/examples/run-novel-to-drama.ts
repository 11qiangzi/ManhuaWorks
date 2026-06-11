/**
 * examples 共享 helper
 *
 * 提供：
 *   - loadDemoNovel()        : 加载 e2e/fixtures/demo-novel.txt
 *   - buildInput(opts)       : 构造 NovelToDramaInput
 *   - runOnce(input, user)   : 跑一次 pipeline + 输出结构化结果
 *   - printRunResult(snap)   : 人读格式化输出
 *   - ensureEnv()            : 检查必要的环境变量（真模式）
 *
 * 真模式 / mock 模式都用这套 helper：
 *   - mock 模式：调 runOnce 前 installMocks()
 *   - 真模式：调 runOnce 前 ensureEnv() + 设置 useByok 等
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { nanoid } from "nanoid";

import { novelToDramaPipeline, buildNovelToDramaOutput, type NovelToDramaInput } from "../pipelines/novel-to-drama.js";
import { PipelineRunner, snapshotStore, type RunSnapshot } from "../pipeline-runner.js";
import type { AuthUser } from "../middleware/auth.js";
import { calculateBill, formatBill } from "../e2e/test-helpers/cost-calculator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 加载 demo-novel.txt（统一指向 e2e/fixtures） */
export async function loadDemoNovel(): Promise<string> {
  const p = resolve(__dirname, "..", "e2e", "fixtures", "demo-novel.txt");
  return readFile(p, "utf8");
}

export interface BuildInputOptions {
  text: string;
  chapterTitle?: string;
  storyType?: "urban_fantasy" | "sweet_romance_novel";
  artStyle?: "manhua_chinese" | "anime";
  durationSeconds?: number;
  ttsProvider?: "edge-tts" | "volcengine" | "aliyun" | "elevenlabs";
  projectId?: string;
}

export function buildInput(opts: BuildInputOptions): NovelToDramaInput {
  return {
    text: opts.text,
    chapterTitle: opts.chapterTitle ?? "便利店之夜",
    storyType: opts.storyType ?? "urban_fantasy",
    artStyle: opts.artStyle ?? "manhua_chinese",
    durationSeconds: opts.durationSeconds ?? 60,
    ttsProvider: opts.ttsProvider ?? "edge-tts",
    projectId: opts.projectId,
  };
}

export function makeUser(tier: AuthUser["tier"] = "pro", byokEnabled = false): AuthUser {
  return {
    userId: `u-${nanoid(8)}`,
    tier,
    byokEnabled,
  };
}

export interface RunResult {
  snap: RunSnapshot;
  output: ReturnType<typeof buildNovelToDramaOutput> | null;
  elapsedMs: number;
  bill: ReturnType<typeof calculateBill>;
}

export async function runOnce(input: NovelToDramaInput, user: AuthUser): Promise<RunResult> {
  const runner = new PipelineRunner(novelToDramaPipeline);
  const t0 = Date.now();
  const snap = await runner.start({
    pipeline: novelToDramaPipeline,
    user,
    inputs: input as unknown as Record<string, unknown>,
  });
  const elapsedMs = Date.now() - t0;
  const output = snap.status === "success" ? buildNovelToDramaOutput(snap) : null;
  const bill = calculateBill(snap.costSummary);
  return { snap, output, elapsedMs, bill };
}

export function printRunResult(result: RunResult): void {
  const { snap, output, elapsedMs, bill } = result;
  console.log("\n─────── Run Result ───────");
  console.log(`runId          : ${snap.runId}`);
  console.log(`status         : ${snap.status}`);
  console.log(`elapsed        : ${elapsedMs}ms`);
  console.log(`totalCost      : $${snap.costSummary.totalCostUsd.toFixed(4)}`);
  console.log(`stepCount      : ${Object.keys(snap.steps).length}`);
  if (snap.error) console.log(`error          : ${snap.error}`);

  console.log("\nSteps:");
  for (const [name, step] of Object.entries(snap.steps)) {
    const lat = step.latencyMs;
    const cost = step.costUsd;
    const mark = step.status === "success" ? "✅" : step.status === "skipped" ? "⏭️ " : "❌";
    console.log(`  ${mark} ${name.padEnd(12)} ${lat.toString().padStart(5)}ms  $${cost.toFixed(4)}`);
  }

  if (output) {
    console.log("\nOutput:");
    console.log(`  storyboardRunId : ${output.storyboardRunId || "n/a"}`);
    console.log(`  characterRunId  : ${output.characterRunId || "n/a"}`);
    console.log(`  ttsRunId        : ${output.ttsRunId || "n/a"}`);
    console.log(`  imageRunIds     : ${output.imageRunIds.length} 个`);
    console.log(`  videoRunIds     : ${output.videoRunIds.length} 个`);
    console.log(`  composeRunId    : ${output.composeRunId || "n/a"}`);
    console.log(`  finalVideoUrl   : ${output.finalVideoUrl || "n/a"}`);
    console.log(`  audioUrl        : ${output.audioUrl || "n/a"}`);
  }

  console.log("\n" + formatBill(bill));
}

/** 检查真模式必需的环境变量 */
export interface EnsureEnvResult {
  ok: boolean;
  missing: string[];
  mode: "real" | "mock";
}

export function ensureEnv(required: string[] = []): EnsureEnvResult {
  const mode: "real" | "mock" = process.env.MOCK === "1" ? "mock" : "real";
  if (mode === "mock") {
    return { ok: true, missing: [], mode };
  }
  const missing = required.filter((k) => !process.env[k] || process.env[k]!.trim() === "");
  return {
    ok: missing.length === 0,
    missing,
    mode,
  };
}

/** 通用入口：检测真/假模式 */
export function isMock(): boolean {
  return process.env.MOCK === "1";
}
