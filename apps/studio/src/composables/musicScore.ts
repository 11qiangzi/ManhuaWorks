// =============================================================================
// musicScore.ts — 配乐设定 Composable
// Step 5 配乐设定的状态管理：情绪时间线、三轨混音、AI 自动配乐
// =============================================================================

import { ref, computed, shallowRef } from 'vue'

// ── 类型定义 ──

/** 16 标签情绪系统 */
export type MoodTag =
  | '紧张' | '温馨' | '悲伤' | '欢快'
  | '激昂' | '神秘' | '浪漫' | '恐惧'
  | '平静' | '愤怒' | '希望' | '孤独'
  | '史诗' | '喜剧' | '悬疑' | '庄严'

/** 情绪颜色映射 */
export const MOOD_COLORS: Record<MoodTag, string> = {
  '紧张': '#ef4444',
  '温馨': '#f59e0b',
  '悲伤': '#6366f1',
  '欢快': '#22c55e',
  '激昂': '#dc2626',
  '神秘': '#8b5cf6',
  '浪漫': '#ec4899',
  '恐惧': '#1e1b4b',
  '平静': '#06b6d4',
  '愤怒': '#b91c1c',
  '希望': '#fbbf24',
  '孤独': '#64748b',
  '史诗': '#d97706',
  '喜剧': '#84cc16',
  '悬疑': '#7c3aed',
  '庄严': '#0f766e',
}

/** 情绪段落（时间线上的每一段） */
export interface MoodSegment {
  id: string
  shotIndex: number
  shotLabel: string
  mood: MoodTag
  startTime: number   // 秒
  endTime: number     // 秒
  color: string
}

/** 音频条目 */
export interface AudioEntry {
  id: string
  name: string
  duration: number    // 秒
  startTime: number   // 秒
  /** 来源：AI 匹配 / 手动选择 / AI 生成 */
  source: 'ai-match' | 'manual' | 'ai-generate'
  /** 波形数据占位（百分比数组） */
  waveform: number[]
}

/** 轨道类型 */
export type TrackType = 'bgm' | 'sfx' | 'voiceover'

/** 轨道 */
export interface Track {
  type: TrackType
  label: string
  icon: string
  entries: AudioEntry[]
  volume: number     // 0-100
  muted: boolean
}

/** 镜头音乐分配 */
export interface ShotMusicAssignment {
  shotIndex: number
  shotLabel: string
  shotDescription: string
  moodTags: MoodTag[]
  bgmId: string | null
  sfxIds: string[]
  voiceoverId: string | null
}

/** 项目配乐总状态 */
export interface ProjectScore {
  segments: MoodSegment[]
  tracks: Track[]
  assignments: ShotMusicAssignment[]
  totalDuration: number
}

/** AI 配乐状态 */
export type AutoScoreStatus =
  | 'idle'
  | 'analyzing'    // 分析中
  | 'matching'     // 匹配中
  | 'generating'   // 生成中
  | 'mixing'       // 混音中
  | 'done'         // 完成
  | 'error'        // 失败

export const AUTO_SCORE_STATUS_LABELS: Record<AutoScoreStatus, string> = {
  idle: '就绪',
  analyzing: '分析中',
  matching: '匹配中',
  generating: '生成中',
  mixing: '混音中',
  done: '完成',
  error: '失败',
}

// ── 波形生成辅助 ──

function randomWaveform(length = 40): number[] {
  const wf: number[] = []
  for (let i = 0; i < length; i++) {
    wf.push(20 + Math.random() * 80)
  }
  return wf
}

// ── Mock 数据 ──

function createMockScore(): ProjectScore {
  const moods: MoodTag[] = ['紧张', '温馨', '激昂', '神秘', '欢快', '悲伤', '平静', '浪漫']
  const shotLabels = [
    '长安夜·开场', '书房对白', '后山练剑', '初遇暗影尊',
    '长安集市', '偶遇苏婉', '朝堂风云', '夜袭',
  ]

  let t = 0
  const segments: MoodSegment[] = shotLabels.map((label, i) => {
    const dur = 18 + Math.random() * 22
    const seg: MoodSegment = {
      id: `seg_${i}`,
      shotIndex: i + 1,
      shotLabel: label,
      mood: moods[i % moods.length]!,
      startTime: t,
      endTime: t + dur,
      color: MOOD_COLORS[moods[i % moods.length]!],
    }
    t += dur
    return seg
  })

  const totalDuration = t

  const tracks: Track[] = [
    {
      type: 'bgm',
      label: 'BGM 背景音乐',
      icon: '🎵',
      volume: 75,
      muted: false,
      entries: [
        {
          id: 'bgm_1',
          name: '古风悠远·琴箫合奏',
          duration: 68,
          startTime: 0,
          source: 'ai-match',
          waveform: randomWaveform(50),
        },
        {
          id: 'bgm_2',
          name: '战场激昂·鼓点雷鸣',
          duration: 45,
          startTime: 72,
          source: 'ai-match',
          waveform: randomWaveform(35),
        },
        {
          id: 'bgm_3',
          name: '月下柔情·古筝独奏',
          duration: 38,
          startTime: 120,
          source: 'ai-generate',
          waveform: randomWaveform(30),
        },
      ],
    },
    {
      type: 'sfx',
      label: 'SFX 音效',
      icon: '🔊',
      volume: 85,
      muted: false,
      entries: [
        {
          id: 'sfx_1',
          name: '剑鸣声',
          duration: 2.5,
          startTime: 42,
          source: 'ai-match',
          waveform: randomWaveform(12),
        },
        {
          id: 'sfx_2',
          name: '集市喧嚣',
          duration: 15,
          startTime: 78,
          source: 'ai-match',
          waveform: randomWaveform(20),
        },
        {
          id: 'sfx_3',
          name: '马蹄声',
          duration: 8,
          startTime: 130,
          source: 'manual',
          waveform: randomWaveform(14),
        },
      ],
    },
    {
      type: 'voiceover',
      label: 'VO 旁白/对白',
      icon: '🎙️',
      volume: 90,
      muted: false,
      entries: [
        {
          id: 'vo_1',
          name: '开场旁白',
          duration: 12,
          startTime: 2,
          source: 'ai-generate',
          waveform: randomWaveform(18),
        },
        {
          id: 'vo_2',
          name: '书房对白',
          duration: 10,
          startTime: 24,
          source: 'ai-generate',
          waveform: randomWaveform(16),
        },
      ],
    },
  ]

  const assignments: ShotMusicAssignment[] = shotLabels.map((label, i) => ({
    shotIndex: i + 1,
    shotLabel: label,
    shotDescription: `镜头 ${i + 1} 的画面描述...`,
    moodTags: [moods[i % moods.length]!, moods[(i + 3) % moods.length]!],
    bgmId: tracks[0]!.entries[Math.min(i, tracks[0]!.entries.length - 1)]?.id ?? null,
    sfxIds: i % 3 === 0 ? [tracks[1]!.entries[0]!.id] : [],
    voiceoverId: i < 2 ? tracks[2]!.entries[i]?.id ?? null : null,
  }))

  return { segments, tracks, assignments, totalDuration }
}

// ── Composable ──

export function useMusicScore() {
  /** 项目配乐状态 */
  const projectScore = ref<ProjectScore | null>(null)

  /** AI 自动配乐状态 */
  const autoScoreStatus = ref<AutoScoreStatus>('idle')

  /** AI 配乐进度 0-100 */
  const autoScoreProgress = ref(0)

  /** 当前播放头位置（秒） */
  const playheadPosition = ref(0)

  /** 当前选中的段落 ID */
  const selectedSegmentId = ref<string | null>(null)

  /** 高级模式开关 */
  const advancedMode = ref(false)

  /** 内部定时器引用 */
  let _scoreTimer: ReturnType<typeof setInterval> | null = null

  // ── 初始化 mock 数据 ──

  function initMockData() {
    projectScore.value = createMockScore()
  }

  // ── AI 自动配乐 ──

  function startAutoScore() {
    if (autoScoreStatus.value !== 'idle' && autoScoreStatus.value !== 'done' && autoScoreStatus.value !== 'error') {
      return // 已在运行中
    }

    autoScoreStatus.value = 'analyzing'
    autoScoreProgress.value = 0

    const phases: { status: AutoScoreStatus; duration: number }[] = [
      { status: 'analyzing', duration: 2000 },
      { status: 'matching', duration: 2500 },
      { status: 'generating', duration: 3000 },
      { status: 'mixing', duration: 1500 },
    ]

    let phaseIndex = 0
    const totalDuration = phases.reduce((s, p) => s + p.duration, 0)
    let elapsed = 0

    _scoreTimer = setInterval(() => {
      elapsed += 100
      autoScoreProgress.value = Math.min(100, Math.round((elapsed / totalDuration) * 100))

      // 检查是否进入下一阶段
      let threshold = 0
      for (let i = 0; i <= phaseIndex && i < phases.length; i++) {
        threshold += phases[i]!.duration
      }
      if (elapsed >= threshold && phaseIndex < phases.length - 1) {
        phaseIndex++
        autoScoreStatus.value = phases[phaseIndex]!.status
      }

      if (elapsed >= totalDuration) {
        clearInterval(_scoreTimer!)
        _scoreTimer = null
        autoScoreStatus.value = 'done'
        autoScoreProgress.value = 100
        // 初始化配乐数据
        initMockData()
      }
    }, 100)
  }

  function cancelAutoScore() {
    if (_scoreTimer) {
      clearInterval(_scoreTimer)
      _scoreTimer = null
    }
    autoScoreStatus.value = 'idle'
    autoScoreProgress.value = 0
  }

  // ── 轨道控制 ──

  function updateTrackVolume(trackType: TrackType, volume: number) {
    if (!projectScore.value) return
    const track = projectScore.value.tracks.find(t => t.type === trackType)
    if (track) {
      track.volume = Math.max(0, Math.min(100, volume))
    }
  }

  function toggleTrackMute(trackType: TrackType) {
    if (!projectScore.value) return
    const track = projectScore.value.tracks.find(t => t.type === trackType)
    if (track) {
      track.muted = !track.muted
    }
  }

  function addTrackEntry(trackType: TrackType, entry: AudioEntry) {
    if (!projectScore.value) return
    const track = projectScore.value.tracks.find(t => t.type === trackType)
    if (track) {
      track.entries.push(entry)
    }
  }

  function removeTrackEntry(trackType: TrackType, entryId: string) {
    if (!projectScore.value) return
    const track = projectScore.value.tracks.find(t => t.type === trackType)
    if (track) {
      track.entries = track.entries.filter(e => e.id !== entryId)
    }
  }

  // ── 段落选择 ──

  function selectSegment(segmentId: string | null) {
    selectedSegmentId.value = segmentId
  }

  // ── 时间格式化 ──

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // ── 计算属性 ──

  const isProcessing = computed(() =>
    autoScoreStatus.value !== 'idle' &&
    autoScoreStatus.value !== 'done' &&
    autoScoreStatus.value !== 'error'
  )

  const statusLabel = computed(() => AUTO_SCORE_STATUS_LABELS[autoScoreStatus.value])

  const hasScore = computed(() => projectScore.value !== null)

  return {
    // 状态
    projectScore,
    autoScoreStatus,
    autoScoreProgress,
    playheadPosition,
    selectedSegmentId,
    advancedMode,
    // 计算属性
    isProcessing,
    statusLabel,
    hasScore,
    // 方法
    initMockData,
    startAutoScore,
    cancelAutoScore,
    updateTrackVolume,
    toggleTrackMute,
    addTrackEntry,
    removeTrackEntry,
    selectSegment,
    formatTime,
  }
}
