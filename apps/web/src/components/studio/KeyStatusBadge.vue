<script setup lang="ts">
/**
 * KeyStatusBadge - API Key 状态徽章
 * ManhuaWorks studio component
 */

interface Props {
  status: 'valid' | 'expiring' | 'invalid' | string
}

const props = defineProps<Props>()

const STATUS_CONFIG: Record<string, { label: string; tone: string }> = {
  valid: { label: '有效', tone: 'success' },
  expiring: { label: '即将过期', tone: 'warning' },
  invalid: { label: '失效', tone: 'danger' }
}

const config = STATUS_CONFIG[props.status] ?? { label: props.status, tone: 'neutral' }
</script>

<template>
  <span class="key-badge" :class="`key-badge--${config.tone}`">
    <span class="key-badge__dot" />
    <span class="key-badge__label">{{ config.label }}</span>
  </span>
</template>

<style scoped>
.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.key-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.key-badge--success {
  background: color-mix(in srgb, var(--success, #22c55e) 14%, transparent);
  color: var(--success, #22c55e);
}
.key-badge--success .key-badge__dot {
  background: var(--success, #22c55e);
}

.key-badge--warning {
  background: color-mix(in srgb, var(--warning, #f59e0b) 14%, transparent);
  color: var(--warning, #f59e0b);
}
.key-badge--warning .key-badge__dot {
  background: var(--warning, #f59e0b);
  animation: blink 1.2s ease-in-out infinite;
}

.key-badge--danger {
  background: color-mix(in srgb, var(--danger, #ef4444) 14%, transparent);
  color: var(--danger, #ef4444);
}
.key-badge--danger .key-badge__dot {
  background: var(--danger, #ef4444);
}

.key-badge--neutral {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.key-badge--neutral .key-badge__dot {
  background: var(--text-secondary);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
