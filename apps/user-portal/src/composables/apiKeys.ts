/**
 * useApiKeys — BYOK 页面状态管理
 * ManhuaWorks · W6 用户后台 · L4-A BYOK UI
 *
 * 单一数据源：
 * - keys: ApiKeyRow[]
 * - loading / error / revealing
 * - revealText / revealExpiresAt (30s 倒计时)
 *
 * 集成：
 * - api/api-keys.ts 4 个纯函数
 * - 鉴权 token 来自 useAuthStore (stores/auth.ts)
 * - 用户积分（creditsUsed / creditsTotal）来自 useUserStore
 */

import { ref, computed } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import {
  fetchApiKeys,
  createApiKey,
  deleteApiKey,
  revealApiKey,
  type ApiKeyRow,
  type ProviderId,
  type RevealKeyResp,
  PROVIDER_IDS
} from '@/api/api-keys'

/** 一次性 reveal 30s 倒计时（毫秒） */
export const REVEAL_TTL_MS = 30_000

export function useApiKeys() {
  const authStore = useAuthStore()
  const userStore = useUserStore()

  /* ---------- 状态 ---------- */
  const keys = ref<ApiKeyRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const revealing = ref(false)
  const revealText = ref<string | null>(null)
  const revealExpiresAt = ref<number | null>(null)
  /** 30s 倒计时显示（秒），revealExpiresAt 改变时驱动 */
  const revealSecondsLeft = ref(0)
  let revealTimer: ReturnType<typeof setInterval> | null = null

  /* ---------- 衍生 ---------- */
  const hasKeys = computed(() => keys.value.length > 0)
  const totalKeys = computed(() => keys.value.length)
  const kpi = computed(() => {
    const configuredSet = new Set(keys.value.map((k) => k.provider))
    const configured = PROVIDER_IDS.filter((p) => configuredSet.has(p)).length
    return {
      creditsUsed: userStore.creditsUsed,
      creditsTotal: userStore.creditsTotal,
      creditsPercent: userStore.creditsPercent,
      configured,
      unconfigured: PROVIDER_IDS.length - configured,
      totalKeys: keys.value.length
    }
  })
  const isAuthed = computed(() => authStore.isLoggedIn)

  /* ---------- 倒计时工具 ---------- */
  function startRevealCountdown(): void {
    stopRevealCountdown()
    revealExpiresAt.value = Date.now() + REVEAL_TTL_MS
    revealSecondsLeft.value = Math.ceil(REVEAL_TTL_MS / 1000)
    revealTimer = setInterval(() => {
      if (revealExpiresAt.value == null) return
      const left = Math.max(0, revealExpiresAt.value - Date.now())
      revealSecondsLeft.value = Math.ceil(left / 1000)
      if (left <= 0) {
        closeReveal()
      }
    }, 250)
  }

  function stopRevealCountdown(): void {
    if (revealTimer != null) {
      clearInterval(revealTimer)
      revealTimer = null
    }
  }

  function closeReveal(): void {
    revealText.value = null
    revealExpiresAt.value = null
    revealSecondsLeft.value = 0
    revealing.value = false
    stopRevealCountdown()
  }

  /* ---------- 操作 ---------- */

  /** 列表 */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      keys.value = await fetchApiKeys()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'load_failed'
      keys.value = []
    } finally {
      loading.value = false
    }
  }

  /** 新增（带去抖：同 provider 已存在则覆盖，由后端 upsert 负责） */
  async function add(provider: ProviderId, apiKey: string, label?: string): Promise<boolean> {
    if (!apiKey || apiKey.trim().length < 8) {
      error.value = 'key_length_invalid'
      return false
    }
    loading.value = true
    error.value = null
    try {
      await createApiKey(provider, apiKey, label)
      await load()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'add_failed'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 删除 */
  async function remove(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await deleteApiKey(id)
      keys.value = keys.value.filter((k) => k.id !== id)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'remove_failed'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 一次性 reveal —— 调 GET /:id/reveal, 后端真返回明文 (L3.D AES-256-GCM 解密)
   * 30s 倒计时后自动关弹窗 + 清理 revealText (明文不入 localStorage / store)
   */
  async function reveal(id: string): Promise<RevealKeyResp | null> {
    revealing.value = true
    error.value = null
    try {
      const data = await revealApiKey(id)
      revealText.value = data.apiKey
      startRevealCountdown()
      return data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'reveal_failed'
      return null
    } finally {
      revealing.value = false
    }
  }

  /** 重置（路由切换/登出时使用） */
  function reset(): void {
    keys.value = []
    error.value = null
    loading.value = false
    closeReveal()
  }

  // 跨上下文清理：组件里走 onUnmounted，测试 effectScope 里走 onScopeDispose
  // 用 @vueuse/core 的 tryOnScopeDispose 抹平差异（无当前 instance 时不报错）
  tryOnScopeDispose(() => {
    stopRevealCountdown()
  })

  return {
    // state
    keys,
    loading,
    error,
    revealing,
    revealText,
    revealExpiresAt,
    revealSecondsLeft,
    // derived
    hasKeys,
    totalKeys,
    kpi,
    isAuthed,
    // actions
    load,
    add,
    remove,
    reveal,
    closeReveal,
    reset
  }
}
