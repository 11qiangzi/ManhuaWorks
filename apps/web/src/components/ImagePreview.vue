<script setup lang="ts">
/**
 * ImagePreview.vue — 统一图片预览组件
 * 苏克杰 🎨 P2-1: 四态切换（占位→加载→图片→错误）
 *
 * Props:
 *   src       — 图片 URL（null/undefined = 占位态）
 *   alt       — alt 文本
 *   aspect    — 宽高比（'16:9' | '4:3' | '1:1' | 'auto'）
 *   fallback  — 占位 emoji（默认 🖼️）
 *   rounded   — 圆角大小（默认 12px）
 *   size      — 'sm' | 'md' | 'lg'（控制 fallback emoji 字号）
 */
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  src?: string | null
  alt?: string
  aspect?: '16:9' | '4:3' | '1:1' | 'auto'
  fallback?: string
  rounded?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  src: null,
  alt: '预览',
  aspect: '16:9',
  fallback: '🖼️',
  rounded: '12px',
  size: 'lg',
})

type PreviewState = 'placeholder' | 'loading' | 'loaded' | 'error'

const state = ref<PreviewState>(props.src ? 'loading' : 'placeholder')

watch(() => props.src, (newSrc) => {
  if (!newSrc) {
    state.value = 'placeholder'
  } else {
    state.value = 'loading'
  }
})

function onLoad() {
  state.value = 'loaded'
}

function onError() {
  state.value = 'error'
}

const aspectPadding = computed(() => {
  switch (props.aspect) {
    case '16:9': return '56.25%'
    case '4:3':  return '75%'
    case '1:1':  return '100%'
    default:     return '0'
  }
})

const emojiSize = computed(() => {
  switch (props.size) {
    case 'sm': return '28px'
    case 'md': return '48px'
    case 'lg': return '64px'
    default:   return '48px'
  }
})

const containerStyle = computed(() => ({
  borderRadius: props.rounded,
}))
</script>

<template>
  <div class="img-preview" :style="containerStyle">
    <!-- Aspect ratio sizer -->
    <div v-if="aspect !== 'auto'" class="img-preview__sizer" :style="{ paddingBottom: aspectPadding }" />

    <!-- Content layer -->
    <div class="img-preview__content">
      <!-- 占位态 -->
      <div v-if="state === 'placeholder'" class="img-preview__placeholder">
        <span class="img-preview__emoji" :style="{ fontSize: emojiSize }">{{ fallback }}</span>
        <span class="img-preview__hint">暂无预览</span>
      </div>

      <!-- 加载态 -->
      <div v-else-if="state === 'loading'" class="img-preview__loading">
        <div class="img-preview__spinner" />
        <span class="img-preview__hint">加载中…</span>
      </div>

      <!-- 图片态 -->
      <img
        v-if="src && (state === 'loading' || state === 'loaded')"
        :src="src"
        :alt="alt"
        class="img-preview__img"
        :class="{ 'img-preview__img--visible': state === 'loaded' }"
        @load="onLoad"
        @error="onError"
      />

      <!-- 错误态 -->
      <div v-if="state === 'error'" class="img-preview__error">
        <span class="img-preview__emoji" :style="{ fontSize: emojiSize }">⚠️</span>
        <span class="img-preview__hint">加载失败</span>
      </div>
    </div>

    <!-- Slot for overlay content (e.g. badges, buttons) -->
    <slot />
  </div>
</template>

<style scoped>
.img-preview {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #1e293b);
}

.img-preview__sizer {
  width: 100%;
  height: 0;
}

.img-preview__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}

.img-preview__placeholder,
.img-preview__loading,
.img-preview__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0.6;
}

.img-preview__emoji {
  line-height: 1;
  filter: grayscale(0.2);
}

.img-preview__hint {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  font-weight: 500;
}

.img-preview__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border, #1e293b);
  border-top-color: var(--accent, #818cf8);
  border-radius: 50%;
  animation: img-spin 0.8s linear infinite;
}

@keyframes img-spin {
  to { transform: rotate(360deg); }
}

.img-preview__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.img-preview__img--visible {
  opacity: 1;
}
</style>
