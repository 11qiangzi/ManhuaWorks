<template>
  <div class="auto-score-btn" :class="[`auto-score-btn--${status}`]">
    <!-- 主按钮 -->
    <button
      type="button"
      class="auto-score-btn__main"
      :disabled="disabled || isProcessing"
      @click="handleClick"
    >
      <!-- 旋转加载图标 -->
      <svg
        v-if="isProcessing"
        class="auto-score-btn__spinner"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-width="2" d="M12 2a10 10 0 019.95 9" />
      </svg>

      <!-- 完成图标 -->
      <svg
        v-else-if="status === 'complete'"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        class="auto-score-btn__icon"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>

      <!-- 错误图标 -->
      <svg
        v-else-if="status === 'error' || status === 'timeout'"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        class="auto-score-btn__icon"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
      </svg>

      <!-- 默认 AI 图标 -->
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        class="auto-score-btn__icon"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.378 3.378 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>

      <span class="auto-score-btn__text">{{ statusLabel }}</span>
    </button>

    <!-- 进度条（处理中显示） -->
    <div v-if="isProcessing" class="auto-score-btn__progress-track">
      <div
        class="auto-score-btn__progress-fill"
        :style="{ width: `${clampedProgress}%` }"
      />
      <span class="auto-score-btn__progress-text">{{ clampedProgress }}%</span>
    </div>

    <!-- 操作按钮区 -->
    <div v-if="isProcessing || status === 'error' || status === 'timeout'" class="auto-score-btn__extra">
      <button
        v-if="isProcessing"
        type="button"
        class="auto-score-btn__cancel"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        v-if="status === 'error' || status === 'timeout'"
        type="button"
        class="auto-score-btn__retry"
        @click="emit('retry')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="auto-score-btn__retry-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        重试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AutoScoreStatus } from './types';

interface Props {
  /** 自动配乐状态 */
  status?: AutoScoreStatus;
  /** 进度 0-100 */
  progress?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  status: 'idle',
  progress: 0,
  disabled: false,
});

const emit = defineEmits<{
  click: [];
  cancel: [];
  retry: [];
}>();

const STATUS_LABELS: Record<AutoScoreStatus, string> = {
  idle: 'AI 智能配乐',
  analyzing: '分析中...',
  matching: '匹配中...',
  generating: '生成中...',
  mixing: '混音中...',
  complete: '配乐完成',
  error: '配乐出错',
  timeout: '配乐超时',
};

const statusLabel = computed(() => STATUS_LABELS[props.status]);

const isProcessing = computed(() =>
  ['analyzing', 'matching', 'generating', 'mixing'].includes(props.status)
);

const clampedProgress = computed(() =>
  Math.round(Math.max(0, Math.min(100, props.progress)))
);

function handleClick() {
  if (props.disabled || isProcessing.value) return;
  emit('click');
}
</script>

<style scoped>
.auto-score-btn {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  font-family: inherit;
}

.auto-score-btn__main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  color: #fff;
  background: linear-gradient(135deg, #00BFA5 0%, #7C3AED 100%);
  box-shadow: 0 2px 8px rgba(0, 191, 165, 0.25);
}

.auto-score-btn__main:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(0, 191, 165, 0.35);
  transform: translateY(-1px);
}

.auto-score-btn__main:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.auto-score-btn--complete .auto-score-btn__main {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
}

.auto-score-btn--error .auto-score-btn__main,
.auto-score-btn--timeout .auto-score-btn__main {
  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
}

.auto-score-btn__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.auto-score-btn__spinner {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.auto-score-btn__text {
  white-space: nowrap;
}

/* 进度条 */
.auto-score-btn__progress-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.auto-score-btn__progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #00BFA5, #7C3AED);
  transition: width 0.3s ease;
}

.auto-score-btn__progress-text {
  position: absolute;
  right: 0;
  top: -16px;
  font-size: 10px;
  color: var(--color-text-secondary, #9ca3af);
  font-variant-numeric: tabular-nums;
}

/* 额外操作 */
.auto-score-btn__extra {
  display: flex;
  gap: 8px;
}

.auto-score-btn__cancel {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.auto-score-btn__cancel:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.auto-score-btn__retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  color: #F87171;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.auto-score-btn__retry:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
}

.auto-score-btn__retry-icon {
  width: 14px;
  height: 14px;
}
</style>
