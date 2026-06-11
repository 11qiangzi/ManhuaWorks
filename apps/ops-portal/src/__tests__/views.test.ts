/**
 * ops-portal 业务总后台测试
 * ManhuaWorks · M1-W4 · L4-B
 *
 * 10 测试覆盖:
 *   1. router 注册 /dashboard + /users
 *   2. router / → /dashboard 重定向
 *   3. mock-data 5 KPI 字段
 *   4. revenueSeries 长度 = 7
 *   5. userList 长度 = 50
 *   6. providerUsage 5 项
 *   7. projectStatus 6 状态
 *   8. recentOps 长度 = 10
 *   9. provider 全部命中已知 5 个
 *  10. user status 4 种
 */
import { describe, it, expect } from 'vitest'
import { router } from '@/router'
import {
  dashboardKpi,
  revenueSeries,
  providerUsage,
  projectStatus,
  recentOps,
  userList
} from '@/api/mock-data'

describe('ops-portal router', () => {
  it('注册 /dashboard + /users 两条路由', () => {
    const names = router.getRoutes().map(r => r.path)
    expect(names).toContain('/dashboard')
    expect(names).toContain('/users')
  })

  it('/ 重定向到 /dashboard', () => {
    const root = router.getRoutes().find(r => r.path === '/')
    expect(root).toBeDefined()
    expect(root!.redirect).toBe('/dashboard')
  })
})

describe('mock-data · 大盘', () => {
  it('dashboardKpi 5 字段', () => {
    expect(dashboardKpi).toHaveProperty('totalUsers')
    expect(dashboardKpi).toHaveProperty('active7d')
    expect(dashboardKpi).toHaveProperty('totalProjects')
    expect(dashboardKpi).toHaveProperty('totalWorks')
    expect(dashboardKpi).toHaveProperty('newToday')
  })

  it('revenueSeries 长度 = 7', () => {
    expect(revenueSeries).toHaveLength(7)
    for (const p of revenueSeries) {
      expect(typeof p.date).toBe('string')
      expect(typeof p.value).toBe('number')
    }
  })

  it('providerUsage 5 项 (openai/anthropic/google/deepseek/minimax)', () => {
    expect(providerUsage).toHaveLength(5)
    const ids = providerUsage.map(p => p.provider)
    expect(ids).toEqual(['openai', 'anthropic', 'google', 'deepseek', 'minimax'])
    for (const p of providerUsage) {
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.used).toBeGreaterThan(0)
    }
  })

  it('projectStatus 6 状态', () => {
    expect(projectStatus).toHaveLength(6)
    const ids = projectStatus.map(s => s.status)
    expect(ids).toEqual(['draft', 'running', 'reviewing', 'published', 'archived', 'failed'])
  })

  it('recentOps 长度 = 10', () => {
    expect(recentOps).toHaveLength(10)
    for (const o of recentOps) {
      expect(o.who).toBeTruthy()
      expect(o.action).toBeTruthy()
      expect(typeof o.ts).toBe('number')
    }
  })
})

describe('mock-data · 用户', () => {
  it('userList 长度 = 50', () => {
    expect(userList).toHaveLength(50)
    for (const u of userList) {
      expect(u.id).toMatch(/^user_/)
      expect(u.email).toContain('@')
      expect(['openai', 'anthropic', 'google', 'deepseek', 'minimax']).toContain(u.provider)
      expect(['active', 'trial', 'paused', 'revoked']).toContain(u.status)
      expect(typeof u.credits).toBe('number')
      expect(typeof u.createdAt).toBe('number')
    }
  })

  it('所有 user 的 provider 都在 5 已知之列', () => {
    const allowed = new Set(['openai', 'anthropic', 'google', 'deepseek', 'minimax'])
    for (const u of userList) {
      expect(allowed.has(u.provider)).toBe(true)
    }
  })

  it('所有 user 的 status 都在 4 已知之列', () => {
    const allowed = new Set(['active', 'trial', 'paused', 'revoked'])
    for (const u of userList) {
      expect(allowed.has(u.status)).toBe(true)
    }
  })
})
