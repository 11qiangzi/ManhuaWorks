/**
 * admin-portal · auth Pinia store — 接 user-service
 * ManhuaWorks · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError, tokenStore } from '@manhuaworks/api-client'
import type { UserDTO } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useAuthStore = defineStore('auth', () => {
  const api = getApi()

  const user = ref<UserDTO | null>(null)
  const token = ref<string | null>(tokenStore.get())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => (user.value?.role ?? 0) >= 5)
  const isSuper = computed(() => (user.value?.role ?? 0) >= 9)

  async function loginByPassword(email: string, password: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const r = await api.users.loginByPassword({ email, password })
      user.value = r.user
      token.value = r.token
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '登录失败'
      throw e
    } finally { loading.value = false }
  }

  async function loginByCode(phone: string, code: string, display_name?: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const r = await api.users.loginByCode({ phone, code, display_name })
      user.value = r.user
      token.value = r.token
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '登录失败'
      throw e
    } finally { loading.value = false }
  }

  async function fetchMe(): Promise<void> {
    try { user.value = await api.users.me() } catch (e) {
      if (e instanceof ApiError && e.status === 401) user.value = null
      throw e
    }
  }

  async function logout(): Promise<void> {
    try { await api.users.logout() } catch { /* noop */ }
    user.value = null
    token.value = null
  }

  return { user, token, loading, error, isLoggedIn, isAdmin, isSuper, loginByPassword, loginByCode, fetchMe, logout }
})
