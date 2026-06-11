<script setup lang="ts">
/**
 * App.vue · 根组件
 * ManhuaWorks · W1
 *
 * 职责：
 * 1. 初始化主题（从 localStorage 恢复）
 * 2. RouterView 出口
 * 3. 全局 300ms 主题过渡
 */

import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})
</script>

<template>
  <div class="app-root">
    <RouterView v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </RouterView>
  </div>
</template>

<style>
/* ===== 主题样式汇总 ===== */
@import './styles/tailwind.css';
@import './themes/dark-workshop.css';
@import './themes/minimal-light.css';
@import './themes/creator-orange.css';
@import './themes/national-ink.css';
@import './themes/neon-cyber.css';

/* ===== 全局过渡 ===== */
html {
  /* 主题切换 300ms 平滑过渡 */
  transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
              color 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  margin: 0;
  font-family: var(--font-display, -apple-system, BlinkMacSystemFont,
                   'PingFang SC', 'Microsoft YaHei', sans-serif);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
              color 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.app-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
  transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
              color 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* 全局 transition：所有用到主题变量的属性都平滑过渡 */
* {
  transition-property: background-color, color, border-color, box-shadow;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== 路由切换动画 ===== */
.page-enter-active,
.page-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ===== 滚动条适配主题 ===== */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
</style>
