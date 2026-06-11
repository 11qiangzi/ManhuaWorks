/**
 * collab-service · 路由契约测试用 stub
 *
 * 这里提供一个**与真实 collab-service 路由同形**的 Hono app，
 * 用 in-memory 状态模拟 4 大模块（协作者/评论/活动/通知）。
 *
 * 用途：
 *  - 测试客户端与 collab-service 的 HTTP 契约
 *  - 测试错误码、状态码、响应结构
 *  - 不依赖真实 DB/Redis/Postgres
 *
 * 真实 collab-service 路由在 `services/collab-service/src/**\/routes.ts`
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { nanoid } from 'nanoid'

/* ==================== 类型 ==================== */

export type CollaboratorRole = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer'
export type CollaboratorStatus = 'pending' | 'active' | 'declined' | 'removed'

export interface Collaborator {
  projectId: string
  userId: string
  email: string
  displayName: string
  role: CollaboratorRole
  status: CollaboratorStatus
  invitedBy: string
  invitedAt: string
  joinedAt: string | null
}

export interface Comment {
  id: string
  projectId: string
  assetId: string | null
  parentId: string | null
  threadId: string
  authorId: string
  body: string
  mentions: string[]
  isResolved: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Activity {
  id: string
  projectId: string
  actorId: string
  verb: string
  targetType: string | null
  targetId: string | null
  summary: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

/* ==================== In-Memory 状态 ==================== */

export interface CollabState {
  collaborators: Collaborator[]
  comments: Comment[]
  activities: Activity[]
  notifications: Notification[]
  invitations: Array<{
    id: string
    projectId: string
    email: string
    role: CollaboratorRole
    token: string
    invitedBy: string
    expiresAt: string
    acceptedAt: string | null
  }>
}

export function makeCollabState(): CollabState {
  return {
    collaborators: [],
    comments: [],
    activities: [],
    notifications: [],
    invitations: [],
  }
}

/* ==================== 鉴权：模拟 auth.mode='none' ==================== */

export interface AuthSubject {
  userId: string
  role: 'admin' | 'editor' | 'viewer'
}

const VALID_ROLES: AuthSubject['role'][] = ['admin', 'editor', 'viewer']

export function authMiddleware(extract: (c: { req: { header: (n: string) => string | undefined } }) => AuthSubject | null) {
  return async (c: { req: { header: (n: string) => string | undefined }; json: (b: unknown, s?: number) => Response; set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    const sub = extract({ req: c.req })
    if (!sub) return c.json({ error: 'unauthorized', message: 'missing or invalid token' }, 401)
    if (!VALID_ROLES.includes(sub.role)) {
      return c.json({ error: 'unauthorized', message: 'invalid role' }, 401)
    }
    c.set('auth', sub)
    await next()
  }
}

/* ==================== 工厂：app ==================== */

export interface BuildAppOptions {
  state: CollabState
  extractSubject: (c: { req: { header: (n: string) => string | undefined } }) => AuthSubject | null
  /** 套餐限制（默认 10） */
  maxCollaboratorsPerProject?: number
}

export function buildApp(opts: BuildAppOptions): Hono<{ Variables: { auth: AuthSubject } }> {
  const app = new Hono<{ Variables: { auth: AuthSubject } }>()
  const state = opts.state
  const max = opts.maxCollaboratorsPerProject ?? 10

  // 错误兜底
  app.onError((err, c) => {
    return c.json({ error: 'internal', message: (err as Error).message }, 500)
  })
  app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404))

  // 健康检查
  app.get('/health', (c) => c.json({ status: 'ok', service: 'collab-service' }))

  // 元信息
  app.get('/v1/collab/info', (c) => c.json({
    roles: ['owner', 'admin', 'editor', 'commenter', 'viewer'],
    activityEvents: ['invited', 'joined', 'removed', 'commented', 'uploaded', 'role_changed'],
    notificationChannels: ['inbox', 'email', 'websocket'],
  }))

  // 鉴权
  app.use('/v1/*', authMiddleware(opts.extractSubject))

  /* ---------- 协作者 ---------- */

  const listCollabQuery = z.object({
    status: z.enum(['pending', 'active', 'declined', 'removed']).optional(),
  })

  app.get('/v1/collab/projects/:projectId/collaborators', (c) => {
    const projectId = c.req.param('projectId')
    const q = listCollabQuery.safeParse(c.req.query())
    if (!q.success) return c.json({ error: 'bad_request', issues: q.error.flatten() }, 400)
    let rows = state.collaborators.filter(x => x.projectId === projectId)
    if (q.data.status) rows = rows.filter(x => x.status === q.data.status)
    return c.json({
      list: rows,
      count: rows.length,
    })
  })

  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'editor', 'commenter', 'viewer']),
    message: z.string().max(500).optional(),
  })

  app.post('/v1/collab/projects/:projectId/collaborators', async (c) => {
    const projectId = c.req.param('projectId')
    const auth = c.get('auth')
    const body = await c.req.json().catch(() => null)
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400)

    // 校验邀请者是 owner/admin
    const inviter = state.collaborators.find(x => x.projectId === projectId && x.userId === auth.userId)
    if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) {
      return c.json({ error: 'forbidden', message: 'owner or admin required' }, 403)
    }

    // 套餐配额
    const activeCount = state.collaborators.filter(x => x.projectId === projectId && x.status === 'active').length
    if (activeCount >= max) {
      return c.json({ error: 'plan_limit', message: `max ${max} collaborators` }, 403)
    }

    // 已为成员？
    const existing = state.collaborators.find(x => x.projectId === projectId && x.email === parsed.data.email)
    if (existing) {
      return c.json({ error: 'already_member' }, 409)
    }

    // 已有未处理邀请？
    const pending = state.invitations.find(x => x.projectId === projectId && x.email === parsed.data.email && !x.acceptedAt)
    if (pending) {
      return c.json({ error: 'pending_invitation_exists' }, 409)
    }

    const invitationId = nanoid()
    const token = nanoid(32)
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    state.invitations.push({
      id: invitationId,
      projectId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invitedBy: auth.userId,
      expiresAt,
      acceptedAt: null,
    })

    // 活动流
    state.activities.push({
      id: nanoid(),
      projectId,
      actorId: auth.userId,
      verb: 'invited',
      targetType: 'member',
      targetId: null,
      summary: `邀请 ${parsed.data.email} 作为 ${parsed.data.role}`,
      createdAt: new Date().toISOString(),
    })

    return c.json({
      invitation_id: invitationId,
      invite_url: `https://manhuaworks.com/invitations/${invitationId}?token=${token}`,
      expires_at: expiresAt,
    }, 201)
  })

  app.post('/v1/collab/projects/:projectId/collaborators/accept', (c) => {
    const projectId = c.req.param('projectId')
    const inv = state.invitations.find(x => x.projectId === projectId && !x.acceptedAt && new Date(x.expiresAt) > new Date())
    if (!inv) return c.json({ error: 'not_found' }, 404)
    inv.acceptedAt = new Date().toISOString()
    const auth = c.get('auth')
    const newUserId = auth?.userId ?? nanoid()
    state.collaborators.push({
      projectId,
      userId: newUserId,
      email: inv.email,
      displayName: inv.email.split('@')[0],
      role: inv.role,
      status: 'active',
      invitedBy: inv.invitedBy,
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    })
    state.activities.push({
      id: nanoid(),
      projectId,
      actorId: newUserId,
      verb: 'joined',
      targetType: 'member',
      targetId: null,
      summary: `${inv.email} 加入了项目`,
      createdAt: new Date().toISOString(),
    })
    return c.json({
      project_id: projectId,
      role: inv.role,
      user_id: newUserId,
    })
  })

  app.patch('/v1/collab/projects/:projectId/collaborators/:userId', async (c) => {
    const projectId = c.req.param('projectId')
    const userId = c.req.param('userId')
    const auth = c.get('auth')
    const body = await c.req.json().catch(() => null)
    const parsed = z.object({ role: z.enum(['admin', 'editor', 'commenter', 'viewer']) }).safeParse(body)
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400)

    const inviter = state.collaborators.find(x => x.projectId === projectId && x.userId === auth.userId)
    if (!inviter || inviter.role !== 'owner') {
      return c.json({ error: 'forbidden', message: 'owner required' }, 403)
    }

    const target = state.collaborators.find(x => x.projectId === projectId && x.userId === userId)
    if (!target) return c.json({ error: 'not_found' }, 404)
    if (target.role === 'owner') {
      return c.json({ error: 'forbidden', message: 'cannot change owner role' }, 403)
    }
    const oldRole = target.role
    target.role = parsed.data.role

    state.activities.push({
      id: nanoid(),
      projectId,
      actorId: auth.userId,
      verb: 'role_changed',
      targetType: 'member',
      targetId: userId,
      summary: `角色从 ${oldRole} 改为 ${parsed.data.role}`,
      createdAt: new Date().toISOString(),
    })
    return c.json(target)
  })

  app.delete('/v1/collab/projects/:projectId/collaborators/:userId', (c) => {
    const projectId = c.req.param('projectId')
    const userId = c.req.param('userId')
    const auth = c.get('auth')

    const inviter = state.collaborators.find(x => x.projectId === projectId && x.userId === auth.userId)
    if (!inviter || (inviter.role !== 'owner' && inviter.role !== 'admin')) {
      return c.json({ error: 'forbidden' }, 403)
    }

    const idx = state.collaborators.findIndex(x => x.projectId === projectId && x.userId === userId)
    if (idx === -1) return c.json({ error: 'not_found' }, 404)
    if (state.collaborators[idx].role === 'owner') {
      return c.json({ error: 'forbidden', message: 'cannot remove owner' }, 403)
    }
    state.collaborators[idx].status = 'removed'

    state.activities.push({
      id: nanoid(),
      projectId,
      actorId: auth.userId,
      verb: 'removed',
      targetType: 'member',
      targetId: userId,
      summary: `移除了协作者 ${userId}`,
      createdAt: new Date().toISOString(),
    })

    // 通知被移除的人
    state.notifications.push({
      id: nanoid(),
      userId,
      type: 'member_removed',
      title: '你已被移出项目',
      body: '',
      link: null,
      readAt: null,
      createdAt: new Date().toISOString(),
    })

    return c.json({ ok: true })
  })

  /* ---------- 评论 ---------- */

  const commentCreateSchema = z.object({
    body: z.string().min(1).max(2000),
    mentions: z.array(z.string()).max(10).default([]),
    parentId: z.string().nullable().optional(),
    assetId: z.string().nullable().optional(),
  })

  app.get('/v1/collab/projects/:projectId/comments', (c) => {
    const projectId = c.req.param('projectId')
    const page = Number(c.req.query('page') ?? 1)
    const pageSize = Math.min(Number(c.req.query('pageSize') ?? 20), 100)
    const resolved = c.req.query('resolved') ?? 'all'
    const offset = (page - 1) * pageSize

    let rows = state.comments.filter(x => x.projectId === projectId && !x.deletedAt)
    if (resolved === 'true') rows = rows.filter(x => x.isResolved)
    if (resolved === 'false') rows = rows.filter(x => !x.isResolved)
    rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const total = rows.length
    rows = rows.slice(offset, offset + pageSize)
    return c.json({ list: rows, page, page_size: pageSize, total })
  })

  app.post('/v1/collab/projects/:projectId/comments', async (c) => {
    const projectId = c.req.param('projectId')
    const auth = c.get('auth')
    const body = await c.req.json().catch(() => null)
    const parsed = commentCreateSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.flatten() }, 400)

    // 校验是项目成员
    const member = state.collaborators.find(x => x.projectId === projectId && x.userId === auth.userId && x.status === 'active')
    if (!member) return c.json({ error: 'forbidden' }, 403)

    const id = nanoid()
    const now = new Date().toISOString()
    const threadId = parsed.data.parentId ?? id
    const comment: Comment = {
      id,
      projectId,
      assetId: parsed.data.assetId ?? null,
      parentId: parsed.data.parentId ?? null,
      threadId,
      authorId: auth.userId,
      body: parsed.data.body,
      mentions: parsed.data.mentions,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    state.comments.push(comment)

    state.activities.push({
      id: nanoid(),
      projectId,
      actorId: auth.userId,
      verb: parsed.data.parentId ? 'replied' : 'commented',
      targetType: 'comment',
      targetId: id,
      summary: parsed.data.body.slice(0, 30),
      createdAt: now,
    })

    // 给被 @ 的人发通知
    for (const mentionedUserId of parsed.data.mentions) {
      state.notifications.push({
        id: nanoid(),
        userId: mentionedUserId,
        type: 'comment_mention',
        title: `${auth.userId} 在评论中提到你`,
        body: parsed.data.body.slice(0, 100),
        link: `/projects/${projectId}?comment=${id}`,
        readAt: null,
        createdAt: now,
      })
    }

    return c.json(comment, 201)
  })

  app.patch('/v1/collab/comments/:commentId', async (c) => {
    const commentId = c.req.param('commentId')
    const auth = c.get('auth')
    const body = await c.req.json().catch(() => null)
    const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(body)
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400)

    const comment = state.comments.find(x => x.id === commentId)
    if (!comment) return c.json({ error: 'not_found' }, 404)
    if (comment.authorId !== auth.userId) return c.json({ error: 'forbidden' }, 403)

    // 5 分钟编辑窗口
    const age = Date.now() - new Date(comment.createdAt).getTime()
    if (age > 5 * 60 * 1000) {
      return c.json({ error: 'edit_window_expired' }, 409)
    }

    comment.body = parsed.data.body
    comment.updatedAt = new Date().toISOString()
    return c.json(comment)
  })

  app.delete('/v1/collab/comments/:commentId', (c) => {
    const commentId = c.req.param('commentId')
    const auth = c.get('auth')
    const comment = state.comments.find(x => x.id === commentId)
    if (!comment) return c.json({ error: 'not_found' }, 404)
    if (comment.authorId !== auth.userId && auth.role !== 'admin') {
      return c.json({ error: 'forbidden' }, 403)
    }
    comment.deletedAt = new Date().toISOString()
    return c.json({ ok: true })
  })

  app.post('/v1/collab/comments/:commentId/resolve', (c) => {
    const commentId = c.req.param('commentId')
    const comment = state.comments.find(x => x.id === commentId)
    if (!comment) return c.json({ error: 'not_found' }, 404)
    comment.isResolved = true
    return c.json({ ok: true, is_resolved: true })
  })

  /* ---------- 活动 ---------- */

  app.get('/v1/collab/projects/:projectId/activity', (c) => {
    const projectId = c.req.param('projectId')
    const limit = Math.min(Number(c.req.query('limit') ?? 30), 100)
    const since = c.req.query('since')
    let rows = state.activities.filter(x => x.projectId === projectId)
    if (since) rows = rows.filter(x => x.createdAt > since)
    rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    return c.json({ list: rows, count: rows.length })
  })

  /* ---------- 通知 ---------- */

  app.get('/v1/collab/notifications', (c) => {
    const userId = c.req.query('userId') ?? ''
    if (!userId) return c.json({ error: 'bad_request' }, 400)
    const unreadOnly = c.req.query('unreadOnly') === 'true'
    let rows = state.notifications.filter(x => x.userId === userId)
    if (unreadOnly) rows = rows.filter(x => !x.readAt)
    rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const unread = state.notifications.filter(x => x.userId === userId && !x.readAt).length
    return c.json({ list: rows, unread_count: unread })
  })

  app.get('/v1/collab/notifications/unread-count', (c) => {
    const userId = c.req.query('userId') ?? ''
    const count = state.notifications.filter(x => x.userId === userId && !x.readAt).length
    return c.json({ count })
  })

  app.post('/v1/collab/notifications/:id/read', (c) => {
    const id = c.req.param('id')
    const n = state.notifications.find(x => x.id === id)
    if (!n) return c.json({ error: 'not_found' }, 404)
    n.readAt = new Date().toISOString()
    return c.json({ ok: true })
  })

  app.post('/v1/collab/notifications/read-all', (c) => {
    const userId = c.req.query('userId') ?? ''
    let n = 0
    for (const x of state.notifications) {
      if (x.userId === userId && !x.readAt) {
        x.readAt = new Date().toISOString()
        n++
      }
    }
    return c.json({ marked: n })
  })

  return app
}
