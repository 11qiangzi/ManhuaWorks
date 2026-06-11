/**
 * adapters/output: 轮询 RunSnapshot → 输出 ToonflowJobResult
 *
 * 上层调用方式：
 *   const result = await waitForToonflowResult(jobId, workflowId, runId, client, {
 *     pollIntervalMs: 2000,
 *     timeoutMs: 600_000,
 *   });
 *
 * 内部行为：
 *   - 每 pollIntervalMs 拉一次 GET /v1/orchestrate/runs/:runId
 *   - 终态（success/failed/cancelled）→ 调 mapper 折叠成 ToonflowJobResult
 *   - 成功时还要从 snap.steps 拿 NovelToDramaOutput
 *     （这要求 ai-orchestrator 端 serializeSnap 已把 output 嵌进 snapshot；
 *      实际取自 snap.steps["compose"].outputs）
 *   - 超时抛 OutputAdapterError
 */

import type { OrchestratorClient } from "../client/http.js";
import {
  novelToToonflow,
  NovelToToonflowError,
} from "../mapper/novel-to-toonflow.js";
import type { ToonflowJobResult } from "../types/toonflow.js";
import type { NovelToDramaOutput, RunSnapshot } from "../types/manhua.js";

export class OutputAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputAdapterError";
  }
}

export interface WaitOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onPoll?: (snap: RunSnapshot) => void;
}

const TERMINAL = new Set<RunSnapshot["status"]>(["success", "failed", "cancelled"]);

export async function waitForToonflowResult(
  jobId: string,
  workflowId: string,
  runId: string,
  client: OrchestratorClient,
  options: WaitOptions = {},
): Promise<ToonflowJobResult> {
  const pollMs = options.pollIntervalMs ?? 2_000;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (options.signal?.aborted) {
      throw new OutputAdapterError("waitForToonflowResult aborted");
    }
    if (Date.now() > deadline) {
      throw new OutputAdapterError(
        `waitForToonflowResult timeout after ${timeoutMs}ms (runId=${runId})`,
      );
    }

    const snap = await client.getRun(runId);
    options.onPoll?.(snap);

    if (TERMINAL.has(snap.status)) {
      return snapToToonflowResult(jobId, workflowId, snap);
    }

    await sleep(pollMs);
  }
}

/**
 * 一次性映射：已拿到终态 snapshot 时直接转。
 */
export function snapToToonflowResult(
  jobId: string,
  workflowId: string,
  snap: RunSnapshot,
): ToonflowJobResult {
  const output = extractNovelToDramaOutput(snap);
  try {
    return novelToToonflow(jobId, workflowId, snap, output);
  } catch (err) {
    if (err instanceof NovelToToonflowError) {
      throw new OutputAdapterError(err.message);
    }
    throw err;
  }
}

/**
 * 从 snapshot 步骤 outputs 里拼出 NovelToDramaOutput。
 *
 * ai-orchestrator 的 index.ts 在 success 路径上会调 buildNovelToDramaOutput(snap)，
 * 该函数读自 snap.steps 各 step 的 outputs 字段。bridge 端无法直接复用 build 函数
 * （那是私有实现），所以这里做最小化的"等价提取"：
 *   - 找到 image-gen / video-gen / tts / compose 步骤
 *   - 把所有 .outputs 合并，再按 NovelToDramaOutput 的 key 抽取
 */
function extractNovelToDramaOutput(snap: RunSnapshot): NovelToDramaOutput | undefined {
  if (snap.status !== "success") return undefined;

  const find = (name: string): Record<string, unknown> | undefined =>
    snap.steps[name]?.outputs;

  const imageGen = find("image-gen");
  const videoGen = find("video-gen");
  const tts = find("tts");
  const compose = find("compose");
  const storyboard = find("storyboard");
  const character = find("character");

  const imageUrls = (imageGen?.imageUrls as string[] | undefined) ?? [];
  const videoUrls = (videoGen?.videoUrls as string[] | undefined) ?? [];
  const audioUrl = (tts?.audioUrl as string | undefined) ?? undefined;
  const finalVideoUrl =
    (compose?.finalVideoUrl as string | undefined) ??
    (videoUrls[videoUrls.length - 1] as string | undefined);

  if (!finalVideoUrl) return undefined;

  return {
    storyboardRunId: (storyboard?.runId as string | undefined) ?? snap.runId,
    characterRunId: (character?.runId as string | undefined) ?? snap.runId,
    imageRunIds: Array.isArray(imageGen?.runIds)
      ? (imageGen?.runIds as string[])
      : [],
    ttsRunId: (tts?.runId as string | undefined) ?? snap.runId,
    videoRunIds: Array.isArray(videoGen?.runIds)
      ? (videoGen?.runIds as string[])
      : [],
    composeRunId: (compose?.runId as string | undefined) ?? snap.runId,
    finalVideoUrl,
    totalCostUsd: snap.costSummary.totalCostUsd,
    totalLatencyMs: snap.costSummary.totalLatencyMs,
    imageUrls,
    videoUrls,
    audioUrl,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
