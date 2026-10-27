<script setup lang="ts">
/**
 * ErrorState · 友好错误态 (STA-3)
 * 陈远枢派单54: 千机工坊P2错误态
 */
defineProps<{
  title?: string
  message: string
  retryText?: string
}>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="err-card">
    <div class="err-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
    </div>
    <div class="err-body">
      <h3 class="err-title">{{ title || '加载失败' }}</h3>
      <p class="err-msg">{{ message }}</p>
    </div>
    <button
      v-if="retryText !== undefined ? retryText : true"
      class="err-btn"
      @click="$emit('retry')"
    >
      {{ typeof retryText === 'string' ? retryText : '重试' }}
    </button>
  </div>
</template>

<style scoped>
.err-card {
  display: flex; align-items: center; gap: 14px;
  max-width: 560px; margin: 24px auto 0;
  padding: 16px 20px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
}
.err-icon { color: #EF4444; flex-shrink: 0; }
.err-body { flex: 1; min-width: 0; }
.err-title { font-size: 14px; font-weight: 600; color: #F87171; margin: 0 0 2px; }
.err-msg { font-size: 13px; color: var(--text-secondary, #9CA3AF); margin: 0; }
.err-btn {
  padding: 7px 18px; border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px; background: rgba(239, 68, 68, 0.1);
  color: #EF4444; font-size: 13px; font-weight: 600;
  font-family: inherit; cursor: pointer; white-space: nowrap;
  transition: all 150ms ease; flex-shrink: 0;
}
.err-btn:hover { background: rgba(239, 68, 68, 0.18); border-color: #EF4444; }
</style>
