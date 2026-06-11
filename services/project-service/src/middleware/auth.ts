/**
 * project-service 鉴权中间件 — → @manhuaworks/shared 统一
 *
 * 谢擎标准 (派单 48 P0 第3次派, 2026-06-10)
 *
 * project-service 原先使用远程 user-service 校验，现已统一为本地 JWT 验证。
 * 所有鉴权逻辑统一到 @manhuaworks/shared:
 *   - requireAuth / requireRole / authOptional / requireOwner / getUser / verifyToken
 *
 * 本文件保留为兼容重导出，新代码请直接 import from '@manhuaworks/shared'
 */
export {
  requireAuth,
  requireRole,
  authOptional,
  requireOwner,
  getUser,
  verifyToken,
} from "@manhuaworks/shared";
export type { JwtPayload, AuthUser } from "@manhuaworks/shared";
