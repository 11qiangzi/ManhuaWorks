<script setup lang="ts">
/**
 * KeyStatusBadge · Key 状态徽章
 * 状态：valid / expiring / invalid / unset
 * 颜色全部走主题 CSS 变量
 */

import { computed } from 'vue'
import type { KeyStatus } from '@/api/byok'
import { keyStatusText, keyStatusVar } from '@/api/byok'

interface Props {
  status: KeyStatus
  /** 紧凑模式（无文字，仅色点） */
  compact?: boolean
  /** 自定义标题 */
  title?: string
}

const props = withDefaults(defineProps<Props>(), { compact: false, title: undefined })

const label = computed(() => keyStatusText(props.status))
const colorVar = computed(() => `var(${keyStatusVar(props.status)})`)
const icon = computed(() => {
  switch (props.status) {
    case 'valid': return '✓'
    case 'expiring': return '⚠'
    case 'invalid': return '✗'
    case 'unset': return '○'
    default: return '?'
  }
})
</script>

<template>
  <span
    class="key-badge"
    :class="[`key-badge--${status}`, { 'key-badge--compact': compact }]"
    :title="title ?? label"
    :style="{ '--badge-color': colorVar }"
  >
    <span class="key-badge__icon" aria-hidden="true">{{ icon }}</span>
    <span v-if="!compact" class="key-badge__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  border: 1px solid color-mix(in srgb, var(--badge-color) 35%, transparent);
  background: color-mix(in srgb, var(--badge-color) 12%, transparent);
  color: var(--badge-color);
  white-space: nowrap;
}

.key-badge--compact {
  padding: 3px;
  width: 18px;
  height: 18px;
  justify-content: center;
}

.key-badge__icon {
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}

.key-badge--expiring .key-badge__icon {
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
