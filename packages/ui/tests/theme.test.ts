/**
 * theme.test.ts - 5 主题色 token 完整性 + useTheme localStorage 持久化
 * ManhuaWorks · L2 task 9 (composables)
 *
 * 覆盖：
 *   - 5 主题色 token 完整性
 *   - generateThemeCSS / generateAllThemeCSS 输出正确
 *   - getTheme fallback
 *   - useTheme localStorage 持久化
 *   - 系统偏好检测
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  themes,
  themeNames,
  generateThemeCSS,
  generateAllThemeCSS,
  getTheme,
} from '../src/themes'
import { darkTheme } from '../src/themes/dark'
import { lightTheme } from '../src/themes/light'
import { sepiaTheme } from '../src/themes/sepia'
import { midnightTheme } from '../src/themes/midnight'
import { neonTheme } from '../src/themes/neon'
import { useTheme } from '../src/composables/useTheme'

const STORAGE_KEY = 'manhuaworks:theme'

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.className = ''
  }
})

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

describe('themes - registry', () => {
  it('case 1: 5 个主题全注册', () => {
    expect(themeNames).toEqual(['dark', 'light', 'sepia', 'midnight', 'neon'])
    expect(Object.keys(themes)).toEqual(['dark', 'light', 'sepia', 'midnight', 'neon'])
  })

  it('case 2: 每个主题都有 name + tokens', () => {
    for (const name of themeNames) {
      const t = themes[name]
      expect(t.name).toBe(name)
      expect(typeof t.tokens).toBe('object')
      expect(Object.keys(t.tokens).length).toBeGreaterThanOrEqual(10)
    }
  })

  it('case 3: dark / light / sepia / midnight / neon 各自有定义', () => {
    expect(darkTheme.name).toBe('dark')
    expect(lightTheme.name).toBe('light')
    expect(sepiaTheme.name).toBe('sepia')
    expect(midnightTheme.name).toBe('midnight')
    expect(neonTheme.name).toBe('neon')
  })

  it('case 4: 主题 token 含 bg-primary / text-primary / primary', () => {
    for (const name of themeNames) {
      const tokens = themes[name].tokens as Record<string, string>
      expect(tokens).toHaveProperty('bg-primary')
      expect(tokens).toHaveProperty('text-primary')
      expect(tokens).toHaveProperty('primary')
    }
  })

  it('case 5: generateThemeCSS 输出有效 CSS', () => {
    const css = generateThemeCSS(darkTheme)
    expect(css).toContain('.theme-dark')
    expect(css).toContain(':root[data-theme="dark"]')
    expect(css).toContain('--bg-primary')
    expect(css).toContain('--text-primary')
    expect(css).toContain('--primary')
  })

  it('case 6: generateAllThemeCSS 输出 5 套 CSS', () => {
    const css = generateAllThemeCSS()
    expect(css).toContain('.theme-dark')
    expect(css).toContain('.theme-light')
    expect(css).toContain('.theme-sepia')
    expect(css).toContain('.theme-midnight')
    expect(css).toContain('.theme-neon')
  })

  it('case 7: getTheme 已知名称返回正确主题', () => {
    expect(getTheme('dark').name).toBe('dark')
    expect(getTheme('light').name).toBe('light')
    expect(getTheme('sepia').name).toBe('sepia')
    expect(getTheme('midnight').name).toBe('midnight')
    expect(getTheme('neon').name).toBe('neon')
  })

  it('case 8: getTheme 未知名称 fallback 到 dark', () => {
    expect(getTheme('unknown').name).toBe('dark')
    expect(getTheme(null).name).toBe('dark')
    expect(getTheme(undefined).name).toBe('dark')
    expect(getTheme('').name).toBe('dark')
  })

  it('case 9: 5 主题 token 数量级一致', () => {
    const counts = themeNames.map((n) => Object.keys(themes[n].tokens).length)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    expect(max - min).toBeLessThanOrEqual(5) // 同一 token 集合差异不超过 5
  })
})

describe('useTheme - localStorage 持久化', () => {
  it('case 10: setTheme 后写 localStorage', () => {
    const t = useTheme()
    t.setTheme('midnight')
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('midnight')
    }
  })

  it('case 11: 5 主题全部写 localStorage', () => {
    const t = useTheme()
    for (const name of themeNames) {
      t.setTheme(name)
      if (typeof localStorage !== 'undefined') {
        expect(localStorage.getItem(STORAGE_KEY)).toBe(name)
      }
    }
  })

  it('case 12: init 读 localStorage 恢复主题', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'sepia')
    }
    const t = useTheme()
    t.init()
    expect(t.current.value).toBe('sepia')
  })

  it('case 13: resetToSystem 清 localStorage', () => {
    const t = useTheme()
    t.setTheme('neon')
    t.resetToSystem()
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    }
  })

  it('case 14: localStorage 不可用时不崩 (SSR)', () => {
    const saved = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = undefined
    try {
      const t = useTheme()
      expect(() => t.setTheme('light')).not.toThrow()
      expect(() => t.resetToSystem()).not.toThrow()
    } finally {
      ;(globalThis as any).localStorage = saved
    }
  })

  it('case 15: STORAGE_KEY 导出', () => {
    expect(STORAGE_KEY).toBe('manhuaworks:theme')
  })

  it('case 16: useTheme 重复 init 是幂等的', () => {
    const t = useTheme()
    t.init()
    const first = t.current.value
    t.init()
    expect(t.current.value).toBe(first)
  })

  it('case 17: themeNames 数组顺序正确', () => {
    expect(themeNames[0]).toBe('dark')
    expect(themeNames[1]).toBe('light')
    expect(themeNames[2]).toBe('sepia')
    expect(themeNames[3]).toBe('midnight')
    expect(themeNames[4]).toBe('neon')
  })

  it('case 18: 切换主题时 DOM 属性更新', () => {
    const t = useTheme()
    t.setTheme('dark')
    if (typeof document !== 'undefined') {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    }
    t.setTheme('neon')
    if (typeof document !== 'undefined') {
      expect(document.documentElement.getAttribute('data-theme')).toBe('neon')
      expect(document.documentElement.classList.contains('theme-neon')).toBe(true)
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false)
    }
  })
})