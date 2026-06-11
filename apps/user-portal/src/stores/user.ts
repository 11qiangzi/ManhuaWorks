/**
 * user store — 用户档案状态管理
 * ManhuaWorks · W4 用户后台
 *
 * 单一数据源：
 * - UserProfile（昵称/邮箱/头像/订阅/通知）
 * - 衍生：plan / credits / notifications
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userService, type UserProfile, type UserPlan, type NotificationPrefs } from '@/api/user-service'

export const useUserStore = defineStore('user', () => {
  /* ---------- 状态 ---------- */
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /* ---------- 衍生 ---------- */
  const isLoggedIn = computed(() => profile.value !== null)
  const nickname = computed(() => profile.value?.nickname ?? '创作者')
  const plan = computed<UserPlan>(() => profile.value?.plan ?? 'free')
  const avatar = computed(() => profile.value?.avatar ?? null)
  const creditsUsed = computed(() => profile.value?.creditsUsed ?? 0)
  const creditsTotal = computed(() => profile.value?.creditsTotal ?? 0)
  const creditsPercent = computed(() => {
    const total = creditsTotal.value || 1
    return Math.min(100, Math.round((creditsUsed.value / total) * 100))
  })

  /* ---------- 操作 ---------- */

  /** 加载当前用户档案 */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const p = await userService.me()
      profile.value = p
    } catch (err) {
      error.value = (err as Error).message
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  /** 更新档案 */
  async function updateProfile(patch: { nickname?: string; bio?: string; avatar?: string }): Promise<boolean> {
    if (!profile.value) return false
    const original = { ...profile.value }
    // 乐观更新
    if (patch.nickname !== undefined) profile.value.nickname = patch.nickname
    if (patch.bio !== undefined) profile.value.bio = patch.bio
    if (patch.avatar !== undefined) profile.value.avatar = patch.avatar
    try {
      const updated = await userService.updateProfile(patch)
      profile.value = updated
      return true
    } catch (err) {
      // 回滚
      profile.value = original
      error.value = (err as Error).message
      return false
    }
  }

  /** 更新通知偏好 */
  async function updateNotifications(patch: Partial<NotificationPrefs>): Promise<boolean> {
    if (!profile.value) return false
    const original = profile.value.notifications
    profile.value.notifications = { ...original, ...patch } as NotificationPrefs
    try {
      const updated = await userService.updateNotifications({ notifications: patch })
      profile.value = updated
      return true
    } catch (err) {
      profile.value.notifications = original
      error.value = (err as Error).message
      return false
    }
  }

  /** 登出 */
  function logout(): void {
    profile.value = null
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    } catch { /* ignore */ }
  }

  /** 重置 */
  function reset(): void {
    profile.value = null
    loading.value = false
    error.value = null
  }

  return {
    profile,
    loading,
    error,
    isLoggedIn,
    nickname,
    plan,
    avatar,
    creditsUsed,
    creditsTotal,
    creditsPercent,
    load,
    updateProfile,
    updateNotifications,
    logout,
    reset
  }
})