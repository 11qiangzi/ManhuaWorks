<script setup lang="ts">
/**
 * AssetGrid · 资产网格
 * ManhuaWorks · W3 工坊流程精修
 *
 * 缩略图网格 + 标签 + 操作菜单（重命名/下载/删除/收藏）
 * 适配：image / video / audio
 */
import { ref, computed } from 'vue'
import type { AssetItem, AssetType } from '@/api/asset-service'

const props = defineProps<{
  assets: AssetItem[]
  loading?: boolean
  selectedIds?: string[]
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', asset: AssetItem, event: MouseEvent): void
  (e: 'rename', id: string, newName: string): void
  (e: 'remove', id: string): void
  (e: 'download', asset: AssetItem): void
  (e: 'toggleFavorite', id: string): void
  (e: 'openMenu', id: string): void
}>()

const menuOpenId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameDraft = ref('')

const TYPE_ICON: Record<AssetType, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  other: '📄'
}

function isSelected(id: string): boolean {
  return props.selectedIds?.includes(id) ?? false
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function onClick(asset: AssetItem, e: MouseEvent) {
  emit('click', asset, e)
}

function onMenuToggle(id: string, e: Event) {
  e.stopPropagation()
  menuOpenId.value = menuOpenId.value === id ? null : id
  emit('openMenu', id)
}

function onRenameStart(asset: AssetItem, e: Event) {
  e.stopPropagation()
  renamingId.value = asset.id
  renameDraft.value = asset.alias || asset.name
  menuOpenId.value = null
}

function onRenameCommit(id: string) {
  const v = renameDraft.value.trim()
  if (v) emit('rename', id, v)
  renamingId.value = null
}

function onRenameCancel() {
  renamingId.value = null
}

function onRemove(asset: AssetItem, e: Event) {
  e.stopPropagation()
  if (confirm(`确认删除「${asset.name}」？`)) {
    emit('remove', asset.id)
  }
  menuOpenId.value = null
}

function onDownload(asset: AssetItem, e: Event) {
  e.stopPropagation()
  emit('download', asset)
  menuOpenId.value = null
}

function onFavorite(asset: AssetItem, e: Event) {
  e.stopPropagation()
  emit('toggleFavorite', asset.id)
}

// 点击外部关闭菜单
function onDocClick() {
  menuOpenId.value = null
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', onDocClick)
  // 卸载时清理（onUnmounted 在 setup 中）
  // 这里不引入 onUnmounted 模块以保持组件轻量
}

const emit_ = emit
void emit_ // 防止 tree-shake 警告
</script>

<template>
  <div class="asset-grid" :class="{ 'asset-grid--compact': compact }">
    <div v-if="loading && assets.length === 0" class="asset-grid__loading">
      <div class="asset-grid__spinner" />
      <span>加载资产...</span>
    </div>

    <div v-else-if="assets.length === 0" class="asset-grid__empty">
      <span class="asset-grid__empty-icon">📦</span>
      <p>暂无资产</p>
      <span class="asset-grid__empty-sub">上传文件或切换筛选条件</span>
    </div>

    <div v-else class="asset-grid__list">
      <article
        v-for="asset in assets"
        :key="asset.id"
        class="asset"
        :class="{
          'asset--selected': isSelected(asset.id),
          [`asset--${asset.type}`]: true
        }"
        @click="onClick(asset, $event)"
      >
        <!-- 缩略图 -->
        <div class="asset__thumb">
          <img
            v-if="asset.type === 'image' && asset.url"
            :src="asset.thumbnailUrl || asset.url"
            :alt="asset.name"
            loading="lazy"
          />
          <video
            v-else-if="asset.type === 'video' && asset.url"
            :src="asset.url"
            preload="metadata"
            muted
          />
          <div v-else-if="asset.type === 'audio'" class="asset__audio">
            <span class="asset__type-icon">{{ TYPE_ICON.audio }}</span>
            <div class="asset__audio-wave" aria-hidden="true">
              <span v-for="i in 12" :key="i" :style="{ height: `${30 + (i * 13) % 50}%` }" />
            </div>
          </div>
          <div v-else class="asset__placeholder">
            <span class="asset__type-icon">{{ TYPE_ICON[asset.type] }}</span>
          </div>

          <span class="asset__type-badge">{{ TYPE_ICON[asset.type] }}</span>

          <span v-if="asset.duration" class="asset__duration">
            ⏱ {{ formatDuration(asset.duration) }}
          </span>

          <span
            v-if="asset.favorite"
            class="asset__fav"
            title="已收藏"
            @click.stop="onFavorite(asset, $event)"
          >★</span>
        </div>

        <!-- 名称/重命名输入框 -->
        <div class="asset__body">
          <input
            v-if="renamingId === asset.id"
            v-model="renameDraft"
            type="text"
            class="asset__rename-input"
            autofocus
            @blur="onRenameCommit(asset.id)"
            @keyup.enter="onRenameCommit(asset.id)"
            @keyup.escape="onRenameCancel"
            @click.stop
          />
          <h4 v-else class="asset__name" :title="asset.name">
            {{ asset.alias || asset.name }}
          </h4>

          <div class="asset__meta">
            <span>{{ formatSize(asset.size) }}</span>
            <span v-if="asset.width && asset.height">· {{ asset.width }}×{{ asset.height }}</span>
          </div>

          <div v-if="asset.tags && asset.tags.length > 0" class="asset__tags">
            <span v-for="t in asset.tags.slice(0, 3)" :key="t" class="asset__tag">#{{ t }}</span>
          </div>
        </div>

        <!-- 操作菜单 -->
        <button
          type="button"
          class="asset__menu-btn"
          title="操作"
          @click="onMenuToggle(asset.id, $event)"
        >⋮</button>

        <div v-if="menuOpenId === asset.id" class="asset__menu" @click.stop>
          <button type="button" class="asset__menu-item" @click="onRenameStart(asset, $event)">
            ✏️ 重命名
          </button>
          <button type="button" class="asset__menu-item" @click="onFavorite(asset, $event)">
            {{ asset.favorite ? '☆ 取消收藏' : '★ 收藏' }}
          </button>
          <button type="button" class="asset__menu-item" @click="onDownload(asset, $event)">
            ⬇️ 下载
          </button>
          <div class="asset__menu-divider" />
          <button type="button" class="asset__menu-item asset__menu-item--danger" @click="onRemove(asset, $event)">
            🗑️ 删除
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.asset-grid {
  width: 100%;
}

.asset-grid--compact .asset__name { font-size: 11px; }

.asset-grid__loading,
.asset-grid__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.asset-grid__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.asset-grid__empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.asset-grid__empty p {
  margin: 0;
  font-size: 14px;
}

.asset-grid__empty-sub {
  font-size: 12px;
  opacity: 0.7;
}

.asset-grid__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.asset-grid--compact .asset-grid__list {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

/* ===== 单个资产 ===== */
.asset {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
}

.asset:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.asset--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.asset__thumb {
  position: relative;
  aspect-ratio: 1/1;
  background: var(--bg-primary);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset__thumb img,
.asset__thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.asset__type-icon {
  font-size: 36px;
  opacity: 0.5;
}

.asset__audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  width: 100%;
}

.asset__audio-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 32px;
  justify-content: center;
}

.asset__audio-wave span {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  animation: wave 1.4s ease-in-out infinite;
  opacity: 0.7;
}

.asset__audio-wave span:nth-child(odd) { animation-delay: 0.2s; }
.asset__audio-wave span:nth-child(3n) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}

.asset__type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  color: var(--text-primary);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  border: 1px solid var(--border);
}

.asset__duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 1px 6px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 3px;
  font-size: 10px;
  font-family: monospace;
}

.asset__fav {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #fbbf24;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  user-select: none;
}

/* ===== 主体 ===== */
.asset__body {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.asset__name {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset__rename-input {
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  width: 100%;
  outline: none;
}

.asset__meta {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
  display: flex;
  gap: 3px;
}

.asset__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}

.asset__tag {
  font-size: 9px;
  padding: 1px 4px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}

/* ===== 菜单 ===== */
.asset__menu-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 150ms;
  font-family: inherit;
  backdrop-filter: blur(4px);
}

.asset:hover .asset__menu-btn { opacity: 1; }

.asset__menu-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.asset__menu {
  position: absolute;
  top: 36px;
  right: 6px;
  z-index: 20;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow);
  padding: 4px;
  display: flex;
  flex-direction: column;
  animation: menuIn 150ms ease;
}

@keyframes menuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.asset__menu-item {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  padding: 6px 10px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: background 150ms;
}

.asset__menu-item:hover {
  background: var(--bg-secondary);
  color: var(--accent);
}

.asset__menu-item--danger:hover {
  color: var(--danger);
}

.asset__menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>
