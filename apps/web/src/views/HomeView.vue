<script setup lang="ts">
/**
 * HomeView · ManhuaWorks 官网首页
 * W1 交付
 *
 * 区块结构：
 * 1. 顶部导航（Logo + 主题切换器 + 登录按钮）
 * 2. Hero 主视觉
 * 3. 核心能力介绍（3 大产品力）
 * 4. 5 主题选择器（体验区）
 * 5. 底部信息
 */

import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { currentMeta } = useTheme()

/** 3 大产品力 */
const features = [
  {
    id: 'story',
    icon: '📖',
    title: '粘贴小说 → 智能拆稿',
    desc: '粘贴小说文本，AI 自动识别章节结构、人物关系、关键场景，省下 80% 拆稿时间'
  },
  {
    id: 'storyboard',
    icon: '🎬',
    title: 'AI 分镜生成',
    desc: '从文本到镜头脚本，自动匹配景别、运镜、转场，导演视角重新讲故事'
  },
  {
    id: 'video',
    icon: '🎥',
    title: '角色+场景+镜头，一键出片',
    desc: '角色 · 场景 · 镜头三位一体，AI 出图直出视频片段，连贯不串戏'
  }
]
</script>

<template>
  <main class="home">
    <!-- ===== 1. 顶部导航 ===== -->
    <header class="home__nav">
      <div class="home__brand">
        <span class="home__logo">漫</span>
        <span class="home__brand-name">漫工场</span>
      </div>
      <div class="home__nav-right">
        <ThemeSwitcher mode="compact" />
        <RouterLink to="/login" class="btn-login">登录</RouterLink>
      </div>
    </header>

    <!-- ===== 2. Hero ===== -->
    <section class="home__hero">
      <div class="home__hero-inner">
        <p class="home__eyebrow">AI 驱动的漫剧创作平台</p>
        <h1 class="home__title">
          AI 漫剧<span class="home__title-accent">一键成片</span>
        </h1>
        <p class="home__subtitle">
          从小说到漫剧，只需粘贴文本
          <br />AI 自动拆稿 · 智能分镜 · 角色生成 · 一键导出
        </p>
        <div class="home__cta">
          <RouterLink to="/login" class="btn-primary">立即开始</RouterLink>
          <RouterLink to="/showcase" class="btn-secondary">
            看看作品
          </RouterLink>
        </div>
        <p class="home__current-theme">
          当前主题：<strong>{{ currentMeta.label }}</strong> · {{ currentMeta.desc }}
        </p>
      </div>
    </section>

    <!-- ===== 3. 3 大产品力 ===== -->
    <section class="home__features">
      <div class="home__section-header">
        <h2>3 大核心能力</h2>
        <p>粘贴小说 → AI 拆稿 → 智能分镜 → 一键出片</p>
      </div>
      <div class="home__feature-grid">
        <div v-for="f in features" :key="f.id" class="home__feature-card">
          <div class="home__feature-icon">{{ f.icon }}</div>
          <h3 class="home__feature-title">{{ f.title }}</h3>
          <p class="home__feature-desc">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ===== 4. 主题体验区 ===== -->
    <section class="home__themes">
      <div class="home__section-header">
        <h2>5 套视觉主题</h2>
        <p>选择您喜欢的创作风格，随心切换</p>
      </div>
      <ThemeSwitcher mode="grid" />
    </section>

    <!-- ===== 5. 底部 ===== -->
    <footer class="home__footer">
      <p>© 2026 漫工场 · AI 漫剧创作平台</p>
      <p class="home__footer-links">
        <a href="#">产品</a> · <a href="#">资源</a> · <a href="#">关于我们</a> · <a href="#">服务条款</a> · <a href="#">隐私政策</a>
      </p>
    </footer>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

/* ===== 1. 导航 ===== */
.home__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10,14,26,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.home__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.home__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--gradient);
  color: white;
  font-weight: 800;
  font-size: 16px;
}

.home__brand-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.home__nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-login {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 200ms;
}

.btn-login:hover {
  background: var(--accent-strong);
  box-shadow: 0 0 20px var(--accent-glow);
}

/* ===== 2. Hero ===== */
.home__hero {
  padding: 80px 32px 60px;
  text-align: center;
}

.home__hero-inner {
  max-width: 760px;
  margin: 0 auto;
}

.home__eyebrow {
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 16px;
  font-weight: 500;
}

.home__title {
  font-size: clamp(40px, 6vw, 64px);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.home__title-accent {
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.home__subtitle {
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 36px;
}

.home__cta {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.btn-primary {
  display: inline-block;
  padding: 14px 32px;
  border-radius: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: all 300ms;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow), var(--glow);
}

.btn-secondary {
  display: inline-block;
  padding: 14px 32px;
  border-radius: 10px;
  border: 1.5px solid var(--border-strong);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  transition: all 300ms;
}

.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.home__current-theme {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.home__current-theme strong {
  color: var(--accent);
  font-weight: 600;
}

/* ===== 通用 section ===== */
.home__features,
.home__themes {
  padding: 60px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.home__section-header {
  text-align: center;
  margin-bottom: 36px;
}

.home__section-header h2 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.home__section-header p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 14px;
}

/* ===== 3. Features Grid ===== */
.home__feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.home__feature-card {
  padding: 32px 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  transition: all 300ms;
}

.home__feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.home__feature-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.home__feature-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px;
}

.home__feature-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== 5. Footer ===== */
.home__footer {
  padding: 40px 32px;
  text-align: center;
  border-top: 1px solid var(--border);
  margin-top: 40px;
  font-size: 13px;
  color: var(--text-secondary);
}

.home__footer p {
  margin: 4px 0;
}

.home__footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  margin: 0 4px;
  transition: color 200ms;
}

.home__footer-links a:hover {
  color: var(--accent);
}
</style>
