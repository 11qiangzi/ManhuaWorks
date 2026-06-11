/**
 * collab-service · 5 个核心路由集成测试
 *
 * 覆盖：
 *  1. 协作者（邀请/接受/改角色/移除/列表）
 *  2. 评论（发/编辑/删/解决）
 *  3. 活动（列出 + 触发记录）
 *  4. 通知（列出/未读/标已读）
 *  5. 鉴权（无 token 401 / 错误 token 401）
 *
 * 策略：
 *  - 用 stub Hono app（与真实路由同形），in-memory 状态
 *  - 不启服务、不连 DB
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildApp,
  makeCollabState,
  type CollabState,
  type AuthSubject,
} from './stubs/app'
import { makeRequest, makeAppRequest, readJson } from '../setup/mock-providers'
import type { Hono } from 'hono'

/* ==================== 工具 ==================== */

const OWNER: AuthSubject = { userId: 'u_owner', role: 'admin' }
const MEMBER: AuthSubject = { userId: 'u_member', role: 'editor' }
const STRANGER: AuthSubject = { userId: 'u_stranger', role: 'editor' }
const ADMIN_USER: AuthSubject = { userId: 'u_admin', role: 'admin' }

function authHeader(sub: AuthSubject): Record<string, string> {
  return { 'X-User-Id': sub.userId, 'X-User-Role': sub.role }
}

function newApp(state: CollabState): Hono<{ Variables: { auth: AuthSubject } }> {
  return buildApp({
    state,
    extractSubject: (c) => {
      const userId = c.req.header('X-User-Id')
      const role = c.req.header('X-User-Role') as AuthSubject['role'] | undefined
      if (!userId || !role) return null
      return { userId, role }
    },
  })
}

async function seedOwner(state: CollabState, projectId = 'p_1', userId = OWNER.userId) {
  state.collaborators.push({
    projectId,
    userId,
    email: `${userId}@example.com`,
    displayName: userId,
    role: 'owner',
    status: 'active',
    invitedBy: userId,
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  })
}

/* ==================== 测试 ==================== */

describe('collab-service · 路由集成', () => {
  let state: CollabState
  let app: ReturnType<typeof newApp>

  beforeEach(() => {
    state = makeCollabState()
    app = newApp(state)
    seedOwner(state)
  })

  /* ==================== 1. 健康检查 ==================== */

  describe('health', () => {
    it('GET /health → ok', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/health'))
      expect(res.status).toBe(200)
      const body = await readJson<{ status: string; service: string }>(res)
      expect(body.status).toBe('ok')
      expect(body.service).toBe('collab-service')
    })

    it('GET /v1/collab/info → 返回元信息', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/info', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ roles: string[]; activityEvents: string[] }>(res)
      expect(body.roles).toContain('owner')
      expect(body.roles).toContain('viewer')
    })
  })

  /* ==================== 2. 鉴权 ==================== */

  describe('鉴权', () => {
    it('无 token → 401', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/collaborators'))
      expect(res.status).toBe(401)
    })

    it('无效 role → 401', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/collaborators', undefined, {
        'X-User-Id': 'u_x', 'X-User-Role': 'invalid',
      }))
      expect(res.status).toBe(401)
    })

    it('正常 token → 200', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/collaborators', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
    })
  })

  /* ==================== 3. 协作者 ==================== */

  describe('协作者', () => {
    it('GET 列表（默认 active）→ 包含 owner', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/collaborators', undefined, authHeader(OWNER)))
      const body = await readJson<{ list: unknown[]; count: number }>(res)
      expect(body.count).toBe(1)
    })

    it('POST 邀请 → 201 + invite_url + 活动流记录', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'newbie@example.com', role: 'editor',
      }, authHeader(OWNER)))
      expect(res.status).toBe(201)
      const body = await readJson<{ invitation_id: string; invite_url: string; expires_at: string }>(res)
      expect(body.invitation_id).toBeDefined()
      expect(body.invite_url).toContain('token=')
      expect(state.invitations).toHaveLength(1)
      expect(state.activities.some(a => a.verb === 'invited')).toBe(true)
    })

    it('非 owner/admin 邀请 → 403', async () => {
      state.collaborators.push({
        projectId: 'p_1', userId: MEMBER.userId, email: 'm@x.com', displayName: 'm',
        role: 'editor', status: 'active', invitedBy: OWNER.userId,
        invitedAt: new Date().toISOString(), joinedAt: new Date().toISOString(),
      })
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'x@example.com', role: 'viewer',
      }, authHeader(MEMBER)))
      expect(res.status).toBe(403)
    })

    it('套餐配额满 → 403 plan_limit', async () => {
      // 默认 10 个
      for (let i = 0; i < 9; i++) {
        state.collaborators.push({
          projectId: 'p_1', userId: `u_${i}`, email: `u${i}@x.com`, displayName: `u${i}`,
          role: 'editor', status: 'active', invitedBy: OWNER.userId,
          invitedAt: new Date().toISOString(), joinedAt: new Date().toISOString(),
        })
      }
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'over@example.com', role: 'editor',
      }, authHeader(OWNER)))
      expect(res.status).toBe(403)
      const body = await readJson<{ error: string }>(res)
      expect(body.error).toBe('plan_limit')
    })

    it('重复邀请同 email → 409 pending_invitation_exists', async () => {
      await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'dup@example.com', role: 'editor',
      }, authHeader(OWNER)))
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'dup@example.com', role: 'editor',
      }, authHeader(OWNER)))
      expect(res.status).toBe(409)
    })

    it('POST accept 邀请 → 200 + 加入成员 + 活动', async () => {
      await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'newbie@example.com', role: 'editor',
      }, authHeader(OWNER)))
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators/accept', undefined, authHeader(STRANGER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ role: string; user_id: string }>(res)
      expect(body.role).toBe('editor')
      expect(state.collaborators.some(c => c.email === 'newbie@example.com' && c.status === 'active')).toBe(true)
      expect(state.activities.some(a => a.verb === 'joined')).toBe(true)
    })

    it('PATCH 改角色（owner 操作）→ 200 + 活动', async () => {
      state.collaborators.push({
        projectId: 'p_1', userId: MEMBER.userId, email: 'm@x.com', displayName: 'm',
        role: 'editor', status: 'active', invitedBy: OWNER.userId,
        invitedAt: new Date().toISOString(), joinedAt: new Date().toISOString(),
      })
      const res = await makeAppRequest(app, makeRequest('PATCH', 'http://x/v1/collab/projects/p_1/collaborators/u_member', {
        role: 'viewer',
      }, authHeader(OWNER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ role: string }>(res)
      expect(body.role).toBe('viewer')
      expect(state.activities.some(a => a.verb === 'role_changed')).toBe(true)
    })

    it('PATCH owner 角色 → 403（不能改 owner）', async () => {
      const res = await makeAppRequest(app, makeRequest('PATCH', 'http://x/v1/collab/projects/p_1/collaborators/u_owner', {
        role: 'viewer',
      }, authHeader(OWNER)))
      expect(res.status).toBe(403)
    })

    it('DELETE 移除协作者 → 200 + 通知被移除人', async () => {
      state.collaborators.push({
        projectId: 'p_1', userId: MEMBER.userId, email: 'm@x.com', displayName: 'm',
        role: 'editor', status: 'active', invitedBy: OWNER.userId,
        invitedAt: new Date().toISOString(), joinedAt: new Date().toISOString(),
      })
      const res = await makeAppRequest(app, makeRequest('DELETE', 'http://x/v1/collab/projects/p_1/collaborators/u_member', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      expect(state.collaborators.find(c => c.userId === MEMBER.userId)?.status).toBe('removed')
      expect(state.notifications.some(n => n.type === 'member_removed' && n.userId === MEMBER.userId)).toBe(true)
    })

    it('DELETE 移除 owner → 403', async () => {
      const res = await makeAppRequest(app, makeRequest('DELETE', 'http://x/v1/collab/projects/p_1/collaborators/u_owner', undefined, authHeader(OWNER)))
      expect(res.status).toBe(403)
    })
  })

  /* ==================== 4. 评论 ==================== */

  describe('评论', () => {
    beforeEach(() => {
      // 加一个 active 成员让评论可发
      state.collaborators.push({
        projectId: 'p_1', userId: MEMBER.userId, email: 'm@x.com', displayName: 'm',
        role: 'editor', status: 'active', invitedBy: OWNER.userId,
        invitedAt: new Date().toISOString(), joinedAt: new Date().toISOString(),
      })
    })

    it('GET 列表（默认未解决）', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/comments', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ list: unknown[]; total: number }>(res)
      expect(body.total).toBe(0)
    })

    it('POST 发评论 → 201 + thread_id', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'test',
        mentions: [],
      }, authHeader(MEMBER)))
      expect(res.status).toBe(201)
      const body = await readJson<{ id: string; threadId: string; authorId: string }>(res)
      expect(body.threadId).toBe(body.id) // 顶层评论 threadId = id
      expect(body.authorId).toBe(MEMBER.userId)
    })

    it('POST 评论带 @mention → 给被 @ 的人发通知', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: '@owner 你看这里',
        mentions: ['u_owner'],
      }, authHeader(MEMBER)))
      expect(res.status).toBe(201)
      expect(state.notifications.some(n => n.type === 'comment_mention' && n.userId === 'u_owner')).toBe(true)
    })

    it('POST 评论 body 超过 2000 字符 → 400', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'a'.repeat(2001),
        mentions: [],
      }, authHeader(MEMBER)))
      expect(res.status).toBe(400)
    })

    it('非项目成员发评论 → 403', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'x', mentions: [],
      }, authHeader(STRANGER)))
      expect(res.status).toBe(403)
    })

    it('PATCH 编辑自己的评论（在 5 分钟内）', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'v1', mentions: [],
      }, authHeader(MEMBER)))
      const { id } = await readJson<{ id: string }>(create)
      const res = await makeAppRequest(app, makeRequest('PATCH', `http://x/v1/collab/comments/${id}`, {
        body: 'v2',
      }, authHeader(MEMBER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ body: string }>(res)
      expect(body.body).toBe('v2')
    })

    it('PATCH 编辑别人评论 → 403', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'x', mentions: [],
      }, authHeader(MEMBER)))
      const { id } = await readJson<{ id: string }>(create)
      const res = await makeAppRequest(app, makeRequest('PATCH', `http://x/v1/collab/comments/${id}`, {
        body: 'y',
      }, authHeader(OWNER)))
      expect(res.status).toBe(403)
    })

    it('PATCH 5 分钟后的评论 → 409 edit_window_expired', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'old', mentions: [],
      }, authHeader(MEMBER)))
      const { id } = await readJson<{ id: string }>(create)
      // 改 createdAt 模拟过期
      const c = state.comments.find(x => x.id === id)!
      c.createdAt = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      const res = await makeAppRequest(app, makeRequest('PATCH', `http://x/v1/collab/comments/${id}`, {
        body: 'new',
      }, authHeader(MEMBER)))
      expect(res.status).toBe(409)
      const body = await readJson<{ error: string }>(res)
      expect(body.error).toBe('edit_window_expired')
    })

    it('DELETE 自己的评论（软删）', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'x', mentions: [],
      }, authHeader(MEMBER)))
      const { id } = await readJson<{ id: string }>(create)
      const res = await makeAppRequest(app, makeRequest('DELETE', `http://x/v1/collab/comments/${id}`, undefined, authHeader(MEMBER)))
      expect(res.status).toBe(200)
      expect(state.comments.find(x => x.id === id)?.deletedAt).not.toBeNull()
    })

    it('POST resolve → 标记为已解决', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: 'x', mentions: [],
      }, authHeader(MEMBER)))
      const { id } = await readJson<{ id: string }>(create)
      const res = await makeAppRequest(app, makeRequest('POST', `http://x/v1/collab/comments/${id}/resolve`, undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      expect(state.comments.find(x => x.id === id)?.isResolved).toBe(true)
    })
  })

  /* ==================== 5. 活动流 ==================== */

  describe('活动流', () => {
    it('GET → 返回项目活动（按时间倒序）', async () => {
      // 触发一条邀请
      await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'x@example.com', role: 'viewer',
      }, authHeader(OWNER)))
      const res = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/activity?limit=10', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      const body = await readJson<{ list: Array<{ verb: string }>; count: number }>(res)
      expect(body.count).toBeGreaterThan(0)
      expect(body.list[0].verb).toBe('invited')
    })

    it('GET 带 since 过滤', async () => {
      const now = new Date().toISOString()
      state.activities.push({
        id: 'a_1', projectId: 'p_1', actorId: 'u_1', verb: 'old',
        targetType: null, targetId: null, summary: 'old',
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
      })
      const res = await makeAppRequest(app, makeRequest('GET', `http://x/v1/collab/projects/p_1/activity?since=${now}`, undefined, authHeader(OWNER)))
      const body = await readJson<{ list: unknown[]; count: number }>(res)
      expect(body.count).toBe(0)
    })
  })

  /* ==================== 6. 通知 ==================== */

  describe('通知', () => {
    beforeEach(() => {
      state.notifications.push(
        { id: 'n_1', userId: OWNER.userId, type: 'comment_mention', title: 'a', body: 'b', link: null, readAt: null, createdAt: new Date().toISOString() },
        { id: 'n_2', userId: OWNER.userId, type: 'invitation_accepted', title: 'c', body: 'd', link: null, readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      )
    })

    it('GET 列表 → 包含未读 + 已读', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', `http://x/v1/collab/notifications?userId=u_owner`, undefined, authHeader(OWNER)))
      const body = await readJson<{ list: unknown[]; unread_count: number }>(res)
      expect(body.list).toHaveLength(2)
      expect(body.unread_count).toBe(1)
    })

    it('GET ?unreadOnly=true → 只返回未读', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', `http://x/v1/collab/notifications?userId=u_owner&unreadOnly=true`, undefined, authHeader(OWNER)))
      const body = await readJson<{ list: unknown[]; unread_count: number }>(res)
      expect(body.list).toHaveLength(1)
    })

    it('GET /unread-count', async () => {
      const res = await makeAppRequest(app, makeRequest('GET', `http://x/v1/collab/notifications/unread-count?userId=u_owner`, undefined, authHeader(OWNER)))
      const body = await readJson<{ count: number }>(res)
      expect(body.count).toBe(1)
    })

    it('POST /:id/read → 标记已读', async () => {
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/notifications/n_1/read', undefined, authHeader(OWNER)))
      expect(res.status).toBe(200)
      expect(state.notifications.find(n => n.id === 'n_1')?.readAt).not.toBeNull()
    })

    it('POST /read-all → 全部已读', async () => {
      // 准备：先重置 n_2 为未读
      state.notifications[1].readAt = null
      const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/notifications/read-all?userId=u_owner', undefined, authHeader(OWNER)))
      const body = await readJson<{ marked: number }>(res)
      expect(body.marked).toBe(2)
    })
  })

  /* ==================== 7. 端到端串联 ==================== */

  describe('端到端串联', () => {
    it('完整链路：邀请 → 接受 → 评论 → 通知', async () => {
      // 1. 邀请
      const inv = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators', {
        email: 'suming@example.com', role: 'editor',
      }, authHeader(OWNER)))
      expect(inv.status).toBe(201)

      // 2. 接受
      const acc = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/collaborators/accept', undefined, authHeader(STRANGER)))
      expect(acc.status).toBe(200)
      const accBody = await readJson<{ user_id: string }>(acc)

      // 3. 接受者发评论 @ owner
      const com = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_1/comments', {
        body: '@owner 看看这个', mentions: ['u_owner'],
      }, authHeader(STRANGER)))
      expect(com.status).toBe(201)

      // 4. owner 收到通知
      const noti = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/notifications?userId=u_owner', undefined, authHeader(OWNER)))
      const notiBody = await readJson<{ list: Array<{ type: string }>; unread_count: number }>(noti)
      expect(notiBody.list.some(n => n.type === 'comment_mention')).toBe(true)
      expect(notiBody.unread_count).toBeGreaterThan(0)

      // 5. 标已读
      const markRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/notifications/read-all?userId=u_owner', undefined, authHeader(OWNER)))
      expect(markRes.status).toBe(200)

      // 6. 再查：未读数 = 0
      const cnt = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/notifications/unread-count?userId=u_owner', undefined, authHeader(OWNER)))
      const cntBody = await readJson<{ count: number }>(cnt)
      expect(cntBody.count).toBe(0)

      // 7. 活动流含 invited / joined / commented
      const act = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/collab/projects/p_1/activity', undefined, authHeader(OWNER)))
      const actBody = await readJson<{ list: Array<{ verb: string }> }>(act)
      const verbs = actBody.list.map(a => a.verb)
      expect(verbs).toContain('invited')
      expect(verbs).toContain('joined')
      expect(verbs).toContain('commented')
    })
  })
})
