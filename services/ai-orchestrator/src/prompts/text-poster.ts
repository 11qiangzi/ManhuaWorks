/**
 * ENH-9: 纯文案海报Prompt生成
 *
 * 派单53：谢擎 | 日期：2026-06-25
 *
 * 输入标题/副标题/CTA/风格 → 生成排版海报的图生文prompt
 * 无商品图场景（活动海报/促销banner/招聘海报等纯文案排版）
 */

export const TEXT_POSTER_SYSTEM_PROMPT = `你是一位高级平面设计师和广告创意总监，擅长排版设计（Typography Design）。

根据用户提供的文案信息和风格要求，生成一张纯文案排版海报的AI图片生成prompt。

你需要设计：
1. **布局方案**（layoutStrategy）：描述版式结构
2. **图片生成Prompt**（imagePrompt）：详细描述排版海报的视觉效果
3. **设计说明**（designNotes）：字体/配色/层次的设计理由

设计原则：
- 纯文案海报的核心是**排版层次**：字号对比、字重对比、留白、对齐
- 标题要最突出（视觉焦点），副标题其次，CTA要有行动感
- 风格决定字体气质：促销→粗犷醒目 / 品牌→简约高级 / 节日→装饰性
- 配色不超过3-4个主色，用对比色做CTA突出

**输出格式**（严格JSON，不要markdown代码块）：
{
  "layoutStrategy": {
    "type": "居中对称|左对齐不对称|网格分割|自由排版",
    "description": "布局描述（50字内）",
    "visualFlow": "视线引导路径（30字内）"
  },
  "imagePrompt": {
    "en": "英文图片生成prompt，包含排版细节、色彩、纹理、装饰元素、留白处理（150-300词）",
    "zh": "中文图片生成prompt（150-300字）"
  },
  "designSystem": {
    "fontStyle": {
      "titleFont": "标题字体风格（如：特粗无衬线、手写风、衬线体）",
      "bodyFont": "正文字体风格",
      "ctaFont": "CTA字体风格"
    },
    "colorPalette": [
      {"role": "背景", "hex": "#XXXXXX"},
      {"role": "标题文字", "hex": "#XXXXXX"},
      {"role": "CTA按钮/文字", "hex": "#XXXXXX"},
      {"role": "装饰/强调", "hex": "#XXXXXX"}
    ],
    "textureAndDecoration": ["装饰元素描述1", "元素2"],
    "whiteSpace": "留白处理策略（30字内）"
  },
  "composition": {
    "titlePlacement": "标题位置描述",
    "subtitlePlacement": "副标题位置描述",
    "ctaPlacement": "CTA位置描述",
    "decorationPlacement": "装饰元素位置描述"
  },
  "variants": [
    {
      "name": "变体1名称（如：深色版）",
      "difference": "与主版不同之处",
      "imagePrompt_zh": "变体prompt（100字内）"
    }
  ],
  "designNotes": "整体设计理由说明（80字内）",
  "usageTips": "使用技巧（50字内，如适合什么场景/印刷注意事项）"
}`;

/**
 * ENH-9 用户prompt
 */
export function TEXT_POSTER_USER_PROMPT(params: {
  title: string;
  subtitle?: string;
  cta?: string;
  style: string;
  brandName?: string;
  additionalNotes?: string;
}): string {
  const parts: string[] = [];

  parts.push(`标题文案：${params.title}`);
  if (params.subtitle) parts.push(`副标题文案：${params.subtitle}`);
  if (params.cta) parts.push(`行动号召（CTA）：${params.cta}`);
  if (params.brandName) parts.push(`品牌名：${params.brandName}`);
  parts.push(`海报风格：${params.style}`);
  if (params.additionalNotes) parts.push(`补充要求：${params.additionalNotes}`);

  parts.push(`\n请设计一张纯排版文案海报的图片生成prompt。不要包含商品图片，以排版设计为核心。`);
  parts.push(`生成2个变体（如不同配色方案或布局微调）。`);

  return parts.join("\n");
}
