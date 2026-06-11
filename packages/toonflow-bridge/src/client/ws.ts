/**
 * Toonflow 端 WebSocket 进度回推客户端
 *
 * 用途：bridge 在收到 ai-orchestrator 的 step 状态变化后，把消息转换
 * 成 ToonflowProgressEvent 推回 Toonflow 自己的 WS / callback 端点。
 *
 * Toonflow 标准协议（自行约定）：
 *   - URL:   wss://<toonflow-host>/ws/jobs/:jobId
 *   - 发送:  { type: "progress", payload: ToonflowProgressEvent }
 *   - 心跳:  每 25s 一帧 { type: "ping", ts }
 *   - 重连:  指数退避（500/1000/2000/4000ms, 最多 5 次）
 */

import WebSocket from "ws";
import type { ToonflowProgressEvent } from "../types/toonflow.js";

export interface ToonflowWsOptions {
  /** Toonflow 给的 jobId,会拼到 URL 路径 */
  jobId: string;
  /** wss://...host，不含路径 */
  baseWsUrl: string;
  /** 鉴权 token（Toonflow 端约定：query ?token= 或 subprotocol） */
  token?: string;
  /** 心跳间隔（ms），默认 25000 */
  heartbeatMs?: number;
  /** 最多重连次数，默认 5 */
  maxReconnect?: number;
  logger?: (line: string) => void;
}

type WsState = "idle" | "connecting" | "open" | "closed" | "failed";

export class ToonflowWsClient {
  private ws: WebSocket | null = null;
  private state: WsState = "idle";
  private reconnectAttempt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private explicitClosed = false;

  constructor(private readonly opts: ToonflowWsOptions) {}

  /** 建立连接（可重复调用，内部去重） */
  connect(): void {
    if (this.state === "open" || this.state === "connecting") return;
    this.explicitClosed = false;
    this.openSocket();
  }

  /** 主动关闭（不再重连） */
  close(reason = "client_close"): void {
    this.explicitClosed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, reason);
      } catch {
        /* ignore */
      }
    }
    this.state = "closed";
  }

  /** 推送一条进度事件 */
  sendProgress(event: ToonflowProgressEvent): boolean {
    if (this.state !== "open" || !this.ws) return false;
    try {
      this.ws.send(JSON.stringify({ type: "progress", payload: event }));
      return true;
    } catch (err) {
      this.opts.logger?.(`[toonflow-ws] send failed: ${(err as Error).message}`);
      return false;
    }
  }

  getState(): WsState {
    return this.state;
  }

  // ---- 内部 ----
  private openSocket(): void {
    this.state = "connecting";
    const base = this.opts.baseWsUrl.replace(/\/$/, "");
    const qs = this.opts.token ? `?token=${encodeURIComponent(this.opts.token)}` : "";
    const url = `${base}/ws/jobs/${encodeURIComponent(this.opts.jobId)}${qs}`;
    this.opts.logger?.(`[toonflow-ws] connecting ${url}`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.state = "open";
      this.reconnectAttempt = 0;
      this.opts.logger?.(`[toonflow-ws] open jobId=${this.opts.jobId}`);

      // 启心跳
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        if (this.state === "open" && this.ws) {
          try {
            this.ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          } catch {
            /* ignore */
          }
        }
      }, this.opts.heartbeatMs ?? 25_000);
    });

    ws.on("message", (raw) => {
      // Toonflow 端会发回 { type: "ack" } 或控制消息，本客户端不强制处理
      this.opts.logger?.(`[toonflow-ws] recv ${raw.toString().slice(0, 120)}`);
    });

    ws.on("close", (code, reasonBuf) => {
      this.state = "closed";
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      const reason = reasonBuf.toString();
      this.opts.logger?.(`[toonflow-ws] closed code=${code} reason=${reason}`);

      if (this.explicitClosed) return;
      if (this.reconnectAttempt >= (this.opts.maxReconnect ?? 5)) {
        this.state = "failed";
        this.opts.logger?.(`[toonflow-ws] give up after ${this.reconnectAttempt} retries`);
        return;
      }
      const delay = Math.min(4000, 500 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;
      setTimeout(() => this.openSocket(), delay);
    });

    ws.on("error", (err) => {
      this.opts.logger?.(`[toonflow-ws] error: ${err.message}`);
    });
  }
}
