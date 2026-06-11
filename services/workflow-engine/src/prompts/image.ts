/**
 * 图像 prompt 模板（4 套：电影感 / 插画感 / 赛博感 / 古典感）
 *
 * 用法：renderImagePrompt() 把变量插值，喂给 image-gen 节点 → ai-router
 *
 * 模板变量：
 *   {{subject}}      主体
 *   {{action}}       动作
 *   {{location}}     地点
 *   {{mood}}         情绪
 *   {{lighting}}     光照
 *   {{camera}}       镜头
 *   {{style}}        风格 id
 */

export type ImageMood = 'cinematic' | 'illustration' | 'cyberpunk' | 'classical';

export interface ImagePromptTemplate {
  mood: ImageMood;
  name: string;
  nameZh: string;
  prefix: string;
  suffix: string;
  lighting: string;
  camera: string;
  negative: string;
  /** 默认参数 */
  defaults: {
    aspectRatio: '1:1' | '16:9' | '9:16' | '3:2' | '2:3';
    numImages: number;
    steps: number;
    cfgScale: number;
  };
  /** 推荐配套 artStyle */
  recommendedArtStyles: string[];
}

export const IMAGE_PROMPTS: Record<ImageMood, ImagePromptTemplate> = {
  cinematic: {
    mood: 'cinematic',
    name: 'Cinematic',
    nameZh: '电影感',
    prefix: 'cinematic film still, anamorphic lens, shallow depth of field, atmospheric, color graded,',
    suffix: 'cinematic composition, rule of thirds, anamorphic bokeh, film grain, 24fps, masterpiece, ultra detailed',
    lighting: 'practical lighting, motivated key light, motivated fill, rim light',
    camera: '35mm anamorphic, f/1.8, eye level or low angle',
    negative: 'cartoon, anime, painting, sketch, deformed, extra fingers, blurry, low quality, watermark, text, oversaturated, hdr artifacts',
    defaults: {
      aspectRatio: '16:9',
      numImages: 1,
      steps: 30,
      cfgScale: 7.5,
    },
    recommendedArtStyles: ['realpeople_modern_city', 'realpeople_urban_modern', '3D_anime_render'],
  },
  illustration: {
    mood: 'illustration',
    name: 'Illustration',
    nameZh: '插画感',
    prefix: 'digital illustration, soft shading, hand-drawn feel, vibrant colors, character-driven composition,',
    suffix: 'illustration art, book cover style, clean linework, polished shading, artstation trending, detailed',
    lighting: 'soft global illumination, gentle directional light',
    camera: 'dynamic composition, slight dutch angle if action',
    negative: 'photorealistic, 3d render, deformed, extra fingers, blurry, low quality, watermark, text, dull colors',
    defaults: {
      aspectRatio: '3:2',
      numImages: 1,
      steps: 28,
      cfgScale: 7,
    },
    recommendedArtStyles: ['2D_90s_japanese_anime', '2D_mature_urban_romance', '2D_flat_design'],
  },
  cyberpunk: {
    mood: 'cyberpunk',
    name: 'Cyberpunk',
    nameZh: '赛博感',
    prefix: 'cyberpunk, neon-lit, dystopian future, holographic displays, rain-slick streets, dense urban detail,',
    suffix: 'neon glow, chromatic aberration, glitch details, sci-fi atmosphere, blade runner inspired, ultra detailed',
    lighting: 'mixed neon (magenta + cyan + amber), hard shadows, atmospheric haze, volumetric light',
    camera: 'low angle, dutch angle, anamorphic lens, f/1.4',
    negative: 'medieval, pastoral, daytime, low contrast, warm color, blurry, low quality, deformed, watermark, text',
    defaults: {
      aspectRatio: '16:9',
      numImages: 1,
      steps: 35,
      cfgScale: 8,
    },
    recommendedArtStyles: ['3D_guofeng_cyber', 'realpeople_urban_modern', 'scifi_post_apocalypse'],
  },
  classical: {
    mood: 'classical',
    name: 'Classical',
    nameZh: '古典感',
    prefix: 'classical Chinese painting, gongbi or xieyi style, meticulous brushwork, traditional composition,',
    suffix: 'museum quality, silk scroll texture, traditional seal stamp, ink and color on xuan paper, masterpiece',
    lighting: 'diffuse natural light, no harsh shadow, atmospheric mist',
    camera: 'frontal or 3/4 traditional portrait composition, generous 留白',
    negative: 'photorealistic, anime, 3d render, modern elements, neon, deformed, blurry, low quality, watermark, text',
    defaults: {
      aspectRatio: '3:2',
      numImages: 1,
      steps: 30,
      cfgScale: 7,
    },
    recommendedArtStyles: ['2D_chinese_guofeng', '3D_chinese_traditional', 'realpeople_ancient_chinese'],
  },
};

export function getImagePrompt(mood: ImageMood): ImagePromptTemplate {
  return IMAGE_PROMPTS[mood];
}

/** 自动从 artStyle 推断 image mood */
export function inferImageMood(artStyle: string): ImageMood {
  const s = artStyle.toLowerCase();
  if (s.includes('cyber') || s.includes('scifi') || s.includes('post_apoc')) return 'cyberpunk';
  if (s.includes('guofeng') || s.includes('chinese_traditional') || s.includes('ancient')) return 'classical';
  if (s.includes('anime') || s.includes('2d') || s.includes('flat') || s.includes('illustration')) return 'illustration';
  return 'cinematic';
}

/**
 * 渲染最终图像 prompt
 * @param mood 风格情绪
 * @param vars 变量
 * @param characterRefs 角色锁脸引用提示（会拼到 prompt 中）
 */
export function renderImagePrompt(
  mood: ImageMood,
  vars: {
    subject: string;
    action: string;
    location: string;
    mood?: string;
    style?: string;
  },
  characterRefs: string[] = []
): string {
  const tpl = IMAGE_PROMPTS[mood];
  const charPart = characterRefs.length > 0 ? `featuring ${characterRefs.join(', ')}, ` : '';
  const moodPart = vars.mood ? `, ${vars.mood} atmosphere` : '';
  return [
    tpl.prefix,
    `${charPart}${vars.subject} ${vars.action} at ${vars.location}${moodPart},`,
    tpl.lighting + ',',
    tpl.camera + ',',
    tpl.suffix,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
