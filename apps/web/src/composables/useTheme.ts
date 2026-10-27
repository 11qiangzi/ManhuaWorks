/**
 * useTheme — 千机工坊多主题系统
 *
 * 5 主题：dark-workshop | national-ink | neon-cyber | minimal-light | creator-orange
 * 持久化：localStorage `app-theme`
 * 默认：dark-workshop（千机青墨韵科技风）
 */

import { ref, computed, watch } from 'vue'

export interface ThemeMeta {
  name: string
  label: string
  desc: string
  preview: { bg: string; text: string; accent: string }
}

const THEMES: ThemeMeta[] = [
  {
    name: 'dark-workshop',
    label: '暗夜工坊',
    desc: '千机青墨韵科技风',
    preview: { bg: '#0E0F12', text: '#E8EAED', accent: '#00BFA5' },
  },
  {
    name: 'national-ink',
    label: '国风墨',
    desc: '水墨宣纸，古风漫改',
    preview: { bg: '#f5efe1', text: '#1a1612', accent: '#a8302b' },
  },
  {
    name: 'neon-cyber',
    label: '霓虹赛博',
    desc: '赛博朋克，霓虹冲击',
    preview: { bg: '#0a0014', text: '#f0e6ff', accent: '#ff00aa' },
  },
  {
    name: 'minimal-light',
    label: '极简白',
    desc: '白昼办公，清晰锐利',
    preview: { bg: '#ffffff', text: '#1a1d23', accent: '#2563eb' },
  },
  {
    name: 'creator-orange',
    label: '创作橙',
    desc: '创作激情，灵感迸发',
    preview: { bg: '#fffaf5', text: '#2d1810', accent: '#ff6b1a' },
  },
]

const THEME_KEY = 'app-theme'
const DEFAULT_THEME = 'dark-workshop'

function loadSaved(): string {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved && THEMES.find(t => t.name === saved)) return saved
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

const current = ref<string>(loadSaved())
const currentMeta = computed(() => THEMES.find(t => t.name === current.value) ?? THEMES[0])

function applyTheme(name: string) {
  // Remove all theme classes
  for (const t of THEMES) {
    document.documentElement.classList.remove(`theme-${t.name}`)
  }
  // Add active theme class
  document.documentElement.classList.add(`theme-${name}`)
}

function setTheme(name: string) {
  if (!THEMES.find(t => t.name === name)) return
  current.value = name
  localStorage.setItem(THEME_KEY, name)
  applyTheme(name)
}

function initTheme() {
  applyTheme(current.value)
}

function toggleTheme() {
  const idx = THEMES.findIndex(t => t.name === current.value)
  const next = THEMES[(idx + 1) % THEMES.length]
  setTheme(next.name)
}

// Watch for external changes (e.g. other tabs)
if (typeof window !== 'undefined') {
  watch(current, (name) => {
    applyTheme(name)
  })
}

export function useAppTheme() {
  return {
    current,
    currentMeta,
    setTheme,
    initTheme,
    init: initTheme,
    toggleTheme,
  }
}

export const useTheme = useAppTheme

export const APP_THEME_LIST = THEMES
export const THEME_LIST = THEMES

export type AppThemeName = typeof THEMES[number]['name']
export type ThemeName = AppThemeName
export type AppThemeMeta = ThemeMeta
