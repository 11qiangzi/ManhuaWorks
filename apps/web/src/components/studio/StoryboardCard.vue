<script setup lang="ts">
/**
 * StoryboardCard - 分镜卡片
 * ManhuaWorks studio component
 *
 * 展示单个分镜镜头信息（用于分镜编辑器详情区）
 */

export interface StoryboardShot {
  id: string
  order: number
  description: string
  duration: number
  camera?: string
  characters?: string[]
  scene?: string
  status: 'done' | 'generating' | 'draft' | 'failed'
  imageUrl?: string | null
}

interface Props {
  shot: StoryboardShot
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

const emit = defineEmits<{
  select: [id: string]
  edit: [id: string]
  remove: [id: string]
  'adjust-duration': [id: string, delta: number]
}>()

const CAMERA_LABELS: Record<string, string> = {
  medium: '中景',
  close_up: '特写',
  wide: '远景',
  tracking: '跟拍'
}

const STATUS_LABELS: Record<string, string> = {
  done: '已完成',
  generating: '生成中',
  draft: '草稿',
  failed: '失败'
}
</script>

<template>
  <article
    class="sb-card"
    :class="{
      'sb-card--selected': props.selected,
      [`sb-card--${props.shot.status}`]: true
    }"
    @click="emit('select', props.shot.id)"
  >
    <div class="sb-card__head">
      <span class="sb-card__order">#{{ props.shot.order }}</span>
      <span class="sb-card__camera">{{ CAMERA_LABELS[props.shot.camera ?? ''] ?? props.shot.camera ?? '未分类' }}</span>
      <span class="sb-card__status" :class="`sb-card__status--${props.shot.status}`">
        {{ STATUS_LABELS[props.shot.status] ?? props.shot.status }}
      </span>
    </div>

    <p class="sb-card__desc">{{ props.shot.description }}</p>

    <div v-if="props.shot.characters?.length" class="sb-card__chars">
      <span v-for="c in props.shot.characters" :key="c" class="sb-card__char">{{ c }}</span>
    </div>

    <div class="sb-card__foot">
      <div class="sb-card__duration">
        <button type="button" class="sb-card__dur-btn" @click.stop="emit('adjust-duration', props.shot.id, -1)">-</button>
        <span class="sb-card__dur-val">{{ props.shot.duration }}s</span>
        <button type="button" class="sb-card__dur-btn" @click.stop="emit('adjust-duration', props.shot.id, 1)">+</button>
      </div>
      <div class="sb-card__actions">
        <button type="button" class="sb-card__btn" @click.stop="emit('edit', props.shot.id)" title="编辑">&#9998;</button>
        <button type="button" class="sb-card__btn sb-card__btn--danger" @click.stop="emit('remove', props.shot.id)" title="删除">&#10005;</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.sb-card {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 200ms;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sb-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.sb-card--selected {
  border-color: var(--accent);
  box-shadow: var(--glow);
}

.sb-card--done { border-left: 3px solid var(--success, #22c55e); }
.sb-card--generating { border-left: 3px solid var(--warning, #f59e0b); }
.sb-card--failed { border-left: 3px solid var(--danger, #ef4444); }

.sb-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sb-card__order {
  font-weight: 700;
  color: var(--accent);
  font-size: 14px;
}

.sb-card__camera {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  color: var(--text-secondary);
}

.sb-card__status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
}

.sb-card__status--done { background: color-mix(in srgb, var(--success, #22c55e) 20%, transparent); color: var(--success, #22c55e); }
.sb-card__status--generating { background: color-mix(in srgb, var(--warning, #f59e0b) 20%, transparent); color: var(--warning, #f59e0b); }
.sb-card__status--draft { background: var(--bg-primary); color: var(--text-secondary); }
.sb-card__status--failed { background: color-mix(in srgb, var(--danger, #ef4444) 20%, transparent); color: var(--danger, #ef4444); }

.sb-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

.sb-card__chars {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.sb-card__char {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}

.sb-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.sb-card__duration {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sb-card__dur-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.sb-card__dur-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sb-card__dur-val {
  font-size: 13px;
  font-weight: 600;
  min-width: 30px;
  text-align: center;
}

.sb-card__actions {
  display: flex;
  gap: 4px;
}

.sb-card__btn {
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

.sb-card__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sb-card__btn--danger:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}
</style>
