<script setup lang="ts">
/**
 * NotFoundView.vue · 404 友好页面
 * 替代静默重定向到首页，用户能明确知道访问了不存在的页面
 */
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="not-found">
    <div class="not-found__card">
      <div class="not-found__code">404</div>
      <h1 class="not-found__title">找不到页面</h1>
      <p class="not-found__desc">
        你访问的页面不存在，可能已被移除或地址输入有误。
      </p>
      <div class="not-found__actions">
        <RouterLink to="/" class="not-found__btn not-found__btn--primary">
          ← 返回首页
        </RouterLink>
        <RouterLink to="/dashboard" class="not-found__btn not-found__btn--secondary">
          前往工作台
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary, #0A0E1A);
  color: var(--text-primary, #f1f5f9);
  padding: 24px;
}

.not-found__card {
  text-align: center;
  max-width: 420px;
}

.not-found__code {
  font-size: 96px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.not-found__title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px;
}

.not-found__desc {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.6;
  margin: 0 0 32px;
}

.not-found__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.not-found__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 200ms;
}

.not-found__btn--primary {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.not-found__btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.45);
}

.not-found__btn--secondary {
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  color: var(--text-primary, #f1f5f9);
}

.not-found__btn--secondary:hover {
  background: var(--bg-tertiary, #23262e);
  border-color: var(--accent, #6366f1);
}
</style>
