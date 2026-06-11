/**
 * @manhuaworks/toonflow-bridge
 *
 * 兼容对接层 v1：让 ManhuaWorks 系统能接收 Toonflow 格式的输入并返回标准 mp4。
 *
 *  ┌────────────┐   ToonflowRunRequest   ┌─────────────────────┐   NovelToDramaInput
 *  │  Toonflow  │ ─────────────────────▶ │ ToonflowBridge      │ ───────────────────────▶  ai-orchestrator
 *  │  Caller    │                        │ (this package)      │
 *  │            │ ◀─────────────────────  │                     │ ◀──── RunSnapshot ─────  (HTTP)
 *  └────────────┘   ToonflowJobResult    └─────────────────────┘
 *                                          │ WS progress
 *                                          ▼
 *                                       ToonflowProgressEvent
 *
 * 用法：
 *
 *   import { ToonflowBridge } from "@manhuaworks/toonflow-bridge";
 *
 *   const bridge = new ToonflowBridge({
 *     orchestratorUrl: "http://127.0.0.1:8087",
 *     orchestratorToken: process.env.ORCH_TOKEN,
 *     toonflowWsUrl: "wss://toonflow.example.com",
 *     toonflowToken: process.env.TOONFLOW_TOKEN,
 *   });
 *
 *   // 一次性（同步等待 mp4）
 *   const result = await bridge.run(workflow, runRequest);
 *
 *   // 或流式（订阅进度）
 *   const handle = await bridge.start(workflow, runRequest, {
 *     onProgress: (ev) => console.log(ev.status, ev.progress),
 *   });
 *   const result = await handle.waitForResult();
 */

export { ToonflowBridge } from "./bridge.js";
export type { ToonflowBridgeOptions, ToonflowRunHandle } from "./bridge.js";

// Adapters
export {
  startFromToonflow,
  InputAdapterError,
} from "./adapters/input.js";
export type { AdaptedStartResult } from "./adapters/input.js";

export {
  waitForToonflowResult,
  snapToToonflowResult,
  OutputAdapterError,
} from "./adapters/output.js";
export type { WaitOptions } from "./adapters/output.js";

export {
  mapSnapToToonflowStatus,
  mapSnapToProgress,
  mapSnapToToonflowEvent,
  toonflowStatusHint,
} from "./adapters/progress.js";

// Mappers
export { toonflowToNovel, ToonflowMappingError } from "./mapper/toonflow-to-novel.js";
export { novelToToonflow, NovelToToonflowError } from "./mapper/novel-to-toonflow.js";

// Clients
export { OrchestratorClient, OrchestratorHttpError, createOrchestratorClient } from "./client/http.js";
export type { OrchestratorHttpOptions, StartNovelToDramaResponse } from "./client/http.js";
export { ToonflowWsClient } from "./client/ws.js";
export type { ToonflowWsOptions } from "./client/ws.js";

// Types
export type {
  ToonflowNode,
  ToonflowNodeKind,
  ToonflowEdge,
  ToonflowWorkflow,
  ToonflowCharacter,
  ToonflowRunRequest,
  ToonflowProgressEvent,
  ToonflowJobResult,
  ToonflowShot,
  ToonflowStatus,
} from "./types/toonflow.js";
export { TOONFLOW_PROGRESS_HINT } from "./types/toonflow.js";

export type {
  ArtStyle,
  StoryType,
  AuthUser,
  UserTier,
  NovelToDramaInput,
  NovelToDramaOutput,
  RunSnapshot,
  RunStatus,
  StepResult,
  CostSummary,
  ManhuaPipelineStep,
} from "./types/manhua.js";
export { MANHUA_PIPELINE_STEPS, MANHUA_PIPELINE_NAME } from "./types/manhua.js";
