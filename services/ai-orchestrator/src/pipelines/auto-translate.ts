/**
 * Pipeline 5：auto-translate
 * 已有视频 + 中文字幕 → 翻译 + 配音替换 + 字幕烧录
 * 支持语言：英 en / 日 ja / 韩 ko / 西 es
 *
 * 步骤：
 *   1. extract-subtitle   从源视频/分镜抽 SRT/对话
 *   2. translate-text     翻译成目标语言（ai-helper）
 *   3. translate-audio    用目标语种 TTS 重新配音
 *   4. burn-subtitle      把新字幕+新音频烧回视频（compose）
 */

import type { PipelineDefinition, StepContext } from "../pipeline-runner.js";
import { aiHelperClient, type Language } from "../clients/ai-helper.js";
import { workflowClient } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

export type TargetLanguage = "en" | "ja" | "ko" | "es";

export interface AutoTranslateInput {
  /** 源资产 ID（asset-service，kind=episode 或 video） */
  sourceAssetId: string;
  /** 源分镜（来自上游；含 dialogue 字段） */
  shots?: Array<{ shotId: string; dialogue?: string }>;
  /** 源 SRT 文本（可选，与 shots 二选一） */
  subtitleSrt?: string;
  /** 目标语种 */
  targetLanguage: TargetLanguage;
  /** 配音供应商（默认 volcengine，多语种效果最好） */
  ttsProvider?: "volcengine" | "aliyun" | "elevenlabs";
  /** 烧录后是否要替换原视频（默认 false：另存新资产） */
  burnInPlace?: boolean;
  /** 项目 ID */
  projectId?: string;
}

export interface AutoTranslateOutput {
  sourceLanguage: Language;
  targetLanguage: TargetLanguage;
  translatedSubtitleSrt: string;
  translatedDialogues: Array<{ shotId: string; original: string; translated: string }>;
  newAudioUrl?: string;
  finalVideoUrl?: string;
  costUsd: number;
  latencyMs: number;
}

const LANG_MAP: Record<TargetLanguage, string> = {
  en: "English",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
};

export const autoTranslatePipeline: PipelineDefinition = {
  name: "auto-translate",
  steps: [
    {
      name: "extract-subtitle",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateInput;
        let dialogues: Array<{ shotId: string; dialogue: string }> = [];
        if (input.shots && input.shots.length > 0) {
          dialogues = input.shots
            .filter((s) => s.dialogue && s.dialogue.trim().length > 0)
            .map((s) => ({ shotId: s.shotId, dialogue: s.dialogue ?? "" }));
        } else if (input.subtitleSrt) {
          // SRT 解析（简版：只取文本行）
          dialogues = input.subtitleSrt
            .split(/\n\n+/)
            .map((block) => {
              const lines = block.split("\n").filter(Boolean);
              // 跳过序号行和时间码行
              const textLines = lines.filter(
                (l) => !/^\d+$/.test(l.trim()) && !/-->/.test(l),
              );
              return { shotId: `srt-${dialogues.length + 1}`, dialogue: textLines.join(" ") };
            })
            .filter((d) => d.dialogue.length > 0);
        } else {
          // 兜底：从 asset-service 取
          const asset = await assetClient.get(input.sourceAssetId);
          const payload = asset as unknown as { payload: { dialogues?: Array<{ shotId: string; dialogue: string }> } };
          dialogues = payload.payload.dialogues ?? [];
        }
        ctx.cost.recordFromStep("extract-subtitle", "zhipu", 0.05, 0, false);
        return { dialogues };
      },
    },
    {
      name: "translate-text",
      dependsOn: ["extract-subtitle"],
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateInput;
        const dialogues = (ctx.prev["extract-subtitle"]?.dialogues as Array<{ shotId: string; dialogue: string }>) ?? [];
        if (dialogues.length === 0) {
          return { translated: [], srt: "" };
        }
        const start = Date.now();
        const translated: Array<{ shotId: string; original: string; translated: string }> = [];
        const targetName = LANG_MAP[input.targetLanguage];
        for (const d of dialogues) {
          const r = await aiHelperClient.translate({
            text: d.dialogue,
            from: "zh",
            to: input.targetLanguage,
          });
          translated.push({
            shotId: d.shotId,
            original: d.dialogue,
            translated: (r.data ?? "").trim() || d.dialogue,
          });
        }
        // 生成简化 SRT
        const srt = translated
          .map((t, i) => `${i + 1}\n00:00:${String(i * 5).padStart(2, "0")},000 --> 00:00:${String((i + 1) * 5).padStart(2, "0")},000\n${t.translated}\n`)
          .join("\n");
        ctx.cost.recordFromStep("translate-text", "zhipu", 0.05 * Math.max(1, dialogues.length), Date.now() - start, false);
        return { translated, srt };
      },
    },
    {
      name: "translate-audio",
      dependsOn: ["translate-text"],
      retries: 1,
      optional: true, // 没台词时跳过
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateInput;
        const translated = (ctx.prev["translate-text"]?.translated as Array<{ translated: string }>) ?? [];
        const allText = translated.map((t) => t.translated).join("\n").slice(0, 2000);
        if (!allText.trim()) {
          return { skipped: true };
        }
        const start = Date.now();
        const r = await workflowClient.tts({
          text: allText,
          provider: input.ttsProvider ?? "volcengine",
        });
        ctx.cost.recordFromStep("translate-audio", "volcengine", 0.2, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "burn-subtitle",
      dependsOn: ["translate-audio", "translate-text"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateInput;
        // 拿原视频 URL（来自 asset）
        const asset = await assetClient.get(input.sourceAssetId);
        const sourceUrl = (asset as unknown as { url?: string }).url;
        if (!sourceUrl) {
          return { skipped: true, reason: "source has no url" };
        }
        const srt = (ctx.prev["translate-text"]?.srt as string) ?? "";
        const audioUrl = ctx.prev["translate-audio"]?.audioUrl as string | undefined;
        const start = Date.now();
        // compose 时把 [原视频] + [新音频] + [新字幕] 烧回去
        const r = await workflowClient.compose({
          videoUrls: [sourceUrl],
          audioUrls: audioUrl ? [audioUrl] : undefined,
          subtitleText: srt,
          outputFormat: "mp4",
        });
        ctx.cost.recordFromStep("burn-subtitle", "volcengine", 0.05, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
  ],
};

export function buildAutoTranslateOutput(snap: import("../pipeline-runner.js").RunSnapshot): AutoTranslateOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  return {
    sourceLanguage: "zh",
    targetLanguage: ((snap.inputs as unknown as AutoTranslateInput).targetLanguage as TargetLanguage) ?? "en",
    translatedSubtitleSrt: (o("translate-text").srt as string) ?? "",
    translatedDialogues: (o("translate-text").translated as Array<{ shotId: string; original: string; translated: string }>) ?? [],
    newAudioUrl: (o("translate-audio").audioUrl as string) ?? undefined,
    finalVideoUrl: (o("burn-subtitle").finalVideoUrl as string) ?? undefined,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
  };
}
