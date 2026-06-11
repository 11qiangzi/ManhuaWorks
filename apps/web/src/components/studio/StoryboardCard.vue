<script setup lang="ts">
/**
 * StoryboardCard · 分镜卡片
 * ManhuaWorks · W3 工坊流程精修
 *
 * 显示：缩略图 + 镜头号 + 描述 + 时长 + 镜头类型
 * 交互：点击编辑 / 删除
 */
import { computed } from 'vue'

export interface StoryboardShot {
  id: string
  order: number
  thumbnail?: string | null
  description: string
  duration: number
  camera?: string
  characters?: string[]
  scene?: string
  status?: 'draft' | 'generating' | 'done' | 'failed'
}

const props = defineProps<{
  shot: StoryboardShot
  selected?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
  (e: 'select', id: string): void
  (e: 'preview', id: string): void
}>()

const cameraIcon = computed(() => {
  const map: Record<string, string> = {
    close_up: '🔍',
    medium: '👤',
    wide: '🌄',
    pan: '↔️',
    tilt: '↕️',
    dolly: '🎥',
    tracking: '🏃',
    over_shoulder: '👥'
  }
  return map[props.shot.camera ?? ''] ?? '🎬'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    draft: '草稿',
    generating: '生成中',
    done: '完成',
    failed: '失败'
  }
  return map[props.shot.status ?? 'draft'] ?? '草稿'
})

function onEdit(e: Event) {
  e.stopPropagation()
  emit('edit', props.shot.id)
}
function onRemove(e: Event) {
  e.stopPropagation()
  if (confirm(`确认删除分镜 #${props.shot.order}？`)) {
    emit('remove', props.shot.id)
  }
}
function onClick() {
  emit('select', props.shot.id)
  emit('preview', props.shot.id)
}
</script>

<template>
  <article
    class="sb-card"
    :class="{
      'sb-card--selected': selected,
      'sb-card--compact': compact,
      [`sb-card--${shot.status ?? 'draft'}`]: true
    }"
    @click="onClick"
  >
    <!-- 缩略图 -->
    <div class="sb-card__thumb">
      <img v-if="shot.thumbnail" :src="shot.thumbnail" :alt="`分镜 ${shot.order}`" />
      <div v-else class="sb-card__thumb-placeholder">
        <span class="sb-card__camera-icon">{{ cameraIcon }}</span>
      </div>
      <span class="sb-card__order">#{{ shot.order }}</span>
      <span class="sb-card__status" :class="`sb-card__status--${shot.status ?? 'draft'}`">
        {{ statusLabel }}
      </span>
    </div>

    <!-- 主体 -->
    <div class="sb-card__body">
      <div class="sb-card__meta">
        <span class="sb-card__camera" :title="shot.camera">
          {{ cameraIcon }} {{ shot.camera || '镜头' }}
        </span>
        <span class="sb-card__duration">⏱ {{ shot.duration }}s</span>
      </div>
      <p class="sb-card__desc" :title="shot.description">{{ shot.description }}</p>
      <div v-if="shot.characters && shot.characters.length > 0" class="sb-card__tags">
        <span v-for="c in shot.characters.slice(0, 3)" :key="c" class="sb-card__tag">👤 {{ c }}</span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="sb-card__actions" @click.stop>
      <button type="button" class="sb-card__btn" title="编辑" @click="onEdit">✏️</button>
      <button type="button" class="sb-card__btn sb-card__btn--danger" title="删除" @click="onRemove">🗑️</button>
    </div>
  </article>
</template>

<style scoped>
.sb-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
  user-select: none;
}

.sb-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.sb-card--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.sb-card--generating { border-left: 3px solid var(--warning); }
.sb-card--done { border-left: 3px solid var(--success); }
.sb-card--failed { border-left: 3px solid var(--danger); }

.sb-card__thumb {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.sb-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sb-card__thumb-placeholder {
  font-size: 36px;
  opacity: 0.5;
}

.sb-card__camera-icon {
  font-size: 32px;
}

.sb-card__order {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.sb-card__status {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.sb-card__status--generating { background: var(--warning); color: var(--bg-primary); }
.sb-card__status--done { background: var(--success); color: var(--bg-primary); }
.sb-card__status--failed { background: var(--danger); color: var(--bg-primary); }
.sb-card__status--draft { background: color-mix(in srgb, var(--text-secondary) 30%, transparent); }

.sb-card__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.sb-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.sb-card__camera {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sb-card__duration {
  font-family: monospace;
  color: var(--accent);
  font-weight: 600;
}

.sb-card__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.sb-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.sb-card__tag {
  font-size: 10px;
  padding: 1px 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  border-radius: 3px;
}

.sb-card__actions {
  display: flex;
  gap: 4px;
  padding: 0 8px 8px;
  opacity: 0;
  transition: opacity 200ms;
}

.sb-card:hover .sb-card__actions,
.sb-card--selected .sb-card__actions {
  opacity: 1;
}

.sb-card__btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
}

.sb-card__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sb-card__btn--danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.sb-card--compact .sb-card__body { padding: 8px 10px 10px; }
.sb-card--compact .sb-card__desc { -webkit-line-clamp: 2; font-size: 11px; }
</style>
