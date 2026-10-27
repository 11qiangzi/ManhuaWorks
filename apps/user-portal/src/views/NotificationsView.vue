<script setup lang="ts">
/**
 * NotificationsView · 通知中心
 * 千机工坊 · 用户后台
 *
 * 功能：
 * 1. 通知列表（游标分页）
 * 2. 标记已读 / 未读
 * 3. 按类型筛选（系统 / 项目 / 账单 / 协作）
 * 4. 全部已读
 * 5. 空状态
 */

import { ref, computed, onMounted, watch } from 'vue'
import { notificationService, NOTIF_TYPE_META, type Notification, type NotificationType } from '@/api/notification-service'

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const notifications = ref<Notification[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const nextCursor = ref<string | null>(null)
const totalCount = ref(0)
const activeFilter = ref<NotificationType | 'all'>('all')
const PAGE_SIZE = 20

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const typeParam = activeFilter.value === 'all' ? null : activeFilter.value
    const res = await notificationService.list(PAGE_SIZE, null, typeParam)
    notifications.value = res.list
    nextCursor.value = res.nextCursor
    totalCount.value = res.total
  } catch (e: any) {
    error.value = e?.message || '加载通知失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const typeParam = activeFilter.value === 'all' ? null : activeFilter.value
    const res = await notificationService.list(PAGE_SIZE, nextCursor.value, typeParam)
    notifications.value.push(...res.list)
    nextCursor.value = res.nextCursor
    totalCount.value = res.total
  } catch {
    /* 静默 */
  } finally {
    loadingMore.value = false
  }
}

onMounted(load)

watch(activeFilter, () => {
  notifications.value = []
  nextCursor.value = null
  load()
})

/* ------------------------------------------------------------------ */
/*                          操作                                       */
/* ------------------------------------------------------------------ */

async function toggleRead(n: Notification): Promise<void> {
  const wasRead = n.read
  n.read = !wasRead
  if (wasRead) {
    await notificationService.markUnread(n.id)
  } else {
    await notificationService.markRead(n.id)
  }
}

async function markAllRead(): Promise<void> {
  await notificationService.markAllRead()
  notifications.value.forEach((n) => (n.read = true))
}

/* ------------------------------------------------------------------ */
/*                          衍生                                       */
/* ------------------------------------------------------------------ */

const FILTERS: { id: NotificationType | 'all'; label: string; icon: string }[] = [
  { id: 'all',     label: '全部', icon: '📋' },
  { id: 'system',  label: '系统', icon: NOTIF_TYPE_META.system.icon },
  { id: 'project', label: '项目', icon: NOTIF_TYPE_META.project.icon },
  { id: 'billing', label: '账单', icon: NOTIF_TYPE_META.billing.icon },
  { id: 'collab',  label: '协作', icon: NOTIF_TYPE_META.collab.icon }
]

const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)
const hasMore = computed(() => !!nextCursor.value)

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <main class="nv">
    <!-- 头部 -->
    <section class="nv__header">
      <div>
        <h1 class="nv__title">🔔 通知中心</h1>
        <p class="nv__sub">
          共 {{ totalCount }} 条通知
          <span v-if="unreadCount > 0" class="nv__unread-badge">{{ unreadCount }} 条未读</span>
        </p>
      </div>
      <button
        v-if="unreadCount > 0"
        type="button"
        class="nv__btn nv__btn--ghost"
        @click="markAllRead"
      >全部标为已读</button>
    </section>

    <!-- 筛选 -->
    <section class="nv__filters">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        type="button"
        class="nv__chip"
        :class="{ 'nv__chip--active': activeFilter === f.id }"
        @click="activeFilter = f.id"
      >
        <span>{{ f.icon }}</span>
        <span>{{ f.label }}</span>
      </button>
    </section>

    <!-- 加载中 -->
    <section v-if="loading" class="nv__state">
      <div class="nv__spinner"></div>
      <p>加载中…</p>
    </section>

    <!-- 错误 -->
    <section v-else-if="error" class="nv__state nv__state--error">
      <p>{{ error }}</p>
      <button type="button" class="nv__btn nv__btn--ghost" @click="load">重试</button>
    </section>

    <!-- 空状态 -->
    <section v-else-if="notifications.length === 0" class="nv__state nv__state--empty">
      <div class="nv__empty-icon">🔕</div>
      <p class="nv__empty-title">暂无通知</p>
      <p class="nv__empty-desc">
        {{ activeFilter === 'all' ? '你还没有收到任何通知' : `没有${FILTERS.find(f => f.id === activeFilter)?.label || ''}类型的通知` }}
      </p>
    </section>

    <!-- 通知列表 -->
    <section v-else class="nv__list">
      <article
        v-for="n in notifications"
        :key="n.id"
        class="nv__item"
        :class="{ 'nv__item--unread': !n.read }"
      >
        <div class="nv__item-icon" :style="{ background: NOTIF_TYPE_META[n.type]?.color + '18' }">
          {{ NOTIF_TYPE_META[n.type]?.icon || '📌' }}
        </div>
        <div class="nv__item-body">
          <div class="nv__item-top">
            <span class="nv__item-type" :style="{ color: NOTIF_TYPE_META[n.type]?.color }">
              {{ NOTIF_TYPE_META[n.type]?.label || n.type }}
            </span>
            <span class="nv__item-time">{{ formatTime(n.createdAt) }}</span>
          </div>
          <p class="nv__item-title">{{ n.title }}</p>
          <p class="nv__item-desc">{{ n.body }}</p>
          <a v-if="n.link" :href="n.link" class="nv__item-link" target="_blank">查看详情 →</a>
        </div>
        <button
          type="button"
          class="nv__item-toggle"
          :title="n.read ? '标为未读' : '标为已读'"
          @click="toggleRead(n)"
        >
          <span class="nv__dot" :class="{ 'nv__dot--read': n.read, 'nv__dot--unread': !n.read }"></span>
        </button>
      </article>
    </section>

    <!-- 加载更多 -->
    <div v-if="!loading && hasMore" class="nv__more">
      <button
        type="button"
        class="nv__btn nv__btn--ghost"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
/* ============================================================
   NotificationsView
   ============================================================ */
.nv {
  max-width: 860px;
  margin: 0 auto;
  padding: 28px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ===== 头部 ===== */
.nv__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.nv__title { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.nv__sub { font-size: 13px; color: var(--text-secondary); margin: 0; display: flex; align-items: center; gap: 8px; }
.nv__unread-badge {
  display: inline-block;
  background: var(--color-brand-primary, #7C3AED);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 99px;
}

/* ===== 按钮 ===== */
.nv__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}
.nv__btn:hover:not(:disabled) { background: var(--bg-tertiary); }
.nv__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.nv__btn--ghost { background: transparent; }
.nv__btn--ghost:hover:not(:disabled) { background: var(--bg-tertiary); }

/* ===== 筛选 ===== */
.nv__filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nv__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
}
.nv__chip:hover { border-color: var(--border-strong); color: var(--text-primary); }
.nv__chip--active {
  background: var(--color-brand-primary, #7C3AED);
  color: #fff;
  border-color: var(--color-brand-primary, #7C3AED);
}

/* ===== 状态 ===== */
.nv__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--text-secondary);
}
.nv__state--error { color: var(--danger, #ef4444); }
.nv__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--color-brand-primary, #7C3AED);
  border-radius: 50%;
  animation: nv-spin 0.8s linear infinite;
}
@keyframes nv-spin { to { transform: rotate(360deg); } }

/* ===== 空状态 ===== */
.nv__state--empty { padding: 80px 20px; }
.nv__empty-icon { font-size: 48px; opacity: 0.4; }
.nv__empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0; }
.nv__empty-desc { font-size: 13px; color: var(--text-muted); margin: 0; }

/* ===== 通知列表 ===== */
.nv__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nv__item {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 150ms;
  align-items: flex-start;
}
.nv__item:hover { border-color: var(--border-strong); }
.nv__item--unread {
  border-left: 3px solid var(--color-brand-primary, #7C3AED);
  background: color-mix(in srgb, var(--color-brand-primary, #7C3AED) 3%, var(--bg-secondary));
}

.nv__item-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.nv__item-body { flex: 1; min-width: 0; }
.nv__item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.nv__item-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.nv__item-time { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.nv__item-title { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
.nv__item-desc { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.nv__item-link {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-brand-primary, #7C3AED);
  text-decoration: none;
  font-weight: 600;
}
.nv__item-link:hover { text-decoration: underline; }

.nv__item-toggle {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nv__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: all 150ms;
}
.nv__dot--unread { background: var(--color-brand-primary, #7C3AED); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand-primary, #7C3AED) 30%, transparent); }
.nv__dot--read { background: var(--border); }

/* ===== 加载更多 ===== */
.nv__more {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .nv { padding: 16px; }
  .nv__header { flex-direction: column; align-items: flex-start; }
  .nv__item { padding: 12px; gap: 10px; }
  .nv__item-icon { width: 34px; height: 34px; font-size: 15px; }
}
</style>
