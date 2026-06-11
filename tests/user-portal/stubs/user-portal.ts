/**
 * user-portal 组件 stubs（轻量实现）
 *
 * 真实实现位于 `apps/user-portal/src/components/`（W4 任务 1 完成后）
 * 测试先用 stub 验证 API 契约 + 渲染逻辑
 */

import { computed, type Ref, type ComputedRef } from 'vue'
import type { Plan, User, Usage } from './types'

/* ==================== UserCard ==================== */

export interface UserCardProps {
  user: User
  showEmail?: boolean
  showStats?: boolean
  compact?: boolean
}

export interface UserCardEmits {
  (e: 'edit'): void
  (e: 'logout'): void
}

export interface UserCardVM {
  initials: ComputedRef<string>
  badgeColor: ComputedRef<'gray' | 'blue' | 'gold' | 'purple'>
  badgeLabel: ComputedRef<string>
  formatJoinedDate: () => string
}

export function useUserCardVM(props: UserCardProps): UserCardVM {
  const initials = computed(() => {
    const parts = props.user.display_name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return props.user.display_name.slice(0, 2).toUpperCase()
  })

  const badgeColor = computed(() => {
    const map: Record<Plan, 'gray' | 'blue' | 'gold' | 'purple'> = {
      free: 'gray',
      basic: 'blue',
      pro: 'gold',
      enterprise: 'purple',
    }
    return map[props.user.plan]
  })

  const badgeLabel = computed(() => {
    const map: Record<Plan, string> = {
      free: '免费',
      basic: '基础',
      pro: '专业',
      enterprise: '企业',
    }
    return map[props.user.plan]
  })

  const formatJoinedDate = () => {
    const d = new Date(props.user.created_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return { initials, badgeColor, badgeLabel, formatJoinedDate }
}

/* ==================== ProjectCard ==================== */

export interface ProjectCardProps {
  project: import('./types').Project
  selected?: boolean
  draggable?: boolean
}

export interface ProjectCardVM {
  daysSinceLastOpen: ComputedRef<number>
  relativeTime: ComputedRef<string>
  typeLabel: ComputedRef<string>
  coverFallback: ComputedRef<string>
}

export function useProjectCardVM(props: ProjectCardProps): ProjectCardVM {
  const daysSinceLastOpen = computed(() => {
    const diff = Date.now() - new Date(props.project.last_opened_at).getTime()
    return Math.floor(diff / 86_400_000)
  })

  const relativeTime = computed(() => {
    const d = daysSinceLastOpen.value
    if (d < 1) return '今天'
    if (d < 7) return `${d} 天前`
    if (d < 30) return `${Math.floor(d / 7)} 周前`
    if (d < 365) return `${Math.floor(d / 30)} 月前`
    return `${Math.floor(d / 365)} 年前`
  })

  const typeLabel = computed(() => {
    const map: Record<ProjectCardProps['project']['type'], string> = {
      novel: '小说',
      drama: '漫剧',
      audiobook: '有声书',
      manga: '漫画',
    }
    return map[props.project.type]
  })

  const coverFallback = computed(() => {
    // 生成一个确定性的渐变色 hex
    const hash = [...props.project.id].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0
    const hue = hash % 360
    return `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 60) % 360}, 60%, 40%))`
  })

  return { daysSinceLastOpen, relativeTime, typeLabel, coverFallback }
}

/* ==================== PlanBadge ==================== */

export interface PlanBadgeProps {
  plan: Plan
  expiresAt?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export interface PlanBadgeVM {
  color: ComputedRef<'gray' | 'blue' | 'gold' | 'purple'>
  label: ComputedRef<string>
  isExpiringSoon: ComputedRef<boolean>
  daysToExpire: ComputedRef<number | null>
}

export function usePlanBadgeVM(props: PlanBadgeProps): PlanBadgeVM {
  const color = computed(() => {
    const map: Record<Plan, 'gray' | 'blue' | 'gold' | 'purple'> = {
      free: 'gray',
      basic: 'blue',
      pro: 'gold',
      enterprise: 'purple',
    }
    return map[props.plan]
  })

  const label = computed(() => {
    const map: Record<Plan, string> = {
      free: '免费',
      basic: '基础',
      pro: '专业',
      enterprise: '企业',
    }
    return map[props.plan]
  })

  const daysToExpire = computed(() => {
    if (!props.expiresAt) return null
    const diff = new Date(props.expiresAt).getTime() - Date.now()
    return Math.ceil(diff / 86_400_000)
  })

  const isExpiringSoon = computed(() => {
    const d = daysToExpire.value
    return d !== null && d <= 7 && d >= 0
  })

  return { color, label, isExpiringSoon, daysToExpire }
}

/* ==================== UsageBar ==================== */

export interface UsageBarProps {
  data: { used: number; limit: number; percent: number }
  label?: string
  unit?: string
}

export interface UsageBarVM {
  color: ComputedRef<'green' | 'yellow' | 'red'>
  displayText: ComputedRef<string>
}

export function useUsageBarVM(props: UsageBarProps): UsageBarVM {
  const color = computed(() => {
    if (props.data.percent < 70) return 'green'
    if (props.data.percent < 90) return 'yellow'
    return 'red'
  })

  const displayText = computed(() => {
    const { used, limit } = props.data
    const u = props.unit ?? ''
    return `${used.toLocaleString()} / ${limit.toLocaleString()} ${u}`
  })

  return { color, displayText }
}
