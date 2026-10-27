<script setup lang="ts">
/**
 * LazyImage — 懒加载图片组件 (IntersectionObserver)
 *
 * 特性:
 *  - 到达视口前不加载 (threshold 200px)
 *  - WebP 优先 + 原始格式 fallback
 *  - 加载中骨架屏, 加载失败占位
 *  - 支持 srcset / sizes (响应式图片)
 *  - loading="lazy" native 兜底
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    webp?: string
    alt?: string
    width?: number | string
    height?: number | string
    /** 响应式 srcset (原始格式) */
    srcset?: string
    /** 响应式 srcset (WebP) */
    webpset?: string
    sizes?: string
    /** 提前多少 px 开始加载 (default 200) */
    rootMargin?: string
    /** 占位背景色 */
    placeholderColor?: string
    /** 是否立即加载 (跳过 lazy) */
    eager?: boolean
    /** CSS class */
    imgClass?: string
  }>(),
  {
    alt: '',
    rootMargin: '200px',
    placeholderColor: '#f0f0f0',
    eager: false,
    imgClass: '',
  }
)

const emit = defineEmits<{
  loaded: [el: HTMLImageElement]
  error: [err: ErrorEvent]
}>()

const imgRef = ref<HTMLImageElement>()
const isVisible = ref(props.eager)
const isLoaded = ref(false)
const isError = ref(false)
let observer: IntersectionObserver | null = null

const hasWebp = computed(() => !!props.webp || !!props.webpset)

function onLoad(e: Event) {
  isLoaded.value = true
  isError.value = false
  emit('loaded', e.target as HTMLImageElement)
}

function onError(e: Event) {
  isError.value = true
  emit('error', e as ErrorEvent)
}

onMounted(() => {
  if (props.eager) {
    isVisible.value = true
    return
  }
  // Native lazy loading 兜底 (无需 IntersectionObserver)
  if ('loading' in HTMLImageElement.prototype) {
    isVisible.value = true
    return
  }
  // IntersectionObserver polyfill
  if (!imgRef.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: props.rootMargin }
  )
  observer.observe(imgRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="imgRef"
    class="lazy-image-wrapper"
    :style="{ backgroundColor: isLoaded ? 'transparent' : placeholderColor }"
  >
    <!-- 骨架占位 -->
    <div v-if="!isLoaded && !isError" class="lazy-image-skeleton" />

    <!-- 加载失败 -->
    <div v-if="isError" class="lazy-image-error">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4h20v16H2z"/>
        <circle cx="8.5" cy="11" r="2"/>
        <path d="m22 15-5-5-4 4-3-3-5 5"/>
      </svg>
      <span v-if="alt">{{ alt }}</span>
    </div>

    <!-- 图片 (有条件渲染: picture 支持 WebP, 否则 img) -->
    <template v-if="isVisible">
      <picture v-if="hasWebp">
        <source
          v-if="webpset"
          :srcset="webpset"
          :sizes="sizes"
          type="image/webp"
        />
        <source
          v-else-if="webp"
          :srcset="webp"
          type="image/webp"
        />
        <source
          v-if="srcset"
          :srcset="srcset"
          :sizes="sizes"
        />
        <img
          :src="src"
          :alt="alt"
          :width="width"
          :height="height"
          :class="imgClass"
          loading="lazy"
          @load="onLoad"
          @error="onError"
        />
      </picture>
      <img
        v-else
        :src="src"
        :alt="alt"
        :width="width"
        :height="height"
        :srcset="srcset"
        :sizes="sizes"
        :class="imgClass"
        loading="lazy"
        @load="onLoad"
        @error="onError"
      />
    </template>
  </div>
</template>

<style scoped>
.lazy-image-wrapper {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: inherit;
}
.lazy-image-wrapper img {
  display: block;
  width: 100%;
  height: auto;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.lazy-image-wrapper img[src] {
  opacity: 1;
}
.lazy-image-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.lazy-image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px;
  color: #999;
  font-size: 12px;
  min-height: 80px;
  background: #fafafa;
}
</style>
