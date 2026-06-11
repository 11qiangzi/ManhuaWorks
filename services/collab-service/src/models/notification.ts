/**
 * 通知 (站内 + 邮件/外部钩子预留)
 */
export type NotificationType =
  | "comment.mention"
  | "comment.reply"
  | "comment.resolved"
  | "activity.project"
  | "member.invited"
  | "member.removed";

export type NotificationChannel = "in_app" | "email" | "webhook";
export type NotificationStatus = "unread" | "read" | "archived";

export interface Notification {
  id: string;
  userId: string;             // 接收人
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  projectId: string | null;
  actorId: string | null;     // 触发人
  link: string | null;        // 站内跳转链接
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  body: string;
  projectId?: string | null;
  actorId?: string | null;
  link?: string | null;
  payload?: Record<string, unknown>;
}
