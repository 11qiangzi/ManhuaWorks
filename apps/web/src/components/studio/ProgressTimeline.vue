<script setup lang="ts">
/**
 * ProgressTimeline - 步骤进度时间线
 * ManhuaWorks studio component
 */

export interface TimelineStep {
  id: string
  label: string
  status: 'done' | 'active' | 'pending'
}

interface Props {
  steps: TimelineStep[]
}

const props = defineProps<Props>()
</script>

<template>
  <div class="timeline">
    <div
      v-for="(step, idx) in props.steps"
      :key="step.id"
      class="timeline__item"
      :class="`timeline__item--${step.status}`"
    >
      <!-- 连接线 -->
      <div v-if="idx > 0" class="timeline__line" :class="{ 'timeline__line--done': step.status === 'done' || (props.steps[idx - 1]?.status === 'done') }" />

      <!-- 节点 -->
      <div class="timeline__node">
        <span v-if="step.status === 'done'" class="timeline__icon timeline__icon--done">&#10003;</span>
        <span v-else-if="step.status === 'active'" class="timeline__icon timeline__icon--active">
          <span class="timeline__pulse" />
        </span>
        <span v-else class="timeline__icon timeline__icon--pending">{{ idx + 1 }}</span>
      </div>

      <!-- 标签 -->
      <span class="timeline__label">{{ step.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow-x: auto;
}

.timeline__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 80px;
  position: relative;
}

.timeline__line {
  position: absolute;
  top: 14px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--border);
  z-index: 0;
}

.timeline__line--done {
  background: var(--accent);
}

.timeline__node {
  position: relative;
  z-index: 1;
}

.timeline__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  transition: all 200ms;
}

.timeline__icon--done {
  background: var(--accent);
  color: var(--bg-primary);
}

.timeline__icon--active {
  background: var(--accent);
  color: var(--bg-primary);
  position: relative;
}

.timeline__pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bg-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.6); opacity: 0.5; }
}

.timeline__icon--pending {
  background: var(--bg-primary);
  border: 2px solid var(--border);
  color: var(--text-secondary);
}

.timeline__label {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
}

.timeline__item--done .timeline__label {
  color: var(--accent);
  font-weight: 500;
}

.timeline__item--active .timeline__label {
  color: var(--text-primary);
  font-weight: 600;
}

@media (max-width: 640px) {
  .timeline { padding: 12px; }
  .timeline__item { min-width: 60px; }
  .timeline__label { font-size: 10px; }
}
</style>
