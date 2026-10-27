<script setup lang="ts">
/**
 * MyWorksView · 我的作品
 * 千机工坊 · W4 用户后台
 *
 * 功能：
 * 1. 作品网格（视频/动画/漫画/有声）
 * 2. 缩略图 + 时长 + 播放量 + 点赞
 * 3. 类型筛选 + 可见性筛选 + 搜索
 * 4. 操作：播放 / 下载 / 分享 / 改可见性 / 删除
 */

import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import UserCard from '@/components/UserCard.vue'
import { useUser } from '@/composables/useUser'
import { useWorks } from '@/composables/useWorks'
import {
  TYPE_META,
  VISIBILITY_META,
  formatDuration,
  formatCount,
  type WorkType,
  type WorkVisibility
} from '@/api/work-service'

const router = useRouter()
const { profile, load: loadUser, logout } = useUser()
const {
  works, total, loading, error,
  typeFilter, visibilityFilter, searchKeyword,
  load, remove, updateVisibility, getShareLink, refresh
} = useWorks({ autoLoad: false })

const sharing = ref<string | null>(null)
const shareUrl = ref<string | null>(null)

/* ===== Audio Panel State ===== */
const selectedWorkId = ref<string | null>(null)
const audioPanelLoading = ref(false)

interface AudioTrack {
  id: string
  title: string
  type: 'bgm' | 'sfx' | 'voiceover'
  duration: string
  playing: boolean
}

interface WorkAudio {
  bgm: AudioTrack | null
  sfx: AudioTrack[]
  voiceover: AudioTrack | null
}

const workAudioData = ref<WorkAudio | null>(null)

// Mock audio data keyed by work type
function loadWorkAudio(workId: string) {
  audioPanelLoading.value = true
  // Simulate async loading
  setTimeout(() => {
    workAudioData.value = {
      bgm: { id: `bgm-${workId}`, title: '背景配乐 - 暗夜序曲', type: 'bgm', duration: '03:24', playing: false },
      sfx: [
        { id: `sfx-1-${workId}`, title: '脚步声', type: 'sfx', duration: '00:02', playing: false },
        { id: `sfx-2-${workId}`, title: '门关闭', type: 'sfx', duration: '00:01', playing: false },
        { id: `sfx-3-${workId}`, title: '风声', type: 'sfx', duration: '00:05', playing: false },
        { id: `sfx-4-${workId}`, title: '雨声', type: 'sfx', duration: '00:08', playing: false },
        { id: `sfx-5-${workId}`, title: '心跳', type: 'sfx', duration: '00:03', playing: false }
      ],
      voiceover: { id: `vo-${workId}`, title: '旁白配音 - 第一章', type: 'voiceover', duration: '05:12', playing: false }
    }
    audioPanelLoading.value = false
  }, 350)
}

function toggleWorkDetail(workId: string) {
  if (selectedWorkId.value === workId) {
    selectedWorkId.value = null
    workAudioData.value = null
  } else {
    selectedWorkId.value = workId
    loadWorkAudio(workId)
  }
}

function toggleAudioPlay(track: AudioTrack) {
  if (!workAudioData.value) return
  // Stop all playing tracks
  if (workAudioData.value.bgm) workAudioData.value.bgm.playing = false
  workAudioData.value.sfx.forEach(s => s.playing = false)
  if (workAudioData.value.voiceover) workAudioData.value.voiceover.playing = false
  // Toggle the clicked one
  track.playing = !track.playing
}

const TYPES: { id: WorkType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '🎞' },
  { id: 'video', label: '视频', icon: '🎬' },
  { id: 'animation', label: '动画', icon: '🎞️' },
  { id: 'comic', label: '漫画', icon: '📖' },
  { id: 'audiobook', label: '有声', icon: '🎙️' }
]

const VISIBILITIES: { id: WorkVisibility | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'public', label: '🌐 公开' },
  { id: 'unlisted', label: '🔗 不公开' },
  { id: 'private', label: '🔒 私密' }
]

onMounted(async () => {
  await Promise.all([loadUser(), refresh()])
})

function play(workId: string) {
  // TODO: navigate to work detail or open player
}

function download(workId: string, url?: string | null) {
  if (url) {
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    a.click()
  } else {
    alert('下载链接生成中...')
  }
}

async function share(workId: string) {
  sharing.value = workId
  shareUrl.value = null
  try {
    const res = await getShareLink(workId)
    shareUrl.value = res.url
  } finally {
    sharing.value = null
  }
}

async function copyShareUrl() {
  if (shareUrl.value) {
    try {
      await navigator.clipboard.writeText(shareUrl.value)
      alert('已复制到剪贴板')
    } catch {
      // 兜底
      prompt('复制链接：', shareUrl.value)
    }
  }
}

function onLogout() {
  logout()
  router.push('/login')
}
</script>

<template>
  <main class="mw">
    <!-- 顶栏 -->
    <header class="mw__nav">
      <div class="mw__nav-left">
        <button class="mw__back" @click="router.push('/dashboard')" title="返回">←</button>
        <span class="mw__logo">M</span>
        <span class="mw__brand-name">我的作品</span>
        <span class="mw__count">{{ total }} 个</span>
      </div>
      <nav class="mw__nav-links">
        <RouterLink to="/dashboard" class="mw__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="mw__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="mw__nav-link mw__nav-link--active">作品</RouterLink>
        <RouterLink to="/assets" class="mw__nav-link">素材</RouterLink>
        <RouterLink to="/settings" class="mw__nav-link">设置</RouterLink>
      </nav>
      <div class="mw__nav-right">
        <ThemeSwitcher mode="compact" />
        <UserCard :user="profile" compact />
      </div>
    </header>

    <div class="mw__content">
      <!-- 标题区 -->
      <section class="mw__head">
        <div>
          <h1>🎞 我的作品</h1>
          <p>已发布的视频 / 动画 / 漫画 / 有声作品</p>
        </div>
        <button type="button" class="mw__btn" @click="refresh">🔄 刷新</button>
      </section>

      <!-- 类型筛选 -->
      <nav class="mw__types">
        <button
          v-for="t in TYPES"
          :key="t.id"
          type="button"
          class="mw__type"
          :class="{ 'mw__type--active': typeFilter === t.id }"
          @click="typeFilter = t.id"
        >
          <span>{{ t.icon }}</span>
          <span>{{ t.label }}</span>
        </button>
      </nav>

      <!-- 工具栏 -->
      <div class="mw__toolbar">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="🔍 搜索作品标题"
          class="mw__search"
        />
        <div class="mw__visibility">
          <button
            v-for="v in VISIBILITIES"
            :key="v.id"
            type="button"
            class="mw__vis-btn"
            :class="{ 'mw__vis-btn--active': visibilityFilter === v.id }"
            @click="visibilityFilter = v.id"
          >{{ v.label }}</button>
        </div>
      </div>

      <div v-if="error" class="mw__error">⚠ {{ error }}</div>

      <!-- 列表 -->
      <div v-if="loading && works.length === 0" class="mw__loading">
        <div class="mw__spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="works.length === 0" class="mw__empty">
        <p class="mw__empty-icon">🎞</p>
        <p class="mw__empty-title">还没有作品</p>
        <p class="mw__empty-desc">完成项目后发布即可在这里看到作品</p>
        <RouterLink to="/projects" class="mw__btn mw__btn--primary">去创建项目</RouterLink>
      </div>

      <div v-else class="mw__grid">
        <article v-for="w in works" :key="w.id" class="work-card">
          <!-- 缩略图 -->
          <div class="work-card__cover" @click="play(w.id)">
            <img v-if="w.thumbnail" :src="w.thumbnail" :alt="w.title" />
            <div v-else class="work-card__cover-placeholder" :style="{ background: TYPE_META[w.type].color }">
              <span>{{ TYPE_META[w.type].icon }}</span>
            </div>

            <!-- 时长 -->
            <span v-if="w.duration" class="work-card__duration">
              {{ formatDuration(w.duration) }}
            </span>

            <!-- 类型徽章 -->
            <span class="work-card__type" :style="{ background: TYPE_META[w.type].color }">
              {{ TYPE_META[w.type].label }}
            </span>

            <!-- 可见性 -->
            <span class="work-card__visibility">
              {{ VISIBILITY_META[w.visibility].icon }} {{ VISIBILITY_META[w.visibility].label }}
            </span>

            <!-- 播放按钮 -->
            <button type="button" class="work-card__play" @click.stop="play(w.id)">▶</button>
          </div>

          <!-- 信息 -->
          <div class="work-card__body">
            <h3 class="work-card__title" :title="w.title">{{ w.title }}</h3>
            <div class="work-card__stats">
              <span>▶ {{ formatCount(w.views) }}</span>
              <span>❤ {{ formatCount(w.likes) }}</span>
              <span v-if="w.comments !== undefined">💬 {{ formatCount(w.comments) }}</span>
            </div>
            <div v-if="w.tags && w.tags.length" class="work-card__tags">
              <span v-for="t in w.tags.slice(0, 2)" :key="t" class="work-card__tag">#{{ t }}</span>
            </div>
            <div class="work-card__date">
              {{ w.publishedAt ? new Date(w.publishedAt).toLocaleDateString('zh-CN') : '未发布' }}
            </div>

            <!-- 操作 -->
            <div class="work-card__actions">
              <button type="button" class="work-card__btn" @click="play(w.id)">▶ 播放</button>
              <button type="button" class="work-card__btn" @click="download(w.id, w.downloadUrl)">⬇ 下载</button>
              <button type="button" class="work-card__btn" @click="share(w.id)">
                {{ sharing === w.id ? '生成中...' : '🔗 分享' }}
              </button>
              <button type="button" class="work-card__btn" @click="toggleWorkDetail(w.id)">
                {{ selectedWorkId === w.id ? '🔊 收起' : '🔊 音频' }}
              </button>
              <select
                :value="w.visibility"
                class="work-card__select"
                @change="(e) => updateVisibility(w.id, (e.target as HTMLSelectElement).value as WorkVisibility)"
              >
                <option v-for="v in VISIBILITIES.filter(v => v.id !== 'all')" :key="v.id" :value="v.id">
                  {{ v.label }}
                </option>
              </select>
              <button type="button" class="work-card__btn work-card__btn--danger" @click="remove(w.id)">🗑</button>
            </div>
          </div>
        </article>
      </div>

      <!-- ===== 音频详情面板 ===== -->
      <div v-if="selectedWorkId" class="audio-panel">
        <div class="audio-panel__head">
          <h2 class="audio-panel__title">🔊 音频轨道</h2>
          <span class="audio-panel__work-id">作品 #{{ selectedWorkId }}</span>
          <button type="button" class="audio-panel__close" @click="selectedWorkId = null; workAudioData = null">✕</button>
        </div>

        <div v-if="audioPanelLoading" class="audio-panel__loading">
          <div class="mw__spinner"></div>
          <span>加载音频数据...</span>
        </div>

        <div v-else-if="!workAudioData" class="audio-panel__empty">
          暂无音频数据
        </div>

        <div v-else class="audio-panel__body">
          <!-- BGM Track -->
          <section class="audio-panel__section">
            <h3 class="audio-panel__section-title">🎵 背景配乐 (BGM)</h3>
            <div v-if="workAudioData.bgm" class="audio-track audio-track--bgm">
              <button
                type="button"
                class="audio-track__play"
                :class="{ 'audio-track__play--active': workAudioData.bgm.playing }"
                @click="toggleAudioPlay(workAudioData.bgm)"
              >
                {{ workAudioData.bgm.playing ? '⏸' : '▶' }}
              </button>
              <div class="audio-track__info">
                <span class="audio-track__title">{{ workAudioData.bgm.title }}</span>
                <span class="audio-track__duration">{{ workAudioData.bgm.duration }}</span>
              </div>
              <div class="audio-track__wave">
                <span v-for="i in 40" :key="i" class="audio-track__wave-bar"
                  :class="{ 'audio-track__wave-bar--active': workAudioData.bgm.playing }"
                  :style="{ height: (15 + Math.sin(i * 0.5) * 25 + Math.random() * 15) + '%' }"
                ></span>
              </div>
            </div>
            <div v-else class="audio-panel__none">暂无背景配乐</div>
          </section>

          <!-- Sound Effects -->
          <section class="audio-panel__section">
            <h3 class="audio-panel__section-title">🔔 音效 (SFX) <span class="audio-panel__count">{{ workAudioData.sfx.length }} 个</span></h3>
            <div class="audio-sfx-list">
              <div v-for="sfx in workAudioData.sfx" :key="sfx.id" class="audio-sfx-item">
                <button
                  type="button"
                  class="audio-sfx__play"
                  :class="{ 'audio-sfx__play--active': sfx.playing }"
                  @click="toggleAudioPlay(sfx)"
                >
                  {{ sfx.playing ? '⏸' : '▶' }}
                </button>
                <span class="audio-sfx__title">{{ sfx.title }}</span>
                <span class="audio-sfx__duration">{{ sfx.duration }}</span>
              </div>
            </div>
          </section>

          <!-- Voiceover -->
          <section class="audio-panel__section">
            <h3 class="audio-panel__section-title">🎙 旁白配音 (Voiceover)</h3>
            <div v-if="workAudioData.voiceover" class="audio-track audio-track--vo">
              <button
                type="button"
                class="audio-track__play"
                :class="{ 'audio-track__play--active': workAudioData.voiceover.playing }"
                @click="toggleAudioPlay(workAudioData.voiceover)"
              >
                {{ workAudioData.voiceover.playing ? '⏸' : '▶' }}
              </button>
              <div class="audio-track__info">
                <span class="audio-track__title">{{ workAudioData.voiceover.title }}</span>
                <span class="audio-track__duration">{{ workAudioData.voiceover.duration }}</span>
              </div>
              <div class="audio-track__wave">
                <span v-for="i in 40" :key="i" class="audio-track__wave-bar audio-track__wave-bar--vo"
                  :class="{ 'audio-track__wave-bar--active': workAudioData.voiceover.playing }"
                  :style="{ height: (10 + Math.sin(i * 0.8) * 20 + Math.random() * 20) + '%' }"
                ></span>
              </div>
            </div>
            <div v-else class="audio-panel__none">暂无配音</div>
          </section>
        </div>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <Teleport to="body">
      <div v-if="shareUrl" class="mw__modal" @click.self="shareUrl = null">
        <div class="mw__modal-card">
          <h2>🔗 分享作品</h2>
          <p>该链接 {{ VISIBILITY_META.public.label === '公开' ? '任何人都' : '仅知道链接的人' }}可以查看</p>
          <div class="mw__share-row">
            <input type="text" :value="shareUrl" readonly class="mw__share-input" />
            <button type="button" class="mw__btn mw__btn--primary" @click="copyShareUrl">复制</button>
          </div>
          <div class="mw__modal-actions">
            <button type="button" class="mw__btn" @click="shareUrl = null">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.mw {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* ===== 顶栏 ===== */
.mw__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.mw__nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mw__back {
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
}

.mw__back:hover {
  background: var(--bg-tertiary);
}

.mw__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--gradient);
  color: white;
  font-weight: 800;
  font-size: 14px;
}

.mw__brand-name {
  font-size: 15px;
  font-weight: 700;
}

.mw__count {
  padding: 2px 8px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 999px;
  font-size: 11px;
}

.mw__nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  margin-left: 20px;
}

.mw__nav-link {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  text-decoration: none;
  transition: all 180ms;
}

.mw__nav-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.mw__nav-link--active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.mw__nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== 内容 ===== */
.mw__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
}

.mw__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.mw__head h1 {
  font-size: 24px;
  margin: 0 0 4px;
}

.mw__head p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.mw__btn {
  padding: 7px 14px;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 200ms;
}

.mw__btn:hover {
  border-color: var(--accent);
}

.mw__btn--primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.mw__btn--primary:hover {
  background: var(--accent-deep);
}

/* ===== 类型筛选 ===== */
.mw__types {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.mw__type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.mw__type:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.mw__type--active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

/* ===== Toolbar ===== */
.mw__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.mw__search {
  flex: 1;
  min-width: 200px;
  padding: 9px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.mw__search:focus {
  outline: none;
  border-color: var(--accent);
}

.mw__visibility {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.mw__vis-btn {
  padding: 5px 10px;
  font-size: 11px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.mw__vis-btn:hover {
  color: var(--text-primary);
}

.mw__vis-btn--active {
  background: var(--accent);
  color: white;
}

/* ===== Error ===== */
.mw__error {
  padding: 10px 14px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

/* ===== Loading / Empty ===== */
.mw__loading,
.mw__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 14px;
  color: var(--text-secondary);
}

.mw__empty-icon {
  font-size: 48px;
  margin: 0;
}

.mw__empty-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.mw__empty-desc {
  font-size: 13px;
  margin: 0 0 12px;
}

.mw__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 作品网格 ===== */
.mw__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.work-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: all 250ms;
}

.work-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.work-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--bg-tertiary);
  cursor: pointer;
  overflow: hidden;
}

.work-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 400ms;
}

.work-card:hover .work-card__cover img {
  transform: scale(1.05);
}

.work-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  opacity: 0.6;
}

.work-card__duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  font-weight: 500;
}

.work-card__type {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  color: white;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.work-card__visibility {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--bg-primary) 75%, transparent);
  backdrop-filter: blur(4px);
  color: var(--text-primary);
  border-radius: 4px;
  font-size: 10px;
}

.work-card__play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 90%, transparent);
  color: white;
  border: none;
  font-size: 18px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.85);
  transition: all 200ms;
  box-shadow: var(--shadow);
}

.work-card:hover .work-card__play {
  opacity: 1;
  transform: scale(1);
}

.work-card__play:hover {
  background: var(--accent);
  transform: scale(1.1);
}

.work-card__body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.work-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.work-card__stats {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.work-card__tags {
  display: flex;
  gap: 4px;
}

.work-card__tag {
  font-size: 10px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 999px;
}

.work-card__date {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
}

.work-card__actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.work-card__btn {
  flex: 1;
  padding: 5px 6px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.work-card__btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.work-card__btn--danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.work-card__select {
  flex: 1;
  padding: 5px 6px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-secondary);
  font-family: inherit;
  cursor: pointer;
}

/* ===== Modal ===== */
.mw__modal {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg-primary) 75%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.mw__modal-card {
  width: 90%;
  max-width: 480px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow);
}

.mw__modal-card h2 {
  margin: 0;
  font-size: 18px;
}

.mw__modal-card p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.mw__share-row {
  display: flex;
  gap: 8px;
}

.mw__share-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 12px;
}

.mw__modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

/* ===== Audio Panel ===== */
.audio-panel {
  margin-top: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  animation: audio-slide-in 250ms ease;
}

@keyframes audio-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.audio-panel__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--bg-secondary)), var(--bg-secondary));
  border-bottom: 1px solid var(--border);
}

.audio-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.audio-panel__work-id {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 4px;
}

.audio-panel__close {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 180ms;
}

.audio-panel__close:hover {
  color: var(--danger, #ef4444);
  border-color: var(--danger, #ef4444);
}

.audio-panel__loading,
.audio-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 13px;
}

.audio-panel__body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.audio-panel__section {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.audio-panel__section:last-child {
  border-bottom: none;
}

.audio-panel__section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-panel__count {
  font-size: 10px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-radius: 999px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

.audio-panel__none {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.6;
  padding: 8px 0;
}

/* ===== Audio Track ===== */
.audio-track {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.audio-track--bgm {
  border-left: 3px solid var(--accent);
}

.audio-track--vo {
  border-left: 3px solid #10b981;
}

.audio-track__play {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 200ms;
}

.audio-track__play:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.audio-track__play--active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.audio-track__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  flex-shrink: 0;
}

.audio-track__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.audio-track__duration {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.audio-track__wave {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 32px;
  overflow: hidden;
}

.audio-track__wave-bar {
  flex: 1;
  min-height: 2px;
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 1px 1px 0 0;
  transition: background 200ms;
}

.audio-track__wave-bar--vo {
  background: color-mix(in srgb, #10b981 25%, transparent);
}

.audio-track__wave-bar--active {
  background: var(--accent);
  animation: audio-wave-bounce 500ms ease-in-out infinite alternate;
}

.audio-track__wave-bar--vo.audio-track__wave-bar--active {
  background: #10b981;
}

@keyframes audio-wave-bounce {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
}

/* ===== SFX List ===== */
.audio-sfx-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-sfx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 180ms;
}

.audio-sfx-item:hover {
  border-color: var(--accent);
}

.audio-sfx__play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 180ms;
}

.audio-sfx__play:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.audio-sfx__play--active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.audio-sfx__title {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
}

.audio-sfx__duration {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

@media (max-width: 768px) {
  .mw__nav {
    flex-wrap: wrap;
    padding: 12px 16px;
  }
  .mw__nav-links {
    order: 3;
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
  }
  .mw__content {
    padding: 16px;
  }
}
</style>