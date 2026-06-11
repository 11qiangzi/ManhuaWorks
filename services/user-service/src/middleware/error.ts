/**
 * user-service 错误处理中间件 — → @manhuaworks/shared 统一
 *
 * 谢擎标准 (派单 48 P0 第3次派, 2026-06-10)
 *
 * 所有错误处理逻辑已统一到 @manhuaworks/shared:
 *   - errorHandler / notFoundHandler / asyncHandler
 *
 * 本文件保留为兼容重导出，新代码请直接 import from '@manhuaworks/shared'
 */
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from "@manhuaworks/shared";
