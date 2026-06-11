// =============================================================================
// studio.ts — Studio 视图层共享类型（L2 林染 5 视图）
// W6 任务 2：项目编辑器 / 角色 / 场景 / 工具箱 / 导出 的视图层模型
//
// 与 W3/W4 类型（character / scene / workflow）解耦，专注于 UI 展示
// 后续接 api/ 时再做映射
// =============================================================================

import type { CharacterArchetype } from './character'
import type { SceneTemplate, SceneSubScene } from './scene'

/** 5 主题 ID（与 character/scene 中一致） */
export type StudioThemeId =
  | 'minimal-light'
  | 'dark-workshop'
  | 'creator-orange'
  | 'neon-cyber'
  | 'national-ink'

/** 5 主题元信息（用于主题切换 UI） */
export interface StudioThemeMeta {
  id: StudioThemeId
  label: string
  icon: string
  /** 主色（CSS color 值或 token） */
  primary: string
  /** 强调色 */
  accent: string
  /** 暗色模式 */
  dark: boolean
}

export const STUDIO_THEMES: StudioThemeMeta[] = [
  { id: 'minimal-light', label: '极简白', icon: '☀️', primary: '#f5f5f4', accent: '#0ea5e9', dark: false },
  { id: 'dark-workshop', label: '深色工坊', icon: '🌙', primary: '#0e0f12', accent: '#f59e0b', dark: true },
  { id: 'creator-orange', label: '创作者橙', icon: '🟧', primary: '#fff7ed', accent: '#ea580c', dark: false },
  { id: 'neon-cyber', label: '霓虹赛博', icon: '🌃', primary: '#0a0118', accent: '#d946ef', dark: true },
  { id: 'national-ink', label: '国风水墨', icon: '🖌️', primary: '#fdf6e3', accent: '#1c1917', dark: false },
]

/** 分镜（shot）—— 项目编辑器的核心单元 */
export interface Shot {
  id: string
  /** 序号（1-based 显示） */
  index: number
  /** 分镜标题 */
  title: string
  /** 场景描述（用于 AI 提示词） */
  description: string
  /** 关联角色 archetype 列表 */
  characterArchetypes: CharacterArchetype[]
  /** 关联场景模板 */
  sceneTemplate: SceneTemplate
  /** 关联子场景 ID（可空） */
  subSceneId: string | null
  /** 镜头语言：远/中/近/特写 */
  shotType: ShotType
  /** 视角：平视/俯视/仰视 */
  cameraAngle: CameraAngle
  /** 运镜：固定/推进/拉远/横移/摇镜 */
  cameraMove: CameraMove
  /** 对白（可空） */
  dialogue: string
  /** 旁白（可空） */
  narration: string
  /** 时长（秒） */
  duration: number
  /** 状态 */
  status: ShotStatus
  /** 占位图 / 已生成图 */
  imageUrl: string | null
  /** 标签 */
  tags: string[]
  /** 备注 */
  note: string
  /** 选中权重（用于 AI 生成时的优先级） */
  weight: number
  /** 锁定 */
  locked: boolean
  /** 创建/更新时间 */
  createdAt: number
  updatedAt: number
}

export type ShotType = 'extreme-wide' | 'wide' | 'medium' | 'close-up' | 'extreme-close' | 'over-shoulder' | 'pov'
export type CameraAngle = 'eye' | 'high' | 'low' | 'birds-eye' | 'worms-eye' | 'dutch'
export type CameraMove = 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'track' | 'zoom'
export type ShotStatus = 'draft' | 'scripted' | 'generating' | 'ready' | 'approved' | 'rejected'

/** ShotType 标签 */
export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  'extreme-wide': '全景',
  'wide': '远景',
  'medium': '中景',
  'close-up': '近景',
  'extreme-close': '特写',
  'over-shoulder': '过肩',
  'pov': '主观',
}

export const CAMERA_ANGLE_LABELS: Record<CameraAngle, string> = {
  'eye': '平视',
  'high': '俯视',
  'low': '仰视',
  'birds-eye': '鸟瞰',
  'worms-eye': '虫视',
  'dutch': '倾斜',
}

export const CAMERA_MOVE_LABELS: Record<CameraMove, string> = {
  'static': '固定',
  'push': '推进',
  'pull': '拉远',
  'pan': '摇镜',
  'tilt': '俯仰',
  'track': '横移',
  'zoom': '变焦',
}

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: '草稿',
  scripted: '已写脚本',
  generating: '生成中',
  ready: '已生成',
  approved: '已通过',
  rejected: '已驳回',
}

export const SHOT_STATUS_COLORS: Record<ShotStatus, string> = {
  draft: 'gray',
  scripted: 'blue',
  generating: 'amber',
  ready: 'cyan',
  approved: 'green',
  rejected: 'red',
}

/** 项目（project）—— 编辑器顶层的容器 */
export interface Project {
  id: string
  name: string
  description: string
  /** 主题 ID */
  themeId: StudioThemeId
  /** 总目标时长（秒） */
  targetDuration: number
  /** 分镜列表 */
  shots: Shot[]
  /** 标签 */
  tags: string[]
  /** 状态 */
  status: 'planning' | 'in-progress' | 'review' | 'completed' | 'archived'
  /** 创建/更新时间 */
  createdAt: number
  updatedAt: number
}

/** 工具定义（工具箱） */
export interface StudioTool {
  id: string
  /** 工具名 */
  name: string
  /** 类别 */
  category: ToolCategory
  /** 描述 */
  description: string
  /** 图标 */
  icon: string
  /** 颜色 token */
  color: string
  /** 提示词模板（变量用 {{name}} 包裹） */
  promptTemplate: string
  /** 提示词变量定义 */
  promptVars: ToolPromptVar[]
  /** 批量支持 */
  batchable: boolean
  /** 预估成本（USD/次） */
  costUsdPerCall: number
  /** 状态 */
  enabled: boolean
  /** 是否推荐 */
  recommended: boolean
}

export type ToolCategory = 'text' | 'image' | 'video' | 'audio' | 'utility'

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '音频',
  utility: '工具',
}

export interface ToolPromptVar {
  /** 变量名 */
  name: string
  /** 标签 */
  label: string
  /** 类型 */
  type: 'text' | 'textarea' | 'number' | 'select'
  /** 默认值 */
  default: string
  /** 选项（select） */
  options?: string[]
  /** 必填 */
  required?: boolean
  /** 帮助 */
  help?: string
}

/** 导出格式（导出中心） */
export type ExportFormat = 'mp4' | 'mov' | 'srt' | 'vtt' | 'ass'
export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; mime: string; size: 'small' | 'medium' | 'large' }[] = [
  { id: 'mp4', label: 'MP4 视频', ext: 'mp4', mime: 'video/mp4', size: 'large' },
  { id: 'mov', label: 'MOV 视频', ext: 'mov', mime: 'video/quicktime', size: 'large' },
  { id: 'srt', label: 'SRT 字幕', ext: 'srt', mime: 'text/plain', size: 'small' },
  { id: 'vtt', label: 'VTT 字幕', ext: 'vtt', mime: 'text/vtt', size: 'small' },
  { id: 'ass', label: 'ASS 字幕', ext: 'ass', mime: 'text/plain', size: 'small' },
]

/** 发布平台 */
export type PlatformId =
  | 'bilibili'
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'weibo'
  | 'wechat'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'telegram'

export interface Platform {
  id: PlatformId
  label: string
  icon: string
  /** 颜色 token */
  color: string
  /** 推荐格式 */
  recommendedFormat: ExportFormat
  /** 最大时长（秒） */
  maxDuration: number
  /** 比例 */
  aspect: '16:9' | '9:16' | '1:1' | '4:3' | '3:4'
  /** 国内/海外 */
  region: 'cn' | 'global' | 'both'
}

export const PLATFORMS: Platform[] = [
  { id: 'bilibili', label: 'B 站', icon: '📺', color: 'pink', recommendedFormat: 'mp4', maxDuration: 7200, aspect: '16:9', region: 'cn' },
  { id: 'douyin', label: '抖音', icon: '🎵', color: 'red', recommendedFormat: 'mp4', maxDuration: 900, aspect: '9:16', region: 'cn' },
  { id: 'kuaishou', label: '快手', icon: '⚡', color: 'orange', recommendedFormat: 'mp4', maxDuration: 900, aspect: '9:16', region: 'cn' },
  { id: 'xiaohongshu', label: '小红书', icon: '📕', color: 'rose', recommendedFormat: 'mp4', maxDuration: 300, aspect: '3:4', region: 'cn' },
  { id: 'weibo', label: '微博', icon: '🔵', color: 'amber', recommendedFormat: 'mp4', maxDuration: 600, aspect: '16:9', region: 'cn' },
  { id: 'wechat', label: '视频号', icon: '💚', color: 'green', recommendedFormat: 'mp4', maxDuration: 1800, aspect: '9:16', region: 'cn' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', color: 'red', recommendedFormat: 'mp4', maxDuration: 43200, aspect: '16:9', region: 'global' },
  { id: 'tiktok', label: 'TikTok', icon: '🎶', color: 'cyan', recommendedFormat: 'mp4', maxDuration: 600, aspect: '9:16', region: 'global' },
  { id: 'twitter', label: 'X (Twitter)', icon: '🐦', color: 'sky', recommendedFormat: 'mp4', maxDuration: 140, aspect: '16:9', region: 'global' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: 'pink', recommendedFormat: 'mp4', maxDuration: 90, aspect: '1:1', region: 'global' },
  { id: 'facebook', label: 'Facebook', icon: '👥', color: 'blue', recommendedFormat: 'mp4', maxDuration: 7200, aspect: '16:9', region: 'global' },
  { id: 'telegram', label: 'Telegram', icon: '✈️', color: 'sky', recommendedFormat: 'mp4', maxDuration: 3600, aspect: '16:9', region: 'both' },
]

/** 导出任务 */
export interface ExportTask {
  id: string
  /** 项目 ID */
  projectId: string
  /** 格式 */
  format: ExportFormat
  /** 平台（多选） */
  platforms: PlatformId[]
  /** 进度 0-100 */
  progress: number
  /** 状态 */
  status: 'queued' | 'preparing' | 'encoding' | 'uploading' | 'success' | 'failed' | 'cancelled'
  /** 步骤描述 */
  step: string
  /** 输出 URL（成功时） */
  outputUrl: string | null
  /** 错误 */
  error: string | null
  /** 成本 USD */
  costUsd: number
  /** 大小字节 */
  sizeBytes: number
  /** 触发时间 */
  createdAt: number
  /** 完成时间 */
  finishedAt: number | null
}
