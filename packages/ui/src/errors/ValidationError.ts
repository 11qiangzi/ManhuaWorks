import { AppError, ErrorCodes } from './AppError'

/** 单个字段错误 */
export interface FieldError {
  field: string
  message: string
  code?: string
}

/**
 * 校验错误：表单字段错误、API 422 错误、客户端预校验
 *
 * 支持：单字段错误 + 字段集合（多字段同时报错）
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: FieldError[]

  constructor(
    message: string = '数据校验失败',
    fieldErrors: FieldError[] = [],
    options: ConstructorParameters<typeof AppError>[2] = {}
  ) {
    super(ErrorCodes.VALIDATION_FAILED, message, {
      severity: 'low',
      ...options,
      meta: { ...options.meta, field: fieldErrors[0]?.field }
    })
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }

  /** 取第一个字段错误 */
  firstFieldError(): FieldError | undefined {
    return this.fieldErrors[0]
  }

  /** 按字段名取错误 */
  errorFor(field: string): FieldError | undefined {
    return this.fieldErrors.find((e) => e.field === field)
  }

  /** 转 Map 方便表单使用 */
  toMap(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const e of this.fieldErrors) {
      map[e.field] = e.message
    }
    return map
  }

  /** 是否有字段错误 */
  hasErrors(): boolean {
    return this.fieldErrors.length > 0
  }

  /** 工厂：单字段错误 */
  static single(field: string, message: string, code?: string): ValidationError {
    return new ValidationError(message, [{ field, message, code }])
  }

  /** 工厂：必填字段 */
  static required(field: string): ValidationError {
    return ValidationError.single(field, `${field} 不能为空`, 'REQUIRED')
  }

  /** 工厂：长度校验 */
  static length(
    field: string,
    min: number,
    max: number,
    actual: number
  ): ValidationError {
    const message =
      actual < min
        ? `${field} 不能少于 ${min} 个字符`
        : `${field} 不能超过 ${max} 个字符`
    return ValidationError.single(field, message, 'LENGTH')
  }
}
