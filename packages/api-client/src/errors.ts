/**
 * ManhuaWorks · api-client
 * Error taxonomy: 4 categories + 30+ error codes
 *
 * - ApiError (base, exported)  ← 所有错误统一抛这一类
 * - NetworkError   7 层网络故障
 * - AuthError      401/403/未登录/刷新失败
 * - ValidationError 422/参数错误
 * - BusinessError  业务规则错误（余额/权限/状态机）
 */

export type ApiErrorCategory = 'network' | 'auth' | 'validation' | 'business'

/* ------------------------------------------------------------------ *
 * Error code constants (30+)
 * ------------------------------------------------------------------ */
export const ErrorCode = {
  // 网络
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_ABORTED: 'NETWORK_ABORTED',
  NETWORK_UNKNOWN: 'NETWORK_UNKNOWN',
  SERVER_INTERNAL: 'SERVER_INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_GATEWAY: 'BAD_GATEWAY',

  // 认证
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_FAILED: 'REFRESH_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID: 'TWO_FACTOR_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // 校验
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  MISSING_FIELD: 'MISSING_FIELD',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 业务
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  SHOT_NOT_FOUND: 'SHOT_NOT_FOUND',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_REJECTED: 'REFUND_REJECTED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  COLLAB_CONFLICT: 'COLLAB_CONFLICT',
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/* ------------------------------------------------------------------ *
 * Base class — ApiError
 * ------------------------------------------------------------------ */
export class ApiError extends Error {
  readonly code: ErrorCodeValue | string
  readonly status: number
  readonly category: ApiErrorCategory
  readonly details?: unknown
  readonly cause?: unknown

  constructor(opts: {
    code: ErrorCodeValue | string
    message: string
    status: number
    category?: ApiErrorCategory
    details?: unknown
    cause?: unknown
  }) {
    super(opts.message)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.category = opts.category ?? ApiError.categorize(opts.status, opts.code)
    this.details = opts.details
    this.cause = opts.cause
    // 修复 instanceof 在 ES5 transpile 下的链路
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** 用户可读中文消息（给 UI 直接显示） */
  get userMessage(): string {
    if (this.message && this.message.length > 0) return this.message
    return ApiError.defaultMessage(this.code, this.status)
  }

  /** JSON 序列化形式（用于日志） */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      category: this.category,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
    }
  }

  /* ----------------- 静态工具 ----------------- */

  static categorize(status: number, code: string): ApiErrorCategory {
    if (code === ErrorCode.NETWORK_TIMEOUT || code === ErrorCode.NETWORK_OFFLINE ||
        code === ErrorCode.NETWORK_ABORTED || code === ErrorCode.NETWORK_UNKNOWN) {
      return 'network'
    }
    if (status === 0) return 'network'
    if (status === 401 || status === 403) return 'auth'
    if (status === 400 || status === 422) return 'validation'
    if (status === 429) return 'validation'
    return 'business'
  }

  static defaultMessage(code: string, status: number): string {
    switch (code) {
      case ErrorCode.NETWORK_TIMEOUT: return '请求超时，请检查网络后重试'
      case ErrorCode.NETWORK_OFFLINE: return '网络连接已断开'
      case ErrorCode.NETWORK_ABORTED: return '请求已取消'
      case ErrorCode.NETWORK_UNKNOWN: return '网络异常'
      case ErrorCode.SERVER_INTERNAL: return '服务器内部错误'
      case ErrorCode.SERVICE_UNAVAILABLE: return '服务暂不可用'
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.TOKEN_INVALID: return '登录已过期，请重新登录'
      case ErrorCode.UNAUTHORIZED: return '请先登录'
      case ErrorCode.FORBIDDEN: return '没有权限执行此操作'
      case ErrorCode.INVALID_CREDENTIALS: return '账号或密码错误'
      case ErrorCode.TWO_FACTOR_REQUIRED: return '需要两步验证'
      case ErrorCode.TWO_FACTOR_INVALID: return '两步验证码错误'
      case ErrorCode.EMAIL_NOT_VERIFIED: return '请先验证邮箱'
      case ErrorCode.ACCOUNT_DISABLED: return '账号已被禁用'
      case ErrorCode.VALIDATION_FAILED:
      case ErrorCode.INVALID_PAYLOAD: return '请求参数有误'
      case ErrorCode.RATE_LIMITED: return '操作过于频繁，请稍后再试'
      case ErrorCode.QUOTA_EXCEEDED: return '配额已用完'
      case ErrorCode.PAYMENT_FAILED: return '支付失败'
      case ErrorCode.REFUND_REJECTED: return '退款被拒绝'
      case ErrorCode.SUBSCRIPTION_EXPIRED: return '订阅已到期'
      case ErrorCode.VERSION_CONFLICT: return '版本冲突，请刷新后重试'
      case ErrorCode.COLLAB_CONFLICT: return '协作冲突'
      case ErrorCode.USER_NOT_FOUND: return '用户不存在'
      case ErrorCode.PROJECT_NOT_FOUND: return '项目不存在'
      case ErrorCode.SHOT_NOT_FOUND: return '镜头不存在'
      case ErrorCode.COMMENT_NOT_FOUND: return '评论不存在'
      case ErrorCode.PLAN_NOT_FOUND: return '套餐不存在'
      case ErrorCode.ORDER_NOT_FOUND: return '订单不存在'
      case ErrorCode.DUPLICATE_RESOURCE: return '资源已存在'
      default:
        if (status === 0) return '网络异常'
        if (status >= 500) return '服务器错误，请稍后重试'
        if (status >= 400) return '请求失败'
        return '未知错误'
    }
  }

  /** 根据 fetch 响应 + body 构造 ApiError */
  static fromResponse(
    status: number,
    body: unknown,
    fallbackMessage?: string,
  ): ApiError {
    let code: string = ErrorCode.UNKNOWN
    let message = fallbackMessage ?? ''
    let details: unknown

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      if (typeof b.code === 'string') code = b.code
      if (typeof b.error === 'string' && !message) message = b.error
      if (typeof b.message === 'string' && !message) message = b.message
      if (Array.isArray(b.details)) details = b.details
      else if (b.details && typeof b.details === 'object') details = b.details
    }

    if (!code || code === ErrorCode.UNKNOWN) {
      code = ApiError.codeFromStatus(status)
    }
    if (!message) {
      message = ApiError.defaultMessage(code, status)
    }
    // 422/400 → ValidationError 子类；401/403 → AuthError；网络层已在别处处理
    if (status === 422 || status === 400 || code === ErrorCode.VALIDATION_FAILED ||
        code === ErrorCode.INVALID_PAYLOAD || code === ErrorCode.MISSING_FIELD ||
        code === ErrorCode.RATE_LIMITED) {
      return new ValidationError(code, message, status, details)
    }
    if (status === 401 || status === 403) {
      return new AuthError(code, message, status, details)
    }
    return new ApiError({ code, message, status, details })
  }

  static codeFromStatus(status: number): ErrorCodeValue {
    switch (status) {
      case 0: return ErrorCode.NETWORK_UNKNOWN
      case 400: return ErrorCode.INVALID_PAYLOAD
      case 401: return ErrorCode.UNAUTHORIZED
      case 403: return ErrorCode.FORBIDDEN
      case 404: return ErrorCode.USER_NOT_FOUND
      case 408: return ErrorCode.NETWORK_TIMEOUT
      case 409: return ErrorCode.COLLAB_CONFLICT
      case 422: return ErrorCode.VALIDATION_FAILED
      case 429: return ErrorCode.RATE_LIMITED
      case 500: return ErrorCode.SERVER_INTERNAL
      case 502: return ErrorCode.BAD_GATEWAY
      case 503: return ErrorCode.SERVICE_UNAVAILABLE
      default:
        if (status >= 500) return ErrorCode.SERVER_INTERNAL
        if (status >= 400) return ErrorCode.VALIDATION_FAILED
        return ErrorCode.UNKNOWN
    }
  }
}

/* ------------------------------------------------------------------ *
 * Category-specific subclasses (4 类)
 * ------------------------------------------------------------------ */
export class NetworkError extends ApiError {
  constructor(code: ErrorCodeValue | string, message: string, cause?: unknown) {
    super({ code, message, status: 0, category: 'network', cause })
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AuthError extends ApiError {
  constructor(code: ErrorCodeValue | string, message: string, status = 401, details?: unknown) {
    super({ code, message, status, category: 'auth', details })
    this.name = 'AuthError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends ApiError {
  constructor(code: ErrorCodeValue | string, message: string, status = 422, details?: unknown) {
    super({ code, message, status, category: 'validation', details })
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class BusinessError extends ApiError {
  constructor(code: ErrorCodeValue | string, message: string, status = 400, details?: unknown) {
    super({ code, message, status, category: 'business', details })
    this.name = 'BusinessError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/* ------------------------------------------------------------------ *
 * Type guard
 * ------------------------------------------------------------------ */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError
}
