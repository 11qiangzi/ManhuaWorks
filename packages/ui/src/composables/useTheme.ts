/**
 * useTheme composable
 * - 主题切换 (lightweight, no React/JS 框架运行时)
 * - localStorage 持久化
 * - 检测系统偏好 (prefers-color-scheme)
 * - 跨标签页同步 (storage 事件)
 */
import { computed, ref, watch, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import type { ThemeName } from '../themes'
import { themeNames } from '../themes'

const STORAGE_KEY = 'manhuaworks:theme'

/** 模块级 singleton ref (跨组件共享当前主题) */
const currentTheme: Ref<ThemeName> = ref<ThemeName>('dark')
let initialized = false
let storageHandler: ((e: StorageEvent) => void) | null = null
let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null

/** 检测系统偏好 */
function getSystemPreference(): ThemeName {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark'
  }
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  return darkQuery.matches ? 'dark' : 'light'
}

/** 从 localStorage 读取 */
function readStored(): ThemeName | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (themeNames as string[]).includes(v)) {
      return v as ThemeName
    }
  } catch {
    // localStorage 可能在 SSR/隐私模式不可用
  }
  return null
}

/** 写入 localStorage */
function writeStored(name: ThemeName): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // ignore
  }
}

/** 应用主题到 <html> (data-theme 属性 + class 兼容) */
function applyTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', name)
  root.classList.remove('theme-dark', 'theme-light', 'theme-sepia', 'theme-midnight', 'theme-neon')
  root.classList.add(`theme-${name}`)
}

/** 模块级初始化: 应用主题 + 注册 storage 事件 */
function init(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const stored = readStored()
  const initial = stored ?? getSystemPreference()
  currentTheme.value = initial
  applyTheme(initial)

  storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      const v = e.newValue as ThemeName
      if ((themeNames as string[]).includes(v)) {
        currentTheme.value = v
        applyTheme(v)
      }
    }
  }
  window.addEventListener('storage', storageHandler)

  // 监听系统主题变化 (only if no stored preference)
  if (!stored && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mediaHandler = () => {
      const next = mq.matches ? 'dark' : 'light'
      currentTheme.value = next
      applyTheme(next)
    }
    if (mq.addEventListener) mq.addEventListener('change', mediaHandler)
    else if (mq.addListener) mq.addListener(mediaHandler as any)
  }
}

/** 卸载 */
function dispose(): void {
  if (storageHandler && typeof window !== 'undefined') {
    window.removeEventListener('storage', storageHandler)
    storageHandler = null
  }
  if (mediaHandler && typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (mq.removeEventListener) mq.removeEventListener('change', mediaHandler)
    else if (mq.removeListener) mq.removeListener(mediaHandler as any)
    mediaHandler = null
  }
  initialized = false
}

export interface UseThemeReturn {
  current: Ref<ThemeName>
  setTheme: (name: ThemeName) => void
  toggle: () => void
  cycleTheme: () => void
  resetToSystem: () => void
  init: () => void
  dispose: () => void
}

export function useTheme(): UseThemeReturn {
  if (typeof window !== 'undefined' && !initialized) {
    onMounted(() => init())
    onBeforeUnmount(() => {
      // 不在这里 dispose - singleton 应该跨组件存活
    })
  }

  function setTheme(name: ThemeName): void {
    if (!(themeNames as string[]).includes(name)) {
      throw new Error(`Unknown theme: ${name}`)
    }
    currentTheme.value = name
    writeStored(name)
    applyTheme(name)
  }

  function toggle(): void {
    setTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
  }

  function cycleTheme(): void {
    const idx = themeNames.indexOf(currentTheme.value)
    const next = themeNames[(idx + 1) % themeNames.length] as ThemeName
    setTheme(next)
  }

  function resetToSystem(): void {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
    const sys = getSystemPreference()
    currentTheme.value = sys
    applyTheme(sys)
  }

  // 自动同步 ref -> DOM
  watch(currentTheme, (v) => applyTheme(v))

  return {
    current: currentTheme,
    setTheme,
    toggle,
    cycleTheme,
    resetToSystem,
    init,
    dispose
  }
}

export { themeNames, STORAGE_KEY }
export type { ThemeName }

// ===== 5 站应用主题 (派单 47: 从 web/user-portal 提取) =====

import { APP_THEME_LIST, type AppThemeName, type AppThemeMeta } from '../themes'

const APP_THEME_STORAGE_KEY = 'manhuaworks:theme'

/** 单例 ref (模块级, 跨组件共享) */
const _appTheme: Ref<AppThemeName> = ref<AppThemeName>('dark-workshop')
let _appThemeInit = false

function applyAppTheme(name: AppThemeName) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  APP_THEME_LIST.forEach((t) => html.classList.remove(`theme-${t.name}`))
  html.classList.add(`theme-${name}`)
  html.setAttribute('data-theme', name)
  html.style.colorScheme = name === 'minimal-light' ? 'light' : 'dark'
}

export interface UseAppThemeReturn {
  current: Ref<AppThemeName>
  currentMeta: ComputedRef<AppThemeMeta>
  themes: AppThemeMeta[]
  setTheme: (name: AppThemeName) => void
  initTheme: () => void
  cycleTheme: () => void
}

export function useAppTheme(): UseAppThemeReturn {
  const currentMeta = computed<AppThemeMeta>(
    () => APP_THEME_LIST.find((t) => t.name === _appTheme.value) ?? APP_THEME_LIST[0]
  )

  function setTheme(name: AppThemeName) {
    if (!APP_THEME_LIST.some((t) => t.name === name)) return
    _appTheme.value = name
    try { localStorage.setItem(APP_THEME_STORAGE_KEY, name) } catch {}
    applyAppTheme(name)
  }

  function initTheme() {
    if (_appThemeInit) return
    _appThemeInit = true
    try {
      const saved = localStorage.getItem(APP_THEME_STORAGE_KEY) as AppThemeName | null
      if (saved && APP_THEME_LIST.some((t) => t.name === saved)) {
        _appTheme.value = saved
      }
    } catch {}
    applyAppTheme(_appTheme.value)
  }

  function cycleTheme() {
    const idx = APP_THEME_LIST.findIndex((t) => t.name === _appTheme.value)
    setTheme(APP_THEME_LIST[(idx + 1) % APP_THEME_LIST.length].name)
  }

  watch(_appTheme, (v) => applyAppTheme(v))

  return { current: _appTheme, currentMeta, themes: APP_THEME_LIST, setTheme, initTheme, cycleTheme }
}

export { APP_THEME_LIST, APP_THEME_STORAGE_KEY }
