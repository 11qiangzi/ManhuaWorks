<script setup lang="ts">
/**
 * ModelSelectorView · 模型选择器
 * ManhuaWorks · W2
 *
 * 功能：
 * 1. 4 供应商卡片（横排）
 * 2. 选供应商后展示该供应商的模型（卡片网格）
 * 3. 对比表（价格/上下文/能力）
 * 4. 跳到项目编辑器或 BYOK 设置
 */

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import ProviderCard from '@/components/studio/ProviderCard.vue'
import ModelCard from '@/components/studio/ModelCard.vue'
import CostEstimator from '@/components/studio/CostEstimator.vue'
import FailoverIndicator from '@/components/studio/FailoverIndicator.vue'
import { PROVIDERS, MODELS, type Provider, type CallType, type ModelMeta } from '@/api/ai-router'
import { listKeys, type ByokKey } from '@/api/byok'

const route = useRoute()
const router = useRouter()

/** 从 query 读默认供应商 */
const providerParam = route.query.provider as Provider | undefined

const selectedProvider = ref<Provider | undefined>(providerParam)
const selectedModel = ref<string | undefined>(route.query.model as string | undefined)
const callType = ref<CallType>(((route.query.call_type as CallType) ?? 'text'))
const keys = ref<ByokKey[]>([])

/** 过滤后的模型 */
const filteredModels = computed(() => {
  if (!selectedProvider.value) {
    return MODELS.filter((m) => m.capabilities.includes(callType.value))
  }
  return MODELS.filter(
    (m) => m.provider === selectedProvider.value && m.capabilities.includes(callType.value)
  )
})

/** 当前选中的模型 */
const currentModel = computed<ModelMeta | undefined>(() => {
  if (!selectedModel.value) return undefined
  return MODELS.find((m) => m.id === selectedModel.value)
})

/** 该 provider 的 key 是否已配置 */
const hasKey = computed(() => {
  if (!selectedProvider.value) return true
  return keys.value.some(
    (k) => k.provider === selectedProvider.value && k.status === 'valid'
  )
})

/** 对比表数据 */
const comparisonRows = computed(() => {
  const rows = PROVIDERS.map((p) => {
    const textModel = MODELS.find((m) => m.provider === p.id && m.capabilities.includes('text'))
    const imgModel = MODELS.find((m) => m.provider === p.id && m.capabilities.includes('image'))
    return {
      provider: p,
      textModel: textModel?.name ?? '—',
      imageModel: imgModel?.name ?? '—',
      latency: p.avgLatencyMs,
      quality: p.qualityScore
    }
  })
  return rows
})

function onSelectProvider(id: Provider) {
  selectedProvider.value = id
  // 重置 model 选择
  selectedModel.value = undefined
}

function onSelectModel(id: string) {
  selectedModel.value = id
}

function onUseModel() {
  if (!selectedModel.value || !selectedProvider.value) return
  router.push({
    name: 'project-editor',
    query: {
      provider: selectedProvider.value,
      model: selectedModel.value,
      call_type: callType.value
    }
  })
}

function goByok() {
  router.push('/studio/byok')
}

onMounted(async () => {
  // 拉取 BYOK 列表（用于判断 provider 是否可用）
  try {
    const token = localStorage.getItem('token')
    if (token) {
      keys.value = await listKeys()
    }
  } catch {
    keys.value = []
  }
})
</script>

<template>
  <main class="model-selector">
    <!-- 顶栏 -->
    <header class="ms__nav">
      <div class="ms__brand">
        <button class="ms__back" @click="router.push('/studio')" title="返回工作台">←</button>
        <span class="ms__logo">M</span>
        <span class="ms__brand-name">模型选择器</span>
      </div>
      <div class="ms__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="ms__content">
      <!-- 标题 + 类型选择 -->
      <section class="ms__header">
        <div>
          <h1>选择 AI 模型</h1>
          <p>4 家供应商 · {{ MODELS.length }} 个模型 · 按价格 / 速度 / 质量自由组合</p>
        </div>
        <div class="ms__type">
          <label>调用类型</label>
          <div class="ms__type-chips">
            <button
              v-for="t in [['text', '文字'], ['image', '图片'], ['video', '视频']] as const"
              :key="t[0]"
              type="button"
              class="ms__type-chip"
              :class="{ 'ms__type-chip--on': callType === t[0] }"
              @click="callType = t[0]"
            >
              {{ t[1] }}
            </button>
          </div>
        </div>
      </section>

      <!-- 故障转移 -->
      <FailoverIndicator compact />

      <!-- 4 供应商 -->
      <section class="ms__section">
        <h2>① 选择供应商</h2>
        <div class="ms__provider-grid">
          <ProviderCard
            v-for="p in PROVIDERS"
            :key="p.id"
            :provider="p"
            :selected="selectedProvider === p.id"
            :disabled="!keys.some((k) => k.provider === p.id && k.status === 'valid')"
            @select="onSelectProvider"
          />
        </div>
        <p v-if="keys.length === 0" class="ms__hint">
          ⚠ 尚未配置任何 API Key
          <button type="button" @click="goByok">去配置 →</button>
        </p>
      </section>

      <!-- 模型网格 -->
      <section v-if="filteredModels.length > 0" class="ms__section">
        <h2>
          ② 选择模型
          <span v-if="selectedProvider">（{{ PROVIDERS.find(p => p.id === selectedProvider)?.name }}）</span>
        </h2>
        <div class="ms__model-grid">
          <ModelCard
            v-for="m in filteredModels"
            :key="m.id"
            :model="m"
            :selected="selectedModel === m.id"
            @select="onSelectModel"
          />
        </div>
      </section>

      <!-- 对比表 -->
      <section class="ms__section">
        <h2>③ 价格 / 速度 / 质量对比</h2>
        <div class="ms__table-wrap">
          <table class="ms__table">
            <thead>
              <tr>
                <th>供应商</th>
                <th>代表文字模型</th>
                <th>代表图片模型</th>
                <th>输入价</th>
                <th>输出价</th>
                <th>延迟</th>
                <th>质量</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in comparisonRows"
                :key="row.provider.id"
                :class="{ 'ms__table-row--active': selectedProvider === row.provider.id }"
              >
                <td>
                  <span class="ms__table-provider">
                    <span class="ms__table-logo">{{ row.provider.logo }}</span>
                    <span>{{ row.provider.name }}</span>
                  </span>
                </td>
                <td>{{ row.textModel }}</td>
                <td>{{ row.imageModel }}</td>
                <td><code>${{ row.provider.inputPricePer1k.toFixed(4) }}/1k</code></td>
                <td><code>${{ row.provider.outputPricePer1k.toFixed(4) }}/1k</code></td>
                <td>{{ row.latency }}ms</td>
                <td>
                  <div class="ms__quality">
                    <div class="ms__quality-bar">
                      <div
                        class="ms__quality-fill"
                        :style="{ width: row.quality + '%' }"
                      />
                    </div>
                    <span>{{ row.quality }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 成本估算 -->
      <section v-if="selectedModel && selectedProvider" class="ms__section">
        <h2>④ 成本估算</h2>
        <CostEstimator
          :default-provider="selectedProvider"
          :default-model="selectedModel"
          :default-call-type="callType"
        />
      </section>

      <!-- 底部行动 -->
      <div v-if="currentModel" class="ms__action-bar">
        <div>
          <strong>已选：{{ currentModel.name }}</strong>
          <span class="ms__action-desc">{{ currentModel.description }}</span>
        </div>
        <div class="ms__action-btns">
          <button type="button" class="qh-btn" @click="router.push('/studio')">取消</button>
          <button type="button" class="qh-btn qh-btn--primary" :disabled="!hasKey" @click="onUseModel">
            {{ hasKey ? '使用此模型生成 →' : '请先配置 API Key' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.model-selector {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* 顶栏 */
.ms__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.ms__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.ms__back {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
}

.ms__back:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ms__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gradient);
  color: white;
  font-size: 14px;
  font-weight: 800;
}

.ms__brand-name {
  font-size: 15px;
  font-weight: 600;
}

.ms__content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 28px 100px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.ms__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.ms__header h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ms__header p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.ms__type {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ms__type > label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.ms__type-chips {
  display: flex;
  gap: 6px;
}

.ms__type-chip {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.ms__type-chip:hover { border-color: var(--accent); color: var(--accent); }

.ms__type-chip--on {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.ms__section h2 {
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.ms__section h2 span {
  color: var(--text-secondary);
  font-weight: 400;
  font-size: 14px;
  margin-left: 4px;
}

.ms__provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.ms__model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.ms__hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--warning);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ms__hint button {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

/* 表格 */
.ms__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.ms__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 720px;
}

.ms__table th,
.ms__table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.ms__table th {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 600;
  letter-spacing: 0.05em;
  background: var(--bg-primary);
}

.ms__table tr:last-child td { border-bottom: none; }

.ms__table tr:hover td {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.ms__table-row--active td {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.ms__table-provider {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.ms__table-logo {
  font-size: 18px;
}

.ms__table code {
  font-family: monospace;
  font-size: 12px;
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 3px;
}

.ms__quality {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ms__quality-bar {
  width: 60px;
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--text-secondary) 18%, transparent);
  overflow: hidden;
}

.ms__quality-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 300ms ease;
}

.ms__quality span {
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
  min-width: 26px;
}

/* 行动栏 */
.ms__action-bar {
  position: sticky;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
  background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.ms__action-bar strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}

.ms__action-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.ms__action-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.qh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.qh-btn:hover { border-color: var(--accent); color: var(--accent); }

.qh-btn--primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.qh-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: var(--glow);
}

.qh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .ms__nav { padding: 12px 16px; }
  .ms__content { padding: 20px 16px 80px; }
  .ms__header h1 { font-size: 22px; }
  .ms__action-bar { flex-direction: column; align-items: stretch; }
  .ms__action-btns { width: 100%; }
  .ms__action-btns .qh-btn { flex: 1; justify-content: center; }
}
</style>
