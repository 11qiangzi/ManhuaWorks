/**
 * Toast Pinia Store
 *
 * 集中管理 toast 队列，支撑：
 *  - 4 种类型（success/error/warning/info/loading/promise）
 *  - 5 种位置（top-right/top-left/bottom-right/bottom-left/top-center）
 *  - 自动消失（按类型）
 *  - 手动关闭
 *  - 队列管理（最大并发数）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise'
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration: number
  position: ToastPosition
  createdAt: number
  /** 自定义操作按钮 */
  action?: { label: string; handler: () => void }
  /** 是否不可关闭 */
  persistent?: boolean
  /** 进度 0-100（用于 promise/loading） */
  progress?: number
  /** promise 关联状态 */
  promiseStatus?: 'pending' | 'fulfilled' | 'rejected'
}

export interface AddToastOptions {
  title?: string
  duration?: number
  position?: ToastPosition
  action?: { label: string; handler: () => void }
  persistent?: boolean
}

const MAX_TOASTS = 8

let toastSeq = 0
function genId(): string {
  toastSeq += 1
  return `t-${Date.now()}-${toastSeq}`
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])

  const byPosition = computed(() => {
    const grouped: Record<ToastPosition, Toast[]> = {
      'top-right': [],
      'top-left': [],
      'bottom-right': [],
      'bottom-left': [],
      'top-center': [],
      'bottom-center': []
    }
    for (const t of items.value) {
      grouped[t.position]?.push(t)
    }
    return grouped
  })

  function add(type: ToastType, message: string, options: AddToastOptions = {}): string {
    const id = genId()
    const toast: Toast = {
      id,
      type,
      message,
      title: options.title,
      duration: options.duration ?? defaultDurationFor(type),
      position: options.position ?? 'top-right',
      createdAt: Date.now(),
      action: options.action,
      persistent: options.persistent ?? (type === 'loading' || type === 'promise'),
      progress: type === 'loading' ? undefined : undefined,
      promiseStatus: type === 'promise' ? 'pending' : undefined
    }
    items.value.push(toast)
    enforceMax()
    return id
  }

  function defaultDurationFor(type: ToastType): number {
    switch (type) {
      case 'error':
        return 5000
      case 'warning':
        return 4000
      case 'success':
        return 3000
      case 'info':
        return 3000
      case 'loading':
      case 'promise':
        return 0 // 不自动消失
      default:
        return 3000
    }
  }

  function enforceMax() {
    // 超过最大数时移除最早的普通 toast（不删除 loading）
    if (items.value.length <= MAX_TOASTS) return
    const candidates = items.value.filter((t) => t.type !== 'loading' && t.type !== 'promise')
    if (candidates.length === 0) return
    const toRemove = items.value.length - MAX_TOASTS
    let removed = 0
    for (let i = 0; i < items.value.length && removed < toRemove; i++) {
      if (items.value[i].type !== 'loading' && items.value[i].type !== 'promise') {
        items.value.splice(i, 1)
        i--
        removed++
      }
    }
  }

  function remove(id: string) {
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx >= 0) items.value.splice(idx, 1)
  }

  function update(id: string, patch: Partial<Toast>) {
    const t = items.value.find((x) => x.id === id)
    if (t) Object.assign(t, patch)
  }

  function clear() {
    items.value = []
  }

  function clearByPosition(position: ToastPosition) {
    items.value = items.value.filter((t) => t.position !== position)
  }

  return {
    items,
    byPosition,
    add,
    remove,
    update,
    clear,
    clearByPosition
  }
})

export function genToastId(): string {
  return genId()
}
