<script setup lang="ts">
/**
 * ShareView.vue -- 作品分享预览页（公开页面，无需登录）
 * P3-2: 零成本获客引擎 -- 分享机制
 *
 * 路由: /share/:type/:id
 *
 * 功能:
 * - 展示被分享的 AI 作品
 * - 品牌化头部 + CTA 引导注册
 * - 作品详情（类型、创建日期、风格标签）
 */

import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { BRAND } from '@/config/branding'
import { getClient } from '@manhuaworks/api-client'

const http = () => getClient().http

const route = useRoute()

/** 作品类型 */
type WorkType = 'manga' | 'promo' | 'ad-short' | 'ad-image' | 'music' | 'novel'

/** 作品详情 */
interface WorkDetail {
  id: string
  type: WorkType
  title: string
  description: string
  imageUrl?: string
  createdAt: string
  styleTags: string[]
  authorName: string
}

/** 作品类型 -> 品牌子名 */
const TYPE_LABELS: Record<WorkType, string> = {
  manga: BRAND.subNames.manhua,
  promo: BRAND.subNames.promo,
  'ad-short': BRAND.subNames.video,
  'ad-image': BRAND.subNames.ad,
  music: BRAND.subNames.music,
  novel: BRAND.subNames.novel,
}

/** 作品类型 -> 图标 */
const TYPE_ICONS: Record<WorkType, string> = {
  manga: '📖',
  promo: '🎬',
  'ad-short': '📱',
  'ad-image': '🖼',
  music: '🎵',
  novel: '✍️',
}

/** 作品类型 -> 描述 */
const TYPE_DESCS: Record<WorkType, string> = {
  manga: 'AI 动画生成作品',
  promo: 'AI 宣传视频作品',
  'ad-short': 'AI 短视频广告作品',
  'ad-image': 'AI 广告图片作品',
  music: 'AI 原创音乐作品',
  novel: 'AI 小说创作作品',
}

/** 从路由参数提取类型和 ID */
const workType = computed(() => (route.params.type as WorkType) || 'manga')
const workId = computed(() => (route.params.id as string) || 'preview')

/** 类型标签 */
const typeLabel = computed(() => TYPE_LABELS[workType.value] || workType.value)

/** 类型图标 */
const typeIcon = computed(() => TYPE_ICONS[workType.value] || '🎬')

/** 类型描述 */
const typeDesc = computed(() => TYPE_DESCS[workType.value] || 'AI 创作作品')

/** 加载状态 */
const loading = ref(true)

/** 作品详情（目前为模拟数据，后续接入 API） */
const work = ref<WorkDetail | null>(null)

/** 模拟加载作品数据 */
onMounted(async () => {
  loading.value = true
  // TODO: 接入真实 API -- GET /api/works/:id/public
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 600))

  work.value = {
    id: workId.value,
    type: workType.value,
    title: `${typeLabel.value} 作品 #${workId.value.slice(0, 8)}`,
    description: `这是一部由${BRAND.nameCn}AI工具生成的${typeDesc.value}。创作者使用${BRAND.nameCn}的智能创作引擎，将想法变成了现实。`,
    createdAt: new Date().toISOString().slice(0, 10),
    styleTags: ['AI生成', typeLabel.value, '千机工坊'],
    authorName: '匿名创作者',
  }

  loading.value = false
})

/** 格式化日期 */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return dateStr
  }
}
</script>

<template>
  <main class="share-view">
    <!-- ========== Branded Header ========== -->
    <header class="share-view__header">
      <RouterLink to="/" class="share-view__brand">
        <span class="share-view__logo">{{ BRAND.logoText }}</span>
        <span class="share-view__brand-name">{{ BRAND.nameCn }}</span>
      </RouterLink>
      <span class="share-view__tagline">{{ BRAND.tone }}</span>
    </header>

    <!-- ========== Loading ========== -->
    <div v-if="loading" class="share-view__loading">
      <div class="share-view__spinner" />
      <p>加载作品中...</p>
    </div>

    <!-- ========== Work Preview ========== -->
    <template v-else-if="work">
      <section class="share-view__hero">
        <!-- 作品封面 -->
        <div class="share-view__cover">
          <div
            v-if="work.imageUrl"
            class="share-view__cover-img"
            :style="{ backgroundImage: `url(${work.imageUrl})` }"
          />
          <div v-else class="share-view__cover-placeholder">
            <span class="share-view__cover-icon">{{ typeIcon }}</span>
            <span class="share-view__cover-label">{{ typeLabel }}</span>
          </div>

          <!-- 水印 -->
          <div class="share-view__cover-watermark">
            <span>{{ BRAND.nameCn }}</span>
          </div>

          <!-- 类型角标 -->
          <span class="share-view__cover-badge">{{ typeLabel }}</span>
        </div>

        <!-- 作品信息 -->
        <div class="share-view__info">
          <span class="share-view__type-badge">{{ typeIcon }} {{ typeLabel }}</span>
          <h1 class="share-view__title">{{ work.title }}</h1>
          <p class="share-view__desc">{{ work.description }}</p>

          <!-- 作品详情 -->
          <div class="share-view__meta">
            <div class="share-view__meta-item">
              <span class="share-view__meta-label">作品类型</span>
              <span class="share-view__meta-value">{{ typeDesc }}</span>
            </div>
            <div class="share-view__meta-item">
              <span class="share-view__meta-label">创建日期</span>
              <span class="share-view__meta-value">{{ formatDate(work.createdAt) }}</span>
            </div>
            <div class="share-view__meta-item">
              <span class="share-view__meta-label">创作者</span>
              <span class="share-view__meta-value">{{ work.authorName }}</span>
            </div>
          </div>

          <!-- 风格标签 -->
          <div class="share-view__tags">
            <span v-for="tag in work.styleTags" :key="tag" class="share-view__tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </section>

      <!-- ========== CTA ========== -->
      <section class="share-view__cta">
        <div class="share-view__cta-inner">
          <h2 class="share-view__cta-title">
            用{{ BRAND.nameCn }}AI创作
          </h2>
          <p class="share-view__cta-desc">
            {{ BRAND.tagline }}<br />
            免费注册，开启你的 AI 创作之旅
          </p>
          <RouterLink to="/login" class="share-view__cta-btn">
            免费创建你自己的作品 &rarr;
          </RouterLink>
          <p class="share-view__cta-hint">
            注册即送 100 算力 + 专业版 7 天体验
          </p>
        </div>
      </section>

      <!-- ========== Features ========== -->
      <section class="share-view__features">
        <h3 class="share-view__features-title">为什么选择{{ BRAND.nameCn }}？</h3>
        <div class="share-view__features-grid">
          <div class="share-view__feature-card">
            <span class="share-view__feature-icon">⚡</span>
            <h4>一键生成</h4>
            <p>AI 智能创作，几分钟即可生成专业级作品</p>
          </div>
          <div class="share-view__feature-card">
            <span class="share-view__feature-icon">🎨</span>
            <h4>六艺并行</h4>
            <p>动画、小说、音乐、视频、广告图、广告视频 -- 全部支持</p>
          </div>
          <div class="share-view__feature-card">
            <span class="share-view__feature-icon">💰</span>
            <h4>零成本起步</h4>
            <p>免费注册即可体验，无需信用卡，无需下载</p>
          </div>
        </div>
      </section>
    </template>

    <!-- ========== 404 ========== -->
    <section v-else class="share-view__not-found">
      <div class="share-view__not-found-icon">🔗</div>
      <h2>作品未找到</h2>
      <p>该分享链接可能已过期或作品已被删除</p>
      <RouterLink to="/" class="share-view__back-btn">返回首页</RouterLink>
    </section>

    <!-- ========== Footer ========== -->
    <footer class="share-view__footer">
      <RouterLink to="/" class="share-view__footer-brand">{{ BRAND.nameCn }}</RouterLink>
      <span class="share-view__footer-sep">·</span>
      <RouterLink to="/showcase" class="share-view__footer-link">作品展示</RouterLink>
      <span class="share-view__footer-sep">·</span>
      <RouterLink to="/pricing" class="share-view__footer-link">定价方案</RouterLink>
      <p class="share-view__footer-copy">&copy; 2026 {{ BRAND.nameCn }} · {{ BRAND.tone }}</p>
    </footer>
  </main>
</template>

<style scoped>
.share-view {
  min-height: 100vh;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
}

/* ===== Header ===== */
.share-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10, 14, 26, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border, #2a2d35);
  position: sticky;
  top: 0;
  z-index: 100;
}

.share-view__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.share-view__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: #fff;
  font-weight: 800;
  font-size: 16px;
}

.share-view__brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.share-view__tagline {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.4));
  letter-spacing: 0.05em;
}

/* ===== Loading ===== */
.share-view__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 24px;
  gap: 16px;
}

.share-view__loading p {
  font-size: 14px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin: 0;
}

.share-view__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent, #00BFA5);
  border-radius: 50%;
  animation: share-spin 0.8s linear infinite;
}

@keyframes share-spin {
  to { transform: rotate(360deg); }
}

/* ===== Hero Section ===== */
.share-view__hero {
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

/* Cover */
.share-view__cover {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border, #2a2d35);
}

.share-view__cover-img {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.share-view__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.12), rgba(124, 58, 237, 0.12));
}

.share-view__cover-icon {
  font-size: 80px;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.3));
}

.share-view__cover-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent, #00BFA5);
  letter-spacing: 0.08em;
}

/* Cover watermark */
.share-view__cover-watermark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.share-view__cover-watermark span {
  font-size: 32px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.15);
  letter-spacing: 0.3em;
  transform: rotate(-20deg);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  user-select: none;
}

/* Cover badge */
.share-view__cover-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0a0e1a);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* Info */
.share-view__info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.share-view__type-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 4px 14px;
  border-radius: 20px;
  background: rgba(0, 191, 165, 0.1);
  border: 1px solid rgba(0, 191, 165, 0.2);
  color: var(--accent, #00BFA5);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.share-view__title {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.share-view__desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin: 0;
}

/* Meta */
.share-view__meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.share-view__meta-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.share-view__meta-label {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.4));
  width: 72px;
  flex-shrink: 0;
}

.share-view__meta-value {
  font-size: 13px;
  color: var(--text-primary, #e4e4e7);
  font-weight: 500;
}

/* Tags */
.share-view__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-view__tag {
  padding: 4px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  font-weight: 500;
}

/* ===== CTA ===== */
.share-view__cta {
  padding: 0 24px 48px;
}

.share-view__cta-inner {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
  padding: 48px 32px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.08), rgba(124, 58, 237, 0.08));
  border: 1px solid rgba(0, 191, 165, 0.15);
}

.share-view__cta-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 12px;
  letter-spacing: -0.01em;
}

.share-view__cta-desc {
  font-size: 14px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  line-height: 1.7;
  margin: 0 0 24px;
}

.share-view__cta-btn {
  display: inline-block;
  padding: 14px 36px;
  border-radius: 10px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0a0e1a);
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  transition: all 300ms;
  box-shadow: 0 4px 24px rgba(0, 191, 165, 0.25);
}

.share-view__cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 191, 165, 0.35);
}

.share-view__cta-hint {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.35));
  margin: 12px 0 0;
}

/* ===== Features ===== */
.share-view__features {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px 60px;
}

.share-view__features-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 24px;
}

.share-view__features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.share-view__feature-card {
  padding: 24px 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  text-align: center;
  transition: all 200ms;
}

.share-view__feature-card:hover {
  border-color: rgba(0, 191, 165, 0.2);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.share-view__feature-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 12px;
}

.share-view__feature-card h4 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 8px;
}

.share-view__feature-card p {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.45));
  margin: 0;
  line-height: 1.6;
}

/* ===== 404 ===== */
.share-view__not-found {
  padding: 120px 24px;
  text-align: center;
}

.share-view__not-found-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.share-view__not-found h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}

.share-view__not-found p {
  font-size: 14px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin: 0 0 24px;
}

.share-view__back-btn {
  display: inline-block;
  padding: 10px 24px;
  border-radius: 8px;
  border: 1px solid var(--border, #2a2d35);
  color: var(--text-primary, #e4e4e7);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 200ms;
}

.share-view__back-btn:hover {
  border-color: var(--accent, #00BFA5);
  color: var(--accent, #00BFA5);
}

/* ===== Footer ===== */
.share-view__footer {
  padding: 24px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.share-view__footer-brand,
.share-view__footer-link {
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: color 200ms;
}

.share-view__footer-brand:hover,
.share-view__footer-link:hover {
  color: var(--accent, #00BFA5);
}

.share-view__footer-sep {
  color: rgba(255, 255, 255, 0.15);
  margin: 0 8px;
  font-size: 13px;
}

.share-view__footer-copy {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.3));
  margin: 12px 0 0;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .share-view__hero {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 32px 20px;
  }

  .share-view__title {
    font-size: 22px;
  }

  .share-view__features-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .share-view__cta-inner {
    padding: 32px 20px;
  }

  .share-view__tagline {
    display: none;
  }
}
</style>
