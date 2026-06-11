<script setup lang="ts">
/**
 * App.vue · 用户后台 (派单 49 — UserLayout 接入)
 * 使用独立 UserLayout 组件 (中文化侧边栏导航)
 */
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import UserLayout from './components/UserLayout.vue'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => { initTheme() })
</script>

<template>
  <UserLayout>
    <RouterView v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </RouterView>
  </UserLayout>
</template>

<style>
@import './styles/tailwind.css';
@import './themes/dark-workshop.css';
@import './themes/minimal-light.css';
@import './themes/creator-orange.css';
@import './themes/national-ink.css';
@import './themes/neon-cyber.css';

html {
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
}
* {
  transition-property: background-color, color, border-color, box-shadow;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
.page-enter-active, .page-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-8px); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 5px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }

</style>
