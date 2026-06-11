<template>
  <Transition name="field-error-fade">
    <p
      v-if="message"
      :id="fieldId ? `${fieldId}-error` : undefined"
      class="form-field-error text-xs text-red-600 mt-1 flex items-center gap-1"
      role="alert"
    >
      <span class="leading-none">⚠</span>
      <span class="flex-1 break-words">{{ message }}</span>
    </p>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  message?: string | null | undefined
  fieldId?: string
}

withDefaults(defineProps<Props>(), {
  message: '',
  fieldId: ''
})
</script>

<style scoped>
.field-error-fade-enter-active,
.field-error-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.field-error-fade-enter-from,
.field-error-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
