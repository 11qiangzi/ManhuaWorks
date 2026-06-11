/**
 * 错误码常量 (30+ 错误码，覆盖 4xx/5xx/网络/业务)
 *
 * 命名规范：E + 类别(1位) + 序号(3位)
 *  - 1xxx: 客户端错误 (4xx)
 *  - 2xxx: 服务端错误 (5xx)
 *  - 3xxx: 网络/连接
 *  - 4xxx: 业务/领域
 *  - 5xxx: 运行时/未知
 */
export const ErrorCodes = {
  // 1xxx - 客户端错误
  BAD_REQUEST: 'E1001',
  UNAUTHORIZED: 'E1002',
  FORBIDDEN: 'E1003',
  NOT_FOUND: 'E1004',
  METHOD_NOT_ALLOWED: 'E1005',
  CONFLICT: 'E1006',
  GONE: 'E1007',
  UNPROCESSABLE: 'E1008',
  TOO_MANY_REQUESTS: 'E1009',
  PAYLOAD_TOO_LARGE: 'E1010',
  VALIDATION_FAILED: 'E1011',

  // 2xxx - 服务端错误
  INTERNAL_ERROR: 'E2001',
  NOT_IMPLEMENTED: 'E2002',
  BAD_GATEWAY: 'E2003',
  SERVICE_UNAVAILABLE: 'E2004',
  GATEWAY_TIMEOUT: 'E2005',
  DATABASE_ERROR: 'E2006',
  CACHE_ERROR: 'E2007',
  UPSTREAM_ERROR: 'E2008',

  // 3xxx - 网络/连接
  NETWORK_OFFLINE: 'E3001',
  NETWORK_TIMEOUT: 'E3002',
  NETWORK_DNS: 'E3003',
  NETWORK_RESET: 'E3004',
  CORS_BLOCKED: 'E3005',
  SSL_ERROR: 'E3006',
  WEBSOCKET_CLOSED: 'E3007',
  WEBSOCKET_TIMEOUT: 'E3008',

  // 4xxx - 业务/领域
  AUTH_LOGIN_FAILED: 'E4001',
  AUTH_TOKEN_EXPIRED: 'E4002',
  AUTH_TOKEN_INVALID: 'E4003',
  AUTH_REFRESH_FAILED: 'E4004',
  AUTH_PERMISSION_DENIED: 'E4005',
  AUTH_ACCOUNT_LOCKED: 'E4006',
  RESOURCE_NOT_FOUND: 'E4007',
  RESOURCE_CONFLICT: 'E4008',
  QUOTA_EXCEEDED: 'E4009',
  PAYMENT_REQUIRED: 'E4010',
  WORKFLOW_INVALID: 'E4011',
  WORKFLOW_TIMEOUT: 'E4012',
  GENERATION_FAILED: 'E4013',
  UPLOAD_FAILED: 'E4014',
  RATE_LIMITED: 'E4015',

  // 5xxx - 运行时/未知
  UNKNOWN: 'E5001',
  RUNTIME: 'E5002',
  SERIALIZATION: 'E5003',
  DESERIALIZATION: 'E5004',
  CONFIGURATION: 'E5005',
  INITIALIZATION: 'E5006',
  ABORTED: 'E5007'
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/** 错误严重度 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/** 错误元数据 */
export interface ErrorMeta {
  /** 错误字段（用于表单错误） */
  field?: string
  /** 上下文键值对 */
  context?: Record<string, unknown>
  /** 重试建议（毫秒） */
  retryAfterMs?: number
  /** 关联资源 ID */
  resourceId?: string
  /** 错误链路追踪 */
  traceId?: string
}

/**
 * 应用错误基类
 *
 * 4 个前端共享的错误基类，封装错误码、严重度、元数据。
 * 所有领域错误（网络/校验/认证/业务）继承自本类。
 */
export class AppError extends Error {
  public readonly code: ErrorCode | string
  public readonly severity: ErrorSeverity
  public readonly meta: ErrorMeta
  public readonly statusCode?: number
  public readonly cause?: unknown
  public readonly timestamp: number

  constructor(
    code: ErrorCode | string,
    message: string,
    options: {
      severity?: ErrorSeverity
      meta?: ErrorMeta
      statusCode?: number
      cause?: unknown
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.severity = options.severity ?? 'medium'
    this.meta = options.meta ?? {}
    this.statusCode = options.statusCode
    this.cause = options.cause
    this.timestamp = Date.now()

    // 保持原型链正确（TypeScript 编译 ES5 时需要）
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** 是否可重试 */
  isRetryable(): boolean {
    return (
      this.code === ErrorCodes.NETWORK_TIMEOUT ||
      this.code === ErrorCodes.NETWORK_RESET ||
      this.code === ErrorCodes.SERVICE_UNAVAILABLE ||
      this.code === ErrorCodes.GATEWAY_TIMEOUT ||
      this.code === ErrorCodes.UPSTREAM_ERROR ||
      this.code === ErrorCodes.RATE_LIMITED
    )
  }

  /** 是否需要用户介入 */
  requiresUserAction(): boolean {
    return this.severity === 'high' || this.severity === 'critical'
  }

  /** 序列化为 JSON（用于上报） */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      statusCode: this.statusCode,
      meta: this.meta,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  /** 字段错误快捷访问 */
  get field(): string | undefined {
    return this.meta.field
  }
}
