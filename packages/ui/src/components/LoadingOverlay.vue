<template>
  <Teleport to="body">
    <Transition name="loading-overlay-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-30 bg-white/70 backdrop-blur-sm flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div class="flex flex-col items-center gap-2">
          <div class="loading-spinner w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p v-if="message" class="text-sm text-gray-700">{{ message }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  message?: string
}
withDefaults(defineProps<Props>(), { message: '' })
</script>

<style scoped>
.loading-overlay-fade-enter-active,
.loading-overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}
.loading-overlay-fade-enter-from,
.loading-overlay-fade-leave-to {
  opacity: 0;
}
</style>
