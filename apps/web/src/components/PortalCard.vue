<script setup lang="ts">
/**
 * PortalCard · 后台入口卡片
 * ManhuaWorks · W1 交付
 *
 * 用于 HomeView 展示 4 大后台入口：
 * - 用户后台 app.mhwork
 * - 业务总后台 ops.mhwork
 * - 平台总后台 admin.mhwork
 * - 开发者后台 dev.mhwork
 *
 * 同时支持创作者工作台入口（独立子站，可选）。
 */

interface PortalInfo {
  id: string
  title: string
  subtitle: string
  desc: string
  icon: string
  href: string
  /** 是否需要登录态 */
  requiresAuth?: boolean
  /** 标签色：primary / accent / warning / success */
  badge?: 'primary' | 'accent' | 'warning' | 'success' | 'info'
  /** 可选标签文案 */
  badgeText?: string
}

interface Props {
  portal: PortalInfo
  /** 点击行为：外部链接 / 内部路由 / 提示 */
  variant?: 'external' | 'internal' | 'soon'
}

const props = withDefaults(defineProps<Props>(), { variant: 'external' })
const emit = defineEmits<{ enter: [id: string] }>()

function onClick() {
  if (props.variant === 'soon') return
  if (props.variant === 'internal') {
    emit('enter', props.portal.id)
    return
  }
  // external — 用 window.open，避免直接跳转
  window.open(props.portal.href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <button
    type="button"
    class="portal-card"
    :class="[`portal-card--${variant}`, `portal-card--${portal.badge ?? 'primary'}`]"
    :disabled="variant === 'soon'"
    @click="onClick"
  >
    <div class="portal-card__icon">{{ portal.icon }}</div>
    <div class="portal-card__body">
      <div class="portal-card__header">
        <h3 class="portal-card__title">{{ portal.title }}</h3>
        <span v-if="portal.badgeText" class="portal-card__badge">
          {{ portal.badgeText }}
        </span>
      </div>
      <p class="portal-card__subtitle">{{ portal.subtitle }}</p>
      <p class="portal-card__desc">{{ portal.desc }}</p>
    </div>
    <div class="portal-card__arrow" v-if="variant !== 'soon'">→</div>
    <div class="portal-card__lock" v-else>🔒</div>
  </button>
</template>

<style scoped>
.portal-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  padding: 20px 22px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: var(--text-primary);
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.portal-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 300ms;
}

.portal-card:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.portal-card:hover:not(:disabled)::before {
  opacity: 1;
}

.portal-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.portal-card__icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.portal-card__body {
  flex: 1;
  min-width: 0;
}

.portal-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.portal-card__title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.portal-card__badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg-primary);
}

.portal-card--info .portal-card__badge {
  background: color-mix(in srgb, #3b82f6 80%, var(--bg-primary));
  color: white;
}

.portal-card--warning .portal-card__badge {
  background: var(--warning);
  color: #1a1a1a;
}

.portal-card--success .portal-card__badge {
  background: var(--success);
  color: #042f0d;
}

.portal-card__subtitle {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
}

.portal-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.portal-card__arrow {
  font-size: 20px;
  color: var(--text-secondary);
  align-self: center;
  flex-shrink: 0;
  transition: transform 300ms, color 300ms;
}

.portal-card:hover:not(:disabled) .portal-card__arrow {
  color: var(--accent);
  transform: translateX(4px);
}

.portal-card__lock {
  font-size: 16px;
  align-self: center;
  flex-shrink: 0;
  opacity: 0.5;
}
</style>
