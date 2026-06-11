/**
 * Theme: Sepia (national-ink)
 * ManhuaWorks 主题色板 - 国风墨韵
 */
export const sepiaTheme = {
  name: 'sepia',
  tokens: {
    primary: '#a8302b',
    'primary-hover': '#bf3a35',
    'primary-active': '#8b1e1a',
    secondary: '#5c1c1a',
    'secondary-hover': '#6b2220',
    'secondary-active': '#4a1311',
    accent: '#d4a056',
    'accent-soft': '#c4564f',

    success: '#6b8e23',
    'success-bg': 'rgba(107, 142, 35, 0.12)',
    warning: '#d97706',
    'warning-bg': 'rgba(217, 119, 6, 0.12)',
    error: '#b91c1c',
    'error-bg': 'rgba(185, 28, 28, 0.12)',
    info: '#0e7490',
    'info-bg': 'rgba(14, 116, 144, 0.12)',

    'bg-primary': '#f5efe1',
    'bg-secondary': '#ebe3cf',
    'bg-tertiary': '#ddd2b6',
    'bg-elevated': '#f9f5ea',
    'bg-overlay': 'rgba(26, 22, 18, 0.45)',

    'text-primary': '#1a1612',
    'text-secondary': '#5a4d3a',
    'text-tertiary': '#8a7a5a',
    'text-inverse': '#f5efe1',
    'text-link': '#a8302b',

    'border-subtle': '#d8c9a3',
    'border-default': '#c4b387',
    'border-strong': '#b89e72',

    'code-bg': '#ebe3cf',
    'code-text': '#1a1612',
    'gradient-brand': 'linear-gradient(135deg, #a8302b 0%, #5c1c1a 100%)',
    'glow-accent': '0 0 0 1px rgba(168, 48, 43, 0.2)',

    'gray-50': '#f9f5ea',
    'gray-100': '#f5efe1',
    'gray-200': '#ebe3cf',
    'gray-300': '#d8c9a3',
    'gray-400': '#b89e72',
    'gray-500': '#8a7a5a',
    'gray-600': '#5a4d3a',
    'gray-700': '#3a3022',
    'gray-800': '#251f15',
    'gray-900': '#1a1612',

    'text-xs': '12px',
    'text-sm': '14px',
    'text-md': '16px',
    'text-lg': '20px',
    'text-xl': '28px',
    'font-display': "'STKaiti', 'KaiTi', 'PingFang SC', 'Microsoft YaHei', serif",
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

    'shadow-1': '0 1px 2px rgba(168, 48, 43, 0.06)',
    'shadow-2': '0 2px 4px rgba(168, 48, 43, 0.08)',
    'shadow-3': '0 4px 8px rgba(168, 48, 43, 0.1)',
    'shadow-4': '0 6px 12px rgba(168, 48, 43, 0.12)',
    'shadow-5': '0 8px 24px rgba(168, 48, 43, 0.15)',
    'shadow-6': '0 12px 32px rgba(168, 48, 43, 0.2)',
    'shadow-7': '0 16px 48px rgba(168, 48, 43, 0.25)'
  }
} as const

export type SepiaTheme = typeof sepiaTheme
