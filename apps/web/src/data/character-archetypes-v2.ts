// =============================================================================
// character-archetypes-v2.ts — 6 类角色 archetype v2
// W5 任务 5：扩字段（行为/关系/主题适配/风格 ID）
// 复用 W3 角色库（archetype 与 5 主题色 + 表情 + 视角一致）
// =============================================================================

import type {
  CharacterArchetype,
  CharacterArchetypeMeta,
  CharacterVector,
} from '../types/character'

/** W3 兼容 5 主题 ID */
type ThemeId = 'minimal-light' | 'dark-workshop' | 'creator-orange' | 'neon-cyber' | 'national-ink'

/** 6 类 archetype 元数据 */
export const CHARACTER_ARCHETYPES_V2: CharacterArchetypeMeta[] = [
  {
    id: 'youth',
    label: '少年',
    code: 'youth',
    color: 'blue',
    colorAccent: 'sky',
    icon: '🧑‍🎓',
    tagline: '14-22 岁，成长型主角，信念驱动',
    description:
      '青少年男性角色。身形逐渐挺拔，面容带少年感未脱稚气，眼神常带倔强与好奇。' +
      '服装偏运动校服、卫衣、机车夹克等便于行动的款式。性格常含成长弧线：从懵懂到担当。',
    ageRange: { min: 14, max: 22 },
    bodyShape: '瘦长 / 中等 / 后期可肌肉化',
    clothingTone: '校服 / 卫衣 / 夹克 / 运动鞋',
    defaultExpressions: ['neutral', 'determined', 'smile', 'angry', 'shock', 'sad'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-modern',
    traits: ['成长型', '热血', '好奇心', '正义感', '有缺陷'],
    relationships: ['mentor（导师）', 'maiden（女主）', 'villain（宿敌）', 'child（被保护者）'],
    themeAdapters: {
      'minimal-light': { color: 'blue', accent: 'sky', promptHint: '清淡水彩，柔和明暗' },
      'dark-workshop': { color: 'blue', accent: 'cyan', promptHint: '深色背景，强光对比' },
      'creator-orange': { color: 'orange', accent: 'amber', promptHint: '暖色调，活力橙' },
      'neon-cyber': { color: 'cyan', accent: 'magenta', promptHint: '霓虹赛博光效' },
      'national-ink': { color: 'ink', accent: 'gold', promptHint: '水墨风，笔触留白' },
    },
  },
  {
    id: 'maiden',
    label: '少女',
    code: 'maiden',
    color: 'pink',
    colorAccent: 'rose',
    icon: '👧',
    tagline: '14-22 岁，成长型女主，情感驱动',
    description:
      '青少年女性角色。身形纤细柔美，五官清秀灵动，发型多变（双马尾/长发/短发）。' +
      '服装偏 JK 制服、连衣裙、汉服等。性格常含自我觉醒：从柔弱到独立。',
    ageRange: { min: 14, max: 22 },
    bodyShape: '纤细 / 柔美',
    clothingTone: 'JK 制服 / 连衣裙 / 汉服 / 运动装',
    defaultExpressions: ['neutral', 'shy', 'smile', 'angry', 'worried', 'determined'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-modern',
    traits: ['成长型', '共情强', '聪慧', '有时柔弱', '觉醒'],
    relationships: ['youth（男主/搭档）', 'mentor（师姐/前辈）', 'villain（情敌/宿敌）', 'child（妹妹/徒弟）'],
    themeAdapters: {
      'minimal-light': { color: 'pink', accent: 'rose', promptHint: '柔光，淡粉色调' },
      'dark-workshop': { color: 'pink', accent: 'fuchsia', promptHint: '深色背景，柔光描边' },
      'creator-orange': { color: 'rose', accent: 'amber', promptHint: '暖橙粉，活力' },
      'neon-cyber': { color: 'magenta', accent: 'cyan', promptHint: '霓虹粉，赛博风' },
      'national-ink': { color: 'rose', accent: 'gold', promptHint: '工笔仕女，柔美笔触' },
    },
  },
  {
    id: 'villain',
    label: '反派',
    code: 'villain',
    color: 'red',
    colorAccent: 'crimson',
    icon: '🧑‍🦲',
    tagline: '核心冲突来源，气场压人',
    description:
      '反派角色。身形常高大/瘦削/特殊（如残肢、面具、纹章），眼神冷厉或癫狂。' +
      '服装常带识别符号（披风/黑袍/制服徽章）。性格鲜明极端：高傲/阴鸷/伪善/癫狂。',
    ageRange: { min: 20, max: 60 },
    bodyShape: '高大 / 瘦削 / 异形',
    clothingTone: '黑袍 / 制服 / 披风 / 战术装备',
    defaultExpressions: ['evil-smile', 'cold', 'angry', 'mocking', 'mad', 'reveal'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-modern',
    traits: ['极端', '高智商', '有过去', '气场强', '可悲可恨'],
    relationships: ['youth（宿敌/镜像）', 'mentor（师徒/反目）', 'elder（上位者/反叛父）'],
    themeAdapters: {
      'minimal-light': { color: 'red', accent: 'crimson', promptHint: '冷灰背景，红色高光' },
      'dark-workshop': { color: 'red', accent: 'crimson', promptHint: '暗红，黑影重' },
      'creator-orange': { color: 'crimson', accent: 'amber', promptHint: '血红，戏剧光' },
      'neon-cyber': { color: 'magenta', accent: 'red', promptHint: '暗紫红，全息光' },
      'national-ink': { color: 'ink', accent: 'crimson', promptHint: '水墨反派，浓黑+血' },
    },
  },
  {
    id: 'mentor',
    label: '导师',
    code: 'mentor',
    color: 'purple',
    colorAccent: 'violet',
    icon: '🧙',
    tagline: '指引型长辈/同辈，阅历深厚',
    description:
      '导师型角色。常为中年/青年/老年，气质沉稳慈祥或严厉内敛。' +
      '服装得体（长袍/西装/道袍/休闲）。关键道具：拐杖/书/武器/信物。',
    ageRange: { min: 25, max: 70 },
    bodyShape: '中等 / 健壮 / 瘦削',
    clothingTone: '长袍 / 西装 / 道袍 / 休闲',
    defaultExpressions: ['calm', 'smile', 'serious', 'worried', 'encouraging', 'reveal'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-modern',
    traits: ['沉稳', '博学', '有过去', '牺牲精神', '指引者'],
    relationships: ['youth（徒弟）', 'maiden（徒弟/红颜）', 'child（监护人）', 'villain（前徒弟/对头）'],
    themeAdapters: {
      'minimal-light': { color: 'purple', accent: 'violet', promptHint: '淡紫，柔和' },
      'dark-workshop': { color: 'purple', accent: 'violet', promptHint: '深紫，神秘' },
      'creator-orange': { color: 'violet', accent: 'amber', promptHint: '紫橙对比' },
      'neon-cyber': { color: 'violet', accent: 'cyan', promptHint: '赛博紫，全息' },
      'national-ink': { color: 'ink', accent: 'gold', promptHint: '水墨师者' },
    },
  },
  {
    id: 'child',
    label: '儿童',
    code: 'child',
    color: 'green',
    colorAccent: 'lime',
    icon: '🧒',
    tagline: '8-13 岁，天真/灵动机敏',
    description:
      '儿童角色。身形小巧，面容稚嫩，比例头身比偏大（Q 版风）。' +
      '服装活泼（背带裤/T 恤/校服/动漫风）。动作和表情夸张，富有童趣。',
    ageRange: { min: 8, max: 13 },
    bodyShape: '小巧 / Q 版',
    clothingTone: '背带裤 / T 恤 / 校服 / 动漫风',
    defaultExpressions: ['happy', 'curious', 'sad', 'scared', 'angry', 'surprised'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-chibi',
    traits: ['天真', '机敏', '无畏', '话多', '触发剧情'],
    relationships: ['youth（师兄姐/被保护者）', 'maiden（大姐姐/小妹妹）', 'mentor（监护人）', 'elder（祖辈）'],
    themeAdapters: {
      'minimal-light': { color: 'green', accent: 'lime', promptHint: 'Q 版淡彩' },
      'dark-workshop': { color: 'green', accent: 'lime', promptHint: 'Q 版深绿' },
      'creator-orange': { color: 'lime', accent: 'amber', promptHint: 'Q 版活力橙' },
      'neon-cyber': { color: 'lime', accent: 'cyan', promptHint: 'Q 版赛博' },
      'national-ink': { color: 'ink', accent: 'lime', promptHint: '水墨童子' },
    },
  },
  {
    id: 'elder',
    label: '老者',
    code: 'elder',
    color: 'amber',
    colorAccent: 'yellow',
    icon: '🧓',
    tagline: '阅历深厚，智慧/权威',
    description:
      '老年角色。身形或有佝偻或依然挺拔，皱纹/白发/长须是标识。' +
      '服装庄重（长衫/道袍/西装/休闲）。眼神深邃，常作"长者言"叙事支点。',
    ageRange: { min: 55, max: 90 },
    bodyShape: '佝偻 / 挺拔 / 拄拐',
    clothingTone: '长衫 / 道袍 / 西装 / 唐装',
    defaultExpressions: ['wise', 'calm', 'smile', 'serious', 'worried', 'farewell'],
    defaultViews: ['front', 'side', 'back', 'threeQ'],
    styleId: 'manhua-classic',
    traits: ['智慧', '权威', '有过去', '见证者', '传承者'],
    relationships: ['youth（祖辈/师祖）', 'mentor（同辈/老友）', 'child（孙辈）', 'villain（宿敌/对头）'],
    themeAdapters: {
      'minimal-light': { color: 'amber', accent: 'yellow', promptHint: '素描淡彩' },
      'dark-workshop': { color: 'amber', accent: 'yellow', promptHint: '深褐金色' },
      'creator-orange': { color: 'amber', accent: 'gold', promptHint: '金黄，温暖' },
      'neon-cyber': { color: 'amber', accent: 'cyan', promptHint: '赛博老将' },
      'national-ink': { color: 'ink', accent: 'gold', promptHint: '水墨长者' },
    },
  },
]

/** 按 archetype ID 查找元数据 */
export function getArchetypeMeta(id: CharacterArchetype): CharacterArchetypeMeta {
  const m = CHARACTER_ARCHETYPES_V2.find(a => a.id === id)
  if (!m) throw new Error(`[character-archetypes-v2] unknown archetype: ${id}`)
  return m
}

/** 列出所有 archetype ID */
export function listArchetypeIds(): CharacterArchetype[] {
  return CHARACTER_ARCHETYPES_V2.map(a => a.id)
}

/** 按主题 ID 获取角色配色变体 */
export function getArchetypeThemeVariant(
  id: CharacterArchetype,
  themeId: ThemeId,
): { color?: string; accent?: string; promptHint?: string } | null {
  const m = getArchetypeMeta(id)
  return m.themeAdapters[themeId] ?? null
}

/**
 * 构造 archetype 的初始一致性向量（1024 维）。
 * 使用确定性 hash 映射到 [-1, 1] 区间，便于离线 mock 与测试。
 * 生产环境应替换为 all-MiniLM-L6-v2 embedding（见 api/vectors.ts）。
 */
export function buildArchetypeVector(
  id: CharacterArchetype,
  options?: { seed?: number; extraText?: string },
): CharacterVector {
  const seedBase = options?.seed ?? hashStr(id)
  const text = `${id} ${getArchetypeMeta(id).label} ${options?.extraText ?? ''}`.trim()
  return deterministicVector(text, 1024, seedBase)
}

/** 简单字符串 hash（djb2） */
function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** 确定性向量生成（伪 embedding，调试/测试用） */
function deterministicVector(text: string, dim: number, seed: number): number[] {
  const v: number[] = new Array(dim)
  let s = seed >>> 0
  for (let i = 0; i < dim; i++) {
    // 文本字符参与，构造稳定的伪随机分布
    s = (s * 1103515245 + 12345 + i + text.charCodeAt(i % text.length)) >>> 0
    const r = (s % 20001) / 10000 - 1 // [-1, 1]
    v[i] = Math.round(r * 1e4) / 1e4
  }
  // 归一化（cosine 友好）
  return normalize(v)
}

/** L2 归一化 */
function normalize(v: number[]): number[] {
  let s = 0
  for (const x of v) s += x * x
  const norm = Math.sqrt(s) || 1
  return v.map(x => Math.round((x / norm) * 1e4) / 1e4)
}

/** 预生成 6 archetype 的向量（启动时一次性构造，缓存到内存） */
export const ARCHETYPE_VECTORS: Record<CharacterArchetype, CharacterVector> = Object.fromEntries(
  CHARACTER_ARCHETYPES_V2.map(a => [a.id, buildArchetypeVector(a.id)]),
) as Record<CharacterArchetype, CharacterVector>
