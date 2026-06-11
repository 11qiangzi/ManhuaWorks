/**
 * Theme: Midnight (creator-orange variant - deep warm dark)
 * ManhuaWorks 主题色板 - 暖夜橙 (创作橘 + 夜色)
 */
export const midnightTheme = {
  name: 'midnight',
  tokens: {
    primary: '#ff6b1a',
    'primary-hover': '#ff7d35',
    'primary-active': '#cc4f0d',
    secondary: '#f43f5e',
    'secondary-hover': '#f55e78',
    'secondary-active': '#c92644',
    accent: '#ff9966',
    'accent-soft': '#ffb38c',

    success: '#16a34a',
    'success-bg': 'rgba(22, 163, 74, 0.12)',
    warning: '#f59e0b',
    'warning-bg': 'rgba(245, 158, 11, 0.12)',
    error: '#dc2626',
    'error-bg': 'rgba(220, 38, 38, 0.12)',
    info: '#0ea5e9',
    'info-bg': 'rgba(14, 165, 233, 0.12)',

    'bg-primary': '#1f1410',
    'bg-secondary': '#2a1c14',
    'bg-tertiary': '#382418',
    'bg-elevated': '#3e2a1c',
    'bg-overlay': 'rgba(15, 8, 5, 0.6)',

    'text-primary': '#fffaf5',
    'text-secondary': '#d4b8a0',
    'text-tertiary': '#9a7a5e',
    'text-inverse': '#1f1410',
    'text-link': '#ff6b1a',

    'border-subtle': '#382418',
    'border-default': '#4a3220',
    'border-strong': '#5a3e2a',

    'code-bg': '#2a1c14',
    'code-text': '#fffaf5',
    'gradient-brand': 'linear-gradient(135deg, #ff6b1a 0%, #f43f5e 100%)',
    'glow-accent': '0 0 0 1px rgba(255, 107, 26, 0.22)',

    'gray-50': '#fffaf5',
    'gray-100': '#fde3cd',
    'gray-200': '#e8c8a8',
    'gray-300': '#c4a080',
    'gray-400': '#9a7a5e',
    'gray-500': '#7a5a40',
    'gray-600': '#5a3e2a',
    'gray-700': '#3e2a1c',
    'gray-800': '#2a1c14',
    'gray-900': '#1f1410',

    'text-xs': '12px',
    'text-sm': '14px',
    'text-md': '16px',
    'text-lg': '20px',
    'text-xl': '28px',
    'font-display': "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    'font-mono': "'JetBrains Mono', 'Courier New', monospace",

    'space-0': '0',
    'space-1': '4px',
    'space-2': '8px',
    'space-3': '12px',
    'space-4': '16px',
    'space-5': '24px',
    'space-6': '32px',
    'space-7': '48px',
    'space-8': '64px',

    'radius-1': '2px',
    'radius-2': '4px',
    'radius-3': '8px',
    'radius-4': '12px',
    'radius-5': '16px',
    'radius-6': '24px',

    'shadow-1': '0 1px 2px rgba(0, 0, 0, 0.25)',
    'shadow-2': '0 2px 4px rgba(0, 0, 0, 0.3)',
    'shadow-3': '0 4px 8px rgba(0, 0, 0, 0.35)',
    'shadow-4': '0 6px 12px rgba(0, 0, 0, 0.4)',
    'shadow-5': '0 8px 24px rgba(255, 107, 26, 0.18)',
    'shadow-6': '0 12px 32px rgba(0, 0, 0, 0.5)',
    'shadow-7': '0 16px 48px rgba(0, 0, 0, 0.6)'
  }
} as const

export type MidnightTheme = typeof midnightTheme
