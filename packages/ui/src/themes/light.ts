/**
 * Theme: Light
 * ManhuaWorks 主题色板 - 极简白 (白天办公)
 */
export const lightTheme = {
  name: 'light',
  tokens: {
    /* brand palette (v2.0) */
    'brand-cyan': '#00BFA5',
    'brand-cyan-dark': '#0D9488',
    'brand-cyan-light': '#5EEAD4',
    'brand-purple': '#7C3AED',
    'brand-purple-dark': '#5B21B6',
    'brand-purple-light': '#A78BFA',

    primary: '#2563eb',
    'primary-hover': '#3b76f0',
    'primary-active': '#1d4ed8',
    secondary: '#7c3aed',
    'secondary-hover': '#8b4ef0',
    'secondary-active': '#6d28d9',
    accent: '#06b6d4',
    'accent-soft': '#60a5fa',

    success: '#10b981',
    'success-bg': 'rgba(16, 185, 129, 0.1)',
    warning: '#f59e0b',
    'warning-bg': 'rgba(245, 158, 11, 0.1)',
    error: '#ef4444',
    'error-bg': 'rgba(239, 68, 68, 0.1)',
    info: '#3b82f6',
    'info-bg': 'rgba(59, 130, 246, 0.1)',

    'bg-primary': '#ffffff',
    'bg-secondary': '#f7f8fa',
    'bg-tertiary': '#eef0f4',
    'bg-elevated': '#ffffff',
    'bg-overlay': 'rgba(15, 23, 42, 0.45)',

    'text-primary': '#1a1d23',
    'text-secondary': '#6b7280',
    'text-tertiary': '#9ca3af',
    'text-inverse': '#ffffff',
    'text-link': '#2563eb',

    'border-subtle': '#e5e7eb',
    'border-default': '#d1d5db',
    'border-strong': '#9ca3af',

    'code-bg': '#f3f4f6',
    'code-text': '#1a1d23',
    'gradient-brand': 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    'glow-accent': '0 0 0 1px rgba(37, 99, 235, 0.18)',

    'gray-50': '#f7f8fa',
    'gray-100': '#eef0f4',
    'gray-200': '#e5e7eb',
    'gray-300': '#d1d5db',
    'gray-400': '#9ca3af',
    'gray-500': '#6b7280',
    'gray-600': '#4b5563',
    'gray-700': '#374151',
    'gray-800': '#1f2937',
    'gray-900': '#0f172a',

    'text-xs': '12px',
    'text-sm': '14px',
    'text-md': '16px',
    'text-lg': '20px',
    'text-xl': '28px',
    'font-display': "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
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

    'shadow-1': '0 1px 2px rgba(0, 0, 0, 0.04)',
    'shadow-2': '0 2px 4px rgba(0, 0, 0, 0.06)',
    'shadow-3': '0 4px 8px rgba(0, 0, 0, 0.08)',
    'shadow-4': '0 6px 12px rgba(0, 0, 0, 0.1)',
    'shadow-5': '0 8px 24px rgba(0, 0, 0, 0.12)',
    'shadow-6': '0 12px 32px rgba(0, 0, 0, 0.16)',
    'shadow-7': '0 16px 48px rgba(0, 0, 0, 0.2)'
  }
} as const

export type LightTheme = typeof lightTheme
