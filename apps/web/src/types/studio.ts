/**
 * types/studio.ts — types for ProjectEditorView & SceneView
 * Reconstructed after dead-code cleanup, 2026-06-21
 */

export type StudioThemeId = string

export const STUDIO_THEMES = [
  { id: 'dark-workshop', label: '暗夜工坊', icon: '🌙', accent: '#ff7a45', primary: '#0a0e1a' },
  { id: 'national-ink', label: '国风墨', icon: '🖌️', accent: '#a8302b', primary: '#f5efe1' },
  { id: 'neon-cyber', label: '霓虹赛博', icon: '💜', accent: '#ff00aa', primary: '#0a0014' },
  { id: 'minimal-light', label: '极简白', icon: '☀️', accent: '#2563eb', primary: '#ffffff' },
  { id: 'creator-orange', label: '创作橙', icon: '🔥', accent: '#ff6b1a', primary: '#fffaf5' },
] as const

export type ShotStatus = 'draft' | 'scripted' | 'generating' | 'ready' | 'approved' | 'rejected'

// ── Seedance API 原生类型 — Shot 的完整生成配方 ──

/** content[].image_url 条目 — 直接映射 Seedance content array */
export interface ShotMediaImage {
  url: string
  role: 'first_frame' | 'last_frame' | 'reference_image'
  label?: string
  sourceType?: 'character' | 'scene' | 'custom'
  sourceId?: string
}

/** content[].video 条目 */
export interface ShotMediaVideo {
  url: string
  role: 'reference_video'
  label?: string
}

/** content[].audio 条目 */
export interface ShotMediaAudio {
  url: string
  role: 'reference_audio'
  label?: string
}

/** 多段镜头运动 — 支持"先 pan 再 dolly 再 zoom"组合 */
export interface CameraAction {
  move: string
  speed?: 'slow' | 'normal' | 'fast'
  durationRatio?: number
  description?: string
}

/** 每个 Shot 的完整生成配置 — 直接映射 Seedance API content array + parameters */
export interface ShotGeneration {
  /** 完整英文 prompt（AI 生成 + 用户可调） */
  prompt?: string
  /** 对话文本 — 用双引号注入 prompt，触发 Seedance 口型同步 */
  dialogue?: string
  /** 旁白 */
  narration?: string
  /** 音效描述 */
  sfx?: string
  /** 参考图（角色/场景/风格/自定义），最多 9 张 */
  referenceImages?: ShotMediaImage[]
  /** 参考视频，最多 3 个 */
  referenceVideos?: ShotMediaVideo[]
  /** 参考音频，最多 3 个 */
  referenceAudios?: ShotMediaAudio[]
  /** 多段镜头运动组合 */
  cameraActions?: CameraAction[]
  shotType?: string
  cameraAngle?: string
  cameraLens?: string
  lightingPreset?: string
  lightingCustom?: string
  duration?: number
  resolution?: string
  generateAudio?: boolean
  seed?: number
  returnLastFrame?: boolean
  firstFrameOverride?: string
  lastFrameOverride?: string
}

export interface Shot {
  id: string
  index: number
  title: string
  status: ShotStatus
  duration: number
  description?: string
  characterArchetypes: string[]
  characterOutfitSelections?: Record<string, string>
  sceneTemplateId?: string
  sceneTemplate?: string
  subSceneId?: string | null
  shotType?: string
  cameraAngle?: string
  cameraMove?: string
  cameraLens?: string
  lightingPreset?: string
  lightingCustom?: string
  dialogue?: string
  narration?: string
  sfx?: string
  imageUrl?: string | null
  tags?: string[]
  note?: string
  weight?: number
  locked?: boolean
  createdAt: number
  updatedAt: number
  /** 完整生成配置（直接映射 Seedance API） */
  generation?: ShotGeneration
  /** 已生成的视频 URL */
  videoUrl?: string | null
  /** 视频实际尾帧（return_last_frame 返回，可链式传给下一镜头） */
  videoLastFrameUrl?: string | null
  /** 转场方式（与下一镜头之间的过渡） */
  transition?: 'cut' | 'dissolve' | 'fade-black' | 'fade-white' | 'whip-pan' | 'match-cut' | 'smash-cut' | 'j-cut' | 'l-cut'
  /** 节奏/情绪基调 */
  pacing?: 'tense' | 'calm' | 'explosive' | 'melancholic' | 'suspenseful' | 'comedic' | 'romantic' | 'epic'
  /** 角色动作速度 */
  actionSpeed?: 'slow-motion' | 'normal' | 'fast' | 'sudden' | 'gradual'
  /** 微表情描述（角色面部细节：眼神、嘴角、眉头等） */
  microExpression?: string
  /** 角色站位描述（角色在画面中的位置关系） */
  positioning?: string
  /** 空间锚点（场景中的固定参照物，保持场景连贯性） */
  spatialAnchor?: string
  /** 拍摄角度（平视/俯视/仰视/鸟瞰/倾斜） */
  cameraViewAngle?: string
  /** 同一长对白拆分出的镜头共享此 ID，用于配音连续性分组 */
  dialogueGroupId?: string
  /** 标记此镜头角色职责：说话人 or 反应镜头 */
  dialogueRole?: 'speaker' | 'reaction'
  /** 是否为反应镜头（便捷标记，等同 dialogueRole === 'reaction'） */
  isReactionShot?: boolean
  /** 景别(explicit 字段，对应手册"景别"；默认等同 shotType) */
  shotSize?: string
  /** 动作强度（P6：文戏/武戏分模式驱动） calm=文戏 normal=通用 action=武戏 */
  actionIntensity?: 'calm' | 'normal' | 'action'
  /** 该镜头注入的全局制作规范锚点文本（G1：贯穿全局的风格/色调/氛围） */
  globalDirective?: string
}

/**
 * 全局制作规范（Global Directive）— 工业级漫剧生成的第一性原则。
 * 每一部剧先生成一段贯穿全局的规范，注入到每一个镜头的 prompt 开头，
 * 是解决"跨镜头不一致"的根（比单镜头参考图更根本）。
 */
export interface GlobalDirective {
  /** 风格锁定（如 "2D 日漫风格"） */
  styleLock: string
  /** 全局色调（如 "冷蓝月光色调"） */
  colorTone: string
  /** 氛围基调（如 "悬疑紧张"） */
  mood: string
  /** 全局约束（无字幕/无水印/防双胞胎等） */
  constraints: string
  /** 环境音效基调（如 "雨声、远处雷鸣"） */
  ambientSound: string
  /** 已格式化的、可直接注入每镜头 prompt 的锚点文本 */
  anchor: string
}

export interface Project {
  id: number
  name: string
  status?: string
  description?: string
  createdAt: number
  updatedAt: number
  shots: Shot[]
}

export function makeMockProject(n: number): Project {
  const now = Date.now()
  return {
    id: n,
    name: `示例项目 ${n}`,
    status: 'planning',
    description: '这是一个示例项目',
    createdAt: now,
    updatedAt: now,
    shots: [],
  }
}

export const SHOT_TYPE_LABELS: Record<string, string> = {
  wide: '远景', medium: '中景', close: '特写', establishing: '定场',
}

export const CAMERA_ANGLE_LABELS: Record<string, string> = {
  'eye-level': '平视', 'low-angle': '仰角', 'high-angle': '俯角', 'dutch': '倾斜',
}

export const CAMERA_MOVE_LABELS: Record<string, string> = {
  static: '固定', pan: '横摇', tilt: '纵摇', dolly: '推拉', tracking: '跟拍',
  'zoom-in': '推进', 'zoom-out': '拉远', crane: '升降', handheld: '手持', steadicam: '稳定器',
}

export const TRANSITION_LABELS: Record<string, string> = {
  'cut': '硬切', 'dissolve': '叠化', 'fade-black': '淡入黑', 'fade-white': '闪白',
  'whip-pan': '甩镜', 'match-cut': '匹配剪辑', 'smash-cut': '猛切', 'j-cut': 'J-cut', 'l-cut': 'L-cut',
}

export const PACING_LABELS: Record<string, string> = {
  'tense': '紧张', 'calm': '平静', 'explosive': '爆发', 'melancholic': '忧郁',
  'suspenseful': '悬疑', 'comedic': '喜感', 'romantic': '浪漫', 'epic': '史诗',
}

export const ACTION_SPEED_LABELS: Record<string, string> = {
  'slow-motion': '慢动作', 'normal': '正常', 'fast': '快速', 'sudden': '骤变', 'gradual': '渐进',
}

export const SHOT_SIZE_LABELS: Record<string, string> = {
  'extreme-wide': '大远景', 'establishing': '定场', 'wide': '远景', 'medium': '中景',
  'close': '特写', 'extreme-close': '大特写',
}

export const ACTION_INTENSITY_LABELS: Record<string, string> = {
  'calm': '文戏', 'normal': '通用', 'action': '武戏',
}

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: '草稿', scripted: '已脚本', generating: '生成中', ready: '就绪', approved: '已确认', rejected: '已驳回',
}

export const SHOT_STATUS_COLORS: Record<ShotStatus, string> = {
  draft: '#9ca3af', scripted: '#60a5fa', generating: '#fbbf24', ready: '#34d399', approved: '#10b981', rejected: '#ef4444',
}

// Workflow types for orchestrator.ts (minimal, v2.0 reduced scope)
export interface Workflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: unknown[]
}
export interface WorkflowRun {
  id: string
  status: string
  steps: unknown[]
}
export interface DebugEvent {
  type: string
  data: unknown
}
export interface WorkflowNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
}
