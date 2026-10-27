<template>
  <router-view />
</template>

<script setup lang="ts">
// 千机工坊 开发者平台 — 根组件
</script>

<style>
/* 全局基础样式 */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100vh;
  background: #0f1117;
  color: #e5e7eb;
}

code,
pre,
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
}
</style>
