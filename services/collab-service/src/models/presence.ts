/**
 * 在线状态 (presence)
 *  - 用户维度的在线/离线/正在查看哪个项目
 *  - 30s 心跳
 */
export type PresenceStatus = "online" | "away" | "offline";

export interface Presence {
  userId: string;
  status: PresenceStatus;
  projectId: string | null;       // 正在协作的项目
  cursor: { x: number; y: number } | null; // 协作光标位置 (画布坐标)
  lastHeartbeatAt: Date;
  joinedAt: Date;
  meta: Record<string, unknown>;
}

export interface HeartbeatInput {
  userId: string;
  projectId?: string | null;
  cursor?: { x: number; y: number } | null;
  status?: PresenceStatus;
}
