/**
 * useWebSocket — WebSocket 客户端 composable
 * 千机工坊 · W3 工坊流程精修
 *
 * 功能：
 * 1. 自动重连（指数退避 1s → 2s → 4s → 8s → 最大 30s）
 * 2. 事件订阅（onMessage / onOpen / onClose / onError）
 * 3. 心跳保活（30s 一次 ping）
 * 4. 手动重连 / 主动关闭
 * 5. 5 主题无关（仅传递事件，不涉及 UI）
 */

import { ref, computed, onUnmounted, readonly } from 'vue'

export type WSStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error'

export interface WSOptions {
  /** 重连最大尝试次数（默认 Infinity = 无限） */
  maxRetries?: number
  /** 心跳间隔 (ms)，默认 30000 */
  heartbeatInterval?: number
  /** 重连初始延迟 (ms)，默认 1000 */
  initialReconnectDelay?: number
  /** 重连最大延迟 (ms)，默认 30000 */
  maxReconnectDelay?: number
  /** 重连退避系数，默认 2 */
  backoffFactor?: number
  /** 自定义协议子协议 */
  protocols?: string | string[]
  /** 连接时携带的 query / header（仅 query，header 由浏览器管理） */
  query?: Record<string, string>
}

export interface WSMessage<T = unknown> {
  /** 原始 data */
  raw: MessageEvent['data']
  /** 解析后的对象（如果是 JSON） */
  data: T
  /** 接收时间戳 */
  timestamp: number
}

/** 进度事件类型（与 ai-router.ts 中的 ProgressEvent 对齐） */
export interface ProgressEvent {
  jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  progress: number
  currentStep: number
  totalSteps: number
  steps: Array<{
    step: string
    status: 'pending' | 'running' | 'done' | 'failed'
    message?: string
  }>
  costUsd: number
  outputs?: {
    texts?: string[]
    images?: string[]
    videos?: string[]
  }
  log?: string
  error?: string
}

/** 默认配置 */
const DEFAULTS = {
  maxRetries: Infinity as number,
  heartbeatInterval: 30000,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  backoffFactor: 2,
  protocols: undefined as string | string[] | undefined,
  query: undefined as Record<string, string> | undefined
}

/**
 * 构造完整 WS URL
 */
function buildUrl(url: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return url
  const qs = new URLSearchParams(query).toString()
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

/**
 * 计算下一次重连延迟（指数退避 + 抖动）
 */
function calcBackoff(
  attempt: number,
  initial: number,
  max: number,
  factor: number
): number {
  const base = Math.min(initial * Math.pow(factor, attempt), max)
  // ±20% 抖动，避免雪崩
  const jitter = base * 0.2 * (Math.random() * 2 - 1)
  return Math.max(100, Math.floor(base + jitter))
}

/**
 * useWebSocket 主函数
 * @param url 完整 ws:// 或 wss:// 地址
 * @param options 配置
 */
export function useWebSocket(url: string, options: WSOptions = {}) {
  const opts = { ...DEFAULTS, ...options }

  const status = ref<WSStatus>('idle')
  const retryCount = ref(0)
  const lastError = ref<string | null>(null)
  const lastMessageAt = ref<number | null>(null)
  const manuallyClosed = ref(false)

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  // 事件订阅集合
  const messageListeners = new Set<(msg: WSMessage) => void>()
  const openListeners = new Set<() => void>()
  const closeListeners = new Set<(ev: CloseEvent) => void>()
  const errorListeners = new Set<(err: Event) => void>()
  const statusListeners = new Set<(s: WSStatus) => void>()

  function setStatus(s: WSStatus) {
    status.value = s
    statusListeners.forEach((fn) => fn(s))
  }

  /** 启动连接（首次或重连） */
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    manuallyClosed.value = false
    setStatus('connecting')

    const fullUrl = buildUrl(url, opts.query)
    try {
      ws = new WebSocket(fullUrl, opts.protocols)
    } catch (err) {
      lastError.value = (err as Error).message
      setStatus('error')
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      retryCount.value = 0
      lastError.value = null
      lastMessageAt.value = Date.now()
      setStatus('open')
      openListeners.forEach((fn) => fn())
      startHeartbeat()
    }

    ws.onmessage = (ev: MessageEvent) => {
      lastMessageAt.value = Date.now()
      let data: unknown = ev.data
      // 尝试 JSON 解析
      if (typeof ev.data === 'string') {
        try {
          data = JSON.parse(ev.data)
        } catch {
          // 保留原始字符串
          data = ev.data
        }
      }
      const msg: WSMessage = { raw: ev.data, data, timestamp: Date.now() }
      messageListeners.forEach((fn) => fn(msg))
    }

    ws.onerror = (ev: Event) => {
      lastError.value = 'WebSocket 错误'
      setStatus('error')
      errorListeners.forEach((fn) => fn(ev))
    }

    ws.onclose = (ev: CloseEvent) => {
      stopHeartbeat()
      setStatus('closed')
      closeListeners.forEach((fn) => fn(ev))
      // 正常关闭不重连
      if (!manuallyClosed.value && (opts.maxRetries === Infinity || retryCount.value < opts.maxRetries)) {
        scheduleReconnect()
      }
    }
  }

  /** 调度重连 */
  function scheduleReconnect() {
    if (manuallyClosed.value) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    const delay = calcBackoff(
      retryCount.value,
      opts.initialReconnectDelay,
      opts.maxReconnectDelay,
      opts.backoffFactor
    )
    retryCount.value += 1
    reconnectTimer = setTimeout(() => {
      connect()
    }, delay)
  }

  /** 启动心跳 */
  function startHeartbeat() {
    stopHeartbeat()
    if (opts.heartbeatInterval > 0) {
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping', t: Date.now() }))
          } catch {
            // 发送失败，下次 onerror 会触发重连
          }
        }
      }, opts.heartbeatInterval)
    }
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /** 主动发送 */
  function send(data: unknown): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false
    }
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      ws.send(payload)
      return true
    } catch {
      return false
    }
  }

  /** 主动关闭（不再重连） */
  function close(code = 1000, reason = 'client-close') {
    manuallyClosed.value = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopHeartbeat()
    if (ws) {
      setStatus('closing')
      try {
        ws.close(code, reason)
      } catch {
        /* noop */
      }
      ws = null
    } else {
      setStatus('closed')
    }
  }

  /** 手动重连（清零重试计数） */
  function reconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      try { ws.close() } catch { /* noop */ }
      ws = null
    }
    retryCount.value = 0
    connect()
  }

  // 事件订阅
  function onMessage(fn: (msg: WSMessage) => void): () => void {
    messageListeners.add(fn)
    return () => { messageListeners.delete(fn) }
  }
  function onOpen(fn: () => void): () => void {
    openListeners.add(fn)
    return () => { openListeners.delete(fn) }
  }
  function onClose(fn: (ev: CloseEvent) => void): () => void {
    closeListeners.add(fn)
    return () => { closeListeners.delete(fn) }
  }
  function onError(fn: (err: Event) => void): () => void {
    errorListeners.add(fn)
    return () => { errorListeners.delete(fn) }
  }
  function onStatusChange(fn: (s: WSStatus) => void): () => void {
    statusListeners.add(fn)
    return () => { statusListeners.delete(fn) }
  }

  // 自动开始连接
  connect()

  // 卸载时清理
  onUnmounted(() => {
    close()
  })

  return {
    // 状态（只读暴露）
    status: readonly(status),
    retryCount: readonly(retryCount),
    lastError: readonly(lastError),
    lastMessageAt: readonly(lastMessageAt),
    // 操作
    send,
    close,
    reconnect,
    // 订阅
    onMessage,
    onOpen,
    onClose,
    onError,
    onStatusChange
  }
}

/**
 * 便捷函数：订阅指定 jobId 的进度事件
 * 后端协议：ws://host/ws/jobs/:jobId/progress
 */
export function useJobProgress(jobId: string | null | undefined) {
  if (!jobId) {
    return {
      event: ref<ProgressEvent | null>(null),
      status: ref<WSStatus>('idle' as WSStatus),
      connected: ref(false),
      retryCount: ref(0)
    }
  }
  // 简化：仅在浏览器环境生效
  const wsBase = typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:5173'
  const url = `${wsBase}/ws/jobs/${encodeURIComponent(jobId)}/progress`

  const event = ref<ProgressEvent | null>(null)
  const { status, retryCount, onMessage } = useWebSocket(url, {
    heartbeatInterval: 20000,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 15000
  })

  onMessage((msg) => {
    if (msg.data && typeof msg.data === 'object' && 'jobId' in (msg.data as object)) {
      event.value = msg.data as ProgressEvent
    }
  })

  const connected = computed(() => status.value === 'open')

  return { event, status, connected, retryCount }
}
