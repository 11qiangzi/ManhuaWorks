/**
 * user-portal · 组合式 API 单测
 *
 * 覆盖：useUser / useProjects / useWorks / useAssetLibrary
 *
 * 策略：
 *  - mock fetcher（避免真实网络）
 *  - 覆盖正常流程、错误流程、computed 联动
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useUser,
  useProjects,
  useWorks,
  useAssetLibrary,
  type Fetcher,
} from './stubs/composables'
import {
  makeRequest,
  makeAppRequest,
  readJson,
  nextId,
} from '../setup/mock-providers'
import type { User, Project, Work, LibraryView, Asset } from './fixtures/types'

/* ==================== 测试夹具 ==================== */

function makeUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: 'u_123',
    email: 'linqi@example.com',
    display_name: '林启',
    avatar_url: 'https://cdn.example.com/a.png',
    bio: '前考古助理',
    plan: 'pro',
    plan_expires_at: '2026-12-31T23:59:59+08:00',
    created_at: '2025-08-12T10:30:00+08:00',
    stats: { projects: 18, works: 7, assets: 432, collaborators: 12 },
    ...overrides,
  }
}

function makeProjectFixture(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId('p'),
    name: '灰星 1500 章',
    cover_url: null,
    type: 'novel',
    asset_count: 0,
    member_count: 1,
    last_opened_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeWorkFixture(overrides: Partial<Work> = {}): Work {
  return {
    id: nextId('w'),
    title: '灰星 EP01',
    type: 'drama',
    cover_url: null,
    duration_sec: 60,
    status: 'draft',
    project_id: 'p_456',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/* ==================== useUser ==================== */

describe('useUser', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = vi.fn(async (url: string) => {
      if (url === '/v1/users/me') {
        return new Response(JSON.stringify(makeUserFixture()), { status: 200 })
      }
      if (url === '/v1/users/me/usage') {
        return new Response(JSON.stringify({
          storage: { used_mb: 2840, limit_mb: 51200, percent: 5.5 },
          ai_tokens: { used: 124000, limit: 1000000, percent: 12.4 },
          exports: { used: 4, limit: 50 },
          bandwidth_mb: { used: 120, limit: 10240 },
        }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as Fetcher
  })

  it('fetchMe 拉取用户信息', async () => {
    const u = useUser({ fetcher })
    expect(u.me.value).toBeNull()
    await u.fetchMe()
    expect(u.me.value?.display_name).toBe('林启')
    expect(u.isLoading.value).toBe(false)
  })

  it('isPro 在 plan=pro 时为 true', async () => {
    const u = useUser({ fetcher })
    await u.fetchMe()
    expect(u.isPro.value).toBe(true)
  })

  it('isPro 在 plan=free 时为 false', async () => {
    fetcher = vi.fn(async () => new Response(JSON.stringify(makeUserFixture({ plan: 'free' })), { status: 200 })) as unknown as Fetcher
    const u = useUser({ fetcher })
    await u.fetchMe()
    expect(u.isPro.value).toBe(false)
  })

  it('fetchMe 失败时记录 error', async () => {
    fetcher = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as Fetcher
    const u = useUser({ fetcher })
    await u.fetchMe()
    expect(u.error.value).toBeInstanceOf(Error)
    expect(u.error.value?.message).toContain('500')
  })

  it('fetchUsage 后 storagePercent 计算正确', async () => {
    const u = useUser({ fetcher })
    await u.fetchUsage()
    expect(u.usage.value?.storage.percent).toBe(5.5)
    expect(u.storagePercent.value).toBe(5.5)
  })

  it('updateProfile 走 PATCH', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify({ ...makeUserFixture(), display_name: '新名' }), { status: 200 })
      }
      return new Response(JSON.stringify(makeUserFixture()), { status: 200 })
    }) as unknown as Fetcher

    const u = useUser({ fetcher })
    await u.fetchMe()
    await u.updateProfile({ display_name: '新名', bio: '更新' })

    const patchCall = calls.find(c => c.init?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const body = JSON.parse(patchCall!.init!.body as string)
    expect(body.display_name).toBe('新名')
    expect(u.me.value?.display_name).toBe('新名')
  })

  it('updateProfile 在 me 未加载时抛错', async () => {
    const u = useUser({ fetcher })
    await expect(u.updateProfile({ display_name: 'x' })).rejects.toThrow('not loaded')
  })

  it('logout 清空 me + 调 logout 接口', async () => {
    const calls: string[] = []
    fetcher = vi.fn(async (url: string) => {
      calls.push(url)
      if (url === '/v1/users/me') return new Response(JSON.stringify(makeUserFixture()), { status: 200 })
      if (url === '/v1/users/me/usage') return new Response(JSON.stringify({
        storage: { used_mb: 0, limit_mb: 100, percent: 0 },
        ai_tokens: { used: 0, limit: 100, percent: 0 },
        exports: { used: 0, limit: 5 },
        bandwidth_mb: { used: 0, limit: 100 },
      }), { status: 200 })
      if (url === '/v1/auth/logout') return new Response(null, { status: 204 })
      return new Response('not found', { status: 404 })
    }) as unknown as Fetcher

    const u = useUser({ fetcher })
    await u.fetchMe()
    await u.fetchUsage()
    await u.logout()
    expect(u.me.value).toBeNull()
    expect(u.usage.value).toBeNull()
    expect(calls).toContain('/v1/auth/logout')
  })
})

/* ==================== useProjects ==================== */

describe('useProjects', () => {
  let mockProjects: Project[]
  let fetcher: Fetcher

  beforeEach(() => {
    mockProjects = [
      makeProjectFixture({ name: '灰星 1500 章' }),
      makeProjectFixture({ name: '星海 30 章' }),
    ]
    fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/v1/projects') && (!init || init.method === undefined || init.method === 'GET')) {
        return new Response(JSON.stringify({
          data: mockProjects,
          next_cursor: 'cur_1',
          has_more: true,
        }), { status: 200 })
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        return new Response(JSON.stringify({ ...makeProjectFixture(body), id: nextId('p') }), { status: 201 })
      }
      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as Fetcher
  })

  it('fetch 拉取列表 + 设置 cursor', async () => {
    const p = useProjects({ fetcher })
    await p.fetch()
    expect(p.list.value).toHaveLength(2)
    expect(p.cursor.value).toBe('cur_1')
    expect(p.hasMore.value).toBe(true)
  })

  it('create 把新项目加到列表头', async () => {
    const p = useProjects({ fetcher })
    await p.fetch()
    const before = p.list.value.length
    const created = await p.create({ name: '新项目', type: 'manga' })
    expect(created.name).toBe('新项目')
    expect(p.list.value).toHaveLength(before + 1)
    expect(p.list.value[0].id).toBe(created.id)
  })

  it('remove 把项目从列表中移除', async () => {
    const p = useProjects({ fetcher })
    await p.fetch()
    const targetId = p.list.value[0].id
    await p.remove(targetId)
    expect(p.list.value.find(x => x.id === targetId)).toBeUndefined()
  })

  it('fetch(reset=true) 清空再拉', async () => {
    const p = useProjects({ fetcher })
    await p.fetch()
    await p.create({ name: '新', type: 'novel' })
    expect(p.list.value.length).toBeGreaterThan(2)
    await p.fetch(true)
    expect(p.list.value).toHaveLength(2)
  })
})

/* ==================== useWorks ==================== */

describe('useWorks', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/v1/works' && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({
          data: [makeWorkFixture(), makeWorkFixture({ title: 'EP02' })],
          next_cursor: null,
          has_more: false,
        }), { status: 200 })
      }
      if (url === '/v1/works' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        return new Response(JSON.stringify(makeWorkFixture(body)), { status: 201 })
      }
      const exportMatch = url.match(/^\/v1\/works\/(.+)\/export$/)
      if (exportMatch && init?.method === 'POST') {
        return new Response(JSON.stringify({ task_id: 'exp_abc', estimated_sec: 45, status: 'queued' }), { status: 202 })
      }
      const dupMatch = url.match(/^\/v1\/works\/(.+)\/duplicate$/)
      if (dupMatch && init?.method === 'POST') {
        return new Response(JSON.stringify(makeWorkFixture({ id: nextId('w'), title: 'EP01 (副本)' })), { status: 201 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as Fetcher
  })

  it('fetch 拉取作品列表', async () => {
    const w = useWorks({ fetcher })
    await w.fetch()
    expect(w.list.value).toHaveLength(2)
  })

  it('create 返回完整 work 并加入列表', async () => {
    const w = useWorks({ fetcher })
    await w.fetch()
    const before = w.list.value.length
    const created = await w.create({ title: '新作品', type: 'drama', project_id: 'p_456' })
    expect(created.id).toBeDefined()
    expect(w.list.value.length).toBe(before + 1)
  })

  it('duplicate 不改变原列表，返回新 work', async () => {
    const w = useWorks({ fetcher })
    await w.fetch()
    const before = w.list.value.length
    const dup = await w.duplicate(w.list.value[0].id)
    expect(dup.title).toContain('副本')
    expect(w.list.value.length).toBe(before)
  })

  it('export 异步任务返回 task_id', async () => {
    const w = useWorks({ fetcher })
    await w.fetch()
    const task = await w.export(w.list.value[0].id, { format: 'mp4', resolution: '1080p' })
    expect(task.task_id).toBe('exp_abc')
  })
})

/* ==================== useAssetLibrary ==================== */

describe('useAssetLibrary', () => {
  let fetcher: Fetcher

  beforeEach(() => {
    const libView: LibraryView = {
      groups: [
        { type: 'image', count: 10, used_mb: 100 },
        { type: 'video', count: 2, used_mb: 200 },
        { type: 'audio', count: 5, used_mb: 5 },
      ],
      total: 17,
      total_mb: 305,
    }
    const assets: Asset[] = [
      { id: 'a_1', filename: 'a.png', type: 'image', size_mb: 2, url: 'https://x', thumbnail_url: null, project_id: 'p_1', created_at: '2026-01-01' },
      { id: 'a_2', filename: 'b.mp4', type: 'video', size_mb: 50, url: 'https://y', thumbnail_url: null, project_id: 'p_1', created_at: '2026-01-01' },
      { id: 'a_3', filename: 'c.mp3', type: 'audio', size_mb: 1, url: 'https://z', thumbnail_url: null, project_id: 'p_1', created_at: '2026-01-01' },
      { id: 'a_4', filename: 'd.png', type: 'image', size_mb: 3, url: 'https://w', thumbnail_url: null, project_id: null, created_at: '2026-01-01' },
    ]

    fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/v1/assets/library?group_by=type') {
        return new Response(JSON.stringify(libView), { status: 200 })
      }
      if (url.startsWith('/v1/assets?limit=')) {
        return new Response(JSON.stringify({ data: assets, next_cursor: null, has_more: false }), { status: 200 })
      }
      if (url === '/v1/assets/uploads/init' && init?.method === 'POST') {
        return new Response(JSON.stringify({ upload_url: 'https://s3/upload', asset_id: 'a_new', expires_in: 600 }), { status: 200 })
      }
      if (url === '/v1/assets/uploads/complete' && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      const delMatch = url.match(/^\/v1\/assets\/(.+)$/)
      if (delMatch && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as Fetcher
  })

  it('fetch 同时拉取 view 和 assets', async () => {
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    expect(a.view.value?.total).toBe(17)
    expect(a.assets.value).toHaveLength(4)
    expect(a.totalSizeMb.value).toBe(305)
  })

  it('byType computed 按 type 分组', async () => {
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    expect(a.byType.value.image).toHaveLength(2)
    expect(a.byType.value.video).toHaveLength(1)
    expect(a.byType.value.audio).toHaveLength(1)
  })

  it('upload 走 2 步协议（init + complete）', async () => {
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    const before = a.assets.value.length
    const asset = await a.upload({ name: 'new.png', size: 1024, type: 'image/png' }, 'p_1')
    expect(asset.id).toBe('a_new')
    expect(a.assets.value.length).toBe(before + 1)
  })

  it('upload 根据 mime 推断 type', async () => {
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    const videoAsset = await a.upload({ name: 'x.mp4', size: 1024, type: 'video/mp4' })
    expect(videoAsset.type).toBe('video')
  })

  it('remove 从列表中移除', async () => {
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    const before = a.assets.value.length
    await a.remove('a_1')
    expect(a.assets.value).toHaveLength(before - 1)
    expect(a.assets.value.find(x => x.id === 'a_1')).toBeUndefined()
  })

  it('fetch 失败时 error 被设置', async () => {
    fetcher = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as Fetcher
    const a = useAssetLibrary({ fetcher })
    await a.fetch()
    expect(a.error.value).toBeInstanceOf(Error)
  })
})
