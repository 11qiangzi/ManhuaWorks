/**
 * studio · collab Pinia store — 接 collab-service（HTTP + WebSocket）
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type {
  CollabEnvelope, CollabMessageType, CollabHandler, ShotDTO,
  CommentDTO, NotificationDTO, PresenceDTO, ActivityDTO,
  CreateCommentReq, CommentPayload, JoinPayload,
} from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'
import { useAuthStore } from './auth'

export type CollabEventHandler = (env: CollabEnvelope) => void

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

  const socketState = ref<'idle' | 'connecting' | 'open' | 'closing' | 'closed'>('closed')
  const currentProjectId = ref<string | null>(null)

  let socket: ReturnType<typeof api.collab.socket> | null = null
  const eventHandlers = new Set<CollabEventHandler>()

  /* ---------------- Computed ---------------- */
  const isConnected = computed(() => socketState.value === 'open')
  const myPresence = computed<PresenceDTO | null>(() => {
    const auth = useAuthStore()
    const uid = auth.user?.id
    if (!uid) return null
    return presence.value.find(p => p.user_id === uid) ?? null
  })

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

  async function join(projectId: string, target?: { target_type: string; target_id: string }): Promise<PresenceDTO> {
    const p = await api.collab.join(projectId, target as any)
    const idx = presence.value.findIndex((x) => x.user_id === p.user_id)
    if (idx >= 0) presence.value[idx] = p
    else presence.value.push(p)
    return p
  }

  async function leave(projectId: string): Promise<void> {
    await api.collab.leave(projectId)
    // Only remove the current user's presence, keep others
    const auth = useAuthStore()
    const uid = auth.user?.id
    if (uid) {
      presence.value = presence.value.filter(p => p.user_id !== uid)
    }
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

    // 监听 socket 状态变化（轮询检查 state 属性）
    const stateInterval = setInterval(() => {
      if (socket) {
        socketState.value = socket.state
      } else {
        clearInterval(stateInterval)
      }
    }, 500)

    // 监听评论事件
    socket.on<CommentPayload>('comment', (env) => {
      const { comment, verb } = env.data
      if (verb === 'create' && comment && !comments.value.find(x => x.id === comment.id)) {
        comments.value.push(comment)
      } else if (verb === 'resolve' || verb === 'reopen') {
        const idx = comments.value.findIndex(x => x.id === comment.id)
        if (idx >= 0) comments.value[idx] = { ...comments.value[idx]!, ...comment }
      } else if (verb === 'delete') {
        comments.value = comments.value.filter(x => x.id !== comment.id)
      }
      // 转发给应用层
      for (const fn of eventHandlers) {
        try { fn(env) } catch { /* noop */ }
      }
    })

    // 监听加入/离开事件
    socket.on<JoinPayload>('join', (env) => {
      const p = env.data.presence
      if (p && p.user_id) {
        const idx = presence.value.findIndex(x => x.user_id === p.user_id)
        if (idx >= 0) presence.value[idx] = p
        else presence.value.push(p)
      }
      for (const fn of eventHandlers) {
        try { fn(env) } catch { /* noop */ }
      }
    })

    // 其他事件类型也转发给应用层
    for (const msgType of ['typing', 'cursor', 'edit'] as CollabMessageType[]) {
      socket.on(msgType, (env) => {
        for (const fn of eventHandlers) {
          try { fn(env) } catch { /* noop */ }
        }
      })
    }
  }

  function disconnect(): void {
    if (socket) {
      try { socket.close() } catch { /* noop */ }
      socket = null
    }
    currentProjectId.value = null
    socketState.value = 'closed'
    presence.value = []
  }

  function send(type: CollabMessageType, data: unknown): void {
    if (!socket) return
    socket.send(type, data)
  }

  function onEvent(fn: CollabEventHandler): () => void {
    eventHandlers.add(fn)
    return () => eventHandlers.delete(fn)
  }

  /** 入站事件合并到本地状态（兼容旧调用） */
  function onSocketEvent(env: CollabEnvelope): void {
    switch (env.type) {
      case 'comment': {
        const { comment, verb } = env.data as CommentPayload
        if (verb === 'create' && comment && !comments.value.find((x) => x.id === comment.id)) {
          comments.value.push(comment)
        } else if (verb === 'resolve' || verb === 'reopen') {
          const idx = comments.value.findIndex((x) => x.id === comment.id)
          if (idx >= 0) comments.value[idx] = { ...comments.value[idx]!, ...comment }
        }
        break
      }
      case 'join': {
        const p = (env.data as JoinPayload).presence
        if (p && p.user_id) {
          const idx = presence.value.findIndex((x) => x.user_id === p.user_id)
          if (idx >= 0) presence.value[idx] = p
          else presence.value.push(p)
        }
        break
      }
      default:
        break
    }
  }

  return {
    comments, notifications, unreadCount, presence, activities,
    loading, error, socketState, currentProjectId, isConnected, myPresence,
    loadComments, addComment, resolveComment, reopenComment, deleteComment,
    loadNotifications, refreshUnreadCount, markRead, markAllRead, archive,
    loadPresence, join, leave,
    loadActivities,
    connect, disconnect, send, onEvent, onSocketEvent,
  }
})
