/**
 * one-click-manga pipeline
 *
 * @deprecated 代码已拆分到 one-click-manga/ 子目录。
 * 此文件保留为重导出层，保持已有 import 正常工作。
 * 后续应直接 import from "./one-click-manga/index.js"。
 */
export {
  oneClickMangaPipeline,
  buildOneClickMangaOutput,
  type OneClickMangaInput,
  type OneClickMangaOutput,
  type StepResult,
  DEFAULT_STORY_TYPE,
  DEFAULT_ART_STYLE,
  DEFAULT_DURATION,
  DEFAULT_EPISODE_COUNT,
  STEP_NAMES,
  TOTAL_STEPS,
  MAX_INPUT_FULL,
  MAX_INPUT_MEDIUM,
  MAX_INPUT_CHAR_FRAGMENT,
  MAX_TTS_DIALOGUE,
  MAX_INPUT_SNIPPET,
  MAX_INPUT_SHORT,
  MAX_SHOTS_PER_STEP,
  progressPct,
  mapMoodToMusicStyle,
} from "./one-click-manga/index.js";
