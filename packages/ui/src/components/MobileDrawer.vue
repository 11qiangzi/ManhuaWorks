<script setup lang="ts">
/**
 * MobileDrawer - 移动端抽屉 (侧滑)
 * - 4 方向: left/right/top/bottom
 * - 遮罩可关闭
 * - 锁滚动
 * - ESC 关闭
 */
import { computed, onMounted, onBeforeUnmount, watch, ref, nextTick } from 'vue'
import { useBreakpoint } from '../composables/useBreakpoint'
import { useSwipe } from '../composables/useSwipe'
import { usePrefersReducedMotion } from '../composables/useMediaQuery'

interface Props {
  modelValue: boolean
  side?: 'left' | 'right' | 'top' | 'bottom'
  size?: string                  // 宽度或高度
  closeOnMask?: boolean
  closeOnEsc?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  side: 'left',
  size: '80%',
  closeOnMask: true,
  closeOnEsc: true,
  title: ''
})

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'open': []
  'close': []
}>()

const bp = useBreakpoint()
const reduced = usePrefersReducedMotion()
const wrapRef = ref<HTMLElement | null>(null)

const sideClass = computed(() => `md-side-${props.side}`)
const sizeStyle = computed(() => {
  if (props.side === 'left' || props.side === 'right') {
    return { width: props.size, maxWidth: '480px' }
  }
  return { height: props.size, maxHeight: '70vh' }
})

const { handlers: swipeHandlers } = useSwipe({
  threshold: 60,
  velocity: 0.4,
  onSwipe: (e) => {
    if (!props.modelValue) return
    // 在对应方向滑动关闭
    if (props.side === 'left' && e.direction === 'left') close()
    if (props.side === 'right' && e.direction === 'right') close()
    if (props.side === 'top' && e.direction === 'up') close()
    if (props.side === 'bottom' && e.direction === 'down') close()
  }
})

function open() {
  emit('update:modelValue', true)
  emit('open')
}
function close() {
  emit('update:modelValue', false)
  emit('close')
}
function onMaskClick() {
  if (props.closeOnMask) close()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEsc && props.modelValue) close()
}

watch(() => props.modelValue, async (v) => {
  if (v) {
    if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'
  } else {
    if (typeof document !== 'undefined') document.body.style.overflow = ''
  }
  await nextTick()
})

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

// 桌面端不显示为抽屉，可强制弹窗样式
const isMobileView = computed(() => bp.isMobile.value || bp.isTablet.value)
</script>

<template>
  <Teleport to="body">
    <Transition :name="reduced ? 'page-fade' : `drawer-${side}`">
      <div
        v-if="modelValue"
        class="md-mask"
        :class="{ 'md-mask-mobile': isMobileView }"
        @click="onMaskClick"
      >
        <div
          ref="wrapRef"
          class="md-drawer"
          :class="[sideClass, { 'md-no-anim': reduced }]"
          :style="sizeStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          @click.stop
          v-on="isMobileView ? swipeHandlers : {}"
        >
          <header v-if="title || $slots.header" class="md-header">
            <slot name="header">
              <h3 class="md-title">{{ title }}</h3>
            </slot>
            <button class="md-close mi-focus-ring" aria-label="关闭" @click="close">×</button>
          </header>
          <div class="md-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="md-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.md-mask {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: var(--z-modal);
  display: flex;
}
.md-mask-mobile { align-items: stretch; }
.md-drawer {
  background: var(--bg-elevated);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-7);
  overflow: hidden;
}
.md-side-left, .md-side-right { height: 100vh; }
.md-side-top, .md-side-bottom { width: 100vw; }
.md-side-left { margin-right: auto; }
.md-side-right { margin-left: auto; }
.md-side-top { margin-bottom: auto; }
.md-side-bottom { margin-top: auto; }
.md-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.md-title { font-size: var(--text-md); font-weight: 600; }
.md-close {
  background: none; border: none; cursor: pointer; color: var(--text-secondary);
  font-size: 24px; line-height: 1; padding: var(--space-1) var(--space-2); border-radius: var(--radius-2);
}
.md-body { flex: 1; padding: var(--space-4); overflow-y: auto; }
.md-footer { padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border-subtle); }
.md-no-anim { animation: none !important; transition: none !important; }

/* Transitions */
.drawer-left-enter-active .md-drawer, .drawer-left-leave-active .md-drawer { transition: transform var(--dur-base) var(--ease-out); }
.drawer-left-enter-from .md-drawer, .drawer-left-leave-to .md-drawer { transform: translateX(-100%); }
.drawer-right-enter-active .md-drawer, .drawer-right-leave-active .md-drawer { transition: transform var(--dur-base) var(--ease-out); }
.drawer-right-enter-from .md-drawer, .drawer-right-leave-to .md-drawer { transform: translateX(100%); }
.drawer-top-enter-active .md-drawer, .drawer-top-leave-active .md-drawer { transition: transform var(--dur-base) var(--ease-out); }
.drawer-top-enter-from .md-drawer, .drawer-top-leave-to .md-drawer { transform: translateY(-100%); }
.drawer-bottom-enter-active .md-drawer, .drawer-bottom-leave-active .md-drawer { transition: transform var(--dur-base) var(--ease-out); }
.drawer-bottom-enter-from .md-drawer, .drawer-bottom-leave-to .md-drawer { transform: translateY(100%); }
.drawer-left-enter-active, .drawer-left-leave-active,
.drawer-right-enter-active, .drawer-right-leave-active,
.drawer-top-enter-active, .drawer-top-leave-active,
.drawer-bottom-enter-active, .drawer-bottom-leave-active { transition: opacity var(--dur-base) var(--ease-out); }
.drawer-left-enter-from, .drawer-left-leave-to,
.drawer-right-enter-from, .drawer-right-leave-to,
.drawer-top-enter-from, .drawer-top-leave-to,
.drawer-bottom-enter-from, .drawer-bottom-leave-to { opacity: 0; }
</style>
