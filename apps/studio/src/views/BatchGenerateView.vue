<script setup lang="ts">
/**
 * BatchGenerateView.vue — 批量生成设置 (1:1 复刻 studio-batch-generate.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import { useWorkflowStore } from '../stores/workflow'
import { useWorkflowRunner } from '../composables/useWorkflowRunner'

const router = useRouter()
const toast = useToast()
const store = useWorkflowStore()
const runner = useWorkflowRunner()

// ── Workflow context from store ──────────────────────────────────────────────
const workflowName = computed(() => store.current?.name ?? '未加载工作流')
const workflowNodes = computed(() => store.current?.nodes ?? [])

// ── Seed configuration ───────────────────────────────────────────────────────
const selectedSeed = ref(42)
const seeds = ref<number[]>([42, 128, 256, 512, 1024, 2048, 4096, 8192])

// ── Prompt variants ──────────────────────────────────────────────────────────
const promptVariants = ref([
  { id: 'main', label: '主提示词', text: '少年剑修，白衣黑发，眼神坚定，古风仙侠风格，masterpiece', active: true },
  { id: 'v1', label: '变体 1', text: '少年剑修，白衣黑发，眼神坚定，水墨画风，留白构图', active: false },
  { id: 'v2', label: '变体 2', text: '少年剑修，白衣黑发，特写镜头，表情微怒，光影对比强', active: false },
])

// ── Styles (multi-select for batch combinations) ─────────────────────────────
const styles = ['🎌 动漫 (默认)', '🖋️ 水墨', '📷 写实', '✏️ 素描', '🎮 赛博']
const activeStyles = ref<number[]>([0])

function toggleStyle(i: number) {
  const idx = activeStyles.value.indexOf(i)
  if (idx >= 0) {
    // Keep at least one style active
    if (activeStyles.value.length > 1) activeStyles.value.splice(idx, 1)
  } else {
    activeStyles.value.push(i)
  }
}

// ── Episode range selection ──────────────────────────────────────────────────
const TOTAL_EPISODES = 24
const episodeStart = ref(1)
const episodeEnd = ref(12)

function clampEpisodeRange() {
  if (episodeStart.value < 1) episodeStart.value = 1
  if (episodeStart.value > TOTAL_EPISODES) episodeStart.value = TOTAL_EPISODES
  if (episodeEnd.value < episodeStart.value) episodeEnd.value = episodeStart.value
  if (episodeEnd.value > TOTAL_EPISODES) episodeEnd.value = TOTAL_EPISODES
}

const episodeRange = computed(() => {
  const eps: number[] = []
  for (let i = episodeStart.value; i <= episodeEnd.value; i++) eps.push(i)
  return eps
})

// ── Quality preset selection ──────────────────────────────────────────────────
type QualityPresetId = 'draft' | 'standard' | 'hd' | 'ultra'

interface QualityPreset {
  id: QualityPresetId
  name: string
  description: string
  resolution: string
  multiplier: number // cost multiplier
  icon: string
}

const qualityPresets: QualityPreset[] = [
  { id: 'draft', name: '草稿', description: '快速预览，低分辨率', resolution: '512×512', multiplier: 0.5, icon: '⚡' },
  { id: 'standard', name: '标准', description: '平衡质量与速度', resolution: '1024×1024', multiplier: 1.0, icon: '📐' },
  { id: 'hd', name: '高清', description: '高分辨率，适合交付', resolution: '1536×1536', multiplier: 2.0, icon: '✨' },
  { id: 'ultra', name: '超清', description: '最高质量，耗时较长', resolution: '2048×2048', multiplier: 4.0, icon: '💎' },
]

const selectedQuality = ref<QualityPresetId>('standard')
const activeQualityPreset = computed(() => qualityPresets.find(q => q.id === selectedQuality.value) ?? qualityPresets[1])

// ── Parallel generation toggle ────────────────────────────────────────────────
const parallelEnabled = ref(true)
const parallelCount = ref(3)

// ── Per-episode progress tracking ────────────────────────────────────────────
type EpisodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

interface EpisodeProgress {
  episode: number
  status: EpisodeStatus
  progress: number
  step: string
  imageUrl: string | null
  error: string | null
  startedAt: number | null
  finishedAt: number | null
  timerHandle: ReturnType<typeof setInterval> | null
}

const episodeProgressMap = ref<Map<number, EpisodeProgress>>(new Map())

function getEpisodeProgress(ep: number): EpisodeProgress {
  let entry = episodeProgressMap.value.get(ep)
  if (!entry) {
    entry = {
      episode: ep,
      status: 'pending',
      progress: 0,
      step: '等待中',
      imageUrl: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      timerHandle: null,
    }
    episodeProgressMap.value.set(ep, entry)
  }
  return entry
}

const completedEpisodes = computed(() => {
  let count = 0
  episodeProgressMap.value.forEach(ep => { if (ep.status === 'completed') count++ })
  return count
})

const failedEpisodes = computed(() => {
  let count = 0
  episodeProgressMap.value.forEach(ep => { if (ep.status === 'failed') count++ })
  return count
})

const runningEpisodes = computed(() => {
  let count = 0
  episodeProgressMap.value.forEach(ep => { if (ep.status === 'running') count++ })
  return count
})

// ── Batch math ───────────────────────────────────────────────────────────────
const CARDS_PER_PAGE = 6
const totalCount = computed(() => seeds.value.length * promptVariants.value.length * activeStyles.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / CARDS_PER_PAGE)))
const estimatedTime = computed(() => `${Math.round(totalCount.value * 0.125)} 分钟`)
const estimatedCost = computed(() => `¥${(totalCount.value * 0.015).toFixed(2)}`)

// ── Preview cards (all seed × prompt × style combos, paginated) ──────────────
const pagedCards = computed(() => {
  const all: Array<{ key: string; seed: number; promptLabel: string; styleLabel: string }> = []
  for (const s of seeds.value) {
    for (const p of promptVariants.value) {
      for (const si of activeStyles.value) {
        all.push({
          key: `${s}-${p.id}-${si}`,
          seed: s,
          promptLabel: p.label,
          styleLabel: styles[si],
        })
      }
    }
  }
  const start = (currentPage.value - 1) * CARDS_PER_PAGE
  return all.slice(start, start + CARDS_PER_PAGE)
})

// ── Pagination ───────────────────────────────────────────────────────────────
const currentPage = ref(1)

// Clamp current page when total pages shrinks
watch(totalPages, (max) => {
  if (currentPage.value > max) currentPage.value = max
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

// ── Timer handles for cleanup ─────────────────────────────────────────────────
let _progressInterval: ReturnType<typeof setInterval> | null = null
let _completionTimeout: ReturnType<typeof setTimeout> | null = null

// ── Batch generation state ───────────────────────────────────────────────────
const batchLoading = ref(false)
const batchProgress = ref(0)
const editingVariantId = ref<string | null>(null)

// Sync with runner: if the real runner finishes while we're loading, reflect it
watch(
  () => runner.isRunning.value,
  (running) => {
    if (!running && batchLoading.value && batchProgress.value >= 90) {
      batchProgress.value = 100
      batchLoading.value = false
      toast.success(`批量生成完成！共 ${totalCount.value} 张`)
    }
  },
)

function goBack() {
  router.push('/workflow')
}

async function onStartBatch() {
  if (batchLoading.value) return

  // Mark the workflow as dirty to track the batch operation
  store.markDirty()

  batchLoading.value = true
  batchProgress.value = 0

  // Clamp episode range
  clampEpisodeRange()

  // Reset episode progress for selected range
  episodeProgressMap.value.clear()

  // Kick off the workflow via the runner if a workflow is loaded.
  if (store.current) {
    runner.runWorkflow(store.current).catch((e) => { console.warn('batch run failed:', e) })
  }

  // Launch per-episode simulations
  const episodes = episodeRange.value
  const maxParallel = parallelEnabled.value ? parallelCount.value : 1
  let launched = 0

  function launchNext() {
    while (launched < episodes.length && runningEpisodes.value < maxParallel) {
      const ep = episodes[launched]
      simulateEpisode(ep)
      launched++
    }
  }

  launchNext()

  // Periodically check for completed episodes and launch next ones
  const episodeMonitor = setInterval(() => {
    if (!batchLoading.value) {
      clearInterval(episodeMonitor)
      return
    }
    launchNext()

    // Update overall batch progress based on episode completion
    const total = episodes.length
    const done = completedEpisodes.value + failedEpisodes.value
    batchProgress.value = total > 0 ? Math.round((done / total) * 100) : 0

    if (done >= total) {
      clearInterval(episodeMonitor)
      batchProgress.value = 100
      batchLoading.value = false
      toast.success(`批量生成完成！${completedEpisodes.value} 成功，${failedEpisodes.value} 失败`)
    }
  }, 500)

  // Clear any lingering timers from a previous run
  if (_progressInterval) clearInterval(_progressInterval)
  if (_completionTimeout) clearTimeout(_completionTimeout)
  _progressInterval = episodeMonitor
}

function onCancelBatch() {
  cancelAllEpisodes()
  if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null }
  if (_completionTimeout) { clearTimeout(_completionTimeout); _completionTimeout = null }
  runner.cancel().catch((e) => { console.warn('cancel failed:', e) })
  batchLoading.value = false
  batchProgress.value = 0
  toast.info('批量生成已取消')
}

function onRandomSeed() {
  const newSeed = Math.floor(Math.random() * 9999) + 1
  seeds.value.push(newSeed)
  selectedSeed.value = newSeed
  toast.info(`已添加随机种子: ${newSeed}`)
}

function onAddVariant() {
  const id = `v${Date.now().toString(36)}`
  promptVariants.value.push({
    id,
    label: `变体 ${promptVariants.value.length}`,
    text: '',
    active: false,
  })
  editingVariantId.value = id
}

function onEditVariant(variantId: string) {
  editingVariantId.value = editingVariantId.value === variantId ? null : variantId
}

// ── Per-episode generation simulation ────────────────────────────────────────
function simulateEpisode(ep: number): void {
  const entry = getEpisodeProgress(ep)
  entry.status = 'running'
  entry.progress = 0
  entry.step = '排队中'
  entry.startedAt = Date.now()
  entry.error = null
  entry.finishedAt = null

  const steps = ['解析提示词', '生成构图', '渲染图像', '后处理', '保存结果']
  let stepIdx = 0

  entry.timerHandle = setInterval(() => {
    if (entry.status !== 'running') {
      if (entry.timerHandle) clearInterval(entry.timerHandle)
      entry.timerHandle = null
      return
    }
    entry.progress = Math.min(100, entry.progress + Math.floor(Math.random() * 12) + 3)
    if (entry.progress >= (stepIdx + 1) * 20 && stepIdx < steps.length - 1) {
      stepIdx++
    }
    entry.step = steps[stepIdx]

    if (entry.progress >= 100) {
      entry.status = 'completed'
      entry.step = '已完成'
      entry.progress = 100
      entry.finishedAt = Date.now()
      if (entry.timerHandle) clearInterval(entry.timerHandle)
      entry.timerHandle = null
    }
  }, 400 + Math.random() * 300)

  // Small chance of failure for realism
  setTimeout(() => {
    if (entry.status === 'running' && Math.random() < 0.08) {
      entry.status = 'failed'
      entry.step = '生成失败'
      entry.error = '网络超时或生成异常，请重试'
      entry.finishedAt = Date.now()
      if (entry.timerHandle) clearInterval(entry.timerHandle)
      entry.timerHandle = null
    }
  }, 3000 + Math.random() * 5000)
}

function cancelEpisode(ep: number): void {
  const entry = episodeProgressMap.value.get(ep)
  if (entry && entry.status === 'running') {
    entry.status = 'cancelled'
    entry.step = '已取消'
    entry.finishedAt = Date.now()
    if (entry.timerHandle) clearInterval(entry.timerHandle)
    entry.timerHandle = null
  }
}

function retryEpisode(ep: number): void {
  const entry = episodeProgressMap.value.get(ep)
  if (entry && (entry.status === 'failed' || entry.status === 'cancelled')) {
    simulateEpisode(ep)
  }
}

function cancelAllEpisodes(): void {
  episodeProgressMap.value.forEach((entry) => {
    if (entry.status === 'running' || entry.status === 'pending') {
      entry.status = 'cancelled'
      entry.step = '已取消'
      entry.finishedAt = Date.now()
      if (entry.timerHandle) clearInterval(entry.timerHandle)
      entry.timerHandle = null
    }
  })
}

function exportCompletedResults(): void {
  const completed: number[] = []
  episodeProgressMap.value.forEach((entry) => {
    if (entry.status === 'completed') completed.push(entry.episode)
  })
  if (completed.length === 0) {
    toast.info('暂无已完成的生成结果')
    return
  }
  toast.success(`正在导出 ${completed.length} 集结果 (EP${completed[0]}~EP${completed[completed.length - 1]})`)
}

function episodeStatusLabel(s: EpisodeStatus): string {
  return {
    pending: '等待',
    running: '生成中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }[s]
}

function episodeStatusColor(s: EpisodeStatus): string {
  return {
    pending: 'text-slate-400 bg-slate-500/20',
    running: 'text-blue-300 bg-blue-500/20',
    completed: 'text-emerald-300 bg-emerald-500/20',
    failed: 'text-rose-300 bg-rose-500/20',
    cancelled: 'text-slate-300 bg-slate-500/20',
  }[s]
}

// ── Cleanup on unmount ───────────────────────────────────────────────────────
onUnmounted(() => {
  if (_progressInterval) clearInterval(_progressInterval)
  if (_completionTimeout) clearTimeout(_completionTimeout)
  // Clean up per-episode timers
  episodeProgressMap.value.forEach((entry) => {
    if (entry.timerHandle) clearInterval(entry.timerHandle)
  })
})
</script>

<template>
  <div class="batch-generate">
    <div class="bg-toolbar">
      <span class="bg-title">📊 批量生成 · 图像生成节点</span>
      <span class="bg-sub">工作流：{{ workflowName }} · {{ workflowNodes.length }} 个节点 · EP{{ episodeStart }}~EP{{ episodeEnd }}</span>
      <button
        v-if="completedEpisodes > 0 && !batchLoading"
        class="btn btn-sm btn-secondary"
        @click="exportCompletedResults"
      >
        📤 导出 {{ completedEpisodes }} 集结果
      </button>
      <button
        class="btn btn-sm btn-primary bg-start-btn"
        :disabled="batchLoading"
        @click="onStartBatch"
      >
        {{ batchLoading ? `生成中... ${batchProgress}%` : '🚀 开始批量生成' }}
      </button>
      <button
        v-if="batchLoading"
        class="btn btn-sm btn-ghost"
        @click="onCancelBatch"
      >
        ✕ 取消
      </button>
    </div>
    <!-- Overall batch progress bar -->
    <div v-if="batchLoading" class="batch-progress-bar">
      <div class="batch-progress-fill" :style="{ width: batchProgress + '%' }"></div>
    </div>
    <div class="bg-layout">
      <div class="bg-main">
        <!-- Seed configuration -->
        <div class="config-card">
          <div class="section-title">🎲 种子批次</div>
          <p class="config-hint">不同种子产生不同构图和细节，同一提示词多版本择优</p>
          <div class="seed-chips">
            <span
              v-for="s in seeds"
              :key="s"
              class="seed-chip"
              :class="{ active: selectedSeed === s }"
              @click="selectedSeed = s"
            >{{ s }}</span>
          </div>
          <div class="seed-info">
            <button class="btn btn-xs btn-secondary" @click="onRandomSeed">+ 随机种子</button>
            <span>每种子生成 {{ activeStyles.length * promptVariants.length }} 张，共 <strong>{{ seeds.length * activeStyles.length * promptVariants.length }} 张</strong></span>
          </div>
        </div>

        <!-- Episode range selection -->
        <div class="config-card">
          <div class="section-title">📺 集数范围</div>
          <p class="config-hint">选择需要批量生成的集数范围 (共 {{ TOTAL_EPISODES }} 集)</p>
          <div class="episode-range-row">
            <label class="ep-range-label">
              <span>起始集</span>
              <input
                v-model.number="episodeStart"
                type="number"
                min="1"
                :max="TOTAL_EPISODES"
                class="ep-range-input"
                @change="clampEpisodeRange"
              />
            </label>
            <span class="ep-range-sep">至</span>
            <label class="ep-range-label">
              <span>结束集</span>
              <input
                v-model.number="episodeEnd"
                type="number"
                min="1"
                :max="TOTAL_EPISODES"
                class="ep-range-input"
                @change="clampEpisodeRange"
              />
            </label>
            <span class="ep-range-count">共 <strong>{{ episodeRange.length }}</strong> 集</span>
          </div>
          <div class="episode-chips">
            <span
              v-for="ep in episodeRange"
              :key="ep"
              class="ep-chip"
            >EP{{ ep }}</span>
          </div>
        </div>

        <!-- Quality preset selection -->
        <div class="config-card">
          <div class="section-title">🎯 质量预设</div>
          <p class="config-hint">选择生成质量等级，更高质量需要更多时间和积分</p>
          <div class="quality-row">
            <button
              v-for="q in qualityPresets"
              :key="q.id"
              type="button"
              class="quality-chip"
              :class="{ active: selectedQuality === q.id }"
              @click="selectedQuality = q.id"
            >
              <span class="quality-icon">{{ q.icon }}</span>
              <div class="quality-info">
                <span class="quality-name">{{ q.name }}</span>
                <span class="quality-desc">{{ q.resolution }} · {{ q.description }}</span>
              </div>
              <span class="quality-mult">{{ q.multiplier }}x</span>
            </button>
          </div>
        </div>

        <!-- Parallel generation toggle -->
        <div class="config-card">
          <div class="section-title">⚡ 并行生成</div>
          <p class="config-hint">开启并行可同时处理多集，显著提升批量速度</p>
          <div class="parallel-row">
            <label class="parallel-toggle">
              <input
                v-model="parallelEnabled"
                type="checkbox"
                class="toggle-input"
              />
              <span class="toggle-track" :class="{ on: parallelEnabled }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">{{ parallelEnabled ? '已开启' : '已关闭' }}</span>
            </label>
            <div v-if="parallelEnabled" class="parallel-count-row">
              <span>并行数:</span>
              <button
                v-for="n in [1, 2, 3, 5]"
                :key="n"
                type="button"
                class="parallel-num-chip"
                :class="{ active: parallelCount === n }"
                @click="parallelCount = n"
              >{{ n }}</button>
            </div>
          </div>
        </div>

        <!-- Prompt variants -->
        <div class="config-card">
          <div class="section-title">📝 提示词变体</div>
          <p class="config-hint">同一场景不同提示词描述，对比生成效果</p>
          <div
            v-for="v in promptVariants"
            :key="v.id"
            class="prompt-variant"
            :class="{ active: v.active }"
          >
            <div class="pv-header">
              <span class="badge" :class="v.id === 'main' ? 'badge-purple' : 'badge-amber'">{{ v.label }}</span>
              <button class="btn btn-xs btn-ghost" @click="onEditVariant(v.id)">✏️</button>
            </div>
            <input
              v-if="editingVariantId === v.id"
              class="pv-edit-input"
              v-model="v.text"
              placeholder="输入提示词变体文本..."
              @keydown.enter="onEditVariant(v.id)"
            />
            <div v-else class="pv-text" :class="{ 'pv-text--highlight': v.id !== 'main' }">{{ v.text }}</div>
          </div>
          <button class="btn btn-xs btn-secondary btn-full" @click="onAddVariant">+ 添加提示词变体</button>
        </div>

        <!-- Multi-style selection -->
        <div class="config-card">
          <div class="section-title">🎨 多风格并行</div>
          <p class="config-hint">同一镜头用不同风格同时生成，方便对比选优（可多选）</p>
          <div class="style-row">
            <span
              v-for="(s, i) in styles"
              :key="i"
              class="style-chip"
              :class="{ active: activeStyles.includes(i) }"
              @click="toggleStyle(i)"
            >{{ s }}</span>
          </div>
        </div>

        <!-- Batch summary -->
        <div class="batch-summary">
          <div class="section-title">📦 批量汇总</div>
          <div class="summary-row"><span>集数范围</span><span>EP{{ episodeStart }} ~ EP{{ episodeEnd }} ({{ episodeRange.length }} 集)</span></div>
          <div class="summary-row"><span>质量预设</span><span>{{ activeQualityPreset.icon }} {{ activeQualityPreset.name }} ({{ activeQualityPreset.resolution }})</span></div>
          <div class="summary-row"><span>并行模式</span><span>{{ parallelEnabled ? `并行 ×${parallelCount}` : '串行' }}</span></div>
          <div class="summary-row"><span>种子数</span><span>{{ seeds.length }}</span></div>
          <div class="summary-row"><span>提示词变体数</span><span>{{ promptVariants.length }}</span></div>
          <div class="summary-row"><span>风格数</span><span>{{ activeStyles.length }}</span></div>
          <div class="summary-row summary-row--total"><span>预计总量</span><span class="summary-total">{{ totalCount }} 张/集 × {{ episodeRange.length }} 集 = {{ totalCount * episodeRange.length }} 张</span></div>
          <div class="summary-row"><span>预计耗时</span><span>{{ estimatedTime }}</span></div>
          <div class="summary-row"><span>预计积分</span><span>{{ totalCount }} × ¥{{ (0.015 * activeQualityPreset.multiplier).toFixed(3) }} × {{ episodeRange.length }} = ¥{{ (totalCount * 0.015 * activeQualityPreset.multiplier * episodeRange.length).toFixed(2) }}</span></div>
          <div v-if="batchLoading" class="summary-row" style="color: var(--accent, #818cf8);">
            <span>运行中</span><span>{{ runningEpisodes }} 并行 · {{ completedEpisodes }} 完成 · {{ failedEpisodes }} 失败</span>
          </div>
        </div>
      </div>

      <!-- Preview panel: per-episode progress -->
      <div class="bg-preview">
        <div class="section-title">📊 集数进度</div>
        <p class="preview-sub">
          EP{{ episodeStart }} ~ EP{{ episodeEnd }} · {{ activeQualityPreset.name }} · {{ parallelEnabled ? `并行 ×${parallelCount}` : '串行' }}
        </p>

        <!-- Summary stats -->
        <div v-if="batchLoading || completedEpisodes > 0 || failedEpisodes > 0" class="ep-stats-row">
          <span class="ep-stat ep-stat--running">🔄 运行 {{ runningEpisodes }}</span>
          <span class="ep-stat ep-stat--done">✅ 完成 {{ completedEpisodes }}</span>
          <span class="ep-stat ep-stat--fail">❌ 失败 {{ failedEpisodes }}</span>
          <button
            v-if="completedEpisodes > 0"
            class="btn btn-xs btn-primary"
            @click="exportCompletedResults"
          >📤 导出已完成</button>
        </div>

        <!-- Episode list -->
        <div class="ep-list">
          <div
            v-for="ep in episodeRange"
            :key="ep"
            class="ep-item"
          >
            <div class="ep-item-header">
              <span class="ep-item-name">EP{{ ep }}</span>
              <span class="ep-item-badge" :class="episodeStatusColor(getEpisodeProgress(ep).status)">
                {{ episodeStatusLabel(getEpisodeProgress(ep).status) }}
              </span>
            </div>

            <!-- Progress bar -->
            <div v-if="getEpisodeProgress(ep).status === 'running'" class="ep-progress-bar">
              <div
                class="ep-progress-fill"
                :style="{ width: getEpisodeProgress(ep).progress + '%' }"
              ></div>
            </div>

            <!-- Step info -->
            <div class="ep-item-footer">
              <span class="ep-item-step">{{ getEpisodeProgress(ep).step }}</span>
              <span v-if="getEpisodeProgress(ep).status === 'running'" class="ep-item-pct">{{ getEpisodeProgress(ep).progress }}%</span>
            </div>

            <!-- Error message -->
            <div v-if="getEpisodeProgress(ep).error" class="ep-item-error">
              {{ getEpisodeProgress(ep).error }}
            </div>

            <!-- Actions -->
            <div v-if="getEpisodeProgress(ep).status === 'running' || getEpisodeProgress(ep).status === 'failed' || getEpisodeProgress(ep).status === 'cancelled'" class="ep-item-actions">
              <button
                v-if="getEpisodeProgress(ep).status === 'running'"
                class="btn btn-xs btn-ghost"
                @click="cancelEpisode(ep)"
              >取消</button>
              <button
                v-if="getEpisodeProgress(ep).status === 'failed' || getEpisodeProgress(ep).status === 'cancelled'"
                class="btn btn-xs btn-secondary"
                @click="retryEpisode(ep)"
              >🔄 重试</button>
            </div>
          </div>
        </div>

        <!-- Legacy preview grid (collapsed when batch is running) -->
        <template v-if="!batchLoading && completedEpisodes === 0">
          <div class="section-title" style="margin-top: 16px;">🖼️ 预览排列</div>
          <p class="preview-sub">
            {{ seeds.length }} 种子 × {{ promptVariants.length }} 提示词 × {{ activeStyles.length }} 风格 = {{ totalCount }} 张
          </p>
          <div class="preview-filters">
            <span class="chip active">全部</span>
            <span class="chip">种子 {{ selectedSeed }}</span>
            <span class="chip">主提示词</span>
          </div>
          <div class="preview-grid">
            <div v-for="card in pagedCards" :key="card.key" class="preview-card">
              <div class="preview-thumb">🗡️</div>
              <div class="preview-label">S{{ card.seed }} · {{ card.promptLabel }} · {{ card.styleLabel }}</div>
            </div>
          </div>
          <div class="preview-pager">
            <button class="btn btn-xs btn-ghost" :disabled="currentPage <= 1" @click="prevPage">《 上一页</button>
            <span>第 {{ currentPage }}/{{ totalPages }} 页</span>
            <button class="btn btn-xs btn-ghost" :disabled="currentPage >= totalPages" @click="nextPage">下一页 》</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.batch-generate { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.batch-progress-bar { height: 3px; background: var(--bg-tertiary, #1a2332); overflow: hidden; flex-shrink: 0; }
.batch-progress-fill { height: 100%; background: linear-gradient(to right, var(--accent, #818cf8), #a78bfa, #c084fc); transition: width .4s ease; }
.bg-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 20px; background: var(--bg-secondary, #111827); border-bottom: 1px solid var(--border, #1e293b); }
.bg-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.bg-sub { font-size: 10px; color: var(--text-muted, #64748b); }
.bg-start-btn { margin-left: auto; }
.bg-layout { display: flex; flex: 1; overflow: hidden; }
.bg-main { flex: 1; padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.bg-preview { width: 400px; background: var(--bg-secondary, #111827); border-left: 1px solid var(--border, #1e293b); padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.config-card { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 18px; }
.config-hint { font-size: 11px; color: var(--text-muted, #64748b); margin: -4px 0 10px; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.seed-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.seed-chip { padding: 5px 12px; border-radius: 16px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); font-family: var(--font-mono, monospace); font-size: 11px; cursor: pointer; color: var(--text-secondary, #94a3b8); }
.seed-chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.seed-info { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--text-muted, #64748b); }
.seed-info strong { color: var(--text-primary, #e2e8f0); }
.prompt-variant { padding: 12px; border: 1px solid var(--border, #1e293b); border-radius: 8px; background: var(--bg-card, #141a2e); margin-bottom: 8px; }
.prompt-variant.active { border-color: var(--accent, #818cf8); }
.pv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.pv-text { font-size: 11px; font-family: var(--font-mono, monospace); color: var(--text-secondary, #94a3b8); }
.pv-edit-input { width: 100%; padding: 6px 10px; border-radius: 6px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--accent, #818cf8); color: var(--text-primary, #e2e8f0); font-size: 11px; font-family: var(--font-mono, monospace); outline: none; }
.style-row { display: flex; gap: 8px; flex-wrap: wrap; }
.style-chip { padding: 8px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); cursor: pointer; font-size: 12px; color: var(--text-secondary, #94a3b8); }
.style-chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.batch-summary { padding: 16px; background: rgba(99,102,241,.06); border: 1px solid var(--accent, #818cf8); border-radius: var(--radius, 12px); }
.summary-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; }
.summary-row--total { border-top: 1px solid var(--border, #1e293b); padding-top: 6px; margin-top: 4px; font-weight: 700; }
.summary-total { color: var(--accent, #818cf8); font-size: 16px; }
.preview-sub { font-size: 10px; color: var(--text-muted, #64748b); margin-top: -8px; }
.preview-filters { display: flex; gap: 8px; }
.chip { padding: 4px 10px; border-radius: 12px; font-size: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-secondary, #94a3b8); cursor: pointer; }
.chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preview-card { padding: 12px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: 8px; }
.preview-thumb { aspect-ratio: 16/9; border-radius: 6px; background: var(--bg-tertiary, #1a2332); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 8px; }
.preview-label { font-size: 10px; color: var(--text-muted, #64748b); text-align: center; }
.preview-pager { display: flex; gap: 8px; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted, #64748b); }

/* Episode range */
.episode-range-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.ep-range-label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-muted, #64748b); }
.ep-range-input { width: 72px; padding: 6px 10px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 13px; font-family: var(--font-mono, monospace); text-align: center; outline: none; transition: border-color .2s; }
.ep-range-input:focus { border-color: var(--accent, #818cf8); }
.ep-range-sep { font-size: 12px; color: var(--text-muted, #64748b); margin-top: 18px; }
.ep-range-count { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-top: 18px; margin-left: auto; }
.ep-range-count strong { color: var(--accent, #818cf8); }
.episode-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ep-chip { padding: 3px 8px; border-radius: 10px; background: rgba(99,102,241,.08); border: 1px solid rgba(99,102,241,.2); font-size: 10px; font-family: var(--font-mono, monospace); color: var(--accent, #818cf8); }

/* Quality presets */
.quality-row { display: flex; flex-direction: column; gap: 6px; }
.quality-chip { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); cursor: pointer; text-align: left; transition: all .2s; color: var(--text-secondary, #94a3b8); }
.quality-chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--text-primary, #e2e8f0); }
.quality-chip:hover { border-color: var(--accent, #818cf8); }
.quality-icon { font-size: 18px; flex-shrink: 0; }
.quality-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.quality-name { font-size: 12px; font-weight: 600; color: var(--text-primary, #e2e8f0); }
.quality-desc { font-size: 10px; color: var(--text-muted, #64748b); }
.quality-mult { font-size: 11px; font-weight: 700; color: var(--accent, #818cf8); font-family: var(--font-mono, monospace); }

/* Parallel toggle */
.parallel-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.parallel-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.toggle-input { display: none; }
.toggle-track { display: inline-flex; align-items: center; width: 40px; height: 22px; border-radius: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); padding: 2px; transition: all .2s; }
.toggle-track.on { background: var(--accent, #818cf8); border-color: var(--accent, #818cf8); }
.toggle-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s; }
.toggle-track.on .toggle-thumb { transform: translateX(18px); }
.toggle-label { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.parallel-count-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted, #64748b); }
.parallel-num-chip { padding: 4px 12px; border-radius: 12px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); font-size: 12px; font-family: var(--font-mono, monospace); cursor: pointer; color: var(--text-secondary, #94a3b8); transition: all .2s; }
.parallel-num-chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.1); color: var(--accent, #818cf8); }

/* Per-episode progress */
.ep-stats-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.15); border-radius: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.ep-stat { font-size: 11px; font-weight: 500; }
.ep-stat--running { color: #60a5fa; }
.ep-stat--done { color: #34d399; }
.ep-stat--fail { color: #fb7185; }
.ep-list { display: flex; flex-direction: column; gap: 6px; max-height: 500px; overflow-y: auto; }
.ep-item { padding: 10px 12px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: 8px; }
.ep-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.ep-item-name { font-size: 12px; font-weight: 700; color: var(--text-primary, #e2e8f0); font-family: var(--font-mono, monospace); }
.ep-item-badge { display: inline-flex; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
.ep-progress-bar { height: 4px; border-radius: 2px; background: var(--bg-tertiary, #1a2332); overflow: hidden; margin-bottom: 4px; }
.ep-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(to right, var(--accent, #818cf8), #a78bfa); transition: width .3s ease; }
.ep-item-footer { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted, #64748b); }
.ep-item-step { font-family: var(--font-mono, monospace); }
.ep-item-pct { color: var(--accent, #818cf8); font-weight: 600; font-family: var(--font-mono, monospace); }
.ep-item-error { margin-top: 4px; padding: 4px 8px; border-radius: 4px; background: rgba(244,63,94,.08); font-size: 10px; color: #fb7185; }
.ep-item-actions { display: flex; gap: 6px; margin-top: 6px; }
</style>
