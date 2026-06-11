/**
 * 角色 prompt 模板（3 套：写实 / 动漫 / 水墨）
 *
 * 用法：
 *   - 喂给 LLM 一次，输出完整角色卡 JSON
 *   - 锁脸 prompt 直接喂给图像生成模型（i2i / i2v）
 *
 * 模板变量：
 *   {{name}}        角色名
 *   {{role}}        protagonist / supporting / antagonist / background
 *   {{storyType}}   故事类型 id
 *   {{otherChars}}  其他角色名（用于一致性锚定）
 */

export type CharacterStyle = 'realistic' | 'anime' | 'ink_wash';

export interface CharacterPromptTemplate {
  style: CharacterStyle;
  name: string;
  nameZh: string;
  /** 角色卡 JSON Schema（LLM 输出约束） */
  schema: string;
  /** 锁脸 prompt 前缀（喂给图像模型） */
  facePrefix: string;
  /** 锁脸 prompt 后缀 */
  faceSuffix: string;
  /** 多表情 prompt 后缀 */
  expressionSuffix: Record<string, string>;
  /** 跨场景锁脸 negative prompt */
  faceNegative: string;
  /** 默认脸部参数 */
  defaults: {
    cameraAngle: string;
    lighting: string;
    background: string;
  };
}

export const CHARACTER_PROMPTS: Record<CharacterStyle, CharacterPromptTemplate> = {
  realistic: {
    style: 'realistic',
    name: 'Realistic',
    nameZh: '写实',
    schema: [
      '请输出严格 JSON（无 markdown 标记）：',
      '{',
      '  "name": "string",',
      '  "role": "protagonist|supporting|antagonist|background",',
      '  "age": number,',
      '  "gender": "male|female|other",',
      '  "appearance": {',
      '    "hairColor": "string", "hairStyle": "string",',
      '    "eyeColor": "string", "skinTone": "string",',
      '    "heightCm": number, "bodyType": "string",',
      '    "distinguishingFeatures": ["string", ...]',
      '  },',
      '  "personality": ["string", ...],',
      '  "background": "string",',
      '  "voiceHint": "string"',
      '}',
    ].join('\n'),
    facePrefix: 'photorealistic portrait, studio lighting, sharp focus, real human skin texture, 85mm lens,',
    faceSuffix: 'front-facing, neutral expression, head and shoulders, character sheet consistency, photoreal, 8k, RAW photo',
    expressionSuffix: {
      happy: ', bright genuine smile, eyes slightly squinted, warm expression',
      sad: ', melancholic gaze, slightly downturned mouth, soft eyes',
      angry: ', furrowed brows, intense piercing eyes, clenched jaw',
      surprised: ', wide eyes, raised eyebrows, slight open mouth',
      scared: ', tense expression, sweat on forehead, dilated pupils',
      neutral: ', calm composed expression, direct gaze',
      smug: ', slight asymmetric smirk, one eyebrow raised',
      shocked: ', eyes wide, mouth agape, frozen pose',
      crying: ', tears streaming, red-rimmed eyes, trembling lips',
      laughing: ', open joyful laugh, head slightly tilted, animated expression',
    },
    faceNegative: 'cartoon, anime, painting, illustration, deformed, extra fingers, blurry, low quality, watermark, text, oversaturated',
    defaults: {
      cameraAngle: 'eye level, straight on',
      lighting: 'three-point studio lighting, soft key light, dim fill',
      background: 'plain light grey backdrop',
    },
  },
  anime: {
    style: 'anime',
    name: 'Anime',
    nameZh: '动漫',
    schema: [
      '请输出严格 JSON（无 markdown 标记）：',
      '{',
      '  "name": "string",',
      '  "role": "protagonist|supporting|antagonist|background",',
      '  "age": number,',
      '  "gender": "male|female|other",',
      '  "appearance": {',
      '    "hairColor": "string (e.g. 黑色 / 银白 / 暗紫)", "hairStyle": "string",',
      '    "eyeColor": "string (e.g. 翡翠绿 / 琥珀)",',
      '    "heightCm": number,',
      '    "distinguishingFeatures": ["string", ...] (e.g. 左眼有伤疤 / 戴半框眼镜)',
      '  },',
      '  "personality": ["string", ...],',
      '  "background": "string",',
      '  "voiceHint": "声线 / 语气 / 节奏",',
      '  "animeArchetype": "傲娇 | 元气 | 高冷 | 温柔 | 病娇 | 热血 | 天然 | 中二 ..."',
      '}',
    ].join('\n'),
    facePrefix: 'anime style, cel shaded, vivid colors, large expressive eyes, detailed hair strands, clean line art,',
    faceSuffix: 'front-facing bust portrait, head and shoulders, white background, character reference sheet consistency, high quality anime art',
    expressionSuffix: {
      happy: ', beaming smile, sparkling eyes, slight blush',
      sad: ', downcast eyes, single tear, melancholic',
      angry: ', vein popping, glaring eyes, gritted teeth',
      surprised: ', wide round eyes, small open mouth, exclamation lines',
      scared: ', trembling, sweat drop, pale face',
      neutral: ', calm flat expression, deadpan',
      smug: ', one eye closed, curved smirk',
      shocked: ', bulging eyes, dramatic pose, lines radiating',
      crying: ', full tears, sobbing, red eyes',
      laughing: ', mouth wide open laughing, eyes closed, joyful',
    },
    faceNegative: '3d render, photorealistic, deformed, extra fingers, blurry, low quality, watermark, text, dull colors, western cartoon',
    defaults: {
      cameraAngle: 'eye level, slight 3/4 view',
      lighting: 'soft flat anime lighting, no harsh shadows',
      background: 'pure white background, character ref sheet',
    },
  },
  ink_wash: {
    style: 'ink_wash',
    name: 'Ink Wash',
    nameZh: '水墨',
    schema: [
      '请输出严格 JSON（无 markdown 标记）：',
      '{',
      '  "name": "string",',
      '  "role": "protagonist|supporting|antagonist|background",',
      '  "age": number,',
      '  "gender": "male|female|other",',
      '  "appearance": {',
      '    "hairColor": "string (黑/灰白/墨色)", "hairStyle": "string (高髻/散发/束发)",',
      '    "eyeColor": "string (深邃黑/琥珀)",',
      '    "bodyType": "string (清瘦/魁梧/飘逸)",',
      '    "distinguishingFeatures": ["string", ...] (e.g. 持剑 / 长袍 / 玉佩)',
      '  },',
      '  "personality": ["string", ...],',
      '  "background": "string",',
      '  "voiceHint": "语调 / 气息",',
      '  "moodPalette": ["留白", "水墨", "宣纸", "朱砂", "黛色", "..."]',
      '}',
    ].join('\n'),
    facePrefix: 'Chinese ink wash painting, sumi-e style, flowing brushwork, xuan paper texture, soft gradients,',
    faceSuffix: 'portrait, traditional Chinese clothing, hair ornaments, half body, profile-consistent, museum quality ink wash',
    expressionSuffix: {
      happy: ', warm subtle smile, eyes crescent',
      sad: ', distant gaze, drooping shoulders',
      angry: ', glaring, brushstroke intensity',
      surprised: ', eyes widened, slight gasp',
      scared: ', wide eyes, startled posture',
      neutral: ', serene, zhuangzi-like calm',
      smug: ', confident smile, slight chin lift',
      shocked: ', brushstroke burst, dramatic pause',
      crying: ', single ink drop tear, melancholy',
      laughing: ', open hearty laugh, head thrown back',
    },
    faceNegative: 'photorealistic, anime, western art, 3d render, bright colors, neon, deformed, low quality, watermark, text',
    defaults: {
      cameraAngle: 'eye level, classic Chinese portrait composition',
      lighting: 'natural diffuse, like traditional Chinese studio',
      background: 'xuan paper, ink wash clouds, blank space (留白)',
    },
  },
};

export function getCharacterPrompt(style: CharacterStyle): CharacterPromptTemplate {
  return CHARACTER_PROMPTS[style];
}

/** 自动从 artStyle id 推断 character style */
export function inferCharacterStyle(artStyle: string): CharacterStyle {
  const s = artStyle.toLowerCase();
  if (s.includes('anime') || s.includes('2d_90s') || s.includes('flat') || s.includes('2d')) return 'anime';
  if (s.includes('guofeng') || s.includes('chinese_traditional') || s.includes('ink') || s.includes('guofeng_')) return 'ink_wash';
  return 'realistic';
}

/** 渲染锁脸 prompt（用于 image-gen） */
export function renderFacePrompt(
  style: CharacterStyle,
  profile: {
    name: string;
    appearance: { hairColor: string; hairStyle: string; eyeColor: string; distinguishingFeatures: string[] };
  },
  expression: keyof CharacterPromptTemplate['expressionSuffix'] = 'neutral'
): string {
  const tpl = CHARACTER_PROMPTS[style];
  const features = profile.appearance.distinguishingFeatures.length
    ? ', ' + profile.appearance.distinguishingFeatures.join(', ')
    : '';
  return [
    tpl.facePrefix,
    `${profile.name}, ${profile.appearance.hairColor} ${profile.appearance.hairStyle} hair, ${profile.appearance.eyeColor} eyes${features},`,
    tpl.defaults.cameraAngle + ',',
    tpl.defaults.lighting + ',',
    tpl.defaults.background + ',',
    tpl.expressionSuffix[expression] ?? '',
    tpl.faceSuffix,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 渲染完整角色卡 prompt（喂给 LLM） */
export function renderCharacterCardPrompt(
  style: CharacterStyle,
  vars: { name: string; role: string; storyType?: string; otherChars?: string[] }
): string {
  const tpl = CHARACTER_PROMPTS[style];
  return [
    `【角色卡生成 · 风格：${tpl.nameZh}（${tpl.name}）】`,
    `角色名：${vars.name}`,
    `角色定位：${vars.role}`,
    vars.storyType ? `所属故事类型：${vars.storyType}` : '',
    vars.otherChars && vars.otherChars.length > 0
      ? `其他角色（请保持外貌差异化）：${vars.otherChars.join('、')}`
      : '',
    '',
    tpl.schema,
  ]
    .filter(Boolean)
    .join('\n');
}
