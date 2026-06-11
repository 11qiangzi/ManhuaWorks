/**
 * 集中 service 容器 - 打破循环依赖
 *  - 所有 service/controller 引用同一份
 */
import { RealtimeService } from "./services/realtimeService.js";
import { CommentService } from "./services/commentService.js";
import { PresenceService } from "./services/presenceService.js";
import { ActivityService } from "./services/activityService.js";
import { NotificationService } from "./services/notificationService.js";

export const realtimeService = new RealtimeService();
export const commentService = new CommentService({ realtime: realtimeService });
export const presenceService = new PresenceService({ realtime: realtimeService });
export const activityService = new ActivityService();
export const notificationService = new NotificationService({ realtime: realtimeService });
