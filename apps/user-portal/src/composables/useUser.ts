/**
 * useUser — 用户档案便捷 composable
 * ManhuaWorks · W4 用户后台
 */

import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

export function useUser() {
  const store = useUserStore()
  const {
    profile,
    loading,
    error,
    isLoggedIn,
    nickname,
    plan,
    avatar,
    creditsUsed,
    creditsTotal,
    creditsPercent
  } = storeToRefs(store)

  /** 自动加载（onMounted） */
  function autoLoad(): void {
    onMounted(() => {
      if (!profile.value) {
        store.load()
      }
    })
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
    load: store.load,
    updateProfile: store.updateProfile,
    updateNotifications: store.updateNotifications,
    logout: store.logout,
    autoLoad
  }
}