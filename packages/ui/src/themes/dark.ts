/**
 * Theme: Dark
 * ManhuaWorks 主题色板 - 暗色 (工程师工坊)
 * 通过 :root CSS 变量驱动，零运行时开销
 */
export const darkTheme = {
  name: 'dark',
  tokens: {
    /* brand palette (v2.0) */
    'brand-cyan': '#00BFA5',
    'brand-cyan-dark': '#0D9488',
    'brand-cyan-light': '#5EEAD4',
    'brand-purple': '#7C3AED',
    'brand-purple-dark': '#5B21B6',
    'brand-purple-light': '#A78BFA',

    /* brand */
    primary: '#ff7a45',
    'primary-hover': '#ff8e5e',
    'primary-active': '#d35a2a',
    secondary: '#ff4d6d',
    'secondary-hover': '#ff6680',
    'secondary-active': '#d63a5a',
    accent: '#ffb84d',
    'accent-soft': '#ff9a6e',

    /* status */
    success: '#4ade80',
    'success-bg': 'rgba(74, 222, 128, 0.12)',
    warning: '#fbbf24',
    'warning-bg': 'rgba(251, 191, 36, 0.12)',
    error: '#f87171',
    'error-bg': 'rgba(248, 113, 113, 0.12)',
    info: '#60a5fa',
    'info-bg': 'rgba(96, 165, 250, 0.12)',

    /* surfaces */
    'bg-primary': '#0e0f12',
    'bg-secondary': '#1a1c21',
    'bg-tertiary': '#232730',
    'bg-elevated': '#2a2d33',
    'bg-overlay': 'rgba(0, 0, 0, 0.6)',

    /* text */
    'text-primary': '#e8eaed',
    'text-secondary': '#8a8f99',
    'text-tertiary': '#5a5f69',
    'text-inverse': '#0e0f12',
    'text-link': '#ff7a45',

    /* border */
    'border-subtle': '#2a2d33',
    'border-default': '#3a3e46',
    'border-strong': '#4a4e56',

    /* code */
    'code-bg': '#14161a',
    'code-text': '#e8eaed',

    /* gradient */
    'gradient-brand': 'linear-gradient(135deg, #ff7a45 0%, #ff4d6d 100%)',

    /* glow */
    'glow-accent': '0 0 0 1px rgba(255, 122, 69, 0.18)',

    /* gray scale (9 档) */
    'gray-50': '#f7f8fa',
    'gray-100': '#e8eaed',
    'gray-200': '#c4c8cf',
    'gray-300': '#8a8f99',
    'gray-400': '#5a5f69',
    'gray-500': '#4a4e56',
    'gray-600': '#3a3e46',
    'gray-700': '#2a2d33',
    'gray-800': '#1a1c21',
    'gray-900': '#0e0f12',

    /* typography (5 档) */
    'text-xs': '12px',
    'text-sm': '14px',
    'text-md': '16px',
    'text-lg': '20px',
    'text-xl': '28px',
    'font-display': "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    'font-mono': "'JetBrains Mono', 'Courier New', monospace",

    /* spacing (8 档) */
    'space-0': '0',
    'space-1': '4px',
    'space-2': '8px',
    'space-3': '12px',
    'space-4': '16px',
    'space-5': '24px',
    'space-6': '32px',
    'space-7': '48px',
    'space-8': '64px',

    /* radius (6 档) */
    'radius-1': '2px',
    'radius-2': '4px',
    'radius-3': '8px',
    'radius-4': '12px',
    'radius-5': '16px',
    'radius-6': '24px',

    /* shadow (7 档) */
    'shadow-1': '0 1px 2px rgba(0, 0, 0, 0.2)',
    'shadow-2': '0 2px 4px rgba(0, 0, 0, 0.25)',
    'shadow-3': '0 4px 8px rgba(0, 0, 0, 0.3)',
    'shadow-4': '0 6px 12px rgba(0, 0, 0, 0.35)',
    'shadow-5': '0 8px 24px rgba(0, 0, 0, 0.45)',
    'shadow-6': '0 12px 32px rgba(0, 0, 0, 0.5)',
    'shadow-7': '0 16px 48px rgba(0, 0, 0, 0.6)'
  }
} as const

export type DarkTheme = typeof darkTheme
