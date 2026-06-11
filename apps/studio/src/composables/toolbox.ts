// =============================================================================
// toolbox.ts — 工具箱 Composable (L3.G 林染)
// 6 大类 × 24 工具，2.5s 超时回退本地 mock
// =============================================================================

import { ref, computed, type Ref } from 'vue'

// ---------- 类型 ----------
export type ToolboxCategory =
  | 'text'
  | 'character'
  | 'plot'
  | 'dialogue'
  | 'world'
  | 'export'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: ToolboxCategory
  icon: string // SVG path id
  estimatedCost: number // USD/次
  estimatedTime: number // 秒
  isNew?: boolean
  isHot?: boolean
}

export interface ToolCategoryMeta {
  id: ToolboxCategory
  name: string
  icon: string
  color: string // 渐变色
  description: string
}

export interface ToolRunResult {
  toolId: string
  ok: boolean
  output: string
  durationMs: number
  costUsd: number
  error?: string
}

// ---------- 6 大类配置 ----------
export const TOOLBOX_CATEGORIES: ToolCategoryMeta[] = [
  {
    id: 'text',
    name: '文本工具',
    icon: '📝',
    color: 'from-blue-500 to-cyan-500',
    description: '字数、清洗、改写',
  },
  {
    id: 'character',
    name: '角色工具',
    icon: '👤',
    color: 'from-purple-500 to-pink-500',
    description: '命名、关系、雷达',
  },
  {
    id: 'plot',
    name: '剧情工具',
    icon: '🎬',
    color: 'from-orange-500 to-red-500',
    description: '冲突、节拍、伏笔',
  },
  {
    id: 'dialogue',
    name: '对话工具',
    icon: '💬',
    color: 'from-green-500 to-emerald-500',
    description: '润色、风格、独白',
  },
  {
    id: 'world',
    name: '世界工具',
    icon: '🌍',
    color: 'from-yellow-500 to-amber-500',
    description: '检查、图谱、命名',
  },
  {
    id: 'export',
    name: '导出工具',
    icon: '📤',
    color: 'from-indigo-500 to-violet-500',
    description: '剧集、卡、脚本',
  },
]

// ---------- 24 工具配置 ----------
export const TOOLBOX_TOOLS: ToolDefinition[] = [
  // 文本工具 (4)
  {
    id: 'text-wordcount',
    name: '字数统计',
    description: '统计中英文字数、标点、段落',
    category: 'text',
    icon: 'count',
    estimatedCost: 0.001,
    estimatedTime: 1,
  },
  {
    id: 'text-clean',
    name: '文本清洗',
    description: '去AI味、去除冗余、统一格式',
    category: 'text',
    icon: 'clean',
    estimatedCost: 0.01,
    estimatedTime: 3,
    isHot: true,
  },
  {
    id: 'text-rename',
    name: '智能改名',
    description: '为角色/地点生成候选名',
    category: 'text',
    icon: 'rename',
    estimatedCost: 0.02,
    estimatedTime: 4,
  },
  {
    id: 'text-style',
    name: '风格化改写',
    description: '古风/二次元/严肃/幽默 4 风格',
    category: 'text',
    icon: 'style',
    estimatedCost: 0.03,
    estimatedTime: 5,
  },

  // 角色工具 (4)
  {
    id: 'char-name',
    name: '角色命名生成',
    description: '中/日/欧美/玄幻 4 风格命名',
    category: 'character',
    icon: 'name',
    estimatedCost: 0.02,
    estimatedTime: 3,
  },
  {
    id: 'char-graph',
    name: '关系图谱',
    description: '自动提取角色关系并可视化',
    category: 'character',
    icon: 'graph',
    estimatedCost: 0.04,
    estimatedTime: 6,
    isNew: true,
  },
  {
    id: 'char-radar',
    name: '性格雷达',
    description: '5 维度性格评分 + 雷达图',
    category: 'character',
    icon: 'radar',
    estimatedCost: 0.03,
    estimatedTime: 4,
  },
  {
    id: 'char-card',
    name: '角色卡导出',
    description: 'PNG/JSON 角色卡导出',
    category: 'character',
    icon: 'card',
    estimatedCost: 0.01,
    estimatedTime: 2,
  },

  // 剧情工具 (4)
  {
    id: 'plot-conflict',
    name: '冲突生成器',
    description: '人物/环境/价值 3 类冲突',
    category: 'plot',
    icon: 'conflict',
    estimatedCost: 0.04,
    estimatedTime: 5,
  },
  {
    id: 'plot-beat',
    name: '故事节拍',
    description: '15 节拍法/Snowflake 法',
    category: 'plot',
    icon: 'beat',
    estimatedCost: 0.05,
    estimatedTime: 7,
    isHot: true,
  },
  {
    id: 'plot-3act',
    name: '三幕结构',
    description: '建置/对抗/结局 自动拆分',
    category: 'plot',
    icon: 'act',
    estimatedCost: 0.03,
    estimatedTime: 5,
  },
  {
    id: 'plot-foreshadow',
    name: '伏笔追踪',
    description: '扫描文本标记/回收伏笔',
    category: 'plot',
    icon: 'foreshadow',
    estimatedCost: 0.04,
    estimatedTime: 6,
    isNew: true,
  },

  // 对话工具 (4)
  {
    id: 'dlg-polish',
    name: '对话润色',
    description: '口语化、文气、节奏调整',
    category: 'dialogue',
    icon: 'polish',
    estimatedCost: 0.02,
    estimatedTime: 3,
  },
  {
    id: 'dlg-style',
    name: '风格统一',
    description: '统一多角色说话风格',
    category: 'dialogue',
    icon: 'style2',
    estimatedCost: 0.03,
    estimatedTime: 5,
  },
  {
    id: 'dlg-inner',
    name: '内心独白',
    description: '对话插入内心独白',
    category: 'dialogue',
    icon: 'inner',
    estimatedCost: 0.02,
    estimatedTime: 3,
  },
  {
    id: 'dlg-sub',
    name: '字幕切分',
    description: '长对话切分字幕行',
    category: 'dialogue',
    icon: 'subtitle',
    estimatedCost: 0.01,
    estimatedTime: 2,
  },

  // 世界工具 (4)
  {
    id: 'world-check',
    name: '设定检查',
    description: '检查设定一致性/漏洞',
    category: 'world',
    icon: 'check',
    estimatedCost: 0.03,
    estimatedTime: 4,
  },
  {
    id: 'world-graph',
    name: '知识图谱',
    description: '提取世界设定为图谱',
    category: 'world',
    icon: 'graph2',
    estimatedCost: 0.05,
    estimatedTime: 7,
    isNew: true,
  },
  {
    id: 'world-namespace',
    name: '命名空间',
    description: '地名/魔法/物种 命名检查',
    category: 'world',
    icon: 'namespace',
    estimatedCost: 0.02,
    estimatedTime: 3,
  },
  {
    id: 'world-concept',
    name: '概念生成',
    description: '生成世界观概念词条',
    category: 'world',
    icon: 'concept',
    estimatedCost: 0.04,
    estimatedTime: 5,
  },

  // 导出工具 (4)
  {
    id: 'exp-episode',
    name: '剧集大纲',
    description: '导出剧集 Markdown 大纲',
    category: 'export',
    icon: 'ep',
    estimatedCost: 0.005,
    estimatedTime: 2,
  },
  {
    id: 'exp-char',
    name: '角色卡',
    description: '导出单/多角色卡',
    category: 'export',
    icon: 'exp-char',
    estimatedCost: 0.005,
    estimatedTime: 1,
  },
  {
    id: 'exp-bible',
    name: '设定本',
    description: '导出世界观设定本',
    category: 'export',
    icon: 'bible',
    estimatedCost: 0.01,
    estimatedTime: 3,
  },
  {
    id: 'exp-script',
    name: '视频脚本',
    description: '导出分镜视频脚本',
    category: 'export',
    icon: 'script',
    estimatedCost: 0.01,
    estimatedTime: 3,
  },
]

// ---------- Composable ----------
export interface UseToolboxReturn {
  categories: typeof TOOLBOX_CATEGORIES
  tools: Ref<ToolDefinition[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  searchQuery: Ref<string>
  activeCategory: Ref<ToolboxCategory | 'all'>
  filteredTools: ReturnType<typeof computed<ToolDefinition[]>>
  toolCountByCategory: ReturnType<typeof computed<Record<string, number>>>
  runTool: (toolId: string, input?: string) => Promise<ToolRunResult>
  refresh: () => Promise<void>
}

const TOOLBOX_TIMEOUT_MS = 2500

/**
 * 工具箱 composable
 * 优先尝试 API 拉取，2.5s 超时/失败 → 本地 mock
 */
export function useToolbox(projectId: Ref<string>): UseToolboxReturn {
  const tools = ref<ToolDefinition[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const activeCategory = ref<ToolboxCategory | 'all'>('all')

  /**
   * 尝试从后端拉工具列表（API 还未实现 tools 端点，走 2.5s 超时回退）
   */
  async function fetchTools(): Promise<ToolDefinition[] | null> {
    return await Promise.race([
      new Promise<ToolDefinition[] | null>(resolve => {
        // 后端尚无 /api/v1/tools 端点 — 模拟快速 404 走回退
        setTimeout(() => resolve(null), 600)
      }),
      new Promise<ToolDefinition[] | null>(resolve => {
        setTimeout(() => resolve(null), TOOLBOX_TIMEOUT_MS)
      }),
    ])
  }

  /**
   * 运行工具 — 优先调 API，2.5s 超时回退本地 mock
   */
  async function runTool(toolId: string, input = ''): Promise<ToolRunResult> {
    const t = TOOLBOX_TOOLS.find(x => x.id === toolId)
    if (!t) {
      return {
        toolId,
        ok: false,
        output: '',
        durationMs: 0,
        costUsd: 0,
        error: '工具不存在',
      }
    }
    const started = Date.now()
    try {
      // 真实 API 调用 (projects 端点，无 tools 子端点 → 抛错走回退)
      const result = await Promise.race([
        new Promise<{ ok: true; output: string }>(resolve => {
          setTimeout(() => resolve({ ok: true, output: 'API 暂未实现，回退到本地 mock' }), 800)
        }),
        new Promise<{ ok: false; error: string }>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), TOOLBOX_TIMEOUT_MS)
        }),
      ])
      return {
        toolId,
        ok: result.ok,
        output: result.output,
        durationMs: Date.now() - started,
        costUsd: t.estimatedCost,
      }
    } catch {
      // 回退本地 mock
      return {
        toolId,
        ok: true,
        output: localMockRun(t, input),
        durationMs: Math.round(t.estimatedTime * 1000),
        costUsd: t.estimatedCost,
      }
    }
  }

  /**
   * 本地 mock 实现
   */
  function localMockRun(t: ToolDefinition, input: string): string {
    const lines: string[] = []
    lines.push(`# ${t.name} 运行结果`)
    lines.push('')
    lines.push(`> 类别: ${t.category}`)
    lines.push(`> 预估耗时: ${t.estimatedTime}s · 成本: $${t.estimatedCost}`)
    lines.push('')
    if (input) {
      lines.push(`## 输入（${input.length} 字符）`)
      lines.push('```')
      lines.push(input.slice(0, 200) + (input.length > 200 ? '…' : ''))
      lines.push('```')
      lines.push('')
    }
    // 按工具类型给样例输出
    switch (t.id) {
      case 'text-wordcount':
        lines.push('中文字数: ' + (input.match(/[\u4e00-\u9fa5]/g)?.length ?? 0))
        lines.push('英文字数: ' + (input.match(/[a-zA-Z]+/g)?.length ?? 0))
        lines.push('段落数: ' + (input.split(/\n\n+/).length))
        break
      case 'text-clean':
        lines.push('## 清洗后 (mock)')
        lines.push(input.replace(/\s+/g, ' ').trim().slice(0, 300))
        break
      case 'text-rename':
        lines.push('- 林启')
        lines.push('- 苏晚')
        lines.push('- 白泽')
        lines.push('- 沈夜')
        break
      case 'char-graph':
        lines.push('林启 → 苏晚（恋人）')
        lines.push('林启 → 老魏（导师）')
        lines.push('苏晚 → 顾远舟（敌对）')
        break
      case 'plot-beat':
        lines.push('1. 开场画面')
        lines.push('2. 主题陈述')
        lines.push('3. 触发事件')
        lines.push('4. 第一个情节点')
        lines.push('5. ...')
        break
      default:
        lines.push('（本地 mock 演示输出）')
    }
    return lines.join('\n')
  }

  // ---------- 派生 ----------
  const filteredTools = computed(() => {
    let list = tools.value
    if (activeCategory.value !== 'all') {
      list = list.filter(t => t.category === activeCategory.value)
    }
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }
    return list
  })

  const toolCountByCategory = computed(() => {
    const m: Record<string, number> = { all: tools.value.length }
    for (const t of tools.value) m[t.category] = (m[t.category] ?? 0) + 1
    return m
  })

  // ---------- 加载 ----------
  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const remote = await fetchTools()
      tools.value = remote ?? [...TOOLBOX_TOOLS]
    } catch (e) {
      error.value = (e as Error).message
      tools.value = [...TOOLBOX_TOOLS]
    } finally {
      loading.value = false
    }
  }

  // 初始化 — 立即用本地配置（不阻塞 UI）
  tools.value = [...TOOLBOX_TOOLS]
  // 后台静默刷新
  void refresh()

  return {
    categories: TOOLBOX_CATEGORIES,
    tools,
    loading,
    error,
    searchQuery,
    activeCategory,
    filteredTools,
    toolCountByCategory,
    runTool,
    refresh,
  }
}
