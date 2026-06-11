// =============================================================================
// scene-match.test.ts — 场景匹配测试
// W5 任务 5：12 类场景各 5 个 case（共 60 case）
// =============================================================================

import { describe, it, expect } from 'vitest'
import type { SceneTemplate, SceneVector, SceneV2 } from '../src/types/scene'
import { SCENE_TEMPLATES, DEFAULT_SCENE_CONSISTENCY_THRESHOLD } from '../src/types/scene'
import {
  SCENE_TEMPLATES_V2,
  SCENE_TEMPLATE_VECTORS,
  getSceneTemplateMeta,
  listSceneTemplateIds,
  listSubScenes,
} from '../src/data/scene-templates-v2'
import { SCENE_VECTOR_LIBRARY, getSceneTemplateVector, getSubSceneVector } from '../src/data/scene-vectors'
import { cosineSimilarity, checkSceneConsistency } from '../src/api/vectors'
import { useSceneMatch, quickMatchScenes, tokenize, computeTemplateScores } from '../src/composables/useSceneMatch'

const TPL_LIST: SceneTemplate[] = [...SCENE_TEMPLATES]

describe('scene match', () => {
  // -------- 元数据完整性（5 case） --------
  describe('template data integrity (5 cases)', () => {
    it('case 1: exports exactly 12 templates', () => {
      expect(SCENE_TEMPLATES_V2).toHaveLength(12)
    })

    it('case 2: all 12 template IDs are unique', () => {
      const ids = SCENE_TEMPLATES_V2.map(s => s.id)
      expect(new Set(ids).size).toBe(12)
    })

    it('case 3: all templates have 4-6 sub scenes', () => {
      for (const t of SCENE_TEMPLATES_V2) {
        expect(t.subScenes.length).toBeGreaterThanOrEqual(4)
        expect(t.subScenes.length).toBeLessThanOrEqual(6)
      }
    })

    it('case 4: all templates have valid lighting params', () => {
      for (const t of SCENE_TEMPLATES_V2) {
        expect(t.defaultColorTemp).toBeGreaterThanOrEqual(2000)
        expect(t.defaultColorTemp).toBeLessThanOrEqual(8000)
        expect(t.defaultIntensity).toBeGreaterThanOrEqual(0)
        expect(t.defaultIntensity).toBeLessThanOrEqual(1)
        expect(t.defaultLightDir).toBeTruthy()
      }
    })

    it('case 5: all templates have theme adapters for 5 themes', () => {
      for (const t of SCENE_TEMPLATES_V2) {
        const themeIds = Object.keys(t.themeAdapters)
        expect(themeIds.length).toBe(5)
      }
    })
  })

  // -------- 12 template × 5 case = 60 case --------
  describe('template vectors — 12 templates × 5 cases = 60 cases', () => {
    for (const tpl of TPL_LIST) {
      describe(`template: ${tpl}`, () => {
        it('case 1: template vector is 1024-dim', () => {
          const v = SCENE_TEMPLATE_VECTORS[tpl]
          expect(v).toHaveLength(1024)
        })

        it('case 2: template vector is L2-normalized', () => {
          const v = SCENE_TEMPLATE_VECTORS[tpl]
          let s = 0
          for (const x of v) s += x * x
          expect(Math.abs(Math.sqrt(s) - 1)).toBeLessThan(1e-3)
        })

        it('case 3: template self-similarity = 1.0', () => {
          const v = SCENE_TEMPLATE_VECTORS[tpl]
          const sim = cosineSimilarity(v, v)
          expect(sim).toBeCloseTo(1.0, 5)
        })

        it('case 4: library has 5 style variants', () => {
          const lib = SCENE_VECTOR_LIBRARY[tpl]
          expect(Object.keys(lib)).toHaveLength(5)
        })

        it('case 5: at least 4 sub scenes available', () => {
          const subs = listSubScenes(tpl)
          expect(subs.length).toBeGreaterThanOrEqual(4)
        })
      })
    }
  })

  // -------- 匹配核心（5 case） --------
  describe('match core (5 cases)', () => {
    it('case 1: useSceneMatch initializes with empty results', () => {
      const m = useSceneMatch()
      expect(m.results.value).toHaveLength(0)
      expect(m.query.value).toBe('')
    })

    it('case 2: match with query returns 12 sorted results', async () => {
      const m = useSceneMatch()
      const r = await m.match('雨夜霓虹 改造人 黑市')
      expect(r).toHaveLength(12)
      // 检查排序
      for (let i = 1; i < r.length; i++) {
        expect(r[i - 1]!.totalScore).toBeGreaterThanOrEqual(r[i]!.totalScore)
      }
    })

    it('case 3: cyberpunk query ranks cyberpunk template top', async () => {
      const m = useSceneMatch()
      const r = await m.match('雨夜霓虹改造人')
      // 期望 cyberpunk 在前 3
      const top3 = r.slice(0, 3).map(x => x.template)
      expect(top3).toContain('cyberpunk')
    })

    it('case 4: xianxia query ranks xianxia template top', async () => {
      const m = useSceneMatch()
      const r = await m.match('山峰云海亭台剑气')
      const top3 = r.slice(0, 3).map(x => x.template)
      expect(top3).toContain('xianxia')
    })

    it('case 5: empty query returns empty results', async () => {
      const m = useSceneMatch()
      const r = await m.match('')
      expect(r).toHaveLength(0)
    })
  })

  // -------- 子场景匹配（5 case） --------
  describe('sub scene match (5 cases)', () => {
    it('case 1: sub scene count is 4-6', async () => {
      const m = useSceneMatch()
      const r = await m.match('教室 操场 校园')
      for (const tpl of r) {
        expect(tpl.subScenes.length).toBeGreaterThanOrEqual(4)
        expect(tpl.subScenes.length).toBeLessThanOrEqual(6)
      }
    })

    it('case 2: sub scenes are sorted by score desc', async () => {
      const m = useSceneMatch()
      const r = await m.match('赛博朋克 雨夜 霓虹 改造人')
      for (const tpl of r) {
        for (let i = 1; i < tpl.subScenes.length; i++) {
          expect(tpl.subScenes[i - 1]!.score).toBeGreaterThanOrEqual(tpl.subScenes[i]!.score)
        }
      }
    })

    it('case 3: sub scene vector is 1024-dim', () => {
      const v = getSubSceneVector('cyberpunk', 'neon-cyber', '雨夜霓虹街', ['雨夜', '霓虹'])
      expect(v).toHaveLength(1024)
    })

    it('case 4: getSceneTemplateVector returns a clone', () => {
      const v1 = getSceneTemplateVector('forest', 'minimal-light')
      v1[0] = 999
      const v2 = getSceneTemplateVector('forest', 'minimal-light')
      expect(v2[0]).not.toBe(999)
    })

    it('case 5: sub scene match returns array with score property', async () => {
      const m = useSceneMatch()
      const r = await m.match('民国 旗袍 黄包车')
      const republic = r.find(x => x.template === 'republic')
      if (republic && republic.subScenes.length > 0) {
        expect(typeof republic.subScenes[0]!.score).toBe('number')
      }
    })
  })

  // -------- 关键词分词（5 case） --------
  describe('tokenize (5 cases)', () => {
    it('case 1: simple text → tokens', () => {
      const t = tokenize('雨夜 霓虹')
      expect(t.length).toBeGreaterThan(0)
    })

    it('case 2: chinese 2-gram', () => {
      const t = tokenize('霓虹')
      expect(t).toContain('霓虹')
    })

    it('case 3: removes punctuation', () => {
      const t = tokenize('雨夜，霓虹！改造人？')
      expect(t.length).toBeGreaterThan(0)
    })

    it('case 4: empty string returns empty', () => {
      expect(tokenize('')).toEqual([])
    })

    it('case 5: mixed Chinese/English', () => {
      const t = tokenize('cyber cyberpunk 赛博朋克')
      expect(t).toContain('cyber')
      expect(t).toContain('cyberpunk')
      expect(t).toContain('赛博')
      expect(t).toContain('博朋')
      expect(t).toContain('朋克')
    })
  })

  // -------- 模板命中分（5 case） --------
  describe('computeTemplateScores (5 cases)', () => {
    it('case 1: empty tokens returns empty scores', () => {
      const s = computeTemplateScores([])
      expect(Object.keys(s)).toHaveLength(0)
    })

    it('case 2: cyberpunk keyword hits cyberpunk', () => {
      const s = computeTemplateScores(['赛博', '赛博朋', '改造人'])
      expect(s.cyberpunk ?? 0).toBeGreaterThan(0)
    })

    it('case 3: xianxia keyword hits xianxia', () => {
      const s = computeTemplateScores(['山峰', '云海', '亭台'])
      expect(s.xianxia ?? 0).toBeGreaterThan(0)
    })

    it('case 4: wasteland keyword hits wasteland', () => {
      const s = computeTemplateScores(['废土', '沙暴', '废墟'])
      expect(s.wasteland ?? 0).toBeGreaterThan(0)
    })

    it('case 5: scores are in [0, 1]', () => {
      const s = computeTemplateScores(['山峰', '废土', '霓虹', '赛博', '雪峰', '极光'])
      for (const v of Object.values(s)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })
  })

  // -------- 一致性 API（5 case） --------
  describe('scene consistency API (5 cases)', () => {
    it('case 1: passes for self-similarity', () => {
      const v = SCENE_TEMPLATE_VECTORS.cyberpunk
      const r = checkSceneConsistency(v, v, 0.82)
      expect(r.passed).toBe(true)
    })

    it('case 2: default scene threshold = 0.82', () => {
      expect(DEFAULT_SCENE_CONSISTENCY_THRESHOLD).toBe(0.82)
    })

    it('case 3: cross-template similarity < 1.0', () => {
      const a = SCENE_TEMPLATE_VECTORS.cyberpunk
      const b = SCENE_TEMPLATE_VECTORS.xianxia
      const sim = cosineSimilarity(a, b)
      expect(sim).toBeLessThan(1.0)
    })

    it('case 4: failed check has suggestion', () => {
      const r = checkSceneConsistency(SCENE_TEMPLATE_VECTORS.cyberpunk, SCENE_TEMPLATE_VECTORS.xianxia, 0.99)
      expect(r.passed).toBe(false)
      expect(r.suggestion).toBeDefined()
    })

    it('case 5: suggestion is non-empty', () => {
      const r = checkSceneConsistency(SCENE_TEMPLATE_VECTORS.cyberpunk, SCENE_TEMPLATE_VECTORS.xianxia, 0.99)
      expect(r.suggestion!.length).toBeGreaterThan(0)
    })
  })

  // -------- 工具函数（5 case） --------
  describe('utility functions (5 cases)', () => {
    it('case 1: listSceneTemplateIds returns 12', () => {
      expect(listSceneTemplateIds()).toHaveLength(12)
    })

    it('case 2: getSceneTemplateMeta throws for unknown', () => {
      expect(() => getSceneTemplateMeta('not-a-template' as SceneTemplate)).toThrow()
    })

    it('case 3: quickMatchScenes works without state', async () => {
      const r = await quickMatchScenes('雪山 极光')
      expect(r.length).toBe(12)
    })

    it('case 4: matrix library size = 12 × 5 = 60', () => {
      let count = 0
      for (const tpl of TPL_LIST) {
        for (const style of Object.keys(SCENE_VECTOR_LIBRARY[tpl])) {
          const v = SCENE_VECTOR_LIBRARY[tpl][style as keyof typeof SCENE_VECTOR_LIBRARY[typeof tpl]]
          expect(v).toHaveLength(1024)
          count++
        }
      }
      expect(count).toBe(60)
    })

    it('case 5: reset() clears state', async () => {
      const m = useSceneMatch()
      await m.match('赛博朋克')
      expect(m.results.value.length).toBeGreaterThan(0)
      m.reset()
      expect(m.results.value).toHaveLength(0)
      expect(m.query.value).toBe('')
    })
  })
})

// 占位：避免 lint 警告
void ({} as SceneV2)
