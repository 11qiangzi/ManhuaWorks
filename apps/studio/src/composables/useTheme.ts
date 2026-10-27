import { ref, watch } from 'vue'

type Theme = 'light' | 'dark' | 'auto'

export function useTheme() {
  const theme = ref<Theme>((localStorage.getItem('studio_theme') as Theme) ?? 'auto')

  watch(theme, t => {
    localStorage.setItem('studio_theme', t)
    applyTheme()
  }, { immediate: true })

  function applyTheme() {
    const root = document.documentElement
    const isDark =
      theme.value === 'dark' ||
      (theme.value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', isDark)
  }

  return { theme, applyTheme }
}
