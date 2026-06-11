/**
 * billing-service 鉴权中间件 — → @manhuaworks/shared 统一
 *
 * 谢擎标准 (派单 48 P0 第3次派, 2026-06-10)
 *
 * 所有鉴权逻辑已统一到 @manhuaworks/shared:
 *   - requireAuth / requireRole / authOptional / requireOwner / getUser / verifyToken
 *
 * 向后兼容别名:
 *   - authRequired → requireAuth
 *   - adminOnly → requireRole(5)
 *
 * 本文件保留为兼容重导出，新代码请直接 import from '@manhuaworks/shared'
 */
import { requireAuth, requireRole } from "@manhuaworks/shared";
export {
  requireAuth,
  requireRole,
  authOptional,
  requireOwner,
  getUser,
  verifyToken,
} from "@manhuaworks/shared";
export type { JwtPayload, AuthUser } from "@manhuaworks/shared";

// 向后兼容别名 (billing-service 控制器使用旧名称)
export const authRequired = requireAuth;
export const adminOnly = requireRole(5);

// 保留本地类型以兼容
import type { Request } from "express";
import type { AuthUser } from "@manhuaworks/shared";
export type AuthedRequest = Request & { user?: AuthUser };
