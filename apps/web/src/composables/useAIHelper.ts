/**
 * useAIHelper — AI 辅助面板状态管理
 * ManhuaWorks · W3 工坊流程精修
 *
 * 6 大 AI 功能：
 * 1. auto_storyboard   — 自动分镜（小说 → 分镜列表）
 * 2. suggest_shot      — 推荐镜头（基于上下文）
 * 3. dialogue_polish   — 对白润色
 * 4. expression_gen    — 表情生成
 * 5. scene_lighting    — 场景光影建议
 * 6. consistency_check — 一致性检查（角色/场景）
 *
 * 后端协议：/v1/ai-helper/*
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { aiHelper, type AIHelperRequest, type AIHelperResult, type AIHelperType } from '@/api/ai-helper'

export interface UseAIHelperReturn {
  // 状态
  running: Ref<boolean>
  currentType: Ref<AIHelperType | null>
  lastResult: Ref<AIHelperResult | null>
  history: Ref<Array<{ type: AIHelperType; result: AIHelperResult; at: number }>>
  error: Ref<string | null>
  // 操作
  run: (type: AIHelperType, payload: Record<string, unknown>) => Promise<AIHelperResult | null>
  applySuggestion: (index: number) => void
  clear: () => void
  // 衍生
  hasResult: ComputedRef<boolean>
  suggestions: ComputedRef<string[]>
}

/**
 * AI 辅助 composable
 */
export function useAIHelper(): UseAIHelperReturn {
  const running = ref(false)
  const currentType = ref<AIHelperType | null>(null)
  const lastResult = ref<AIHelperResult | null>(null)
  const history = ref<Array<{ type: AIHelperType; result: AIHelperResult; at: number }>>([])
  const error = ref<string | null>(null)

  const hasResult = computed(() => lastResult.value !== null)

  const suggestions = computed<string[]>(() => {
    const r = lastResult.value
    if (!r) return []
    const data = r.data as Record<string, unknown> | undefined
    if (!data) return []
    if (Array.isArray(data.suggestions)) {
      return (data.suggestions as unknown[]).map(String)
    }
    if (typeof data.text === 'string') {
      // 拆行
      return data.text.split('\n').map((s) => s.trim()).filter(Boolean)
    }
    return []
  })

  async function run(type: AIHelperType, payload: Record<string, unknown>): Promise<AIHelperResult | null> {
    running.value = true
    currentType.value = type
    error.value = null
    try {
      const req: AIHelperRequest = { type, payload }
      const result = await aiHelper.run(req)
      lastResult.value = result
      history.value.unshift({ type, result, at: Date.now() })
      // 限制历史 50 条
      if (history.value.length > 50) history.value = history.value.slice(0, 50)
      return result
    } catch (err) {
      error.value = (err as Error).message
      return null
    } finally {
      running.value = false
      // 保留 200ms 让用户看到结束状态
      setTimeout(() => {
        if (currentType.value === type) currentType.value = null
      }, 200)
    }
  }

  function applySuggestion(index: number) {
    // 实际应用逻辑在调用方实现（因为不同功能的"应用"含义不同）
    // 这里只做标记 / 触发自定义事件
    const ev = new CustomEvent('ai-helper:apply', {
      detail: { index, type: currentType.value, result: lastResult.value }
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(ev)
    }
  }

  function clear() {
    lastResult.value = null
    currentType.value = null
    error.value = null
  }

  return {
    running,
    currentType,
    lastResult,
    history,
    error,
    run,
    applySuggestion,
    clear,
    hasResult,
    suggestions
  }
}

/** 6 大功能的元信息（用于 AIHelperPanel UI） */
export const AI_HELPER_FEATURES: Array<{
  type: AIHelperType
  label: string
  icon: string
  desc: string
  hotkey?: string
}> = [
  { type: 'auto_storyboard', label: '自动分镜', icon: '🎬', desc: '从小说文本智能拆分镜头', hotkey: 'A' },
  { type: 'suggest_shot', label: '推荐镜头', icon: '💡', desc: '基于上下文推荐镜头角度' },
  { type: 'dialogue_polish', label: '对白润色', icon: '✍️', desc: '让对白更自然有张力' },
  { type: 'expression_gen', label: '表情生成', icon: '😊', desc: '为角色生成 8 种表情' },
  { type: 'scene_lighting', label: '光影建议', icon: '🌅', desc: '智能推荐光影参数' },
  { type: 'consistency_check', label: '一致性检查', icon: '🔍', desc: '检查角色/场景/服装一致性' }
]
