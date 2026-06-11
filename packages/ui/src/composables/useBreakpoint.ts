/**
 * useBreakpoint - reactive viewport breakpoint detection
 * 4 档: mobile / tablet / desktop / 4k
 */
import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'

export type BreakpointName = 'mobile' | 'tablet' | 'desktop' | '4k'

export interface Breakpoints {
  mobile: number   // 0 - 639
  tablet: number   // 640 - 1023
  desktop: number  // 1024 - 2559
  '4k': number     // 2560+
}

export const DEFAULT_BREAKPOINTS: Breakpoints = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  '4k': 2560
}

export interface UseBreakpointReturn {
  width: Ref<number>
  height: Ref<number>
  current: ComputedRef<BreakpointName>
  isMobile: ComputedRef<boolean>
  isTablet: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  is4K: ComputedRef<boolean>
  isAtLeast: (bp: BreakpointName) => boolean
  isAtMost: (bp: BreakpointName) => boolean
  cols: ComputedRef<1 | 2 | 3 | 5>
}

function classify(w: number, bp: Breakpoints): BreakpointName {
  if (w >= bp['4k']) return '4k'
  if (w >= bp.desktop) return 'desktop'
  if (w >= bp.tablet) return 'tablet'
  return 'mobile'
}

function rank(bp: BreakpointName): number {
  return { mobile: 0, tablet: 1, desktop: 2, '4k': 3 }[bp]
}

export function useBreakpoint(breakpoints: Breakpoints = DEFAULT_BREAKPOINTS): UseBreakpointReturn {
  const width = ref(0)
  const height = ref(0)

  function update() {
    if (typeof window === 'undefined') return
    width.value = window.innerWidth || 0
    height.value = window.innerHeight || 0
  }

  let raf: number | null = null
  function onResize() {
    if (raf !== null) return
    raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(() => { update(); raf = null })
      : (setTimeout(() => { update(); raf = null }, 16) as unknown as number)
  }

  onMounted(() => {
    update()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize, { passive: true })
      window.addEventListener('orientationchange', onResize, { passive: true })
    }
  })
  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
    if (raf !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
      else clearTimeout(raf as unknown as number)
      raf = null
    }
  })

  const current = computed(() => classify(width.value, breakpoints))
  const isMobile = computed(() => current.value === 'mobile')
  const isTablet = computed(() => current.value === 'tablet')
  const isDesktop = computed(() => current.value === 'desktop')
  const is4K = computed(() => current.value === '4k')
  const cols = computed<1 | 2 | 3 | 5>(() => {
    const c = current.value
    if (c === 'mobile') return 1
    if (c === 'tablet') return 2
    if (c === 'desktop') return 3
    return 5 // 4k
  })

  function isAtLeast(bp: BreakpointName): boolean {
    return rank(current.value) >= rank(bp)
  }
  function isAtMost(bp: BreakpointName): boolean {
    return rank(current.value) <= rank(bp)
  }

  return { width, height, current, isMobile, isTablet, isDesktop, is4K, isAtLeast, isAtMost, cols }
}
