<template>
  <form class="loading-form space-y-4" :aria-busy="loading" @submit.prevent="onSubmit">
    <fieldset :disabled="loading" class="space-y-4">
      <slot />
    </fieldset>
    <div v-if="loading" class="absolute inset-0 bg-white/50 flex items-center justify-center pointer-events-none">
      <div class="flex items-center gap-2 text-sm text-gray-700">
        <div class="loading-spinner w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span>{{ message }}</span>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
  message?: string
}
const props = withDefaults(defineProps<Props>(), { loading: false, message: '提交中…' })
const emit = defineEmits<{ (e: 'submit'): void }>()

function onSubmit() {
  if (props.loading) return
  emit('submit')
}
</script>
