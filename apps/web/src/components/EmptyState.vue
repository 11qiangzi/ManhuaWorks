<script setup lang="ts">
/**
 * EmptyState · 空状态引导卡片 (STA-1)
 * 陈远枢派单54: 千机工坊P2空状态设计
 */
defineProps<{
  icon?: string
  title: string
  description: string
  ctaText?: string
  ctaLink?: string
  secondaryText?: string
}>()

defineEmits<{
  (e: 'cta'): void
  (e: 'secondary'): void
}>()
</script>

<template>
  <div class="es-card">
    <div class="es-icon-wrap">
      <slot name="icon">
        <span class="es-icon">{{ icon || '📄' }}</span>
      </slot>
    </div>
    <h3 class="es-title">{{ title }}</h3>
    <p class="es-desc">{{ description }}</p>
    <div class="es-actions">
      <button v-if="ctaText" class="es-btn es-btn--primary" @click="$emit('cta')">
        {{ ctaText }}
      </button>
      <RouterLink v-if="ctaLink" :to="ctaLink" class="es-btn es-btn--primary">
        {{ ctaText || '开始' }}
      </RouterLink>
      <button v-if="secondaryText" class="es-btn es-btn--secondary" @click="$emit('secondary')">
        {{ secondaryText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.es-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 56px 24px; text-align: center;
  max-width: 480px; margin: 0 auto;
}
.es-icon-wrap {
  width: 80px; height: 80px; border-radius: 20px;
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.12), rgba(124, 58, 237, 0.12));
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px;
}
.es-icon { font-size: 36px; }
.es-title { font-size: 18px; font-weight: 700; margin: 0 0 8px; color: var(--text-primary); }
.es-desc { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; max-width: 320px; line-height: 1.6; }
.es-actions { display: flex; gap: 10px; }
.es-btn {
  padding: 9px 22px; border-radius: 20px;
  font-size: 13px; font-weight: 600; font-family: inherit;
  cursor: pointer; border: none; transition: all 200ms ease;
  text-decoration: none; display: inline-flex; align-items: center;
}
.es-btn--primary {
  background: var(--accent, #00BFA5); color: #09090B;
}
.es-btn--primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
.es-btn--secondary {
  background: var(--bg-elevated, #23262E);
  border: 1px solid var(--border-default, #2E3139);
  color: var(--text-secondary);
}
.es-btn--secondary:hover { border-color: var(--accent); color: var(--accent); }
</style>
