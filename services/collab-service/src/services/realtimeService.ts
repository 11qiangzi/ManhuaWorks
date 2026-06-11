/**
 * RealtimeService - WS 实时同步 + Redis pub/sub 跨进程广播
 *
 * 职责：
 *  - 维护内存中的 (projectId -> Set<Connection>) 索引
 *  - 通过 redisPub 广播到 channel collab:project:<id> / collab:user:<id>
 *  - redisSub 收到后扇出到本进程所有相关连接
 *  - 提供 sendToConnection() (私信/单播)
 *
 * 注：WS 自身的 connection 注册由 ws/server.ts 调用 (避免循环依赖)
 */
import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { redisPub, redisSub, REDIS_CHANNELS } from "../config/redis.js";
import { logger } from "../config/logger.js";

export interface ConnectionMeta {
  id: string;             // connId (uuid)
  userId: string;
  projectId: string | null;
  clientId: string;
  socket: WebSocket;
  ip: string | null;
  userAgent: string | null;
  lastPingAt: number;
}

export interface BroadcastEnvelope {
  type: string;
  event: string;
  data: unknown;
}

export interface MentionPayload {
  commentId: string;
  projectId: string;
  actorId: string;
  preview: string;
}

export class RealtimeService {
  private connections = new Map<string, ConnectionMeta>();
  private projectIndex = new Map<string, Set<string>>(); // projectId -> connId
  private userIndex = new Map<string, Set<string>>();     // userId -> connId
  private subscriberReady = false;

  constructor() {
    void this.initSubscriber();
  }

  private async initSubscriber(): Promise<void> {
    // 模式订阅: collab:project:*  / collab:user:*
    await redisSub.psubscribe(`${REDIS_CHANNELS.global}*`);
    redisSub.on("pmessage", (_pattern, channel, message) => {
      this.fanOutFromRedis(channel, message);
    });
    redisSub.on("error", (err) => {
      logger.error({ err }, "redisSub 错误");
    });
    this.subscriberReady = true;
    logger.info("RealtimeService: redis pub/sub 已订阅");
  }

  private fanOutFromRedis(channel: string, message: string): void {
    let env: BroadcastEnvelope;
    try {
      env = JSON.parse(message) as BroadcastEnvelope;
    } catch (err) {
      logger.warn({ err, channel }, "fanOutFromRedis: JSON 解析失败");
      return;
    }
    if (channel.startsWith("collab:project:")) {
      const projectId = channel.slice("collab:project:".length);
      const set = this.projectIndex.get(projectId);
      if (!set) return;
      for (const connId of set) this.sendToConn(connId, env);
    } else if (channel.startsWith("collab:user:")) {
      const userId = channel.slice("collab:user:".length);
      const set = this.userIndex.get(userId);
      if (!set) return;
      for (const connId of set) this.sendToConn(connId, env);
    }
  }

  private sendToConn(connId: string, env: BroadcastEnvelope): void {
    const meta = this.connections.get(connId);
    if (!meta) return;
    if (meta.socket.readyState !== meta.socket.OPEN) return;
    try {
      meta.socket.send(JSON.stringify({ ...env, ts: Date.now() }));
    } catch (err) {
      logger.warn({ err, connId }, "sendToConn 失败");
    }
  }

  // ============== 注册 / 注销 ==============

  register(meta: Omit<ConnectionMeta, "lastPingAt">): ConnectionMeta {
    const full: ConnectionMeta = { ...meta, lastPingAt: Date.now() };
    this.connections.set(full.id, full);
    if (full.projectId) {
      let set = this.projectIndex.get(full.projectId);
      if (!set) {
        set = new Set();
        this.projectIndex.set(full.projectId, set);
      }
      set.add(full.id);
    }
    let userSet = this.userIndex.get(full.userId);
    if (!userSet) {
      userSet = new Set();
      this.userIndex.set(full.userId, userSet);
    }
    userSet.add(full.id);
    return full;
  }

  unregister(connId: string): ConnectionMeta | null {
    const meta = this.connections.get(connId);
    if (!meta) return null;
    this.connections.delete(connId);
    if (meta.projectId) {
      const set = this.projectIndex.get(meta.projectId);
      if (set) {
        set.delete(connId);
        if (set.size === 0) this.projectIndex.delete(meta.projectId);
      }
    }
    const userSet = this.userIndex.get(meta.userId);
    if (userSet) {
      userSet.delete(connId);
      if (userSet.size === 0) this.userIndex.delete(meta.userId);
    }
    return meta;
  }

  get(connId: string): ConnectionMeta | null {
    return this.connections.get(connId) ?? null;
  }

  setProject(connId: string, projectId: string | null): ConnectionMeta | null {
    const meta = this.connections.get(connId);
    if (!meta) return null;
    if (meta.projectId) this.projectIndex.get(meta.projectId)?.delete(connId);
    meta.projectId = projectId;
    if (projectId) {
      let set = this.projectIndex.get(projectId);
      if (!set) {
        set = new Set();
        this.projectIndex.set(projectId, set);
      }
      set.add(connId);
    }
    return meta;
  }

  touch(connId: string): void {
    const meta = this.connections.get(connId);
    if (meta) meta.lastPingAt = Date.now();
  }

  stats(): { connections: number; projects: number; users: number } {
    return {
      connections: this.connections.size,
      projects: this.projectIndex.size,
      users: this.userIndex.size,
    };
  }

  listProjectConnections(projectId: string): ConnectionMeta[] {
    const ids = this.projectIndex.get(projectId);
    if (!ids) return [];
    const out: ConnectionMeta[] = [];
    for (const id of ids) {
      const c = this.connections.get(id);
      if (c) out.push(c);
    }
    return out;
  }

  // ============== 广播 ==============

  broadcastToProject(projectId: string, env: BroadcastEnvelope): void {
    const channel = REDIS_CHANNELS.project(projectId);
    const payload = JSON.stringify(env);
    redisPub.publish(channel, payload).catch((err) => {
      logger.error({ err, channel }, "broadcastToProject publish 失败");
    });
  }

  broadcastToUser(userId: string, env: BroadcastEnvelope): void {
    const channel = REDIS_CHANNELS.user(userId);
    const payload = JSON.stringify(env);
    redisPub.publish(channel, payload).catch((err) => {
      logger.error({ err, channel, userId }, "broadcastToUser publish 失败");
    });
  }

  // mention 触发的内部通道 (供 notificationService 复用)
  async notifyMentions(userId: string, payload: MentionPayload): Promise<void> {
    this.broadcastToUser(userId, {
      type: "mention",
      event: "new",
      data: payload,
    });
  }

  isSubscriberReady(): boolean {
    return this.subscriberReady;
  }

  newConnId(): string {
    return randomUUID();
  }
}
