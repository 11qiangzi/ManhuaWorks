// =============================================================================
// character-consistency.test.ts — 角色一致性测试
// W5 任务 5：6 类 archetype 各 5 个 case（共 30 case）
// =============================================================================

import { describe, it, expect } from 'vitest'
import type { CharacterArchetype, CharacterVector, CharacterV2 } from '../src/types/character'
import { CHARACTER_ARCHETYPES, DEFAULT_CONSISTENCY_THRESHOLD } from '../src/types/character'
import { CHARACTER_ARCHETYPES_V2, ARCHETYPE_VECTORS, getArchetypeMeta } from '../src/data/character-archetypes-v2'
import { CHARACTER_VECTOR_LIBRARY, getCharacterVector } from '../src/data/character-vectors'
import { cosineSimilarity, checkCharacterConsistency } from '../src/api/vectors'
import { useCharacterConsistency, mockCharacterVector } from '../src/composables/useCharacterConsistency'

const ARCH_LIST: CharacterArchetype[] = [...CHARACTER_ARCHETYPES]

describe('character consistency', () => {
  // -------- 元数据完整性（5 case） --------
  describe('archetype data integrity (5 cases)', () => {
    it('case 1: exports exactly 6 archetypes', () => {
      expect(CHARACTER_ARCHETYPES_V2).toHaveLength(6)
    })

    it('case 2: all 6 archetype IDs are unique', () => {
      const ids = CHARACTER_ARCHETYPES_V2.map(a => a.id)
      expect(new Set(ids).size).toBe(6)
    })

    it('case 3: all archetypes have valid metadata (label/ageRange/styleId/traits/relationships)', () => {
      for (const a of CHARACTER_ARCHETYPES_V2) {
        expect(a.label).toBeTruthy()
        expect(a.ageRange.min).toBeGreaterThanOrEqual(0)
        expect(a.ageRange.max).toBeGreaterThan(a.ageRange.min)
        expect(a.styleId).toBeTruthy()
        expect(a.traits.length).toBeGreaterThan(0)
        expect(a.relationships.length).toBeGreaterThan(0)
      }
    })

    it('case 4: all archetypes have theme adapters for 5 themes', () => {
      for (const a of CHARACTER_ARCHETYPES_V2) {
        const themeIds = Object.keys(a.themeAdapters)
        expect(themeIds.length).toBe(5)
        for (const t of themeIds) {
          expect(a.themeAdapters[t]).toBeDefined()
        }
      }
    })

    it('case 5: 5 themes include minimal-light/dark-workshop/creator-orange/neon-cyber/national-ink', () => {
      const expected = ['minimal-light', 'dark-workshop', 'creator-orange', 'neon-cyber', 'national-ink']
      const meta = getArchetypeMeta('youth')
      for (const e of expected) {
        expect(meta.themeAdapters[e]).toBeDefined()
      }
    })
  })

  // -------- 6 archetype × 5 case = 30 case --------
  describe('archetype vectors — 6 archetypes × 5 cases = 30 cases', () => {
    for (const arch of ARCH_LIST) {
      describe(`archetype: ${arch}`, () => {
        it('case 1: archetype vector is 1024-dim', () => {
          const v = ARCHETYPE_VECTORS[arch]
          expect(v).toHaveLength(1024)
        })

        it('case 2: archetype vector is L2-normalized', () => {
          const v = ARCHETYPE_VECTORS[arch]
          let s = 0
          for (const x of v) s += x * x
          expect(Math.abs(Math.sqrt(s) - 1)).toBeLessThan(1e-3)
        })

        it('case 3: archetype self-similarity = 1.0', () => {
          const v = ARCHETYPE_VECTORS[arch]
          const sim = cosineSimilarity(v, v)
          expect(sim).toBeCloseTo(1.0, 5)
        })

        it('case 4: library has 5 style variants', () => {
          const lib = CHARACTER_VECTOR_LIBRARY[arch]
          expect(Object.keys(lib)).toHaveLength(5)
        })

        it('case 5: different style vectors differ but correlate', () => {
          const v1 = getCharacterVector(arch, 'minimal-light')
          const v2 = getCharacterVector(arch, 'national-ink')
          const sim = cosineSimilarity(v1, v2)
          expect(sim).toBeGreaterThan(0.5)
          expect(sim).toBeLessThan(0.999)
        })
      })
    }
  })

  // -------- 一致性 API（5 case） --------
  describe('consistency check API (5 cases)', () => {
    it('case 1: passes when similarity >= threshold (self)', () => {
      const v = ARCHETYPE_VECTORS.youth
      const r = checkCharacterConsistency(v, v, 0.85)
      expect(r.passed).toBe(true)
      expect(r.similarity).toBeCloseTo(1.0, 5)
    })

    it('case 2: fails when similarity < threshold (cross-archetype)', () => {
      const v1 = ARCHETYPE_VECTORS.youth
      const v2 = ARCHETYPE_VECTORS.elder
      const r = checkCharacterConsistency(v1, v2, 0.99)
      expect(r.passed).toBe(false)
      expect(r.reason).toBeDefined()
      expect(r.suggestion).toBeDefined()
    })

    it('case 3: default threshold is 0.85', () => {
      expect(DEFAULT_CONSISTENCY_THRESHOLD).toBe(0.85)
    })

    it('case 4: mocked character vector can be generated for any archetype', () => {
      for (const arch of ARCH_LIST) {
        const v = mockCharacterVector(arch, 'minimal-light')
        expect(v).toHaveLength(1024)
      }
    })

    it('case 5: cosine similarity range [-1, 1]', () => {
      for (let i = 0; i < ARCH_LIST.length - 1; i++) {
        for (let j = i + 1; j < ARCH_LIST.length; j++) {
          const a = ARCHETYPE_VECTORS[ARCH_LIST[i]!]
          const b = ARCHETYPE_VECTORS[ARCH_LIST[j]!]
          const sim = cosineSimilarity(a, b)
          expect(sim).toBeGreaterThanOrEqual(-1)
          expect(sim).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  // -------- composable 行为（5 case） --------
  describe('useCharacterConsistency composable (5 cases)', () => {
    it('case 1: initializes with default threshold 0.85', () => {
      const c = useCharacterConsistency()
      expect(c.threshold.value).toBe(0.85)
    })

    it('case 2: setThreshold validates range [0, 1]', () => {
      const c = useCharacterConsistency()
      expect(() => c.setThreshold(1.5)).toThrow()
      expect(() => c.setThreshold(-0.1)).toThrow()
      c.setThreshold(0.9)
      expect(c.threshold.value).toBe(0.9)
    })

    it('case 3: check() returns pass for same vector', async () => {
      const c = useCharacterConsistency()
      const v = ARCHETYPE_VECTORS.youth
      const r = await c.check({ archetype: 'youth', styleId: 'minimal-light', vector: v })
      expect(r.passed).toBe(true)
    })

    it('case 4: checkSimilarity returns similarity in [-1, 1]', () => {
      const c = useCharacterConsistency()
      const a: CharacterV2 = makeV2('a', 'youth', ARCHETYPE_VECTORS.youth)
      const b: CharacterV2 = makeV2('b', 'maiden', ARCHETYPE_VECTORS.maiden)
      const r = c.checkSimilarity(a, b)
      expect(typeof r.similarity).toBe('number')
      expect(r.similarity).toBeGreaterThanOrEqual(-1)
      expect(r.similarity).toBeLessThanOrEqual(1)
    })

    it('case 5: regenerateHint returns meaningful text', () => {
      const c = useCharacterConsistency()
      const low = c.regenerateHint({
        passed: false, similarity: 0.3, threshold: 0.85, reason: 'low', suggestion: '',
      })
      expect(low).toContain('0.300')
      const mid = c.regenerateHint({
        passed: false, similarity: 0.6, threshold: 0.85, reason: 'mid', suggestion: '',
      })
      expect(mid.length).toBeGreaterThan(0)
    })
  })

  // -------- 向量库规模（5 case） --------
  describe('vector library scale (5 cases)', () => {
    it('case 1: 6 archetypes × 5 styles = 30 vectors', () => {
      let count = 0
      for (const arch of ARCH_LIST) {
        for (const style of Object.keys(CHARACTER_VECTOR_LIBRARY[arch])) {
          const v = CHARACTER_VECTOR_LIBRARY[arch][style as CharacterStyleIdSafe]
          expect(v).toHaveLength(1024)
          count++
        }
      }
      expect(count).toBe(30)
    })

    it('case 2: getCharacterVector returns a clone (not reference)', () => {
      const v1 = getCharacterVector('youth', 'minimal-light')
      v1[0] = 999
      const v2 = getCharacterVector('youth', 'minimal-light')
      expect(v2[0]).not.toBe(999)
    })

    it('case 3: library vectors are all 1024-dim', () => {
      for (const arch of ARCH_LIST) {
        for (const style of Object.keys(CHARACTER_VECTOR_LIBRARY[arch])) {
          const v = CHARACTER_VECTOR_LIBRARY[arch][style as CharacterStyleIdSafe]
          expect(v).toHaveLength(1024)
        }
      }
    })

    it('case 4: cross-archetype similarities < 1.0 (except self)', () => {
      for (let i = 0; i < ARCH_LIST.length; i++) {
        for (let j = 0; j < ARCH_LIST.length; j++) {
          if (i === j) continue
          const a = ARCHETYPE_VECTORS[ARCH_LIST[i]!]
          const b = ARCHETYPE_VECTORS[ARCH_LIST[j]!]
          const sim = cosineSimilarity(a, b)
          expect(sim).toBeLessThan(1.0)
        }
      }
    })

    it('case 5: passRate is 0 when history is empty', () => {
      const c = useCharacterConsistency()
      expect(c.passRate.value).toBe(0)
    })
  })
})

// 工具：构造一个最小可用的 CharacterV2
function makeV2(id: string, archetype: CharacterArchetype, vector: CharacterVector): CharacterV2 {
  return {
    id,
    name: id,
    archetype,
    description: '',
    views: { front: null, side: null, back: null, threeQ: null },
    expressions: [],
    tags: [],
    vector,
    styleId: 'minimal-light',
    themeId: 'minimal-light',
    locked: false,
    consistencyScore: 100,
    relatedIds: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

type CharacterStyleIdSafe = keyof typeof CHARACTER_VECTOR_LIBRARY[CharacterArchetype]

// 隐式引用避免 lint 警告（保留 ARCHETYPE_VECTORS 等用于潜在扩展）
void ARCHETYPE_VECTORS
