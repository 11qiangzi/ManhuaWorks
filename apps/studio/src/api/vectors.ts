// =============================================================================
// vectors.ts — Embedding 服务 + 一致性检查 API
// W5 任务 5：调 all-MiniLM-L6-v2 embedding 服务（默认 1024 维）
// 一致性检查：cosine 相似度 ≥ 0.85 通过，< 0.85 触发重新生成
// =============================================================================

import type { CharacterVector, CharacterArchetype } from '../types/character'
import type { SceneVector, SceneTemplate } from '../types/scene'
import { ARCHETYPE_VECTORS } from '../data/character-archetypes-v2'
import { SCENE_TEMPLATE_VECTORS } from '../data/scene-templates-v2'
import { CHARACTER_VECTOR_LIBRARY, CHARACTER_STYLE_IDS } from '../data/character-vectors'
import { SCENE_VECTOR_LIBRARY, SCENE_STYLE_IDS } from '../data/scene-vectors'

/** Embedding 服务地址（走 vite proxy /api） */
const EMBEDDING_BASE_URL: string =
  (import.meta.env?.VITE_EMBEDDING_URL as string | undefined) ??
  ''

/** 默认一致性阈值（角色） */
export const DEFAULT_CHARACTER_THRESHOLD = 0.85
/** 默认一致性阈值（场景） */
export const DEFAULT_SCENE_THRESHOLD = 0.82

/** Embedding 服务响应 */
export interface EmbeddingResponse {
  vector: number[]
  dim: number
  model: string
}

/** 调 embedding 服务（生成 1024 维向量） */
export async function embedText(text: string, signal?: AbortSignal): Promise<EmbeddingResponse> {
  const resp = await fetch(`${EMBEDDING_BASE_URL}/api/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model: 'all-MiniLM-L6-v2' }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`embedText failed: ${resp.status} ${await resp.text().catch(() => '')}`)
  }
  const data = await resp.json() as { vector: number[]; dim: number; model: string }
  if (data.dim !== 1024) {
    console.warn(`[vectors] embedding dim=${data.dim}, expected 1024`)
  }
  return data
}

/** 批量 embed（节省 RTT） */
export async function embedBatch(texts: string[], signal?: AbortSignal): Promise<EmbeddingResponse[]> {
  if (texts.length === 0) return []
  const resp = await fetch(`${EMBEDDING_BASE_URL}/api/v1/embeddings/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, model: 'all-MiniLM-L6-v2' }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`embedBatch failed: ${resp.status}`)
  }
  return await resp.json() as EmbeddingResponse[]
}

/** 计算两个向量的 cosine 相似度（[-1, 1]） */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dim mismatch (${a.length} vs ${b.length})`)
  }
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (denom === 0) return 0
  return dot / denom
}

/** 一致性检查结果 */
export interface ConsistencyCheckPayload {
  passed: boolean
  similarity: number
  threshold: number
  reason?: string
  suggestion?: string
}

/**
 * 角色一致性检查：cosine(v_gen, v_target) ≥ threshold
 * @param generated 新生成的向量
 * @param target 目标向量（archetype + style 合成）
 * @param threshold 阈值（默认 0.85）
 */
export function checkCharacterConsistency(
  generated: CharacterVector,
  target: CharacterVector,
  threshold: number = DEFAULT_CHARACTER_THRESHOLD,
): ConsistencyCheckPayload {
  const sim = cosineSimilarity(generated, target)
  if (sim >= threshold) {
    return { passed: true, similarity: sim, threshold }
  }
  const reason = `cosine ${sim.toFixed(4)} < ${threshold}`
  let suggestion: string | undefined
  if (sim < 0.5) {
    suggestion = '形象与目标 archetype 严重不符，建议重新生成'
  } else if (sim < 0.7) {
    suggestion = '形象偏离 archetype，建议微调提示词（强调标签词）'
  } else {
    suggestion = '形象接近但未达阈值，可微调 style 或 archetype 提示词'
  }
  return { passed: false, similarity: sim, threshold, reason, suggestion }
}

/** 场景一致性检查 */
export function checkSceneConsistency(
  generated: SceneVector,
  target: SceneVector,
  threshold: number = DEFAULT_SCENE_THRESHOLD,
): ConsistencyCheckPayload {
  const sim = cosineSimilarity(generated, target)
  if (sim >= threshold) {
    return { passed: true, similarity: sim, threshold }
  }
  return {
    passed: false,
    similarity: sim,
    threshold,
    reason: `cosine ${sim.toFixed(4)} < ${threshold}`,
    suggestion: '场景与目标 template 偏离，建议调整环境/光影/色温参数',
  }
}

/** 离线 mock：本地构造向量（无网络/无服务时） */
export function mockEmbed(text: string, dim: number = 1024, seed?: number): CharacterVector {
  const sBase = seed ?? hashStr(text)
  const v: number[] = new Array(dim)
  let s = sBase >>> 0
  for (let i = 0; i < dim; i++) {
    s = (s * 1103515245 + 12345 + i + text.charCodeAt(i % Math.max(1, text.length))) >>> 0
    const r = (s % 20001) / 10000 - 1
    v[i] = Math.round(r * 1e4) / 1e4
  }
  // 归一化
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum) || 1
  return v.map(x => Math.round((x / norm) * 1e4) / 1e4)
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** 列出所有角色 archetype 的本地向量（无网络） */
export function listLocalArchetypeVectors(): Record<CharacterArchetype, CharacterVector> {
  return { ...ARCHETYPE_VECTORS }
}

/** 列出所有场景 template 的本地向量（无网络） */
export function listLocalTemplateVectors(): Record<SceneTemplate, SceneVector> {
  return { ...SCENE_TEMPLATE_VECTORS }
}

/** 列出 5 主题下的所有角色向量（调试用） */
export function listLocalCharacterLibrary() {
  return { library: CHARACTER_VECTOR_LIBRARY, styles: [...CHARACTER_STYLE_IDS] }
}

/** 列出 5 主题下的所有场景向量（调试用） */
export function listLocalSceneLibrary() {
  return { library: SCENE_VECTOR_LIBRARY, styles: [...SCENE_STYLE_IDS] }
}

/** 服务可达性检查 */
export async function pingEmbeddingService(timeoutMs: number = 3000): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${EMBEDDING_BASE_URL}/healthz`, { signal: ctrl.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}
