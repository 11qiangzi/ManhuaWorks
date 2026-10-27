/**
 * web · user Pinia store — 接 user-service
 * 千机工坊 · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@manhuaworks/api-client'
import type { UserDTO, UserProfileDTO } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useUserStore = defineStore('user', () => {
  const api = getApi()

  const profile = ref<UserProfileDTO | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadProfile(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // user-service 有 /users/me/profile（带扩展字段）
      const p = await api.http.get<UserProfileDTO>('/users/me/profile')
      profile.value = p
    } catch (e) {
      // 退到 /auth/me
      if (e instanceof ApiError && e.status === 404) {
        try {
          const u = await api.users.me()
          profile.value = u as UserProfileDTO
          return
        } catch (e2) {
          error.value = e2 instanceof ApiError ? e2.userMessage : '加载失败'
          throw e2
        }
      }
      error.value = e instanceof ApiError ? e.userMessage : '加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(patch: { display_name?: string; avatar_url?: string }): Promise<void> {
    if (!profile.value) return
    const id = profile.value.id
    await api.projects.updateUser(id, patch)
    await loadProfile()
  }

  function setProfile(u: UserDTO | null): void {
    profile.value = (u as UserProfileDTO | null)
  }

  return { profile, loading, error, loadProfile, updateProfile, setProfile }
})
