<script setup lang="ts">
/**
 * ShotCard.vue — 镜头卡片
 * L2 林染 任务 2：项目编辑器核心单元
 *
 * 显示：序号 / 缩略图 / 标题 / 描述 / 角色/场景标签 / 镜头语言 / 时长 / 状态
 * 交互：选中 / 拖拽 / 锁定 / 编辑
 */
import { computed } from 'vue'
import type { Shot } from '../../types/studio'
import {
  SHOT_TYPE_LABELS,
  CAMERA_ANGLE_LABELS,
  CAMERA_MOVE_LABELS,
  SHOT_STATUS_LABELS,
  SHOT_STATUS_COLORS,
} from '../../types/studio'
import { getArchetypeMeta } from '../../data/character-archetypes-v2'
import { getSceneTemplateMeta } from '../../data/scene-templates-v2'
import type { SceneTemplate } from '../../types/scene'

const props = defineProps<{
  shot: Shot
  selected?: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', shotId: string, additive: boolean): void
  (e: 'edit', shotId: string): void
  (e: 'delete', shotId: string): void
  (e: 'duplicate', shotId: string): void
  (e: 'lock', shotId: string): void
  (e: 'drag-start', shotId: string, event: PointerEvent): void
  (e: 'drag-over', shotId: string, event: DragEvent): void
  (e: 'drop', shotId: string, event: DragEvent): void
}>()

const statusColor = computed(() => SHOT_STATUS_COLORS[props.shot.status])
const statusLabel = computed(() => SHOT_STATUS_LABELS[props.shot.status])

const sceneMeta = computed(() => props.shot.sceneTemplate ? getSceneTemplateMeta(props.shot.sceneTemplate as SceneTemplate) : { icon: '🏞️', label: '未设定' })

const archetypeChips = computed(() =>
  props.shot.characterArchetypes.slice(0, 3).map(a => getArchetypeMeta(a as never)),
)

function onClick(e: MouseEvent) {
  emit('select', props.shot.id, e.shiftKey || e.ctrlKey || e.metaKey)
}

function onEdit(e: MouseEvent) {
  e.stopPropagation()
  emit('edit', props.shot.id)
}

function onDelete(e: MouseEvent) {
  e.stopPropagation()
  if (confirm(`删除镜头 ${props.shot.index} · ${props.shot.title}?`)) {
    emit('delete', props.shot.id)
  }
}

function onDuplicate(e: MouseEvent) {
  e.stopPropagation()
  emit('duplicate', props.shot.id)
}

function onLock(e: MouseEvent) {
  e.stopPropagation()
  emit('lock', props.shot.id)
}

function onDragStart(e: PointerEvent) {
  if (props.shot.locked) return
  emit('drag-start', props.shot.id, e)
}
</script>

<template>
  <div
    class="shot-card group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-900"
    :class="[
      selected ? 'border-amber-500 ring-2 ring-amber-400/40' : 'border-gray-200 dark:border-gray-700',
      dragging ? 'opacity-50' : '',
      shot.locked ? 'bg-amber-50/40 dark:bg-amber-900/10' : '',
    ]"
    :data-shot-id="shot.id"
    :data-shot-index="shot.index"
    @click="onClick"
    @dblclick="onEdit"
  >
    <!-- 顶部：序号 + 状态 + 锁定 -->
    <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] dark:border-gray-800 dark:bg-gray-800/60">
      <div class="flex items-center gap-1.5">
        <span
          class="flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] font-bold"
          :class="selected ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
        >{{ shot.index }}</span>
        <span
          class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          :class="{
            'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300': statusColor === 'gray',
            'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300': statusColor === 'blue',
            'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300': statusColor === 'amber',
            'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300': statusColor === 'cyan',
            'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300': statusColor === 'green',
            'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300': statusColor === 'red',
          }"
        >{{ statusLabel }}</span>
        <span v-if="shot.locked" class="text-amber-500" title="已锁定">🔒</span>
      </div>
      <div class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          class="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
          title="编辑"
          @click="onEdit"
        >✏️</button>
        <button
          class="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
          :title="shot.locked ? '解锁' : '锁定'"
          @click="onLock"
        >{{ shot.locked ? '🔓' : '🔒' }}</button>
        <button
          class="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
          title="复制"
          @click="onDuplicate"
        >📋</button>
        <button
          class="rounded p-0.5 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50"
          title="删除"
          @click="onDelete"
        >🗑</button>
      </div>
    </div>

    <!-- 缩略图 -->
    <div
      class="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800"
      :style="shot.locked ? 'cursor: not-allowed' : 'cursor: grab'"
      @pointerdown="onDragStart"
    >
      <img
        v-if="shot.imageUrl"
        :src="shot.imageUrl"
        :alt="`镜头 ${shot.index}`"
        class="h-full w-full object-cover"
        draggable="false"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-2xl text-gray-300 dark:text-gray-600"
      >
        🎬
      </div>
      <!-- 时长 -->
      <div class="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
        {{ shot.duration.toFixed(1) }}s
      </div>
      <!-- 场景模板角标 -->
      <div class="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
        <span>{{ sceneMeta.icon }}</span>
        <span>{{ sceneMeta.label }}</span>
      </div>
    </div>

    <!-- 内容 -->
    <div class="flex flex-1 flex-col gap-1.5 p-2">
      <h4 class="line-clamp-1 text-[12px] font-semibold text-gray-800 dark:text-gray-100">
        {{ shot.title }}
      </h4>
      <p class="line-clamp-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        {{ shot.description }}
      </p>

      <!-- 角色 archetype 标签 -->
      <div v-if="archetypeChips.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="a in archetypeChips"
          :key="a.id"
          class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium"
          :class="`bg-${a.color}-100 text-${a.color}-700 dark:bg-${a.color}-900/40 dark:text-${a.color}-300`"
        >
          <span>{{ a.icon }}</span>
          <span>{{ a.label }}</span>
        </span>
      </div>

      <!-- 镜头语言 -->
      <div class="mt-auto flex items-center gap-1.5 border-t border-gray-100 pt-1.5 text-[10px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ SHOT_TYPE_LABELS[shot.shotType ?? 'medium'] }}</span>
        <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ CAMERA_ANGLE_LABELS[shot.cameraAngle ?? 'eye-level'] }}</span>
        <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ CAMERA_MOVE_LABELS[shot.cameraMove ?? 'static'] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shot-card {
  user-select: none;
  font-size: 12px;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
