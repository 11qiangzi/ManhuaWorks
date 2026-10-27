<script setup lang="ts">
/**
 * ExportView · 导出
 * ManhuaWorks · W3 工坊流程精修
 *
 * 1. 单集 vs 整季
 * 2. 字幕选项（开启/语言/字体/位置）
 * 3. 平台格式（YouTube / B站 / 抖音 / 快手 / 本地）
 * 4. 导出参数（分辨率/码率/格式）
 * 5. 进度展示
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import ProgressTimeline from '@/components/studio/ProgressTimeline.vue'

const router = useRouter()
const toast = useToast()

/** 范围 */
const scope = ref<'episode' | 'season'>('episode')
const episodeId = ref('ep-01')
const episodes = ref<{ id: string; title: string; duration: number }[]>([])

/** 字幕 */
const subtitleEnabled = ref(true)
const subtitleLang = ref<'zh' | 'en' | 'zh-en'>('zh')
const subtitleFont = ref('sans')
const subtitlePosition = ref<'bottom' | 'top'>('bottom')

/** 平台 */
const platforms = ref<{ id: Platform; label: string; icon: string; maxRes: string; desc: string }[]>([
  { id: 'youtube', label: 'YouTube', icon: '▶️', maxRes: '4K · 60fps', desc: '横版 16:9 · 适合长视频' },
  { id: 'bilibili', label: 'B 站', icon: '📺', maxRes: '1080P · 60fps', desc: '横版 16:9 · 弹幕友好' },
  { id: 'douyin', label: '抖音', icon: '🎵', maxRes: '1080P · 竖版 9:16', desc: '竖版 9:16 · 时长 ≤ 60s' },
  { id: 'kuaishou', label: '快手', icon: '⚡', maxRes: '1080P · 竖版 9:16', desc: '竖版 9:16 · 时长 ≤ 60s' },
  { id: 'local', label: '本地下载', icon: '💾', maxRes: '原始分辨率', desc: 'MP4 / MOV · 不上传' }
])
const activePlatform = ref<Platform>('youtube')

/** 视频参数 */
const resolution = ref<'720p' | '1080p' | '2k' | '4k'>('1080p')
const bitrate = ref<'low' | 'medium' | 'high' | 'lossless'>('high')
const format = ref<'mp4' | 'mov' | 'webm'>('mp4')
const fps = ref(30)

const BITRATE_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高', lossless: '无损' }
const FONT_LABELS: Record<string, string> = { sans: '无衬线', serif: '衬线', mono: '等宽', kai: '楷体' }
const POS_LABELS: Record<string, string> = { bottom: '底部', top: '顶部' }

/** 导出任务 */
type Platform = 'youtube' | 'bilibili' | 'douyin' | 'kuaishou' | 'local'
interface ExportTask {
  id: string
  scope: 'episode' | 'season'
  target: string
  platform: Platform
  progress: number
  status: 'queued' | 'rendering' | 'uploading' | 'done' | 'failed'
  startedAt: string
}
const tasks = ref<ExportTask[]>([])
const exporting = ref(false)

const currentDuration = computed(() => {
  if (scope.value === 'episode') {
    return episodes.value.find((e) => e.id === episodeId.value)?.duration ?? 0
  }
  return episodes.value.reduce((s, e) => s + e.duration, 0)
})

const estimatedSize = computed(() => {
  // 粗估：1080P / high ≈ 1MB/秒
  const factor =
    bitrate.value === 'lossless' ? 8 :
    bitrate.value === 'high' ? 1.0 :
    bitrate.value === 'medium' ? 0.5 : 0.25
  const resolutionFactor = resolution.value === '4k' ? 4 : resolution.value === '2k' ? 2 : 1
  return Math.round(currentDuration.value * factor * resolutionFactor)
})

const sizeText = computed(() => {
  const mb = estimatedSize.value
  if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb} MB`
})

const timelineSteps = computed(() => [
  { id: 'prepare', label: '素材准备', status: 'done' as const },
  { id: 'render', label: '视频渲染', status: exporting.value ? 'active' as const : 'pending' as const },
  { id: 'encode', label: '编码封装', status: 'pending' as const },
  { id: 'upload', label: activePlatform.value === 'local' ? '本地下载' : '平台上传', status: 'pending' as const }
])

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function onExport() {
  if (!episodes.value.length) {
    toast.error('没有可导出的集数数据')
    return
  }
  exporting.value = true
  const task: ExportTask = {
    id: `t-${Date.now()}`,
    scope: scope.value,
    target: scope.value === 'episode' ? episodeId.value : '全季',
    platform: activePlatform.value,
    progress: 0,
    status: 'rendering',
    startedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }
  tasks.value.unshift(task)
  toast.info('视频渲染任务已提交，渲染引擎正在处理…')

  // 模拟进度（真实渲染需要后端 video-render-service 支持）
  const timer = setInterval(() => {
    const t = tasks.value.find((x) => x.id === task.id)
    if (!t) return clearInterval(timer)
    t.progress += 5 + Math.random() * 10
    if (t.progress >= 100) {
      t.progress = 100
      t.status = t.platform === 'local' ? 'done' : 'uploading'
      setTimeout(() => {
        t.status = 'done'
        toast.success(t.platform === 'local' ? '导出完成' : '上传完成')
      }, 1500)
      clearInterval(timer)
      exporting.value = false
    }
  }, 500)
}

onMounted(() => {
  // 从 sessionStorage 或 URL 参数加载集数数据
  try {
    const raw = sessionStorage.getItem('mhw:studio:export-episodes')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        episodes.value = parsed
        episodeId.value = parsed[0].id
      }
    }
  } catch { /* ignore */ }

  // 如果 sessionStorage 没有数据，从项目 shots 加载
  if (!episodes.value.length) {
    const projectId = router.currentRoute.value.query.projectId as string
    if (projectId) {
      // 从 API 加载项目的 shots 作为集数
      import('@manhuaworks/api-client').then(({ getClient }) => {
        getClient().http.get(`/projects/${projectId}/shots`).then((res: any) => {
          const shots: any[] = res?.items || res || []
          if (shots.length > 0) {
            episodes.value = shots.map((s: any, i: number) => ({
              id: s.id || `ep-${String(i + 1).padStart(2, '0')}`,
              title: s.title || s.name || `第 ${String(i + 1).padStart(2, '0')} 集`,
              duration: s.duration || 300,
            }))
            episodeId.value = episodes.value[0].id
          }
        }).catch(() => {})
      }).catch(() => {})
    }
  }
})
</script>

<template>
  <main class="ex">
    <!-- 顶栏 -->
    <header class="ex__nav">
      <div class="ex__brand">
        <button class="ex__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="ex__logo">M</span>
        <span class="ex__brand-name">导出成片</span>
      </div>
      <div class="ex__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="ex__content">
      <!-- 标题 -->
      <section class="ex__header">
        <div>
          <h1>📤 导出成片</h1>
          <p>单集 / 整季 · 字幕 · 多平台格式</p>
        </div>
      </section>

      <!-- 进度 -->
      <ProgressTimeline :steps="timelineSteps" />

      <div class="ex__main">
        <!-- 左：配置 -->
        <section class="ex__config">
          <!-- 1. 范围 -->
          <article class="ex__card">
            <h2>1️⃣ 导出范围</h2>
            <div class="ex__seg">
              <button
                type="button"
                class="ex__seg-btn"
                :class="{ 'ex__seg-btn--active': scope === 'episode' }"
                @click="scope = 'episode'"
              >
                单集
              </button>
              <button
                type="button"
                class="ex__seg-btn"
                :class="{ 'ex__seg-btn--active': scope === 'season' }"
                @click="scope = 'season'"
              >
                整季（4 集）
              </button>
            </div>
            <select v-if="scope === 'episode'" v-model="episodeId" class="ex__select">
              <option v-for="e in episodes" :key="e.id" :value="e.id">
                {{ e.title }} · {{ formatDuration(e.duration) }}
              </option>
            </select>
            <p class="ex__hint">
              预估时长：<strong>{{ formatDuration(currentDuration) }}</strong>
            </p>
          </article>

          <!-- 2. 字幕 -->
          <article class="ex__card">
            <h2>2️⃣ 字幕</h2>
            <label class="ex__check">
              <input v-model="subtitleEnabled" type="checkbox" />
              <span>启用字幕</span>
            </label>
            <div v-if="subtitleEnabled" class="ex__sub-grid">
              <label class="ex__field">
                <span>语言</span>
                <select v-model="subtitleLang" class="ex__select">
                  <option value="zh">中文</option>
                  <option value="en">英文</option>
                  <option value="zh-en">中英双语</option>
                </select>
              </label>
              <label class="ex__field">
                <span>字体</span>
                <select v-model="subtitleFont" class="ex__select">
                  <option value="sans">无衬线</option>
                  <option value="serif">衬线</option>
                  <option value="mono">等宽</option>
                  <option value="kai">楷体</option>
                </select>
              </label>
              <label class="ex__field">
                <span>位置</span>
                <select v-model="subtitlePosition" class="ex__select">
                  <option value="bottom">底部</option>
                  <option value="top">顶部</option>
                </select>
              </label>
            </div>
          </article>

          <!-- 3. 平台 -->
          <article class="ex__card">
            <h2>3️⃣ 平台格式</h2>
            <div class="ex__platforms">
              <button
                v-for="p in platforms"
                :key="p.id"
                type="button"
                class="ex__platform"
                :class="{ 'ex__platform--active': activePlatform === p.id }"
                @click="activePlatform = p.id"
              >
                <span class="ex__platform-icon">{{ p.icon }}</span>
                <div class="ex__platform-info">
                  <strong>{{ p.label }}</strong>
                  <small>{{ p.maxRes }}</small>
                  <p>{{ p.desc }}</p>
                </div>
              </button>
            </div>
          </article>

          <!-- 4. 视频参数 -->
          <article class="ex__card">
            <h2>4️⃣ 视频参数</h2>
            <div class="ex__param-grid">
              <label class="ex__field">
                <span>分辨率</span>
                <select v-model="resolution" class="ex__select">
                  <option value="720p">720P</option>
                  <option value="1080p">1080P</option>
                  <option value="2k">2K</option>
                  <option value="4k">4K</option>
                </select>
              </label>
              <label class="ex__field">
                <span>码率</span>
                <select v-model="bitrate" class="ex__select">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="lossless">无损</option>
                </select>
              </label>
              <label class="ex__field">
                <span>帧率</span>
                <select v-model.number="fps" class="ex__select">
                  <option :value="24">24 fps</option>
                  <option :value="30">30 fps</option>
                  <option :value="60">60 fps</option>
                </select>
              </label>
              <label class="ex__field">
                <span>格式</span>
                <select v-model="format" class="ex__select">
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                  <option value="webm">WebM</option>
                </select>
              </label>
            </div>
          </article>
        </section>

        <!-- 右：摘要 + 任务 -->
        <aside class="ex__side">
          <article class="ex__summary">
            <h2>📋 导出摘要</h2>
            <dl class="ex__dl">
              <dt>范围</dt><dd>{{ scope === 'episode' ? episodes.find((e) => e.id === episodeId)?.title : '整季 4 集' }}</dd>
              <dt>时长</dt><dd>{{ formatDuration(currentDuration) }}</dd>
              <dt>字幕</dt><dd>{{ subtitleEnabled ? `${subtitleLang} · ${FONT_LABELS[subtitleFont]} · ${POS_LABELS[subtitlePosition]}` : '关闭' }}</dd>
              <dt>平台</dt><dd>{{ platforms.find((p) => p.id === activePlatform)?.label }}</dd>
              <dt>分辨率</dt><dd>{{ resolution.toUpperCase() }} · {{ fps }}fps</dd>
              <dt>码率</dt><dd>{{ BITRATE_LABELS[bitrate] }}</dd>
              <dt>格式</dt><dd>{{ format.toUpperCase() }}</dd>
              <dt>预估大小</dt><dd><strong>{{ sizeText }}</strong></dd>
            </dl>
            <button
              type="button"
              class="qh-btn qh-btn--primary ex__go"
              :disabled="exporting"
              @click="onExport"
            >
              {{ exporting ? '⚡ 导出中...' : '🚀 开始导出' }}
            </button>
          </article>

          <article v-if="tasks.length > 0" class="ex__tasks">
            <h2>📦 任务列表</h2>
            <ul class="ex__task-list">
              <li v-for="t in tasks" :key="t.id" class="ex__task">
                <div class="ex__task-head">
                  <strong>{{ t.target }} → {{ platforms.find((p) => p.id === t.platform)?.label }}</strong>
                  <span class="ex__task-status" :class="`ex__task-status--${t.status}`">
                    {{ t.status }}
                  </span>
                </div>
                <div class="ex__task-progress">
                  <div class="ex__task-bar">
                    <div class="ex__task-fill" :style="{ width: `${t.progress}%` }" />
                  </div>
                  <span class="ex__task-pct">{{ Math.round(t.progress) }}%</span>
                </div>
                <small class="ex__task-time">开始于 {{ t.startedAt }}</small>
              </li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.ex {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.ex__nav {
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

.ex__brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.ex__back {
  width: 30px; height: 30px; border-radius: 7px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 16px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.ex__back:hover { background: var(--bg-tertiary); }
.ex__logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px;
}

.ex__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ex__header h1 { font-size: 24px; margin: 0 0 4px; }
.ex__header p { color: var(--text-secondary); margin: 0; font-size: 14px; }

.ex__main {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}

.ex__config { display: flex; flex-direction: column; gap: 16px; }
.ex__card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}
.ex__card h2 { font-size: 16px; margin: 0 0 14px; }

.ex__seg {
  display: inline-flex;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  margin-bottom: 10px;
}
.ex__seg-btn {
  padding: 6px 16px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  border-radius: 6px;
  transition: all .2s;
}
.ex__seg-btn--active {
  background: var(--accent);
  color: #fff;
}
.ex__hint { font-size: 12px; color: var(--text-secondary); margin: 8px 0 0; }
.ex__hint strong { color: var(--text-primary); }

.ex__check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.ex__sub-grid, .ex__param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.ex__field { display: flex; flex-direction: column; gap: 4px; }
.ex__field span { font-size: 12px; color: var(--text-secondary); }
.ex__select {
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}
.ex__select:focus { outline: none; border-color: var(--accent); }

.ex__platforms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.ex__platform {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: var(--text-primary);
  transition: all .2s;
}
.ex__platform:hover { border-color: var(--accent); }
.ex__platform--active {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: var(--accent);
}
.ex__platform-icon { font-size: 24px; }
.ex__platform-info { flex: 1; min-width: 0; }
.ex__platform-info strong { display: block; font-size: 14px; margin-bottom: 2px; }
.ex__platform-info small { color: var(--text-secondary); font-size: 11px; }
.ex__platform-info p { margin: 4px 0 0; font-size: 11px; color: var(--text-secondary); }

.ex__side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 80px; align-self: start; }
.ex__summary, .ex__tasks {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}
.ex__summary h2, .ex__tasks h2 { font-size: 16px; margin: 0 0 14px; }
.ex__dl { display: grid; grid-template-columns: 80px 1fr; gap: 8px 12px; margin: 0 0 16px; font-size: 13px; }
.ex__dl dt { color: var(--text-secondary); }
.ex__dl dd { margin: 0; }

.ex__go { width: 100%; padding: 12px; font-size: 14px; }

.ex__task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.ex__task {
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.ex__task-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; }
.ex__task-status { padding: 1px 8px; border-radius: 10px; font-size: 10px; }
.ex__task-status--rendering { background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--warning); }
.ex__task-status--uploading { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); }
.ex__task-status--done { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
.ex__task-status--failed { background: color-mix(in srgb, var(--error) 20%, transparent); color: var(--error); }
.ex__task-status--queued { background: var(--bg-tertiary); color: var(--text-secondary); }
.ex__task-progress { display: flex; align-items: center; gap: 8px; }
.ex__task-bar { flex: 1; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; }
.ex__task-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width .3s; }
.ex__task-pct { font-size: 11px; color: var(--text-secondary); min-width: 36px; text-align: right; }
.ex__task-time { color: var(--text-secondary); font-size: 11px; }

@media (max-width: 1024px) {
  .ex__main { grid-template-columns: 1fr; }
  .ex__side { position: static; }
}
</style>
