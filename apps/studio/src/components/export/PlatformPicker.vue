<script setup lang="ts">
/**
 * PlatformPicker.vue — 12 平台选择器
 * L2 林染 任务 2
 */
import { computed } from 'vue'
import { PLATFORMS, type PlatformId } from '../../types/studio'

const props = defineProps<{
  modelValue: PlatformId[]
  /** 按地区过滤 */
  regionFilter?: 'all' | 'cn' | 'global'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: PlatformId[]): void
}>()

const filtered = computed(() => {
  if (!props.regionFilter || props.regionFilter === 'all') return PLATFORMS
  return PLATFORMS.filter(p => p.region === props.regionFilter || p.region === 'both')
})

const regionStats = computed(() => ({
  cn: PLATFORMS.filter(p => p.region === 'cn').length,
  global: PLATFORMS.filter(p => p.region === 'global').length,
  both: PLATFORMS.filter(p => p.region === 'both').length,
}))

function toggle(id: PlatformId) {
  const set = new Set(props.modelValue)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  emit('update:modelValue', [...set])
}

function selectAll() {
  emit('update:modelValue', filtered.value.map(p => p.id))
}

function clearAll() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="platform-picker flex flex-col gap-2">
    <div class="flex items-center justify-between text-[11px]">
      <div class="flex items-center gap-2 text-gray-500">
        <span>已选 <strong class="font-mono text-amber-600">{{ modelValue.length }}</strong> / {{ filtered.length }}</span>
        <span class="text-gray-300">|</span>
        <span>国内 {{ regionStats.cn }} · 海外 {{ regionStats.global }} · 通吃 {{ regionStats.both }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
          @click="selectAll"
        >全选</button>
        <button
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
          @click="clearAll"
        >清空</button>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <button
        v-for="p in filtered"
        :key="p.id"
        type="button"
        class="flex items-center gap-2 rounded-lg border p-2 text-left transition-all hover:shadow-md"
        :class="modelValue.includes(p.id)
          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 dark:bg-amber-900/30'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'"
        @click="toggle(p.id)"
      >
        <span
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-lg"
          :style="{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }"
        >{{ p.icon }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <span class="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{{ p.label }}</span>
            <span v-if="modelValue.includes(p.id)" class="text-amber-500">✓</span>
          </div>
          <div class="flex items-center gap-1 text-[10px] text-gray-400">
            <span class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">{{ p.aspect }}</span>
            <span>·</span>
            <span>{{ Math.round(p.maxDuration / 60) }}min</span>
            <span
              v-if="p.region === 'cn'"
              class="rounded bg-red-100 px-1 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >国内</span>
            <span
              v-else-if="p.region === 'global'"
              class="rounded bg-blue-100 px-1 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            >海外</span>
            <span
              v-else
              class="rounded bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            >通吃</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.platform-picker {
  width: 100%;
}
</style>
