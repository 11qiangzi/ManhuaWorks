/**
 * ToonflowBridge —— 顶层「门面」类。
 *
 * 职责：把 input adapter / output adapter / progress adapter / 两个 client 串起来，
 * 提供两种用法：
 *   - run():     同步返回最终 ToonflowJobResult（自动 poll + 进度通过 onProgress 回调）
 *   - start():   异步立即返回 handle，调用方可订阅 / 取消
 *
 * 设计原则：
 *   - 一切 HTTP/WS 资源在 finally 关闭（WS 不会泄漏）
 *   - 不持有任何全局状态；多次 run 之间互不影响
 *   - 失败语义明确：Adapter / Http / Mapping 错误统一 throw 带 name 的 Error 子类
 */

import { OrchestratorClient } from "./client/http.js";
import { ToonflowWsClient } from "./client/ws.js";
import {
  startFromToonflow,
  InputAdapterError,
  type AdaptedStartResult,
} from "./adapters/input.js";
import {
  waitForToonflowResult,
  OutputAdapterError,
  type WaitOptions,
} from "./adapters/output.js";
import { mapSnapToToonflowEvent } from "./adapters/progress.js";
import type {
  ToonflowJobResult,
  ToonflowProgressEvent,
  ToonflowRunRequest,
  ToonflowWorkflow,
} from "./types/toonflow.js";

export interface ToonflowBridgeOptions {
  orchestratorUrl: string;
  /** 调 ai-orchestrator 用的 token（Bearer） */
  orchestratorToken?: string;
  /** 推 Toonflow 进度用的 WS 基址，例如 wss://toonflow.example.com */
  toonflowWsUrl?: string;
  /** Toonflow 端鉴权 token */
  toonflowToken?: string;
  /** 默认轮询间隔（ms），可被 run 覆盖 */
  pollIntervalMs?: number;
  /** 默认超时（ms），可被 run 覆盖 */
  timeoutMs?: number;
  logger?: (line: string) => void;
}

export interface ToonflowRunOptions {
  jobId?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 进度回调（每轮 poll 后调用；包含 5 状态 + 百分比） */
  onProgress?: (ev: ToonflowProgressEvent) => void;
  /** 是否同时通过 WS 推回 Toonflow 端（默认 true：toonflowWsUrl 存在时） */
  pushToToonflow?: boolean;
}

export interface ToonflowRunHandle {
  jobId: string;
  runId: string;
  workflowId: string;
  /** 同步等结果 */
  waitForResult(): Promise<ToonflowJobResult>;
  /** 取最近一次 snapshot */
  latestSnapshot(): Promise<unknown>;
  /** 取消 */
  cancel(): Promise<void>;
}

export class ToonflowBridge {
  private readonly http: OrchestratorClient;
  private readonly opts: ToonflowBridgeOptions;
  private readonly log: (line: string) => void;

  constructor(opts: ToonflowBridgeOptions) {
    this.opts = opts;
    this.http = new OrchestratorClient({
      baseUrl: opts.orchestratorUrl,
      token: opts.orchestratorToken,
      logger: opts.logger,
    });
    this.log = opts.logger ?? (() => {});
  }

  /**
   * 一次性：等 mp4 出来
   */
  async run(
    workflow: ToonflowWorkflow,
    request: ToonflowRunRequest,
    options: ToonflowRunOptions = {},
  ): Promise<ToonflowJobResult> {
    const handle = await this.start(workflow, request, options);
    return handle.waitForResult();
  }

  /**
   * 异步启动：返回 handle，调用方订阅 / 等待
   */
  async start(
    workflow: ToonflowWorkflow,
    request: ToonflowRunRequest,
    options: ToonflowRunOptions = {},
  ): Promise<ToonflowRunHandle> {
    // 1. 启动 ai-orchestrator run
    let started: AdaptedStartResult;
    try {
      started = await startFromToonflow(workflow, request, this.http, {
        jobId: options.jobId,
      });
    } catch (err) {
      if (err instanceof InputAdapterError) throw err;
      throw new InputAdapterError(`unexpected start error: ${(err as Error).message}`);
    }
    const { jobId, runId, snapshot } = started;
    this.log(`[bridge] start jobId=${jobId} runId=${runId} status=${snapshot.status}`);

    // 2. 配 WS 客户端（可选）
    const wsEnabled =
      (options.pushToToonflow ?? true) && !!this.opts.toonflowWsUrl;
    const ws = wsEnabled
      ? new ToonflowWsClient({
          jobId,
          baseWsUrl: this.opts.toonflowWsUrl!,
          token: this.opts.toonflowToken,
          logger: this.log,
        })
      : null;
    if (ws) ws.connect();

    // 3. 起手事件立刻推一次
    const firstEvent = mapSnapToToonflowEvent(jobId, workflow.workflowId, snapshot);
    if (ws) ws.sendProgress(firstEvent);
    options.onProgress?.(firstEvent);

    // 4. 等结果
    const waitOpts: WaitOptions = {
      pollIntervalMs: options.pollIntervalMs ?? this.opts.pollIntervalMs ?? 2_000,
      timeoutMs: options.timeoutMs ?? this.opts.timeoutMs ?? 600_000,
      signal: options.signal,
    };

    const handle: ToonflowRunHandle = {
      jobId,
      runId,
      workflowId: workflow.workflowId,
      waitForResult: async () => {
        try {
          const result = await waitForToonflowResult(
            jobId,
            workflow.workflowId,
            runId,
            this.http,
            {
              ...waitOpts,
              onPoll: (snap) => {
                const ev = mapSnapToToonflowEvent(jobId, workflow.workflowId, snap);
                if (ws) ws.sendProgress(ev);
                options.onProgress?.(ev);
              },
            },
          );

          // 终态补一次 done/failed 事件（让 Toonflow 端 UI 收到收尾）
          const finalEvent: ToonflowProgressEvent = {
            jobId,
            workflowId: workflow.workflowId,
            status: result.status,
            progress: result.status === "done" ? 100 : -1,
            message: result.error,
            ts: Date.now(),
          };
          if (ws) ws.sendProgress(finalEvent);
          options.onProgress?.(finalEvent);

          return result;
        } finally {
          if (ws) ws.close(`jobId=${jobId} done`);
        }
      },
      latestSnapshot: async () => this.http.getRun(runId),
      cancel: async () => {
        await this.http.cancelRun(runId);
        if (ws) ws.close(`jobId=${jobId} cancelled`);
      },
    };

    return handle;
  }
}
