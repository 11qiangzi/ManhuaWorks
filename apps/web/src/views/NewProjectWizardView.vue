<script setup lang="ts">
/**
 * NewProjectWizardView.vue — 新建项目向导 (1:1 复刻 studio-new-project-wizard.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getApi } from '../api-bridge'

const router = useRouter()
const step = ref(1)
const selectedMode = ref('premium')

// ===== Form data =====
const projectName = ref('')
const genre = ref('古风')
const episodes = ref(24)
const characterName = ref('')
const archetype = ref('主角 · 剑修')
const characterDesc = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)
const modeNames: Record<string,string> = { premium:'精品动画', commentary:'解说动画', liveaction:'真人剧' }

const modes = [
  { id: 'premium', icon: '🎨', name: '精品动画', desc: '高品质动画\n角色精致·镜头考究' },
  { id: 'commentary', icon: '🎙️', name: '解说动画', desc: '故事驱动型\n智能多播·音色提取' },
  { id: 'liveaction', icon: '🎬', name: '真人剧', desc: '写实风格\n演员音色·专业运镜' },
]

function nextStep() { if (step.value < 4) step.value++ }
function prevStep() { if (step.value > 1) step.value-- }
function cancel() { router.push('/') }

async function finish() {
  creating.value = true; createError.value = null
  try {
    const api = getApi()
    const project = await api.http.post<{ id: string }>(
      '/v1/projects',
      {
        name: projectName.value || '未命名项目',
        description: `${modeNames[selectedMode.value] || '精品动画'} 项目`,
      },
    )
    const newId = project?.id
    // Step 3: 创建初始角色（如果用户填写了角色名）
    if (newId && characterName.value.trim()) {
      try {
        await api.http.post(`/projects/${encodeURIComponent(newId)}/characters`, {
          name: characterName.value.trim(),
          archetype: archetype.value || '主角',
          description: characterDesc.value || '',
        })
      } catch {
        // Character creation failure is non-fatal — user can add later
      }
    }
    if (newId) router.push(`/project/${newId}`)
    else router.push('/project')
  } catch (e: any) {
    createError.value = e.message || '创建项目失败，请重试'
    setTimeout(() => { createError.value = null }, 5000)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="wizard-overlay">
    <div class="wizard-card">
      <div class="wizard-steps">
        <div class="wizard-step"><div class="wizard-dot" :class="{ active: step >= 1, done: step > 1 }">{{ step > 1 ? '✓' : '1' }}</div><span :style="{ fontSize: '12px', color: step >= 1 ? 'var(--accent)' : 'var(--text-muted)' }">选择模式</span></div>
        <div class="wizard-line" :class="{ done: step > 1 }"></div>
        <div class="wizard-step"><div class="wizard-dot" :class="{ active: step >= 2, done: step > 2 }">{{ step > 2 ? '✓' : '2' }}</div><span :style="{ fontSize: '12px', color: step >= 2 ? 'var(--accent)' : 'var(--text-muted)' }">基本信息</span></div>
        <div class="wizard-line" :class="{ done: step > 2 }"></div>
        <div class="wizard-step"><div class="wizard-dot" :class="{ active: step >= 3, done: step > 3 }">{{ step > 3 ? '✓' : '3' }}</div><span :style="{ fontSize: '12px', color: step >= 3 ? 'var(--accent)' : 'var(--text-muted)' }">初始角色</span></div>
        <div class="wizard-line" :class="{ done: step > 3 }"></div>
        <div class="wizard-step"><div class="wizard-dot" :class="{ active: step >= 4 }">4</div><span :style="{ fontSize: '12px', color: step >= 4 ? 'var(--accent)' : 'var(--text-muted)' }">完成</span></div>
      </div>

      <template v-if="step === 1">
        <h2 class="wizard-heading">🎯 选择创作模式</h2>
        <p class="wizard-sub">不同模式使用不同的 AI 模型和参数预设</p>
        <div class="mode-grid">
          <div v-for="m in modes" :key="m.id" class="mode-card" :class="{ active: selectedMode === m.id }" @click="selectedMode = m.id">
            <div class="mode-icon">{{ m.icon }}</div>
            <div class="mode-name">{{ m.name }}</div>
            <div class="mode-desc">{{ m.desc }}</div>
          </div>
        </div>
      </template>
      <template v-if="step === 2">
        <h2 class="wizard-heading">📋 基本信息</h2>
        <p class="wizard-sub">填写项目名称和简介</p>
        <div class="form-grid" style="margin-bottom:24px">
          <div><label class="form-label">项目名称</label><input class="input" v-model="projectName" placeholder="我的第一个动画项目"></div>
          <div><label class="form-label">题材</label><select class="input" v-model="genre"><option>古风</option><option>仙侠</option><option>都市</option><option>科幻</option></select></div>
          <div><label class="form-label">目标集数</label><input class="input" v-model.number="episodes" style="width:100px"></div>
        </div>
      </template>
      <template v-if="step === 3">
        <h2 class="wizard-heading">👤 初始角色</h2>
        <p class="wizard-sub">添加你的第一个角色</p>
        <div class="form-grid" style="margin-bottom:24px">
          <div><label class="form-label">角色名称</label><input class="input" v-model="characterName" placeholder="主角姓名"></div>
          <div><label class="form-label">角色原型</label><select class="input" v-model="archetype"><option>主角 · 剑修</option><option>主角 · 法师</option><option>反派</option><option>配角</option></select></div>
          <div><label class="form-label">角色描述</label><textarea class="input" v-model="characterDesc" rows="2" placeholder="简短描述角色特征..."></textarea></div>
        </div>
      </template>
      <template v-if="step === 4">
        <div style="text-align:center;padding:20px 0">
          <div v-if="createError" class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300" style="margin-bottom:16px">{{ createError }}</div>
          <div style="font-size:64px;margin-bottom:16px">{{ creating ? '⏳' : '🎉' }}</div>
          <h2 class="wizard-heading">{{ creating ? '正在创建项目...' : '项目创建完成！' }}</h2>
          <p class="wizard-sub">我们将自动为您拆解小说章节、提取角色和场景。进入项目后，可以在工作流中随时调整。</p>
        </div>
      </template>

      <div class="wizard-actions">
        <button class="btn btn-secondary" @click="cancel" :disabled="creating">取消</button>
        <div class="wizard-actions-right">
          <button v-if="step > 1" class="btn btn-ghost" @click="prevStep" :disabled="creating">← 上一步</button>
          <button v-if="step < 4" class="btn btn-primary" @click="nextStep">下一步：{{ step === 1 ? '基本信息 →' : step === 2 ? '初始角色 →' : '完成 →' }}</button>
          <button v-if="step === 4" class="btn btn-primary" style="padding:12px 32px" @click="finish" :disabled="creating">{{ creating ? '创建中...' : '🚀 进入项目' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-overlay { display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; }
.wizard-card { width: 720px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius-lg, 16px); padding: 40px 48px; }
.wizard-steps { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 32px; }
.wizard-step { display: flex; align-items: center; gap: 8px; }
.wizard-dot { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-tertiary, #1a2332); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--text-muted, #64748b); }
.wizard-dot.active { background: var(--accent, #818cf8); color: #fff; }
.wizard-dot.done { background: #34d399; color: #fff; }
.wizard-line { width: 40px; height: 2px; background: var(--border, #1e293b); }
.wizard-line.done { background: #34d399; }
.wizard-heading { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 6px; color: var(--text-primary, #e2e8f0); }
.wizard-sub { text-align: center; font-size: 13px; color: var(--text-muted, #64748b); margin-bottom: 24px; }
.mode-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 28px; }
.mode-card { padding: 24px 18px; border: 2px solid var(--border, #1e293b); border-radius: var(--radius, 12px); cursor: pointer; text-align: center; }
.mode-card.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.05); }
.mode-card:hover { border-color: var(--border-strong, #334155); }
.mode-icon { font-size: 36px; margin-bottom: 8px; }
.mode-name { font-weight: 700; font-size: 15px; color: var(--text-primary, #e2e8f0); }
.mode-desc { font-size: 11px; color: var(--text-muted, #64748b); margin-top: 4px; white-space: pre-line; }
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.form-label { font-size: 12px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.wizard-actions { display: flex; justify-content: space-between; align-items: center; }
.wizard-actions-right { display: flex; gap: 8px; align-items: center; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
select.input { cursor: pointer; }
</style>
