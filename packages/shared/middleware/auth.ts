/**
 * 统一鉴权中间件 — 重导出
 *
 * 谢擎标准 (派单 48 后端统一化, P0 第3次派)
 * 实际实现在 src/middleware/auth.ts
 *
 * Usage:
 *   import { requireAuth, requireRole, authOptional, getUser } from '@manhuaworks/shared/middleware/auth';
 */
export {
  requireAuth,
  requireRole,
  authOptional,
  requireOwner,
  getUser,
  verifyToken,
} from "../src/middleware/auth.js";
export type { JwtPayload, AuthUser } from "../src/middleware/auth.js";
