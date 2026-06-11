<template>
  <div class="progress-bar" role="progressbar" :aria-valuenow="clamped" aria-valuemin="0" aria-valuemax="100">
    <div v-if="label" class="flex justify-between text-xs text-gray-600 mb-1">
      <span>{{ label }}</span>
      <span>{{ clamped }}%</span>
    </div>
    <div :class="['w-full rounded overflow-hidden', heightClass, trackClass]">
      <div
        class="h-full transition-all duration-300 ease-out"
        :class="barClass"
        :style="{ width: `${clamped}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: number
  label?: string
  /** 'primary' | 'success' | 'warning' | 'danger' */
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  label: ''
})

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.value))))

const heightClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-1'
    case 'lg':
      return 'h-3'
    default:
      return 'h-2'
  }
})

const trackClass = computed(() => 'bg-gray-200')

const barClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'danger':
      return 'bg-red-500'
    default:
      return 'bg-blue-500'
  }
})
</script>
