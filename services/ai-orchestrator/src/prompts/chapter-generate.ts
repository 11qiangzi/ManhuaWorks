/**
 * API-4: 逐章生成 Prompt
 *
 * 输入：大纲 + 世界观 + 角色 + 当前章节号
 * 输出：单章正文（≥2000字）
 * 支持：继续下一章 / 修改本章 / 重新生成
 *
 * 用途：用户确认大纲后逐步生成章节，
 * 替代现网"一次性黑盒生成"模式。
 */

export const CHAPTER_GENERATE_SYSTEM_PROMPT = `你是一个专业的小说写手。根据给定的大纲、世界观设定、角色信息，生成指定章节的小说正文。

## 写作要求
1. **字数**：严格≥2000字，不超过5000字
2. **衔接**：如果有上一章摘要，开头必须无缝接续
3. **结构**：
   - 开篇：承接上一章（或若第1章则直接入戏），500字内建立场景
   - 中段：推进剧情，塑造角色，展开冲突
   - 结尾：留悬念或余韵钩子（必须让读者想翻页）
4. **文风**：根据故事类型调整——
   - 都市/现实：简洁有力，对话生活化
   - 仙侠/武侠：有古韵但不过度堆砌
   - 科幻：逻辑自洽，科幻设定自然融入
   - 悬疑：信息有控制地释放，留白
   - 甜宠：对话甜而不腻，情感线清晰
5. **零AI味**：避免"他意识到""他感到""在这一刻"等套路句式，用动作和对话推进剧情
6. **角色一致性**：严格遵循提供的角色设定，不OOC（角色性格跑偏）

## 输出格式（严格JSON）
{
  "chapterNumber": 章节号,
  "title": "本章标题",
  "content": "本章正文（≥2000字）",
  "wordCount": 字数,
  "hook": "章末钩子（用于吸引继续阅读的一句话）",
  "nextChapterPreview": "下一章预告（30字以内）"
}`;

export const CHAPTER_GENERATE_USER_PROMPT = (params: {
  chapterNumber: number;
  chapterTitle?: string;
  outline: string;
  worldview: string;
  characters: string;
  previousChapterSummary?: string;
  storyType?: string;
  styleNote?: string;
}) => {
  const parts: string[] = [];

  parts.push(`## 当前章节：第${params.chapterNumber}章${params.chapterTitle ? ` - ${params.chapterTitle}` : ""}`);
  parts.push("");

  if (params.previousChapterSummary) {
    parts.push(`## 上一章摘要`);
    parts.push(params.previousChapterSummary);
    parts.push("");
  }

  parts.push(`## 故事大纲`);
  parts.push(params.outline);
  parts.push("");

  parts.push(`## 世界观设定`);
  parts.push(params.worldview);
  parts.push("");

  parts.push(`## 角色信息`);
  parts.push(params.characters);
  parts.push("");

  if (params.storyType) {
    parts.push(`## 风格要求`);
    parts.push(`故事类型：${params.storyType}`);
    if (params.styleNote) parts.push(`额外风格说明：${params.styleNote}`);
    parts.push("");
  }

  parts.push("请生成第" + params.chapterNumber + "章正文。");

  return parts.join("\n");
};

/** 修改本章的Prompt */
export const CHAPTER_REVISE_USER_PROMPT = (originalContent: string, revisionNote: string) =>
  `请修改以下章节，严格按照修改建议进行调整：

## 原章节内容
${originalContent}

## 修改建议
${revisionNote}

要求：
1. 保持原章节的字数和核心剧情不动，仅按修改建议调整
2. 如果修改建议涉及情节改动，需要确保前后逻辑通畅
3. 保留原文中不需要修改的部分`;

/** 重新生成本章的Prompt */
export const CHAPTER_REGENERATE_USER_PROMPT = (params: {
  chapterNumber: number;
  outline: string;
  worldview: string;
  characters: string;
  previousChapterSummary?: string;
  storyType?: string;
  avoidPattern: string;
}) => {
  const parts: string[] = [
    `请重新生成第${params.chapterNumber}章，避免以下写法：${params.avoidPattern}`,
    "",
    `## 故事大纲`,
    params.outline,
    "",
    `## 世界观设定`,
    params.worldview,
    "",
    `## 角色信息`,
    params.characters,
  ];
  if (params.previousChapterSummary) {
    parts.push("", `## 上一章摘要`, params.previousChapterSummary);
  }
  if (params.storyType) {
    parts.push("", `## 风格要求`, `故事类型：${params.storyType}`);
  }
  parts.push("", "请用全新的角度和文笔重写本章，确保与上一版本的写法有显著差异。");
  return parts.join("\n");
};
