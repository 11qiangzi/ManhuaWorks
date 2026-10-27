/**
 * 轻量 i18n 工具 — 不依赖 vue-i18n
 *
 * 用法：
 *   import { t } from '../i18n'
 *   t('common.save')              → '保存'
 *   t('export.timeAgo.seconds', { n: 30 })  → '30s 前'
 *   t('agent.greeting')           → '你好！我是 AI 工作流助手…'
 *
 * 未来迁移 vue-i18n 时只需替换此文件内部实现。
 */

import { zhCN } from './zh-CN'

type Messages = Record<string, unknown>

/** 按 . 分隔路径取值 */
function getByPath(obj: Messages, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Messages)[key]
  }
  return typeof current === 'string' ? current : undefined
}

/** 简单模板替换：{name} → 实际值 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key]
    return val != null ? String(val) : `{${key}}`
  })
}

/**
 * 翻译函数
 * @param key   点分路径，如 'common.save'
 * @param params 插值参数，如 { n: 30 }
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = getByPath(zhCN as unknown as Messages, key)
  if (raw == null) return key // fallback: 返回 key 本身
  return interpolate(raw, params)
}

/** 语言包引用（未来可扩展多语言） */
export const messages = { 'zh-CN': zhCN } as const

export type { TranslationKey } from './zh-CN'
