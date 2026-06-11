/**
 * 评论数据模型
 *  - 支持线程化 (parent_comment_id)
 *  - 支持 @mention
 *  - 解决/重开
 */
export type CommentTargetType = "project" | "panel" | "script" | "asset" | "general";

export interface Comment {
  id: string;
  projectId: string;
  authorId: string;
  targetType: CommentTargetType;
  targetId: string | null;       // 关联资源 id (panel/script/asset)，general 时为 null
  parentCommentId: string | null;
  body: string;
  mentions: string[];             // @ 到的 user_id 列表
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentInput {
  projectId: string;
  authorId: string;
  targetType: CommentTargetType;
  targetId?: string | null;
  parentCommentId?: string | null;
  body: string;
}

export interface UpdateCommentInput {
  body?: string;
}
