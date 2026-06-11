/**
 * mapper: Toonflow 工作流 → ManhuaWorks 漫剧输入（NovelToDramaInput）
 *
 * 字段映射规则（v1，仅支持 Toonflow 标准 9 节点子集）：
 *   input_text 节点        → inputs.text + inputs.chapterTitle
 *   generate_storyboard 节点 → inputs.storyType（从 params.storyType 取）
 *   image_diffusion 节点    → inputs.artStyle（从 params.artStyle 取）
 *   tts 节点               → inputs.ttsProvider（从 params.provider 取）
 *   video_animate 节点      → inputs.durationSeconds（从 params.duration 取）
 *   其余节点（split_chapters / extract_characters / compose / output_mp4）忽略
 *
 * 不支持的节点 → 抛 ToonflowMappingError
 */

import type {
  ToonflowNode,
  ToonflowNodeKind,
  ToonflowWorkflow,
} from "../types/toonflow.js";
import type {
  ArtStyle,
  NovelToDramaInput,
  StoryType,
} from "../types/manhua.js";

export class ToonflowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToonflowMappingError";
  }
}

const SUPPORTED_NODES: ReadonlySet<ToonflowNodeKind> = new Set<ToonflowNodeKind>([
  "input_text",
  "generate_storyboard",
  "image_diffusion",
  "tts",
  "video_animate",
  "split_chapters",
  "extract_characters",
  "compose",
  "output_mp4",
]);

const VALID_ART_STYLES: ReadonlySet<ArtStyle> = new Set<ArtStyle>([
  "anime",
  "manhua_chinese",
  "realistic_3d",
  "watercolor",
  "pixel",
  "ink_painting",
  "comic_western",
]);

const VALID_STORY_TYPES: ReadonlySet<StoryType> = new Set<StoryType>([
  "sweet_romance_novel",
  "urban_fantasy",
  "wuxia_martial",
  "scifi_mecha",
  "school_life",
  "mystery_suspense",
  "isekai",
]);

const VALID_TTS = new Set<"edge-tts" | "volcengine" | "aliyun" | "elevenlabs">([
  "edge-tts",
  "volcengine",
  "aliyun",
  "elevenlabs",
]);

function readParam<T extends string>(
  node: ToonflowNode,
  key: string,
  validator: (v: string) => v is T,
  fallback: T,
): T {
  const v = node.params?.[key];
  if (typeof v !== "string") return fallback;
  return validator(v) ? v : fallback;
}

/**
 * 把 Toonflow 工作流 + run inputs 折叠成一个 NovelToDramaInput
 * @throws ToonflowMappingError 当工作流包含未支持节点 / 必填字段缺失
 */
export function toonflowToNovel(
  workflow: ToonflowWorkflow,
  runInputs: {
    text?: string;
    chapterTitle?: string;
    artStyle?: string;
    storyType?: string;
  } = {},
): NovelToDramaInput {
  // 1. 节点合法性
  for (const n of workflow.nodes) {
    if (!SUPPORTED_NODES.has(n.kind)) {
      throw new ToonflowMappingError(
        `unsupported node kind '${n.kind}' (id=${n.id}); v1 only supports the 9 standard Toonflow nodes`,
      );
    }
  }

  // 2. 找到各角色节点
  const findOne = (k: ToonflowNodeKind): ToonflowNode | undefined =>
    workflow.nodes.find((n) => n.kind === k);

  const textNode = findOne("input_text");
  const storyboardNode = findOne("generate_storyboard");
  const imageNode = findOne("image_diffusion");
  const ttsNode = findOne("tts");
  const videoNode = findOne("video_animate");

  // 3. 提取文本（run inputs 优先于节点 params）
  const text = runInputs.text ?? (textNode?.params?.text as string | undefined);
  if (!text || text.length < 20) {
    throw new ToonflowMappingError(
      "toonflow-to-novel: 'text' is required (>=20 chars). " +
        "Provide via runInputs.text or input_text.params.text",
    );
  }
  if (text.length > 20_000) {
    throw new ToonflowMappingError("toonflow-to-novel: 'text' exceeds 20000 chars limit");
  }

  // 4. 标题：node.label > runInputs.chapterTitle > workflow.defaultPrompt
  const chapterTitle =
    runInputs.chapterTitle ??
    textNode?.label ??
    (typeof workflow.defaultPrompt === "string" ? workflow.defaultPrompt : undefined);

  // 5. artStyle / storyType / ttsProvider / durationSeconds
  //    优先级：runInputs（外部 override）> 节点 params > 默认值
  const isValidArtStyle = (v: unknown): v is ArtStyle =>
    typeof v === "string" && VALID_ART_STYLES.has(v as ArtStyle);
  const isValidStoryType = (v: unknown): v is StoryType =>
    typeof v === "string" && VALID_STORY_TYPES.has(v as StoryType);

  let artStyle: ArtStyle | undefined;
  if (isValidArtStyle(runInputs.artStyle)) {
    artStyle = runInputs.artStyle as ArtStyle;
  } else if (imageNode) {
    const v = imageNode.params?.artStyle;
    artStyle = isValidArtStyle(v) ? (v as ArtStyle) : "anime";
  } else {
    artStyle = "anime";
  }

  let storyType: StoryType | undefined;
  if (isValidStoryType(runInputs.storyType)) {
    storyType = runInputs.storyType as StoryType;
  } else if (storyboardNode) {
    const v = storyboardNode.params?.storyType;
    storyType = isValidStoryType(v) ? (v as StoryType) : "sweet_romance_novel";
  } else {
    storyType = "sweet_romance_novel";
  }

  const ttsProvider = ttsNode
    ? readParam<"edge-tts" | "volcengine" | "aliyun" | "elevenlabs">(
        ttsNode,
        "provider",
        (v): v is "edge-tts" | "volcengine" | "aliyun" | "elevenlabs" =>
          VALID_TTS.has(v as "edge-tts" | "volcengine" | "aliyun" | "elevenlabs"),
        "edge-tts",
      )
    : undefined;

  let durationSeconds: number | undefined;
  if (videoNode) {
    const raw = videoNode.params?.durationSeconds ?? videoNode.params?.duration;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (raw < 15 || raw > 180) {
        throw new ToonflowMappingError(
          `toonflow-to-novel: video_animate.durationSeconds=${raw} out of [15,180]`,
        );
      }
      durationSeconds = Math.floor(raw);
    }
  }

  const result: NovelToDramaInput = {
    text,
  };
  if (chapterTitle) result.chapterTitle = chapterTitle.slice(0, 200);
  if (artStyle) result.artStyle = artStyle;
  if (storyType) result.storyType = storyType;
  if (ttsProvider) result.ttsProvider = ttsProvider;
  if (durationSeconds !== undefined) result.durationSeconds = durationSeconds;
  if (workflow.workflowId) result.projectId = workflow.workflowId;

  return result;
}
