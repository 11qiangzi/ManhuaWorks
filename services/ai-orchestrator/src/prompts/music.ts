/**
 * API-9 & API-10: 配乐模块 Prompt
 *
 * API-9: 上传视频 → 分析节奏/情绪/转场 → 生成3段候选配乐（不同风格）
 * API-10: 输入自然语言情绪描述 → 补全音乐参数(BPM/调式/乐器配置)+生成音乐prompt
 *
 * 用途：激活"为画面配乐"核心需求（45%用户带视频进来），
 * 让小白用户用自然语言描述音乐需求。
 */

// ==================== API-9: 视频分析配乐 ====================

export const VIDEO_MUSIC_ANALYZE_SYSTEM_PROMPT = `你是一个专业的影视配乐师。根据视频的分析数据（节奏曲线、转场点、情绪标签），生成3段不同风格的候选配乐方案。

## 视频分析维度（由前端/中间层提供）
- 节奏曲线：视频的时间-速度变化数据
- 转场点：关键转场的时间戳
- 情绪标签：画面整体情绪分类
- 场景识别：每个段落的内容类型（对话/动作/空镜/特效）

## 输出格式（严格JSON）
{
  "videoAnalysis": {
    "duration": 视频时长（秒）,
    "tempo": "整体节奏：fast|medium|slow",
    "moodPrimary": "主要情绪",
    "moodSecondary": "次要情绪",
    "transitionCount": 转场次数,
    "segments": [
      {
        "startTime": 开始秒数,
        "endTime": 结束秒数,
        "type": "段落类型",
        "intensity": "强度: low|medium|high"
      }
    ]
  },
  "candidates": [
    {
      "id": "candidate_1",
      "styleName": "风格名称（如：史诗管弦/电子氛围/轻钢琴）",
      "styleTag": "epic|emotional|tense|relaxing|upbeat|cool",
      "description": "风格描述（30-50字）",
      "musicPrompt": "音乐生成prompt（英文，100-200字，包含BPM/调式/乐器）",
      "bpm": BPM数值,
      "key": "调式（如C Major / A Minor）",
      "instruments": ["乐器1","乐器2"],
      "matchScore": "与视频匹配度（1-10）",
      "highlightSegments": ["0:15高潮处","1:20叙事转折处"]
    }
  ],
  "alignmentSuggestion": "卡点对齐建议（简述哪些转场点需要音乐同步）"
}

## 三段候选风格策略
1. **情感共鸣型**：强化视频原有情绪，用旋律引导观众情感
2. **节奏反衬型**：与视频节奏形成张力，制造独特氛围
3. **简约留白型**：轻量配乐不抢画面，适合对话/叙事段落`;

export const VIDEO_MUSIC_ANALYZE_USER_PROMPT = (videoAnalysis: {
  duration: number;
  tempo: string;
  moodPrimary: string;
  moodSecondary: string;
  segments: Array<{ startTime: number; endTime: number; type: string; intensity: string }>;
}) => {
  const segText = (videoAnalysis.segments || [])
    .map((s) => `  ${s.startTime}s-${s.endTime}s: ${s.type}，强度${s.intensity}`)
    .join("\n");

  return `请为以下视频分析配乐方案：

## 视频数据
- 时长：${videoAnalysis.duration}秒
- 整体节奏：${videoAnalysis.tempo}
- 主要情绪：${videoAnalysis.moodPrimary}
- 次要情绪：${videoAnalysis.moodSecondary}

## 段落分析
${segText}

要求：
1. 生成3段不同风格的候选配乐
2. 每段给出具体的音乐生成prompt（含BPM/调式/乐器配置）
3. 给出与视频的卡点对齐建议`;
};

// ==================== API-10: 音乐需求自然语言翻译 ====================

/**
 * 情绪到音乐参数的映射表（供参考）
 */
export const MOOD_TO_MUSIC_PARAMS: Record<string, {
  typicalBpm: [number, number];
  typicalKeys: string[];
  typicalInstruments: string[];
  description: string;
}> = {
  "温馨": {
    typicalBpm: [70, 90],
    typicalKeys: ["C Major", "G Major", "F Major"],
    typicalInstruments: ["钢琴", "木吉他", "弦乐组", "长笛"],
    description: "适合亲情主题视频、婚礼剪辑、回忆片段",
  },
  "热血": {
    typicalBpm: [120, 160],
    typicalKeys: ["D Minor", "E Minor", "A Minor"],
    typicalInstruments: ["电吉他", "架子鼓", "合成器", "管弦乐"],
    description: "适合动作场面、燃向剪辑、体育赛事",
  },
  "悲伤": {
    typicalBpm: [50, 72],
    typicalKeys: ["A Minor", "D Minor", "E Minor"],
    typicalInstruments: ["钢琴", "大提琴", "小提琴独奏", "弦乐四重奏"],
    description: "适合抒情视频、离别场景、情感叙事",
  },
  "史诗": {
    typicalBpm: [90, 130],
    typicalKeys: ["D Minor", "C Minor", "E♭ Major"],
    typicalInstruments: ["交响乐团", "合唱", "定音鼓", "铜管"],
    description: "适合大场面、预告片、宣传片高潮",
  },
  "悬疑": {
    typicalBpm: [60, 100],
    typicalKeys: ["C Minor", "F Minor", "D♭ Major"],
    typicalInstruments: ["合成器", "弦乐拨奏", "钢琴低音区", "电子音效"],
    description: "适合悬疑视频、推理内容、恐怖氛围",
  },
  "欢乐": {
    typicalBpm: [100, 140],
    typicalKeys: ["C Major", "G Major", "D Major"],
    typicalInstruments: ["尤克里里", "口哨", "木吉他", "钟琴"],
    description: "适合Vlog、旅行视频、庆祝场面",
  },
  "治愈": {
    typicalBpm: [60, 85],
    typicalKeys: ["F Major", "C Major", "A Major"],
    typicalInstruments: ["钢琴", "木吉他指弹", "八音盒", "竖琴"],
    description: "适合日常记录、宠物视频、美食内容",
  },
  "暗黑": {
    typicalBpm: [55, 85],
    typicalKeys: ["C Minor", "E♭ Minor", "F Minor"],
    typicalInstruments: ["合成器贝斯", "工业打击乐", "失真吉他", "人声采样"],
    description: "适合暗黑风格、赛博朋克、恐怖内容",
  },
  "浪漫": {
    typicalBpm: [60, 90],
    typicalKeys: ["C Major", "E♭ Major", "A♭ Major"],
    typicalInstruments: ["钢琴", "小提琴", "萨克斯", "尼龙弦吉他"],
    description: "适合约会场景、婚礼视频、爱情故事",
  },
  "怀旧": {
    typicalBpm: [65, 85],
    typicalKeys: ["G Major", "D Major", "A Major"],
    typicalInstruments: ["木吉他", "口琴", "黑胶质感效果", "钢琴"],
    description: "适合回忆主题、老照片合集、年代感内容",
  },
};

export const MUSIC_TRANSLATE_SYSTEM_PROMPT = `你是一个音乐制作人兼录音工程师。将用户的自然语言情绪描述翻译为专业的音乐制作参数和音乐生成prompt。

## 情绪-参数参考
${Object.entries(MOOD_TO_MUSIC_PARAMS)
    .map(([mood, params]) =>
      `- **${mood}**：BPM ${params.typicalBpm[0]}-${params.typicalBpm[1]}，常用调式 ${params.typicalKeys.slice(0, 2).join("/")}，乐器 ${params.typicalInstruments.slice(0, 3).join("、")}（${params.description}）`
    )
    .join("\n")}

## 输出格式（严格JSON）
{
  "originalDescription": "用户原始描述",
  "interpretedMood": "识别到的主导情绪",
  "moodSecondary": "次要情绪（可选）",
  "parameters": {
    "bpm": BPM数值,
    "key": "调式",
    "timeSignature": "拍号（默认4/4）",
    "instruments": ["乐器配置"],
    "structure": "结构建议：intro-verse-chorus-bridge-outro",
    "durationRecommendation": "建议时长（秒）"
  },
  "musicPrompt": "音乐生成prompt（英文，100-200字，适合输入到Suno/Udio等AI音乐工具）",
  "referenceSuggestions": ["参考曲风1","参考曲风2"],
  "usageTips": "使用建议（适用场景、配合画面建议）"
}`;

export const MUSIC_TRANSLATE_USER_PROMPT = (description: string, duration?: number, additionalNotes?: string) => {
  const parts: string[] = [
    `请将以下音乐需求翻译为专业的音乐制作参数：`,
    "",
    `用户描述：${description}`,
  ];
  if (duration) {
    parts.push(`期望时长：${duration}秒`);
  }
  if (additionalNotes) {
    parts.push(`补充说明：${additionalNotes}`);
  }
  parts.push("", "要求：BPM/调式/乐器配置准确、musicPrompt可直接用于AI音乐生成工具。");
  return parts.join("\n");
};
