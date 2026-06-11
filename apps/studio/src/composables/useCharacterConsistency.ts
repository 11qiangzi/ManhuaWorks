// =============================================================================
// useCharacterConsistency.ts — 角色一致性 composable
// W5 任务 5：cosine 相似度 ≥0.85 自动通过，<0.85 触发重新生成
// =============================================================================

import { ref, computed, type Ref } from 'vue'
import type {
  CharacterV2,
  CharacterVector,
  CharacterArchetype,
  ConsistencyCheckResult,
} from '../types/character'
import { DEFAULT_CONSISTENCY_THRESHOLD } from '../types/character'
import {
  cosineSimilarity,
  embedText,
  checkCharacterConsistency,
  mockEmbed,
  pingEmbeddingService,
} from '../api/vectors'
import { getCharacterVector } from '../data/character-vectors'

export interface UseCharacterConsistencyOptions {
  /** 阈值（默认 0.85） */
  threshold?: number
  /** 自动 ping 服务（决定走 embed 还是 mock） */
  autoPing?: boolean
}

export interface UseCharacterConsistencyReturn {
  /** 当前阈值 */
  threshold: Ref<number>
  /** 服务是否可用（决定用真 embed 还是 mock） */
  serviceAvailable: Ref<boolean>
  /** 最近的检查结果 */
  lastResult: Ref<ConsistencyCheckResult | null>
  /** 是否正在检查 */
  checking: Ref<boolean>
  /** 历史记录 */
  history: Ref<ConsistencyCheckResult[]>
  /** 通过率 */
  passRate: Ref<number>
  /** 检查角色向量 vs archetype+style 目标 */
  check: (
    character: Pick<CharacterV2, 'archetype' | 'styleId' | 'vector'>,
    generatedVector?: CharacterVector,
  ) => Promise<ConsistencyCheckResult>
  /** 检查两个角色之间的相似度（关系网） */
  checkSimilarity: (a: CharacterV2, b: CharacterV2) => ConsistencyCheckResult
  /** 批量检查 */
  batchCheck: (
    items: Array<Pick<CharacterV2, 'archetype' | 'styleId' | 'vector'>>,
  ) => Promise<ConsistencyCheckResult[]>
  /** 设置阈值 */
  setThreshold: (v: number) => void
  /** 重新生成（返回 prompt hint） */
  regenerateHint: (failed: ConsistencyCheckResult) => string
  /** 清空历史 */
  clear: () => void
}

/**
 * 角色一致性 composable。
 * 用法：
 * ```ts
 * const consistency = useCharacterConsistency({ threshold: 0.85 })
 * const result = await consistency.check(character, newVector)
 * if (!result.passed) {
 *   const hint = consistency.regenerateHint(result)
 *   // 调 AI 服务 + 新提示词
 * }
 * ```
 */
export function useCharacterConsistency(
  options: UseCharacterConsistencyOptions = {},
): UseCharacterConsistencyReturn {
  const threshold = ref<number>(options.threshold ?? DEFAULT_CONSISTENCY_THRESHOLD)
  const serviceAvailable = ref<boolean>(false)
  const lastResult = ref<ConsistencyCheckResult | null>(null)
  const checking = ref<boolean>(false)
  const history = ref<ConsistencyCheckResult[]>([])

  const passRate = computed(() => {
    if (history.value.length === 0) return 0
    const passed = history.value.filter(r => r.passed).length
    return Math.round((passed / history.value.length) * 1e4) / 1e4
  })

  if (options.autoPing !== false) {
    // 异步检查服务可用性，不阻塞初始化
    pingEmbeddingService().then(ok => {
      serviceAvailable.value = ok
    }).catch(() => {
      serviceAvailable.value = false
    })
  }

  /**
   * 核心检查函数：给定角色 + 新生成向量，与 archetype+style 目标比对。
   * 如果 generatedVector 未传，则用 character.vector 自身作为 generated。
   */
  async function check(
    character: Pick<CharacterV2, 'archetype' | 'styleId' | 'vector'>,
    generatedVector?: CharacterVector,
  ): Promise<ConsistencyCheckResult> {
    checking.value = true
    try {
      const target = getCharacterVector(character.archetype, character.styleId as any)
      const generated = generatedVector ?? character.vector
      const result = checkCharacterConsistency(generated, target, threshold.value)
      lastResult.value = result
      history.value.unshift(result)
      if (history.value.length > 50) history.value.length = 50
      return result
    } finally {
      checking.value = false
    }
  }

  /** 角色之间相似度（用于关系网：朋友/敌人） */
  function checkSimilarity(a: CharacterV2, b: CharacterV2): ConsistencyCheckResult {
    const sim = cosineSimilarity(a.vector, b.vector)
    const passed = sim >= threshold.value
    return {
      passed,
      similarity: sim,
      threshold: threshold.value,
      reason: passed ? undefined : `角色相似度 ${sim.toFixed(4)} 低于 ${threshold.value}`,
    }
  }

  /** 批量检查（同一 archetype/style 下的多个角色） */
  async function batchCheck(
    items: Array<Pick<CharacterV2, 'archetype' | 'styleId' | 'vector'>>,
  ): Promise<ConsistencyCheckResult[]> {
    checking.value = true
    try {
      const out: ConsistencyCheckResult[] = []
      for (const item of items) {
        const r = await check(item)
        out.push(r)
      }
      return out
    } finally {
      checking.value = false
    }
  }

  function setThreshold(v: number) {
    if (v < 0 || v > 1) {
      throw new Error(`[useCharacterConsistency] threshold must be in [0, 1], got ${v}`)
    }
    threshold.value = Math.round(v * 1e4) / 1e4
  }

  /**
   * 重新生成提示词 hint。
   * 把失败结果转化为 prompt 注入。
   */
  function regenerateHint(failed: ConsistencyCheckResult): string {
    if (failed.similarity >= 0.7) {
      return `微调 archetype 风格：当前相似度 ${failed.similarity.toFixed(3)}，加强 archetype 标签词`
    }
    if (failed.similarity >= 0.5) {
      return `重新生成：当前相似度 ${failed.similarity.toFixed(3)}，需要更贴合 archetype 主体特征（年龄/体型/服装）`
    }
    return `大幅重做：当前相似度 ${failed.similarity.toFixed(3)}，完全偏离 archetype，请使用 archetype 标准描述重新生成`
  }

  function clear() {
    history.value = []
    lastResult.value = null
  }

  return {
    threshold,
    serviceAvailable,
    lastResult,
    checking,
    history,
    passRate,
    check,
    checkSimilarity,
    batchCheck,
    setThreshold,
    regenerateHint,
    clear,
  }
}

/**
 * 便捷工具：本地 mock 角色向量（无需 embedding 服务）
 */
export function mockCharacterVector(
  archetype: CharacterArchetype,
  styleId: string,
  description: string = '',
): CharacterVector {
  return mockEmbed(`${archetype} ${styleId} ${description}`, 1024, hashStr(archetype + styleId))
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
