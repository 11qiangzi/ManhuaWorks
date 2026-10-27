<!--
/**
 * MaterialLibraryView · 素材中心
 *
 * ⚠️ 大组件 (1672+ 行) — 建议拆分为:
 *   - AudioListView: 音频列表+播放+筛选 (~300行)
 *   - MaterialGridView: 素材网格+搜索 (~400行)
 *   - CreateMaterialModal: 新建素材弹窗 (~200行)
 *   - EditImageModal: 图片编辑弹窗 (~300行)
 *   - ProjectSwitcher: 项目切换器 (~100行)
 *
 * 当前状态: 功能完整但单文件过大，后续迭代时逐步拆分
 */
-->

<script setup lang="ts">
/**
 * MaterialLibraryView.vue — 统一素材库 V2
 * 林染 🔮 2026-06-10: 重写 — 图片驱动
 *   卡片展示真实图片 (上传/AI生成)
 *   新建 → 弹窗设提示词+参数 → AI 生成
 *   图片支持修改：重新生成/上传替换/裁剪
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { useCharacterStore } from '../stores/characterStore'
import { useSceneStore } from '../stores/sceneStore'
import { useAssetStore, ASSET_CATEGORY_LABELS, type AssetCategory, type AssetItem } from '../stores/assetStore'
import { assetService } from '@/api/asset-service-v2'
import { generateImage, generateVideo } from '@/api/ai-router'

const route = useRoute()
const router = useRouter()

// ============ Types — 素材图片和素材项的类型定义 ============
interface MaterialImage {
  id: string
  url: string | null          // 图片 URL (data: 或 http:)
  prompt: string              // 生成提示词
  negativePrompt: string      // 反向提示词
  style: string               // 风格 (anime/realistic/comic/sketch/watercolor)
  aspectRatio: string         // 宽高比 1:1/16:9/9:16/4:3
  resolution: string          // 分辨率
  status: 'idle' | 'generating' | 'ready' | 'failed'
  error?: string
}

interface MaterialItem {
  id: string
  name: string
  type: 'characters' | 'scenes' | 'props' | 'voices' | 'audio'
  images: MaterialImage[]     // 多张图片 (主视觉图 + 设定图)
  tags: string[]
  description: string
  projectId: string           // 🆕 所属作品
  createdAt: number
  updatedAt: number
}

// ============ Stores — 项目/角色/场景 store 实例及项目列表 ============
const projectStore = useProjectStore()
const characterStore = useCharacterStore()
const sceneStore = useSceneStore()
const assetStore = useAssetStore()

// 🆕 作品/项目 (initialized from API, with mock fallback)
interface ProjectInfo {
  id: string
  name: string
  icon: string
  description: string
}

const projects = ref<ProjectInfo[]>([
  { id: 'proj_1', name: '长安月下', icon: '🌙', description: '古风宫廷 · 24 集' },
  { id: 'proj_2', name: '剑破苍穹', icon: '⚔️', description: '仙侠冒险 · 96 镜头' },
  { id: 'proj_3', name: '深空遗民', icon: '🚀', description: '近未来科幻 · 8 集' },
])
const activeProject = ref<string>(projects.value[0]?.id ?? '')

// ============ Tabs — 素材分类标签页配置 (角色/场景/道具/音色/音频/品牌资产) ============
type MaterialTab = 'characters' | 'scenes' | 'props' | 'voices' | 'audio' | 'brand'
const activeTab = ref<MaterialTab>( (route.query.tab as MaterialTab) || 'characters' )

const tabs: { id: MaterialTab; label: string; icon: string; addLabel: string }[] = [
  { id: 'characters', label: '角色', icon: '👤', addLabel: '新角色' },
  { id: 'scenes', label: '场景', icon: '🎬', addLabel: '新场景' },
  { id: 'props', label: '道具', icon: '🗡️', addLabel: '新道具' },
  { id: 'voices', label: '音色', icon: '🎙️', addLabel: '新音色' },
  { id: 'audio', label: '音频', icon: '🎵', addLabel: '新音频' },
  { id: 'brand', label: '品牌资产', icon: '🏷️', addLabel: '新品牌' },
  { id: 'assets', label: '素材资产', icon: '📦', addLabel: '生成素材' },
]

watch(activeTab, tab => { router.replace({ query: { tab } }) })

// ============ 素材数据 — 默认图片工厂、种子数据、生命周期初始化 ============
const items = ref<MaterialItem[]>([])

function createDefaultImage(): MaterialImage {
  return {
    id: `img_${Date.now().toString(36)}`,
    url: null,
    prompt: '',
    negativePrompt: '',
    style: 'anime',
    aspectRatio: '1:1',
    resolution: '1024x1024',
    status: 'idle',
  }
}

function seedItems() {
  items.value = [
    // === 长安月下 (proj_1) ===
    {
      id: 'char_1', name: '林启', type: 'characters', projectId: 'proj_1',
      images: [ { id:'img_1a', url:null, prompt:'少年剑修，白衣黑发，眼神坚定', negativePrompt:'', style:'anime', aspectRatio:'1:1', resolution:'1024x1024', status:'idle' } ],
      tags: ['主角','剑修'], description:'本作男主角', createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'char_2', name: '苏婉', type: 'characters', projectId: 'proj_1',
      images: [ { id:'img_2a', url:null, prompt:'少女炼丹师，绿裙长发，温婉聪慧', negativePrompt:'', style:'anime', aspectRatio:'1:1', resolution:'1024x1024', status:'idle' } ],
      tags: ['女主','炼丹师'], description:'本作女主角', createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'scn_1', name: '林府书房', type: 'scenes', projectId: 'proj_1',
      images: [ { id:'img_s1a', url:null, prompt:'古典书房，檀木书桌，窗外竹影', negativePrompt:'', style:'anime', aspectRatio:'16:9', resolution:'1920x1080', status:'idle' } ],
      tags: ['室内','古风'], description:'林启府邸书房', createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'scn_2', name: '后山竹海', type: 'scenes', projectId: 'proj_1',
      images: [ { id:'img_s2a', url:null, prompt:'江南古典园林，亭台楼阁，樱花飘落', negativePrompt:'', style:'anime', aspectRatio:'16:9', resolution:'1920x1080', status:'idle' } ],
      tags: ['室外','修行'], description:'后山练剑处', createdAt: Date.now(), updatedAt: Date.now(),
    },
    // === 剑破苍穹 (proj_2) ===
    {
      id: 'char_3', name: '叶辰', type: 'characters', projectId: 'proj_2',
      images: [ { id:'img_3a', url:null, prompt:'仙侠少年，手持断剑，伤痕累累', negativePrompt:'', style:'anime', aspectRatio:'1:1', resolution:'1024x1024', status:'idle' } ],
      tags: ['主角','剑修'], description:'少年宗主', createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'scn_3', name: '赛博都市', type: 'scenes', projectId: 'proj_3',
      images: [ { id:'img_s3a', url:null, prompt:'霓虹灯未来都市，飞行汽车，阴雨夜晚', negativePrompt:'', style:'realistic', aspectRatio:'16:9', resolution:'1920x1080', status:'idle' } ],
      tags: ['未来','城市'], description:'赛博朋克风格城市', createdAt: Date.now(), updatedAt: Date.now(),
    },
  ]
}

// ============ 🎵 音频素材系统 — 音频类型/筛选/排序/播放/情绪标签 ============
type AudioType = 'BGM' | '音效' | '配音'
type AudioFilter = 'all' | AudioType
type AudioSort = 'recent' | 'name' | 'duration' | 'plays'

interface AudioItem {
  id: string
  name: string
  audioType: AudioType
  duration: number          // seconds
  uploadDate: number        // timestamp
  plays: number
  moodTags: string[]        // from 16-tag mood system
  genre: string
  projectId: string
  usageCount: number
}

const audioFilter = ref<AudioFilter>('all')
const audioSort = ref<AudioSort>('recent')
const playingAudioId = ref<string | null>(null)
const audioVolume = ref(80)

const audioItems = ref<AudioItem[]>([
  {
    id: 'aud_1', name: '春日序曲.mp3', audioType: 'BGM',
    duration: 150, uploadDate: Date.now() - 86400000 * 2, plays: 342,
    moodTags: ['温馨', '浪漫', '平静'], genre: '古风',
    projectId: 'proj_1', usageCount: 12,
  },
  {
    id: 'aud_2', name: '剑鸣九天.mp3', audioType: 'BGM',
    duration: 210, uploadDate: Date.now() - 86400000 * 5, plays: 587,
    moodTags: ['激昂', '史诗', '庄严'], genre: '仙侠',
    projectId: 'proj_1', usageCount: 8,
  },
  {
    id: 'aud_3', name: '拔剑音效.wav', audioType: '音效',
    duration: 3, uploadDate: Date.now() - 86400000 * 1, plays: 1204,
    moodTags: ['激昂', '紧张'], genre: '动作',
    projectId: 'proj_1', usageCount: 45,
  },
  {
    id: 'aud_4', name: '脚步声_石板路.wav', audioType: '音效',
    duration: 5, uploadDate: Date.now() - 86400000 * 3, plays: 890,
    moodTags: ['平静', '神秘'], genre: '环境',
    projectId: 'proj_1', usageCount: 23,
  },
  {
    id: 'aud_5', name: '林启_独白_第一集.mp3', audioType: '配音',
    duration: 45, uploadDate: Date.now() - 86400000 * 7, plays: 156,
    moodTags: ['悲伤', '孤独', '希望'], genre: '独白',
    projectId: 'proj_1', usageCount: 3,
  },
  {
    id: 'aud_6', name: '苏婉_对白_炼丹房.mp3', audioType: '配音',
    duration: 32, uploadDate: Date.now() - 86400000 * 4, plays: 98,
    moodTags: ['温馨', '欢快'], genre: '对白',
    projectId: 'proj_1', usageCount: 5,
  },
])

const filteredAudioItems = computed(() => {
  let list = audioItems.value.filter(a => a.projectId === activeProject.value)
  if (audioFilter.value !== 'all') {
    list = list.filter(a => a.audioType === audioFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a => a.name.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q))
  }
  // Sort
  switch (audioSort.value) {
    case 'name': list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh')); break
    case 'duration': list = [...list].sort((a, b) => b.duration - a.duration); break
    case 'plays': list = [...list].sort((a, b) => b.plays - a.plays); break
    default: list = [...list].sort((a, b) => b.uploadDate - a.uploadDate); break
  }
  return list
})

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function toggleAudioPlay(id: string) {
  playingAudioId.value = playingAudioId.value === id ? null : id
}

function deleteAudioItem(id: string) {
  audioItems.value = audioItems.value.filter(a => a.id !== id)
  if (playingAudioId.value === id) playingAudioId.value = null
}

// Mood tag color map (from musicScore composable)
const moodColors: Record<string, string> = {
  '紧张': '#ef4444', '温馨': '#f59e0b', '悲伤': '#6366f1', '欢快': '#22c55e',
  '激昂': '#dc2626', '神秘': '#8b5cf6', '浪漫': '#ec4899', '恐惧': '#1e1b4b',
  '平静': '#06b6d4', '愤怒': '#b91c1c', '希望': '#fbbf24', '孤独': '#64748b',
  '史诗': '#d97706', '喜剧': '#84cc16', '悬疑': '#7c3aed', '庄严': '#0f766e',
}

const audioTypeColors: Record<AudioType, string> = {
  'BGM': '#818cf8',
  '音效': '#f59e0b',
  '配音': '#34d399',
}

onMounted(async () => {
  seedItems() // 加载中占位数据，syncFromStores() 会用真实数据覆盖
  const t = route.query.tab as MaterialTab | undefined
  if (t) activeTab.value = t

  // Load projects from API
  try {
    await projectStore.loadList()
    if (projectStore.projects.length > 0) {
      projects.value = projectStore.projects.map(p => ({
        id: p.id,
        name: p.name || '未命名项目',
        icon: '📁',
        description: p.description || '',
      }))
      activeProject.value = projects.value[0].id
    }
  } catch (e: any) {
    console.warn('[素材库] 项目加载失败:', e?.message)
  }

  // Sync characters/scenes from stores to material items
  await syncFromStores()
})

// Sync character/scene store data to material items when active project changes
watch(activeProject, () => { syncFromStores() })

async function syncFromStores() {
  const pid = activeProject.value
  if (!pid) return

  // Only reload if the store doesn't already have this project's data
  const needCharacterLoad = characterStore.projectId !== pid
  const needSceneLoad = sceneStore.projectId !== pid

  try {
    if (needCharacterLoad) {
      await characterStore.load(pid, [])
    }
    if (characterStore.characters.length > 0) {
      // Remove old character items for this project, then add from store
      items.value = items.value.filter(i => !(i.type === 'characters' && i.projectId === pid))
      for (const c of characterStore.characters) {
        items.value.push({
          id: c.id,
          name: c.name,
          type: 'characters',
          images: [{ id: `img_${c.id}`, url: c.thumbnail_url || null, prompt: c.description || '', negativePrompt: '', style: 'anime', aspectRatio: '1:1', resolution: '1024x1024', status: c.thumbnail_url ? 'ready' : 'idle' }],
          tags: c.tags || [],
          description: c.description || '',
          projectId: pid,
          createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
          updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
        })
      }
    }
  } catch (e: any) {
    console.warn('[素材库] 角色数据加载失败:', e?.message)
  }

  try {
    if (needSceneLoad) {
      await sceneStore.load(pid, [])
    }
    if (sceneStore.scenes.length > 0) {
      items.value = items.value.filter(i => !(i.type === 'scenes' && i.projectId === pid))
      for (const s of sceneStore.scenes) {
        items.value.push({
          id: s.id,
          name: s.name,
          type: 'scenes',
          images: [{ id: `img_${s.id}`, url: s.thumbnail_url || null, prompt: s.description || '', negativePrompt: '', style: 'anime', aspectRatio: '16:9', resolution: '1920x1080', status: s.thumbnail_url ? 'ready' : 'idle' }],
          tags: s.tags || [],
          description: s.description || '',
          projectId: pid,
          createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
          updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
        })
      }
    }
  } catch (e: any) {
    console.warn('[素材库] 场景数据加载失败:', e?.message)
  }

  // 素材资产（武器/道具/饰品/特效·技能）— 真后端 assetStore
  try {
    if (assetStore.projectId !== pid) {
      await assetStore.load(pid)
    }
  } catch (e: any) {
    console.warn('[素材库] 素材资产加载失败:', e?.message)
  }
}

// ============ 📦 素材资产（武器/道具/饰品/特效·技能）— 真后端 + AI 生成 ============
const assetCategoryFilter = ref<AssetCategory | 'all'>('all')
const assetItemsView = computed<AssetItem[]>(() =>
  assetCategoryFilter.value === 'all'
    ? assetStore.assets
    : assetStore.assets.filter(a => a.category === assetCategoryFilter.value)
)

const showAssetGen = ref(false)
const GENRE_OPTIONS = ['修仙', '玄幻', '都市', '科幻', '武侠', '古风', '奇幻', '末日']
const assetGen = ref({
  category: 'weapon' as AssetCategory,
  name: '',
  description: '',
  genre: '修仙',
  prompt: '',
  busy: false,
  step: '',
  error: '',
})

function openAssetGen() {
  assetGen.value = { category: 'weapon', name: '', description: '', genre: '修仙', prompt: '', busy: false, step: '', error: '' }
  showAssetGen.value = true
}
function closeAssetGen() {
  if (assetGen.value.busy) return
  showAssetGen.value = false
}

function buildAssetPrompt(): string {
  const g = assetGen.value
  if (g.prompt.trim()) return g.prompt.trim()
  const base: Record<AssetCategory, string> = {
    weapon: `${g.genre}风格武器，名称「${g.name}」，${g.description}，金属/材质质感，细节精致，游戏资产设定图，白底或透明背景`,
    prop: `${g.genre}风格道具，名称「${g.name}」，${g.description}，写实质感，细节精致，游戏资产设定图，白底或透明背景`,
    accessory: `${g.genre}风格饰品/佩戴物，名称「${g.name}」，${g.description}，精致工艺，游戏资产设定图，白底或透明背景`,
    effect: `${g.genre}技能特效「${g.name}」，${g.description}，能量爆发，魔法光效，动态粒子，华丽炫酷，暗色背景突出光效`,
  }
  return `${base[g.category]}，高清，8k，概念艺术`
}

async function generateAsset() {
  const g = assetGen.value
  if (!g.name.trim()) { g.error = '请填写素材名称'; return }
  const pid = activeProject.value
  if (!pid) { g.error = '请先选择项目'; return }
  g.busy = true
  g.error = ''
  g.step = '生成中…'
  try {
    const prompt = buildAssetPrompt()
    // 1) 静帧缩略图（所有类型都需要；特效也用作视频首帧/参考图）
    g.step = '生成参考图…'
    const urls = await generateImage({ prompt, size: '1024x1024', n: 1 })
    const thumbnail = Array.isArray(urls) ? urls[0] : (urls as unknown as string)
    if (!thumbnail) throw new Error('图片生成未返回 URL')

    // 2) 特效：用静帧做参考图，生成短视频 clip（动图）
    let videoUrl: string | undefined
    if (g.category === 'effect') {
      g.step = '生成特效动图…'
      const v = await generateVideo({ prompt: `${prompt}，动态施展，能量流动`, referenceImages: [thumbnail], durationSeconds: 4, ratio: '16:9' })
      videoUrl = v?.url
    }

    // 3) 入库
    g.step = '保存素材…'
    const saved = await assetStore.create({
      category: g.category,
      name: g.name.trim(),
      description: g.description.trim() || undefined,
      prompt,
      thumbnail_url: thumbnail,
      tags: g.genre ? [g.genre] : [],
    })
    if (videoUrl && saved?.id) {
      await assetStore.update(saved.id, { video_url: videoUrl })
    }
    g.step = '完成'
    showAssetGen.value = false
  } catch (e: any) {
    g.error = e?.message || '生成失败'
    g.step = ''
  } finally {
    g.busy = false
  }
}

// ============ 🏷️ 品牌资产 — 品牌信息/Logo/色彩/字体管理 ============
interface BrandAsset {
  id: string
  name: string
  slogan: string
  primaryColor: string
  secondaryColor: string
  font: string
  projectCount: number
  updatedAt: number
}

const brands = ref<BrandAsset[]>([
  { id: 'b1', name: '长安月下', slogan: '一梦长安，千年风月', primaryColor: '#E85D75', secondaryColor: '#F7D5A8', font: 'Serif', projectCount: 3, updatedAt: Date.now() - 86400000 * 5 },
  { id: 'b2', name: '千机工坊', slogan: 'AI多媒体创作平台', primaryColor: '#00D4AA', secondaryColor: '#8B5CF6', font: '系统默认', projectCount: 8, updatedAt: Date.now() - 86400000 * 2 },
  { id: 'b3', name: '剑破苍穹', slogan: '少年宗主，一剑开天', primaryColor: '#6366F1', secondaryColor: '#A78BFA', font: '楷体', projectCount: 2, updatedAt: Date.now() - 86400000 * 14 },
])

const showBrandForm = ref(false)
const brandForm = ref({ name: '', slogan: '', primaryColor: '#00D4AA', secondaryColor: '#8B5CF6', font: '' })

function saveBrand() {
  if (!brandForm.value.name.trim()) return
  brands.value.push({
    id: `b${Date.now()}`,
    name: brandForm.value.name,
    slogan: brandForm.value.slogan,
    primaryColor: brandForm.value.primaryColor || '#00D4AA',
    secondaryColor: brandForm.value.secondaryColor || '#8B5CF6',
    font: brandForm.value.font || '系统默认',
    projectCount: 0,
    updatedAt: Date.now(),
  })
  brandForm.value = { name: '', slogan: '', primaryColor: '#00D4AA', secondaryColor: '#8B5CF6', font: '' }
  showBrandForm.value = false
}

function deleteBrand(id: string) {
  brands.value = brands.value.filter(b => b.id !== id)
}

// ============ 筛选 — 搜索/标签过滤/项目统计/项目切换 ============
const searchQuery = ref('')
const activeTag = ref<string | null>(null)

const allTags = computed(() => {
  const s = new Set<string>()
  for (const item of filteredByType.value) item.tags.forEach(t => s.add(t))
  return [...s]
})

const filteredByType = computed(() => items.value.filter(i => i.type === activeTab.value && i.projectId === activeProject.value))

// 🆕 当前作品统计
const projectStats = computed(() => {
  if (!activeProject.value) return { characters: 0, scenes: 0, props: 0, voices: 0 }
  const projItems = items.value.filter(i => i.projectId === activeProject.value)
  return {
    characters: projItems.filter(i => i.type === 'characters').length,
    scenes: projItems.filter(i => i.type === 'scenes').length,
    props: projItems.filter(i => i.type === 'props').length,
    voices: projItems.filter(i => i.type === 'voices').length,
    total: projItems.length,
  }
})

// 🆕 其他作品统计
const otherProjectStats = computed(() =>
  projects.value.filter(p => p.id !== activeProject.value).map(p => {
    const projItems = items.value.filter(i => i.projectId === p.id)
    return { ...p, characters: projItems.filter(i => i.type === 'characters').length, scenes: projItems.filter(i => i.type === 'scenes').length, props: projItems.filter(i => i.type === 'props').length, voices: projItems.filter(i => i.type === 'voices').length }
  })
)

function switchProject(projectId: string) {
  activeProject.value = projectId
  selectedId.value = null
}

const filteredItems = computed(() => {
  let list = filteredByType.value
  if (activeTag.value) list = list.filter(i => i.tags.includes(activeTag.value!))
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
  }
  return list
})

// ============ 新建素材模态框 — 三步流程: 填表→AI生成预览→选择确认 ============
const showCreateModal = ref(false)
const createStep = ref<'form' | 'generating' | 'select'>('form')  // 🆕 步骤：填表→生成→选择
const selectedPreview = ref(0)  // 选中的预览图索引
const generatedPreviews = ref<Array<{ id: string; url: string | null; seed: number }>>([])
const createForm = ref({
  name: '',
  description: '',
  tags: '',
  prompt: '',
  negativePrompt: '',
  style: 'anime' as string,
  aspectRatio: '1:1' as string,
  resolution: '1024x1024' as string,
})

function openCreateModal() {
  createForm.value = {
    name: '', description: '', tags: '',
    prompt: '', negativePrompt: '', style: 'anime',
    aspectRatio: '1:1', resolution: '1024x1024',
  }
  createStep.value = 'form'
  selectedPreview.value = 0
  generatedPreviews.value = []
  showCreateModal.value = true
}

// 🆕 第一步：生成三张预览图
async function generatePreviews() {
  if (!createForm.value.prompt.trim()) return
  createStep.value = 'generating'

  try {
    const prompt = createForm.value.prompt
    const style = createForm.value.style || 'anime'
    const results = await Promise.allSettled([
      generateImage({ prompt, style, size: '1024x1024', n: 1 }),
      generateImage({ prompt: prompt + ', variation 1', style, size: '1024x1024', n: 1 }),
      generateImage({ prompt: prompt + ', variation 2', style, size: '1024x1024', n: 1 }),
    ])
    generatedPreviews.value = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r, i) => ({
        id: `prev_${i + 1}`,
        url: r.value?.url || r.value?.[0]?.url || null,
        seed: Math.floor(Math.random() * 1000000),
      }))
    if (generatedPreviews.value.length === 0) {
      // All failed — show empty state
      generatedPreviews.value = [
        { id: 'prev_1', url: null, seed: 0 },
      ]
    }
  } catch {
    generatedPreviews.value = [{ id: 'prev_1', url: null, seed: 0 }]
  }
  selectedPreview.value = 0
  createStep.value = 'select'
}

// 🆕 第二步：选择图片后确认创建
function confirmCreate() {
  if (!createForm.value.name.trim()) return
  if (!createForm.value.prompt.trim()) return

  const id = `${activeTab.value.slice(0, 4)}_${Date.now().toString(36)}`
  const selected = generatedPreviews.value[selectedPreview.value]
  const newItem: MaterialItem = {
    id,
    name: createForm.value.name.trim(),
    type: activeTab.value,
    projectId: activeProject.value,
    images: [{
      id: `img_${Date.now().toString(36)}`,
      url: selected?.url ?? null,
      prompt: createForm.value.prompt.trim(),
      negativePrompt: createForm.value.negativePrompt.trim(),
      style: createForm.value.style,
      aspectRatio: createForm.value.aspectRatio,
      resolution: createForm.value.resolution,
      status: 'idle',
    }],
    tags: createForm.value.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    description: createForm.value.description.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  items.value.unshift(newItem)
  showCreateModal.value = false
  selectedId.value = id
}

// 返回第一步
function backToForm() {
  createStep.value = 'form'
  generatedPreviews.value = []
}

// ============ 选中 & 详情 — 右侧面板的素材选中状态 ============
const selectedId = ref<string | null>(null)
const selectedItem = computed(() => items.value.find(i => i.id === selectedId.value) ?? null)

function selectItem(id: string) { selectedId.value = id }

// ============ 图片操作 — 编辑弹窗/重新生成/上传/添加/删除 ============
const showImageModal = ref(false)
const editImageIndex = ref(0)
const editImageForm = ref<MaterialImage>(createDefaultImage())
const imageGenerating = ref(false)
const uploadPreview = ref<string | null>(null)

function openImageEdit(itemId: string, imgIdx: number) {
  const item = items.value.find(i => i.id === itemId)
  if (!item || !item.images[imgIdx]) return
  editImageIndex.value = imgIdx
  selectedId.value = itemId
  editImageForm.value = { ...item.images[imgIdx] }
  imageGenerating.value = false
  uploadPreview.value = null
  showImageModal.value = true
}

async function regenerateImage() {
  imageGenerating.value = true
  const item = items.value.find(i => i.id === selectedId.value)
  if (!item) { imageGenerating.value = false; return }

  try {
    const prompt = editImageForm.value.prompt
    const urls = await generateImage({ prompt, size: '1024x1024', n: 1 })
    if (urls.length > 0) {
      item.images[editImageIndex.value].url = urls[0]
      item.images[editImageIndex.value].prompt = prompt
      item.images[editImageIndex.value].negativePrompt = editImageForm.value.negativePrompt
      item.images[editImageIndex.value].style = editImageForm.value.style
      item.images[editImageIndex.value].status = 'ready'
      item.updatedAt = Date.now()
    }
  } catch (err) {
    console.error('[MaterialLibrary] AI regeneration failed:', err)
    item.images[editImageIndex.value].prompt = editImageForm.value.prompt
    item.images[editImageIndex.value].negativePrompt = editImageForm.value.negativePrompt
    item.images[editImageIndex.value].style = editImageForm.value.style
    item.images[editImageIndex.value].status = 'idle'
    item.updatedAt = Date.now()
  } finally {
    imageGenerating.value = false
  }
  showImageModal.value = false
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const item = items.value.find(i => i.id === selectedId.value)
  if (!item) return

  // 先用本地预览
  const reader = new FileReader()
  reader.onload = () => {
    item.images[editImageIndex.value].url = reader.result as string
    item.images[editImageIndex.value].status = 'ready'
    item.updatedAt = Date.now()
  }
  reader.readAsDataURL(file)

  // 异步上传到 asset-service，成功后替换为服务器 URL
  try {
    const asset = await assetService.upload(file, { kind: 'image' })
    item.images[editImageIndex.value].url = asset.url
    item.updatedAt = Date.now()
  } catch {
    // 上传失败保留本地预览
  }
  showImageModal.value = false
}

function addNewImage() {
  const item = items.value.find(i => i.id === selectedId.value)
  if (!item) return
  item.images.push(createDefaultImage())
  item.updatedAt = Date.now()
}

function deleteImage(imgIdx: number) {
  const item = items.value.find(i => i.id === selectedId.value)
  if (!item) return
  item.images.splice(imgIdx, 1)
  if (item.images.length === 0) item.images.push(createDefaultImage())
  item.updatedAt = Date.now()
}

function deleteItem() {
  items.value = items.value.filter(i => i.id !== selectedId.value)
  selectedId.value = items.value.filter(i => i.type === activeTab.value)[0]?.id ?? null
}

// ============ 样式常量 — 风格/比例/分辨率选项 + 键盘事件 ============
const styleOptions = [
  { value: 'anime', label: '动漫风', icon: '🎨' },
  { value: 'realistic', label: '写实风', icon: '📷' },
  { value: 'comic', label: '美漫风', icon: '💥' },
  { value: 'sketch', label: '线稿', icon: '✏️' },
  { value: 'watercolor', label: '水彩', icon: '🖌️' },
]
const ratioOptions = [
  { value: '1:1', label: '1:1 方形' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '4:3', label: '4:3' },
]
const resOptions = ['512x512', '1024x1024', '1920x1080', '1080x1920']

// 键盘关闭
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showImageModal.value) showImageModal.value = false
    else if (showCreateModal.value) showCreateModal.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="ml-root">
    <!-- ===== 🆕 作品选择器 ===== -->
    <div class="ml-project-bar">
      <span class="ml-project-bar-label">📁 当前作品</span>
      <div class="ml-project-current">
        {{ projects.find(p => p.id === activeProject)?.icon }}
        {{ projects.find(p => p.id === activeProject)?.name }}
        <span class="ml-project-current-arrow">▾</span>
      </div>
      <span class="ml-project-meta">
        {{ projects.find(p => p.id === activeProject)?.description }}
        · 角色 {{ projectStats.characters }} · 场景 {{ projectStats.scenes }}
        · 道具 {{ projectStats.props }} · 音色 {{ projectStats.voices }}
      </span>
      <div class="ml-project-chips">
        <button
          v-for="p in projects"
          :key="p.id"
          class="ml-project-chip"
          :class="{ 'ml-project-chip--active': activeProject === p.id }"
          @click="switchProject(p.id)"
        >{{ p.icon }} {{ p.name }}</button>
        <button class="ml-project-chip ml-project-chip--new">+ 新建</button>
      </div>
    </div>

    <!-- ===== Header ===== -->
    <header class="ml-header">
      <div class="ml-header-left">
        <span class="ml-header-icon">🎭</span>
        <span class="ml-header-title">素材库</span>
        <span class="ml-header-count">{{ filteredByType.length }} 项</span>
      </div>
      <div class="ml-header-right">
        <input v-model="searchQuery" placeholder="搜索素材…" class="ml-search" />
        <button class="ml-btn ml-btn--primary" @click="activeTab === 'assets' ? openAssetGen() : openCreateModal()">+ 新建</button>
      </div>
    </header>

    <!-- ===== Tabs ===== -->
    <nav class="ml-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="ml-tab" :class="{ 'ml-tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="ml-tab-icon">{{ tab.icon }}</span>
        <span class="ml-tab-label">{{ tab.label }}</span>
        <span class="ml-tab-count"> ({{ tab.id === 'characters' ? projectStats.characters : tab.id === 'scenes' ? projectStats.scenes : tab.id === 'props' ? projectStats.props : tab.id === 'audio' ? audioItems.filter(a => a.projectId === activeProject).length : tab.id === 'assets' ? assetStore.count : projectStats.voices }})</span>
      </button>
    </nav>

    <!-- ===== Tags 筛选 ===== -->
    <div v-if="allTags.length > 0 && activeTab !== 'audio'" class="ml-tags-bar">
      <button class="ml-tag-chip" :class="{ 'ml-tag-chip--active': !activeTag }" @click="activeTag = null">全部</button>
      <button v-for="t in allTags" :key="t" class="ml-tag-chip" :class="{ 'ml-tag-chip--active': activeTag === t }" @click="activeTag = activeTag === t ? null : t">{{ t }}</button>
    </div>

    <!-- ===== Body ===== -->
    <div class="ml-body">
      <!-- ===== 🎵 音频列表视图 ===== -->
      <template v-if="activeTab === 'audio'">
        <div class="ml-audio-root">
          <!-- Filter bar -->
          <div class="ml-audio-filters">
            <div class="ml-audio-filter-group">
              <button
                v-for="f in (['all', 'BGM', '音效', '配音'] as const)"
                :key="f"
                class="ml-audio-filter-btn"
                :class="{ 'ml-audio-filter-btn--active': audioFilter === f }"
                @click="audioFilter = f"
              >
                {{ f === 'all' ? '所有音频' : f }}
              </button>
            </div>
            <div class="ml-audio-sort-group">
              <span class="ml-audio-sort-label">排序:</span>
              <select v-model="audioSort" class="ml-audio-sort-select">
                <option value="recent">最近上传</option>
                <option value="name">名称</option>
                <option value="duration">时长</option>
                <option value="plays">播放量</option>
              </select>
            </div>
          </div>

          <!-- Audio list -->
          <div class="ml-audio-list-area">
            <!-- Empty state -->
            <div v-if="filteredAudioItems.length === 0" class="ml-audio-empty">
              <span class="ml-audio-empty-icon">🎵</span>
              <h3>还没有音频素材</h3>
              <p>试试 <button class="ml-audio-empty-link" @click="openCreateModal">生成音乐</button> 或 <button class="ml-audio-empty-link">上传音频文件</button></p>
            </div>

            <!-- List cards -->
            <div v-else class="ml-audio-list">
              <div
                v-for="item in filteredAudioItems"
                :key="item.id"
                class="ml-audio-card"
                :class="{ 'ml-audio-card--playing': playingAudioId === item.id }"
              >
                <!-- Play button -->
                <button
                  class="ml-audio-play-btn"
                  :class="{ 'ml-audio-play-btn--active': playingAudioId === item.id }"
                  @click="toggleAudioPlay(item.id)"
                >
                  <span v-if="playingAudioId === item.id" class="ml-audio-waveform">
                    <span class="ml-waveform-bar"></span>
                    <span class="ml-waveform-bar"></span>
                    <span class="ml-waveform-bar"></span>
                    <span class="ml-waveform-bar"></span>
                    <span class="ml-waveform-bar"></span>
                  </span>
                  <span v-else class="ml-audio-play-icon">▶</span>
                </button>

                <!-- File info -->
                <div class="ml-audio-info">
                  <div class="ml-audio-name">{{ item.name }}</div>
                  <div class="ml-audio-meta">
                    <span
                      class="ml-audio-type-badge"
                      :style="{ background: audioTypeColors[item.audioType] + '22', color: audioTypeColors[item.audioType], borderColor: audioTypeColors[item.audioType] + '44' }"
                    >{{ item.audioType }}</span>
                    <span class="ml-audio-duration">{{ formatDuration(item.duration) }}</span>
                    <span class="ml-audio-date">{{ formatDate(item.uploadDate) }}</span>
                  </div>
                </div>

                <!-- Mood tags -->
                <div class="ml-audio-moods">
                  <span
                    v-for="tag in item.moodTags"
                    :key="tag"
                    class="ml-audio-mood-dot"
                    :title="tag"
                    :style="{ background: moodColors[tag] || '#64748b' }"
                  ></span>
                  <span class="ml-audio-mood-labels">
                    <span
                      v-for="tag in item.moodTags"
                      :key="tag"
                      class="ml-audio-mood-chip"
                      :style="{ color: moodColors[tag] || '#64748b' }"
                    >{{ tag }}</span>
                  </span>
                </div>

                <!-- Genre -->
                <span class="ml-audio-genre">{{ item.genre }}</span>

                <!-- Usage count -->
                <span class="ml-audio-usage">使用 {{ item.usageCount }} 次</span>

                <!-- Actions -->
                <div class="ml-audio-actions">
                  <button class="ml-audio-action-btn" @click="toggleAudioPlay(item.id)" :title="playingAudioId === item.id ? '暂停' : '播放'">
                    {{ playingAudioId === item.id ? '⏸' : '▶' }}
                  </button>
                  <button class="ml-audio-action-btn ml-audio-action-btn--add" title="添加到项目">+</button>
                  <button class="ml-audio-action-btn" title="下载">⬇</button>
                  <button class="ml-audio-action-btn ml-audio-action-btn--danger" title="删除" @click="deleteAudioItem(item.id)">🗑</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Audio preview bar (when playing) -->
          <Transition name="modal-fade">
            <div v-if="playingAudioId" class="ml-audio-preview-bar">
              <div class="ml-audio-preview-info">
                <span class="ml-audio-preview-waveform">
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                  <span class="ml-waveform-bar"></span>
                </span>
                <span class="ml-audio-preview-name">{{ audioItems.find(a => a.id === playingAudioId)?.name }}</span>
              </div>
              <div class="ml-audio-preview-controls">
                <button class="ml-audio-preview-stop" @click="playingAudioId = null">⏹ 停止</button>
                <div class="ml-audio-volume">
                  <span class="ml-audio-volume-icon">{{ audioVolume > 50 ? '🔊' : audioVolume > 0 ? '🔉' : '🔇' }}</span>
                  <input
                    type="range"
                    class="ml-audio-volume-slider"
                    min="0"
                    max="100"
                    v-model="audioVolume"
                  />
                  <span class="ml-audio-volume-val">{{ audioVolume }}%</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>

      <!-- ===== 🏷️ 品牌资产 ===== -->
      <template v-else-if="activeTab === 'brand'">
        <div class="ml-brand-root">
          <!-- 品牌信息卡片 -->
          <div class="ml-brand-header">
            <div class="ml-brand-header-left">
              <h2 class="ml-brand-title">品牌资产管理</h2>
              <p class="ml-brand-sub">集中管理品牌视觉资产、Logo、色彩、字体等，确保全站创作风格统一</p>
            </div>
            <button class="ml-brand-cta" @click="showBrandForm = !showBrandForm">
              {{ showBrandForm ? '取消' : '+ 新建品牌' }}
            </button>
          </div>

          <!-- 品牌表单 -->
          <Transition name="slide-down">
            <div v-if="showBrandForm" class="ml-brand-form">
              <div class="ml-brand-form-row">
                <div class="ml-brand-form-group">
                  <label class="ml-brand-form-label">品牌名称</label>
                  <input v-model="brandForm.name" class="ml-brand-form-input" placeholder="例如：长安月下、千机工坊" />
                </div>
                <div class="ml-brand-form-group">
                  <label class="ml-brand-form-label">品牌标语</label>
                  <input v-model="brandForm.slogan" class="ml-brand-form-input" placeholder="品牌宣传语" />
                </div>
              </div>
              <div class="ml-brand-form-row">
                <div class="ml-brand-form-group" style="flex:2">
                  <label class="ml-brand-form-label">主色 (HEX)</label>
                  <div class="ml-brand-color-input">
                    <input v-model="brandForm.primaryColor" class="ml-brand-form-input" placeholder="#00D4AA" />
                    <span class="ml-brand-color-swatch" :style="{background: brandForm.primaryColor || '#00D4AA'}" />
                  </div>
                </div>
                <div class="ml-brand-form-group">
                  <label class="ml-brand-form-label">辅色 (HEX)</label>
                  <div class="ml-brand-color-input">
                    <input v-model="brandForm.secondaryColor" class="ml-brand-form-input" placeholder="#8B5CF6" />
                    <span class="ml-brand-color-swatch" :style="{background: brandForm.secondaryColor || '#8B5CF6'}" />
                  </div>
                </div>
                <div class="ml-brand-form-group">
                  <label class="ml-brand-form-label">字体</label>
                  <input v-model="brandForm.font" class="ml-brand-form-input" placeholder="系统默认" />
                </div>
              </div>
              <div class="ml-brand-form-actions">
                <button class="ml-brand-save-btn" @click="saveBrand">保存品牌</button>
              </div>
            </div>
          </Transition>

          <!-- 品牌列表 -->
          <div class="ml-brand-grid">
            <div v-for="b in brands" :key="b.id" class="ml-brand-card">
              <div class="ml-brand-card-header">
                <div class="ml-brand-card-color" :style="{background: b.primaryColor}" />
                <div class="ml-brand-card-color" :style="{background: b.secondaryColor}" />
              </div>
              <div class="ml-brand-card-body">
                <h4 class="ml-brand-card-name">{{ b.name }}</h4>
                <p class="ml-brand-card-slogan">{{ b.slogan || '暂无标语' }}</p>
                <div class="ml-brand-card-meta">
                  <span class="ml-brand-card-font">{{ b.font || '系统默认' }}</span>
                  <button class="ml-brand-card-del" @click="deleteBrand(b.id)">删除</button>
                </div>
              </div>
              <div class="ml-brand-card-footer">
                <span class="ml-brand-card-date">{{ new Date(b.updatedAt).toLocaleDateString('zh-CN') }}</span>
                <span class="ml-brand-card-badge">{{ b.projectCount || 0 }} 项目</span>
              </div>
            </div>
            <div v-if="brands.length === 0" class="ml-brand-empty">
              <span class="ml-brand-empty-icon">🏷️</span>
              <h3>暂无品牌资产</h3>
              <p>创建品牌统一管理Logo、色彩、字体，确保所有创作风格一致</p>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 📦 素材资产（武器/道具/饰品/特效·技能） ===== -->
      <template v-else-if="activeTab === 'assets'">
        <div class="ml-assets-root">
          <!-- 分类筛选 chips -->
          <div class="ml-assets-filters">
            <button class="ml-asset-chip" :class="{ 'ml-asset-chip--active': assetCategoryFilter === 'all' }" @click="assetCategoryFilter = 'all'">全部</button>
            <button
              v-for="(label, key) in ASSET_CATEGORY_LABELS"
              :key="key"
              class="ml-asset-chip"
              :class="{ 'ml-asset-chip--active': assetCategoryFilter === key }"
              @click="assetCategoryFilter = key"
            >{{ label }}</button>
          </div>

          <!-- 网格 -->
          <div v-if="assetItemsView.length === 0" class="ml-assets-empty">
            <span class="ml-assets-empty-icon">📦</span>
            <h3>还没有素材资产</h3>
            <p>点右上角「+ 新建」→ 选分类（武器 / 道具 / 饰品 / 特效·技能）→ AI 生成并入库；后续生成视频会自动引用这些设定，避免画面风格乱跳。</p>
          </div>

          <div v-else class="ml-assets-grid">
            <div v-for="a in assetItemsView" :key="a.id" class="ml-asset-card">
              <div class="ml-asset-thumb">
                <video v-if="a.video_url" :src="a.video_url" :poster="a.thumbnail_url" controls class="ml-asset-media" />
                <img v-else-if="a.thumbnail_url" :src="a.thumbnail_url" class="ml-asset-media" :alt="a.name" />
                <div v-else class="ml-asset-media ml-asset-media--mock">{{ a.name }}</div>
                <span class="ml-asset-badge">{{ ASSET_CATEGORY_LABELS[a.category] }}</span>
              </div>
              <div class="ml-asset-meta">
                <div class="ml-asset-name">{{ a.name }}</div>
                <div class="ml-asset-desc">{{ a.description || '' }}</div>
              </div>
              <button class="ml-asset-del" @click="assetStore.remove(a.id)">删除</button>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 常规素材视图（非音频、非品牌） ===== -->
      <template v-else>
      <!-- 左侧列表 -->
      <div class="ml-list">
        <!-- 空状态 -->
        <div v-if="filteredItems.length === 0" class="ml-empty">
          <span class="ml-empty-icon">🎭</span>
          <h3>暂无素材</h3>
          <p>点击「+ 新建」创建你的第一个{{ tabs.find(t=>t.id===activeTab)?.label }}素材</p>
        </div>

        <!-- 卡片网格 -->
        <div v-else class="ml-grid">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="ml-card"
            :class="{ 'ml-card--selected': selectedId === item.id }"
            @click="selectItem(item.id)"
          >
            <!-- 图片预览区 -->
            <div class="ml-card-img-wrap">
              <div
                v-if="item.images[0]?.url"
                class="ml-card-img"
                :style="{ backgroundImage: `url(${item.images[0].url})` }"
              ></div>
              <div v-else class="ml-card-img ml-card-img--empty">
                <span class="ml-card-img-hint">
                  {{ item.images[0]?.prompt ? '🖼️ 待生成' : '📷 上传图片' }}
                </span>
              </div>

              <!-- 悬停操作层 -->
              <div class="ml-card-overlay">
                <button class="ml-card-overlay-btn" @click.stop="openImageEdit(item.id, 0)">✏️ 编辑</button>
              </div>

              <!-- 状态标签 -->
              <span v-if="item.images[0]?.status === 'generating'" class="ml-card-badge ml-card-badge--busy">生成中</span>
            </div>

            <div class="ml-card-body">
              <span class="ml-card-name">{{ item.name }}</span>
              <span v-if="item.images.length > 1" class="ml-card-img-count">{{ item.images.length }} 张图</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧详情面板 -->
      <div v-if="selectedItem" class="ml-detail">
        <div class="ml-detail-head">
          <h3 class="ml-detail-title">{{ selectedItem.name }}</h3>
          <div class="ml-detail-actions">
            <button class="ml-btn-sm ml-btn-sm--danger" @click="deleteItem">🗑 删除</button>
          </div>
        </div>

        <div class="ml-detail-body">
          <!-- 所有图片 -->
          <div class="ml-detail-section">
            <div class="ml-detail-section-head">
              <span class="ml-detail-label">📷 图片 ({{ selectedItem.images.length }})</span>
              <button class="ml-btn-xs" @click="addNewImage">+ 添加</button>
            </div>
            <div class="ml-detail-images">
              <div
                v-for="(img, idx) in selectedItem.images"
                :key="img.id"
                class="ml-detail-img-card"
                @click="openImageEdit(selectedItem.id, idx)"
              >
                <div
                  v-if="img.url"
                  class="ml-detail-img"
                  :style="{ backgroundImage: `url(${img.url})` }"
                ></div>
                <div v-else class="ml-detail-img ml-detail-img--empty">
                  <span>{{ img.prompt ? img.prompt.slice(0, 30) + '…' : '无图片' }}</span>
                </div>
                <div class="ml-detail-img-info">
                  <span class="ml-detail-img-style">{{ styleOptions.find(s=>s.value===img.style)?.icon }} {{ img.style }}</span>
                  <span v-if="selectedItem.images.length > 1" class="ml-detail-img-del" @click.stop="deleteImage(idx)">✕</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 描述 -->
          <label class="ml-field">
            <span class="ml-field-label">描述</span>
            <p class="ml-field-text">{{ selectedItem.description || '暂无描述' }}</p>
          </label>

          <!-- 标签 -->
          <label class="ml-field">
            <span class="ml-field-label">标签</span>
            <div class="ml-tags">
              <span v-for="t in selectedItem.tags" :key="t" class="ml-tag">{{ t }}</span>
              <span v-if="selectedItem.tags.length===0" class="ml-no-data">无</span>
            </div>
          </label>

          <!-- 提示词 -->
          <label class="ml-field">
            <span class="ml-field-label">提示词</span>
            <p class="ml-field-text ml-field-mono">{{ selectedItem.images[0]?.prompt || '未设置' }}</p>
          </label>
        </div>
      </div>

      <div v-else class="ml-detail-empty">
        <span>👈 选择素材查看详情</span>
      </div>
      </template>
    </div>

    <!-- ============ 新建素材 模态框 ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
          <div class="modal-dialog modal-dialog--wide" :class="{ 'modal-dialog--create': createStep === 'select' }">
            <div class="modal-head">
              <h3>
                {{ createStep === 'form' ? '✨ 新建' + tabs.find(t=>t.id===activeTab)?.addLabel : '' }}
                {{ createStep === 'generating' ? '🤖 正在生成…' : '' }}
                {{ createStep === 'select' ? '🖼️ 选择一张图片' : '' }}
              </h3>
              <button class="modal-close" @click="showCreateModal = false">✕</button>
            </div>

            <!-- 步骤 1: 填表 -->
            <div v-if="createStep === 'form'" class="modal-body modal-body--two-col">
              <div class="modal-col">
                <h4 class="modal-col-title">📋 基本信息</h4>
                <label class="ml-field">
                  <span class="ml-field-label">名称 *</span>
                  <input v-model="createForm.name" class="ml-input" placeholder="输入素材名称" />
                </label>
                <label class="ml-field">
                  <span class="ml-field-label">描述</span>
                  <textarea v-model="createForm.description" class="ml-input ml-textarea" rows="3" placeholder="简要描述…"></textarea>
                </label>
                <label class="ml-field">
                  <span class="ml-field-label">标签（逗号分隔）</span>
                  <input v-model="createForm.tags" class="ml-input" placeholder="主角, 剑修, 少年" />
                </label>
              </div>
              <div class="modal-col">
                <h4 class="modal-col-title">🤖 AI 生成参数</h4>
                <label class="ml-field">
                  <span class="ml-field-label">提示词 *</span>
                  <textarea v-model="createForm.prompt" class="ml-input ml-textarea" rows="4" placeholder="描述你想要的画面…&#10;例：少年剑修，白衣黑发，眼神坚定，仙侠风格"></textarea>
                </label>
                <label class="ml-field">
                  <span class="ml-field-label">反向提示词</span>
                  <input v-model="createForm.negativePrompt" class="ml-input" placeholder="低质量, 模糊, 变形" />
                </label>
                <div class="ml-field-row">
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">风格</span>
                    <select v-model="createForm.style" class="ml-input ml-select">
                      <option v-for="s in styleOptions" :key="s.value" :value="s.value">{{ s.icon }} {{ s.label }}</option>
                    </select>
                  </label>
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">比例</span>
                    <select v-model="createForm.aspectRatio" class="ml-input ml-select">
                      <option v-for="r in ratioOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                    </select>
                  </label>
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">分辨率</span>
                    <select v-model="createForm.resolution" class="ml-input ml-select">
                      <option v-for="r in resOptions" :key="r" :value="r">{{ r }}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <!-- 步骤 2: 生成中 -->
            <div v-if="createStep === 'generating'" class="modal-body">
              <div class="ml-generating">
                <div class="ml-generating-loader">
                  <span class="ml-spinner-lg"></span>
                  <span class="ml-generating-text">AI 正在生成图片…</span>
                  <span class="ml-generating-progress">{{ generatedPreviews.length }} / 3</span>
                </div>
                <div class="ml-generating-hint">
                  正在根据你的提示词生成三张候选图片，请稍候
                </div>
              </div>
            </div>

            <!-- 步骤 3: 三选一 -->
            <div v-if="createStep === 'select'" class="modal-body">
              <p class="ml-select-hint">AI 生成了三张图片，选择一张你喜欢的来保存</p>
              <div class="ml-select-grid">
                <div
                  v-for="(prev, idx) in generatedPreviews"
                  :key="prev.id"
                  class="ml-select-card"
                  :class="{ 'ml-select-card--active': selectedPreview === idx }"
                  @click="selectedPreview = idx"
                >
                  <div v-if="prev.url" class="ml-select-img" :style="{ backgroundImage: `url(${prev.url})` }"></div>
                  <div v-else class="ml-select-img ml-select-img--mock">
                    <div class="ml-select-mock-prompt">{{ createForm.prompt.slice(0, 50) }}{{ createForm.prompt.length > 50 ? '…' : '' }}</div>
                    <div class="ml-select-mock-badge">{{ styleOptions.find(s=>s.value===createForm.style)?.icon }} {{ createForm.style }} · seed {{ prev.seed }}</div>
                  </div>
                  <div class="ml-select-radio" :class="{ 'ml-select-radio--on': selectedPreview === idx }">
                    {{ selectedPreview === idx ? '◉' : '○' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-foot">
              <button class="ml-btn" @click="showCreateModal = false">取消</button>

              <!-- 步骤1: 生成预览按钮 -->
              <button
                v-if="createStep === 'form'"
                class="ml-btn ml-btn--primary ml-btn--lg"
                :disabled="!createForm.prompt.trim()"
                @click="generatePreviews"
              >🤖 生成三张预览</button>

              <!-- 步骤2: 加载中 -->
              <button
                v-if="createStep === 'generating'"
                class="ml-btn ml-btn--primary ml-btn--lg"
                disabled
              >
                <span class="ml-spinner"></span> 生成中…
              </button>

              <!-- 步骤3: 返回 + 确认创建 -->
              <template v-if="createStep === 'select'">
                <button class="ml-btn" @click="backToForm">← 返回修改</button>
                <button
                  class="ml-btn ml-btn--primary ml-btn--lg"
                  :disabled="!createForm.name.trim()"
                  @click="confirmCreate"
                >✅ 确认创建并保存</button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ 图片编辑模态框 ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showImageModal" class="modal-overlay" @click.self="showImageModal = false">
          <div class="modal-dialog modal-dialog--wide">
            <div class="modal-head">
              <h3>🖼️ 编辑图片 — {{ selectedItem?.name }}</h3>
              <button class="modal-close" @click="showImageModal = false">✕</button>
            </div>
            <div class="modal-body modal-body--two-col">
              <!-- 左：预览 -->
              <div class="modal-col">
                <h4 class="modal-col-title">预览</h4>
                <div class="ml-image-preview">
                  <div
                    v-if="selectedItem?.images[editImageIndex]?.url"
                    class="ml-image-preview-img"
                    :style="{ backgroundImage: `url(${selectedItem?.images[editImageIndex]?.url})` }"
                  ></div>
                  <div v-else class="ml-image-preview-empty">
                    <span>暂无图片</span>
                    <span class="ml-image-preview-hint">生成或上传图片</span>
                  </div>
                </div>
                <!-- 上传 -->
                <label class="ml-field" style="margin-top:12px">
                  <span class="ml-field-label">📤 上传本地图片</span>
                  <input type="file" accept="image/*" class="ml-input" @change="handleUpload" />
                </label>
              </div>

              <!-- 右：AI 生成 -->
              <div class="modal-col">
                <h4 class="modal-col-title">🤖 AI 生成 / 修改</h4>
                <label class="ml-field">
                  <span class="ml-field-label">提示词</span>
                  <textarea v-model="editImageForm.prompt" class="ml-input ml-textarea" rows="4" placeholder="修改提示词…"></textarea>
                </label>
                <label class="ml-field">
                  <span class="ml-field-label">反向提示词</span>
                  <input v-model="editImageForm.negativePrompt" class="ml-input" placeholder="避免的元素…" />
                </label>
                <div class="ml-field-row">
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">风格</span>
                    <select v-model="editImageForm.style" class="ml-input ml-select">
                      <option v-for="s in styleOptions" :key="s.value" :value="s.value">{{ s.icon }} {{ s.label }}</option>
                    </select>
                  </label>
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">比例</span>
                    <select v-model="editImageForm.aspectRatio" class="ml-input ml-select">
                      <option v-for="r in ratioOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                    </select>
                  </label>
                  <label class="ml-field ml-field--sm">
                    <span class="ml-field-label">分辨率</span>
                    <select v-model="editImageForm.resolution" class="ml-input ml-select">
                      <option v-for="r in resOptions" :key="r" :value="r">{{ r }}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div class="modal-foot">
              <button class="ml-btn ml-btn--ghost" @click="showImageModal = false">取消</button>
              <button
                class="ml-btn ml-btn--primary ml-btn--lg"
                :disabled="imageGenerating || !editImageForm.prompt.trim()"
                @click="regenerateImage"
              >
                <span v-if="imageGenerating" class="ml-spinner"></span>
                {{ imageGenerating ? '生成中…' : '🤖 重新生成' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ 📦 生成素材资产（武器/道具/饰品/特效·技能）模态框 ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAssetGen" class="modal-overlay" @click.self="closeAssetGen">
          <div class="modal-dialog">
            <div class="modal-head">
              <h3>📦 生成素材资产</h3>
              <button class="modal-close" @click="closeAssetGen">✕</button>
            </div>
            <div class="modal-body">
              <label class="ml-field">
                <span class="ml-field-label">分类 *</span>
                <select v-model="assetGen.category" class="ml-input ml-select">
                  <option v-for="(label, key) in ASSET_CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </label>
              <label class="ml-field">
                <span class="ml-field-label">名称 *</span>
                <input v-model="assetGen.name" class="ml-input" placeholder="如：青锋剑 / 储物戒指 / 炎爆术" />
              </label>
              <label class="ml-field">
                <span class="ml-field-label">题材</span>
                <select v-model="assetGen.genre" class="ml-input ml-select">
                  <option v-for="g in GENRE_OPTIONS" :key="g" :value="g">{{ g }}</option>
                </select>
              </label>
              <label class="ml-field">
                <span class="ml-field-label">设定 / 描述</span>
                <textarea v-model="assetGen.description" class="ml-input ml-textarea" rows="2" placeholder="外观、材质、效果等描述"></textarea>
              </label>
              <label class="ml-field">
                <span class="ml-field-label">自定义提示词（留空自动生成）</span>
                <textarea v-model="assetGen.prompt" class="ml-input ml-textarea" rows="3" placeholder="不填则由 题材+分类+名称+描述 自动拼装"></textarea>
              </label>
              <p v-if="assetGen.error" class="ml-asset-error">{{ assetGen.error }}</p>
              <p v-if="assetGen.step" class="ml-asset-step">{{ assetGen.step }}</p>
            </div>
            <div class="modal-foot">
              <button class="ml-btn" @click="closeAssetGen" :disabled="assetGen.busy">取消</button>
              <button class="ml-btn ml-btn--primary ml-btn--lg" :disabled="!assetGen.name.trim() || assetGen.busy" @click="generateAsset">
                <span v-if="assetGen.busy" class="ml-spinner"></span>{{ assetGen.busy ? '生成中…' : '🤖 AI 生成并入库' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== 🆕 其他作品素材概览 ===== -->
    <div v-if="otherProjectStats.length > 0" class="ml-other-projects">
      <div class="ml-other-divider"><span>其他作品素材</span></div>
      <div class="ml-other-grid">
        <div
          v-for="p in otherProjectStats"
          :key="p.id"
          class="ml-other-card"
          @click="switchProject(p.id)"
        >
          <div class="ml-other-card-head">
            <span>{{ p.icon }} {{ p.name }}</span>
            <span class="ml-other-card-link">切换 →</span>
          </div>
          <div class="ml-other-card-stats">
            <span>👤 {{ p.characters }}</span>
            <span>🎬 {{ p.scenes }}</span>
            <span>🗡️ {{ p.props }}</span>
            <span>🎙️ {{ p.voices }}</span>
          </div>
        </div>
        <div class="ml-other-card ml-other-card--new">
          <span>+ 新建作品</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Root ===== */
.ml-root { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--bg-primary, #0a0e1a); color: var(--text-primary, #e4e4e7); }

/* ===== 🆕 Project Bar ===== */
.ml-project-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 20px; border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
}
.ml-project-bar-label { font-size: 11px; color: var(--text-secondary, #94a3b8); font-weight: 600; flex-shrink: 0; }
.ml-project-current {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 6px;
  background: rgba(129,140,248,0.1); border: 1px solid var(--accent, #818cf8);
  color: var(--accent, #818cf8); font-size: 13px; font-weight: 600; cursor: pointer;
}
.ml-project-current-arrow { font-size: 9px; opacity: 0.6; }
.ml-project-meta { font-size: 11px; color: var(--text-secondary, #94a3b8); }
.ml-project-chips { display: flex; gap: 6px; margin-left: auto; }
.ml-project-chip {
  padding: 4px 12px; border-radius: 16px;
  background: var(--bg-tertiary, #1f2937); border: 1px solid var(--border, #1f2937);
  color: var(--text-secondary, #94a3b8); font-size: 11px; cursor: pointer; transition: all 150ms;
}
.ml-project-chip:hover { border-color: var(--border-strong, #334155); }
.ml-project-chip--active { background: rgba(129,140,248,0.1); border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.ml-project-chip--new { border-style: dashed; opacity: 0.5; }
.ml-tab-count { font-size: 10px; color: var(--text-secondary, #94a3b8); }

/* ===== Header ===== */
.ml-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 24px; border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827); gap: 12px;
}
.ml-header-left { display: flex; align-items: center; gap: 8px; }
.ml-header-icon { font-size: 20px; }
.ml-header-title { font-size: 15px; font-weight: 700; }
.ml-header-count { font-size: 11px; color: var(--text-secondary, #94a3b8); padding: 2px 8px; border-radius: 6px; background: var(--bg-tertiary, #1f2937); }
.ml-header-right { display: flex; align-items: center; gap: 8px; }
.ml-search { width: 180px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border, #1f2937); background: var(--bg-tertiary, #1f2937); color: var(--text-primary, #e4e4e7); font-size: 12px; }
.ml-search:focus { border-color: var(--accent, #818cf8); outline: none; }

/* ===== Buttons ===== */
.ml-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border, #1f2937); background: var(--bg-tertiary, #1f2937); color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; transition: all 200ms; }
.ml-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e4e4e7); }
.ml-btn--primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; font-weight: 600; }
.ml-btn--primary:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(102,126,234,0.3); transform: translateY(-1px); }
.ml-btn--lg { padding: 10px 24px; font-size: 14px; }
.ml-btn--ghost { background: transparent; border: 1px dashed var(--border, #1f2937); }
.ml-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ml-btn-sm { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border, #1f2937); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 11px; cursor: pointer; transition: all 150ms; }
.ml-btn-sm:hover { border-color: var(--accent, #818cf8); }
.ml-btn-sm--danger:hover { border-color: #ef4444; color: #ef4444; }
.ml-btn-xs { padding: 2px 8px; border-radius: 5px; border: 1px solid var(--border, #1f2937); background: transparent; color: var(--accent, #818cf8); font-size: 10px; cursor: pointer; }
.ml-btn-xs:hover { background: rgba(129,140,248,0.1); }

.ml-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 6px; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== Tabs ===== */
.ml-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border, #1f2937); background: var(--bg-secondary, #111827); padding: 0 20px; }
.ml-tab {
  display: flex; align-items: center; gap: 6px; padding: 10px 20px;
  border: none; border-bottom: 2px solid transparent;
  background: transparent; color: var(--text-secondary, #94a3b8);
  font-size: 13px; cursor: pointer; transition: all 200ms;
}
.ml-tab:hover { color: var(--text-primary, #e4e4e7); }
.ml-tab--active { color: var(--accent, #818cf8); border-bottom-color: var(--accent, #818cf8); }
.ml-tab-icon { font-size: 16px; }

/* ===== Tags Bar ===== */
.ml-tags-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 20px; border-bottom: 1px solid var(--border, #1f2937); background: var(--bg-primary, #0a0e1a); }
.ml-tag-chip {
  padding: 3px 10px; border-radius: 12px; border: 1px solid var(--border, #1f2937);
  background: transparent; color: var(--text-secondary, #94a3b8);
  font-size: 11px; cursor: pointer; transition: all 150ms;
}
.ml-tag-chip:hover { border-color: var(--accent, #818cf8); }
.ml-tag-chip--active { background: rgba(129,140,248,0.12); border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }

/* ===== Body Layout ===== */
.ml-body { flex: 1; display: flex; overflow: hidden; }
.ml-list { flex: 1; overflow-y: auto; min-width: 0; }

/* ===== Empty ===== */
.ml-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 8px; color: var(--text-secondary, #94a3b8); }
.ml-empty-icon { font-size: 40px; opacity: 0.3; }
.ml-empty h3 { font-size: 15px; margin: 0; color: var(--text-primary, #e4e4e7); }
.ml-empty p { font-size: 12px; margin: 0; }

/* ===== Card Grid ===== */
.ml-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; padding: 16px 20px; }
.ml-card {
  border: 1px solid var(--border, #1f2937); border-radius: 10px;
  background: var(--bg-secondary, #111827); cursor: pointer;
  transition: all 200ms; overflow: hidden;
}
.ml-card:hover { transform: translateY(-2px); border-color: var(--accent, #818cf8); }
.ml-card--selected { border-color: var(--accent, #818cf8); box-shadow: 0 0 0 2px rgba(129,140,248,0.3); }

/* 🆕 图片预览 */
.ml-card-img-wrap { height: 160px; position: relative; overflow: hidden; }
.ml-card-img {
  width: 100%; height: 100%; background-size: cover; background-position: center;
  transition: transform 0.3s ease;
}
.ml-card:hover .ml-card-img { transform: scale(1.05); }
.ml-card-img--empty {
  background: var(--bg-tertiary, #1f2937);
  display: flex; align-items: center; justify-content: center;
}
.ml-card-img-hint { font-size: 13px; color: var(--text-secondary, #94a3b8); }

/* 悬停操作层 */
.ml-card-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.5); opacity: 0;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 200ms;
}
.ml-card:hover .ml-card-overlay { opacity: 1; }
.ml-card-overlay-btn {
  padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.6); color: white;
  font-size: 12px; cursor: pointer;
}

/* 状态标签 */
.ml-card-badge {
  position: absolute; top: 8px; right: 8px;
  padding: 2px 8px; border-radius: 6px; font-size: 10px;
}
.ml-card-badge--busy { background: rgba(251,191,36,0.8); color: black; animation: pulse-slow 1.5s infinite; }
@keyframes pulse-slow { 0%,100%{opacity:1} 50%{opacity:0.6} }

.ml-card-body { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; }
.ml-card-name { font-size: 13px; font-weight: 600; }
.ml-card-img-count { font-size: 10px; color: var(--text-secondary, #94a3b8); }

/* ===== Detail Panel ===== */
.ml-detail {
  width: 340px; flex-shrink: 0; border-left: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827); overflow-y: auto;
  display: flex; flex-direction: column;
}
.ml-detail-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 1px solid var(--border, #1f2937);
  position: sticky; top: 0; background: var(--bg-secondary, #111827); z-index: 1;
}
.ml-detail-title { font-size: 14px; font-weight: 700; margin: 0; }
.ml-detail-actions { display: flex; gap: 6px; }
.ml-detail-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.ml-detail-empty { width: 280px; flex-shrink: 0; border-left: 1px solid var(--border, #1f2937); display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #94a3b8); font-size: 13px; }

/* Detail sections */
.ml-detail-section { display: flex; flex-direction: column; gap: 8px; }
.ml-detail-section-head { display: flex; justify-content: space-between; align-items: center; }
.ml-detail-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary, #94a3b8); }

/* Detail image cards */
.ml-detail-images { display: flex; gap: 8px; overflow-x: auto; }
.ml-detail-img-card {
  width: 100px; flex-shrink: 0; border: 1px solid var(--border, #1f2937); border-radius: 8px;
  overflow: hidden; cursor: pointer; transition: border-color 200ms;
}
.ml-detail-img-card:hover { border-color: var(--accent, #818cf8); }
.ml-detail-img {
  height: 80px; background-size: cover; background-position: center;
}
.ml-detail-img--empty {
  background: var(--bg-tertiary, #1f2937); display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: var(--text-secondary, #94a3b8); padding: 4px; text-align: center;
}
.ml-detail-img-info { padding: 4px 6px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; }
.ml-detail-img-style { color: var(--text-secondary, #94a3b8); }
.ml-detail-img-del { color: #ef4444; cursor: pointer; padding: 0 2px; }
.ml-detail-img-del:hover { background: rgba(239,68,68,0.1); border-radius: 3px; }

/* Fields */
.ml-field { display: flex; flex-direction: column; gap: 4px; }
.ml-field--sm { flex: 1; min-width: 0; }
.ml-field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary, #94a3b8); }
.ml-field-text { font-size: 12px; color: var(--text-primary, #e4e4e7); margin: 0; line-height: 1.5; }
.ml-field-mono { font-family: monospace; font-size: 11px; }
.ml-field-row { display: flex; gap: 8px; }
.ml-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.ml-tag { font-size: 10px; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--border, #1f2937); color: var(--text-secondary, #94a3b8); }
.ml-no-data { font-size: 11px; color: var(--text-secondary, #94a3b8); opacity: 0.5; }

/* Inputs */
.ml-input {
  padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937); color: var(--text-primary, #e4e4e7);
  font-size: 12px; width: 100%; box-sizing: border-box; transition: border-color 200ms;
}
.ml-input:focus { border-color: var(--accent, #818cf8); outline: none; }
.ml-textarea { resize: vertical; font-family: inherit; }
.ml-select { cursor: pointer; }

/* ===== Modal ===== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.modal-dialog {
  background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1f2937);
  border-radius: 14px; width: 90vw; max-width: 800px; max-height: 85vh;
  display: flex; flex-direction: column;
}
.modal-dialog--wide { max-width: 800px; }
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--border, #1f2937);
}
.modal-head h3 { margin: 0; font-size: 15px; }
.modal-close { border: none; background: transparent; color: var(--text-secondary, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px; }
.modal-close:hover { color: #ef4444; }
.modal-body { padding: 20px; overflow-y: auto; }
.modal-body--two-col { display: flex; gap: 24px; }
.modal-col { flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.modal-col-title { font-size: 13px; font-weight: 700; margin: 0; }
.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px; border-top: 1px solid var(--border, #1f2937);
}

/* 🆕 三选一预览 */
.ml-select-hint { font-size: 13px; color: var(--text-secondary, #94a3b8); text-align: center; margin: 0 0 16px; }
.ml-select-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ml-select-card { border: 2px solid var(--border, #1f2937); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 200ms; position: relative; }
.ml-select-card:hover { border-color: var(--accent, #818cf8); transform: translateY(-2px); }
.ml-select-card--active { border-color: #34d399; box-shadow: 0 0 0 2px rgba(52,211,153,0.3); }
.ml-select-img { height: 200px; background-size: cover; background-position: center; background-color: var(--bg-tertiary, #1f2937); }
.ml-select-img--mock { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; text-align: center; }
.ml-select-mock-prompt { font-size: 12px; color: var(--text-primary, #e4e4e7); line-height: 1.5; word-break: break-word; }
.ml-select-mock-badge { font-size: 10px; padding: 4px 10px; border-radius: 6px; background: rgba(129,140,248,0.1); color: var(--accent, #818cf8); }
.ml-select-radio { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; }
.ml-select-radio--on { background: #34d399; }
.modal-dialog--create { max-width: 900px; }

/* 🆕 生成中 */
.ml-generating { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 20px; }
.ml-generating-loader { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.ml-spinner-lg { width: 40px; height: 40px; border: 3px solid rgba(129,140,248,0.2); border-top-color: var(--accent, #818cf8); border-radius: 50%; animation: spin 0.8s linear infinite; }
.ml-generating-text { font-size: 15px; font-weight: 600; color: var(--text-primary, #e4e4e7); }
.ml-generating-progress { font-size: 12px; color: var(--accent, #818cf8); font-weight: 600; }
.ml-generating-hint { font-size: 12px; color: var(--text-secondary, #94a3b8); }

/* Image preview in modal */
.ml-image-preview {
  width: 100%; height: 200px; border-radius: 10px; overflow: hidden;
  border: 1px solid var(--border, #1f2937);
}
.ml-image-preview-img {
  width: 100%; height: 100%; background-size: contain; background-position: center; background-repeat: no-repeat;
  background-color: var(--bg-tertiary, #1f2937);
}
.ml-image-preview-empty {
  width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg-tertiary, #1f2937); gap: 4px;
  color: var(--text-secondary, #94a3b8); font-size: 13px;
}
.ml-image-preview-hint { font-size: 11px; opacity: 0.5; }

/* Transitions */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 200ms ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 768px) {
  .ml-body { flex-direction: column; }
  .ml-detail, .ml-detail-empty { width: 100%; border-left: none; border-top: 1px solid var(--border, #1f2937); max-height: 50vh; }
  .modal-body--two-col { flex-direction: column; }
}

/* ===== 🆕 Other Projects ===== */
.ml-other-projects { border-top: 1px solid var(--border, #1f2937); padding: 16px 20px; }
.ml-other-divider { text-align: center; margin-bottom: 12px; }
.ml-other-divider span { font-size: 11px; color: var(--text-secondary, #94a3b8); padding: 0 12px; }
.ml-other-grid { display: flex; gap: 12px; opacity: 0.55; }
.ml-other-card {
  flex: 1; padding: 12px 14px; border-radius: 10px;
  background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1f2937);
  cursor: pointer; transition: all 150ms;
}
.ml-other-card:hover { border-color: var(--accent, #818cf8); opacity: 1; }
.ml-other-card--new { border-style: dashed; display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #94a3b8); }
.ml-other-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 600; }
.ml-other-card-link { font-size: 10px; color: var(--accent, #818cf8); }
.ml-other-card-stats { display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary, #94a3b8); }

/* ===== 🎵 Audio List View ===== */
.ml-audio-root {
  flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}

/* Filter bar */
.ml-audio-filters {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; border-bottom: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827); gap: 12px;
}
.ml-audio-filter-group { display: flex; gap: 4px; }
.ml-audio-filter-btn {
  padding: 5px 14px; border-radius: 16px;
  border: 1px solid var(--border, #1f2937);
  background: transparent; color: var(--text-secondary, #94a3b8);
  font-size: 12px; cursor: pointer; transition: all 150ms;
}
.ml-audio-filter-btn:hover { border-color: var(--accent, #818cf8); }
.ml-audio-filter-btn--active {
  background: rgba(129,140,248,0.12); border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8); font-weight: 600;
}
.ml-audio-sort-group { display: flex; align-items: center; gap: 6px; }
.ml-audio-sort-label { font-size: 11px; color: var(--text-secondary, #94a3b8); }
.ml-audio-sort-select {
  padding: 4px 8px; border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-primary, #e4e4e7); font-size: 11px;
  cursor: pointer; outline: none;
}
.ml-audio-sort-select:focus { border-color: var(--accent, #818cf8); }

/* Audio list area */
.ml-audio-list-area { flex: 1; overflow-y: auto; padding: 12px 20px; }

/* Empty state */
.ml-audio-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 8px; color: var(--text-secondary, #94a3b8); padding: 60px 20px;
}
.ml-audio-empty-icon { font-size: 48px; opacity: 0.3; }
.ml-audio-empty h3 { font-size: 16px; margin: 0; color: var(--text-primary, #e4e4e7); }
.ml-audio-empty p { font-size: 13px; margin: 4px 0 0; }
.ml-audio-empty-link {
  background: none; border: none; color: var(--accent, #818cf8);
  font-size: 13px; cursor: pointer; text-decoration: underline;
  text-underline-offset: 2px; padding: 0;
}
.ml-audio-empty-link:hover { color: #a5b4fc; }

/* Audio list */
.ml-audio-list { display: flex; flex-direction: column; gap: 6px; }

/* Audio card (list row) */
.ml-audio-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-secondary, #111827);
  transition: all 200ms;
}
.ml-audio-card:hover {
  border-color: var(--border-strong, #334155);
  background: var(--bg-tertiary, #1f2937);
}
.ml-audio-card--playing {
  border-color: var(--accent, #818cf8);
  background: rgba(129,140,248,0.06);
  box-shadow: 0 0 0 1px rgba(129,140,248,0.15);
}

/* Play button */
.ml-audio-play-btn {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--border, #1f2937);
  background: var(--bg-tertiary, #1f2937);
  color: var(--text-secondary, #94a3b8);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 200ms;
}
.ml-audio-play-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
  background: rgba(129,140,248,0.1);
}
.ml-audio-play-btn--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129,140,248,0.15);
  color: var(--accent, #818cf8);
}
.ml-audio-play-icon { font-size: 14px; margin-left: 2px; }

/* Waveform animation */
.ml-audio-waveform {
  display: flex; align-items: flex-end; gap: 2px; height: 18px;
}
.ml-waveform-bar {
  width: 3px; border-radius: 1.5px;
  background: var(--accent, #818cf8);
  animation: waveform-dance 0.8s ease-in-out infinite alternate;
}
.ml-waveform-bar:nth-child(1) { height: 40%; animation-delay: 0s; }
.ml-waveform-bar:nth-child(2) { height: 70%; animation-delay: 0.1s; }
.ml-waveform-bar:nth-child(3) { height: 100%; animation-delay: 0.2s; }
.ml-waveform-bar:nth-child(4) { height: 55%; animation-delay: 0.3s; }
.ml-waveform-bar:nth-child(5) { height: 80%; animation-delay: 0.15s; }
.ml-waveform-bar:nth-child(6) { height: 45%; animation-delay: 0.25s; }
.ml-waveform-bar:nth-child(7) { height: 65%; animation-delay: 0.05s; }
@keyframes waveform-dance {
  0% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
  100% { transform: scaleY(0.5); }
}

/* Audio info */
.ml-audio-info { flex: 1; min-width: 0; }
.ml-audio-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary, #e4e4e7);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ml-audio-meta {
  display: flex; align-items: center; gap: 8px; margin-top: 3px;
}
.ml-audio-type-badge {
  padding: 1px 8px; border-radius: 8px;
  font-size: 10px; font-weight: 600;
  border: 1px solid;
}
.ml-audio-duration {
  font-size: 11px; color: var(--text-secondary, #94a3b8);
  font-family: monospace; font-weight: 500;
}
.ml-audio-date { font-size: 11px; color: var(--text-muted, #64748b); }

/* Mood tags */
.ml-audio-moods {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}
.ml-audio-mood-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; flex-shrink: 0;
}
.ml-audio-mood-labels { display: flex; gap: 4px; }
.ml-audio-mood-chip { font-size: 10px; font-weight: 600; }

/* Genre */
.ml-audio-genre {
  padding: 2px 8px; border-radius: 6px;
  background: var(--bg-tertiary, #1f2937);
  border: 1px solid var(--border, #1f2937);
  font-size: 10px; color: var(--text-secondary, #94a3b8);
  flex-shrink: 0; white-space: nowrap;
}

/* Usage */
.ml-audio-usage {
  font-size: 10px; color: var(--text-muted, #64748b);
  flex-shrink: 0; white-space: nowrap;
}

/* Actions */
.ml-audio-actions {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}
.ml-audio-action-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border, #1f2937);
  background: transparent; color: var(--text-secondary, #94a3b8);
  font-size: 12px; cursor: pointer; transition: all 150ms;
  display: flex; align-items: center; justify-content: center;
}
.ml-audio-action-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
  background: rgba(129,140,248,0.08);
}
.ml-audio-action-btn--add:hover {
  border-color: #34d399; color: #34d399;
  background: rgba(52,211,153,0.08);
}
.ml-audio-action-btn--danger:hover {
  border-color: #ef4444; color: #ef4444;
  background: rgba(239,68,68,0.08);
}

/* Audio preview bar (bottom) */
.ml-audio-preview-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px;
  border-top: 1px solid var(--accent, #818cf8);
  background: linear-gradient(135deg, rgba(129,140,248,0.08) 0%, rgba(118,75,162,0.06) 100%);
  flex-shrink: 0;
}
.ml-audio-preview-info { display: flex; align-items: center; gap: 10px; }
.ml-audio-preview-waveform {
  display: flex; align-items: flex-end; gap: 2px; height: 20px;
}
.ml-audio-preview-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary, #e4e4e7);
}
.ml-audio-preview-controls { display: flex; align-items: center; gap: 16px; }
.ml-audio-preview-stop {
  padding: 5px 14px; border-radius: 6px;
  border: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.08);
  color: #f87171; font-size: 12px; cursor: pointer;
  transition: all 150ms;
}
.ml-audio-preview-stop:hover {
  background: rgba(239,68,68,0.15); border-color: #ef4444;
}
.ml-audio-volume { display: flex; align-items: center; gap: 6px; }
.ml-audio-volume-icon { font-size: 14px; }
.ml-audio-volume-slider {
  -webkit-appearance: none; appearance: none;
  width: 80px; height: 4px; border-radius: 2px;
  background: var(--bg-tertiary, #1f2937); outline: none; cursor: pointer;
}
.ml-audio-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent, #818cf8); cursor: pointer;
}
.ml-audio-volume-slider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent, #818cf8); cursor: pointer; border: none;
}
.ml-audio-volume-val {
  font-size: 10px; color: var(--text-muted, #64748b);
  width: 32px; text-align: right;
}

/* ===== 🏷️ 品牌资产样式 ===== */
.ml-brand-root { padding: 20px 0; }

.ml-brand-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 20px; gap: 16px;
}

.ml-brand-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
.ml-brand-sub { font-size: 13px; color: var(--text-secondary); margin: 0; }

.ml-brand-cta {
  padding: 9px 18px; border: 1px solid var(--accent, #818cf8); border-radius: 8px;
  background: transparent; color: var(--accent, #818cf8); font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: inherit; white-space: nowrap; transition: all 200ms;
}
.ml-brand-cta:hover { background: rgba(129,140,248,0.1); }

.ml-brand-form {
  padding: 20px; background: var(--bg-tertiary, #1f2937);
  border: 1px solid var(--border, #2e3139); border-radius: 12px; margin-bottom: 20px;
}

.ml-brand-form-row { display: flex; gap: 14px; margin-bottom: 12px; }
.ml-brand-form-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.ml-brand-form-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); letter-spacing: 0.02em; }
.ml-brand-form-input {
  padding: 10px 12px; border: 1px solid var(--border, #2e3139); border-radius: 8px;
  background: var(--bg-secondary, #1e242b); color: var(--text-primary); font-size: 13px; font-family: inherit;
}
.ml-brand-form-input:focus { outline: none; border-color: var(--accent, #818cf8); }

.ml-brand-color-input { display: flex; align-items: center; gap: 8px; }
.ml-brand-color-input .ml-brand-form-input { flex: 1; }
.ml-brand-color-swatch {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border, #2e3139); flex-shrink: 0;
}

.ml-brand-form-actions { display: flex; justify-content: flex-end; }
.ml-brand-save-btn {
  padding: 10px 24px; border: none; border-radius: 8px; background: var(--accent, #818cf8);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 200ms;
}
.ml-brand-save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(129,140,248,0.3); }

.ml-brand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

.ml-brand-card {
  background: var(--bg-tertiary, #1f2937); border: 1px solid var(--border, #2e3139);
  border-radius: 12px; overflow: hidden; transition: all 200ms;
}
.ml-brand-card:hover { border-color: var(--accent, #818cf8); transform: translateY(-2px); }

.ml-brand-card-header { display: flex; gap: 0; height: 8px; }
.ml-brand-card-color { flex: 1; }

.ml-brand-card-body { padding: 16px; }
.ml-brand-card-name { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
.ml-brand-card-slogan { font-size: 12px; color: var(--text-secondary); margin: 0 0 10px; font-style: italic; }
.ml-brand-card-meta { display: flex; align-items: center; justify-content: space-between; }
.ml-brand-card-font { font-size: 11px; color: var(--text-muted); background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; }
.ml-brand-card-del {
  padding: 4px 10px; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px;
  background: transparent; color: #ef4444; font-size: 11px; cursor: pointer; font-family: inherit; transition: all 150ms;
}
.ml-brand-card-del:hover { background: rgba(239,68,68,0.1); }

.ml-brand-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-top: 1px solid var(--border, #2e3139); font-size: 11px; color: var(--text-muted);
}
.ml-brand-card-badge {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 6px;
  background: rgba(129,140,248,0.12); color: var(--accent, #818cf8);
}

.ml-brand-empty {
  grid-column: 1 / -1; text-align: center; padding: 60px 20px;
}
.ml-brand-empty-icon { font-size: 48px; opacity: 0.4; margin-bottom: 12px; display: block; }
.ml-brand-empty h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; color: var(--text-primary); }
.ml-brand-empty p { font-size: 13px; color: var(--text-secondary); margin: 0; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 200ms ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* ============ 📦 素材资产（武器/道具/饰品/特效·技能） ============ */
.ml-assets-root { padding: 20px; }
.ml-assets-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.ml-asset-chip {
  padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border, #2a2f45);
  background: var(--surface-2, #161a2b); color: var(--text-secondary); font-size: 13px; cursor: pointer;
  transition: all 160ms ease;
}
.ml-asset-chip:hover { border-color: var(--accent, #8b5cf6); color: var(--text-primary); }
.ml-asset-chip--active { background: var(--accent, #8b5cf6); border-color: var(--accent, #8b5cf6); color: #fff; }

.ml-assets-empty { text-align: center; padding: 70px 20px; color: var(--text-secondary); }
.ml-assets-empty-icon { font-size: 52px; opacity: 0.4; display: block; margin-bottom: 14px; }
.ml-assets-empty h3 { font-size: 18px; font-weight: 600; margin: 0 0 10px; color: var(--text-primary); }
.ml-assets-empty p { font-size: 13px; max-width: 480px; margin: 0 auto; line-height: 1.7; }

.ml-assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
.ml-asset-card {
  background: var(--surface-2, #161a2b); border: 1px solid var(--border, #2a2f45); border-radius: 14px;
  overflow: hidden; display: flex; flex-direction: column; transition: transform 180ms ease, box-shadow 180ms ease;
}
.ml-asset-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
.ml-asset-thumb { position: relative; aspect-ratio: 1 / 1; background: #0e111c; }
.ml-asset-media { width: 100%; height: 100%; object-fit: cover; display: block; }
.ml-asset-media--mock { display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 14px; padding: 10px; text-align: center; }
.ml-asset-badge {
  position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: 999px;
  background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; backdrop-filter: blur(4px);
}
.ml-asset-meta { padding: 10px 12px; flex: 1; }
.ml-asset-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.ml-asset-desc { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ml-asset-del {
  margin: 0 12px 12px; padding: 6px 0; border: 1px solid var(--border, #2a2f45); border-radius: 8px;
  background: transparent; color: #f87171; font-size: 12px; cursor: pointer; transition: all 160ms ease;
}
.ml-asset-del:hover { background: rgba(248,113,113,0.12); }

.ml-asset-error { color: #f87171; font-size: 13px; margin: 6px 0 0; }
.ml-asset-step { color: var(--accent, #8b5cf6); font-size: 13px; margin: 6px 0 0; }
</style>
