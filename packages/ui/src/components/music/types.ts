/**
 * Music Component Library - Type Definitions
 * S1 Spec: Audio scoring, track management, and mood classification types
 */

/** 音轨类型 */
export type TrackType = 'bgm' | 'sfx' | 'voiceover';

/** 情绪标签信息 */
export interface MoodInfo {
  id: string;
  label: string;
  labelEn: string;
  color: string;
  confidence: number;
}

/** 音频轨道条目 */
export interface AudioTrackEntry {
  id: string;
  name: string;
  type: TrackType;
  format: 'mp3' | 'wav' | 'flac' | 'aac';
  duration: number;
  audioUrl: string;
  waveformData?: number[];
  mood?: MoodInfo[];
  genre?: string[];
  bpm?: number;
  startTime?: number;
  isValid: boolean;
  isPlaying: boolean;
}

/** 轨道数据 */
export interface TrackData {
  type: TrackType;
  clips: AudioTrackEntry[];
  volume: number;
  muted: boolean;
  totalDuration: number;
}

/** 项目配乐总谱 */
export interface ProjectScore {
  projectId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  source: 'auto' | 'manual' | 'mixed';
  tracks: { bgm: TrackData; sfx: TrackData; voiceover: TrackData };
  totalDuration: number;
  metadata: {
    moodsUsed: string[];
    totalClips: number;
    autoScoreSuccessRate?: number;
  };
}

/** 自动配乐状态 */
export type AutoScoreStatus =
  | 'idle'
  | 'analyzing'
  | 'matching'
  | 'generating'
  | 'mixing'
  | 'complete'
  | 'error'
  | 'timeout';

/** 时间线段（用于 MoodTimeline） */
export interface ScoreSegment {
  id: string;
  startTime: number;
  endTime: number;
  moodId: string;
  moodLabel: string;
  color: string;
  trackType: TrackType;
  confidence: number;
}

/** 音频筛选条件 */
export interface AudioFilter {
  type?: TrackType;
  mood?: string[];
  genre?: string[];
  bpmRange?: [number, number];
  durationRange?: [number, number];
  format?: string[];
}

/** 音频选择器尺寸 */
export type ComponentSize = 'sm' | 'md' | 'lg';
