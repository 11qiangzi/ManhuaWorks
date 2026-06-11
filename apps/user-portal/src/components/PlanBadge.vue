<script setup lang="ts">
/**
 * PlanBadge.vue · 订阅等级徽章
 * ManhuaWorks · W4 用户后台
 */

import { computed } from 'vue'
import { PLAN_META, type UserPlan } from '@/api/user-service'

interface Props {
  plan: UserPlan
  /** 大小 */
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), { size: 'md' })

const meta = computed(() => PLAN_META[props.plan])
</script>

<template>
  <span class="plan-badge" :class="[`plan-badge--${size}`, `plan-badge--${plan}`]">
    <span class="plan-badge__dot" :style="{ background: meta.color }"></span>
    <span class="plan-badge__label">{{ meta.label }}</span>
  </span>
</template>

<style scoped>
.plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.plan-badge--sm {
  padding: 1px 7px;
  font-size: 10px;
  gap: 4px;
}

.plan-badge--lg {
  padding: 4px 14px;
  font-size: 13px;
  gap: 8px;
}

.plan-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.plan-badge--sm .plan-badge__dot {
  width: 5px;
  height: 5px;
}

.plan-badge--free .plan-badge__label {
  color: var(--text-secondary);
}

.plan-badge--basic .plan-badge__label {
  color: #2563eb;
}

.plan-badge--pro .plan-badge__label {
  color: var(--accent);
}

.plan-badge--enterprise {
  background: linear-gradient(135deg, rgba(168, 48, 43, 0.15), rgba(168, 48, 43, 0.05));
  border-color: #a8302b;
}

.plan-badge--enterprise .plan-badge__label {
  background: linear-gradient(135deg, #a8302b, #5c1c1a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 600;
}
</style>