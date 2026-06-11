/**
 * adapters/input: Toonflow 入口 → 调 ai-orchestrator
 *
 * 这是「Toonflow 侧进入 ManhuaWorks」的主入口：
 *   1. 拿 ToonflowRunRequest + ToonflowWorkflow
 *   2. mapper 把它们折叠成 NovelToDramaInput
 *   3. HTTP 客户端 POST /v1/orchestrate/novel-to-drama
 *   4. 返回 jobId + runId 对照表 + 起手 snapshot
 */

import { OrchestratorClient } from "../client/http.js";
import { toonflowToNovel, ToonflowMappingError } from "../mapper/toonflow-to-novel.js";
import type { ToonflowRunRequest, ToonflowWorkflow } from "../types/toonflow.js";
import type { NovelToDramaInput, RunSnapshot } from "../types/manhua.js";
import { nanoid as makeId } from "./_id.js";

export class InputAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputAdapterError";
  }
}

export interface AdaptedStartResult {
  jobId: string;
  runId: string;
  snapshot: RunSnapshot;
  novelInput: NovelToDramaInput;
}

/**
 * 把 Toonflow 进来的请求 + workflow 转成 ai-orchestrator 启动结果
 */
export async function startFromToonflow(
  workflow: ToonflowWorkflow,
  request: ToonflowRunRequest,
  client: OrchestratorClient,
  options: { jobId?: string } = {},
): Promise<AdaptedStartResult> {
  // 1. mapper: workflow + runInputs → NovelToDramaInput
  let novelInput: NovelToDramaInput;
  try {
    novelInput = toonflowToNovel(workflow, request.inputs);
  } catch (err) {
    if (err instanceof ToonflowMappingError) {
      throw new InputAdapterError(`toonflow workflow invalid: ${err.message}`);
    }
    throw err;
  }

  // 2. BYOK 透传（不直接打到 ai-orchestrator 的 NovelToDramaInput，
  //    而是交给上层在请求头 / 子 token 里传；这里只挂到 projectId 旁路）
  if (request.byok) {
    novelInput.projectId = [
      novelInput.projectId ?? workflow.workflowId,
      `byok:${Object.keys(request.byok).filter((k) => request.byok?.[k as keyof typeof request.byok]).join("+")}`,
    ]
      .filter(Boolean)
      .join("|");
  }

  // 3. HTTP 调起
  const start = await client.startNovelToDrama(novelInput);

  // 4. 产出 jobId（Toonflow 端用），runId（ai-orchestrator 端用）
  const jobId = options.jobId ?? makeId();

  return {
    jobId,
    runId: start.runId,
    snapshot: start.snapshot,
    novelInput,
  };
}
