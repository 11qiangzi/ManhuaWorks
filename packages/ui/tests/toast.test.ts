/**
 * toast.test.ts - Toast 系统测试
 * 覆盖：4 类型 + 5 位置 + 队列管理 + promise 流转
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '../src/stores/toast'
import { useToast } from '../src/composables/useToast'

describe('useToastStore - basic CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a toast and exposes it', () => {
    const store = useToastStore()
    const id = store.add('success', '保存成功')
    expect(store.items).toHaveLength(1)
    expect(store.items[0].id).toBe(id)
    expect(store.items[0].type).toBe('success')
  })

  it('removes a toast by id', () => {
    const store = useToastStore()
    const id = store.add('info', 'msg')
    store.remove(id)
    expect(store.items).toHaveLength(0)
  })

  it('updates a toast in place', () => {
    const store = useToastStore()
    const id = store.add('info', 'old')
    store.update(id, { message: 'new' })
    expect(store.items[0].message).toBe('new')
  })

  it('clears all toasts', () => {
    const store = useToastStore()
    store.add('success', 'a')
    store.add('error', 'b')
    store.clear()
    expect(store.items).toHaveLength(0)
  })
})

describe('useToastStore - 6 toast types', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('supports success/error/warning/info/loading/promise', () => {
    const store = useToastStore()
    const types = ['success', 'error', 'warning', 'info', 'loading', 'promise'] as const
    for (const t of types) {
      const id = store.add(t, 'msg')
      expect(store.items.find((x) => x.id === id)?.type).toBe(t)
    }
    expect(store.items).toHaveLength(6)
  })

  it('loading/promise are persistent by default', () => {
    const store = useToastStore()
    const loadingId = store.add('loading', 'l')
    const promiseId = store.add('promise', 'p')
    expect(store.items.find((x) => x.id === loadingId)?.persistent).toBe(true)
    expect(store.items.find((x) => x.id === promiseId)?.persistent).toBe(true)
  })

  it('error/warning have different default durations', () => {
    const store = useToastStore()
    const errorId = store.add('error', 'e')
    const warningId = store.add('warning', 'w')
    const successId = store.add('success', 's')
    expect(store.items.find((x) => x.id === errorId)?.duration).toBeGreaterThan(
      store.items.find((x) => x.id === successId)?.duration ?? 0
    )
    expect(store.items.find((x) => x.id === warningId)?.duration).toBeGreaterThan(
      store.items.find((x) => x.id === successId)?.duration ?? 0
    )
  })
})

describe('useToastStore - 6 positions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('supports 6 positions', () => {
    const store = useToastStore()
    const positions = [
      'top-right',
      'top-left',
      'bottom-right',
      'bottom-left',
      'top-center',
      'bottom-center'
    ] as const
    for (const p of positions) {
      store.add('info', 'm', { position: p })
    }
    expect(Object.values(store.byPosition).flat()).toHaveLength(6)
    for (const p of positions) {
      expect(store.byPosition[p]).toHaveLength(1)
    }
  })

  it('clearByPosition() removes only specified position', () => {
    const store = useToastStore()
    store.add('info', 'a', { position: 'top-right' })
    store.add('info', 'b', { position: 'top-left' })
    store.clearByPosition('top-right')
    expect(store.byPosition['top-right']).toHaveLength(0)
    expect(store.byPosition['top-left']).toHaveLength(1)
  })
})

describe('useToastStore - queue management', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('enforces max queue size of 8 (keeps loading/promise)', () => {
    const store = useToastStore()
    for (let i = 0; i < 12; i++) {
      store.add('info', `m${i}`)
    }
    expect(store.items.length).toBeLessThanOrEqual(8)
  })

  it('preserves loading/promise even over limit', () => {
    const store = useToastStore()
    store.add('loading', 'keep-me')
    for (let i = 0; i < 12; i++) {
      store.add('info', `m${i}`)
    }
    const loadingItems = store.items.filter((t) => t.type === 'loading')
    expect(loadingItems.length).toBeGreaterThanOrEqual(1)
  })
})

describe('useToast composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes success/error/warning/info/loading', () => {
    const t = useToast()
    expect(typeof t.success).toBe('function')
    expect(typeof t.error).toBe('function')
    expect(typeof t.warning).toBe('function')
    expect(typeof t.info).toBe('function')
    expect(typeof t.loading).toBe('function')
  })

  it('success() creates success toast', () => {
    const t = useToast()
    const id = t.success('saved!')
    const store = useToastStore()
    expect(store.items.find((x) => x.id === id)?.type).toBe('success')
  })

  it('error() creates error toast with title option', () => {
    const t = useToast()
    const id = t.error('oops', { title: '错误' })
    const store = useToastStore()
    expect(store.items.find((x) => x.id === id)?.title).toBe('错误')
  })

  it('loading() creates persistent toast', () => {
    const t = useToast()
    const id = t.loading('loading...')
    const store = useToastStore()
    expect(store.items.find((x) => x.id === id)?.persistent).toBe(true)
  })

  it('promise() resolves to success', async () => {
    const t = useToast()
    const result = await t.promise(Promise.resolve('value'), {
      loading: 'loading...',
      success: 'done!',
      error: 'failed'
    })
    expect(result).toBe('value')
  })

  it('promise() catches error and shows error toast', async () => {
    const t = useToast()
    const p = t.promise(Promise.reject(new Error('boom')), {
      loading: 'loading...',
      success: 'done',
      error: 'failed: ' // prefix
    })
    await expect(p).rejects.toThrow('boom')
  })

  it('promise() supports function-based success/error messages', async () => {
    const t = useToast()
    const result = await t.promise(Promise.resolve(42), {
      loading: 'loading...',
      success: (v) => `value is ${v}`,
      error: (e) => `error: ${e}`
    })
    expect(result).toBe(42)
  })

  it('dismiss() removes specific toast', () => {
    const t = useToast()
    const id = t.info('hi')
    t.dismiss(id)
    const store = useToastStore()
    expect(store.items).toHaveLength(0)
  })

  it('clear() removes all', () => {
    const t = useToast()
    t.success('a')
    t.error('b')
    t.clear()
    const store = useToastStore()
    expect(store.items).toHaveLength(0)
  })

  it('setPosition() changes default position for subsequent toasts', () => {
    const t = useToast()
    t.setPosition('bottom-left')
    const id = t.info('hi')
    const store = useToastStore()
    expect(store.items.find((x) => x.id === id)?.position).toBe('bottom-left')
  })
})
