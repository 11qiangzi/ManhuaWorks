<script setup lang="ts">
/**
 * UserCard.vue · 用户卡片（用于侧栏/顶栏）
 * ManhuaWorks · W4 用户后台
 */

import { computed } from 'vue'
import PlanBadge from './PlanBadge.vue'
import type { UserProfile } from '@/api/user-service'

interface Props {
  user: UserProfile | null
  /** 紧凑模式（用于顶栏） */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), { compact: false })

defineEmits<{
  logout: []
  settings: []
}>()

const initials = computed(() => {
  if (!props.user?.nickname) return '?'
  return props.user.nickname.charAt(0).toUpperCase()
})
</script>

<template>
  <div class="user-card" :class="{ 'user-card--compact': compact }">
    <!-- 头像 -->
    <div class="user-card__avatar">
      <img v-if="user?.avatar" :src="user.avatar" :alt="user.nickname" />
      <span v-else>{{ initials }}</span>
    </div>

    <!-- 信息 -->
    <div v-if="!compact" class="user-card__body">
      <p class="user-card__name">{{ user?.nickname ?? '创作者' }}</p>
      <p class="user-card__email">{{ user?.email ?? user?.phone ?? '未设置' }}</p>
      <PlanBadge v-if="user?.plan" :plan="user.plan" />
    </div>
    <div v-else class="user-card__body user-card__body--compact">
      <span class="user-card__name">{{ user?.nickname ?? '创作者' }}</span>
      <PlanBadge v-if="user?.plan" :plan="user.plan" size="sm" />
    </div>

    <!-- 操作 -->
    <div v-if="!compact" class="user-card__actions">
      <button type="button" class="user-card__btn" @click="$emit('settings')">⚙ 设置</button>
      <button type="button" class="user-card__btn user-card__btn--danger" @click="$emit('logout')">退出</button>
    </div>
  </div>
</template>

<style scoped>
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 200ms;
}

.user-card--compact {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
}

.user-card--compact:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.user-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--gradient);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  overflow: hidden;
  flex-shrink: 0;
}

.user-card--compact .user-card__avatar {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.user-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-card__body {
  flex: 1;
  min-width: 0;
}

.user-card__body--compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-card__name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 2px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-card__body--compact .user-card__name {
  font-size: 13px;
  margin: 0;
}

.user-card__email {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-card__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-card__btn {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.user-card__btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.user-card__btn--danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>