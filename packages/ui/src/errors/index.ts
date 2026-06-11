/**
 * 错误系统统一出口
 *
 * 用法：
 *   import { AppError, NetworkError, ValidationError, AuthError, BusinessError, isAppError, fromUnknown } from '@manhuaworks/ui/errors'
 */
export { AppError, ErrorCodes } from './AppError'
export type { ErrorCode, ErrorSeverity, ErrorMeta } from './AppError'

export { NetworkError } from './NetworkError'
export { ValidationError } from './ValidationError'
export type { FieldError } from './ValidationError'
export { AuthError } from './AuthError'
export { BusinessError } from './BusinessError'

import { AppError } from './AppError'
import { NetworkError } from './NetworkError'
import { ValidationError } from './ValidationError'
import { AuthError } from './AuthError'
import { BusinessError } from './BusinessError'
import { ErrorCodes } from './AppError'

/** 类型守卫 */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError
}

export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError
}

export function isBusinessError(e: unknown): e is BusinessError {
  return e instanceof BusinessError
}

/**
 * 把任意异常转成 AppError，便于统一处理
 */
export function fromUnknown(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (e instanceof Error) {
    return new AppError(ErrorCodes.UNKNOWN, e.message, { cause: e })
  }
  if (typeof e === 'string') {
    return new AppError(ErrorCodes.UNKNOWN, e)
  }
  return new AppError(ErrorCodes.UNKNOWN, '未知错误', {
    meta: { context: { raw: e } }
  })
}

/**
 * 把 axios/fetch 错误转成 AppError
 */
export function fromHttpResponse(
  status: number,
  body?: { code?: string; message?: string; fieldErrors?: Array<{ field: string; message: string }> }
): AppError {
  const code = body?.code
  const message = body?.message ?? `HTTP ${status}`

  // 401 / 403 -> AuthError
  if (status === 401) {
    return new AuthError(ErrorCodes.UNAUTHORIZED, message, { statusCode: 401 })
  }
  if (status === 403) {
    return new AuthError(ErrorCodes.FORBIDDEN, message, { statusCode: 403 })
  }

  // 422 / 400 with fieldErrors -> ValidationError
  if (status === 422 || (status === 400 && body?.fieldErrors && body.fieldErrors.length > 0)) {
    return new ValidationError(
      message,
      body?.fieldErrors ?? [],
      { statusCode: status, meta: { context: { code } } }
    )
  }

  // 404 -> BusinessError
  if (status === 404) {
    return new BusinessError(ErrorCodes.NOT_FOUND, message, { statusCode: 404 })
  }

  // 429 -> rate limited
  if (status === 429) {
    return new BusinessError(ErrorCodes.RATE_LIMITED, message, {
      statusCode: 429,
      meta: { retryAfterMs: 1000 }
    })
  }

  // 5xx -> generic server error
  if (status >= 500) {
    return new AppError(code ?? ErrorCodes.INTERNAL_ERROR, message, {
      severity: 'high',
      statusCode: status
    })
  }

  // fallback
  return new AppError(code ?? ErrorCodes.BAD_REQUEST, message, { statusCode: status })
}
