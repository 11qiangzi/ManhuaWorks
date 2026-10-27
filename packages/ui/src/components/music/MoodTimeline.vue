<template>
  <div class="mood-timeline" :class="{ 'mood-timeline--interactive': interactive }">
    <!-- 头部控制 -->
    <div class="mood-timeline__header">
      <span class="mood-timeline__title">情绪时间线</span>
      <div class="mood-timeline__time-display">
        <span class="mood-timeline__current-time">{{ formatTime(currentTime) }}</span>
        <span class="mood-timeline__separator">/</span>
        <span class="mood-timeline__total-time">{{ formatTime(totalDuration) }}</span>
      </div>
      <button
        v-if="interactive"
        type="button"
        class="mood-timeline__advanced-btn"
        @click="emit('switch-advanced')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="mood-timeline__advanced-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        高级
      </button>
    </div>

    <!-- 时间轴轨道 -->
    <div
      ref="timelineRef"
      class="mood-timeline__track"
      :style="{ width: `${timelineWidth}px` }"
      @click="onTrackClick"
      @mousemove="onTrackHover"
      @mouseleave="hoveredSegment = null"
    >
      <!-- 段色块 -->
      <div
        v-for="seg in segments"
        :key="seg.id"
        class="mood-timeline__segment"
        :class="{
          'mood-timeline__segment--hovered': hoveredSegment === seg.id,
          'mood-timeline__segment--active': isSegmentActive(seg),
        }"
        :style="segmentStyle(seg)"
        :title="`${seg.moodLabel} (${formatTime(seg.startTime)} - ${formatTime(seg.endTime)})`"
        @click.stop="emit('segment-click', seg)"
        @mouseenter="onSegmentHover(seg)"
      >
        <span class="mood-timeline__segment-label">{{ seg.moodLabel }}</span>
      </div>

      <!-- 播放头 -->
      <div
        class="mood-timeline__playhead"
        :style="{ left: `${playheadPosition}px` }"
      >
        <div class="mood-timeline__playhead-line" />
        <div class="mood-timeline__playhead-head" />
      </div>
    </div>

    <!-- 时间刻度 -->
    <div class="mood-timeline__markers" :style="{ width: `${timelineWidth}px` }">
      <div
        v-for="marker in timeMarkers"
        :key="marker.time"
        class="mood-timeline__marker"
        :style="{ left: `${marker.position}px` }"
      >
        <div class="mood-timeline__marker-tick" />
        <span class="mood-timeline__marker-label">{{ formatTime(marker.time) }}</span>
      </div>
    </div>

    <!-- 情绪图例 -->
    <div v-if="uniqueMoods.length > 0" class="mood-timeline__legend">
      <div v-for="mood in uniqueMoods" :key="mood.moodId" class="mood-timeline__legend-item">
        <span class="mood-timeline__legend-dot" :style="{ backgroundColor: mood.color }" />
        <span class="mood-timeline__legend-label">{{ mood.moodLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ScoreSegment } from './types';

interface Props {
  segments: ScoreSegment[];
  currentTime?: number;
  interactive?: boolean;
  totalDuration?: number;
  pixelsPerSecond?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentTime: 0,
  interactive: false,
  totalDuration: 60,
  pixelsPerSecond: 8,
});

const emit = defineEmits<{
  'segment-click': [segment: ScoreSegment];
  'segment-hover': [segment: ScoreSegment | null];
  'switch-advanced': [];
}>();

const timelineRef = ref<HTMLElement | null>(null);
const hoveredSegment = ref<string | null>(null);

const timelineWidth = computed(() => Math.max(400, props.totalDuration * props.pixelsPerSecond));

const playheadPosition = computed(() =>
  Math.min(props.currentTime * props.pixelsPerSecond, timelineWidth.value)
);

const timeMarkers = computed(() => {
  const markers: { time: number; position: number }[] = [];
  const step = props.totalDuration <= 30 ? 5 : props.totalDuration <= 120 ? 10 : 30;
  for (let t = 0; t <= props.totalDuration; t += step) {
    markers.push({ time: t, position: t * props.pixelsPerSecond });
  }
  return markers;
});

const uniqueMoods = computed(() => {
  const seen = new Set<string>();
  return props.segments.filter((s) => {
    if (seen.has(s.moodId)) return false;
    seen.add(s.moodId);
    return true;
  });
});

function segmentStyle(seg: ScoreSegment) {
  const left = seg.startTime * props.pixelsPerSecond;
  const width = (seg.endTime - seg.startTime) * props.pixelsPerSecond;
  return {
    left: `${left}px`,
    width: `${Math.max(width, 2)}px`,
    backgroundColor: seg.color + '30',
    borderLeft: `3px solid ${seg.color}`,
  };
}

function isSegmentActive(seg: ScoreSegment) {
  return props.currentTime >= seg.startTime && props.currentTime < seg.endTime;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function onSegmentHover(seg: ScoreSegment) {
  hoveredSegment.value = seg.id;
  emit('segment-hover', seg);
}

function onTrackClick(e: MouseEvent) {
  if (!props.interactive || !timelineRef.value) return;
  const rect = timelineRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const time = x / props.pixelsPerSecond;
  const seg = props.segments.find((s) => time >= s.startTime && time < s.endTime);
  if (seg) emit('segment-click', seg);
}

function onTrackHover(e: MouseEvent) {
  if (!timelineRef.value) return;
  const rect = timelineRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const time = x / props.pixelsPerSecond;
  const seg = props.segments.find((s) => time >= s.startTime && time < s.endTime);
  const newId = seg?.id ?? null;
  if (newId !== hoveredSegment.value) {
    hoveredSegment.value = newId;
    emit('segment-hover', seg ?? null);
  }
}
</script>

<style scoped>
.mood-timeline {
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--color-bg-secondary, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  overflow-x: auto;
}

.mood-timeline__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mood-timeline__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #e5e7eb);
}

.mood-timeline__time-display {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.mood-timeline__current-time {
  font-size: 14px;
  font-weight: 600;
  color: #00BFA5;
}

.mood-timeline__separator {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.mood-timeline__total-time {
  font-size: 12px;
  color: var(--color-text-secondary, #9ca3af);
}

.mood-timeline__advanced-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.08);
  color: #A78BFA;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.mood-timeline__advanced-btn:hover {
  background: rgba(124, 58, 237, 0.15);
}

.mood-timeline__advanced-icon {
  width: 14px;
  height: 14px;
}

/* 轨道 */
.mood-timeline__track {
  position: relative;
  height: 40px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  cursor: default;
}

.mood-timeline--interactive .mood-timeline__track {
  cursor: pointer;
}

/* 段 */
.mood-timeline__segment {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  transition: opacity 0.15s, background-color 0.15s;
  overflow: hidden;
}

.mood-timeline__segment--hovered {
  opacity: 0.85;
  filter: brightness(1.2);
}

.mood-timeline__segment--active {
  filter: brightness(1.3);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.mood-timeline__segment-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 播放头 */
.mood-timeline__playhead {
  position: absolute;
  top: -4px;
  bottom: -4px;
  z-index: 10;
  pointer-events: none;
}

.mood-timeline__playhead-line {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: #00BFA5;
  box-shadow: 0 0 6px rgba(0, 191, 165, 0.5);
}

.mood-timeline__playhead-head {
  position: absolute;
  top: 0;
  left: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00BFA5;
  box-shadow: 0 0 4px rgba(0, 191, 165, 0.4);
}

/* 刻度 */
.mood-timeline__markers {
  position: relative;
  height: 20px;
  margin-top: 4px;
}

.mood-timeline__marker {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
}

.mood-timeline__marker-tick {
  width: 1px;
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
}

.mood-timeline__marker-label {
  font-size: 10px;
  color: var(--color-text-secondary, #6b7280);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

/* 图例 */
.mood-timeline__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mood-timeline__legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mood-timeline__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mood-timeline__legend-label {
  font-size: 11px;
  color: var(--color-text-secondary, #9ca3af);
}
</style>
