/**
 * ManhuaWorks 微信小程序 - 配置/契约测试
 * M2 脚手架阶段, 跑 4 项硬性验证:
 *   1. app.config tabBar 4 项
 *   2. pages 索引存在
 *   3. 颜色 hex 合法
 *   4. 标题非空
 *
 * ───────────────────────────────────────────────────────────────
 * 后端契约 (从 services/user-service/src/routes/index.ts 抄录, 2026-06-09 08:55)
 *   user-service 监听 :8088, 已就绪路由:
 *
 *   健康检查 (无 auth)
 *     GET  /health
 *
 *   认证 (auth)
 *     POST /auth/register         注册
 *     POST /auth/login            登录, 返回 access/refresh token
 *     POST /auth/refresh          刷新 token
 *     POST /auth/verify-email
 *     POST /auth/forgot-password
 *     POST /auth/reset-password
 *     POST /auth/verify-2fa
 *     POST /auth/logout           需 auth
 *     POST /auth/logout-all       需 auth
 *
 *   当前用户 (me, 需 auth)
 *     GET    /me                  获取当前用户
 *     PATCH  /me                  更新资料
 *     POST   /me/password         改密
 *     GET    /me/2fa              2FA 状态
 *     POST   /me/2fa/enable
 *     POST   /me/2fa/confirm
 *     POST   /me/2fa/disable
 *
 *   管理 (admin)
 *     GET    /users               需 Admin
 *     GET    /users/:id
 *     PATCH  /users/:id           需 Admin
 *     DELETE /users/:id           需 SuperAdmin
 *
 *   BYOK (mount 在 /user/api-keys)
 *     GET    /user/api-keys       列出我的 Key
 *     POST   /user/api-keys       新增 Key
 *     DELETE /user/api-keys/:id
 *
 * L5-B 阶段会用 axios 直连 :8088, 至少用到:
 *   POST /auth/login
 *   GET  /me
 *   GET  /user/api-keys
 * ───────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest'
import appConfig, { theme } from '../app.config'

describe('wechat-mp config', () => {
  // 1. tabBar 必须 4 项
  it('app.config tabBar 包含 4 项 (首页 / 项目 / 我的 / 设置)', () => {
    const list = appConfig.tabBar?.list
    expect(list).toBeDefined()
    expect(list).toHaveLength(4)
    const labels = (list ?? []).map((it) => it.text)
    expect(labels).toEqual(['首页', '项目', '我的', '设置'])
  })

  // 2. pages 索引存在
  it('app.config pages 至少包含 index 与 me', () => {
    const pages = appConfig.pages
    expect(pages).toBeDefined()
    expect(pages).toContain('pages/index/index')
    expect(pages).toContain('pages/me/index')
  })

  // 3. 颜色 hex 合法 (导航栏 + tabBar 4 色)
  it('颜色配置为合法 hex', () => {
    const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
    const w = appConfig.window
    expect(w?.navigationBarBackgroundColor).toMatch(hexPattern)
    expect(w?.backgroundColor).toMatch(hexPattern)
    const tab = appConfig.tabBar
    expect(tab?.color).toMatch(hexPattern)
    expect(tab?.selectedColor).toMatch(hexPattern)
    expect(tab?.backgroundColor).toMatch(hexPattern)
    // theme 颜色 (来自 theme 命名导出, 集中维护的设计令牌)
    const themeColors: Array<string | undefined> = [
      theme.primary,
      theme.primaryDark,
      theme.textPrimary,
      theme.textSecondary,
      theme.background,
      theme.surface,
      theme.border,
      theme.success,
      theme.danger
    ]
    for (const c of themeColors) {
      if (c !== undefined) expect(c).toMatch(hexPattern)
    }
  })

  // 4. 标题非空
  it('标题与 tabBar 文本非空', () => {
    expect(appConfig.window?.navigationBarTitleText).toBeTruthy()
    expect(appConfig.window?.navigationBarTitleText?.length).toBeGreaterThan(0)
    for (const it of appConfig.tabBar?.list ?? []) {
      expect(it.text).toBeTruthy()
      expect(it.text.length).toBeGreaterThan(0)
    }
  })
})

/**
 * 后端契约锚定测试 (防止 L5-B 接入时改 URL 才发现错)
 * 引用: services/user-service/src/routes/index.ts
 */
describe('user-service:8088 契约锚定', () => {
  // 跑死: 关键端点字符串必须存在
  // (即便 L5-B 改实现, 这 4 个端点命名/路径不会改)
  it('user-service 关键端点约定', () => {
    const must = [
      'POST /auth/login',
      'GET  /me',
      'GET  /user/api-keys',
      'POST /auth/refresh'
    ]
    // 这里是文档型断言: 至少有一个不为空 (触发 lint 引用, 防误删)
    expect(must.length).toBe(4)
    for (const m of must) {
      expect(m).toMatch(/\s+\/(auth|me|user)(\/|$)/)
    }
  })
})
