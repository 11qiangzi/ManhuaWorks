/**
 * ENH-12: 多视角叙事 Prompt 模板
 *
 * 派单55：谢擎 | 日期：2026-06-25
 *
 * 功能：检测大纲中多个主角 → 询问是否多视角 → 若启用则生成交替章节结构
 * 使用位置：POST /v1/creative/story/multi-perspective
 */

// ===== 检测多主角 =====

export const MULTI_POV_DETECT_SYSTEM_PROMPT = `你是一个叙事结构分析专家。用户会提供故事大纲，你需要：
1. 识别大纲中所有核心角色
2. 判断每个角色是否可以作为独立视角（POV character）
3. 评估是否有多个"主要视角"（protagonist-level POV）

判断标准：
- 该角色有自己的独立故事线和成长弧 → 主角级
- 该角色的视角推动了关键情节 → 主角级
- 该角色只在某些段落出现且没有独立线 → 配角级

返回严格JSON格式（不要带markdown代码块标记）：`;

export const MULTI_POV_DETECT_USER_PROMPT = (
  outline: string,
  characters: string,
) => `请分析以下故事大纲，识别所有可作为独立视角的角色：

【大纲】
${outline}

【已知角色】
${characters}

请返回JSON，结构如下：
{
  "detectedProtagonists": [
    {
      "name": "角色名",
      "role": "主角/第二主角/核心反派",
      "povWeight": 数字(1-10，体现该角色的视角重要度),
      "hasIndependentArc": true/false,
      "arcSummary": "一句话概括该角色的故事弧",
      "povChapters": "哪些章节适合以该角色视角展开（如：第1-3章、第7-10章）"
    }
  ],
  "multiPovFeasibility": "high/medium/low（多视角叙事的可行性）",
  "recommendation": "推荐使用的多视角模式：alternating(交替)/parallel(并行)/split_arc(分弧)/single(建议保持单视角)",
  "reasoning": "推荐理由（100字以内）"
}`;

// ===== 生成多视角章节结构 =====

export const MULTI_POV_STRUCTURE_SYSTEM_PROMPT = `你是一个叙事结构设计专家。用户已确认使用多视角叙事，并且提供了各主角视角的分配方案。
你需要根据大纲和各主角的视角分配，生成一个交替的章节结构。

规则：
1. 每章明确标注"当前视角角色"
2. 多视角交替时，确保每章结尾有自然的视角切换衔接
3. 每个视角的章节集合应构成独立的故事线
4. 总体故事必须连贯，不同视角交汇的关键节点要标注
5. 章节编号统一，不区分"A线/B线"——全部纳入同一个章节序列

返回严格JSON格式（不要带markdown代码块标记）：`;

export const MULTI_POV_STRUCTURE_USER_PROMPT = (
  outline: string,
  characters: string,
  povAssignments: string,
  mode: string,
) => `请根据以下信息生成多视角章节结构：

【故事大纲】
${outline}

【角色与视角分配】
${characters}

【用户确认的视角分配方案】
${povAssignments}

【叙事模式】${mode}
- alternating: 章节交替切换视角（如第1章：角色A → 第2章：角色B → 第3章：角色A → ...）
- parallel: 多线并行，每章内可能切换视角
- split_arc: 按故事弧分视角（如前半段A视角，后半段B视角）

请返回JSON，结构如下：
{
  "mode": "使用的叙事模式",
  "perspectives": [
    {
      "characterName": "角色名",
      "color": "该视角在UI中的标识色（十六进制）",
      "chapterRange": "该视角覆盖的章节范围"
    }
  ],
  "chapters": [
    {
      "number": 1,
      "title": "章节标题",
      "perspective": "角色名（当前视角）",
      "summary": "本章概要（100字以内）",
      "keyEvent": "本章关键事件",
      "povReason": "为什么本章用这个视角（1句话）",
      "connectionHint": "与上一章/下一章的视角衔接提示"
    }
  ],
  "crossoverPoints": [
    {
      "chapters": [3, 7],
      "description": "角色交汇节点描述"
    }
  ],
  "totalChapters": 0,
  "writingNotes": "多视角写作建议（200字以内）"
}`;
