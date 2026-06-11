/**
 * ManhuaWorks 微信小程序 - 认证 Pinia Store
 *
 * 后端契约:
 *   POST /api/v1/auth/login  -> { code:0, data: TokenPair }
 *   TokenPair 字段: access_token, refresh_token, expires_in, token_type, user (PublicUser)
 *
 * 存储策略:
 *   token  -> uni.setStorageSync('mw_access_token', ...)  (持久化)
 *   user   -> Pinia 内存 (敏感度低, 重启可重新拉 /me)
 *
 * 401 处理:
 *   axios 拦截器在 401 时清 token + 触发 setUnauthorizedHandler 注册的回调
 *   store 的 logout() 主动调, 不依赖 401
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  login as apiLogin,
  tokenStore,
  type LoginInput,
  type PublicUser,
  type TokenPair,
  setUnauthorizedHandler
} from '../api/client'

interface PersistedUser {
  id: string
  email: string | null
  display_name: string | null
  role: number
}

const USER_CACHE_KEY = 'mw_user_cache'

/** 把 user 序列化进 uni storage, 重启小程序也能恢复昵称 */
function persistUser(u: PublicUser | null): void {
  try {
    // @ts-expect-error - uni 在运行时由 taro 注入
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      // @ts-expect-error - uni 在运行时由 taro 注入
      uni.setStorageSync(USER_CACHE_KEY, u ? JSON.stringify(u) : '')
      return
    }
  } catch {
    // uni 不可用
  }
  if (typeof localStorage !== 'undefined') {
    if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_CACHE_KEY)
  }
}

function readPersistedUser(): PublicUser | null {
  try {
    // @ts-expect-error - uni 在运行时由 taro 注入
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      // @ts-expect-error - uni 在运行时由 taro 注入
      const raw = uni.getStorageSync(USER_CACHE_KEY)
      if (!raw) return null
      return typeof raw === 'string' ? (JSON.parse(raw) as PublicUser) : (raw as PublicUser)
    }
  } catch {
    // parse 失败 / uni 不可用
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as PublicUser
    } catch {
      return null
    }
  }
  return null
}

export const useAuthStore = defineStore('auth', () => {
  /* state */
  const token = ref<string | null>(tokenStore.get())
  const user = ref<PublicUser | null>(readPersistedUser())
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  /* getters */
  const isLoggedIn = computed<boolean>(() => !!token.value && !!user.value)
  const displayName = computed<string>(() => {
    if (!user.value) return '游客'
    return user.value.display_name || user.value.email || user.value.phone || '用户'
  })
  const userId = computed<string | null>(() => user.value?.id ?? null)
  const userRole = computed<number>(() => user.value?.role ?? 0)

  /* actions */

  /** 调真实 /api/v1/auth/login */
  async function login(input: LoginInput): Promise<TokenPair> {
    loading.value = true
    error.value = null
    try {
      const pair = await apiLogin(input)
      token.value = pair.access_token
      user.value = pair.user
      tokenStore.set(pair.access_token)
      persistUser(pair.user)
      return pair
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'login_failed'
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 退出: 清 token + user (本地操作, 不强制打后端) */
  function logout(): void {
    token.value = null
    user.value = null
    error.value = null
    tokenStore.clear()
    persistUser(null)
  }

  /** 401 时: 只清状态, 不重定向 (跳转由拦截器回调负责) */
  function onUnauthorized(): void {
    token.value = null
    user.value = null
    tokenStore.clear()
    persistUser(null)
  }

  /** 拿简化版 user (供页面展示用) */
  function toJSON(): PersistedUser | null {
    if (!user.value) return null
    return {
      id: user.value.id,
      email: user.value.email,
      display_name: user.value.display_name,
      role: user.value.role
    }
  }

  /* 注入 401 回调: 让 axios 拦截器在 401 时清状态 */
  setUnauthorizedHandler(() => {
    onUnauthorized()
  })

  return {
    // state
    token,
    user,
    loading,
    error,
    // getters
    isLoggedIn,
    displayName,
    userId,
    userRole,
    // actions
    login,
    logout,
    onUnauthorized,
    toJSON
  }
})
