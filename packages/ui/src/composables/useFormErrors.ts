/**
 * 表单字段错误映射
 *
 * 用法：
 *   const { errors, setError, clearError, clearAll, validate } = useFormErrors()
 *   if (someValidationFailed) {
 *     setError('email', '邮箱格式不正确')
 *   }
 *
 *   // 与 ValidationError 联动
 *   try { ... } catch (e) {
 *     if (isValidationError(e)) {
 *       applyValidationError(e)
 *     }
 *   }
 */
import { reactive, computed, type ComputedRef } from 'vue'
import { isValidationError, type FieldError } from '../errors'

export interface UseFormErrorsReturn {
  errors: Record<string, string>
  hasErrors: ComputedRef<boolean>
  errorList: ComputedRef<FieldError[]>
  setError: (field: string, message: string) => void
  clearError: (field: string) => void
  clearAll: () => void
  validate: (rules: Record<string, (value: unknown) => string | undefined>) => boolean
  applyValidationError: (e: unknown) => void
  getError: (field: string) => string | undefined
}

export function useFormErrors(): UseFormErrorsReturn {
  const errors = reactive<Record<string, string>>({})

  const hasErrors = computed(() => Object.keys(errors).length > 0)

  const errorList = computed<FieldError[]>(() =>
    Object.entries(errors).map(([field, message]) => ({ field, message }))
  )

  function setError(field: string, message: string) {
    errors[field] = message
  }

  function clearError(field: string) {
    delete errors[field]
  }

  function clearAll() {
    for (const k of Object.keys(errors)) {
      delete errors[k]
    }
  }

  function getError(field: string): string | undefined {
    return errors[field]
  }

  function validate(
    rules: Record<string, (value: unknown) => string | undefined>
  ): boolean {
    clearAll()
    for (const [field, rule] of Object.entries(rules)) {
      const msg = rule(undefined)
      if (msg) {
        setError(field, msg)
      }
    }
    return Object.keys(errors).length === 0
  }

  function applyValidationError(e: unknown) {
    if (!isValidationError(e)) return
    clearAll()
    for (const fe of e.fieldErrors) {
      setError(fe.field, fe.message)
    }
  }

  return {
    errors,
    hasErrors,
    errorList,
    setError,
    clearError,
    clearAll,
    validate,
    applyValidationError,
    getError
  }
}
