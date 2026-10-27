// =============================================================================
// studio-mock.ts — 5 视图 mock 数据
// L2 林染：项目 / 角色 / 场景 / 工具 / 导出 全部 mock
// 后续接 api/ 时再替换
// =============================================================================

import type {
  Project,
  Shot,
  StudioTool,
  ExportTask,
  StudioThemeId,
} from '../types/studio'
import type { CharacterV2 } from '../types/character'
import type { SceneV2, SceneLighting } from '../types/scene'
import { CHARACTER_ARCHETYPES } from '../types/character'
import { SCENE_TEMPLATES } from '../types/scene'
import {
  CHARACTER_ARCHETYPES_V2,
  getArchetypeMeta,
  buildArchetypeVector,
} from './character-archetypes-v2'
import {
  SCENE_TEMPLATES_V2,
  getSceneTemplateMeta,
  buildSceneTemplateVector,
} from './scene-templates-v2'
import { hashStr, deterministicVector, normalize } from './_vector-helper'

// =============================================================================
// Project mock
// =============================================================================

/** 生成 ID */
function id(prefix: string, n: number | string): string {
  return `${prefix}_${n}_${hashStr(String(n)).toString(36).slice(0, 4)}`
}

/** 8 个镜头 mock */
function makeShots(projectSeed: number): Shot[] {
  const titles = [
    '雨夜开场 · 少年初登场',
    '霓虹招牌 · 角色剪影',
    '对峙 · 少年与反派',
    '回忆闪回 · 师父传授',
    '追逐 · 楼顶天台',
    '密室 · 线索浮现',
    '转折 · 真相揭露',
    '结尾 · 雨过天晴',
  ]
  const descriptions = [
    '雨夜，少年撑伞走在霓虹街道上，画面由模糊渐渐聚焦',
    '特写少年眼神倒映霓虹招牌，背景虚化',
    '楼顶对峙，少年的身影与反派剪影形成强烈对比',
    '回忆蒙太奇，师父在竹林中传授武艺',
    '追逐长镜头，少年在楼顶飞奔，镜头摇移',
    '室内密室场景，光从顶部洒下，线索道具特写',
    '蒙太克快切，真相揭露的高潮',
    '雨过天晴，少年回望，镜头慢慢拉远',
  ]
  const archetypes: Shot['characterArchetypes'][] = [
    ['youth'],
    ['youth'],
    ['youth', 'villain'],
    ['youth', 'mentor'],
    ['youth', 'villain'],
    ['youth', 'mentor'],
    ['youth', 'villain', 'mentor'],
    ['youth', 'maiden'],
  ]
  const sceneTemplates: Shot['sceneTemplate'][] = [
    'cyberpunk', 'cyberpunk', 'cyberpunk',
    'xianxia', 'cyberpunk', 'cyberpunk',
    'cyberpunk', 'cyberpunk',
  ]
  const subSceneIds = [
    'cyberpunk-1', 'cyberpunk-1', 'cyberpunk-5',
    'xianxia-3', 'cyberpunk-5', 'cyberpunk-2',
    'cyberpunk-3', 'cyberpunk-1',
  ]
  const shotTypes: Shot['shotType'][] = [
    'extreme-wide', 'close-up', 'medium', 'medium',
    'wide', 'medium', 'medium', 'extreme-wide',
  ]
  const angles: Shot['cameraAngle'][] = [
    'eye', 'low', 'low', 'high', 'high', 'high', 'eye', 'eye',
  ]
  const moves: Shot['cameraMove'][] = [
    'push', 'static', 'pan', 'static', 'track', 'static', 'tilt', 'pull',
  ]
  const statuses: Shot['status'][] = [
    'approved', 'approved', 'ready', 'ready',
    'generating', 'scripted', 'draft', 'draft',
  ]
  const durations = [4.0, 2.5, 5.0, 3.5, 6.0, 4.5, 3.0, 4.0]
  const dialogues = [
    '',
    '...',
    '"你不该来。"',
    '"记住，戒骄戒躁。"',
    '...',
    '"线索在这里。"',
    '"真相只有一个。"',
    '（沉默）',
  ]
  const narrations = [
    '雨夜的霓虹，是这座城市最后的温度。',
    '',
    '',
    '',
    '追逐，是为了不让自己停下来思考。',
    '',
    '有些真相，注定要被揭开。',
    '雨停了。故事，才刚开始。',
  ]

  const now = Date.now()
  return titles.map((title, i) => ({
    id: id('shot', `${projectSeed}-${i}`),
    index: i + 1,
    title,
    description: descriptions[i] ?? '',
    characterArchetypes: archetypes[i] ?? ['youth'],
    sceneTemplate: sceneTemplates[i] ?? 'cyberpunk',
    subSceneId: subSceneIds[i] ?? null,
    shotType: shotTypes[i] ?? 'medium',
    cameraAngle: angles[i] ?? 'eye',
    cameraMove: moves[i] ?? 'static',
    dialogue: dialogues[i] ?? '',
    narration: narrations[i] ?? '',
    duration: durations[i] ?? 4.0,
    status: statuses[i] ?? 'draft',
    imageUrl: i < 4 ? `https://placehold.co/320x180/0e0f12/f59e0b?text=Shot+${i + 1}` : null,
    tags: ['mock', `镜头-${i + 1}`],
    note: i === 2 ? '高潮镜头，注意光影' : '',
    weight: 1.0,
    locked: i === 0,
    createdAt: now - (8 - i) * 60000,
    updatedAt: now - (8 - i) * 30000,
  }))
}

/** 默认项目 mock */
export function makeMockProject(seed = 1): Project {
  const now = Date.now()
  return {
    id: id('proj', seed),
    name: '霓虹少年 · 序章',
    description: '近未来赛博朋克世界，少年雨夜觉醒的序章故事',
    themeId: 'dark-workshop',
    targetDuration: 60,
    shots: makeShots(seed),
    tags: ['赛博朋克', '序章', '短篇'],
    status: 'in-progress',
    createdAt: now - 3600 * 1000,
    updatedAt: now,
  }
}

// =============================================================================
// Character mock
// =============================================================================

/** 6 archetype × 1 = 6 个 mock 角色（每个 archetype 一个） */
export function makeMockCharacters(): CharacterV2[] {
  const now = Date.now()
  return CHARACTER_ARCHETYPES.map((arch, i) => {
    const meta = getArchetypeMeta(arch)
    return {
      id: id('char', `${i}-${arch}`),
      name: `${meta.label} · 角色 ${i + 1}`,
      archetype: arch,
      description: meta.description.split('。')[0] ?? meta.tagline,
      views: { front: null, side: null, back: null, threeQ: null },
      expressions: meta.defaultExpressions.slice(0, 4).map((e, k) => ({
        id: `${e}-${k}`,
        name: e,
        icon: ['😐', '😠', '😊', '😢', '😲', '😨'][k % 6] ?? '😐',
        imageUrl: null,
      })),
      tags: [meta.code, ...meta.traits.slice(0, 2)],
      vector: buildArchetypeVector(arch, { seed: hashStr(arch) + i }),
      styleId: meta.styleId,
      themeId: 'dark-workshop' as StudioThemeId,
      locked: i === 0,
      consistencyScore: 90 - i * 3,
      relatedIds: [],
      createdAt: now - (6 - i) * 60000,
      updatedAt: now - i * 10000,
    }
  })
}

export { CHARACTER_ARCHETYPES_V2 }

// =============================================================================
// Scene mock
// =============================================================================

/** 12 模板 × 1 = 12 个 mock 场景 */
export function makeMockScenes(): SceneV2[] {
  const now = Date.now()
  return SCENE_TEMPLATES.map((tpl, i) => {
    const meta = getSceneTemplateMeta(tpl)
    const sub = meta.subScenes[0]
    const lighting: SceneLighting = {
      timeOfDay: 'day',
      lightDir: meta.defaultLightDir,
      colorTemp: meta.defaultColorTemp,
      intensity: meta.defaultIntensity,
      name: sub?.name,
    }
    return {
      id: id('scene', `${i}-${tpl}`),
      name: `${meta.label} · 默认场景`,
      template: tpl,
      parentId: null,
      description: meta.description.split('。')[0] ?? meta.tagline,
      assets: { imageUrl: null, thumbnailUrl: null },
      lighting,
      tags: [meta.code, ...meta.keywords.slice(0, 2)],
      vector: buildSceneTemplateVector(tpl, { seed: hashStr(tpl) + i }),
      styleId: meta.styleId,
      themeId: 'dark-workshop' as StudioThemeId,
      reusable: i % 2 === 0,
      consistencyScore: 85 - i * 2,
      relatedArchetypes: meta.compatibleArchetypes,
      createdAt: now - (12 - i) * 60000,
      updatedAt: now - i * 10000,
    }
  })
}

export { SCENE_TEMPLATES_V2 }

// =============================================================================
// Tool mock (5 工具)
// =============================================================================

export const MOCK_TOOLS: StudioTool[] = [
  {
    id: 'tpl-script',
    name: '镜头脚本生成',
    category: 'text',
    description: '根据剧情大纲，调用 LLM 生成镜头描述、对白、旁白',
    icon: '📝',
    color: 'blue',
    promptTemplate:
      '你是一位资深动画编剧。请为以下剧情生成 {{count}} 个镜头：\n\n剧情：{{plot}}\n风格：{{style}}\n要求：{{requirements}}',
    promptVars: [
      { name: 'count', label: '镜头数', type: 'number', default: '5', required: true },
      { name: 'plot', label: '剧情描述', type: 'textarea', default: '少年在雨夜觉醒', required: true, help: '一段话描述核心剧情' },
      { name: 'style', label: '风格', type: 'select', default: '赛博朋克', options: ['赛博朋克', '古风仙侠', '现代校园', '民国', '末日', '海洋', '森林'], required: false },
      { name: 'requirements', label: '额外要求', type: 'textarea', default: '突出少年成长', required: false },
    ],
    batchable: true,
    costUsdPerCall: 0.02,
    enabled: true,
    recommended: true,
  },
  {
    id: 'tpl-character',
    name: '角色一致性生成',
    category: 'image',
    description: '基于 archetype + 4 视图参考图，生成多角度稳定角色图',
    icon: '👤',
    color: 'pink',
    promptTemplate:
      'A consistent {{archetype}} character, {{view}} view, {{style}} style, high detail, full body, clean background, anime style\n\n参考：{{reference}}',
    promptVars: [
      { name: 'archetype', label: 'Archetype', type: 'select', default: 'youth', options: ['youth', 'maiden', 'villain', 'mentor', 'child', 'elder'], required: true },
      { name: 'view', label: '视角', type: 'select', default: 'front', options: ['front', 'side', 'back', 'threeQ'], required: true },
      { name: 'style', label: '风格', type: 'select', default: 'manhua-modern', options: ['manhua-modern', 'manhua-classic', 'manhua-chibi'], required: false },
      { name: 'reference', label: '参考描述', type: 'text', default: '14-22 岁少年', required: false },
    ],
    batchable: true,
    costUsdPerCall: 0.05,
    enabled: true,
    recommended: true,
  },
  {
    id: 'tpl-scene',
    name: '场景背景生成',
    category: 'image',
    description: '基于场景模板，生成高质量背景图（含光影、氛围）',
    icon: '🎬',
    color: 'cyan',
    promptTemplate:
      'A wide shot of {{template}} scene, {{subscene}}, time {{timeOfDay}}, color temperature {{colorTemp}}K, light from {{lightDir}}, {{style}} style, cinematic composition, no people',
    promptVars: [
      { name: 'template', label: '场景模板', type: 'select', default: 'cyberpunk', options: ['scifi-city', 'wasteland', 'spaceship', 'modern-school', 'xianxia', 'republic', 'apocalypse', 'school-life', 'cyberpunk', 'ocean', 'snow-mountain', 'forest'], required: true },
      { name: 'subscene', label: '子场景', type: 'text', default: '雨夜霓虹主街', required: false },
      { name: 'timeOfDay', label: '时段', type: 'select', default: 'night', options: ['day', 'sunset', 'night', 'dawn', 'dusk'], required: true },
      { name: 'colorTemp', label: '色温(K)', type: 'number', default: '6500', required: false },
      { name: 'lightDir', label: '光向', type: 'text', default: 'side', required: false },
      { name: 'style', label: '风格', type: 'text', default: '赛博朋克', required: false },
    ],
    batchable: true,
    costUsdPerCall: 0.08,
    enabled: true,
    recommended: false,
  },
  {
    id: 'tpl-asset-upscaler',
    name: '资产超分辨率',
    category: 'utility',
    description: '对低分辨率资产做 2x/4x 超分，保持细节',
    icon: '🔍',
    color: 'amber',
    promptTemplate: 'Upscale the following asset by {{scale}}x, preserving details, no artifacts: {{assetId}}',
    promptVars: [
      { name: 'assetId', label: '资产 ID', type: 'text', default: '', required: true },
      { name: 'scale', label: '放大倍数', type: 'select', default: '2', options: ['2', '4'], required: true },
    ],
    batchable: true,
    costUsdPerCall: 0.03,
    enabled: true,
    recommended: false,
  },
  {
    id: 'tpl-tts',
    name: '对白 TTS',
    category: 'audio',
    description: '将对白文本转为语音，支持多种角色音色',
    icon: '🔊',
    color: 'green',
    promptTemplate: '{{voice}} voice, emotion {{emotion}}, speed {{speed}}: "{{text}}"',
    promptVars: [
      { name: 'text', label: '对白文本', type: 'textarea', default: '你不该来。', required: true },
      { name: 'voice', label: '音色', type: 'select', default: 'male-young', options: ['male-young', 'female-young', 'male-mature', 'female-mature', 'child', 'elder'], required: true },
      { name: 'emotion', label: '情绪', type: 'select', default: 'neutral', options: ['neutral', 'angry', 'sad', 'happy', 'tired', 'excited'], required: true },
      { name: 'speed', label: '语速', type: 'number', default: '1.0', required: false },
    ],
    batchable: true,
    costUsdPerCall: 0.01,
    enabled: true,
    recommended: false,
  },
]

/** 工具分类顺序（用于 UI 排序） */
export const TOOL_CATEGORY_ORDER: StudioTool['category'][] = ['text', 'image', 'video', 'audio', 'utility']

// =============================================================================
// Export mock
// =============================================================================

export function makeMockExportTasks(projectId: string): ExportTask[] {
  const now = Date.now()
  return [
    {
      id: id('exp', '1'),
      projectId,
      format: 'mp4',
      platforms: ['bilibili', 'youtube'],
      progress: 100,
      status: 'success',
      step: '已完成',
      outputUrl: 'https://placehold.co/640x360/0e0f12/f59e0b?text=Output+MP4',
      error: null,
      costUsd: 0.42,
      sizeBytes: 28_500_000,
      createdAt: now - 3600_000,
      finishedAt: now - 3500_000,
    },
    {
      id: id('exp', '2'),
      projectId,
      format: 'srt',
      platforms: ['bilibili', 'douyin', 'youtube'],
      progress: 100,
      status: 'success',
      step: '已完成',
      outputUrl: 'https://placehold.co/640x80/0e0f12/0ea5e9?text=Output+SRT',
      error: null,
      costUsd: 0.01,
      sizeBytes: 12_400,
      createdAt: now - 1800_000,
      finishedAt: now - 1790_000,
    },
    {
      id: id('exp', '3'),
      projectId,
      format: 'mp4',
      platforms: ['douyin', 'xiaohongshu', 'tiktok'],
      progress: 64,
      status: 'encoding',
      step: '正在编码 H.264 (64%)',
      outputUrl: null,
      error: null,
      costUsd: 0.18,
      sizeBytes: 0,
      createdAt: now - 60_000,
      finishedAt: null,
    },
  ]
}

// =============================================================================
// 通用：生成完整 mock 初始状态
// =============================================================================

export interface StudioMockData {
  project: Project
  characters: CharacterV2[]
  scenes: SceneV2[]
  tools: StudioTool[]
  exportTasks: ExportTask[]
}

export function buildStudioMock(): StudioMockData {
  const project = makeMockProject(1)
  return {
    project,
    characters: makeMockCharacters(),
    scenes: makeMockScenes(),
    tools: MOCK_TOOLS,
    exportTasks: makeMockExportTasks(project.id),
  }
}
