<script setup lang="ts">
/**
 * AssetsView · 素材库
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 网格：缩略图 / 类型标签 / 大小 / 上传时间
 * 上传 / 删除 / 批量操作
 * 调 apiClient.assets.list + upload + delete (失败回退 mock)
 */

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'

const api = getApi()

/* ------------------------------------------------------------------ */
/*                          类型                                       */
/* ------------------------------------------------------------------ */

type AssetType = 'image' | 'video' | 'audio' | 'character' | 'scene'

interface Asset {
  id: string
  name: string
  type: AssetType
  cover: string
  size: number
  url: string
  uploader?: string
  createdAt: string
  tags?: string[]
}

interface AssetListResp {
  list: Asset[]
  total: number
}

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const assets = ref<Asset[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const typeFilter = ref<AssetType | 'all'>('all')
const searchKeyword = ref('')
const selected = ref<Set<string>>(new Set())
const uploading = ref(false)
const dragOver = ref(false)

/* ------------------------------------------------------------------ */
/*                          Mock 回退                                  */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<AssetType, { label: string; color: string; icon: string }> = {
  image: { label: '图片', color: '#10b981', icon: '🖼' },
  video: { label: '视频', color: '#ef4444', icon: '🎬' },
  audio: { label: '音频', color: '#f59e0b', icon: '🎵' },
  character: { label: '角色', color: '#a855f7', icon: '👤' },
  scene: { label: '场景', color: '#2563eb', icon: '🏞' }
}

const MOCK_ASSETS: Asset[] = [
  { id: 'a1', name: '长安城日景.jpg', type: 'image', cover: '🏯', size: 4_512_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 86_400_000).toISOString(), tags: ['古风', '日景'] },
  { id: 'a2', name: '苏锦年 · 立绘.png', type: 'character', cover: '👘', size: 12_240_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), tags: ['女主'] },
  { id: 'a3', name: '校园走廊.mp4', type: 'video', cover: '🏫', size: 32_000_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), tags: ['校园'] },
  { id: 'a4', name: '古风 BGM.mp3', type: 'audio', cover: '🎶', size: 8_200_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), tags: ['BGM'] },
  { id: 'a5', name: '街市场景.jpg', type: 'scene', cover: '🏮', size: 6_100_000, url: '#', uploader: '林染', createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), tags: ['场景', '古代'] },
  { id: 'a6', name: '男主 · 林启.png', type: 'character', cover: '🧑', size: 9_800_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), tags: ['男主'] },
  { id: 'a7', name: '星空.jpg', type: 'image', cover: '🌌', size: 3_200_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), tags: ['背景'] },
  { id: 'a8', name: '雨景.mp4', type: 'video', cover: '🌧', size: 24_000_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 8 * 86_400_000).toISOString(), tags: ['天气'] },
  { id: 'a9', name: '宫廷大殿.png', type: 'scene', cover: '🏛', size: 15_400_000, url: '#', uploader: '林染', createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), tags: ['场景'] },
  { id: 'a10', name: '音效 · 剑鸣.wav', type: 'audio', cover: '⚔️', size: 1_200_000, url: '#', uploader: '我', createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(), tags: ['音效'] }
]

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await api.http.request<{ data: AssetListResp }>({
      method: 'GET',
      path: '/v1/assets',
      query: {
        type: typeFilter.value === 'all' ? undefined : typeFilter.value,
        keyword: searchKeyword.value.trim() || undefined
      }
    })
    if (res?.data?.list && res.data.list.length > 0) {
      assets.value = res.data.list
      total.value = res.data.total
    } else {
      applyMock()
    }
  } catch {
    applyMock()
  } finally {
    loading.value = false
  }
}

function applyMock(): void {
  let list = MOCK_ASSETS.slice()
  if (typeFilter.value !== 'all') list = list.filter((a) => a.type === typeFilter.value)
  if (searchKeyword.value.trim()) {
    const k = searchKeyword.value.trim()
    list = list.filter((a) => a.name.includes(k) || (a.tags ?? []).some((t) => t.includes(k)))
  }
  assets.value = list
  total.value = list.length
}

onMounted(load)

/* ------------------------------------------------------------------ */
/*                          工具                                       */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB'
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

const counts = computed(() => {
  const c: Record<AssetType | 'all', number> = { all: 0, image: 0, video: 0, audio: 0, character: 0, scene: 0 }
  for (const a of MOCK_ASSETS) {
    c.all += 1
    c[a.type] += 1
  }
  return c
})

/* ------------------------------------------------------------------ */
/*                          选中                                       */
/* ------------------------------------------------------------------ */

function toggleSelect(id: string): void {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}

function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function clearSelection(): void {
  selected.value = new Set()
}

function selectAll(): void {
  if (selected.value.size === assets.value.length) {
    selected.value = new Set()
  } else {
    selected.value = new Set(assets.value.map((a) => a.id))
  }
}

/* ------------------------------------------------------------------ */
/*                          上传 / 删除                                */
/* ------------------------------------------------------------------ */

async function onUpload(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      try {
        await api.http.request<{ data: Asset }>({
          method: 'POST',
          path: '/v1/assets/upload',
          body: { name: file.name, size: file.size, type: file.type }
        })
      } catch {
        // mock
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const type: AssetType =
        ['mp4', 'mov', 'webm'].includes(ext) ? 'video' :
        ['mp3', 'wav', 'ogg'].includes(ext) ? 'audio' :
        ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'image' : 'image'
      const newAsset: Asset = {
        id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type,
        cover: TYPE_META[type].icon,
        size: file.size,
        url: URL.createObjectURL(file),
        uploader: '我',
        createdAt: new Date().toISOString(),
        tags: []
      }
      assets.value.unshift(newAsset)
      total.value += 1
    }
  } finally {
    uploading.value = false
  }
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  dragOver.value = false
  onUpload(e.dataTransfer?.files ?? null)
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave(): void {
  dragOver.value = false
}

const fileInput = ref<HTMLInputElement | null>(null)
function pickFile(): void {
  fileInput.value?.click()
}

async function deleteOne(a: Asset): Promise<void> {
  if (!confirm(`确定删除素材「${a.name}」？`)) return
  try {
    await api.http.request({ method: 'DELETE', path: `/v1/assets/${a.id}` })
  } catch {
    // mock fallback
  }
  assets.value = assets.value.filter((x) => x.id !== a.id)
  total.value = Math.max(0, total.value - 1)
  selected.value.delete(a.id)
  selected.value = new Set(selected.value)
}

async function deleteSelected(): Promise<void> {
  if (selected.value.size === 0) return
  if (!confirm(`确定批量删除 ${selected.value.size} 个素材？`)) return
  for (const id of selected.value) {
    try {
      await api.http.request({ method: 'DELETE', path: `/v1/assets/${id}` })
    } catch {
      /* mock */
    }
  }
  assets.value = assets.value.filter((x) => !selected.value.has(x.id))
  total.value = Math.max(0, total.value - selected.value.size)
  clearSelection()
}
</script>

<template>
  <main class="av">
    <header class="av__nav">
      <div class="av__brand">
        <span class="av__logo">M</span>
        <span class="av__brand-name">素材库</span>
      </div>
      <nav class="av__nav-links">
        <RouterLink to="/dashboard" class="av__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="av__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="av__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="av__nav-link av__nav-link--active">素材</RouterLink>
        <RouterLink to="/team" class="av__nav-link">团队</RouterLink>
        <RouterLink to="/account" class="av__nav-link">账户</RouterLink>
      </nav>
    </header>

    <div class="av__content">
      <section class="av__bar">
        <h1 class="av__title">🗃 素材库 <span class="av__count">({{ total }})</span></h1>
        <div class="av__actions">
          <input
            v-model="searchKeyword"
            type="search"
            class="av__search"
            placeholder="搜索素材名 / 标签…"
            @keyup.enter="load"
          />
          <select v-model="typeFilter" class="av__select" @change="load">
            <option value="all">全部 ({{ counts.all }})</option>
            <option value="image">图片 ({{ counts.image }})</option>
            <option value="video">视频 ({{ counts.video }})</option>
            <option value="audio">音频 ({{ counts.audio }})</option>
            <option value="character">角色 ({{ counts.character }})</option>
            <option value="scene">场景 ({{ counts.scene }})</option>
          </select>
          <button type="button" class="av__btn av__btn--primary" @click="pickFile">+ 上传</button>
          <input
            ref="fileInput"
            type="file"
            multiple
            style="display: none"
            @change="(e) => onUpload((e.target as HTMLInputElement).files)"
          />
        </div>
      </section>

      <!-- 批量操作条 -->
      <section v-if="selected.size > 0" class="av__batch">
        <span>已选 <strong>{{ selected.size }}</strong> 项</span>
        <button type="button" class="av__btn" @click="selectAll">{{ selected.size === assets.length ? '取消全选' : '全选当前' }}</button>
        <button type="button" class="av__btn" @click="clearSelection">清空选择</button>
        <button type="button" class="av__btn av__btn--danger" @click="deleteSelected">🗑 批量删除</button>
      </section>

      <!-- 上传拖放区 -->
      <section
        v-if="uploading || dragOver"
        class="av__drop"
        :class="{ 'av__drop--active': dragOver }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <p v-if="uploading">⏳ 上传中…</p>
        <p v-else>📥 拖放文件到此处以上传</p>
      </section>
      <section
        v-else
        class="av__drop av__drop--idle"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <p>📥 拖放文件到此处 / <a href="#" @click.prevent="pickFile">点击选择</a></p>
      </section>

      <section v-if="loading" class="av__loading">加载中…</section>
      <section v-else-if="assets.length === 0" class="av__empty">📭 素材库空空如也，上传一些吧</section>
      <section v-else class="av__grid">
        <article
          v-for="a in assets"
          :key="a.id"
          class="ast"
          :class="{ 'ast--selected': isSelected(a.id) }"
        >
          <div
            class="ast__cover"
            :style="{ background: `linear-gradient(135deg, ${TYPE_META[a.type].color} 0%, #6366f1 100%)` }"
          >
            <span class="ast__emoji">{{ a.cover }}</span>
            <span class="ast__type" :style="{ color: TYPE_META[a.type].color }">
              {{ TYPE_META[a.type].icon }} {{ TYPE_META[a.type].label }}
            </span>
            <label class="ast__check" @click.stop>
              <input
                type="checkbox"
                :checked="isSelected(a.id)"
                @change="toggleSelect(a.id)"
              />
            </label>
          </div>
          <div class="ast__body">
            <p class="ast__name" :title="a.name">{{ a.name }}</p>
            <p class="ast__meta">
              <span>{{ formatSize(a.size) }}</span>
              <span class="ast__sep">·</span>
              <span>{{ formatTime(a.createdAt) }}</span>
            </p>
            <p v-if="a.uploader" class="ast__uploader">上传：{{ a.uploader }}</p>
            <button type="button" class="ast__del" @click.stop="deleteOne(a)">删除</button>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.av { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.av__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.av__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.av__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  color: white; font-weight: 800;
}
.av__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.av__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.av__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.av__nav-link--active { color: white; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); }

.av__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 16px; }
.av__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.av__title { font-size: 22px; font-weight: 800; margin: 0; }
.av__count { font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.av__actions { display: flex; gap: 8px; margin-left: auto; align-items: center; flex-wrap: wrap; }
.av__search, .av__select {
  height: 36px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  font-size: 13px;
}
.av__search { width: 220px; }
.av__btn {
  height: 36px; padding: 0 14px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer; font-size: 13px; font-weight: 600;
}
.av__btn--primary { background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: white; border: none; }
.av__btn--danger { color: #ef4444; border-color: #ef4444; }
.av__btn--danger:hover { background: #ef4444; color: white; }

.av__batch {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: color-mix(in srgb, #2563eb 8%, var(--bg-secondary));
  border: 1px solid #2563eb; border-radius: 8px; font-size: 13px;
}

.av__drop {
  border: 2px dashed var(--border); border-radius: 8px; padding: 14px;
  text-align: center; color: var(--text-secondary); font-size: 13px; transition: all 180ms;
}
.av__drop--active { border-color: #2563eb; background: color-mix(in srgb, #2563eb 6%, transparent); }
.av__drop--idle a { color: #2563eb; }

.av__loading, .av__empty { padding: 60px 20px; text-align: center; color: var(--text-secondary); }
.av__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
@media (max-width: 960px) { .av__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .av__grid { grid-template-columns: 1fr; } }

.ast {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 10px; overflow: hidden; transition: all 200ms; position: relative;
}
.ast:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.12); }
.ast--selected { border-color: #2563eb; box-shadow: 0 0 0 2px color-mix(in srgb, #2563eb 30%, transparent); }
.ast__cover {
  aspect-ratio: 1 / 1; position: relative;
  display: flex; align-items: center; justify-content: center;
  font-size: 56px; color: white;
}
.ast__emoji { filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.2)); }
.ast__type {
  position: absolute; top: 8px; left: 8px;
  background: rgba(255, 255, 255, 0.95); padding: 2px 7px;
  border-radius: 99px; font-size: 10px; font-weight: 700;
}
.ast__check {
  position: absolute; top: 8px; right: 8px;
  width: 22px; height: 22px;
  background: rgba(255, 255, 255, 0.95); border-radius: 4px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.ast__check input { cursor: pointer; }
.ast__body { padding: 10px 12px; }
.ast__name { font-size: 12px; font-weight: 700; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ast__meta { font-size: 10px; color: var(--text-secondary); margin: 4px 0 2px; }
.ast__sep { margin: 0 4px; opacity: 0.5; }
.ast__uploader { font-size: 10px; color: var(--text-secondary); margin: 0 0 4px; }
.ast__del {
  font-size: 11px; padding: 3px 8px; border: 1px solid #ef4444;
  background: transparent; color: #ef4444; border-radius: 4px; cursor: pointer;
}
.ast__del:hover { background: #ef4444; color: white; }
</style>
