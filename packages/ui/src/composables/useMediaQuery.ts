/**
 * useMediaQuery - reactive media query
 */
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)
  let mql: MediaQueryList | null = null

  function onChange(e: MediaQueryListEvent) {
    matches.value = e.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(query)
    matches.value = mql.matches
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else if (mql.addListener) mql.addListener(onChange as any)
  })
  onBeforeUnmount(() => {
    if (!mql) return
    if (mql.removeEventListener) mql.removeEventListener('change', onChange)
    else if (mql.removeListener) mql.removeListener(onChange as any)
    mql = null
  })

  return matches
}

/** prefers-reduced-motion: 满足无障碍要求 */
export function usePrefersReducedMotion(): Ref<boolean> {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** prefers-color-scheme: dark / light */
export function usePrefersColorScheme(): Ref<'dark' | 'light' | 'none'> {
  const m = useMediaQuery('(prefers-color-scheme: dark)')
  if (typeof window === 'undefined' || !window.matchMedia) {
    return ref<'dark' | 'light' | 'none'>('none')
  }
  // 简化: m 跟踪 dark 偏好；light 是反义
  return ref<'dark' | 'light' | 'none'>(m.value ? 'dark' : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'none'))
}
