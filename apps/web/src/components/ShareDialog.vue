<script setup lang="ts">
/**
 * ShareDialog.vue -- 作品分享对话框
 * P3-2: 零成本获客引擎 -- 分享机制
 *
 * 功能:
 * - 作品预览卡片（含水印叠加层）
 * - 5 大平台分享按钮（微信/小红书/抖音/B站/复制链接）
 * - 水印开关
 * - 分享链接 + 邀请好友文案
 */

import { ref, computed } from 'vue'
import { useShare, type ShareData, type SharePlatform, type ShareWorkType } from '@/composables/useShare'
import { BRAND } from '@/config/branding'

const props = defineProps<{
  /** 是否显示对话框 */
  modelValue: boolean
  /** 分享数据 */
  shareData: ShareData
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'shared', platform: SharePlatform): void
}>()

const {
  sharing,
  copySuccess,
  activePlatform,
  generateShareUrl,
  getWorkTypeLabel,
  getWorkTypeIcon,
  share,
} = useShare()

/** 水印开关（默认开启） */
const watermarkOn = ref(true)

/** 当前分享提示平台 */
const shareHint = ref<string | null>(null)

/** 分享 URL */
const shareUrl = computed(() => generateShareUrl(props.shareData))

/** 作品类型标签 */
const typeLabel = computed(() => getWorkTypeLabel(props.shareData.workType))

/** 作品类型图标 */
const typeIcon = computed(() => getWorkTypeIcon(props.shareData.workType))

/** 分享平台配置 */
interface PlatformConfig {
  key: SharePlatform
  label: string
  icon: string
  hint: string
  color: string
}

const platforms: PlatformConfig[] = [
  { key: 'wechat', label: '微信', icon: '📱', hint: '已复制，去微信粘贴', color: '#07C160' },
  { key: 'xiaohongshu', label: '小红书', icon: '📕', hint: '正在打开小红书...', color: '#FE2C55' },
  { key: 'douyin', label: '抖音', icon: '🎵', hint: '正在打开抖音...', color: '#25F4EE' },
  { key: 'bilibili', label: 'B站', icon: '📺', hint: '正在打开B站...', color: '#00A1D6' },
  { key: 'copy', label: '复制链接', icon: '🔗', hint: '已复制到剪贴板', color: '#8B5CF6' },
]

/** 执行分享 */
async function handleShare(platform: PlatformConfig) {
  shareHint.value = null
  const ok = await share(platform.key, props.shareData)
  if (ok || activePlatform.value === platform.key) {
    shareHint.value = platform.hint
    emit('shared', platform.key)
    // 3 秒后清除提示
    setTimeout(() => {
      if (shareHint.value === platform.hint) {
        shareHint.value = null
      }
    }, 4000)
  }
}

/** 关闭对话框 */
function close() {
  emit('update:modelValue', false)
  shareHint.value = null
}

/** 点击遮罩层关闭 */
function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('share-dialog__overlay')) {
    close()
  }
}

/** 复制链接到剪贴板 */
async function copyShareLink() {
  const text = `${props.shareData.title}\n${shareUrl.value}`
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    shareHint.value = '已复制到剪贴板'
    setTimeout(() => { shareHint.value = null }, 3000)
  } catch {
    shareHint.value = '复制失败，请手动复制'
    setTimeout(() => { shareHint.value = null }, 3000)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="share-dialog">
      <div v-if="modelValue" class="share-dialog__overlay" @click="onOverlayClick">
        <div class="share-dialog" role="dialog" aria-modal="true" aria-label="分享你的作品">
          <!-- ========== Header ========== -->
          <header class="share-dialog__header">
            <h2 class="share-dialog__title">分享你的作品</h2>
            <button class="share-dialog__close" @click="close" aria-label="关闭">
              &times;
            </button>
          </header>

          <!-- ========== Preview Card ========== -->
          <div class="share-dialog__preview">
            <div class="share-dialog__thumbnail">
              <!-- 占位图 / 缩略图 -->
              <div
                v-if="shareData.imageUrl"
                class="share-dialog__thumb-img"
                :style="{ backgroundImage: `url(${shareData.imageUrl})` }"
              />
              <div v-else class="share-dialog__thumb-placeholder">
                <span class="share-dialog__thumb-emoji">{{ typeIcon }}</span>
              </div>

              <!-- 水印叠加层 -->
              <div v-if="watermarkOn" class="share-dialog__watermark">
                <span class="share-dialog__watermark-text">{{ BRAND.nameCn }}</span>
                <span class="share-dialog__watermark-sub">AI生成</span>
              </div>

              <!-- 类型 Badge -->
              <span class="share-dialog__badge">{{ typeLabel }}</span>
            </div>

            <div class="share-dialog__preview-info">
              <h3 class="share-dialog__preview-title">{{ shareData.title }}</h3>
              <p class="share-dialog__preview-desc">{{ shareData.description }}</p>
              <span class="share-dialog__ai-tag">由{{ BRAND.nameCn }}AI生成</span>
            </div>
          </div>

          <!-- ========== Watermark Toggle ========== -->
          <label class="share-dialog__watermark-toggle">
            <input v-model="watermarkOn" type="checkbox" />
            <span class="share-dialog__toggle-check">{{ watermarkOn ? '☑' : '☐' }}</span>
            <span>添加{{ BRAND.nameCn }}水印</span>
          </label>

          <!-- ========== Share Hint ========== -->
          <Transition name="hint">
            <div v-if="shareHint" class="share-dialog__hint">
              {{ shareHint }}
            </div>
          </Transition>

          <!-- ========== Share Buttons ========== -->
          <div class="share-dialog__platforms">
            <button
              v-for="p in platforms"
              :key="p.key"
              class="share-dialog__platform-btn"
              :style="{ '--btn-color': p.color }"
              @click="handleShare(p)"
              :disabled="sharing"
            >
              <span class="share-dialog__platform-icon">{{ p.icon }}</span>
              <span class="share-dialog__platform-label">{{ p.label }}</span>
            </button>
          </div>

          <!-- ========== Share Link ========== -->
          <div class="share-dialog__link-section">
            <div class="share-dialog__link-box">
              <span class="share-dialog__link-text">{{ shareUrl }}</span>
              <button class="share-dialog__link-copy" @click="copyShareLink">
                复制
              </button>
            </div>
          </div>

          <!-- ========== Referral ========== -->
          <p class="share-dialog__referral">
            邀请好友注册，双方各得 5 次生成机会
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== Overlay ===== */
.share-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  padding: 24px;
}

/* ===== Dialog ===== */
.share-dialog {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg-secondary, #111318);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  padding: 0;
}

/* ===== Header ===== */
.share-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.share-dialog__title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}

.share-dialog__close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
}

.share-dialog__close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

/* ===== Preview Card ===== */
.share-dialog__preview {
  display: flex;
  gap: 16px;
  padding: 20px 24px;
}

.share-dialog__thumbnail {
  position: relative;
  width: 120px;
  height: 90px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.share-dialog__thumb-img {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.share-dialog__thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.15), rgba(124, 58, 237, 0.15));
}

.share-dialog__thumb-emoji {
  font-size: 36px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

/* Watermark overlay */
.share-dialog__watermark {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(1px);
  pointer-events: none;
}

.share-dialog__watermark-text {
  font-size: 14px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.1em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.share-dialog__watermark-sub {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.15em;
  margin-top: 2px;
}

/* Badge */
.share-dialog__badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0a0e1a);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* Preview info */
.share-dialog__preview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.share-dialog__preview-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-dialog__preview-desc {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.share-dialog__ai-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent, #00BFA5);
  letter-spacing: 0.03em;
}

/* ===== Watermark Toggle ===== */
.share-dialog__watermark-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px 16px;
  font-size: 13px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  cursor: pointer;
  user-select: none;
}

.share-dialog__watermark-toggle input {
  display: none;
}

.share-dialog__toggle-check {
  font-size: 18px;
  color: var(--accent, #00BFA5);
  line-height: 1;
}

/* ===== Hint ===== */
.share-dialog__hint {
  margin: 0 24px 12px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(0, 191, 165, 0.1);
  border: 1px solid rgba(0, 191, 165, 0.2);
  color: var(--accent, #00BFA5);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

/* ===== Platforms Grid ===== */
.share-dialog__platforms {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 0 24px 20px;
}

.share-dialog__platform-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #e4e4e7);
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.share-dialog__platform-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--btn-color, var(--accent, #00BFA5));
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.share-dialog__platform-btn:active {
  transform: translateY(0);
}

.share-dialog__platform-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.share-dialog__platform-icon {
  font-size: 24px;
  line-height: 1;
}

.share-dialog__platform-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

/* ===== Share Link ===== */
.share-dialog__link-section {
  padding: 0 24px 16px;
}

.share-dialog__link-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.share-dialog__link-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.share-dialog__link-copy {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0a0e1a);
  font-size: 12px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms;
}

.share-dialog__link-copy:hover {
  opacity: 0.85;
  transform: scale(1.03);
}

/* ===== Referral ===== */
.share-dialog__referral {
  margin: 0;
  padding: 14px 24px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.4));
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  letter-spacing: 0.02em;
}

/* ===== Transitions ===== */
.share-dialog-enter-active {
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.share-dialog-leave-active {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.share-dialog-enter-from {
  opacity: 0;
}

.share-dialog-enter-from .share-dialog {
  transform: scale(0.95) translateY(10px);
}

.share-dialog-leave-to {
  opacity: 0;
}

.share-dialog-leave-to .share-dialog {
  transform: scale(0.95) translateY(10px);
}

.hint-enter-active {
  transition: all 200ms ease;
}

.hint-leave-active {
  transition: all 150ms ease;
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ===== Scrollbar ===== */
.share-dialog::-webkit-scrollbar {
  width: 4px;
}

.share-dialog::-webkit-scrollbar-track {
  background: transparent;
}

.share-dialog::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* ===== Responsive ===== */
@media (max-width: 520px) {
  .share-dialog {
    max-width: 100%;
    border-radius: 12px;
  }

  .share-dialog__preview {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .share-dialog__thumbnail {
    width: 160px;
    height: 120px;
  }

  .share-dialog__platforms {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
