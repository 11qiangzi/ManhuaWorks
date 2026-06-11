<script setup lang="ts">
/**
 * GenerationProgressView · 生成进度
 * ManhuaWorks · W2
 *
 * 流程：
 * 1. 读 sessionStorage 里的 pending-job
 * 2. 调 createJob 启动任务
 * 3. 订阅 WebSocket 实时进度
 * 4. 渲染：步骤进度条 + 实时日志 + 成本 + 取消按钮
 */

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import FailoverIndicator from '@/components/studio/FailoverIndicator.vue'
import {
  createJob,
  cancelJob,
  subscribeProgress,
  type ProgressEvent,
  type GenerationStep
} from '@/api/ai-router'
import { PROVIDERS } from '@/api/ai-router'

interface PendingJob {
  projectId: string
  projectTitle: string
  callType: string
  provider: string
  model: string
  artStyle: string
  storyType: string
  prompt: string
  fileName: string
  tokenCount: number
}

const router = useRouter()

const job = ref<PendingJob | null>(null)
const starting = ref(true)
const startError = ref<string | null>(null)
const jobId = ref<string | null>(null)
const unsubscribe = ref<(() => void) | null>(null)

const event = ref<ProgressEvent | null>(null)
const logs = ref<Array<{ time: string; text: string; tone: 'info' | 'warn' | 'error' | 'success' }>>([])
const cancelling = ref(false)

const logBoxRef = ref<HTMLDivElement | null>(null)

/** 整体进度 0-100 */
const overallProgress = computed(() => event.value?.progress ?? 0)

/** 状态文案/颜色 */
const statusLabel = computed(() => {
  switch (event.value?.status) {
    case 'queued': return '排队中'
    case 'running': return '生成中'
    case 'succeeded': return '完成'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    default: return '准备中'
  }
})

const statusColor = computed(() => {
  switch (event.value?.status) {
    case 'succeeded': return 'var(--success)'
    case 'failed': return 'var(--danger)'
    case 'cancelled': return 'var(--warning)'
    case 'running': return 'var(--accent)'
    case 'queued': return 'var(--text-secondary)'
    default: return 'var(--text-secondary)'
  }
})

/** 供应商名称 */
const providerName = computed(() => {
  if (!job.value) return ''
  return PROVIDERS.find((p) => p.id === job.value!.provider)?.name ?? job.value.provider
})

/** 步骤状态 */
function stepStatusText(s: GenerationStep): string {
  switch (s.status) {
    case 'pending': return '等待中'
    case 'running': return '进行中'
    case 'done': return '完成'
    case 'failed': return '失败'
  }
}

function stepStatusIcon(s: GenerationStep): string {
  switch (s.status) {
    case 'pending': return '○'
    case 'running': return '⏵'
    case 'done': return '✓'
    case 'failed': return '✗'
  }
}

function stepStatusColor(s: GenerationStep): string {
  switch (s.status) {
    case 'pending': return 'var(--text-secondary)'
    case 'running': return 'var(--accent)'
    case 'done': return 'var(--success)'
    case 'failed': return 'var(--danger)'
  }
}

/** 启动 */
async function startJob() {
  starting.value = true
  startError.value = null
  try {
    if (!job.value) {
      startError.value = '没有待启动的任务'
      return
    }
    const res = await createJob({
      projectId: job.value.projectId,
      callType: job.value.callType as 'text' | 'image' | 'video' | 'embed',
      provider: job.value.provider as 'openai' | 'anthropic' | 'google' | 'stability',
      model: job.value.model,
      prompt: job.value.prompt,
      stylePrompt: job.value.artStyle,
      count: 1
    })
    jobId.value = res.jobId
    pushLog('success', `✓ 任务已创建 · jobId=${res.jobId}`)
    pushLog('info', `💰 预估成本 $${res.estimatedCostUsd.toFixed(4)}`)
    // 订阅 WS
    subscribe()
  } catch (err) {
    startError.value = (err as Error).message
    pushLog('error', `✗ 启动失败: ${(err as Error).message}`)
    // 后端不可用 → 走本地模拟进度
    simulate()
  } finally {
    starting.value = false
  }
}

function subscribe() {
  if (!jobId.value) return
  unsubscribe.value = subscribeProgress(
    jobId.value,
    (ev) => {
      // 第一次收到事件 → 写入初始步骤
      if (!event.value) {
        pushLog('info', `🔌 WebSocket 已连接`)
      }
      event.value = ev
      if (ev.log) pushLog('info', ev.log)
      if (ev.status === 'succeeded') {
        pushLog('success', `🎉 任务完成 · 总耗时未知 · 总成本 $${ev.costUsd.toFixed(4)}`)
      } else if (ev.status === 'failed') {
        pushLog('error', `✗ 任务失败: ${ev.error ?? '未知错误'}`)
      } else if (ev.status === 'cancelled') {
        pushLog('warn', `⏹ 任务已取消`)
      }
      scrollLog()
    },
    (err) => {
      const wsUrl = (err as unknown as WebSocket)?.url ?? '连接断开'
      pushLog('warn', `⚠ WebSocket 异常: ${wsUrl}`)
    }
  )
}

/** 本地模拟（后端不可用时） */
function simulate() {
  if (!job.value) return
  const steps: GenerationStep[] = [
    { step: '解析小说', status: 'pending' },
    { step: '提取角色', status: 'pending' },
    { step: '拆解分镜', status: 'pending' },
    { step: '生成场景', status: 'pending' },
    { step: '渲染视频', status: 'pending' },
    { step: '合成输出', status: 'pending' }
  ]
  event.value = {
    jobId: 'sim-' + Date.now(),
    progress: 0,
    currentStep: 0,
    totalSteps: steps.length,
    steps,
    costUsd: 0,
    status: 'running'
  }
  pushLog('warn', '⚠ 后端不可达，启用本地模拟进度（仅供演示）')

  let i = 0
  const tick = () => {
    if (!event.value) return
    if (i >= steps.length) {
      event.value.status = 'succeeded'
      event.value.progress = 100
      event.value.costUsd = 0.042
      event.value.outputs = { texts: ['示例生成结果...'] }
      pushLog('success', '🎉 模拟完成')
      return
    }
    steps[i]!.status = 'running'
    event.value.currentStep = i
    event.value.steps = [...steps]
    event.value.progress = Math.round((i / steps.length) * 100)
    pushLog('info', `⏵ ${steps[i]!.step} ...`)
    setTimeout(() => {
      steps[i]!.status = 'done'
      event.value!.steps = [...steps]
      event.value!.progress = Math.round(((i + 1) / steps.length) * 100)
      event.value!.costUsd = +(0.008 * (i + 1)).toFixed(4)
      pushLog('info', `✓ ${steps[i]!.step} 完成`)
      i += 1
      tick()
    }, 1500)
  }
  tick()
}

/** 取消 */
async function onCancel() {
  if (!jobId.value) return
  cancelling.value = true
  try {
    await cancelJob(jobId.value)
    pushLog('warn', '⏹ 取消请求已发送')
  } catch (err) {
    // 模拟模式下直接更新
    if (event.value) {
      event.value.status = 'cancelled'
    }
    pushLog('warn', `⏹ 本地取消 · ${(err as Error).message}`)
  } finally {
    cancelling.value = false
  }
}

/** 写日志 */
function pushLog(tone: 'info' | 'warn' | 'error' | 'success', text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.push({ time, text, tone })
  if (logs.value.length > 200) logs.value.shift()
}

/** 滚到底 */
function scrollLog() {
  nextTick(() => {
    if (logBoxRef.value) {
      logBoxRef.value.scrollTop = logBoxRef.value.scrollHeight
    }
  })
}

/** 跳回 */
function goBack() {
  if (unsubscribe.value) unsubscribe.value()
  router.push('/studio')
}

/** 重试 */
function onRetry() {
  logs.value = []
  event.value = null
  startJob()
}

onMounted(() => {
  try {
    const raw = sessionStorage.getItem('pending-job')
    if (!raw) {
      startError.value = '没有待启动的任务，请从项目编辑器发起'
      starting.value = false
      return
    }
    job.value = JSON.parse(raw)
    startJob()
  } catch (err) {
    startError.value = (err as Error).message
    starting.value = false
  }
})

onUnmounted(() => {
  if (unsubscribe.value) unsubscribe.value()
})

/** 监听 logs 长度自动滚 */
watch(logs, () => scrollLog(), { deep: true })
</script>

<template>
  <main class="progress">
    <!-- 顶栏 -->
    <header class="progress__nav">
      <div class="progress__brand">
        <button class="progress__back" @click="goBack" title="返回">←</button>
        <span class="progress__logo">M</span>
        <span class="progress__brand-name">生成进度</span>
      </div>
      <div class="progress__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div v-if="!job && startError" class="progress__error">
      <span>⚠ {{ startError }}</span>
      <button type="button" class="qh-btn" @click="goBack">返回</button>
    </div>

    <div v-else class="progress__content">
      <!-- 状态总览 -->
      <header class="progress__header">
        <div>
          <h1>{{ job?.projectTitle ?? '生成任务' }}</h1>
          <p>
            <span>{{ providerName }}</span>
            <code>{{ job?.model }}</code>
            <span>· 约 {{ job?.tokenCount.toLocaleString() ?? 0 }} tokens</span>
          </p>
        </div>
        <div class="progress__status" :style="{ color: statusColor }">
          <span class="progress__status-dot" :style="{ background: statusColor }" />
          <strong>{{ statusLabel }}</strong>
        </div>
      </header>

      <!-- 故障转移 -->
      <FailoverIndicator compact />

      <!-- 进度条 -->
      <section class="progress__bar-wrap">
        <div class="progress__bar">
          <div
            class="progress__bar-fill"
            :style="{ width: overallProgress + '%', background: statusColor }"
          />
        </div>
        <div class="progress__bar-meta">
          <span>{{ overallProgress }}%</span>
          <span>·</span>
          <span>已花费 ${{ (event?.costUsd ?? 0).toFixed(4) }}</span>
        </div>
      </section>

      <!-- 双列：步骤 + 日志 -->
      <div class="progress__layout">
        <!-- 步骤 -->
        <section class="progress__steps">
          <h2>📋 生成步骤</h2>
          <ol class="steps">
            <li
              v-for="(s, idx) in (event?.steps ?? [])"
              :key="idx"
              class="steps__item"
              :class="`steps__item--${s.status}`"
            >
              <span class="steps__icon" :style="{ color: stepStatusColor(s) }">
                {{ stepStatusIcon(s) }}
              </span>
              <div class="steps__body">
                <strong>{{ s.step }}</strong>
                <span :style="{ color: stepStatusColor(s) }">{{ stepStatusText(s) }}</span>
                <p v-if="s.message" class="steps__msg">{{ s.message }}</p>
              </div>
            </li>
            <li v-if="!event?.steps?.length" class="steps__placeholder">
              正在初始化任务...
            </li>
          </ol>
        </section>

        <!-- 日志 -->
        <section class="progress__logs">
          <h2>📜 实时日志</h2>
          <div ref="logBoxRef" class="logs">
            <div
              v-for="(line, i) in logs"
              :key="i"
              class="logs__line"
              :class="`logs__line--${line.tone}`"
            >
              <span class="logs__time">{{ line.time }}</span>
              <span class="logs__text">{{ line.text }}</span>
            </div>
            <div v-if="logs.length === 0" class="logs__empty">
              等待 WebSocket 连接...
            </div>
          </div>
        </section>
      </div>

      <!-- 产物 -->
      <section v-if="event?.status === 'succeeded' && event.outputs" class="progress__outputs">
        <h2>🎉 生成完成</h2>
        <div v-if="event.outputs.texts?.length" class="outputs">
          <h3>文字</h3>
          <ul>
            <li v-for="(t, i) in event.outputs.texts" :key="i">
              <pre>{{ t }}</pre>
            </li>
          </ul>
        </div>
        <div v-if="event.outputs.images?.length" class="outputs">
          <h3>图片</h3>
          <div class="outputs__images">
            <div v-for="(src, i) in event.outputs.images" :key="i" class="outputs__img">
              <img :src="src" :alt="`output-${i}`" />
            </div>
          </div>
        </div>
      </section>

      <!-- 操作栏 -->
      <div class="progress__action">
        <button type="button" class="qh-btn" @click="goBack">返回工作台</button>
        <button
          v-if="event?.status === 'failed' || event?.status === 'cancelled'"
          type="button"
          class="qh-btn"
          @click="onRetry"
        >
          🔄 重试
        </button>
        <button
          v-if="event?.status === 'running' || event?.status === 'queued' || !event"
          type="button"
          class="qh-btn qh-btn--danger"
          :disabled="cancelling || !jobId"
          @click="onCancel"
        >
          {{ cancelling ? '取消中...' : '⏹ 取消任务' }}
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.progress {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* 顶栏 */
.progress__nav {
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

.progress__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.progress__back {
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

.progress__back:hover { border-color: var(--accent); color: var(--accent); }

.progress__logo {
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

.progress__brand-name { font-size: 15px; font-weight: 600; }

.progress__error {
  max-width: 600px;
  margin: 80px auto;
  padding: 24px;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px solid var(--danger);
  border-radius: 12px;
  color: var(--danger);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.progress__content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.progress__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.progress__header h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
}

.progress__header p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.progress__header code {
  font-family: monospace;
  font-size: 12px;
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 3px;
}

.progress__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.progress__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 进度条 */
.progress__bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress__bar {
  width: 100%;
  height: 10px;
  background: var(--bg-secondary);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.progress__bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.progress__bar-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

/* 双列 */
.progress__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 20px;
  align-items: flex-start;
}

@media (max-width: 880px) {
  .progress__layout { grid-template-columns: 1fr; }
}

.progress__steps,
.progress__logs {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
}

.progress__steps h2,
.progress__logs h2 {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
}

/* 步骤列表 */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.steps__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 200ms;
}

.steps__item--running {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-primary));
}

.steps__item--done {
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
}

.steps__item--failed {
  border-color: var(--danger);
}

.steps__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-secondary);
  font-size: 14px;
  flex-shrink: 0;
  font-weight: 700;
}

.steps__item--running .steps__icon {
  animation: spinSlow 2s linear infinite;
}

@keyframes spinSlow { to { transform: rotate(360deg); } }

.steps__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.steps__body strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.steps__body span {
  font-size: 11px;
}

.steps__msg {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.steps__placeholder {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px 12px;
  font-size: 13px;
}

/* 日志 */
.logs {
  height: 360px;
  overflow-y: auto;
  padding: 12px;
  background: var(--code-bg, var(--bg-primary));
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
}

.logs__line {
  display: flex;
  gap: 8px;
  margin-bottom: 2px;
  word-break: break-all;
}

.logs__time {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.logs__text {
  flex: 1;
  min-width: 0;
}

.logs__line--info .logs__text { color: var(--text-primary); }
.logs__line--warn .logs__text { color: var(--warning); }
.logs__line--error .logs__text { color: var(--danger); }
.logs__line--success .logs__text { color: var(--success); font-weight: 500; }

.logs__empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 30px 0;
  font-style: italic;
}

/* 产物 */
.progress__outputs {
  background: var(--bg-secondary);
  border: 1px solid var(--success);
  border-radius: 12px;
  padding: 18px 20px;
}

.progress__outputs h2 {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: var(--success);
}

.outputs h3 {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.outputs ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.outputs pre {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.outputs__images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.outputs__img {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.outputs__img img {
  width: 100%;
  display: block;
}

/* 操作栏 */
.progress__action {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid var(--border);
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
  cursor: pointer;
  transition: all 200ms;
}

.qh-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.qh-btn--danger:hover:not(:disabled) { border-color: var(--danger); color: var(--danger); }
.qh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 720px) {
  .progress__nav { padding: 12px 16px; }
  .progress__content { padding: 20px 16px 40px; }
  .progress__header h1 { font-size: 18px; }
  .logs { height: 260px; }
}
</style>
