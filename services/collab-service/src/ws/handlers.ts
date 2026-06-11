/**
 * WS 消息处理
 *  - 入站 5 类: typing / cursor / edit / comment / join (也含 leave / ping)
 *  - 出站: 直接调用 realtimeService 广播
 */
import { z } from "zod";
import type { WebSocket } from "ws";
import type { ConnectionMeta, RealtimeService } from "../services/realtimeService.js";
import { logger } from "../config/logger.js";

const CursorPayload = z.object({
  projectId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
});

const TypingPayload = z.object({
  projectId: z.string().uuid(),
  isTyping: z.boolean(),
});

const EditPayload = z.object({
  projectId: z.string().uuid(),
  targetType: z.enum(["panel", "script", "asset", "general"]),
  targetId: z.string().uuid().nullable().optional(),
  op: z.enum(["insert", "update", "delete", "noop"]),
  // 不传输完整内容, 仅提示有变化
  preview: z.string().max(200).optional(),
});

const JoinPayload = z.object({
  projectId: z.string().uuid(),
});

const LeavePayload = z.object({
  projectId: z.string().uuid(),
});

const CommentPayload = z.object({
  projectId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  targetType: z.enum(["project", "panel", "script", "asset", "general"]),
  targetId: z.string().uuid().nullable().optional(),
  parentCommentId: z.string().uuid().nullable().optional(),
});

const PingPayload = z.object({ ts: z.number().optional() });

const Inbound = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping"), data: PingPayload.optional() }),
  z.object({ type: z.literal("typing"), data: TypingPayload }),
  z.object({ type: z.literal("cursor"), data: CursorPayload }),
  z.object({ type: z.literal("edit"), data: EditPayload }),
  z.object({ type: z.literal("join"), data: JoinPayload }),
  z.object({ type: z.literal("leave"), data: LeavePayload }),
  z.object({ type: z.literal("comment"), data: CommentPayload }),
]);

export type InboundMessage = z.infer<typeof Inbound>;

export interface HandlerDeps {
  realtime: RealtimeService;
  onCreateComment: (meta: ConnectionMeta, payload: z.infer<typeof CommentPayload>) => Promise<void>;
}

function send(socket: WebSocket, env: unknown): void {
  if (socket.readyState !== socket.OPEN) return;
  try {
    socket.send(JSON.stringify(env));
  } catch (err) {
    logger.warn({ err }, "WS send 失败");
  }
}

export function makeHandlers(deps: HandlerDeps) {
  const { realtime, onCreateComment } = deps;

  return async function handle(meta: ConnectionMeta, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      send(meta.socket, { type: "error", event: "bad_json", data: { message: "JSON 解析失败" } });
      return;
    }
    const result = Inbound.safeParse(parsed);
    if (!result.success) {
      send(meta.socket, { type: "error", event: "bad_payload", data: result.error.flatten() });
      return;
    }
    const msg = result.data;
    realtime.touch(meta.id);

    switch (msg.type) {
      case "ping": {
        send(meta.socket, { type: "pong", event: "pong", data: { ts: Date.now() } });
        return;
      }
      case "typing": {
        realtime.setProject(meta.id, msg.data.projectId);
        realtime.broadcastToProject(msg.data.projectId, {
          type: "typing",
          event: msg.data.isTyping ? "start" : "stop",
          data: { userId: meta.userId, projectId: msg.data.projectId },
        });
        return;
      }
      case "cursor": {
        realtime.setProject(meta.id, msg.data.projectId);
        realtime.broadcastToProject(msg.data.projectId, {
          type: "cursor",
          event: "move",
          data: { userId: meta.userId, x: msg.data.x, y: msg.data.y },
        });
        return;
      }
      case "edit": {
        realtime.setProject(meta.id, msg.data.projectId);
        realtime.broadcastToProject(msg.data.projectId, {
          type: "edit",
          event: msg.data.op,
          data: {
            userId: meta.userId,
            targetType: msg.data.targetType,
            targetId: msg.data.targetId ?? null,
            op: msg.data.op,
            preview: msg.data.preview ?? null,
            ts: Date.now(),
          },
        });
        return;
      }
      case "join": {
        realtime.setProject(meta.id, msg.data.projectId);
        realtime.broadcastToProject(msg.data.projectId, {
          type: "presence",
          event: "joined",
          data: { userId: meta.userId, projectId: msg.data.projectId, connId: meta.id },
        });
        return;
      }
      case "leave": {
        realtime.broadcastToProject(msg.data.projectId, {
          type: "presence",
          event: "left",
          data: { userId: meta.userId, projectId: msg.data.projectId },
        });
        realtime.setProject(meta.id, null);
        return;
      }
      case "comment": {
        realtime.setProject(meta.id, msg.data.projectId);
        // 走 service (解析 mention + 落库 + activity)
        await onCreateComment(meta, msg.data);
        return;
      }
    }
  };
}
