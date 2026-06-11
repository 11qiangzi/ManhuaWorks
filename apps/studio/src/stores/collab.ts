/**
 * studio · collab Pinia store — 接 collab-service（HTTP + WebSocket）
 * ManhuaWorks · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  CollabEvent, CollabEventType, CollabSocketState, ShotDTO,
  CommentDTO, NotificationDTO, PresenceDTO, ActivityDTO,
  CreateCommentReq,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export type CollabEventHandler = (evt: CollabEvent) => void

export const useCollabStore = defineStore('collab', () => {
  const api = getApi()

  /* ---------------- 状态 ---------------- */
  const comments = ref<CommentDTO[]>([])
  const notifications = ref<NotificationDTO[]>([])
  const unreadCount = ref(0)
  const presence = ref<PresenceDTO[]>([])
  const activities = ref<ActivityDTO[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const socketState = ref<CollabSocketState>('closed')
  const currentProjectId = ref<string | null>(null)

  let socket: ReturnType<typeof api.collab.socket> | null = null
  const eventHandlers = new Set<CollabEventHandler>()

  /* ---------------- Computed ---------------- */
  const isConnected = computed(() => socketState.value === 'open')
  const myPresence = computed<PresenceDTO | null>(() =>
    presence.value.find(() => true) ?? null,
  )

  /* ---------------- Comments ---------------- */

  async function loadComments(projectId: string, targetType?: CommentDTO['target_type'], targetId?: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const r = await api.collab.listComments({ project_id: projectId, target_type: targetType, target_id: targetId, pageSize: 100 })
      comments.value = r.list
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载评论失败'
      throw e
    } finally { loading.value = false }
  }

  async function addComment(req: CreateCommentReq): Promise<CommentDTO> {
    const c = await api.collab.createComment(req)
    comments.value.push(c)
    return c
  }

  async function resolveComment(id: string): Promise<void> {
    const c = await api.collab.resolveComment(id)
    const idx = comments.value.findIndex((x) => x.id === id)
    if (idx >= 0) comments.value[idx] = c
  }

  async function reopenComment(id: string): Promise<void> {
    const c = await api.collab.reopenComment(id)
    const idx = comments.value.findIndex((x) => x.id === id)
    if (idx >= 0) comments.value[idx] = c
  }

  async function deleteComment(id: string): Promise<void> {
    await api.collab.deleteComment(id)
    comments.value = comments.value.filter((x) => x.id !== id)
  }

  /* ---------------- Notifications ---------------- */

  async function loadNotifications(unreadOnly = false): Promise<void> {
    const r = await api.collab.listNotifications({ unread_only: unreadOnly, pageSize: 50 })
    notifications.value = r.list
  }

  async function refreshUnreadCount(): Promise<void> {
    try {
      const r = await api.collab.unreadCount()
      unreadCount.value = r.count
    } catch { /* noop */ }
  }

  async function markRead(id: string): Promise<void> {
    await api.collab.markRead(id)
    const idx = notifications.value.findIndex((n) => n.id === id)
    if (idx >= 0 && !notifications.value[idx]!.read) {
      notifications.value[idx] = { ...notifications.value[idx]!, read: true }
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function markAllRead(): Promise<void> {
    await api.collab.markAllRead()
    notifications.value = notifications.value.map((n) => ({ ...n, read: true }))
    unreadCount.value = 0
  }

  async function archive(id: string): Promise<void> {
    await api.collab.archiveNotification(id)
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  /* ---------------- Presence ---------------- */

  async function loadPresence(projectId: string): Promise<void> {
    presence.value = await api.collab.listProjectPresence(projectId)
  }

  async function join(projectId: string, currentTarget?: string): Promise<PresenceDTO> {
    const p = await api.collab.join(projectId, currentTarget)
    const idx = presence.value.findIndex((x) => x.user_id === p.user_id)
    if (idx >= 0) presence.value[idx] = p
    else presence.value.push(p)
    return p
  }

  async function leave(projectId: string): Promise<void> {
    await api.collab.leave(projectId)
    presence.value = presence.value.filter((x) => x.project_id !== projectId)
  }

  /* ---------------- Activities ---------------- */

  async function loadActivities(projectId?: string): Promise<void> {
    const r = await api.collab.listActivities({ project_id: projectId, pageSize: 50 })
    activities.value = r.list
  }

  /* ---------------- WebSocket ---------------- */

  function connect(projectId: string): void {
    if (socket && currentProjectId.value === projectId && socketState.value === 'open') return
    if (socket) disconnect()

    currentProjectId.value = projectId
    socket = api.collab.socket(projectId)

    socket.onState((s) => { socketState.value = s })

    socket.onEvent((evt) => {
      // 默认处理：把入站事件合并到 store
      onSocketEvent(evt)
      // 转发给应用层
      for (const fn of eventHandlers) {
        try { fn(evt) } catch { /* noop */ }
      }
    })

    socket.connect()
  }

  function disconnect(): void {
    if (socket) {
      try { socket.close() } catch { /* noop */ }
      socket = null
    }
    currentProjectId.value = null
    socketState.value = 'closed'
  }

  function send(type: CollabEventType, data: unknown, extra: Partial<CollabEvent> = {}): void {
    if (!socket) return
    socket.send(type, data, extra)
  }

  function onEvent(fn: CollabEventHandler): () => void {
    eventHandlers.add(fn)
    return () => eventHandlers.delete(fn)
  }

  /** 入站事件合并到本地状态 */
  function onSocketEvent(evt: CollabEvent): void {
    switch (evt.type) {
      case 'comment.add': {
        const c = evt.data as CommentDTO
        if (c && c.id && !comments.value.find((x) => x.id === c.id)) {
          comments.value.push(c)
        }
        break
      }
      case 'comment.resolve': {
        const c = evt.data as CommentDTO
        const idx = comments.value.findIndex((x) => x.id === c.id)
        if (idx >= 0) comments.value[idx] = { ...comments.value[idx]!, ...c }
        break
      }
      case 'presence.join': {
        const p = evt.data as PresenceDTO
        if (p && p.user_id) {
          const idx = presence.value.findIndex((x) => x.user_id === p.user_id)
          if (idx >= 0) presence.value[idx] = p
          else presence.value.push(p)
        }
        break
      }
      case 'presence.leave': {
        const p = evt.data as PresenceDTO
        if (p && p.user_id) {
          presence.value = presence.value.filter((x) => x.user_id !== p.user_id)
        }
        break
      }
      case 'presence.update': {
        const p = evt.data as PresenceDTO
        if (p && p.user_id) {
          const idx = presence.value.findIndex((x) => x.user_id === p.user_id)
          if (idx >= 0) presence.value[idx] = p
        }
        break
      }
      case 'notification': {
        const n = evt.data as NotificationDTO
        if (n && n.id) {
          notifications.value.unshift(n)
          if (!n.read) unreadCount.value += 1
        }
        break
      }
      case 'shot.update': {
        // 推给 project store（如果当前 store 持有了 shot）
        const s = evt.data as ShotDTO
        if (s && s.id) {
          // 不直接改另一个 store，由应用层负责刷新
          // 这里只 emit，不写入
        }
        break
      }
      default:
        break
    }
  }

  return {
    comments, notifications, unreadCount, presence, activities,
    loading, error, socketState, currentProjectId, isConnected,
    loadComments, addComment, resolveComment, reopenComment, deleteComment,
    loadNotifications, refreshUnreadCount, markRead, markAllRead, archive,
    loadPresence, join, leave,
    loadActivities,
    connect, disconnect, send, onEvent,
  }
})
