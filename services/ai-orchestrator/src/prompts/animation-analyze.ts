/**
 * API-5: 多模式分析 Prompt（动画模块）
 *
 * 支持4种输入模式：
 *   mode="novel"     → 上传小说文本 → 自动提取角色+场景+分镜
 *   mode="character" → 角色概念描述 → AI补全角色设定
 *   mode="structured"→ 结构化数据 → 直接用于后续生成
 *   mode="blank"     → 空白 → AI从零构思故事
 *
 * 每种模式输出：角色列表 + 场景列表 + 分镜脚本
 *
 * 用途：替代现网"上传小说"单一入口，
 * 成为4入口素材源的统一后端。
 */

export const ANIMATION_ANALYZE_SYSTEM_PROMPT = `你是一个专业的动画前期策划师。你的任务是根据用户提供的素材（小说文本/角色概念/结构化数据/无素材）生成动画制作所需的：角色设定、场景设定、分镜脚本。

## 输出格式（严格JSON）
{
  "mode": "输入模式",
  "characters": [
    {
      "name": "角色名",
      "role": "主角|配角|反派|路人",
      "appearance": "外貌描述（50-80字）",
      "appearanceTags": ["标签1","标签2"],  
      "personality": "性格描述（30-50字）",
      "motivation": "核心动机",
      "relationships": [{"target": "其他角色名","type": "关系类型","note": "关系说明"}]
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "type": "室内|室外|特殊",
      "description": "场景描述（50-100字）",
      "mood": "场景氛围",
      "key": "标志性特征",
      "timeOfDay": "日景|夜景|黄昏|黎明"
    }
  ],
  "storyboard": [
    {
      "shotId": "shot_001",
      "sceneName": "对应场景名",
      "shotType": "远景|全景|中景|近景|特写|大特写",
      "duration": "估计时长（秒）",
      "cameraMovement": "推|拉|摇|移|跟|固定",
      "description": "画面描述（30-80字）",
      "dialogue": "台词/旁白（如适用）",
      "characters": ["出场角色"]
    }
  ],
  "summary": {
    "totalCharacters": 角色总数,
    "totalScenes": 场景总数,
    "totalShots": 分镜总数,
    "estimatedDuration": "预估总时长（秒）",
    "styleRecommendation": "推荐美术风格"
  }
}

## 各模式处理策略
- **novel模式**：从小说文本中提取关键信息，重点抓出场人物、核心场景、可视觉化的情节
- **character模式**：基于角色描述反向推演可能的故事走向和场景
- **structured模式**：直接校验并补全结构化数据
- **blank模式**：生成一个短小完整的故事框架（1-3角色、2-4场景、6-12分镜）`;

export const ANIMATION_ANALYZE_USER_PROMPT = (mode: string, input?: string) => {
  switch (mode) {
    case "novel":
      return `请分析以下小说文本，提取角色、场景和分镜脚本：

---
${input}
---

要求：提取所有可视觉化的元素，生成不少于6个分镜。`;
    case "character":
      return `请根据以下角色概念描述，完善角色设定并反向推演出完整的故事框架和分镜：

---
${input}
---

要求：基于角色特征推导可能的故事冲突，生成配套场景和分镜。`;
    case "structured":
      return `请校验并补全以下结构化数据，确保角色/场景/分镜信息完整可用：

\`\`\`json
${input}
\`\`\`

要求：检查缺失信息并补充，确保后续动画生成流程可用。`;
    case "blank":
    default:
      return `请从零构思一个短小完整的动画故事框架。要求：
1. 1-3个有记忆点的角色
2. 有清晰的故事冲突
3. 适合改编为3-5分钟的动画短片
4. 包含完整的角色+场景+分镜`;
  }
};
