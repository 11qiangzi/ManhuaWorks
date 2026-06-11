<template>
  <div class="loading-table w-full" role="status" aria-live="polite">
    <table class="w-full">
      <thead v-if="!compact">
        <tr class="border-b border-gray-200">
          <th v-for="i in columns" :key="`h${i}`" class="px-4 py-2">
            <div class="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="`r${r}`" class="border-b border-gray-100">
          <td v-for="c in columns" :key="`r${r}c${c}`" class="px-4 py-3">
            <div class="h-3 bg-gray-200 rounded animate-pulse" :class="`w-${widthClass(c)}`"></div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="message" class="text-center text-xs text-gray-500 mt-2">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  rows?: number
  columns?: number
  message?: string
  /** 紧凑模式（无表头） */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  columns: 4,
  message: '',
  compact: false
})

const rows = computed(() => Math.max(1, props.rows))
const columns = computed(() => Math.max(1, props.columns))

function widthClass(c: number): string {
  // 奇偶列宽度变化
  return c % 3 === 0 ? 'full' : c % 2 === 0 ? '2/3' : '1/2'
}
</script>
