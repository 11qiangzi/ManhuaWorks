<template>
  <div class="dev-layout">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">千</div>
        <div class="logo-text">
          <span class="logo-main">千机工坊</span>
          <span class="logo-sub">开发者平台</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: currentRoute === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="api-status">
          <span class="status-dot online"></span>
          <span class="status-text">API 正常</span>
        </div>
      </div>
    </aside>

    <!-- 主体区域 -->
    <div class="main-area">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>
        <div class="topbar-right">
          <span class="docs-version">API v1.0</span>
          <div class="user-avatar" title="开发者">
            <span>Dev</span>
          </div>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 底部 -->
      <footer class="layout-footer">
        <span>千机工坊 &copy; 2026</span>
        <span class="footer-sep">|</span>
        <a href="#" class="footer-link">开发者协议</a>
        <span class="footer-sep">|</span>
        <a href="#" class="footer-link">状态页</a>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', icon: '🏠', label: '首页', badge: '' },
  { path: '/docs', icon: '📖', label: 'API 文档', badge: '' },
  { path: '/api-keys', icon: '🔑', label: 'API Key 管理', badge: '' },
  { path: '/playground', icon: '🧪', label: 'Playground', badge: '' },
  { path: '/sdk', icon: '📦', label: 'SDK 下载', badge: '' },
]

const currentRoute = computed(() => route.path)
const pageTitle = computed(() => (route.meta.title as string) || '开发者平台')
</script>

<style scoped>
.dev-layout {
  display: flex;
  min-height: 100vh;
  background: #0f1117;
}

/* === 侧边栏 === */
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: #131627;
  border-right: 1px solid #2d3348;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid #2d3348;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-main {
  font-size: 15px;
  font-weight: 700;
  color: #e5e7eb;
}

.logo-sub {
  font-size: 11px;
  color: #6b7280;
  margin-top: 1px;
}

/* === 导航 === */
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #9ca3af;
  font-size: 14px;
  transition: all 0.15s ease;
  position: relative;
}

.nav-item:hover {
  background: #1e2235;
  color: #e5e7eb;
}

.nav-item.active {
  background: rgba(0, 191, 165, 0.1);
  color: #00BFA5;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #00BFA5;
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  font-size: 16px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #7C3AED;
  color: white;
  font-weight: 600;
}

/* === 侧边栏底部 === */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #2d3348;
}

.api-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.status-dot.online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.4);
}

.status-text {
  color: #9ca3af;
}

/* === 主区域 === */
.main-area {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* === 顶栏 === */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #131627;
  border-bottom: 1px solid #2d3348;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #e5e7eb;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.docs-version {
  font-size: 12px;
  color: #6b7280;
  padding: 3px 8px;
  border: 1px solid #2d3348;
  border-radius: 4px;
  font-family: monospace;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: white;
  cursor: pointer;
}

/* === 内容 === */
.content-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* === 底部 === */
.layout-footer {
  padding: 16px 24px;
  border-top: 1px solid #2d3348;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-sep {
  color: #2d3348;
}

.footer-link {
  color: #6b7280;
  text-decoration: none;
  transition: color 0.15s;
}

.footer-link:hover {
  color: #00BFA5;
}

/* === 响应式 === */
@media (max-width: 768px) {
  .sidebar {
    width: 60px;
  }
  .logo-text,
  .nav-label,
  .nav-badge,
  .status-text {
    display: none;
  }
  .sidebar-logo {
    justify-content: center;
    padding: 16px 8px;
  }
  .sidebar-nav {
    padding: 8px 4px;
  }
  .nav-item {
    justify-content: center;
    padding: 10px 8px;
  }
  .nav-icon {
    width: auto;
  }
  .main-area {
    margin-left: 60px;
  }
}
</style>
