<template>
  <div
    :class="[
      'volume-slider',
      `volume-slider--${size}`,
      { 'volume-slider--vertical': vertical, 'volume-slider--disabled': disabled },
    ]"
    :style="cssVars"
  >
    <!-- 静音按钮 -->
    <button
      type="button"
      class="volume-slider__mute-btn"
      :disabled="disabled"
      :aria-label="muted ? '取消静音' : '静音'"
      @click="toggleMute"
    >
      <svg
        v-if="muted || internalValue === 0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :class="['volume-slider__icon', `volume-slider__icon--${size}`]"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
      <svg
        v-else-if="internalValue < 50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :class="['volume-slider__icon', `volume-slider__icon--${size}`]"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15.536 8.464a5 5 0 010 7.072" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :class="['volume-slider__icon', `volume-slider__icon--${size}`]"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728" />
      </svg>
    </button>

    <!-- 滑轨容器 -->
    <div
      ref="trackRef"
      class="volume-slider__track"
      @mousedown="onDragStart"
      @touchstart.passive="onTouchStart"
    >
      <div class="volume-slider__track-bg">
        <div class="volume-slider__track-fill" :style="fillStyle" />
      </div>
      <div class="volume-slider__thumb" :style="thumbStyle" />
    </div>

    <!-- 百分比标签 -->
    <span v-if="showLabel" class="volume-slider__label">
      {{ muted ? '静音' : `${internalValue}%` }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from 'vue';

interface Props {
  /** 音量值 0-100 */
  value?: number;
  /** 是否静音 */
  muted?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否垂直方向 */
  vertical?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md';
  /** 是否显示标签 */
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  value: 80,
  muted: false,
  disabled: false,
  vertical: false,
  size: 'md',
  showLabel: true,
});

const emit = defineEmits<{
  'update:value': [val: number];
  'update:muted': [val: boolean];
  'drag-start': [];
  'drag-end': [];
}>();

const trackRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
const internalValue = ref(props.value);

watch(() => props.value, (v) => { internalValue.value = v; });

const cssVars = computed(() => ({
  '--vs-track-size': props.size === 'sm' ? '4px' : '6px',
  '--vs-thumb-size': props.size === 'sm' ? '12px' : '16px',
  '--vs-accent': '#00BFA5',
  '--vs-track-bg': 'rgba(255,255,255,0.15)',
  '--vs-text': 'var(--color-text, #e5e7eb)',
}));

const fillStyle = computed<CSSProperties>(() => {
  const pct = props.muted ? 0 : internalValue.value;
  return props.vertical
    ? { height: `${pct}%`, width: '100%' }
    : { width: `${pct}%`, height: '100%' };
});

const thumbStyle = computed<CSSProperties>(() => {
  const pct = props.muted ? 0 : internalValue.value;
  return props.vertical
    ? { bottom: `${pct}%`, left: '50%', transform: 'translateX(-50%)' }
    : { left: `${pct}%`, top: '50%', transform: 'translateY(-50%)' };
});

function toggleMute() {
  if (props.disabled) return;
  emit('update:muted', !props.muted);
}

function getValueFromEvent(e: MouseEvent | Touch) {
  const track = trackRef.value;
  if (!track) return internalValue.value;
  const rect = track.getBoundingClientRect();
  let ratio: number;
  if (props.vertical) {
    ratio = 1 - (e.clientY - rect.top) / rect.height;
  } else {
    ratio = (e.clientX - rect.left) / rect.width;
  }
  return Math.round(Math.max(0, Math.min(100, ratio * 100)));
}

function onDragStart(e: MouseEvent) {
  if (props.disabled) return;
  dragging.value = true;
  emit('drag-start');
  const val = getValueFromEvent(e);
  internalValue.value = val;
  emit('update:value', val);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e: MouseEvent) {
  const val = getValueFromEvent(e);
  internalValue.value = val;
  emit('update:value', val);
}

function onDragEnd() {
  dragging.value = false;
  emit('drag-end');
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

function onTouchStart(e: TouchEvent) {
  if (props.disabled || !e.touches[0]) return;
  dragging.value = true;
  emit('drag-start');
  const val = getValueFromEvent(e.touches[0]);
  internalValue.value = val;
  emit('update:value', val);
  document.addEventListener('touchmove', onTouchMove);
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(e: TouchEvent) {
  if (!e.touches[0]) return;
  const val = getValueFromEvent(e.touches[0]);
  internalValue.value = val;
  emit('update:value', val);
}

function onTouchEnd() {
  dragging.value = false;
  emit('drag-end');
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
}
</script>

<style scoped>
.volume-slider {
  --vs-track-size: 6px;
  --vs-thumb-size: 16px;
  --vs-accent: #00BFA5;
  --vs-track-bg: rgba(255, 255, 255, 0.15);
  --vs-text: #e5e7eb;

  display: inline-flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  touch-action: none;
}

.volume-slider--vertical {
  flex-direction: column;
  height: 120px;
}

.volume-slider--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.volume-slider__mute-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vs-text);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
}

.volume-slider__mute-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.volume-slider__mute-btn:disabled {
  cursor: not-allowed;
}

.volume-slider__icon {
  width: 20px;
  height: 20px;
}

.volume-slider__icon--sm {
  width: 16px;
  height: 16px;
}

.volume-slider__track {
  position: relative;
  flex: 1;
  min-width: 80px;
  height: var(--vs-track-size);
  cursor: pointer;
  padding: calc(var(--vs-thumb-size) / 2) 0;
}

.volume-slider--vertical .volume-slider__track {
  min-width: unset;
  min-height: 80px;
  width: var(--vs-track-size);
  height: 100%;
  flex: 1;
  padding: 0 calc(var(--vs-thumb-size) / 2);
}

.volume-slider__track-bg {
  position: absolute;
  border-radius: calc(var(--vs-track-size) / 2);
  background: var(--vs-track-bg);
  overflow: hidden;
}

.volume-slider:not(.volume-slider--vertical) .volume-slider__track-bg {
  left: 0;
  right: 0;
  top: 50%;
  height: var(--vs-track-size);
  transform: translateY(-50%);
}

.volume-slider--vertical .volume-slider__track-bg {
  top: 0;
  bottom: 0;
  left: 50%;
  width: var(--vs-track-size);
  transform: translateX(-50%);
}

.volume-slider__track-fill {
  background: var(--vs-accent);
  border-radius: calc(var(--vs-track-size) / 2);
  transition: width 0.05s linear, height 0.05s linear;
}

.volume-slider__thumb {
  position: absolute;
  width: var(--vs-thumb-size);
  height: var(--vs-thumb-size);
  border-radius: 50%;
  background: var(--vs-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s;
  pointer-events: none;
}

.volume-slider__thumb:hover,
.volume-slider__track:active .volume-slider__thumb {
  transform: translateY(-50%) scale(1.2);
}

.volume-slider--vertical .volume-slider__thumb:hover,
.volume-slider--vertical .volume-slider__track:active .volume-slider__thumb {
  transform: translateX(-50%) scale(1.2);
}

.volume-slider__label {
  font-size: 12px;
  color: var(--vs-text);
  min-width: 36px;
  text-align: center;
  white-space: nowrap;
}

.volume-slider--sm .volume-slider__label {
  font-size: 10px;
  min-width: 28px;
}
</style>
