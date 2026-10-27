/**
 * 千机工坊 六大模块P0后端API 共享类型
 *
 * 派单51：谢擎 | 日期：2026-06-25
 *
 * 这些类型定义了六大创作模块新增API的输入/输出结构。
 * 前端林染侧会引用这些类型进行组件开发。
 */

// ==================== API-1: 故事创意灵感 ====================

export interface StoryInspirationItem {
  /** 故事标题（8字以内） */
  title: string;
  /** 一句话梗概（30-50字） */
  logline: string;
  /** 风格标签 */
  styleTags: string[];
  /** 适合改编的类型 */
  adaptedFor: string[];
}

export interface StoryInspirationResponse {
  inspirations: StoryInspirationItem[];
  /** 是否来自"换一批"请求 */
  refreshed: boolean;
}

// ==================== API-2: 故事模板 ====================

export interface StoryTemplateDefinition {
  id: string;
  name: string;
  description: string;
  subTags: string[];
  icon: string;
}

export interface ChapterOutline {
  number: number;
  title: string;
  summary: string;
  keyEvent: string;
}

export interface CharacterOutline {
  name: string;
  role: string;
  archetype: string;
  motivation: string;
  arc: string;
}

export interface WorldviewHints {
  era: string;
  setting: string;
  uniqueRule: string;
}

export interface TemplateOutlineResponse {
  templateId: string;
  templateName: string;
  title: string;
  synopsis: string;
  coreConflict: string;
  genreTags: string[];
  targetAudience: string;
  chapters: ChapterOutline[];
  characters: CharacterOutline[];
  worldviewHints: WorldviewHints;
  hook: string;
}

// ==================== API-3: 世界观提取与补充 ====================

export interface WorldviewDimension {
  current: string;
  suggestion: string;
  completeness: "low" | "medium" | "high";
}

export interface WorldviewExtractResponse {
  era: WorldviewDimension;
  geography: WorldviewDimension;
  powerSystem: WorldviewDimension;
  social: WorldviewDimension;
  coreConflict: WorldviewDimension;
  overallScore: number;
  criticalGaps: string[];
}

export interface WorldviewEnrichResponse {
  dimension: string;
  current: string;
  enriched: string;
  additions: string[];
  conflictsResolved: string[];
}

// ==================== API-4: 逐章生成 ====================

export interface ChapterGenerateRequest {
  /** 项目ID（用于关联已有项目） */
  projectId?: string;
  /** 章节号 */
  chapterNumber: number;
  /** 本章标题（可选） */
  chapterTitle?: string;
  /** 完整大纲 */
  outline: string;
  /** 世界观设定 */
  worldview: string;
  /** 角色信息 */
  characters: string;
  /** 上一章摘要（用于衔接，第1章可省略） */
  previousChapterSummary?: string;
  /** 故事类型 */
  storyType?: string;
  /** 额外风格说明 */
  styleNote?: string;
}

export interface ChapterGenerateResponse {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  hook: string;
  nextChapterPreview: string;
}

export interface ChapterReviseRequest {
  /** 原章节内容 */
  originalContent: string;
  /** 修改建议 */
  revisionNote: string;
}

export interface ChapterRegenerateRequest {
  chapterNumber: number;
  outline: string;
  worldview: string;
  characters: string;
  previousChapterSummary?: string;
  storyType?: string;
  /** 需要避免的写法 */
  avoidPattern: string;
}

// ==================== API-5: 动画多模式分析 ====================

export type AnimationInputMode = "novel" | "character" | "structured" | "blank";

export interface AnimationAnalyzeRequest {
  mode: AnimationInputMode;
  /** 小说文本 / 角色概念描述 / 结构化JSON / 空（blank模式） */
  input?: string;
  /** 项目ID（可选） */
  projectId?: string;
}

export interface AnimationCharacter {
  name: string;
  role: string;
  appearance: string;
  appearanceTags: string[];
  personality: string;
  motivation: string;
  relationships: Array<{ target: string; type: string; note: string }>;
}

export interface AnimationScene {
  name: string;
  type: string;
  description: string;
  mood: string;
  key: string;
  timeOfDay: string;
}

export interface AnimationShot {
  shotId: string;
  sceneName: string;
  shotType: string;
  duration: string;
  cameraMovement: string;
  description: string;
  dialogue: string;
  characters: string[];
}

export interface AnimationAnalyzeResponse {
  mode: string;
  characters: AnimationCharacter[];
  scenes: AnimationScene[];
  storyboard: AnimationShot[];
  summary: {
    totalCharacters: number;
    totalScenes: number;
    totalShots: number;
    estimatedDuration: string;
    styleRecommendation: string;
  };
}

// ==================== API-6: 智能Brief生成 ====================

export interface BriefGenerateRequest {
  brandName: string;
  websiteUrl?: string;
  /** AI抓取的官网内容（由前端或中间层提供） */
  websiteContent?: string;
  targetAudience?: string;
  sellingPoints?: string;
}

export interface BriefToneAndStyle {
  primary: string;
  secondary: string;
  referenceBrands: string[];
  visualStyle: string;
  colorPalette: string;
}

export interface BriefTargetAudience {
  primary: string;
  secondary: string;
  insight: string;
}

export interface BriefGenerateResponse {
  brandName: string;
  brandSlug: string;
  productPositioning: string;
  coreSellingPoints: string[];
  toneAndStyle: BriefToneAndStyle;
  targetAudience: BriefTargetAudience;
  keyMessage: string;
  callToAction: string;
  durationRecommendation: string;
  platformRecommendations: string[];
  contentWarnings: string[];
}

// ==================== API-7: 多脚本方案 ====================

export interface ScriptScene {
  sceneNumber: number;
  durationSeconds: number;
  shotType: string;
  visual: string;
  audio: string;
  narration: string;
  onScreenText: string;
}

export interface ScriptOption {
  id: string;
  style: string;
  title: string;
  durationSeconds: number;
  hook: string;
  scenes: ScriptScene[];
  endingCallToAction: string;
  toneKeywords: string[];
}

export interface MultiScriptResponse {
  briefSummary: string;
  scripts: ScriptOption[];
  comparisonNotes: {
    storytelling: string;
    productShowcase: string;
    suspense: string;
  };
}

// ==================== API-8: 商品链接解析 ====================

export interface ProductParseRequest {
  /** 平台标识 */
  platform: "taobao" | "pinduoduo" | "jd" | "xiaohongshu" | "douyin";
  /** 商品链接URL */
  url: string;
  /** 抓取的原始内容（HTML或文本） */
  rawContent: string;
}

export interface ProductPrice {
  current: number | null;
  original: number | null;
  currency: string;
}

export interface ProductImages {
  mainImage: string | null;
  detailImages: string[];
  skuImages: string[];
}

export interface ProductSpecification {
  name: string;
  values: string[];
}

export interface ProductSalesData {
  soldCount: string | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface ProductShipping {
  freeShipping: boolean;
  deliveryTime: string | null;
}

export interface VideoSuitability {
  score: number;
  reason: string;
  recommendedStyle: string;
}

export interface ProductParseResponse {
  platform: string;
  productTitle: string;
  price: ProductPrice;
  images: ProductImages;
  category: string;
  brand: string | null;
  specifications: ProductSpecification[];
  description: string;
  features: string[];
  salesData: ProductSalesData;
  shipping: ProductShipping;
  videoSuitability: VideoSuitability;
}

// ==================== API-9: 视频分析配乐 ====================

export interface VideoSegment {
  startTime: number;
  endTime: number;
  type: string;
  intensity: "low" | "medium" | "high";
}

export interface VideoMusicAnalyzeRequest {
  /** 视频时长（秒） */
  duration: number;
  /** 整体节奏 */
  tempo: "fast" | "medium" | "slow";
  /** 主要情绪 */
  moodPrimary: string;
  /** 次要情绪 */
  moodSecondary: string;
  /** 段落分析 */
  segments: VideoSegment[];
}

export interface MusicCandidate {
  id: string;
  styleName: string;
  styleTag: string;
  description: string;
  musicPrompt: string;
  bpm: number;
  key: string;
  instruments: string[];
  matchScore: number;
  highlightSegments: string[];
}

export interface VideoMusicAnalyzeResponse {
  videoAnalysis: {
    duration: number;
    tempo: string;
    moodPrimary: string;
    moodSecondary: string;
    transitionCount: number;
    segments: VideoSegment[];
  };
  candidates: MusicCandidate[];
  alignmentSuggestion: string;
}

// ==================== API-10: 音乐需求自然语言翻译 ====================

export interface MusicTranslateRequest {
  /** 自然语言情绪描述 */
  description: string;
  /** 期望时长（秒） */
  duration?: number;
  /** 补充说明 */
  additionalNotes?: string;
}

export interface MusicTranslateResponse {
  originalDescription: string;
  interpretedMood: string;
  moodSecondary: string;
  parameters: {
    bpm: number;
    key: string;
    timeSignature: string;
    instruments: string[];
    structure: string;
    durationRecommendation: number;
  };
  musicPrompt: string;
  referenceSuggestions: string[];
  usageTips: string;
}

// ==================== ENH-2: 参考作品风格分析 ====================

export interface ReferenceAnalyzeRequest {
  /** 作品链接（可选） */
  link?: string;
  /** 作品名 */
  bookName?: string;
  /** 作者 */
  author?: string;
  /** 作品描述/内容摘要 */
  description?: string;
}

export interface PacingAnalysis {
  level: "fast" | "medium" | "slow" | "varied";
  description: string;
  eventDensity: "low" | "medium" | "high";
}

export interface WritingStyleAnalysis {
  level: string;
  description: string;
  sentencePreference: string;
  signatureTechniques: string[];
}

export interface PerspectiveAnalysis {
  type: "first_person" | "third_person_limited" | "third_person_omniscient" | "multi_pov" | "mixed";
  description: string;
  distance: "close" | "medium" | "distant";
}

export interface EmotionalArcAnalysis {
  baseMood: string;
  pattern: string;
  description: string;
}

export interface StructureAnalysis {
  type: string;
  description: string;
}

export interface DialogueStyleAnalysis {
  ratio: "heavy" | "balanced" | "sparse";
  function: string;
  description: string;
}

export interface DescriptionFocusAnalysis {
  environment: number;
  psychology: number;
  action: number;
  appearance: number;
}

export interface ReferenceAnalyzeResponse {
  workTitle: string;
  genreTags: string[];
  pacing: PacingAnalysis;
  writingStyle: WritingStyleAnalysis;
  perspective: PerspectiveAnalysis;
  emotionalArc: EmotionalArcAnalysis;
  structure: StructureAnalysis;
  dialogueStyle: DialogueStyleAnalysis;
  descriptionFocus: DescriptionFocusAnalysis;
  styleSummary: string;
  writingTips: string[];
  adaptationAdvice: string;
}

// ==================== ENH-3: 角色外貌标签 ====================

export interface CharacterAppearanceRequest {
  /** 角色名 */
  characterName: string;
  /** 角色文字描述 */
  description: string;
  /** 期望画风 */
  artStyle?: string;
  /** 性别 */
  gender?: string;
  /** 年龄 */
  age?: string;
}

export interface AppearanceTagGroups {
  hair: string[];
  face: string[];
  body: string[];
  clothing: string[];
  aura: string[];
  signature: string[];
}

export interface ImagePromptPair {
  en: string;
  zh: string;
}

export interface VisualDirection {
  colorPalette: string[];
  styleRef: string;
  lighting: string;
}

export interface CharacterAppearanceResponse {
  characterName: string;
  appearanceTags: AppearanceTagGroups;
  allTags: string[];
  imagePrompt: ImagePromptPair;
  visualDirection: VisualDirection;
  designNotes: string[];
}

// ==================== ENH-4: 分镜模板 ====================

export interface StoryboardTemplate {
  id: string;
  name: string;
  description: string;
  suitableScenes: string[];
  shotStructure: StoryboardShotDef[];
  exampleImagePrompt: ImagePromptPair;
}

export interface StoryboardShotDef {
  order: number;
  shotType: string;
  cameraMovement: string;
  description: string;
  durationHint: string;
}

export interface StoryboardTemplateListResponse {
  templates: StoryboardTemplate[];
  total: number;
  usageTip: string;
}

// ==================== ENH-5: SSE阶段进度推送 ====================

export interface StageProgress {
  stage: "storyboard_extraction" | "character_matching" | "scene_rendering" | "compositing";
  stageLabel: string;
  percentage: number;
  status: "pending" | "active" | "completed" | "failed";
  detail: string;
  timestamp: number;
}

export interface GenerationProgress {
  jobId: string;
  overallProgress: number;
  currentStage: string;
  stages: StageProgress[];
  estimatedRemaining: number;
}

// ==================== ENH-6: 受众细分标签 ====================

export interface AudienceSegmentRequest {
  /** 大类受众标签（如：年轻消费者） */
  parentTag: string;
  /** 附加上下文（产品/品牌信息） */
  context?: string;
}

export interface RecommendedTone {
  primary: string;
  secondary: string;
  dosNot: string[];
  donts: string[];
}

export interface AudienceSubSegment {
  tag: string;
  description: string;
  ageRange: string;
  interests: string[];
  painPoints: string[];
  recommendedTone: RecommendedTone;
  hookStyle: string;
  platformPreference: string[];
}

export interface ToneOverview {
  matrix: Record<string, number>;
  summary: string;
}

export interface PlatformAdvice {
  [platform: string]: string;
}

export interface AudienceSegmentResponse {
  parentTag: string;
  parentDescription: string;
  segments: AudienceSubSegment[];
  toneOverview: ToneOverview;
  globalKeywords: string[];
  platformAdvice: PlatformAdvice;
}

// ==================== ENH-7: 短视频脚本模板 ====================

export interface ScriptTemplateScene {
  time: string;
  action: string;
  text: string;
  visual: string;
}

export interface ScriptTemplateExample {
  title: string;
  scenes: ScriptTemplateScene[];
  tips: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  structure: string[];
  suitableCategories: string[];
  estimatedDuration: string;
  exampleScript: ScriptTemplateExample;
}

export interface ScriptTemplateListResponse {
  templates: ScriptTemplate[];
  total: number;
  updatedAt: string;
  usageTip: string;
}

// ==================== ENH-8: 批量生成任务队列 ====================

export interface BatchProductItem {
  /** 产品索引（客户端生成） */
  index: number;
  /** 产品名称 */
  productName: string;
  /** 产品主图URL */
  mainImageUrl?: string;
  /** 产品卖点 */
  sellingPoints?: string;
  /** 产品链接 */
  productUrl?: string;
}

export interface BatchGenerateRequest {
  /** 产品列表（最多20个） */
  products: BatchProductItem[];
  /** 目标平台 */
  platform: string;
  /** 品类 */
  category?: string;
  /** 脚本模板ID */
  scriptTemplateId?: string;
  /** 风格 */
  style?: string;
  /** 项目ID（可选） */
  projectId?: string;
}

export type BatchProductStatus = "queued" | "processing" | "completed" | "failed";

export interface BatchProductProgress {
  index: number;
  productName: string;
  status: BatchProductStatus;
  progress: number;
  error?: string;
  result?: unknown;
}

export interface BatchGenerateResponse {
  batchId: string;
  status: "accepted";
  totalProducts: number;
  createdAt: string;
  estimatedTotalTime: string;
}

export interface BatchStatusResponse {
  batchId: string;
  status: "processing" | "completed" | "partially_completed" | "failed";
  totalProducts: number;
  completedCount: number;
  failedCount: number;
  products: BatchProductProgress[];
  createdAt: string;
  updatedAt: string;
}

// ==================== ENH-9: 纯文案海报 ====================

export interface TextPosterRequest {
  /** 标题文案 */
  title: string;
  /** 副标题文案（可选） */
  subtitle?: string;
  /** 行动号召（可选） */
  cta?: string;
  /** 海报风格 */
  style: string;
  /** 品牌名（可选） */
  brandName?: string;
  /** 补充要求 */
  additionalNotes?: string;
}

export interface LayoutStrategy {
  type: string;
  description: string;
  visualFlow: string;
}

export interface FontStyle {
  titleFont: string;
  bodyFont: string;
  ctaFont: string;
}

export interface ColorRole {
  role: string;
  hex: string;
}

export interface DesignSystem {
  fontStyle: FontStyle;
  colorPalette: ColorRole[];
  textureAndDecoration: string[];
  whiteSpace: string;
}

export interface Composition {
  titlePlacement: string;
  subtitlePlacement: string;
  ctaPlacement: string;
  decorationPlacement: string;
}

export interface PosterVariant {
  name: string;
  difference: string;
  imagePrompt_zh: string;
}

export interface TextPosterResponse {
  layoutStrategy: LayoutStrategy;
  imagePrompt: ImagePromptPair;
  designSystem: DesignSystem;
  composition: Composition;
  variants: PosterVariant[];
  designNotes: string;
  usageTips: string;
}

// ==================== ENH-10: AI写词 ====================

export interface LyricsGenerateRequest {
  /** 创作主题 */
  theme: string;
  /** 关键词（可选） */
  keywords?: string;
  /** 情感方向 */
  emotion: string;
  /** 期望风格（可选） */
  style?: string;
  /** 篇幅：短/标准/完整 */
  length?: "short" | "medium" | "full";
}

export interface LyricsStructure {
  verse1: string;
  verse2: string;
  chorus: string;
  bridge: string;
}

export interface LyricsVersion {
  version: string;
  style: string;
  title: string;
  suggestedGenre: string;
  suggestedBpm: number;
  lyrics: LyricsStructure;
  hook: string;
  writingNote: string;
}

export interface LyricsGenerateResponse {
  theme: string;
  emotion: string;
  versions: LyricsVersion[];
  commonKeywords: string[];
  usageSuggestion: string;
}

// ==================== ENH-12: 多视角叙事 ====================

export interface PovProtagonist {
  name: string;
  role: string;
  povWeight: number;
  hasIndependentArc: boolean;
  arcSummary: string;
  povChapters: string;
}

export interface MultiPovDetectRequest {
  /** 故事大纲文本 */
  outline: string;
  /** 已知角色信息 */
  characters: string;
}

export interface MultiPovDetectResponse {
  detectedProtagonists: PovProtagonist[];
  multiPovFeasibility: "high" | "medium" | "low";
  recommendation: "alternating" | "parallel" | "split_arc" | "single";
  reasoning: string;
}

export type NarrativeMultiPovMode = "alternating" | "parallel" | "split_arc";

export interface MultiPovStructureRequest {
  /** 故事大纲 */
  outline: string;
  /** 角色与视角分配（用户确认后的方案） */
  characters: string;
  /** 视角分配方案描述 */
  povAssignments: string;
  /** 叙事模式 */
  mode: NarrativeMultiPovMode;
}

export interface PerspectiveMeta {
  characterName: string;
  color: string;
  chapterRange: string;
}

export interface PovChapter {
  number: number;
  title: string;
  perspective: string;
  summary: string;
  keyEvent: string;
  povReason: string;
  connectionHint: string;
}

export interface CrossoverPoint {
  chapters: number[];
  description: string;
}

export interface MultiPovStructureResponse {
  mode: string;
  perspectives: PerspectiveMeta[];
  chapters: PovChapter[];
  crossoverPoints: CrossoverPoint[];
  totalChapters: number;
  writingNotes: string;
}

// ==================== ENH-14: 参考视频风格提取 ====================

export interface VideoStyleExtractRequest {
  /** 视频链接URL */
  videoUrl?: string;
  /** 来源平台 */
  platform?: string;
  /** 视频描述或字幕文本（用户手动输入） */
  videoDescription?: string;
}

export interface PacingFeature {
  level: string;
  description: string;
  avgShotDuration: string;
  cutFrequency: string;
}

export interface ColorFeature {
  primary: string;
  secondary: string;
  accents: string[];
  toneStyle: string;
  saturation: string;
}

export interface TransitionFeature {
  primaryTypes: string[];
  frequency: string;
  description: string;
  segmentUsage: Record<string, string>;
}

export interface CopyToneFeature {
  style: string;
  voiceType: string;
  speed: string;
  personalityKeywords: string[];
  sentenceStyle: string;
}

export interface MusicStyleFeature {
  genre: string;
  mood: string;
  tempo: string;
  description: string;
}

export interface VisualElementFeature {
  techniques: string[];
  dominantElements: string[];
  description: string;
}

export interface VideoStyleExtractResponse {
  referenceUrl: string;
  platform: string;
  estimatedDuration: string;
  pacing: PacingFeature;
  color: ColorFeature;
  transitions: TransitionFeature;
  copyTone: CopyToneFeature;
  musicStyle: MusicStyleFeature;
  visualElements: VisualElementFeature;
  styleTags: string[];
  generationHints: string[];
  overallImpression: string;
}

// ==================== ENH-15: TTS配音+字幕同步 ====================

export interface TtsSubtitleRequest {
  /** 旁白文案 */
  narrationText: string;
  /** 语音角色 */
  voice?: string;
  /** 语速（正常=1.0） */
  speed?: number;
  /** 语调 */
  tone?: string;
  /** 项目ID（可选） */
  projectId?: string;
}

export interface SubtitleSegment {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
  charCount: number;
}

export interface TtsSubtitleResponse {
  /** 音频URL（ai-router TTS输出） */
  audioUrl: string;
  /** 音频总时长（秒） */
  audioDurationSeconds: number;
  /** 字幕段落列表 */
  segments: SubtitleSegment[];
  /** SRT格式字幕文本 */
  srtContent: string;
  /** 语音提供商 */
  ttsProvider: string;
  /** 使用的语音角色 */
  voice: string;
}

// ==================== ENH-17: 追踪标签生成 ====================

export interface VideoTrackingTagRequest {
  /** 视频标题/名称 */
  videoTitle: string;
  /** 目标平台 */
  platform?: string;
  /** 项目ID（可选） */
  projectId?: string;
}

export interface VideoTrackingTag {
  /** 唯一追踪ID */
  trackingId: string;
  /** 可粘贴到发布内容中的追踪链接 */
  trackingUrl: string;
  /** 可粘贴的追踪文本标签（如 #qianji_track_xxx） */
  trackingTag: string;
  /** 追踪参数（用于批量查询数据分析） */
  trackingParam: string;
  /** 创建时间 */
  createdAt: string;
}

export interface VideoTrackingTagResponse {
  videoTitle: string;
  platform: string;
  tracking: VideoTrackingTag;
  /** 发布时粘贴使用说明 */
  usageInstructions: string;
}

// ==================== ENH-20: BGM素材库查询 ====================

export interface BgmLibraryQueryRequest {
  /** 情绪筛选 */
  mood?: string;
  /** 最小时长（秒） */
  minDuration?: number;
  /** 最大时长（秒） */
  maxDuration?: number;
  /** 风格筛选 */
  style?: string;
  /** 分页偏移 */
  offset?: number;
  /** 分页大小（默认20） */
  limit?: number;
}

export interface BgmTrack {
  /** 音频资产ID */
  assetId: string;
  /** 曲名 */
  title: string;
  /** 时长（秒） */
  durationSeconds: number;
  /** 情绪标签 */
  mood: string;
  /** 次要情绪 */
  moodSecondary?: string;
  /** 风格标签 */
  style: string;
  /** BPM */
  bpm?: number;
  /** 调式 */
  key?: string;
  /** 乐器配置 */
  instruments?: string[];
  /** 音频URL */
  audioUrl?: string;
  /** 生成时间 */
  createdAt: string;
  /** 使用次数 */
  usageCount: number;
}

export interface BgmLibraryResponse {
  tracks: BgmTrack[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  /** 可用筛选维度 */
  filterOptions: {
    moods: string[];
    styles: string[];
  };
}
