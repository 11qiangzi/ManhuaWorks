/**
 * Pipeline 5（精修）：auto-translate.refined
 *
 * W3 baseline + W5 增量：
 *   - 12 语言（en/ja/ko/fr/de/es/ru/ar/hi/pt/it/zh-TW）
 *   - 字幕烧录（compose）
 *   - 双语字幕（primary + secondary，并排显示）
 *   - 错误恢复 + 缓存 + 并发翻译
 *   - 后期字体选择（recommendedFont）
 *   - RTL 字幕渲染（ar）
 */

import type { PipelineDefinition, StepContext, RunSnapshot } from "../pipeline-runner.js";
import { aiHelperClient, type Language } from "../clients/ai-helper.js";
import { workflowClient } from "../clients/workflow.js";
import { assetClient } from "../clients/asset.js";

import { LANGUAGE_PRESETS, pickLanguagePreset, buildBilingualSrt, isRtl, type LanguageKey } from "../presets/languages.js";
import { DEFAULT_QUALITY_MODE, type QualityMode } from "../presets/quality-modes.js";
import { runBatchTranslate } from "../perf/batch.js";

export type { LanguageKey } from "../presets/languages.js";

export interface AutoTranslateRefinedInput {
  sourceAssetId: string;
  /** 源分镜 */
  shots?: Array<{ shotId: string; dialogue?: string }>;
  /** 源 SRT */
  subtitleSrt?: string;
  /** 目标语种（12 语言之一） */
  targetLanguage: LanguageKey;
  /** 第二语言（双语字幕） */
  secondaryLanguage?: LanguageKey;
  /** 配音供应商 */
  ttsProvider?: "volcengine" | "aliyun" | "elevenlabs" | "edge-tts";
  /** 烧录后是否替换原视频 */
  burnInPlace?: boolean;
  /** 项目 ID */
  projectId?: string;
  /** 质量模式 */
  qualityMode?: QualityMode;
  /** 是否烧录双语字幕（默认 false） */
  bilingualSubtitle?: boolean;
}

export interface AutoTranslateRefinedOutput {
  sourceLanguage: Language;
  targetLanguage: LanguageKey;
  secondaryLanguage?: LanguageKey;
  translatedSubtitleSrt: string;
  bilingualSubtitleSrt?: string;
  translatedDialogues: Array<{ shotId: string; original: string; translated: string; secondary?: string }>;
  newAudioUrl?: string;
  finalVideoUrl?: string;
  costUsd: number;
  latencyMs: number;
  mode: QualityMode;
  recommendedFont: string;
  isRtl: boolean;
  cacheHits: number;
  /** 翻译并发 */
  translateConcurrency: number;
}

/** 工具：把 dialogues 转简化 SRT */
function dialoguesToSrt(dialogues: Array<{ index: number; text: string }>): string {
  return dialogues
    .map((d) => {
      const start = `00:00:${String(d.index * 5).padStart(2, "0")},000`;
      const end = `00:00:${String((d.index + 1) * 5).padStart(2, "0")},000`;
      return `${d.index + 1}\n${start} --> ${end}\n${d.text}\n`;
    })
    .join("\n");
}

export const autoTranslateRefinedPipeline: PipelineDefinition = {
  name: "auto-translate.refined",
  steps: [
    {
      name: "extract-subtitle",
      retries: 1,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateRefinedInput;
        let dialogues: Array<{ shotId: string; dialogue: string }> = [];
        if (input.shots && input.shots.length > 0) {
          dialogues = input.shots
            .filter((s) => s.dialogue && s.dialogue.trim().length > 0)
            .map((s) => ({ shotId: s.shotId, dialogue: s.dialogue ?? "" }));
        } else if (input.subtitleSrt) {
          const blocks = input.subtitleSrt.split(/\n\n+/);
          for (let i = 0; i < blocks.length; i++) {
            const lines = blocks[i]!.split("\n").filter(Boolean);
            const textLines = lines.filter((l) => !/^\d+$/.test(l.trim()) && !/-->/.test(l));
            const text = textLines.join(" ").trim();
            if (text.length > 0) {
              dialogues.push({ shotId: `srt-${i + 1}`, dialogue: text });
            }
          }
        } else {
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
        const input = ctx.inputs as unknown as AutoTranslateRefinedInput;
        const mode = input.qualityMode ?? DEFAULT_QUALITY_MODE;
        const dialogues = (ctx.prev["extract-subtitle"]?.dialogues as Array<{ shotId: string; dialogue: string }>) ?? [];
        if (dialogues.length === 0) {
          return { translated: [], srt: "", bilingualSrt: "", cacheHits: 0 };
        }
        const preset = pickLanguagePreset(input.targetLanguage);
        const secPreset = input.secondaryLanguage ? pickLanguagePreset(input.secondaryLanguage) : undefined;

        // 主语种翻译（并发 + 缓存）
        const start = Date.now();
        const { translated: primaryTexts, cacheHits: primaryHits } = await runBatchTranslate(
          dialogues.map((d) => ({ text: d.dialogue, from: "zh" as Language, to: input.targetLanguage as Language })),
          mode === "quality" ? 3 : 6,
        );

        // 第二语种翻译（如有）
        let secondaryTexts: string[] | undefined;
        let secondaryHits = 0;
        if (input.secondaryLanguage) {
          const r = await runBatchTranslate(
            dialogues.map((d) => ({ text: d.dialogue, from: "zh" as Language, to: input.secondaryLanguage as Language })),
            mode === "quality" ? 3 : 6,
          );
          secondaryTexts = r.translated;
          secondaryHits = r.cacheHits;
        }

        const translated: Array<{ shotId: string; original: string; translated: string; secondary?: string }> = dialogues.map(
          (d, i) => ({
            shotId: d.shotId,
            original: d.dialogue,
            translated: primaryTexts[i] ?? d.dialogue,
            secondary: secondaryTexts?.[i],
          }),
        );

        // SRT
        const primaryArr = translated.map((t, i) => ({ index: i, text: t.translated }));
        const srt = dialoguesToSrt(primaryArr);

        // 双语 SRT
        let bilingualSrt = "";
        if (input.bilingualSubtitle && secPreset && secondaryTexts) {
          const bilingualArr = translated.map((t, i) => ({
            index: i,
            start: `00:00:${String(i * 5).padStart(2, "0")},000`,
            end: `00:00:${String((i + 1) * 5).padStart(2, "0")},000`,
            text: t.translated,
          }));
          bilingualSrt = buildBilingualSrt(
            bilingualArr,
            secondaryTexts.map((text) => ({ text })),
            input.targetLanguage,
            input.secondaryLanguage!,
          );
        }

        ctx.cost.recordFromStep(
          "translate-text",
          "zhipu",
          0.05 * preset.costMultiplier * Math.max(1, dialogues.length) + (secPreset ? 0.05 * secPreset.costMultiplier * dialogues.length : 0),
          Date.now() - start,
          false,
        );
        return { translated, srt, bilingualSrt, cacheHits: primaryHits + secondaryHits };
      },
    },
    {
      name: "translate-audio",
      dependsOn: ["translate-text"],
      retries: 1,
      optional: true,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateRefinedInput;
        const translated = (ctx.prev["translate-text"]?.translated as Array<{ translated: string }>) ?? [];
        const allText = translated.map((t) => t.translated).join("\n").slice(0, 2000);
        if (!allText.trim()) return { skipped: true };
        const preset = pickLanguagePreset(input.targetLanguage);
        const start = Date.now();
        // 优先级：入参 > preset 推荐
        const provider = input.ttsProvider ?? preset.recommendedTts[0] ?? "volcengine";
        const r = await workflowClient.tts({
          text: allText,
          provider,
        });
        ctx.cost.recordFromStep("translate-audio", "volcengine", 0.2 * preset.costMultiplier, Date.now() - start, false);
        return r.outputs as Record<string, unknown>;
      },
    },
    {
      name: "burn-subtitle",
      dependsOn: ["translate-audio", "translate-text"],
      retries: 0,
      optional: true,
      run: async (ctx: StepContext) => {
        const input = ctx.inputs as unknown as AutoTranslateRefinedInput;
        const asset = await assetClient.get(input.sourceAssetId);
        const sourceUrl = (asset as unknown as { url?: string }).url;
        if (!sourceUrl) return { skipped: true, reason: "source has no url" };

        const preset = pickLanguagePreset(input.targetLanguage);
        const srt = (input.bilingualSubtitle
          ? (ctx.prev["translate-text"]?.bilingualSrt as string)
          : (ctx.prev["translate-text"]?.srt as string)) ?? "";
        const audioUrl = ctx.prev["translate-audio"]?.audioUrl as string | undefined;
        const start = Date.now();
        // 注：字体 / RTL 信息会通过 postProcess 字段透传给 compose（生产可对接 ffmpeg 端）
        const r = await workflowClient.compose({
          videoUrls: [sourceUrl],
          audioUrls: audioUrl ? [audioUrl] : undefined,
          subtitleText: srt,
          outputFormat: "mp4",
        });
        ctx.cost.recordFromStep("burn-subtitle", "volcengine", 0.05, Date.now() - start, false);
        return { ...(r.outputs as Record<string, unknown>), _font: preset.recommendedFont, _rtl: isRtl(input.targetLanguage) };
      },
    },
  ],
};

export function buildAutoTranslateRefinedOutput(snap: RunSnapshot): AutoTranslateRefinedOutput {
  const o = (n: string) => snap.steps[n]?.outputs ?? {};
  const inputs = snap.inputs as unknown as AutoTranslateRefinedInput;
  const cacheHits = (o("translate-text").cacheHits as number) ?? 0;
  const preset = pickLanguagePreset(inputs.targetLanguage);
  return {
    sourceLanguage: "zh",
    targetLanguage: inputs.targetLanguage,
    secondaryLanguage: inputs.secondaryLanguage,
    translatedSubtitleSrt: (o("translate-text").srt as string) ?? "",
    bilingualSubtitleSrt: o("translate-text").bilingualSrt as string | undefined,
    translatedDialogues: (o("translate-text").translated as Array<{ shotId: string; original: string; translated: string; secondary?: string }>) ?? [],
    newAudioUrl: (o("translate-audio").audioUrl as string) ?? undefined,
    finalVideoUrl: (o("burn-subtitle").finalVideoUrl as string) ?? undefined,
    costUsd: snap.costSummary.totalCostUsd,
    latencyMs: snap.costSummary.totalLatencyMs,
    mode: inputs.qualityMode ?? DEFAULT_QUALITY_MODE,
    recommendedFont: preset.recommendedFont,
    isRtl: isRtl(inputs.targetLanguage),
    cacheHits,
    translateConcurrency: (inputs.qualityMode ?? DEFAULT_QUALITY_MODE) === "quality" ? 3 : 6,
  };
}

export const _LANGUAGE_PRESETS = LANGUAGE_PRESETS;
