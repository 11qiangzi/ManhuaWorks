/**
 * ActivityService - 活动流
 *  - 写入由 comment/presence 等调用
 *  - 查询 + 聚合
 */
import * as activityRepo from "../repositories/activityRepository.js";
import type { Activity, ActivityType } from "../models/activity.js";

export class ActivityService {
  async record(input: {
    projectId: string;
    actorId: string;
    type: ActivityType;
    targetType?: string | null;
    targetId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<Activity> {
    return activityRepo.insertActivity(input);
  }

  async list(
    projectId: string,
    opts: { limit?: number; before?: Date; actorId?: string; type?: ActivityType } = {}
  ): Promise<Activity[]> {
    return activityRepo.listActivities(projectId, opts);
  }

  async listByActor(actorId: string, projectId: string, limit = 30): Promise<Activity[]> {
    return activityRepo.listActivities(projectId, { actorId, limit });
  }
}
