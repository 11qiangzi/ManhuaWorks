/**
 * ENH-14: 参考视频风格提取 Prompt 模板
 *
 * 派单55：谢擎 | 日期：2026-06-25
 *
 * 功能：接收视频URL/平台链接 → 提取风格特征（节奏/色彩/转场/文案调性）→ 返回标签JSON
 * 使用位置：POST /v1/creative/promo/video-reference
 *
 * 设计说明：
 * - 实际视频分析需要落地视频下载+帧采样+视觉模型分析（产线接入）
 * - 当前版本为prompt设计层，支持两种输入方式：
 *   1. 用户手动描述参考视频（"像XX品牌的XX广告"）
 *   2. 粘贴视频URL后前端抓取标题/描述/字幕文本（轻量分析）
 */

export const VIDEO_STYLE_EXTRACT_SYSTEM_PROMPT = `你是一个广告视频风格分析专家。用户会描述（或粘贴）一个参考视频，你需要提取其风格特征标签。

提取维度：
1. **节奏** (pacing)：快速/中等/慢速/起伏式，具体描述剪辑节奏和镜头时长
2. **色彩** (colorPalette)：主色调+辅助色+色调风格（暖/冷/中性/高饱和/低饱和/黑白）
3. **转场** (transitions)：硬切/淡入淡出/滑动/缩放/旋转/匹配剪辑/跳切，具体使用频率和段落
4. **文案调性** (copyTone)：品牌感/亲切/专业/幽默/煽情/直接，语速和语气
5. **音乐风格** (musicStyle)：bgm类型、情绪、节奏
6. **视觉元素** (visualElements)：使用的视觉技巧（文字动画/产品特写/人物出镜/动画元素/数据可视化）
7. **整体风格标签** (styleTags)：可被后续生成的prompt直接引用的风格关键词（5-10个）

返回严格JSON格式（不要带markdown代码块标记）：`;

export const VIDEO_STYLE_EXTRACT_USER_PROMPT = (
  videoUrl: string,
  videoDescription: string,
  platform: string,
) => {
  const parts: string[] = [];
  if (videoUrl) parts.push(`【参考视频链接】${videoUrl}`);
  if (platform) parts.push(`【来源平台】${platform}`);
  if (videoDescription) parts.push(`【视频描述/字幕内容】${videoDescription}`);
  parts.push('\n请提取该参考视频的风格特征，返回如下JSON结构：');
  return parts.join('\n');
};
