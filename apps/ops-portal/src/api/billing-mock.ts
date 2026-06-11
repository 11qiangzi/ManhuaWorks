// billing-mock.ts — 4 角色演示用户 (复用 demo UUID 与后端 seed 对齐)
export interface DemoBillingUser {
  id: string
  displayName: string
  role: 'admin' | 'creator' | 'free' | 'business'
  balanceCents: number
  currency: 'USD' | 'CNY'
}

export const demoUsers: DemoBillingUser[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    displayName: '演示账号-管理员',
    role: 'admin',
    balanceCents: 50000,
    currency: 'CNY',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    displayName: '演示账号-创作者',
    role: 'creator',
    balanceCents: 29000,
    currency: 'CNY',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    displayName: '演示账号-免费用户',
    role: 'free',
    balanceCents: 0,
    currency: 'CNY',
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    displayName: '演示账号-企业用户',
    role: 'business',
    balanceCents: 99900,
    currency: 'CNY',
  },
]
