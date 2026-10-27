<script setup lang="ts">
/**
 * ToolsView.vue · 工具箱
 * P1-1 · 辅助工具集合
 * P4-1: 添加 loading/error/empty 状态包装
 */
import { ref, onMounted } from 'vue'
import DashboardShell from '@/components/DashboardShell.vue'

const loading = ref(true)
const error = ref<string | null>(null)

const tools = ref([
  { icon: '🎨', name: 'AI 配色助手', desc: '根据场景自动生成配色方案' },
  { icon: '✂️', name: '图片裁切', desc: '快速裁切与尺寸调整' },
  { icon: '🔄', name: '格式转换', desc: '图片格式批量转换工具' },
  { icon: '📊', name: '数据统计', desc: '项目数据统计与分析' },
  { icon: '🔗', name: '链接管理', desc: '分享链接与访问统计' },
  { icon: '📦', name: '批量导出', desc: '批量导出素材与成品' },
])

onMounted(() => {
  // Tools are static, but simulate load-complete for skeleton transition
  loading.value = false
})

function retry(): void {
  error.value = null
  loading.value = false
}
</script>

<template>
  <DashboardShell>
    <div class="tools-page">
      <header class="tools-page__header">
        <h1>🧰 工具箱</h1>
        <p>辅助创作工具集合，提升工作效率</p>
      </header>

      <!-- Error banner -->
      <div v-if="error" class="tools-page__error-banner">
        <div class="tools-page__error-inner">
          <span class="tools-page__error-icon">⚠️</span>
          <div>
            <p class="tools-page__error-title">加载失败</p>
            <p class="tools-page__error-msg">{{ error }}</p>
          </div>
          <button type="button" class="tools-page__retry-btn" @click="retry">重试</button>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="tools-page__grid">
        <div v-for="i in 6" :key="i" class="tools-page__skeleton-card">
          <div class="skeleton tools-page__skeleton-icon" />
          <div class="tools-page__skeleton-body">
            <div class="skeleton tools-page__skeleton-title" />
            <div class="skeleton tools-page__skeleton-desc" />
          </div>
          <div class="skeleton tools-page__skeleton-badge" />
        </div>
      </div>

      <!-- Empty state (tools list is empty, unlikely) -->
      <section v-else-if="!error && tools.length === 0" class="tools-page__empty">
        <div class="tools-page__empty-icon">🧰</div>
        <h2 class="tools-page__empty-title">工具箱持续更新中</h2>
        <p class="tools-page__empty-desc">新的辅助工具即将上线，敬请期待</p>
      </section>

      <!-- Success: tool cards -->
      <div v-else class="tools-page__grid">
        <div
          v-for="tool in tools"
          :key="tool.name"
          class="tool-card"
        >
          <span class="tool-card__icon">{{ tool.icon }}</span>
          <div>
            <h3 class="tool-card__name">{{ tool.name }}</h3>
            <p class="tool-card__desc">{{ tool.desc }}</p>
          </div>
          <span class="tool-card__status">即将上线</span>
        </div>
      </div>
    </div>
  </DashboardShell>
</template>

<style scoped>
.tools-page {
  padding: 28px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.tools-page__header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 6px;
}

.tools-page__header p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px;
}

/* ===== Shimmer animation ===== */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #1A1C21 25%, #23262E 50%, #1A1C21 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

/* ===== Error banner ===== */
.tools-page__error-banner {
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.06) 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 16px 20px;
}

.tools-page__error-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}

.tools-page__error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.tools-page__error-title {
  font-size: 14px;
  font-weight: 700;
  color: #ef4444;
  margin: 0 0 2px;
}

.tools-page__error-msg {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.tools-page__retry-btn {
  margin-left: auto;
  padding: 8px 20px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: all 150ms;
  white-space: nowrap;
}

.tools-page__retry-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

/* ===== Loading skeleton ===== */
.tools-page__skeleton-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.tools-page__skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.tools-page__skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tools-page__skeleton-title {
  height: 16px;
  width: 50%;
}

.tools-page__skeleton-desc {
  height: 12px;
  width: 80%;
}

.tools-page__skeleton-badge {
  width: 64px;
  height: 22px;
  border-radius: 20px;
  flex-shrink: 0;
}

/* ===== Empty state ===== */
.tools-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.tools-page__empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.tools-page__empty-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text-primary);
}

.tools-page__empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== Tool grid ===== */
.tools-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 200ms;
  cursor: default;
}

.tool-card:hover {
  border-color: var(--accent, #00BFA5);
  transform: translateY(-1px);
}

.tool-card__icon {
  font-size: 28px;
  flex-shrink: 0;
}

.tool-card__name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}

.tool-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.tool-card__status {
  margin-left: auto;
  font-size: 11px;
  padding: 3px 10px;
  background: rgba(124, 58, 237, 0.12);
  color: #7C3AED;
  border-radius: 20px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
