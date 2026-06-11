<script setup lang="ts">
/**
 * AIHelperPanel · AI 辅助面板
 * ManhuaWorks · W3 工坊流程精修
 *
 * 6 功能按钮 + 实时建议
 * 设计为可折叠的侧边面板
 */
import { ref, computed } from 'vue'
import { useAIHelper, AI_HELPER_FEATURES } from '@/composables/useAIHelper'
import type { AIHelperType } from '@/api/ai-helper'

const props = withDefaults(defineProps<{
  /** 默认折叠 */
  defaultCollapsed?: boolean
  /** 是否显示历史 */
  showHistory?: boolean
  /** 当前上下文（小说文本/分镜/对白） */
  context?: Record<string, unknown>
  /** 自定义上下文类型提示 */
  contextHint?: string
  position?: 'left' | 'right'
}>(), {
  defaultCollapsed: false,
  showHistory: true,
  context: () => ({}),
  contextHint: '',
  position: 'right'
})

const emit = defineEmits<{
  (e: 'feature', type: AIHelperType, payload: Record<string, unknown>): void
  (e: 'apply', index: number, text: string): void
}>()

const helper = useAIHelper()
const collapsed = ref(props.defaultCollapsed)

function onRun(type: AIHelperType) {
  // 自动把 context 一起带上
  helper.run(type, props.context)
  emit('feature', type, props.context)
}

function onApply(index: number) {
  const text = helper.suggestions.value[index] ?? ''
  if (text) {
    emit('apply', index, text)
  }
  helper.applySuggestion(index)
}

function toggle() {
  collapsed.value = !collapsed.value
}

const isRunning = computed(() => helper.running.value)
const currentType = computed(() => helper.currentType.value)
</script>

<template>
  <aside
    class="ai-panel"
    :class="{
      'ai-panel--collapsed': collapsed,
      [`ai-panel--${position}`]: true
    }"
  >
    <!-- 头部（标题 + 折叠按钮） -->
    <header class="ai-panel__head">
      <div class="ai-panel__title">
        <span class="ai-panel__icon">🤖</span>
        <strong>AI 辅助</strong>
        <span v-if="isRunning" class="ai-panel__running" title="正在运行">●</span>
      </div>
      <button
        type="button"
        class="ai-panel__toggle"
        :title="collapsed ? '展开' : '折叠'"
        @click="toggle"
      >
        {{ collapsed ? '◀' : '▶' }}
      </button>
    </header>

    <!-- 主体 -->
    <div v-show="!collapsed" class="ai-panel__body">
      <!-- 上下文提示 -->
      <div v-if="contextHint" class="ai-panel__hint">
        <span class="ai-panel__hint-icon">💡</span>
        <span>{{ contextHint }}</span>
      </div>

      <!-- 6 大功能按钮 -->
      <div class="ai-panel__features">
        <button
          v-for="f in AI_HELPER_FEATURES"
          :key="f.type"
          type="button"
          class="ai-panel__feature"
          :class="{
            'ai-panel__feature--on': currentType === f.type,
            'ai-panel__feature--running': isRunning && currentType === f.type
          }"
          :disabled="isRunning"
          :title="f.desc + (f.hotkey ? `（快捷键 ⌘${f.hotkey}）` : '')"
          @click="onRun(f.type)"
        >
          <span class="ai-panel__feature-icon">{{ f.icon }}</span>
          <span class="ai-panel__feature-label">
            <strong>{{ f.label }}</strong>
            <small>{{ f.desc }}</small>
          </span>
          <span v-if="isRunning && currentType === f.type" class="ai-panel__feature-spin">⏳</span>
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="helper.error.value" class="ai-panel__error">
        <span>⚠ {{ helper.error.value }}</span>
      </div>

      <!-- 结果区 -->
      <div v-if="helper.hasResult.value" class="ai-panel__result">
        <header class="ai-panel__result-head">
          <strong>✨ 建议</strong>
          <button
            type="button"
            class="ai-panel__result-clear"
            title="清空结果"
            @click="helper.clear()"
          >×</button>
        </header>

        <ol v-if="helper.suggestions.value.length > 0" class="ai-panel__suggestions">
          <li
            v-for="(s, idx) in helper.suggestions.value"
            :key="idx"
            class="ai-panel__suggestion"
          >
            <div class="ai-panel__suggestion-text">{{ s }}</div>
            <button
              type="button"
              class="ai-panel__suggestion-apply"
              title="应用此建议"
              @click="onApply(idx)"
            >应用</button>
          </li>
        </ol>

        <div v-else class="ai-panel__result-empty">
          {{ typeof helper.lastResult.value?.data === 'object' ? '已收到响应，但无可显示建议' : '已收到响应' }}
        </div>

        <footer v-if="helper.lastResult.value" class="ai-panel__result-meta">
          <span>⏱ {{ helper.lastResult.value.durationMs }}ms</span>
          <span>· ${{ helper.lastResult.value.costUsd.toFixed(4) }}</span>
          <span v-if="helper.lastResult.value.model">· {{ helper.lastResult.value.model }}</span>
        </footer>
      </div>

      <!-- 历史 -->
      <div v-if="showHistory && helper.history.value.length > 0" class="ai-panel__history">
        <header class="ai-panel__history-head">
          <strong>🕐 历史</strong>
        </header>
        <ul class="ai-panel__history-list">
          <li
            v-for="(h, idx) in helper.history.value.slice(0, 5)"
            :key="idx"
            class="ai-panel__history-item"
            :title="`${AI_HELPER_FEATURES.find(f => f.type === h.type)?.label || h.type} · ${new Date(h.at).toLocaleString('zh-CN')}`"
          >
            <span>{{ AI_HELPER_FEATURES.find(f => f.type === h.type)?.icon || '🤖' }}</span>
            <span class="ai-panel__history-label">{{ AI_HELPER_FEATURES.find(f => f.type === h.type)?.label || h.type }}</span>
            <span class="ai-panel__history-time">{{ new Date(h.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

.ai-panel--collapsed { width: 56px; }
.ai-panel:not(.ai-panel--collapsed) { width: 320px; max-width: 100%; }

/* ===== 头部 ===== */
.ai-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ai-panel__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.ai-panel__icon { font-size: 16px; }

.ai-panel__running {
  color: var(--accent);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ai-panel__toggle {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  flex-shrink: 0;
}

.ai-panel__toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ===== 主体 ===== */
.ai-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.ai-panel__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.ai-panel__hint-icon { font-size: 14px; flex-shrink: 0; }

/* ===== 6 大功能 ===== */
.ai-panel__features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.ai-panel__feature {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 8px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: all 200ms;
  min-height: 60px;
}

.ai-panel__feature:hover:not(:disabled) {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.ai-panel__feature:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-panel__feature--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-primary));
}

.ai-panel__feature--running {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }
}

.ai-panel__feature-icon { font-size: 20px; }

.ai-panel__feature-label {
  display: flex;
  flex-direction: column;
  gap: 0;
  font-size: 11px;
  min-width: 0;
}

.ai-panel__feature-label strong {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-primary);
}

.ai-panel__feature-label small {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ai-panel__feature-spin {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 12px;
  animation: spin 1.2s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 错误 ===== */
.ai-panel__error {
  padding: 8px 10px;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  border-radius: 6px;
  font-size: 11px;
  color: var(--danger);
}

/* ===== 结果 ===== */
.ai-panel__result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.ai-panel__result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
  color: var(--text-primary);
}

.ai-panel__result-clear {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  font-family: inherit;
}

.ai-panel__result-clear:hover {
  background: var(--bg-secondary);
  color: var(--danger);
}

.ai-panel__suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.ai-panel__suggestion {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
}

.ai-panel__suggestion-text {
  flex: 1;
  word-break: break-word;
  color: var(--text-primary);
}

.ai-panel__suggestion-apply {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: all 150ms;
}

.ai-panel__suggestion-apply:hover {
  background: var(--accent);
  color: var(--bg-primary);
}

.ai-panel__result-empty {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  padding: 8px;
}

.ai-panel__result-meta {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

/* ===== 历史 ===== */
.ai-panel__history {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-panel__history-head {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.ai-panel__history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-panel__history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 11px;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: default;
}

.ai-panel__history-item:hover { background: var(--bg-primary); }

.ai-panel__history-label { flex: 1; }

.ai-panel__history-time { font-family: monospace; font-size: 10px; opacity: 0.7; }
</style>
