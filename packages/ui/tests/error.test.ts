/**
 * error.test.ts - 错误系统测试
 * 覆盖：5 类错误、30+ 错误码、错误转换、类型守卫
 */
import { describe, it, expect } from 'vitest'
import {
  AppError,
  NetworkError,
  ValidationError,
  AuthError,
  BusinessError,
  ErrorCodes,
  isAppError,
  isNetworkError,
  isValidationError,
  isAuthError,
  isBusinessError,
  fromUnknown,
  fromHttpResponse
} from '../src/errors'

describe('ErrorCodes', () => {
  it('exposes 30+ error codes across categories', () => {
    const codes = Object.keys(ErrorCodes)
    expect(codes.length).toBeGreaterThanOrEqual(30)
  })

  it('all codes follow the E#### naming pattern', () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(code).toMatch(/^E\d{4}$/)
    }
  })

  it('contains all required categories', () => {
    // 1xxx client
    expect(ErrorCodes.BAD_REQUEST).toBe('E1001')
    expect(ErrorCodes.UNAUTHORIZED).toBe('E1002')
    // 2xxx server
    expect(ErrorCodes.INTERNAL_ERROR).toBe('E2001')
    // 3xxx network
    expect(ErrorCodes.NETWORK_OFFLINE).toBe('E3001')
    // 4xxx business
    expect(ErrorCodes.AUTH_LOGIN_FAILED).toBe('E4001')
    // 5xxx runtime
    expect(ErrorCodes.UNKNOWN).toBe('E5001')
  })
})

describe('AppError', () => {
  it('creates an error with code, message, severity', () => {
    const e = new AppError(ErrorCodes.NOT_FOUND, '资源不存在')
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('E1004')
    expect(e.message).toBe('资源不存在')
    expect(e.severity).toBe('medium')
    expect(e.timestamp).toBeGreaterThan(0)
  })

  it('isRetryable() returns true for network/5xx/rate limited', () => {
    expect(new AppError(ErrorCodes.NETWORK_TIMEOUT, '').isRetryable()).toBe(true)
    expect(new AppError(ErrorCodes.SERVICE_UNAVAILABLE, '').isRetryable()).toBe(true)
    expect(new AppError(ErrorCodes.RATE_LIMITED, '').isRetryable()).toBe(true)
    expect(new AppError(ErrorCodes.NOT_FOUND, '').isRetryable()).toBe(false)
  })

  it('requiresUserAction() for high/critical severity', () => {
    expect(new AppError(ErrorCodes.NOT_FOUND, '', { severity: 'low' }).requiresUserAction()).toBe(false)
    expect(new AppError(ErrorCodes.NOT_FOUND, '', { severity: 'high' }).requiresUserAction()).toBe(true)
    expect(new AppError(ErrorCodes.NOT_FOUND, '', { severity: 'critical' }).requiresUserAction()).toBe(true)
  })

  it('toJSON() returns serializable object', () => {
    const e = new AppError(ErrorCodes.NOT_FOUND, 'msg', { statusCode: 404 })
    const json = e.toJSON()
    expect(json.code).toBe('E1004')
    expect(json.statusCode).toBe(404)
    expect(json.timestamp).toBeGreaterThan(0)
  })

  it('preserves prototype chain', () => {
    const e = new AppError(ErrorCodes.NOT_FOUND, 'msg')
    expect(Object.getPrototypeOf(e)).toBe(AppError.prototype)
  })
})

describe('NetworkError', () => {
  it('offline() factory produces NETWORK_OFFLINE', () => {
    const e = NetworkError.offline()
    expect(e.code).toBe('E3001')
    expect(e.severity).toBe('high')
  })

  it('timeout() factory includes retryAfterMs', () => {
    const e = NetworkError.timeout('https://api.example.com')
    expect(e.code).toBe('E3002')
    expect(e.meta.retryAfterMs).toBe(1000)
    expect(e.meta.context?.url).toBe('https://api.example.com')
  })

  it('dns() factory includes host', () => {
    const e = NetworkError.dns('example.com')
    expect(e.code).toBe('E3003')
    expect(e.meta.context?.host).toBe('example.com')
  })

  it('websocketClosed() factory', () => {
    const e = NetworkError.websocketClosed('ping timeout')
    expect(e.code).toBe('E3007')
  })
})

describe('ValidationError', () => {
  it('creates with field errors', () => {
    const e = new ValidationError('校验失败', [
      { field: 'email', message: '邮箱格式不对' },
      { field: 'password', message: '密码太短' }
    ])
    expect(e.code).toBe('E1011')
    expect(e.fieldErrors).toHaveLength(2)
  })

  it('firstFieldError() returns first one', () => {
    const e = new ValidationError('x', [
      { field: 'a', message: 'm1' },
      { field: 'b', message: 'm2' }
    ])
    expect(e.firstFieldError()?.field).toBe('a')
  })

  it('errorFor(field) returns specific error', () => {
    const e = new ValidationError('x', [
      { field: 'email', message: 'm1' },
      { field: 'name', message: 'm2' }
    ])
    expect(e.errorFor('email')?.message).toBe('m1')
    expect(e.errorFor('missing')).toBeUndefined()
  })

  it('toMap() returns field -> message mapping', () => {
    const e = new ValidationError('x', [
      { field: 'a', message: 'm1' },
      { field: 'b', message: 'm2' }
    ])
    expect(e.toMap()).toEqual({ a: 'm1', b: 'm2' })
  })

  it('required() factory', () => {
    const e = ValidationError.required('username')
    expect(e.code).toBe('E1011')
    expect(e.errorFor('username')?.code).toBe('REQUIRED')
    expect(e.errorFor('username')?.message).toContain('不能为空')
  })

  it('length() factory for too short', () => {
    const e = ValidationError.length('password', 8, 20, 5)
    expect(e.errorFor('password')?.message).toContain('不能少于 8')
  })

  it('length() factory for too long', () => {
    const e = ValidationError.length('password', 8, 20, 25)
    expect(e.errorFor('password')?.message).toContain('不能超过 20')
  })
})

describe('AuthError', () => {
  it('unauthenticated() factory', () => {
    const e = AuthError.unauthenticated()
    expect(e.code).toBe('E1002')
  })

  it('tokenExpired() requires re-login', () => {
    const e = AuthError.tokenExpired()
    expect(e.code).toBe('E4002')
    expect(e.requiresRelogin()).toBe(true)
  })

  it('permissionDenied() includes resource', () => {
    const e = AuthError.permissionDenied('user:123')
    expect(e.code).toBe('E4005')
    expect(e.meta.context?.resource).toBe('user:123')
  })

  it('accountLocked() is critical severity', () => {
    const e = AuthError.accountLocked()
    expect(e.severity).toBe('critical')
  })

  it('requiresRelogin() false for permission denied', () => {
    const e = AuthError.permissionDenied('x')
    expect(e.requiresRelogin()).toBe(false)
  })
})

describe('BusinessError', () => {
  it('resourceNotFound() with id', () => {
    const e = BusinessError.resourceNotFound('Project', 'p-123')
    expect(e.code).toBe('E4007')
    expect(e.meta.resourceId).toBe('p-123')
  })

  it('quotaExceeded() is high severity', () => {
    const e = BusinessError.quotaExceeded('image-gen', 100)
    expect(e.code).toBe('E4009')
    expect(e.severity).toBe('high')
  })

  it('workflowInvalid() includes stage', () => {
    const e = BusinessError.workflowInvalid('render', 'timeout')
    expect(e.code).toBe('E4011')
    expect(e.meta.context?.stage).toBe('render')
  })

  it('generationFailed() includes retry hint', () => {
    const e = BusinessError.generationFailed('MiniMax-Image', 'rate limited')
    expect(e.code).toBe('E4013')
    expect(e.meta.retryAfterMs).toBe(3000)
  })

  it('uploadFailed() includes filename', () => {
    const e = BusinessError.uploadFailed('test.png', 'too large')
    expect(e.code).toBe('E4014')
    expect(e.meta.context?.filename).toBe('test.png')
  })
})

describe('Type guards', () => {
  it('isAppError matches all subclasses', () => {
    expect(isAppError(new AppError(ErrorCodes.UNKNOWN, ''))).toBe(true)
    expect(isAppError(new NetworkError())).toBe(true)
    expect(isAppError(new ValidationError('x'))).toBe(true)
    expect(isAppError(new AuthError())).toBe(true)
    expect(isAppError(new BusinessError(ErrorCodes.QUOTA_EXCEEDED, 'x'))).toBe(true)
    expect(isAppError(new Error('plain'))).toBe(false)
  })

  it('isNetworkError only matches NetworkError', () => {
    expect(isNetworkError(new NetworkError())).toBe(true)
    expect(isNetworkError(new AppError(ErrorCodes.NETWORK_OFFLINE, ''))).toBe(false)
  })

  it('isValidationError only matches ValidationError', () => {
    expect(isValidationError(new ValidationError('x'))).toBe(true)
    expect(isValidationError(new AppError(ErrorCodes.VALIDATION_FAILED, ''))).toBe(false)
  })
})

describe('fromUnknown', () => {
  it('returns AppError unchanged', () => {
    const original = new AppError(ErrorCodes.NOT_FOUND, 'x')
    expect(fromUnknown(original)).toBe(original)
  })

  it('wraps plain Error', () => {
    const e = fromUnknown(new Error('boom'))
    expect(e).toBeInstanceOf(AppError)
    expect(e.message).toBe('boom')
  })

  it('wraps string', () => {
    const e = fromUnknown('oops')
    expect(e).toBeInstanceOf(AppError)
    expect(e.message).toBe('oops')
  })

  it('wraps arbitrary value', () => {
    const e = fromUnknown({ code: 42 })
    expect(e).toBeInstanceOf(AppError)
    expect(e.meta.context?.raw).toEqual({ code: 42 })
  })
})

describe('fromHttpResponse', () => {
  it('401 -> AuthError', () => {
    const e = fromHttpResponse(401, { message: 'no token' })
    expect(isAuthError(e)).toBe(true)
    expect(e.statusCode).toBe(401)
  })

  it('403 -> AuthError forbidden', () => {
    const e = fromHttpResponse(403, { message: 'forbidden' })
    expect(isAuthError(e)).toBe(true)
    expect(e.code).toBe('E1003')
  })

  it('404 -> BusinessError not found', () => {
    const e = fromHttpResponse(404)
    expect(isBusinessError(e)).toBe(true)
    expect(e.code).toBe('E1004')
  })

  it('422 -> ValidationError with fieldErrors', () => {
    const e = fromHttpResponse(422, {
      fieldErrors: [{ field: 'email', message: 'invalid' }]
    })
    expect(isValidationError(e)).toBe(true)
    // errorFor is defined on ValidationError; cast to access
    if (isValidationError(e)) {
      expect(e.errorFor('email')?.message).toBe('invalid')
    }
  })

  it('429 -> rate limited BusinessError', () => {
    const e = fromHttpResponse(429, { message: 'slow down' })
    expect(e.code).toBe('E4015')
    expect(e.meta.retryAfterMs).toBe(1000)
  })

  it('500 -> generic server AppError', () => {
    const e = fromHttpResponse(500)
    expect(e.severity).toBe('high')
    expect(e.statusCode).toBe(500)
  })
})
