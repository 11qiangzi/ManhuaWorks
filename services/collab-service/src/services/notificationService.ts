/**
 * NotificationService - 通知
 *  - 站内通知 (落库 + 实时推 WS)
 *  - 邮件/webhook 钩子预留 (env 控制)
 */
import * as notifRepo from "../repositories/notificationRepository.js";
import type { Notification, NotificationStatus, CreateNotificationInput } from "../models/notification.js";
import type { RealtimeService } from "./realtimeService.js";
import { logger } from "../config/logger.js";

export interface NotificationDeps {
  realtime: RealtimeService;
}

export class NotificationService {
  private realtime: RealtimeService;

  constructor(deps: NotificationDeps) {
    this.realtime = deps.realtime;
  }

  async send(input: CreateNotificationInput): Promise<Notification> {
    const notif = await notifRepo.insertNotification(input);
    // 实时推送到用户 WS (个人通道)
    this.realtime.broadcastToUser(notif.userId, {
      type: "notification",
      event: "new",
      data: notif,
    });
    // 邮件 / webhook 钩子 (此处只占位)
    if (notif.channel === "email" || notif.channel === "webhook") {
      logger.info({ notifId: notif.id, channel: notif.channel }, "[stub] 外部通道分发未实现");
    }
    return notif;
  }

  async list(userId: string, opts: { status?: NotificationStatus; limit?: number; before?: Date } = {}): Promise<Notification[]> {
    return notifRepo.listNotifications(userId, opts);
  }

  async unreadCount(userId: string): Promise<number> {
    return notifRepo.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    return notifRepo.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<number> {
    return notifRepo.markAllRead(userId);
  }

  async archive(userId: string, id: string): Promise<boolean> {
    return notifRepo.archive(id, userId);
  }
}
