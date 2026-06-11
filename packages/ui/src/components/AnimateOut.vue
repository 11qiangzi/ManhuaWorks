<script setup lang="ts">
/**
 * AnimateOut - 通用出场动画包装
 * 用法: <AnimateOut :show="isVisible" animation="fade-out"><p>...</p></AnimateOut>
 */
import { ref, watch, nextTick } from 'vue'

interface Props {
  show: boolean
  animation?: string
  tag?: string
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  animation: 'fade-out',
  tag: 'div',
  duration: undefined
})

const shouldRender = ref(props.show)
const elRef = ref<HTMLElement | null>(null)
const animating = ref(false)

watch(() => props.show, async (v) => {
  if (v) {
    shouldRender.value = true
    animating.value = false
    await nextTick()
  } else {
    animating.value = true
    await nextTick()
    // 等待动画结束
    const dur = props.duration ?? 280
    setTimeout(() => {
      if (!props.show) {
        shouldRender.value = false
        animating.value = false
      }
    }, dur + 50)
  }
}, { immediate: true })
</script>

<template>
  <component
    v-if="shouldRender"
    :is="tag"
    ref="elRef"
    :class="[`anim-${animating ? animation : 'fade-in-fast'}`]"
  >
    <slot />
  </component>
</template>
