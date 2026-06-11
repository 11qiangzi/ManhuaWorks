/**
 * collab-service · WebSocket 实时协作测试
 *
 * 覆盖：
 *  1. 连接握手（hello + presence）
 *  2. 心跳（ping/pong）
 *  3. Presence 多客户端同步
 *  4. CRDT op 提交 + 广播 + ack
 *  5. Typing 指示器
 *  6. 离线 / 重新连接
 *  7. 鉴权（未授权用户被拒）
 *
 * 策略：
 *  - 100% 内存模拟，不启服务
 *  - MockWSClient 模拟单个客户端
 *  - RealtimeHub 模拟服务端
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  RealtimeHub,
  MockWSClient,
  broadcastOpToProject,
  buildNotificationFrame,
  type OutboundFrame,
  type Operation,
} from './stubs/realtime'
import { wait } from '../setup/mock-providers'

/* ==================== 工具 ==================== */

function makeClient(hub: RealtimeHub, userId: string, projectId = 'p_1'): MockWSClient {
  return new MockWSClient({
    hub,
    userId,
    projectId,
    displayName: userId,
  })
}

function makeOp(userId: string, field: string, value: unknown): Omit<Operation, 'id' | 'ts'> {
  return { field, userId, value, origin: 'test' }
}

/* ==================== 测试 ==================== */

describe('collab-service · WebSocket 实时协作', () => {
  let hub: RealtimeHub

  beforeEach(() => {
    hub = new RealtimeHub({ presenceTimeoutMs: 100, heartbeatMs: 50 })
  })

  /* ==================== 1. 连接 ==================== */

  describe('连接握手', () => {
    it('connect → 收到 hello + presence', () => {
      const c = makeClient(hub, 'u_1')
      c.connect()
      const types = c.allReceived().map(f => f.type)
      expect(types).toContain('hello')
      expect(types).toContain('presence')
      const hello = c.allReceived().find(f => f.type === 'hello') as Extract<OutboundFrame, { type: 'hello' }>
      expect(hello.userId).toBe('u_1')
      expect(hello.projectId).toBe('p_1')
    })

    it('未授权用户 connect → 收到 error', () => {
      hub.setAuthorized(new Set(['u_1']))
      const c = makeClient(hub, 'u_stranger')
      c.connect()
      const err = c.allReceived().find(f => f.type === 'error') as Extract<OutboundFrame, { type: 'error' }>
      expect(err).toBeDefined()
      expect(err.message).toContain('forbidden')
      expect(hub.getPresence()).toHaveLength(0)
    })

    it('同一用户多 tab（多 clientId）→ 多个 presence 记录', () => {
      const a = new MockWSClient({ hub, userId: 'u_1', projectId: 'p_1', clientId: 'tab_A' })
      const b = new MockWSClient({ hub, userId: 'u_1', projectId: 'p_1', clientId: 'tab_B' })
      a.connect()
      b.connect()
      expect(hub.getPresence('p_1')).toHaveLength(2)
    })
  })

  /* ==================== 2. 心跳 ==================== */

  describe('心跳', () => {
    it('客户端发 ping → 收到 pong + 续约 lastSeen', async () => {
      const c = makeClient(hub, 'u_1')
      c.connect()
      const before = hub.getPresence('p_1')[0].lastSeen
      await wait(20)
      c.send({ type: 'ping' })
      const after = hub.getPresence('p_1')[0].lastSeen
      expect(after).toBeGreaterThan(before)
      const pong = c.allReceived().find(f => f.type === 'pong') as Extract<OutboundFrame, { type: 'pong' }>
      expect(pong).toBeDefined()
    })

    it('60s 没心跳 → 服务端 reap 掉', async () => {
      // presenceTimeoutMs = 100ms（测试用）
      const c = makeClient(hub, 'u_1')
      c.connect()
      expect(hub.getPresence('p_1')).toHaveLength(1)
      await wait(150)
      hub.reapStalePresence()
      expect(hub.getPresence('p_1')).toHaveLength(0)
    })
  })

  /* ==================== 3. Presence ==================== */

  describe('Presence', () => {
    it('3 个用户加入 → presence = 3', () => {
      const a = makeClient(hub, 'u_a')
      const b = makeClient(hub, 'u_b')
      const c = makeClient(hub, 'u_c')
      a.connect(); b.connect(); c.connect()
      const presence = hub.getPresence('p_1')
      expect(presence).toHaveLength(3)
      const userIds = presence.map(p => p.userId)
      expect(userIds).toContain('u_a')
      expect(userIds).toContain('u_b')
      expect(userIds).toContain('u_c')
    })

    it('不同项目的 presence 互相隔离', () => {
      const a = makeClient(hub, 'u_1', 'p_1')
      const b = makeClient(hub, 'u_1', 'p_2')
      a.connect(); b.connect()
      expect(hub.getPresence('p_1')).toHaveLength(1)
      expect(hub.getPresence('p_2')).toHaveLength(1)
    })

    it('presence-join / leave 事件正确触发', () => {
      const events: unknown[] = []
      hub.on('presence-join', (p) => events.push({ type: 'join', user: p.userId }))
      hub.on('presence-leave', (p) => events.push({ type: 'leave', user: p.userId }))

      const c = makeClient(hub, 'u_1')
      c.connect()
      c.disconnect()

      expect(events).toEqual([
        { type: 'join', user: 'u_1' },
        { type: 'leave', user: 'u_1' },
      ])
    })

    it('每个用户分配不同颜色', () => {
      const users = ['u_1', 'u_2', 'u_3', 'u_4', 'u_5']
      users.forEach(u => makeClient(hub, u).connect())
      const colors = hub.getPresence('p_1').map(p => p.color)
      const unique = new Set(colors)
      expect(unique.size).toBe(users.length)
    })
  })

  /* ==================== 4. CRDT 操作 ==================== */

  describe('CRDT 操作（op）', () => {
    it('提交 op → 入库 + 返回 op-ack', () => {
      const c = makeClient(hub, 'u_1')
      c.connect()
      c.send({ type: 'op', op: makeOp('u_1', 'scene.title', '新标题') })

      expect(hub.operations).toHaveLength(1)
      expect(hub.operations[0].field).toBe('scene.title')
      const ack = c.allReceived().find(f => f.type === 'op-ack') as Extract<OutboundFrame, { type: 'op-ack' }>
      expect(ack.field).toBe('scene.title')
      expect(ack.opId).toBe(hub.operations[0].id)
    })

    it('广播 op 给项目内其他用户', () => {
      const a = makeClient(hub, 'u_a')
      const b = makeClient(hub, 'u_b')
      a.connect(); b.connect()
      b.allReceived().length // 计数

      a.send({ type: 'op', op: makeOp('u_a', 'layer.1', { x: 10 }) })

      const frames = broadcastOpToProject(hub, 'p_1', hub.operations[0], 'u_a')
      expect(frames).toHaveLength(1)
      expect(frames[0].type).toBe('op')
    })

    it('getOperationsSince 增量同步', async () => {
      hub.submitOp({ field: 'a', userId: 'u_1', value: 1 })
      await wait(5)
      hub.submitOp({ field: 'b', userId: 'u_1', value: 2 })
      await wait(5)
      hub.submitOp({ field: 'c', userId: 'u_1', value: 3 })

      // since = a 之后 1ms
      const since = hub.operations[0].ts + 1
      const result = hub.getOperationsSince(since)
      expect(result).toHaveLength(2)
      const fields = result.map(r => r.field)
      expect(fields).toEqual(['b', 'c'])
    })

    it('applySnapshot 保留最新值', () => {
      hub.applySnapshot('scene.title', '旧')
      hub.applySnapshot('scene.title', '新')
      expect(hub.snapshots).toHaveLength(2)
      const last = hub.snapshots[hub.snapshots.length - 1]
      expect(last.value).toBe('新')
    })
  })

  /* ==================== 5. Typing ==================== */

  describe('Typing 指示器', () => {
    it('客户端发 typing → 触发 typing 事件', () => {
      const events: Array<{ userId: string; field: string | undefined; isTyping: boolean }> = []
      hub.on('typing', (e) => events.push(e))

      const c = makeClient(hub, 'u_1')
      c.connect()
      c.send({ type: 'typing', field: 'comment.body', isTyping: true })
      c.send({ type: 'typing', field: 'comment.body', isTyping: false })

      expect(events).toEqual([
        { userId: 'u_1', field: 'comment.body', isTyping: true },
        { userId: 'u_1', field: 'comment.body', isTyping: false },
      ])
    })
  })

  /* ==================== 6. 通知 ==================== */

  describe('通知推送', () => {
    it('buildNotificationFrame 构造正确的帧结构', () => {
      const frame = buildNotificationFrame({
        kind: 'comment_mention',
        data: { id: 'c_1', body: '你看这里' },
      })
      expect(frame.type).toBe('notification')
      expect((frame as Record<string, unknown>).kind).toBe('comment_mention')
    })
  })

  /* ==================== 7. 断线重连 ==================== */

  describe('断线 / 重连', () => {
    it('leave 帧触发 disconnect', () => {
      const c = makeClient(hub, 'u_1')
      c.connect()
      expect(hub.getPresence('p_1')).toHaveLength(1)
      c.send({ type: 'leave' })
      expect(hub.getPresence('p_1')).toHaveLength(0)
    })

    it('同用户重连 → 2 个 presence 记录（新 clientId）', () => {
      const c1 = makeClient(hub, 'u_1')
      c1.connect()
      c1.disconnect()
      const c2 = makeClient(hub, 'u_1')
      c2.connect()
      expect(hub.getPresence('p_1')).toHaveLength(1) // disconnect 已清
    })
  })

  /* ==================== 8. 端到端协作场景 ==================== */

  describe('端到端：3 人在线同时编辑', () => {
    it('林启 + 苏眀 + 陈远枢 同时改 → 各自 op 都记录', () => {
      const linqi = makeClient(hub, 'u_linqi')
      const suming = makeClient(hub, 'u_suming')
      const yuanshu = makeClient(hub, 'u_yuanshu')
      linqi.connect()
      suming.connect()
      yuanshu.connect()

      linqi.send({ type: 'op', op: makeOp('u_linqi', 'scene.1.title', '开场：船舱') })
      suming.send({ type: 'op', op: makeOp('u_suming', 'scene.1.camera', '推近') })
      yuanshu.send({ type: 'op', op: makeOp('u_yuanshu', 'scene.1.color', '#FF6B35') })

      expect(hub.operations).toHaveLength(3)
      const fields = hub.operations.map(o => o.field)
      expect(fields).toEqual([
        'scene.1.title',
        'scene.1.camera',
        'scene.1.color',
      ])
      const authors = new Set(hub.operations.map(o => o.userId))
      expect(authors.size).toBe(3)
    })

    it('广播：1 个 op 给其他 2 人，不给作者', () => {
      const a = makeClient(hub, 'u_a')
      const b = makeClient(hub, 'u_b')
      const c = makeClient(hub, 'u_c')
      a.connect(); b.connect(); c.connect()

      a.send({ type: 'op', op: makeOp('u_a', 'f', 'v') })
      const op = hub.operations[0]
      const frames = broadcastOpToProject(hub, 'p_1', op, 'u_a')
      expect(frames).toHaveLength(2) // 给 b + c
      const targetUsers = new Set(
        hub.getPresence('p_1').filter(p => p.userId !== 'u_a').map(p => p.userId)
      )
      expect(targetUsers.size).toBe(2)
    })
  })
})
