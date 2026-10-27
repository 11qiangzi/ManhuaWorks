/**
 * user-portal · profile Pinia store — 接 user-service
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { UserProfileDTO, Plan } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useProfileStore = defineStore('profile', () => {
  const api = getApi()

  const profile = ref<UserProfileDTO | null>(null)
  const quota = ref<{ plan: Plan; credits_used: number; credits_total: number; reset_at: string } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isPro = computed(() => profile.value?.plan === 'pro' || profile.value?.plan === 'enterprise')
  const nickname = computed(() => profile.value?.display_name ?? '用户')
  const creditsRemaining = computed(() => {
    if (!quota.value) return 0
    return Math.max(0, quota.value.credits_total - quota.value.credits_used)
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // 优先 /users/me/profile（有扩展字段）
      try {
        profile.value = await api.http.get<UserProfileDTO>('/users/me/profile')
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          profile.value = await api.users.me()
        } else {
          throw e
        }
      }
      // 配额（billing-service）
      try {
        quota.value = await api.billing.getMyQuota()
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          quota.value = null
        } else {
          // 不阻塞 profile
          quota.value = null
        }
      }
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '加载失败'
      throw e
    } finally { loading.value = false }
  }

  async function update(patch: { display_name?: string; avatar_url?: string }): Promise<void> {
    if (!profile.value) return
    const id = profile.value.id
    await api.projects.updateUser(id, patch)
    await load()
  }

  function logout(): void {
    profile.value = null
    quota.value = null
  }

  return {
    profile, quota, loading, error,
    isPro, nickname, creditsRemaining,
    load, update, logout,
  }
})
