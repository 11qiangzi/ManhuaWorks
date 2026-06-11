/**
 * 统一错误处理中间件 — 重导出
 *
 * 谢擎标准 (派单 48 后端统一化, P0 第3次派)
 * 实际实现在 src/middleware/error.ts
 *
 * Usage:
 *   import { errorHandler, notFoundHandler, asyncHandler } from '@manhuaworks/shared/middleware/error';
 */
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from "../src/middleware/error.js";
