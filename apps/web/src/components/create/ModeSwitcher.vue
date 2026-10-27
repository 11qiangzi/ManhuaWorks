<script setup lang="ts">
/**
 * ModeSwitcher.vue — 模式切换按钮组
 *
 * 林染 · P2 Phase B1.2 · 2026-06-21
 *
 * 两种创作模式：
 *   - 一键创作 (simple)：粘贴文本 → AI 全流程自动生成
 *   - 专业模式 (pro)：7 步手动编辑，逐镜头微调
 *
 * 品牌色：
 *   主色千机青 #00BFA5 · 辅色墨韵紫 #7C3AED
 *   按钮渐变 千机青→墨韵紫
 */

import { computed } from 'vue'

// =========================================================================
// Props & Emits
// =========================================================================

const props = defineProps<{
  mode: 'simple' | 'pro'
}>()

const emit = defineEmits<{
  'update:mode': [value: 'simple' | 'pro']
}>()

// =========================================================================
// 模式定义
// =========================================================================

interface ModeOption {
  key: 'simple' | 'pro'
  label: string
  subtitle: string
  icon: string
}

const MODES: ModeOption[] = [
  {
    key: 'simple',
    label: '一键创作',
    subtitle: '粘贴文本，AI 全流程自动出片',
    icon: '⚡',
  },
  {
    key: 'pro',
    label: '专业模式',
    subtitle: '7 步手动编辑，逐镜头微调',
    icon: '🎬',
  },
]

// =========================================================================
// 交互
// =========================================================================

function switchTo(mode: 'simple' | 'pro') {
  if (mode === props.mode) return
  emit('update:mode', mode)
}
</script>

<template>
  <div class="mode-switcher" role="radiogroup" aria-label="创作模式切换">
    <button
      v-for="m in MODES"
      :key="m.key"
      class="mode-btn"
      :class="{ 'mode-btn--active': mode === m.key }"
      role="radio"
      :aria-checked="mode === m.key"
      @click="switchTo(m.key)"
    >
      <span class="mode-btn__icon">{{ m.icon }}</span>
      <span class="mode-btn__body">
        <span class="mode-btn__label">{{ m.label }}</span>
        <span class="mode-btn__subtitle">{{ m.subtitle }}</span>
      </span>
      <span v-if="mode === m.key" class="mode-btn__check">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <div class="mode-switcher__gradient-bar" />
  </div>
</template>

<style scoped>
/* ================================================================
 *  ModeSwitcher — 品牌色主题
 * ================================================================ */

:root {
  --ms-bg: #0E0F12;
  --ms-surface: #141518;
  --ms-surface-hover: #1A1C21;
  --ms-border: #272A30;
  --ms-text: #FAFAFA;
  --ms-text-secondary: #A1A1AA;
  --ms-text-muted: #71717A;
  --ms-accent: #00BFA5;
  --ms-accent-secondary: #7C3AED;
  --ms-radius: 14px;
}

.mode-switcher {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--ms-surface);
  border: 1px solid var(--ms-border);
  border-radius: var(--ms-radius);
  position: relative;
  overflow: hidden;
}

.mode-switcher__gradient-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--ms-accent), var(--ms-accent-secondary));
  opacity: 0.6;
}

/* ── 按钮 ── */
.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.95rem 1.1rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--ms-radius) - 4px);
  color: var(--ms-text-secondary);
  cursor: pointer;
  transition: all 0.25s ease;
  text-align: left;
  position: relative;
  min-height: 72px;
}

.mode-btn:hover {
  background: var(--ms-surface-hover);
  color: var(--ms-text);
}

.mode-btn:active {
  transform: scale(0.98);
}

.mode-btn--active {
  background: linear-gradient(135deg,
    rgba(0, 191, 165, 0.06),
    rgba(124, 58, 237, 0.06)
  );
  border-color: color-mix(in srgb, var(--ms-accent) 30%, transparent);
  color: var(--ms-text);
}

.mode-btn__icon {
  font-size: 1.35rem;
  flex-shrink: 0;
  line-height: 1;
}

.mode-btn__body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mode-btn__label {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.mode-btn--active .mode-btn__label {
  background: linear-gradient(135deg, var(--ms-accent), var(--ms-accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.mode-btn__subtitle {
  font-size: 0.75rem;
  color: var(--ms-text-muted);
  line-height: 1.3;
}

.mode-btn--active .mode-btn__subtitle {
  color: var(--ms-text-secondary);
}

.mode-btn__check {
  flex-shrink: 0;
  color: var(--ms-accent);
  display: flex;
  align-items: center;
}

/* ── 响应式 ── */
@media (max-width: 480px) {
  .mode-switcher {
    flex-direction: column;
  }

  .mode-btn {
    min-height: auto;
    padding: 0.75rem 0.9rem;
  }
}
</style>
