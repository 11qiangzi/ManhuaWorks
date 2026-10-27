// =============================================================================
// scene.ts — 场景类型定义
// W5 任务 5：场景 v2（12 类模板 + 子场景 + 向量）
// =============================================================================

/** 12 类场景模板 */
export type SceneTemplate =
  | 'scifi-city'      // 科幻都市：霓虹/玻璃幕墙/悬浮车
  | 'wasteland'       // 废土：沙暴/锈铁/枯树
  | 'spaceship'       // 太空船：舰桥/舱室/星图
  | 'modern-school'   // 现代校园：教室/操场/图书馆
  | 'xianxia'         // 古风仙侠：山峰/云海/亭台
  | 'republic'        // 民国：长街/黄包车/旗袍
  | 'apocalypse'      // 末日：废墟/毒雾/幸存营地
  | 'school-life'     // 校园日常：走廊/天台/食堂（区分现代校园）
  | 'cyberpunk'       // 赛博朋克：高楼雨夜/全息广告/改造人
  | 'ocean'           // 海洋：海面/深海/珊瑚礁
  | 'snow-mountain'   // 雪山：冰原/雪松/极光
  | 'forest'          // 森林：密林/晨雾/林间小屋

/** 场景模板元数据 */
export interface SceneTemplateMeta {
  id: SceneTemplate
  /** 中文标签 */
  label: string
  /** 英文/拼音 code */
  code: string
  /** 主题色 token */
  color: string
  /** 主题色 token（亮） */
  colorAccent: string
  /** emoji */
  icon: string
  /** 一行描述 */
  tagline: string
  /** 4-6 行详细描述 */
  description: string
  /** 典型色温（K） */
  defaultColorTemp: number
  /** 默认光向 */
  defaultLightDir: string
  /** 默认强度 0-1 */
  defaultIntensity: number
  /** 子场景列表（4-6） */
  subScenes: SceneSubScene[]
  /** 关键词（用于文本匹配） */
  keywords: string[]
  /** 风格 ID（5 主题之一） */
  styleId: string
  /** 典型角色 archetype 适配（一致性配对） */
  compatibleArchetypes: string[]
  /** 主题适配（5 套主题） */
  themeAdapters: Record<string, ThemeVariant>
}

/** 子场景 */
export interface SceneSubScene {
  id: string
  name: string
  /** 短描述 */
  description: string
  /** 子场景专属色温（K） */
  colorTemp: number
  /** 子场景专属光向 */
  lightDir: string
  /** 子场景专属强度 0-1 */
  intensity: number
  /** 关键词 */
  keywords: string[]
  /** 标签 */
  tags: string[]
  /** 占位图（生成前） */
  placeholder?: string
}

/** 主题适配变体 */
export interface ThemeVariant {
  color?: string
  accent?: string
  promptHint?: string
}

/** 场景资源 */
export interface SceneAssets {
  /** 主图 URL */
  imageUrl: string | null
  /** 缩略图 */
  thumbnailUrl?: string | null
}

/** 光影参数 */
export interface SceneLighting {
  timeOfDay: string
  lightDir: string
  colorTemp: number
  intensity: number
  name?: string
}

/** 一致性向量（1024 维） */
export type SceneVector = number[]

/** 场景 v2 定义 */
export interface SceneV2 {
  id: string
  /** 场景名 */
  name: string
  /** 模板 ID */
  template: SceneTemplate
  /** 父场景 ID（如果是子场景） */
  parentId?: string | null
  /** 描述 */
  description: string
  /** 资源 */
  assets: SceneAssets
  /** 光影 */
  lighting: SceneLighting
  /** 标签 */
  tags: string[]
  /** 一致性向量 */
  vector: SceneVector
  /** 风格 ID */
  styleId: string
  /** 主题 ID */
  themeId: string
  /** 复用标记 */
  reusable: boolean
  /** 一致性评分 */
  consistencyScore: number
  /** 关联角色 archetype */
  relatedArchetypes: string[]
  /** 创建/更新时间 */
  createdAt: number
  updatedAt: number
}

/** 场景匹配结果 */
export interface SceneMatchResult {
  /** 模板 */
  template: SceneTemplate
  /** 模板匹配度 0-1 */
  templateScore: number
  /** 推荐的子场景 */
  subScenes: Array<SceneSubScene & { score: number }>
  /** 综合得分 */
  totalScore: number
}

/** 12 模板 ID 列表 */
export const SCENE_TEMPLATES: SceneTemplate[] = [
  'scifi-city', 'wasteland', 'spaceship', 'modern-school',
  'xianxia', 'republic', 'apocalypse', 'school-life',
  'cyberpunk', 'ocean', 'snow-mountain', 'forest',
]

/** 默认一致性阈值 */
export const DEFAULT_SCENE_CONSISTENCY_THRESHOLD = 0.82

/** 5 套主题 ID */
export const THEME_IDS = [
  'minimal-light',
  'dark-workshop',
  'creator-orange',
  'neon-cyber',
  'national-ink',
] as const

export type ThemeId = (typeof THEME_IDS)[number]
