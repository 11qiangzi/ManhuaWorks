/**
 * 站内通知 Store（区别于 toast：toast 是即时轻提示，notification 是站内消息流）
 *
 * 用法：
 *   const { items, unreadCount, add, markAsRead, markAllAsRead } = useNotificationStore()
 *   add({ title: '系统消息', body: '...', level: 'info' })
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'mention' | 'system'

export interface NotificationItem {
  id: string
  level: NotificationLevel
  title: string
  body: string
  createdAt: number
  read: boolean
  /** 关联跳转链接 */
  link?: string
  /** 关联头像/图标 */
  avatar?: string
  /** 关联用户/来源 */
  source?: string
  /** 关联资源 ID */
  resourceId?: string
  meta?: Record<string, unknown>
}

let seq = 0
function genId(): string {
  seq += 1
  return `n-${Date.now()}-${seq}`
}

export const useNotificationStore = defineStore('notification', () => {
  const items = ref<NotificationItem[]>([])
  const panelOpen = ref(false)

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

  const grouped = computed(() => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const today: NotificationItem[] = []
    const yesterday: NotificationItem[] = []
    const earlier: NotificationItem[] = []
    for (const n of items.value) {
      const diff = now - n.createdAt
      if (diff < day) today.push(n)
      else if (diff < 2 * day) yesterday.push(n)
      else earlier.push(n)
    }
    return { today, yesterday, earlier }
  })

  function add(
    n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & {
      id?: string
      createdAt?: number
      read?: boolean
    }
  ): NotificationItem {
    const item: NotificationItem = {
      id: n.id ?? genId(),
      level: n.level,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt ?? Date.now(),
      read: n.read ?? false,
      link: n.link,
      avatar: n.avatar,
      source: n.source,
      resourceId: n.resourceId,
      meta: n.meta
    }
    items.value.unshift(item)
    return item
  }

  function markAsRead(id: string) {
    const n = items.value.find((x) => x.id === id)
    if (n) n.read = true
  }

  function markAllAsRead() {
    for (const n of items.value) n.read = true
  }

  function remove(id: string) {
    const idx = items.value.findIndex((x) => x.id === id)
    if (idx >= 0) items.value.splice(idx, 1)
  }

  function clear() {
    items.value = []
  }

  function openPanel() {
    panelOpen.value = true
  }

  function closePanel() {
    panelOpen.value = false
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
  }

  return {
    items,
    panelOpen,
    unreadCount,
    grouped,
    add,
    markAsRead,
    markAllAsRead,
    remove,
    clear,
    openPanel,
    closePanel,
    togglePanel
  }
})
