<template>
  <button
    :type="type"
    :disabled="loading || disabled"
    :class="[
      'loading-button inline-flex items-center justify-center gap-2 px-4 py-2 rounded transition',
      'disabled:opacity-60 disabled:cursor-not-allowed',
      variantClass
    ]"
    @click="onClick"
  >
    <span
      v-if="loading"
      class="loading-spinner w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
    ></span>
    <span v-if="loading && loadingText">{{ loadingText }}</span>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  type: 'button',
  variant: 'primary',
  loadingText: ''
})

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

const variantClass = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    case 'ghost':
      return 'bg-transparent text-gray-700 hover:bg-gray-100'
    case 'danger':
      return 'bg-red-500 text-white hover:bg-red-600'
    default:
      return 'bg-blue-500 text-white hover:bg-blue-600'
  }
})

function onClick(ev: MouseEvent) {
  if (props.loading || props.disabled) return
  emit('click', ev)
}
</script>
