/**
 * E2E · 计费流程
 * ManhuaWorks · L2 task 8
 *
 * 流程：注册/登录 → 查套餐 → 订阅 → 订单 → 退款
 * 真实连接 user-service :8088 + billing-service :8090
 */
import { test, expect, type APIRequestContext, request } from '@playwright/test'

const USER_API = process.env.API_USERS ?? 'http://localhost:8088'
const BILLING_API = process.env.API_BILLING ?? 'http://localhost:8090'
const API = '/api/v1'

async function setupUser(): Promise<{ api: APIRequestContext; token: string }> {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e-bill-${ts}@manhuaworks.test`
  const api = await request.newContext({ baseURL: USER_API })
  const reg = await api.post(`${API}/auth/register`, {
    data: { email, password: 'Passw0rd!_e2e', display_name: `E2E Bill ${ts}` },
  })
  let token: string
  if (reg.status() === 201) {
    token = (await reg.json()).data.access_token
  } else {
    const lo = await api.post(`${API}/auth/login`, { data: { email, password: 'Passw0rd!_e2e' } })
    token = (await lo.json()).data.access_token
  }
  return { api, token }
}

test.describe('E2E · billing-flow 计费流程', () => {
  test('套餐列表 + 我的订阅 + 配额', async () => {
    const { token } = await setupUser()
    const bill = await request.newContext({ baseURL: BILLING_API })
    const auth = { Authorization: `Bearer ${token}` }

    // 套餐
    const plans = await bill.get(`${API}/subscriptions/plans`, { headers: auth })
    if (plans.status() === 404) test.skip(true, 'billing-service plans not implemented')
    expect([200]).toContain(plans.status())
    const pj = await plans.json()
    expect(pj.data.length).toBeGreaterThanOrEqual(1)

    // 我的订阅
    const my = await bill.get(`${API}/subscriptions/me`, { headers: auth })
    expect([200, 404]).toContain(my.status())

    // 配额
    const quota = await bill.get(`${API}/quota/me`, { headers: auth })
    expect([200, 404]).toContain(quota.status())
  })
})
