<template>
  <div class="indeterminate-progress w-full h-1 bg-gray-200 overflow-hidden relative" role="progressbar" aria-busy="true">
    <div class="indeterminate-bar absolute h-full w-1/3 bg-blue-500" :class="animatedClass"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 'primary' | 'success' | 'warning' | 'danger' */
  variant?: 'primary' | 'success' | 'warning' | 'danger'
}
const props = withDefaults(defineProps<Props>(), { variant: 'primary' })

const animatedClass = computed(() => {
  const color =
    props.variant === 'success'
      ? 'bg-green-500'
      : props.variant === 'warning'
        ? 'bg-yellow-500'
        : props.variant === 'danger'
          ? 'bg-red-500'
          : 'bg-blue-500'
  return color
})
</script>

<style scoped>
.indeterminate-bar {
  animation: indeterminate-slide 1.4s ease-in-out infinite;
}
@keyframes indeterminate-slide {
  0% {
    left: -33%;
  }
  100% {
    left: 100%;
  }
}
</style>
