import { AppError, ErrorCodes } from './AppError'

/** 认证/授权错误：登录失败、token 过期、权限不足 */
export class AuthError extends AppError {
  constructor(
    code:
      | typeof ErrorCodes.AUTH_LOGIN_FAILED
      | typeof ErrorCodes.AUTH_TOKEN_EXPIRED
      | typeof ErrorCodes.AUTH_TOKEN_INVALID
      | typeof ErrorCodes.AUTH_REFRESH_FAILED
      | typeof ErrorCodes.AUTH_PERMISSION_DENIED
      | typeof ErrorCodes.AUTH_ACCOUNT_LOCKED
      | typeof ErrorCodes.UNAUTHORIZED
      | typeof ErrorCodes.FORBIDDEN = ErrorCodes.UNAUTHORIZED,
    message: string = '认证失败',
    options: ConstructorParameters<typeof AppError>[2] = {}
  ) {
    super(code, message, { severity: 'high', ...options })
    this.name = 'AuthError'
  }

  /** 是否需要重新登录 */
  requiresRelogin(): boolean {
    return (
      this.code === ErrorCodes.AUTH_TOKEN_EXPIRED ||
      this.code === ErrorCodes.AUTH_TOKEN_INVALID ||
      this.code === ErrorCodes.AUTH_REFRESH_FAILED
    )
  }

  /** 工厂：未登录 */
  static unauthenticated(): AuthError {
    return new AuthError(ErrorCodes.UNAUTHORIZED, '请先登录', {
      severity: 'medium'
    })
  }

  /** 工厂：token 过期 */
  static tokenExpired(): AuthError {
    return new AuthError(ErrorCodes.AUTH_TOKEN_EXPIRED, '登录已过期，请重新登录', {
      severity: 'high',
      meta: { context: { reason: 'expired' } }
    })
  }

  /** 工厂：权限不足 */
  static permissionDenied(resource?: string): AuthError {
    return new AuthError(
      ErrorCodes.AUTH_PERMISSION_DENIED,
      `没有权限访问${resource ? `: ${resource}` : ''}`,
      { meta: { context: { resource } } }
    )
  }

  /** 工厂：账户被锁 */
  static accountLocked(): AuthError {
    return new AuthError(
      ErrorCodes.AUTH_ACCOUNT_LOCKED,
      '账户已被锁定，请联系管理员',
      { severity: 'critical' }
    )
  }
}
