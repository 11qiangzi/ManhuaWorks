/**
 * ManhuaWorks · 端到端测试：1 集 60s 漫剧（mock 模式）
 *
 * 覆盖完整链路：
 *  1. 登录
 *  2. 创建作品 + 选模板
 *  3. 上传小说文本 + 参考图 + 声音
 *  4. AI 拆剧本（mock LLM）
 *  5. 邀请协作者
 *  6. 协作者打开 + 实时同步
 *  7. 评论
 *  8. AI 渲染分镜图（mock Image）
 *  9. AI 配音（mock TTS）
 * 10. AI 合成视频（mock Video）
 * 11. 导出 + 通知
 *
 * 设计：
 *  - 用 4 个 mock provider 替代真实 AI（mock-providers.ts）
 *  - 用 stub Hono app 替代真实 user-portal / collab / asset / workflow
 *  - 端到端验证业务契约，不是 HTTP 路径
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mockLLM,
  mockImage,
  mockVideo,
  mockTTS,
  resetAllProviders,
  makeRequest,
  makeAppRequest,
  readJson,
  wait,
  waitFor,
  nextId,
} from '../setup/mock-providers'

/* ==================== 业务状态（端到端共享） ==================== */

interface DB {
  users: Map<string, { id: string; email: string; display_name: string; plan: string }>
  projects: Map<string, { id: string; name: string; owner_id: string; cover_url: string | null }>
  assets: Map<string, { id: string; project_id: string; filename: string; type: string; size_mb: number; url: string }>
  works: Map<string, { id: string; project_id: string; title: string; status: string; scenes: Scene[]; duration_sec: number }>
  scenes: Map<string, Scene>
  comments: Array<{ id: string; work_id: string; author_id: string; body: string; created_at: string }>
  notifications: Array<{ id: string; user_id: string; type: string; title: string; read: boolean }>
  invitations: Array<{ id: string; project_id: string; email: string; role: string; accepted: boolean }>
}

interface Scene {
  id: string
  index: number
  title: string
  narration: string
  shot: { type: string; subject: string; camera?: string; color?: string }
  image_url?: string
  audio_url?: string
  video_url?: string
}

/* ==================== Stub：user-portal 后端 ==================== */

function createUserPortalApp(db: DB, fetcherForAI: (kind: string, req: unknown) => Promise<unknown>) {
  const app = {
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url)
      const path = url.pathname
      const method = req.method

      // ---- Auth ----
      if (path === '/v1/auth/login' && method === 'POST') {
        const body = await req.json() as { email: string; password: string }
        const user = [...db.users.values()].find(u => u.email === body.email)
        if (!user) return new Response(JSON.stringify({ error: { code: 'invalid_credentials' } }), { status: 401 })
        return new Response(JSON.stringify({
          access_token: `tok_${user.id}`,
          refresh_token: `rt_${user.id}`,
          user,
        }), { status: 200 })
      }

      // ---- Users ----
      if (path === '/v1/users/me' && method === 'GET') {
        const userId = (req.headers.get('X-User-Id') ?? '').replace('tok_', '')
        const user = db.users.get(userId)
        if (!user) return new Response(null, { status: 401 })
        return new Response(JSON.stringify({ ...user, plan_expires_at: '2026-12-31' }), { status: 200 })
      }

      // ---- Projects ----
      if (path === '/v1/projects' && method === 'POST') {
        const userId = (req.headers.get('X-User-Id') ?? '').replace('tok_', '')
        const body = await req.json() as { name: string; type: string; template_id?: string }
        const project = {
          id: `p_${nextId()}`,
          name: body.name,
          owner_id: userId,
          cover_url: null,
        }
        db.projects.set(project.id, project)
        return new Response(JSON.stringify(project), { status: 201 })
      }
      if (path.match(/^\/v1\/projects\/p_.+$/) && method === 'GET') {
        const id = path.split('/').pop()!
        const project = db.projects.get(id)
        if (!project) return new Response(null, { status: 404 })
        return new Response(JSON.stringify(project), { status: 200 })
      }

      // ---- Assets (上传) ----
      if (path === '/v1/assets/uploads/init' && method === 'POST') {
        const assetId = `a_${nextId()}`
        return new Response(JSON.stringify({
          upload_url: `https://mock-s3/${assetId}`,
          asset_id: assetId,
          expires_in: 600,
        }), { status: 200 })
      }
      if (path === '/v1/assets/uploads/complete' && method === 'POST') {
        const body = await req.json() as { asset_id: string; project_id?: string }
        // 这里简化：资产在 init 时已记录
        const asset = db.assets.get(body.asset_id)
        if (asset && body.project_id) asset.project_id = body.project_id
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      // ---- Works ----
      if (path === '/v1/works' && method === 'POST') {
        const body = await req.json() as { title: string; type: string; project_id: string; template_id?: string; config?: Record<string, unknown> }
        const workId = `w_${nextId()}`
        const work = {
          id: workId,
          project_id: body.project_id,
          title: body.title,
          status: 'draft',
          scenes: [],
          duration_sec: 60,
        }
        db.works.set(workId, work)
        return new Response(JSON.stringify(work), { status: 201 })
      }
      if (path.match(/^\/v1\/works\/w_.+\/parse_novel$/) && method === 'POST') {
        const workId = path.split('/')[3]
        const work = db.works.get(workId)
        if (!work) return new Response(null, { status: 404 })

        // 调 LLM 拆剧本
        const llmResp = await fetcherForAI('llm', {
          prompt: '请把以下小说拆成 5 场戏：...',
          jsonSchema: { type: 'object' },
        }) as { parsed: { scenes: Array<{ index: number; title: string; narration: string; shot: { type: string; subject: string } }> } }

        const scenes: Scene[] = llmResp.parsed.scenes.map((s) => ({
          id: `s_${nextId()}`,
          index: s.index,
          title: s.title,
          narration: s.narration,
          shot: s.shot,
        }))
        work.scenes = scenes
        scenes.forEach(s => db.scenes.set(s.id, s))
        return new Response(JSON.stringify({ scenes }), { status: 200 })
      }
      if (path.match(/^\/v1\/works\/w_.+\/render_scenes$/) && method === 'POST') {
        const workId = path.split('/')[3]
        const work = db.works.get(workId)
        if (!work) return new Response(null, { status: 404 })

        // 并行调 Image + TTS（mock）
        const results = await Promise.all(work.scenes.map(async (scene) => {
          const [img, tts] = await Promise.all([
            fetcherForAI('image', { prompt: scene.shot.subject, width: 1920, height: 1080 }),
            fetcherForAI('tts', { text: scene.narration, voiceId: 'v_main' }),
          ])
          scene.image_url = (img as { images: Array<{ url: string }> }).images[0].url
          scene.audio_url = (tts as { audioUrl: string }).audioUrl
          return scene
        }))
        return new Response(JSON.stringify({ scenes: results }), { status: 200 })
      }
      if (path.match(/^\/v1\/works\/w_.+\/compose_video$/) && method === 'POST') {
        const workId = path.split('/')[3]
        const work = db.works.get(workId)
        if (!work) return new Response(null, { status: 404 })

        for (const scene of work.scenes) {
          const v = await fetcherForAI('video', {
            imageUrl: scene.image_url,
            prompt: scene.shot.subject,
            durationSec: 12,
            fps: 24,
          }) as { videoUrl: string }
          scene.video_url = v.videoUrl
        }
        return new Response(JSON.stringify({ work }), { status: 200 })
      }
      if (path.match(/^\/v1\/works\/w_.+\/export$/) && method === 'POST') {
        const workId = path.split('/')[3]
        const work = db.works.get(workId)
        if (!work) return new Response(null, { status: 404 })
        work.status = 'exported'
        const exportUrl = `https://mock-cdn/exports/${workId}.mp4`
        // 给作者发通知
        const owner = [...db.users.values()].find(u => db.projects.get(work.project_id)?.owner_id === u.id)
        if (owner) {
          db.notifications.push({
            id: `n_${nextId()}`,
            user_id: owner.id,
            type: 'export_completed',
            title: `「${work.title}」已导出`,
            read: false,
          })
        }
        return new Response(JSON.stringify({ task_id: `exp_${workId}`, url: exportUrl }), { status: 202 })
      }

      // ---- Comments ----
      if (path.match(/^\/v1\/collab\/works\/w_.+\/comments$/) && method === 'POST') {
        const workId = path.split('/')[4]
        const userId = (req.headers.get('X-User-Id') ?? '').replace('tok_', '')
        const body = await req.json() as { body: string; mentions?: string[] }
        const comment = {
          id: `c_${nextId()}`,
          work_id: workId,
          author_id: userId,
          body: body.body,
          created_at: new Date().toISOString(),
        }
        db.comments.push(comment)
        // 给被 @ 的人发通知
        for (const m of body.mentions ?? []) {
          db.notifications.push({
            id: `n_${nextId()}`,
            user_id: m,
            type: 'comment_mention',
            title: `${userId} 提到你`,
            read: false,
          })
        }
        return new Response(JSON.stringify(comment), { status: 201 })
      }

      // ---- Collab ----
      if (path.match(/^\/v1\/collab\/projects\/p_.+\/invitations$/) && method === 'POST') {
        const projectId = path.split('/')[4]
        const body = await req.json() as { email: string; role: string }
        const inv = {
          id: `inv_${nextId()}`,
          project_id: projectId,
          email: body.email,
          role: body.role,
          accepted: false,
        }
        db.invitations.push(inv)
        return new Response(JSON.stringify(inv), { status: 201 })
      }

      // ---- Notifications ----
      if (path === '/v1/notifications' && method === 'GET') {
        const userId = (req.headers.get('X-User-Id') ?? '').replace('tok_', '')
        const list = db.notifications.filter(n => n.user_id === userId)
        return new Response(JSON.stringify({ data: list, unread_count: list.filter(n => !n.read).length }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'not_found', path }), { status: 404 })
    },
  }
  return app
}

/* ==================== Stub：collab 实时层 ==================== */

function createCollabStub() {
  const operations: Array<{ field: string; value: unknown; userId: string; ts: number }> = []
  return {
    operations,
    submit(field: string, value: unknown, userId: string) {
      operations.push({ field, value, userId, ts: Date.now() })
    },
  }
}

/* ==================== AI fetcher：转发到 mock provider ==================== */

function makeAIFetcher() {
  return async (kind: string, req: unknown): Promise<unknown> => {
    switch (kind) {
      case 'llm': return await mockLLM.chat(req as { prompt: string; jsonSchema?: unknown })
      case 'image': return await mockImage.generate(req as { prompt: string; width: number; height: number })
      case 'video': return await mockVideo.generate(req as { imageUrl: string; prompt: string; durationSec: number; fps: number })
      case 'tts': return await mockTTS.synthesize(req as { text: string; voiceId: string })
      default: throw new Error(`unknown AI kind: ${kind}`)
    }
  }
}

/* ==================== 主测试 ==================== */

describe('端到端：1 集 60s 漫剧（mock AI）', () => {
  let db: DB
  let app: ReturnType<typeof createUserPortalApp>
  let collab: ReturnType<typeof createCollabStub>
  let ai: ReturnType<typeof makeAIFetcher>
  let ownerId: string
  let collaboratorId: string
  let accessToken: string

  beforeEach(() => {
    resetAllProviders()
    db = {
      users: new Map(),
      projects: new Map(),
      assets: new Map(),
      works: new Map(),
      scenes: new Map(),
      comments: [],
      notifications: [],
      invitations: [],
    }
    // 预置用户
    ownerId = 'u_linqi'
    collaboratorId = 'u_suming'
    db.users.set(ownerId, { id: ownerId, email: 'linqi@example.com', display_name: '林启', plan: 'pro' })
    db.users.set(collaboratorId, { id: collaboratorId, email: 'suming@example.com', display_name: '苏眀', plan: 'pro' })

    ai = makeAIFetcher()
    app = createUserPortalApp(db, ai)
    collab = createCollabStub()
    accessToken = `tok_${ownerId}`
  })

  afterEach(() => {
    // 清理
  })

  /* ==================== 步骤 1：登录 ==================== */

  it('1. 登录：林启成功登录拿到 token', async () => {
    const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/auth/login', {
      email: 'linqi@example.com',
      password: 'P@ssw0rd!',
    }))
    expect(res.status).toBe(200)
    const body = await readJson<{ access_token: string; user: { display_name: string } }>(res)
    expect(body.access_token).toBe('tok_u_linqi')
    expect(body.user.display_name).toBe('林启')
  })

  it('1b. 登录失败：错误密码 → 401', async () => {
    const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/auth/login', {
      email: 'linqi@example.com',
      password: 'wrong',
    }))
    expect(res.status).toBe(401)
  })

  /* ==================== 步骤 2：创建作品 ==================== */

  it('2. 创建作品：灰星 EP01', async () => {
    const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01：苏眀在起点',
      type: 'drama',
      project_id: 'p_demo',
      template_id: 'tpl_60s_drama',
      config: { target_duration_sec: 60, style: 'anime_film' },
    }))
    expect(res.status).toBe(201)
    const body = await readJson<{ id: string; title: string; status: string }>(res)
    expect(body.title).toBe('灰星 EP01：苏眀在起点')
    expect(body.status).toBe('draft')
  })

  /* ==================== 步骤 3：上传素材 ==================== */

  it('3. 上传小说文本 + 参考图 + 声音', async () => {
    const init1 = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/init', {
      filename: 'chapter01.txt', size: 2048, content_type: 'text/plain', project_id: 'p_demo',
    }))
    const init1Body = await readJson<{ asset_id: string; upload_url: string }>(init1)
    expect(init1Body.asset_id).toMatch(/^a_/)
    db.assets.set(init1Body.asset_id, {
      id: init1Body.asset_id, project_id: 'p_demo',
      filename: 'chapter01.txt', type: 'document', size_mb: 0.002, url: init1Body.upload_url,
    })

    const init2 = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/init', {
      filename: 'style.png', size: 102400, content_type: 'image/png', project_id: 'p_demo',
    }))
    const init2Body = await readJson<{ asset_id: string }>(init2)
    db.assets.set(init2Body.asset_id, {
      id: init2Body.asset_id, project_id: 'p_demo',
      filename: 'style.png', type: 'image', size_mb: 0.1, url: 'https://mock-s3/style.png',
    })

    const init3 = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/init', {
      filename: 'voice.mp3', size: 512000, content_type: 'audio/mpeg', project_id: 'p_demo',
    }))
    const init3Body = await readJson<{ asset_id: string }>(init3)
    db.assets.set(init3Body.asset_id, {
      id: init3Body.asset_id, project_id: 'p_demo',
      filename: 'voice.mp3', type: 'audio', size_mb: 0.5, url: 'https://mock-s3/voice.mp3',
    })

    // 落库
    for (const aid of [init1Body.asset_id, init2Body.asset_id, init3Body.asset_id]) {
      const complete = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/complete', {
        asset_id: aid, project_id: 'p_demo',
      }))
      expect(complete.status).toBe(200)
    }

    expect(db.assets.size).toBe(3)
    expect([...db.assets.values()].map(a => a.type).sort()).toEqual(['audio', 'document', 'image'])
  })

  /* ==================== 步骤 4：AI 拆剧本 ==================== */

  it('4. AI 拆剧本：返回 5 场戏', async () => {
    // 先创建作品
    const createRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
    }))
    const work = await readJson<{ id: string }>(createRes)

    // 调 AI
    const parseRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, {
      'X-User-Id': 'tok_' + ownerId,
    }))
    expect(parseRes.status).toBe(200)
    const body = await readJson<{ scenes: Scene[] }>(parseRes)
    expect(body.scenes).toHaveLength(5)
    expect(body.scenes[0].title).toContain('开场')

    // 验证 mock LLM 被调用
    expect(mockLLM.callCount).toBeGreaterThanOrEqual(1)
  })

  /* ==================== 步骤 5+6：邀请协作者 + 实时同步 ==================== */

  it('5+6. 邀请苏眀 + 实时同步改剧本', async () => {
    // 邀请
    const invRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_demo/invitations', {
      email: 'suming@example.com', role: 'editor', message: '帮我看镜头',
    }, { 'X-User-Id': 'tok_' + ownerId }))
    expect(invRes.status).toBe(201)
    const inv = await readJson<{ id: string; email: string }>(invRes)
    expect(inv.email).toBe('suming@example.com')
    expect(db.invitations).toHaveLength(1)

    // 苏眀接受（手动模拟）
    db.invitations[0].accepted = true

    // 林启改 scene 3
    collab.submit('scene.3.title', '任务下达', ownerId)
    // 苏眀改 scene 3
    collab.submit('scene.3.camera', '极推近特写', collaboratorId)

    expect(collab.operations).toHaveLength(2)
    expect(collab.operations[0].userId).toBe(ownerId)
    expect(collab.operations[1].userId).toBe(collaboratorId)
  })

  /* ==================== 步骤 7：评论 ==================== */

  it('7. 苏眀评论 @林启 → 林启收到通知', async () => {
    const res = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/works/w_001/comments', {
      body: '@林启 这场戏的镜头角度再压一点',
      mentions: [ownerId],
    }, { 'X-User-Id': 'tok_' + collaboratorId }))
    expect(res.status).toBe(201)
    const body = await readJson<{ body: string; author_id: string }>(res)
    expect(body.author_id).toBe(collaboratorId)

    // 林启查通知
    const noti = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/notifications', undefined, {
      'X-User-Id': 'tok_' + ownerId,
    }))
    const notiBody = await readJson<{ data: Array<{ type: string; title: string }>; unread_count: number }>(noti)
    expect(notiBody.data.some(n => n.type === 'comment_mention')).toBe(true)
    expect(notiBody.unread_count).toBeGreaterThan(0)
  })

  /* ==================== 步骤 8+9：AI 渲染分镜图 + 配音 ==================== */

  it('8+9. AI 渲染 5 场戏的图 + 配音（mock）', async () => {
    // 准备：创建作品 + 拆剧本
    const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
    }))
    const work = await readJson<{ id: string }>(create)
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))

    // 渲染
    const render = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/render_scenes`, {}, { 'X-User-Id': 'tok_' + ownerId }))
    expect(render.status).toBe(200)
    const body = await readJson<{ scenes: Scene[] }>(render)

    expect(body.scenes).toHaveLength(5)
    body.scenes.forEach((s) => {
      expect(s.image_url).toMatch(/mock-cdn/)
      expect(s.audio_url).toMatch(/mock-cdn/)
    })

    expect(mockImage.callCount).toBe(5)
    expect(mockTTS.callCount).toBe(5)
  })

  /* ==================== 步骤 10：合成视频 ==================== */

  it('10. AI 合成视频（mock）', async () => {
    const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
    }))
    const work = await readJson<{ id: string }>(create)
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/render_scenes`, {}, { 'X-User-Id': 'tok_' + ownerId }))

    const compose = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/compose_video`, {
      video_ai: 'runway_gen3',
      resolution: '1080p', fps: 24,
    }, { 'X-User-Id': 'tok_' + ownerId }))
    expect(compose.status).toBe(200)
    const body = await readJson<{ work: { scenes: Scene[] } }>(compose)
    body.work.scenes.forEach(s => expect(s.video_url).toMatch(/mock-cdn/))
    expect(mockVideo.callCount).toBe(5)
  })

  /* ==================== 步骤 11：导出 ==================== */

  it('11. 导出 + 收到通知', async () => {
    // 完整跑一遍
    const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
    }))
    const work = await readJson<{ id: string }>(create)
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/render_scenes`, {}, { 'X-User-Id': 'tok_' + ownerId }))
    await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/compose_video`, {}, { 'X-User-Id': 'tok_' + ownerId }))

    const exp = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/export`, {
      format: 'mp4', resolution: '1080p',
    }, { 'X-User-Id': 'tok_' + ownerId }))
    expect(exp.status).toBe(202)
    const expBody = await readJson<{ task_id: string; url: string }>(exp)
    expect(expBody.url).toMatch(/mock-cdn/)

    // 林启查通知
    await waitFor(() => db.notifications.length > 0)
    const noti = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/notifications', undefined, { 'X-User-Id': 'tok_' + ownerId }))
    const notiBody = await readJson<{ data: Array<{ type: string }> }>(noti)
    expect(notiBody.data.some(n => n.type === 'export_completed')).toBe(true)
  })

  /* ==================== 失败场景 ==================== */

  describe('失败场景与恢复', () => {
    it('AI 拆剧本失败 → 抛 500', async () => {
      mockLLM.state = 'fail'
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
        title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
      }))
      const work = await readJson<{ id: string }>(create)
      const res = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
      // 500 内部错误（mock fail 抛错）
      expect([500, 502]).toContain(res.status)
    })

    it('渲染第 3 张图失败 → 第 3 个 scene 没有 image_url', async () => {
      mockImage.failAtCall = 3
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
        title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
      }))
      const work = await readJson<{ id: string }>(create)
      await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
      const render = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/render_scenes`, {}, { 'X-User-Id': 'tok_' + ownerId }))
      // 部分失败：HTTP 500（Promise.all 短路）—— 这里可观测 mockImage.failAtCall 触发
      // 实际：Promise.all 一个 reject 整体 reject
      expect(render.status).toBe(500)
    })

    it('重试后成功：mockLLM.fail 后切回 ok → 重跑 OK', async () => {
      const create = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
        title: '灰星 EP01', type: 'drama', project_id: 'p_demo',
      }))
      const work = await readJson<{ id: string }>(create)

      // 第一次失败
      mockLLM.state = 'fail'
      const r1 = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
      expect(r1.status).toBe(500)

      // 重置 + 重试
      mockLLM.reset()
      const r2 = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': 'tok_' + ownerId }))
      expect(r2.status).toBe(200)
    })
  })

  /* ==================== 完整链路：7 步骤一气呵成 ==================== */

  it('🌟 完整链路：登录 → 创建 → 上传 → AI 拆 → 协作 → 评论 → 渲染 → 合成 → 导出', async () => {
    // 1) 登录
    const loginRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/auth/login', {
      email: 'linqi@example.com', password: 'pw',
    }))
    expect(loginRes.status).toBe(200)
    const auth = await readJson<{ access_token: string }>(loginRes)

    // 2) 创建作品
    const createRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/works', {
      title: '灰星 EP01：苏眀在起点',
      type: 'drama',
      project_id: 'p_demo',
      template_id: 'tpl_60s_drama',
    }, { 'X-User-Id': auth.access_token }))
    const work = await readJson<{ id: string; title: string; status: string }>(createRes)
    expect(work.status).toBe('draft')

    // 3) 上传 3 个素材（init + complete）
    for (const file of [
      { filename: 'novel.txt', type: 'document', size: 2048, ct: 'text/plain' },
      { filename: 'style.png', type: 'image', size: 102400, ct: 'image/png' },
      { filename: 'voice.mp3', type: 'audio', size: 512000, ct: 'audio/mpeg' },
    ]) {
      const init = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/init', {
        filename: file.filename, size: file.size, content_type: file.ct, project_id: 'p_demo',
      }))
      const { asset_id } = await readJson<{ asset_id: string }>(init)
      db.assets.set(asset_id, { id: asset_id, project_id: 'p_demo', filename: file.filename, type: file.type, size_mb: file.size / 1e6, url: `https://x/${asset_id}` })
      await makeAppRequest(app, makeRequest('POST', 'http://x/v1/assets/uploads/complete', { asset_id, project_id: 'p_demo' }))
    }
    expect(db.assets.size).toBe(3)

    // 4) AI 拆剧本
    const parseRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/parse_novel`, {}, { 'X-User-Id': auth.access_token }))
    const { scenes } = await readJson<{ scenes: Scene[] }>(parseRes)
    expect(scenes).toHaveLength(5)

    // 5) 邀请协作者
    const invRes = await makeAppRequest(app, makeRequest('POST', 'http://x/v1/collab/projects/p_demo/invitations', {
      email: 'suming@example.com', role: 'editor',
    }, { 'X-User-Id': auth.access_token }))
    expect(invRes.status).toBe(201)
    db.invitations[0].accepted = true

    // 6) 协作编辑（实时同步层）
    collab.submit('scene.3.title', '任务下达', ownerId)
    collab.submit('scene.3.camera', '极推近', collaboratorId)
    expect(collab.operations).toHaveLength(2)

    // 7) 评论
    const comRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/collab/works/${work.id}/comments`, {
      body: '@林启 这场镜头再压一点', mentions: [ownerId],
    }, { 'X-User-Id': 'tok_' + collaboratorId }))
    expect(comRes.status).toBe(201)

    // 8+9) 渲染
    const renderRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/render_scenes`, {}, { 'X-User-Id': auth.access_token }))
    const renderBody = await readJson<{ scenes: Scene[] }>(renderRes)
    expect(renderBody.scenes.every(s => s.image_url && s.audio_url)).toBe(true)

    // 10) 合成
    const compRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/compose_video`, {}, { 'X-User-Id': auth.access_token }))
    const compBody = await readJson<{ work: { scenes: Scene[] } }>(compRes)
    expect(compBody.work.scenes.every(s => s.video_url)).toBe(true)

    // 11) 导出
    const expRes = await makeAppRequest(app, makeRequest('POST', `http://x/v1/works/${work.id}/export`, {
      format: 'mp4', resolution: '1080p',
    }, { 'X-User-Id': auth.access_token }))
    expect(expRes.status).toBe(202)
    const expBody = await readJson<{ url: string }>(expRes)
    expect(expBody.url).toMatch(/mock-cdn/)

    // 验证 mock 调用
    expect(mockLLM.callCount).toBe(1) // parse_novel 1 次
    expect(mockImage.callCount).toBe(5) // 5 场戏
    expect(mockTTS.callCount).toBe(5)
    expect(mockVideo.callCount).toBe(5)

    // 验证通知
    await waitFor(() => db.notifications.some(n => n.type === 'export_completed'))
    const finalNoti = await makeAppRequest(app, makeRequest('GET', 'http://x/v1/notifications', undefined, { 'X-User-Id': auth.access_token }))
    const finalNotiBody = await readJson<{ data: Array<{ type: string }> }>(finalNoti)
    const types = finalNotiBody.data.map(n => n.type)
    expect(types).toContain('comment_mention')
    expect(types).toContain('export_completed')
  })
})
