/**
 * 千机工坊 Design System - Tailwind Base Tokens (v2.0)
 *
 * All app-level tailwind.config files MUST extend this baseTheme.
 * Brand tokens are mapped to CSS variables where possible, so the
 * 5-theme system (dark/light/sepia/midnight/neon) can override at runtime.
 *
 * Usage in app tailwind.config.ts:
 *   import { baseTheme } from '@manhuaworks/ui/tailwind.base'
 *   export default { theme: { extend: baseTheme } }
 */

export const baseTheme = {
  colors: {
    // ── Brand palette (v2.0 spec) ──
    brand: {
      cyan: 'var(--brand-cyan, #00BFA5)',           // 千机青
      'cyan-dark': 'var(--brand-cyan-dark, #0D9488)',
      'cyan-light': 'var(--brand-cyan-light, #5EEAD4)',
      purple: 'var(--brand-purple, #7C3AED)',        // 墨韵紫
      'purple-dark': 'var(--brand-purple-dark, #5B21B6)',
      'purple-light': 'var(--brand-purple-light, #A78BFA)',
    },

    // ── Semantic / status ──
    semantic: {
      success: 'var(--success, #10B981)',
      warning: 'var(--warning, #F59E0B)',
      error: 'var(--error, #EF4444)',
      info: 'var(--info, #3B82F6)',
    },

    // ── Surface / background ──
    surface: {
      bg: 'var(--bg-primary, #0E0F12)',              // 砚台黑
      panel: 'var(--bg-secondary, #1A1C21)',         // 宣纸灰
      'panel-hover': 'var(--bg-tertiary, #23262E)',
      elevated: 'var(--bg-elevated, #2A2D33)',
      overlay: 'var(--bg-overlay, rgba(0,0,0,0.6))',
      border: 'var(--border-default, #2E3139)',
    },

    // ── Text ──
    text: {
      primary: 'var(--text-primary, #E8EAED)',
      secondary: 'var(--text-secondary, #9CA3AF)',
      disabled: 'var(--text-tertiary, #4B5563)',
      inverse: 'var(--text-inverse, #0E0F12)',
      link: 'var(--text-link, #00BFA5)',
    },
  },

  spacing: {
    // 4-8-12-16-20-24-32-40-48-64-80-96-128 (Tailwind default + custom)
    '4.5': '1.125rem',   // 18px - half-step between 4 and 5
    '13': '3.25rem',     // 52px
    '15': '3.75rem',     // 60px
    '18': '4.5rem',      // 72px
    '88': '22rem',       // 352px
    '100': '25rem',      // 400px
    '112': '28rem',      // 448px
    '128': '32rem',      // 512px
  },

  borderRadius: {
    sm: '6px',    // 按钮 / 输入框 / Tag
    md: '12px',   // 卡片 / 面板 / 弹窗
    lg: '16px',   // Modal / 图片容器
    xl: '24px',   // 大型装饰容器
    full: '50%',  // 头像 / 状态点
  },

  boxShadow: {
    card: '0 2px 8px rgba(0,0,0,0.15)',
    hover: '0 4px 16px rgba(0,0,0,0.25)',
    modal: '0 8px 32px rgba(0,0,0,0.35)',
    glow: '0 0 15px rgba(0,191,165,0.4)',           // 千机青 glow
    'glow-purple': '0 0 15px rgba(124,58,237,0.4)',  // 墨韵紫 glow
  },

  fontFamily: {
    sans: ['var(--font-sans, "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif)'],
    mono: ['var(--font-mono, "JetBrains Mono", "Courier New", monospace)'],
    display: ['var(--font-display, "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif)'],
  },

  fontSize: {
    '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px
    xs: ['0.75rem', { lineHeight: '1rem' }],            // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],        // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],           // 16px
    lg: ['1.25rem', { lineHeight: '1.75rem' }],         // 20px
    xl: ['1.75rem', { lineHeight: '2.25rem' }],         // 28px
    '2xl': ['2rem', { lineHeight: '2.5rem' }],          // 32px
    '3xl': ['2.5rem', { lineHeight: '3rem' }],          // 40px
  },

  transitionTimingFunction: {
    'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    'in': 'cubic-bezier(0.7, 0, 0.84, 0)',
    'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  },

  transitionDuration: {
    fast: '150ms',
    base: '280ms',
    slow: '480ms',
  },

  zIndex: {
    drawer: '40',
    modal: '50',
    toast: '60',
    tooltip: '70',
  },
} as const

export type BaseTheme = typeof baseTheme
