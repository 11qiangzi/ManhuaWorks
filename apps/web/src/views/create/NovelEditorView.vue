<script setup lang="ts">
/**
 * NovelEditorView.vue - 故事生成器（结构化输出版本）
 *
 * 三步流程：
 *   Step 1 - 输入故事（大纲/模板/AI灵感）
 *   Step 2 - AI生成结构化故事（章节/角色/场景）
 *   Step 3 - 导出 + 联动动画生成器
 */

import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { generateText } from '@/api/ai-router'
import { getApi } from '@/api-bridge'

const hasStarted = ref(true)

const router = useRouter()
const route = useRoute()

/* ================================================================== */
/*  素材归属项目选择器                                                   */
/*  创作模块路由不带 :id，需用真实项目 id 才能把人物/场景引用落到正确项目 */
/* ================================================================== */

const projectId = computed(() => (route.params.id as string) || '1')

const projectOptions = ref<{ id: string; title: string }[]>([])
const selectedProjectId = ref<string>('')
const projectLoading = ref(false)
const projectError = ref('')

async function loadProjectOptions() {
  projectLoading.value = true
  projectError.value = ''
  try {
    const api = getApi()
    const resp = await api.http.get<any>('/api/v1/projects')
    const list = Array.isArray(resp)
      ? resp
      : (resp?.items ?? resp?.list ?? (Array.isArray(resp?.data) ? resp.data : []) ?? [])
    projectOptions.value = (list as any[]).map((p: any) => ({
      id: p.id,
      title: p.title || p.name || String(p.id),
    }))
    if (!selectedProjectId.value && projectOptions.value.length > 0) {
      selectedProjectId.value = projectOptions.value[0].id
    }
    // 选项就绪后自动加载该项目的素材库（供后续章节自动引用）
    await loadLibraryForProject()
  } catch (e: any) {
    projectError.value = `项目加载失败：${e?.message || '未知错误'}`
  } finally {
    projectLoading.value = false
  }
}

/** 实际用于落库/引用的项目 id（优先下拉选中，回退路由 id；'1' 视为无效） */
function effectiveProjectId(): string {
  const pid = selectedProjectId.value || projectId.value
  return pid && pid !== '1' ? pid : ''
}

function onProjectChange() {
  loadLibraryForProject()
}

/* ================================================================== */
/*  全局步骤状态                                                         */
/* ================================================================== */

const currentStep = ref<1 | 2 | 3 | 4>(1)
const storyTitle = ref('未命名故事')

// ENH-1: 预览确认页状态
const showPreviewConfirm = ref(false)
const previewExpandedSections = ref<string[]>(['outline', 'characters', 'scenes', 'style'])

function togglePreviewSection(section: string) {
  const idx = previewExpandedSections.value.indexOf(section)
  if (idx > -1) previewExpandedSections.value.splice(idx, 1)
  else previewExpandedSections.value.push(section)
}

function isPreviewSectionExpanded(section: string): boolean {
  return previewExpandedSections.value.includes(section)
}

const worldSetting = ref('')
const stylePref = ref('')

// ENH-12: 叙事视角切换
const narrativePerspective = ref<'single' | 'dual' | 'multi'>('single')
const PERSPECTIVE_OPTIONS = [
  { id: 'single' as const, icon: '👤', label: '单主角视角', desc: '围绕单一主角展开叙事，最传统的小说结构', checked: true },
  { id: 'dual' as const, icon: '👥', label: '双主角交替', desc: '两个主角各自展开故事线，章与章交替叙述', checked: false },
  { id: 'multi' as const, icon: '👥+', label: '多主角并行', desc: '三个或以上主角线交叉展开，宏大叙事结构', checked: false },
]

/* ================================================================== */
/*  Step 1: 输入故事                                                     */
/* ================================================================== */

const STORY_TEMPLATES = [
  {
    key: 'romance',
    label: '甜宠爱情',
    description: '青梅竹马/霸道总裁/甜蜜邂逅，适合轻松浪漫的漫画故事',
    starter:
      '夏日的午后，苏晚晴在大学图书馆里翻找着一本绝版诗集。当她终于伸手去够最高层的那本书时，一只修长的手先她一步将书取了下来。\n\n"这本书我找了一整个学期。"她抬起头，对上了一双深邃如潭的眼睛。\n\n顾衍之微微挑眉，"这么巧，我也是。"\n\n他们不知道的是，这本诗集里夹着一封三十年前的情书，而这段缘分的开始，远比他们想象的更早……',
  },
  {
    key: 'fantasy',
    label: '都市奇幻',
    description: '超能力觉醒/异能世界/隐藏身份，适合热血战斗类漫画',
    starter:
      '凌晨三点，城市的霓虹灯依然闪烁。快递员林昊在送最后一单快递时，发现包裹开始发出诡异的蓝光。\n\n他本想把包裹直接送到收件地址就赶紧回家，但当他的手指触碰到包裹的瞬间，一道电流般的力量涌入了他的身体。\n\n"叮——系统绑定成功。宿主已觉醒【时间回溯】能力。"\n\n脑海中响起一个冰冷的机械声音。林昊低头看着自己的双手，指尖正闪烁着微弱的金色光芒。\n\n就在这时，他看到了新闻推送——明天，这座城市将迎来一场前所未有的灾难……',
  },
  {
    key: 'mystery',
    label: '悬疑推理',
    description: '连环谜案/密室逃脱/天才侦探，适合烧脑悬疑类漫画',
    starter:
      '"第七具尸体出现了。"法医助手周然的声音微微发抖。\n\n刑警队长沈夜站在案发现场，面无表情地审视着房间里的每一个细节。和前六起案件一样——死者面带微笑，左手握着一朵白色玫瑰，桌上放着一杯已经冷掉的红茶。\n\n"时间呢？"\n\n"死亡时间大约在凌晨两点到三点之间。和之前一样，死因不明。"\n\n沈夜蹲下身，仔细观察死者右手边的地板。那里用指甲刻着一个数字——"3"。\n\n"这不是第三个。"他站起身，"这是倒计时。还有四个人。"',
  },
] as const

const storyInput = ref('')
const selectedTemplate = ref<string | null>(null)
const generatingInspiration = ref(false)

// ENH-2: 参考作品输入
const refWorksLink = ref('')
const refWorksDesc = ref('')
const analyzingStyle = ref(false)
const analyzedStyle = ref('')
const showRefWorks = ref(false)

async function analyzeStyle() {
  if (!refWorksLink.value.trim() && !refWorksDesc.value.trim()) return
  analyzingStyle.value = true
  try {
    const result = await generateText({
      prompt: `分析以下参考作品的风格特征（节奏、文风、叙事视角、情感基调），请用3-5个关键词+简短说明的形式输出：
链接/书名：${refWorksLink.value || '未提供'}
描述：${refWorksDesc.value || '未提供'}`,
      systemPrompt: '你是文学风格分析专家，擅长提取作品的写作风格特征。',
      maxTokens: 300,
    })
    analyzedStyle.value = result.trim()
  } catch {
    analyzedStyle.value = '分析失败，请稍后重试'
  } finally {
    analyzingStyle.value = false
  }
}

const storyInputLength = computed(() => storyInput.value.length)

function selectTemplate(key: string) {
  if (selectedTemplate.value === key) {
    selectedTemplate.value = null
    return
  }
  selectedTemplate.value = key
  const tpl = STORY_TEMPLATES.find((t) => t.key === key)
  if (tpl && !storyInput.value.trim()) {
    storyInput.value = tpl.starter
  }
}

async function generateInspiration() {
  generatingInspiration.value = true
  try {
    const result = await generateText({
      prompt: '请为我生成一个有趣的创意故事开头（200字以内），可以是都市奇幻、悬疑推理或甜宠爱情类型。只需要故事开头，不需要额外说明。',
      systemPrompt: '你是一位创意写作专家，擅长产出引人入胜的故事开头。',
      maxTokens: 500,
    })
    storyInput.value = result.trim()
  } catch {
    // fallback: 随机模板
    const starters = [
      '在一个所有人都能听到心声的世界里，少年白夜是唯一一个"沉默"的人。他听不到别人的心声，也没有人能听到他的。直到有一天，他在废弃的天文台里遇到了一个同样"沉默"的少女……',
      '2087年，虚拟现实游戏《深渊》席卷全球。职业玩家叶寒在攻略最终Boss时，发现游戏里的NPC竟然开始向现实世界发送求救信号。而当他摘下VR头盔的那一刻，发现自己已经分不清现实与虚拟的边界……',
      '老城区的第七号照相馆已经营业了六十年，但从来没有人见过老板的样子。每一张从这里洗出的照片，都会在三天后成真。大学生方小渡偶然得到了一张照片——照片上是他自己的葬礼……',
      '她是帝国最年轻的将军，他是敌国送来的人质皇子。当战火席卷大陆，他们被迫站在对立面。但在硝烟弥漫的战场上，两颗心却不知不觉靠近了……',
    ]
    storyInput.value = starters[Math.floor(Math.random() * starters.length)]
  } finally {
    generatingInspiration.value = false
  }
}

async function goToStep2() {
  if (!storyInput.value.trim()) return
  generatingStory.value = true
  try {
    const prompt = `请将以下故事内容扩展为结构化故事数据。请严格按JSON格式返回，包含以下字段：
- title: 故事标题
- chapters: 章节数组，每个章节含 title、summary、mood(情绪标签)
- characters: 角色数组，每个角色含 name、description(外貌描述)、personality(性格)
- scenes: 场景数组，每个场景含 name、description(环境描述)、atmosphere(光线氛围)

故事内容：
${storyInput.value.trim().slice(0, 8000)}`

    const result = await generateText({
      prompt,
      systemPrompt: '你是一位专业的小说结构师，擅长将故事拆解为结构化的章节、角色和场景数据。',
      maxTokens: 4096,
    })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      storyTitle.value = data.title || '未命名故事'
      chapters.value = data.chapters || []
      characters.value = data.characters || []
      scenes.value = data.scenes || []
    } else {
      await generateStructuredStory()
    }
  } catch {
    await generateStructuredStory()
  } finally {
    generatingStory.value = false
    currentStep.value = 2
  }
}

const generatingStory = ref(false)

/* ================================================================== */
/*  Step 2: 结构化故事数据                                               */
/* ================================================================== */

// ---- 常量 ----

const MOOD_OPTIONS = ['紧张', '温馨', '战斗', '悲伤', '欢快', '悬疑', '史诗', '科幻'] as const
const MOOD_COLORS: Record<string, string> = {
  紧张: '#EF4444',
  温馨: '#F59E0B',
  战斗: '#DC2626',
  悲伤: '#3B82F6',
  欢快: '#10B981',
  悬疑: '#7C3AED',
  史诗: '#F97316',
  科幻: '#06B6D4',
}

const ARCHETYPE_OPTIONS = ['英雄', '反派', '导师', '伙伴', '爱人', '旁观者'] as const
const ARCHETYPE_ICONS: Record<string, string> = {
  英雄: '⚔️',
  反派: '🔥',
  导师: '📖',
  伙伴: '🤝',
  爱人: '❤️',
  旁观者: '👁️',
}

// ---- 数据类型 ----

interface StoryChapter {
  id: number
  number: number
  title: string
  content: string
  mood: string
}

interface StoryCharacter {
  id: number
  name: string
  archetype: string
  appearance: string
  personality: string
  imagePrompt: string
  referenceImage: string | null
  generatingPrompt: boolean
}

interface StoryScene {
  id: number
  name: string
  location: string
  atmosphere: string
  imagePrompt: string
  referenceImage: string | null
  generatingPrompt: boolean
}

// ---- 数据 ----

const chapters = ref<StoryChapter[]>([])
const characters = ref<StoryCharacter[]>([])
const scenes = ref<StoryScene[]>([])

const activeTab = ref<'chapters' | 'characters' | 'scenes'>('chapters')

let nextChapterId = 1
let nextCharacterId = 1
let nextSceneId = 1

// ---- 素材库引用上下文（合并「素材库」+「小说自身」，按名称去重） ----
// 用途：后续章节正文生成时自动引用前面已保存的人物/场景，调用不对用户可手动改

const libCharacters = ref<{ id: string; name: string; description: string }[]>([])
const libScenes = ref<{ id: string; name: string; description: string }[]>([])
const libLoading = ref(false)

/** 从选中项目加载素材库人物/场景（供后续章节自动引用） */
async function loadLibraryForProject() {
  const pid = effectiveProjectId()
  libCharacters.value = []
  libScenes.value = []
  if (!pid) return
  libLoading.value = true
  try {
    const { useCharacterStore } = await import('@/stores/characterStore')
    const { useSceneStore } = await import('@/stores/sceneStore')
    const charStore = useCharacterStore()
    const sceneStore = useSceneStore()
    await charStore.load(pid, [])
    await sceneStore.load(pid, [])
    libCharacters.value = charStore.characters.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: (c.description || '') as string,
    }))
    libScenes.value = sceneStore.scenes.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: (s.description || '') as string,
    }))
  } catch (e) {
    console.warn('[引用] 素材库加载失败（可忽略，将仅使用小说自身设定）:', e)
  } finally {
    libLoading.value = false
  }
}

interface RefItem {
  key: string
  kind: 'character' | 'scene'
  name: string
  description: string
  source: 'library' | 'novel'
}

const refItems = computed<RefItem[]>(() => {
  const map = new Map<string, RefItem>()
  const add = (kind: 'character' | 'scene', name: string, description: string, source: 'library' | 'novel') => {
    const key = `${kind}:${name}`
    if (name && !map.has(key)) map.set(key, { key, kind, name, description, source })
  }
  libCharacters.value.forEach((c) => add('character', c.name, c.description, 'library'))
  libScenes.value.forEach((s) => add('scene', s.name, s.description, 'library'))
  characters.value.forEach((c) => add('character', c.name, c.appearance || c.personality, 'novel'))
  scenes.value.forEach((s) => add('scene', s.name, s.location || s.atmosphere, 'novel'))
  return Array.from(map.values())
})

// 选中状态：默认全选（全自动），可手动取消（全自动可关）
const selectedRefKeys = ref<Set<string>>(new Set())
const refAutoMode = ref(true)
const refPanelOpen = ref(true)

watch(refItems, (items) => {
  if (refAutoMode.value) selectedRefKeys.value = new Set(items.map((i) => i.key))
}, { deep: true })

function toggleRefAuto() {
  refAutoMode.value = !refAutoMode.value
  if (refAutoMode.value) selectedRefKeys.value = new Set(refItems.value.map((i) => i.key))
}
function isRefSelected(key: string) { return selectedRefKeys.value.has(key) }
function toggleRef(key: string) {
  const s = new Set(selectedRefKeys.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  selectedRefKeys.value = s
}
const selectedRefs = computed(() => refItems.value.filter((i) => selectedRefKeys.value.has(i.key)))

/** 把选中的引用拼成 prompt 上下文（人物/场景名+描述） */
function buildReferenceContextText(): string {
  const chars = selectedRefs.value.filter((r) => r.kind === 'character')
  const scns = selectedRefs.value.filter((r) => r.kind === 'scene')
  const parts: string[] = []
  if (chars.length) parts.push('【已有人物设定（请严格复用，保持一致性）】\n' + chars.map((c) => `- ${c.name}：${c.description}`).join('\n'))
  if (scns.length) parts.push('【已有场景设定（请严格复用，保持一致性）】\n' + scns.map((s) => `- ${s.name}：${s.description}`).join('\n'))
  return parts.join('\n\n')
}

// ---- 章节正文生成（注入选中引用，保证与素材库一致） ----
const chapterGenerating = ref<Record<number, boolean>>({})

async function generateChapter(ch: StoryChapter) {
  chapterGenerating.value = { ...chapterGenerating.value, [ch.id]: true }
  try {
    const ctx = buildReferenceContextText()
    const prompt = `请为漫画小说写作「${ch.title}」的完整正文（中文，不少于400字，有画面感，适合漫画分镜节奏）。
情绪基调：${ch.mood}
${ctx ? '请严格复用以下已有设定，保持人物性格与场景描写一致：\n' + ctx + '\n' : ''}
故事背景参考：${storyInput.value.trim().slice(0, 1500)}`
    const result = await generateText({
      prompt,
      systemPrompt: '你是一位专业漫画小说编剧，擅长把设定转化为有画面感、节奏紧凑的正文，并严格保持与已有设定的连续性。',
      maxTokens: 1400,
    })
    ch.content = result.trim()
  } catch (err) {
    console.error('[generateChapter] 生成失败:', err)
  } finally {
    chapterGenerating.value = { ...chapterGenerating.value, [ch.id]: false }
  }
}

// ---- 生成结构化故事（AI） ----

async function generateStructuredStory() {
  const ctx = buildReferenceContextText()
  const prompt = `请根据以下故事内容，生成结构化故事数据。请严格按JSON格式返回，包含以下字段：
- title: 故事标题
- chapters: 章节数组，每个章节含 title（标题）、content（内容，至少100字）、mood（情绪标签，从以下选取：紧张/温馨/战斗/悲伤/欢快/悬疑/史诗/科幻）
- characters: 角色数组（至少3个），每个角色含 name（名字）、archetype（原型：英雄/反派/导师/伙伴/爱人/旁观者）、appearance（外貌描述）、personality（性格描述）
- scenes: 场景数组（至少2个），每个场景含 name（场景名）、location（环境描述）、atmosphere（光线氛围描述）

${ctx ? '【已有素材库设定，请优先复用这些人物/场景，保持一致性，不要凭空新增同名冲突设定】\n' + ctx + '\n' : ''}
故事内容：
${storyInput.value.trim().slice(0, 6000)}`

  try {
    const result = await generateText({
      prompt,
      systemPrompt: '你是一位专业的小说结构师，擅长将故事拆解为结构化的章节、角色和场景数据。请只返回JSON，不要包含其他文字。',
      maxTokens: 4096,
    })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      storyTitle.value = data.title || storyTitle.value

      if (Array.isArray(data.chapters)) {
        chapters.value = data.chapters.map((ch: any, idx: number) => ({
          id: nextChapterId++,
          number: idx + 1,
          title: ch.title || `第${idx + 1}章`,
          content: ch.content || '',
          mood: ch.mood || '紧张',
        }))
      }

      if (Array.isArray(data.characters)) {
        characters.value = data.characters.map((char: any) => ({
          id: nextCharacterId++,
          name: char.name || '未命名角色',
          archetype: char.archetype || '伙伴',
          appearance: char.appearance || '',
          personality: char.personality || '',
          imagePrompt: '',
          referenceImage: null,
          generatingPrompt: false,
        }))
      }

      if (Array.isArray(data.scenes)) {
        scenes.value = data.scenes.map((scene: any) => ({
          id: nextSceneId++,
          name: scene.name || '未命名场景',
          location: scene.location || '',
          atmosphere: scene.atmosphere || '',
          imagePrompt: '',
          referenceImage: null,
          generatingPrompt: false,
        }))
      }
    }
  } catch (err) {
    console.error('[generateStructuredStory] AI 生成失败:', err)
    // 最小 fallback：用输入文本创建一个单章节结构
    chapters.value = [{
      id: nextChapterId++,
      number: 1,
      title: '第一章',
      content: storyInput.value,
      mood: '紧张',
    }]
  }
}

// ---- 章节操作 ----

function addChapter() {
  const num = chapters.value.length + 1
  chapters.value.push({
    id: nextChapterId++,
    number: num,
    title: `第${num}章：未命名`,
    content: '',
    mood: '温馨',
  })
}

function removeChapter(id: number) {
  const idx = chapters.value.findIndex((c) => c.id === id)
  if (idx === -1 || chapters.value.length <= 1) return
  chapters.value.splice(idx, 1)
  renumberChapters()
}

function moveChapter(id: number, direction: 'up' | 'down') {
  const idx = chapters.value.findIndex((c) => c.id === id)
  if (idx === -1) return
  if (direction === 'up' && idx > 0) {
    ;[chapters.value[idx - 1], chapters.value[idx]] = [chapters.value[idx], chapters.value[idx - 1]]
  } else if (direction === 'down' && idx < chapters.value.length - 1) {
    ;[chapters.value[idx], chapters.value[idx + 1]] = [chapters.value[idx + 1], chapters.value[idx]]
  }
  renumberChapters()
}

function renumberChapters() {
  chapters.value.forEach((ch, i) => {
    ch.number = i + 1
  })
}

function chapterWordCount(content: string): number {
  return content.replace(/\s/g, '').length
}

// ---- 角色操作 ----

function addCharacter() {
  characters.value.push({
    id: nextCharacterId++,
    name: '新角色',
    archetype: '旁观者',
    appearance: '',
    personality: '',
    imagePrompt: '',
    referenceImage: null,
    generatingPrompt: false,
  })
}

function removeCharacter(id: number) {
  const idx = characters.value.findIndex((c) => c.id === id)
  if (idx !== -1) characters.value.splice(idx, 1)
}

async function generateCharacterPrompt(char: StoryCharacter) {
  char.generatingPrompt = true
  try {
    const result = await generateText({
      prompt: `为以下角色生成一段高质量的图片提示词（英文），用于AI绘画工具。要求：动漫/漫画风格，包含外貌特征、服装、姿态、表情、光线等细节。

角色名：${char.name}
原型：${char.archetype || '未设定'}
外貌描述：${char.appearance || '未描述'}
性格：${char.personality || '未描述'}

请直接输出提示词，不要包含其他说明文字。`,
      systemPrompt: '你是一位专业的AI绘画提示词专家，擅长生成高质量的角色画像提示词。请直接输出英文提示词。',
      maxTokens: 500,
    })
    char.imagePrompt = result.trim()
  } catch (err) {
    console.error('[generateCharacterPrompt] 生成失败:', err)
    char.imagePrompt = `Anime style character portrait of ${char.name}. Appearance: ${char.appearance || '未描述'}. Personality: ${char.personality || '未描述'}. Archetype: ${char.archetype}. High quality, detailed illustration, manga art style, cinematic lighting.`
  } finally {
    char.generatingPrompt = false
  }
}

function handleCharacterImageUpload(char: StoryCharacter, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      char.referenceImage = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// ---- 场景操作 ----

function addScene() {
  scenes.value.push({
    id: nextSceneId++,
    name: '新场景',
    location: '',
    atmosphere: '',
    imagePrompt: '',
    referenceImage: null,
    generatingPrompt: false,
  })
}

function removeScene(id: number) {
  const idx = scenes.value.findIndex((s) => s.id === id)
  if (idx !== -1) scenes.value.splice(idx, 1)
}

async function generateScenePrompt(scene: StoryScene) {
  scene.generatingPrompt = true
  try {
    const result = await generateText({
      prompt: `为以下场景生成一段高质量的图片提示词（英文），用于AI绘画工具。要求：动漫/漫画风格背景图，包含环境细节、光线氛围、色彩基调、构图等描述。

场景名：${scene.name}
地点描述：${scene.location || '未描述'}
光线氛围：${scene.atmosphere || '未描述'}

请直接输出提示词，不要包含其他说明文字。`,
      systemPrompt: '你是一位专业的AI绘画提示词专家，擅长生成高质量的场景背景提示词。请直接输出英文提示词。',
      maxTokens: 500,
    })
    scene.imagePrompt = result.trim()
  } catch (err) {
    console.error('[generateScenePrompt] 生成失败:', err)
    scene.imagePrompt = `Anime background art, ${scene.name}. Location: ${scene.location || '未描述'}. Atmosphere: ${scene.atmosphere || '未描述'}. Highly detailed environment, manga style, cinematic composition, dramatic lighting.`
  } finally {
    scene.generatingPrompt = false
  }
}

function handleSceneImageUpload(scene: StoryScene, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      scene.referenceImage = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// ---- Tab 切换动画 ----

const tabTransitionName = ref('tab-slide-left')

watch(activeTab, (newVal, oldVal) => {
  const order = ['chapters', 'characters', 'scenes']
  tabTransitionName.value =
    order.indexOf(newVal) > order.indexOf(oldVal) ? 'tab-slide-left' : 'tab-slide-right'
})

/* ================================================================== */
/*  Step 3: 导出                                                       */
/* ================================================================== */

type ExportFormat = 'txt' | 'json' | 'storyboard'

const exportFormat = ref<ExportFormat>('json')
const showExportPreview = ref(false)
const storyboardExportCache = ref('')
const storyboardGenerating = ref(false)

async function refreshStoryboardCache() {
  if (exportFormat.value !== 'storyboard') return
  storyboardGenerating.value = true
  try {
    storyboardExportCache.value = await generateStoryboardExport()
  } catch (err) {
    console.error('[refreshStoryboardCache] 生成分镜导出失败:', err)
    storyboardExportCache.value = '{ "error": "生成分镜导出失败，请重试" }'
  } finally {
    storyboardGenerating.value = false
  }
}

watch([chapters, characters, scenes], () => {
  if (exportFormat.value === 'storyboard' && showExportPreview.value) {
    refreshStoryboardCache()
  }
}, { deep: true })

watch([exportFormat, showExportPreview], () => {
  if (exportFormat.value === 'storyboard' && showExportPreview.value) {
    refreshStoryboardCache()
  }
})

function getExportContent(): string {
  if (exportFormat.value === 'txt') {
    return generatePlainTextExport()
  } else if (exportFormat.value === 'json') {
    return generateJsonExport()
  } else {
    return storyboardExportCache.value || '正在生成分镜数据...'
  }
}

function generatePlainTextExport(): string {
  const lines: string[] = []
  lines.push('='.repeat(50))
  lines.push('故事全文')
  lines.push('='.repeat(50))
  lines.push('')

  chapters.value.forEach((ch) => {
    lines.push(`--- ${ch.title} ---`)
    lines.push(`[情绪: ${ch.mood}]`)
    lines.push('')
    lines.push(ch.content || '（暂无内容）')
    lines.push('')
  })

  lines.push('='.repeat(50))
  lines.push('角色设定')
  lines.push('='.repeat(50))
  lines.push('')

  characters.value.forEach((char) => {
    lines.push(`【${char.name}】 (${char.archetype})`)
    lines.push(`  外貌: ${char.appearance || '未设定'}`)
    lines.push(`  性格: ${char.personality || '未设定'}`)
    if (char.imagePrompt) {
      lines.push(`  图片提示词: ${char.imagePrompt}`)
    }
    lines.push('')
  })

  lines.push('='.repeat(50))
  lines.push('场景设定')
  lines.push('='.repeat(50))
  lines.push('')

  scenes.value.forEach((scene) => {
    lines.push(`【${scene.name}】`)
    lines.push(`  地点: ${scene.location || '未设定'}`)
    lines.push(`  氛围: ${scene.atmosphere || '未设定'}`)
    if (scene.imagePrompt) {
      lines.push(`  图片提示词: ${scene.imagePrompt}`)
    }
    lines.push('')
  })

  return lines.join('\n')
}

function generateJsonExport(): string {
  const data = {
    meta: {
      generator: 'ManhuaWorks Story Generator',
      version: '2.0',
      createdAt: new Date().toISOString(),
    },
    story: {
      outline: storyInput.value,
      template: selectedTemplate.value || 'custom',
    },
    chapters: chapters.value.map((ch) => ({
      number: ch.number,
      title: ch.title,
      content: ch.content,
      mood: ch.mood,
      wordCount: chapterWordCount(ch.content),
    })),
    characters: characters.value.map((char) => ({
      name: char.name,
      archetype: char.archetype,
      appearance: char.appearance,
      personality: char.personality,
      imagePrompt: char.imagePrompt,
    })),
    scenes: scenes.value.map((scene) => ({
      name: scene.name,
      location: scene.location,
      atmosphere: scene.atmosphere,
      imagePrompt: scene.imagePrompt,
    })),
  }
  return JSON.stringify(data, null, 2)
}

async function generateStoryboardExport(): Promise<string> {
  const storyboard = {
    meta: {
      generator: 'ManhuaWorks Story Generator',
      version: '2.0',
      format: 'storyboard',
      createdAt: new Date().toISOString(),
    },
    story: {
      outline: storyInput.value,
      template: selectedTemplate.value || 'custom',
    },
    panels: [] as any[],
    characters: characters.value.map((char) => ({
      name: char.name,
      archetype: char.archetype,
      appearance: char.appearance,
      personality: char.personality,
      imagePrompt: char.imagePrompt,
    })),
    scenes: scenes.value.map((scene) => ({
      name: scene.name,
      location: scene.location,
      atmosphere: scene.atmosphere,
      imagePrompt: scene.imagePrompt,
    })),
  }

  // 构建面板列表
  let panelId = 1
  chapters.value.forEach((ch) => {
    const paragraphs = ch.content.split('\n').filter((p) => p.trim())
    paragraphs.forEach((paragraph, pIdx) => {
      storyboard.panels.push({
        id: panelId++,
        chapter: ch.number,
        chapterTitle: ch.title,
        panelIndex: pIdx + 1,
        narration: paragraph,
        mood: ch.mood,
        craftPrompt: '',
        transitionHint: pIdx === paragraphs.length - 1 ? 'fade' : 'cut',
      })
    })
  })

  // 调用 AI 生成 CRAFT 提示词
  const characterNames = characters.value.map((c) => c.name).join(', ')
  const sceneNames = scenes.value.map((s) => s.name).join(', ')

  const panelSummaries = storyboard.panels.map((p) =>
    `[面板${p.id}] 章节:${p.chapterTitle} | 情绪:${p.mood} | 旁白:${p.narration.slice(0, 80)}`
  ).join('\n')

  try {
    const result = await generateText({
      prompt: `为以下漫画分镜面板生成CRAFT图片提示词（英文）。每个面板一行，格式为：
[面板ID] CRAFT提示词

要求：动漫/漫画风格，包含场景、角色、动作、表情、光线、构图等视觉描述。

可用角色：${characterNames || '未设定'}
可用场景：${sceneNames || '未设定'}

面板列表：
${panelSummaries}`,
      systemPrompt: '你是一位专业的漫画分镜师，擅长将故事文字转化为视觉分镜提示词。请为每个面板输出一行CRAFT提示词，只输出英文提示词，格式严格为 [面板ID] 提示词。',
      maxTokens: 2048,
    })

    // 解析 AI 返回的面板提示词
    const lines = result.split('\n').filter((l) => l.trim())
    for (const line of lines) {
      const match = line.match(/\[面板(\d+)\]\s*(.+)/)
      if (match) {
        const id = parseInt(match[1], 10)
        const craftPrompt = match[2].trim()
        const panel = storyboard.panels.find((p) => p.id === id)
        if (panel) {
          panel.craftPrompt = `[CRAFT] ${craftPrompt}`
        }
      }
    }
  } catch (err) {
    console.error('[generateStoryboardExport] AI 生成 CRAFT 提示词失败:', err)
  }

  // 为未获得 AI 提示词的面板提供 fallback
  storyboard.panels.forEach((p) => {
    if (!p.craftPrompt) {
      p.craftPrompt = `[CRAFT] Mood: ${p.mood} | Scene: ${scenes.value[0]?.name || '未设定'} | Characters: ${characterNames} | Style: anime, cinematic, ${p.mood}`
    }
  })

  return JSON.stringify(storyboard, null, 2)
}

async function downloadExport() {
  let content: string
  if (exportFormat.value === 'storyboard') {
    if (!storyboardExportCache.value) {
      await refreshStoryboardCache()
    }
    content = storyboardExportCache.value || '{ "error": "生成分镜导出失败" }'
  } else {
    content = getExportContent()
  }
  const ext = exportFormat.value === 'txt' ? 'txt' : 'json'
  const filename = `story-export.${ext}`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function navigateToAnimation() {
  // 将结构化数据存入 sessionStorage 供动画生成器读取
  const storyData = {
    title: storyTitle.value,
    outline: storyInput.value,
    template: selectedTemplate.value || 'custom',
    chapters: chapters.value.map((ch) => ({
      number: ch.number,
      title: ch.title,
      content: ch.content,
      mood: ch.mood,
    })),
    characters: characters.value.map((char) => ({
      name: char.name,
      archetype: char.archetype,
      appearance: char.appearance,
      personality: char.personality,
      imagePrompt: char.imagePrompt,
    })),
    scenes: scenes.value.map((scene) => ({
      name: scene.name,
      location: scene.location,
      atmosphere: scene.atmosphere,
      imagePrompt: scene.imagePrompt,
    })),
  }
  try {
    sessionStorage.setItem('mhw:bridge:story::animation', JSON.stringify(storyData))
  } catch {
    // storage full or unavailable, proceed with query params only
  }
  router.push({ path: '/create/animation', query: { from: 'story' } })
}

/* ================================================================== */
/*  步骤导航                                                           */
/* ================================================================== */

function goToStep(step: 1 | 2 | 3 | 4) {
  if (step === 4 && storyInput.value.trim()) return
  currentStep.value = step
}

/* ================================================================== */
/*  总字数统计                                                          */
/* ================================================================== */

/* ================================================================== */
/*  总字数统计                                                          */
/* ================================================================== */

const totalWordCount = computed(() =>
  chapters.value.reduce((sum, ch) => sum + chapterWordCount(ch.content), 0)
)

const totalCharacters = computed(() => characters.value.length)
const totalScenes = computed(() => scenes.value.length)

// ── 草稿自动保存 ──
const DRAFT_KEY = 'mhw:draft:novel'
watch([storyInput, chapters, characters, scenes], () => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      storyInput: storyInput.value,
      chapters: chapters.value,
      characters: characters.value,
      scenes: scenes.value,
      savedAt: new Date().toISOString()
    }))
  } catch { /* storage full */ }
}, { deep: true })
// 恢复草稿
onMounted(() => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.storyInput) storyInput.value = d.storyInput
    }
  } catch { /* ignore */ }
  // 加载素材归属项目列表（用于后续章节自动引用素材库）
  loadProjectOptions()
})
</script>

<template>
  <!-- P4-1: First-visit empty state -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">📖</div>
      <h2 class="qe-empty__title">暂无故事项目</h2>
      <p class="qe-empty__desc">输入故事大纲或选择模板，AI自动生成结构化故事、角色与场景</p>
      <button class="qe-empty__btn" @click="hasStarted = true">📖 开始创作</button>
    </div>
    <div class="story-generator" v-else>

    <!-- ====== 顶部步骤指示器 ====== -->
    <header class="step-header">
      <div class="step-header__brand">
        <h1>故事生成器</h1>
        <span class="step-header__subtitle">结构化创作 · 动画联动</span>
      </div>
      <nav class="step-nav">
        <button
          class="step-nav__item"
          :class="{ 'step-nav__item--active': currentStep === 1, 'step-nav__item--done': currentStep > 1 }"
          @click="goToStep(1)"
        >
          <span class="step-nav__number">1</span>
          <span class="step-nav__label">输入故事</span>
        </button>
        <div class="step-nav__connector" :class="{ 'step-nav__connector--done': currentStep > 1 }" />
        <button
          class="step-nav__item"
          :class="{ 'step-nav__item--active': currentStep === 2, 'step-nav__item--done': currentStep > 2 }"
          :disabled="!storyInput.trim()"
          @click="goToStep(2)"
        >
          <span class="step-nav__number">2</span>
          <span class="step-nav__label">结构化编辑</span>
        </button>
        <div class="step-nav__connector" :class="{ 'step-nav__connector--done': currentStep > 2 }" />
        <button
          class="step-nav__item"
          :class="{ 'step-nav__item--active': currentStep === 3, 'step-nav__item--done': currentStep > 3 }"
          :disabled="chapters.length === 0"
          @click="goToStep(3)"
        >
          <span class="step-nav__number">3</span>
          <span class="step-nav__label">预览确认</span>
        </button>
        <div class="step-nav__connector" :class="{ 'step-nav__connector--done': currentStep > 3 }" />
        <button
          class="step-nav__item"
          :class="{ 'step-nav__item--active': currentStep === 4 }"
          :disabled="chapters.length === 0"
          @click="goToStep(4)"
        >
          <span class="step-nav__number">4</span>
          <span class="step-nav__label">导出联动</span>
        </button>
      </nav>
    </header>

    <!-- ====== 步骤内容区 ====== -->
    <main class="step-content">
      <Transition name="step-fade" mode="out-in">
        <!-- ============================================================ -->
        <!--  Step 1: 输入故事                                             -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 1" key="step1" class="step-panel">
          <div class="step1-layout">
            <div class="step1-left">
              <h2 class="step-title">输入你的故事</h2>
              <p class="step-desc">写下故事大纲或开头，AI将帮你生成完整的结构化故事，包括章节、角色和场景设定。</p>

              <!-- 模板选择 -->
              <div class="template-section">
                <label class="field-label">选择故事模板（可选）</label>
                <div class="template-grid">
                  <button
                    v-for="tpl in STORY_TEMPLATES"
                    :key="tpl.key"
                    class="template-card"
                    :class="{ 'template-card--selected': selectedTemplate === tpl.key }"
                    @click="selectTemplate(tpl.key)"
                  >
                    <span class="template-card__label">{{ tpl.label }}</span>
                    <span class="template-card__desc">{{ tpl.description }}</span>
                  </button>
                </div>
              </div>

              <!-- AI灵感按钮 -->
              <button
                class="inspiration-btn"
                :disabled="generatingInspiration"
                @click="generateInspiration"
              >
                <span v-if="generatingInspiration" class="spinner" />
                <span v-else class="inspiration-btn__icon">&#10024;</span>
                {{ generatingInspiration ? '生成中...' : 'AI灵感 - 随机生成故事开头' }}
              </button>

              <!-- ENH-2: 参考作品输入 -->
              <div class="ref-works-section">
                <button class="ref-works-toggle" @click="showRefWorks = !showRefWorks">
                  <span>{{ showRefWorks ? '▾' : '▸' }}</span>
                  参考作品（可选）
                </button>
                <div v-if="showRefWorks" class="ref-works-body">
                  <p class="ref-works-hint">有喜欢的作品风格？粘贴链接或描述，AI将分析风格并融入生成</p>
                  <input
                    v-model="refWorksLink"
                    class="ref-works-input"
                    placeholder="粘贴作品链接或书名..."
                  />
                  <textarea
                    v-model="refWorksDesc"
                    class="ref-works-textarea"
                    placeholder="简单描述你觉得这个作品的风格特点..."
                    rows="2"
                  ></textarea>
                  <button
                    class="btn btn--outline btn--sm"
                    :disabled="analyzingStyle || (!refWorksLink && !refWorksDesc)"
                    @click="analyzeStyle"
                  >
                    <span v-if="analyzingStyle" class="spinner spinner--sm" />
                    {{ analyzingStyle ? '分析中...' : '🤖 AI分析风格' }}
                  </button>
                  <div v-if="analyzedStyle" class="ref-works-result">
                    <span class="ref-works-result__label">风格分析：</span>
                    <span class="ref-works-result__text">{{ analyzedStyle }}</span>
                  </div>
                </div>
              </div>

              <!-- ENH-11: 续写入口 -->
              <div v-if="!storyInput.trim()" class="continue-entry">
                <p class="continue-entry__hint">已有故事？</p>
                <RouterLink to="/projects" class="continue-entry__btn">📂 继续已有故事</RouterLink>
              </div>

              <!-- 故事输入 -->
              <div class="story-input-section">
                <div class="field-label-row">
                  <label class="field-label">故事大纲 / 开头</label>
                  <span class="char-count" :class="{ 'char-count--warn': storyInputLength > 9000 }">
                    {{ storyInputLength }} / 10000
                  </span>
                </div>
                <textarea
                  v-model="storyInput"
                  class="story-textarea"
                  placeholder="在这里写下你的故事大纲或开头……&#10;&#10;你可以：&#10;1. 直接写出故事的核心设定和开头&#10;2. 选择一个模板快速开始&#10;3. 点击「AI灵感」让AI帮你生成故事开头&#10;&#10;写得越详细，AI生成的结构化故事质量越高。"
                  maxlength="10000"
                />
              </div>

              <div class="step1-actions">
                <button
                  class="btn btn--primary btn--lg"
                  :disabled="!storyInput.trim() || generatingStory"
                  @click="goToStep2"
                >
                  <span v-if="generatingStory" class="spinner" />
                  {{ generatingStory ? 'AI正在生成完整故事...' : '下一步 - AI生成完整故事' }}
                </button>
              </div>
            </div>

            <div class="step1-right">
              <div class="info-card">
                <h3 class="info-card__title">什么是结构化故事？</h3>
                <div class="info-card__body">
                  <p>结构化故事将你的创意拆分为三个维度：</p>
                  <ul>
                    <li><strong>章节</strong> - 故事的叙事脉络，包含内容、情绪曲线</li>
                    <li><strong>角色</strong> - 人物设定，包含外貌、性格、参考图</li>
                    <li><strong>场景</strong> - 环境设定，包含地点、氛围、参考图</li>
                  </ul>
                  <p>结构化数据可以直接导入动画生成器，自动生成分镜脚本和画面。</p>
                </div>
              </div>
              <div class="info-card info-card--flow">
                <h3 class="info-card__title">创作流程</h3>
                <div class="flow-steps">
                  <div class="flow-step flow-step--current">
                    <span class="flow-step__dot" />
                    <span>输入故事</span>
                  </div>
                  <div class="flow-step__line" />
                  <div class="flow-step">
                    <span class="flow-step__dot" />
                    <span>编辑结构化内容</span>
                  </div>
                  <div class="flow-step__line" />
                  <div class="flow-step">
                    <span class="flow-step__dot" />
                    <span>导出 / 转入动画</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!--  Step 2: 结构化编辑                                           -->
        <!-- ============================================================ -->
        <div v-else-if="currentStep === 2" key="step2" class="step-panel">
          <div class="step2-layout">
            <!-- 素材归属项目 + 引用上下文（合并素材库 + 小说自身，按名称去重） -->
            <div class="nov-ref-bar">
              <div class="nov-proj-picker">
                <label class="nov-proj-picker__label">📁 素材归属项目</label>
                <select
                  v-model="selectedProjectId"
                  class="nov-proj-picker__select"
                  :disabled="projectLoading"
                  @change="onProjectChange"
                >
                  <option v-if="projectOptions.length === 0" value="" disabled>加载中…</option>
                  <option v-for="p in projectOptions" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
                <span v-if="projectLoading" class="nov-proj-picker__hint">加载中…</span>
                <span v-if="projectError" class="nov-proj-picker__error">{{ projectError }}</span>
              </div>

              <div v-if="refItems.length > 0 || libLoading" class="nov-ref">
                <button class="nov-ref__toggle" type="button" @click="refPanelOpen = !refPanelOpen">
                  <span class="nov-ref__title">📚 引用素材（{{ selectedRefs.length }}/{{ refItems.length }}）</span>
                  <span class="nov-ref__auto">
                    <label class="nov-ref__auto-label">
                      <input type="checkbox" :checked="refAutoMode" @change="toggleRefAuto" /> 全自动
                    </label>
                  </span>
                  <span class="nov-ref__caret">{{ refPanelOpen ? '▲' : '▼' }}</span>
                </button>
                <div v-if="refPanelOpen" class="nov-ref__panel">
                  <p v-if="libLoading" class="nov-ref__hint">正在从素材库加载人物/场景…</p>
                  <label
                    v-for="item in refItems"
                    :key="item.key"
                    class="nov-ref__item"
                    :class="{ 'nov-ref__item--library': item.source === 'library' }"
                  >
                    <input
                      type="checkbox"
                      :checked="isRefSelected(item.key)"
                      @change="toggleRef(item.key)"
                    />
                    <span class="nov-ref__kind">{{ item.kind === 'character' ? '👤' : '🎬' }}</span>
                    <span class="nov-ref__name">{{ item.name }}</span>
                    <span class="nov-ref__src">{{ item.source === 'library' ? '素材库' : '本文' }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Tab 切换 -->
            <div class="tab-bar">
              <button
                class="tab-btn"
                :class="{ 'tab-btn--active': activeTab === 'chapters' }"
                @click="activeTab = 'chapters'"
              >
                <span class="tab-btn__icon">&#128214;</span>
                章节
                <span class="tab-btn__badge">{{ chapters.length }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ 'tab-btn--active': activeTab === 'characters' }"
                @click="activeTab = 'characters'"
              >
                <span class="tab-btn__icon">&#128100;</span>
                角色
                <span class="tab-btn__badge">{{ characters.length }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ 'tab-btn--active': activeTab === 'scenes' }"
                @click="activeTab = 'scenes'"
              >
                <span class="tab-btn__icon">&#127912;</span>
                场景
                <span class="tab-btn__badge">{{ scenes.length }}</span>
              </button>

              <div class="tab-bar__stats">
                共 {{ chapters.length }} 章 · {{ totalWordCount }} 字 · {{ totalCharacters }} 角色 · {{ totalScenes }} 场景
              </div>
            </div>

            <!-- Tab 内容 -->
            <div class="tab-content">
              <Transition :name="tabTransitionName" mode="out-in">
                <!-- ======== 章节 Tab ======== -->
                <div v-if="activeTab === 'chapters'" key="chapters" class="tab-pane">
                  <div class="chapter-list">
                    <div
                      v-for="(ch, idx) in chapters"
                      :key="ch.id"
                      class="chapter-card"
                    >
                      <div class="chapter-card__header">
                        <div class="chapter-card__number-row">
                          <span class="chapter-card__number">第{{ ch.number }}章</span>
                          <input
                            v-model="ch.title"
                            class="chapter-card__title-input"
                            :placeholder="`第${ch.number}章标题`"
                          />
                        </div>
                        <div class="chapter-card__actions">
                          <button
                            class="icon-btn"
                            title="上移"
                            :disabled="idx === 0"
                            @click="moveChapter(ch.id, 'up')"
                          >&#9650;</button>
                          <button
                            class="icon-btn"
                            title="下移"
                            :disabled="idx === chapters.length - 1"
                            @click="moveChapter(ch.id, 'down')"
                          >&#9660;</button>
                          <button
                            class="icon-btn icon-btn--danger"
                            title="删除"
                            :disabled="chapters.length <= 1"
                            @click="removeChapter(ch.id)"
                          >&#10005;</button>
                        </div>
                      </div>

                      <div class="chapter-card__body">
                        <textarea
                          v-model="ch.content"
                          class="chapter-card__textarea"
                          :placeholder="`在这里编辑第${ch.number}章的内容...`"
                          rows="6"
                        />
                      </div>

                      <div class="chapter-card__footer">
                        <div class="chapter-card__mood">
                          <label class="mood-label">情绪曲线</label>
                          <select v-model="ch.mood" class="mood-select">
                            <option v-for="m in MOOD_OPTIONS" :key="m" :value="m">
                              {{ m }}
                            </option>
                          </select>
                          <span
                            class="mood-indicator"
                            :style="{ background: MOOD_COLORS[ch.mood] || '#888' }"
                          />
                        </div>
                        <div class="chapter-card__footer-actions">
                          <button
                            class="chapter-card__ai-btn"
                            :disabled="chapterGenerating[ch.id]"
                            :title="selectedRefs.length ? `将引用 ${selectedRefs.length} 项素材库设定` : '生成本章正文'"
                            @click="generateChapter(ch)"
                          >
                            <span v-if="chapterGenerating[ch.id]" class="spinner" />
                            <span v-else>✨</span>
                            {{ chapterGenerating[ch.id] ? '生成中…' : 'AI 生成' }}
                          </button>
                          <span class="chapter-card__wordcount">
                            {{ chapterWordCount(ch.content) }} 字
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button class="add-card-btn" @click="addChapter">
                    <span class="add-card-btn__icon">+</span>
                    添加章节
                  </button>
                </div>

                <!-- ======== 角色 Tab ======== -->
                <div v-else-if="activeTab === 'characters'" key="characters" class="tab-pane">
                  <div class="card-grid">
                    <div
                      v-for="char in characters"
                      :key="char.id"
                      class="entity-card"
                    >
                      <div class="entity-card__header">
                        <span class="entity-card__icon">{{ ARCHETYPE_ICONS[char.archetype] || '&#128100;' }}</span>
                        <input
                          v-model="char.name"
                          class="entity-card__name-input"
                          placeholder="角色名"
                        />
                        <button
                          class="icon-btn icon-btn--danger icon-btn--sm"
                          title="删除角色"
                          @click="removeCharacter(char.id)"
                        >&#10005;</button>
                      </div>

                      <div class="entity-card__body">
                        <div class="field">
                          <label class="field-label-sm">原型</label>
                          <select v-model="char.archetype" class="field-select">
                            <option v-for="a in ARCHETYPE_OPTIONS" :key="a" :value="a">
                              {{ a }}
                            </option>
                          </select>
                        </div>

                        <div class="field">
                          <label class="field-label-sm">外貌描述</label>
                          <textarea
                            v-model="char.appearance"
                            class="field-textarea field-textarea--sm"
                            placeholder="描述角色的外貌特征..."
                            rows="2"
                          />
                        </div>

                        <div class="field">
                          <label class="field-label-sm">性格描述</label>
                          <textarea
                            v-model="char.personality"
                            class="field-textarea field-textarea--sm"
                            placeholder="描述角色的性格特点..."
                            rows="2"
                          />
                        </div>

                        <button
                          class="prompt-gen-btn"
                          :disabled="char.generatingPrompt"
                          @click="generateCharacterPrompt(char)"
                        >
                          <span v-if="char.generatingPrompt" class="spinner spinner--sm" />
                          <span v-else>&#10024;</span>
                          {{ char.generatingPrompt ? '生成中...' : '生成参考图提示词' }}
                        </button>

                        <div v-if="char.imagePrompt" class="prompt-display">
                          <label class="field-label-sm">图片提示词（可编辑）</label>
                          <textarea
                            v-model="char.imagePrompt"
                            class="field-textarea field-textarea--prompt"
                            rows="3"
                          />
                        </div>

                        <div class="upload-area">
                          <label class="field-label-sm">参考图片</label>
                          <div
                            class="upload-zone"
                            :class="{ 'upload-zone--has-image': char.referenceImage }"
                          >
                            <template v-if="char.referenceImage">
                              <img :src="char.referenceImage" class="upload-preview" alt="参考图" />
                              <button
                                class="upload-remove"
                                @click="char.referenceImage = null"
                              >&#10005;</button>
                            </template>
                            <template v-else>
                              <span class="upload-placeholder">
                                <span class="upload-placeholder__icon">&#128247;</span>
                                点击上传参考图
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                class="upload-input"
                                @change="handleCharacterImageUpload(char, $event)"
                              />
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button class="add-card-btn" @click="addCharacter">
                    <span class="add-card-btn__icon">+</span>
                    添加角色
                  </button>
                </div>

                <!-- ======== 场景 Tab ======== -->
                <div v-else-if="activeTab === 'scenes'" key="scenes" class="tab-pane">
                  <div class="card-grid">
                    <div
                      v-for="scene in scenes"
                      :key="scene.id"
                      class="entity-card"
                    >
                      <div class="entity-card__header">
                        <span class="entity-card__icon">&#127912;</span>
                        <input
                          v-model="scene.name"
                          class="entity-card__name-input"
                          placeholder="场景名"
                        />
                        <button
                          class="icon-btn icon-btn--danger icon-btn--sm"
                          title="删除场景"
                          @click="removeScene(scene.id)"
                        >&#10005;</button>
                      </div>

                      <div class="entity-card__body">
                        <div class="field">
                          <label class="field-label-sm">地点描述</label>
                          <textarea
                            v-model="scene.location"
                            class="field-textarea field-textarea--sm"
                            placeholder="描述场景的地点和环境..."
                            rows="2"
                          />
                        </div>

                        <div class="field">
                          <label class="field-label-sm">氛围/光照</label>
                          <textarea
                            v-model="scene.atmosphere"
                            class="field-textarea field-textarea--sm"
                            placeholder="描述场景的氛围和光照效果..."
                            rows="2"
                          />
                        </div>

                        <button
                          class="prompt-gen-btn"
                          :disabled="scene.generatingPrompt"
                          @click="generateScenePrompt(scene)"
                        >
                          <span v-if="scene.generatingPrompt" class="spinner spinner--sm" />
                          <span v-else>&#10024;</span>
                          {{ scene.generatingPrompt ? '生成中...' : '生成参考图提示词' }}
                        </button>

                        <div v-if="scene.imagePrompt" class="prompt-display">
                          <label class="field-label-sm">图片提示词（可编辑）</label>
                          <textarea
                            v-model="scene.imagePrompt"
                            class="field-textarea field-textarea--prompt"
                            rows="3"
                          />
                        </div>

                        <div class="upload-area">
                          <label class="field-label-sm">参考图片</label>
                          <div
                            class="upload-zone"
                            :class="{ 'upload-zone--has-image': scene.referenceImage }"
                          >
                            <template v-if="scene.referenceImage">
                              <img :src="scene.referenceImage" class="upload-preview" alt="参考图" />
                              <button
                                class="upload-remove"
                                @click="scene.referenceImage = null"
                              >&#10005;</button>
                            </template>
                            <template v-else>
                              <span class="upload-placeholder">
                                <span class="upload-placeholder__icon">&#128247;</span>
                                点击上传参考图
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                class="upload-input"
                                @change="handleSceneImageUpload(scene, $event)"
                              />
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button class="add-card-btn" @click="addScene">
                    <span class="add-card-btn__icon">+</span>
                    添加场景
                  </button>
                </div>
              </Transition>
            </div>

            <!-- 底部操作 -->
            <div class="step2-footer">
              <button class="btn btn--ghost" @click="currentStep = 1">
                返回编辑故事
              </button>
              <button class="btn btn--primary btn--lg" @click="currentStep = 3">
                下一步 - 预览确认
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!--  Step 3: 预览确认（ENH-1）                                      -->
        <!-- ============================================================ -->
        <div v-else-if="currentStep === 3" key="step3" class="step-panel">
          <div class="preview-confirm">
            <h2 class="step-title">生成预览确认</h2>
            <p class="step-desc">
              请确认以下AI提取的设定无误，点击任意项可展开详情并修改。确认无误后即可导出。
            </p>

            <div class="pc-section" :class="{ 'pc-section--expanded': isPreviewSectionExpanded('outline') }">
              <button class="pc-section__header" @click="togglePreviewSection('outline')">
                <span class="pc-section__icon">📋</span>
                <span class="pc-section__title">大纲总览</span>
                <span class="pc-section__count">{{ chapters.length }} 章</span>
                <span class="pc-section__arrow">{{ isPreviewSectionExpanded('outline') ? '▾' : '▸' }}</span>
              </button>
              <div v-if="isPreviewSectionExpanded('outline')" class="pc-section__body">
                <div v-for="ch in chapters" :key="ch.id" class="pc-item">
                  <span class="pc-item__num">{{ ch.number }}</span>
                  <span class="pc-item__title">{{ ch.title }}</span>
                  <span class="pc-item__mood" :style="{ background: MOOD_COLORS[ch.mood] || '#888' }">{{ ch.mood }}</span>
                  <span class="pc-item__wc">{{ chapterWordCount(ch.content) }}字</span>
                </div>
                <button class="btn btn--sm btn--ghost" @click="currentStep = 2">✏️ 修改大纲</button>
              </div>
            </div>

            <div class="pc-section" :class="{ 'pc-section--expanded': isPreviewSectionExpanded('characters') }">
              <button class="pc-section__header" @click="togglePreviewSection('characters')">
                <span class="pc-section__icon">👥</span>
                <span class="pc-section__title">角色设定</span>
                <span class="pc-section__count">{{ characters.length }} 名</span>
                <span class="pc-section__arrow">{{ isPreviewSectionExpanded('characters') ? '▾' : '▸' }}</span>
              </button>
              <div v-if="isPreviewSectionExpanded('characters')" class="pc-section__body">
                <div v-for="char in characters" :key="char.id" class="pc-item">
                  <span class="pc-item__num">{{ ARCHETYPE_ICONS[char.archetype] }}</span>
                  <span class="pc-item__title">{{ char.name }}</span>
                  <span class="pc-item__tag">{{ char.archetype }}</span>
                  <span class="pc-item__detail">{{ char.appearance }}</span>
                </div>
                <button class="btn btn--sm btn--ghost" @click="currentStep = 2">✏️ 修改角色</button>
              </div>
            </div>

            <div class="pc-section" :class="{ 'pc-section--expanded': isPreviewSectionExpanded('scenes') }">
              <button class="pc-section__header" @click="togglePreviewSection('scenes')">
                <span class="pc-section__icon">🌍</span>
                <span class="pc-section__title">世界观 / 场景</span>
                <span class="pc-section__count">{{ scenes.length }} 个</span>
                <span class="pc-section__arrow">{{ isPreviewSectionExpanded('scenes') ? '▾' : '▸' }}</span>
              </button>
              <div v-if="isPreviewSectionExpanded('scenes')" class="pc-section__body">
                <div v-for="sc in scenes" :key="sc.id" class="pc-item">
                  <span class="pc-item__num">🏞️</span>
                  <span class="pc-item__title">{{ sc.name }}</span>
                  <span class="pc-item__detail">{{ sc.atmosphere }}</span>
                </div>
                <button class="btn btn--sm btn--ghost" @click="currentStep = 2">✏️ 修改场景</button>
              </div>
            </div>

            <div class="pc-section" :class="{ 'pc-section--expanded': isPreviewSectionExpanded('style') }">
              <button class="pc-section__header" @click="togglePreviewSection('style')">
                <span class="pc-section__icon">🎨</span>
                <span class="pc-section__title">写作风格</span>
                <span class="pc-section__count">{{ selectedTemplate ? '模板预设' : '自由创作' }}</span>
                <span class="pc-section__arrow">{{ isPreviewSectionExpanded('style') ? '▾' : '▸' }}</span>
              </button>
              <div v-if="isPreviewSectionExpanded('style')" class="pc-section__body">
                <div v-if="selectedTemplate" class="pc-item">
                  <span class="pc-item__num">📌</span>
                  <span class="pc-item__title">{{ STORY_TEMPLATES.find(t=>t.key===selectedTemplate)?.label || selectedTemplate }}</span>
                  <span class="pc-item__detail">{{ STORY_TEMPLATES.find(t=>t.key===selectedTemplate)?.description || '' }}</span>
                </div>
                <div v-else class="pc-item">
                  <span class="pc-item__num">📌</span>
                  <span class="pc-item__title">自由创作</span>
                  <span class="pc-item__detail">未使用模板</span>
                </div>
                <div v-if="analyzedStyle" class="pc-item pc-item--accent">
                  <span class="pc-item__num">🔍</span>
                  <span class="pc-item__title">参考风格</span>
                  <span class="pc-item__detail">{{ analyzedStyle }}</span>
                </div>
                <button class="btn btn--sm btn--ghost" @click="currentStep = 1">✏️ 修改风格</button>
              </div>
            </div>

            <!-- ENH-12: 叙事视角 -->
            <div class="pc-section pc-section--perspective">
              <div class="pc-section__header">
                <span class="pc-section__icon">👁️</span>
                <span class="pc-section__title">叙事视角</span>
                <span class="pc-section__count">{{ PERSPECTIVE_OPTIONS.find(p=>p.id===narrativePerspective)?.label }}</span>
              </div>
              <div class="pc-section__body">
                <div class="perspective-grid">
                  <button
                    v-for="opt in PERSPECTIVE_OPTIONS"
                    :key="opt.id"
                    class="perspective-card"
                    :class="{ 'perspective-card--selected': narrativePerspective === opt.id }"
                    @click="narrativePerspective = opt.id"
                  >
                    <span class="perspective-card__icon">{{ opt.icon }}</span>
                    <span class="perspective-card__label">{{ opt.label }}</span>
                    <span class="perspective-card__desc">{{ opt.desc }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="pc-actions">
              <button class="btn btn--ghost" @click="currentStep = 2">← 返回编辑</button>
              <button class="btn btn--gradient btn--lg" @click="currentStep = 4">
                ✅ 全部确认，进入导出
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!--  Step 4: 导出 + 联动                                          -->
        <!-- ============================================================ -->
        <div v-else-if="currentStep === 4" key="step4" class="step-panel">
          <div class="step3-layout">
            <div class="step3-left">
              <h2 class="step-title">导出与联动</h2>
              <p class="step-desc">选择导出格式，或将结构化故事直接转入动画生成器开始创作。</p>

              <!-- 导出格式选择 -->
              <div class="export-section">
                <label class="field-label">导出格式</label>
                <div class="format-grid">
                  <button
                    class="format-card"
                    :class="{ 'format-card--selected': exportFormat === 'txt' }"
                    @click="exportFormat = 'txt'"
                  >
                    <span class="format-card__icon">&#128196;</span>
                    <span class="format-card__name">纯文本 (.txt)</span>
                    <span class="format-card__desc">完整故事文本，含角色和场景设定</span>
                  </button>
                  <button
                    class="format-card"
                    :class="{ 'format-card--selected': exportFormat === 'json' }"
                    @click="exportFormat = 'json'"
                  >
                    <span class="format-card__icon">&#128203;</span>
                    <span class="format-card__name">结构化数据 (.json)</span>
                    <span class="format-card__desc">标准JSON格式，可导入动画生成器</span>
                  </button>
                  <button
                    class="format-card"
                    :class="{ 'format-card--selected': exportFormat === 'storyboard' }"
                    @click="exportFormat = 'storyboard'"
                  >
                    <span class="format-card__icon">&#127916;</span>
                    <span class="format-card__name">分镜脚本 (.json)</span>
                    <span class="format-card__desc">含CRAFT提示词，可直接用于画面生成</span>
                  </button>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="export-actions">
                <button class="btn btn--outline" @click="showExportPreview = !showExportPreview">
                  {{ showExportPreview ? '隐藏预览' : '预览导出内容' }}
                </button>
                <button class="btn btn--primary" @click="downloadExport">
                  <span>&#128229;</span> 下载文件
                </button>
              </div>

              <!-- 一键转入动画 -->
              <div class="animation-cta">
                <div class="animation-cta__info">
                  <h3>一键转入动画生成器</h3>
                  <p>将故事数据（章节、角色、场景）直接传递给动画生成器，自动生成分镜和画面。</p>
                </div>
                <button class="btn btn--gradient btn--lg" @click="navigateToAnimation">
                  &#127916; 转入动画生成器
                </button>
              </div>

              <button class="btn btn--ghost" @click="currentStep = 3">
                返回预览
              </button>
            </div>

            <!-- 预览面板 -->
            <div class="step3-right">
              <div v-if="showExportPreview" class="preview-panel">
                <div class="preview-panel__header">
                  <h3>导出预览</h3>
                  <span class="preview-panel__format-badge">{{ exportFormat.toUpperCase() }}</span>
                </div>
                <pre class="preview-panel__content">{{ getExportContent() }}</pre>
              </div>
              <div v-else class="summary-panel">
                <h3 class="summary-panel__title">故事概览</h3>
                <div class="summary-grid">
                  <div class="summary-item">
                    <span class="summary-item__value">{{ chapters.length }}</span>
                    <span class="summary-item__label">章节</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-item__value">{{ totalWordCount }}</span>
                    <span class="summary-item__label">总字数</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-item__value">{{ totalCharacters }}</span>
                    <span class="summary-item__label">角色</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-item__value">{{ totalScenes }}</span>
                    <span class="summary-item__label">场景</span>
                  </div>
                </div>

                <div class="summary-chapters">
                  <h4>章节列表</h4>
                  <div v-for="ch in chapters" :key="ch.id" class="summary-chapter">
                    <span class="summary-chapter__title">{{ ch.title }}</span>
                    <span
                      class="summary-chapter__mood"
                      :style="{ background: MOOD_COLORS[ch.mood] || '#888' }"
                    >{{ ch.mood }}</span>
                    <span class="summary-chapter__wc">{{ chapterWordCount(ch.content) }}字</span>
                  </div>
                </div>

                <div class="summary-chapters">
                  <h4>角色列表</h4>
                  <div v-for="char in characters" :key="char.id" class="summary-chapter">
                    <span class="summary-chapter__title">
                      {{ ARCHETYPE_ICONS[char.archetype] }} {{ char.name }}
                    </span>
                    <span class="summary-chapter__archetype">{{ char.archetype }}</span>
                  </div>
                </div>

                <div class="summary-chapters">
                  <h4>场景列表</h4>
                  <div v-for="scene in scenes" :key="scene.id" class="summary-chapter">
                    <span class="summary-chapter__title">{{ scene.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
/* ================================================================ */
/*  First-visit empty state (P4-1)                                     */
/* ================================================================ */

.qe-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 60px 24px;
}
.qe-empty__icon { font-size: 72px; margin-bottom: 20px; opacity: 0.5; }
.qe-empty__title { font-size: 24px; font-weight: 700; color: #FAFAFA; margin: 0 0 10px; }
.qe-empty__desc { font-size: 14px; color: var(--text-muted, #64748B); margin: 0 0 28px; max-width: 420px; line-height: 1.6; }
.qe-empty__btn {
  padding: 12px 32px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0E0F12);
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.qe-empty__btn:hover { background: #0D9488; transform: translateY(-1px); }

/* ================================================================== */
/*  根布局                                                              */
/* ================================================================== */

.story-generator {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

/* ================================================================== */
/*  步骤指示器头部                                                       */
/* ================================================================== */

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: var(--bg-secondary, #1A1C21);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.step-header__brand {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.step-header__brand h1 {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.step-header__subtitle {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.step-nav {
  display: flex;
  align-items: center;
  gap: 0;
}

.step-nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted, #64748B);
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: 13px;
}

.step-nav__item:hover:not(:disabled) {
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  background: rgba(255, 255, 255, 0.03);
}

.step-nav__item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.step-nav__item--active {
  color: var(--text-primary, var(--text-primary, #E8EAED)) !important;
  background: rgba(124, 58, 237, 0.12) !important;
  border-color: rgba(124, 58, 237, 0.25) !important;
}

.step-nav__item--done {
  color: #10B981 !important;
}

.step-nav__number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.25s ease;
}

.step-nav__item--active .step-nav__number {
  background: #7C3AED;
  border-color: #7C3AED;
  color: #fff;
}

.step-nav__item--done .step-nav__number {
  background: #10B981;
  border-color: #10B981;
  color: #fff;
}

.step-nav__label {
  font-weight: 500;
}

.step-nav__connector {
  width: 32px;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 4px;
  transition: background 0.3s ease;
}

.step-nav__connector--done {
  background: #10B981;
}

/* ================================================================== */
/*  步骤内容区                                                           */
/* ================================================================== */

.step-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.step-panel {
  min-height: 100%;
  padding: 28px 32px;
}

/* ================================================================== */
/*  Step 1 布局                                                         */
/* ================================================================== */

.step1-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.step-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
  color: var(--text-primary, var(--text-primary, #E8EAED));
}

.step-desc {
  font-size: 14px;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  margin: 0 0 24px;
  line-height: 1.6;
}

/* 模板选择 */
.template-section {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  margin-bottom: 10px;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.template-card {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-card:hover {
  border-color: rgba(124, 58, 237, 0.3);
  background: rgba(124, 58, 237, 0.05);
}

.template-card--selected {
  border-color: #7C3AED !important;
  background: rgba(124, 58, 237, 0.1) !important;
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.3);
}

.template-card__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, #E8EAED));
}

.template-card__desc {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  line-height: 1.5;
}

/* AI灵感 */
.inspiration-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid rgba(124, 58, 237, 0.25);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(0, 191, 165, 0.05));
  color: #c4b5fd;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 20px;
}

.inspiration-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 191, 165, 0.1));
  border-color: rgba(124, 58, 237, 0.4);
}

.inspiration-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inspiration-btn__icon {
  font-size: 16px;
}

/* 故事输入 */
.story-input-section {
  margin-bottom: 24px;
}

.story-textarea {
  width: 100%;
  min-height: 280px;
  max-height: 500px;
  resize: vertical;
  padding: 16px 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: #cbd5e1;
  font-size: 14px;
  line-height: 1.85;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  letter-spacing: 0.02em;
  outline: none;
  transition: border-color 0.2s ease;
}

.story-textarea:focus {
  border-color: rgba(124, 58, 237, 0.4);
}

.story-textarea::placeholder {
  color: #475569;
}

.story-textarea::-webkit-scrollbar {
  width: 6px;
}

.story-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.story-textarea::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.char-count {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.char-count--warn {
  color: #F59E0B;
}

.step1-actions {
  display: flex;
  gap: 12px;
}

/* 右侧信息卡片 */
.step1-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-card {
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.info-card--flow {
  border-color: rgba(0, 191, 165, 0.15);
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.03), rgba(124, 58, 237, 0.03));
}

.info-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, #E8EAED));
  margin: 0 0 12px;
}

.info-card__body {
  font-size: 13px;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  line-height: 1.7;
}

.info-card__body ul {
  padding-left: 18px;
  margin: 8px 0;
}

.info-card__body li {
  margin-bottom: 4px;
}

.info-card__body strong {
  color: #c4b5fd;
}

/* 流程步骤 */
.flow-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-muted, #64748B);
}

.flow-step--current {
  color: #c4b5fd;
  font-weight: 600;
}

.flow-step__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.flow-step--current .flow-step__dot {
  background: #7C3AED;
  border-color: #7C3AED;
  box-shadow: 0 0 8px rgba(124, 58, 237, 0.4);
}

.flow-step__line {
  width: 2px;
  height: 16px;
  background: rgba(255, 255, 255, 0.06);
  margin-left: 4px;
}

/* ================================================================== */
/*  Step 2 布局                                                         */
/* ================================================================== */

.step2-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748B);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}

.tab-btn:hover {
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  background: rgba(255, 255, 255, 0.03);
}

.tab-btn--active {
  color: var(--text-primary, var(--text-primary, #E8EAED)) !important;
  background: rgba(124, 58, 237, 0.12) !important;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.15);
}

.tab-btn__icon {
  font-size: 16px;
}

.tab-btn__badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
}

.tab-btn--active .tab-btn__badge {
  background: rgba(124, 58, 237, 0.25);
  color: #c4b5fd;
}

.tab-bar__stats {
  margin-left: auto;
  font-size: 12px;
  color: #475569;
  padding-right: 12px;
}

/* Tab 内容 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}

.tab-pane {
  min-height: 100%;
}

/* 章节列表 */
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chapter-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.chapter-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.chapter-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.chapter-card__number-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-card__number {
  font-size: 12px;
  font-weight: 700;
  color: #7C3AED;
  white-space: nowrap;
}

.chapter-card__title-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-size: 15px;
  font-weight: 600;
  padding: 4px 0;
  outline: none;
  min-width: 200px;
  transition: border-color 0.2s ease;
}

.chapter-card__title-input:focus {
  border-color: rgba(124, 58, 237, 0.4);
}

.chapter-card__actions {
  display: flex;
  gap: 4px;
}

.chapter-card__body {
  padding: 16px 18px;
}

.chapter-card__textarea {
  width: 100%;
  resize: vertical;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.8;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  outline: none;
  transition: border-color 0.2s ease;
}

.chapter-card__textarea:focus {
  border-color: rgba(124, 58, 237, 0.3);
}

.chapter-card__textarea::placeholder {
  color: #475569;
}

.chapter-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.chapter-card__mood {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mood-label {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.mood-select {
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #1a1f2e;
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.mood-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chapter-card__wordcount {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

/* 卡片网格 (角色/场景) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.entity-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.entity-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.entity-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.entity-card__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.entity-card__name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-size: 15px;
  font-weight: 700;
  padding: 4px 0;
  outline: none;
  transition: border-color 0.2s ease;
}

.entity-card__name-input:focus {
  border-color: rgba(124, 58, 237, 0.4);
}

.entity-card__body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-sm {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.field-textarea {
  width: 100%;
  resize: vertical;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 8px 12px;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.7;
  outline: none;
  transition: border-color 0.2s ease;
}

.field-textarea:focus {
  border-color: rgba(124, 58, 237, 0.3);
}

.field-textarea::placeholder {
  color: #475569;
}

.field-textarea--sm {
  min-height: 48px;
}

.field-textarea--prompt {
  min-height: 60px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #a5b4fc;
}

.prompt-gen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(124, 58, 237, 0.2);
  background: rgba(124, 58, 237, 0.06);
  color: #c4b5fd;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prompt-gen-btn:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.35);
}

.prompt-gen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prompt-display {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 上传区域 */
.upload-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upload-zone {
  position: relative;
  width: 100%;
  min-height: 80px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.upload-zone:hover {
  border-color: rgba(124, 58, 237, 0.3);
  background: rgba(124, 58, 237, 0.03);
}

.upload-zone--has-image {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.1);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  padding: 12px;
}

.upload-placeholder__icon {
  font-size: 24px;
}

.upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-preview {
  width: 100%;
  height: auto;
  max-height: 160px;
  object-fit: cover;
  display: block;
}

.upload-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.upload-remove:hover {
  background: rgba(239, 68, 68, 0.8);
}

/* 添加按钮 */
.add-card-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  margin-top: 16px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  background: transparent;
  color: var(--text-muted, #64748B);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-card-btn:hover {
  border-color: rgba(124, 58, 237, 0.3);
  color: #c4b5fd;
  background: rgba(124, 58, 237, 0.04);
}

.add-card-btn__icon {
  font-size: 18px;
  font-weight: 700;
}

/* Step 2 底部 */
.step2-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 16px;
  flex-shrink: 0;
}

/* ================================================================== */
/*  Step 3 布局                                                         */
/* ================================================================== */

.step3-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.export-section {
  margin-bottom: 24px;
}

.format-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.format-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.format-card:hover {
  border-color: rgba(124, 58, 237, 0.25);
  background: rgba(124, 58, 237, 0.04);
}

.format-card--selected {
  border-color: #7C3AED !important;
  background: rgba(124, 58, 237, 0.08) !important;
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.25);
}

.format-card__icon {
  font-size: 24px;
  flex-shrink: 0;
}

.format-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, #E8EAED));
}

.format-card__desc {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.export-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

/* 动画CTA */
.animation-cta {
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(0, 191, 165, 0.08));
  border: 1px solid rgba(124, 58, 237, 0.2);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.animation-cta__info h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, #E8EAED));
  margin: 0 0 6px;
}

.animation-cta__info p {
  font-size: 13px;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  margin: 0;
  line-height: 1.6;
}

/* 右侧预览/概览 */
.step3-right {
  position: sticky;
  top: 0;
}

.preview-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 160px);
}

.preview-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.preview-panel__header h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary, var(--text-primary, #E8EAED));
}

.preview-panel__format-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.2);
  color: #c4b5fd;
  letter-spacing: 0.05em;
}

.preview-panel__content {
  flex: 1;
  padding: 16px 20px;
  margin: 0;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  font-family: 'Courier New', 'Source Code Pro', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.preview-panel__content::-webkit-scrollbar {
  width: 6px;
}

.preview-panel__content::-webkit-scrollbar-track {
  background: transparent;
}

.preview-panel__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

/* 概览面板 */
.summary-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 24px;
}

.summary-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, #E8EAED));
  margin: 0 0 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.summary-item {
  text-align: center;
  padding: 12px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.summary-item__value {
  display: block;
  font-size: 22px;
  font-weight: 800;
  color: #7C3AED;
  margin-bottom: 4px;
}

.summary-item__label {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

.summary-chapters {
  margin-bottom: 20px;
}

.summary-chapters h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}

.summary-chapter {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 13px;
}

.summary-chapter__title {
  flex: 1;
  color: var(--text-primary, var(--text-primary, #E8EAED));
  font-weight: 500;
}

.summary-chapter__mood {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
}

.summary-chapter__wc {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

.summary-chapter__archetype {
  font-size: 11px;
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

/* ================================================================== */
/*  通用按钮                                                            */
/* ================================================================== */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  color: #fff;
}

.btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #8B5CF6, #7C3AED);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

.btn--outline {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

.btn--outline:hover:not(:disabled) {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.06);
}

.btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted, #64748B);
}

.btn--ghost:hover:not(:disabled) {
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
  background: rgba(255, 255, 255, 0.03);
}

.btn--gradient {
  background: linear-gradient(135deg, #7C3AED, var(--accent, #00BFA5));
  color: #fff;
  font-weight: 700;
}

.btn--gradient:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(124, 58, 237, 0.35);
  transform: translateY(-1px);
}

.btn--lg {
  padding: 14px 32px;
  font-size: 15px;
}

/* 图标按钮 */
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted, #64748B);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, var(--text-secondary, #9CA3AF));
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.12);
  color: #EF4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.icon-btn--sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

/* Spinner */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner--sm {
  width: 12px;
  height: 12px;
  border-width: 1.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ================================================================== */
/*  过渡动画                                                            */
/* ================================================================== */

.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.tab-slide-left-enter-active,
.tab-slide-left-leave-active,
.tab-slide-right-enter-active,
.tab-slide-right-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.tab-slide-left-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.tab-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.tab-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

.tab-slide-right-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* ================================================================== */
/*  滚动条全局                                                          */
/* ================================================================== */

.step-content::-webkit-scrollbar,
.tab-content::-webkit-scrollbar {
  width: 6px;
}

.step-content::-webkit-scrollbar-track,
.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.step-content::-webkit-scrollbar-thumb,
.tab-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.step-content::-webkit-scrollbar-thumb:hover,
.tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.14);
}

/* ================================================================== */
/*  响应式                                                              */
/* ================================================================== */

@media (max-width: 1280px) {
  .step1-layout {
    grid-template-columns: 1fr 280px;
    gap: 24px;
  }

  .step3-layout {
    grid-template-columns: 1fr 340px;
    gap: 24px;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1024px) {
  .step1-layout {
    grid-template-columns: 1fr;
  }

  .step1-right {
    display: none;
  }

  .step3-layout {
    grid-template-columns: 1fr;
  }

  .step3-right {
    position: static;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .template-grid {
    grid-template-columns: 1fr;
  }

  .step-header {
    flex-direction: column;
    gap: 12px;
  }
}

/* ===== ENH-1: 预览确认页 ===== */
.preview-confirm {
  max-width: 800px;
  margin: 0 auto;
}

.pc-section {
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 200ms ease;
}

.pc-section--expanded {
  border-color: var(--accent, #6366f1);
}

.pc-section__header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 18px;
  background: transparent;
  border: none;
  color: var(--text-primary, #f1f5f9);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 150ms ease;
}

.pc-section__header:hover {
  background: var(--bg-tertiary, #23262e);
}

.pc-section__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.pc-section__title {
  flex: 1;
}

.pc-section__count {
  font-size: 12px;
  color: var(--text-muted, #555);
  background: var(--bg-tertiary, #23262e);
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.pc-section__arrow {
  font-size: 12px;
  color: var(--text-muted, #555);
  transition: transform 200ms ease;
}

.pc-section__body {
  padding: 0 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary, #1e1e22);
  border-radius: 8px;
  font-size: 13px;
}

.pc-item--accent {
  border-left: 3px solid var(--accent, #6366f1);
}

.pc-item__num {
  font-size: 14px;
  width: 28px;
  text-align: center;
  color: var(--text-muted, #555);
  flex-shrink: 0;
}

.pc-item__title {
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
  flex-shrink: 0;
  min-width: 80px;
}

.pc-item__mood {
  font-size: 11px;
  color: #fff;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  flex-shrink: 0;
}

.pc-item__tag {
  font-size: 11px;
  color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.pc-item__detail {
  font-size: 12px;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-item__wc {
  font-size: 11px;
  color: var(--text-muted, #555);
  flex-shrink: 0;
}

.pc-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 24px 0;
}

/* ===== ENH-2: 参考作品 ===== */
.ref-works-section {
  margin-top: 16px;
}

.ref-works-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  padding: 6px 0;
  transition: color 150ms ease;
}

.ref-works-toggle:hover {
  color: var(--text-primary, #f1f5f9);
}

.ref-works-body {
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
  padding: 14px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ref-works-hint {
  font-size: 12px;
  color: var(--text-muted, #555);
  margin: 0;
  line-height: 1.5;
}

.ref-works-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 8px;
  color: var(--text-primary, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 200ms ease;
}

.ref-works-input:focus {
  border-color: var(--accent, #6366f1);
}

.ref-works-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 8px;
  color: var(--text-primary, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color 200ms ease;
}

.ref-works-textarea:focus {
  border-color: var(--accent, #6366f1);
}

.ref-works-result {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(99, 102, 241, 0.08);
  border-left: 3px solid var(--accent, #6366f1);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.ref-works-result__label {
  color: var(--accent, #6366f1);
  font-weight: 600;
  flex-shrink: 0;
}

.ref-works-result__text {
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
}

.spinner--sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

/* ===== ENH-11: 续写入口 ===== */
.continue-entry {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 10px;
  margin-bottom: 16px;
}
.continue-entry__hint { font-size: 13px; color: var(--text-secondary); margin: 0; }
.continue-entry__btn {
  font-size: 13px; font-weight: 600; color: var(--violet, #8B5CF6);
  text-decoration: none;
  padding: 4px 12px; border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 6px; transition: all 150ms ease;
}
.continue-entry__btn:hover { background: rgba(139, 92, 246, 0.1); border-color: var(--violet, #8B5CF6); }

/* ===== ENH-12: 叙事视角 ===== */
.pc-section--perspective .pc-section__header { cursor: default; }
.perspective-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.perspective-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 10px;
  background: var(--bg-secondary, #1a1c21);
  border: 2px solid var(--border, #2a2d35);
  border-radius: 10px; cursor: pointer;
  transition: all 200ms ease; font-family: inherit; color: var(--text-primary);
}
.perspective-card:hover { border-color: var(--accent, #6366f1); }
.perspective-card--selected {
  border-color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.12);
}
.perspective-card__icon { font-size: 24px; }
.perspective-card__label { font-size: 13px; font-weight: 600; }
.perspective-card__desc { font-size: 11px; color: var(--text-secondary); text-align: center; line-height: 1.4; }

@media (max-width: 600px) {
  .perspective-grid { grid-template-columns: 1fr; }
}

/* ===== 素材归属项目 + 引用上下文面板 ===== */
.nov-ref-bar {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary, #f4f4f7);
  border: 1px solid var(--border, #e2e2e8);
  border-radius: 12px;
  margin-bottom: 16px;
}
.nov-proj-picker { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.nov-proj-picker__label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.nov-proj-picker__select {
  font-family: inherit; font-size: 13px; color: var(--text-primary);
  padding: 6px 10px; border-radius: 8px;
  background: var(--bg-primary, #fff); border: 1px solid var(--border, #d8d8e0);
  min-width: 200px; cursor: pointer;
}
.nov-proj-picker__hint { font-size: 12px; color: var(--text-secondary); }
.nov-proj-picker__error { font-size: 12px; color: #ef4444; }

.nov-ref { border-top: 1px dashed var(--border, #e2e2e8); padding-top: 10px; }
.nov-ref__toggle {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: transparent; border: none; cursor: pointer;
  font-family: inherit; padding: 4px 0; color: var(--text-primary);
}
.nov-ref__title { font-size: 13px; font-weight: 600; }
.nov-ref__auto { margin-left: auto; }
.nov-ref__auto-label { font-size: 12px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.nov-ref__caret { font-size: 11px; color: var(--text-secondary); }
.nov-ref__panel {
  margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
  max-height: 240px; overflow-y: auto; padding: 8px;
  background: var(--bg-primary, #fff); border-radius: 10px;
  border: 1px solid var(--border, #e2e2e8);
}
.nov-ref__hint { font-size: 12px; color: var(--text-secondary); margin: 0; }
.nov-ref__item {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-primary); cursor: pointer;
  padding: 4px 6px; border-radius: 6px;
}
.nov-ref__item:hover { background: rgba(99,102,241,0.06); }
.nov-ref__item--library { background: rgba(16,185,129,0.05); }
.nov-ref__kind { font-size: 14px; }
.nov-ref__name { font-weight: 500; }
.nov-ref__src {
  margin-left: auto; font-size: 11px; color: var(--text-secondary);
  padding: 1px 7px; border-radius: 999px; background: rgba(0,0,0,0.05);
}
.nov-ref__item--library .nov-ref__src { background: rgba(16,185,129,0.15); color: #059669; }

/* ===== 章节卡 AI 生成按钮 ===== */
.chapter-card__footer-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.chapter-card__ai-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; font-family: inherit;
  color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25);
}
.chapter-card__ai-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
.chapter-card__ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 600px) {
  .nov-ref-bar { padding: 10px; }
  .chapter-card__footer-actions { width: 100%; justify-content: space-between; }
}
</style>
