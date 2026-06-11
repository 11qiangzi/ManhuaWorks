/**
 * errorHandler — 统一错误处理中间件 (P0 整改 第7项)
 *
 * 统一 3 种错误响应格式 → 1 种标准格式：
 *   {
 *     error: { code: string, message: string },
 *     details?: unknown,
 *     timestamp: string
 *   }
 *
 * Usage:
 *   import { errorHandler, AppError } from '@manhuaworks/shared/middleware/error-handler';
 *   app.use(errorHandler);
 */
import type { Request, Response, NextFunction } from "express";

// ===== 标准错误类 =====

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "请求参数错误", details?: unknown) {
    super(400, "bad_request", message, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "未授权", details?: unknown) {
    super(401, "unauthorized", message, details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "权限不足", details?: unknown) {
    super(403, "forbidden", message, details);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "资源不存在", details?: unknown) {
    super(404, "not_found", message, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "资源冲突", details?: unknown) {
    super(409, "conflict", message, details);
    this.name = "ConflictError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "请求过于频繁", details?: unknown) {
    super(429, "too_many_requests", message, details);
    this.name = "TooManyRequestsError";
  }
}

export class InternalError extends AppError {
  constructor(message = "服务器内部错误", details?: unknown) {
    super(500, "internal_error", message, details);
    this.name = "InternalError";
  }
}

// ===== 统一错误响应格式 =====

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
  details?: unknown;
  timestamp: string;
}

/** 构建统一错误响应体 */
export function buildErrorBody(code: string, message: string, details?: unknown): ErrorResponse {
  return {
    error: { code, message },
    ...(details !== undefined ? { details } : {}),
    timestamp: new Date().toISOString(),
  };
}

// ===== 错误处理中间件 =====

/** 404 兜底中间件 */
export function notFoundHandler(_req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json(buildErrorBody("not_found", "接口不存在"));
}

/** Express 统一错误处理中间件 (4 参数签名) */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 已知 AppError
  if (err instanceof AppError) {
    res.status(err.status).json(buildErrorBody(err.code, err.message, err.details));
    return;
  }

  // JSON 解析错误
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json(buildErrorBody("invalid_json", "请求体 JSON 格式错误"));
    return;
  }

  // JWT 相关错误 (jsonwebtoken)
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json(buildErrorBody("invalid_token", "token 无效或已过期"));
    return;
  }

  // 未知错误 → 500
  console.error("[errorHandler] unhandled error:", err.message);
  res.status(500).json(buildErrorBody("internal_error", "服务器内部错误"));
}
