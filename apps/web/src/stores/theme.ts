import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 5 主题枚举 */
export type ThemeName =
  | 'dark-workshop'
  | 'minimal-light'
  | 'creator-orange'
  | 'national-ink'
  | 'neon-cyber'

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeName>('dark-workshop')

  function set(name: ThemeName) {
    current.value = name
  }

  function load(): ThemeName {
    try {
      const saved = localStorage.getItem('manhuaworks:theme') as ThemeName | null
      if (saved) {
        current.value = saved
        return saved
      }
    } catch {
      // localStorage 不可用
    }
    return current.value
  }

  return { current, set, load }
})
