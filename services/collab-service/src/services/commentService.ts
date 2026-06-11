/**
 * CommentService - 评论业务
 *  - CRUD
 *  - @mention 解析 (@username)
 *  - 解决/重开
 *  - 落库同时记录 activity + 触发实时广播 (通过 realtimeService 回调注入避免循环依赖)
 */
import { z } from "zod";
import { AppError } from "../middleware/error.js";
import * as commentRepo from "../repositories/commentRepository.js";
import * as activityRepo from "../repositories/activityRepository.js";
import { resolveUsernames } from "../clients/userClient.js";
import type { Comment, CommentTargetType, CreateCommentInput, UpdateCommentInput } from "../models/comment.js";
import type { Activity } from "../models/activity.js";
import type { RealtimeService } from "./realtimeService.js";

const MENTION_RE = /@([a-zA-Z0-9_.\-]{1,32})/g;

export const CreateCommentSchema = z.object({
  projectId: z.string().uuid(),
  targetType: z.enum(["project", "panel", "script", "asset", "general"]),
  targetId: z.string().uuid().nullable().optional(),
  parentCommentId: z.string().uuid().nullable().optional(),
  body: z.string().min(1).max(5000),
});

export const UpdateCommentSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
});

export interface CommentDeps {
  realtime: RealtimeService;
}

export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m[1]) out.add(m[1].toLowerCase());
  }
  return [...out];
}

async function resolveMentionIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  return resolveUsernames(usernames);
}

export class CommentService {
  private realtime: RealtimeService;

  constructor(deps: CommentDeps) {
    this.realtime = deps.realtime;
  }

  async create(authorId: string, raw: unknown): Promise<Comment> {
    const data = CreateCommentSchema.parse(raw);
    const mentions = await resolveMentionIds(parseMentions(data.body));
    const comment = await commentRepo.insertComment({
      projectId: data.projectId,
      authorId,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      parentCommentId: data.parentCommentId ?? null,
      body: data.body,
      mentions,
    });

    const activity = await activityRepo.insertActivity({
      projectId: data.projectId,
      actorId: authorId,
      type: "comment.created",
      targetType: "comment",
      targetId: comment.id,
      payload: { targetType: comment.targetType, targetId: comment.targetId, mentions },
    });

    this.realtime.broadcastToProject(comment.projectId, {
      type: "comment",
      event: "created",
      data: { comment, activity },
    });

    // mention 通知 (异步、不阻塞)
    for (const userId of mentions) {
      this.realtime.notifyMentions(userId, {
        commentId: comment.id,
        projectId: comment.projectId,
        actorId: authorId,
        preview: comment.body.slice(0, 80),
      }).catch(() => undefined);
    }

    return comment;
  }

  async get(id: string): Promise<Comment> {
    const c = await commentRepo.findCommentById(id);
    if (!c) throw new AppError("评论不存在", 404, "COMMENT_NOT_FOUND");
    return c;
  }

  async list(
    projectId: string,
    opts: { targetType?: CommentTargetType; targetId?: string; limit?: number; before?: Date } = {}
  ): Promise<Comment[]> {
    return commentRepo.listComments(projectId, opts);
  }

  async thread(rootId: string): Promise<Comment[]> {
    return commentRepo.listThread(rootId);
  }

  async update(actorId: string, id: string, raw: unknown): Promise<Comment> {
    const data = UpdateCommentSchema.parse(raw);
    const cur = await commentRepo.findCommentById(id);
    if (!cur) throw new AppError("评论不存在", 404, "COMMENT_NOT_FOUND");
    if (cur.authorId !== actorId) {
      throw new AppError("无权编辑他人评论", 403, "FORBIDDEN");
    }
    const mentions = data.body ? await resolveMentionIds(parseMentions(data.body)) : cur.mentions;
    const updated = await commentRepo.updateComment(id, data, mentions);
    if (!updated) throw new AppError("更新失败", 500, "UPDATE_FAILED");
    this.realtime.broadcastToProject(updated.projectId, {
      type: "comment",
      event: "updated",
      data: { comment: updated },
    });
    return updated;
  }

  async setResolved(actorId: string, id: string, resolved: boolean): Promise<Comment> {
    const cur = await commentRepo.findCommentById(id);
    if (!cur) throw new AppError("评论不存在", 404, "COMMENT_NOT_FOUND");
    const updated = await commentRepo.setResolved(id, resolved, actorId);
    if (!updated) throw new AppError("更新失败", 500, "UPDATE_FAILED");
    const activity: Activity = await activityRepo.insertActivity({
      projectId: updated.projectId,
      actorId,
      type: resolved ? "comment.resolved" : "comment.reopened",
      targetType: "comment",
      targetId: id,
    });
    this.realtime.broadcastToProject(updated.projectId, {
      type: "comment",
      event: resolved ? "resolved" : "reopened",
      data: { comment: updated, activity },
    });
    return updated;
  }

  async remove(actorId: string, id: string): Promise<void> {
    const cur = await commentRepo.findCommentById(id);
    if (!cur) throw new AppError("评论不存在", 404, "COMMENT_NOT_FOUND");
    if (cur.authorId !== actorId) {
      throw new AppError("无权删除他人评论", 403, "FORBIDDEN");
    }
    const ok = await commentRepo.deleteComment(id);
    if (!ok) throw new AppError("删除失败", 500, "DELETE_FAILED");
    this.realtime.broadcastToProject(cur.projectId, {
      type: "comment",
      event: "deleted",
      data: { id, projectId: cur.projectId },
    });
  }
}

export type { CreateCommentInput, UpdateCommentInput };
