/**
 * 11 套艺术风格资产（导入自 Toonflow）
 * 来源：D:\ManhuaWorks\assets\art-skills\
 *
 * 每种风格包含：
 * - 视觉关键词（喂给图像模型）
 * - 镜头/构图规则
 * - 典型色板
 */

export interface ArtStyle {
  id: string;
  name: string;
  nameZh: string;
  /** 喂给图像模型的视觉关键词 */
  visualKeywords: string[];
  /** 风格前缀 prompt（直接拼接到文生图 prompt 前面） */
  prefixPrompt: string;
  /** 典型色板（hex） */
  palette: string[];
  /** 适合的故事类型 */
  bestFor: string[];
  /** 关键构图/线条规则 */
  compositionRules: string[];
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: '2d_90s_japanese_anime',
    name: '2D 90s Japanese Anime',
    nameZh: '2D 90年代日式动漫',
    visualKeywords: ['cel-shaded', 'vibrant', '90s anime', 'hand-drawn'],
    prefixPrompt: '90s japanese anime style, cel-shaded, hand-drawn, vibrant colors, expressive eyes, dynamic poses, ',
    palette: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72CF'],
    bestFor: ['hot_blooded_action', 'xianxia_fantasy', 'coming_of_age'],
    compositionRules: ['speed lines for action', 'sweat drops for emotion', 'large expressive eyes'],
  },
  {
    id: '2d_chinese_guofeng',
    name: '2D Chinese Guofeng',
    nameZh: '2D 中国国风',
    visualKeywords: ['guofeng', 'ink wash', 'traditional chinese', 'hanfu'],
    prefixPrompt: 'chinese guofeng style, ink wash painting, traditional hanfu, flowing silk, mountain landscape, ',
    palette: ['#8B4513', '#D4AF37', '#2F4F4F', '#CD853F', '#DC143C'],
    bestFor: ['xianxia_fantasy', 'historical_epic'],
    compositionRules: ['flowing silk ribbons', 'ink wash backgrounds', 'calligraphy text'],
  },
  {
    id: '2d_flat_design',
    name: '2D Flat Design',
    nameZh: '2D 扁平设计',
    visualKeywords: ['flat design', 'minimal', 'vector', 'clean lines'],
    prefixPrompt: 'flat design illustration, minimal, vector art, clean lines, solid colors, no shading, ',
    palette: ['#FFB6C1', '#87CEEB', '#98FB98', '#FFD700', '#DDA0DD'],
    bestFor: ['comedy_humor', 'family_warmth'],
    compositionRules: ['no gradients', 'geometric shapes', 'bold outlines'],
  },
  {
    id: '2d_mature_urban_romance',
    name: '2D Mature Urban Romance',
    nameZh: '2D 都市成熟言情',
    visualKeywords: ['modern shoujo', 'urban', 'fashionable', 'sophisticated'],
    prefixPrompt: 'modern urban romance anime style, fashionable characters, city backdrop, soft lighting, ',
    palette: ['#FFB7C5', '#E6E6FA', '#F0E68C', '#DDA0DD', '#AFEEEE'],
    bestFor: ['sweet_romance_novel', 'urban_workplace_drama'],
    compositionRules: ['soft lighting', 'fashionable outfits', 'city skylines'],
  },
  {
    id: '3d_anime_render',
    name: '3D Anime Render',
    nameZh: '3D 动漫渲染',
    visualKeywords: ['3d anime', 'unreal engine', 'subsurface scattering', 'cinematic'],
    prefixPrompt: '3d anime render, unreal engine 5, cinematic lighting, subsurface scattering, detailed, ',
    palette: ['#FF1493', '#00CED1', '#FFD700', '#9370DB', '#FF6347'],
    bestFor: ['hot_blooded_action', 'scifi_post_apocalypse'],
    compositionRules: ['volumetric lighting', 'depth of field', 'realistic materials'],
  },
  {
    id: '3d_chinese_traditional',
    name: '3D Chinese Traditional',
    nameZh: '3D 中国传统',
    visualKeywords: ['3d guofeng', 'traditional chinese', 'ornate', 'pavilion'],
    prefixPrompt: '3d chinese traditional style, ornate pavilions, red lanterns, traditional architecture, ',
    palette: ['#8B0000', '#FFD700', '#006400', '#4B0082', '#FF8C00'],
    bestFor: ['xianxia_fantasy', 'historical_epic'],
    compositionRules: ['ornate carvings', 'red lanterns', 'traditional roofs'],
  },
  {
    id: '3d_clay_stopmotion',
    name: '3D Clay Stopmotion',
    nameZh: '3D 黏土定格',
    visualKeywords: ['claymation', 'stopmotion', 'textured', 'playful'],
    prefixPrompt: '3d claymation stopmotion style, textured clay, fingerprints visible, playful, ',
    palette: ['#F4A460', '#DEB887', '#8B4513', '#FFA07A', '#CD853F'],
    bestFor: ['family_warmth', 'comedy_humor', 'coming_of_age'],
    compositionRules: ['visible fingerprints', 'clay texture', 'miniature sets'],
  },
  {
    id: '3d_guofeng_cyber',
    name: '3D Guofeng Cyber',
    nameZh: '3D 国风赛博',
    visualKeywords: ['guofeng cyberpunk', 'neon', 'hanfu', 'futuristic'],
    prefixPrompt: 'guofeng cyberpunk style, neon lights, hanfu meets tech, futuristic oriental city, ',
    palette: ['#FF00FF', '#00FFFF', '#FFD700', '#FF1493', '#9B30FF'],
    bestFor: ['scifi_post_apocalypse', 'xianxia_fantasy'],
    compositionRules: ['neon signs with chinese characters', 'hanfu + tech implants', 'rain reflections'],
  },
  {
    id: 'realpeople_ancient_chinese',
    name: 'Real People Ancient Chinese',
    nameZh: '真人古风',
    visualKeywords: ['realistic', 'ancient chinese', 'cosplay', 'period drama'],
    prefixPrompt: 'realistic ancient chinese style, period drama, traditional hanfu, cinematic, ',
    palette: ['#8B4513', '#D4AF37', '#800020', '#2F4F4F', '#CD853F'],
    bestFor: ['historical_epic', 'xianxia_fantasy'],
    compositionRules: ['period-accurate costumes', 'natural lighting', 'film grain'],
  },
  {
    id: 'realpeople_modern_city',
    name: 'Real People Modern City',
    nameZh: '真人现代都市',
    visualKeywords: ['realistic', 'modern city', 'urban', 'natural'],
    prefixPrompt: 'realistic modern city style, urban environment, natural lighting, ',
    palette: ['#708090', '#A9A9A9', '#2F4F4F', '#D2691E', '#8B4513'],
    bestFor: ['urban_workplace_drama', 'sweet_romance_novel'],
    compositionRules: ['shallow depth of field', 'urban backgrounds', 'natural expressions'],
  },
  {
    id: 'realpeople_urban_modern',
    name: 'Real People Urban Modern',
    nameZh: '真人时尚现代',
    visualKeywords: ['realistic', 'fashionable', 'modern', 'stylish'],
    prefixPrompt: 'realistic urban modern style, fashionable, stylish outfits, contemporary, ',
    palette: ['#000000', '#FFFFFF', '#C0C0C0', '#DC143C', '#4169E1'],
    bestFor: ['urban_workplace_drama', 'sweet_romance_novel'],
    compositionRules: ['fashion magazine style', 'clean compositions', 'monochrome accents'],
  },
];

export function getArtStyle(id: string): ArtStyle | undefined {
  return ART_STYLES.find((s) => s.id === id);
}
