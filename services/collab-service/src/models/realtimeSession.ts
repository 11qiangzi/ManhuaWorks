/**
 * WebSocket 实时会话 (持久化记录 + 内存索引)
 *  - 每个 WS 连接落库一条 (供断线重连/审计)
 */
export type SessionStatus = "active" | "closed" | "expired";

export interface RealtimeSession {
  id: string;                 // 服务端生成 (uuid)
  userId: string;
  projectId: string | null;
  clientId: string;           // 客户端自报
  ip: string | null;
  userAgent: string | null;
  status: SessionStatus;
  connectedAt: Date;
  lastPingAt: Date;
  closedAt: Date | null;
  closeReason: string | null;
}

export interface OpenSessionInput {
  id: string;
  userId: string;
  projectId: string | null;
  clientId: string;
  ip?: string | null;
  userAgent?: string | null;
}
