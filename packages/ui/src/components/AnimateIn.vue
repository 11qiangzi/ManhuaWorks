<script setup lang="ts">
/**
 * AnimateIn - 通用入场动画包装
 * 用法: <AnimateIn animation="fade-in-up" :delay="100"><h1>...</h1></AnimateIn>
 */
import { computed, onMounted, ref, watch } from 'vue'

interface Props {
  animation?: string         // entrance name, e.g. "fade-in-up"
  delay?: number              // ms
  duration?: number           // ms (optional override)
  tag?: string
  trigger?: 'mount' | 'visible' | 'hover'
  once?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  animation: 'fade-in',
  delay: 0,
  duration: undefined,
  tag: 'div',
  trigger: 'mount',
  once: true
})

const elRef = ref<HTMLElement | null>(null)
const visible = ref(props.trigger === 'mount')
const played = ref(false)

function play() {
  if (played.value && props.once) return
  played.value = true
  visible.value = true
}

onMounted(() => {
  if (props.trigger === 'mount') {
    play()
  } else if (props.trigger === 'visible' && elRef.value) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          play()
          if (props.once) io.disconnect()
        } else if (!props.once) {
          visible.value = false
        }
      }
    }, { threshold: 0.1 })
    io.observe(elRef.value)
  }
})

const styleObj = computed(() => {
  const s: Record<string, string> = {
    animationDelay: `${props.delay}ms`,
    animationFillMode: 'both'
  }
  if (props.duration !== undefined) {
    s.animationDuration = `${props.duration}ms`
  }
  return s
})

const cls = computed(() => `anim-${props.animation}`)
</script>

<template>
  <component
    :is="tag"
    ref="elRef"
    :class="[cls, { 'anim-paused': !visible && trigger !== 'mount' }]"
    :style="styleObj"
    @mouseenter="trigger === 'hover' && play()"
  >
    <slot />
  </component>
</template>

<style scoped>
.anim-paused { animation-play-state: paused; }
</style>
