<template>
  <component :is="tag" v-if="!err" class="error-boundary-wrapper">
    <slot />
  </component>
  <div v-else class="error-boundary-fallback" role="alert" :class="containerClass">
    <div class="flex flex-col items-center justify-center p-6 text-center">
      <div class="text-4xl mb-2">{{ icon }}</div>
      <h3 v-if="title" class="text-lg font-semibold mb-1">{{ title }}</h3>
      <p class="text-sm text-gray-600 mb-4">{{ err.message }}</p>
      <p v-if="showCode && err.code" class="text-xs text-gray-400 mb-3">错误码: {{ err.code }}</p>
      <div class="flex gap-2">
        <button
          v-if="showReset"
          type="button"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          @click="reset"
        >
          重试
        </button>
        <button
          v-if="showDetails"
          type="button"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          @click="toggleDetails"
        >
          {{ detailsOpen ? '收起' : '详情' }}
        </button>
      </div>
      <pre
        v-if="detailsOpen && err.stack"
        class="mt-4 text-left text-xs bg-gray-50 p-3 rounded overflow-auto max-w-full max-h-64"
      >{{ err.stack }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { fromUnknown, type AppError } from '../errors'

interface Props {
  /** 自定义容器标签 */
  tag?: string
  /** 自定义标题 */
  title?: string
  /** 显示错误码 */
  showCode?: boolean
  /** 显示重试按钮 */
  showReset?: boolean
  /** 显示详情按钮 */
  showDetails?: boolean
  /** 自定义容器 class */
  containerClass?: string
  /** 自定义图标 */
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  tag: 'div',
  title: '出错了',
  showCode: true,
  showReset: true,
  showDetails: false,
  containerClass: '',
  icon: '⚠️'
})

const err = ref<AppError | null>(null)
const detailsOpen = ref(false)

onErrorCaptured((e: unknown) => {
  err.value = fromUnknown(e)
  return false
})

function reset() {
  err.value = null
  detailsOpen.value = false
}

function toggleDetails() {
  detailsOpen.value = !detailsOpen.value
}

defineExpose({ reset, err })
</script>
