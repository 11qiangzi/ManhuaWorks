/**
 * ManhuaWorks · api-client
 * collab module
 *   - REST: comments / presence / notifications / activities
 *   - WebSocket: 自动重连（指数退避 1s → 2s → 4s → 8s，上限 30s）
 *   - 5 类消息: typing / cursor / edit / comment / join
 */

import { tokenStore } from './token-store.js'
import { ApiError, ErrorCode, NetworkError } from './errors.js'
import type { HttpModule, CollabModule, CollabSocket, CreateApiClientOptions } from './types.js'
import type {
  CommentDTO, CreateCommentReq, PageResp, CommentTargetType, ID,
  NotificationDTO, ListNotificationsReq, ActivityDTO, ListActivitiesReq,
  PresenceDTO, CollabMessageType, CollabHandler, CollabEnvelope,
} from './types.js'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]   // 1s → 2s → 4s → 8s → 16s → 30s cap
const HEARTBEAT_INTERVAL_MS = 25_000
const PING_FRAME = JSON.stringify({ type: '__ping', ts: Date.now() })

/* =================================================================== *
 *  REST collab methods
 * =================================================================== */
export function createCollabRest(http: HttpModule): Omit<CollabModule, 'socket'> {
  return {
    /* ---------------- Comments ---------------- */
    async listComments(q: { project_id: ID; target_type?: CommentTargetType; target_id?: ID; page?: number; pageSize?: number }) {
      return await http.get<PageResp<CommentDTO>>(`/collab/projects/${encodeURIComponent(q.project_id)}/comments`, q as Record<string, unknown>)
    },
    async createComment(req: CreateCommentReq) {
      return await http.post<CommentDTO>('/collab/comments', req)
    },
    async resolveComment(id: ID) {
      return await http.post<CommentDTO>(`/collab/comments/${encodeURIComponent(id)}/resolve`, {})
    },
    async reopenComment(id: ID) {
      return await http.post<CommentDTO>(`/collab/comments/${encodeURIComponent(id)}/reopen`, {})
    },
    async deleteComment(id: ID) {
      await http.delete<void>(`/collab/comments/${encodeURIComponent(id)}`)
    },

    /* ---------------- Notifications ---------------- */
    async listNotifications(q: ListNotificationsReq = {}) {
      return await http.get<PageResp<NotificationDTO>>('/collab/notifications', q as Record<string, unknown>)
    },
    async unreadCount() {
      return await http.get<{ count: number }>('/collab/notifications/unread-count')
    },
    async markRead(id: ID) {
      await http.post<void>(`/collab/notifications/${encodeURIComponent(id)}/read`, {})
    },
    async markAllRead() {
      await http.post<void>('/collab/notifications/read-all', {})
    },
    async archiveNotification(id: ID) {
      await http.delete<void>(`/collab/notifications/${encodeURIComponent(id)}`)
    },

    /* ---------------- Activity ---------------- */
    async listActivities(q: ListActivitiesReq = {}) {
      return await http.get<PageResp<ActivityDTO>>('/collab/activities', q as Record<string, unknown>)
    },

    /* ---------------- Presence ---------------- */
    async listProjectPresence(projectId: ID) {
      return await http.get<PresenceDTO[]>(`/collab/projects/${encodeURIComponent(projectId)}/presence`)
    },
    async join(projectId: ID, target?: { target_type: CommentTargetType; target_id: ID }) {
      return await http.post<PresenceDTO>(`/collab/projects/${encodeURIComponent(projectId)}/join`, target ?? {})
    },
    async leave(projectId: ID) {
      await http.post<void>(`/collab/projects/${encodeURIComponent(projectId)}/leave`, {})
    },
  }
}

/* =================================================================== *
 *  WebSocket client (reconnect with exponential backoff)
 * =================================================================== */
export function createCollabSocket(opts: CreateApiClientOptions): (projectId: ID) => CollabSocket {
  const wsBase = (opts.wsBaseURL ?? defaultWsBase(opts.baseURL ?? '/api')).replace(/\/+$/, '')
  const WSImpl: typeof WebSocket = opts.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : (class FakeWS {
    constructor() { throw new NetworkError(ErrorCode.NETWORK_UNKNOWN, 'WebSocket unavailable') }
  }) as unknown as typeof WebSocket)

  return function socket(projectId: ID): CollabSocket {
    const handlers = new Map<CollabMessageType | '*', Set<CollabHandler>>()
    let state: CollabSocket['state'] = 'idle'
    let ws: WebSocket | null = null
    let attempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let manualClose = false

    function urlFor(): string {
      const token = tokenStore.get()
      const tParam = token ? `?token=${encodeURIComponent(token)}` : ''
      return `${wsBase}/collab/ws/projects/${encodeURIComponent(projectId)}${tParam}`
    }

    function flushReconnect(): void {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    }

    function startHeartbeat(): void {
      stopHeartbeat()
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === 1 /* OPEN */) {
          try { ws.send(PING_FRAME) } catch { /* ignore send errors, will trigger close → reconnect */ }
        }
      }, HEARTBEAT_INTERVAL_MS)
    }
    function stopHeartbeat(): void {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
    }

    function dispatch(env: CollabEnvelope): void {
      const set = handlers.get(env.type)
      if (set) for (const h of set) {
        try { h(env) } catch { /* listener 异常不中断广播 */ }
      }
      const star = handlers.get('*')
      if (star) for (const h of star) {
        try { h(env) } catch { /* ignore */ }
      }
    }

    function connect(): void {
      if (state === 'connecting' || state === 'open' || state === 'closing') return
      state = 'connecting'
      let sock: WebSocket
      try { sock = new WSImpl(urlFor()) }
      catch (e) {
        state = 'closed'
        scheduleReconnect()
        void e
        return
      }
      ws = sock

      sock.onopen = () => {
        attempt = 0
        state = 'open'
        startHeartbeat()
      }

      sock.onmessage = (ev: MessageEvent) => {
        let env: CollabEnvelope | null = null
        try {
          const data = typeof ev.data === 'string' ? ev.data : ''
          if (!data) return
          const obj = JSON.parse(data) as Partial<CollabEnvelope>
          if (!obj || typeof obj.type !== 'string') return
          env = obj as CollabEnvelope
        } catch { return }
        if (env) dispatch(env)
      }

      sock.onerror = () => {
        // error → close will follow
      }

      sock.onclose = () => {
        ws = null
        stopHeartbeat()
        state = 'closed'
        if (manualClose) return
        scheduleReconnect()
      }
    }

    function scheduleReconnect(): void {
      flushReconnect()
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    const api: CollabSocket = {
      projectId,
      get state() { return state },

      on<T = unknown>(type: CollabMessageType | '*', handler: CollabHandler<T>): () => void {
        let set = handlers.get(type)
        if (!set) { set = new Set(); handlers.set(type, set) }
        set.add(handler as CollabHandler)
        return () => {
          const s = handlers.get(type)
          if (s) s.delete(handler as CollabHandler)
        }
      },

      send<T = unknown>(type: CollabMessageType, data: T): void {
        const env: CollabEnvelope<T> = {
          type,
          project_id: projectId,
          user_id: 'self',   // server 端用 token 校验
          ts: Date.now(),
          data,
        }
        if (ws && ws.readyState === 1) {
          try { ws.send(JSON.stringify(env)) } catch { /* swallow */ }
        }
      },

      close(): void {
        manualClose = true
        flushReconnect()
        stopHeartbeat()
        if (ws) {
          try { state = 'closing'; ws.close() } catch { /* ignore */ }
          ws = null
        }
        state = 'closed'
      },

      reconnect(): void {
        attempt = 0
        if (ws) {
          try { ws.close() } catch { /* ignore */ }
          ws = null
        }
        flushReconnect()
        connect()
      },
    }

    // 自动首次连接
    if (typeof WSImpl === typeof WebSocket || (WSImpl as unknown) !== (class FakeWS {} as unknown)) {
      connect()
    }

    return api
  }
}

function defaultWsBase(apiBase: string): string {
  if (typeof window === 'undefined') return 'ws://localhost:8080/api'
  if (apiBase.startsWith('http://')) return `ws://${apiBase.slice(7)}`
  if (apiBase.startsWith('https://')) return `wss://${apiBase.slice(8)}`
  // 同源
  const loc = window.location
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${loc.host}${apiBase}`
}

/* re-export for tests / 兼容 */
export { RECONNECT_DELAYS }

/* keep ApiError 引用以防 tree-shake 砍掉 */
void ApiError
