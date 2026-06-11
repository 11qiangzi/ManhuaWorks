<script setup lang="ts">
/**
 * ThemeSwitcher.vue · 主题切换器
 * ManhuaWorks · W4 用户后台（内联版）
 *
 * mode='compact'  → 顶栏用的小按钮
 * mode='grid'     → 设置页用的大卡片
 */

import { useTheme, type ThemeMeta } from '@/composables/useTheme'

interface Props {
  mode?: 'compact' | 'grid'
}

withDefaults(defineProps<Props>(), { mode: 'compact' })

const { themes, currentMeta, setTheme } = useTheme()

function pick(t: ThemeMeta) {
  setTheme(t.name)
}
</script>

<template>
  <!-- 紧凑模式：单按钮 + 弹出下拉 -->
  <div v-if="mode === 'compact'" class="ts ts--compact">
    <button type="button" class="ts__btn" :title="`主题：${currentMeta.label}`">
      🎨 {{ currentMeta.label }}
    </button>
    <div class="ts__menu">
      <button
        v-for="t in themes"
        :key="t.name"
        type="button"
        class="ts__option"
        :class="{ 'ts__option--active': t.name === currentMeta.name }"
        @click="pick(t)"
      >
        <span class="ts__swatch" :style="{ background: t.preview.bg, borderColor: t.preview.accent }">
          <span class="ts__swatch-dot" :style="{ background: t.preview.accent }"></span>
        </span>
        <span class="ts__label">{{ t.label }}</span>
        <span v-if="t.name === currentMeta.name" class="ts__check">✓</span>
      </button>
    </div>
  </div>

  <!-- 网格模式：5 卡片 -->
  <div v-else class="ts ts--grid">
    <button
      v-for="t in themes"
      :key="t.name"
      type="button"
      class="ts__card"
      :class="{ 'ts__card--active': t.name === currentMeta.name }"
      :style="{
        background: t.preview.bg,
        color: t.preview.text,
        borderColor: t.name === currentMeta.name ? t.preview.accent : 'transparent'
      }"
      @click="pick(t)"
    >
      <div class="ts__card-head">
        <span class="ts__card-accent" :style="{ background: t.preview.accent }"></span>
        <span class="ts__card-name">{{ t.label }}</span>
        <span v-if="t.name === currentMeta.name" class="ts__card-check">✓</span>
      </div>
      <p class="ts__card-desc">{{ t.desc }}</p>
    </button>
  </div>
</template>

<style scoped>
/* ===== Compact ===== */
.ts--compact {
  position: relative;
}

.ts__btn {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.ts__btn:hover {
  border-color: var(--accent);
}

.ts__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 4px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: all 180ms;
  z-index: 60;
}

.ts--compact:hover .ts__menu {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.ts__option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 150ms;
}

.ts__option:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.ts__option--active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.ts__swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ts__swatch-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.ts__label {
  flex: 1;
}

.ts__check {
  color: var(--accent);
  font-weight: 700;
}

/* ===== Grid ===== */
.ts--grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.ts__card {
  padding: 16px;
  border: 2px solid;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.ts__card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.ts__card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ts__card-accent {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.ts__card-name {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.ts__card-check {
  font-size: 16px;
  font-weight: 700;
}

.ts__card-desc {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
}
</style>