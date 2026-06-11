<script setup lang="ts">
/**
 * ToolCard.vue — 工具卡片
 * L2 林聚 任务 2
 */
import { computed } from 'vue'
import type { StudioTool } from '../../types/studio'
import { TOOL_CATEGORY_LABELS } from '../../types/studio'

const props = defineProps<{
  tool: StudioTool
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', id: string): void
  (e: 'configure', id: string): void
  (e: 'toggle', id: string): void
}>()

const categoryLabel = computed(() => TOOL_CATEGORY_LABELS[props.tool.category])

function onClick() {
  emit('click', props.tool.id)
}
function onConfigure(e: MouseEvent) {
  e.stopPropagation()
  emit('configure', props.tool.id)
}
function onToggle(e: MouseEvent) {
  e.stopPropagation()
  emit('toggle', props.tool.id)
}
</script>

<template>
  <div
    class="tool-card group relative flex flex-col overflow-hidden rounded-lg border bg-white transition-all hover:shadow-md dark:bg-gray-900"
    :class="[
      selected
        ? 'border-amber-500 ring-2 ring-amber-400/40'
        : 'border-gray-200 dark:border-gray-700',
      !tool.enabled ? 'opacity-50' : '',
    ]"
    :data-tool-id="tool.id"
    :data-tool-category="tool.category"
  >
    <!-- 顶部 -->
    <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] dark:border-gray-800 dark:bg-gray-800/60">
      <div class="flex items-center gap-1.5">
        <span
          class="flex h-7 w-7 items-center justify-center rounded text-lg"
          :style="{ background: `color-mix(in srgb, currentColor 10%, transparent)` }"
        >{{ tool.icon }}</span>
        <div class="flex flex-col">
          <span class="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{{ tool.name }}</span>
          <span class="text-[10px] text-gray-400">{{ categoryLabel }} · {{ tool.costUsdPerCall.toFixed(3) }} USD/次</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-0.5">
        <span
          v-if="tool.recommended"
          class="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white"
        >推荐</span>
        <button
          class="rounded p-0.5 text-[10px] hover:bg-gray-200 dark:hover:bg-gray-700"
          :title="tool.enabled ? '点击禁用' : '点击启用'"
          @click="onToggle"
        >{{ tool.enabled ? '🟢' : '⚪' }}</button>
      </div>
    </div>

    <!-- 描述 -->
    <div
      class="flex flex-1 cursor-pointer flex-col gap-2 p-2"
      @click="onClick"
    >
      <p class="line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
        {{ tool.description }}
      </p>

      <!-- 变量 -->
      <div class="flex items-center gap-1 text-[10px] text-gray-400">
        <span>变量：</span>
        <span
          v-for="v in tool.promptVars.slice(0, 4)"
          :key="v.name"
          class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800"
        >{{ v.name }}</span>
        <span
          v-if="tool.promptVars.length > 4"
          class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800"
        >+{{ tool.promptVars.length - 4 }}</span>
      </div>

      <!-- 能力 -->
      <div class="mt-auto flex items-center gap-1 text-[10px]">
        <span
          v-if="tool.batchable"
          class="rounded bg-blue-100 px-1 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >⚡ 批量</span>
        <span
          v-if="tool.promptVars.length > 0"
          class="rounded bg-gray-100 px-1 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >{{ tool.promptVars.length }} 参数</span>
        <span
          class="rounded bg-gray-100 px-1 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >{{ tool.costUsdPerCall.toFixed(3) }} USD</span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-800/60">
      <span class="text-[10px] text-gray-400">{{ tool.id }}</span>
      <button
        class="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
        @click="onConfigure"
      >⚙ 配置</button>
    </div>
  </div>
</template>

<style scoped>
.tool-card {
  user-select: none;
  font-size: 12px;
  min-height: 160px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
