/**
 * API-2: 故事模板扩展 Prompt
 *
 * 从原有3个模板扩展至8+种，每种含子类型标签。
 * 输入：模板ID + 可选用户输入
 * 输出：基于模板风格的大纲框架
 *
 * 用途：方向型用户选择模板后获得定制大纲起点。
 */

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  subTags: string[];
  icon: string;
}

/** 8大故事模板定义 */
export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "sweet_romance",
    name: "甜宠爱情",
    description: "都市或古代背景的甜蜜恋爱故事",
    subTags: ["霸总甜宠","先婚后爱","校园初恋","青梅竹马","契约恋爱","年下姐弟"],
    icon: "💕",
  },
  {
    id: "urban_fantasy",
    name: "都市奇幻",
    description: "现代背景下的超自然力量",
    subTags: ["异能觉醒","系统流","诡异复苏","规则怪谈","灵气复苏","都市修仙"],
    icon: "🌃",
  },
  {
    id: "mystery_suspense",
    name: "悬疑推理",
    description: "推理探案与悬疑解谜",
    subTags: ["本格推理","社会派","心理悬疑","犯罪心理","法医刑侦","密室逃脱"],
    icon: "🔍",
  },
  {
    id: "wuxia_xianxia",
    name: "古风仙侠",
    description: "传统武侠与修仙玄幻",
    subTags: ["古典武侠","修仙证道","洪荒神话","剑道争锋","宗门恩怨","凡人修仙"],
    icon: "⚔️",
  },
  {
    id: "scifi_apocalypse",
    name: "科幻末世",
    description: "未来科技与末日生存",
    subTags: ["星际殖民","AI觉醒","废土求生","赛博朋克","基因改造","外星入侵"],
    icon: "🚀",
  },
  {
    id: "historical_alt",
    name: "历史架空",
    description: "历史背景下的架空叙事",
    subTags: ["朝代架空","穿越改造","宫斗权谋","乱世争霸","谍战风云","古代经营"],
    icon: "🏯",
  },
  {
    id: "gaming_esports",
    name: "游戏电竞",
    description: "游戏世界与电子竞技",
    subTags: ["全息游戏","电竞逆袭","游戏异界","副本攻略","职业战队","虚拟现实"],
    icon: "🎮",
  },
  {
    id: "realistic_drama",
    name: "现实题材",
    description: "贴近现实的当代故事",
    subTags: ["职场奋斗","家庭温情","乡村振兴","医疗行业","法律正义","教育成长"],
    icon: "📖",
  },
];

/**
 * 模板风格Prompt生成
 *
 * 输入：模板ID + 可选用户描述（100-500字）
 * 输出：定制大纲框架（章节概要 + 核心冲突 + 角色建议）
 */
export const STORY_TEMPLATE_SYSTEM_PROMPT = `你是一个专业的小说大纲策划师。根据用户选择的故事模板风格和可选描述，生成一个完整的故事大纲框架。

## 模板风格说明
${STORY_TEMPLATES.map((t) => `- **${t.name}**（${t.id}）：${t.description}，子类型包括：${t.subTags.join("、")}`).join("\n")}

## 输出格式（严格JSON）
{
  "templateId": "模板ID",
  "templateName": "模板名称",
  "title": "建议故事标题",
  "synopsis": "故事梗概（200-300字）",
  "coreConflict": "核心冲突（50字以内）",
  "genreTags": ["类型标签1","类型标签2"],
  "targetAudience": "目标读者群体",
  "chapters": [
    { "number": 1, "title": "章节标题", "summary": "本章概要（30字以内）", "keyEvent": "关键事件" }
  ],
  "characters": [
    { "name": "主角名", "role": "主角", "archetype": "角色原型", "motivation": "核心动机", "arc": "角色弧光" }
  ],
  "worldviewHints": {
    "era": "时代背景",
    "setting": "核心场景",
    "uniqueRule": "独特的世界规则（如修炼体系/科技设定/社会制度）"
  },
  "hook": "开篇钩子（吸引读者的第一句话或场景）"
}`;

export const STORY_TEMPLATE_USER_PROMPT = (templateId: string, templateName: string, userInput?: string) =>
  `请为【${templateName}】风格生成一个完整的故事大纲框架。
${userInput ? `用户补充描述：${userInput}` : "请自由发挥，生成一个典型的该风格故事大纲。"}
要求：梗概要有感染力，章节概要简洁有力，核心冲突新颖不自洽，角色有记忆点。`;
