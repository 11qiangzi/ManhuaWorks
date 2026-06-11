/**
 * @manhuaworks/shared — 5 服务统一工具包 (谢擎标准, 派单 48)
 *
 * 导出:
 *   - types/errors     — 错误码、AppError 及子类、success()/paginated() 助手
 *   - middleware/auth   — 统一鉴权
 *   - middleware/error  — 统一错误处理
 *   - middleware/health — 健康检查
 *   - middleware/cache  — Redis 缓存
 */

// ─── 类型 ─────────────────────────────────────────────────────
export {
  ErrorCodes,
  AppError,
  BadRequestError,
  UnauthorizedError,
  InvalidTokenError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalError,
  ServiceUnavailableError,
  success,
  paginated,
} from "./types/errors.js";
export type { ErrorCode } from "./types/errors.js";

// ─── 鉴权中间件 ───────────────────────────────────────────────
export {
  requireAuth,
  requireRole,
  authOptional,
  requireOwner,
  getUser,
  verifyToken,
} from "./middleware/auth.js";
export type { JwtPayload, AuthUser } from "./middleware/auth.js";

// ─── 错误处理 ─────────────────────────────────────────────────
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from "./middleware/error.js";

// ─── 健康检查 ─────────────────────────────────────────────────
export { healthRouter } from "./middleware/health.js";
export type { HealthOptions } from "./middleware/health.js";

// ─── Redis 缓存 ──────────────────────────────────────────────
export {
  createCache,
  withCache,
  CacheKeys,
  CacheTTL,
} from "./middleware/cache.js";
export type { CacheOptions, CacheStore } from "./middleware/cache.js";

// ─── 速率限制 ──────────────────────────────────────────────
export { rateLimit } from "./middleware/rate-limit.js";
export type { RateLimitOptions } from "./middleware/rate-limit.js";
