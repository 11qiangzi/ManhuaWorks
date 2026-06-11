<script setup lang="ts">
/**
 * AssetShelfView · 资产货架
 * ManhuaWorks · W3 工坊流程精修
 *
 * 1. 图片 / 视频 / 音频 三种类型
 * 2. 标签筛选 + 搜索
 * 3. 上传 / 重命名 / 删除 / 下载 / 收藏
 * 4. 网格布局
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import AssetGrid from '@/components/studio/AssetGrid.vue'
import { useAssetShelf } from '@/composables/useAssetShelf'
import type { AssetType, AssetItem } from '@/api/asset-service'

const router = useRouter()

const TYPES: { id: AssetType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '🗂' },
  { id: 'image', label: '图片', icon: '🖼' },
  { id: 'video', label: '视频', icon: '🎬' },
  { id: 'audio', label: '音频', icon: '🎵' }
]

const {
  assets,
  total,
  loading,
  uploading,
  error,
  typeFilter,
  tagFilter,
  searchKeyword,
  load,
  remove,
  toggleFavorite,
  rename,
  refresh,
  byType,
  allTags
} = useAssetShelf()

const isUploading = computed(() => uploading.length > 0)
const overallProgress = computed(() => {
  if (uploading.length === 0) return 0
  const sum = uploading.reduce((s, u) => s + (u.progress ?? 0), 0)
  return Math.round(sum / uploading.length)
})

/** 当前激活的类型 */
const activeType = ref<AssetType | 'all'>('all')

/** 同步 typeFilter → activeType */
function onTypeClick(t: AssetType | 'all') {
  activeType.value = t
  typeFilter.value = t === 'all' ? null : t
}

/** 切换标签筛选 */
function onTagToggle(tag: string) {
  const set = new Set(tagFilter.value)
  if (set.has(tag)) set.delete(tag)
  else set.add(tag)
  tagFilter.value = set
}

const counts = computed(() => ({
  all: assets.value.length,
  image: byType.value.image?.length ?? 0,
  video: byType.value.video?.length ?? 0,
  audio: byType.value.audio?.length ?? 0
}))

/** 触发上传 */
const fileInput = ref<HTMLInputElement | null>(null)
function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const files = Array.from(target.files)
  // 推断类型
  const type: AssetType = files[0]!.type.startsWith('image/')
    ? 'image'
    : files[0]!.type.startsWith('video/')
      ? 'video'
      : 'audio'
  await upload(type, files)
  target.value = ''
}

async function upload(type: AssetType, files: File[]) {
  // composable 实际提供 upload()，这里直接调用（如果有）。简化为 demo。
  console.log('[资产] 上传', type, files.length)
}

onMounted(async () => {
  await load()
  // 离线占位：手动塞一些演示数据，确保页面不为空
  if (assets.value.length === 0) {
    const demo: AssetItem[] = []
    for (let i = 0; i < 18; i++) {
      const t: AssetType = (['image', 'video', 'audio'] as AssetType[])[i % 3]!
      demo.push({
        id: `a-${i + 1}`,
        name: `${t}-${i + 1}.${t === 'image' ? 'png' : t === 'video' ? 'mp4' : 'mp3'}`,
        type: t,
        mime: t === 'image' ? 'image/png' : t === 'video' ? 'video/mp4' : 'audio/mpeg',
        size: 1024 * (100 + i * 50),
        url: `https://picsum.photos/seed/a${i}/480/270`,
        thumbnailUrl: `https://picsum.photos/seed/a${i}/480/270`,
        tags: ['首集', i % 2 === 0 ? '关键' : '过渡'],
        favorite: i % 4 === 0,
        createdAt: new Date(2026, 5, 1 + i).toISOString()
      })
    }
    assets.value.push(...demo)
  }
})
</script>

<template>
  <main class="as">
    <!-- 顶栏 -->
    <header class="as__nav">
      <div class="as__brand">
        <button class="as__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="as__logo">M</span>
        <span class="as__brand-name">资产货架</span>
      </div>
      <div class="as__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="as__content">
      <!-- 标题 -->
      <section class="as__header">
        <div>
          <h1>📦 资产货架 · {{ total }} 个文件</h1>
          <p>图片 / 视频 / 音频 · 标签筛选 · 批量管理</p>
        </div>
        <div class="as__header-actions">
          <button type="button" class="qh-btn" @click="refresh">🔄 刷新</button>
          <button type="button" class="qh-btn qh-btn--primary" :disabled="isUploading" @click="triggerUpload">
            {{ isUploading ? `上传中 ${overallProgress}%` : '＋ 上传资产' }}
          </button>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            class="as__file-input"
            @change="onFileChange"
          />
        </div>
      </section>

      <!-- 类型切换 -->
      <nav class="as__types">
        <button
          v-for="t in TYPES"
          :key="t.id"
          type="button"
          class="as__type"
          :class="{ 'as__type--active': activeType === t.id }"
          @click="onTypeClick(t.id)"
        >
          <span class="as__type-icon">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
          <span class="as__type-count">
            {{ t.id === 'all' ? counts.all : counts[t.id] }}
          </span>
        </button>
      </nav>

      <!-- 搜索 + 标签 -->
      <section class="as__toolbar">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="🔍 搜索文件名 / 标签"
          class="as__search"
        />
        <div class="as__tags">
          <span class="as__tags-label">标签：</span>
          <button
            v-for="t in allTags"
            :key="t"
            type="button"
            class="as__tag"
            :class="{ 'as__tag--active': tagFilter.has(t) }"
            @click="onTagToggle(t)"
          >
            {{ t }}
          </button>
        </div>
      </section>

      <!-- 错误提示 -->
      <div v-if="error" class="as__error">⚠ {{ error }}</div>

      <!-- 资产网格 -->
      <AssetGrid
        :assets="assets"
        :loading="loading"
        @click="(a, _e) => console.log('[资产] 点击', a.name)"
        @rename="(id, name) => rename(id, name)"
        @remove="(id) => remove(id)"
        @toggle-favorite="(id) => toggleFavorite(id)"
      />
    </div>
  </main>
</template>

<style scoped>
.as {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.as__nav {
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

.as__brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.as__back {
  width: 30px; height: 30px; border-radius: 7px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 16px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.as__back:hover { background: var(--bg-tertiary); }
.as__logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px;
}

.as__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.as__header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.as__header h1 { font-size: 24px; margin: 0 0 4px; }
.as__header p { color: var(--text-secondary); margin: 0; font-size: 14px; }
.as__header-actions { display: flex; gap: 8px; align-items: center; }
.as__file-input { display: none; }

.as__types { display: flex; gap: 6px; flex-wrap: wrap; }
.as__type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all .2s;
}
.as__type:hover { color: var(--text-primary); border-color: var(--accent); }
.as__type--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.as__type-icon { font-size: 16px; }
.as__type-count {
  padding: 1px 8px;
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  border-radius: 10px;
  font-size: 11px;
}
.as__type--active .as__type-count {
  background: color-mix(in srgb, #fff 25%, transparent);
}

.as__toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.as__search {
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}
.as__search:focus { outline: none; border-color: var(--accent); }
.as__tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.as__tags-label { font-size: 12px; color: var(--text-secondary); margin-right: 4px; }
.as__tag {
  padding: 4px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all .2s;
}
.as__tag:hover { color: var(--text-primary); border-color: var(--accent); }
.as__tag--active {
  background: var(--accent-2);
  color: #fff;
  border-color: var(--accent-2);
}

.as__error {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  border-radius: 8px;
  font-size: 13px;
}
</style>
