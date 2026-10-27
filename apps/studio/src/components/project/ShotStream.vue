<script setup lang="ts">
/**
 * ShotStream.vue — 镜头卡片流
 * L2 林染 任务 2：
 *   - 网格/列表两种布局
 *   - 拖拽重排（HTML5 native drag&drop）
 *   - 选中态、单选/多选
 */
import { ref, computed } from 'vue'
import type { Shot } from '../../types/studio'
import ShotCard from './ShotCard.vue'

type Layout = 'grid' | 'list'

const props = defineProps<{
  shots: Shot[]
  selectedIds: string[]
  /** 默认布局 */
  defaultLayout?: Layout
}>()

const emit = defineEmits<{
  (e: 'select', shotId: string, additive: boolean): void
  (e: 'edit', shotId: string): void
  (e: 'delete', shotId: string): void
  (e: 'duplicate', shotId: string): void
  (e: 'lock', shotId: string): void
  (e: 'reorder', fromId: string, toId: string): void
}>()

const layout = ref<Layout>(props.defaultLayout ?? 'grid')
const dragOverId = ref<string | null>(null)
const draggingId = ref<string | null>(null)

const sorted = computed(() => [...props.shots].sort((a, b) => a.index - b.index))

function onCardSelect(shotId: string, additive: boolean) {
  emit('select', shotId, additive)
}

function onDragStart(shotId: string, e: PointerEvent) {
  draggingId.value = shotId
  // 仅在 pointer 拖拽时启动（HTML5 dragstart 留给 native dnd）
  if (e.button !== 0) return
}

function onDragEnter(shotId: string, e: DragEvent) {
  e.preventDefault()
  dragOverId.value = shotId
}

function onDragOver(shotId: string, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(shotId: string, e: DragEvent) {
  e.preventDefault()
  if (!draggingId.value || draggingId.value === shotId) {
    dragOverId.value = null
    draggingId.value = null
    return
  }
  emit('reorder', draggingId.value, shotId)
  dragOverId.value = null
  draggingId.value = null
}

function onSelectAll() {
  emit('select', sorted.value[0]?.id ?? '', false)
}
</script>

<template>
  <div class="shot-stream flex h-full flex-col">
    <!-- 工具条 -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
        <span class="font-semibold">镜头流</span>
        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">
          {{ shots.length }} 个
        </span>
        <span v-if="selectedIds.length > 0" class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          已选 {{ selectedIds.length }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="rounded p-1 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="layout === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : ''"
          @click="layout = 'grid'"
          title="网格"
        >▦</button>
        <button
          class="rounded p-1 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="layout === 'list' ? 'bg-gray-100 dark:bg-gray-800' : ''"
          @click="layout = 'list'"
          title="列表"
        >☰</button>
      </div>
    </div>

    <!-- 卡片流 -->
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="sorted.length === 0" class="flex h-32 items-center justify-center text-[12px] text-gray-400">
        暂无镜头，点击右上角 ➕ 新建第一个镜头
      </div>
      <div
        v-else
        class="grid gap-3"
        :class="layout === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1'"
        @dragover.prevent
      >
        <div
          v-for="shot in sorted"
          :key="shot.id"
          draggable="true"
          class="relative"
          :class="dragOverId === shot.id ? 'ring-2 ring-amber-400' : ''"
          @dragenter="(e) => onDragEnter(shot.id, e)"
          @dragover="(e) => onDragOver(shot.id, e)"
          @drop="(e) => onDrop(shot.id, e)"
        >
          <ShotCard
            :shot="shot"
            :selected="selectedIds.includes(shot.id)"
            :dragging="draggingId === shot.id"
            @select="onCardSelect"
            @edit="(id) => emit('edit', id)"
            @delete="(id) => emit('delete', id)"
            @duplicate="(id) => emit('duplicate', id)"
            @lock="(id) => emit('lock', id)"
            @drag-start="onDragStart"
            @drag-over="onDragOver"
            @drop="onDrop"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shot-stream {
  background: var(--bg-primary, #f9fafb);
  min-height: 0;
}
</style>
