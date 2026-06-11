/**
 * WebSocket Server
 *  - 挂在同一 HTTP server 的 /ws 路径
 *  - 握手时 JWT 校验
 *  - 30s 心跳 (ping/pong)
 *  - 落库 realtime_sessions
 */
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { realtimeService, commentService, activityService, notificationService } from "../container.js";
import { authenticateUpgrade, extractClientId, extractClientIp } from "./auth.js";
import { makeHandlers } from "./handlers.js";
import {
  openSession,
  pingSession,
  closeSession,
  expireStaleSessions,
} from "../repositories/realtimeSessionRepository.js";
import { AppError } from "@manhuaworks/shared";
import type { ConnectionMeta } from "../services/realtimeService.js";

const HEARTBEAT_MS = env.WS_HEARTBEAT_INTERVAL_MS;
const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_MS * 2;

let wss: WebSocketServer | null = null;

interface ClientFrame {
  meta: ConnectionMeta;
  isAlive: boolean;
}

const clients = new WeakMap<WebSocket, ClientFrame>();

export function attachWebSocket(httpServer: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ noServer: true, path: env.WS_PATH });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url) {
      socket.destroy();
      return;
    }
    const path = req.url.split("?")[0];
    if (path !== env.WS_PATH) {
      // 不接管其他 upgrade
      return;
    }
    const user = authenticateUpgrade(req);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit("connection", ws, req, user);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: unknown, user: { id: string; displayName?: string }) => {
    void onConnection(ws, user);
  });

  // 服务端心跳
  const interval = setInterval(() => {
    if (!wss) return;
    for (const ws of wss.clients) {
      const frame = clients.get(ws);
      if (!frame) continue;
      if (!frame.isAlive) {
        try { ws.terminate(); } catch { /* ignore */ }
        continue;
      }
      frame.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
    // 后台清理 stale session
    expireStaleSessions(HEARTBEAT_TIMEOUT_MS).catch((err) =>
      logger.warn({ err }, "expireStaleSessions 失败")
    );
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(interval));

  return wss;
}

async function onConnection(ws: WebSocket, user: { id: string; displayName?: string }): Promise<void> {
  const connId = realtimeService.newConnId();
  const clientId = extractClientId({ url: "", headers: {} } as never, "web");
  const ip = extractClientIp({ headers: {}, socket: (ws as unknown as { _socket?: { remoteAddress?: string } })._socket } as never);

  // 注册到 realtimeService
  const meta = realtimeService.register({
    id: connId,
    userId: user.id,
    projectId: null,
    clientId,
    socket: ws,
    ip,
    userAgent: null,
  });
  clients.set(ws, { meta, isAlive: true });

  // 落库 session
  try {
    await openSession({
      id: connId,
      userId: user.id,
      projectId: null,
      clientId,
      ip,
      userAgent: null,
    });
  } catch (err) {
    logger.warn({ err, connId }, "openSession 落库失败 (非致命)");
  }

  // 握手成功消息
  try {
    ws.send(JSON.stringify({
      type: "system",
      event: "connected",
      data: { connId, userId: user.id, ts: Date.now() },
    }));
  } catch { /* ignore */ }

  // 心跳响应
  ws.on("pong", () => {
    const f = clients.get(ws);
    if (f) {
      f.isAlive = true;
      realtimeService.touch(f.meta.id);
      pingSession(f.meta.id).catch(() => undefined);
    }
  });

  const handle = makeHandlers({
    realtime: realtimeService,
    onCreateComment: async (m, payload) => {
      try {
        const created = await commentService.create(m.userId, payload);
        for (const userId of created.mentions) {
          await notificationService
            .send({
              userId,
              type: "comment.mention",
              title: "有人 @ 了你",
              body: created.body.slice(0, 80),
              projectId: created.projectId,
              actorId: created.authorId,
              link: `/projects/${created.projectId}/comments/${created.id}`,
              payload: { commentId: created.id },
            })
            .catch(() => undefined);
        }
        await activityService
          .record({
            projectId: created.projectId,
            actorId: m.userId,
            type: "comment.created",
            targetType: "comment",
            targetId: created.id,
            payload: { via: "ws" },
          })
          .catch(() => undefined);
      } catch (err) {
        const msg = err instanceof AppError ? err.message : "创建评论失败";
        try {
          ws.send(JSON.stringify({ type: "error", event: "comment_failed", data: { message: msg } }));
        } catch { /* ignore */ }
      }
    },
  });

  ws.on("message", (data) => {
    const text = data.toString();
    handle(meta, text).catch((err) => {
      logger.error({ err, connId }, "WS 处理失败");
    });
  });

  ws.on("close", (code, reason) => {
    const reasonStr = reason?.toString?.() ?? `code=${code}`;
    realtimeService.unregister(connId);
    closeSession(connId, reasonStr).catch(() => undefined);
    if (meta.projectId) {
      realtimeService.broadcastToProject(meta.projectId, {
        type: "presence",
        event: "left",
        data: { userId: meta.userId, projectId: meta.projectId, reason: reasonStr },
      });
    }
    clients.delete(ws);
    logger.info({ connId, userId: user.id, reason: reasonStr }, "WS 连接关闭");
  });

  ws.on("error", (err) => {
    logger.warn({ err, connId }, "WS 连接错误");
  });
}

export function getWss(): WebSocketServer | null {
  return wss;
}
