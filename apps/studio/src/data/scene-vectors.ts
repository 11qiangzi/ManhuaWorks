// =============================================================================
// scene-vectors.ts — 场景一致性向量库
// W5 任务 5：12 template × 1024 维（all-MiniLM-L6-v2 输出 + 风格 ID）
// 复用 scene-templates-v2.ts 的 SCENE_TEMPLATE_VECTORS，并补充 per-style 微调
// =============================================================================

import type { SceneVector, SceneTemplate, SceneV2 } from '../types/scene'
import { SCENE_TEMPLATE_VECTORS, buildSceneTemplateVector } from './scene-templates-v2'

/** 5 主题 / 风格 ID（与 character-vectors 一致） */
export const SCENE_STYLE_IDS = [
  'minimal-light',
  'dark-workshop',
  'creator-orange',
  'neon-cyber',
  'national-ink',
] as const

export type SceneStyleId = (typeof SCENE_STYLE_IDS)[number]

/** 风格 ID 元数据 */
export interface SceneStyleMeta {
  id: SceneStyleId
  label: string
  color: string
  accent: string
  promptHint: string
}

export const SCENE_STYLE_META: Record<SceneStyleId, SceneStyleMeta> = {
  'minimal-light': { id: 'minimal-light', label: '极简浅', color: 'slate', accent: 'sky', promptHint: '淡彩环境' },
  'dark-workshop': { id: 'dark-workshop', label: '深色工坊', color: 'zinc', accent: 'cyan', promptHint: '深色环境' },
  'creator-orange': { id: 'creator-orange', label: '创作者橙', color: 'orange', accent: 'amber', promptHint: '暖色环境' },
  'neon-cyber': { id: 'neon-cyber', label: '霓虹赛博', color: 'magenta', accent: 'cyan', promptHint: '霓虹环境' },
  'national-ink': { id: 'national-ink', label: '国风水墨', color: 'ink', accent: 'gold', promptHint: '水墨环境' },
}

/**
 * 场景向量库：每类 template × 每个 style ID 都有一个 1024 维向量。
 * 与角色向量库同构：template 向量 + style 偏置向量以 0.18 权重混合。
 */
export const SCENE_VECTOR_LIBRARY: Record<SceneTemplate, Record<SceneStyleId, SceneVector>> =
  (() => {
    const result = {} as Record<SceneTemplate, Record<SceneStyleId, SceneVector>>
    const styleIds: SceneStyleId[] = [...SCENE_STYLE_IDS]
    const styleVectors: Record<SceneStyleId, SceneVector> = Object.fromEntries(
      styleIds.map(s => [s, buildStyleVector(s)]),
    ) as Record<SceneStyleId, SceneVector>
    for (const tpl of Object.keys(SCENE_TEMPLATE_VECTORS) as SceneTemplate[]) {
      const tplVec = SCENE_TEMPLATE_VECTORS[tpl]
      result[tpl] = Object.fromEntries(
        styleIds.map(s => [s, blendVectors(tplVec, styleVectors[s], 0.18)]),
      ) as Record<SceneStyleId, SceneVector>
    }
    return result
  })()

function buildStyleVector(style: SceneStyleId): SceneVector {
  const meta = SCENE_STYLE_META[style]
  const text = `${style} ${meta.label} ${meta.promptHint}`
  return buildSceneTemplateVector('forest', { seed: hashStr(style), extraText: text })
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function blendVectors(v1: SceneVector, v2: SceneVector, alpha: number): SceneVector {
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

/** 取出某 template × style 的向量（克隆） */
export function getSceneTemplateVector(template: SceneTemplate, style: SceneStyleId): SceneVector {
  return [...SCENE_VECTOR_LIBRARY[template][style]]
}

/** 取出某子场景的向量（template 向量 + 子场景关键词微调） */
export function getSubSceneVector(
  template: SceneTemplate,
  style: SceneStyleId,
  subSceneName: string,
  subSceneKeywords: string[] = [],
): SceneVector {
  const base = getSceneTemplateVector(template, style)
  const tweak = buildSceneTemplateVector(template, {
    seed: hashStr(template + subSceneName),
    extraText: [subSceneName, ...subSceneKeywords].join(' '),
  })
  return blendVectors(base, tweak, 0.22)
}

/** 列出 12 template 的所有向量 */
export function listAllSceneVectors(): Array<{
  template: SceneTemplate
  style: SceneStyleId
  vector: SceneVector
}> {
  const out: Array<{ template: SceneTemplate; style: SceneStyleId; vector: SceneVector }> = []
  for (const [tpl, styleMap] of Object.entries(SCENE_VECTOR_LIBRARY) as [SceneTemplate, Record<SceneStyleId, SceneVector>][]) {
    for (const [style, vec] of Object.entries(styleMap) as [SceneStyleId, SceneVector][]) {
      out.push({ template: tpl, style, vector: vec })
    }
  }
  return out
}

/** 构造场景 v2 的完整向量 */
export function buildSceneV2Vector(scene: Pick<SceneV2, 'template' | 'styleId' | 'description' | 'tags'>): SceneVector {
  const baseVec = getSceneTemplateVector(scene.template, scene.styleId as SceneStyleId)
  const extraText = [scene.description ?? '', ...(scene.tags ?? [])].join(' ')
  if (!extraText.trim()) return baseVec
  const tweak = buildSceneTemplateVector(scene.template, {
    seed: hashStr(scene.template + scene.styleId),
    extraText,
  })
  return blendVectors(baseVec, tweak, 0.12)
}
