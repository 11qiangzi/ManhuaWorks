<template>
  <div class="notification-center relative">
    <button
      type="button"
      class="notification-bell relative p-2 rounded-full hover:bg-gray-100"
      :aria-label="`通知 (${unreadCount} 未读)`"
      @click="togglePanel"
    >
      <span class="text-xl">🔔</span>
      <span
        v-if="unreadCount > 0"
        class="notification-badge absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <Transition name="notification-panel">
      <div
        v-if="panelOpen"
        class="notification-panel absolute right-0 mt-2 w-80 max-h-[480px] overflow-auto bg-white rounded-lg shadow-xl border border-gray-200 z-40"
      >
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <h3 class="font-medium text-sm">通知</h3>
          <button
            type="button"
            class="text-xs text-blue-500 hover:underline disabled:text-gray-300 disabled:no-underline"
            :disabled="unreadCount === 0"
            @click="markAllAsRead"
          >
            全部已读
          </button>
        </div>

        <div v-if="items.length === 0" class="py-12 text-center text-sm text-gray-400">
          暂无通知
        </div>

        <div v-else>
          <template v-for="(group, label) in grouped" :key="label">
            <div v-if="group.length > 0">
              <p class="px-3 pt-2 pb-1 text-[11px] text-gray-400">{{ groupLabel(label) }}</p>
              <NotificationItem
                v-for="n in group"
                :key="n.id"
                :item="n"
                @click="onItemClick(n)"
              />
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useNotification } from '../composables/useNotification'
import type { NotificationItem as NItem } from '../stores/notification'
import NotificationItem from './NotificationItem.vue'

const {
  items,
  unreadCount,
  panelOpen,
  grouped,
  markAsRead,
  markAllAsRead,
  togglePanel
} = useNotification()

function onItemClick(n: NItem) {
  markAsRead(n.id)
}

function groupLabel(label: string): string {
  if (label === 'today') return '今天'
  if (label === 'yesterday') return '昨天'
  return '更早'
}
</script>

<style scoped>
.notification-panel-enter-active,
.notification-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.notification-panel-enter-from,
.notification-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
