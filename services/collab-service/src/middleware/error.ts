/**
 * collab-service 错误处理中间件 — → @manhuaworks/shared 统一
 *
 * 谢擎标准 (派单 48 P0 第3次派, 2026-06-10)
 *
 * 所有错误处理逻辑已统一到 @manhuaworks/shared:
 *   - errorHandler / notFoundHandler / asyncHandler
 *
 * 向后兼容别名:
 *   - ah → asyncHandler
 *   - HttpError → AppError (映射)
 *
 * 本文件保留为兼容重导出，新代码请直接 import from '@manhuaworks/shared'
 */
export {
  errorHandler,
  notFoundHandler,
  AppError,
} from "@manhuaworks/shared";

import { AppError as SharedAppError, asyncHandler as sharedAsyncHandler } from "@manhuaworks/shared";

// 向后兼容别名
export const ah = sharedAsyncHandler;

// HttpError 兼容 (映射到 AppError)
export class HttpError extends SharedAppError {
  public statusCode: number;
  public details?: unknown;

  constructor(statusCode = 400, code: string | number = "BAD_REQUEST", message?: string, details?: unknown) {
    super(typeof code === "number" ? code : 40000, message ?? String(code), details);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
