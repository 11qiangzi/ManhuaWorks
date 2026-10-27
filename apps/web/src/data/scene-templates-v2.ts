// =============================================================================
// scene-templates-v2.ts — 12 类场景模板 v2
// W5 任务 5：扩到 12 类（4-6 子场景 / 主题适配 / 风格 ID）
// 复用 W3 6 类（scifi-city / wasteland / spaceship / xianxia / republic / modern-school）
// =============================================================================

import type {
  SceneTemplate,
  SceneTemplateMeta,
  SceneVector,
  SceneSubScene,
} from '../types/scene'

type ThemeId = 'minimal-light' | 'dark-workshop' | 'creator-orange' | 'neon-cyber' | 'national-ink'

/** 12 类场景模板 */
export const SCENE_TEMPLATES_V2: SceneTemplateMeta[] = [
  // ----- 1. 科幻都市 -----
  {
    id: 'scifi-city',
    label: '科幻都市',
    code: 'scifi-city',
    color: 'cyan',
    colorAccent: 'blue',
    icon: '🏙️',
    tagline: '霓虹/玻璃幕墙/悬浮车，未来都市夜景',
    description:
      '近未来科幻城市。玻璃幕墙摩天楼、悬浮交通工具、全息广告、磁悬浮轨道。' +
      '色温偏冷（4500-6500K），光向以顶光和侧光为主，常用青蓝紫色调。',
    defaultColorTemp: 5800,
    defaultLightDir: 'top',
    defaultIntensity: 0.75,
    styleId: 'scifi-neon',
    compatibleArchetypes: ['youth', 'maiden', 'villain', 'mentor'],
    subScenes: [
      { id: 'scifi-city-1', name: '霓虹主街', description: '雨夜霓虹主街，全息广告', colorTemp: 6200, lightDir: 'top-side', intensity: 0.7, keywords: ['霓虹', '主街', '广告', '雨夜'], tags: ['夜景', '主街', '商业'] },
      { id: 'scifi-city-2', name: '悬空平台', description: '百层悬空观景平台，星际航道', colorTemp: 5500, lightDir: 'top', intensity: 0.85, keywords: ['悬空', '观景', '平台', '航道'], tags: ['高处', '平台', '观光'] },
      { id: 'scifi-city-3', name: '地下城', description: '地下集市，潮湿霓虹', colorTemp: 4500, lightDir: 'side', intensity: 0.55, keywords: ['地下', '集市', '潮湿'], tags: ['地下', '集市', '潮湿'] },
      { id: 'scifi-city-4', name: '磁悬浮站', description: '磁悬浮车站，玻璃穹顶', colorTemp: 6000, lightDir: 'top', intensity: 0.9, keywords: ['车站', '磁悬浮', '穹顶'], tags: ['车站', '交通', '枢纽'] },
      { id: 'scifi-city-5', name: '天台机场', description: '楼顶悬浮机场，起降坪', colorTemp: 6500, lightDir: 'top-side', intensity: 0.95, keywords: ['天台', '机场', '悬浮'], tags: ['天台', '机场', '起降'] },
    ],
    keywords: ['科幻', '城市', '都市', '霓虹', '未来', '玻璃', '摩天楼', '悬浮'],
    themeAdapters: {
      'minimal-light': { color: 'cyan', accent: 'sky', promptHint: '未来水彩' },
      'dark-workshop': { color: 'cyan', accent: 'blue', promptHint: '深空蓝' },
      'creator-orange': { color: 'orange', accent: 'cyan', promptHint: '暖橙青蓝对比' },
      'neon-cyber': { color: 'magenta', accent: 'cyan', promptHint: '赛博霓虹' },
      'national-ink': { color: 'ink', accent: 'cyan', promptHint: '水墨未来' },
    },
  },

  // ----- 2. 废土 -----
  {
    id: 'wasteland',
    label: '废土',
    code: 'wasteland',
    color: 'orange',
    colorAccent: 'amber',
    icon: '🏜️',
    tagline: '沙暴/锈铁/枯树，末日边缘',
    description:
      '核战或生态崩溃后的废土。锈蚀金属残骸、枯木、沙暴。' +
      '色温偏暖黄（3500-4500K），光向以低角度侧光为主，黄昏或正午烈日。',
    defaultColorTemp: 4000,
    defaultLightDir: 'side-low',
    defaultIntensity: 0.9,
    styleId: 'wasteland',
    compatibleArchetypes: ['youth', 'villain', 'mentor', 'child'],
    subScenes: [
      { id: 'wasteland-1', name: '沙暴荒原', description: '黄沙漫天，锈车残骸', colorTemp: 3800, lightDir: 'side-low', intensity: 0.85, keywords: ['沙暴', '荒原', '锈车'], tags: ['荒原', '沙暴'] },
      { id: 'wasteland-2', name: '废土城废墟', description: '断裂高架，废弃楼群', colorTemp: 4200, lightDir: 'top-side', intensity: 0.75, keywords: ['废墟', '废城', '高架'], tags: ['废墟', '城市'] },
      { id: 'wasteland-3', name: '锈铁货场', description: '集装箱锈蚀堆场，沙地', colorTemp: 3600, lightDir: 'side', intensity: 0.7, keywords: ['货场', '锈铁', '集装箱'], tags: ['货场', '工业'] },
      { id: 'wasteland-4', name: '地下掩体', description: '混凝土掩体，柴油灯', colorTemp: 2800, lightDir: 'spot', intensity: 0.45, keywords: ['掩体', '地下', '柴油灯'], tags: ['掩体', '地下'] },
      { id: 'wasteland-5', name: '枯木林', description: '枯死树林，灰色天', colorTemp: 5000, lightDir: 'top', intensity: 0.6, keywords: ['枯木', '树林', '灰色'], tags: ['树林', '枯木'] },
      { id: 'wasteland-6', name: '集市据点', description: '幸存者集市，金属棚', colorTemp: 3400, lightDir: 'top', intensity: 0.65, keywords: ['集市', '据点', '幸存者'], tags: ['集市', '据点'] },
    ],
    keywords: ['废土', '沙暴', '末日', '废墟', '锈铁', '枯树', '荒原', '末日边缘'],
    themeAdapters: {
      'minimal-light': { color: 'orange', accent: 'amber', promptHint: '淡彩废土' },
      'dark-workshop': { color: 'orange', accent: 'crimson', promptHint: '血色废土' },
      'creator-orange': { color: 'orange', accent: 'amber', promptHint: '暖橙荒原' },
      'neon-cyber': { color: 'orange', accent: 'cyan', promptHint: '霓虹废土' },
      'national-ink': { color: 'ink', accent: 'amber', promptHint: '水墨荒原' },
    },
  },

  // ----- 3. 太空船 -----
  {
    id: 'spaceship',
    label: '太空船',
    code: 'spaceship',
    color: 'indigo',
    colorAccent: 'blue',
    icon: '🚀',
    tagline: '舰桥/舱室/星图，星辰大海',
    description:
      '科幻飞船内景与外景。舰桥、舱室、气闸舷窗、星空。' +
      '色温偏冷（5000-7000K），主光来自仪表与舷窗反射光，常带青蓝紫色调。',
    defaultColorTemp: 6000,
    defaultLightDir: 'screen',
    defaultIntensity: 0.65,
    styleId: 'scifi-space',
    compatibleArchetypes: ['youth', 'maiden', 'mentor', 'villain'],
    subScenes: [
      { id: 'spaceship-1', name: '舰桥', description: '主控舰桥，全息星图', colorTemp: 6500, lightDir: 'screen', intensity: 0.7, keywords: ['舰桥', '星图', '主控'], tags: ['舰桥', '主控'] },
      { id: 'spaceship-2', name: '船员舱', description: '紧凑船员舱，舷窗星空', colorTemp: 5500, lightDir: 'window', intensity: 0.5, keywords: ['船员舱', '舷窗'], tags: ['舱室', '起居'] },
      { id: 'spaceship-3', name: '气闸', description: '气闸舱，宇航服', colorTemp: 6000, lightDir: 'top', intensity: 0.6, keywords: ['气闸', '宇航服'], tags: ['气闸', '出舱'] },
      { id: 'spaceship-4', name: '货舱', description: '大型货舱，集装箱', colorTemp: 5000, lightDir: 'top', intensity: 0.55, keywords: ['货舱', '集装箱'], tags: ['货舱'] },
      { id: 'spaceship-5', name: '引擎室', description: '引擎核心，等离子辉光', colorTemp: 7000, lightDir: 'core', intensity: 0.85, keywords: ['引擎', '等离子'], tags: ['引擎', '核心'] },
    ],
    keywords: ['太空', '飞船', '舰桥', '舱室', '星空', '气闸', '引擎', '星图'],
    themeAdapters: {
      'minimal-light': { color: 'indigo', accent: 'blue', promptHint: '深空蓝' },
      'dark-workshop': { color: 'indigo', accent: 'blue', promptHint: '极深空' },
      'creator-orange': { color: 'indigo', accent: 'orange', promptHint: '冷暖对比' },
      'neon-cyber': { color: 'cyan', accent: 'magenta', promptHint: '霓虹舰桥' },
      'national-ink': { color: 'ink', accent: 'cyan', promptHint: '水墨星空' },
    },
  },

  // ----- 4. 现代校园 -----
  {
    id: 'modern-school',
    label: '现代校园',
    code: 'modern-school',
    color: 'green',
    colorAccent: 'lime',
    icon: '🏫',
    tagline: '教室/操场/图书馆，青春舞台',
    description:
      '现代校园建筑与设施。教学楼、操场、图书馆、宿舍。' +
      '色温偏中（4500-5500K），光向以自然光（顶光/侧窗光）为主。',
    defaultColorTemp: 5000,
    defaultLightDir: 'window',
    defaultIntensity: 0.8,
    styleId: 'modern',
    compatibleArchetypes: ['youth', 'maiden', 'child', 'mentor'],
    subScenes: [
      { id: 'modern-school-1', name: '教室', description: '标准教室，投影白板', colorTemp: 5200, lightDir: 'window', intensity: 0.85, keywords: ['教室', '投影'], tags: ['教室', '教学'] },
      { id: 'modern-school-2', name: '操场', description: '塑胶跑道，蓝天白云', colorTemp: 5500, lightDir: 'top', intensity: 1.0, keywords: ['操场', '跑道'], tags: ['操场', '户外'] },
      { id: 'modern-school-3', name: '图书馆', description: '书架长廊，落地窗', colorTemp: 4800, lightDir: 'window', intensity: 0.7, keywords: ['图书馆', '书架'], tags: ['图书馆', '阅读'] },
      { id: 'modern-school-4', name: '天台', description: '教学楼天台，夕阳', colorTemp: 4500, lightDir: 'side-low', intensity: 0.8, keywords: ['天台', '夕阳'], tags: ['天台', '黄昏'] },
    ],
    keywords: ['校园', '教室', '操场', '图书馆', '天台', '学校', '现代', '青春'],
    themeAdapters: {
      'minimal-light': { color: 'green', accent: 'lime', promptHint: '清亮校园' },
      'dark-workshop': { color: 'green', accent: 'lime', promptHint: '深绿校园' },
      'creator-orange': { color: 'lime', accent: 'amber', promptHint: '暖阳校园' },
      'neon-cyber': { color: 'lime', accent: 'cyan', promptHint: '霓虹校园' },
      'national-ink': { color: 'ink', accent: 'lime', promptHint: '水墨校园' },
    },
  },

  // ----- 5. 古风仙侠 -----
  {
    id: 'xianxia',
    label: '古风仙侠',
    code: 'xianxia',
    color: 'violet',
    colorAccent: 'gold',
    icon: '⛰️',
    tagline: '山峰/云海/亭台，仙侠飘逸',
    description:
      '古风仙侠世界。奇峰、云海、亭台楼阁、仙鹤祥云。' +
      '色温偏冷暖中性（4500-5500K），光向以日出/日落侧光为主，雾气与光辉常作为氛围元素。',
    defaultColorTemp: 5000,
    defaultLightDir: 'side-low',
    defaultIntensity: 0.7,
    styleId: 'xianxia-ink',
    compatibleArchetypes: ['youth', 'maiden', 'mentor', 'elder', 'villain'],
    subScenes: [
      { id: 'xianxia-1', name: '云海山峰', description: '日出云海，仙山峰顶', colorTemp: 5200, lightDir: 'side-low', intensity: 0.75, keywords: ['云海', '山峰', '日出'], tags: ['山峰', '云海'] },
      { id: 'xianxia-2', name: '亭台楼阁', description: '水榭亭台，月色', colorTemp: 4800, lightDir: 'moon', intensity: 0.6, keywords: ['亭台', '楼阁', '月色'], tags: ['亭台', '古风'] },
      { id: 'xianxia-3', name: '竹林剑场', description: '翠竹剑场，对决', colorTemp: 5000, lightDir: 'top', intensity: 0.7, keywords: ['竹林', '剑场'], tags: ['竹林', '对决'] },
      { id: 'xianxia-4', name: '洞府福地', description: '山洞洞府，灵泉灵石', colorTemp: 4500, lightDir: 'spot', intensity: 0.6, keywords: ['洞府', '福地', '灵泉'], tags: ['洞府', '福地'] },
      { id: 'xianxia-5', name: '天宫瑶池', description: '云上天宫，瑶池', colorTemp: 5500, lightDir: 'top', intensity: 0.85, keywords: ['天宫', '瑶池'], tags: ['天宫', '瑶池'] },
    ],
    keywords: ['仙侠', '古风', '山峰', '云海', '亭台', '竹林', '洞府', '天宫', '剑气'],
    themeAdapters: {
      'minimal-light': { color: 'violet', accent: 'gold', promptHint: '工笔淡彩' },
      'dark-workshop': { color: 'violet', accent: 'gold', promptHint: '暗紫金' },
      'creator-orange': { color: 'gold', accent: 'crimson', promptHint: '金红古风' },
      'neon-cyber': { color: 'violet', accent: 'cyan', promptHint: '霓虹仙侠' },
      'national-ink': { color: 'ink', accent: 'gold', promptHint: '水墨仙侠' },
    },
  },

  // ----- 6. 民国 -----
  {
    id: 'republic',
    label: '民国',
    code: 'republic',
    color: 'amber',
    colorAccent: 'crimson',
    icon: '🏮',
    tagline: '长街/黄包车/旗袍，旧时光',
    description:
      '民国时期（1912-1949）城市与街巷。旗袍、长衫、黄包车、老式电车、租界洋楼。' +
      '色温偏暖（3500-4500K），光向以侧光和街灯为主，黄昏雨夜常见。',
    defaultColorTemp: 4000,
    defaultLightDir: 'side',
    defaultIntensity: 0.7,
    styleId: 'republic-ink',
    compatibleArchetypes: ['youth', 'maiden', 'mentor', 'villain', 'elder'],
    subScenes: [
      { id: 'republic-1', name: '租界洋楼', description: '租界洋楼，梧桐街', colorTemp: 4200, lightDir: 'side', intensity: 0.7, keywords: ['租界', '洋楼', '梧桐'], tags: ['租界', '洋楼'] },
      { id: 'republic-2', name: '黄包车雨夜', description: '雨夜长街，黄包车', colorTemp: 3500, lightDir: 'street', intensity: 0.55, keywords: ['雨夜', '黄包车'], tags: ['雨夜', '长街'] },
      { id: 'republic-3', name: '茶馆戏台', description: '老茶馆，戏台', colorTemp: 3800, lightDir: 'top', intensity: 0.6, keywords: ['茶馆', '戏台'], tags: ['茶馆', '戏台'] },
      { id: 'republic-4', name: '火车站', description: '民国火车站，老式月台', colorTemp: 4000, lightDir: 'top', intensity: 0.7, keywords: ['火车站', '月台'], tags: ['车站', '月台'] },
      { id: 'republic-5', name: '旗袍裁缝铺', description: '旗袍裁缝铺，绸缎', colorTemp: 3700, lightDir: 'window', intensity: 0.65, keywords: ['旗袍', '裁缝铺'], tags: ['旗袍', '裁缝'] },
    ],
    keywords: ['民国', '旗袍', '黄包车', '租界', '长街', '茶馆', '戏台', '老上海', '旧时光'],
    themeAdapters: {
      'minimal-light': { color: 'amber', accent: 'crimson', promptHint: '怀旧素描' },
      'dark-workshop': { color: 'amber', accent: 'crimson', promptHint: '沉郁民国' },
      'creator-orange': { color: 'amber', accent: 'crimson', promptHint: '暖橙民国' },
      'neon-cyber': { color: 'amber', accent: 'magenta', promptHint: '赛博民国' },
      'national-ink': { color: 'ink', accent: 'crimson', promptHint: '水墨民国' },
    },
  },

  // ----- 7. 末日 -----
  {
    id: 'apocalypse',
    label: '末日',
    code: 'apocalypse',
    color: 'gray',
    colorAccent: 'red',
    icon: '☠️',
    tagline: '废墟/毒雾/幸存营地，绝境',
    description:
      '末日世界（与废土区分：废土偏沙暴干燥，末日偏毒雾潮湿/核冬）。' +
      '色温偏冷灰（3500-5000K），光向常为阴天漫射，毒雾/辐射云常出现。',
    defaultColorTemp: 4200,
    defaultLightDir: 'overcast',
    defaultIntensity: 0.5,
    styleId: 'apocalypse',
    compatibleArchetypes: ['youth', 'maiden', 'villain', 'mentor', 'child'],
    subScenes: [
      { id: 'apocalypse-1', name: '毒雾废墟', description: '毒雾笼罩废弃城市', colorTemp: 4000, lightDir: 'overcast', intensity: 0.4, keywords: ['毒雾', '废墟', '阴天'], tags: ['毒雾', '废墟'] },
      { id: 'apocalypse-2', name: '幸存营地', description: '铁皮幸存营地，篝火', colorTemp: 2800, lightDir: 'fire', intensity: 0.55, keywords: ['营地', '篝火', '幸存者'], tags: ['营地', '篝火'] },
      { id: 'apocalypse-3', name: '变异丛林', description: '变异植物丛，荧光菌', colorTemp: 5000, lightDir: 'top', intensity: 0.5, keywords: ['变异', '丛林', '荧光'], tags: ['丛林', '变异'] },
      { id: 'apocalypse-4', name: '核冬公路', description: '核冬覆盖的废弃公路', colorTemp: 5500, lightDir: 'overcast', intensity: 0.55, keywords: ['核冬', '公路'], tags: ['公路', '核冬'] },
      { id: 'apocalypse-5', name: '地下避难所', description: '地下避难所，柴油灯', colorTemp: 2800, lightDir: 'spot', intensity: 0.5, keywords: ['避难所', '地下'], tags: ['避难所', '地下'] },
    ],
    keywords: ['末日', '毒雾', '核冬', '废墟', '幸存者', '变异', '避难所', '绝境'],
    themeAdapters: {
      'minimal-light': { color: 'gray', accent: 'red', promptHint: '灰冷末日' },
      'dark-workshop': { color: 'gray', accent: 'red', promptHint: '深灰末日' },
      'creator-orange': { color: 'crimson', accent: 'amber', promptHint: '血色末日' },
      'neon-cyber': { color: 'cyan', accent: 'magenta', promptHint: '霓虹末日' },
      'national-ink': { color: 'ink', accent: 'crimson', promptHint: '水墨末日' },
    },
  },

  // ----- 8. 校园日常 -----
  {
    id: 'school-life',
    label: '校园日常',
    code: 'school-life',
    color: 'pink',
    colorAccent: 'rose',
    icon: '🎒',
    tagline: '走廊/天台/食堂，青春碎片',
    description:
      '校园日常生活场景（区别于现代校园的"建筑设施"，更偏"具体情节空间"）。' +
      '色温偏中（4500-5500K），光向以自然光为主，注重生活气息。',
    defaultColorTemp: 5000,
    defaultLightDir: 'window',
    defaultIntensity: 0.8,
    styleId: 'school-life',
    compatibleArchetypes: ['youth', 'maiden', 'child'],
    subScenes: [
      { id: 'school-life-1', name: '课间走廊', description: '课间走廊，学生喧闹', colorTemp: 5200, lightDir: 'window', intensity: 0.85, keywords: ['课间', '走廊'], tags: ['走廊', '日常'] },
      { id: 'school-life-2', name: '食堂', description: '学校食堂，喧闹排队', colorTemp: 4800, lightDir: 'top', intensity: 0.8, keywords: ['食堂', '排队'], tags: ['食堂', '日常'] },
      { id: 'school-life-3', name: '放学回家路', description: '放学回家路，夕阳', colorTemp: 4500, lightDir: 'side-low', intensity: 0.8, keywords: ['放学', '回家路'], tags: ['回家', '黄昏'] },
      { id: 'school-life-4', name: '宿舍夜谈', description: '学生宿舍，夜谈', colorTemp: 3200, lightDir: 'lamp', intensity: 0.6, keywords: ['宿舍', '夜谈'], tags: ['宿舍', '夜晚'] },
      { id: 'school-life-5', name: '校园祭', description: '校园祭，摊位灯光', colorTemp: 3500, lightDir: 'spot', intensity: 0.75, keywords: ['校园祭', '摊位'], tags: ['校园祭', '节日'] },
    ],
    keywords: ['校园', '日常', '走廊', '食堂', '宿舍', '放学', '回家', '校园祭', '青春碎片'],
    themeAdapters: {
      'minimal-light': { color: 'pink', accent: 'rose', promptHint: '清甜日常' },
      'dark-workshop': { color: 'pink', accent: 'rose', promptHint: '深粉日常' },
      'creator-orange': { color: 'rose', accent: 'amber', promptHint: '暖粉日常' },
      'neon-cyber': { color: 'magenta', accent: 'cyan', promptHint: '霓虹校园' },
      'national-ink': { color: 'rose', accent: 'ink', promptHint: '水墨日常' },
    },
  },

  // ----- 9. 赛博朋克 -----
  {
    id: 'cyberpunk',
    label: '赛博朋克',
    code: 'cyberpunk',
    color: 'magenta',
    colorAccent: 'cyan',
    icon: '🌃',
    tagline: '高楼雨夜/全息广告/改造人',
    description:
      '赛博朋克世界（与科幻都市区分：科幻都市偏未来乐观，赛博朋克偏反乌托邦）。' +
      '色温偏冷（5000-7000K），光向以霓虹和侧光为主，雨夜常出现，改造人/义体元素显著。',
    defaultColorTemp: 6000,
    defaultLightDir: 'neon',
    defaultIntensity: 0.6,
    styleId: 'cyberpunk',
    compatibleArchetypes: ['youth', 'maiden', 'villain', 'mentor'],
    subScenes: [
      { id: 'cyberpunk-1', name: '雨夜霓虹街', description: '雨夜霓虹主街，改造人', colorTemp: 6500, lightDir: 'neon', intensity: 0.6, keywords: ['雨夜', '霓虹', '改造人'], tags: ['雨夜', '霓虹'] },
      { id: 'cyberpunk-2', name: '义体诊所', description: '地下义体诊所，手术台', colorTemp: 4500, lightDir: 'spot', intensity: 0.55, keywords: ['义体', '诊所'], tags: ['义体', '诊所'] },
      { id: 'cyberpunk-3', name: '企业大厦', description: '巨型企业大厦，全息', colorTemp: 7000, lightDir: 'top', intensity: 0.75, keywords: ['企业', '大厦', '全息'], tags: ['企业', '高楼'] },
      { id: 'cyberpunk-4', name: '黑市夜市', description: '黑市夜市，武器交易', colorTemp: 3500, lightDir: 'side', intensity: 0.5, keywords: ['黑市', '夜市'], tags: ['黑市', '夜市'] },
      { id: 'cyberpunk-5', name: '天空城', description: '低空天空城，贫民窟', colorTemp: 5000, lightDir: 'top', intensity: 0.6, keywords: ['天空城', '贫民窟'], tags: ['天空城', '贫民'] },
    ],
    keywords: ['赛博朋克', '雨夜', '霓虹', '改造人', '义体', '企业', '黑市', '反乌托邦', '高楼'],
    themeAdapters: {
      'minimal-light': { color: 'magenta', accent: 'cyan', promptHint: '清冷赛博' },
      'dark-workshop': { color: 'magenta', accent: 'cyan', promptHint: '深暗赛博' },
      'creator-orange': { color: 'magenta', accent: 'orange', promptHint: '暖霓虹' },
      'neon-cyber': { color: 'magenta', accent: 'cyan', promptHint: '纯正赛博' },
      'national-ink': { color: 'magenta', accent: 'ink', promptHint: '水墨赛博' },
    },
  },

  // ----- 10. 海洋 -----
  {
    id: 'ocean',
    label: '海洋',
    code: 'ocean',
    color: 'sky',
    colorAccent: 'cyan',
    icon: '🌊',
    tagline: '海面/深海/珊瑚礁，深蓝之境',
    description:
      '海洋世界。海面、深海、珊瑚礁、海底遗迹。' +
      '色温偏冷（5500-7500K），光向以海面折射光和生物荧光为主。',
    defaultColorTemp: 6500,
    defaultLightDir: 'above-water',
    defaultIntensity: 0.75,
    styleId: 'ocean',
    compatibleArchetypes: ['youth', 'maiden', 'mentor', 'child', 'villain'],
    subScenes: [
      { id: 'ocean-1', name: '海面', description: '阳光海面，浪花', colorTemp: 6500, lightDir: 'top', intensity: 0.95, keywords: ['海面', '阳光', '浪花'], tags: ['海面', '阳光'] },
      { id: 'ocean-2', name: '深海', description: '深海黑暗，生物荧光', colorTemp: 5500, lightDir: 'bio', intensity: 0.4, keywords: ['深海', '荧光', '生物'], tags: ['深海', '荧光'] },
      { id: 'ocean-3', name: '珊瑚礁', description: '浅海珊瑚礁，鱼群', colorTemp: 7000, lightDir: 'refraction', intensity: 0.8, keywords: ['珊瑚礁', '鱼群'], tags: ['珊瑚', '浅海'] },
      { id: 'ocean-4', name: '海底遗迹', description: '沉没古城，神秘', colorTemp: 6000, lightDir: 'spot', intensity: 0.55, keywords: ['遗迹', '沉没', '古城'], tags: ['遗迹', '神秘'] },
      { id: 'ocean-5', name: '风暴海', description: '风暴海面，巨浪', colorTemp: 5000, lightDir: 'storm', intensity: 0.5, keywords: ['风暴', '巨浪'], tags: ['风暴', '巨浪'] },
    ],
    keywords: ['海洋', '海面', '深海', '珊瑚礁', '海底', '遗迹', '风暴', '浪花'],
    themeAdapters: {
      'minimal-light': { color: 'sky', accent: 'cyan', promptHint: '清亮海面' },
      'dark-workshop': { color: 'sky', accent: 'cyan', promptHint: '深蓝海洋' },
      'creator-orange': { color: 'sky', accent: 'amber', promptHint: '夕阳海面' },
      'neon-cyber': { color: 'cyan', accent: 'magenta', promptHint: '霓虹海' },
      'national-ink': { color: 'sky', accent: 'ink', promptHint: '水墨海' },
    },
  },

  // ----- 11. 雪山 -----
  {
    id: 'snow-mountain',
    label: '雪山',
    code: 'snow-mountain',
    color: 'sky',
    colorAccent: 'white',
    icon: '🏔️',
    tagline: '冰原/雪松/极光，白色秘境',
    description:
      '雪山与冰原世界。雪山、雪松、极光、冰洞。' +
      '色温偏冷（6000-8000K），光向以雪面反射和极光为主。',
    defaultColorTemp: 7000,
    defaultLightDir: 'reflect',
    defaultIntensity: 0.85,
    styleId: 'snow',
    compatibleArchetypes: ['youth', 'mentor', 'elder', 'child'],
    subScenes: [
      { id: 'snow-1', name: '雪峰', description: '雪峰之巅，蓝天', colorTemp: 7500, lightDir: 'top', intensity: 1.0, keywords: ['雪峰', '蓝天'], tags: ['雪峰', '高峰'] },
      { id: 'snow-2', name: '雪松林', description: '雪松林，雾凇', colorTemp: 6500, lightDir: 'side', intensity: 0.85, keywords: ['雪松', '雾凇'], tags: ['雪松', '林海'] },
      { id: 'snow-3', name: '极光', description: '极光夜空，冰雪', colorTemp: 6500, lightDir: 'aurora', intensity: 0.6, keywords: ['极光', '夜空'], tags: ['极光', '夜空'] },
      { id: 'snow-4', name: '冰洞', description: '冰川冰洞，蓝色', colorTemp: 7000, lightDir: 'refraction', intensity: 0.7, keywords: ['冰洞', '冰川'], tags: ['冰洞', '冰川'] },
      { id: 'snow-5', name: '雪原村落', description: '雪原村落，炊烟', colorTemp: 5000, lightDir: 'window', intensity: 0.6, keywords: ['雪原', '村落', '炊烟'], tags: ['雪原', '村落'] },
    ],
    keywords: ['雪山', '雪峰', '雪松', '极光', '冰洞', '雪原', '冰川', '雾凇'],
    themeAdapters: {
      'minimal-light': { color: 'sky', accent: 'white', promptHint: '清冷雪原' },
      'dark-workshop': { color: 'sky', accent: 'cyan', promptHint: '深夜雪' },
      'creator-orange': { color: 'sky', accent: 'amber', promptHint: '雪中暖光' },
      'neon-cyber': { color: 'cyan', accent: 'magenta', promptHint: '霓虹雪山' },
      'national-ink': { color: 'sky', accent: 'ink', promptHint: '水墨雪山' },
    },
  },

  // ----- 12. 森林 -----
  {
    id: 'forest',
    label: '森林',
    code: 'forest',
    color: 'green',
    colorAccent: 'emerald',
    icon: '🌲',
    tagline: '密林/晨雾/林间小屋',
    description:
      '森林世界。密林、晨雾、林间小屋、林间小径。' +
      '色温偏中（4500-5500K），光向以林间斑驳光为主。',
    defaultColorTemp: 5000,
    defaultLightDir: 'dappled',
    defaultIntensity: 0.7,
    styleId: 'forest',
    compatibleArchetypes: ['youth', 'maiden', 'child', 'mentor', 'elder', 'villain'],
    subScenes: [
      { id: 'forest-1', name: '密林', description: '密林深处，斑驳光', colorTemp: 5000, lightDir: 'dappled', intensity: 0.7, keywords: ['密林', '斑驳光'], tags: ['密林', '深处'] },
      { id: 'forest-2', name: '晨雾森林', description: '晨雾森林，薄雾', colorTemp: 5500, lightDir: 'side', intensity: 0.75, keywords: ['晨雾', '薄雾'], tags: ['晨雾', '清早'] },
      { id: 'forest-3', name: '林间小屋', description: '林间小屋，炊烟', colorTemp: 4500, lightDir: 'window', intensity: 0.7, keywords: ['林间', '小屋', '炊烟'], tags: ['小屋', '林间'] },
      { id: 'forest-4', name: '林间小径', description: '林间小径，秋叶', colorTemp: 5000, lightDir: 'top', intensity: 0.85, keywords: ['小径', '秋叶'], tags: ['小径', '秋'] },
      { id: 'forest-5', name: '古老树根', description: '古老巨树，蘑菇', colorTemp: 4800, lightDir: 'spot', intensity: 0.6, keywords: ['古树', '蘑菇'], tags: ['古树', '蘑菇'] },
    ],
    keywords: ['森林', '密林', '晨雾', '林间', '小屋', '小径', '古树', '林海'],
    themeAdapters: {
      'minimal-light': { color: 'green', accent: 'emerald', promptHint: '清绿森林' },
      'dark-workshop': { color: 'green', accent: 'emerald', promptHint: '深绿森林' },
      'creator-orange': { color: 'emerald', accent: 'amber', promptHint: '暖阳森林' },
      'neon-cyber': { color: 'emerald', accent: 'cyan', promptHint: '霓虹森林' },
      'national-ink': { color: 'ink', accent: 'emerald', promptHint: '水墨森林' },
    },
  },
]

/** 按 template ID 查找 */
export function getSceneTemplateMeta(id: SceneTemplate): SceneTemplateMeta {
  const m = SCENE_TEMPLATES_V2.find(s => s.id === id)
  if (!m) throw new Error(`[scene-templates-v2] unknown template: ${id}`)
  return m
}

/** 列出所有 template ID */
export function listSceneTemplateIds(): SceneTemplate[] {
  return SCENE_TEMPLATES_V2.map(s => s.id)
}

/** 列出某模板下的所有子场景 */
export function listSubScenes(id: SceneTemplate): SceneSubScene[] {
  return getSceneTemplateMeta(id).subScenes
}

/** 按主题 ID 获取场景配色变体 */
export function getSceneTemplateThemeVariant(
  id: SceneTemplate,
  themeId: ThemeId,
): { color?: string; accent?: string; promptHint?: string } | null {
  return getSceneTemplateMeta(id).themeAdapters[themeId] ?? null
}

/**
 * 构造场景模板的初始一致性向量（1024 维）。
 * 同样使用确定性 hash（调试/测试用），生产应替换为 all-MiniLM-L6-v2 embedding。
 */
export function buildSceneTemplateVector(
  id: SceneTemplate,
  options?: { seed?: number; extraText?: string },
): SceneVector {
  const m = getSceneTemplateMeta(id)
  const seedBase = options?.seed ?? hashStr(id)
  const text = `${id} ${m.label} ${m.keywords.join(' ')} ${options?.extraText ?? ''}`.trim()
  return deterministicVector(text, 1024, seedBase)
}

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function deterministicVector(text: string, dim: number, seed: number): number[] {
  const v: number[] = new Array(dim)
  let s = seed >>> 0
  for (let i = 0; i < dim; i++) {
    s = (s * 1103515245 + 12345 + i + text.charCodeAt(i % text.length)) >>> 0
    const r = (s % 20001) / 10000 - 1
    v[i] = Math.round(r * 1e4) / 1e4
  }
  return normalize(v)
}

function normalize(v: number[]): number[] {
  let s = 0
  for (const x of v) s += x * x
  const norm = Math.sqrt(s) || 1
  return v.map(x => Math.round((x / norm) * 1e4) / 1e4)
}

/** 预生成 12 模板的向量（启动时构造） */
export const SCENE_TEMPLATE_VECTORS: Record<SceneTemplate, SceneVector> = Object.fromEntries(
  SCENE_TEMPLATES_V2.map(s => [s.id, buildSceneTemplateVector(s.id)]),
) as Record<SceneTemplate, SceneVector>
