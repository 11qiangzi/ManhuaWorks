/**
 * mapper: ManhuaWorks 漫剧输出（RunSnapshot + NovelToDramaOutput） → ToonflowJobResult
 *
 * 关键决策：
 *   - Toonflow 主交付物是 mp4（finalVideoUrl），所以 map 之前会断言
 *     `output.finalVideoUrl` 存在，否则映射失败
 *   - shots[].imageUrl / videoUrl 来自 output.imageUrls / videoUrls（按顺序对齐）
 *   - 每个 shot 的默认 durationMs = ceil(totalDur / shotCount)
 *   - 状态收敛：success → "done"，failed → "failed"，cancelled → "failed"
 *     Toonflow 只有 done/failed 两个终态
 */

import type { RunSnapshot, NovelToDramaOutput } from "../types/manhua.js";
import type { ToonflowJobResult, ToonflowShot } from "../types/toonflow.js";

export class NovelToToonflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NovelToToonflowError";
  }
}

/**
 * 把 ai-orchestrator 的快照 + 业务输出折叠成 Toonflow 主结果
 *
 * @param jobId      Toonflow 任务 ID
 * @param workflowId Toonflow 工作流 ID
 * @param snap       ai-orchestrator 终态 RunSnapshot（status 必须 success/failed/cancelled）
 * @param output     snap.status === "success" 时必填，对应 buildNovelToDramaOutput(snap)
 * @param subtitleSrt 可选，autotranslate pipeline 产物
 */
export function novelToToonflow(
  jobId: string,
  workflowId: string,
  snap: RunSnapshot,
  output?: NovelToDramaOutput,
  subtitleSrt?: string,
): ToonflowJobResult {
  const totalDurMs = snap.costSummary.totalLatencyMs;

  // 1. 终态映射
  let toonflowStatus: ToonflowJobResult["status"];
  if (snap.status === "success") toonflowStatus = "done";
  else if (snap.status === "failed") toonflowStatus = "failed";
  else if (snap.status === "cancelled") toonflowStatus = "failed";
  else
    throw new NovelToToonflowError(
      `cannot map non-terminal snap.status='${snap.status}' to toonflow result`,
    );

  // 2. 失败路径：finalVideoUrl 留空字符串，shots 空数组
  if (snap.status !== "success" || !output) {
    return {
      jobId,
      workflowId,
      status: toonflowStatus,
      finalVideoUrl: "",
      shots: [],
      costUsd: snap.costSummary.totalCostUsd,
      totalLatencyMs: totalDurMs,
      error: snap.error ?? "pipeline did not reach success",
    };
  }

  // 3. 成功路径：要求 finalVideoUrl
  if (!output.finalVideoUrl) {
    throw new NovelToToonflowError(
      "novel-to-toonflow: success snapshot missing output.finalVideoUrl (compose step likely failed)",
    );
  }

  // 4. shots 对齐
  const imageUrls = output.imageUrls ?? [];
  const videoUrls = output.videoUrls ?? [];
  const shotCount = Math.max(imageUrls.length, videoUrls.length, 1);
  const perShotMs = Math.max(1000, Math.ceil(totalDurMs / shotCount));

  const shots: ToonflowShot[] = [];
  for (let i = 0; i < shotCount; i++) {
    const imageUrl = imageUrls[i] ?? imageUrls[imageUrls.length - 1] ?? "";
    const videoUrl = videoUrls[i];
    if (!imageUrl) continue;
    shots.push({
      shotId: `shot-${i + 1}`,
      sceneId: `scene-${Math.floor(i / 4) + 1}`,
      imageUrl,
      ...(videoUrl ? { videoUrl } : {}),
      durationMs: perShotMs,
    });
  }

  const result: ToonflowJobResult = {
    jobId,
    workflowId,
    status: "done",
    finalVideoUrl: output.finalVideoUrl,
    shots,
    costUsd: output.totalCostUsd,
    totalLatencyMs: output.totalLatencyMs ?? totalDurMs,
  };
  if (output.audioUrl) result.audioUrl = output.audioUrl;
  if (subtitleSrt) result.subtitleSrt = subtitleSrt;
  return result;
}
