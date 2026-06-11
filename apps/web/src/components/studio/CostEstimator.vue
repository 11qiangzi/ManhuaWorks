<script setup lang="ts">
/**
 * CostEstimator · 成本估算器
 * 输入：供应商 / 模型 / 输入 token / 输出 token / 图片数 / 视频秒数
 * 输出：分项成本 + 总价
 *
 * 用本地静态表（不调后端）→ 即时反馈
 */

import { ref, computed, watch } from 'vue'
import { PROVIDERS, MODELS, localEstimate, estimateTokens, type Provider, type CallType } from '@/api/ai-router'

interface Props {
  /** 默认供应商 */
  defaultProvider?: Provider
  /** 默认模型 */
  defaultModel?: string
  /** 默认调用类型 */
  defaultCallType?: CallType
  /** 是否显示文本框（自动算 token） */
  showTextInput?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini',
  defaultCallType: 'text',
  showTextInput: true
})

const emit = defineEmits<{
  (e: 'change', value: { costUsd: number; inputTokens: number; outputTokens: number }): void
}>()

const provider = ref<Provider>(props.defaultProvider)
const callType = ref<CallType>(props.defaultCallType)
const model = ref<string>(props.defaultModel)
const inputText = ref('')
const inputTokens = ref(0)
const outputTokens = ref(1000)
const imageCount = ref(1)
const videoSeconds = ref(10)

/** 当前 provider 的可用模型（按 callType 过滤） */
const availableModels = computed(() => {
  if (callType.value === 'text') {
    return MODELS.filter((m) => m.provider === provider.value && m.capabilities.includes('text'))
  }
  return MODELS.filter((m) => m.provider === provider.value && m.capabilities.includes(callType.value))
})

/** 当前 provider 的元数据 */
const providerMeta = computed(() => PROVIDERS.find((p) => p.id === provider.value))

/** 默认模型（首项） */
const defaultModelForType = computed(() => {
  return availableModels.value[0]?.id ?? MODELS[0]!.id
})

/** 切换供应商/类型时，自动选首个可用模型 */
watch([provider, callType], () => {
  if (!availableModels.value.find((m) => m.id === model.value)) {
    model.value = defaultModelForType.value
  }
})

/** 文本输入 → token 估算 */
watch(inputText, (v) => {
  inputTokens.value = estimateTokens(v)
})

/** 当前 model 的元数据 */
const currentModel = computed(() => MODELS.find((m) => m.id === model.value))

/** 实时成本 */
const estimate = computed(() => {
  return localEstimate({
    provider: provider.value,
    model: model.value,
    inputTokens: inputTokens.value,
    outputTokens: callType.value === 'text' ? outputTokens.value : 0,
    imageCount: callType.value === 'image' ? imageCount.value : 0,
    videoSeconds: callType.value === 'video' ? videoSeconds.value : 0
  })
})

watch(estimate, (v) => {
  emit('change', { costUsd: v.costUsd, inputTokens: inputTokens.value, outputTokens: outputTokens.value })
}, { immediate: true })

const fmt = (n: number) => n.toFixed(n < 0.01 ? 6 : 4)
</script>

<template>
  <div class="cost-estimator">
    <header class="cost-estimator__head">
      <h3>💰 成本估算</h3>
      <p>输入参数 → 实时计算（本地静态表）</p>
    </header>

    <div class="cost-estimator__grid">
      <!-- 调用类型 -->
      <label class="cost-estimator__field">
        <span>调用类型</span>
        <select v-model="callType" class="ce-input">
          <option value="text">文字</option>
          <option value="image">图片</option>
          <option value="video">视频</option>
        </select>
      </label>

      <!-- 供应商 -->
      <label class="cost-estimator__field">
        <span>供应商</span>
        <select v-model="provider" class="ce-input">
          <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">
            {{ p.logo }} {{ p.name }}
          </option>
        </select>
      </label>

      <!-- 模型 -->
      <label class="cost-estimator__field cost-estimator__field--wide">
        <span>模型</span>
        <select v-model="model" class="ce-input">
          <option v-for="m in availableModels" :key="m.id" :value="m.id">
            {{ m.name }} · {{ m.id }}
          </option>
        </select>
      </label>
    </div>

    <!-- 文字参数 -->
    <div v-if="callType === 'text'" class="cost-estimator__text">
      <label v-if="showTextInput" class="cost-estimator__field cost-estimator__field--full">
        <span>小说 / 提示词（自动算 token）</span>
        <textarea
          v-model="inputText"
          rows="4"
          class="ce-input"
          placeholder="粘贴小说片段或提示词..."
        />
      </label>
      <div class="cost-estimator__row">
        <div class="cost-estimator__stat">
          <span>输入 token</span>
          <strong>{{ inputTokens.toLocaleString() }}</strong>
        </div>
        <label class="cost-estimator__field">
          <span>期望输出 token</span>
          <input v-model.number="outputTokens" type="number" min="0" step="100" class="ce-input" />
        </label>
      </div>
    </div>

    <!-- 图片参数 -->
    <div v-else-if="callType === 'image'" class="cost-estimator__row">
      <label class="cost-estimator__field">
        <span>生成张数</span>
        <input v-model.number="imageCount" type="number" min="1" max="100" class="ce-input" />
      </label>
      <div class="cost-estimator__stat">
        <span>单张价格</span>
        <strong>${{ providerMeta?.imagePricePerUnit?.toFixed(3) ?? '—' }}</strong>
      </div>
    </div>

    <!-- 视频参数 -->
    <div v-else-if="callType === 'video'" class="cost-estimator__row">
      <label class="cost-estimator__field">
        <span>视频时长（秒）</span>
        <input v-model.number="videoSeconds" type="number" min="1" max="600" class="ce-input" />
      </label>
      <div class="cost-estimator__stat">
        <span>每秒价格</span>
        <strong>${{ providerMeta?.videoPricePerSecond?.toFixed(2) ?? '—' }}</strong>
      </div>
    </div>

    <!-- 成本展示 -->
    <div class="cost-estimator__result">
      <div class="cost-estimator__breakdown">
        <div v-if="callType === 'text'" class="cost-estimator__line">
          <span>输入：{{ inputTokens.toLocaleString() }} × ${{ currentModel?.inputPricePer1k.toFixed(4) }}/1k</span>
          <code>${{ fmt(estimate.breakdown.inputCost) }}</code>
        </div>
        <div v-if="callType === 'text'" class="cost-estimator__line">
          <span>输出：{{ outputTokens.toLocaleString() }} × ${{ currentModel?.outputPricePer1k.toFixed(4) }}/1k</span>
          <code>${{ fmt(estimate.breakdown.outputCost) }}</code>
        </div>
        <div v-if="callType === 'image'" class="cost-estimator__line">
          <span>图片：{{ imageCount }} × ${{ providerMeta?.imagePricePerUnit?.toFixed(3) }}</span>
          <code>${{ fmt(estimate.breakdown.imageCost) }}</code>
        </div>
        <div v-if="callType === 'video'" class="cost-estimator__line">
          <span>视频：{{ videoSeconds }}s × ${{ providerMeta?.videoPricePerSecond?.toFixed(2) }}</span>
          <code>${{ fmt(estimate.breakdown.videoCost) }}</code>
        </div>
      </div>
      <div class="cost-estimator__total">
        <span>预计花费</span>
        <strong>${{ fmt(estimate.costUsd) }}</strong>
        <small>≈ ¥{{ (estimate.costUsd * 7.2).toFixed(2) }}</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cost-estimator {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.cost-estimator__head h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.cost-estimator__head p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.cost-estimator__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.cost-estimator__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cost-estimator__field--wide { grid-column: span 2; }
.cost-estimator__field--full { grid-column: 1 / -1; }

.cost-estimator__field > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.ce-input {
  padding: 8px 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  transition: border-color 200ms;
  width: 100%;
  box-sizing: border-box;
}

.ce-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow);
}

textarea.ce-input {
  resize: vertical;
  min-height: 70px;
  font-family: inherit;
}

.cost-estimator__text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cost-estimator__row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.cost-estimator__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 120px;
}

.cost-estimator__stat > span {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cost-estimator__stat > strong {
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
  color: var(--text-primary);
}

.cost-estimator__result {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 8px;
}

.cost-estimator__breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cost-estimator__line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  gap: 12px;
}

.cost-estimator__line code {
  font-family: monospace;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
}

.cost-estimator__total {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  flex-wrap: wrap;
}

.cost-estimator__total > span {
  font-size: 13px;
  color: var(--text-secondary);
}

.cost-estimator__total > strong {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  font-family: monospace;
}

.cost-estimator__total > small {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

@media (max-width: 640px) {
  .cost-estimator__field--wide { grid-column: span 1; }
}
</style>
