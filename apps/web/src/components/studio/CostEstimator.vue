<script setup lang="ts">
/**
 * CostEstimator - 成本估算器
 * ManhuaWorks studio component
 */

import { ref, computed } from 'vue'

interface Props {
  defaultProvider: string
  defaultModel: string
  defaultCallType: string
  showTextInput?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTextInput: true
})

function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const nonCjk = text.length - cjk
  return Math.ceil(cjk * 1.5 + nonCjk * 0.4)
}

const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  text: { input: 0.002, output: 0.006 },
  image: { input: 0.02, output: 0.04 },
  video: { input: 0.05, output: 0.10 }
}

const inputText = ref('')
const tokenInput = ref(1000)
const outputTokenRatio = ref(0.6)

const inputTokens = computed(() => {
  if (props.showTextInput && inputText.value) {
    return estimateTokens(inputText.value)
  }
  return tokenInput.value
})

const outputTokens = computed(() => Math.ceil(inputTokens.value * outputTokenRatio.value))
const prices = computed(() => PRICE_TABLE[props.defaultCallType] ?? PRICE_TABLE.text!)
const inputCost = computed(() => (inputTokens.value / 1000) * prices.value.input)
const outputCost = computed(() => (outputTokens.value / 1000) * prices.value.output)
const totalCost = computed(() => inputCost.value + outputCost.value)
</script>

<template>
  <div class="cost-estimator">
    <h3 class="cost-estimator__title">成本估算</h3>

    <div class="cost-estimator__info">
      <span class="cost-estimator__tag">{{ props.defaultProvider }}</span>
      <span class="cost-estimator__tag">{{ props.defaultModel }}</span>
      <span class="cost-estimator__tag cost-estimator__tag--type">{{ props.defaultCallType }}</span>
    </div>

    <div v-if="props.showTextInput" class="cost-estimator__input">
      <label class="cost-estimator__label">输入文本</label>
      <textarea
        v-model="inputText"
        rows="3"
        class="cost-estimator__textarea"
        placeholder="粘贴文本以估算成本..."
      />
    </div>

    <div v-if="!props.showTextInput || !inputText" class="cost-estimator__slider">
      <label class="cost-estimator__label">
        输入 tokens: <strong>{{ inputTokens.toLocaleString() }}</strong>
      </label>
      <input
        v-model.number="tokenInput"
        type="range"
        min="100"
        max="100000"
        step="100"
        class="cost-estimator__range"
      />
    </div>

    <div class="cost-estimator__slider">
      <label class="cost-estimator__label">
        输出比例: <strong>{{ (outputTokenRatio * 100).toFixed(0) }}%</strong>
      </label>
      <input
        v-model.number="outputTokenRatio"
        type="range"
        min="0.1"
        max="2.0"
        step="0.1"
        class="cost-estimator__range"
      />
    </div>

    <div class="cost-estimator__breakdown">
      <div class="cost-estimator__row">
        <span>输入 ({{ inputTokens.toLocaleString() }} tokens)</span>
        <code>${{ inputCost.toFixed(4) }}</code>
      </div>
      <div class="cost-estimator__row">
        <span>输出 ({{ outputTokens.toLocaleString() }} tokens)</span>
        <code>${{ outputCost.toFixed(4) }}</code>
      </div>
      <div class="cost-estimator__row cost-estimator__row--total">
        <span>预估总计</span>
        <strong>${{ totalCost.toFixed(4) }}</strong>
      </div>
    </div>

    <p class="cost-estimator__hint">
      单价: 输入 ${{ prices.input }}/1k · 输出 ${{ prices.output }}/1k
    </p>
  </div>
</template>

<style scoped>
.cost-estimator {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cost-estimator__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.cost-estimator__info {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cost-estimator__tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: monospace;
  border: 1px solid var(--border);
}

.cost-estimator__tag--type {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 20%, transparent);
}

.cost-estimator__label {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cost-estimator__label strong {
  color: var(--text-primary);
  font-family: monospace;
}

.cost-estimator__textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.cost-estimator__textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.cost-estimator__range {
  width: 100%;
  accent-color: var(--accent);
}

.cost-estimator__breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.cost-estimator__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.cost-estimator__row code {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary);
}

.cost-estimator__row--total {
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-primary);
}

.cost-estimator__row--total strong {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  font-family: monospace;
}

.cost-estimator__hint {
  margin: 0;
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
}
</style>
