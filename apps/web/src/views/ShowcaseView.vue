<script setup lang="ts">
/**
 * ShowcaseView · 示例作品展示
 * 公开页面 · 不需要登录
 * 展示 ManhuaWorks 平台制作的漫改作品
 */

interface ShowcaseItem {
  id: string
  title: string
  subtitle: string
  desc: string
  genre: 'modern' | 'fantasy' | 'scifi'
  coverEmoji: string
  coverColor: string
  shots: number
  duration: string
  status: '草稿' | '进行中' | '已发布'
  highlight: string
}

const showcases: ShowcaseItem[] = [
  {
    id: 'project-001',
    title: '都市奇缘: 晚安摩天楼',
    subtitle: '现代都市 · 爱情喜剧',
    desc: '现代都市爱情喜剧。一对住在同一栋摩天楼里的陌生人，通过深夜阳台的纸条互诉心声。当 AI 学会讲笑话，当代码学会写情书，这就是 2026 年的恋爱。',
    genre: 'modern',
    coverEmoji: '🌃',
    coverColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    shots: 24,
    duration: '~8 分钟',
    status: '草稿',
    highlight: 'AI 自动匹配都市夜景 + 浪漫氛围光'
  },
  {
    id: 'project-002',
    title: '剑破苍穹: 少年宗主',
    subtitle: '仙侠冒险 · 长篇连载',
    desc: '古风仙侠冒险长篇。出身没落宗门的少年，凭一柄断剑踏上复仇与觉醒之路。从山野少年到一宗之主，24 集讲述三年的故事。',
    genre: 'fantasy',
    coverEmoji: '⚔️',
    coverColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    shots: 96,
    duration: '~32 分钟',
    status: '进行中',
    highlight: '角色一致性 99.2% · 跨集不串戏'
  },
  {
    id: 'project-003',
    title: '深空遗民: 第八殖民舰',
    subtitle: '近未来科幻 · 首章完结',
    desc: '近未来科幻。当太阳熄灭，第八殖民舰是人类的最后方舟。但船员们发现，比死亡更可怕的是彼此。已完结首章 8 集。',
    genre: 'scifi',
    coverEmoji: '🚀',
    coverColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    shots: 48,
    duration: '~16 分钟',
    status: '已发布',
    highlight: '首章观众 12.3 万 · 平均完播率 78%'
  }
]

const statusColor: Record<ShowcaseItem['status'], string> = {
  草稿: 'var(--text-muted)',
  进行中: 'var(--warning)',
  已发布: 'var(--success)'
}
</script>

<template>
  <main class="showcase">
    <header class="showcase__nav">
      <RouterLink to="/" class="showcase__back">← 返回首页</RouterLink>
      <span class="showcase__brand">M · ManhuaWorks</span>
    </header>

    <section class="showcase__hero">
      <p class="showcase__eyebrow">SHOWCASE · 作品案例</p>
      <h1 class="showcase__title">
        文字 → 漫剧,<br />AI 做到了
      </h1>
      <p class="showcase__subtitle">
        3 部真实作品 · 从草根创作者到 IP 工厂
      </p>
    </section>

    <section class="showcase__grid">
      <article v-for="item in showcases" :key="item.id" class="showcase__card">
        <div class="showcase__cover" :style="{ background: item.coverColor }">
          <span class="showcase__cover-emoji">{{ item.coverEmoji }}</span>
          <span class="showcase__cover-status" :style="{ color: statusColor[item.status] }">
            ● {{ item.status }}
          </span>
        </div>
        <div class="showcase__body">
          <h2 class="showcase__card-title">{{ item.title }}</h2>
          <p class="showcase__card-subtitle">{{ item.subtitle }}</p>
          <p class="showcase__card-desc">{{ item.desc }}</p>
          <div class="showcase__meta">
            <span class="showcase__meta-item">🎬 {{ item.shots }} 镜头</span>
            <span class="showcase__meta-item">⏱ {{ item.duration }}</span>
          </div>
          <div class="showcase__highlight">
            <span class="showcase__highlight-label">亮点</span>
            <span class="showcase__highlight-text">{{ item.highlight }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="showcase__cta">
      <h2>你也想做一部?</h2>
      <p>注册即可创建你的第一个漫改项目, 注册即送 100 算力 + Pro 套餐 7 天体验</p>
      <div class="showcase__cta-buttons">
        <RouterLink to="/login" class="btn-primary">立即开始</RouterLink>
        <RouterLink to="/" class="btn-secondary">返回首页</RouterLink>
      </div>
    </section>

    <footer class="showcase__footer">
      <p>© 2026 ManhuaWorks · 创作者友好的漫改 SaaS</p>
    </footer>
  </main>
</template>

<style scoped>
.showcase {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.showcase__nav {
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

.showcase__back {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.showcase__back:hover {
  color: var(--accent);
}

.showcase__brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.showcase__hero {
  padding: 80px 32px 60px;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
}

.showcase__eyebrow {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin: 0 0 16px;
  font-weight: 600;
}

.showcase__title {
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.showcase__subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
}

.showcase__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  padding: 0 32px 60px;
  max-width: 1200px;
  margin: 0 auto;
}

.showcase__card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 300ms;
}

.showcase__card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.showcase__cover {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.showcase__cover-emoji {
  font-size: 80px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.showcase__cover-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.showcase__body {
  padding: 24px;
}

.showcase__card-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}

.showcase__card-subtitle {
  font-size: 12px;
  color: var(--accent);
  margin: 0 0 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.showcase__card-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.showcase__meta {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.showcase__meta-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.showcase__highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.showcase__highlight-label {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg-primary);
  letter-spacing: 0.05em;
}

.showcase__highlight-text {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.showcase__cta {
  padding: 60px 32px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.showcase__cta h2 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
}

.showcase__cta p {
  color: var(--text-secondary);
  margin: 0 0 28px;
  line-height: 1.6;
}

.showcase__cta-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 15px;
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
  padding: 12px 28px;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: all 300ms;
}

.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.showcase__footer {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}
</style>
