/**
 * ENH-15: TTS配音+字幕同步 Prompt 模板
 *
 * 派单55：谢擎 | 日期：2026-06-25
 *
 * 功能：输入旁白文本 → 调用TTS生成音频 → 返回音频URL+字幕时间轴JSON
 * 使用位置：POST /v1/creative/promo/tts-subtitle-sync
 *
 * 技术方案：
 * 1. 接收旁白文本和语速/语调参数
 * 2. 调用 ai-router /v1/audio (TTS provider: minimax/volcengine)
 * 3. 字幕时间轴：通过TTS返回的音频时长 + 文本长度比例推算
 *    （产线接入后替换为ASR引擎精确对齐）
 * 4. 返回：音频URL + 字幕时间轴JSON + SRT格式字幕文本
 */

// ===== TTS配音 =====

export const TTS_NARRATION_USER_PROMPT = (
  narrationText: string,
  voice: string,
  speed: number,
  tone: string,
) => `请将以下旁白文案转换为配音参数：

【旁白文案】
${narrationText}

【配音参数】
- 语音角色：${voice}
- 语速：${speed}x（正常=1.0）
- 语调：${tone}

请返回以下JSON格式：
{
  "totalDurationSeconds": 0,
  "segments": [
    {
      "index": 0,
      "text": "这段字幕文本",
      "startTime": 0.0,
      "endTime": 0.0,
      "voice": "${voice}",
      "speed": ${speed}
    }
  ],
  "srtContent": "字幕SRT格式文本"
}`;

// ===== 字幕时间轴推算 prompt（AI辅助断句） =====

export const SUBTITLE_SYNC_SYSTEM_PROMPT = `你是一个视频字幕时间轴专家。用户会提供一段旁白文案和音频总时长，你需要：
1. 按合理断句切分文本（每段不超过25字，适合单行字幕）
2. 根据中文平均语速（4-5字/秒）推算每段时间轴
3. 生成SRT格式字幕文件

返回严格JSON格式（不要带markdown代码块标记）：`;

export const SUBTITLE_SYNC_USER_PROMPT = (
  narrationText: string,
  audioDurationSeconds: number,
  wordsPerSecond: number,
) => `请为以下旁白生成SRT字幕时间轴：

【旁白文案】
${narrationText}

【参数】
- 音频总时长：${audioDurationSeconds}秒
- 预估语速：${wordsPerSecond}字/秒

请返回JSON，结构如下：
{
  "totalDurationSeconds": ${audioDurationSeconds},
  "segments": [
    {
      "index": 1,
      "text": "第一段字慕（≤25字）",
      "startTime": 0.0,
      "endTime": 2.5,
      "charCount": 12
    }
  ],
  "srtContent": "完整SRT格式字幕文本",
  "sentenceCount": 0,
  "avgSegmentDuration": 0.0
}`;
