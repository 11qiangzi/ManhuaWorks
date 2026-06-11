/**
 * mock-data.ts · 业务总后台假数据
 * ManhuaWorks · M1-W4 · L4-B
 * 纯前端 mock, 不接后端
 */

export interface SeriesPoint { date: string; value: number }
export interface UserMock {
  id: string
  email: string
  username: string
  provider: string
  status: 'active' | 'trial' | 'paused' | 'revoked'
  createdAt: number
  credits: number
}

/* ------------------------------------------------------------------ */
/* 大盘 5 KPI + 3 图 + 日志                                           */
/* ------------------------------------------------------------------ */

export const dashboardKpi = {
  totalUsers: 4_287,
  active7d: 1_842,
  totalProjects: 936,
  totalWorks: 4_021,
  newToday: 38
}

export function gen7DaySeries(base: number, drift: number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const v = base + Math.round(Math.sin(i * 1.3 + drift) * 80) + Math.round(Math.random() * 40)
    out.push({ date: d.toISOString().slice(5, 10), value: Math.max(0, v) })
  }
  return out
}

export const revenueSeries = gen7DaySeries(1280, 0)
export const activeUserSeries = gen7DaySeries(1850, 1.5)

export const providerUsage = [
  { provider: 'openai', used: 1820, color: '#10a37f' },
  { provider: 'anthropic', used: 942, color: '#d97706' },
  { provider: 'google', used: 612, color: '#4285f4' },
  { provider: 'deepseek', used: 488, color: '#5b21b6' },
  { provider: 'minimax', used: 425, color: '#a8302b' }
]

export const projectStatus = [
  { status: 'draft', count: 142 },
  { status: 'running', count: 218 },
  { status: 'reviewing', count: 89 },
  { status: 'published', count: 312 },
  { status: 'archived', count: 154 },
  { status: 'failed', count: 21 }
]

export const recentOps = [
  { ts: Date.now() - 60_000, who: 'admin@manhuaworks.com', action: 'GRANT_CREDITS', target: 'user_4821', detail: '+500 积分' },
  { ts: Date.now() - 180_000, who: 'admin@manhuaworks.com', action: 'ROTATE_API_KEY', target: 'provider:openai', detail: '强制轮换 key fingerprint' },
  { ts: Date.now() - 600_000, who: 'system', action: 'COST_ALERT', target: 'org:team_8', detail: '当日消耗 > ¥800 触发告警' },
  { ts: Date.now() - 1_200_000, who: 'admin2@manhuaworks.com', action: 'BAN_USER', target: 'user_2947', detail: '违规刷量' },
  { ts: Date.now() - 1_800_000, who: 'admin@manhuaworks.com', action: 'UNBAN_USER', target: 'user_2114', detail: '误封解除' },
  { ts: Date.now() - 2_400_000, who: 'system', action: 'BACKUP_OK', target: 'db:manhuaworks', detail: '每日 04:00 全量备份完成' },
  { ts: Date.now() - 3_600_000, who: 'admin3@manhuaworks.com', action: 'REFUND', target: 'order_7741', detail: '¥199 全额退款' },
  { ts: Date.now() - 4_800_000, who: 'system', action: 'DEPLOY', target: 'service:ai-orchestrator', detail: 'v0.4.7 → v0.4.8' },
  { ts: Date.now() - 6_000_000, who: 'admin@manhuaworks.com', action: 'CREATE_COUPON', target: 'coupon:LAUNCH50', detail: '5 折券 × 100 张' },
  { ts: Date.now() - 7_200_000, who: 'admin2@manhuaworks.com', action: 'SUSPEND', target: 'team_19', detail: '欠费暂停' }
]

/* ------------------------------------------------------------------ */
/* 用户列表 (50 条假数据)                                              */
/* ------------------------------------------------------------------ */

const providers = ['openai', 'anthropic', 'google', 'deepseek', 'minimax']
const statuses: UserMock['status'][] = ['active', 'trial', 'paused', 'revoked']
const firstNames = ['林', '王', '李', '张', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高']
const givenNames = ['启', '墨', '染', '琢', '选', '远', '辞', '辞', '归', '怀', '安', '知', '辞', '言', '辞']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export const userList: UserMock[] = Array.from({ length: 50 }, (_, i) => {
  const fn = pick(firstNames)
  const gn = pick(givenNames)
  return {
    id: `user_${(i + 1000).toString(36)}`,
    email: `${fn}.${gn}${i}@example.com`,
    username: `${fn}${gn}${i}`,
    provider: pick(providers),
    status: pick(statuses),
    createdAt: Date.now() - Math.floor(Math.random() * 90 * 86400_000),
    credits: Math.floor(Math.random() * 5000)
  }
})
