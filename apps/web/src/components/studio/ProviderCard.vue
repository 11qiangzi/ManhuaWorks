<script setup lang="ts">
/**
 * ProviderCard · 4 供应商卡片
 * ManhuaWorks · W2
 *
 * 展示：logo / 名称 / 价格 / 延迟 / 质量评分 / 启用状态
 * 可选：点击展开详情 / 选中态
 */

import { computed } from 'vue'
import type { ProviderMeta } from '@/api/ai-router'

interface Props {
  provider: ProviderMeta
  /** 选中状态 */
  selected?: boolean
  /** 是否禁用（不可选） */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { selected: false, disabled: false })
const emit = defineEmits<{ (e: 'select', id: ProviderMeta['id']): void }>()

const qualityColor = computed(() => {
  const s = props.provider.qualityScore
  if (s >= 90) return 'var(--success)'
  if (s >= 80) return 'var(--accent)'
  return 'var(--warning)'
})

const latencyColor = computed(() => {
  const l = props.provider.avgLatencyMs
  if (l < 1500) return 'var(--success)'
  if (l < 3000) return 'var(--warning)'
  return 'var(--danger)'
})

function onClick() {
  if (props.disabled) return
  emit('select', props.provider.id)
}
</script>

<template>
  <button
    type="button"
    class="provider-card"
    :class="{ 'provider-card--selected': selected, 'provider-card--disabled': disabled }"
    :disabled="disabled"
    @click="onClick"
  >
    <header class="provider-card__header">
      <div class="provider-card__logo-wrap">
        <span class="provider-card__logo">{{ provider.logo }}</span>
        <span v-if="selected" class="provider-card__check" aria-label="selected">✓</span>
      </div>
      <div class="provider-card__title">
        <h3>{{ provider.name }}</h3>
        <p class="provider-card__id">{{ provider.id }}</p>
      </div>
    </header>

    <ul class="provider-card__stats">
      <li>
        <span class="provider-card__label">文字</span>
        <span class="provider-card__value">
          ${{ provider.inputPricePer1k.toFixed(4) }}<small>/1k in</small>
        </span>
      </li>
      <li>
        <span class="provider-card__label">输出</span>
        <span class="provider-card__value">
          ${{ provider.outputPricePer1k.toFixed(4) }}<small>/1k out</small>
        </span>
      </li>
      <li v-if="provider.imagePricePerUnit">
        <span class="provider-card__label">图片</span>
        <span class="provider-card__value">${{ provider.imagePricePerUnit.toFixed(3) }}<small>/张</small></span>
      </li>
      <li v-if="provider.videoPricePerSecond">
        <span class="provider-card__label">视频</span>
        <span class="provider-card__value">${{ provider.videoPricePerSecond.toFixed(2) }}<small>/秒</small></span>
      </li>
    </ul>

    <div class="provider-card__bar">
      <div class="provider-card__metric">
        <span class="provider-card__label">延迟</span>
        <span class="provider-card__metric-value" :style="{ color: latencyColor }">
          {{ provider.avgLatencyMs }}<small>ms</small>
        </span>
      </div>
      <div class="provider-card__metric">
        <span class="provider-card__label">质量</span>
        <div class="provider-card__quality">
          <div class="provider-card__quality-track">
            <div
              class="provider-card__quality-fill"
              :style="{ width: `${provider.qualityScore}%`, background: qualityColor }"
            />
          </div>
          <span class="provider-card__quality-num" :style="{ color: qualityColor }">
            {{ provider.qualityScore }}
          </span>
        </div>
      </div>
    </div>

    <footer class="provider-card__footer">
      <span v-if="provider.enabled" class="provider-card__status provider-card__status--on">● 可用</span>
      <span v-else class="provider-card__status provider-card__status--off">● 维护中</span>
      <span v-if="disabled" class="provider-card__hint">需配置 API Key</span>
    </footer>
  </button>
</template>

<style scoped>
.provider-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

.provider-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow), var(--glow);
}

.provider-card--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.provider-card--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.provider-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-card__logo-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  font-size: 24px;
  flex-shrink: 0;
}

.provider-card__check {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-secondary);
}

.provider-card__title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.provider-card__id {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.provider-card__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.provider-card__stats li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-card__label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.provider-card__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: monospace;
}

.provider-card__value small {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

.provider-card__bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.provider-card__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-card__metric-value {
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
}

.provider-card__metric-value small {
  font-size: 10px;
  font-weight: 400;
  margin-left: 2px;
  color: var(--text-secondary);
}

.provider-card__quality {
  display: flex;
  align-items: center;
  gap: 6px;
}

.provider-card__quality-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--text-secondary) 18%, transparent);
  overflow: hidden;
}

.provider-card__quality-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;
}

.provider-card__quality-num {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  min-width: 22px;
  text-align: right;
}

.provider-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.provider-card__status--on { color: var(--success); }
.provider-card__status--off { color: var(--text-secondary); }

.provider-card__hint {
  color: var(--warning);
  font-size: 11px;
}
</style>
