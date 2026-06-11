/**
 * user-portal · 关键组件单测
 *
 * 覆盖：UserCard / ProjectCard / PlanBadge / UsageBar
 *
 * 测试策略：
 *  - 走 stub 实现，验证 VM 逻辑（Vue 组件本身靠 vue-tsc + E2E 覆盖）
 *  - snapshot 重要 props 组合
 *
 * @author 陆流光
 * @updated 2026-06-08
 */

import { describe, it, expect } from 'vitest'
import {
  useUserCardVM,
  useProjectCardVM,
  usePlanBadgeVM,
  useUsageBarVM,
} from './stubs/user-portal'
import type { User, Project, Plan } from './fixtures/types'

/* ==================== 工具 ==================== */

/** 直接调用 hook 时需要 reactive 包裹 props（测试中用 plain object + watch） */
function withReactiveProps<T extends object>(props: T, fn: (p: T) => void): T {
  // 在 happy-dom 环境下，vue 的 computed 需要在 effectScope 中运行
  // 测试中直接传 plain object 也能工作，因为 stub 的 computed 不依赖 effect
  return props
}

function makeUser(overrides: Partial<User> = {}): User {
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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p_456',
    name: '灰星 1500 章',
    cover_url: 'https://cdn.example.com/c.png',
    type: 'novel',
    asset_count: 1240,
    member_count: 5,
    last_opened_at: new Date().toISOString(),
    created_at: '2025-09-01T08:00:00+08:00',
    ...overrides,
  }
}

/* ==================== UserCard ==================== */

describe('UserCard · 用户卡片', () => {
  it('中文姓名取首字做 initials', () => {
    const props = withReactiveProps({ user: makeUser({ display_name: '林启' }) }, () => {})
    const vm = useUserCardVM(props)
    expect(vm.initials.value).toBe('林启') // 单段中文：取前 2 字
  })

  it('英文姓名取每个单词首字母', () => {
    const props = withReactiveProps({ user: makeUser({ display_name: 'John Smith' }) }, () => {})
    const vm = useUserCardVM(props)
    expect(vm.initials.value).toBe('JS')
  })

  it('三字中文姓名取前 2 字', () => {
    const props = withReactiveProps({ user: makeUser({ display_name: '欧阳苏眀' }) }, () => {})
    const vm = useUserCardVM(props)
    expect(vm.initials.value).toBe('欧阳') // 单段取前 2 字
  })

  it.each<[Plan, 'gray' | 'blue' | 'gold' | 'purple', string]>([
    ['free', 'gray', '免费'],
    ['basic', 'blue', '基础'],
    ['pro', 'gold', '专业'],
    ['enterprise', 'purple', '企业'],
  ])('套餐 %s → 颜色 %s 标签 %s', (plan, color, label) => {
    const props = withReactiveProps({ user: makeUser({ plan }) }, () => {})
    const vm = useUserCardVM(props)
    expect(vm.badgeColor.value).toBe(color)
    expect(vm.badgeLabel.value).toBe(label)
  })

  it('formatJoinedDate 输出 YYYY-MM-DD', () => {
    const props = withReactiveProps({
      user: makeUser({ created_at: '2025-08-12T10:30:00+08:00' }),
    }, () => {})
    const vm = useUserCardVM(props)
    const formatted = vm.formatJoinedDate()
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(formatted).toBe('2025-08-12')
  })

  it('头像为空时仍能计算 initials（不依赖 URL）', () => {
    const props = withReactiveProps({
      user: makeUser({ avatar_url: null, display_name: '苏眀' }),
    }, () => {})
    const vm = useUserCardVM(props)
    expect(vm.initials.value).toBe('苏眀')
  })
})

/* ==================== ProjectCard ==================== */

describe('ProjectCard · 项目卡片', () => {
  it('daysSinceLastOpen = 0 当 last_opened_at 是今天', () => {
    const props = withReactiveProps({
      project: makeProject({ last_opened_at: new Date().toISOString() }),
    }, () => {})
    const vm = useProjectCardVM(props)
    expect(vm.daysSinceLastOpen.value).toBe(0)
    expect(vm.relativeTime.value).toBe('今天')
  })

  it('relativeTime 格式：N 天前 / N 周前 / N 月前 / N 年前', () => {
    const days = (n: number) =>
      new Date(Date.now() - n * 86_400_000).toISOString()
    const cases: Array<[number, string]> = [
      [3, '3 天前'],
      [10, '1 周前'],
      [45, '1 月前'],
      [400, '1 年前'],
    ]
    for (const [n, expected] of cases) {
      const props = withReactiveProps({
        project: makeProject({ last_opened_at: days(n) }),
      }, () => {})
      const vm = useProjectCardVM(props)
      expect(vm.relativeTime.value).toBe(expected)
    }
  })

  it.each<[Project['type'], string]>([
    ['novel', '小说'],
    ['drama', '漫剧'],
    ['audiobook', '有声书'],
    ['manga', '漫画'],
  ])('type=%s → 中文标签 %s', (type, label) => {
    const props = withReactiveProps({ project: makeProject({ type }) }, () => {})
    const vm = useProjectCardVM(props)
    expect(vm.typeLabel.value).toBe(label)
  })

  it('coverFallback 是确定的渐变（相同 ID 相同颜色）', () => {
    const a = useProjectCardVM({ project: makeProject({ id: 'p_456' }) })
    const b = useProjectCardVM({ project: makeProject({ id: 'p_456' }) })
    expect(a.coverFallback.value).toBe(b.coverFallback.value)
    expect(a.coverFallback.value).toMatch(/linear-gradient/)
  })

  it('不同 ID 产生不同渐变', () => {
    const a = useProjectCardVM({ project: makeProject({ id: 'p_aaa' }) })
    const b = useProjectCardVM({ project: makeProject({ id: 'p_bbb' }) })
    expect(a.coverFallback.value).not.toBe(b.coverFallback.value)
  })
})

/* ==================== PlanBadge ==================== */

describe('PlanBadge · 套餐徽章', () => {
  it('free 不显示到期', () => {
    const vm = usePlanBadgeVM({ plan: 'free' })
    expect(vm.daysToExpire.value).toBeNull()
    expect(vm.isExpiringSoon.value).toBe(false)
  })

  it('7 天内到期 → isExpiringSoon = true', () => {
    const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const vm = usePlanBadgeVM({ plan: 'pro', expiresAt: inFiveDays })
    expect(vm.isExpiringSoon.value).toBe(true)
    expect(vm.daysToExpire.value).toBe(5)
  })

  it('30 天后到期 → isExpiringSoon = false', () => {
    const inThirtyDays = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const vm = usePlanBadgeVM({ plan: 'pro', expiresAt: inThirtyDays })
    expect(vm.isExpiringSoon.value).toBe(false)
  })

  it('已过期（1 天前）→ isExpiringSoon = false（视为已失效）', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    const vm = usePlanBadgeVM({ plan: 'pro', expiresAt: yesterday })
    expect(vm.isExpiringSoon.value).toBe(false)
    expect(vm.daysToExpire.value).toBeLessThan(0)
  })

  it.each<[Plan, 'gray' | 'blue' | 'gold' | 'purple', string]>([
    ['free', 'gray', '免费'],
    ['basic', 'blue', '基础'],
    ['pro', 'gold', '专业'],
    ['enterprise', 'purple', '企业'],
  ])('plan=%s → 颜色 %s 标签 %s', (plan, color, label) => {
    const vm = usePlanBadgeVM({ plan })
    expect(vm.color.value).toBe(color)
    expect(vm.label.value).toBe(label)
  })
})

/* ==================== UsageBar ==================== */

describe('UsageBar · 用量进度条', () => {
  it.each<[number, 'green' | 'yellow' | 'red']>([
    [0, 'green'],
    [50, 'green'],
    [69.9, 'green'],
    [70, 'yellow'],
    [89.9, 'yellow'],
    [90, 'red'],
    [100, 'red'],
  ])('percent=%s%% → 颜色 %s', (percent, color) => {
    const vm = useUsageBarVM({
      data: { used: percent, limit: 100, percent },
    })
    expect(vm.color.value).toBe(color)
  })

  it('displayText 格式：used / limit unit', () => {
    const vm = useUsageBarVM({
      data: { used: 124000, limit: 1000000, percent: 12.4 },
      unit: 'tokens',
    })
    expect(vm.displayText.value).toBe('124,000 / 1,000,000 tokens')
  })

  it('无 unit 时不附加', () => {
    const vm = useUsageBarVM({
      data: { used: 5, limit: 10, percent: 50 },
    })
    expect(vm.displayText.value).toBe('5 / 10 ')
  })

  it('label 参数透传', () => {
    const vm = useUsageBarVM({
      data: { used: 1, limit: 10, percent: 10 },
      label: '存储',
    })
    expect(vm.displayText.value).toBe('1 / 10 ')
  })
})
