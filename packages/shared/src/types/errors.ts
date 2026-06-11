/**
 * 谢擎标准错误码 — 5 服务统一
 *
 * 标准返回格式: { code: number, message: string, data?: unknown }
 *   code: 0       → 成功
 *   code: 40000   → 参数错误
 *   code: 40100   → 未登录
 *   code: 40101   → 密码错误
 *   code: 40102   → token 无效或过期
 *   code: 40103   → refreshToken 过期
 *   code: 40201   → 支付失败
 *   code: 40300   → 无权访问
 *   code: 40301   → 不可给他人操作
 *   code: 40400   → 资源不存在
 *   code: 40900   → 资源冲突
 *   code: 42900   → 请求过于频繁
 *   code: 50000   → 服务器内部错误
 *   code: 50300   → 服务不可用
 */

export const ErrorCodes = {
  SUCCESS: 0,
  BAD_REQUEST: 40000,
  UNAUTHORIZED: 40100,
  WRONG_PASSWORD: 40101,
  INVALID_TOKEN: 40102,
  REFRESH_TOKEN_EXPIRED: 40103,
  PAYMENT_FAILED: 40201,
  FORBIDDEN: 40300,
  CANNOT_OPERATE_OTHERS: 40301,
  NOT_FOUND: 40400,
  CONFLICT: 40900,
  RATE_LIMITED: 42900,
  INTERNAL_ERROR: 50000,
  SERVICE_UNAVAILABLE: 50300,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** 标准成功响应 */
export function success<T>(data?: T, message = "ok") {
  return { code: ErrorCodes.SUCCESS, message, data };
}

/** 标准分页响应 */
export function paginated<T>(items: T[], total: number, offset = 0, limit = 20) {
  return {
    code: ErrorCodes.SUCCESS,
    message: "ok",
    data: { items, total, offset, limit },
  };
}

/**
 * AppError — 统一错误类
 * 支持数字错误码（谢擎标准）
 *
 * code → HTTP status 映射:
 *   0xxxx → 200, 4xxxx → 400/401/403/404/409, 5xxxx → 500
 */
export class AppError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.data = data;
  }

  /** 从错误码推导 HTTP 状态码 */
  statusCode(): number {
    const prefix = Math.floor(this.code / 100);
    const map: Record<number, number> = {
      0: 200,    // 成功
      400: 400,  // 参数错误
      401: 401,  // 未登录
      402: 402,  // 支付失败
      403: 403,  // 无权访问
      404: 404,  // 资源不存在
      405: 405,  // 方法不允许
      409: 409,  // 冲突
      429: 429,  // 限流
      500: 500,  // 服务器错误
      503: 503,  // 服务不可用
    };
    return map[prefix] ?? 500;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "参数错误", data?: unknown) {
    super(ErrorCodes.BAD_REQUEST, message, data);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "未登录", code: number = ErrorCodes.UNAUTHORIZED) {
    super(code, message);
    this.name = "UnauthorizedError";
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = "token 无效或已过期") {
    super(ErrorCodes.INVALID_TOKEN, message);
    this.name = "InvalidTokenError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "无权访问") {
    super(ErrorCodes.FORBIDDEN, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "资源不存在") {
    super(ErrorCodes.NOT_FOUND, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "资源已存在") {
    super(ErrorCodes.CONFLICT, message);
    this.name = "ConflictError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "请求过于频繁，请稍后再试", retryAfter?: number) {
    super(ErrorCodes.RATE_LIMITED, message, { retryAfter });
    this.name = "TooManyRequestsError";
  }
}

export class InternalError extends AppError {
  constructor(message = "服务器内部错误") {
    super(ErrorCodes.INTERNAL_ERROR, message);
    this.name = "InternalError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "服务暂不可用") {
    super(ErrorCodes.SERVICE_UNAVAILABLE, message);
    this.name = "ServiceUnavailableError";
  }
}
