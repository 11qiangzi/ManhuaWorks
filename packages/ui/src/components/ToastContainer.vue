<template>
  <Teleport to="body">
    <div class="toast-container-fixed pointer-events-none">
      <template v-for="position in positions" :key="position">
        <div
          v-if="grouped[position].length > 0"
          :class="['toast-stack', positionClass(position)]"
          role="region"
          :aria-label="`通知-${position}`"
        >
          <TransitionGroup :name="transitionName(position)" tag="div" class="toast-list">
            <ToastItem
              v-for="t in grouped[position]"
              :key="t.id"
              :toast="t"
              @close="onClose(t.id)"
            />
          </TransitionGroup>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useToastStore, type ToastPosition } from '../stores/toast'
import ToastItem from './ToastItem.vue'

const store = useToastStore()

const positions: ToastPosition[] = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
  'top-center',
  'bottom-center'
]

const grouped = computed(() => store.byPosition)

function positionClass(pos: ToastPosition): string {
  const base = 'fixed z-50 p-4 flex flex-col gap-2 pointer-events-auto'
  switch (pos) {
    case 'top-right':
      return `${base} top-0 right-0`
    case 'top-left':
      return `${base} top-0 left-0`
    case 'top-center':
      return `${base} top-0 left-1/2 -translate-x-1/2`
    case 'bottom-right':
      return `${base} bottom-0 right-0 flex-col-reverse`
    case 'bottom-left':
      return `${base} bottom-0 left-0 flex-col-reverse`
    case 'bottom-center':
      return `${base} bottom-0 left-1/2 -translate-x-1/2 flex-col-reverse`
  }
}

function transitionName(pos: ToastPosition): string {
  if (pos.startsWith('top')) return 'toast-slide-down'
  return 'toast-slide-up'
}

function onClose(id: string) {
  store.remove(id)
}
</script>

<style scoped>
.toast-container-fixed {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.toast-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 通用过渡 */
.toast-slide-down-enter-active,
.toast-slide-down-leave-active,
.toast-slide-up-enter-active,
.toast-slide-up-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.toast-slide-down-enter-from,
.toast-slide-up-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.toast-slide-down-leave-to,
.toast-slide-up-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
</style>
