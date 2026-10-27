/**
 * ai-helper — AI 辅助 API 客户端
 * 千机工坊 · W3 工坊流程精修
 *
 * 6 大功能：
 * 1. auto_storyboard   — 自动镜头
 * 2. suggest_shot      — 推荐镜头
 * 3. dialogue_polish   — 对白润色
 * 4. expression_gen    — 表情生成
 * 5. scene_lighting    — 光影建议
 * 6. consistency_check — 一致性检查
 *
 * 后端：/v1/ai-helper/*
 * 鉴权：Bearer JWT
 */

import axios, { type AxiosInstance } from 'axios'

/* ------------------------------------------------------------------ */
/*                            类型定义                                 */
/* ------------------------------------------------------------------ */

export type AIHelperType =
  | 'auto_storyboard'
  | 'suggest_shot'
  | 'dialogue_polish'
  | 'expression_gen'
  | 'scene_lighting'
  | 'consistency_check'

/** 自动镜头结果 */
export interface AutoStoryboardResult {
  shots: Array<{
    id: string
    order: number
    description: string
    duration: number
    camera: 'close_up' | 'medium' | 'wide' | 'pan' | 'tilt' | 'dolly' | 'tracking'
    characters: string[]
    scene: string
    dialogue?: string
  }>
  totalDuration: number
}

/** 推荐镜头结果 */
export interface SuggestShotResult {
  suggestions: Array<{
    camera: string
    description: string
    reason: string
    confidence: number
  }>
}

/** 对白润色结果 */
export interface DialoguePolishResult {
  original: string
  polished: string
  suggestions: string[]
  tone: string
}

/** 表情生成结果 */
export interface ExpressionGenResult {
  expressions: Array<{
    name: string
    description: string
    intensity: number
    imageUrl?: string
  }>
}

/** 光影建议结果 */
export interface SceneLightingResult {
  recommendations: Array<{
    name: string
    timeOfDay: string
    lightDir: string
    colorTemp: number
    intensity: number
    description: string
  }>
}

/** 一致性检查结果 */
export interface ConsistencyCheckResult {
  issues: Array<{
    type: 'character' | 'scene' | 'costume' | 'prop'
    severity: 'low' | 'medium' | 'high'
    description: string
    suggestion: string
  }>
  score: number
}

/** 通用响应 data */
export type AIHelperData =
  | AutoStoryboardResult
  | SuggestShotResult
  | DialoguePolishResult
  | ExpressionGenResult
  | SceneLightingResult
  | ConsistencyCheckResult
  | { suggestions: string[]; text?: string }
  | Record<string, unknown>

/** 请求 */
export interface AIHelperRequest {
  type: AIHelperType
  payload: Record<string, unknown>
}

/** 响应 */
export interface AIHelperResult {
  type: AIHelperType
  data: AIHelperData
  /** 推理耗时 (ms) */
  durationMs: number
  /** 成本 (USD) */
  costUsd: number
  /** 来源模型 */
  model?: string
  /** 备注 */
  notes?: string
}

/* ------------------------------------------------------------------ */
/*                            客户端                                   */
/* ------------------------------------------------------------------ */

const BASE = '/v1/ai-helper'

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

class AIHelperClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: BASE,
      timeout: 90000
    })
  }

  /** 通用调用入口 */
  async run(req: AIHelperRequest): Promise<AIHelperResult> {
    try {
      const res = await this.client.post<{ data: AIHelperResult }>('/run', req, {
        headers: authHeaders()
      })
      return res.data.data
    } catch (err) {
      // 离线或后端不可达 → 走本地模拟
      if (!navigator.onLine) {
        return this.localMock(req)
      }
      throw err
    }
  }

  /* 便利方法（语义化） */
  autoStoryboard(payload: { text: string; projectId?: string; shotCount?: number }) {
    return this.run({ type: 'auto_storyboard', payload })
  }
  suggestShot(payload: { currentShot: string; context: string }) {
    return this.run({ type: 'suggest_shot', payload })
  }
  polishDialogue(payload: { text: string; tone?: string }) {
    return this.run({ type: 'dialogue_polish', payload })
  }
  generateExpressions(payload: { characterId: string; style: string; count?: number }) {
    return this.run({ type: 'expression_gen', payload })
  }
  suggestLighting(payload: { sceneId: string; mood: string }) {
    return this.run({ type: 'scene_lighting', payload })
  }
  checkConsistency(payload: { projectId: string; sceneId?: string; characterIds?: string[] }) {
    return this.run({ type: 'consistency_check', payload })
  }

  /* ==================================================================
   * 本地模拟（用于离线 / 后端不可用时演示）
   * ================================================================== */
  private localMock(req: AIHelperRequest): AIHelperResult {
    const start = Date.now()
    let data: AIHelperData = {}
    const notes = '本地模拟（后端不可达）'

    switch (req.type) {
      case 'auto_storyboard': {
        const text = (req.payload.text as string) || ''
        // 简单按段落切分
        const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0).slice(0, 12)
        const cameras: Array<AutoStoryboardResult['shots'][number]['camera']> = [
          'wide', 'medium', 'close_up', 'pan', 'tilt', 'dolly', 'tracking', 'close_up'
        ]
        const shots = paragraphs.map((p, i) => ({
          id: `shot-${i + 1}`,
          order: i + 1,
          description: p.trim().slice(0, 80) + (p.length > 80 ? '...' : ''),
          duration: 3 + (i % 4),
          camera: cameras[i % cameras.length]!,
          characters: i % 2 === 0 ? ['林启'] : [],
          scene: '废墟深处',
          dialogue: i % 3 === 0 ? '...' : undefined
        }))
        const total = shots.reduce((s, x) => s + x.duration, 0)
        data = { shots, totalDuration: total } as AutoStoryboardResult
        break
      }
      case 'suggest_shot': {
        data = {
          suggestions: [
            { camera: 'close_up', description: '特写林启表情', reason: '强调情绪转折', confidence: 0.92 },
            { camera: 'pan', description: '摇镜展示废墟全貌', reason: '交代环境', confidence: 0.85 },
            { camera: 'over_shoulder', description: '过肩镜头', reason: '对话场景常用', confidence: 0.78 }
          ]
        } as SuggestShotResult
        break
      }
      case 'dialogue_polish': {
        const text = (req.payload.text as string) || ''
        data = {
          original: text,
          polished: text.replace(/。/g, '。').replace(/，/g, '，') + '\n（已润色）',
          suggestions: [
            '把"他笑了"改为"他嘴角微微一扬"',
            '把"很生气"改为"眼中闪过一丝冷意"',
            '加入一句潜台词'
          ],
          tone: '克制 · 文学'
        } as DialoguePolishResult
        break
      }
      case 'expression_gen': {
        const count = (req.payload.count as number) || 8
        const names = ['平静', '微笑', '惊讶', '愤怒', '悲伤', '惊恐', '沉思', '坚定']
        data = {
          expressions: Array.from({ length: count }, (_, i) => ({
            name: names[i % names.length]!,
            description: `基础表情 · ${names[i % names.length]}`,
            intensity: 0.4 + (i % 4) * 0.15
          }))
        } as ExpressionGenResult
        break
      }
      case 'scene_lighting': {
        data = {
          recommendations: [
            { name: '黎明', timeOfDay: '06:00', lightDir: '侧光', colorTemp: 4500, intensity: 0.4, description: '冷暖交界 · 适合开场' },
            { name: '正午', timeOfDay: '12:00', lightDir: '顶光', colorTemp: 5500, intensity: 0.9, description: '高对比 · 适合冲突' },
            { name: '黄昏', timeOfDay: '18:00', lightDir: '侧逆光', colorTemp: 3200, intensity: 0.7, description: '暖调 · 适合回忆' },
            { name: '夜', timeOfDay: '22:00', lightDir: '底光', colorTemp: 2800, intensity: 0.3, description: '神秘 · 适合悬念' }
          ]
        } as SceneLightingResult
        break
      }
      case 'consistency_check': {
        data = {
          issues: [
            { type: 'character', severity: 'low', description: '林启衣服颜色略有偏差', suggestion: '统一为深灰夹克' },
            { type: 'scene', severity: 'medium', description: '废墟植被从夏绿变成了秋黄', suggestion: '锁定单一季节' }
          ],
          score: 88
        } as ConsistencyCheckResult
        break
      }
    }

    return {
      type: req.type,
      data,
      durationMs: Date.now() - start,
      costUsd: 0.001,
      model: 'local-mock',
      notes
    }
  }
}

export const aiHelper = new AIHelperClient()
