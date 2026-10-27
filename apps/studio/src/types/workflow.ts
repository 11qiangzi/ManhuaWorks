// =============================================================================
// 工作流类型定义
// W5 任务 3：节点/连线/工作流核心类型
// =============================================================================

/** 节点端口（输入/输出） */
export interface NodePort {
  id: string
  label: string
  dataType: PortDataType
  required?: boolean
}

export type PortDataType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'json'
  | 'number'
  | 'boolean'
  | 'any'

/** 节点分类（决定调色板分组） */
export type NodeCategory =
  | 'input'      // 输入：文本/图像/资产
  | 'ai'         // AI：模型调用
  | 'logic'      // 逻辑：条件/循环/合并
  | 'transform'  // 转换：格式化/分割
  | 'output'     // 输出：保存/导出
  | 'control'    // 控制：并行/串行/延迟

/** 节点定义（模板，出现在面板） */
export interface NodeDefinition {
  type: string                    // 唯一类型 id
  category: NodeCategory
  label: string
  icon: string                    // emoji
  color: string                   // 主题色 token
  description: string
  inputs: NodePort[]
  outputs: NodePort[]
  defaultParams: Record<string, unknown>
  /** 节点尺寸（用于画布首次创建时） */
  size?: { width: number; height: number }
}

/** 画布上的节点实例 */
export interface WorkflowNode {
  id: string
  type: string                    // 对应 NodeDefinition.type
  position: { x: number; y: number }
  size: { width: number; height: number }
  params: Record<string, unknown>
  label?: string                  // 可重命名
  status?: NodeRuntimeStatus
}

export type NodeRuntimeStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped'

/** 节点运行时结果（运行后写入） */
export interface NodeRuntimeResult {
  status: NodeRuntimeStatus
  startedAt?: number
  finishedAt?: number
  output?: unknown
  error?: string
  costUsd?: number
  tokensIn?: number
  tokensOut?: number
}

/** 连线 */
export interface WorkflowEdge {
  id: string
  source: string                  // 源节点 id
  sourcePort: string              // 源端口 id
  target: string                  // 目标节点 id
  targetPort: string              // 目标端口 id
  /** 可选条件边（仅 logic/control 节点） */
  condition?: string
}

/** 工作流文档（可保存/加载） */
export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: Viewport
  createdAt: number
  updatedAt: number
  version: number
  tags?: string[]
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/** 运行/调试会话 */
export interface WorkflowRun {
  runId: string
  workflowId: string
  status: 'pending' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'
  startedAt: number
  finishedAt?: number
  nodeResults: Record<string, NodeRuntimeResult>
  totalCostUsd?: number
  error?: string
}

/** 调试事件（来自 ai-orchestrator WebSocket） */
export interface DebugEvent {
  type:
    | 'node-queued'
    | 'node-started'
    | 'node-progress'
    | 'node-finished'
    | 'node-error'
    | 'run-finished'
    | 'run-cancelled'
  runId: string
  nodeId?: string
  payload?: Record<string, unknown>
  timestamp: number
}

/** 历史记录命令（撤销/重做） */
export interface HistoryCommand {
  type:
    | 'add-node'
    | 'remove-node'
    | 'move-node'
    | 'update-node'
    | 'add-edge'
    | 'remove-edge'
    | 'batch'
  do: () => void
  undo: () => void
  label: string
  timestamp: number
}

/** 选中状态 */
export interface Selection {
  nodeIds: string[]
  edgeIds: string[]
}

/** 12 类节点模板（对应 NodePalette） */
export const NODE_DEFINITIONS: NodeDefinition[] = [
  // ----- input (3) -----
  {
    type: 'text-input',
    category: 'input',
    label: '文本输入',
    icon: '📝',
    color: 'blue',
    description: '手动输入文本（提示词/对白/旁白）',
    inputs: [],
    outputs: [{ id: 'out', label: '文本', dataType: 'text' }],
    defaultParams: { text: '', multiline: true },
    size: { width: 180, height: 80 },
  },
  {
    type: 'image-input',
    category: 'input',
    label: '图像输入',
    icon: '🖼️',
    color: 'blue',
    description: '上传或选择资产库的图像',
    inputs: [],
    outputs: [{ id: 'out', label: '图像', dataType: 'image' }],
    defaultParams: { source: 'upload', assetId: null },
    size: { width: 180, height: 80 },
  },
  {
    type: 'asset-input',
    category: 'input',
    label: '资产输入',
    icon: '📦',
    color: 'blue',
    description: '引用资产库（角色/场景/道具）',
    inputs: [],
    outputs: [
      { id: 'out', label: '资产', dataType: 'json' },
    ],
    defaultParams: { assetType: 'character', assetId: null },
    size: { width: 180, height: 80 },
  },

  // ----- ai (3 + 6 pipelines) -----
  {
    type: 'llm-generate',
    category: 'ai',
    label: 'LLM 生成',
    icon: '🧠',
    color: 'purple',
    description: '调大模型生成文本（剧本/对白/镜头描述）',
    inputs: [
      { id: 'prompt', label: '提示词', dataType: 'text', required: true },
    ],
    outputs: [
      { id: 'out', label: '文本', dataType: 'text' },
    ],
    defaultParams: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: '',
    },
    size: { width: 200, height: 120 },
  },
  {
    type: 'image-generate',
    category: 'ai',
    label: '图像生成',
    icon: '🎨',
    color: 'purple',
    description: '调扩散模型生成图像（线稿/上色）',
    inputs: [
      { id: 'prompt', label: '提示词', dataType: 'text', required: true },
      { id: 'ref', label: '参考图', dataType: 'image' },
    ],
    outputs: [
      { id: 'out', label: '图像', dataType: 'image' },
    ],
    defaultParams: {
      model: 'sdxl',
      steps: 30,
      guidance: 7.5,
      width: 1024,
      height: 1024,
    },
    size: { width: 200, height: 140 },
  },
  {
    type: 'image-edit',
    category: 'ai',
    label: '图像编辑',
    icon: '🪄',
    color: 'purple',
    description: '局部重绘/超分/上色',
    inputs: [
      { id: 'image', label: '原图', dataType: 'image', required: true },
      { id: 'mask', label: '蒙版', dataType: 'image' },
      { id: 'prompt', label: '提示词', dataType: 'text' },
    ],
    outputs: [
      { id: 'out', label: '图像', dataType: 'image' },
    ],
    defaultParams: { operation: 'inpaint', strength: 0.7 },
    size: { width: 200, height: 120 },
  },

  // ----- pipelines (6 — 真实 ai-orchestrator 管道节点) -----
  {
    type: 'translate',
    category: 'ai',
    label: '自动翻译',
    icon: '🌐',
    color: 'blue',
    description: 'ai-orchestrator auto-translate.refined pipeline — 12 语种 + 双语字幕',
    inputs: [
      { id: 'in', label: '源字幕', dataType: 'text' },
    ],
    outputs: [
      { id: 'out', label: '译文', dataType: 'json' },
    ],
    defaultParams: {
      sourceAssetId: '',
      subtitleSrt: '',
      targetLanguage: 'en',
      ttsProvider: 'edge-tts',
      qualityMode: 'balanced',
    },
    size: { width: 200, height: 120 },
  },
  {
    type: 'character-replace',
    category: 'ai',
    label: '角色替换',
    icon: '👤',
    color: 'purple',
    description: 'ai-orchestrator character-replace.refined pipeline — 跨镜头角色一致性',
    inputs: [
      { id: 'in', label: '目标资产', dataType: 'json' },
    ],
    outputs: [
      { id: 'out', label: '替换结果', dataType: 'json' },
    ],
    defaultParams: {
      targetAssetId: '',
      replacements: [],
      artStyle: 'manhua_chinese',
      styleKey: 'cinematic_dark',
      qualityMode: 'balanced',
    },
    size: { width: 200, height: 120 },
  },
  {
    type: 'episode-batch',
    category: 'ai',
    label: '分集批处理',
    icon: '📺',
    color: 'cyan',
    description: 'ai-orchestrator episode-batch.refined pipeline — 多集并行处理',
    inputs: [
      { id: 'in', label: '项目', dataType: 'json' },
    ],
    outputs: [
      { id: 'out', label: '集列表', dataType: 'json' },
    ],
    defaultParams: {
      projectId: '',
      episodes: [],
      qualityMode: 'balanced',
    },
    size: { width: 200, height: 120 },
  },
  {
    type: 'style-transfer',
    category: 'ai',
    label: '风格迁移',
    icon: '🎭',
    color: 'pink',
    description: 'ai-orchestrator style-transfer.refined pipeline — 12 艺术风格',
    inputs: [
      { id: 'in', label: '源资产', dataType: 'json' },
    ],
    outputs: [
      { id: 'out', label: '风格化结果', dataType: 'json' },
    ],
    defaultParams: {
      sourceAssetId: '',
      targetStyle: 'manhua_chinese',
      projectId: '',
    },
    size: { width: 200, height: 120 },
  },
  {
    type: 'novel-to-drama',
    category: 'ai',
    label: '小说转动画',
    icon: '🎬',
    color: 'amber',
    description: 'ai-orchestrator novel-to-drama.refined pipeline — 7 步全链路',
    inputs: [
      { id: 'in', label: '小说文本', dataType: 'text' },
    ],
    outputs: [
      { id: 'out', label: '动画', dataType: 'json' },
    ],
    defaultParams: {
      text: '',
      chapterTitle: '',
      storyType: 'urban_fantasy',
      artStyle: 'manhua_chinese',
      durationSeconds: 60,
      ttsProvider: 'edge-tts',
      projectId: '',
    },
    size: { width: 220, height: 140 },
  },
  {
    type: 'multi-character',
    category: 'ai',
    label: '多角色替换',
    icon: '👥',
    color: 'violet',
    description: 'ai-orchestrator multi-character-replace.refined pipeline — 场景/角色/道具批量',
    inputs: [
      { id: 'in', label: '目标资产', dataType: 'json' },
    ],
    outputs: [
      { id: 'out', label: '替换结果', dataType: 'json' },
    ],
    defaultParams: {
      targetAssetId: '',
      replacements: [],
      artStyle: 'manhua_chinese',
      projectId: '',
    },
    size: { width: 200, height: 120 },
  },

  // ----- logic (2) -----
  {
    type: 'condition',
    category: 'logic',
    label: '条件分支',
    icon: '🔀',
    color: 'amber',
    description: '基于表达式分支出 true/false',
    inputs: [
      { id: 'in', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'true', label: '真', dataType: 'any' },
      { id: 'false', label: '假', dataType: 'any' },
    ],
    defaultParams: { expression: 'input.length > 0' },
    size: { width: 180, height: 100 },
  },
  {
    type: 'merge',
    category: 'logic',
    label: '合并',
    icon: '🔗',
    color: 'amber',
    description: '合并多路输入为一个',
    inputs: [
      { id: 'a', label: 'A', dataType: 'any' },
      { id: 'b', label: 'B', dataType: 'any' },
    ],
    outputs: [
      { id: 'out', label: '合并', dataType: 'any' },
    ],
    defaultParams: { strategy: 'concat' },
    size: { width: 180, height: 100 },
  },

  // ----- transform (1) -----
  {
    type: 'prompt-template',
    category: 'transform',
    label: '提示词模板',
    icon: '📋',
    color: 'emerald',
    description: '用变量插值生成最终提示词',
    inputs: [
      { id: 'var1', label: '变量 1', dataType: 'text' },
      { id: 'var2', label: '变量 2', dataType: 'text' },
    ],
    outputs: [
      { id: 'out', label: '提示词', dataType: 'text' },
    ],
    defaultParams: { template: '{{var1}} 在 {{var2}} 场景中' },
    size: { width: 200, height: 120 },
  },

  // ----- output (2) -----
  {
    type: 'save-asset',
    category: 'output',
    label: '保存到资产库',
    icon: '💾',
    color: 'green',
    description: '保存到资产库（自动分类）',
    inputs: [
      { id: 'in', label: '输入', dataType: 'any', required: true },
    ],
    outputs: [
      { id: 'out', label: '资产 id', dataType: 'json' },
    ],
    defaultParams: { assetType: 'panel', tags: [] },
    size: { width: 180, height: 100 },
  },
  {
    type: 'export',
    category: 'output',
    label: '导出',
    icon: '📤',
    color: 'green',
    description: '导出为 ZIP/PDF/图片序列',
    inputs: [
      { id: 'in', label: '输入', dataType: 'any', required: true },
    ],
    outputs: [
      { id: 'out', label: '导出 url', dataType: 'text' },
    ],
    defaultParams: { format: 'zip', resolution: 300 },
    size: { width: 180, height: 100 },
  },

  // ----- control (1) -----
  {
    type: 'parallel',
    category: 'control',
    label: '并行执行',
    icon: '⚡',
    color: 'rose',
    description: '同时执行多条分支',
    inputs: [
      { id: 'in', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'a', label: '分支 A', dataType: 'any' },
      { id: 'b', label: '分支 B', dataType: 'any' },
    ],
    defaultParams: { mode: 'all' },
    size: { width: 180, height: 100 },
  },
]

/** 按 category 分组（用于调色板 UI） */
export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: '输入',
  ai: 'AI',
  logic: '逻辑',
  transform: '转换',
  output: '输出',
  control: '控制',
}

export const NODE_CATEGORY_ORDER: NodeCategory[] = [
  'input', 'ai', 'logic', 'transform', 'output', 'control',
]
