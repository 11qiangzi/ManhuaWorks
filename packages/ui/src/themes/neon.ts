/**
 * Theme: Neon (neon-cyber)
 * ManhuaWorks 主题色板 - 霓虹赛博
 */
export const neonTheme = {
  name: 'neon',
  tokens: {
    /* brand palette (v2.0) */
    'brand-cyan': '#00BFA5',
    'brand-cyan-dark': '#0D9488',
    'brand-cyan-light': '#5EEAD4',
    'brand-purple': '#7C3AED',
    'brand-purple-dark': '#5B21B6',
    'brand-purple-light': '#A78BFA',

    primary: '#ff00aa',
    'primary-hover': '#ff33bb',
    'primary-active': '#cc0088',
    secondary: '#00f0ff',
    'secondary-hover': '#33f4ff',
    'secondary-active': '#00c0cc',
    accent: '#a78bd9',
    'accent-soft': '#ff66cc',

    success: '#00ff88',
    'success-bg': 'rgba(0, 255, 136, 0.1)',
    warning: '#ffea00',
    'warning-bg': 'rgba(255, 234, 0, 0.1)',
    error: '#ff0055',
    'error-bg': 'rgba(255, 0, 85, 0.1)',
    info: '#00f0ff',
    'info-bg': 'rgba(0, 240, 255, 0.1)',

    'bg-primary': '#0a0014',
    'bg-secondary': '#150028',
    'bg-tertiary': '#1f0a3d',
    'bg-elevated': '#2a0f4f',
    'bg-overlay': 'rgba(10, 0, 20, 0.7)',

    'text-primary': '#f0e6ff',
    'text-secondary': '#a78bd9',
    'text-tertiary': '#6b4d99',
    'text-inverse': '#0a0014',
    'text-link': '#00f0ff',

    'border-subtle': '#3d1a6b',
    'border-default': '#5e2a99',
    'border-strong': '#8a4dd0',

    'code-bg': '#150028',
    'code-text': '#f0e6ff',
    'gradient-brand': 'linear-gradient(135deg, #ff00aa 0%, #00f0ff 100%)',
    'glow-accent': '0 0 12px rgba(255, 0, 170, 0.4)',

    'gray-50': '#f0e6ff',
    'gray-100': '#d4c2e8',
    'gray-200': '#a78bd9',
    'gray-300': '#8a4dd0',
    'gray-400': '#5e2a99',
    'gray-500': '#3d1a6b',
    'gray-600': '#2a0f4f',
    'gray-700': '#1f0a3d',
    'gray-800': '#150028',
    'gray-900': '#0a0014',

    'text-xs': '12px',
    'text-sm': '14px',
    'text-md': '16px',
    'text-lg': '20px',
    'text-xl': '28px',
    'font-display': "'JetBrains Mono', 'Courier New', -apple-system, monospace",
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

    'shadow-1': '0 1px 2px rgba(255, 0, 170, 0.15)',
    'shadow-2': '0 2px 4px rgba(255, 0, 170, 0.2)',
    'shadow-3': '0 4px 8px rgba(255, 0, 170, 0.25)',
    'shadow-4': '0 6px 12px rgba(255, 0, 170, 0.3)',
    'shadow-5': '0 8px 32px rgba(255, 0, 170, 0.4)',
    'shadow-6': '0 12px 32px rgba(0, 240, 255, 0.35)',
    'shadow-7': '0 16px 48px rgba(255, 0, 170, 0.5)'
  }
} as const

export type NeonTheme = typeof neonTheme
