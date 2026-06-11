/**
 * project-service HTTP 客户端
 *  - 检查项目存在 / 协作者权限
 *  - 软依赖: 调用失败时按默认策略降级
 */
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface ProjectBrief {
  id: string;
  ownerId: string;
  title: string;
  status?: number;
}

interface ProjectResponse {
  code: number;
  data?: ProjectBrief;
}

interface MemberResponse {
  code: number;
  data?: { isMember?: boolean; role?: string };
}

export async function getProject(projectId: string, token: string): Promise<ProjectBrief | null> {
  try {
    const res = await fetch(`${env.PROJECT_SERVICE_URL}/api/v1/projects/${projectId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ProjectResponse;
    return body.data ?? null;
  } catch (err) {
    logger.warn({ err, projectId }, "projectClient.getProject 失败");
    return null;
  }
}

export async function checkMembership(projectId: string, userId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${env.PROJECT_SERVICE_URL}/api/v1/projects/${projectId}/members/${userId}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return false;
    const body = (await res.json()) as MemberResponse;
    return body.data?.isMember === true;
  } catch (err) {
    logger.warn({ err, projectId, userId }, "projectClient.checkMembership 失败");
    return false;
  }
}
