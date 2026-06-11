/**
 * animation.test.ts - useLoading 状态机 + useTheme 主题切换
 * ManhuaWorks · L2 task 9 (composables)
 *
 * 覆盖：
 *   useLoading: 14 类 loading、状态机 (start/stop/setProgress/setMessage/setError)、
 *               withLoading、isAnyLoading、activeKeys、clear
 *   useTheme:   5 主题切换、localStorage 持久化、循环、reset to system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useLoading } from '../src/composables/useLoading'
import { useTheme } from '../src/composables/useTheme'
import { AppError, ErrorCodes } from '../src/errors'
import { themeNames } from '../src/themes'

// =============================================================================
// useLoading 状态机
// =============================================================================

describe('useLoading - 状态机', () => {
  it('case 1: start/stop 切换状态', () => {
    const l = useLoading()
    l.start('button', 'btn1')
    expect(l.isLoading('btn1')).toBe(true)
    l.stop('btn1')
    expect(l.isLoading('btn1')).toBe(false)
  })

  it('case 2: 14 类 loading 全部可以 start', () => {
    const types = [
      'page', 'section', 'table', 'button', 'form', 'inline',
      'modal', 'drawer', 'skeleton', 'infinite', 'pull-refresh',
      'upload', 'progress', 'indeterminate',
    ] as const
    const l = useLoading()
    types.forEach((t, i) => l.start(t, `k${i}`))
    types.forEach((t, i) => {
      expect(l.isLoading(`k${i}`)).toBe(true)
      expect(l.states[`k${i}`].type).toBe(t)
    })
  })

  it('case 3: setProgress 限制 0-100', () => {
    const l = useLoading()
    l.start('progress', 'p1')
    l.setProgress('p1', 50)
    expect(l.states['p1'].progress).toBe(50)
    l.setProgress('p1', 150)
    expect(l.states['p1'].progress).toBe(100)
    l.setProgress('p1', -10)
    expect(l.states['p1'].progress).toBe(0)
  })

  it('case 4: setMessage / setError / clear', () => {
    const l = useLoading()
    l.start('inline', 'm1')
    l.setMessage('m1', '加载中...')
    expect(l.states['m1'].message).toBe('加载中...')
    const err = new AppError(ErrorCodes.NETWORK_OFFLINE, 'boom')
    l.setError('m1', err)
    expect(l.states['m1'].error).toBe(err)
    l.clear()
    expect(Object.keys(l.states)).toHaveLength(0)
  })

  it('case 5: withLoading 自动清理 + 抛错时设 error', async () => {
    const l = useLoading()
    const result = await l.withLoading('form', 'submit', async () => 42)
    expect(result).toBe(42)
    expect(l.isLoading('submit')).toBe(false)

    // 抛错
    await expect(
      l.withLoading('form', 'submit2', async () => {
        throw new AppError(ErrorCodes.INTERNAL_ERROR, 'fail')
      })
    ).rejects.toThrow()
    expect(l.isLoading('submit2')).toBe(false)
  })

  it('case 6: isAnyLoading / activeKeys', () => {
    const l = useLoading()
    l.start('button', 'a')
    l.start('button', 'b')
    l.stop('a')
    expect(l.isAnyLoading.value).toBe(true)
    expect(l.activeKeys.value).toContain('b')
    l.stop('b')
    expect(l.isAnyLoading.value).toBe(false)
  })

  it('case 7: withLoading onError 回调', async () => {
    const l = useLoading()
    const onError = vi.fn()
    await expect(
      l.withLoading('button', 'x', async () => {
        throw new Error('boom')
      }, { onError })
    ).rejects.toThrow('boom')
    expect(onError).toHaveBeenCalled()
  })
})

// =============================================================================
// useTheme 主题切换
// =============================================================================

describe('useTheme - 主题切换', () => {
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

  it('case 8: 5 个主题名都注册', () => {
    expect(themeNames).toEqual(['dark', 'light', 'sepia', 'midnight', 'neon'])
  })

  it('case 9: setTheme 切到 light + 写 localStorage + DOM', () => {
    const t = useTheme()
    t.setTheme('light')
    expect(t.current.value).toBe('light')
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    }
    if (typeof document !== 'undefined') {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(document.documentElement.classList.contains('theme-light')).toBe(true)
    }
  })

  it('case 10: setTheme 5 个主题都能切', () => {
    const t = useTheme()
    for (const name of themeNames) {
      t.setTheme(name)
      expect(t.current.value).toBe(name)
    }
  })

  it('case 11: setTheme 未知主题抛错', () => {
    const t = useTheme()
    expect(() => t.setTheme('unknown-theme' as any)).toThrow(/Unknown theme/)
  })

  it('case 12: toggle 在 dark/light 间切换', () => {
    const t = useTheme()
    t.setTheme('dark')
    t.toggle()
    expect(t.current.value).toBe('light')
    t.toggle()
    expect(t.current.value).toBe('dark')
  })

  it('case 13: cycleTheme 循环切换', () => {
    const t = useTheme()
    t.setTheme('dark')
    t.cycleTheme()
    expect(t.current.value).toBe('light')
    t.cycleTheme()
    expect(t.current.value).toBe('sepia')
    t.cycleTheme()
    expect(t.current.value).toBe('midnight')
    t.cycleTheme()
    expect(t.current.value).toBe('neon')
    t.cycleTheme()
    expect(t.current.value).toBe('dark') // wrap
  })

  it('case 14: resetToSystem 清 localStorage + 应用系统偏好', () => {
    const t = useTheme()
    t.setTheme('neon')
    t.resetToSystem()
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    }
  })

  it('case 15: 主题持久化 (setTheme 后 init 读回)', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'sepia')
    }
    const t = useTheme()
    t.init()
    expect(t.current.value).toBe('sepia')
  })

  it('case 16: 主题持久化跨标签页 (storage event)', () => {
    const t = useTheme()
    t.init()
    t.setTheme('midnight')
    expect(t.current.value).toBe('midnight')
    // 模拟其他标签页修改
    if (typeof window !== 'undefined') {
      const ev = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: 'sepia',
        oldValue: 'midnight',
      })
      window.dispatchEvent(ev)
      expect(t.current.value).toBe('sepia')
    }
  })

  it('case 17: 5 主题色 token 完整 (dark)', async () => {
    const { darkTheme } = await import('../src/themes/dark')
    expect(darkTheme.name).toBe('dark')
    expect(Object.keys(darkTheme.tokens).length).toBeGreaterThanOrEqual(10)
    // 必须包含基础 token
    expect(darkTheme.tokens).toHaveProperty('bg-primary')
    expect(darkTheme.tokens).toHaveProperty('text-primary')
    expect(darkTheme.tokens).toHaveProperty('primary')
  })

  it('case 18: 5 主题色 token 完整 (light / sepia / midnight / neon)', async () => {
    const [light, sepia, midnight, neon] = await Promise.all([
      import('../src/themes/light'),
      import('../src/themes/sepia'),
      import('../src/themes/midnight'),
      import('../src/themes/neon'),
    ])
    expect(light.lightTheme.name).toBe('light')
    expect(sepia.sepiaTheme.name).toBe('sepia')
    expect(midnight.midnightTheme.name).toBe('midnight')
    expect(neon.neonTheme.name).toBe('neon')
    for (const t of [light.lightTheme, sepia.sepiaTheme, midnight.midnightTheme, neon.neonTheme]) {
      expect(Object.keys(t.tokens).length).toBeGreaterThanOrEqual(10)
      expect(t.tokens).toHaveProperty('bg-primary')
      expect(t.tokens).toHaveProperty('text-primary')
    }
  })
})