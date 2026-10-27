<script setup lang="ts">

/**

 * OnboardingFlow - 3-step guided overlay for first-time users

 * Appears after registration, stores completion in localStorage

 */

import { ref, computed } from 'vue'

import { useRouter } from 'vue-router'

const router = useRouter()

const emit = defineEmits<{

  (e: 'complete', payload: { module: string; template: string }): void

  (e: 'skip'): void

}>()

const currentStep = ref(1)

const selectedModule = ref('')

const selectedTemplate = ref('')

/* ------------------------------------------------------------------ */

/*  Module definitions                                                 */

/* ------------------------------------------------------------------ */

interface Module {

  id: string

  icon: string

  name: string

  desc: string

}

const modules: Module[] = [

  { id: 'comic',     icon: '🎬', name: '动画',   desc: '动画短片·动漫改编·动态漫画创作' },

  { id: 'story',     icon: '📖', name: '故事',   desc: '小说·剧本·互动叙事' },

  { id: 'promo',     icon: '🎬', name: '宣传片', desc: '品牌宣传·产品介绍视频' },

  { id: 'short',     icon: '📱', name: '短视频', desc: '竖屏短视频·社交媒体内容' },

  { id: 'ad',        icon: '🖼', name: '广告图', desc: '海报·Banner·广告素材设计' },

  { id: 'music',     icon: '🎵', name: '配乐',   desc: 'BGM·音效·原创音乐生成' },

]

/* ------------------------------------------------------------------ */

/*  Template definitions (keyed by module id)                          */

/* ------------------------------------------------------------------ */

interface Template {

  id: string

  name: string

  thumb: string

  duration: string

}

const templateMap: Record<string, Template[]> = {

  comic: [

    { id: 'comic-episodic',  name: '动画第一集',   thumb: '📑', duration: '~15分钟' },

    { id: 'comic-4koma',     name: '4格动画模板',           thumb: '📋', duration: '~5分钟' },

    { id: 'comic-strip',     name: '横版动画',             thumb: '🖼', duration: '~8分钟' },

  ],

  story: [

    { id: 'story-novel',     name: '短篇小说模板',         thumb: '📖', duration: '~20分钟' },

    { id: 'story-script',    name: '剧本大纲',             thumb: '📝', duration: '~12分钟' },

    { id: 'story-branch',    name: '互动分支故事',         thumb: '🔀', duration: '~25分钟' },

  ],

  promo: [

    { id: 'promo-brand',     name: '品牌故事宣传片',       thumb: '🎬', duration: '~10分钟' },

    { id: 'promo-product',   name: '产品功能介绍',         thumb: '📱', duration: '~8分钟' },

    { id: 'promo-event',     name: '活动预告片',           thumb: '📅', duration: '~5分钟' },

  ],

  short: [

    { id: 'short-tiktok',    name: '竖屏短视频·悬念开场', thumb: '📱', duration: '~6分钟' },

    { id: 'short-tutorial',  name: '教程类短视频',         thumb: '📚', duration: '~10分钟' },

    { id: 'short-vlog',      name: 'Vlog风格短片',           thumb: '📷', duration: '~8分钟' },

  ],

  ad: [

    { id: 'ad-poster',       name: '竖版海报模板',         thumb: '🖼', duration: '~4分钟' },

    { id: 'ad-banner',       name: 'Banner广告位',           thumb: '📐', duration: '~3分钟' },

    { id: 'ad-social',       name: '社交媒体广告图',       thumb: '📣', duration: '~5分钟' },

  ],

  music: [

    { id: 'music-bg',        name: '背景音乐·轻快',       thumb: '🎶', duration: '~3分钟' },

    { id: 'music-epic',      name: '史诗感配乐',           thumb: '🎼', duration: '~5分钟' },

    { id: 'music-jingle',    name: '片头音效',             thumb: '🔔', duration: '~2分钟' },

  ],

}

const templates = computed(() => templateMap[selectedModule.value] || [])

/* ------------------------------------------------------------------ */

/*  Editor route mapping                                               */

/* ------------------------------------------------------------------ */

const editorRoutes: Record<string, string> = {

  comic: '/create/animation',

  story: '/create/novel',

  promo: '/create/promo',

  short: '/create/ad-video',

  ad:    '/create/ad-image',

  music: '/create/music',

}

/* ------------------------------------------------------------------ */

/*  Actions                                                            */

/* ------------------------------------------------------------------ */

function selectModule(id: string) {

  selectedModule.value = id

  selectedTemplate.value = ''

}

function selectTemplate(id: string) {

  selectedTemplate.value = id

}

function nextStep() {

  if (currentStep.value < 3) currentStep.value++

}

function prevStep() {

  if (currentStep.value > 1) currentStep.value--

}

function skipOnboarding() {

  localStorage.setItem('onboarding-complete', 'true')

  emit('skip')

}

function startCreating() {

  localStorage.setItem('onboarding-complete', 'true')

  const route = editorRoutes[selectedModule.value] || '/create/animation'

  emit('complete', {

    module: selectedModule.value,

    template: selectedTemplate.value || 'blank',

  })

  // Navigate to the selected editor

  router.push(route)

}

function getModuleName(id: string): string {

  return modules.find(m => m.id === id)?.name || id

}

function getTemplateName(id: string): string {

  if (!id) return '从空白开始'

  const list = templateMap[selectedModule.value]

  return list?.find(t => t.id === id)?.name || id

}

</script>

<template>

  <Transition name="onb-fade">

    <div class="onb-overlay">

      <!-- Backdrop -->

      <div class="onb-backdrop" @click="skipOnboarding" />

      <!-- Modal -->

      <div class="onb-modal">

        <!-- Skip link (top right) -->

        <!-- Step indicator dots -->

        <div class="onb-dots">

          <span

            v-for="s in 3"

            :key="s"

            class="onb-dot"

            :class="{ 'onb-dot--active': s === currentStep, 'onb-dot--done': s < currentStep }"

          />

        </div>

        <!-- Step content with slide transition -->

        <Transition name="onb-slide" mode="out-in">

          <!-- ===== Step 1: Select Module ===== -->

          <div v-if="currentStep === 1" key="step1" class="onb-step">

            <div class="onb-module-grid">

              <button

                v-for="m in modules"

                :key="m.id"

                class="onb-module-card"

                :class="{ 'onb-module-card--selected': selectedModule === m.id }"

                @click="selectModule(m.id)"

              >

                <span class="onb-module-icon">{{ m.icon }}</span>

                <span class="onb-module-name">{{ m.name }}</span>

                <span class="onb-module-desc">{{ m.desc }}</span>

              </button>

            </div>

            <div class="onb-actions">

              <button

                class="onb-btn onb-btn--primary"

                :disabled="!selectedModule"

                @click="nextStep"

              >濠电偞鍨堕幐鎼佹晸鐟欙絾娅囬柨鐔诲Г濞兼瑩鏁撻弬銈嗗��</button>

            </div>

          </div>

          <!-- ===== Step 2: Select Template ===== -->

          <div v-else-if="currentStep === 2" key="step2" class="onb-step">

            <div class="onb-template-list">

              <button

                v-for="t in templates"

                :key="t.id"

                class="onb-template-card"

                :class="{ 'onb-template-card--selected': selectedTemplate === t.id }"

                @click="selectTemplate(t.id)"

              >

                <div class="onb-template-thumb">{{ t.thumb }}</div>

                <div class="onb-template-info">

                  <span class="onb-template-name">{{ t.name }}</span>

                </div>

                <span
                  v-if="selectedTemplate === t.id"
                  class="onb-template-check"
                >✓</span>

              </button>

            </div>

            <button

              class="onb-blank-option"

              @click="selectTemplate('')"

            >

            </button>

            <div class="onb-actions">

              <button class="onb-btn onb-btn--primary" @click="nextStep">濠电偞鍨堕幐鎼佹晸鐟欙絾娅囬柨鐔诲Г濞兼瑩鏁撻弬銈嗗��</button>

            </div>

          </div>

          <!-- ===== Step 3: Confirmation ===== -->

          <div v-else key="step3" class="onb-step onb-step--confirm">

            <div class="onb-confirm-summary">

              <div class="onb-confirm-row">

                <span class="onb-confirm-value">

                  {{ modules.find(m => m.id === selectedModule)?.icon }}

                  {{ getModuleName(selectedModule) }}

                </span>

              </div>

              <div class="onb-confirm-row">

                <span class="onb-confirm-label">婵犵�樻�勯幏鐑芥煃閳轰礁鏆炵紒璁规嫹</span>

                <span class="onb-confirm-value">{{ getTemplateName(selectedTemplate) }}</span>

              </div>

            </div>

            <div class="onb-actions onb-actions--center">

            </div>

          </div>

        </Transition>

      </div>

    </div>

  </Transition>

</template>

<style scoped>

/* ===== Overlay ===== */

.onb-overlay {

  position: fixed;

  inset: 0;

  z-index: 9999;

  display: flex;

  align-items: center;

  justify-content: center;

}

.onb-backdrop {

  position: absolute;

  inset: 0;

  background: rgba(0, 0, 0, 0.65);

  backdrop-filter: blur(8px);

}

.onb-modal {

  position: relative;

  z-index: 1;

  width: 90%;

  max-width: 680px;

  max-height: 90vh;

  overflow-y: auto;

  background: var(--bg-card, #1a1d24);

  border: 1px solid var(--border, #2a2d35);

  border-radius: 16px;

  padding: 32px 36px;

  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);

}

/* ===== Skip ===== */

.onb-skip {

  position: absolute;

  top: 16px;

  right: 20px;

  background: none;

  border: none;

  color: var(--text-secondary, #8b8fa3);

  font-size: 13px;

  cursor: pointer;

  font-family: inherit;

  padding: 4px 8px;

  border-radius: 4px;

  transition: color 0.2s;

}

.onb-skip:hover {

  color: var(--text-primary, #e8eaed);

}

/* ===== Dots ===== */

.onb-dots {

  display: flex;

  gap: 8px;

  justify-content: center;

  margin-bottom: 24px;

}

.onb-dot {

  width: 8px;

  height: 8px;

  border-radius: 50%;

  background: var(--border, #2a2d35);

  transition: all 0.3s;

}

.onb-dot--active {

  background: var(--accent, #6366f1);

  box-shadow: 0 0 8px var(--accent, #6366f1);

  transform: scale(1.3);

}

.onb-dot--done {

  background: var(--accent, #6366f1);

  opacity: 0.5;

}

/* ===== Step content ===== */

.onb-step {

  display: flex;

  flex-direction: column;

  gap: 8px;

}

.onb-title {

  font-size: 22px;

  font-weight: 700;

  margin: 0;

  color: var(--text-primary, #e8eaed);

  text-align: center;

}

.onb-subtitle {

  font-size: 14px;

  color: var(--text-secondary, #8b8fa3);

  margin: 0 0 16px;

  text-align: center;

}

/* ===== Module grid (Step 1) ===== */

.onb-module-grid {

  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 12px;

  margin-bottom: 12px;

}

.onb-module-card {

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 6px;

  padding: 20px 12px;

  background: var(--bg-secondary, #14161c);

  border: 2px solid var(--border, #2a2d35);

  border-radius: 12px;

  cursor: pointer;

  transition: all 0.25s;

  font-family: inherit;

  color: var(--text-primary, #e8eaed);

}

.onb-module-card:hover {

  border-color: var(--accent, #6366f1);

  transform: translateY(-2px);

}

.onb-module-card--selected {

  border-color: var(--accent, #6366f1);

  background: color-mix(in srgb, var(--accent, #6366f1) 10%, var(--bg-secondary, #14161c));

  box-shadow: 0 0 16px color-mix(in srgb, var(--accent, #6366f1) 30%, transparent);

}

.onb-module-icon {

  font-size: 32px;

  line-height: 1;

}

.onb-module-name {

  font-size: 15px;

  font-weight: 600;

}

.onb-module-desc {

  font-size: 11px;

  color: var(--text-secondary, #8b8fa3);

  text-align: center;

  line-height: 1.3;

}

/* ===== Template list (Step 2) ===== */

.onb-template-list {

  display: flex;

  flex-direction: column;

  gap: 10px;

  margin-bottom: 8px;

}

.onb-template-card {

  display: flex;

  align-items: center;

  gap: 14px;

  padding: 14px 16px;

  background: var(--bg-secondary, #14161c);

  border: 2px solid var(--border, #2a2d35);

  border-radius: 10px;

  cursor: pointer;

  transition: all 0.25s;

  font-family: inherit;

  color: var(--text-primary, #e8eaed);

  text-align: left;

  width: 100%;

}

.onb-template-card:hover {

  border-color: var(--accent, #6366f1);

}

.onb-template-card--selected {

  border-color: var(--accent, #6366f1);

  background: color-mix(in srgb, var(--accent, #6366f1) 8%, var(--bg-secondary, #14161c));

  box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #6366f1) 20%, transparent);

}

.onb-template-thumb {

  font-size: 28px;

  width: 48px;

  height: 48px;

  display: flex;

  align-items: center;

  justify-content: center;

  background: color-mix(in srgb, var(--accent, #6366f1) 8%, transparent);

  border-radius: 10px;

  flex-shrink: 0;

}

.onb-template-info {

  flex: 1;

  display: flex;

  flex-direction: column;

  gap: 2px;

}

.onb-template-name {

  font-size: 14px;

  font-weight: 600;

}

.onb-template-duration {

  font-size: 12px;

  color: var(--text-secondary, #8b8fa3);

}

.onb-template-use {

  font-size: 12px;

  color: var(--accent, #6366f1);

  padding: 4px 10px;

  border: 1px solid var(--accent, #6366f1);

  border-radius: 6px;

  white-space: nowrap;

}

.onb-template-check {

  font-size: 12px;

  color: #fff;

  padding: 4px 10px;

  background: var(--accent, #6366f1);

  border-radius: 6px;

  white-space: nowrap;

  font-weight: 600;

}

.onb-blank-option {

  display: flex;

  align-items: center;

  gap: 8px;

  justify-content: center;

  padding: 10px;

  background: none;

  border: 1px dashed var(--border, #2a2d35);

  border-radius: 8px;

  cursor: pointer;

  color: var(--text-secondary, #8b8fa3);

  font-size: 13px;

  font-family: inherit;

  transition: all 0.2s;

  margin-bottom: 12px;

}

.onb-blank-option:hover {

  border-color: var(--accent, #6366f1);

  color: var(--text-primary, #e8eaed);

}

.onb-template-check-sm {

  color: var(--accent, #6366f1);

  font-weight: 700;

}

/* ===== Confirmation (Step 3) ===== */

.onb-step--confirm {

  align-items: center;

}

.onb-confirm-summary {

  width: 100%;

  max-width: 380px;

  display: flex;

  flex-direction: column;

  gap: 10px;

  margin: 12px 0;

}

.onb-confirm-row {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 12px 16px;

  background: var(--bg-secondary, #14161c);

  border: 1px solid var(--border, #2a2d35);

  border-radius: 8px;

}

.onb-confirm-label {

  font-size: 13px;

  color: var(--text-secondary, #8b8fa3);

}

.onb-confirm-value {

  font-size: 14px;

  font-weight: 600;

  color: var(--text-primary, #e8eaed);

}

.onb-confirm-hint {

  font-size: 14px;

  color: var(--accent, #6366f1);

  margin: 8px 0 4px;

  text-align: center;

}

/* ===== Action buttons ===== */

.onb-actions {

  display: flex;

  gap: 10px;

  justify-content: center;

  margin-top: 8px;

}

.onb-actions--center {

  justify-content: center;

}

.onb-btn {

  padding: 10px 24px;

  border-radius: 8px;

  font-size: 14px;

  font-weight: 600;

  cursor: pointer;

  transition: all 0.2s;

  border: none;

  font-family: inherit;

}

.onb-btn--primary {

  background: var(--accent, #6366f1);

  color: #fff;

}

.onb-btn--primary:hover {

  filter: brightness(1.1);

  transform: translateY(-1px);

}

.onb-btn--primary:disabled {

  opacity: 0.4;

  cursor: not-allowed;

  transform: none;

  filter: none;

}

.onb-btn--ghost {

  background: transparent;

  border: 1px solid var(--border, #2a2d35);

  color: var(--text-secondary, #8b8fa3);

}

.onb-btn--ghost:hover {

  border-color: var(--accent, #6366f1);

  color: var(--text-primary, #e8eaed);

}

.onb-btn--start {

  background: linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6);

  color: #fff;

  font-size: 18px;

  padding: 14px 48px;

  border-radius: 12px;

  box-shadow: 0 4px 24px color-mix(in srgb, var(--accent, #6366f1) 40%, transparent);

}

.onb-btn--start:hover {

  filter: brightness(1.15);

  transform: translateY(-2px);

  box-shadow: 0 8px 32px color-mix(in srgb, var(--accent, #6366f1) 50%, transparent);

}

/* ===== Transitions ===== */

.onb-fade-enter-active,

.onb-fade-leave-active {

  transition: opacity 0.3s ease;

}

.onb-fade-enter-from,

.onb-fade-leave-to {

  opacity: 0;

}

.onb-slide-enter-active,

.onb-slide-leave-active {

  transition: all 0.3s ease;

}

.onb-slide-enter-from {

  opacity: 0;

  transform: translateX(30px);

}

.onb-slide-leave-to {

  opacity: 0;

  transform: translateX(-30px);

}

/* ===== Responsive ===== */

@media (max-width: 600px) {

  .onb-modal {

    padding: 24px 20px;

  }

  .onb-module-grid {

    grid-template-columns: repeat(2, 1fr);

  }

  .onb-title {

    font-size: 18px;

  }

}

</style>

