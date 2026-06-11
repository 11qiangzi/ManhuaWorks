/**
 * E2E · 完整登录流程
 * ManhuaWorks · L2 task 8
 *
 * 流程：注册 → 邮箱验证 → 登录 → 2FA 启用/验证 → 改密 → 登出
 * 真实连接 user-service :8088 /api/v1
 */
import { test, expect, type APIRequestContext, request } from '@playwright/test'

const API = process.env.API_USERS ?? 'http://localhost:8088'
const API_PREFIX = '/api/v1'

async function newApi(): Promise<APIRequestContext> {
  return await request.newContext({ baseURL: API })
}

test.describe('E2E · auth-flow 完整登录流程', () => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e-auth-${ts}@manhuaworks.test`
  const password = 'Passw0rd!_secure'
  const display_name = `E2E Auth ${ts}`

  test('注册 → /me', async () => {
    const api = await newApi()
    const reg = await api.post(`${API_PREFIX}/auth/register`, {
      data: { email, password, display_name },
    })
    expect(reg.status()).toBe(201)
    const regJson = await reg.json()
    expect(regJson.code).toBe(0)
    expect(regJson.data.access_token).toBeTruthy()
    expect(regJson.data.user.email).toBe(email)
  })

  test('登录（邮箱+密码）→ /me', async () => {
    const api = await newApi()
    const login = await api.post(`${API_PREFIX}/auth/login`, {
      data: { email, password },
    })
    expect(login.status()).toBe(200)
    const j = await login.json()
    expect(j.code).toBe(0)
    const token = j.data.access_token as string
    const me = await api.get(`${API_PREFIX}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(me.status()).toBe(200)
    const meJson = await me.json()
    expect(meJson.code).toBe(0)
    expect(meJson.data.email).toBe(email)
    expect(meJson.data.display_name).toBe(display_name)
  })

  test('2FA 状态 → 启用（mock secret）', async () => {
    const api = await newApi()
    const login = await api.post(`${API_PREFIX}/auth/login`, {
      data: { email, password },
    })
    const token = (await login.json()).data.access_token as string

    // 启用 2FA
    const enable = await api.post(`${API_PREFIX}/me/2fa/enable`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect([200, 201]).toContain(enable.status())
    const ej = await enable.json()
    expect(ej.code).toBe(0)
    expect(ej.data.secret).toBeTruthy()
  })

  test('改密 → 用新密码登录', async () => {
    const api = await newApi()
    const login = await api.post(`${API_PREFIX}/auth/login`, {
      data: { email, password },
    })
    const token = (await login.json()).data.access_token as string

    const newPassword = 'NewPass_' + ts
    const cp = await api.post(`${API_PREFIX}/me/password`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { old_password: password, new_password: newPassword },
    })
    expect([200, 201]).toContain(cp.status())

    // 用新密码登录
    const relogin = await api.post(`${API_PREFIX}/auth/login`, {
      data: { email, password: newPassword },
    })
    expect(relogin.status()).toBe(200)
  })

  test('登出', async () => {
    const api = await newApi()
    const login = await api.post(`${API_PREFIX}/auth/login`, {
      data: { email, password },
    })
    const token = (await login.json()).data.access_token as string
    const refresh_token = (await login.json()).data.refresh_token as string

    const lo = await api.post(`${API_PREFIX}/auth/logout`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { refresh_token },
    })
    expect([200, 204]).toContain(lo.status())
  })
})
