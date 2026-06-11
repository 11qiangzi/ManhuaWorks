<script setup lang="ts">
/**
 * DragDropList · 拖拽列表
 * ManhuaWorks · W3 工坊流程精修
 *
 * 通用 HTML5 拖拽排序组件，用于：
 * 1. 分镜排序（StoryboardEditor）
 * 2. 镜头重排
 * 3. 任意 list 排序
 *
 * 特性：
 * - 原生 HTML5 拖拽（无第三方依赖）
 * - 键盘可达（上下箭头移动）
 * - 拖拽手柄 + 视觉反馈
 * - 5 主题适配
 */
import { ref, computed } from 'vue'

export interface DragItem {
  id: string
  /** 列表中显示的标题 */
  title: string
  /** 副标题（可选） */
  subtitle?: string
  /** 拖拽前禁用 */
  dragDisabled?: boolean
  /** 任意附加数据 */
  data?: Record<string, unknown>
}

const props = withDefaults(defineProps<{
  items: DragItem[]
  selectedId?: string | null
  /** 拖拽手柄图标 */
  handleIcon?: string
  /** 是否显示序号 */
  showOrder?: boolean
  /** 列表为空时的占位文本 */
  emptyText?: string
  /** 自定义槽位（slot="item" 替代默认渲染） */
}>(), {
  handleIcon: '⋮⋮',
  showOrder: true,
  emptyText: '暂无项目',
  selectedId: null
})

const emit = defineEmits<{
  (e: 'reorder', fromIndex: number, toIndex: number, newList: DragItem[]): void
  (e: 'select', id: string): void
  (e: 'remove', id: string): void
  (e: 'edit', id: string): void
}>()

// 拖拽状态
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const isDraggingAny = computed(() => draggedIndex.value !== null)

function onDragStart(e: DragEvent, index: number) {
  if (props.items[index]?.dragDisabled) {
    e.preventDefault()
    return
  }
  draggedIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', props.items[index]?.id ?? '')
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (draggedIndex.value !== null) {
    dragOverIndex.value = index
  }
}

function onDragLeave(_e: DragEvent, _index: number) {
  // 不在这里清，避免快速穿过时闪烁
}

function onDrop(e: DragEvent, index: number) {
  e.preventDefault()
  if (draggedIndex.value === null) return
  const from = draggedIndex.value
  const to = index
  draggedIndex.value = null
  dragOverIndex.value = null
  if (from === to) return

  // 计算新列表
  const next = [...props.items]
  const [moved] = next.splice(from, 1)
  if (moved) {
    next.splice(to, 0, moved)
  }
  emit('reorder', from, to, next)
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

// 键盘排序（↑↓）
function onKeydown(e: KeyboardEvent, index: number) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  const dir = e.key === 'ArrowUp' ? -1 : 1
  const to = index + dir
  if (to < 0 || to >= props.items.length) return
  const next = [...props.items]
  const [moved] = next.splice(index, 1)
  if (moved) {
    next.splice(to, 0, moved)
  }
  emit('reorder', index, to, next)
}

function onClick(id: string) {
  emit('select', id)
}
function onRemove(id: string, e: Event) {
  e.stopPropagation()
  if (confirm('确认删除？')) emit('remove', id)
}
function onEdit(id: string, e: Event) {
  e.stopPropagation()
  emit('edit', id)
}
</script>

<template>
  <ol
    class="dd-list"
    :class="{ 'dd-list--dragging': isDraggingAny }"
    role="list"
  >
    <li
      v-if="items.length === 0"
      class="dd-list__empty"
    >
      <span class="dd-list__empty-icon">📋</span>
      <p>{{ emptyText }}</p>
    </li>

    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="dd-item"
      :class="{
        'dd-item--dragging': draggedIndex === index,
        'dd-item--over-top': dragOverIndex === index && draggedIndex !== null && draggedIndex > index,
        'dd-item--over-bottom': dragOverIndex === index && draggedIndex !== null && draggedIndex < index,
        'dd-item--selected': selectedId === item.id,
        'dd-item--disabled': item.dragDisabled
      }"
      :draggable="!item.dragDisabled"
      :tabindex="0"
      @dragstart="onDragStart($event, index)"
      @dragover="onDragOver($event, index)"
      @dragleave="onDragLeave($event, index)"
      @drop="onDrop($event, index)"
      @dragend="onDragEnd"
      @keydown="onKeydown($event, index)"
      @click="onClick(item.id)"
    >
      <!-- 拖拽手柄 -->
      <span
        class="dd-item__handle"
        :class="{ 'dd-item__handle--disabled': item.dragDisabled }"
        :title="item.dragDisabled ? '该条目不可拖拽' : '拖动排序（也可点击 ↑↓ 键）'"
        aria-hidden="true"
      >{{ handleIcon }}</span>

      <!-- 序号 -->
      <span v-if="showOrder" class="dd-item__order">{{ index + 1 }}</span>

      <!-- 主体 -->
      <div class="dd-item__body">
        <slot name="item" :item="item" :index="index">
          <div class="dd-item__default">
            <strong class="dd-item__title">{{ item.title }}</strong>
            <span v-if="item.subtitle" class="dd-item__subtitle">{{ item.subtitle }}</span>
          </div>
        </slot>
      </div>

      <!-- 操作 -->
      <div class="dd-item__actions" @click.stop>
        <button type="button" class="dd-item__btn" title="编辑" @click="onEdit(item.id, $event)">✏️</button>
        <button type="button" class="dd-item__btn dd-item__btn--danger" title="删除" @click="onRemove(item.id, $event)">🗑️</button>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.dd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dd-list--dragging {
  cursor: grabbing;
}

/* ===== 空 ===== */
.dd-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px 20px;
  color: var(--text-secondary);
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
}

.dd-list__empty-icon {
  font-size: 36px;
  opacity: 0.5;
}

.dd-list__empty p {
  margin: 0;
  font-size: 13px;
}

/* ===== 单条 ===== */
.dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: all 200ms;
  position: relative;
}

.dd-item:hover {
  border-color: var(--accent);
}

.dd-item:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.dd-item--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-secondary));
}

.dd-item--dragging {
  opacity: 0.5;
  transform: scale(0.98);
  cursor: grabbing;
}

.dd-item--over-top::before,
.dd-item--over-bottom::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  box-shadow: 0 0 4px var(--accent);
}

.dd-item--over-top::before { top: -4px; }
.dd-item--over-bottom::after { bottom: -4px; }

.dd-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 手柄 ===== */
.dd-item__handle {
  font-size: 14px;
  color: var(--text-secondary);
  cursor: grab;
  padding: 0 4px;
  user-select: none;
  flex-shrink: 0;
  line-height: 1;
}

.dd-item__handle:hover { color: var(--accent); }
.dd-item__handle--disabled { cursor: not-allowed; }

.dd-item:active .dd-item__handle { cursor: grabbing; }

/* ===== 序号 ===== */
.dd-item__order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

/* ===== 主体 ===== */
.dd-item__body {
  flex: 1;
  min-width: 0;
}

.dd-item__default {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dd-item__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dd-item__subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 操作 ===== */
.dd-item__actions {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 200ms;
  flex-shrink: 0;
}

.dd-item:hover .dd-item__actions,
.dd-item--selected .dd-item__actions {
  opacity: 1;
}

.dd-item__btn {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 150ms;
}

.dd-item__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.dd-item__btn--danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
