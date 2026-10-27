<script setup lang="ts">
/**
 * PromoEditorView.vue — 宣传片编辑器（6 步向导）
 *
 * 步骤：
 *   1. 品牌brief  2. 脚本生成  3. 镜头设定  4. 配音配乐
 *   5. 合成预览    6. 导出
 *
 * v2.1 product spec — Step 4 "配音配乐" 为详细实现
 */

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VolumeSlider, AudioSelector, AutoScoreButton } from '@manhuaworks/ui'

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
  { key: 'brief',     label: '品牌brief', icon: '📋', description: '填写品牌信息、目标受众和核心卖点' },
  { key: 'script',    label: '脚本生成', icon: '📝', description: 'AI 根据 brief 生成宣传片脚本' },
  { key: 'storyboard',label: '镜头设定', icon: '🎞️', description: '设定每个镜头的画面、时长和转场' },
  { key: 'audio',     label: '配音配乐', icon: '🎵', description: '配音选择 + 背景音乐 + 混音预览' },
  { key: 'preview',   label: '合成预览', icon: '👁️', description: '预览宣传片成片效果，微调细节' },
  { key: 'export',    label: '导出',     icon: '📤', description: '多格式导出，分轨/导播台' },
]

// ── 当前步骤 ──
const currentStepIndex = ref(0)

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
  router.replace({
    path: '/promo-editor',
    query: { step: STEPS[index]!.key },
  })
}

function goNext() { goToStep(currentStepIndex.value + 1) }
function goPrev() { goToStep(currentStepIndex.value - 1) }

// ── 步骤状态（已完成/进行中/未开始）──
const completedSteps = ref<Set<number>>(new Set())

function markCompleted(index: number) {
  completedSteps.value.add(index)
  completedSteps.value = new Set(completedSteps.value)
}

function stepState(index: number): 'done' | 'active' | 'pending' {
  if (completedSteps.value.has(index)) return 'done'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

// ── 项目名 ──
const projectName = ref('宣传片项目')

// ══════════════════════════════════════════════════════
// Step 4: 配音配乐 — 详细实现
// ══════════════════════════════════════════════════════

// ── 配音设置 ──
const narrationText = ref(
  '在这个充满机遇的时代，我们的品牌以创新为驱动，用科技改变生活。从产品研发到用户体验，每一步都精益求精，只为给您带来更好的选择。'
)

interface VoiceOption {
  id: string
  label: string
  desc: string
  icon: string
}

const voiceOptions: VoiceOption[] = [
  { id: 'ai-male',    label: 'AI男声',   desc: '沉稳大气，适合企业宣传', icon: '🗣️' },
  { id: 'ai-female',  label: 'AI女声',   desc: '温柔亲切，适合品牌故事', icon: '👩' },
  { id: 'child',      label: '童声',     desc: '活泼可爱，适合亲子/教育', icon: '👶' },
  { id: 'broadcaster',label: '播音腔',   desc: '专业新闻播音风格',       icon: '🎙️' },
  { id: 'emotional',  label: '情绪配音', desc: '富有感染力的情绪表达',   icon: '🎭' },
]

const selectedVoice = ref('ai-male')
const voicePreviewing = ref(false)

function toggleVoicePreview() {
  voicePreviewing.value = !voicePreviewing.value
  if (voicePreviewing.value) {
    setTimeout(() => { voicePreviewing.value = false }, 3000)
  }
}

// ── 音乐设置 ──
interface MusicType {
  id: string
  label: string
  icon: string
  color: string
}

const musicTypes: MusicType[] = [
  { id: 'corporate', label: '企业大气', icon: '🏢', color: '#818cf8' },
  { id: 'tech',      label: '科技感',   icon: '🔬', color: '#06b6d4' },
  { id: 'warm',      label: '温馨感动', icon: '💝', color: '#f472b6' },
  { id: 'fashion',   label: '时尚潮流', icon: '💃', color: '#a78bfa' },
  { id: 'retro',     label: '复古',     icon: '📻', color: '#f59e0b' },
  { id: 'chinese',   label: '国风',     icon: '🏮', color: '#ef4444' },
]

const selectedMusicType = ref('corporate')
const selectedMusicName = ref('')
const aiMusicGenerating = ref(false)
const aiMusicProgress = ref(0)

// AudioSelector 兼容数据
const selectedAudioEntry = ref<any>(null)
const musicRecommendations = ref<any[]>([
  { id: 'r1', name: '品牌力量 - Corporate Epic', duration: 120, mood: [{ id: 'epic', label: '大气', color: '#818cf8' }] },
  { id: 'r2', name: '创新之路 - Tech Inspire', duration: 95, mood: [{ id: 'tech', label: '科技', color: '#06b6d4' }] },
  { id: 'r3', name: '温暖叙事 - Warm Heart', duration: 110, mood: [{ id: 'warm', label: '温馨', color: '#f472b6' }] },
])

function startAiMusicGen() {
  if (aiMusicGenerating.value) return
  aiMusicGenerating.value = true
  aiMusicProgress.value = 0
  const timer = setInterval(() => {
    aiMusicProgress.value += 3
    if (aiMusicProgress.value >= 100) {
      clearInterval(timer)
      aiMusicGenerating.value = false
      aiMusicProgress.value = 100
      selectedMusicName.value = `AI生成 - ${musicTypes.find(m => m.id === selectedMusicType.value)?.label || ''} 风格`
    }
  }, 80)
}

function openMaterialLibrary() {
  // 占位：打开素材库弹窗
  selectedMusicName.value = '素材库 - 企业大气BGM_01'
}

// ── 时长匹配 ──
const scriptDuration = ref(62) // 脚本时长（秒）
const musicDuration = computed(() => {
  if (selectedMusicName.value) {
    // 模拟：AI 生成或素材库的音乐时长
    if (aiMusicProgress.value >= 100) return scriptDuration.value // AI 生成自动匹配
    return Math.round(scriptDuration.value * (0.9 + Math.random() * 0.2))
  }
  return 0
})

const durationMatched = computed(() => {
  if (!musicDuration.value) return false
  return Math.abs(musicDuration.value - scriptDuration.value) <= 2
})

// ── 混音预览 ──
const isMixPlaying = ref(false)
const voiceoverVolume = ref(70)
const voiceoverMuted = ref(false)
const musicVolume = ref(40)
const musicMuted = ref(false)

function toggleMixPlayback() {
  isMixPlaying.value = !isMixPlaying.value
}

// AutoScoreButton 状态
const autoScoreStatus = ref<'idle' | 'analyzing' | 'matching' | 'generating' | 'mixing' | 'complete' | 'error' | 'timeout'>('idle')
const autoScoreProgress = ref(0)

function onAutoScoreClick() {
  autoScoreStatus.value = 'analyzing'
  autoScoreProgress.value = 0
  const steps = ['analyzing', 'matching', 'generating', 'mixing', 'complete'] as const
  let stepIdx = 0
  const timer = setInterval(() => {
    autoScoreProgress.value += 5
    if (autoScoreProgress.value >= (stepIdx + 1) * 20 && stepIdx < steps.length - 1) {
      stepIdx++
      autoScoreStatus.value = steps[stepIdx]
    }
    if (autoScoreProgress.value >= 100) {
      clearInterval(timer)
      autoScoreStatus.value = 'complete'
      autoScoreProgress.value = 100
    }
  }, 100)
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="pe-root">
    <!-- ═══════════ 顶部标题栏 ═══════════ -->
    <header class="pe-header">
      <div class="pe-header-left">
        <button class="pe-back-btn" @click="router.push('/')">← 返回</button>
        <span class="pe-project-name">{{ projectName }}</span>
        <span class="pe-header-sep">·</span>
        <span class="pe-header-sub">宣传片编辑器</span>
      </div>
      <div class="pe-header-right">
        <span class="pe-step-indicator">步骤 {{ currentStepIndex + 1 }} / {{ STEPS.length }}</span>
      </div>
    </header>

    <!-- ═══════════ 步骤栏 ═══════════ -->
    <nav class="pe-stepbar">
      <div
        v-for="(step, idx) in STEPS"
        :key="step.key"
        class="pe-step-item"
        :class="{
          'pe-step-item--active': stepState(idx) === 'active',
          'pe-step-item--done': stepState(idx) === 'done',
          'pe-step-item--pending': stepState(idx) === 'pending',
        }"
        @click="goToStep(idx)"
      >
        <div class="pe-step-dot">
          <span v-if="stepState(idx) === 'done'" class="pe-step-check">✓</span>
          <span v-else class="pe-step-num">{{ idx + 1 }}</span>
        </div>
        <div class="pe-step-text">
          <span class="pe-step-icon">{{ step.icon }}</span>
          <span class="pe-step-label">{{ step.label }}</span>
        </div>
        <div v-if="idx < STEPS.length - 1" class="pe-step-line" :class="{ 'pe-step-line--done': stepState(idx) === 'done' }"></div>
      </div>
    </nav>

    <!-- ═══════════ 步骤内容区 ═══════════ -->
    <div class="pe-body">
      <Transition name="pe-slide" mode="out-in">

        <!-- ── Step 1: 品牌brief ── -->
        <div v-if="currentStep.key === 'brief'" key="brief" class="pe-panel">
          <div class="pe-panel-inner">
            <h2 class="pe-panel-title">📋 品牌brief</h2>
            <p class="pe-panel-desc">填写品牌信息、目标受众和核心卖点</p>
            <div class="pe-form-area">
              <div class="pe-form-group">
                <label class="pe-form-label">品牌名称</label>
                <input class="pe-form-input" placeholder="输入品牌名称..." />
              </div>
              <div class="pe-form-group">
                <label class="pe-form-label">目标受众</label>
                <input class="pe-form-input" placeholder="如：25-40岁都市白领..." />
              </div>
              <div class="pe-form-group">
                <label class="pe-form-label">核心卖点</label>
                <textarea class="pe-form-textarea" placeholder="描述品牌的核心价值和宣传重点..." rows="4"></textarea>
              </div>
              <div class="pe-form-group">
                <label class="pe-form-label">宣传时长</label>
                <div class="pe-duration-options">
                  <button
                    v-for="d in [15, 30, 60, 90, 120]"
                    :key="d"
                    class="pe-duration-chip"
                    :class="{ 'pe-duration-chip--active': scriptDuration === d }"
                    @click="scriptDuration = d"
                  >{{ d }}秒</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 2: 脚本生成 ── -->
        <div v-else-if="currentStep.key === 'script'" key="script" class="pe-panel">
          <div class="pe-panel-inner">
            <h2 class="pe-panel-title">📝 脚本生成</h2>
            <p class="pe-panel-desc">AI 根据品牌 brief 自动生成宣传片脚本</p>
            <div class="pe-placeholder-area">
              <div class="pe-placeholder-icon">📝</div>
              <div class="pe-placeholder-text">脚本生成区</div>
              <div class="pe-placeholder-hint">点击「AI 生成脚本」后，将自动根据 brief 生成旁白文案和镜头描述</div>
              <button class="pe-action-btn" @click="markCompleted(1)">✨ AI 生成脚本</button>
            </div>
          </div>
        </div>

        <!-- ── Step 3: 镜头设定 ── -->
        <div v-else-if="currentStep.key === 'storyboard'" key="storyboard" class="pe-panel">
          <div class="pe-panel-inner">
            <h2 class="pe-panel-title">🎞️ 镜头设定</h2>
            <p class="pe-panel-desc">设定每个镜头的画面、时长和转场效果</p>
            <div class="pe-placeholder-area">
              <div class="pe-placeholder-icon">🎞️</div>
              <div class="pe-placeholder-text">镜头设定区</div>
              <div class="pe-placeholder-hint">拖拽排列镜头，设定画面内容、运镜方式和转场效果</div>
              <button class="pe-action-btn" @click="markCompleted(2)">🎬 开始镜头设定</button>
            </div>
          </div>
        </div>

        <!-- ── Step 4: 配音配乐（详细实现）── -->
        <div v-else-if="currentStep.key === 'audio'" key="audio" class="pe-panel pe-panel--flush">
          <div class="pe-audio-root">
            <!-- 顶部标题 -->
            <div class="pe-audio-header">
              <h2 class="pe-audio-title">🎵 配音配乐</h2>
              <span class="pe-audio-subtitle">设置配音、选择背景音乐并预览混音效果</span>
            </div>

            <!-- 主内容：左配音 + 右音乐 -->
            <div class="pe-audio-columns">
              <!-- ══ 左列：配音设置 ══ -->
              <div class="pe-audio-col pe-audio-col--voice">
                <div class="pe-col-card">
                  <div class="pe-col-header">
                    <span class="pe-col-icon">🎙️</span>
                    <span class="pe-col-title">配音设置</span>
                  </div>

                  <!-- 旁白文本 -->
                  <div class="pe-field-group">
                    <label class="pe-field-label">旁白文案</label>
                    <textarea
                      v-model="narrationText"
                      class="pe-narration-textarea"
                      placeholder="输入旁白文案..."
                      rows="5"
                    ></textarea>
                    <div class="pe-field-hint">
                      字数：{{ narrationText.length }} · 预计时长：{{ formatTime(scriptDuration) }}
                    </div>
                  </div>

                  <!-- 音色选择 -->
                  <div class="pe-field-group">
                    <label class="pe-field-label">音色选择</label>
                    <div class="pe-voice-grid">
                      <div
                        v-for="voice in voiceOptions"
                        :key="voice.id"
                        class="pe-voice-card"
                        :class="{ 'pe-voice-card--active': selectedVoice === voice.id }"
                        @click="selectedVoice = voice.id"
                      >
                        <span class="pe-voice-icon">{{ voice.icon }}</span>
                        <span class="pe-voice-name">{{ voice.label }}</span>
                        <span class="pe-voice-desc">{{ voice.desc }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 试听按钮 -->
                  <button
                    class="pe-preview-voice-btn"
                    :class="{ 'pe-preview-voice-btn--playing': voicePreviewing }"
                    @click="toggleVoicePreview"
                  >
                    {{ voicePreviewing ? '⏸ 播放中...' : '▶ 试听配音' }}
                  </button>
                </div>
              </div>

              <!-- ══ 右列：音乐设置 ══ -->
              <div class="pe-audio-col pe-audio-col--music">
                <div class="pe-col-card">
                  <div class="pe-col-header">
                    <span class="pe-col-icon">🎶</span>
                    <span class="pe-col-title">背景音乐</span>
                  </div>

                  <!-- 音乐风格选择 -->
                  <div class="pe-field-group">
                    <label class="pe-field-label">音乐风格</label>
                    <div class="pe-music-type-grid">
                      <div
                        v-for="mt in musicTypes"
                        :key="mt.id"
                        class="pe-music-type-card"
                        :class="{ 'pe-music-type-card--active': selectedMusicType === mt.id }"
                        @click="selectedMusicType = mt.id"
                      >
                        <span class="pe-music-type-icon">{{ mt.icon }}</span>
                        <span class="pe-music-type-name">{{ mt.label }}</span>
                        <div
                          class="pe-music-type-bar"
                          :style="{ background: mt.color }"
                        ></div>
                      </div>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="pe-music-actions">
                    <button
                      class="pe-music-gen-btn"
                      :class="{ 'pe-music-gen-btn--loading': aiMusicGenerating }"
                      @click="startAiMusicGen"
                      :disabled="aiMusicGenerating"
                    >
                      {{ aiMusicGenerating ? `生成中 ${aiMusicProgress}%...` : '🤖 AI生成' }}
                    </button>
                    <button class="pe-music-lib-btn" @click="openMaterialLibrary">
                      📂 从素材库选择
                    </button>
                  </div>

                  <!-- AI 生成进度 -->
                  <div v-if="aiMusicGenerating" class="pe-music-progress">
                    <div class="pe-music-progress-bar">
                      <div class="pe-music-progress-fill" :style="{ width: `${aiMusicProgress}%` }"></div>
                    </div>
                  </div>

                  <!-- AudioSelector 组件 -->
                  <div class="pe-field-group">
                    <label class="pe-field-label">快速选择</label>
                    <AudioSelector
                      :selected="selectedAudioEntry"
                      :recommendations="musicRecommendations"
                      :show-ai-generate="true"
                      :show-material-library="true"
                      placeholder="搜索或选择背景音乐..."
                      @select="(item: any) => { selectedAudioEntry = item; selectedMusicName = item.name }"
                      @ai-generate="startAiMusicGen"
                      @open-material-library="openMaterialLibrary"
                    />
                  </div>

                  <!-- 已选音乐 -->
                  <div v-if="selectedMusicName" class="pe-music-selected">
                    <div class="pe-music-selected-info">
                      <span class="pe-music-selected-icon">🎵</span>
                      <span class="pe-music-selected-name">{{ selectedMusicName }}</span>
                    </div>
                  </div>

                  <!-- 时长匹配 -->
                  <div class="pe-duration-match">
                    <div class="pe-duration-match-row">
                      <span class="pe-duration-label">脚本时长</span>
                      <span class="pe-duration-value">{{ formatTime(scriptDuration) }}</span>
                    </div>
                    <div class="pe-duration-match-row">
                      <span class="pe-duration-label">音乐时长</span>
                      <span class="pe-duration-value" :class="{ 'pe-duration-value--matched': durationMatched }">
                        {{ musicDuration ? formatTime(musicDuration) : '—' }}
                      </span>
                    </div>
                    <div class="pe-duration-match-status">
                      <span v-if="durationMatched" class="pe-match-ok">✓ 时长已自动匹配</span>
                      <span v-else-if="musicDuration" class="pe-match-warn">⚠ 时长差异 {{ Math.abs(musicDuration - scriptDuration) }}s，将自动裁剪</span>
                      <span v-else class="pe-match-empty">请先选择或生成音乐</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ══ 底部：混音预览 ══ -->
            <div class="pe-mix-section">
              <div class="pe-mix-header">
                <span class="pe-mix-title">🎧 混音预览</span>
                <button
                  class="pe-mix-play-btn"
                  :class="{ 'pe-mix-play-btn--playing': isMixPlaying }"
                  @click="toggleMixPlayback"
                >
                  {{ isMixPlaying ? '⏸ 暂停' : '▶ 同步播放' }}
                </button>
              </div>

              <div class="pe-mix-controls">
                <!-- 配音音量 -->
                <div class="pe-mix-track">
                  <span class="pe-mix-track-label">🎙️ 配音</span>
                  <VolumeSlider
                    :value="voiceoverVolume"
                    :muted="voiceoverMuted"
                    size="md"
                    :show-label="true"
                    @update:value="(v: number) => voiceoverVolume = v"
                    @update:muted="(v: boolean) => voiceoverMuted = v"
                  />
                </div>

                <!-- 音乐音量 -->
                <div class="pe-mix-track">
                  <span class="pe-mix-track-label">🎶 音乐</span>
                  <VolumeSlider
                    :value="musicVolume"
                    :muted="musicMuted"
                    size="md"
                    :show-label="true"
                    @update:value="(v: number) => musicVolume = v"
                    @update:muted="(v: boolean) => musicMuted = v"
                  />
                </div>

                <!-- AI 智能配乐按钮 -->
                <div class="pe-mix-autoscore">
                  <AutoScoreButton
                    :status="autoScoreStatus"
                    :progress="autoScoreProgress"
                    @click="onAutoScoreClick"
                    @cancel="autoScoreStatus = 'idle'"
                    @retry="onAutoScoreClick"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 5: 合成预览 ── -->
        <div v-else-if="currentStep.key === 'preview'" key="preview" class="pe-panel">
          <div class="pe-panel-inner">
            <h2 class="pe-panel-title">👁️ 合成预览</h2>
            <p class="pe-panel-desc">预览宣传片成片效果，确认画面、配音和节奏</p>
            <div class="pe-preview-stage">
              <div class="pe-preview-placeholder">
                <div class="pe-preview-empty-icon">🎬</div>
              </div>
              <button class="pe-action-btn" @click="markCompleted(4)">🎬 生成合成预览</button>
            </div>
          </div>
        </div>

        <!-- ── Step 6: 导出 ── -->
        <div v-else-if="currentStep.key === 'export'" key="export" class="pe-panel">
          <div class="pe-panel-inner">
            <h2 class="pe-panel-title">📤 导出</h2>
            <p class="pe-panel-desc">选择导出格式和内容</p>
            <div class="pe-export-options">
              <div class="pe-export-card">
                <span class="pe-export-icon">🎵</span>
                <span class="pe-export-name">导出配音+配乐分轨</span>
                <span class="pe-export-desc">后期可独立调整</span>
              </div>
              <div class="pe-export-card">
                <span class="pe-export-icon">🎛️</span>
                <span class="pe-export-name">导出导播台</span>
                <span class="pe-export-desc">含 cue 点标记</span>
              </div>
              <div class="pe-export-card">
                <span class="pe-export-icon">🎥</span>
                <span class="pe-export-name">MP4 成片</span>
                <span class="pe-export-desc">含音频合成</span>
              </div>
              <div class="pe-export-card">
                <span class="pe-export-icon">📦</span>
                <span class="pe-export-name">项目包</span>
                <span class="pe-export-desc">完整工程文件</span>
              </div>
            </div>
            <button class="pe-action-btn" @click="router.push('/export')">📤 前往导出中心</button>
          </div>
        </div>

      </Transition>
    </div>

    <!-- ═══════════ 底部导航 ═══════════ -->
    <footer class="pe-footer" v-if="currentStep.key !== 'audio'">
      <div class="pe-footer-left">
        <button v-if="currentStepIndex > 0" class="pe-nav-btn" @click="goPrev">← 上一步</button>
      </div>
      <div class="pe-footer-center">
        <span class="pe-footer-step-info">
          {{ currentStep.icon }} {{ currentStep.label }} — {{ currentStep.description }}
        </span>
      </div>
      <div class="pe-footer-right">
        <button
          v-if="currentStepIndex < STEPS.length - 1"
          class="pe-nav-btn pe-nav-btn--primary"
          @click="() => { markCompleted(currentStepIndex); goNext() }"
        >下一步 →</button>
        <button
          v-else
          class="pe-nav-btn pe-nav-btn--primary"
          @click="router.push('/export')"
        >📤 完成导出</button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.pe-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

/* ═══════════ 顶部标题栏 ═══════════ */
.pe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  flex-shrink: 0;
}
.pe-header-left { display: flex; align-items: center; gap: 10px; }
.pe-back-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.pe-back-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.pe-project-name { font-size: 15px; font-weight: 700; color: var(--text-primary, #e4e4e7); }
.pe-header-sep { color: var(--text-muted, #64748b); }
.pe-header-sub { font-size: 13px; color: var(--text-secondary, #94a3b8); }
.pe-header-right { display: flex; align-items: center; gap: 8px; }
.pe-step-indicator {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
  font-weight: 600;
}

/* ═══════════ 步骤栏 ═══════════ */
.pe-stepbar {
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
.pe-stepbar::-webkit-scrollbar { display: none; }

.pe-step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  padding: 4px 0;
  position: relative;
}

.pe-step-dot {
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
.pe-step-item--pending .pe-step-dot {
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #64748b);
  border: 1px solid var(--border, #1f2937);
}
.pe-step-item--active .pe-step-dot {
  background: var(--accent, #818cf8);
  color: #fff;
  box-shadow: 0 0 12px rgba(129, 140, 248, 0.3);
}
.pe-step-item--done .pe-step-dot {
  background: #34d399;
  color: #fff;
}
.pe-step-check { font-size: 12px; }
.pe-step-num { font-size: 12px; }

.pe-step-text { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.pe-step-icon { font-size: 14px; }
.pe-step-label { font-size: 12px; font-weight: 600; }
.pe-step-item--pending .pe-step-label { color: var(--text-muted, #64748b); }
.pe-step-item--active .pe-step-label { color: var(--accent, #818cf8); }
.pe-step-item--done .pe-step-label { color: #34d399; }

.pe-step-line {
  width: 24px;
  height: 2px;
  background: var(--border, #1f2937);
  margin: 0 4px;
  flex-shrink: 0;
  transition: background 200ms;
}
.pe-step-line--done { background: #34d399; }

/* ═══════════ 步骤内容区 ═══════════ */
.pe-body { flex: 1; overflow-y: auto; min-height: 0; }
.pe-panel { height: 100%; display: flex; flex-direction: column; }
.pe-panel--flush { overflow: hidden; }
.pe-panel-inner {
  flex: 1;
  padding: 28px 32px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pe-panel-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary, #e4e4e7);
  margin: 0 0 6px;
  text-align: center;
}
.pe-panel-desc {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 24px;
  text-align: center;
}

/* ── 表单区域（Step 1）── */
.pe-form-area {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.pe-form-group { display: flex; flex-direction: column; gap: 6px; }
.pe-form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
}
.pe-form-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #e4e4e7);
  font-size: 13px;
  outline: none;
  transition: border-color 200ms;
}
.pe-form-input:focus { border-color: var(--accent, #818cf8); }
.pe-form-textarea {
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
.pe-form-textarea:focus { border-color: var(--accent, #818cf8); }
.pe-duration-options { display: flex; gap: 8px; flex-wrap: wrap; }
.pe-duration-chip {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.pe-duration-chip:hover { border-color: var(--accent, #818cf8); }
.pe-duration-chip--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
  font-weight: 600;
}

/* ── 占位区域（Steps 2, 3, 5）── */
.pe-placeholder-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
}
.pe-placeholder-icon { font-size: 48px; opacity: 0.3; }
.pe-placeholder-text { font-size: 16px; font-weight: 700; color: var(--text-secondary, #94a3b8); }
.pe-placeholder-hint { font-size: 12px; color: var(--text-muted, #64748b); text-align: center; max-width: 400px; }

/* ── 预览区 ── */
.pe-preview-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 480px;
}
.pe-preview-placeholder {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  background: var(--bg-secondary, #111827);
  border: 1px solid var(--border, #1f2937);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pe-preview-empty-icon { font-size: 48px; opacity: 0.3; }

/* ── 导出（Step 6）── */
.pe-export-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
}
.pe-export-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 14px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 10px;
  background: var(--bg-secondary, #111827);
  cursor: pointer;
  transition: border-color 150ms;
}
.pe-export-card:hover { border-color: var(--accent, #818cf8); }
.pe-export-icon { font-size: 28px; }
.pe-export-name { font-size: 13px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.pe-export-desc { font-size: 11px; color: var(--text-muted, #64748b); }

/* ── 公共按钮 ── */
.pe-action-btn {
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
.pe-action-btn:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }
.pe-action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* ═══════════ Step 4: 配音配乐 ═══════════ */
.pe-audio-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary, #0a0e1a);
}

.pe-audio-header {
  padding: 16px 24px 8px;
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.pe-audio-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary, #e4e4e7);
  margin: 0;
}
.pe-audio-subtitle {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

/* 双列布局 */
.pe-audio-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 12px 24px;
  flex: 1;
  min-height: 0;
}

.pe-col-card {
  background: var(--bg-secondary, #111827);
  border: 1px solid var(--border, #1f2937);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pe-col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border, #1f2937);
}
.pe-col-icon { font-size: 18px; }
.pe-col-title { font-size: 14px; font-weight: 700; color: var(--text-primary, #e4e4e7); }

/* 字段组 */
.pe-field-group { display: flex; flex-direction: column; gap: 6px; }
.pe-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pe-field-hint {
  font-size: 10px;
  color: var(--text-muted, #64748b);
}

/* 旁白文本 */
.pe-narration-textarea {
  width: 100%;
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
  line-height: 1.6;
}
.pe-narration-textarea:focus { border-color: var(--accent, #818cf8); }

/* 音色选择 */
.pe-voice-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.pe-voice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 8px;
  background: var(--bg-tertiary, #1a2332);
  cursor: pointer;
  transition: all 150ms;
  text-align: center;
}
.pe-voice-card:hover { border-color: var(--border-strong, #334155); }
.pe-voice-card--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.08);
}
.pe-voice-icon { font-size: 18px; }
.pe-voice-name { font-size: 10px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.pe-voice-desc { font-size: 9px; color: var(--text-muted, #64748b); line-height: 1.2; }

/* 试听按钮 */
.pe-preview-voice-btn {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
  align-self: flex-start;
}
.pe-preview-voice-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.pe-preview-voice-btn--playing {
  border-color: #34d399;
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
}

/* 音乐风格 */
.pe-music-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.pe-music-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px 8px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 8px;
  background: var(--bg-tertiary, #1a2332);
  cursor: pointer;
  transition: all 150ms;
  position: relative;
  overflow: hidden;
}
.pe-music-type-card:hover { border-color: var(--border-strong, #334155); }
.pe-music-type-card--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.06);
}
.pe-music-type-icon { font-size: 20px; }
.pe-music-type-name { font-size: 11px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.pe-music-type-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0.6;
}
.pe-music-type-card--active .pe-music-type-bar { opacity: 1; }

/* 音乐操作按钮 */
.pe-music-actions {
  display: flex;
  gap: 8px;
}
.pe-music-gen-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
}
.pe-music-gen-btn:hover { box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3); }
.pe-music-gen-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pe-music-gen-btn--loading {
  background: var(--bg-tertiary, #1a2332);
  color: var(--accent, #818cf8);
  border: 1px solid var(--accent, #818cf8);
}
.pe-music-lib-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
}
.pe-music-lib-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }

/* 进度条 */
.pe-music-progress { padding: 4px 0; }
.pe-music-progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary, #1a2332);
  overflow: hidden;
}
.pe-music-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 80ms linear;
}

/* 已选音乐 */
.pe-music-selected {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.2);
}
.pe-music-selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pe-music-selected-icon { font-size: 16px; }
.pe-music-selected-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #818cf8);
}

/* 时长匹配 */
.pe-duration-match {
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #1f2937);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pe-duration-match-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pe-duration-label { font-size: 11px; color: var(--text-muted, #64748b); }
.pe-duration-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #e4e4e7);
  font-variant-numeric: tabular-nums;
}
.pe-duration-value--matched { color: #34d399; }
.pe-duration-match-status { padding-top: 4px; }
.pe-match-ok { font-size: 11px; color: #34d399; font-weight: 600; }
.pe-match-warn { font-size: 11px; color: #f59e0b; }
.pe-match-empty { font-size: 11px; color: var(--text-muted, #64748b); }

/* ═══════════ 混音预览区 ═══════════ */
.pe-mix-section {
  border-top: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  padding: 14px 24px;
  flex-shrink: 0;
}
.pe-mix-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.pe-mix-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #e4e4e7); }
.pe-mix-play-btn {
  margin-left: auto;
  padding: 4px 14px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
}
.pe-mix-play-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.pe-mix-play-btn--playing {
  border-color: #34d399;
  color: #34d399;
  background: rgba(52, 211, 153, 0.08);
}

.pe-mix-controls {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.pe-mix-track {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pe-mix-track-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  white-space: nowrap;
}
.pe-mix-autoscore {
  margin-left: auto;
}

/* ═══════════ 底部导航 ═══════════ */
.pe-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  flex-shrink: 0;
}
.pe-footer-left,
.pe-footer-right { flex-shrink: 0; min-width: 100px; }
.pe-footer-right { text-align: right; }
.pe-footer-center { flex: 1; text-align: center; }
.pe-footer-step-info { font-size: 12px; color: var(--text-secondary, #94a3b8); }

.pe-nav-btn {
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
.pe-nav-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }
.pe-nav-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-weight: 600;
}
.pe-nav-btn--primary:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }

/* ═══════════ 过渡动画 ═══════════ */
.pe-slide-enter-active,
.pe-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.pe-slide-enter-from { opacity: 0; transform: translateX(20px); }
.pe-slide-leave-to { opacity: 0; transform: translateX(-20px); }

/* ── 响应式 ── */
@media (max-width: 900px) {
  .pe-audio-columns { grid-template-columns: 1fr; }
  .pe-voice-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .pe-stepbar { padding: 8px 12px; }
  .pe-step-label { display: none; }
  .pe-step-line { width: 12px; }
  .pe-voice-grid { grid-template-columns: repeat(2, 1fr); }
  .pe-music-type-grid { grid-template-columns: repeat(2, 1fr); }
  .pe-export-options { grid-template-columns: 1fr; }
  .pe-panel-inner { padding: 20px 16px; }
  .pe-mix-controls { flex-direction: column; align-items: stretch; }
  .pe-mix-autoscore { margin-left: 0; }
}
</style>
