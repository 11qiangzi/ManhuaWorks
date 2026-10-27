<script setup lang="ts">
/**
 * DragDropList - 拖拽排序列表
 * ManhuaWorks studio component
 *
 * 简单的拖拽排序列表组件（上下移动）
 */

export interface DragItem {
  id: string
  title: string
  subtitle?: string
  data?: Record<string, unknown>
}

interface Props {
  items: DragItem[]
  showOrder?: boolean
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  showOrder: false,
  emptyText: '暂无数据'
})

const emit = defineEmits<{
  reorder: [fromIndex: number, toIndex: number, newList: DragItem[]]
  select: [id: string]
  remove: [id: string]
}>()

/** 拖拽状态 */
const dragIdx = defineModel<number | null>({ default: null })

function onDragStart(idx: number) {
  dragIdx.value = idx
}

function onDragOver(e: DragEvent, idx: number) {
  e.preventDefault()
}

function onDrop(fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx) {
    dragIdx.value = null
    return
  }
  const newList = [...props.items]
  const [moved] = newList.splice(fromIdx, 1)
  if (moved) {
    newList.splice(toIdx, 0, moved)
  }
  emit('reorder', fromIdx, toIdx, newList)
  dragIdx.value = null
}

function onDragEnd() {
  dragIdx.value = null
}

function onMoveUp(idx: number) {
  if (idx <= 0) return
  onDrop(idx, idx - 1)
}

function onMoveDown(idx: number) {
  if (idx >= props.items.length - 1) return
  onDrop(idx, idx + 1)
}
</script>

<template>
  <div class="ddl">
    <div v-if="props.items.length === 0" class="ddl__empty">
      {{ props.emptyText }}
    </div>

    <TransitionGroup v-else name="ddl-list" tag="ul" class="ddl__list">
      <li
        v-for="(item, idx) in props.items"
        :key="item.id"
        class="ddl__item"
        :class="{ 'ddl__item--dragging': dragIdx === idx }"
        draggable="true"
        @dragstart="onDragStart(idx)"
        @dragover="onDragOver($event, idx)"
        @drop="onDrop(dragIdx ?? idx, idx)"
        @dragend="onDragEnd"
        @click="emit('select', item.id)"
      >
        <!-- 拖拽把手 -->
        <span class="ddl__handle" title="拖拽排序">&#9776;</span>

        <!-- 序号 -->
        <span v-if="props.showOrder" class="ddl__order">{{ idx + 1 }}</span>

        <!-- 内容 -->
        <div class="ddl__content">
          <strong class="ddl__title">{{ item.title }}</strong>
          <span v-if="item.subtitle" class="ddl__subtitle">{{ item.subtitle }}</span>
        </div>

        <!-- 上下移动按钮 -->
        <div class="ddl__arrows">
          <button
            type="button"
            class="ddl__arrow"
            :disabled="idx === 0"
            @click.stop="onMoveUp(idx)"
            title="上移"
          >&uarr;</button>
          <button
            type="button"
            class="ddl__arrow"
            :disabled="idx === props.items.length - 1"
            @click.stop="onMoveDown(idx)"
            title="下移"
          >&darr;</button>
        </div>

        <!-- 删除 -->
        <button
          type="button"
          class="ddl__remove"
          @click.stop="emit('remove', item.id)"
          title="删除"
        >&times;</button>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ddl__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ddl__empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.ddl__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: grab;
  transition: all 200ms;
}

.ddl__item:hover {
  border-color: var(--accent);
}

.ddl__item--dragging {
  opacity: 0.5;
  cursor: grabbing;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-primary));
}

.ddl__handle {
  color: var(--text-secondary);
  font-size: 14px;
  cursor: grab;
  flex-shrink: 0;
  opacity: 0.5;
}

.ddl__item:hover .ddl__handle {
  opacity: 1;
}

.ddl__order {
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  color: var(--accent);
  min-width: 18px;
  text-align: center;
}

.ddl__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ddl__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ddl__subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ddl__arrows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.ddl__arrow {
  width: 20px;
  height: 16px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.ddl__arrow:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.ddl__arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ddl__remove {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 150ms;
  font-family: inherit;
  padding: 0;
}

.ddl__remove:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

/* Transition animations */
.ddl-list-move {
  transition: transform 200ms ease;
}

.ddl-list-enter-active,
.ddl-list-leave-active {
  transition: all 200ms ease;
}

.ddl-list-enter-from,
.ddl-list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
