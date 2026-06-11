/**
 * Theme registry - 5 themes
 * 通过 CSS 变量 (零运行时开销) 注入 :root 与 .theme-* 类
 */
import { darkTheme } from './dark'
import { lightTheme } from './light'
import { sepiaTheme } from './sepia'
import { midnightTheme } from './midnight'
import { neonTheme } from './neon'

export type ThemeName = 'dark' | 'light' | 'sepia' | 'midnight' | 'neon'

export interface ThemeDefinition {
  readonly name: ThemeName
  readonly tokens: Readonly<Record<string, string>>
}

export const themes: Record<ThemeName, ThemeDefinition> = {
  dark: darkTheme,
  light: lightTheme,
  sepia: sepiaTheme,
  midnight: midnightTheme,
  neon: neonTheme
}

export const themeNames: ThemeName[] = ['dark', 'light', 'sepia', 'midnight', 'neon']

/** generate CSS variables for a theme, scoped to .theme-<name> */
export function generateThemeCSS(theme: ThemeDefinition): string {
  const lines: string[] = []
  const selector = `.theme-${theme.name}, :root[data-theme="${theme.name}"]`
  lines.push(`${selector} {`)
  for (const [key, value] of Object.entries(theme.tokens)) {
    lines.push(`  --${key}: ${value};`)
  }
  lines.push('}')
  return lines.join('\n')
}

/** generate all 5 themes' CSS as a single string */
export function generateAllThemeCSS(): string {
  return themeNames.map((n) => generateThemeCSS(themes[n])).join('\n\n')
}

/** get theme by name, falls back to dark */
export function getTheme(name: string | null | undefined): ThemeDefinition {
  if (name && (name in themes)) {
    return themes[name as ThemeName]
  }
  return themes.dark
}

export { darkTheme, lightTheme, sepiaTheme, midnightTheme, neonTheme }

// --- 5 站扩展主题元数据 (派单 47) ---
export type AppThemeName = 'dark-workshop' | 'minimal-light' | 'creator-orange' | 'national-ink' | 'neon-cyber'

export interface AppThemeMeta {
  name: AppThemeName
  label: string
  desc: string
  preview: { bg: string; accent: string; text: string }
}

export const APP_THEME_LIST: AppThemeMeta[] = [
  { name: 'dark-workshop', label: '暗夜工坊', desc: '深夜创作 · 沉浸低光', preview: { bg: '#0e0f12', accent: '#ff7a45', text: '#e8eaed' } },
  { name: 'minimal-light', label: '极简白', desc: '白天办公 · 长时间阅读', preview: { bg: '#ffffff', accent: '#2563eb', text: '#1a1d23' } },
  { name: 'creator-orange', label: '创作橙', desc: '灵感迸发 · 激情创作', preview: { bg: '#fffaf5', accent: '#ff6b1a', text: '#2d1810' } },
  { name: 'national-ink', label: '国风墨', desc: '古风漫改 · 东方题材', preview: { bg: '#f5efe1', accent: '#a8302b', text: '#1a1612' } },
  { name: 'neon-cyber', label: '霓虹赛博', desc: '赛博朋克 · AI 视觉冲击', preview: { bg: '#0a0014', accent: '#ff00aa', text: '#f0e6ff' } },
]

export default themes
