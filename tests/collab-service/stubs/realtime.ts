/**
 * collab-service · 实时协作 stub
 *
 * 模拟 WebSocket 帧协议 + presence + CRDT 同步
 * 帧类型与真实 ws-server.ts 的 OutboundFrame / InboundFrame 对齐
 */

import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'

/* ==================== 帧类型 ==================== */

export type OutboundFrame =
  | { type: 'hello'; projectId: string; clientId: string; userId: string; ts: number }
  | { type: 'presence'; users: Array<{ userId: string; clientCount: number; displayName?: string }>; snapshot: Array<Record<string, unknown>> }
  | { type: 'presence-join'; user: { userId: string; displayName?: string; clientId: string } }
  | { type: 'presence-leave'; userId: string; clientId: string }
  | { type: 'op'; op: Operation }
  | { type: 'op-ack'; opId: string; field: string; acceptedTs: number }
  | { type: 'typing'; userId: string; field?: string; isTyping: boolean }
  | { type: 'activity'; [k: string]: unknown }
  | { type: 'notification'; [k: string]: unknown }
  | { type: 'pong'; ts: number }
  | { type: 'error'; message: string }

export type InboundFrame =
  | { type: 'ping' }
  | { type: 'op'; op: Omit<Operation, 'id' | 'ts'> }
  | { type: 'typing'; field?: string; isTyping?: boolean }
  | { type: 'snapshot' }
  | { type: 'leave' }

export interface Operation {
  id: string
  ts: number
  field: string
  userId: string
  value: unknown
  origin?: string
}

export interface PresenceRecord {
  userId: string
  displayName: string
  clientId: string
  projectId: string
  joinedAt: number
  lastSeen: number
  color: string
  cursor?: { x: number; y: number }
}

/* ==================== Realtime Hub ==================== */

export interface RealtimeHubOptions {
  presenceTimeoutMs?: number
  heartbeatMs?: number
  seedProjectId?: string
  authorizedUserIds?: Set<string>
}

const COLORS = ['#FF6B35', '#00BFFF', '#9B59B6', '#2ECC71', '#F1C40F', '#E74C3C', '#1ABC9C']

export class RealtimeHub extends EventEmitter {
  presenceTimeoutMs: number
  heartbeatMs: number
  presence: Map<string, PresenceRecord> = new Map()
  operations: Operation[] = []
  snapshots: Array<{ id: string; field: string; value: unknown; createdAt: number }> = []
  /** 已授权用户（白名单），不传则全部允许 */
  private authorized: Set<string> | null

  constructor(opts: RealtimeHubOptions = {}) {
    super()
    this.presenceTimeoutMs = opts.presenceTimeoutMs ?? 60_000
    this.heartbeatMs = opts.heartbeatMs ?? 25_000
    this.authorized = opts.authorizedUserIds ?? null
  }

  isAuthorized(userId: string): boolean {
    return this.authorized === null || this.authorized.has(userId)
  }

  setAuthorized(userIds: Set<string>): void {
    this.authorized = userIds
  }

  /* ---------- 连接管理 ---------- */

  onJoin(projectId: string, userId: string, displayName: string, clientId = nanoid(8)): PresenceRecord {
    const existing = [...this.presence.values()].find(p => p.userId === userId && p.clientId === clientId)
    if (existing) return existing
    const color = COLORS[this.presence.size % COLORS.length] ?? '#888'
    const rec: PresenceRecord = {
      userId,
      displayName,
      clientId,
      projectId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      color,
    }
    this.presence.set(`${userId}:${clientId}`, rec)
    this.emit('presence-join', rec)
    return rec
  }

  onLeave(userId: string, clientId: string): void {
    const key = `${userId}:${clientId}`
    if (this.presence.delete(key)) {
      this.emit('presence-leave', { userId, clientId })
    }
  }

  /** 心跳：更新 lastSeen */
  heartbeat(userId: string, clientId: string): void {
    const rec = this.presence.get(`${userId}:${clientId}`)
    if (rec) rec.lastSeen = Date.now()
  }

  /** 清理超时 presence */
  reapStalePresence(): void {
    const now = Date.now()
    for (const [key, rec] of this.presence.entries()) {
      if (now - rec.lastSeen > this.presenceTimeoutMs) {
        this.presence.delete(key)
        this.emit('presence-leave', { userId: rec.userId, clientId: rec.clientId })
      }
    }
  }

  /* ---------- Operations（CRDT 同步） ---------- */

  submitOp(op: Omit<Operation, 'id' | 'ts'>): Operation {
    const fullOp: Operation = { id: nanoid(), ts: Date.now(), ...op }
    this.operations.push(fullOp)
    this.emit('op', fullOp)
    return fullOp
  }

  applySnapshot(field: string, value: unknown): void {
    const id = nanoid()
    this.snapshots.push({ id, field, value, createdAt: Date.now() })
    this.emit('snapshot', { id, field, value })
  }

  /* ---------- Typing 指示器 ---------- */

  setTyping(userId: string, field: string | undefined, isTyping: boolean): void {
    this.emit('typing', { userId, field, isTyping })
  }

  /* ---------- 查询 ---------- */

  getPresence(projectId?: string): PresenceRecord[] {
    return [...this.presence.values()].filter(p => !projectId || p.projectId === projectId)
  }

  getOperationsSince(ts = 0): Operation[] {
    return this.operations.filter(o => o.ts > ts)
  }

  clear(): void {
    this.presence.clear()
    this.operations = []
    this.snapshots = []
    this.removeAllListeners()
  }
}

/* ==================== Mock WS 客户端 ==================== */

export interface MockWSClientOpts {
  hub: RealtimeHub
  userId: string
  projectId: string
  clientId?: string
  displayName?: string
  autoPong?: boolean
}

export class MockWSClient {
  hub: RealtimeHub
  userId: string
  projectId: string
  clientId: string
  displayName: string
  sentFrames: OutboundFrame[] = []
  receivedFrames: OutboundFrame[] = []
  autoPong: boolean
  private presenceRecord: PresenceRecord | null = null
  private _listener?: (frame: OutboundFrame) => void

  constructor(opts: MockWSClientOpts) {
    this.hub = opts.hub
    this.userId = opts.userId
    this.projectId = opts.projectId
    this.clientId = opts.clientId ?? `c-${nanoid(8)}`
    this.displayName = opts.displayName ?? opts.userId
    this.autoPong = opts.autoPong ?? true
  }

  /** 模拟"建立连接 + hello 握手" */
  connect(): void {
    if (!this.hub.isAuthorized(this.userId)) {
      const err: OutboundFrame = { type: 'error', message: 'forbidden' }
      this.receivedFrames.push(err)
      this.emit(err)
      return
    }
    this.presenceRecord = this.hub.onJoin(this.projectId, this.userId, this.displayName, this.clientId)
    const hello: OutboundFrame = {
      type: 'hello',
      projectId: this.projectId,
      clientId: this.clientId,
      userId: this.userId,
      ts: Date.now(),
    }
    this.receivedFrames.push(hello)
    this.emit(hello)
    const presence: OutboundFrame = {
      type: 'presence',
      users: this.hub.getPresence(this.projectId).map(p => ({
        userId: p.userId,
        clientCount: 1,
        displayName: p.displayName,
      })),
      snapshot: [],
    }
    this.receivedFrames.push(presence)
    this.emit(presence)
  }

  /** 模拟收到服务端帧（不实际通过 socket） */
  emit(frame: OutboundFrame): void {
    this._listener?.(frame)
    if (this.autoPong && frame.type !== 'pong' && frame.type !== 'hello' && frame.type !== 'error') {
      // 模拟服务端会推 pong
    }
  }

  /** 客户端发帧 */
  send(frame: InboundFrame): void {
    this.sentFrames.push(frame as unknown as OutboundFrame)
    switch (frame.type) {
      case 'ping': {
        this.hub.heartbeat(this.userId, this.clientId)
        const pong: OutboundFrame = { type: 'pong', ts: Date.now() }
        this.receivedFrames.push(pong)
        this.emit(pong)
        break
      }
      case 'op': {
        const op = this.hub.submitOp({ ...frame.op, userId: this.userId })
        const ack: OutboundFrame = { type: 'op-ack', opId: op.id, field: op.field, acceptedTs: op.ts }
        this.receivedFrames.push(ack)
        this.emit(ack)
        break
      }
      case 'typing': {
        this.hub.setTyping(this.userId, frame.field, frame.isTyping ?? false)
        break
      }
      case 'snapshot': {
        // 服务端应返回当前 snapshot
        break
      }
      case 'leave': {
        this.disconnect()
        break
      }
    }
  }

  /** 模拟断开 */
  disconnect(): void {
    if (this.presenceRecord) {
      this.hub.onLeave(this.userId, this.clientId)
      this.presenceRecord = null
    }
  }

  /** 注册帧接收回调 */
  onFrame(cb: (frame: OutboundFrame) => void): void {
    this._listener = cb
  }

  /** 取出所有"收到"的帧 */
  allReceived(): OutboundFrame[] {
    return [...this.receivedFrames]
  }
}

/* ==================== 帧路由：模拟服务端"广播" ==================== */

/** 模拟服务端"广播 op"给项目内所有客户端（除了作者） */
export function broadcastOpToProject(
  hub: RealtimeHub,
  projectId: string,
  op: Operation,
  excludeUserId?: string,
): OutboundFrame[] {
  return hub.getPresence(projectId)
    .filter(p => p.userId !== excludeUserId)
    .map(p => ({ type: 'op' as const, op }))
}

/** 模拟服务端"通知"推给个人 */
export function buildNotificationFrame(payload: Record<string, unknown>): OutboundFrame {
  return { type: 'notification', ...payload }
}
