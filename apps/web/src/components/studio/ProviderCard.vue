<script setup lang="ts">
/**
 * ProviderCard - AI 供应商选择卡片
 * ManhuaWorks studio component
 */

interface ProviderInfo {
  id: string
  name: string
  logo: string
  inputPricePer1k: number
  outputPricePer1k: number
  avgLatencyMs: number
  qualityScore: number
  [key: string]: unknown
}

interface Props {
  provider: ProviderInfo
  selected?: boolean
  disabled?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  disabled: false,
  compact: false
})

const emit = defineEmits<{
  select: [id: string]
}>()

function onClick() {
  if (props.disabled) return
  emit('select', props.provider.id)
}
</script>

<template>
  <button
    type="button"
    class="provider-card"
    :class="{
      'provider-card--selected': props.selected,
      'provider-card--disabled': props.disabled,
      'provider-card--compact': props.compact
    }"
    :disabled="props.disabled"
    @click="onClick"
  >
    <div class="provider-card__head">
      <span class="provider-card__logo">{{ provider.logo }}</span>
      <strong class="provider-card__name">{{ provider.name }}</strong>
      <span v-if="props.selected" class="provider-card__check">&#10003;</span>
    </div>

    <div v-if="!props.compact" class="provider-card__stats">
      <div class="provider-card__stat">
        <span class="provider-card__stat-label">输入</span>
        <code>${{ provider.inputPricePer1k.toFixed(4) }}/1k</code>
      </div>
      <div class="provider-card__stat">
        <span class="provider-card__stat-label">输出</span>
        <code>${{ provider.outputPricePer1k.toFixed(4) }}/1k</code>
      </div>
      <div class="provider-card__stat">
        <span class="provider-card__stat-label">延迟</span>
        <code>{{ provider.avgLatencyMs }}ms</code>
      </div>
      <div class="provider-card__stat">
        <span class="provider-card__stat-label">质量</span>
        <div class="provider-card__quality">
          <div class="provider-card__quality-bar">
            <div class="provider-card__quality-fill" :style="{ width: provider.qualityScore + '%' }" />
          </div>
          <span>{{ provider.qualityScore }}</span>
        </div>
      </div>
    </div>

    <span v-if="props.disabled" class="provider-card__disabled-hint">
      未配置 Key
    </span>
  </button>
</template>

<style scoped>
.provider-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text-primary);
  transition: all 200ms;
  position: relative;
}

.provider-card:hover:not(:disabled) {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.provider-card--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
  box-shadow: var(--glow);
}

.provider-card--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.provider-card--compact {
  padding: 12px;
  gap: 6px;
}

.provider-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-card__logo {
  font-size: 22px;
  line-height: 1;
}

.provider-card--compact .provider-card__logo {
  font-size: 18px;
}

.provider-card__name {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.provider-card--compact .provider-card__name {
  font-size: 13px;
}

.provider-card__check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.provider-card__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}

.provider-card__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-card__stat-label {
  font-size: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.provider-card__stat code {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-primary);
  padding: 1px 5px;
  border-radius: 3px;
}

.provider-card__quality {
  display: flex;
  align-items: center;
  gap: 6px;
}

.provider-card__quality-bar {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--text-secondary) 18%, transparent);
  overflow: hidden;
}

.provider-card__quality-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}

.provider-card__quality span {
  font-size: 10px;
  font-weight: 600;
  font-family: monospace;
}

.provider-card__disabled-hint {
  font-size: 11px;
  color: var(--warning, #f59e0b);
  font-weight: 500;
}
</style>
