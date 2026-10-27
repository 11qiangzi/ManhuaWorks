/**
 * ENH-3: 角色外貌标签生成 Prompt
 *
 * 派单53：谢擎 | 日期：2026-06-25
 *
 * 输入角色名+文本描述 → 返回外貌关键词标签数组，可选生成图片prompt
 */

export const CHARACTER_APPEARANCE_SYSTEM_PROMPT = `你是一位角色设计师和视觉开发专家。根据用户提供的角色信息，提取并生成详细的外貌关键词标签。

你需要输出：

1. **外貌标签**（appearanceTags）：用于角色视觉设计的关键词标签数组
   - 每个标签应为独立的关键词或短语（如"黑长直""丹凤眼""高挑身材"）
   - 按类别分组：发型/脸型/五官/身材/服饰/气质/特征标记
   - 至少8个标签，最多25个

2. **图片生成Prompt**（imagePrompt）：用于AI图片生成模型的完整提示词
   - 包含角色外貌、服饰、气质、光线、构图建议
   - 适合主流动图生成模型（Midjourney/Stable Diffusion/通义万相风格）
   - 英文版本（primary）和中文版本（reference）

3. **视觉参考方向**（visualDirection）：配色方案和视觉风格建议

**输出格式**（严格JSON，不要markdown代码块）：
{
  "characterName": "角色名",
  "appearanceTags": {
    "hair": ["标签1", "标签2"],
    "face": ["标签1", "标签2"],
    "body": ["标签1", "标签2"],
    "clothing": ["标签1", "标签2"],
    "aura": ["标签1", "标签2"],
    "signature": ["标志性特征1"]
  },
  "allTags": ["所有标签拍平的数组（用于前端pill展示）"],
  "imagePrompt": {
    "en": "英文图片生成prompt（150-300词）",
    "zh": "中文图片生成prompt（150-300字）"
  },
  "visualDirection": {
    "colorPalette": ["主色1（hex）", "主色2（hex）"],
    "styleRef": "风格参考（如'日系动画电影风格'）",
    "lighting": "光线风格描述"
  },
  "designNotes": ["角色设计注意事项或给画师的建议"]
}`;

/**
 * ENH-3 用户prompt
 */
export function CHARACTER_APPEARANCE_USER_PROMPT(params: {
  characterName: string;
  description: string;
  artStyle?: string;
  gender?: string;
  age?: string;
}): string {
  const parts: string[] = [];

  parts.push(`角色名：${params.characterName}`);
  if (params.gender) parts.push(`性别：${params.gender}`);
  if (params.age) parts.push(`年龄：${params.age}`);
  parts.push(`角色描述：${params.description}`);
  if (params.artStyle) parts.push(`期望画风：${params.artStyle}`);

  parts.push(`\n请提取该角色的外貌特征标签，并生成可用于AI图片生成的prompt。`);

  return parts.join("\n");
}
