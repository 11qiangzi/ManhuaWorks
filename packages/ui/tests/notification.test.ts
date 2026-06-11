/**
 * notification.test.ts - 站内通知测试
 * 覆盖：CRUD、已读未读、面板开关、grouped
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from '../src/stores/notification'
import { useNotification } from '../src/composables/useNotification'

describe('useNotificationStore - basic CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a notification and exposes it', () => {
    const store = useNotificationStore()
    const n = store.add({ level: 'info', title: '系统消息', body: '欢迎使用' })
    expect(n.id).toBeDefined()
    expect(store.items[0].title).toBe('系统消息')
    expect(store.items[0].read).toBe(false)
  })

  it('removes a notification by id', () => {
    const store = useNotificationStore()
    const n = store.add({ level: 'info', title: 'x', body: 'y' })
    store.remove(n.id)
    expect(store.items).toHaveLength(0)
  })

  it('clears all notifications', () => {
    const store = useNotificationStore()
    store.add({ level: 'info', title: 'a', body: 'x' })
    store.add({ level: 'info', title: 'b', body: 'y' })
    store.clear()
    expect(store.items).toHaveLength(0)
  })
})

describe('useNotificationStore - read/unread', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('unreadCount counts unread items', () => {
    const store = useNotificationStore()
    const a = store.add({ level: 'info', title: 'a', body: 'x' })
    store.add({ level: 'info', title: 'b', body: 'y' })
    expect(store.unreadCount).toBe(2)
    store.markAsRead(a.id)
    expect(store.unreadCount).toBe(1)
  })

  it('markAllAsRead() marks everything as read', () => {
    const store = useNotificationStore()
    store.add({ level: 'info', title: 'a', body: 'x' })
    store.add({ level: 'info', title: 'b', body: 'y' })
    store.markAllAsRead()
    expect(store.unreadCount).toBe(0)
    expect(store.items.every((n) => n.read)).toBe(true)
  })

  it('markAsRead() is idempotent', () => {
    const store = useNotificationStore()
    const n = store.add({ level: 'info', title: 'a', body: 'x' })
    store.markAsRead(n.id)
    store.markAsRead(n.id)
    expect(store.items[0].read).toBe(true)
  })
})

describe('useNotificationStore - panel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with panel closed', () => {
    const store = useNotificationStore()
    expect(store.panelOpen).toBe(false)
  })

  it('openPanel/closePanel/togglePanel control visibility', () => {
    const store = useNotificationStore()
    store.openPanel()
    expect(store.panelOpen).toBe(true)
    store.closePanel()
    expect(store.panelOpen).toBe(false)
    store.togglePanel()
    expect(store.panelOpen).toBe(true)
    store.togglePanel()
    expect(store.panelOpen).toBe(false)
  })
})

describe('useNotificationStore - grouped (today/yesterday/earlier)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('groups items by age', () => {
    const store = useNotificationStore()
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    // 手动插入 3 个不同时间
    store.add({ level: 'info', title: 'today', body: 'x', createdAt: now - 1000 })
    store.add({ level: 'info', title: 'yesterday', body: 'x', createdAt: now - day - 1000 })
    store.add({ level: 'info', title: 'earlier', body: 'x', createdAt: now - 3 * day })
    expect(store.grouped.today).toHaveLength(1)
    expect(store.grouped.yesterday).toHaveLength(1)
    expect(store.grouped.earlier).toHaveLength(1)
  })
})

describe('useNotification composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes all 5 convenience methods', () => {
    const n = useNotification()
    expect(typeof n.info).toBe('function')
    expect(typeof n.success).toBe('function')
    expect(typeof n.warning).toBe('function')
    expect(typeof n.error).toBe('function')
    expect(typeof n.mention).toBe('function')
  })

  it('info/success/warning/error create correct level items', () => {
    const n = useNotification()
    n.info('i-title', 'i-body')
    n.success('s-title', 's-body')
    n.warning('w-title', 'w-body')
    n.error('e-title', 'e-body')
    expect(n.items[0].level).toBe('error')
    expect(n.items[1].level).toBe('warning')
    expect(n.items[2].level).toBe('success')
    expect(n.items[3].level).toBe('info')
  })

  it('mention() includes source', () => {
    const n = useNotification()
    const item = n.mention('m-title', 'm-body', 'alice')
    expect(item.level).toBe('mention')
    expect(item.source).toBe('alice')
  })

  it('add() supports custom level', () => {
    const n = useNotification()
    n.add({ level: 'system', title: 'sys', body: 'x' })
    expect(n.items[0].level).toBe('system')
  })

  it('markAllAsRead() resets unread count', () => {
    const n = useNotification()
    n.info('a', 'x')
    n.info('b', 'y')
    expect(n.unreadCount.value).toBe(2)
    n.markAllAsRead()
    expect(n.unreadCount.value).toBe(0)
  })
})
