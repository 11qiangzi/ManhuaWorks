<template>
  <Teleport to="body">
    <Transition name="loading-modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      >
        <div class="bg-white rounded-lg shadow-xl p-6 min-w-[280px] flex flex-col items-center">
          <div class="loading-spinner w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p v-if="message" class="mt-3 text-sm text-gray-700">{{ message }}</p>
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
.loading-modal-fade-enter-active,
.loading-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.loading-modal-fade-enter-from,
.loading-modal-fade-leave-to {
  opacity: 0;
}
</style>
