<template>
  <div class="audio-track" :class="[`audio-track--${type}`, { 'audio-track--expanded': expanded }]">
    <!-- 轨道头部 -->
    <div class="audio-track__header">
      <button
        type="button"
        class="audio-track__expand-btn"
        :aria-label="expanded ? '收起' : '展开'"
        @click="emit('toggle-expand')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          class="audio-track__chevron"
          :class="{ 'audio-track__chevron--open': expanded }"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- 类型图标 -->
      <div class="audio-track__type-icon" :style="{ backgroundColor: trackColor + '20', color: trackColor }">
        <svg v-if="type === 'bgm'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
        </svg>
        <svg v-else-if="type === 'sfx'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
        </svg>
      </div>

      <span class="audio-track__label">{{ label }}</span>

      <div class="audio-track__controls">
        <!-- 静音按钮 -->
        <button
          type="button"
          class="audio-track__mute-btn"
          :class="{ 'audio-track__mute-btn--active': muted }"
          :title="muted ? '取消静音' : '静音'"
          @click="emit('mute-toggle')"
        >
          {{ muted ? 'M' : 'M' }}
        </button>

        <!-- 迷你音量条 -->
        <div class="audio-track__volume-bar">
          <div class="audio-track__volume-fill" :style="{ width: muted ? '0%' : `${volume}%` }" />
          <input
            type="range"
            min="0"
            max="100"
            :value="muted ? 0 : volume"
            class="audio-track__volume-input"
            @input="onVolumeInput"
          />
        </div>

        <span class="audio-track__volume-label">{{ muted ? 0 : volume }}%</span>
      </div>
    </div>

    <!-- 展开内容区 -->
    <Transition name="track-expand">
      <div v-if="expanded" class="audio-track__body">
        <!-- 加载中 -->
        <div v-if="loading" class="audio-track__loading">
          <div class="audio-track__loading-bar">
            <div class="audio-track__loading-fill" :style="{ width: `${loadingProgress}%` }" />
          </div>
          <span class="audio-track__loading-text">加载中... {{ loadingProgress }}%</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="isEmpty && entries.length === 0" class="audio-track__empty">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__empty-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
          <p class="audio-track__empty-text">{{ emptyText }}</p>
        </div>

        <!-- 条目列表 -->
        <div v-else class="audio-track__entries">
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="audio-track__entry"
            :class="{ 'audio-track__entry--playing': entry.isPlaying }"
          >
            <button
              type="button"
              class="audio-track__entry-play"
              @click="emit('play-entry', entry)"
            >
              <svg v-if="!entry.isPlaying" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="audio-track__entry-play-icon">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="audio-track__entry-play-icon">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
            <div class="audio-track__entry-info">
              <span class="audio-track__entry-name">{{ entry.name }}</span>
              <div class="audio-track__entry-wave">
                <div
                  v-for="(bar, idx) in getWaveBars(entry)"
                  :key="idx"
                  class="audio-track__entry-wave-bar"
                  :style="{ height: `${bar}%` }"
                />
              </div>
            </div>
            <span class="audio-track__entry-duration">{{ formatDuration(entry.duration) }}</span>
            <button type="button" class="audio-track__entry-remove" title="移除" @click="emit('remove-entry', entry)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__remove-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 添加按钮 -->
        <button type="button" class="audio-track__add-btn" @click="emit('add-entry')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-track__add-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加音频
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TrackType, AudioTrackEntry } from './types';

interface Props {
  type: TrackType;
  label: string;
  entries?: AudioTrackEntry[];
  volume?: number;
  muted?: boolean;
  isEmpty?: boolean;
  loading?: boolean;
  loadingProgress?: number;
  expanded?: boolean;
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  entries: () => [],
  volume: 80,
  muted: false,
  isEmpty: false,
  loading: false,
  loadingProgress: 0,
  expanded: true,
  emptyText: '暂无音频，点击下方按钮添加',
});

const emit = defineEmits<{
  'volume-change': [val: number];
  'mute-toggle': [];
  'add-entry': [];
  'remove-entry': [entry: AudioTrackEntry];
  'replace-entry': [entry: AudioTrackEntry];
  'play-entry': [entry: AudioTrackEntry];
  'toggle-expand': [];
}>();

const TRACK_COLORS: Record<TrackType, string> = {
  bgm: '#00BFA5',
  sfx: '#7C3AED',
  voiceover: '#F59E0B',
};

const trackColor = computed(() => TRACK_COLORS[props.type]);

function onVolumeInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  emit('volume-change', val);
}

function getWaveBars(entry: AudioTrackEntry): number[] {
  if (entry.waveformData?.length) {
    return entry.waveformData.map((v) => Math.max(10, v * 100));
  }
  return Array.from({ length: 24 }, (_, i) => {
    const seed = (entry.id.charCodeAt(0) || 42) + i * 3;
    return 12 + Math.abs(Math.sin(seed * 0.5) * 60);
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.audio-track {
  border-radius: 10px;
  background: var(--color-bg-secondary, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  overflow: hidden;
  transition: border-color 0.2s;
}

.audio-track:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.audio-track__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.audio-track__expand-btn {
  display: flex;
  align-items: center;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  cursor: pointer;
}

.audio-track__chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.audio-track__chevron--open { transform: rotate(90deg); }

.audio-track__type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}

.audio-track__icon { width: 18px; height: 18px; }

.audio-track__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #e5e7eb);
  white-space: nowrap;
}

.audio-track__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.audio-track__mute-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.audio-track__mute-btn--active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #F87171;
}

.audio-track__volume-bar {
  position: relative;
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
}

.audio-track__volume-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 2px;
  background: #00BFA5;
  transition: width 0.1s;
  pointer-events: none;
}

.audio-track__volume-input {
  position: absolute;
  inset: -6px 0;
  width: 100%;
  height: calc(100% + 12px);
  opacity: 0;
  cursor: pointer;
  margin: 0;
}

.audio-track__volume-label {
  font-size: 11px;
  color: var(--color-text-secondary, #9ca3af);
  min-width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 展开内容 */
.audio-track__body { padding: 10px 14px; }

.audio-track__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}

.audio-track__loading-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.audio-track__loading-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #00BFA5, #7C3AED);
  transition: width 0.3s;
}

.audio-track__loading-text {
  font-size: 12px;
  color: var(--color-text-secondary, #9ca3af);
  white-space: nowrap;
}

.audio-track__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
}

.audio-track__empty-icon {
  width: 36px;
  height: 36px;
  color: var(--color-text-secondary, #6b7280);
  opacity: 0.5;
}

.audio-track__empty-text {
  font-size: 13px;
  color: var(--color-text-secondary, #9ca3af);
  margin: 0;
}

/* 条目列表 */
.audio-track__entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-track__entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.audio-track__entry:hover { background: rgba(255, 255, 255, 0.04); }

.audio-track__entry--playing {
  background: rgba(0, 191, 165, 0.06);
  border-left: 2px solid #00BFA5;
}

.audio-track__entry-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 191, 165, 0.15);
  color: #00BFA5;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.audio-track__entry-play:hover { background: rgba(0, 191, 165, 0.25); }

.audio-track__entry-play-icon { width: 14px; height: 14px; }

.audio-track__entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.audio-track__entry-name {
  font-size: 13px;
  color: var(--color-text, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-track__entry-wave {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 14px;
}

.audio-track__entry-wave-bar {
  flex: 1;
  min-width: 2px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 1px;
}

.audio-track__entry--playing .audio-track__entry-wave-bar {
  background: rgba(0, 191, 165, 0.4);
}

.audio-track__entry-duration {
  font-size: 11px;
  color: var(--color-text-secondary, #9ca3af);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.audio-track__entry-remove {
  display: flex;
  align-items: center;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.audio-track__entry:hover .audio-track__entry-remove { opacity: 1; }
.audio-track__entry-remove:hover { color: #EF4444; }

.audio-track__remove-icon { width: 14px; height: 14px; }

.audio-track__add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.audio-track__add-btn:hover {
  border-color: rgba(0, 191, 165, 0.4);
  color: #00BFA5;
  background: rgba(0, 191, 165, 0.04);
}

.audio-track__add-icon { width: 16px; height: 16px; }

/* 展开动画 */
.track-expand-enter-active,
.track-expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.track-expand-enter-from,
.track-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
