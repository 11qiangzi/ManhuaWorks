<script setup lang="ts">
/**
 * UserLayout · 用户后台侧边栏 — P0 林知行审定
 * 5 站统一: 展开 240px, 品牌紫 #7C3AED
 */
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const userEmail = ref<string>('')

onMounted(() => {
  try {
    const u = localStorage.getItem('user')
    if (u) userEmail.value = JSON.parse(u)?.email || JSON.parse(u)?.nickname || ''
  } catch {}
})

const menus = [
  { name: 'dashboard', title: '工作台', icon: '🏠', to: '/dashboard' },
  { name: 'my-projects', title: '我的项目', icon: '📁', to: '/projects' },
  { name: 'my-works', title: '我的作品', icon: '🎬', to: '/works' },
  { name: 'asset-library', title: '素材库', icon: '🖼️', to: '/assets' },
  { name: 'team', title: '我的团队', icon: '👥', to: '/team' },
  { name: 'byok', title: 'API 密钥', icon: '🔑', to: '/byok' },
  { name: 'settings', title: '设置', icon: '⚙️', to: '/settings' },
]

const isActive = (to: string) => {
  if (to === '/dashboard') return route.path === '/dashboard' || route.path === '/'
  return route.path.startsWith(to)
}

function logout() {
  try {
    localStorage.removeItem('mhw.access_token')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  } catch {}
  window.location.href = `http://${window.location.hostname}:3000/login`
}
</script>

<template>
  <div class="user-layout">
    <aside class="user-sidebar">
      <div class="user-brand">
        <span class="user-logo">漫</span>
        <span class="user-brand-text">漫工场</span>
      </div>

      <div class="user-section-label">用户后台</div>

      <nav class="user-nav">
        <RouterLink
          v-for="m in menus"
          :key="m.name"
          :to="m.to"
          class="user-nav-item"
          :class="{ 'user-nav-item--active': isActive(m.to) }"
        >
          <span class="user-nav-icon">{{ m.icon }}</span>
          <span class="user-nav-title">{{ m.title }}</span>
        </RouterLink>
      </nav>

      <div class="user-sidebar-footer">
        <div class="user-info" v-if="userEmail">
          <span class="user-icon">👤</span>
          <span class="user-email" :title="userEmail">{{ userEmail }}</span>
        </div>
        <button class="user-logout" @click="logout">退出登录</button>
      </div>
    </aside>

    <main class="user-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.user-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #F8FAFC);
  color: var(--text-primary, #0F172A);
}

.user-sidebar {
  width: var(--sidebar-expanded, 240px);
  flex-shrink: 0;
  background: var(--bg-secondary, #FFFFFF);
  border-right: 1px solid var(--border, #E2E8F0);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.user-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--border, #E2E8F0);
}

.user-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--gradient, linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%));
  color: white;
  font-weight: 800;
  font-size: 16px;
}

.user-brand-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.user-section-label {
  padding: 16px 20px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted, #94A3B8);
}

.user-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
}

.user-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary, #475569);
  font-size: 14px;
  font-weight: 500;
  transition: all 150ms;
}

.user-nav-item:hover {
  background: var(--bg-tertiary, #F1F5F9);
  color: var(--text-primary, #0F172A);
}

.user-nav-item--active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%);
  color: var(--accent, #7C3AED);
  border-left: 3px solid var(--accent, #7C3AED);
  padding-left: 9px;
  font-weight: 600;
}

.user-nav-icon {
  font-size: 18px;
  width: 20px;
  text-align: center;
}

.user-sidebar-footer {
  border-top: 1px solid var(--border, #E2E8F0);
  padding: 16px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #475569);
}

.user-email {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-logout {
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--border, #E2E8F0);
  color: var(--text-secondary, #475569);
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms;
}

.user-logout:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: #EF4444;
  color: #EF4444;
}

.user-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
