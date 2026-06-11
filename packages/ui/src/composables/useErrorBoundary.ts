/**
 * ErrorBoundary 组合式函数
 *
 * 让组件支持：try/catch 渲染 + 失败 fallback + 重置
 *
 * 用法（setup 语法）：
 *   const { ErrorBoundary, captureError, reset } = useErrorBoundary()
 *   return { ErrorBoundary }
 *
 * 模板：
 *   <ErrorBoundary v-slot="{ error }">
 *     <MyComponent />
 *     <template #fallback>
 *       <div>出错了：{{ error?.message }}</div>
 *     </template>
 *   </ErrorBoundary>
 */
import {
  defineComponent,
  h,
  ref,
  onErrorCaptured,
  type PropType,
  type Slot
} from 'vue'
import type { AppError } from '../errors'
import { fromUnknown } from '../errors'

export interface ErrorBoundarySlotProps {
  error: AppError | null
  reset: () => void
}

export interface UseErrorBoundaryReturn {
  error: ReturnType<typeof ref<AppError | null>>
  reset: () => void
  captureError: (e: unknown) => void
  ErrorBoundary: ReturnType<typeof defineComponent>
}

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const error = ref<AppError | null>(null)

  function reset() {
    error.value = null
  }

  function captureError(e: unknown) {
    error.value = fromUnknown(e)
  }

  // 内置 ErrorBoundary 组件
  const ErrorBoundary = defineComponent({
    name: 'ErrorBoundary',
    props: {
      fallback: {
        type: [String, Object, Function] as PropType<string | object | Slot>,
        default: null
      }
    },
    setup(props, { slots }) {
      onErrorCaptured((err: unknown) => {
        error.value = fromUnknown(err)
        return false // 阻止向上传播
      })

      return () => {
        if (error.value) {
          // 自定义 fallback
          if (props.fallback) {
            if (typeof props.fallback === 'function') {
              return (props.fallback as (props: ErrorBoundarySlotProps) => unknown)({
                error: error.value,
                reset
              })
            }
            if (typeof props.fallback === 'string') {
              return h('div', { class: 'error-boundary-fallback' }, props.fallback)
            }
            return props.fallback
          }
          // 命名插槽 fallback
          const fallbackSlot = slots.fallback?.({
            error: error.value,
            reset
          })
          if (fallbackSlot) return fallbackSlot
          // 默认 fallback
          return h(
            'div',
            { class: 'error-boundary-fallback', role: 'alert' },
            `出错了: ${error.value.message}`
          )
        }
        return slots.default?.()
      }
    }
  })

  return {
    error,
    reset,
    captureError,
    ErrorBoundary
  }
}
