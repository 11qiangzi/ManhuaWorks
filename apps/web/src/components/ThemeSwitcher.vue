<script setup lang="ts">
/**
 * ThemeSwitcher · 5 主题选择器
 * 千机工坊 · W1 交付
 *
 * 两种模式：
 * 1. 横向卡片网格（5 主题全展示）— 用于 HomeView / 设置页
 * 2. 下拉式（仅当前主题 + 切换按钮）— 用于 Dashboard 顶栏
 *
 * 通过 mode prop 切换。
 */

import { useTheme, THEME_LIST } from '@/composables/useTheme'

interface Props {
  /** 布局模式：grid 横向卡片 / compact 下拉 */
  mode?: 'grid' | 'compact'
}

withDefaults(defineProps<Props>(), { mode: 'grid' })

const { current, setTheme, currentMeta } = useTheme()
</script>

<template>
  <!-- 模式 1：横向卡片网格 -->
  <div v-if="mode === 'grid'" class="theme-switcher-grid">
    <button
      v-for="theme in THEME_LIST"
      :key="theme.name"
      type="button"
      class="theme-card"
      :class="{ active: current === theme.name }"
      :style="{
        background: theme.preview.bg,
        color: theme.preview.text,
        '--card-accent': theme.preview.accent
      }"
      @click="setTheme(theme.name)"
    >
      <div class="theme-card__swatch">
        <span
          class="theme-card__dot"
          :style="{ background: theme.preview.accent }"
        />
        <span
          class="theme-card__dot"
          :style="{
            background: theme.preview.accent,
            opacity: 0.6
          }"
        />
        <span
          class="theme-card__dot"
          :style="{
            background: theme.preview.accent,
            opacity: 0.3
          }"
        />
      </div>
      <div class="theme-card__label">
        <strong>{{ theme.label }}</strong>
        <span>{{ theme.desc }}</span>
      </div>
      <span v-if="current === theme.name" class="theme-card__check">✓</span>
    </button>
  </div>

  <!-- 模式 2：紧凑下拉 -->
  <div v-else class="theme-switcher-compact">
    <button type="button" class="theme-current" :title="`当前：${currentMeta.label}`">
      <span
        class="theme-current__dot"
        :style="{ background: currentMeta.preview.accent }"
      />
      <span class="theme-current__label">{{ currentMeta.label }}</span>
      <span class="theme-current__arrow">▾</span>
    </button>
    <div class="theme-dropdown">
      <button
        v-for="theme in THEME_LIST"
        :key="theme.name"
        type="button"
        class="theme-option"
        :class="{ active: current === theme.name }"
        @click="setTheme(theme.name)"
      >
        <span
          class="theme-option__dot"
          :style="{ background: theme.preview.accent }"
        />
        <span class="theme-option__name">{{ theme.label }}</span>
        <span v-if="current === theme.name" class="theme-option__check">✓</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ===== 模式 1：横向卡片网格 ===== */
.theme-switcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  width: 100%;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 18px 20px;
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow);
  overflow: hidden;
  min-height: 120px;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--card-accent);
}

.theme-card.active {
  border-color: var(--card-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--card-accent) 20%, transparent),
    var(--shadow);
  transform: translateY(-2px);
}

.theme-card__swatch {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.theme-card__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.theme-card__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-card__label strong {
  font-size: 16px;
  font-weight: 600;
}

.theme-card__label span {
  font-size: 12px;
  opacity: 0.7;
}

.theme-card__check {
  position: absolute;
  top: 12px;
  right: 14px;
  font-size: 18px;
  font-weight: bold;
  color: var(--card-accent);
}

/* ===== 模式 2：紧凑下拉 ===== */
.theme-switcher-compact {
  position: relative;
  display: inline-block;
}

.theme-current {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  transition: all 200ms;
}

.theme-current:hover {
  border-color: var(--accent);
}

.theme-current__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.theme-current__arrow {
  font-size: 10px;
  opacity: 0.6;
}

.theme-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: all 200ms;
}

.theme-switcher-compact:hover .theme-dropdown,
.theme-switcher-compact:focus-within .theme-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  transition: background 150ms;
}

.theme-option:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.theme-option.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.theme-option__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.theme-option__name {
  flex: 1;
}

.theme-option__check {
  color: var(--accent);
  font-weight: bold;
}
</style>
