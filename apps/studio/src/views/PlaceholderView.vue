<template>
  <div class="placeholder-view">
    <div class="placeholder-card">
      <h1 class="placeholder-title">{{ title }}</h1>
      <span class="placeholder-badge">{{ pending }} 待补</span>
      <p class="placeholder-desc">{{ description }}</p>
      <div class="placeholder-actions">
        <router-link to="/workflow" class="placeholder-btn">
          🔀 去工作流设计面板
        </router-link>
        <router-link to="/" class="placeholder-btn placeholder-btn--ghost">
          🏠 返回首页
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '占位')
const pending = computed(() => (route.meta.pending as string) || '即将上线')
const description = computed(() => '该功能正在建设中，页面开发中，敬请期待。')
</script>

<style scoped>
.placeholder-view {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--bg-primary, #0a0e1a);
}
.placeholder-card {
  max-width: 520px;
  width: 100%;
  background: var(--bg-card, #141a2e);
  border: 1px solid var(--border, #1e293b);
  border-radius: var(--radius, 12px);
  padding: 32px;
}
.placeholder-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary, #e2e8f0);
  margin: 0 0 12px;
}
.placeholder-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  margin-bottom: 16px;
}
.placeholder-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 24px;
}
.placeholder-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.placeholder-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  background: var(--accent, #818cf8);
  color: #fff;
}
.placeholder-btn:hover {
  background: var(--accent-strong, #6366f1);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.25);
}
.placeholder-btn--ghost {
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  border: 1px solid var(--border, #1e293b);
}
.placeholder-btn--ghost:hover {
  border-color: var(--accent, #818cf8);
  color: var(--text-primary, #e2e8f0);
  box-shadow: none;
}
</style>
