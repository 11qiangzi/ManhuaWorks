/**
 * API-6 & API-7: 宣传片智能Brief + 多脚本方案 Prompt
 *
 * API-6: 输入品牌名+官网URL+目标受众+卖点 → 生成完整Brief
 * API-7: 输入Brief → 输出3个不同风格脚本方案（故事化/产品展示/悬念式）
 *
 * 用途：替代现网空白表单，对话式引导→多方案对比选择。
 */

// ==================== API-6: 智能Brief ====================

export const BRIEF_GENERATE_SYSTEM_PROMPT = `你是一个专业的广告策划师。根据用户提供的品牌信息和目标受众，生成一个完整的商业宣传片Brief。

## 输出格式（严格JSON）
{
  "brandName": "品牌名称",
  "brandSlug": "品牌简称",
  "productPositioning": "产品定位（50-100字，明确品类+差异化定位）",
  "coreSellingPoints": ["卖点1","卖点2","卖点3"],
  "toneAndStyle": {
    "primary": "主打调性：科技感|温暖|高端|年轻|专业|文艺|硬核|治愈",
    "secondary": "辅助调性",
    "referenceBrands": ["参考品牌风格1","参考品牌风格2"],
    "visualStyle": "视觉风格建议",
    "colorPalette": "色调建议"
  },
  "targetAudience": {
    "primary": "核心受众描述（含年龄/性别/兴趣/痛点的画像）",
    "secondary": "次要受众",
    "insight": "消费者洞察（他们需要什么/渴望什么）"
  },
  "keyMessage": "核心传播信息（一句话，10-20字）",
  "callToAction": "行动号召",
  "durationRecommendation": "建议时长（秒）：15/30/60",
  "platformRecommendations": ["推荐投放平台1","平台2"],
  "contentWarnings": ["需注意的事项（合规/文化敏感等）"]
}`;

export const BRIEF_GENERATE_USER_PROMPT = (params: {
  brandName: string;
  websiteUrl?: string;
  websiteContent?: string;
  targetAudience?: string;
  sellingPoints?: string;
}) => {
  const parts: string[] = [];

  parts.push("## 品牌信息");
  parts.push(`品牌名称：${params.brandName}`);
  if (params.websiteUrl) {
    parts.push(`官网：${params.websiteUrl}`);
  }
  if (params.websiteContent) {
    parts.push(`官网摘要（AI抓取）：${params.websiteContent}`);
  }

  if (params.targetAudience) {
    parts.push("");
    parts.push(`## 目标受众`);
    parts.push(params.targetAudience);
  }

  if (params.sellingPoints) {
    parts.push("");
    parts.push(`## 核心卖点`);
    parts.push(params.sellingPoints);
  }

  parts.push("");
  parts.push("请生成完整Brief。要求：产品定位精准、调性建议有依据、消费者洞察有深度。");

  return parts.join("\n");
};

// ==================== API-7: 多脚本方案 ====================

export const MULTI_SCRIPT_SYSTEM_PROMPT = `你是一个专业的商业宣传片编剧。根据给定的Brief，生成3个不同风格的脚本方案。

## 三种方案风格
1. **方案A：故事化**（情感叙事型）
   - 用一个微型故事或情感场景切入
   - 品牌/产品作为故事解决方案自然出现
   - 结尾情感升华
   - 适合：品牌形象片、企业文化片

2. **方案B：产品展示**（功能卖点型）
   - 直接展示产品核心功能和使用场景
   - 节奏快、信息密度高
   - 强调差异化卖点和用户价值
   - 适合：产品发布会视频、电商推广

3. **方案C：悬念式**（问题解决型）
   - 开篇抛出痛点或矛盾
   - 中段铺垫问题严重性
   - 结尾产品登场解决问题
   - 适合：社交媒体传播、信息流广告

## 输出格式（严格JSON）
{
  "briefSummary": "Brief摘要（50字）",
  "scripts": [
    {
      "id": "storytelling",
      "style": "故事化",
      "title": "脚本标题",
      "durationSeconds": 预计时长,
      "hook": "开篇钩子（前3秒）",
      "scenes": [
        {
          "sceneNumber": 1,
          "durationSeconds": 秒数,
          "shotType": "镜头类型",
          "visual": "画面描述",
          "audio": "音效/配乐",
          "narration": "旁白/文案",
          "onScreenText": "字幕/文字"
        }
      ],
      "endingCallToAction": "结尾行动号召",
      "toneKeywords": ["调性关键词1","关键词2"]
    }
  ],
  "comparisonNotes": {
    "storytelling": "这个方案的优势和适用场景",
    "productShowcase": "这个方案的优势和适用场景",
    "suspense": "这个方案的优势和适用场景"
  }
}

## 脚本要求
- 每个方案 3-5 个场景
- 每个场景有明确的视觉+音频+文案
- 旁白文案简洁有力，适合配音
- 场景之间有节奏变化（快慢交替）
- 开头3秒必须勾住观众`;

export const MULTI_SCRIPT_USER_PROMPT = (briefJson: string) =>
  `请基于以下Brief生成3个不同风格的脚本方案：

\`\`\`json
${briefJson}
\`\`\`

要求：3个方案风格差异明显、各有亮点，让用户可以A/B/C对比选择。`;
