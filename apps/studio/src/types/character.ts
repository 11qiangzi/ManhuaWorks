// =============================================================================
// character.ts — 角色类型定义
// W5 任务 5：角色 v2（6 类 archetype + 一致性向量）
// =============================================================================

/** 6 类角色 archetype */
export type CharacterArchetype =
  | 'youth'         // 少年：14-22 岁，成长型主角
  | 'maiden'        // 少女：14-22 岁，成长型女主
  | 'villain'       // 反派：核心冲突来源
  | 'mentor'        // 导师：指引/陪伴型长辈或同辈
  | 'child'         // 儿童：8-13 岁，天真/灵动机敏
  | 'elder'         // 老者：阅历深厚，智慧或权威

/** 角色 archetype 元数据 */
export interface CharacterArchetypeMeta {
  id: CharacterArchetype
  /** 中文标签 */
  label: string
  /** 英文/拼音 label */
  code: string
  /** 主题色 token（5 主题） */
  color: string
  /** 主题色 token（亮） */
  colorAccent: string
  /** emoji 图标 */
  icon: string
  /** 简短描述（一行） */
  tagline: string
  /** 详细描述（4-6 行） */
  description: string
  /** 典型年龄区间 */
  ageRange: { min: number; max: number }
  /** 体型预设（用于形象设计） */
  bodyShape: string
  /** 服装基调（用于形象设计） */
  clothingTone: string
  /** 默认表情 ID 列表 */
  defaultExpressions: string[]
  /** 视角默认值（4 角度） */
  defaultViews: CharacterViewKey[]
  /** 风格 ID（与场景风格一致） */
  styleId: string
  /** 行为特征 */
  traits: string[]
  /** 常见人物关系（用于一致性配对） */
  relationships: string[]
  /** 主题适配（5 套主题） */
  themeAdapters: Record<string, ThemeVariant>
}

/** 角色视图（前/侧/背/3/4） */
export type CharacterViewKey = 'front' | 'side' | 'back' | 'threeQ'

/** 角色视角资源（4 角度 + 表情） */
export interface CharacterViewAssets {
  front: string | null
  side: string | null
  back: string | null
  threeQ: string | null
}

/** 表情 */
export interface CharacterExpression {
  id: string
  name: string
  icon: string
  imageUrl?: string | null
}

/** 主题适配变体（5 套主题） */
export interface ThemeVariant {
  /** 主色 override */
  color?: string
  /** 强调色 override */
  accent?: string
  /** 主题专属提示词（注入到生成 prompt） */
  promptHint?: string
}

/** 一致性向量（1024 维） */
export type CharacterVector = number[]

/** 角色定义 v2 */
export interface CharacterV2 {
  id: string
  /** 角色名 */
  name: string
  /** archetype */
  archetype: CharacterArchetype
  /** 描述（剧情/性格/外形） */
  description: string
  /** 视角资源 */
  views: CharacterViewAssets
  /** 表情列表 */
  expressions: CharacterExpression[]
  /** 标签 */
  tags: string[]
  /** 一致性向量（1024 维） */
  vector: CharacterVector
  /** 风格 ID */
  styleId: string
  /** 主题 ID（5 套之一） */
  themeId: string
  /** 锁定（防止改写） */
  locked: boolean
  /** 一致性评分（最近一次生成，0-100） */
  consistencyScore: number
  /** 关联角色 ID（关系网络） */
  relatedIds: string[]
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/** 一致性检查结果 */
export interface ConsistencyCheckResult {
  passed: boolean
  /** cosine 相似度（-1~1） */
  similarity: number
  /** 阈值 */
  threshold: number
  /** 失败原因 */
  reason?: string
  /** 建议（重新生成时的提示） */
  suggestion?: string
}

/** 6 archetype ID 列表（用于枚举/测试） */
export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  'youth', 'maiden', 'villain', 'mentor', 'child', 'elder',
]

/** 4 视图 key 列表 */
export const CHARACTER_VIEWS: CharacterViewKey[] = ['front', 'side', 'back', 'threeQ']

/** 默认一致性阈值（cosine 相似度） */
export const DEFAULT_CONSISTENCY_THRESHOLD = 0.85
