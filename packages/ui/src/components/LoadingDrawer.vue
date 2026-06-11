<template>
  <Teleport to="body">
    <Transition :name="`drawer-${position}-slide`">
      <div
        v-if="visible"
        :class="['fixed bg-white shadow-2xl z-40 p-4', positionClass, sizeClass]"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-center gap-2 text-sm text-gray-600">
          <div class="loading-spinner w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <span v-if="message">{{ message }}</span>
          <span v-else>加载中…</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  visible: boolean
  message?: string
  position?: 'left' | 'right' | 'top' | 'bottom'
  size?: 'sm' | 'md' | 'lg'
}
const props = withDefaults(defineProps<Props>(), {
  message: '',
  position: 'right',
  size: 'md'
})

const positionClass = computed(() => {
  switch (props.position) {
    case 'left':
      return 'left-0 top-0 bottom-0'
    case 'right':
      return 'right-0 top-0 bottom-0'
    case 'top':
      return 'top-0 left-0 right-0'
    case 'bottom':
      return 'bottom-0 left-0 right-0'
  }
  return 'right-0 top-0 bottom-0'
})

const sizeClass = computed(() => {
  if (props.position === 'left' || props.position === 'right') {
    return props.size === 'sm' ? 'w-64' : props.size === 'lg' ? 'w-96' : 'w-80'
  }
  return props.size === 'sm' ? 'h-32' : props.size === 'lg' ? 'h-96' : 'h-64'
})
</script>

<style scoped>
.drawer-left-slide-enter-active,
.drawer-left-slide-leave-active,
.drawer-right-slide-enter-active,
.drawer-right-slide-leave-active,
.drawer-top-slide-enter-active,
.drawer-top-slide-leave-active,
.drawer-bottom-slide-enter-active,
.drawer-bottom-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.drawer-left-slide-enter-from,
.drawer-left-slide-leave-to {
  transform: translateX(-100%);
}
.drawer-right-slide-enter-from,
.drawer-right-slide-leave-to {
  transform: translateX(100%);
}
.drawer-top-slide-enter-from,
.drawer-top-slide-leave-to {
  transform: translateY(-100%);
}
.drawer-bottom-slide-enter-from,
.drawer-bottom-slide-leave-to {
  transform: translateY(100%);
}
</style>
