<script setup lang="ts">
/**
 * BatchGenerateView.vue — 批量生成设置 (1:1 复刻 studio-batch-generate.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const selectedSeed = ref(42)
const seeds = [42, 128, 256, 512, 1024, 2048, 4096, 8192]
const promptVariants = ref([
  { id: 'main', label: '主 Prompt', text: '少年剑修，白衣黑发，眼神坚定，古风仙侠风格，masterpiece', active: true },
  { id: 'v1', label: '变体 1', text: '少年剑修，白衣黑发，眼神坚定，水墨画风，留白构图', active: false },
  { id: 'v2', label: '变体 2', text: '少年剑修，白衣黑发，特写镜头，表情微怒，光影对比强', active: false },
])
const styles = ['🎌 动漫 (默认)', '🖋️ 水墨', '📷 写实', '✏️ 素描', '🎮 赛博']
const activeStyle = ref(0)

const totalCount = computed(() => seeds.length * promptVariants.value.length * 1)
const estimatedTime = computed(() => `${Math.round(totalCount.value * 0.125)} 分钟`)
const estimatedCost = computed(() => `$${(totalCount.value * 0.015).toFixed(2)}`)

function goBack() { router.push('/workflow') }
</script>

<template>
  <div class="batch-generate">
    <div class="bg-toolbar">
      <span class="bg-title">📊 批量生成 · 图像生成节点</span>
      <span class="bg-sub">项目：长安月下 · 第 2 镜</span>
      <button class="btn btn-sm btn-primary bg-start-btn">🚀 开始批量生成</button>
    </div>
    <div class="bg-layout">
      <div class="bg-main">
        <div class="config-card">
          <div class="section-title">🎲 Seed 批次</div>
          <p class="config-hint">不同 Seed 产生不同构图和细节，同一 Prompt 多版本择优</p>
          <div class="seed-chips">
            <span v-for="s in seeds" :key="s" class="seed-chip" :class="{ active: selectedSeed === s }" @click="selectedSeed = s">{{ s }}</span>
          </div>
          <div class="seed-info">
            <button class="btn btn-xs btn-secondary">+ 随机 Seed</button>
            <span>每 Seed 生成 1 张，共 <strong>{{ seeds.length }} 张</strong></span>
          </div>
        </div>
        <div class="config-card">
          <div class="section-title">📝 Prompt 变体</div>
          <p class="config-hint">同一场景不同 Prompt 描述，对比生成效果</p>
          <div v-for="v in promptVariants" :key="v.id" class="prompt-variant" :class="{ active: v.active }">
            <div class="pv-header">
              <span class="badge" :class="v.id === 'main' ? 'badge-purple' : 'badge-amber'">{{ v.label }}</span>
              <button class="btn btn-xs btn-ghost">✏️</button>
            </div>
            <div class="pv-text" :class="{ 'pv-text--highlight': v.id !== 'main' }">{{ v.text }}</div>
          </div>
          <button class="btn btn-xs btn-secondary btn-full">+ 添加 Prompt 变体</button>
        </div>
        <div class="config-card">
          <div class="section-title">🎨 多风格并行</div>
          <p class="config-hint">同一镜头用不同风格同时生成，方便对比选优</p>
          <div class="style-row">
            <span v-for="(s, i) in styles" :key="i" class="style-chip" :class="{ active: activeStyle === i }" @click="activeStyle = i">{{ s }}</span>
          </div>
        </div>
        <div class="batch-summary">
          <div class="section-title">📦 批量汇总</div>
          <div class="summary-row"><span>Seed 数</span><span>{{ seeds.length }}</span></div>
          <div class="summary-row"><span>Prompt 变体数</span><span>{{ promptVariants.length }}</span></div>
          <div class="summary-row"><span>风格数</span><span>1</span></div>
          <div class="summary-row summary-row--total"><span>预计总量</span><span class="summary-total">{{ totalCount }} 张</span></div>
          <div class="summary-row"><span>预计耗时</span><span>{{ estimatedTime }}</span></div>
          <div class="summary-row"><span>预计积分</span><span>{{ totalCount }} × $0.015 = {{ estimatedCost }}</span></div>
        </div>
      </div>
      <div class="bg-preview">
        <div class="section-title">🖼️ 预览排列</div>
        <p class="preview-sub">{{ seeds.length }} Seed × {{ promptVariants.length }} Prompt × 1 风格 = {{ totalCount }} 张</p>
        <div class="preview-filters">
          <span class="chip active">全部</span><span class="chip">Seed 42</span><span class="chip">主 Prompt</span>
        </div>
        <div class="preview-grid">
          <div v-for="i in 6" :key="i" class="preview-card">
            <div class="preview-thumb">🗡️</div>
            <div class="preview-label">S{{ seeds[(i-1) % seeds.length] }} · P{{ ['主','变1','变2'][(i-1) % 3] }} · 动漫</div>
          </div>
        </div>
        <div class="preview-pager"><button class="btn btn-xs btn-ghost">《 上一页</button><span>第 1/4 页</span><button class="btn btn-xs btn-ghost">下一页 》</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.batch-generate { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
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
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-purple { background: rgba(139,92,246,.15); color: #a78bfa; }
.badge-amber { background: rgba(245,158,11,.15); color: #fbbf24; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.btn-full { width: 100%; justify-content: center; }
</style>
