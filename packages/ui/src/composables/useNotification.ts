/**
 * useNotification - 站内通知操作包装
 *
 * 与 toast 区别：
 *  - toast: 临时轻提示，几秒自动消失
 *  - notification: 站内消息，持久化，可标记已读
 */
import { computed, type ComputedRef } from 'vue'
import {
  useNotificationStore,
  type NotificationItem
} from '../stores/notification'

export interface UseNotificationReturn {
  items: ReturnType<typeof useNotificationStore>['items']
  unreadCount: ComputedRef<number>
  grouped: ReturnType<typeof useNotificationStore>['grouped']
  panelOpen: ReturnType<typeof useNotificationStore>['panelOpen']
  add: (
    n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { id?: string }
  ) => NotificationItem
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  remove: (id: string) => void
  clear: () => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  info: (title: string, body: string) => NotificationItem
  success: (title: string, body: string) => NotificationItem
  warning: (title: string, body: string) => NotificationItem
  error: (title: string, body: string) => NotificationItem
  mention: (title: string, body: string, source: string) => NotificationItem
}

export function useNotification(): UseNotificationReturn {
  const store = useNotificationStore()

  function info(title: string, body: string) {
    return store.add({ level: 'info', title, body })
  }
  function success(title: string, body: string) {
    return store.add({ level: 'success', title, body })
  }
  function warning(title: string, body: string) {
    return store.add({ level: 'warning', title, body })
  }
  function error(title: string, body: string) {
    return store.add({ level: 'error', title, body })
  }
  function mention(title: string, body: string, source: string) {
    return store.add({ level: 'mention', title, body, source })
  }

  return {
    items: store.items,
    unreadCount: computed(() => store.unreadCount),
    grouped: store.grouped,
    panelOpen: store.panelOpen,
    add: store.add,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    remove: store.remove,
    clear: store.clear,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    togglePanel: store.togglePanel,
    info,
    success,
    warning,
    error,
    mention
  }
}
