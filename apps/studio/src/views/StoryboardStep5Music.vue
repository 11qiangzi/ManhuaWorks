<script setup lang="ts">
/**
 * StoryboardStep5Music.vue — Step 5 配乐设定面板
 * 镜头编辑器中的配乐步骤：情绪时间线 + 三轨面板 + AI 自动配乐
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useMusicScore,
  MOOD_COLORS,
  type MoodTag,
  type TrackType,
  type AudioEntry,
} from '../composables/musicScore'

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
}>()

const {
  projectScore,
  autoScoreStatus,
  autoScoreProgress,
  playheadPosition,
  selectedSegmentId,
  advancedMode,
  isProcessing,
  statusLabel,
  hasScore,
  initMockData,
  startAutoScore,
  cancelAutoScore,
  updateTrackVolume,
  toggleTrackMute,
  selectSegment,
  formatTime,
} = useMusicScore()

// ── 本地状态 ──
const hoveredSegmentId = ref<string | null>(null)
const expandedTrack = ref<TrackType | null>(null)
const playheadAnimTimer = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  // 自动加载 mock 数据用于开发预览
  initMockData()
})

onUnmounted(() => {
  if (playheadAnimTimer.value) {
    clearInterval(playheadAnimTimer.value)
  }
})

// ── 播放头动画（演示用）──
function startPlayheadAnim() {
  if (playheadAnimTimer.value) return
  playheadAnimTimer.value = setInterval(() => {
    if (!projectScore.value) return
    playheadPosition.value += 0.5
    if (playheadPosition.value > projectScore.value.totalDuration) {
      playheadPosition.value = 0
    }
  }, 200)
}

function stopPlayheadAnim() {
  if (playheadAnimTimer.value) {
    clearInterval(playheadAnimTimer.value)
    playheadAnimTimer.value = null
  }
}

// ── 计算属性 ──
const playheadPercent = computed(() => {
  if (!projectScore.value) return 0
  return (playheadPosition.value / projectScore.value.totalDuration) * 100
})

const totalDurationLabel = computed(() => {
  if (!projectScore.value) return '0:00'
  return formatTime(projectScore.value.totalDuration)
})

const trackEntryCount = (trackType: TrackType) => {
  if (!projectScore.value) return 0
  const track = projectScore.value.tracks.find(t => t.type === trackType)
  return track?.entries.length ?? 0
}

const getTrack = (trackType: TrackType) => {
  return projectScore.value?.tracks.find(t => t.type === trackType) ?? null
}

// ── 情绪段落样式 ──
function segmentStyle(seg: { startTime: number; endTime: number; color: string }) {
  if (!projectScore.value) return {}
  const total = projectScore.value.totalDuration
  const left = (seg.startTime / total) * 100
  const width = ((seg.endTime - seg.startTime) / total) * 100
  return {
    left: `${left}%`,
    width: `${width}%`,
    '--seg-color': seg.color,
  }
}

// ── 轨道条目样式 ──
function entryStyle(entry: AudioEntry) {
  if (!projectScore.value) return {}
  const total = projectScore.value.totalDuration
  const left = (entry.startTime / total) * 100
  const width = Math.max(2, (entry.duration / total) * 100)
  return {
    left: `${left}%`,
    width: `${width}%`,
  }
}

const sourceLabels: Record<string, string> = {
  'ai-match': 'AI匹配',
  'manual': '手动',
  'ai-generate': 'AI生成',
}

const sourceColors: Record<string, string> = {
  'ai-match': '#818cf8',
  'manual': '#94a3b8',
  'ai-generate': '#34d399',
}

// ── 轨道类型配置 ──
const trackConfigs: { type: TrackType; label: string; icon: string; color: string; emptyText: string }[] = [
  { type: 'bgm', label: 'BGM 背景音乐', icon: '🎵', color: '#818cf8', emptyText: 'AI 自动匹配背景音乐' },
  { type: 'sfx', label: 'SFX 音效', icon: '🔊', color: '#f59e0b', emptyText: 'AI 自动匹配音效' },
  { type: 'voiceover', label: 'VO 旁白/对白', icon: '🎙️', color: '#34d399', emptyText: 'AI 生成旁白/对白' },
]

// ── 操作 ──
function onAutoScore() {
  if (autoScoreStatus.value === 'done' || autoScoreStatus.value === 'error') {
    // 重新配乐
    startAutoScore()
  } else if (isProcessing.value) {
    cancelAutoScore()
  } else {
    startAutoScore()
  }
}

function autoScoreButtonLabel(): string {
  if (autoScoreStatus.value === 'done') return '🔄 重新配乐'
  if (autoScoreStatus.value === 'error') return '🔄 重试配乐'
  if (isProcessing.value) return '⏹ 取消配乐'
  return '🎶 AI 自动配乐'
}

function autoScoreButtonClass(): string {
  if (autoScoreStatus.value === 'done') return 'ms-auto-btn ms-auto-btn--secondary'
  if (isProcessing.value) return 'ms-auto-btn ms-auto-btn--danger'
  return 'ms-auto-btn ms-auto-btn--primary'
}
</script>

<template>
  <div class="ms-root">
    <!-- ═══════════ 顶部：情绪时间线 ═══════════ -->
    <section class="ms-timeline-section">
      <div class="ms-section-header">
        <span class="ms-section-title">🎼 情绪时间线</span>
        <span class="ms-section-meta" v-if="projectScore">
          {{ projectScore.segments.length }} 段 · {{ totalDurationLabel }}
        </span>
        <button class="ms-play-btn" @click="playheadAnimTimer ? stopPlayheadAnim() : startPlayheadAnim()">
          {{ playheadAnimTimer ? '⏸ 暂停' : '▶ 播放' }}
        </button>
      </div>

      <div class="ms-timeline" v-if="projectScore">
        <!-- 时间刻度 -->
        <div class="ms-timeline-ruler">
          <span v-for="i in 10" :key="i" class="ms-ruler-mark" :style="{ left: `${(i - 1) * 10}%` }">
            {{ formatTime((projectScore.totalDuration / 10) * (i - 1)) }}
          </span>
        </div>

        <!-- 情绪段落条 -->
        <div class="ms-timeline-bar">
          <div
            v-for="seg in projectScore.segments"
            :key="seg.id"
            class="ms-timeline-seg"
            :class="{
              'ms-timeline-seg--selected': selectedSegmentId === seg.id,
              'ms-timeline-seg--hover': hoveredSegmentId === seg.id,
            }"
            :style="segmentStyle(seg)"
            @click="selectSegment(seg.id === selectedSegmentId ? null : seg.id)"
            @mouseenter="hoveredSegmentId = seg.id"
            @mouseleave="hoveredSegmentId = null"
          >
            <span class="ms-seg-label">{{ seg.mood }}</span>
            <span class="ms-seg-shot">#{{ seg.shotIndex }}</span>
          </div>

          <!-- 播放头 -->
          <div class="ms-playhead" :style="{ left: `${playheadPercent}%` }">
            <div class="ms-playhead-line"></div>
            <div class="ms-playhead-diamond"></div>
          </div>
        </div>

        <!-- 段落提示（hover） -->
        <div class="ms-timeline-tooltip" v-if="hoveredSegmentId">
          <template v-for="seg in projectScore.segments" :key="seg.id">
            <span v-if="seg.id === hoveredSegmentId" class="ms-tooltip-text">
              #{{ seg.shotIndex }} {{ seg.shotLabel }} · {{ seg.mood }} · {{ formatTime(seg.startTime) }}-{{ formatTime(seg.endTime) }}
            </span>
          </template>
        </div>
      </div>

      <!-- 空状态 -->
      <div class="ms-timeline-empty" v-else>
        <span>暂无情绪数据，请先运行 AI 自动配乐</span>
      </div>
    </section>

    <!-- ═══════════ 中部：三轨面板 ═══════════ -->
    <section class="ms-tracks-section">
      <div class="ms-section-header">
        <span class="ms-section-title">🎚️ 音频轨道</span>
        <button
          class="ms-advanced-toggle"
          :class="{ 'ms-advanced-toggle--on': advancedMode }"
          @click="advancedMode = !advancedMode"
        >
          {{ advancedMode ? '🔽 收起详细' : '🔼 详细模式' }}
        </button>
      </div>

      <div class="ms-tracks" v-if="projectScore">
        <div
          v-for="cfg in trackConfigs"
          :key="cfg.type"
          class="ms-track"
          :class="{ 'ms-track--expanded': expandedTrack === cfg.type }"
        >
          <!-- 轨道头部 -->
          <div class="ms-track-header" @click="expandedTrack = expandedTrack === cfg.type ? null : cfg.type">
            <div class="ms-track-info">
              <span class="ms-track-icon">{{ cfg.icon }}</span>
              <span class="ms-track-label">{{ cfg.label }}</span>
              <span class="ms-track-count">{{ trackEntryCount(cfg.type) }} 条</span>
            </div>
            <div class="ms-track-controls" @click.stop>
              <!-- 音量滑块 -->
              <div class="ms-volume-group">
                <button
                  class="ms-mute-btn"
                  :class="{ 'ms-mute-btn--muted': getTrack(cfg.type)?.muted }"
                  @click="toggleTrackMute(cfg.type)"
                  :title="getTrack(cfg.type)?.muted ? '取消静音' : '静音'"
                >
                  {{ getTrack(cfg.type)?.muted ? '🔇' : (getTrack(cfg.type)?.volume ?? 50) > 50 ? '🔊' : '🔉' }}
                </button>
                <input
                  type="range"
                  class="ms-volume-slider"
                  min="0"
                  max="100"
                  :value="getTrack(cfg.type)?.volume ?? 75"
                  @input="updateTrackVolume(cfg.type, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="ms-volume-val">{{ getTrack(cfg.type)?.volume ?? 75 }}%</span>
              </div>
              <button class="ms-track-add-btn" title="添加条目">+ 添加</button>
              <span class="ms-track-expand-icon">{{ expandedTrack === cfg.type ? '▾' : '▸' }}</span>
            </div>
          </div>

          <!-- 轨道内容 -->
          <div class="ms-track-body">
            <!-- 条目块 -->
            <div
              v-for="entry in (getTrack(cfg.type)?.entries ?? [])"
              :key="entry.id"
              class="ms-track-entry"
              :style="{
                ...entryStyle(entry),
                '--entry-color': cfg.color,
              }"
            >
              <div class="ms-entry-name">{{ entry.name }}</div>
              <div class="ms-entry-source" :style="{ color: sourceColors[entry.source] }">
                {{ sourceLabels[entry.source] }}
              </div>
              <!-- 波形占位 -->
              <div class="ms-entry-waveform">
                <div
                  v-for="(v, idx) in entry.waveform"
                  :key="idx"
                  class="ms-waveform-bar"
                  :style="{ height: `${v}%`, background: cfg.color }"
                ></div>
              </div>
              <div class="ms-entry-time">{{ formatTime(entry.startTime) }} · {{ entry.duration.toFixed(1) }}s</div>
            </div>

            <!-- 空状态 -->
            <div v-if="!getTrack(cfg.type)?.entries.length" class="ms-track-empty">
              <span class="ms-empty-icon">{{ cfg.icon }}</span>
              <span class="ms-empty-text">暂无{{ cfg.label.split(' ')[0] }}条目</span>
              <span class="ms-empty-hint">点击「添加」或运行「AI 自动配乐」</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 轨道空状态 -->
      <div class="ms-tracks-empty" v-else>
        <div class="ms-empty-big-icon">🎚️</div>
        <div class="ms-empty-big-text">配乐轨道为空</div>
        <div class="ms-empty-big-hint">点击下方「AI 自动配乐」开始智能配乐</div>
      </div>
    </section>

    <!-- ═══════════ 高级：镜头配乐详情 ═══════════ -->
    <section class="ms-advanced-section" v-if="advancedMode && projectScore">
      <div class="ms-section-header">
        <span class="ms-section-title">📋 镜头配乐分配</span>
      </div>
      <div class="ms-shot-cards">
        <div
          v-for="assignment in projectScore.assignments"
          :key="assignment.shotIndex"
          class="ms-shot-card"
          :class="{ 'ms-shot-card--selected': selectedSegmentId === `seg_${assignment.shotIndex - 1}` }"
        >
          <div class="ms-shot-thumb">
            <span class="ms-shot-num">#{{ assignment.shotIndex }}</span>
          </div>
          <div class="ms-shot-body">
            <div class="ms-shot-label">{{ assignment.shotLabel }}</div>
            <div class="ms-shot-moods">
              <span
                v-for="tag in assignment.moodTags"
                :key="tag"
                class="ms-mood-chip"
                :style="{ background: MOOD_COLORS[tag] + '22', color: MOOD_COLORS[tag], borderColor: MOOD_COLORS[tag] + '44' }"
              >{{ tag }}</span>
            </div>
            <div class="ms-shot-assignments">
              <span class="ms-assign-item" v-if="assignment.bgmId">🎵 BGM</span>
              <span class="ms-assign-item" v-if="assignment.sfxIds.length">🔊 SFX×{{ assignment.sfxIds.length }}</span>
              <span class="ms-assign-item" v-if="assignment.voiceoverId">🎙️ VO</span>
              <span class="ms-assign-item ms-assign-item--none" v-if="!assignment.bgmId && !assignment.sfxIds.length && !assignment.voiceoverId">— 未分配</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ 底部：控制区 ═══════════ -->
    <footer class="ms-footer">
      <div class="ms-footer-left">
        <button class="ms-nav-btn" @click="emit('prev')">
          ← 上一步
        </button>
      </div>

      <div class="ms-footer-center">
        <!-- AI 配乐按钮 + 状态 -->
        <button
          :class="autoScoreButtonClass()"
          @click="onAutoScore"
        >
          {{ autoScoreButtonLabel() }}
        </button>

        <!-- 进度条 -->
        <div class="ms-progress-area" v-if="isProcessing">
          <div class="ms-progress-bar">
            <div class="ms-progress-fill" :style="{ width: `${autoScoreProgress}%` }"></div>
          </div>
          <span class="ms-progress-label">{{ statusLabel }} · {{ autoScoreProgress }}%</span>
        </div>

        <!-- 状态完成 -->
        <div class="ms-status-done" v-if="autoScoreStatus === 'done'">
          <span class="ms-done-icon">✅</span>
          <span class="ms-done-text">配乐完成</span>
        </div>
      </div>

      <div class="ms-footer-right">
        <button class="ms-nav-btn ms-nav-btn--primary" @click="emit('next')">
          下一步 →
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.ms-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary, #0a0e1a);
  color: var(--text-primary, #e4e4e7);
  padding: 0 0 0 0;
}

/* ── 公共 ── */
.ms-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px 8px;
}
.ms-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
}
.ms-section-meta {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}
.ms-play-btn {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  cursor: pointer;
  transition: all 150ms;
}
.ms-play-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
}

/* ═══════════ 情绪时间线 ═══════════ */
.ms-timeline-section {
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
}
.ms-timeline {
  padding: 0 20px 12px;
  position: relative;
}
.ms-timeline-ruler {
  position: relative;
  height: 16px;
  margin-bottom: 4px;
}
.ms-ruler-mark {
  position: absolute;
  font-size: 9px;
  color: var(--text-muted, #64748b);
  transform: translateX(-50%);
  top: 0;
}
.ms-timeline-bar {
  position: relative;
  height: 36px;
  border-radius: 6px;
  background: var(--bg-tertiary, #1a2332);
  overflow: visible;
}
.ms-timeline-seg {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 4px;
  background: var(--seg-color);
  opacity: 0.35;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: opacity 150ms, transform 100ms;
  border: 1px solid transparent;
  overflow: hidden;
}
.ms-timeline-seg:hover,
.ms-timeline-seg--hover {
  opacity: 0.6;
}
.ms-timeline-seg--selected {
  opacity: 0.8;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
}
.ms-seg-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}
.ms-seg-shot {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.6);
}
.ms-playhead {
  position: absolute;
  top: -4px;
  bottom: -4px;
  z-index: 10;
  pointer-events: none;
  transition: left 180ms linear;
}
.ms-playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: #ef4444;
  transform: translateX(-50%);
}
.ms-playhead-diamond {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  background: #ef4444;
  transform: translateX(-50%) rotate(45deg);
  border-radius: 1px;
}
.ms-timeline-tooltip {
  margin-top: 4px;
  padding: 4px 10px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 4px;
  border: 1px solid var(--border, #1f2937);
}
.ms-tooltip-text {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}
.ms-timeline-empty {
  padding: 16px 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

/* ═══════════ 三轨面板 ═══════════ */
.ms-tracks-section {
  flex: 1;
  border-bottom: 1px solid var(--border, #1f2937);
  overflow-y: auto;
  min-height: 0;
}
.ms-advanced-toggle {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  cursor: pointer;
  transition: all 150ms;
}
.ms-advanced-toggle:hover { border-color: var(--accent, #818cf8); }
.ms-advanced-toggle--on { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); background: rgba(129, 140, 248, 0.08); }

.ms-tracks {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 20px 12px;
}
.ms-track {
  background: var(--bg-secondary, #111827);
  border: 1px solid var(--border, #1f2937);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 150ms;
}
.ms-track:hover { border-color: var(--border-strong, #334155); }
.ms-track--expanded { border-color: var(--accent, #818cf8); }

.ms-track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 100ms;
}
.ms-track-header:hover { background: var(--bg-tertiary, #1a2332); }

.ms-track-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-track-icon { font-size: 16px; }
.ms-track-label { font-size: 12px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.ms-track-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #64748b);
}

.ms-track-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-volume-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ms-mute-btn {
  background: transparent;
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 2px;
  opacity: 0.8;
  transition: opacity 100ms;
}
.ms-mute-btn:hover { opacity: 1; }
.ms-mute-btn--muted { opacity: 0.4; }

.ms-volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary, #1a2332);
  outline: none;
  cursor: pointer;
}
.ms-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #818cf8);
  cursor: pointer;
}
.ms-volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #818cf8);
  cursor: pointer;
  border: none;
}
.ms-volume-val {
  font-size: 10px;
  color: var(--text-muted, #64748b);
  width: 28px;
  text-align: right;
}
.ms-track-add-btn {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px dashed var(--border, #1f2937);
  background: transparent;
  color: var(--text-secondary, #94a3b8);
  font-size: 10px;
  cursor: pointer;
  transition: all 150ms;
}
.ms-track-add-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.ms-track-expand-icon { font-size: 12px; color: var(--text-muted, #64748b); }

/* 轨道内容 */
.ms-track-body {
  position: relative;
  min-height: 48px;
  padding: 6px 14px 8px;
  border-top: 1px solid var(--border, #1f2937);
  background: rgba(0, 0, 0, 0.15);
}
.ms-track-entry {
  position: absolute;
  top: 6px;
  height: calc(100% - 14px);
  min-width: 40px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--entry-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--entry-color) 40%, transparent);
  padding: 4px 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms;
}
.ms-track-entry:hover {
  background: color-mix(in srgb, var(--entry-color) 30%, transparent);
  border-color: var(--entry-color);
}
.ms-entry-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary, #e4e4e7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-entry-source {
  font-size: 9px;
  font-weight: 500;
}
.ms-entry-waveform {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 16px;
  margin-top: 2px;
  overflow: hidden;
}
.ms-waveform-bar {
  flex: 1;
  min-width: 1px;
  border-radius: 1px;
  opacity: 0.5;
  transition: opacity 100ms;
}
.ms-track-entry:hover .ms-waveform-bar { opacity: 0.8; }
.ms-entry-time {
  font-size: 8px;
  color: var(--text-muted, #64748b);
  margin-top: 1px;
}

.ms-track-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  justify-content: center;
}
.ms-empty-icon { font-size: 16px; opacity: 0.4; }
.ms-empty-text { font-size: 11px; color: var(--text-muted, #64748b); }
.ms-empty-hint { font-size: 10px; color: var(--text-muted, #64748b); opacity: 0.6; }

.ms-tracks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 8px;
}
.ms-empty-big-icon { font-size: 40px; opacity: 0.3; }
.ms-empty-big-text { font-size: 14px; font-weight: 600; color: var(--text-secondary, #94a3b8); }
.ms-empty-big-hint { font-size: 12px; color: var(--text-muted, #64748b); }

/* ═══════════ 高级：镜头卡片 ═══════════ */
.ms-advanced-section {
  border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
}
.ms-shot-cards {
  display: flex;
  gap: 10px;
  padding: 0 20px 14px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.ms-shot-card {
  flex-shrink: 0;
  width: 140px;
  border: 1px solid var(--border, #1f2937);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-tertiary, #1a2332);
  transition: border-color 150ms;
}
.ms-shot-card:hover { border-color: var(--border-strong, #334155); }
.ms-shot-card--selected { border-color: var(--accent, #818cf8); box-shadow: 0 0 8px rgba(129, 140, 248, 0.15); }
.ms-shot-thumb {
  height: 56px;
  background: linear-gradient(135deg, rgba(129, 140, 248, 0.15), rgba(118, 75, 162, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
}
.ms-shot-num {
  font-size: 18px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.15);
}
.ms-shot-body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ms-shot-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #e4e4e7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-shot-moods {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.ms-mood-chip {
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
  border: 1px solid;
}
.ms-shot-assignments {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.ms-assign-item {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}
.ms-assign-item--none {
  background: rgba(148, 163, 184, 0.1);
  color: var(--text-muted, #64748b);
}

/* ═══════════ 底部控制 ═══════════ */
.ms-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  gap: 16px;
  flex-shrink: 0;
}
.ms-footer-left,
.ms-footer-right {
  flex-shrink: 0;
}
.ms-footer-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 360px;
}

.ms-nav-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}
.ms-nav-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }
.ms-nav-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-weight: 600;
}
.ms-nav-btn--primary:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }

/* AI 配乐按钮 */
.ms-auto-btn {
  padding: 10px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 200ms;
  letter-spacing: 0.02em;
}
.ms-auto-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.25);
}
.ms-auto-btn--primary:hover { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); transform: translateY(-1px); }
.ms-auto-btn--secondary {
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #94a3b8);
  border: 1px solid var(--border, #1f2937);
}
.ms-auto-btn--secondary:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.ms-auto-btn--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.ms-auto-btn--danger:hover { background: rgba(239, 68, 68, 0.2); }

/* 进度条 */
.ms-progress-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.ms-progress-bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary, #1a2332);
  overflow: hidden;
}
.ms-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 100ms linear;
}
.ms-progress-label {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

/* 完成状态 */
.ms-status-done {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ms-done-icon { font-size: 14px; }
.ms-done-text { font-size: 12px; font-weight: 600; color: #34d399; }

/* ── 响应式 ── */
@media (max-width: 768px) {
  .ms-footer {
    flex-wrap: wrap;
    gap: 10px;
  }
  .ms-footer-center {
    order: -1;
    width: 100%;
    max-width: none;
  }
  .ms-volume-slider { width: 40px; }
  .ms-shot-card { width: 120px; }
}
</style>
