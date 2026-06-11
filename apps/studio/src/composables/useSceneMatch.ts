// =============================================================================
// useSceneMatch.ts — 场景匹配 composable
// W5 任务 5：输入关键词 → 12 类场景 + 子场景 4-6 个
// =============================================================================

import { ref, computed, type Ref } from 'vue'
import type {
  SceneTemplate,
  SceneTemplateMeta,
  SceneSubScene,
  SceneVector,
  SceneMatchResult,
} from '../types/scene'
import { SCENE_TEMPLATES_V2, getSceneTemplateMeta, listSubScenes } from '../data/scene-templates-v2'
import { cosineSimilarity, embedText, mockEmbed } from '../api/vectors'
import { getSceneTemplateVector, getSubSceneVector } from '../data/scene-vectors'

export interface UseSceneMatchOptions {
  /** 5 主题/风格 ID */
  styleId?: string
  /** 期望返回子场景数（默认 4-6） */
  subSceneCount?: number
  /** 子场景数 min */
  subSceneMin?: number
  /** 子场景数 max */
  subSceneMax?: number
}

export interface UseSceneMatchReturn {
  /** 当前查询关键词 */
  query: Ref<string>
  /** 风格 ID */
  styleId: Ref<string>
  /** 匹配结果（已排序） */
  results: Ref<SceneMatchResult[]>
  /** 正在匹配 */
  matching: Ref<boolean>
  /** 最近一次错误 */
  error: Ref<string | null>
  /** 触发匹配 */
  match: (query?: string) => Promise<SceneMatchResult[]>
  /** 关键词推荐（12 类模板 top N） */
  recommend: (topN?: number) => SceneMatchResult[]
  /** 取子场景（按子场景级向量） */
  matchSubScenes: (queryVector: SceneVector, template: SceneTemplate) => Array<SceneSubScene & { score: number }>
  /** 重置 */
  reset: () => void
}

const DEFAULT_STYLE_ID = 'minimal-light'

/**
 * 场景匹配 composable。
 * 用法：
 * ```ts
 * const matcher = useSceneMatch({ styleId: 'neon-cyber' })
 * await matcher.match('雨夜霓虹 改造人 黑市')
 * console.log(matcher.results.value) // SceneMatchResult[]
 * ```
 */
export function useSceneMatch(options: UseSceneMatchOptions = {}): UseSceneMatchReturn {
  const query = ref<string>('')
  const styleId = ref<string>(options.styleId ?? DEFAULT_STYLE_ID)
  const results = ref<SceneMatchResult[]>([])
  const matching = ref<boolean>(false)
  const error = ref<string | null>(null)

  const subSceneMin = options.subSceneMin ?? 4
  const subSceneMax = options.subSceneMax ?? 6
  const subSceneCount = options.subSceneCount ?? 5

  /**
   * 文本匹配算法：
   * 1. 关键词分桶（中文 2-gram + 整词 + 标签命中）
   * 2. 调 embedding（无服务时本地 mock）
   * 3. cosine 相似度排序
   */
  async function match(q?: string): Promise<SceneMatchResult[]> {
    if (q !== undefined) query.value = q
    const text = query.value.trim()
    if (!text) {
      results.value = []
      return []
    }
    matching.value = true
    error.value = null
    try {
      // 1) embedding（优先远端，失败用 mock）
      let queryVector: SceneVector
      try {
        const r = await embedText(text)
        queryVector = r.vector
      } catch (e) {
        // mock fallback
        queryVector = mockEmbed(text, 1024, hashStr(text))
      }

      // 2) 关键词加权
      const tokens = tokenize(text)
      const templateScores = computeTemplateScores(tokens)

      // 3) 12 模板 × cosine + 关键词加权
      const tplResults: SceneMatchResult[] = SCENE_TEMPLATES_V2.map(meta => {
        const tplVec = getSceneTemplateVector(meta.id, styleId.value as any)
        const cos = cosineSimilarity(queryVector, tplVec)
        const kwScore = templateScores[meta.id] ?? 0
        const templateScore = cos * 0.7 + kwScore * 0.3
        return {
          template: meta.id,
          templateScore,
          subScenes: matchSubScenes(queryVector, meta.id),
          totalScore: templateScore,
        }
      })

      // 4) 排序 + 取全部 12
      tplResults.sort((a, b) => b.totalScore - a.totalScore)
      results.value = tplResults
      return tplResults
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      results.value = []
      return []
    } finally {
      matching.value = false
    }
  }

  /**
   * 子场景匹配：取该 template 的所有子场景，按子场景级向量与 query 算 cosine
   * 排序后取 subSceneMin..subSceneMax 区间。
   */
  function matchSubScenes(queryVector: SceneVector, template: SceneTemplate): Array<SceneSubScene & { score: number }> {
    const subs = listSubScenes(template)
    const scored = subs.map(s => {
      const v = getSubSceneVector(template, styleId.value as any, s.name, s.keywords)
      const cos = cosineSimilarity(queryVector, v)
      // 子场景名/关键词命中加权
      const tokens = tokenize(query.value)
      const hit = tokens.filter(t => s.name.includes(t) || s.keywords.some(k => k.includes(t))).length
      const kwBonus = Math.min(0.3, hit * 0.1)
      return { ...s, score: cos * 0.75 + kwBonus }
    })
    scored.sort((a, b) => b.score - a.score)
    // 取 [subSceneMin, subSceneMax]，默认 4-6
    const lo = Math.max(1, subSceneMin)
    const hi = Math.max(lo, subSceneMax)
    const n = Math.max(lo, Math.min(hi, subSceneCount))
    return scored.slice(0, n)
  }

  /** 关键词推荐（无 query 时返回全部 12，按 template score 默认值） */
  function recommend(topN: number = 12): SceneMatchResult[] {
    return SCENE_TEMPLATES_V2.map(meta => ({
      template: meta.id,
      templateScore: 0.5,
      subScenes: listSubScenes(meta.id).slice(0, subSceneCount).map(s => ({ ...s, score: 0.5 })),
      totalScore: 0.5,
    })).slice(0, topN)
  }

  function reset() {
    query.value = ''
    results.value = []
    error.value = null
  }

  return {
    query,
    styleId,
    results,
    matching,
    error,
    match,
    recommend,
    matchSubScenes,
    reset,
  }
}

/**
 * 简易中文分词（2-gram + 标点切分）。
 * 不依赖第三方，足够关键词命中。
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  const cleaned = text.toLowerCase().replace(/[\s,，。！？!?、；;:'"“”‘’(){}\[\]【】《》<>·…\-]+/g, ' ').trim()
  if (!cleaned) return []
  const tokens: string[] = []
  // 整词（空格切）
  for (const w of cleaned.split(/\s+/)) {
    if (w.length >= 1) tokens.push(w)
  }
  // 中文 2-gram
  for (let i = 0; i < cleaned.length - 1; i++) {
    const c1 = cleaned.charAt(i)
    const c2 = cleaned.charAt(i + 1)
    if (/[\u4e00-\u9fa5]/.test(c1) && /[\u4e00-\u9fa5]/.test(c2)) {
      tokens.push(c1 + c2)
    }
  }
  return Array.from(new Set(tokens))
}

/**
 * 计算每个 template 的关键词命中分（0-1）。
 */
export function computeTemplateScores(tokens: string[]): Record<SceneTemplate, number> {
  const out: Record<string, number> = {}
  if (tokens.length === 0) return out as Record<SceneTemplate, number>
  for (const meta of SCENE_TEMPLATES_V2) {
    const allKws = [...meta.keywords, ...meta.subScenes.flatMap(s => s.keywords)]
    let hit = 0
    for (const t of tokens) {
      if (t.length < 1) continue
      for (const kw of allKws) {
        if (kw.includes(t) || t.includes(kw)) {
          hit++
          break
        }
      }
    }
    const score = Math.min(1, hit / 3) // 3 个关键词命中即满分
    out[meta.id] = score
  }
  return out as Record<SceneTemplate, number>
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * 便捷工具：根据关键词直接拿 12 类排序结果（不依赖 reactive 状态）
 */
export async function quickMatchScenes(
  query: string,
  styleId: string = DEFAULT_STYLE_ID,
): Promise<SceneMatchResult[]> {
  const m = useSceneMatch({ styleId })
  return await m.match(query)
}

/** 列出全部 12 template 元数据 */
export function listAllSceneTemplates(): SceneTemplateMeta[] {
  return [...SCENE_TEMPLATES_V2]
}
