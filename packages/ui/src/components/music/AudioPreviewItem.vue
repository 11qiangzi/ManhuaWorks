<template>
  <div
    :class="[
      'audio-preview',
      { 'audio-preview--compact': compact, 'audio-preview--playing': isPlaying },
    ]"
  >
    <!-- 播放/暂停按钮 -->
    <button
      type="button"
      class="audio-preview__play-btn"
      :aria-label="isPlaying ? '暂停' : '播放'"
      @click="togglePlay"
    >
      <svg
        v-if="!isPlaying"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="audio-preview__play-icon"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="audio-preview__play-icon"
      >
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg>
    </button>

    <!-- 波形占位 + 信息区 -->
    <div class="audio-preview__body">
      <div class="audio-preview__info-row">
        <span class="audio-preview__name" :title="audio.name">{{ audio.name }}</span>
        <span class="audio-preview__duration">{{ formatDuration(audio.duration) }}</span>
      </div>

      <!-- 波形条 -->
      <div class="audio-preview__waveform" :class="{ 'audio-preview__waveform--active': isPlaying }">
        <div
          v-for="(bar, idx) in waveformBars"
          :key="idx"
          class="audio-preview__waveform-bar"
          :style="{ height: `${bar}%` }"
        />
      </div>

      <!-- 底部信息行 -->
      <div class="audio-preview__meta-row">
        <!-- 情绪标签圆点 -->
        <div v-if="audio.mood && audio.mood.length" class="audio-preview__mood-dots">
          <span
            v-for="m in audio.mood.slice(0, 4)"
            :key="m.id"
            class="audio-preview__mood-dot"
            :style="{ backgroundColor: m.color }"
            :title="m.label"
          />
          <span v-if="audio.mood.length > 4" class="audio-preview__mood-more">
            +{{ audio.mood.length - 4 }}
          </span>
        </div>

        <!-- 格式/BPM -->
        <span class="audio-preview__format">{{ audio.format.toUpperCase() }}</span>
        <span v-if="audio.bpm" class="audio-preview__bpm">{{ audio.bpm }} BPM</span>
      </div>
    </div>

    <!-- 操作按钮组 -->
    <div class="audio-preview__actions">
      <button
        v-if="showAddButton"
        type="button"
        class="audio-preview__add-btn"
        title="添加到轨道"
        @click.stop="emit('add', audio)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-preview__action-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        type="button"
        class="audio-preview__dl-btn"
        title="下载"
        @click.stop="emit('download', audio)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="audio-preview__action-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AudioTrackEntry } from './types';

interface Props {
  /** 音频条目 */
  audio: AudioTrackEntry;
  /** 是否正在播放 */
  isPlaying?: boolean;
  /** 是否显示添加按钮 */
  showAddButton?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  showAddButton: true,
  compact: false,
});

const emit = defineEmits<{
  play: [audio: AudioTrackEntry];
  pause: [audio: AudioTrackEntry];
  add: [audio: AudioTrackEntry];
  download: [audio: AudioTrackEntry];
}>();

/** 生成波形条数据（从 waveformData 或使用占位） */
const waveformBars = computed(() => {
  if (props.audio.waveformData && props.audio.waveformData.length > 0) {
    return props.audio.waveformData.map((v) => Math.max(8, Math.min(100, v * 100)));
  }
  // 生成伪随机波形占位
  const count = props.compact ? 20 : 32;
  return Array.from({ length: count }, (_, i) => {
    const seed = (props.audio.id.charCodeAt(0) || 42) + i;
    return 15 + Math.abs(Math.sin(seed * 0.7) * 65);
  });
});

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function togglePlay() {
  if (props.isPlaying) {
    emit('pause', props.audio);
  } else {
    emit('play', props.audio);
  }
}
</script>

<style scoped>
.audio-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-bg-secondary, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  transition: border-color 0.2s, background-color 0.2s;
}

.audio-preview:hover {
  border-color: rgba(0, 191, 165, 0.3);
  background: rgba(255, 255, 255, 0.07);
}

.audio-preview--playing {
  border-color: #00BFA5;
  background: rgba(0, 191, 165, 0.08);
}

.audio-preview--compact {
  padding: 6px 8px;
  gap: 6px;
}

.audio-preview__play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #00BFA5;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s, transform 0.15s;
}

.audio-preview--compact .audio-preview__play-btn {
  width: 28px;
  height: 28px;
}

.audio-preview__play-btn:hover {
  background: #00D4B5;
  transform: scale(1.05);
}

.audio-preview__play-icon {
  width: 18px;
  height: 18px;
}

.audio-preview--compact .audio-preview__play-icon {
  width: 14px;
  height: 14px;
}

.audio-preview__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-preview__info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.audio-preview__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-preview__duration {
  font-size: 12px;
  color: var(--color-text-secondary, #9ca3af);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.audio-preview__waveform {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 24px;
}

.audio-preview--compact .audio-preview__waveform {
  height: 16px;
}

.audio-preview__waveform-bar {
  flex: 1;
  min-width: 2px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1px;
  transition: background-color 0.2s;
}

.audio-preview__waveform--active .audio-preview__waveform-bar {
  background: rgba(0, 191, 165, 0.6);
}

.audio-preview__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary, #9ca3af);
}

.audio-preview__mood-dots {
  display: flex;
  align-items: center;
  gap: 3px;
}

.audio-preview__mood-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.audio-preview__mood-more {
  font-size: 10px;
  color: var(--color-text-secondary, #9ca3af);
}

.audio-preview__format {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.audio-preview__bpm {
  font-size: 11px;
}

.audio-preview__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.audio-preview__add-btn,
.audio-preview__dl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
}

.audio-preview__add-btn:hover {
  color: #00BFA5;
  background: rgba(0, 191, 165, 0.1);
}

.audio-preview__dl-btn:hover {
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.1);
}

.audio-preview__action-icon {
  width: 16px;
  height: 16px;
}
</style>
