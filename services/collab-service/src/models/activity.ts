/**
 * 活动流 (activity)
 *  - 记录项目内所有协作事件
 *  - 用于活动流聚合展示
 */
export type ActivityType =
  | "comment.created"
  | "comment.resolved"
  | "comment.reopened"
  | "comment.mentioned"
  | "panel.created"
  | "panel.updated"
  | "panel.deleted"
  | "asset.uploaded"
  | "member.joined"
  | "member.left"
  | "presence.joined"
  | "presence.left";

export interface Activity {
  id: string;
  projectId: string;
  actorId: string;          // 谁触发的
  type: ActivityType;
  targetType: string | null; // 关联资源类型
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface RecordActivityInput {
  projectId: string;
  actorId: string;
  type: ActivityType;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}
