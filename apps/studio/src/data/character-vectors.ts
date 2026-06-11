// =============================================================================
// character-vectors.ts — 角色一致性向量库
// W5 任务 5：6 archetype × 1024 维（all-MiniLM-L6-v2 输出 + 风格 ID）
// 复用 character-archetypes-v2.ts 的 ARCHETYPE_VECTORS，并补充 per-style 微调
// =============================================================================

import type { CharacterVector, CharacterArchetype, CharacterV2 } from '../types/character'
import { ARCHETYPE_VECTORS, buildArchetypeVector } from './character-archetypes-v2'

/** 5 主题 / 风格 ID（与 W2 themes 系统一致） */
export const CHARACTER_STYLE_IDS = [
  'minimal-light',  // 极简浅色
  'dark-workshop',  // 深色工坊
  'creator-orange', // 创作者橙
  'neon-cyber',     // 霓虹赛博
  'national-ink',   // 国风水墨
] as const

export type CharacterStyleId = (typeof CHARACTER_STYLE_IDS)[number]

/** 风格 ID 元数据（颜色 token、prompt hint） */
export interface CharacterStyleMeta {
  id: CharacterStyleId
  label: string
  color: string
  accent: string
  promptHint: string
}

export const CHARACTER_STYLE_META: Record<CharacterStyleId, CharacterStyleMeta> = {
  'minimal-light': { id: 'minimal-light', label: '极简浅', color: 'slate', accent: 'sky', promptHint: '淡彩清爽，明亮背景' },
  'dark-workshop': { id: 'dark-workshop', label: '深色工坊', color: 'zinc', accent: 'cyan', promptHint: '深色背景，强对比' },
  'creator-orange': { id: 'creator-orange', label: '创作者橙', color: 'orange', accent: 'amber', promptHint: '暖色活力' },
  'neon-cyber': { id: 'neon-cyber', label: '霓虹赛博', color: 'magenta', accent: 'cyan', promptHint: '霓虹光效' },
  'national-ink': { id: 'national-ink', label: '国风水墨', color: 'ink', accent: 'gold', promptHint: '水墨笔触' },
}

/**
 * 角色向量库：每类 archetype × 每个 style ID 都有一个 1024 维向量。
 * 实际生产中应通过 embedding 服务（见 api/vectors.ts）生成；
 * 此处使用 archetype 向量 + style 偏置向量相加得到近似值。
 */
export const CHARACTER_VECTOR_LIBRARY: Record<CharacterArchetype, Record<CharacterStyleId, CharacterVector>> =
  (() => {
    const result = {} as Record<CharacterArchetype, Record<CharacterStyleId, CharacterVector>>
    const styleIds: CharacterStyleId[] = [...CHARACTER_STYLE_IDS]
    const styleVectors: Record<CharacterStyleId, CharacterVector> = Object.fromEntries(
      styleIds.map(s => [s, buildStyleVector(s)]),
    ) as Record<CharacterStyleId, CharacterVector>
    for (const arch of Object.keys(ARCHETYPE_VECTORS) as CharacterArchetype[]) {
      const archVec = ARCHETYPE_VECTORS[arch]
      result[arch] = Object.fromEntries(
        styleIds.map(s => [s, blendVectors(archVec, styleVectors[s], 0.18)]),
      ) as Record<CharacterStyleId, CharacterVector>
    }
    return result
  })()

/** 风格偏置向量（与 archetype 向量相加，形成 0.18 权重混合） */
function buildStyleVector(style: CharacterStyleId): CharacterVector {
  // 使用风格名+关键词作为伪文本，生成稳定 1024 维向量
  const meta = CHARACTER_STYLE_META[style]
  const text = `${style} ${meta.label} ${meta.promptHint}`
  return buildArchetypeVector('youth', { seed: hashStr(style), extraText: text })
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** 加权混合两个向量（v1 主，v2 辅，alpha=v2 权重） */
function blendVectors(v1: CharacterVector, v2: CharacterVector, alpha: number): CharacterVector {
  const out: number[] = new Array(v1.length)
  for (let i = 0; i < v1.length; i++) {
    out[i] = Math.round((v1[i] * (1 - alpha) + v2[i] * alpha) * 1e4) / 1e4
  }
  return normalize(out)
}

function normalize(v: number[]): number[] {
  let s = 0
  for (const x of v) s += x * x
  const norm = Math.sqrt(s) || 1
  return v.map(x => Math.round((x / norm) * 1e4) / 1e4)
}

/** 取出某 archetype × style 的向量（克隆，避免外部修改） */
export function getCharacterVector(archetype: CharacterArchetype, style: CharacterStyleId): CharacterVector {
  return [...CHARACTER_VECTOR_LIBRARY[archetype][style]]
}

/** 列出 6 archetype 的所有向量（带 style 标注） */
export function listAllCharacterVectors(): Array<{
  archetype: CharacterArchetype
  style: CharacterStyleId
  vector: CharacterVector
}> {
  const out: Array<{ archetype: CharacterArchetype; style: CharacterStyleId; vector: CharacterVector }> = []
  for (const [arch, styleMap] of Object.entries(CHARACTER_VECTOR_LIBRARY) as [CharacterArchetype, Record<CharacterStyleId, CharacterVector>][]) {
    for (const [style, vec] of Object.entries(styleMap) as [CharacterStyleId, CharacterVector][]) {
      out.push({ archetype: arch, style, vector: vec })
    }
  }
  return out
}

/** 构造角色 v2 的完整向量（archetype + style + 描述拼接） */
export function buildCharacterV2Vector(character: Pick<CharacterV2, 'archetype' | 'styleId' | 'description' | 'tags'>): CharacterVector {
  const baseVec = getCharacterVector(character.archetype, character.styleId as CharacterStyleId)
  // 描述 + 标签再生成一个微调向量，混合到 base
  const extraText = [character.description ?? '', ...(character.tags ?? [])].join(' ')
  if (!extraText.trim()) return baseVec
  const tweak = buildArchetypeVector(character.archetype, {
    seed: hashStr(character.archetype + character.styleId),
    extraText,
  })
  return blendVectors(baseVec, tweak, 0.12)
}

function _hashStrInline(s: string): number {
  return hashStr(s)
}
