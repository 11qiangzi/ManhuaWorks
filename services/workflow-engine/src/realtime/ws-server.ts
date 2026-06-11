/**
 * WebSocket 服务（Hono + ws）
 *
 * 路由：
 *   ws://0.0.0.0:8084/ws?runId=<id>&lastSeq=<n>&clientId=<c>
 *
 * 协议（文本帧 JSON）：
 *   server → client:
 *     { type: "hello",    runId, clientId, ts }
 *     { type: "event",    event: WorkflowEvent }
 *     { type: "progress", snapshot: ProgressSnapshot }
 *     { type: "resume",   replayed, latestSeq, snapshot, finished }
 *     { type: "ping",     ts }
 *
 *   client → server:
 *     { type: "ping" }
 *     { type: "cancel",   reason?: string }
 *     { type: "resume",   lastSeq: number }
 *     { type: "subscribe" }    // 订阅另一个 runId（同一连接可订阅多个）
 *
 * 心跳：服务端每 25s 主动 ping；客户端断开后清理订阅。
 */

import { WebSocketServer, WebSocket as WSConn, type RawData } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { progressCenter, type ProgressSnapshot } from './progress.js';
import { eventBus, type WorkflowEvent } from './event-bus.js';
import { requestCancel } from './cancel.js';
import { resumeRun } from './resume.js';
import { loadSnapshot } from '../orchestrator/checkpoint.js';
import { config } from '../config.js';
import { nanoid } from 'nanoid';

type OutboundFrame =
  | { type: 'hello'; runId: string; clientId: string; ts: number }
  | { type: 'event'; event: WorkflowEvent }
  | { type: 'progress'; snapshot: ProgressSnapshot }
  | { type: 'resume'; replayed: number; latestSeq: number; snapshot: ProgressSnapshot | null; finished: boolean }
  | { type: 'pong'; ts: number }
  | { type: 'error'; message: string };

type InboundFrame =
  | { type: 'ping' }
  | { type: 'cancel'; reason?: string }
  | { type: 'resume'; lastSeq: number }
  | { type: 'subscribe'; runId: string };

interface ClientCtx {
  ws: WSConn;
  clientId: string;
  runIds: Set<string>;
  /** 该 runId 的事件 unsubscribe */
  unSubEvent: Map<string, () => void>;
  alive: boolean;
  /** 该 runId 当前已发送的最近 seq（用于内部参考） */
  lastSentSeq: Map<string, number>;
}

/* ======================== 工具 ======================== */

function safeSend(ws: WSConn, frame: OutboundFrame): void {
  if (ws.readyState !== WSConn.OPEN) return;
  try {
    ws.send(JSON.stringify(frame));
  } catch (e) {
    console.error('[ws-server] send error', (e as Error).message);
  }
}

function parseUrlParams(req: IncomingMessage): { runId?: string; lastSeq: number; clientId?: string } {
  try {
    const u = new URL(req.url ?? '/', 'http://localhost');
    const runId = u.searchParams.get('runId') ?? undefined;
    const lastSeq = Number(u.searchParams.get('lastSeq') ?? '0') || 0;
    const clientId = u.searchParams.get('clientId') ?? undefined;
    return { runId, lastSeq, clientId };
  } catch {
    return { lastSeq: 0 };
  }
}

/* ======================== 服务类 ======================== */

class RealtimeWSServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientCtx>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private port = 0;

  /** 挂载到现有 HTTP server（同 8084 端口；path = /ws） */
  attach(httpServer: HttpServer, path: string = '/ws'): void {
    this.wss = new WebSocketServer({ server: httpServer, path });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.wss.on('error', (e) => console.error('[ws-server] wss error', e));
    this.startHeartbeat();
    console.log(`[ws-server] attached at ws://0.0.0.0:${config.port}${path}`);
  }

  /** 单独启动（用于 demo / 测试） */
  start(port: number = config.port + 0, path: string = '/ws'): void {
    this.port = port;
    this.wss = new WebSocketServer({ port, path });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.wss.on('error', (e) => console.error('[ws-server] wss error', e));
    this.startHeartbeat();
    console.log(`[ws-server] standalone on ws://0.0.0.0:${port}${path}`);
  }

  private onConnection(ws: WSConn, req: IncomingMessage): void {
    const params = parseUrlParams(req);
    const clientId = params.clientId ?? `c-${nanoid(8)}`;
    const ctx: ClientCtx = {
      ws,
      clientId,
      runIds: new Set(),
      unSubEvent: new Map(),
      alive: true,
      lastSentSeq: new Map(),
    };

    // hello
    safeSend(ws, { type: 'hello', runId: params.runId ?? '*', clientId, ts: Date.now() });

    // 订阅初始 runId
    if (params.runId) {
      void this.subscribeRun(ctx, params.runId, params.lastSeq);
    }

    // 立即推送一次 snapshot（如果已存在）
    if (params.runId) {
      const snap = progressCenter.getSnapshot(params.runId);
      if (snap) safeSend(ws, { type: 'progress', snapshot: snap });
    }

    // 消息处理
    ws.on('message', (raw: RawData) => this.onMessage(ctx, raw));
    ws.on('pong', () => {
      ctx.alive = true;
    });
    ws.on('close', () => this.onClose(ctx));
    ws.on('error', (e) => {
      console.error('[ws-server] client error', e.message);
      this.onClose(ctx);
    });

    this.clients.add(ctx);
    console.log(`[ws-server] client connected: ${clientId} (runId=${params.runId ?? '*'})`);
  }

  private async onMessage(ctx: ClientCtx, raw: RawData): Promise<void> {
    let frame: InboundFrame;
    try {
      frame = JSON.parse(raw.toString()) as InboundFrame;
    } catch {
      safeSend(ctx.ws, { type: 'error', message: 'invalid JSON' });
      return;
    }
    switch (frame.type) {
      case 'ping':
        safeSend(ctx.ws, { type: 'pong', ts: Date.now() });
        return;
      case 'cancel': {
        // 取消当前 runId（取最后一个订阅的）
        const last = Array.from(ctx.runIds).pop();
        if (last) {
          const res = await requestCancel(last, frame.reason);
          safeSend(ctx.ws, { type: 'event', event: {
            id: `ev-cancel-${Date.now()}`,
            kind: 'workflow.cancelled',
            runId: last,
            workflow: (await loadSnapshot(last))?.workflow ?? 'unknown',
            ts: Date.now(),
            data: { reason: res.reason, removed: res.removed },
          } });
        } else {
          safeSend(ctx.ws, { type: 'error', message: 'no runId subscribed' });
        }
        return;
      }
      case 'resume': {
        const last = Array.from(ctx.runIds).pop();
        if (!last) {
          safeSend(ctx.ws, { type: 'error', message: 'no runId subscribed' });
          return;
        }
        const res = await resumeRun(last, frame.lastSeq ?? 0, ctx.clientId);
        safeSend(ctx.ws, {
          type: 'resume',
          replayed: res.replayed,
          latestSeq: res.latestSeq,
          snapshot: res.snapshot,
          finished: res.finished,
        });
        return;
      }
      case 'subscribe': {
        if (!frame.runId) {
          safeSend(ctx.ws, { type: 'error', message: 'subscribe.runId required' });
          return;
        }
        await this.subscribeRun(ctx, frame.runId, 0);
        return;
      }
      default: {
        const _exhaustive: never = frame;
        void _exhaustive;
        safeSend(ctx.ws, { type: 'error', message: 'unknown frame type' });
      }
    }
  }

  private async subscribeRun(ctx: ClientCtx, runId: string, lastSeq: number): Promise<void> {
    if (ctx.runIds.has(runId)) return;
    ctx.runIds.add(runId);

    // 订阅事件总线
    const off = eventBus.onRun(runId, (ev) => {
      // 更新 lastSentSeq（client 端后续 resume 用）
      const seq = (ev as { seq?: number }).seq;
      if (typeof seq === 'number') {
        ctx.lastSentSeq.set(runId, Math.max(ctx.lastSentSeq.get(runId) ?? 0, seq));
      }
      safeSend(ctx.ws, { type: 'event', event: ev });
    });
    ctx.unSubEvent.set(runId, off);

    // 立即做一次 resume（如果 lastSeq > 0）
    if (lastSeq > 0) {
      const res = await resumeRun(runId, lastSeq, ctx.clientId);
      safeSend(ctx.ws, {
        type: 'resume',
        replayed: res.replayed,
        latestSeq: res.latestSeq,
        snapshot: res.snapshot,
        finished: res.finished,
      });
    }
  }

  private onClose(ctx: ClientCtx): void {
    for (const off of ctx.unSubEvent.values()) off();
    this.clients.delete(ctx);
    console.log(`[ws-server] client disconnected: ${ctx.clientId}`);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      for (const ctx of this.clients) {
        if (!ctx.alive) {
          try {
            ctx.ws.terminate();
          } catch {
            // ignore
          }
          continue;
        }
        ctx.alive = false;
        try {
          ctx.ws.ping();
        } catch {
          // ignore
        }
      }
    }, 25_000);
    this.heartbeatTimer.unref?.();
  }

  /** 主动推送 progress（供外部模块在每次节点切换时直接调用，不必走 event-bus） */
  broadcastProgress(snap: ProgressSnapshot): void {
    for (const ctx of this.clients) {
      if (ctx.runIds.has(snap.runId)) {
        safeSend(ctx.ws, { type: 'progress', snapshot: snap });
      }
    }
  }

  /** 关闭 */
  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const ctx of this.clients) {
      try {
        ctx.ws.close(1001, 'server shutdown');
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }
  }
}

export const realtimeWS = new RealtimeWSServer();
