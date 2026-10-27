/**
 * Prompts 统一导出
 *
 * 千机工坊六大模块的AI Prompt模板。
 * 每个模块的prompt独立文件存放，便于单独调优。
 */

// 故事模块
export * from "./story-inspiration.js";
export * from "./story-template.js";
export * from "./worldview.js";
export * from "./chapter-generate.js";

// 动画模块
export * from "./animation-analyze.js";

// 宣传片模块
export * from "./promo-brief.js";

// 短视频模块
export * from "./product-parse.js";

// 配乐模块
export * from "./music.js";

// P1 UX增强 — 参考作品分析 (ENH-2)
export * from "./reference-analyze.js";

// P1 UX增强 — 角色外貌标签 (ENH-3)
export * from "./character-appearance.js";

// P1 UX增强 — 受众细分标签 (ENH-6)
export * from "./audience-segment.js";

// P1 UX增强 — 脚本模板 (ENH-7)
export * from "./script-template.js";

// P1 UX增强 — 纯文案海报 (ENH-9)
export * from "./text-poster.js";

// P1 UX增强 — AI写词 (ENH-10)
export * from "./lyrics.js";

// P2+P3 (派单55) — 多视角叙事 (ENH-12)
export * from "./multi-perspective.js";

// P2+P3 (派单55) — 参考视频风格提取 (ENH-14)
export * from "./video-style-extract.js";

// P2+P3 (派单55) — TTS配音+字幕同步 (ENH-15)
export * from "./narration-subtitle.js";
