<script setup lang="ts">
/**
 * ModelCard · 模型卡片
 * 展示：名称 / 能力标签 / 上下文长度 / 价格 / 描述
 */

import { computed } from 'vue'
import type { ModelMeta, Provider } from '@/api/ai-router'
import { PROVIDERS } from '@/api/ai-router'

interface Props {
  model: ModelMeta
  selected?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { selected: false, disabled: false })
const emit = defineEmits<{ (e: 'select', id: string): void }>()

const provider = computed<Provider | undefined>(() => PROVIDERS.find((p) => p.id === props.model.provider)?.id)
const providerName = computed(() => PROVIDERS.find((p) => p.id === props.model.provider)?.name ?? props.model.provider)
const providerLogo = computed(() => PROVIDERS.find((p) => p.id === props.model.provider)?.logo ?? '⚪')

const contextK = computed(() => {
  const n = props.model.contextLength
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  if (n > 0) return String(n)
  return '—'
})

const capLabels: Record<string, string> = {
  text: '文字',
  image: '图片',
  video: '视频',
  embed: '嵌入'
}

const onClick = () => {
  if (props.disabled) return
  emit('select', props.model.id)
}
</script>

<template>
  <button
    type="button"
    class="model-card"
    :class="{ 'model-card--selected': selected, 'model-card--disabled': disabled }"
    :disabled="disabled"
    @click="onClick"
  >
    <header class="model-card__header">
      <div class="model-card__provider">
        <span class="model-card__provider-logo">{{ providerLogo }}</span>
        <span class="model-card__provider-name">{{ providerName }}</span>
      </div>
      <span v-if="selected" class="model-card__check">✓</span>
    </header>

    <h3 class="model-card__name">{{ model.name }}</h3>
    <code class="model-card__id">{{ model.id }}</code>

    <p class="model-card__desc">{{ model.description }}</p>

    <ul class="model-card__caps">
      <li v-for="c in model.capabilities" :key="c" class="model-card__cap">
        {{ capLabels[c] ?? c }}
      </li>
    </ul>

    <div class="model-card__stats">
      <div class="model-card__stat">
        <span class="model-card__stat-label">上下文</span>
        <span class="model-card__stat-value">{{ contextK }}</span>
      </div>
      <div v-if="model.inputPricePer1k > 0" class="model-card__stat">
        <span class="model-card__stat-label">输入</span>
        <span class="model-card__stat-value">${{ model.inputPricePer1k.toFixed(4) }}<small>/1k</small></span>
      </div>
      <div v-if="model.outputPricePer1k > 0" class="model-card__stat">
        <span class="model-card__stat-label">输出</span>
        <span class="model-card__stat-value">${{ model.outputPricePer1k.toFixed(4) }}<small>/1k</small></span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.model-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
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

.model-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.model-card--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.model-card--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-card__provider {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.model-card__provider-logo {
  font-size: 16px;
  line-height: 1;
}

.model-card__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 12px;
  font-weight: 700;
}

.model-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.model-card__id {
  margin: -4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.model-card__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  min-height: 36px;
}

.model-card__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.model-card__cap {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-weight: 500;
}

.model-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.model-card__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 60px;
}

.model-card__stat-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.model-card__stat-value {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  color: var(--text-primary);
}

.model-card__stat-value small {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-secondary);
}
</style>
