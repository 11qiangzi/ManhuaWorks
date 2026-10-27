<script setup lang="ts">
/**
 * MainLayout.vue · 千机工坊统一布局
 * Refined Dark Editorial — inspired by Linear / Vercel / Stripe
 *
 * Structure:
 *   - Sidebar 240px (collapsible to 64px)
 *   - TopBar 52px (transparent, blends with page)
 *   - Main content area with page transitions
 *   - Immersive mode: hide sidebar + semi-transparent topbar
 */

import { ref, computed, onMounted, watch, onErrorCaptured } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { MODULE_NAMES } from '@/config/naming'
import LoginModal from '@/components/LoginModal.vue'
import NotificationBell from '@/components/notification/NotificationBell.vue'

const route = useRoute()
const router = useRouter()

/* ------------------------------------------------------------------ */
/*  Global error boundary                                              */
/* ------------------------------------------------------------------ */

const childError = ref<string | null>(null)
const childErrorComponent = ref<string | null>(null)

onErrorCaptured((err: unknown, instance: any, info: string) => {
  childError.value = err instanceof Error ? err.message : String(err)
  childErrorComponent.value = instance?.$options?.name || instance?.type?.name || 'Unknown'
  console.error('[MainLayout] child error captured:', err, 'in', childErrorComponent.value)
  return false // prevent propagation
})

function clearChildError() {
  childError.value = null
  childErrorComponent.value = null
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const collapsed = ref(false)
const createOpen = ref(true)
const resourceOpen = ref(true)
const showLoginModal = ref(false)
const showUserDropdown = ref(false)
const searchQuery = ref('')

/** Simple toast */
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}

function toggleUserDropdown() {
  showUserDropdown.value = !showUserDropdown.value
}

function confirmLogout() {
  showUserDropdown.value = false
  if (confirm('确定要退出登录吗？')) {
    logout()
  }
}

function onSearchEnter() {
  const q = searchQuery.value.trim()
  if (!q) return
  showToast(`搜索功能即将上线（关键词：${q}）`)
  searchQuery.value = ''
}

interface UserInfo {
  id: string
  phone?: string
  email?: string
  nickname: string
  display_name?: string
}

const user = ref<UserInfo | null>(null)

onMounted(() => {
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch {
    user.value = null
  }
  collapsed.value = localStorage.getItem('sidebar-collapsed') === 'true'
})

watch(collapsed, (val) => {
  localStorage.setItem('sidebar-collapsed', String(val))
})

/* ------------------------------------------------------------------ */
/*  Immersive mode                                                     */
/* ------------------------------------------------------------------ */

const isImmersive = computed(() => !!route.meta?.immersive)

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */

interface NavItem {
  to: string
  label: string
  icon: string
  matchPrefix?: string
}

const mainNav: NavItem[] = [
  { to: '/dashboard', label: '工作台', icon: '◈' },
  { to: '/projects', label: '我的项目', icon: '◇' },
]

/** 创作空间 — 6大模块（方案要求） */
const createSubItems: NavItem[] = [
  { to: '/create/animation', label: MODULE_NAMES.manga.name, icon: '🎬', matchPrefix: '/create/animation' },
  { to: '/create/novel', label: '小说创作', icon: '📖', matchPrefix: '/create/novel' },
  { to: '/create/promo', label: MODULE_NAMES.promo.name, icon: '📽', matchPrefix: '/create/promo' },
  { to: '/create/ad-video', label: '广告短片', icon: '📹', matchPrefix: '/create/ad-video' },
  { to: '/create/ad-image', label: MODULE_NAMES.adImage.name, icon: '🎨', matchPrefix: '/create/ad-image' },
  { to: '/create/music', label: '音乐生成', icon: '🎵', matchPrefix: '/create/music' },
]

const resourceSubItems: NavItem[] = [
  { to: '/generation-tasks', label: '生成任务', icon: '⚡' },
  { to: '/materials', label: '素材中心', icon: '📁' },
  { to: '/works', label: '作品库', icon: '🏆' },
  { to: '/tools', label: '工具箱', icon: '🧰' },
]

const bottomNav: NavItem[] = [
  { to: '/settings', label: '设置', icon: '⚙' },
]

/* ------------------------------------------------------------------ */
/*  Active state helpers                                               */
/* ------------------------------------------------------------------ */

function isActive(item: NavItem): boolean {
  const path = route.path
  if (item.matchPrefix) return path.startsWith(item.matchPrefix)
  return path === item.to || path.startsWith(item.to + '/')
}

const isCreateGroupActive = computed(() =>
  route.path.startsWith('/create')
)

/* ------------------------------------------------------------------ */
/*  Breadcrumb                                                         */
/* ------------------------------------------------------------------ */

const breadcrumbs = computed(() => {
  const matched = route.matched.filter(r => r.meta?.title)
  return matched.map(r => ({
    title: r.meta.title as string,
    path: r.path
  }))
})

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

function toggleCreateGroup() {
  createOpen.value = !createOpen.value
}

function toggleResourceGroup() {
  resourceOpen.value = !resourceOpen.value
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('mhw.access_token')
  localStorage.removeItem('mhw.user')
  router.push('/login')
}

const userInitial = computed(() => {
  if (!user.value) return '?'
  return (user.value.display_name || user.value.nickname || '?')[0]
})

const userName = computed(() => {
  if (!user.value) return '创作者'
  return user.value.display_name || user.value.nickname || '创作者'
})
</script>

<template>
  <div class="layout" :class="{ 'layout--immersive': isImmersive }">
    <!-- ========== Sidebar ========== -->
    <aside
      v-show="!isImmersive"
      class="sidebar"
      :class="{ 'sidebar--collapsed': collapsed }"
    >
      <!-- Brand -->
      <div class="sidebar__brand">
        <RouterLink to="/" class="sidebar__brand-link">
          <span class="sidebar__logo" :class="{ 'sidebar__logo--collapsed': collapsed }">{{ collapsed ? '千' : '千机工坊' }}</span>
        </RouterLink>
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav">
        <!-- Main nav items -->
        <RouterLink
          v-for="item in mainNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item) }"
          :title="collapsed ? item.label : undefined"
        >
          <span class="nav-item__icon">{{ item.icon }}</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="nav-item__label">{{ item.label }}</span>
          </Transition>
        </RouterLink>

        <!-- Divider -->
        <div class="sidebar__divider" />

        <!-- Create group -->
        <button
          class="nav-group"
          @click="toggleCreateGroup"
          :title="collapsed ? '创作空间' : undefined"
        >
          <span class="nav-group__icon">▸</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="nav-group__label">创作空间</span>
          </Transition>
          <Transition name="fade-text">
            <span
              v-show="!collapsed"
              class="nav-group__arrow"
              :class="{ 'nav-group__arrow--open': createOpen }"
            >▾</span>
          </Transition>
        </button>

        <Transition name="slide-group">
          <div v-show="createOpen && !collapsed" class="nav-subgroup">
            <RouterLink
              v-for="item in createSubItems"
              :key="item.to"
              :to="item.to"
              class="nav-subitem"
              :class="{ 'nav-subitem--active': isActive(item) }"
            >
              <span class="nav-subitem__icon">{{ item.icon }}</span>
              <span class="nav-subitem__label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </Transition>

        <!-- Collapsed: show create icons directly -->
        <div v-show="collapsed" class="nav-subgroup nav-subgroup--collapsed">
          <RouterLink
            v-for="item in createSubItems"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item--active': isActive(item) }"
            :title="item.label"
          >
            <span class="nav-item__icon">{{ item.icon }}</span>
          </RouterLink>
        </div>

        <!-- Divider -->
        <div class="sidebar__divider" />

        <!-- Resource group -->
        <button
          class="nav-group"
          @click="toggleResourceGroup"
          :title="collapsed ? '资源管理' : undefined"
        >
          <span class="nav-group__icon">▸</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="nav-group__label">资源管理</span>
          </Transition>
          <Transition name="fade-text">
            <span
              v-show="!collapsed"
              class="nav-group__arrow"
              :class="{ 'nav-group__arrow--open': resourceOpen }"
            >▾</span>
          </Transition>
        </button>

        <Transition name="slide-group">
          <div v-show="resourceOpen && !collapsed" class="nav-subgroup">
            <RouterLink
              v-for="item in resourceSubItems"
              :key="item.to"
              :to="item.to"
              class="nav-subitem"
              :class="{ 'nav-subitem--active': isActive(item) }"
            >
              <span class="nav-subitem__icon">{{ item.icon }}</span>
              <span class="nav-subitem__label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </Transition>

        <!-- Collapsed: show resource icons directly -->
        <div v-show="collapsed" class="nav-subgroup nav-subgroup--collapsed">
          <RouterLink
            v-for="item in resourceSubItems"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item--active': isActive(item) }"
            :title="item.label"
          >
            <span class="nav-item__icon">{{ item.icon }}</span>
          </RouterLink>
        </div>

        <!-- Divider -->
        <div class="sidebar__divider" />

        <!-- Bottom nav -->
        <RouterLink
          v-for="item in bottomNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item) }"
          :title="collapsed ? item.label : undefined"
        >
          <span class="nav-item__icon">{{ item.icon }}</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="nav-item__label">{{ item.label }}</span>
          </Transition>
        </RouterLink>
      </nav>

      <!-- Footer -->
      <div class="sidebar__footer">
        <!-- User section -->
        <div class="sidebar__user-section" v-show="user">
          <span class="sidebar__user-avatar">{{ userInitial }}</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="sidebar__user-name">{{ userName }}</span>
          </Transition>
        </div>

        <!-- Collapse toggle -->
        <button class="sidebar__collapse-btn" @click="toggleSidebar" :title="collapsed ? '展开侧边栏' : '折叠侧边栏'">
          <span class="sidebar__collapse-icon">{{ collapsed ? '»' : '«' }}</span>
          <Transition name="fade-text">
            <span v-show="!collapsed" class="sidebar__collapse-label">收起</span>
          </Transition>
        </button>
      </div>
    </aside>

    <!-- ========== Main area ========== -->
    <div class="main-area">
      <!-- TopBar -->
      <header class="topbar" :class="{ 'topbar--immersive': isImmersive }">
        <div class="topbar__left">
          <!-- Breadcrumb -->
          <nav v-if="!isImmersive && breadcrumbs.length" class="topbar__breadcrumb">
            <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
              <span v-if="idx > 0" class="topbar__breadcrumb-sep">/</span>
              <RouterLink
                :to="crumb.path"
                class="topbar__breadcrumb-link"
                :class="{ 'topbar__breadcrumb-link--current': idx === breadcrumbs.length - 1 }"
              >
                {{ crumb.title }}
              </RouterLink>
            </template>
          </nav>
          <!-- Immersive: back button -->
          <button v-if="isImmersive" class="topbar__back" @click="router.back()">
            <span class="topbar__back-arrow">←</span> 返回
          </button>
          <RouterLink v-if="isImmersive" to="/" class="topbar__home-link">首页</RouterLink>
          <span v-if="isImmersive && route.meta?.title" class="topbar__immersive-title">
            {{ route.meta.title }}
          </span>
        </div>

        <div class="topbar__right">
          <!-- Search -->
          <div v-if="!isImmersive" class="topbar__search">
            <svg class="topbar__search-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索项目、素材、工具..."
              class="topbar__search-input"
              @keyup.enter="onSearchEnter"
            />
            <kbd class="topbar__search-kbd">Ctrl+K</kbd>
          </div>
          <!-- Notification bell (STA-6) -->
          <NotificationBell />
          <!-- Avatar / Login -->
          <template v-if="user">
            <div class="topbar__user-wrap">
              <button class="topbar__avatar" @click="toggleUserDropdown" :title="userName">
                {{ userInitial }}
              </button>
              <Transition name="dropdown-fade">
                <div v-if="showUserDropdown" class="topbar__dropdown" @click.stop>
                  <div class="topbar__dropdown-header">
                    <span class="topbar__dropdown-avatar">{{ userInitial }}</span>
                    <div class="topbar__dropdown-info">
                      <div class="topbar__dropdown-name">{{ userName }}</div>
                      <div class="topbar__dropdown-email">{{ user?.email || user?.phone || '' }}</div>
                    </div>
                  </div>
                  <div class="topbar__dropdown-divider" />
                  <RouterLink to="/settings" class="topbar__dropdown-item" @click="showUserDropdown = false">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    设置
                  </RouterLink>
                  <button class="topbar__dropdown-item topbar__dropdown-item--danger" @click="confirmLogout">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    退出登录
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <template v-else>
            <button class="topbar__login-btn" @click="showLoginModal = true">登录</button>
          </template>
        </div>
      </header>

      <!-- Content -->
      <main class="content" :class="{ 'content--immersive': isImmersive }">
        <!-- Error boundary fallback -->
        <div v-if="childError" class="content-error">
          <div class="content-error__card">
            <div class="content-error__icon">⚠️</div>
            <h2 class="content-error__title">页面加载出错</h2>
            <p class="content-error__component">{{ childErrorComponent }}</p>
            <p class="content-error__msg">{{ childError }}</p>
            <div class="content-error__actions">
              <button class="content-error__btn content-error__btn--retry" @click="clearChildError">
                重试加载
              </button>
              <RouterLink to="/dashboard" class="content-error__btn content-error__btn--home">
                返回工作台
              </RouterLink>
            </div>
          </div>
        </div>
        <RouterView v-else v-slot="{ Component, route: viewRoute }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="viewRoute.fullPath" />
          </transition>
        </RouterView>
      </main>
    </div>

    
    <!-- ===== POL-3: Mobile bottom tab bar ===== -->
    <nav class="mobile-tabs" v-show="!isImmersive">
      <RouterLink to="/dashboard" class="mobile-tab" :class="{ 'mobile-tab--active': route.path === '/dashboard' }">
        <span class="mobile-tab__icon">◈</span>
        <span class="mobile-tab__label">工作台</span>
      </RouterLink>
      <RouterLink to="/create/animation" class="mobile-tab" :class="{ 'mobile-tab--active': route.path.startsWith('/create') }">
        <span class="mobile-tab__icon">🎬</span>
        <span class="mobile-tab__label">创作</span>
      </RouterLink>
      <RouterLink to="/projects" class="mobile-tab" :class="{ 'mobile-tab--active': route.path.startsWith('/projects') }">
        <span class="mobile-tab__icon">◇</span>
        <span class="mobile-tab__label">项目</span>
      </RouterLink>
      <RouterLink to="/materials" class="mobile-tab" :class="{ 'mobile-tab--active': route.path.startsWith('/materials') || route.path.startsWith('/works') }">
        <span class="mobile-tab__icon">📁</span>
        <span class="mobile-tab__label">素材</span>
      </RouterLink>
      <RouterLink to="/settings" class="mobile-tab" :class="{ 'mobile-tab--active': route.path === '/settings' }">
        <span class="mobile-tab__icon">⚙</span>
        <span class="mobile-tab__label">设置</span>
      </RouterLink>
    </nav>


    <!-- Toast notification -->
    <Transition name="toast-fade">
      <div v-if="toastMsg" class="layout-toast">{{ toastMsg }}</div>
    </Transition>

    <!-- Login Modal -->
    <LoginModal v-model="showLoginModal" />
  </div>
</template>

<style>
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Noto+Sans+SC:wght@500;700&family=JetBrains+Mono:wght@500&display=swap');
</style>

<style scoped>
/* ===== Design Tokens ===== */
.layout {
  /* F-08 对比度修复：改为跟随主题令牌，不再硬编码深色，避免覆盖浅色主题 */
  --bg-root: var(--bg-primary, #0E0F12);
  --bg-surface: var(--bg-secondary, #111113);
  --bg-elevated: var(--bg-secondary, #23262E);
  --bg-muted: var(--bg-secondary, #2E3139);
  --border-subtle: var(--border, #1E1E22);
  --border-default: var(--border, #2E3139);
  --border-accent: var(--accent, #00BFA5);
  --accent-hover: var(--accent, #0D9488);
  --accent-muted: var(--accent-soft, rgba(0, 191, 165, 0.12));
  --accent-secondary: var(--accent-strong, #7C3AED);
  --accent-secondary-muted: var(--accent-glow, rgba(124, 58, 237, 0.12));
  /* --text-primary / --text-secondary / --text-muted / --accent 交由主题与 :root 提供，本布局不再覆盖 */
  --font-sans: 'Plus Jakarta Sans', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;

  display: flex;
  min-height: 100vh;
  background: var(--bg-root);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== Sidebar ===== */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 50;
  transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar--collapsed {
  width: 56px;
}

/* Brand */
.sidebar__brand {
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sidebar__brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.sidebar__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%);
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  letter-spacing: -0.02em;
  white-space: nowrap;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__logo--collapsed {
  width: 30px;
  padding: 0;
  font-size: 14px;
}

.sidebar__brand-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: var(--text-primary);
}

/* Navigation */
.sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Nav items */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  transition: all 150ms ease;
  white-space: nowrap;
  position: relative;
  border-left: 3px solid transparent;
  margin-left: -3px;
}

.nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.nav-item--active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-weight: 600;
  border-left-color: var(--accent);
}

.nav-item__icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  line-height: 1;
}

.nav-item__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Divider */
.sidebar__divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 8px 12px;
  flex-shrink: 0;
}

/* Group toggle */
.nav-group {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: color 150ms ease;
  margin-top: 4px;
}

.nav-group:hover {
  color: var(--text-secondary);
}

.nav-group__icon {
  font-size: 10px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  transition: transform 200ms ease;
  opacity: 0.6;
}

.nav-group__label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-group__arrow {
  font-size: 11px;
  opacity: 0.4;
  transition: transform 200ms ease;
}

.nav-group__arrow--open {
  transform: rotate(0deg);
}

/* Sub-group */
.nav-subgroup {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
  margin-top: 2px;
}

.nav-subgroup--collapsed {
  padding-left: 0;
}

.nav-subitem {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px 0 24px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  transition: all 150ms ease;
  white-space: nowrap;
}

.nav-subitem:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.nav-subitem--active {
  background: var(--accent-muted);
  color: var(--accent);
}

.nav-subitem__icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  line-height: 1;
}

.nav-subitem__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.sidebar__footer {
  border-top: 1px solid var(--border-subtle);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.sidebar__user-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 2px;
}

.sidebar__user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.sidebar__user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__collapse-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 150ms ease;
}

.sidebar__collapse-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.sidebar__collapse-icon {
  font-size: 14px;
  font-weight: 700;
  width: 20px;
  text-align: center;
}

.sidebar__collapse-label {
  white-space: nowrap;
}

/* ===== Main area ===== */
.main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-root);
}

/* ===== TopBar ===== */
.topbar {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 40;
}

.topbar--immersive {
  background: rgba(9, 9, 11, 0.7);
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  border-bottom-color: rgba(255, 255, 255, 0.04);
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* Breadcrumb */
.topbar__breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
}

.topbar__breadcrumb-sep {
  color: var(--text-muted);
  flex-shrink: 0;
  font-size: 12px;
}

.topbar__breadcrumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
  transition: color 150ms ease;
  font-weight: 500;
}

.topbar__breadcrumb-link:hover {
  color: var(--text-primary);
}

.topbar__breadcrumb-link--current {
  color: var(--text-primary);
  font-weight: 600;
}

/* Immersive */
.topbar__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 150ms ease;
}

.topbar__back:hover {
  background: var(--bg-muted);
  color: var(--text-primary);
  border-color: var(--border-default);
}

.topbar__back-arrow {
  font-size: 14px;
}

.topbar__home-link {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 150ms ease;
}
.topbar__home-link:hover {
  background: var(--accent-muted);
}

.topbar__immersive-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Search */
.topbar__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  padding: 0 14px;
  height: 34px;
  min-width: 220px;
  max-width: 320px;
  transition: all 200ms ease;
}

.topbar__search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.topbar__search-svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.topbar__search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
  min-width: 0;
}

.topbar__search-input::placeholder {
  color: var(--text-muted);
}

.topbar__search-kbd {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-muted);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
  line-height: 1;
}

/* Icon button */
.topbar__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.topbar__icon-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

/* Avatar */
.topbar__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

.topbar__avatar:hover {
  border-color: var(--accent);
}

/* Login button */
.topbar__login-btn {
  padding: 7px 20px;
  border-radius: 20px;
  background: var(--accent);
  color: #09090B;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: all 200ms ease;
  letter-spacing: -0.01em;
}

.topbar__login-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 212, 170, 0.25);
}

/* User dropdown */
.topbar__user-wrap {
  position: relative;
}

.topbar__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03);
  z-index: 200;
}

.topbar__dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
}

.topbar__dropdown-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.topbar__dropdown-info {
  min-width: 0;
  flex: 1;
}

.topbar__dropdown-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar__dropdown-email {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__dropdown-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 6px;
}

.topbar__dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: all 150ms ease;
  text-align: left;
}

.topbar__dropdown-item:hover {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.topbar__dropdown-item--danger {
  color: #EF4444;
}

.topbar__dropdown-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #F87171;
}

/* ===== Content ===== */
.content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: var(--bg-root);
}

.content--immersive {
  overflow: hidden;
}

/* ===== Error boundary ===== */
.content-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 32px;
}

.content-error__card {
  text-align: center;
  max-width: 480px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 16px;
  padding: 40px 32px;
}

.content-error__icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.content-error__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  margin: 0 0 8px;
}

.content-error__component {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary, #64748b);
  margin: 0 0 8px;
  padding: 4px 10px;
  background: var(--bg-tertiary, #23262e);
  border-radius: 6px;
  display: inline-block;
}

.content-error__msg {
  font-size: 13px;
  color: #ef4444;
  line-height: 1.6;
  margin: 0 0 24px;
  word-break: break-word;
}

.content-error__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.content-error__btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 200ms;
  font-family: inherit;
}

.content-error__btn--retry {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: #fff;
  border: none;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.content-error__btn--retry:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.45);
}

.content-error__btn--home {
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  color: var(--text-primary, #f1f5f9);
}

.content-error__btn--home:hover {
  background: var(--bg-muted, #2a2d35);
}

/* ===== Route transition ===== */
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
  transform: translateY(-4px);
}

/* ===== Scrollbar ===== */
.sidebar::-webkit-scrollbar {
  width: 3px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* ===== Toast notification ===== */
.layout-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: none;
}

/* ===== Transitions ===== */
.fade-text-enter-active,
.fade-text-leave-active {
  transition: opacity 200ms ease;
}

.fade-text-enter-from,
.fade-text-leave-to {
  opacity: 0;
}

.slide-group-enter-active {
  transition: all 200ms ease;
  overflow: hidden;
}

.slide-group-leave-active {
  transition: all 150ms ease;
  overflow: hidden;
}

.slide-group-enter-from,
.slide-group-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-group-enter-to,
.slide-group-leave-from {
  opacity: 1;
  max-height: 400px;
}

.dropdown-fade-enter-active {
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-leave-active {
  transition: all 120ms ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.toast-fade-enter-active {
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-fade-leave-active {
  transition: all 200ms ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .sidebar {
    width: 56px;
  }

  .sidebar .sidebar__brand-text,
  .sidebar .nav-item__label,
  .sidebar .nav-group__label,
  .sidebar .nav-group__arrow,
  .sidebar .nav-subitem__label,
  .sidebar .sidebar__user-name,
  .sidebar .sidebar__collapse-label {
    display: none;
  }

  .sidebar .nav-subgroup:not(.nav-subgroup--collapsed) {
    display: none;
  }

  .sidebar .nav-subgroup--collapsed {
    display: flex;
  }
}

/* ===== POL-3: Mobile bottom tab bar ===== */
.mobile-tabs {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  height: 56px; background: var(--bg-surface, #111113);
  border-top: 1px solid var(--border-subtle, #1E1E22);
  padding: 0 8px; padding-bottom: env(safe-area-inset-bottom, 0);
}
.mobile-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px;
  color: var(--text-muted, #52525B); text-decoration: none;
  font-size: 10px; font-weight: 500;
  transition: color 150ms ease;
}
.mobile-tab--active { color: var(--accent, #00BFA5); }
.mobile-tab__icon { font-size: 20px; line-height: 1; }
.mobile-tab__label { font-size: 10px; }
@media (max-width: 768px) {
  .mobile-tabs { display: flex; }
  .sidebar { display: none; }
  .main-area { padding-bottom: 60px; }
  .topbar { padding: 0 12px; }
}

</style>
