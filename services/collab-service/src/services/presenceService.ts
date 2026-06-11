/**
 * PresenceService - 在线状态业务
 *  - 心跳 (Redis 主存 + DB 审计)
 *  - 上线/下线
 *  - 项目在线列表
 */
import * as presenceRepo from "../repositories/presenceRepository.js";
import * as activityRepo from "../repositories/activityRepository.js";
import type { Presence, PresenceStatus } from "../models/presence.js";
import type { RealtimeService } from "./realtimeService.js";

export interface PresenceDeps {
  realtime: RealtimeService;
}

export class PresenceService {
  private realtime: RealtimeService;

  constructor(deps: PresenceDeps) {
    this.realtime = deps.realtime;
  }

  async heartbeat(userId: string, input: { projectId?: string | null; cursor?: { x: number; y: number } | null; status?: PresenceStatus }): Promise<Presence> {
    const existing = await presenceRepo.getRedis(userId);
    const now = new Date();
    const presence: Presence = {
      userId,
      status: input.status ?? existing?.status ?? "online",
      projectId: input.projectId !== undefined ? input.projectId : existing?.projectId ?? null,
      cursor: input.cursor !== undefined ? input.cursor : existing?.cursor ?? null,
      lastHeartbeatAt: now,
      joinedAt: existing?.joinedAt ?? now,
      meta: existing?.meta ?? {},
    };

    // 项目切换时记录活动
    if (existing?.projectId && existing.projectId !== presence.projectId) {
      this.realtime.broadcastToProject(existing.projectId, {
        type: "presence",
        event: "left",
        data: { userId, projectId: existing.projectId },
      });
      await activityRepo
        .insertActivity({
          projectId: existing.projectId,
          actorId: userId,
          type: "presence.left",
          payload: {},
        })
        .catch(() => undefined);
    }

    await presenceRepo.upsertRedis(presence);
    // 审计抽样: 每 5 次心跳写一次 db (避免刷爆)
    if (Math.random() < 0.2) {
      await presenceRepo.persistHeartbeat(presence).catch(() => undefined);
    }

    if (presence.projectId) {
      this.realtime.broadcastToProject(presence.projectId, {
        type: "presence",
        event: "heartbeat",
        data: { userId, status: presence.status, cursor: presence.cursor, lastHeartbeatAt: presence.lastHeartbeatAt },
      });
    }
    return presence;
  }

  async join(userId: string, projectId: string): Promise<Presence> {
    const p = await this.heartbeat(userId, { projectId, status: "online" });
    await activityRepo
      .insertActivity({
        projectId,
        actorId: userId,
        type: "presence.joined",
        payload: {},
      })
      .catch(() => undefined);
    this.realtime.broadcastToProject(projectId, {
      type: "presence",
      event: "joined",
      data: { userId, projectId },
    });
    return p;
  }

  async leave(userId: string, projectId: string): Promise<void> {
    await presenceRepo.markOffline(userId);
    this.realtime.broadcastToProject(projectId, {
      type: "presence",
      event: "left",
      data: { userId, projectId },
    });
    await activityRepo
      .insertActivity({
        projectId,
        actorId: userId,
        type: "presence.left",
        payload: {},
      })
      .catch(() => undefined);
  }

  async listProject(projectId: string): Promise<Presence[]> {
    return presenceRepo.listProjectPresence(projectId);
  }

  async get(userId: string): Promise<Presence | null> {
    return presenceRepo.getRedis(userId);
  }
}
