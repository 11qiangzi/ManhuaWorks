<script setup lang="ts">
/**
 * AssetGrid - 资产网格
 * ManhuaWorks studio component
 *
 * 图片/视频/音频资产的网格展示，支持操作
 */

interface AssetItemLike {
  id: string
  name: string
  type: string
  mime?: string
  size: number
  url: string
  thumbnailUrl?: string
  tags?: string[]
  favorite?: boolean
  createdAt?: string
  [key: string]: unknown
}

interface Props {
  assets: AssetItemLike[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  click: [asset: AssetItemLike, event: MouseEvent]
  rename: [id: string, name: string]
  remove: [id: string]
  'toggle-favorite': [id: string]
}>()

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function typeIcon(type: string): string {
  switch (type) {
    case 'image': return '\u{1F5BC}'
    case 'video': return '\u{1F3AC}'
    case 'audio': return '\u{1F3B5}'
    default: return '\u{1F4C4}'
  }
}

function onClickAsset(asset: AssetItemLike, event: MouseEvent) {
  emit('click', asset, event)
}

function onRename(asset: AssetItemLike) {
  const name = prompt('重命名', asset.name)
  if (name && name !== asset.name) {
    emit('rename', asset.id, name)
  }
}
</script>

<template>
  <!-- 加载 -->
  <div v-if="props.loading" class="asset-grid__loading">
    <div class="asset-grid__spinner" />
    <span>加载资产...</span>
  </div>

  <!-- 空 -->
  <div v-else-if="props.assets.length === 0" class="asset-grid__empty">
    <span class="asset-grid__empty-icon">&#128230;</span>
    <p>暂无资产</p>
  </div>

  <!-- 网格 -->
  <div v-else class="asset-grid">
    <article
      v-for="asset in props.assets"
      :key="asset.id"
      class="asset-card"
      @click="onClickAsset(asset, $event)"
    >
      <!-- 缩略图 -->
      <div class="asset-card__thumb">
        <img
          v-if="asset.thumbnailUrl || (asset.type === 'image' && asset.url)"
          :src="asset.thumbnailUrl || asset.url"
          :alt="asset.name"
          class="asset-card__img"
          loading="lazy"
        />
        <span v-else class="asset-card__type-icon">{{ typeIcon(asset.type) }}</span>

        <!-- 收藏标记 -->
        <button
          type="button"
          class="asset-card__fav"
          :class="{ 'asset-card__fav--on': asset.favorite }"
          @click.stop="emit('toggle-favorite', asset.id)"
          :title="asset.favorite ? '取消收藏' : '收藏'"
        >
          {{ asset.favorite ? '\u2605' : '\u2606' }}
        </button>
      </div>

      <!-- 信息 -->
      <div class="asset-card__info">
        <strong class="asset-card__name" :title="asset.name">{{ asset.name }}</strong>
        <div class="asset-card__meta">
          <span>{{ formatSize(asset.size) }}</span>
          <span v-if="asset.tags?.length" class="asset-card__tags">
            <span v-for="t in asset.tags.slice(0, 2)" :key="t" class="asset-card__tag">{{ t }}</span>
          </span>
        </div>
      </div>

      <!-- 操作 -->
      <div class="asset-card__actions">
        <button type="button" class="asset-card__action" @click.stop="onRename(asset)" title="重命名">&#9998;</button>
        <button type="button" class="asset-card__action asset-card__action--danger" @click.stop="emit('remove', asset.id)" title="删除">&#10005;</button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.asset-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
}

.asset-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.asset-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-card__type-icon {
  font-size: 36px;
  opacity: 0.5;
}

.asset-card__fav {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  backdrop-filter: blur(4px);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.asset-card__fav--on {
  color: var(--warning, #f59e0b);
}

.asset-card__fav:hover {
  transform: scale(1.15);
}

.asset-card__info {
  padding: 10px 12px 6px;
}

.asset-card__name {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-secondary);
}

.asset-card__tags {
  display: flex;
  gap: 3px;
}

.asset-card__tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
}

.asset-card__actions {
  display: flex;
  gap: 4px;
  padding: 6px 12px 10px;
  opacity: 0;
  transition: opacity 150ms;
}

.asset-card:hover .asset-card__actions {
  opacity: 1;
}

.asset-card__action {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.asset-card__action:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.asset-card__action--danger:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

/* Loading */
.asset-grid__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--text-secondary);
}

.asset-grid__spinner {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.asset-grid__empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.asset-grid__empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 8px;
  opacity: 0.6;
}
</style>
