<script setup lang="ts">
/**
 * NotificationBell · 通知铃铛 + 通知下拉浮层 (STA-6)
 * 陈远枢派单54: 千机工坊P2通知系统
 */
import { ref, computed } from 'vue'

interface Notification {
  id: string
  type: 'success' | 'fail' | 'info' | 'share'
  icon: string
  title: string
  body: string
  time: string
  read: boolean
  link?: string
}

const showPanel = ref(false)
const notifications = ref<Notification[]>([
  { id: '1', type: 'success', icon: '✅', title: '生成完成', body: '《都市爱情》第3章已生成', time: '5分钟前', read: false },
  { id: '2', type: 'share', icon: '👁️', title: '作品被查看', body: '有人查看了你的作品《剑破苍穹》', time: '1小时前', read: false },
  { id: '3', type: 'fail', icon: '❌', title: '生成失败', body: '宣传片《品牌故事》生成失败，请重试', time: '2小时前', read: true },
])

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

function togglePanel() {
  showPanel.value = !showPanel.value
}

function closePanel() {
  showPanel.value = false
}

function markAllRead() {
  notifications.value.forEach(n => { n.read = true })
}

function getTypeClass(type: Notification['type']): string {
  return `n-type--${type}`
}

// Expose: add notification from parent
function add(n: Omit<Notification, 'id' | 'time' | 'read'>) {
  notifications.value.unshift({
    ...n,
    id: Date.now().toString(),
    time: '刚刚',
    read: false,
  })
}

defineExpose({ add })
</script>

<template>
  <div class="notif-bell-wrap">
    <button class="notif-bell-btn" :title="`${unreadCount} 条未读通知`" @click="togglePanel">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </svg>
      <span v-if="unreadCount > 0" class="notif-bell-badge">{{ unreadCount }}</span>
    </button>

    <Transition name="n-dropdown">
      <div v-if="showPanel" class="notif-panel" @click.stop>
        <div class="notif-panel-header">
          <h3 class="notif-panel-title">通知</h3>
          <button v-if="unreadCount > 0" class="notif-mark-read" @click="markAllRead">全部已读</button>
        </div>

        <div v-if="notifications.length === 0" class="notif-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <p>暂无通知</p>
        </div>

        <div v-else class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="[getTypeClass(n.type), { 'notif-item--unread': !n.read }]"
          >
            <span class="notif-item-icon">{{ n.icon }}</span>
            <div class="notif-item-body">
              <span class="notif-item-title">{{ n.title }}</span>
              <span class="notif-item-text">{{ n.body }}</span>
            </div>
            <span class="notif-item-time">{{ n.time }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Backdrop -->
    <Transition name="n-fade">
      <div v-if="showPanel" class="notif-backdrop" @click="closePanel" />
    </Transition>
  </div>
</template>

<style scoped>
.notif-bell-wrap { position: relative; }
.notif-bell-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 8px;
  background: transparent; border: none;
  color: var(--text-muted); cursor: pointer;
  transition: all 150ms ease;
  position: relative;
}
.notif-bell-btn:hover { background: var(--bg-elevated, #23262E); color: var(--text-secondary); }
.notif-bell-badge {
  position: absolute; top: 2px; right: 2px;
  min-width: 16px; height: 16px; border-radius: 8px;
  background: #EF4444; color: #fff;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
}

.notif-panel {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 360px; max-height: 420px;
  background: var(--bg-elevated, #23262E);
  border: 1px solid var(--border-default, #2E3139);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  z-index: 200; overflow: hidden;
  display: flex; flex-direction: column;
}
.notif-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle, #1E1E22);
}
.notif-panel-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
.notif-mark-read {
  background: none; border: none; color: var(--accent);
  font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit;
}

.notif-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 40px 16px;
  color: var(--text-muted);
}
.notif-empty p { font-size: 13px; margin: 0; }

.notif-list { overflow-y: auto; flex: 1; }
.notif-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle, #1E1E22);
  transition: background 150ms ease;
  cursor: pointer;
}
.notif-item:hover { background: var(--bg-muted, #2E3139); }
.notif-item--unread { background: rgba(0, 191, 165, 0.04); }
.notif-item-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.notif-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.notif-item-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.notif-item-text { font-size: 12px; color: var(--text-secondary); }
.notif-item-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; white-space: nowrap; }

.n-type--fail .notif-item-icon { color: #EF4444; }

.notif-backdrop { position: fixed; inset: 0; z-index: 199; }

/* Transitions */
.n-dropdown-enter-active { transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); }
.n-dropdown-leave-active { transition: all 120ms ease; }
.n-dropdown-enter-from, .n-dropdown-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.n-fade-enter-active { transition: opacity 200ms ease; }
.n-fade-leave-active { transition: opacity 120ms ease; }
.n-fade-enter-from, .n-fade-leave-to { opacity: 0; }
</style>
