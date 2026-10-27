<script setup lang="ts">
/**
 * StoryboardEditorView.vue — 动画编辑器（7 步向导）
 *
 * 步骤：
 *   1. 上传小说  2. 角色设定  3. 场景设定  4. 风格选择
 *   5. 配乐设定  6. 生成预览  7. 导出
 */

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StoryboardStep5Music from './StoryboardStep5Music.vue'

const route = useRoute()
const router = useRouter()

// ── 步骤定义 ──

interface StepDef {
  key: string
  label: string
  icon: string
  description: string
}

const STEPS: StepDef[] = [
  { key: 'upload',    label: '上传小说', icon: '📖', description: '上传小说文本或选择已有剧本' },
  { key: 'character', label: '角色设定', icon: '👤', description: 'AI 提取角色，设定主视觉和属性' },
  { key: 'scene',     label: '场景设定', icon: '🏞️', description: '设定场景风格、光影和氛围' },
  { key: 'style',     label: '风格选择', icon: '🎨', description: '选择画风、镜头风格和后期参数' },
  { key: 'music',     label: '配乐设定', icon: '🎵', description: 'AI 智能配乐，BGM/SFX/旁白三轨混音' },
  { key: 'preview',   label: '生成预览', icon: '👁️', description: '预览镜头成片效果，微调细节' },
  { key: 'export',    label: '导出',     icon: '📤', description: '多格式导出，视频/图片/字幕' },
]

// ── 当前步骤 ──
const currentStepIndex = ref(0)

// 从路由 query 初始化步骤
watch(
  () => route.query.step,
  (s) => {
    if (typeof s === 'string') {
      const idx = STEPS.findIndex(st => st.key === s)
      if (idx >= 0) currentStepIndex.value = idx
    }
  },
  { immediate: true },
)

const currentStep = computed(() => STEPS[currentStepIndex.value]!)

function goToStep(index: number) {
  if (index < 0 || index >= STEPS.length) return
  currentStepIndex.value = index
  // 同步到路由
  const projectId = route.params.id || '1'
  router.replace({
    path: `/project/${projectId}/storyboard`,
    query: { step: STEPS[index]!.key },
  })
}

function goNext() { goToStep(currentStepIndex.value + 1) }
function goPrev() { goToStep(currentStepIndex.value - 1) }

const projectId = computed(() => (route.params.id as string) || '1')

// ── 步骤状态（已完成/进行中/未开始）──
const completedSteps = ref<Set<number>>(new Set())

function markCompleted(index: number) {
  completedSteps.value.add(index)
  // 触发响应式
  completedSteps.value = new Set(completedSteps.value)
}

function stepState(index: number): 'done' | 'active' | 'pending' {
  if (completedSteps.value.has(index)) return 'done'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

// ── 项目名（展示用）──
const projectName = ref('未命名项目')

// ── 步骤 1-4,6-7 的简单模拟操作 ──

// Step 1: 上传小说
const uploadedText = ref('')
const hasUploadedNovel = computed(() => uploadedText.value.trim().length > 10)

// Step 4: 风格选择
const selectedStyle = ref('')
const styleOptions = [
  { id: 'watercolor', label: '水彩国风', icon: '🖌️', desc: '水墨晕染，古典意境' },
  { id: 'anime',      label: '日漫赛璐璐', icon: '✨', desc: '清晰线条，鲜明色彩' },
  { id: 'comic',      label: '美漫写实', icon: '🦸', desc: '立体光影，写实质感' },
  { id: 'pixel',      label: '像素复古', icon: '👾', desc: '8-bit 像素，怀旧风格' },
  { id: 'ink',        label: '黑白线稿', icon: '✒️', desc: '纯线条，极简风格' },
  { id: 'cyberpunk',  label: '赛博霓虹', icon: '🌃', desc: '高饱和，霓虹光效' },
]

// Step 6: 生成预览
const previewGenerating = ref(false)
const previewProgress = ref(0)
let _previewTimer: ReturnType<typeof setInterval> | null = null

function startPreview() {
  if (previewGenerating.value) return
  previewGenerating.value = true
  previewProgress.value = 0
  _previewTimer = setInterval(() => {
    previewProgress.value += 2
    if (previewProgress.value >= 100) {
      clearInterval(_previewTimer!)
      _previewTimer = null
      previewGenerating.value = false
      previewProgress.value = 100
    }
  }, 80)
}

// ── 导航确认 ──
function canProceed(): boolean {
  // 所有步骤都可以前进（演示模式）
  return true
}
</script>

<template>
  <div class="sbe-root">
    <!-- ═══════════ 顶部标题栏 ═══════════ -->
    <header class="sbe-header">
      <div class="sbe-header-left">
        <button class="sbe-back-btn" @click="router.push(`/project/${projectId}`)">← 返回</button>
        <span class="sbe-project-name">{{ projectName }}</span>
        <span class="sbe-header-sep">·</span>
        <span class="sbe-header-sub">动画编辑器</span>
      </div>
      <div class="sbe-header-right">
        <span class="sbe-step-indicator">步骤 {{ currentStepIndex + 1 }} / {{ STEPS.length }}</span>
      </div>
    </header>

    <!-- ═══════════ 步骤栏 ═══════════ -->
    <nav class="sbe-stepbar">
      <div
        v-for="(step, idx) in STEPS"
        :key="step.key"
        class="sbe-step-item"
        :class="{
          'sbe-step-item--active': stepState(idx) === 'active',
          'sbe-step-item--done': stepState(idx) === 'done',
          'sbe-step-item--pending': stepState(idx) === 'pending',
        }"
        @click="goToStep(idx)"
      >
        <div class="sbe-step-dot">
          <span v-if="stepState(idx) === 'done'" class="sbe-step-check">✓</span>
          <span v-else class="sbe-step-num">{{ idx + 1 }}</span>
        </div>
        <div class="sbe-step-text">
          <span class="sbe-step-icon">{{ step.icon }}</span>
          <span class="sbe-step-label">{{ step.label }}</span>
        </div>
        <div v-if="idx < STEPS.length - 1" class="sbe-step-line" :class="{ 'sbe-step-line--done': stepState(idx) === 'done' }"></div>
      </div>
    </nav>

    <!-- ═══════════ 步骤内容区 ═══════════ -->
    <div class="sbe-body">
      <Transition name="sbe-slide" mode="out-in">

        <!-- ── Step 1: 上传小说 ── -->
        <div v-if="currentStep.key === 'upload'" key="upload" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">📖 上传小说</h2>
            <p class="sbe-panel-desc">粘贴小说文本、上传 .txt 文件，或选择已有剧本模板</p>
            <div class="sbe-upload-zone">
              <div class="sbe-upload-icon">📄</div>
              <div class="sbe-upload-text">拖拽文件到此处，或点击选择</div>
              <div class="sbe-upload-hint">支持 .txt / .docx / .epub，最大 10MB</div>
              <textarea
                v-model="uploadedText"
                class="sbe-text-input"
                placeholder="或直接粘贴小说文本..."
                rows="6"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- ── Step 2: 角色设定 ── -->
        <div v-else-if="currentStep.key === 'character'" key="character" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">👤 角色设定</h2>
            <p class="sbe-panel-desc">AI 从文本中提取角色，设定主视觉图和属性</p>
            <div class="sbe-placeholder-grid">
              <div v-for="i in 4" :key="i" class="sbe-placeholder-card">
                <div class="sbe-placeholder-avatar">{{ ['🧑', '👩', '👴', '🧙'][i - 1] }}</div>
                <div class="sbe-placeholder-name">{{ ['主角·林逸', '女主·苏婉', '师父·玄清', '反派·暗影尊'][i - 1] }}</div>
                <div class="sbe-placeholder-tag">{{ ['剑修', '医仙', '长老', '魔修'][i - 1] }}</div>
              </div>
            </div>
            <button class="sbe-action-btn" @click="markCompleted(1)">✨ AI 自动提取角色</button>
          </div>
        </div>

        <!-- ── Step 3: 场景设定 ── -->
        <div v-else-if="currentStep.key === 'scene'" key="scene" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🏞️ 场景设定</h2>
            <p class="sbe-panel-desc">设定场景风格、光影氛围和背景细节</p>
            <div class="sbe-placeholder-grid">
              <div v-for="(s, i) in ['长安宫殿·夜景', '书房·暖光', '后山竹林·晨雾', '暗影深渊·幽暗']" :key="i" class="sbe-placeholder-card">
                <div class="sbe-placeholder-avatar">{{ ['🏯', '🏠', '🌳', '⚫'][i] }}</div>
                <div class="sbe-placeholder-name">{{ s }}</div>
                <div class="sbe-placeholder-tag">{{ ['庄严', '温馨', '平静', '神秘'][i] }}</div>
              </div>
            </div>
            <button class="sbe-action-btn" @click="markCompleted(2)">✨ AI 自动提取场景</button>
          </div>
        </div>

        <!-- ── Step 4: 风格选择 ── -->
        <div v-else-if="currentStep.key === 'style'" key="style" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🎨 风格选择</h2>
            <p class="sbe-panel-desc">选择画风、镜头风格和后期参数</p>
            <div class="sbe-style-grid">
              <div
                v-for="opt in styleOptions"
                :key="opt.id"
                class="sbe-style-card"
                :class="{ 'sbe-style-card--selected': selectedStyle === opt.id }"
                @click="selectedStyle = opt.id"
              >
                <div class="sbe-style-icon">{{ opt.icon }}</div>
                <div class="sbe-style-name">{{ opt.label }}</div>
                <div class="sbe-style-desc">{{ opt.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 5: 配乐设定 ── -->
        <div v-else-if="currentStep.key === 'music'" key="music" class="sbe-panel sbe-panel--flush">
          <StoryboardStep5Music @prev="goPrev" @next="goNext" />
        </div>

        <!-- ── Step 6: 生成预览 ── -->
        <div v-else-if="currentStep.key === 'preview'" key="preview" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">👁️ 生成预览</h2>
            <p class="sbe-panel-desc">预览镜头成片效果，确认画面和节奏</p>
            <div class="sbe-preview-stage">
              <div class="sbe-preview-placeholder">
                <div v-if="previewProgress > 0 && previewProgress < 100" class="sbe-preview-progress-ring">
                  <span class="sbe-preview-progress-text">{{ previewProgress }}%</span>
                </div>
                <div v-else-if="previewProgress >= 100" class="sbe-preview-done-icon">✅</div>
                <div v-else class="sbe-preview-empty-icon">🎬</div>
              </div>
              <div v-if="previewGenerating" class="sbe-preview-bar">
                <div class="sbe-preview-bar-fill" :style="{ width: `${previewProgress}%` }"></div>
              </div>
              <button
                class="sbe-action-btn"
                @click="startPreview"
                :disabled="previewGenerating"
              >
                {{ previewGenerating ? '生成中...' : previewProgress >= 100 ? '🔄 重新生成' : '🎬 生成预览' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Step 7: 导出 ── -->
        <div v-else-if="currentStep.key === 'export'" key="export" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">📤 导出</h2>
            <p class="sbe-panel-desc">选择导出格式和平台，一键下载成品</p>
            <div class="sbe-export-options">
              <div v-for="fmt in ['MP4 视频', '图片序列', 'SRT 字幕', '项目包']" :key="fmt" class="sbe-export-card">
                <span class="sbe-export-icon">{{ fmt.startsWith('MP4') ? '🎥' : fmt.startsWith('图') ? '🖼️' : fmt.startsWith('SRT') ? '📝' : '📦' }}</span>
                <span class="sbe-export-name">{{ fmt }}</span>
              </div>
            </div>
            <button class="sbe-action-btn" @click="router.push('/export')">📤 前往导出中心</button>
          </div>
        </div>

      </Transition>
    </div>

    <!-- ═══════════ 底部导航 ═══════════ -->
    <footer class="sbe-footer" v-if="currentStep.key !== 'music'">
      <div class="sbe-footer-left">
        <button
          v-if="currentStepIndex > 0"
          class="sbe-nav-btn"
          @click="goPrev"
        >← 上一步</button>
      </div>
      <div class="sbe-footer-center">
        <span class="sbe-footer-step-info">
          {{ currentStep.icon }} {{ currentStep.label }} — {{ currentStep.description }}
        </span>
      </div>
      <div class="sbe-footer-right">
        <button
          v-if="currentStepIndex < STEPS.length - 1"
          class="sbe-nav-btn sbe-nav-btn--primary"
          @click="() => { markCompleted(currentStepIndex); goNext() }"
        >下一步 →</button>
        <button
          v-else
          class="sbe-nav-btn sbe-nav-btn--primary"
          @click="router.push('/export')"
        >📤 完成导出</button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.sbe-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

/* ═══════════ 顶部标题栏 ═══════════ */
.sbe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  flex-shrink: 0;
}
.sbe-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sbe-back-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.sbe-back-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.sbe-project-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
}
.sbe-header-sep { color: var(--text-muted, #64748b); }
.sbe-header-sub { font-size: 13px; color: var(--text-secondary, #94a3b8); }
.sbe-header-right { display: flex; align-items: center; gap: 8px; }
.sbe-step-indicator {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
  font-weight: 600;
}

/* ═══════════ 步骤栏 ═══════════ */
.sbe-stepbar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 0;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.sbe-stepbar::-webkit-scrollbar { display: none; }

.sbe-step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  padding: 4px 0;
  position: relative;
}

.sbe-step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 200ms;
}
.sbe-step-item--pending .sbe-step-dot {
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #64748b);
  border: 1px solid var(--border, #1f2937);
}
.sbe-step-item--active .sbe-step-dot {
  background: var(--accent, #818cf8);
  color: #fff;
  box-shadow: 0 0 12px rgba(129, 140, 248, 0.3);
}
.sbe-step-item--done .sbe-step-dot {
  background: #34d399;
  color: #fff;
}
.sbe-step-check { font-size: 12px; }
.sbe-step-num { font-size: 12px; }

.sbe-step-text {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.sbe-step-icon { font-size: 14px; }
.sbe-step-label {
  font-size: 12px;
  font-weight: 600;
}
.sbe-step-item--pending .sbe-step-label { color: var(--text-muted, #64748b); }
.sbe-step-item--active .sbe-step-label { color: var(--accent, #818cf8); }
.sbe-step-item--done .sbe-step-label { color: #34d399; }

.sbe-step-line {
  width: 24px;
  height: 2px;
  background: var(--border, #1f2937);
  margin: 0 4px;
  flex-shrink: 0;
  transition: background 200ms;
}
.sbe-step-line--done { background: #34d399; }

/* ═══════════ 步骤内容区 ═══════════ */
.sbe-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.sbe-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sbe-panel--flush {
  overflow: hidden;
}
.sbe-panel-inner {
  flex: 1;
  padding: 28px 32px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sbe-panel-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary, #e4e4e7);
  margin: 0 0 6px;
  text-align: center;
}
.sbe-panel-desc {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 24px;
  text-align: center;
}

/* ── 上传区 ── */
.sbe-upload-zone {
  width: 100%;
  max-width: 560px;
  border: 2px dashed var(--border, #1f2937);
  border-radius: 12px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary, #111827);
  transition: border-color 200ms;
}
.sbe-upload-zone:hover { border-color: var(--accent, #818cf8); }
.sbe-upload-icon { font-size: 40px; opacity: 0.4; }
.sbe-upload-text { font-size: 14px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.sbe-upload-hint { font-size: 11px; color: var(--text-muted, #64748b); }
.sbe-text-input {
  width: 100%;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #e4e4e7);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 200ms;
}
.sbe-text-input:focus { border-color: var(--accent, #818cf8); }

/* ── 占位卡片 ── */
.sbe-placeholder-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
}
.sbe-placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 10px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 10px;
  background: var(--bg-secondary, #111827);
  transition: border-color 150ms;
}
.sbe-placeholder-card:hover { border-color: var(--accent, #818cf8); }
.sbe-placeholder-avatar { font-size: 28px; }
.sbe-placeholder-name { font-size: 11px; font-weight: 600; color: var(--text-primary, #e4e4e7); text-align: center; }
.sbe-placeholder-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}

/* ── 风格卡片 ── */
.sbe-style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
}
.sbe-style-card {
  padding: 18px 14px;
  border: 2px solid var(--border, #1f2937);
  border-radius: 10px;
  background: var(--bg-secondary, #111827);
  cursor: pointer;
  text-align: center;
  transition: all 200ms;
}
.sbe-style-card:hover { border-color: var(--border-strong, #334155); transform: translateY(-2px); }
.sbe-style-card--selected { border-color: var(--accent, #818cf8); background: rgba(129, 140, 248, 0.05); }
.sbe-style-icon { font-size: 28px; margin-bottom: 6px; }
.sbe-style-name { font-size: 13px; font-weight: 700; color: var(--text-primary, #e4e4e7); }
.sbe-style-desc { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-top: 4px; }

/* ── 预览区 ── */
.sbe-preview-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 480px;
}
.sbe-preview-placeholder {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  background: var(--bg-secondary, #111827);
  border: 1px solid var(--border, #1f2937);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-preview-empty-icon { font-size: 48px; opacity: 0.3; }
.sbe-preview-done-icon { font-size: 48px; }
.sbe-preview-progress-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: sbe-pulse 1.5s ease-in-out infinite;
}
.sbe-preview-progress-text { font-size: 16px; font-weight: 700; color: var(--accent, #818cf8); }
@keyframes sbe-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.sbe-preview-bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary, #1a2332);
  overflow: hidden;
}
.sbe-preview-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 80ms linear;
  border-radius: 2px;
}

/* ── 导出选项 ── */
.sbe-export-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
}
.sbe-export-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 10px;
  background: var(--bg-secondary, #111827);
  cursor: pointer;
  transition: border-color 150ms;
}
.sbe-export-card:hover { border-color: var(--accent, #818cf8); }
.sbe-export-icon { font-size: 24px; }
.sbe-export-name { font-size: 11px; font-weight: 600; color: var(--text-primary, #e4e4e7); }

/* ── 公共按钮 ── */
.sbe-action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 200ms;
}
.sbe-action-btn:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }
.sbe-action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* ═══════════ 底部导航 ═══════════ */
.sbe-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  flex-shrink: 0;
}
.sbe-footer-left,
.sbe-footer-right {
  flex-shrink: 0;
  min-width: 100px;
}
.sbe-footer-right { text-align: right; }
.sbe-footer-center {
  flex: 1;
  text-align: center;
}
.sbe-footer-step-info {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.sbe-nav-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}
.sbe-nav-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }
.sbe-nav-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-weight: 600;
}
.sbe-nav-btn--primary:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }

/* ═══════════ 过渡动画 ═══════════ */
.sbe-slide-enter-active,
.sbe-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.sbe-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.sbe-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .sbe-stepbar { padding: 8px 12px; }
  .sbe-step-label { display: none; }
  .sbe-step-line { width: 12px; }
  .sbe-placeholder-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-style-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-export-options { grid-template-columns: repeat(2, 1fr); }
  .sbe-panel-inner { padding: 20px 16px; }
}
</style>
