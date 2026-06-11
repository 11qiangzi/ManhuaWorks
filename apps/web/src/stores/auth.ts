/**
 * web · auth Pinia store — 接 user-service
 * ManhuaWorks · L2 task 8
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError, tokenStore } from '@manhuaworks/api-client'
import type { UserDTO, TwoFactorEnableResp } from '@manhuaworks/api-client'
import { getApi } from '../api-bridge'

export const useAuthStore = defineStore('auth', () => {
  const api = getApi()

  const user = ref<UserDTO | null>(null)
  const token = ref<string | null>(tokenStore.get())
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => !!user.value)
  const role = computed(() => user.value?.role ?? 0)
  const isAdmin = computed(() => role.value >= 5)

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
    } finally {
      loading.value = false
    }
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
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, display_name: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const r = await api.users.register({ email, password, display_name })
      user.value = r.user
      token.value = r.token
    } catch (e) {
      error.value = e instanceof ApiError ? e.userMessage : '注册失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function sendCode(phone: string): Promise<{ mock_code?: string }> {
    return await api.users.sendCode({ phone })
  }

  async function verifyEmail(tokenStr: string): Promise<void> {
    await api.users.verifyEmail(tokenStr)
  }

  async function enable2FA(): Promise<TwoFactorEnableResp> {
    return await api.users.enable2FA()
  }

  async function verify2FA(code: string): Promise<void> {
    await api.users.confirm2FA({ code })
  }

  async function disable2FA(code: string): Promise<void> {
    await api.users.disable2FA({ code })
  }

  async function changePassword(old_password: string, new_password: string): Promise<void> {
    await api.users.changePassword({ old_password, new_password })
  }

  async function fetchMe(): Promise<void> {
    try {
      user.value = await api.users.me()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        user.value = null
      }
      throw e
    }
  }

  async function logout(): Promise<void> {
    try { await api.users.logout() } catch { /* noop */ }
    user.value = null
    token.value = null
  }

  function setUser(u: UserDTO | null): void {
    user.value = u
  }

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    role,
    isAdmin,
    loginByPassword,
    loginByCode,
    register,
    sendCode,
    verifyEmail,
    enable2FA,
    verify2FA,
    disable2FA,
    changePassword,
    fetchMe,
    logout,
    setUser,
  }
})
