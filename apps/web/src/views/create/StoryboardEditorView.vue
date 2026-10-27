<script setup lang="ts">
/**
 * StoryboardEditorView.vue — 动画编辑器（8 步可视化创作流程）
 *
 * 步骤：
 *   1. 项目设置  2. 上传小说  3. 角色设定  4. 场景设定
 *   5. 分镜编排  6. 配乐设定  7. 预览与微调  8. 导出配置
 */

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { generateText, generateImage, generateVideo, generateConsistentKeyframe, composeVideos, mergeVideoAudio, generateTTS, enhanceVideo, type ConsistencyModel } from '@/api/ai-router'
import { useAssetStore, ASSET_CATEGORY_LABELS, type AssetCategory } from '@/stores/assetStore'
import { getToken } from '@/utils/auth'
import { getApi } from '@/api-bridge'
import type { Shot, ShotMediaImage, CameraAction, ShotGeneration, GlobalDirective } from '@/types/studio'
import { SHOT_TYPE_LABELS, CAMERA_MOVE_LABELS, TRANSITION_LABELS, PACING_LABELS, ACTION_SPEED_LABELS } from '@/types/studio'
import StoryboardStep5Music from './StoryboardStep5Music.vue'
import draggable from 'vuedraggable'

// ENH-13: 移动端轻量模式 — 检测设备性能，自动降级动画
import { onMounted as onMounted_SB, onUnmounted as onUnmounted_SB } from 'vue'
const isLightweightMode = ref(false)
const prefersReducedMotion = ref(false)

function detectLightweightMode() {
  // Check prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia) {
    prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  // Check if mobile/low-memory device
  const mem = (navigator as any).deviceMemory
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isLowMemory = mem && mem <= 4
  isLightweightMode.value = prefersReducedMotion.value || isMobile || isLowMemory
}

// detectLightweightMode called in combined onMounted_SB below

const hasStarted = ref(true)

const route = useRoute()
const router = useRouter()

// ── 步骤定义 ──

interface StepDef {
  key: string
  label: string
  icon: string
  description: string
}

const STEPS: StepDef[] = [
  { key: 'setup',     label: '项目设置', icon: '📋', description: '设定集数、时长、画风、分辨率和画幅' },
  { key: 'upload',    label: '上传小说', icon: '📖', description: '上传小说文本或选择已有剧本' },
  { key: 'character', label: '角色设定', icon: '👤', description: 'AI 提取角色，设定主视觉和属性' },
  { key: 'scene',     label: '场景设定', icon: '🏞️', description: '设定场景风格、生成场景图、编辑描述' },
  { key: 'storyboard',label: '分镜编排', icon: '🎬', description: 'AI 拆分分镜，生成预览图，编辑提示词，确认构图' },
  { key: 'video',     label: '镜头视频', icon: '🎞️', description: '逐镜头生成视频，首尾帧链式衔接，不满意重新生成' },
  { key: 'compose',   label: '合成视频', icon: '🎬', description: '将所有确认的镜头视频按顺序拼接为整集视频' },
  { key: 'enhance',   label: '画质提升', icon: '✨', description: 'AI 超分辨率增强、锐化修复，提升至大片级画质' },
  { key: 'dubbing',   label: 'AI 配音',  icon: '🎙️', description: '分段 AI 配音，可重新配音或导入自定义音频' },
  { key: 'final',     label: '合成导出', icon: '📦', description: '合成视频+配音，预览确认后导出成品' },
]

// ── 当前步骤 ──
const currentStepIndex = ref(0)

// 从路由 query 初始化步骤
watch(
  () => route.query.step,
  (s) => {
    if (typeof s === 'string') {
      const idx = STEPS.findIndex(st => st.key === s)
      if (idx >= 0) currentStepIndex.value = idx
    }
  },
  { immediate: true },
)

const currentStep = computed(() => STEPS[currentStepIndex.value]!)

function goToStep(index: number) {
  if (index < 0 || index >= STEPS.length) return
  currentStepIndex.value = index
  // 同步到路由
  router.replace({
    path: '/create/animation',
    query: { step: STEPS[index]!.key },
  })
}

function goNext() { goToStep(currentStepIndex.value + 1) }
function goPrev() { goToStep(currentStepIndex.value - 1) }

// [a11y] 步骤导航键盘可达：左右方向键切换激活步骤
function onStepKey(idx: number, e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const target = e.key === 'ArrowRight'
      ? Math.min(idx + 1, STEPS.length - 1)
      : Math.max(idx - 1, 0)
    goToStep(target)
  }
}

const projectId = computed(() => (route.params.id as string) || '1')

// ── 素材归属项目选择器 ──
// 创作模块路由不带 :id，需用真实项目 id 才能把场景/角色落库到素材库。
// 提供下拉选择「当前用户的项目」，保存/引用均使用选中项目。
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
  } catch (e: any) {
    projectError.value = `项目加载失败：${e?.message || '未知错误'}`
  } finally {
    projectLoading.value = false
  }
}

/** 实际用于落库的项目 id（优先用下拉选中的，回退到路由 id；'1' 视为无效） */
function effectiveProjectId(): string {
  const pid = selectedProjectId.value || projectId.value
  return pid && pid !== '1' ? pid : ''
}

// 📦 素材资产引用（武器/道具/饰品/特效·技能）— 生成镜头视频时作为参考图
const assetStore = useAssetStore()
const assetRefPanelOpen = ref(false)
const assetRefAuto = ref(true)
const assetRefSelected = ref<Set<string>>(new Set())
const assetRefItems = computed(() => assetStore.assets.map(a => ({
  id: a.id,
  name: a.name,
  category: a.category,
  thumbnail: a.thumbnail_url || a.video_url || '',
})))
watch(assetRefItems, (list) => {
  if (assetRefAuto.value) assetRefSelected.value = new Set(list.map(i => i.id))
}, { immediate: true })
function setAssetRefAll(on: boolean) {
  assetRefAuto.value = on
  assetRefSelected.value = on ? new Set(assetRefItems.value.map(i => i.id)) : new Set()
}
function toggleAssetRef(id: string) {
  const s = new Set(assetRefSelected.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  assetRefSelected.value = s
}
function selectedAssetThumbs(): string[] {
  return assetRefItems.value.filter(i => assetRefSelected.value.has(i.id) && i.thumbnail).map(i => i.thumbnail)
}

function onProjectChange() {
  savedToLib.value = {}
  try { loadProjectScenes() } catch { /* 忽略 */ }
  try { assetStore.load(effectiveProjectId()) } catch { /* 忽略 */ }
}

// ── 步骤状态（已完成/进行中/未开始）──
const completedSteps = ref<Set<number>>(new Set())

function markCompleted(index: number) {
  completedSteps.value.add(index)
  // 触发响应式
  completedSteps.value = new Set(completedSteps.value)
}

function stepState(index: number): 'done' | 'active' | 'pending' {
  if (completedSteps.value.has(index)) return 'done'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

const completedStepsCount = computed(() => completedSteps.value.size)

// [功能体验 7.5] 各步骤进度数据（用于顶部进度总览）
const stepProgressData = computed(() => {
  const total = episodeShots.value.length || 0
  return {
    storyboard: total > 0 ? `${episodeShots.value.length} 个分镜` : undefined,
    video: total > 0 ? `${shotVideoDoneCount.value}/${total}` : undefined,
    compose: composedVideoUrl.value ? '已合成' : undefined,
    enhance: enhancedVideoUrl.value ? '已增强' : undefined,
    dubbing: dubSegments.value.length > 0 ? `${dubDoneCount.value}/${dubSegments.value.length}` : undefined,
    final: finalVideoUrl.value ? '已导出' : undefined,
  } as Record<string, string | undefined>
})

// ── 项目名（展示用）──
const projectName = ref('未命名项目')

// ── Step 1: 项目设置 ──
const episodeCount = ref(12)
const episodeDurationMin = ref(2)
const selectedAspect = ref('9:16')
const selectedResolution = ref('1080p')

const aspectOptions = [
  { value: '9:16', label: '9:16 竖屏', icon: '📱', desc: '短视频/手机竖屏' },
  { value: '16:9', label: '16:9 横屏', icon: '🖥️', desc: '横屏/B站/YouTube' },
  { value: '1:1',  label: '1:1 方形', icon: '⬜', desc: '社交媒体方形' },
]
const resolutionOptions = [
  { value: '720p',  label: '720p',  desc: '标清，快速生成' },
  { value: '1080p', label: '1080p', desc: '高清，推荐' },
  { value: '4K',    label: '4K',    desc: '超高清，耗时较长' },
]
const durationOptions = [1, 2, 3, 5]
const durationMode = ref<'preset' | 'custom' | 'actual'>('preset')
const customDurationMin = ref(3)

// ── 项目继承（从历史项目拉取角色/场景/世界观）──
interface ProjectOption { id: string; name: string; characterCount?: number; sceneCount?: number }
const availableProjects = ref<ProjectOption[]>([])
const inheritFromProjectId = ref<string>('')
const inheritingAssets = ref(false)
const inheritStatus = ref('')

/** 加载用户的历史项目列表 */
async function loadAvailableProjects() {
  try {
    const { getApi } = await import('@/api-bridge')
    const api = getApi()
    const resp = await api.http.get<any>('/projects', { limit: 50 }, { timeoutMs: 3000 } as any)
    const list = Array.isArray(resp) ? resp : (resp?.items ?? resp?.list ?? resp?.data ?? [])
    // 排除当前项目
    availableProjects.value = (Array.isArray(list) ? list : [])
      .filter((p: any) => String(p.id) !== String(projectId.value))
      .map((p: any) => ({ id: String(p.id), name: p.title || p.name || `项目${p.id}` }))
  } catch (err: any) {
    console.warn('[项目继承] 加载项目列表失败:', err?.message)
    availableProjects.value = []
  }
}

/** 从选定项目继承资产（角色+场景+世界观） */
async function inheritFromProject() {
  const sourceId = inheritFromProjectId.value
  if (!sourceId) return

  inheritingAssets.value = true
  inheritStatus.value = '正在拉取资产...'

  try {
    const { getApi } = await import('@/api-bridge')
    const api = getApi()

    // 拉取源项目角色
    let charCount = 0
    try {
      const charResp = await api.http.get<any>(
        `/projects/${encodeURIComponent(sourceId)}/characters`,
        undefined,
        { timeoutMs: 5000 } as any,
      )
      const charList = Array.isArray(charResp) ? charResp : (charResp?.items ?? charResp?.data ?? [])
      if (Array.isArray(charList) && charList.length > 0 && characterAppearances.value.length === 0) {
        const AVATARS = ['🧑', '👩', '👴', '🧙', '🧒', '👨', '👧', '🧓']
        characterAppearances.value = charList.map((c: any, i: number) => {
          const role = (c.archetype || '').toLowerCase()
          const name = (c.name || '')
          const isFemale = /女|母|姐|妹|娘|妃|后|婆|嫂|仙姑|夫人|公主|女主|校花|美女/.test(role + name)
          const defaultVoice = isFemale
            ? VOICE_PRESETS.find(v => v.gender === 'female')!
            : VOICE_PRESETS.find(v => v.gender === 'male')!
          return migrateCharacter({
            id: i + 1,
            name: c.name,
            role: c.archetype || '未知',
            avatar: AVATARS[i % AVATARS.length]!,
            tags: c.tags || [],
            newTag: '',
            showDetail: false,
            views: createEmptyViews(),
            description: c.description || '',
            outfits: [],
            activeOutfitId: null,
            voiceId: defaultVoice?.id,
            voiceName: defaultVoice?.name,
          })
        })
        charCount = charList.length
      }
    } catch (e) { console.warn('[继承] 角色拉取失败', e) }

    // 拉取源项目场景
    let sceneCount = 0
    try {
      const sceneResp = await api.http.get<any>(
        `/projects/${encodeURIComponent(sourceId)}/scenes`,
        undefined,
        { timeoutMs: 5000 } as any,
      )
      const sceneList = Array.isArray(sceneResp) ? sceneResp : (sceneResp?.items ?? sceneResp?.data ?? [])
      if (Array.isArray(sceneList) && sceneList.length > 0 && extractedScenes.value.length === 0) {
        const ICONS = ['🏔️', '🏛️', '🌊', '🌲', '🏙️', '🏯', '🌋', '🏜️']
        extractedScenes.value = sceneList.map((s: any, i: number) => ({
          id: i + 1,
          name: s.name,
          icon: ICONS[i % ICONS.length]!,
          mood: s.tags?.[0] || '',
          environmentDesc: s.description || '',
          timeOfDay: '',
          sceneType: s.scene_type || '',
          colorTone: s.light_color_temp || '',
          imageGenerating: false,
          views: [],
          currentAngle: 'wide',
        }))
        sceneCount = sceneList.length
      }
    } catch (e) { console.warn('[继承] 场景拉取失败', e) }

    const parts: string[] = []
    if (charCount > 0) parts.push(`${charCount} 个角色`)
    if (sceneCount > 0) parts.push(`${sceneCount} 个场景`)
    inheritStatus.value = parts.length > 0
      ? `✅ 已继承 ${parts.join('、')}（来源：项目 #${sourceId}）`
      : '⚠️ 源项目没有可继承的资产'

    // 保存到当前项目
    if (charCount > 0) saveCharactersToProject()
    if (sceneCount > 0) saveScenesToProject()

  } catch (err: any) {
    inheritStatus.value = `❌ 继承失败：${err?.message || '未知错误'}`
  } finally {
    inheritingAssets.value = false
  }
}

const estimatedShotCount = computed(() => {
  if (durationMode.value === 'actual' && shots.value.length > 0) {
    // 以实际分镜总时长反算
    const totalSec = shots.value.reduce((acc, s) => acc + (s.duration || 4), 0)
    const perEp = Math.ceil(totalSec / episodeCount.value / 60)
    return shots.value.length
  }
  const mins = durationMode.value === 'custom' ? customDurationMin.value : episodeDurationMin.value
  const avgSecPerShot = 4
  return episodeCount.value * Math.ceil((mins * 60) / avgSecPerShot)
})

/** 实际总时长（分钟），基于分镜数据 */
const actualDurationMin = computed(() => {
  if (shots.value.length === 0) return 0
  const totalSec = shots.value.reduce((acc, s) => acc + (s.duration || 4), 0)
  return Math.round(totalSec / 60 * 10) / 10
})

/** 当前生效的每集时长（分钟） */
const effectiveDurationMin = computed(() => {
  if (durationMode.value === 'actual') return actualDurationMin.value > 0 ? actualDurationMin.value / episodeCount.value : episodeDurationMin.value
  if (durationMode.value === 'custom') return customDurationMin.value
  return episodeDurationMin.value
})

// ── 步骤 1-4,6-7 的简单模拟操作 ──

// Step 1: 上传小说 — 持久化到 sessionStorage，刷新不丢数据
const uploadedText = ref(localStorage.getItem('mhw:storyboard:novel-text') ?? '')
// Item 16: 防抖 500ms，避免每次击键都写 sessionStorage
let _uploadedTextDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(uploadedText, (val) => {
  if (_uploadedTextDebounceTimer) clearTimeout(_uploadedTextDebounceTimer)
  _uploadedTextDebounceTimer = setTimeout(() => {
    if (val.trim()) {
      localStorage.setItem('mhw:storyboard:novel-text', val)
    } else {
      localStorage.removeItem('mhw:storyboard:novel-text')
    }
    _uploadedTextDebounceTimer = null
  }, 500)
})
const hasUploadedNovel = computed(() => uploadedText.value.trim().length > 10)
const fileInput = ref<HTMLInputElement | null>(null)

import { useFileDrop } from '../../composables/useFileDrop'

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  handleNovelFile(file)
  input.value = '' // 允许重复选择同一文件
}

function handleNovelFile(file: File) {
  if (file.name.toLowerCase().endsWith('.txt')) {
    const reader = new FileReader()
    reader.onload = () => { uploadedText.value = reader.result as string }
    reader.onerror = () => {
      console.error('[上传] 文件读取失败:', reader.error)
      alert('文件读取失败，请检查文件是否损坏或尝试用记事本打开后复制粘贴')
    }
    reader.readAsText(file, 'utf-8')
  } else {
    uploadedText.value = `[暂不支持 ${file.name.split('.').pop()} 格式]\n请手动打开文件，复制内容后粘贴到下方文本框。\n目前仅支持 .txt 纯文本文件。`
  }
}

const { isDragging: isDraggingFile, openPicker, onDragEnter: onFileDragEnter, onDragLeave: onFileDragLeave, onDrop: onFileDrop } =
  useFileDrop((files) => { const f = files[0]; if (f) handleNovelFile(f) })

function openFilePicker() { openPicker(fileInput.value) }

// Step 4: 风格选择
const selectedStyle = ref('')
const styleOptions = [
  // ── 动画/绘画类 ──
  { id: 'watercolor',  label: '水彩国风',   icon: '🖌️', desc: '水墨晕染，古典意境',     img: '/styles/watercolor.png',  group: 'animation' },
  { id: 'anime',       label: '日漫赛璐璐', icon: '✨', desc: '清晰线条，鲜明色彩',     img: '/styles/anime.png',       group: 'animation' },
  { id: 'comic',       label: '美漫写实',   icon: '🦸', desc: '立体光影，写实质感',     img: '/styles/comic.png',       group: 'animation' },
  { id: '3d-pixar',    label: '3D 皮克斯',  icon: '🎬', desc: '圆润可爱，3D 渲染',      img: '/styles/3d-pixar.png',    group: 'animation' },
  { id: 'claymation',  label: '黏土定格',   icon: '🏺', desc: '手工黏土，定格动画',     img: '/styles/claymation.png',  group: 'animation' },
  { id: 'paper-cut',   label: '纸雕剪影',   icon: '✂️', desc: '层叠纸艺，剪影风格',     img: '/styles/paper-cut.png',   group: 'animation' },
  { id: 'flat-design', label: '扁平插画',   icon: '🎨', desc: '极简几何，现代设计',     img: '/styles/flat-design.png', group: 'animation' },
  // ── 真人/写实类 ──
  { id: 'live-action',     label: '真人电影',   icon: '🎥', desc: '电影级真人画面',       img: '/styles/live-action.png',     group: 'realistic' },
  { id: 'documentary',     label: '真人纪录片', icon: '📹', desc: '纪实风格，自然真实',   img: '/styles/documentary.png',     group: 'realistic' },
  { id: 'photorealistic',  label: '超写实摄影', icon: '📷', desc: '8K 级照片真实感',      img: '/styles/photorealistic.png',  group: 'realistic' },
  // ── 艺术/风格类 ──
  { id: 'ukiyoe',      label: '浮世绘',     icon: '🗾', desc: '日本木版画，平面色块',   img: '/styles/ukiyoe.png',      group: 'artistic' },
  { id: 'ink-wash',    label: '水墨写意',   icon: '🖤', desc: '大写意泼墨，气势磅礴',   img: '/styles/ink-wash.png',    group: 'artistic' },
  { id: 'impasto',     label: '厚涂油画',   icon: '🎭', desc: '厚重笔触，油彩肌理',     img: '/styles/impasto.png',     group: 'artistic' },
  { id: 'rococo',      label: '洛可可',     icon: '👑', desc: '华丽宫廷，粉彩柔光',     img: '/styles/rococo.png',      group: 'artistic' },
  { id: 'gothic',      label: '暗黑哥特',   icon: '🦇', desc: '黑暗奇幻，神秘诡异',     img: '/styles/gothic.png',      group: 'artistic' },
  { id: 'vaporwave',   label: '蒸汽波',     icon: '🌴', desc: '复古霓虹，80s 美学',     img: '/styles/vaporwave.png',   group: 'artistic' },
  { id: 'pixel',       label: '像素复古',   icon: '👾', desc: '8-bit 像素，怀旧风格',   img: '/styles/pixel.png',       group: 'artistic' },
  { id: 'lowpoly',     label: '低多边形',   icon: '💎', desc: '几何切面，极简3D',       img: '/styles/lowpoly.png',     group: 'artistic' },
  { id: 'ink',         label: '黑白线稿',   icon: '✒️', desc: '纯线条，极简风格',       img: '/styles/ink.png',         group: 'artistic' },
  { id: 'cyberpunk',   label: '赛博霓虹',   icon: '🌃', desc: '高饱和，霓虹光效',       img: '/styles/cyberpunk.png',   group: 'artistic' },
]
const styleGroupLabels: Record<string, string> = {
  animation: '动画 / 绘画',
  realistic: '真人 / 写实',
  artistic: '艺术 / 风格',
}

// ── 世界观预设 ──
interface WorldviewPreset {
  id: string
  label: string
  icon: string
  description: string
  contextHint: string
  recommendedStyles: string[]
  isTag?: boolean       // 副标签（可多选，表达混合世界观元素）
  tagGroup?: string      // 副标签分组
}

const worldviewPresets: WorldviewPreset[] = [
  {
    id: 'xianxia',
    label: '仙侠玄幻',
    icon: '⚔️',
    description: '修仙世界、灵气、法宝、宗门、仙山',
    contextHint: 'Chinese Xianxia/Xuanhuan fantasy world, cultivation realms, spiritual energy, sects, celestial palaces, ancient Chinese architecture, flowing robes, jade artifacts, mystical fog',
    recommendedStyles: ['ink-wash', 'watercolor', 'anime'],
  },
  {
    id: 'wuxia',
    label: '武侠江湖',
    icon: '🗡️',
    description: '江湖武林、门派、轻功、侠客',
    contextHint: 'Chinese Wuxia martial arts world, jianghu, ancient Chinese towns, bamboo forests, sword fighters, traditional martial arts clothing, heroic atmosphere',
    recommendedStyles: ['watercolor', 'ink', 'anime'],
  },
  {
    id: 'cyberpunk',
    label: '赛博朋克',
    icon: '🌃',
    description: '高科技低生活、霓虹城市、义体改造',
    contextHint: 'cyberpunk future city, neon lights, holographic displays, augmented humans, cybernetic implants, dark rainy streets, high-tech low-life aesthetic',
    recommendedStyles: ['cyberpunk', 'anime', 'comic'],
  },
  {
    id: 'scifi',
    label: '未来科技',
    icon: '🚀',
    description: '星际旅行、AI、太空站、未来文明',
    contextHint: 'futuristic sci-fi world, space travel, advanced technology, sleek spacecraft, space stations, clean futuristic architecture, advanced AI, energy shields',
    recommendedStyles: ['comic', '3d-pixar', 'photorealistic'],
  },
  {
    id: 'postapoc',
    label: '末世废土',
    icon: '☢️',
    description: '文明崩塌、废墟、变异、求生',
    contextHint: 'post-apocalyptic wasteland, ruined civilization, overgrown ruins, mutated creatures, survival gear, scavenged technology, desolate landscapes, dust storms',
    recommendedStyles: ['comic', 'live-action', 'lowpoly'],
  },
  {
    id: 'modern',
    label: '现代都市',
    icon: '🏙️',
    description: '当代城市生活、职场、校园、日常',
    contextHint: 'modern contemporary urban setting, realistic city life, modern clothing and architecture, everyday environments, natural lighting',
    recommendedStyles: ['anime', 'live-action', 'flat-design'],
  },
  {
    id: 'fantasy-west',
    label: '西幻魔法',
    icon: '🧙',
    description: '中世纪、魔法、精灵、龙、骑士',
    contextHint: 'Western fantasy medieval world, magic system, castles, dragons, elves, knights, enchanted forests, ancient runes, medieval European architecture',
    recommendedStyles: ['comic', '3d-pixar', 'impasto'],
  },
  {
    id: 'horror',
    label: '恐怖悬疑',
    icon: '👻',
    description: '灵异、克苏鲁、暗黑、惊悚',
    contextHint: 'horror and suspense atmosphere, dark shadows, eerie environments, unsettling architecture, fog, dim lighting, psychological tension, ominous presence',
    recommendedStyles: ['gothic', 'ink', 'live-action'],
  },
  {
    id: 'ancient',
    label: '古代历史',
    icon: '🏯',
    description: '中国古代、宫廷、战争、历史',
    contextHint: 'ancient Chinese historical setting, imperial palace, traditional Han dynasty or Tang dynasty architecture, silk robes, court politics, historical accuracy',
    recommendedStyles: ['watercolor', 'ink-wash', 'ukiyoe'],
  },
  {
    id: 'steampunk',
    label: '蒸汽朋克',
    icon: '⚙️',
    description: '维多利亚时代、齿轮机械、蒸汽动力',
    contextHint: 'steampunk Victorian era, clockwork machinery, steam-powered technology, brass and copper aesthetics, airships, goggles, gaslight, industrial revolution fantasy',
    recommendedStyles: ['impasto', 'comic', 'vaporwave'],
  },
  {
    id: 'custom',
    label: '自定义世界观',
    icon: '✨',
    description: '手动输入世界观描述',
    contextHint: '',
    recommendedStyles: [],
  },
  // ── 副元素标签（可多选，表达混合世界观）──
  {
    id: 'tag-magic', label: '魔法', icon: '🔮', description: '魔法体系、咒术、魔导器', isTag: true, tagGroup: '元素',
    contextHint: 'magic system, spellcasting, arcane artifacts, glowing runes, mystical energy, enchanted circles',
    recommendedStyles: ['comic', '3d-pixar', 'impasto'],
  },
  {
    id: 'tag-mecha', label: '机甲', icon: '🤖', description: '巨型机器人、装甲、驾驶舱', isTag: true, tagGroup: '元素',
    contextHint: 'mecha giant robots, armored suits, cockpits, mechanical limbs, sci-fi military tech',
    recommendedStyles: ['comic', 'cyberpunk', 'photorealistic'],
  },
  {
    id: 'tag-court', label: '宫廷', icon: '🏛️', description: '宫廷权谋、华服、礼制', isTag: true, tagGroup: '元素',
    contextHint: 'imperial court intrigue, elaborate traditional robes, palace architecture, royal ceremonies',
    recommendedStyles: ['watercolor', 'ink-wash', 'ukiyoe'],
  },
  {
    id: 'tag-zombie', label: '丧尸', icon: '🧟', description: '丧尸、病毒、感染', isTag: true, tagGroup: '元素',
    contextHint: 'zombie outbreak, viral infection, undead horde, abandoned cities, survival horror',
    recommendedStyles: ['gothic', 'live-action', 'comic'],
  },
  {
    id: 'tag-campus', label: '校园', icon: '🎒', description: '校园、青春、日常', isTag: true, tagGroup: '场景',
    contextHint: 'school campus, youth anime setting, classrooms, casual clothing, slice-of-life',
    recommendedStyles: ['anime', 'flat-design', 'watercolor'],
  },
  {
    id: 'tag-military', label: '军事', icon: '🪖', description: '军队、战争、战术', isTag: true, tagGroup: '场景',
    contextHint: 'military warfare, soldiers, tactical gear, battlefield, army uniforms, weapons',
    recommendedStyles: ['comic', 'live-action', 'photorealistic'],
  },
  {
    id: 'tag-food', label: '美食', icon: '🍜', description: '美食、料理、市井', isTag: true, tagGroup: '场景',
    contextHint: 'food cuisine, cooking, bustling market, delicious dishes, warm kitchen',
    recommendedStyles: ['anime', 'watercolor', 'flat-design'],
  },
  {
    id: 'tag-detective', label: '悬疑推理', icon: '🕵️', description: '推理、案件、谜题', isTag: true, tagGroup: '氛围',
    contextHint: 'detective mystery, crime investigation, clues, noir atmosphere, puzzles',
    recommendedStyles: ['gothic', 'ink', 'live-action'],
  },
  {
    id: 'tag-myth', label: '神话', icon: '🐉', description: '神话、图腾、神祇', isTag: true, tagGroup: '元素',
    contextHint: 'mythology, gods and deities, totems, legends, divine realms, mythical creatures',
    recommendedStyles: ['ink-wash', 'impasto', 'watercolor'],
  },
  {
    id: 'tag-steam', label: '蒸汽机械', icon: '⚙️', description: '齿轮、机械、工坊', isTag: true, tagGroup: '元素',
    contextHint: 'clockwork machinery, brass gears, steam-powered devices, workshops, industrial',
    recommendedStyles: ['impasto', 'comic', 'vaporwave'],
  },
]

/** 世界观选择：主基调（单选）+ 副标签（多选） */
interface WorldviewSelection {
  primary: string      // 主基调 preset id（决定画风推荐主方向）
  tags: string[]      // 副标签 preset id 列表（多选，表达混合元素）
}
const selectedWorldview = ref<WorldviewSelection>({ primary: '', tags: [] })
const customWorldviewText = ref('')
/** 切换副标签（多选 toggle） */
function toggleWorldviewTag(id: string) {
  const tags = selectedWorldview.value.tags
  const i = tags.indexOf(id)
  if (i >= 0) tags.splice(i, 1)
  else tags.push(id)
}

/** 当前世界观的完整上下文提示词（注入到所有 AI prompt） */
/** 当前世界观的完整上下文提示词（注入到所有 AI prompt），带主从权重标记 */
const worldviewContext = computed(() => {
  const parts: string[] = []
  const primary = worldviewPresets.find(w => w.id === selectedWorldview.value.primary)
  if (primary?.contextHint) parts.push(`【主基调】${primary.contextHint}`)
  for (const tid of selectedWorldview.value.tags) {
    const t = worldviewPresets.find(w => w.id === tid)
    if (t?.contextHint) parts.push(`【元素】${t.contextHint}`)
  }
  if (customWorldviewText.value.trim()) parts.push(customWorldviewText.value.trim())
  return parts.join('。')
})

/** 当前世界观推荐的画风 ID 列表 */
/** 画风推荐：主基调 + 副标签画风取并集去重 */
const recommendedStyleIds = computed(() => {
  const primary = worldviewPresets.find(w => w.id === selectedWorldview.value.primary)
  const tagStyles = selectedWorldview.value.tags.flatMap(tid =>
    worldviewPresets.find(w => w.id === tid)?.recommendedStyles ?? [])
  return Array.from(new Set([...(primary?.recommendedStyles ?? []), ...tagStyles]))
})

// ── 分镜编排级世界观（覆盖全局世界观，用于预览图生成） ──
type SbWorldviewMode = 'global' | 'none' | 'custom'
const sbWorldviewMode = ref<SbWorldviewMode>('global')
const sbCustomWorldview = ref('')

/** 分镜编排实际使用的世界观上下文（预览图 / 视频生成） */
const sbWorldviewContext = computed(() => {
  switch (sbWorldviewMode.value) {
    case 'global': return worldviewContext.value
    case 'custom': return sbCustomWorldview.value.trim()
    case 'none':   return ''
  }
})

/** 分镜世界观下拉选项 */
const sbWorldviewOptions = [
  { value: 'global' as const, label: '引用全局世界观', desc: '使用第一步设置的世界观' },
  { value: 'none'   as const, label: '无世界观',       desc: '纯靠镜头描述生成，不受世界观影响' },
  { value: 'custom' as const, label: '自定义世界观',   desc: '为本分镜指定独立的世界观' },
]

// ── 自定义画风（用户上传参考图） ──
interface CustomStyle {
  id: string
  label: string
  desc: string
  imageUrl: string
  createdAt: number
}
const customStyles = ref<CustomStyle[]>([])
const showCustomUpload = ref(false)
const customStyleName = ref('')
const customStyleDesc = ref('')
const customStyleInput = ref<HTMLInputElement | null>(null)

// 从 localStorage 恢复自定义画风
onMounted_SB(() => {
  try {
    const raw = localStorage.getItem('mhw:custom-styles')
    if (raw) customStyles.value = JSON.parse(raw)
  } catch { /* ignore */ }
})

function saveCustomStyles() {
  try {
    localStorage.setItem('mhw:custom-styles', JSON.stringify(customStyles.value))
  } catch { /* ignore */ }
}

function onCustomStyleFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return

  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    const newStyle: CustomStyle = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: customStyleName.value.trim() || file.name.replace(/\.\w+$/, ''),
      desc: customStyleDesc.value.trim() || '自定义画风',
      imageUrl: dataUrl,
      createdAt: Date.now(),
    }
    customStyles.value.push(newStyle)
    saveCustomStyles()
    // 自动选中新画风
    selectedStyle.value = newStyle.id
    // 关闭上传面板
    showCustomUpload.value = false
    customStyleName.value = ''
    customStyleDesc.value = ''
  }
  reader.readAsDataURL(file)
}

function deleteCustomStyle(id: string) {
  customStyles.value = customStyles.value.filter(s => s.id !== id)
  saveCustomStyles()
  if (selectedStyle.value === id) selectedStyle.value = ''
}

// ── 画风提示词引擎：统一所有图片生成的风格描述 ──
const stylePromptMap: Record<string, { prefix: string; suffix: string; negative: string }> = {
  // 动画/绘画类
  'watercolor': {
    prefix: 'traditional Chinese watercolor ink wash painting style, soft wet brush strokes, rice paper texture, flowing color bleeds',
    suffix: 'classical Chinese aesthetic, misty atmosphere, elegant brushwork',
    negative: '3d render, photorealistic, digital art',
  },
  'anime': {
    prefix: 'Japanese anime cel-shading style, clean bold linework, flat vibrant colors, cel animation aesthetic',
    suffix: 'sharp outlines, high contrast shading, studio ghibli or shonen jump quality',
    negative: 'watercolor, oil painting, photorealistic',
  },
  'comic': {
    prefix: 'American comic book realism style, dynamic shading, bold ink outlines, muscular proportions',
    suffix: 'dramatic lighting, detailed crosshatching, marvel or DC comic quality',
    negative: 'watercolor, anime, cartoon',
  },
  '3d-pixar': {
    prefix: '3D Pixar Disney animation style, smooth rounded features, subsurface scattering, volumetric lighting',
    suffix: 'cute expressive eyes, vibrant saturated colors, soft shadows, dreamworks quality 3d render',
    negative: '2d, flat, sketch, watercolor',
  },
  'claymation': {
    prefix: 'claymation stop-motion style, plasticine clay texture, visible fingerprints, miniature handcrafted sets',
    suffix: 'tactile surfaces, warm studio lighting, charming handmade quality like Wallace and Gromit',
    negative: 'digital art, smooth render, photorealistic',
  },
  'paper-cut': {
    prefix: 'layered paper cut-out animation style, visible paper edges, shadow depth between layers, paper puppet characters',
    suffix: 'diorama-like depth, colorful paper craft, silhouette art',
    negative: '3d render, oil painting, photorealistic',
  },
  'flat-design': {
    prefix: 'modern flat design illustration, geometric shapes, minimal color palette, vector art style',
    suffix: 'clean lines, bold colors, no gradients or shadows, contemporary corporate illustration',
    negative: 'realistic, textured, painterly, 3d',
  },
  // 真人/写实类
  'live-action': {
    prefix: 'cinematic live-action film still, photorealistic human, dramatic cinematic lighting, shallow depth of field, anamorphic lens',
    suffix: 'film grain, professional color grading, 35mm film quality, golden hour or moody lighting',
    negative: 'cartoon, anime, illustration, painting, drawing',
  },
  'documentary': {
    prefix: 'documentary photography style, natural lighting, candid unposed, photojournalism aesthetic',
    suffix: 'authentic colors, handheld camera feel, 35mm film grain, natural tones',
    negative: 'cartoon, anime, illustration, studio lighting, posed',
  },
  'photorealistic': {
    prefix: 'ultra photorealistic portrait, studio photography, natural skin texture with visible pores, shot on 85mm f/1.4 lens',
    suffix: 'catchlights in eyes, perfect detail, professional fashion photography, 8K resolution',
    negative: 'cartoon, anime, illustration, painting, drawing, CGI',
  },
  // 艺术/风格类
  'ukiyoe': {
    prefix: 'traditional Japanese ukiyo-e woodblock print, flat color blocks, bold black outlines, Hokusai Hiroshige style',
    suffix: 'limited earth-tone palette with indigo and vermillion, traditional Japanese composition',
    negative: '3d, photorealistic, modern digital',
  },
  'ink-wash': {
    prefix: 'bold Chinese ink wash painting, dramatic black ink strokes on rice paper, splashed ink technique, expressive calligraphic brushwork',
    suffix: 'high contrast black and white, traditional shuimo style, powerful and dynamic strokes',
    negative: 'colorful, digital, 3d render, photorealistic',
  },
  'impasto': {
    prefix: 'thick impasto oil painting, visible palette knife texture, rich saturated colors, heavy paint buildup',
    suffix: 'canvas texture, dramatic chiaroscuro lighting, Van Gogh or Rembrandt technique',
    negative: 'digital art, flat, anime, watercolor',
  },
  'rococo': {
    prefix: 'Rococo painting style, ornate aristocratic scene, pastel colors, gilded decorations, flowing silk fabrics',
    suffix: 'cherubs, floral motifs, soft diffused lighting, Fragonard or Boucher aesthetic',
    negative: 'modern, minimal, dark, photorealistic',
  },
  'gothic': {
    prefix: 'dark gothic fantasy illustration, dramatic moonlight, deep shadows, crimson and purple accents',
    suffix: 'ruined cathedral, gargoyles, thorny vines, dark romantic atmosphere, Dark Souls art direction',
    negative: 'bright, cheerful, cartoon, anime, flat',
  },
  'vaporwave': {
    prefix: 'vaporwave aesthetic, neon pink and purple gradients, retro 80s/90s computer graphics, chrome grid, glitch effects',
    suffix: 'Japanese text overlays, VHS distortion, chromatic aberration, dreamy synthwave atmosphere',
    negative: 'realistic, natural, traditional',
  },
  'pixel': {
    prefix: '8-bit pixel art style, limited color palette, crisp pixel edges, retro game aesthetic',
    suffix: 'chiptune era inspired, NES or SNES quality, clean pixel grid',
    negative: 'high resolution, smooth, photorealistic, watercolor',
  },
  'lowpoly': {
    prefix: 'low poly 3D render, geometric faceted surfaces, triangular polygons, pastel gradient colors',
    suffix: 'smooth ambient occlusion, modern minimalist 3D art, Monument Valley aesthetic',
    negative: 'high poly, realistic, detailed texture, photorealistic',
  },
  'ink': {
    prefix: 'black and white line art, pure ink on paper, clean precise lines, minimalist pen drawing',
    suffix: 'no color, high contrast, fine linework, manga or editorial illustration quality',
    negative: 'colorful, painted, textured, 3d',
  },
  'cyberpunk': {
    prefix: 'cyberpunk neon style, high saturation, neon glow effects, futuristic cityscape, rain-slicked surfaces',
    suffix: 'holographic UI, LED signs, dark atmosphere with vibrant neon accents, Blade Runner aesthetic',
    negative: 'natural, traditional, watercolor, flat',
  },
}

/**
 * 获取当前画风的统一提示词片段
 * @param context 'character' | 'scene' | 'storyboard' — 不同场景有不同的默认 fallback
 */
function getStylePrompt(context: 'character' | 'scene' | 'storyboard' = 'storyboard') {
  const sid = selectedStyle.value
  if (!sid) {
    // 无画风选择时的合理默认
    const defaults = {
      character: { prefix: 'high quality illustration', suffix: 'clean character concept art', negative: '' },
      scene:     { prefix: 'detailed environment illustration', suffix: 'cinematic lighting', negative: '' },
      storyboard:{ prefix: 'storyboard frame', suffix: 'cinematic composition', negative: '' },
    }
    return defaults[context]
  }

  // 内置画风
  if (stylePromptMap[sid]) return stylePromptMap[sid]

  // 自定义画风 — 用画风名称作描述
  const cs = customStyles.value.find(c => c.id === sid)
  if (cs) {
    return {
      prefix: `in the style of reference image, ${cs.label}`,
      suffix: cs.desc || 'custom art style',
      negative: '',
    }
  }

  // 兜底
  const sOpt = styleOptions.find(s => s.id === sid)
  return {
    prefix: sOpt ? `${sOpt.label} style` : 'illustration',
    suffix: '',
    negative: '',
  }
}

/**
 * 构建完整的图片生成 prompt
 * @param baseContent 核心内容描述
 * @param context 场景类型
 * @param extra 额外补充描述
 */
function buildPrompt(baseContent: string, context: 'character' | 'scene' | 'storyboard' = 'storyboard', extra?: string) {
  const sp = getStylePrompt(context)
  const parts = [sp.prefix, baseContent]
  if (extra) parts.push(extra)
  if (sp.suffix) parts.push(sp.suffix)
  return parts.join(', ')
}

// ── 五要素结构化 Prompt 引擎 ──
// 基于火山引擎 Seedream/Seedance 官方提示词最佳实践
// 公式: [风格锚点] + [主体描述] + [动作/姿态] + [环境+光照] + [镜头+构图] + [质量标记]

interface PromptContext {
  subject: string
  action?: string
  environment?: string
  lighting?: string
  camera?: {
    shotType?: string
    angle?: string
    movement?: string
    lens?: string
  }
  quality?: string[]
  negative?: string[]
  context?: 'character' | 'scene' | 'storyboard'
}

const UNIVERSAL_NEGATIVE = 'low quality, blurry, deformed, mutated hands, extra limbs, bad anatomy, watermark, text, logo, ugly, duplicate, disfigured, extra fingers, poorly drawn face'

/** 视频专用 negative prompt — 禁止慢动作、漂浮、帧闪烁等视频伪影 */
const VIDEO_NEGATIVE = 'slow motion, slow-mo, floating, drifting, dreamlike, morphing, frame flicker, jitter, warping, melting face, temporal inconsistency, frozen frame, slideshow, zero movement, text, subtitles, chinese characters, written text overlay'

/** 图片专用 negative prompt — 禁止性别/身份漂移（参考图是男性却生成女性等问题） */
const IMAGE_NEGATIVE = 'different person, gender swap, female when should be male, male when should be female, wrong face, changed identity, face does not match reference, different hairstyle, different hair color, age change, body type change, facial features changed, new face, face morphing, identity drift, lookalike but not same person, similar but different face, face replacement, altered appearance'

/** mood → 光照映射表（根据场景氛围自动推断光照描述） */
const moodLightingMap: Record<string, string> = {
  '紧张': 'harsh shadows, low-key lighting, cold blue tone',
  '温馨': 'warm golden light, soft diffused glow, sunset colors',
  '恐怖': 'dim flickering light, deep shadows, green tint, chiaroscuro',
  '悲伤': 'overcast grey sky, muted desaturated tones, rain streaks',
  '欢快': 'bright natural sunlight, vivid colors, clear blue sky',
  '神秘': 'moonlight, fog, cool blue-purple tones, rim lighting',
  '战斗': 'dramatic side lighting, sparks, dust particles, high contrast',
  '浪漫': 'soft pink-golden hour light, lens flare, bokeh background',
  '压抑': 'dark overcast, muted colors, heavy shadows, oppressive atmosphere',
  '壮观': 'epic golden light, god rays through clouds, dramatic wide lighting',
  '宁静': 'soft morning light, gentle mist, warm pastel tones',
  '激烈': 'harsh directional light, flying debris, high contrast red-orange tones',
}

function inferLightingFromMood(mood?: string): string {
  if (!mood) return 'natural ambient lighting'
  for (const [key, val] of Object.entries(moodLightingMap)) {
    if (mood.includes(key)) return val
  }
  return 'natural ambient lighting'
}

// ── 中文 → 英文翻译工具（Seedream 拒绝任何中文 prompt，统一在此集中管理）──────

/** 角色职业/身份精确翻译表 */
const CHAR_ROLE_MAP: Record<string, string> = {
  '考古学家': 'archaeologist', '考古': 'archaeologist',
  '战士': 'warrior', '法师': 'mage', '巫师': 'wizard', '魔导师': 'archmage',
  '医生': 'doctor', '学生': 'student', '教授': 'professor', '老师': 'teacher',
  '学者': 'scholar', '商人': 'merchant', '侦探': 'detective', '刺客': 'assassin',
  '骑士': 'knight', '圣骑士': 'paladin', '弓箭手': 'archer', '弓手': 'archer',
  '盗贼': 'thief', '牧师': 'cleric', '忍者': 'ninja', '武士': 'samurai',
  '猎人': 'hunter', '工程师': 'engineer', '科学家': 'scientist',
  '将军': 'general', '士兵': 'soldier', '守卫': 'guard', '队长': 'captain',
  '主角': 'protagonist', '男主角': 'protagonist', '女主角': 'heroine',
  '反派': 'antagonist', '向导': 'guide', '使者': 'envoy',
  '冒险者': 'adventurer', '勇者': 'hero',
  '精灵': 'elf', '幽灵': 'ghost', '幻象': 'phantom entity',
  '机器人': 'robot', '光球': 'light orb entity', '神明': 'deity',
}

/** 场景氛围文字翻译（用于 envParts；灯光用 moodLightingMap） */
const MOOD_TEXT_MAP: Record<string, string> = {
  '紧张': 'tense', '温馨': 'warm and cozy', '恐怖': 'horrific',
  '悲伤': 'sorrowful', '欢快': 'joyful', '神秘': 'mysterious',
  '战斗': 'intense battle', '浪漫': 'romantic', '压抑': 'oppressive',
  '壮观': 'spectacular', '宁静': 'serene', '激烈': 'fierce',
}

/**
 * 场景环境描述词（模块级，供 buildScenePrompt / regenerateSceneView 共用）。
 * 用关键词匹配方式从中文环境描述中提取英文视觉词。
 */
const SCENE_ENV_MAP: Record<string, string> = {
  '探方': 'excavation trenches', '考古': 'archaeological site', '工地': 'construction site',
  '荒野': 'wilderness', '裂隙': 'cracks and fissures', '深渊': 'abyss', '洞穴': 'cave',
  '土块': 'soil blocks', '剥落': 'peeling and crumbling', '遮阳棚': 'sunshade canopy',
  '龟裂': 'cracked ground', '黄沙': 'yellow sand', '弥漫': 'swirling dust',
  '森林': 'dense forest', '树木': 'trees', '河流': 'river', '湖泊': 'lake',
  '山': 'mountain', '岩石': 'rocks', '废墟': 'ruins', '建筑': 'building', '城市': 'city',
  '街道': 'street', '巷道': 'alleyway', '沙漠': 'desert', '海洋': 'ocean', '海滩': 'beach',
  '雪': 'snow', '冰': 'ice', '火': 'fire', '烟雾': 'smoke', '雨': 'rain', '雾': 'fog',
  '黑暗': 'darkness', '光': 'light', '月光': 'moonlight', '阳光': 'sunlight', '星空': 'starry sky',
  '古老': 'ancient', '破旧': 'dilapidated', '宏伟': 'grand', '狭窄': 'narrow', '空旷': 'vast open',
  '宽阔': 'wide open', '高耸': 'towering', '低矮': 'low-lying', '陡峭': 'steep cliff',
  '平坦': 'flat terrain', '潮湿': 'damp and wet', '干燥': 'dry and arid',
  '密室': 'secret chamber', '走廊': 'corridor', '大厅': 'grand hall', '花园': 'garden',
  '墓地': 'graveyard', '祭坛': 'altar', '神殿': 'temple', '地牢': 'dungeon', '宫殿': 'palace',
  '实验室': 'laboratory', '办公室': 'office', '教室': 'classroom', '图书馆': 'library',
  '市场': 'market', '酒馆': 'tavern', '港口': 'harbor', '码头': 'dock', '广场': 'plaza',
  '瀑布': 'waterfall', '悬崖': 'cliff', '峡谷': 'canyon', '平原': 'plains', '山谷': 'valley',
  '沼泽': 'swamp', '草原': 'grassland', '竹林': 'bamboo grove', '樱花': 'cherry blossoms',
  '夜晚': 'night', '白天': 'daytime', '黄昏': 'dusk', '黎明': 'dawn', '正午': 'midday',
  '金属': 'metal', '木质': 'wooden', '石质': 'stone', '玻璃': 'glass', '砖墙': 'brick wall',
  '破碎': 'shattered', '完整': 'intact', '蔓延': 'spreading', '缠绕': 'entangled',
  '烛光': 'candlelight', '霓虹': 'neon lights', '篝火': 'campfire', '灯笼': 'lanterns',
}

/**
 * 用 SCENE_ENV_MAP 从中文描述文本中提取英文视觉词。
 * 无匹配时返回空字符串（绝不保留中文）。
 */
function translateEnvDesc(text: string): string {
  return translateVisualDesc(text, SCENE_ENV_MAP)
}

/**
 * 角色职业翻译：精确匹配 CHAR_ROLE_MAP，无匹配时剥离中文字符。
 * 绝不向 Seedream 传入中文。
 */
function translateRole(role: string): string {
  if (!role) return 'character'
  for (const [cn, en] of Object.entries(CHAR_ROLE_MAP)) {
    if (role.includes(cn)) return en
  }
  const ascii = role.replace(/[一-鿿㐀-䶿]/g, '').trim()
  return ascii || 'character'
}

/**
 * 通用视觉关键词提取：遍历 map 收集匹配词，无命中时剥离 CJK 字符。
 * 绝不向 Seedream 传入中文。
 */
function translateVisualDesc(text: string, map: Record<string, string>): string {
  if (!text) return ''
  let result = ''
  for (const [cn, en] of Object.entries(map)) {
    if (text.includes(cn)) result += (result ? ', ' : '') + en
  }
  if (!result) {
    result = text.replace(/[一-鿿㐀-䶿　-〿＀-￯]/g, '').trim()
  }
  return result
}

/** 镜头类型映射（Shot.shotType → 英文描述） */
const shotTypeMap: Record<string, string> = {
  'establishing': 'extreme wide',
  'wide': 'wide',
  'medium': 'medium',
  'close': 'close-up',
}

/** 运镜映射（Shot.cameraMove → 英文描述，遵循 Seedance 分离描述原则）
 * 注意：基础描述【不含】速度词，速度由 applyCamSpeed 按 actionSpeed 注入，
 * 避免写死 "slowly" 导致整片慢动作感（见 P0 优化）。 */
const camMoveMap: Record<string, string> = {
  'static': 'static locked-off camera',
  'pan': 'camera pans horizontally',
  'tilt': 'camera tilts vertically',
  'dolly': 'camera pushes forward through space',
  'tracking': 'camera tracks alongside the subject',
  'zoom-in': 'camera zooms in toward subject, tightening the frame',
  'zoom-out': 'camera zooms out, revealing wider view of the scene',
  'crane': 'camera cranes upward, rising above the subject',
  'handheld': 'handheld camera with natural subtle micro-shake, documentary feel',
  'steadicam': 'steadicam tracking shot, gliding parallel to subject',
}

/** 动作速度 → 运镜速度前缀（P0：解决"慢镜头感"）
 * normal 不加任何缓词 = 自然速率；仅 slow-motion 意图才用 slowly。 */
const camSpeedPrefixMap: Record<string, string> = {
  'slow-motion': 'slowly',
  'normal': '',
  'fast': 'quickly',
  'sudden': 'abruptly',
  'gradual': 'gradually accelerating',
}

/** 给运镜基础描述按动作速度注入前缀（static/handheld/steadicam 自带运动质感，不加前缀避免冗余） */
function applyCamSpeed(base: string, actionSpeed?: string): string {
  if (!actionSpeed) return base
  const prefix = camSpeedPrefixMap[actionSpeed]
  if (!prefix) return base
  if (base.startsWith('static') || base.startsWith('handheld') || base.startsWith('steadicam')) return base
  return `${prefix} ${base}`
}

/** 镜头角度映射（修复 "low-angle angle" 重复拼接问题） */
const cameraAngleMap: Record<string, string> = {
  'eye-level': 'eye-level angle',
  'low-angle': 'low angle shot, looking up at the subject',
  'high-angle': 'high angle shot, looking down at the subject',
  'dutch': 'dutch angle, tilted frame for tension',
}

/** 节奏/情绪 → prompt 描述（pacing UI 设置注入生成 prompt） */
const pacingMap: Record<string, string> = {
  'tense':       'tense pacing, rapid energy',
  'calm':        'calm and measured pacing, gentle rhythm',
  'explosive':   'explosive high-energy pacing, intense momentum',
  'melancholic': 'melancholic slow pacing, heavy emotional weight',
  'suspenseful': 'suspenseful pacing, building tension, slow reveal',
  'comedic':     'light comedic pacing, snappy rhythm',
  'romantic':    'romantic pacing, soft lingering moments',
  'epic':        'epic grand pacing, sweeping scale',
}

/** 动作速度 → prompt 描述（actionSpeed UI 设置注入生成 prompt） */
const actionSpeedMap: Record<string, string> = {
  'slow-motion': 'slow motion action, deliberate movements',
  'normal':      'natural speed action',
  'fast':        'fast-paced action, quick dynamic movements',
  'sudden':      'sudden burst of speed, sharp quick motion',
  'gradual':     'gradually accelerating motion, building speed',
}

/** 转场 → prompt 描述（transition UI 设置注入生成 prompt） */
const transitionMap: Record<string, string> = {
  'cut':        '',
  'dissolve':   'smooth dissolve transition feel',
  'fade-black': 'fade to black ending',
  'fade-white': 'bright white flash ending',
  'whip-pan':   'fast whip pan motion blur',
  'match-cut':  'match cut visual continuity',
  'smash-cut':  'abrupt jarring cut',
  'j-cut':      'audio leads visual',
  'l-cut':      'visual leads audio',
}

/** 造型标签中文化映射（OutfitVariant.tags → 英文 prompt） */
const outfitTagMap: Record<string, string> = {
  '战斗服': 'combat armor', '校服': 'school uniform', '白色校服': 'white school uniform',
  '蓝色百褶裙': 'blue pleated skirt', '红色领结': 'red bow tie', '黑色长风衣': 'black long trench coat',
  '休闲装': 'casual wear', '正装': 'formal suit', '古装': 'traditional ancient Chinese clothing',
  '铠甲': 'plate armor', '长袍': 'long robe', '西装': 'business suit',
  '连衣裙': 'dress', '卫衣': 'hoodie', '牛仔裤': 'jeans',
  '运动鞋': 'sneakers', '高跟鞋': 'high heels', '墨镜': 'sunglasses',
  '围巾': 'scarf', '手套': 'gloves', '帽子': 'hat',
  '披风': 'cape', '斗篷': 'cloak', '发带': 'headband',
  '项链': 'necklace', '耳环': 'earrings', '手表': 'wristwatch',
  '背包': 'backpack', '腰带': 'belt', '靴子': 'boots',
  '短裤': 'shorts', '长裙': 'long skirt', '马甲': 'vest',
  '军装': 'military uniform', '护士服': 'nurse uniform', '旗袍': 'cheongsam',
  '和服': 'kimono', '汉服': 'hanfu', '水手服': 'sailor uniform',
}

/** 光照预设选项 */
const lightingPresets = [
  { id: 'auto',        label: '自动',     icon: '🎯', desc: '根据场景氛围自动推断' },
  { id: 'golden-hour', label: '黄金时刻', icon: '🌅', desc: 'warm golden side-light, long shadows' },
  { id: 'moonlight',   label: '月光',     icon: '🌙', desc: 'cool moonlight, silver-blue tones, soft shadows' },
  { id: 'overcast',    label: '阴天',     icon: '☁️', desc: 'overcast diffused light, even soft shadows' },
  { id: 'neon',        label: '霓虹',     icon: '🌃', desc: 'neon glow, vibrant pink-blue, dark atmosphere' },
  { id: 'studio',      label: '影棚',     icon: '💡', desc: 'professional studio lighting, clean white background' },
  { id: 'dramatic',    label: '戏剧性',   icon: '⚡', desc: 'dramatic chiaroscuro, strong rim light, deep shadows' },
  { id: 'custom',      label: '自定义',   icon: '🎨', desc: '' },
]

function getLightingDescription(preset?: string, custom?: string, mood?: string): string {
  if (preset === 'custom' && custom) return custom
  if (preset && preset !== 'auto' && preset !== 'custom') {
    const p = lightingPresets.find(l => l.id === preset)
    if (p?.desc) return p.desc
  }
  return inferLightingFromMood(mood)
}

/**
 * 核心引擎：构建结构化 prompt + negativePrompt
 * 官方要求：用连贯句子刻画细节，镜头描述与主体分离
 */
function buildStructuredPrompt(ctx: PromptContext): { prompt: string; negativePrompt: string } {
  const parts: string[] = []

  // 1. 风格锚点
  const sp = getStylePrompt(ctx.context || 'storyboard')
  if (sp.prefix) parts.push(sp.prefix)

  // 2. 主体（连贯句子，非词组堆砌）
  parts.push(ctx.subject)

  // 3. 动作/姿态
  if (ctx.action) parts.push(ctx.action)

  // 4. 环境 + 光照（合并为一句自然描述）
  const envParts = [ctx.environment, ctx.lighting].filter(Boolean)
  if (envParts.length) parts.push(envParts.join(', '))

  // 5. 镜头 + 构图（分离描述，避免干扰主体 — Seedance 最佳实践）
  const camParts: string[] = []
  if (ctx.camera?.shotType) camParts.push(`${ctx.camera.shotType} shot`)
  if (ctx.camera?.angle) camParts.push(`${ctx.camera.angle} angle`)
  if (ctx.camera?.movement) camParts.push(ctx.camera.movement)
  if (ctx.camera?.lens) camParts.push(`shot on ${ctx.camera.lens} lens, shallow depth of field`)
  if (camParts.length) parts.push(camParts.join(', '))

  // 6. 质量标记
  const defaults = ['masterpiece', 'best quality', 'highly detailed']
  parts.push(...(ctx.quality || defaults))

  // 7. 画风 suffix
  if (sp.suffix) parts.push(sp.suffix)

  // 负面提示词合并：画风专属 + 上下文特定 + 通用兜底
  const negParts: string[] = []
  if (sp.negative) negParts.push(sp.negative)
  if (ctx.negative?.length) negParts.push(...ctx.negative)
  negParts.push(UNIVERSAL_NEGATIVE)

  return {
    prompt: parts.join(', '),
    negativePrompt: [...new Set(negParts)].join(', '),
  }
}

// ── 人形外观词白名单（仅在非人形角色时需要过滤掉的词）──
// 这些词会强烈暗示图像模型生成人类外形，对非人形角色必须排除
const HUMAN_APPEARANCE_KEYWORDS = new Set([
  'young adult', 'middle-aged', 'elderly', 'teenager',
  'male', 'female',
  'height', 'about', 'build', 'slender', 'muscular', 'thin', 'curvy',
  'skin tone', 'copper-toned', 'fair-skinned', 'dark-skinned', 'wheat-colored skin',
  'short hair', 'long hair', 'curly hair', 'straight hair',
  'black hair', 'white hair', 'blonde hair', 'red hair', 'brown hair', 'silver hair',
  'messy', 'neat',
  'eyes', 'sharp', 'gentle', 'cold', 'focused',
  'deep-set', 'bright', 'calm', 'composed',
  'keen', 'determined', 'melancholic', 'cheerful',
  'wearing', 'clothing', 'armor', 'robe',
  'suit', 'casual wear', 'traditional clothing',
  'tall', 'handsome', 'beautiful', 'cute',
])

/** 专用 Builder: 角色参考图 */
function buildCharacterPrompt(char: CharAppearance, outfit: OutfitVariant, viewKey: string): { prompt: string; negativePrompt: string } {
  const nonHuman = isNonHumanChar(char)

  // ════════════════════════════════════════
  // 🔮 非人形角色：完全独立的纯几何/材质管线
  // ════════════════════════════════════════
  // 彻底绕开 buildStructuredPrompt + context:'character'
  // （后者的 style suffix 会注入 "clean character concept art" = 画一个人）
  // 同时清除所有生命体语义词（life form / entity / being / consciousness
  //  在扩散模型里都会触发人体联想），改用纯物理描述语言。
  if (nonHuman) {
    return buildNonHumanGeometryPrompt(char, outfit, viewKey)
  }

  // ════════════════════════════════════════
  // 🧑 人形角色：原有管线不变
  // ════════════════════════════════════════
  const displayName = char.name.replace(/^[^·]+·/, '') || char.name
  const tagDesc = outfit.tags.length > 0 ? outfit.tags.join(', ') : ''

  // 检测中文名（在 CJK 清洗前），用于注入东亚外貌特征避免 Seedream 生成西方化外貌
  const hasChineseName = /[一-鿿]/.test(displayName)
  const ethnicDesc = hasChineseName ? 'East Asian appearance, Asian facial features, black hair' : ''

  // 中文描述 → 英文视觉关键词（避免 Seedream 把中文渲染为图片文字导致 400）
  const charKeywordMap: Record<string, string> = {
    '青年': 'young adult', '中年': 'middle-aged', '老年': 'elderly', '少年': 'teenager',
    '男': 'male', '女': 'female', '考古': 'archaeologist', '战士': 'warrior', '法师': 'mage',
    '医生': 'doctor', '学生': 'student', '教授': 'professor', '商人': 'merchant',
    '身高': 'height', '一米': 'about', '身材': 'build', '修长': 'slender', '健壮': 'muscular',
    '瘦弱': 'thin', '丰满': 'curvy', '肤色': 'skin tone', '铜色': 'copper-toned',
    '白皙': 'fair-skinned', '黝黑': 'dark-skinned', '小麦色': 'wheat-colored skin',
    '短发': 'short hair', '长发': 'long hair', '卷发': 'curly hair', '直发': 'straight hair',
    '黑发': 'black hair', '白发': 'white hair', '金发': 'blonde hair', '红发': 'red hair',
    '棕发': 'brown hair', '银发': 'silver hair', '凌乱': 'messy', '整齐': 'neat',
    '眼神': 'eyes', '锐利': 'sharp', '温柔': 'gentle', '冷漠': 'cold', '专注': 'focused',
    '深邃': 'deep-set', '明亮': 'bright', '沉稳': 'calm', '冷静': 'composed',
    '敏锐': 'keen', '坚毅': 'determined', '忧郁': 'melancholic', '阳光': 'cheerful',
    '穿着': 'wearing', '服装': 'clothing', '铠甲': 'armor', '长袍': 'robe',
    '西装': 'suit', '休闲装': 'casual wear', '古装': 'traditional clothing',
    '白色': 'white', '黑色': 'black', '红色': 'red', '蓝色': 'blue',
    '绿色': 'green', '金色': 'gold', '银色': 'silver', '紫色': 'purple',
    '悬浮': 'floating', '球形': 'spherical', '发光': 'glowing', '荧光': 'fluorescent',
    '纹路': 'patterns', '旋转': 'rotating', '流动': 'flowing', '星团': 'star cluster',
    '机械': 'mechanical', '有机': 'organic', '水晶': 'crystal', '金属': 'metallic',
    '蓝色光': 'blue glow', '红色光': 'red glow', '温暖': 'warm', '冰冷': 'icy',
  }
  const rawDesc = outfit.description || char.description || ''
  let englishDesc = ''
  for (const [cn, en] of Object.entries(charKeywordMap)) {
    if (rawDesc.includes(cn)) englishDesc += (englishDesc ? ', ' : '') + en
  }
  // 标签也翻译
  const tagKeywordMap: Record<string, string> = {
    '黑发': 'black hair', '高挑': 'tall', '沉稳': 'calm', '敏锐': 'keen eyes',
    '冷静': 'composed', '光球': 'light orb', '蓝色': 'blue', '悬浮': 'floating',
    '星图': 'star map', '流动纹路': 'flowing patterns', '强壮': 'strong',
    '温柔': 'gentle', '冷酷': 'cold', '可爱': 'cute', '帅气': 'handsome',
    '美丽': 'beautiful', '神秘': 'mysterious', '威严': 'majestic',
  }
  if (tagDesc) {
    const translatedTags = outfit.tags.map(t => tagKeywordMap[t] || t).join(', ')
    englishDesc += (englishDesc ? ', ' : '') + translatedTags
  }

  const translatedRole = translateRole(char.role)
  const subject = `${displayName}, a ${translatedRole} character`
  const ethnicPart = ethnicDesc ? `, ${ethnicDesc}` : ''
  const action = `standing pose, character concept art, clean solid background${ethnicPart}${englishDesc ? ', ' + englishDesc : ''}`

  const raw = buildStructuredPrompt({
    subject,
    action,
    quality: ['masterpiece', 'best quality', 'consistent design', 'character reference sheet'],
    context: 'character',
  })
  // 清洗 prompt 中残留的 CJK 字符（角色名/未映射标签），防止 Seedream 400
  return {
    prompt: raw.prompt.replace(/[一-鿿　-〿＀-￯]+/g, '').replace(/,\s*,/g, ',').trim(),
    negativePrompt: raw.negativePrompt,
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔮 非人形角色：纯几何/材质/光效 Prompt 引擎（零生命体语义）
// ═══════════════════════════════════════════════════════════════
//
// 设计原则：
//   1. 绝对不使用 buildStructuredPrompt（其 context:'character' 会注入
//      "clean character concept art" 后缀，等价于「画一个人」）
//   2. 零生命体相关词汇（entity / being / life form / consciousness /
//      character / creature / spirit / soul 均禁用）
//   3. 不用否定式负面提示（扩散模型中 "NO face" 反而激活 face 概念）
//   4. 只用纯物理语言描述「是什么」：几何形状、材质属性、光学效果、空间构图
//   5. 质量标签用产品摄影/抽象艺术术语，不用角色设计术语
//

/** 标签→几何核心词映射（非人形专用） */
const NON_HUMAN_GEOMETRY_MAP: Record<string, string> = {
  '发光球体': 'translucent glass orb with luminous core',
  '悬浮': 'levitating in empty space',
  '纹路流动': 'swirling surface patterns with flowing energy filaments',
  '全息星图': 'holographic star map projection embedded in volume',
  '蓝色光晕': 'cyan-blue atmospheric glow and light emission',
  '光球': 'self-illuminated sphere of light',
  '能量体': 'concentrated energy construct with visible flux lines',
}

/** 标签→材质属性映射 */
const NON_HUMAN_MATERIAL_MAP: Record<string, string> = {
  '发光': 'bioluminescent, self-luminous',
  '荧光': 'fluorescent emission, glowing from within',
  '球形': 'spherical geometry, perfect round shape',
  '水晶': 'crystalline structure, faceted refractive surface',
  '金属': 'metallic sheen, reflective surface',
  '流动': 'fluid dynamics, internal motion visible',
  '旋转': 'rotational symmetry, spiral vortex pattern',
  '机械': 'mechanical precision, engineered geometric form',
  '有机': 'organic curved surfaces, natural growth patterns',
}

/**
 * 非人形角色的独立 Prompt 构建器。
 * 返回的 prompt 只包含：几何核心 + 材质 + 光效 + 视角构图 + 技术质量标签
 * 完全不含任何可能触发人体联想的语义。
 */
function buildNonHumanGeometryPrompt(
  char: CharAppearance, outfit: OutfitVariant, viewKey: string
): { prompt: string; negativePrompt: string } {
  const tags = outfit.tags

  // ── 1. 几何核心：从标签推断主体形状 ──
  let geoCore = ''
  for (const tag of tags) {
    if (NON_HUMAN_GEOMETRY_MAP[tag]) {
      geoCore += (geoCore ? ', ' : '') + NON_HUMAN_GEOMETRY_MAP[tag]
    }
  }
  // 兜底：无匹配标签时用通用能量球
  if (!geoCore) geoCore = 'translucent spherical energy construct with luminous interior'

  // ── 2. 材质属性 ──
  let materials: string[] = []
  for (const tag of tags) {
    if (NON_HUMAN_MATERIAL_MAP[tag]) materials.push(NON_HUMAN_MATERIAL_MAP[tag])
  }
  // 默认补上基础材质（除非标签已覆盖）
  if (materials.length === 0) {
    materials = [
      'glass-like translucency',
      'inner radiance',
      'refractive light dispersion',
    ]
  }

  // ── 3. 描述文本中的颜色/视觉词（安全子集，只保留纯物理属性） ──
  const safeVisualMap: Record<string, string> = {
    '蓝色': 'deep cyan-blue coloration', '红色': 'v crimson-red tones',
    '金色': 'warm golden hue', '银色': 'silver-white metallic tint',
    '紫色': 'violet-purple iridescence', '绿色': 'emerald green glow',
    '白色': 'brilliant white core', '黑色': 'dark obsidian exterior',
    '温暖': 'warm color temperature', '冰冷': 'cool blue-white temperature',
  }
  const rawDesc = outfit.description || char.description || ''
  let visualProps = ''
  for (const [cn, en] of Object.entries(safeVisualMap)) {
    if (rawDesc.includes(cn)) visualProps += (visualProps ? ', ' : '') + en
  }

  // ── 4. 视角构图（纯空间描述，不含 body/back/rear） ──
  const angleDesc: Record<string, string> = {
    'front-full':  'directly facing viewer, centered in frame, full spherical composition visible',
    'side-full':   'profile angle from side, showing curved contour and depth',
    'back-full':   'opposite-side viewing angle, showing rear curvature and equatorial detail',
    'front-upper': 'zoomed close-up on surface texture and internal glow details',
  }
  const viewAngle = angleDesc[viewKey] || angleDesc['front-full'] || ''

  // ── 5. 组装 prompt（纯物理描述，零生命体词汇）──
  const promptParts = [
    // 风格前缀：产品级抽象摄影（不是 character art）
    'professional abstract product photography',
    // 几何主体
    geoCore,
    // 材质
    ...materials,
    // 视觉属性
    visualProps,
    // 视角与构图
    viewAngle,
    // 环境
    'isolated on dark void background, empty space surrounding subject, studio lighting',
    // 光效
    'volumetric lighting, subsurface scattering, caustic light patterns, chromatic aberration',
    // 技术质量标签（产品/抽象艺术术语，不是 character design）
    '8k resolution, ultra detailed, sharp focus, octane render quality, ray-traced',
  ].filter(Boolean)

  const prompt = promptParts.join(', ')

  // ── 6. Negative prompt（纯质量/风格反模式，零人体词汇）──
  // 设计原则：完全不提 human/person/face/body/figure 等词（即使作为排除项也不提）
  // 因为扩散模型中这些词会激活对应概念的注意力（悖论效应）。
  // 改用纯风格类别 + 物理属性反模式来间接排除。
  const negativeParts = [
    // 质量缺陷
    'low quality, blurry, noisy, pixelated, compressed artifacts, jpeg artifacts',
    // 排除具象写实风格（这类风格的训练集含大量人像，最容易产出人形）
    'photorealistic, realistic photo, dslr photography, candid snapshot',
    // 排除角色/动画画风（训练集含大量拟人化形象）
    'anime style, manga illustration, cartoon drawing, comic art, 2d animation cel',
    // 排除 3d 渲染的拟人模型风格（用 object/model 替代 figure/character）
    '3d rendered object, cgi model, unreal engine render, blender organic modeling',
    // 排除拟人化/具象化倾向
    'anthropomorphic design, figurative art, zoomorphic, biological morphology, organic anatomy',
    // 物理性反面：非人形应该是透明/发光的 → 排除不透明实心
    'solid opaque, matte surface, non-transmissive, unlit interior, absorption only, zero emission',
    // 通用排除
    'watermark, text overlay, typography, logo, frame, border, edge vignette',
  ]

  return {
    prompt,
    negativePrompt: negativeParts.join(', '),
  }
}

/** 专用 Builder: 场景图 */
function buildScenePrompt(scene: SceneItem): { prompt: string; negativePrompt: string } {
  // 清理环境描述中可能的角色引用
  let desc = scene.environmentDesc || scene.name
  // 移除常见角色名前缀（如"林启在"、"林启"等）— 保留纯环境描述
  for (const c of characterAppearances.value) {
    const shortName = c.name.replace(/^[^·]+·/, '')
    if (shortName && desc.includes(shortName)) {
      desc = desc.replace(new RegExp(`${shortName}[在正站走跑跪]?`, 'g'), '').replace(/\s+/g, ' ').trim()
    }
  }
  if (!desc) desc = scene.name

  // 中文环境描述 → 英文视觉关键词（使用模块级 SCENE_ENV_MAP，避免渲染为图片文字）
  let englishDesc = translateEnvDesc(desc)
  if (!englishDesc) {
    // 无匹配关键词时，只用场景名（去掉中文避免文字渲染）
    englishDesc = scene.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'mysterious location'
  }

  // 环境要素（所有值须为英文，避免中文进入 Seedream prompt）
  const envParts: string[] = []
  if (scene.mood) {
    // 优先查精确翻译表，无匹配时剥离中文字符兜底
    const moodEn = MOOD_TEXT_MAP[scene.mood] ?? scene.mood.replace(/[一-鿿㐀-䶿]/g, '').trim()
    if (moodEn) envParts.push(`${moodEn} atmosphere`)
  }
  if (scene.sceneType) {
    const typeMap: Record<string, string> = {
      '室内': 'indoor', '室外': 'outdoor', '地下': 'underground',
      '天空': 'sky/aerial', '水下': 'underwater', '宇宙': 'outer space',
      '虚拟空间': 'virtual/digital space',
    }
    const typeEn = typeMap[scene.sceneType] ?? scene.sceneType.replace(/[一-鿿㐀-䶿]/g, '').trim()
    if (typeEn) envParts.push(typeEn)
  }
  if (scene.timeOfDay) {
    const todEn = TIME_OF_DAY_MAP[scene.timeOfDay] ?? scene.timeOfDay.replace(/[一-鿿㐀-䶿]/g, '').trim()
    if (todEn) envParts.push(todEn)
  }

  // 光照
  let lighting = inferLightingFromMood(scene.mood)
  if (scene.colorTone && COLOR_TONE_MAP[scene.colorTone]) {
    lighting += `, ${COLOR_TONE_MAP[scene.colorTone]}`
  }

  // 单张高质量全景环境图（后续视角通过裁剪派生）
  const subject = `wide establishing shot of an environment location, ${englishDesc}, environment only, absolutely no humans, no people, no figures, no silhouettes, no characters, empty uninhabited scene, cinematic composition, detailed background`

  const quality = [
    'masterpiece', 'best quality', 'detailed environment',
    'high resolution', 'sharp details',
    'no people', 'no humans', 'no characters', 'no figures', 'no silhouettes',
    'empty scene', 'uninhabited', 'environment concept art',
  ]

  const { prompt, negativePrompt } = buildStructuredPrompt({
    subject,
    environment: envParts.length > 0 ? envParts.join(', ') : undefined,
    lighting,
    camera: { shotType: 'wide', angle: 'eye-level' },
    quality,
    context: 'scene',
  })

  // 强化 negative prompt：反人物 + 反文字渲染
  const enhancedNegative = [negativePrompt, 'people, person, human, figure, silhouette, character, man, woman, boy, girl, crowd, face, body', 'text, words, letters, caption, subtitle, label, watermark, logo, signature, writing, typography, font, chinese characters, kanji, text overlay'].filter(Boolean).join(', ')

  return { prompt, negativePrompt: enhancedNegative }
}

/** 专用 Builder: 分镜帧预览图 */
function buildShotPrompt(shot: Shot, chars: CharAppearance[], scene?: { name: string; mood?: string }): { prompt: string; negativePrompt: string } {
  // 角色动作描述（用自然语言串联，非词组堆砌 — 官方要求）
  const charDescs = chars.map(c => {
    const outfit = getShotOutfitForChar(shot, c)
    const name = c.name.replace(/^[^·]+·/, '') || c.name
    return `${name}(${c.role})` + (outfit.name !== '默认造型' ? ` in ${outfit.name}` : '')
  })
  const charAction = charDescs.length > 0 ? charDescs.join(' and ') : ''

  const subject = charAction || shot.description || shot.title

  return buildStructuredPrompt({
    subject,
    action: shot.description && charAction ? shot.description : undefined,
    environment: scene ? `environment: ${scene.name}` : undefined,
    lighting: getLightingDescription(shot.lightingPreset, shot.lightingCustom, scene?.mood),
    camera: {
      shotType: shotTypeMap[shot.shotType || 'medium'],
      movement: applyCamSpeed(camMoveMap[shot.cameraMove || 'static'], shot.actionSpeed),
      lens: shot.cameraLens,
    },
    context: 'storyboard',
  })
}

// ── Seedance API 统一构建器 ────────────────────────────────────

/** 构建结果 — 直传 Seedance API */
interface GenerationPayload {
  content: Array<Record<string, unknown>>
  parameters: {
    duration: number
    resolution: string
    ratio?: string
    seed?: number
    generateAudio?: boolean
    returnLastFrame?: boolean
  }
  negativePrompt?: string
  /** 供 UI 预览的可读 prompt 文本 */
  previewText: string
}

/** 运镜速度映射 */
const speedMap: Record<string, string> = {
  slow: 'slowly',
  normal: '',
  fast: 'quickly',
}

/** 多段镜头运动 → 英文描述（含时间分配比例） */
function buildCameraDescription(actions: CameraAction[]): string {
  if (!actions.length) return 'static camera'
  const parts = actions.map(a => {
    const moveDesc = camMoveMap[a.move] || a.move
    const speedPrefix = a.speed && speedMap[a.speed] ? speedMap[a.speed] + ' ' : ''
    const ratio = a.durationRatio ? ` (${Math.round(a.durationRatio * 100)}% of duration)` : ''
    const desc = a.description ? `, ${a.description}` : ''
    return `camera ${speedPrefix}${moveDesc.replace(/^camera\s*/, '')}${ratio}${desc}`
  })
  return parts.join(', then ')
}

/**
 * 核心：从 Shot + 上下文构建完整的 Seedance API payload
 *
 * 数据流：
 *   Shot.generation (用户编辑的完整配置)
 *   + characterArchetypes → 自动解析角色参考图
 *   + sceneTemplate → 自动解析场景参考图
 *   + selectedStyle → 画风锚点
 *   → GenerationPayload (直传 API)
 */
/** 角色锁定文本块（P0 prompt anchoring）：从角色外观/造型提取稳定视觉描述，
 * 在每个镜头视频 prompt 开头固定复用，抑制跨镜头角色漂移（研究：光有参考图不够，需 verbatim 文本锚点）。 */
function buildCharacterLockBlock(chars: CharAppearance[], shot: Shot): string {
  if (!chars.length) return ''
  const blocks = chars.map(c => {
    const outfit = getShotOutfitForChar(shot, c)
    const name = c.name.replace(/^[^·]+·/, '') || c.name
    const bits: string[] = []
    if (c.description) bits.push(c.description)
    if (outfit.description) bits.push(outfit.description)
    const tags = (outfit.tags?.length ? outfit.tags : c.tags) || []
    if (tags.length) bits.push(tags.join(', '))
    const visual = bits.filter(Boolean).join('; ')
    return `${name}: ${visual || 'keep consistent appearance from reference image'}. Face features reference the HEADSHOT (front-upper) reference image; maintain consistent costume and outfit across all shots.`
  })
  return `CHARACTER IDENTITY LOCK — identical visual identity across ALL shots (same face, same costume, same hair color): ${blocks.join(' | ')}.`
}

// ════════════════════════════════════════════════════════════════
// 工业级漫剧生成引擎（基于火山引擎 Seedance 指南 + 漫剧制作手册）
//   P1 全局制作规范 · P3 大头照+全身照参考策略 · P4 约束词+压缩 · P6 文戏/武戏
// ════════════════════════════════════════════════════════════════

/** P3：角色参考图策略 = 大头照(front-upper) + 全身照(front-full)，禁用多视图/三视图 */
const REFERENCE_VIEW_ORDER = ['front-upper', 'front-full'] as const
/** P3：单镜头参考图总上限收敛到 4-5 张（角色锚定 2 + 场景 1 + 资产/自定义 1-2） */
const MAX_REF_IMAGES_PER_SHOT = 5

/**
 * P4 约束词块：每镜头结尾固定注入，抑制字幕/水印/风格漂移/双胞胎。
 * 手册铁律 5：无字幕 / 无水印 / 风格锁定 / 防双胞胎全局约束。
 */
function buildConstraintBlock(stylePrefix: string): string {
  const style = stylePrefix ? stylePrefix.replace(/,/g, '') : 'anime'
  return [
    'NO subtitles, NO on-screen text, NO captions, NO watermark, NO logo, NO signature',
    `strict style lock: maintain ${style} across every shot, no style drift`,
    'forbid duplicate identical-looking characters in a single frame; keep only one corresponding person per identity',
  ].join('; ')
}

/**
 * P4 提示词压缩：超长小说原文压缩到 token 安全区（默认 ~4500 字），
 * 优先保留含对白(引号)的句子 + 开头背景，规避 v4-pro 因 prompt 过长超时。
 * 保留：参考图说明 / 景别+运镜 / 台词 / 镜头编号；精简：冗余修饰。
 */
function compressNarrative(text: string, maxChars = 4500): string {
  if (!text) return ''
  const collapsed = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxChars) return collapsed
  const sentences = collapsed.split(/(?<=[。！？!?])/).filter(s => s.trim().length > 0)
  // 优先抽取含对白引号的句子（关键台词）
  const dialogue = sentences.filter(s => /[“"「『‘'《]/.test(s)).slice(0, 14)
  let out = dialogue.join('')
  for (const s of sentences) {
    if (out.length + s.length > maxChars) break
    if (!out.includes(s)) out += s
  }
  return out.slice(0, maxChars).replace(/\s+$/, '')
}

/**
 * P1 格式化全局制作规范为可注入锚点文本（直传每镜头 prompt 开头）。
 */
function formatGlobalDirective(gd: GlobalDirective): string {
  return [
    'GLOBAL DIRECTIVE (identical for every shot):',
    `Style: ${gd.styleLock}`,
    `Color tone: ${gd.colorTone}`,
    `Mood: ${gd.mood}`,
    gd.ambientSound ? `Ambient sound: ${gd.ambientSound}` : '',
    `Constraints: ${gd.constraints}`,
  ].filter(Boolean).join('; ')
}

/**
 * P1 全局制作规范生成器：基于艺术风格 + 场景 + 角色 + 世界观，
 * 用 DeepSeek 产出一段贯穿全剧的规范 JSON（手册"全局制作规范"结构）。
 * 失败返回 null（非阻断，调用方回退为空）。
 */
async function generateGlobalDirective(): Promise<GlobalDirective | null> {
  try {
    const sp = getStylePrompt('storyboard')
    const stylePrefix = sp.prefix || '2D anime style'
    const sceneLines = extractedScenes.value.map(s => `${s.name}（${s.mood || ''}, ${s.environmentDesc || ''}）`).join('\n') || '无'
    const charLines = characterAppearances.value.map(c => {
      const o = getActiveOutfit(c)
      return `${c.name.replace(/^[^·]+·/, '')}（${c.role}）: ${(c.description || '')} ${(o.description || '')}`.trim()
    }).join('\n') || '无'
    const prompt = `你是一位顶级动画美术总监。基于以下项目信息，生成一段贯穿全剧的【全局制作规范】，用于锁定每一集每一镜的统一视觉基调，解决跨镜头不一致问题。

【艺术风格】${stylePrefix}
【场景】${sceneLines}
【角色】${charLines}
${worldviewContext.value ? '【世界观】' + worldviewContext.value : ''}

请严格输出 JSON：
{"styleLock":"2D日漫风格，线条干净，赛璐璐上色","colorTone":"冷蓝月光色调，暗部偏青","mood":"悬疑紧张，压抑中带着希望","constraints":"全程无字幕无文字无Logo无水印；同一角色外形着装严格一致；禁止出现外形完全一致的双胞胎；","ambientSound":"雨声、远处闷雷、潮湿的回响"}

要求：
- styleLock：锁定画风与渲染方式
- colorTone：锁定全局色调与暗部处理
- mood：锁定情绪基调
- constraints：写死全局禁令（无字幕/无水印/角色一致/防双胞胎）
- ambientSound：环境音效基调（随镜头下发）
只输出 JSON，不要其他文字。`

    const res = await generateText({ prompt, maxTokens: 1200, model: 'v4-pro' })
    const parsed = parseAIJson(res) as Partial<GlobalDirective>
    const gd: GlobalDirective = {
      styleLock: parsed.styleLock || stylePrefix,
      colorTone: parsed.colorTone || '',
      mood: parsed.mood || '',
      constraints: parsed.constraints || '无字幕无文字无水印；同一角色外形一致；禁止双胞胎',
      ambientSound: parsed.ambientSound || '',
      anchor: '',
    }
    gd.anchor = formatGlobalDirective(gd)
    return gd
  } catch (e) {
    console.warn('[全局规范] 生成失败，回退为空:', e)
    return null
  }
}

/**
 * P6 文戏/武戏分模式：武戏注入"运镜跟随动作节奏、攻防转换切机位、主体保持焦点"。
 */
function buildActionModeBlock(intensity?: 'calm' | 'normal' | 'action'): string {
  if (intensity === 'action') {
    return 'action sequence: camera follows the rhythm of movement, cut between angles on attack/defense transitions, keep the main subject in sharp focus, dynamic kinetic energy, impactful framing'
  }
  if (intensity === 'calm') {
    return 'quiet dramatic beat: gentle settled pacing, minimal camera movement, intimate framing, let performance breathe'
  }
  return ''
}

function buildContentArray(
  shot: Shot,
  opts: {
    context: 'image' | 'video'
    characters?: CharAppearance[]
    scene?: { name: string; mood?: string; imageUrl?: string; views?: Array<{ angle: string; imageUrl: string }> }
    style?: string
    nextShotFirstFrame?: string
    editedPrompt?: string
  } = { context: 'image' }
): GenerationPayload {
  const gen = shot.generation || {}
  const chars = opts.characters || []
  const scene = opts.scene

  // ─── 1. 解析 generation（fallback 到顶层字段）───
  const shotType = gen.shotType || shot.shotType || 'medium'
  const cameraAngle = gen.cameraAngle || shot.cameraAngle
  const cameraLens = gen.cameraLens || shot.cameraLens
  const lightingPreset = gen.lightingPreset || shot.lightingPreset
  const lightingCustom = gen.lightingCustom || shot.lightingCustom
  const dialogue = gen.dialogue || shot.dialogue
  const narration = gen.narration || shot.narration
  const sfx = gen.sfx || shot.sfx

  // ─── 2. 构建文本 prompt ───
  const ctxType: 'character' | 'scene' | 'storyboard' = opts.context === 'image' ? 'storyboard' : 'storyboard'
  const sp = getStylePrompt(ctxType)

  // 检测新格式：description 中含 [pic]@ 引用 → Seedance 风格直接 prompt
  const isNewFormat = /\[pic\]@/.test(shot.description || '')
  let promptText: string
  const picRefs = isNewFormat ? resolveShotPicRefs(shot) : []
  // [FIX-2026-07-14] 镜头差异化指令——在 if/else 外声明，两种格式分支都需要
  let shotSpecificDirectives = ''

  if (isNewFormat) {
    // 新格式：直接用 description 作为 prompt，镜头内容优先
    const parts: string[] = []
    if (sp.prefix) parts.push(sp.prefix)
    parts.push(shot.description!)
    if (sbWorldviewContext.value) parts.push(`setting: ${sbWorldviewContext.value}`)
    if (sp.suffix) parts.push(sp.suffix)
    promptText = parts.join(', ')
  } else {
    // 旧格式：组合式构建
    // 提示词权重策略：镜头特定内容 > 角色动作 > 场景环境 > 世界观/画风
    // 图片生成模型对 prompt 前面的内容权重更高，因此镜头动作必须优先于场景设定
  const parts: string[] = []

  // a. 画风 prefix（简短的风格锚点，不占太多权重）
  if (sp.prefix) parts.push(sp.prefix)

  // b. 主体描述（角色 + 造型 + 外观描述 + 空间位置，用自然语言）
  const positionHints = ['on the left', 'on the right', 'in the center background']
  const charDescs = chars.map((c, i) => {
    const outfit = getShotOutfitForChar(shot, c)
    const name = c.name.replace(/^[^·]+·/, '') || c.name
    const outfitDesc = outfit.name !== '默认造型' ? ` in ${outfit.name}` : ''
    // 造型标签翻译为英文
    const translatedTags = outfit.tags.length > 0
      ? ', wearing ' + outfit.tags.map(t => outfitTagMap[t] || t).join(', ')
      : ''
    // 角色外观描述注入（如 "black long hair, red eyes, slender build"）
    const charDesc = c.description ? `, ${c.description}` : ''
    // 多人同框空间位置
    const position = chars.length > 1 ? `, ${positionHints[i] || ''}` : ''
    return `${name}(${c.role})${outfitDesc}${translatedTags}${charDesc}${position}`
  })
  const subject = charDescs.length > 0 ? charDescs.join(' and ') : (shot.description || shot.title)
  parts.push(subject)

  // c. 动作/场景描述 — 镜头核心内容，必须紧跟主体
  if (shot.description && charDescs.length > 0) {
    parts.push(shot.description)
  }

  // d. 环境 + 光照 — 作为场景背景补充，不覆盖镜头特定内容
  const envParts: string[] = []
  if (scene) envParts.push(`environment: ${scene.name}`)
  const lighting = getLightingDescription(lightingPreset, lightingCustom, scene?.mood)
  if (lighting) envParts.push(lighting)
  if (envParts.length) parts.push(envParts.join(', '))

  // e. 镜头语言（支持多段 cameraActions）
  const camActions = gen.cameraActions
  if (camActions && camActions.length > 0) {
    parts.push(buildCameraDescription(camActions))
  } else {
    const camParts: string[] = []
    if (shotTypeMap[shotType]) camParts.push(`${shotTypeMap[shotType]} shot`)
    if (cameraAngle) camParts.push(cameraAngleMap[cameraAngle] || cameraAngle)
    const move = shot.cameraMove || 'static'
    if (move !== 'static' && camMoveMap[move]) camParts.push(camMoveMap[move])
    if (cameraLens) camParts.push(`shot on ${cameraLens} lens, shallow depth of field`)
    if (camParts.length) camParts.forEach(p => parts.push(p))
  }

  // e2. 拍摄角度（中文值翻译为英文）
  const viewAngleMap: Record<string, string> = {
    '平视': 'eye-level angle',
    '俯视': 'high angle looking down',
    '仰视': 'low angle looking up',
    '鸟瞰': 'birds-eye view from above',
    '倾斜': 'dutch angle tilted',
  }
  if (shot.cameraViewAngle && viewAngleMap[shot.cameraViewAngle]) {
    parts.push(viewAngleMap[shot.cameraViewAngle])
  }

  // e3. 微表情
  if (shot.microExpression) {
    parts.push(`facial expression: ${shot.microExpression}`)
  }

  // e4. 站位
  if (shot.positioning) {
    parts.push(`character positioning: ${shot.positioning}`)
  }

  // e5. 空间锚点
  if (shot.spatialAnchor) {
    parts.push(`spatial anchors: ${shot.spatialAnchor}`)
  }

  // f. 对话（用双引号包裹 → Seedance 口型同步）
  if (dialogue) {
    parts.push(`dialogue: "${dialogue}"`)
  }

  // g. 旁白 + 音效
  if (narration) parts.push(`narration: ${narration}`)
  if (sfx) parts.push(`sound: ${sfx}`)

  // g2. 节奏 + 动作速度 + 转场（UI 设置注入 prompt）
  if (shot.pacing && pacingMap[shot.pacing]) parts.push(pacingMap[shot.pacing])
  if (shot.actionSpeed && actionSpeedMap[shot.actionSpeed]) parts.push(actionSpeedMap[shot.actionSpeed])
  if (shot.transition && transitionMap[shot.transition]) {
    const transDesc = transitionMap[shot.transition]
    if (transDesc) parts.push(transDesc)
  }
  // 多人对话场景互动提示
  if (chars.length === 2 && dialogue) {
    parts.push('two characters facing each other in conversation')
  }

  // h. 质量标记（视频增加速度暗示，抑制慢动作）
  const qualityMarkers = opts.context === 'video'
    ? ['cinematic quality, natural-speed decisive motion, 24fps, purposeful camera movement, physically realistic, high production value, no slow-motion, no floaty drift']
    : ['masterpiece', 'best quality', 'highly detailed']
  parts.push(...qualityMarkers)

  // h2. 世界观上下文 — 放在后段作为背景锚点，避免主导每个镜头的视觉
  if (sbWorldviewContext.value) {
    parts.push(`setting: ${sbWorldviewContext.value}`)
  }

  // h3. 多宫格参考图提示
  if (referenceGrid.value.length > 0) {
    const charCells = referenceGrid.value.filter(c => c.type === 'character')
    const sceneCells = referenceGrid.value.filter(c => c.type === 'scene')
    const hints: string[] = []
    if (charCells.length > 0) hints.push(`character refs in grid cells ${charCells.map(c => c.index).join(',')}`)
    if (sceneCells.length > 0) hints.push(`scene refs in grid cells ${sceneCells.map(c => c.index).join(',')}`)
    if (hints.length > 0) parts.push(`[Reference grid: ${hints.join('; ')}. Match the visual style and appearance from these reference images]`)
  }

  // i. 画风 suffix
  if (sp.suffix) parts.push(sp.suffix)

  // [FIX-2026-07-14] 提取镜头核心差异化指令（景别/角度/运镜）到独立变量，
  // 稍后注入到 prompt 前部（gdAnchor 之后），让图片模型优先处理这些差异化信号
  const shotDirectiveIndices: number[] = []
  for (let pi = 0; pi < parts.length; pi++) {
    const p = parts[pi]
    if (/^(extreme |close |medium |long |wide |establishing )?shot\b|eye-level|high angle|low angle|birds-eye|dutch angle|shot on \w+ lens/i.test(p)
      || /\b(camera movement|pan|tilt|dolly|tracking|static shot|shallow depth)/i.test(p)) {
      shotDirectiveIndices.push(pi)
    }
  }
  shotSpecificDirectives = shotDirectiveIndices.map(i => parts[i]).filter(Boolean).join('; ')
  for (const idx of shotDirectiveIndices.reverse()) { parts.splice(idx, 1) }

  promptText = parts.join(', ')
  } // end else (旧格式)

  // 全局制作规范锚点（P1）：每个镜头 prompt 开头固定复用，抑制跨镜头风格/色调漂移
  const gdAnchor = injectGlobalDirective.value ? (shot.globalDirective || globalDirectiveAnchor.value) : ''
  if (gdAnchor) promptText = `${gdAnchor} ${promptText}`
  // [FIX-2026-07-14] 紧跟全局规范之后，立即注入镜头差异化指令（景别/角度/运镜）
  // 这是每个镜头"不一样"的核心信号，必须在高权重位置
  if (shotSpecificDirectives) promptText = `${promptText}, [Shot framing: ${shotSpecificDirectives}]`
  // 角色锁定文本块（P0 prompt anchoring）：视频模式紧跟全局规范，抑制跨镜头角色漂移
  // [FIX-2026-07-14 v2] 图片模式用"视觉身份锚点"替代——锁身份特征（性别/脸/发/装）不锁姿势/构图，
  // 解决上一版"太弱→人物飘了（性别都变）"和原始版"太强→千镜一面"的两个极端问题
  if (chars.length > 0 && opts.context === 'video') {
    const lock = buildCharacterLockBlock(chars, shot)
    if (lock) promptText = `${lock} ${promptText}`
  } else if (chars.length > 0 && opts.context === 'image') {
    // [v3-FIX-2026-07-14] 图片模式身份锚点：三重 SAME PERSON 锁 + 精确面部特征
    // 核心策略：用"重复+高权重词"对抗图片模型的人脸漂移倾向
    const idAnchors = chars.map(c => {
      const name = c.name.replace(/^[^·]+·/, '') || c.name
      const outfit = getShotOutfitForChar(shot, c)
      const bits: string[] = []
      // 核心身份特征（必须精确，模型靠这些认人）
      if (c.description) bits.push(c.description)
      if (outfit.description) bits.push(outfit.description)
      const tags = (outfit.tags?.length ? outfit.tags : c.tags) || []
      if (tags.length) bits.push(tags.join(', '))
      const visual = bits.filter(Boolean).join('; ')
      // 三重锁定：开头 SAME PERSON → 中间 EXACT FACE → 结尾 HEADSHOT reference
      return [
        `SAME EXACT PERSON as the headshot reference photo — ${name}`,
        visual || 'match reference image exactly',
        `EXACT IDENTICAL FACE FEATURES, same eyes nose mouth jawline hair as reference`,
        `Face must match HEADSHOT (front-upper) reference image precisely, no face change allowed`,
      ].join('. ') + '.'
    }).join(' | ')
    promptText = `[FACE LOCK — STRICT IDENTITY: ${idAnchors}] ${promptText}`
    // [v3-FIX] 在 prompt 末尾再追加一次 SAME PERSON（模型对首尾注意力权重最高）
    const charNames = chars.map(c => c.name.replace(/^[^·]+·/, '') || c.name).join(', ')
    promptText = `${promptText} [RECONFIRM: this is the SAME PERSON (${charNames}) from the reference photo — identical face, do not change appearance]`
  }
  // 约束词块（P4）：无字幕/无水印/风格锁定/防双胞胎（每镜头固定）
  promptText = `${promptText}, ${buildConstraintBlock(sp.prefix || '')}`
  // 文戏/武戏分模式（P6）：视频模式用运动指令，图片模式用构图级描述
  // [FIX-2026-07-14] 图片模式也注入构图差异，避免文戏/武戏镜头视觉雷同
  if (opts.context === 'video') {
    const actionBlock = buildActionModeBlock(shot.actionIntensity)
    if (actionBlock) promptText = `${promptText}, ${actionBlock}`
  } else if (shot.actionIntensity === 'action') {
    // 武戏图片：动态姿势、紧张构图、肢体张力
    promptText = `${promptText}, dynamic action pose, tense body posture, dramatic physical tension, kinetic composition`
  } else if (shot.actionIntensity === 'calm') {
    // 文戏图片：静态平稳、亲密构图、表演呼吸感
    promptText = `${promptText}, calm composed posture, still balanced framing, intimate composition, subtle emotional expression`
  }

  // ─── 3. 构建 content 数组 ───
  const content: Array<Record<string, unknown>> = []

  // a. 文本 prompt（可被用户编辑覆盖）
  const finalPrompt = opts.editedPrompt || gen.prompt || promptText
  content.push({ type: 'text', text: finalPrompt })

  // b. 参考图：自动解析角色 + 场景 + 用户自定义
  const refImages: ShotMediaImage[] = []
  // [v3-FIX-2026-07-14] 记录首个大头照 URL，用于 Headshot Bookend 策略（首尾夹击）
  let headshotUrl: string | undefined

  // 角色参考图（P3：大头照+全身照，按景别动态选择主参考图）
  // 远景/全景 → front-full 优先（展示全身造型）；特写/近景/中景 → front-upper 优先（面部细节）
  const isWideShot = (shot.shotType === 'wide' || shot.shotType === 'establishing' || shot.shotType === 'long')
  // 根据景别决定视角优先级：宽镜头先全身照，其他先大头照
  const viewOrderForShot: readonly string[] = isWideShot
    ? ['front-full', 'front-upper']
    : ['front-upper', 'front-full']
  for (const c of chars) {
    const outfit = getShotOutfitForChar(shot, c)
    const views = (outfit.views ?? c.views).filter(v => v.imageUrl)
    let charRefCount = 0
    for (const key of viewOrderForShot) {
      if (charRefCount >= 2) break
      const v = views.find(vv => vv.key === key && vv.imageUrl)
      if (v?.imageUrl && refImages.length < MAX_REF_IMAGES_PER_SHOT) {
        refImages.push({
          url: v.imageUrl!,
          role: 'reference_image',
          label: `${c.name}·${v.label}`,
          sourceType: 'character',
          sourceId: String(c.id),
        })
        // 记录第一个大头照用于 bookend
        if (!headshotUrl && key === 'front-upper') headshotUrl = v.imageUrl
        charRefCount++
      }
    }
  }

  // [v3-FIX] Headshot Bookend：将大头照重复放到参考数组末尾，给模型面部信号最大权重
  if (headshotUrl && refImages.length < MAX_REF_IMAGES_PER_SHOT) {
    refImages.push({
      url: headshotUrl,
      role: 'reference_image',
      label: 'FACE-LOCK·headshot-bookend',
      sourceType: 'character',
      sourceId: 'bookend',
    })
  }

  // 场景参考图（[v3-FIX] 特写/近景跳过——场景图抢夺模型对面部的注意力，导致人脸漂移）
  const isFaceCriticalShot = (
    shot.shotType === 'extreme-close-up' || shot.shotType === 'close-up'
  )
  if (!isFaceCriticalShot && (scene?.imageUrl || scene?.views?.length)) {
    const sceneViewUrl = getSceneViewForShot(shot, scene)
    if (sceneViewUrl) {
      refImages.push({
        url: sceneViewUrl,
        role: 'reference_image',
        label: scene.name,
        sourceType: 'scene',
      })
    }
  }
  // 多宫格参考图注入（去重，补充额外视角）
  if (referenceGrid.value.length > 0) {
    const existingUrls = new Set(refImages.map(r => r.url))
    for (const cell of referenceGrid.value) {
      if (!existingUrls.has(cell.imageUrl) && refImages.length < 9) {
        refImages.push({
          url: cell.imageUrl,
          role: 'reference_image',
          label: `格${cell.index}: ${cell.label}`,
          sourceType: cell.type,
          sourceId: cell.sourceId,
        })
        existingUrls.add(cell.imageUrl)
      }
    }
  }
  // 用户自定义参考图
  if (gen.referenceImages?.length) {
    refImages.push(...gen.referenceImages.filter(r => r.role === 'reference_image'))
  }
  // 新格式 [pic]@ 引用的参考图（去重追加）
  if (picRefs.length > 0) {
    const existUrls = new Set(refImages.map(r => r.url))
    for (const pr of picRefs) {
      if (!existUrls.has(pr.url) && refImages.length < 9) {
        refImages.push({ url: pr.url, role: 'reference_image', label: pr.label, sourceType: 'custom' as const })
        existUrls.add(pr.url)
      }
    }
  }
  // 注入 content（最多 9 张）
  // ⚠️ Seedance 2.0 限制：首帧/尾帧不能与参考图混用
  const hasFirstFrame = opts.context === 'video' && gen.firstFrameOverride
  if (!hasFirstFrame) {
    for (const ref of refImages.slice(0, 9)) {
      content.push({
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: ref.url },
      })
    }
  }

  // c. 参考视频
  if (gen.referenceVideos?.length) {
    for (const v of gen.referenceVideos.slice(0, 3)) {
      content.push({
        type: 'video',
        role: 'reference_video',
        video_url: { url: v.url },
      })
    }
  }

  // d. 参考音频
  if (gen.referenceAudios?.length) {
    for (const a of gen.referenceAudios.slice(0, 3)) {
      content.push({
        type: 'audio',
        role: 'reference_audio',
        audio_url: { url: a.url },
      })
    }
  }

  // e. 首帧（视频模式）
  if (opts.context === 'video') {
    const firstFrame = gen.firstFrameOverride
    if (firstFrame) {
      content.push({
        type: 'image_url',
        role: 'first_frame',
        image_url: { url: firstFrame },
      })
    }
  }

  // f. 尾帧（视频模式 — 链式衔接：下一镜头首帧 = 本镜头尾帧）
  if (opts.context === 'video') {
    const lastFrame = gen.lastFrameOverride || opts.nextShotFirstFrame
    if (lastFrame) {
      content.push({
        type: 'image_url',
        role: 'last_frame',
        image_url: { url: lastFrame },
      })
    }
  }

  // ─── 4. 负面提示词 ───
  const negParts: string[] = []
  if (sp.negative) negParts.push(sp.negative)
  negParts.push(UNIVERSAL_NEGATIVE)
  if (opts.context === 'video') negParts.push(VIDEO_NEGATIVE)
  else if (opts.context === 'image') negParts.push(IMAGE_NEGATIVE) // [FIX-2026-07-14 v2] 防性别/身份漂移
  const negativePrompt = [...new Set(negParts)].join(', ')

  // ─── 5. Parameters ───
  const parameters: GenerationPayload['parameters'] = {
    duration: gen.duration || shot.duration || 5,
    resolution: gen.resolution || '720p',
  }
  if (gen.seed != null) parameters.seed = gen.seed
  if (gen.generateAudio != null) parameters.generateAudio = gen.generateAudio
  if (gen.returnLastFrame != null) parameters.returnLastFrame = gen.returnLastFrame

  return {
    content,
    parameters,
    negativePrompt,
    previewText: finalPrompt,
  }
}

// Step 6: 生成预览 — 纯 UI 进度动画（非 API 调用）
const previewGenerating = ref(false)
const previewProgress = ref(0)
let _previewTimer: ReturnType<typeof setInterval> | null = null

/** 清除当前进度定时器 */
function clearPreviewTimer() {
  if (_previewTimer !== null) {
    clearInterval(_previewTimer)
    _previewTimer = null
  }
}

/** 基础预览动画：匀速进度条 0→100%，同时调用 generateText 生成第一镜头描述 */
async function startPreview() {
  if (previewGenerating.value) return
  clearPreviewTimer()
  previewGenerating.value = true
  previewProgress.value = 0

  const STEP = 2           // 每帧增长百分比
  const INTERVAL_MS = 80   // 帧间隔（ms）

  // 启动进度条动画（与 API 并行）
  _previewTimer = setInterval(() => {
    previewProgress.value = Math.min(previewProgress.value + STEP, 100)
    if (previewProgress.value >= 100) {
      clearPreviewTimer()
      previewGenerating.value = false
    }
  }, INTERVAL_MS)

  // 尝试调用 AI 生成第一个镜头描述（不阻塞进度条）
  try {
    const novelSnippet = uploadedText.value.trim().slice(0, 3000)
    if (novelSnippet.length > 20) {
      await generateText({
        systemPrompt: '你是一个专业的动画分镜脚本师。根据小说片段，用一句话描述第一个镜头的画面（50字以内），包括场景、角色和动作。',
        prompt: `小说片段：\n${novelSnippet}`,
        maxTokens: 200,
      })
    }
  } catch (err) {
    console.warn('[startPreview] generateText 调用失败，降级为纯进度动画:', err)
  }
}

// ── Step 5: 分镜编排系统 ──
const shots = ref<Shot[]>([])
const activeEpisode = ref(1)
const editingShotId = ref<string | null>(null)
const shotsGenerating = ref(false)
const shotsError = ref('')
const showPromptPreview = ref(false)
const promptPreviewOverride = ref('')  // 用户手动编辑的 prompt 覆盖

/** 计算当前编辑中镜头的结构化 prompt 预览 */
function getPromptPreview(shot: Shot): { prompt: string; negativePrompt: string } {
  const chars = getShotCharacterRefs(shot)
  const sceneRef = getShotSceneRef(shot)
  const sceneData = sceneRef ? { name: sceneRef.name, mood: sceneRef.mood } : undefined
  return buildShotPrompt(shot, chars, sceneData)
}

const episodeShots = computed(() =>
  shots.value.filter(s => {
    const ep = (s as any).episode ?? 1
    return ep === activeEpisode.value
  })
)

/** 当前集的分镜列表（v-model 用于 draggable 排序） */
const draggableEpisodeShots = computed<Shot[]>({
  get: () => episodeShots.value,
  set: (newOrder) => {
    if (shots.value.length === newOrder.length) {
      // 单集：直接替换
      shots.value = newOrder
    } else {
      // 多集：仅替换本集中的 shot，保持跨集顺序
      const result = [...shots.value]
      let eIdx = 0
      for (let i = 0; i < result.length; i++) {
        if (((result[i] as any).episode ?? 1) === activeEpisode.value) {
          if (eIdx < newOrder.length) result[i] = newOrder[eIdx++]!
        }
      }
      shots.value = result
    }
  }
})

/** 拖拽排序结束后重建全局 index */
function onShotDragEnd() {
  shots.value.forEach((s, i) => { s.index = i + 1 })
}

const episodeTabs = computed(() =>
  Array.from({ length: episodeCount.value }, (_, i) => i + 1)
)

function getShotCharacterRefs(shot: Shot): CharAppearance[] {
  if (!shot.characterArchetypes?.length) return []
  return shot.characterArchetypes
    .map(id => characterAppearances.value.find(c => String(c.id) === id))
    .filter((c): c is CharAppearance => !!c)
}

function getShotSceneRef(shot: Shot): (typeof extractedScenes.value)[0] | undefined {
  if (!shot.sceneTemplate) return undefined
  return extractedScenes.value.find(s => s.name === shot.sceneTemplate)
}

/**
 * 根据镜头景别选择最佳场景视角图片
 * 远景/定场 → 全景(wide)，中景 → 俯瞰(high)，特写 → 细节(detail)
 */
function getSceneViewForShot(shot: Shot, scene: { imageUrl?: string; views?: Array<{ angle: string; imageUrl: string }> }): string | undefined {
  if (!scene.views?.length) return scene.imageUrl

  const shotType = shot.shotType || shot.generation?.shotType || 'medium'
  const angleMap: Record<string, string> = {
    'establishing': 'wide',
    'wide': 'wide',
    'medium': 'high',
    'close': 'detail',
  }
  const preferredAngle = angleMap[shotType] || 'wide'

  // 优先用匹配的视角，fallback 到全景，再 fallback 到 scene.imageUrl
  const view = scene.views.find(v => v.angle === preferredAngle)
    || scene.views.find(v => v.angle === 'wide')
    || scene.views[0]
  return view?.imageUrl || scene.imageUrl
}

/** 解析 shot.description 中的 [pic]@XXX 引用，返回 { url, label } 数组 */
function resolveShotPicRefs(shot: Shot): Array<{ url: string; label: string }> {
  const results: Array<{ url: string; label: string }> = []
  const desc = shot.description || ''
  const refUrls = (shot as any)._refImageUrls as Record<string, string> | undefined
  // 匹配 [pic]@xxx 模式
  const picRegex = /\[pic\]@([^\s，。,.\]]+)/g
  let match: RegExpExecArray | null
  while ((match = picRegex.exec(desc)) !== null) {
    const ref = match[1]
    // 1. 检查是否为 图片N (数字编号 → _refImageUrls)
    const numMatch = ref.match(/^图片(\d+)$/)
    if (numMatch && refUrls) {
      const idx = numMatch[1]
      if (refUrls[idx]) {
        results.push({ url: refUrls[idx], label: `图片${idx}` })
        continue
      }
    }
    // 2. 检查是否为角色名
    const char = characterAppearances.value.find(c => {
      const shortName = c.name.replace(/^[^·]+·/, '')
      return c.name === ref || shortName === ref
    })
    if (char) {
      const outfit = char.outfits?.[0]
      const frontView = outfit?.views?.find(v => v.key === 'front-upper')
      if (frontView?.imageUrl) {
        results.push({ url: frontView.imageUrl, label: char.name })
      }
      continue
    }
    // 3. 检查是否为场景名
    const scene = extractedScenes.value.find(s => s.name === ref)
    if (scene?.imageUrl) {
      results.push({ url: scene.imageUrl, label: scene.name })
    }
  }
  return results
}

/** 获取镜头的参考图缩略图 URL 列表（角色卡+场景图+额外生成的参考图） */
function getShotRefThumbs(shot: Shot): string[] {
  const thumbs: string[] = []
  // 角色卡
  for (const c of getShotCharacterRefs(shot)) {
    const outfit = getShotOutfitForChar(shot, c)
    const frontView = outfit.views.find(v => v.key === 'front-upper')
    if (frontView?.imageUrl) thumbs.push(frontView.imageUrl)
  }
  // 场景图
  const scene = getShotSceneRef(shot)
  if (scene?.imageUrl) thumbs.push(scene.imageUrl)
  // 额外生成的参考图
  const refUrls = (shot as any)._refImageUrls as Record<string, string> | undefined
  if (refUrls) {
    for (const url of Object.values(refUrls)) {
      if (url && !thumbs.includes(url)) thumbs.push(url)
    }
  }
  return thumbs.slice(0, 6) // 最多显示6个缩略图
}

function updateShot(shotId: string, field: string, value: any) {
  const shot = shots.value.find(s => s.id === shotId)
  if (shot) {
    (shot as any)[field] = value
    shot.updatedAt = Date.now()
  }
}

/** 模板引用：自定义参考图 URL 输入框 */
const customRefInput = ref<HTMLInputElement | null>(null)

/** 更新 Shot.generation 子对象的某个字段（响应式安全） */
function updateShotGeneration(shotId: string, field: string, value: any) {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  if (!shot.generation) shot.generation = {}
  ;(shot.generation as any)[field] = value
  shot.updatedAt = Date.now()
}

/** 添加自定义参考图 URL 到 Shot.generation.referenceImages */
function addCustomRefImage(shot: Shot, inputEl: HTMLInputElement) {
  const url = inputEl.value.trim()
  if (!url) return
  if (!shot.generation) shot.generation = {}
  if (!shot.generation.referenceImages) shot.generation.referenceImages = []
  if (shot.generation.referenceImages.length >= 9) {
    alert('参考图最多 9 张')
    return
  }
  shot.generation.referenceImages.push({
    url,
    role: 'reference_image',
    label: url.split('/').pop()?.slice(0, 20) || '自定义参考图',
    sourceType: 'custom',
  })
  inputEl.value = ''
  shot.updatedAt = Date.now()
}

/** 删除 Shot.generation.referenceImages 中指定索引的参考图 */
function removeCustomRefImage(shot: Shot, index: number) {
  if (!shot.generation?.referenceImages) return
  shot.generation.referenceImages.splice(index, 1)
  if (shot.generation.referenceImages.length === 0) {
    delete shot.generation.referenceImages
  }
  shot.updatedAt = Date.now()
}

// ── 分镜版本历史（最多保留 5 个快照） ──
interface ShotSnapshot {
  timestamp: number
  label: string
  shots: Shot[]
}
const shotHistory = ref<ShotSnapshot[]>([])
const showShotHistory = ref(false)

function saveShotSnapshot(label: string) {
  if (shots.value.length === 0) return
  const snapshot: ShotSnapshot = {
    timestamp: Date.now(),
    label,
    shots: JSON.parse(JSON.stringify(shots.value)),
  }
  shotHistory.value = [snapshot, ...shotHistory.value].slice(0, 5)
  try {
    sessionStorage.setItem(HISTORY_KEY_SB, JSON.stringify(shotHistory.value))
  } catch { /* ignore quota errors */ }
}

function restoreShotSnapshot(index: number) {
  const snap = shotHistory.value[index]
  if (!snap) return
  const ts = new Date(snap.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const ok = window.confirm(`恢复到版本「${snap.label}」（${ts}，共 ${snap.shots.length} 个分镜）？\n\n当前分镜将被保存为新快照后覆盖。`)
  if (!ok) return
  saveShotSnapshot('恢复前备份')
  shots.value = JSON.parse(JSON.stringify(snap.shots))
  shots.value.forEach((s, i) => { s.index = i + 1 })
  // 级联清空下游状态
  shotPreviewUrls.value = new Map()
  shotVideoUrls.value = new Map()
  shotPreviewErrors.value = new Map()
  shotVideoErrors.value = new Map()
  composedVideoUrl.value = null
  enhancedVideoUrl.value = null
  finalVideoUrl.value = null
  dubSegments.value = []
}

function deleteShot(shotId: string) {
  // 删除前自动保存快照
  saveShotSnapshot(`删除前（共 ${shots.value.length} 镜）`)
  // [状态联动] 删除镜头时，清除其预览/视频，并级联失效合成结果
  const hadVideo = shotVideoUrls.value.has(shotId)
  shotPreviewUrls.value.delete(shotId)
  shotPreviewUrls.value = new Map(shotPreviewUrls.value)
  shotPreviewErrors.value.delete(shotId)
  shotPreviewErrors.value = new Map(shotPreviewErrors.value)
  shotVideoErrors.value.delete(shotId)
  shotVideoErrors.value = new Map(shotVideoErrors.value)
  shotVideoUrls.value.delete(shotId)
  shotVideoUrls.value = new Map(shotVideoUrls.value)
  if (hadVideo) {
    // 合成产物失效
    composedVideoUrl.value = null
    enhancedVideoUrl.value = null
    finalVideoUrl.value = null
  }
  shots.value = shots.value.filter(s => s.id !== shotId)
  if (editingShotId.value === shotId) editingShotId.value = null
  // Re-index remaining shots to prevent gaps in chain lookups
  shots.value.forEach((s, i) => { s.index = i + 1 })
}

function insertShot(afterId: string) {
  const idx = shots.value.findIndex(s => s.id === afterId)
  if (idx === -1) return
  const afterShot = shots.value[idx]!
  const now = Date.now()
  const newShot: Shot = {
    id: `shot-${now}-${Math.random().toString(36).slice(2, 6)}`,
    index: afterShot.index + 1,
    title: '新镜头',
    status: 'draft',
    duration: 4,
    description: '',
    characterArchetypes: [],
    sceneTemplate: afterShot.sceneTemplate,
    shotType: 'medium',
    cameraMove: 'static',
    dialogue: '',
    createdAt: now,
    updatedAt: now,
  }
  shots.value.splice(idx + 1, 0, newShot)
  // Re-index
  shots.value.forEach((s, i) => { s.index = i + 1 })
  editingShotId.value = newShot.id
}

/** 2A: 一键在指定镜头后插入一个反应镜头（继承场景/角色） */
function insertReactionShot(shotId: string) {
  const idx = shots.value.findIndex(s => s.id === shotId)
  if (idx === -1) return
  const srcShot = shots.value[idx]!
  const now = Date.now()
  const reactionShot: Shot = {
    id: `shot-${now}-react`,
    index: srcShot.index + 1,
    title: `反应（#${srcShot.index}）`,
    status: 'scripted' as const,
    duration: 3,
    description: '',
    characterArchetypes: [...(srcShot.characterArchetypes || [])],
    sceneTemplate: srcShot.sceneTemplate,
    shotType: 'close',
    cameraMove: 'static',
    transition: 'cut',
    dialogue: '',
    narration: '',
    sfx: '',
    note: '',
    microExpression: '',
    positioning: '',
    spatialAnchor: '',
    createdAt: now,
    updatedAt: now,
    isReactionShot: true,
    dialogueRole: 'reaction',
    dialogueGroupId: srcShot.dialogueGroupId,
    generation: { duration: 3, resolution: '720p' },
    episode: (srcShot as any).episode ?? 1,
  } as any
  shots.value.splice(idx + 1, 0, reactionShot)
  shots.value.forEach((s, i) => { s.index = i + 1 })
  // 移除对应建议
  dialogueSuggestions.value = dialogueSuggestions.value.filter(sg => sg.shotId !== shotId)
}

async function generateShots() {
  if (shotsGenerating.value) return
  // 如果已有分镜数据，确认后再覆盖
  if (shots.value.length > 0) {
    const ok = window.confirm(`当前已有 ${shots.value.length} 个分镜，重新生成将覆盖所有已编辑的提示词和设置，确定继续吗？`)
    if (!ok) return
    // 重新生成前保存当前分镜快照
    saveShotSnapshot(`AI 生成前（共 ${shots.value.length} 镜）`)
  }
  shotsGenerating.value = true
  shotsError.value = ''

  // [生成逻辑 B10] 角色列表注入完整视觉描述（外貌+服装+标签），而非仅 name(role)
  const charDescLines = characterAppearances.value.map(c => {
    const shortName = c.name.replace(/^[^·]+·/, '')
    const activeOutfit = c.outfits?.find(o => o.id === c.activeOutfitId) || c.outfits?.[0]
    const outfitDesc = activeOutfit
      ? `【造型：${activeOutfit.name}${activeOutfit.description ? `，${activeOutfit.description}` : ''}${activeOutfit.tags?.length ? `，标签：${activeOutfit.tags.join('/')}` : ''}】`
      : ''
    const charTags = c.tags?.length ? `特征：${c.tags.join('/')}` : ''
    const desc = c.description ? `，${c.description.slice(0, 80)}` : ''
    return `${shortName}（${c.role}${desc}${charTags ? '，' + charTags : ''}）${outfitDesc}`
  })
  const charNames = charDescLines.join('\n')
  const sceneNames = extractedScenes.value.map(s => `${s.name}(${s.mood || ''}, ${s.timeOfDay || ''}, ${s.environmentDesc || ''})`).join('\n')

  // 列出已有的参考图（角色卡+场景图）
  const existingRefs: string[] = []
  for (const c of characterAppearances.value) {
    const shortName = c.name.replace(/^[^·]+·/, '')
    const defaultOutfit = c.outfits?.[0]
    const frontView = defaultOutfit?.views?.find((v: any) => v.key === 'front-upper')
    if (frontView?.imageUrl) existingRefs.push(`[已有] 角色卡 ${shortName}（${defaultOutfit?.name || '默认造型'}）`)
  }
  for (const s of extractedScenes.value) {
    if (s.imageUrl) existingRefs.push(`[已有] 场景图 ${s.name}`)
  }

  // [P1] 自动生成全局制作规范（非阻断：失败回退为空，不阻断分镜生成）
  let gd: GlobalDirective | null = null
  try {
    gd = await generateGlobalDirective()
    if (gd) {
      globalDirective.value = gd
      globalDirectiveAnchor.value = gd.anchor
    }
  } catch (e) {
    console.warn('[全局规范] 生成异常，跳过:', e)
  }

  const prompt = `你是一位顶级电影分镜导演，精通镜头语言、节奏控制和视觉叙事。将以下小说文本拆分为专业分镜列表。

【绝对铁则 - 连续性约束】
全部分镜必须严格遵循连续时空逻辑：
- 同一场景同一时间线内，前序分镜已确定的人物在场状态、肢体姿态、手持/随身道具、场景布局，在后续分镜中必须100%连贯承接
- 无明确剧情交代与完整动作过渡，禁止人物无故消失/瞬移、姿态无逻辑跳变、道具凭空消失/出现
- 同一场景内光照方向、色调、天气必须保持一致

【导演思维】
像真正的电影一样思考：
- 节奏变化：紧张场景用短镜头快切(2-3秒)，对话场景正常(3-4秒)，抒情场景最长(4-5秒)，避免超过5秒
- 景别交替：远景建立环境→中景推进动作→特写捕捉情绪→远景收束，不要连续用同一景别
- 运镜原则：一个镜头以 1 种【主运镜】为主（可叠加至多 1 段过渡运镜），不要同时推拉摇移；动作描述必须【肢体细化+程度量化】（如"缓缓抬手至胸口""猛地转身挥剑""用力蹬地跃起"），优先低缓连续小动作
- 转场设计：根据场景情绪选择转场（硬切=紧张快节奏、叠化=时间流逝、淡入黑=段落结束、甩镜=快速转场）
- 动作节奏：打斗/逃跑用快速，对话/回忆用正常，情感高潮可慢动作，突发事件用骤变
- 场景一致性：同一场景内的多个镜头应保持一致的色调、光照方向和时间段
- 换装转场：如果同一角色在相邻镜头中换了造型（服装不同），转场必须用dissolve或fade-black

【基本参数】
- 总共 ${episodeCount.value} 集，每集约 ${episodeDurationMin.value} 分钟
- 每个镜头 2-5 秒
- 每个镜头的 prompt 必须是中文自然语言描述，必须包含：景别(远景/中景/特写)、镜头运动、画面内容、角色动作表情(肢体+程度量化)、对白、参考图片引用
- 图片引用格式：[pic]@图片N （N是从1开始的编号）
- 已有的角色卡和场景图可以直接引用（用角色名或场景名），例如：[pic]@林启、[pic]@考古工地
- 如果需要额外的构图参考（如特定姿势、表情、画面构图），用 [pic]@图片N 并在 referenceNeeds 中描述
- 对白用中文双引号："对白内容"

【已有参考图】
${existingRefs.length > 0 ? existingRefs.join('\n') : '无'}

${gd?.anchor ? `【全局制作规范（本剧每一镜头都必须严格遵循，不可偏离）】\n${gd.anchor}\n` : ''}
【角色列表】
${charNames || '无'}

【场景列表（含环境描述）】
${sceneNames || '无'}

${worldviewContext.value ? `【世界观背景】\n${worldviewContext.value}\n` : ''}

【小说文本（已压缩：优先保留关键台词与开头背景，避免 prompt 过长）】
${compressNarrative(uploadedText.value, 4500)}

输出 JSON 数组，每个元素格式：
{
  "episode": 1,
  "timeRange": "0-3秒",
  "title": "裂隙初现",
  "prompt": "远景，镜头缓慢推进，[pic]@考古工地全景，夕阳余晖洒在探方上。突然地面开始轻微颤动，碎石滚落。[pic]@林启警觉地抬头环顾四周。",
  "characterNames": ["林启"],
  "sceneName": "考古工地",
  "duration": 3,
  "shotType": "wide",
  "cameraMove": "dolly",
  "cameraViewAngle": "平视",
  "cameraActions": [
    {"move": "dolly", "speed": "slow", "durationRatio": 0.6, "description": "缓推向考古工地"},
    {"move": "static", "speed": "normal", "durationRatio": 0.4, "description": "停顿捕捉地面颤动"}
  ],
  "microExpression": "眼神骤然收紧，瞳孔微缩，嘴角紧抿",
  "positioning": "林启位于画面右侧三分之一处，面朝左前方",
  "spatialAnchor": "探方边缘的裂缝、远处废墟的剪影、散落的考古工具",
  "transition": "smash-cut",
  "pacing": "suspenseful",
  "actionSpeed": "gradual",
  "actionIntensity": "action",
  "dialogue": "这是……什么声音？",
  "referenceNeeds": [
    {"index": 1, "label": "考古工地夕阳光", "prompt": "Ancient archaeological excavation site at golden hour, warm sunset light, scattered tools and trenches, dramatic sky"}
  ]
}

字段说明：
- episode：集数
- timeRange：时间范围
- title：简短镜头标题（2-6字）
- prompt：中文Seedance风格提示词，包含[pic]@图片N引用。要具体描述画面内容、角色动作、表情、环境
- characterNames：出场角色名列表
- sceneName：场景名
- duration：时长(2-5秒)
- shotType：景别(对应手册"景别") "establishing"|"wide"|"medium"|"close"，每镜头必标注且景别应交替变化
- cameraMove：主运镜 "static"|"pan"|"tilt"|"dolly"|"tracking"|"zoom-in"|"zoom-out"|"crane"|"handheld"
- cameraViewAngle：拍摄角度 "平视"|"俯视"|"仰视"|"鸟瞰"|"倾斜"，从以下选一个
- cameraActions：多段运镜组合（2-3段）
- microExpression：微表情描述 - 角色面部细节（眼神变化、嘴角弧度、眉头动作），必须具体直观，可直接用于AI生成
- positioning：站位描述 - 角色在画面中的位置关系（如"画面左侧""中央偏右""两人面对面"），确保连续性
- spatialAnchor：空间锚点 - 场景中可见的固定参照物（如"石桌""窗框""探方边缘"），确保同一场景的多个镜头空间连贯
- transition：与下一镜头的转场方式 "cut"|"dissolve"|"fade-black"|"fade-white"|"whip-pan"|"match-cut"|"smash-cut"
- pacing：节奏基调 "tense"|"calm"|"explosive"|"melancholic"|"suspenseful"|"comedic"|"romantic"|"epic"
- actionSpeed：角色动作速度 "slow-motion"|"normal"|"fast"|"sudden"|"gradual"
- actionIntensity：动作强度 "calm"(文戏)|"normal"(通用)|"action"(武戏)，武戏会注入"运镜跟随动作节奏、攻防转换切机位"指令
- dialogue：对白（可选）
- referenceNeeds：额外参考图需求

【重要JSON格式要求】
- 字符串值内禁止使用双引号，对白用单引号表示
- 字符串值内禁止换行
- 不要有尾逗号
- 确保输出是合法的 JSON 数组

【输出规模】
- 镜头总数量控制在 15-20 个之间，确保每个镜头 JSON 完整闭合、可被程序解析
- 不要为了凑集数而缩减单镜头信息；宁可少而完整，也不要多而截断

只输出 JSON 数组，不要其他文字。`

  try {
    const result = await generateText({ prompt, maxTokens: 24000, model: 'v4-pro' })

    // 使用通用 AI JSON 解析容错
    const parsed: Array<{
      episode?: number; timeRange?: string; title?: string; prompt?: string
      characterNames?: string[]; sceneName?: string; duration?: number
      shotType?: string; cameraMove?: string; cameraViewAngle?: string
      cameraActions?: Array<{ move: string; speed?: string; durationRatio?: number; description?: string }>
      microExpression?: string; positioning?: string; spatialAnchor?: string
      transition?: string; pacing?: string; actionSpeed?: string; actionIntensity?: string
      dialogue?: string
      referenceNeeds?: Array<{ index: number; label: string; prompt: string }>
    }> = parseAIJson(result)

    if (Array.isArray(parsed) && parsed.length > 0) {
      const now = Date.now()
      shots.value = parsed.map((item, i) => {
        // Map character names to IDs
        const charIds = (item.characterNames || [])
          .map(name => {
            const found = characterAppearances.value.find(c =>
              c.name === name || c.name.includes(name) || name.includes(c.name.replace(/^[^·]+·/, ''))
            )
            return found ? String(found.id) : null
          })
          .filter((id): id is string => !!id)

        // Map cameraActions to proper CameraAction[]
        const camActions: CameraAction[] = (item.cameraActions || [])
          .filter(a => a.move)
          .map(a => ({
            move: a.move,
            speed: (a.speed as 'slow' | 'normal' | 'fast') || 'normal',
            durationRatio: a.durationRatio || undefined,
            description: a.description || undefined,
          }))

        return {
          id: `shot-${now}-${i.toString().padStart(3, '0')}`,
          index: i + 1,
          title: item.title || `镜头 ${i + 1}`,
          status: 'scripted' as const,
          duration: item.duration || 4,
          description: item.prompt || item.title || '',
          characterArchetypes: charIds,
          sceneTemplate: item.sceneName || undefined,
          shotType: item.shotType || 'medium',
          cameraMove: item.cameraMove || (camActions.length > 0 ? camActions[0]!.move : 'static'),
          cameraViewAngle: item.cameraViewAngle || '平视',
          dialogue: item.dialogue || '',
          narration: '',
          sfx: '',
          note: '',
          microExpression: item.microExpression || '',
          positioning: item.positioning || '',
          spatialAnchor: item.spatialAnchor || '',
          transition: (item.transition as Shot['transition']) || 'cut',
          pacing: (item.pacing as Shot['pacing']) || undefined,
          actionSpeed: (item.actionSpeed as Shot['actionSpeed']) || 'normal',
          shotSize: item.shotType || 'medium',
          globalDirective: gd?.anchor || undefined,
          actionIntensity: (item.actionIntensity as Shot['actionIntensity']) || undefined,
          generation: {
            duration: item.duration || 4,
            resolution: '720p',
            cameraActions: camActions.length > 0 ? camActions : undefined,
            shotType: item.shotType || 'medium',
          },
          createdAt: now,
          updatedAt: now,
          episode: item.episode || 1,
          _timeRange: item.timeRange || `0-${item.duration || 4}秒`,
          _referenceNeeds: item.referenceNeeds || [],
        } as Shot & { episode: number; _timeRange: string; _referenceNeeds: Array<{ index: number; label: string; prompt: string }> }
      })

      // [状态联动] 重新生成分镜后，清空所有下游状态（预览图/视频/合成/增强/配音/导出）
      shotPreviewUrls.value = new Map()
      shotVideoUrls.value = new Map()
      shotPreviewErrors.value = new Map()
      shotVideoErrors.value = new Map()
      shotSatisfaction.value = new Map()
      composedVideoUrl.value = null
      enhancedVideoUrl.value = null
      finalVideoUrl.value = null
      dubSegments.value = []

      // 收集所有需要生成的参考图（去重）
      const allRefNeeds: Array<{ index: number; label: string; prompt: string; shotIds: string[] }> = []
      const refByKey = new Map<string, typeof allRefNeeds[0]>()
      for (const shot of shots.value) {
        const needs = (shot as any)._referenceNeeds as Array<{ index: number; label: string; prompt: string }>
        for (const need of needs) {
          const key = need.prompt.slice(0, 80)
          if (refByKey.has(key)) {
            refByKey.get(key)!.shotIds.push(shot.id)
          } else {
            const entry = { ...need, shotIds: [shot.id] }
            refByKey.set(key, entry)
            allRefNeeds.push(entry)
          }
        }
      }

      // 批量生成参考图
      if (allRefNeeds.length > 0) {
        const shotRefUrls = new Map<string, Map<number, string>>() // shotId → { picIndex → url }
        for (const ref of allRefNeeds) {
          try {
            const urls = await generateImage({ prompt: ref.prompt, size: '1024x1024' as any, n: 1, seed: Math.floor(Math.random() * 2147483647), negativePrompt: 'blurry, low quality, watermark, text, deformed' })
            if (urls && urls.length > 0) {
              for (const sid of ref.shotIds) {
                if (!shotRefUrls.has(sid)) shotRefUrls.set(sid, new Map())
                shotRefUrls.get(sid)!.set(ref.index, urls[0])
              }
            }
          } catch (e) {
            console.warn('[参考图生成] 失败:', ref.label, e)
          }
        }
        // 存储到 shot 上
        for (const shot of shots.value) {
          const urls = shotRefUrls.get(shot.id)
          if (urls) {
            (shot as any)._refImageUrls = Object.fromEntries(urls)
          }
        }
      }

      // [性能优化 B9] 异步自动批量生成预览，并发限制 3 个
      setTimeout(async () => {
        const shotsNeedPreview = shots.value.filter(
          s => !shotPreviewUrls.value.has(s.id) && !shotPreviewGenerating.value.has(s.id)
        )
        const PREVIEW_CONCURRENCY = 2 // [FIX-2026-07-14] 从3降到2，减少并发限流概率（第4镜等单镜失败的主因之一）
        let pidx = 0
        const pworker = async () => {
          while (pidx < shotsNeedPreview.length) {
            const s = shotsNeedPreview[pidx++]
            if (!s) break
            await generateShotPreview(s)
          }
        }
        await Promise.all(Array.from({ length: Math.min(PREVIEW_CONCURRENCY, shotsNeedPreview.length) }, pworker))
      }, 500)

      // [生成逻辑 B13] 分镜质量校验：景别多样性 + 时长合理性
      const qcWarnings: string[] = []
      const shotTypes = shots.value.map(s => s.shotType).filter(Boolean)
      const uniqueShotTypes = new Set(shotTypes)
      if (shots.value.length >= 5 && uniqueShotTypes.size <= 1) {
        qcWarnings.push(`⚠️ 景别单一（全部为 ${[...uniqueShotTypes][0]}），建议多种景别交替使用`)
      }
      const outRangeDurations = shots.value.filter(s => s.duration < 2 || s.duration > 8)
      if (outRangeDurations.length > 0) {
        qcWarnings.push(`⚠️ ${outRangeDurations.length} 个镜头时长超出合理范围（2-8秒）`)
      }
      // 检查连续 3 个相同运镜
      for (let qi = 0; qi <= shots.value.length - 3; qi++) {
        const [a, b, c] = [shots.value[qi]?.cameraMove, shots.value[qi + 1]?.cameraMove, shots.value[qi + 2]?.cameraMove]
        if (a && a === b && b === c) {
          qcWarnings.push(`⚠️ 连续 3+ 个镜头运镜相同（${a}），建议增加变化`)
          break
        }
      }
      if (qcWarnings.length > 0) {
        console.warn('[分镜质量校验]', qcWarnings)
        shotsError.value = qcWarnings.join('\n')
        // 不阻断流程，仅作警告
        setTimeout(() => { if (shotsError.value === qcWarnings.join('\n')) shotsError.value = '' }, 8000)
      }
      // 生成成功后保存快照
      saveShotSnapshot(`AI 生成（共 ${shots.value.length} 镜）`)
      // 2A: 校验对白长度，生成反应镜头建议
      dialogueSuggestions.value = validateDialogueLength(shots.value)
    }
    markCompleted(4) // storyboard step index
  } catch (e: any) {
    console.warn('[分镜生成] 失败:', e)
    const msg = e?.message || '未知错误'
    const status = e?.response?.status || e?.status || 0
    if (status === 500 || status === 502 || msg.includes('500') || msg.includes('502')) {
      shotsError.value = 'AI 分镜生成失败：AI 服务不可用。请检查：1) ai-router 服务是否已启动；2) 是否已配置有效的 BYOK API 密钥（DeepSeek 等）；3) API 密钥余额是否充足。'
    } else if (status === 401 || msg.includes('401')) {
      shotsError.value = 'AI 分镜生成失败：认证失败，请重新登录。'
    } else if (status === 429 || msg.includes('429')) {
      shotsError.value = 'AI 分镜生成失败：请求过于频繁，请稍后再试。'
    } else if (msg.includes('timeout') || msg.includes('Timeout')) {
      shotsError.value = 'AI 分镜生成失败：请求超时，AI 服务响应过慢，请稍后重试。'
    } else {
      shotsError.value = `AI 分镜生成失败：${msg}`
    }
  } finally {
    shotsGenerating.value = false
  }
}

// 场景种子共享 — 同场景的所有镜头使用相同 seed，提升色调/光照一致性
const sceneSeeds = ref<Map<string, number>>(new Map())
function getSceneSeed(sceneName?: string): number {
  if (!sceneName) return Math.floor(Math.random() * 2147483647)
  if (!sceneSeeds.value.has(sceneName)) {
    sceneSeeds.value.set(sceneName, Math.floor(Math.random() * 2147483647))
    sceneSeeds.value = new Map(sceneSeeds.value)
  }
  return sceneSeeds.value.get(sceneName)!
}

// 单镜头预览图生成
const shotPreviewUrls = ref<Map<string, string>>(new Map())
const shotPreviewGenerating = ref<Set<string>>(new Set())
const shotPreviewErrors = ref<Map<string, string>>(new Map())
// [功能补全 4.1] 预览图 URL 过期检测：img @error 触发时标记为过期
const expiredPreviewIds = ref<Set<string>>(new Set())
function handleShotPreviewExpired(shotId: string) {
  const next = new Set(expiredPreviewIds.value)
  next.add(shotId)
  expiredPreviewIds.value = next
  // 从 Map 中移除过期 URL，触发重新生成按钮显示
  shotPreviewUrls.value.delete(shotId)
  shotPreviewUrls.value = new Map(shotPreviewUrls.value)
}

async function generateShotPreview(shot: Shot) {
  if (shotPreviewGenerating.value.has(shot.id)) return
  console.log('[分镜预览] 开始生成 shot:', shot.id, shot.title)
  shotPreviewErrors.value.delete(shot.id)
  shotPreviewErrors.value = new Map(shotPreviewErrors.value)
  shotPreviewGenerating.value.add(shot.id)
  shotPreviewGenerating.value = new Set(shotPreviewGenerating.value)

  try {
    const chars = getShotCharacterRefs(shot)
    const sceneRef = getShotSceneRef(shot)
    const sceneData = sceneRef ? { name: sceneRef.name, mood: sceneRef.mood, imageUrl: sceneRef.imageUrl } : undefined

    // 使用统一构建器（包含光照、镜头、运镜、角色造型、对话、参考素材）
    const payload = buildContentArray(shot, {
      context: 'image',
      characters: chars,
      scene: sceneData,
      editedPrompt: promptPreviewOverride.value || undefined,
    })

    // 从 content 数组提取参考图 URL（用于 generateImage API）
    // [FIX-2026-07-14] 校验 URL 合法性，剔除空值/非 http URL，避免无效参考图导致生成失败（如第4镜）
    const rawRefUrls = payload.content
      .filter(c => c.role === 'reference_image')
      .map(c => (c.image_url as { url: string })?.url)
    const refImageUrls = rawRefUrls.filter((url): url is string =>
      !!url && /^https?:\/\//.test(url)
    )
    if (rawRefUrls.length > refImageUrls.length) {
      console.warn(`[分镜预览] shot ${shot.id}: 剔除 ${rawRefUrls.length - refImageUrls.length} 个无效参考图URL`)
    }

    const aspectSize = selectedAspect.value === '9:16' ? '1024x1536'
      : selectedAspect.value === '1:1' ? '1024x1024'
      : '1792x1024'

    // [AGNES-OPTIMAL-2026-07-14] 预览使用 Agnes img2img 最优投法（仅大头照底图）
    // 背景：一致性引擎(flux-kontext-pro)走 Replicate → 用户无余额(402)。
    // Agnes 走 apihub.agnes-ai.com → 用户 HappyHorse $10 余额可用。
    // 策略：只投1张大头照做 img2img 底图（多图=噪声），配合 v3 身份锚点 prompt 最大化相似度。
    const charRefs = collectCharacterRefImages(shot, chars)
    const headshot = charRefs[0] // front-upper 大头照（面部最清晰的参考图）
    console.log(`[分镜预览] shot ${shot.id}: headshot=${headshot ? 'yes' : 'no'}, allRefs=${refImageUrls.length}`)

    let urls: string[] | undefined
    let lastError: any = null

    // ── 主路径：Agnes img2img（仅 1 张大头照做底图）──
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        urls = await generateImage({
          prompt: payload.previewText,
          size: aspectSize as any,
          n: 1,
          // [核心] 只投大头照！多图(img2img)会互相打架→人脸糊。单张大头照=最清晰面部基底
          referenceImages: headshot ? [headshot] : undefined,
          negativePrompt: payload.negativePrompt,
          useByok: useByok.value,
        })
        if (urls && urls.length > 0) {
          console.log(`[分镜预览] shot ${shot.id}: ✅ Agnes img2img 成功 (attempt ${attempt + 1}, headshot=${!!headshot})`)
          break
        }
        if (attempt === 0) { lastError = new Error('AI 未返回图片'); continue }
      } catch (err: any) {
        const status = err?.response?.status || err?.status || 0
        const errMsg = err?.message || ''
        console.error(`[分镜预览] shot ${shot.id} Agnes 失败 [${attempt + 1}/2] status=${status}: ${errMsg}`)
        const isRetryable = status === 429 || status === 502 || status === 503
          || /timeout|Timeout|rate\.limit|too many requests/i.test(errMsg)
        if (attempt === 0 && isRetryable) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        lastError = err
        break
      }
    }

    // ── 保底：大头照失败时，用全部参考图再试 ──
    if (!urls || urls.length === 0) {
      try {
        console.warn(`[分镜预览] shot ${shot.id}: 保底 → 全部参考图 (${refImageUrls.length}张)`)
        urls = await generateImage({
          prompt: payload.previewText,
          size: aspectSize as any,
          n: 1,
          referenceImages: refImageUrls.length ? refImageUrls : undefined,
          negativePrompt: payload.negativePrompt,
          useByok: useByok.value,
        })
        console.log(`[分镜预览] shot ${shot.id}: ✅ 保底成功`)
      } catch (fbErr: any) {
        const fbStatus = fbErr?.response?.status || fbErr?.status || 0
        console.error(`[分镜预览] shot ${shot.id}: 保底也失败 (${fbStatus})`)
        lastError = fbErr
      }
    }
    if (urls && urls.length > 0) {
      shotPreviewUrls.value.set(shot.id, urls[0]!)
      shotPreviewUrls.value = new Map(shotPreviewUrls.value)
      console.log('[分镜预览] 生成成功 shot:', shot.id)
    } else {
      // 构建详细的错误消息（包含根因）供 UI 显示
      const rootCause = lastError
      const rcStatus = rootCause?.response?.status || rootCause?.status || '?'
      const rcMsg = rootCause?.message || '未知错误'
      const rcData = rootCause?.response?.data
        ? (typeof rootCause.response.data === 'string' ? rootCause.response.data : JSON.stringify(rootCause.response.data)).slice(0, 200)
        : ''
      const detailMsg = rcData
        ? `生成失败(${rcStatus}): ${rcMsg} — ${rcData}`
        : `生成失败(${rcStatus}): ${rcMsg}`
      console.error(`[分镜预览] shot ${shot.id} 最终失败:`, detailMsg, '| rootCause:', rootCause)
      throw new Error(detailMsg)
    }
  } catch (e: any) {
    const msg = e?.message || '生成失败，请重试'
    console.warn('[分镜预览] 生成失败:', e)
    shotPreviewErrors.value.set(shot.id, msg)
    shotPreviewErrors.value = new Map(shotPreviewErrors.value)
  } finally {
    shotPreviewGenerating.value.delete(shot.id)
    shotPreviewGenerating.value = new Set(shotPreviewGenerating.value)
  }
}

const batchPreviewCancelled = ref(false)
async function generateAllShotPreviews() {
  batchPreviewCancelled.value = false
  const epShots = episodeShots.value
  for (const shot of epShots) {
    if (batchPreviewCancelled.value) break
    // [UX改进 B14] 跳过已锁定的镜头
    if (lockedShots.value.has(shot.id)) continue
    if (!shotPreviewUrls.value.has(shot.id)) {
      await generateShotPreview(shot)
    }
  }
}
function cancelBatchPreviewGeneration() {
  batchPreviewCancelled.value = true
}

// ── Step 7: 渐进式预览 ──
// [UX改进 7.3] 分镜幻灯片预览：按分镜 duration 自动轮播
const slideshowActive = ref(false)
const slideshowShotIdx = ref(0)
let _slideshowTimer: ReturnType<typeof setTimeout> | null = null

function startSlideshow() {
  const shotsWithPreview = episodeShots.value.filter(s => shotPreviewUrls.value.has(s.id))
  if (shotsWithPreview.length === 0) return
  slideshowActive.value = true
  slideshowShotIdx.value = 0
  _slideshowAdvance(shotsWithPreview)
}

function _slideshowAdvance(shotsWithPreview: typeof episodeShots.value) {
  if (!slideshowActive.value || slideshowShotIdx.value >= shotsWithPreview.length) {
    stopSlideshow()
    return
  }
  const shot = shotsWithPreview[slideshowShotIdx.value]!
  editingShotId.value = shot.id
  _slideshowTimer = setTimeout(() => {
    slideshowShotIdx.value++
    _slideshowAdvance(shotsWithPreview)
  }, (shot.duration || 4) * 1000)
}

function stopSlideshow() {
  slideshowActive.value = false
  if (_slideshowTimer) { clearTimeout(_slideshowTimer); _slideshowTimer = null }
}
const previewMode = ref<'firstframe' | 'perShot' | 'full'>('firstframe')
const shotSatisfaction = ref<Map<string, 'approved' | 'rejected' | 'pending'>>(new Map())
// [UX改进 B14] 镜头锁定：锁定的镜头跳过批量重生成（预览图/视频）
const lockedShots = ref<Set<string>>(new Set())
function toggleShotLock(shotId: string) {
  const next = new Set(lockedShots.value)
  if (next.has(shotId)) next.delete(shotId)
  else next.add(shotId)
  lockedShots.value = next
}
const fullVideoGenerating = ref(false)
const fullVideoProgress = ref(0)
const fullVideoUrl = ref('')

// 逐镜头视频 I2V 状态
const shotVideoUrls = ref<Map<string, string>>(new Map())
const shotVideoGenerating = ref<Set<string>>(new Set())
const shotVideoErrors = ref<Map<string, string>>(new Map())
// 批量生成进度 & 取消
const batchVideoRunning = ref(false)
const batchVideoCancelled = ref(false)
const batchVideoProgress = ref({ done: 0, total: 0, succeeded: 0, failed: 0, elapsed: '' })
// BYOK 开关：true=用用户自己的 API Key，false=用平台 Key
const useByok = ref(false)
const videoDuration = ref(5)
const videoResolution = ref('720p')
const chainEnabled = ref(true)
type VideoGenMode = 'firstframe' | 'reference'
const videoGenMode = ref<VideoGenMode>('firstframe')

// ─── 一致性关键帧设置 ───
const enableConsistency = ref(true)
const consistencyModel = ref<ConsistencyModel>('flux-kontext-pro')
const enableFaceSwap = ref(false)
const consistencyModelOptions = [
  { value: 'flux-kontext-pro' as const, label: 'FLUX Kontext Pro', desc: '最强角色一致性，$0.05-0.10/张' },
  { value: 'ideogram-character' as const, label: 'Ideogram Character', desc: '角色一致性专用，$0.03-0.06/张' },
  { value: 'infinite-you' as const, label: 'InfiniteYou', desc: '多人脸支持，$0.038/张' },
  { value: 'instant-id' as const, label: 'InstantID', desc: '免训练人脸保真，$0.02-0.05/张' },
]

/** 一致性关键帧失败提示（P1：让静默降级变为可见，避免"勾了却没生效"） */
const consistencyWarning = ref('')

// ─── 全局制作规范（P1：工业级漫剧生成第一性原则）───
const globalDirective = ref<GlobalDirective | null>(null)
/** 注入每镜头 prompt 开头的锚点文本（generateShots 自动生成，非阻断） */
const globalDirectiveAnchor = ref('')
const globalDirectiveGenerating = ref(false)
const globalDirectiveError = ref('')
/** 是否将全局规范注入每镜头（默认开，用户可关闭） */
const injectGlobalDirective = ref(true)
/** 重新生成全局规范（手动触发） */
async function regenerateGlobalDirective() {
  globalDirectiveGenerating.value = true
  globalDirectiveError.value = ''
  try {
    const gd = await generateGlobalDirective()
    if (gd) {
      globalDirective.value = gd
      globalDirectiveAnchor.value = gd.anchor
    } else {
      globalDirectiveError.value = '全局规范生成失败，将不注入（不影响分镜生成）'
    }
  } catch (e: any) {
    globalDirectiveError.value = `全局规范生成失败：${e?.message || e}`
  } finally {
    globalDirectiveGenerating.value = false
  }
}

const gdPanelOpen = ref(true)
function onGdEdit() {
  if (globalDirective.value) {
    globalDirective.value.anchor = formatGlobalDirective(globalDirective.value)
    globalDirectiveAnchor.value = globalDirective.value.anchor
  }
}

// ─── 一致性关键帧失败重试（P5）───
const consistencyFailedShotId = ref<string | null>(null)
async function retryShotVideo(shotId?: string | null) {
  if (!shotId) return
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  consistencyWarning.value = ''
  consistencyFailedShotId.value = null
  await generateShotVideo(shot)
}

/** FNV-1a 字符串哈希 → 32位种子（P1：关键帧 seed 按角色派生，跨镜头稳定而非随机） */
function hashToSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 2147483647
}

/** 收集角色的最佳参考图（优先 front-upper，用于一致性关键帧） */
function collectCharacterRefImages(shot: Shot, chars: CharAppearance[]): string[] {
  const images: string[] = []
  for (const char of chars) {
    const outfitId = shot.characterOutfitSelections?.[String(char.id)]
    const outfit = outfitId
      ? char.outfits?.find(o => o.id === outfitId)
      : char.outfits?.find(o => o.id === char.activeOutfitId)
    const views = outfit?.views ?? char.views
    // P3：一致性关键帧用大头照(front-upper，人脸最清晰) 优先，全身照(front-full) 兜底，禁用多视图
    const priority = ['front-upper', 'front-full']
    let selected: string | undefined
    for (const key of priority) {
      const view = views.find(v => v.key === key && v.imageUrl)
      if (view?.imageUrl) { selected = view.imageUrl; break }
    }
    if (!selected) {
      const anyView = views.find(v => v.imageUrl)
      selected = anyView?.imageUrl
    }
    if (selected) images.push(selected)
  }
  return images
}

/** 获取某个镜头的下一个镜头（用于链式尾帧可视化） */
function getNextShot(shot: Shot): Shot | undefined {
  return shots.value.find(s => s.index === shot.index + 1)
}

/** 获取某个镜头的尾帧来源描述 */
function getLastFrameSource(shot: Shot): { label: string; url?: string; isAuto: boolean } {
  const next = getNextShot(shot)
  if (!next) {
    return { label: '自动生成 (return_last_frame)', isAuto: true }
  }
  const nextFirst = shotPreviewUrls.value.get(next.id)
  if (nextFirst) {
    return { label: `Shot #${next.index} 首帧`, url: nextFirst, isAuto: false }
  }
  return { label: `Shot #${next.index} 首帧（待确认）`, isAuto: false }
}

/** 获取镜头的多段运镜描述文本 */
function getShotCameraSummary(shot: Shot): string {
  const actions = shot.generation?.cameraActions
  if (actions?.length) {
    return actions.map(a => {
      const spd = a.speed === 'slow' ? '(慢)' : a.speed === 'fast' ? '(快)' : ''
      return `${CAMERA_MOVE_LABELS[a.move] || a.move}${spd}`
    }).join(' → ')
  }
  if (shot.cameraMove) {
    return CAMERA_MOVE_LABELS[shot.cameraMove] || shot.cameraMove
  }
  return '固定'
}

function getShotCompleteness(shot: Shot): { score: number; items: { label: string; ok: boolean }[] } {
  const charRefs = getShotCharacterRefs(shot)
  const sceneRef = getShotSceneRef(shot)
  const items = [
    { label: '场景', ok: !!shot.sceneTemplate && !!sceneRef?.imageUrl },
    { label: '角色', ok: charRefs.length > 0 && charRefs.every(c => getShotOutfitForChar(shot, c).views.some(v => v.imageUrl)) },
    { label: '描述', ok: !!(shot.description || shot.generation?.prompt) },
    { label: '镜头语言', ok: !!(shot.cameraMove !== 'static' || shot.generation?.cameraActions?.length) },
    { label: '对白/旁白', ok: !!(shot.dialogue || shot.narration) },
    { label: '预览图', ok: shotPreviewUrls.value.has(shot.id) },
  ]
  const score = items.filter(i => i.ok).length
  return { score, items }
}

function markShotSatisfaction(shotId: string, status: 'approved' | 'rejected') {
  shotSatisfaction.value.set(shotId, status)
  shotSatisfaction.value = new Map(shotSatisfaction.value)
}

const approvedCount = computed(() =>
  Array.from(shotSatisfaction.value.values()).filter(v => v === 'approved').length
)
const rejectedCount = computed(() =>
  Array.from(shotSatisfaction.value.values()).filter(v => v === 'rejected').length
)

/** 单个镜头 I2V 视频生成：以已确认首帧 + 运镜 prompt → generateVideo（首尾帧链式衔接） */
async function generateShotVideo(shot: Shot) {
  if (shotVideoGenerating.value.has(shot.id)) return
  const firstFrame = shotPreviewUrls.value.get(shot.id)
  const isRefMode = videoGenMode.value === 'reference'

  // 首帧模式必须有预览图；参考图模式可选（无预览图仍可用纯文本+角色/场景参考图生成）
  if (!isRefMode && !firstFrame) {
    shotVideoErrors.value.set(shot.id, '请先生成预览图')
    shotVideoErrors.value = new Map(shotVideoErrors.value)
    return
  }

  shotVideoErrors.value.delete(shot.id)
  consistencyWarning.value = ''
  shotVideoGenerating.value.add(shot.id)
  shotVideoGenerating.value = new Set(shotVideoGenerating.value)

  try {
    const chars = getShotCharacterRefs(shot)
    const sceneRef = getShotSceneRef(shot)
    const sceneData = sceneRef ? { name: sceneRef.name, mood: sceneRef.mood, imageUrl: sceneRef.imageUrl } : undefined

    // 首帧模式：链式尾帧 + firstFrameOverride
    let nextFirstFrame: string | undefined
    let shotForPayload: Shot = shot

    if (!isRefMode && firstFrame) {
      // [bug修复 B1] 链式首帧：优先使用前一个镜头的渲染尾帧（videoLastFrameUrl），
      // 保证前后镜头的画面连贯性；若前一镜头还未生成视频，则回退到当前镜头的预览图
      const prevShot = shots.value.find(s => s.index === shot.index - 1)
      const chainedFirstFrame = prevShot?.videoLastFrameUrl || firstFrame

      // 链式尾帧：下一个镜头的已确认首帧 = 本镜头的 last_frame
      const nextShot = shots.value.find(s => s.index === shot.index + 1)
      nextFirstFrame = nextShot
        ? (nextShot.videoLastFrameUrl || shotPreviewUrls.value.get(nextShot.id) || undefined)
        : undefined

      // 设置首帧 override（确保首帧进入 content 数组）
      shotForPayload = {
        ...shot,
        generation: {
          ...shot.generation,
          firstFrameOverride: shot.generation?.firstFrameOverride || chainedFirstFrame,
        },
      }
    }
    // 参考图模式：shotForPayload 保持原样（无 firstFrameOverride），
    // buildContentArray 会自动注入 reference_image 而非 first_frame

    const payload = buildContentArray(shotForPayload, {
      context: 'video',
      characters: chars,
      scene: sceneData,
      nextShotFirstFrame: nextFirstFrame,
    })

    // 📦 注入素材资产参考图（武器/道具/饰品/特效·技能），保证成片设定一致
    const assetThumbs = selectedAssetThumbs()
    if (assetThumbs.length) {
      for (const url of assetThumbs) {
        payload.content.push({ type: 'image_url', role: 'reference_image', image_url: { url } } as any)
      }
    }

    console.log(`[视频:${isRefMode ? '参考图' : '首帧'}] shot:`, shot.id, 'content items:', payload.content.length)
    console.log('[视频] has first_frame:', payload.content.some(c => c.role === 'first_frame'))
    console.log('[视频] has last_frame:', payload.content.some(c => c.role === 'last_frame'))
    console.log('[视频] has reference_image:', payload.content.some(c => c.role === 'reference_image'))

    // ─── 一致性关键帧生成（在 Seedance 之前；首帧模式与参考图模式均生效） ───
    if (enableConsistency.value && chars.length > 0) {
      const refImages = collectCharacterRefImages(shot, chars)
      if (refImages.length > 0) {
        try {
          // P1: seed 按角色 id 派生确定性值，保证同一角色在不同镜头的关键帧稳定一致
          const seedSrc = chars.map(c => c.id).sort().join('|') + '|' + (consistencyModel.value || 'kf')
          const kfSeed = hashToSeed(seedSrc)
          const kfResult = await generateConsistentKeyframe({
            prompt: payload.previewText,
            referenceImages: refImages,
            faceSourceImage: enableFaceSwap.value ? refImages[0] : undefined,
            width: videoResolution.value === '1080p' ? 1920 : 1280,
            height: videoResolution.value === '1080p' ? 1080 : 720,
            model: consistencyModel.value,
            enableFaceSwap: enableFaceSwap.value,
            seed: kfSeed,
            useByok: useByok.value,
          })

          console.log(`[一致性] keyframe: ${kfResult.mode} via ${kfResult.model}, ${kfResult.generationMs}ms, $${kfResult.cost}, seed=${kfSeed}`)

          // 用一致性关键帧锚定角色：首帧模式替换 first_frame；参考图模式追加为角色参考图
          let replaced = false
          if (!isRefMode) {
            for (const item of payload.content) {
              if (item.role === 'first_frame') {
                item.image_url = { url: kfResult.keyframeUrl }
                replaced = true
                break
              }
            }
          }
          if (!replaced) {
            payload.content.push({
              type: 'image_url',
              role: isRefMode ? 'reference_image' : 'first_frame',
              image_url: { url: kfResult.keyframeUrl },
            })
          }
        } catch (kfErr: any) {
          // P1: 失败可见（不再静默降级），用户能立刻知道一致性没生效
          consistencyWarning.value = '⚠️ 角色一致性关键帧生成失败，已用原预览图继续（检查 Replicate 密钥/额度是否可用）'
          consistencyFailedShotId.value = shot.id
          console.warn('[一致性] keyframe generation failed, using original preview:', kfErr?.message || kfErr)
        }
      }
    }

    const result = await generateVideo({
      prompt: payload.previewText,
      content: payload.content,
      durationSeconds: shot.duration || videoDuration.value,
      resolution: videoResolution.value,
      returnLastFrame: !isRefMode,
      seed: payload.parameters.seed,
      generateAudio: payload.parameters.generateAudio,
      useByok: useByok.value,
    })

    shotVideoUrls.value.set(shot.id, result.url)
    shotVideoUrls.value = new Map(shotVideoUrls.value)

    // 存储尾帧（供后续镜头链式引用或全片合成使用）
    if (result.lastFrameUrl) {
      const shotIdx = shots.value.findIndex(s => s.id === shot.id)
      if (shotIdx >= 0) {
        shots.value[shotIdx]!.videoLastFrameUrl = result.lastFrameUrl
      }
    }

    console.log('[I2V] 完成 shot:', shot.id, 'url:', result.url)
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err)
    console.error('[I2V] 失败 shot:', shot.id, msg)
    shotVideoErrors.value.set(shot.id, msg)
    shotVideoErrors.value = new Map(shotVideoErrors.value)
  } finally {
    shotVideoGenerating.value.delete(shot.id)
    shotVideoGenerating.value = new Set(shotVideoGenerating.value)
  }
}

/** 批量生成所有镜头视频（串行，首尾帧链式衔接 / 参考图模式） */
async function generateAllShotVideos() {
  const isRefMode = videoGenMode.value === 'reference'
  const hasApproved = shotSatisfaction.value.size > 0 && Array.from(shotSatisfaction.value.values()).some(v => v === 'approved')
  let candidateShots = isRefMode
    ? episodeShots.value
    : episodeShots.value.filter(s => shotPreviewUrls.value.has(s.id))

  // 若有已打分的 approved 镜头，只生成 approved 的；未打分则全量生成
  if (hasApproved) {
    candidateShots = candidateShots.filter(s => shotSatisfaction.value.get(s.id) !== 'rejected')
  }
  // [UX改进 B14] 跳过已锁定的镜头
  candidateShots = candidateShots.filter(s => !lockedShots.value.has(s.id))

  // 成本预估（Seedance 单镜头约 $0.50）
  const pendingShots = candidateShots.filter(s => !shotVideoUrls.value.has(s.id) && !shotVideoGenerating.value.has(s.id))
  if (pendingShots.length === 0) return

  const estimatedCost = pendingShots.length * 0.50
  if (!confirm(`即将生成 ${pendingShots.length} 个镜头视频，预计费用 $${estimatedCost.toFixed(2)}，确认继续？`)) {
    return
  }

  // 初始化批量进度
  batchVideoRunning.value = true
  batchVideoCancelled.value = false
  batchVideoProgress.value = { done: 0, total: pendingShots.length, succeeded: 0, failed: 0, elapsed: '0:00' }
  const startTime = Date.now()

  // 进度计时器
  const timer = setInterval(() => {
    const secs = Math.floor((Date.now() - startTime) / 1000)
    const min = Math.floor(secs / 60)
    const sec = secs % 60
    batchVideoProgress.value = {
      ...batchVideoProgress.value,
      elapsed: `${min}:${sec.toString().padStart(2, '0')}`,
    }
  }, 1000)

  try {
    for (const shot of candidateShots) {
      // 检查取消
      if (batchVideoCancelled.value) {
        console.log('[批量视频] 用户取消，已完成', batchVideoProgress.value.done, '/', batchVideoProgress.value.total)
        break
      }
      if (!shotVideoUrls.value.has(shot.id) && !shotVideoGenerating.value.has(shot.id)) {
        const prevErrorCount = shotVideoErrors.value.size
        await generateShotVideo(shot)
        const succeeded = shotVideoUrls.value.has(shot.id)
        const failed = shotVideoErrors.value.size > prevErrorCount
        batchVideoProgress.value = {
          ...batchVideoProgress.value,
          done: batchVideoProgress.value.done + 1,
          succeeded: batchVideoProgress.value.succeeded + (succeeded ? 1 : 0),
          failed: batchVideoProgress.value.failed + (failed ? 1 : 0),
        }
      }
    }
  } finally {
    clearInterval(timer)
    batchVideoRunning.value = false
  }
}

/** 取消批量视频生成 */
function cancelBatchVideoGeneration() {
  batchVideoCancelled.value = true
}

const shotVideoDoneCount = computed(() => shotVideoUrls.value.size)
const allVideosReady = computed(() => {
  const readyShots = episodeShots.value.filter(s => shotPreviewUrls.value.has(s.id))
  return readyShots.length > 0 && readyShots.every(s => shotVideoUrls.value.has(s.id))
})

// ── Step 7: 合成视频 ──
const composedVideoUrl = ref<string | null>(null)
const composingVideo = ref(false)
const composeError = ref('')
const composeElapsed = ref('')

/** 启动一个每秒更新的 elapsed 计时器，返回 clearInterval 句柄 */
function startElapsedTimer(elapsedRef: { value: string }): ReturnType<typeof setInterval> {
  const startTime = Date.now()
  elapsedRef.value = '0:00'
  return setInterval(() => {
    const secs = Math.floor((Date.now() - startTime) / 1000)
    elapsedRef.value = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  }, 1000)
}

async function composeEpisodeVideo() {
  composingVideo.value = true
  composeError.value = ''
  composeElapsed.value = ''
  const timer = startElapsedTimer(composeElapsed)
  try {
    // 收集所有有视频的镜头（按顺序）
    const videoShots = episodeShots.value.filter(s => shotVideoUrls.value.has(s.id))
    if (videoShots.length === 0) {
      composeError.value = '没有可合成的视频，请先在"镜头视频"步骤生成视频'
      return
    }
    // 构建合成请求（按 index 排序，包含转场信息）
    const shots = videoShots
      .sort((a, b) => a.index - b.index)
      .map(s => ({
        videoUrl: shotVideoUrls.value.get(s.id)!,
        transition: s.transition || 'cut',
        duration: s.duration,
      }))

    const result = await composeVideos(shots)
    // [状态联动] 重新合成时，增强和最终导出 URL 失效
    enhancedVideoUrl.value = null
    finalVideoUrl.value = null
    composedVideoUrl.value = result.url
    console.log('[合成] 完成，时长:', result.duration, 's, 大小:', (result.fileSize / 1024 / 1024).toFixed(1), 'MB')
  } catch (e: any) {
    composeError.value = e?.message || '合成失败'
    console.error('[合成] 失败:', e)
  } finally {
    clearInterval(timer)
    composingVideo.value = false
  }
}

// ── Step 8: 画质提升 ──
const enhancedVideoUrl = ref<string | null>(null)
const enhancingVideo = ref(false)
const enhanceError = ref('')
const enhanceElapsed = ref('')
const enhanceMethod = ref<'upscale' | 'sharpen' | 'both'>('both')

async function enhanceEpisodeVideo() {
  if (!composedVideoUrl.value) {
    enhanceError.value = '请先在"合成视频"步骤合成视频'
    return
  }
  enhancingVideo.value = true
  enhanceError.value = ''
  enhanceElapsed.value = ''
  const timer = startElapsedTimer(enhanceElapsed)
  try {
    const result = await enhanceVideo({
      videoUrl: composedVideoUrl.value,
      method: enhanceMethod.value,
    })
    // [状态联动] 增强完成时，最终导出 URL 失效（需重新合成配音）
    finalVideoUrl.value = null
    enhancedVideoUrl.value = result.url
    console.log('[画质提升] 完成')
  } catch (e: any) {
    enhanceError.value = e?.response?.data?.error?.message || e?.message || '画质提升失败'
    console.error('[画质提升] 失败:', e)
  } finally {
    clearInterval(timer)
    enhancingVideo.value = false
  }
}

// ── Step 9: AI 配音 ──
interface DubSegment {
  shotId: string
  shotIndex: number
  title: string
  text: string // 对白/旁白文本
  voiceId: string
  voiceName: string
  audioUrl?: string
  status: 'pending' | 'generating' | 'done' | 'error' | 'imported'
  error?: string
  /** 连续对白组 ID（同一 dialogueGroupId 的 shot 配音应无缝衔接） */
  groupId?: string
  /** 是否为组内主镜头（仅主镜头设 audioUrl，组内其他镜头共享） */
  isGroupPrimary?: boolean
}

const dubSegments = ref<DubSegment[]>([])
const dubGenerating = ref(false)
const dubGeneratingId = ref<string | null>(null)

// ── 2A: 对白长度校验 + 反应镜头建议 ──
const dialogueSuggestions = ref<{ shotId: string; suggestion: string }[]>([])

function validateDialogueLength(shotsToCheck: typeof shots.value): { shotId: string; suggestion: string }[] {
  const results: { shotId: string; suggestion: string }[] = []
  for (const s of shotsToCheck) {
    const dialogue = s.dialogue || ''
    if (dialogue.length > 15 && s.characterArchetypes.length > 1) {
      results.push({
        shotId: s.id,
        suggestion: `#${s.index} 「${s.title}」对白超过 15 字（${dialogue.length} 字），当前场景有多个角色，建议添加反应镜头`,
      })
    }
  }
  return results
}

function buildDubSegments() {
  // 如果已有已完成的配音数据，先确认再覆盖
  const hasExistingWork = dubSegments.value.some(s => s.status === 'done' || s.status === 'imported')
  if (hasExistingWork) {
    const ok = window.confirm('已有配音数据将被清除并重新生成，确定继续吗？')
    if (!ok) return
  }

  /** [bug修复 B5] 清理配音文本：去掉 "角色名：" / "(OS)" 等前缀 */
  function cleanDubText(text: string): string {
    return text
      .replace(/^[^\s：:]{1,10}[：:]\s*/, '') // "林启：" / "Lin:"
      .replace(/^\(OS\)\s*/i, '')              // "(OS) "
      .replace(/^（OS）\s*/, '')        // "（OS）"
      .trim()
  }

  /** [生成逻辑 B11] 解析多角色对话，分配各自音色 */
  function parseSpeakerLines(shot: typeof episodeShots.value[0]) {
    const rawText = shot.dialogue || shot.narration || ''
    if (!rawText.trim()) return []
    const lines = rawText.split(/\n/).filter(l => l.trim())
    const results: { text: string; voiceId: string; voiceName: string }[] = []

    const getVoiceForChar = (name: string | undefined) => {
      const char = name
        ? characterAppearances.value.find(c =>
            c.name === name ||
            c.name.includes(name) ||
            (name && name.includes(c.name.replace(/^[^·]+·/, '')))
          )
        : undefined
      return char?.voiceId
        ? VOICE_PRESETS.find(v => v.id === char.voiceId) || VOICE_PRESETS[0]!
        : (getShotCharacterRefs(shot)[0]?.voiceId
            ? VOICE_PRESETS.find(v => v.id === getShotCharacterRefs(shot)[0]!.voiceId) || VOICE_PRESETS[0]!
            : VOICE_PRESETS[0]!)
    }

    for (const line of lines) {
      const m = line.match(/^([^\s：:]{1,10})[：:]\s*(.+)/)
      if (m) {
        const [, speakerName, textContent] = m
        const voice = getVoiceForChar(speakerName)
        if (textContent?.trim()) {
          results.push({ text: textContent.trim(), voiceId: voice.id, voiceName: voice.name })
        }
      } else {
        const cleaned = cleanDubText(line)
        const voice = getVoiceForChar(undefined)
        if (cleaned) results.push({ text: cleaned, voiceId: voice.id, voiceName: voice.name })
      }
    }
    return results.length > 0 ? results : [{ text: cleanDubText(rawText), voiceId: getVoiceForChar(undefined).id, voiceName: getVoiceForChar(undefined).name }]
  }

  dubSegments.value = episodeShots.value
    .filter(s => s.dialogue || s.narration)
    .flatMap(s => {
      const lines = parseSpeakerLines(s)
      return lines.map((l, idx) => ({
        shotId: s.id,
        shotIndex: s.index,
        title: lines.length > 1 ? `${s.title || `Shot ${s.index}`}（${idx + 1}）` : (s.title || `Shot ${s.index}`),
        text: l.text,
        voiceId: l.voiceId,
        voiceName: l.voiceName,
        status: 'pending' as const,
        // 2B: 传递来自 shot 的 dialogueGroupId
        groupId: (s as any).dialogueGroupId || undefined,
      }))
    })

  // 2B: 标记同一组内的主镜头（第一个为 primary，其余 groupId 相同的复用同一音频）
  const seenGroups = new Set<string>()
  for (const seg of dubSegments.value) {
    if (seg.groupId) {
      if (!seenGroups.has(seg.groupId)) {
        seg.isGroupPrimary = true
        seenGroups.add(seg.groupId)
      } else {
        seg.isGroupPrimary = false
      }
    } else {
      seg.isGroupPrimary = true
    }
  }
}

async function generateDubSegment(seg: DubSegment) {
  if (!seg.text) return

  // 2B: 非 primary 的 group 成员复用主镜头音频（不发 TTS 请求）
  if (seg.groupId && !seg.isGroupPrimary) {
    const primary = dubSegments.value.find(s => s.groupId === seg.groupId && s.isGroupPrimary)
    if (primary?.audioUrl) {
      seg.audioUrl = primary.audioUrl
      seg.status = 'done'
      return
    }
    // primary 未完成时跳过，由 generateAllDubSegments 重排序保证 primary 先执行
    return
  }

  seg.status = 'generating'
  dubGeneratingId.value = seg.shotId
  try {
    const result = await generateTTS({
      text: seg.text,
      voiceId: seg.voiceId,
      speed: 1.0,  // 2B: 固定语速，跨镜头连续对白不自适应调速
    })
    seg.audioUrl = result.url
    seg.status = 'done'

    // 2B: 将音频 URL 传播给同一 group 的其他成员
    if (seg.groupId) {
      for (const other of dubSegments.value) {
        if (other.groupId === seg.groupId && !other.isGroupPrimary && !other.audioUrl) {
          other.audioUrl = result.url
          other.status = 'done'
        }
      }
    }

    console.log(`[TTS] 完成 shot ${seg.shotIndex}: ${result.provider}/${result.voiceId}, ${result.duration.toFixed(1)}s`)
  } catch (e: any) {
    seg.status = 'error'
    seg.error = e?.response?.data?.error?.message || e?.message || '配音失败'
    console.error('[TTS] 失败:', e)
  } finally {
    dubGeneratingId.value = null
  }
}

const batchDubCancelled = ref(false)
async function generateAllDubSegments() {
  dubGenerating.value = true
  batchDubCancelled.value = false
  // 2B: 先生成所有 primary（含无 group 的普通段），再让 non-primary 复用
  const pending = dubSegments.value.filter(seg => seg.status === 'pending' || seg.status === 'error')
  const primaries = pending.filter(s => s.isGroupPrimary !== false)
  const secondaries = pending.filter(s => s.isGroupPrimary === false)
  for (const seg of primaries) {
    if (batchDubCancelled.value) break
    await generateDubSegment(seg)
  }
  for (const seg of secondaries) {
    if (batchDubCancelled.value) break
    await generateDubSegment(seg)
  }
  dubGenerating.value = false
}
function cancelBatchDubGeneration() {
  batchDubCancelled.value = true
}

async function importDubAudio(seg: DubSegment, file: File) {
  seg.status = 'generating'
  try {
    const formData = new FormData()
    formData.append('audio', file)
    const token = getToken()
    const res = await fetch('/v1/upload/audio', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    const data = await res.json() as { url: string }
    seg.audioUrl = data.url
    seg.status = 'imported'
    console.log('[导入音频] 上传成功:', data.url)
  } catch (e: any) {
    seg.status = 'error'
    seg.error = e?.message || '上传失败'
    console.error('[导入音频] 失败:', e)
  }
}

const dubDoneCount = computed(() => dubSegments.value.filter(s => s.status === 'done' || s.status === 'imported').length)
const allDubReady = computed(() => dubSegments.value.length > 0 && dubSegments.value.every(s => s.status === 'done' || s.status === 'imported'))

/** 配音片段 voice 变更：同步 voiceName，已配音的标记为 pending（需重新生成） */
function onDubVoiceChange(seg: DubSegment, newVoiceId: string) {
  seg.voiceId = newVoiceId
  const preset = VOICE_PRESETS.find(v => v.id === newVoiceId)
  seg.voiceName = preset?.name || newVoiceId
  // 若已有配音音频，重置状态提示用户重新生成
  if (seg.audioUrl) {
    seg.status = 'pending'
    seg.audioUrl = undefined
  }
  dubSegments.value = [...dubSegments.value]
}

// ── Step 9: 合成导出 ──
const finalVideoUrl = ref<string | null>(null)
const finalComposing = ref(false)
const finalError = ref('')
const finalElapsed = ref('')

async function composeFinalVideo() {
  const videoSource = enhancedVideoUrl.value || composedVideoUrl.value
  if (!videoSource) {
    finalError.value = '请先合成 episode 视频'
    return
  }
  finalComposing.value = true
  finalError.value = ''
  finalElapsed.value = ''
  const timer = startElapsedTimer(finalElapsed)
  try {
    // [bug修复 B6] 收集已完成的配音音频，按 shotIndex 计算时间偏移实现对齐
    // 构建 shotId → 累计开始时间 的 Map（基于各 shot.duration）
    let cumTime = 0
    const shotStartTimes = new Map<string, number>()
    for (const s of episodeShots.value.sort((a, b) => a.index - b.index)) {
      shotStartTimes.set(s.id, cumTime)
      cumTime += s.duration || 4
    }
    const audioSegments = dubSegments.value
      .filter(s => s.audioUrl && (s.status === 'done' || s.status === 'imported'))
      .map(s => ({
        audioUrl: s.audioUrl!,
        startTime: shotStartTimes.get(s.shotId) ?? 0,
      }))

    const result = await mergeVideoAudio({
      videoUrl: videoSource,
      audioSegments,
      // export settings — 透传给 FFmpeg 服务（后端按需使用）
      ...(exportFormat.value !== 'mp4' ? { format: exportFormat.value } : {}),
      ...(exportFps.value !== 30 ? { fps: exportFps.value } : {}),
      ...(exportBitrate.value !== 'high' ? { bitrate: exportBitrate.value } : {}),
    } as any)
    finalVideoUrl.value = result.url
    console.log('[最终导出] 完成，时长:', result.duration, 's, 大小:', (result.fileSize / 1024 / 1024).toFixed(1), 'MB')
  } catch (e: any) {
    finalError.value = e?.response?.data?.error?.message || e?.message || '合成失败'
    console.error('[最终导出] 失败:', e)
  } finally {
    clearInterval(timer)
    finalComposing.value = false
  }
}
const exportBitrate = ref('high')
const exportFormat = ref('mp4')
const exportFps = ref(30)
const exportSubtitle = ref(true)
const exportSubtitleMode = ref<'embedded' | 'srt'>('embedded')
const exportMusic = ref(true)
const exportWatermark = ref(false)
const exportRange = ref<'all' | 'custom'>('all')
const exportRangeFrom = ref(1)
const exportRangeTo = ref(12)

const exportFormatOptions = [
  { value: 'mp4', label: 'MP4 视频', icon: '🎥' },
  { value: 'images', label: '图片序列', icon: '🖼️' },
  { value: 'srt', label: 'SRT 字幕', icon: '📝' },
  { value: 'project', label: '项目包', icon: '📦' },
]
const fpsOptions = [24, 30, 60]
const bitrateOptions = [
  { value: 'low', label: '低码率', desc: '文件小，画质一般' },
  { value: 'medium', label: '中码率', desc: '平衡' },
  { value: 'high', label: '高码率', desc: '画质好，文件大' },
]

const estimatedExportSize = computed(() => {
  const epCount = exportRange.value === 'all' ? episodeCount.value : (exportRangeTo.value - exportRangeFrom.value + 1)
  const baseSizeMb = epCount * episodeDurationMin.value * 15 // ~15MB per minute at high
  const factor = exportBitrate.value === 'high' ? 1 : exportBitrate.value === 'medium' ? 0.6 : 0.3
  const resFactor = selectedResolution.value === '4K' ? 3 : selectedResolution.value === '1080p' ? 1 : 0.5
  const mb = baseSizeMb * factor * resFactor
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
})

const estimatedExportTime = computed(() => {
  const epCount = exportRange.value === 'all' ? episodeCount.value : (exportRangeTo.value - exportRangeFrom.value + 1)
  const minutes = epCount * episodeDurationMin.value * 2
  return minutes >= 60 ? `${Math.round(minutes / 60)} 小时` : `约 ${minutes} 分钟`
})

function startExport() {
  const exportData = {
    projectId: projectId.value,
    projectName: projectName.value,
    shots: shots.value,
    format: exportFormat.value,
    resolution: selectedResolution.value,
    fps: exportFps.value,
    bitrate: exportBitrate.value,
    subtitle: exportSubtitle.value,
    subtitleMode: exportSubtitleMode.value,
    music: exportMusic.value,
    watermark: exportWatermark.value,
    range: exportRange.value,
    rangeFrom: exportRangeFrom.value,
    rangeTo: exportRangeTo.value,
    aspect: selectedAspect.value,
    artStyle: selectedStyle.value,
    exportedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem('mhw:storyboard:export-data', JSON.stringify(exportData))
  } catch (e) {
    console.warn('[导出] sessionStorage 写入失败', e)
  }
  router.push('/export')
}

// ── 导航确认：按步骤完成度校验闸门（F-01 整改）──
interface StepGate { ok: boolean; reason?: string }
function checkStepGate(index: number): StepGate {
  const key = STEPS[index]?.key
  switch (key) {
    case 'setup':
      return projectName.value?.trim() ? { ok: true } : { ok: false, reason: '请先填写项目名称' }
    case 'upload':
      return hasUploadedNovel.value ? { ok: true } : { ok: false, reason: '请先上传或粘贴小说文本（至少 10 字）' }
    case 'character':
      if (characterAppearances.value.length === 0) return { ok: false, reason: '请至少添加一个角色' }
      if (!characterAppearances.value.some(c => getActiveOutfit(c).views.some(v => v.imageUrl)))
        return { ok: false, reason: '请至少为一名角色生成主视觉图' }
      return { ok: true }
    case 'scene':
      if (extractedScenes.value.length === 0) return { ok: false, reason: '请至少设定一个场景' }
      if (!extractedScenes.value.some(s => s.imageUrl)) return { ok: false, reason: '请至少为一名场景生成场景图' }
      return { ok: true }
    case 'storyboard':
      return shots.value.length > 0 ? { ok: true } : { ok: false, reason: '请先 AI 拆分分镜' }
    case 'video':
      return shotVideoDoneCount.value > 0 ? { ok: true } : { ok: false, reason: '请先生成至少一个镜头视频' }
    case 'compose':
      return composedVideoUrl.value ? { ok: true } : { ok: false, reason: '请先合成视频' }
    case 'enhance':
      return enhancedVideoUrl.value ? { ok: true } : { ok: false, reason: '请先完成画质提升' }
    case 'dubbing':
      return dubSegments.value.length > 0 ? { ok: true } : { ok: false, reason: '请先完成 AI 配音' }
    case 'final':
      return finalVideoUrl.value ? { ok: true } : { ok: false, reason: '请先合成最终视频' }
    default:
      return { ok: true }
  }
}
const currentGate = computed(() => checkStepGate(currentStepIndex.value))
function onNextClick() {
  const gate = checkStepGate(currentStepIndex.value)
  if (!gate.ok) return // 原因已由 footer 的 aria-live 提示展示，不阻断体验，仅拦截前进
  markCompleted(currentStepIndex.value)
  goToStep(currentStepIndex.value + 1)
}

// ── 导出数据交接 ──
function navigateToExport() {
  startExport()
}

// ── ENH-3: AI角色自动描图 ──
interface CharView {
  key: string
  label: string
  promptSuffix: string
  imageUrl?: string
  error?: string
  generating: boolean
}

interface OutfitVariant {
  id: string
  name: string
  tags: string[]
  newTag: string
  description: string
  views: CharView[]
  generating: boolean
}

interface CharAppearance {
  id: number
  name: string
  role: string
  avatar: string
  tags: string[]
  newTag: string
  showDetail: boolean
  views: CharView[]
  description: string
  outfits: OutfitVariant[]
  activeOutfitId: string | null
  voiceId?: string
  voiceName?: string
}

/** 预设音色列表（edge-tts / 火山 / 阿里云常用中文音色） */
const VOICE_PRESETS: Array<{ id: string; name: string; gender: 'male' | 'female'; provider: string }> = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（温柔女声）', gender: 'female', provider: 'edge-tts' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊（活力女声）', gender: 'female', provider: 'edge-tts' },
  { id: 'zh-CN-YunxiNeural', name: '云希（阳光男声）', gender: 'male', provider: 'edge-tts' },
  { id: 'zh-CN-YunjianNeural', name: '云健（沉稳男声）', gender: 'male', provider: 'edge-tts' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰（知性女声）', gender: 'female', provider: 'edge-tts' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏（少年声）', gender: 'male', provider: 'edge-tts' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨（文艺女声）', gender: 'female', provider: 'edge-tts' },
  { id: 'zh-CN-YunzeNeural', name: '云泽（儒雅男声）', gender: 'male', provider: 'edge-tts' },
  { id: 'BV001_streaming', name: '火山·女播报', gender: 'female', provider: 'volcengine' },
  { id: 'BV002_streaming', name: '火山·男播报', gender: 'male', provider: 'volcengine' },
  { id: 'zhitian_emo', name: '阿里云·知甜', gender: 'female', provider: 'aliyun' },
]

const CHAR_VIEW_DEFS: Array<{ key: string; label: string; promptSuffix: string }> = [
  { key: 'front-full', label: '正面全身', promptSuffix: 'front view, full length portrait, head to toe visible, complete figure' },
  { key: 'side-full', label: '侧面全身', promptSuffix: 'side profile view, full length portrait, head to toe visible, complete figure' },
  { key: 'back-full', label: '背面全身', promptSuffix: 'back view, full length portrait, head to toe visible, complete figure' },
  { key: 'front-upper', label: '正面上半身', promptSuffix: 'front view, upper body portrait, waist up' },
]

function createEmptyViews(): CharView[] {
  return CHAR_VIEW_DEFS.map(d => ({
    key: d.key, label: d.label, promptSuffix: d.promptSuffix,
    generating: false,
  }))
}

// ── 造型系统 ──
let _outfitUid = 0
function nextOutfitId(charId: number | string): string {
  return `${charId}-outfit-${++_outfitUid}`
}

function createDefaultOutfit(charId: number | string, tags: string[] = [], description: string = '', views?: CharView[]): OutfitVariant {
  return {
    id: nextOutfitId(charId),
    name: '默认造型',
    tags: [...tags],
    newTag: '',
    description,
    views: views || createEmptyViews(),
    generating: false,
  }
}

/**
 * 从（可能被 token 上限截断的）JSON 数组字符串中提取所有完整顶层对象。
 * 用括号深度计数，跳过末个未闭合的半截对象，返回完整对象的解析数组。
 * 用于推理模型输出超限被截断时的优雅降级（救回前面的完整镜头）。
 */
function extractCompleteObjects(arrStr: string): unknown[] {
  const out: unknown[] = []
  let depth = 0
  let inStr = false
  let esc = false
  let buf = ''
  let capturing = false
  for (let i = 0; i < arrStr.length; i++) {
    const ch = arrStr[i]!
    if (inStr) {
      buf += ch
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; buf += ch; continue }
    if (ch === '{') {
      depth++
      if (depth === 1) { capturing = true; buf = '{'; continue }
    }
    if (capturing) buf += ch
    if (ch === '}') {
      depth--
      if (depth === 0 && capturing) {
        try { out.push(JSON.parse(buf)) } catch { /* 跳过畸形对象 */ }
        buf = ''
        capturing = false
      }
    }
  }
  return out
}

/** 通用 AI JSON 解析容错：去 code block、提取数组、修复常见格式问题 */
function parseAIJson<T>(raw: string): T {
  let s = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
  // 提取 JSON 数组或对象
  const arrMatch = s.match(/\[[\s\S]*\]/)
  const objMatch = s.match(/\{[\s\S]*\}/)
  if (arrMatch) s = arrMatch[0]
  else if (objMatch) s = objMatch[0]
  // 第一次直接解析
  try { return JSON.parse(s) } catch { /* continue to repair */ }
  // 修复 1：去尾逗号
  let fixed = s.replace(/,\s*([\]}])/g, '$1')
  // 修复 2：修复缺失逗号（行末值后直接跟下行引号）
  fixed = fixed.replace(/("|\d|true|false|null)\s*\n\s*"/g, '$1,\n"')
  // 修复 3：补全缺失括号
  const ob = (fixed.match(/\[/g) || []).length
  const cb = (fixed.match(/\]/g) || []).length
  if (ob > cb) fixed += ']'.repeat(ob - cb)
  const oc = (fixed.match(/\{/g) || []).length
  const cc = (fixed.match(/\}/g) || []).length
  if (oc > cc) fixed += '}'.repeat(oc - cc)
  // 修复 4：替换字符串内未转义的中文引号
  fixed = fixed.replace(/(?<="[^"]*?)"(?=[^"]*?")/g, "'")
  try { return JSON.parse(fixed) } catch {
    // 修复 5：尝试逐行修复缺失逗号（属性之间）
    fixed = fixed.replace(/}\s*\n\s*\{/g, '},\n{')
    fixed = fixed.replace(/\]\s*\n\s*\[/g, '],\n[')
    fixed = fixed.replace(/}\s*\n\s*\]/g, '}\n]')
  }
  try { return JSON.parse(fixed) } catch (e) {
    console.warn('[parseAIJson] 修复失败，前200字符:', s.slice(0, 200))
    // 修复 6：截断恢复 — 数组被 token 上限截断时，提取所有完整 {} 对象（丢弃半截末对象）
    const recovered = extractCompleteObjects(fixed)
    if (recovered.length > 0) {
      console.warn('[parseAIJson] 已从截断响应中恢复', recovered.length, '个完整镜头对象')
      return recovered as unknown as T
    }
    throw new Error(`AI 返回的 JSON 格式无法解析，请重试。`)
  }
}

function migrateCharacter(char: CharAppearance): CharAppearance {
  if (char.outfits && char.outfits.length > 0) return char
  const defaultOutfit = createDefaultOutfit(char.id, char.tags, char.description, char.views)
  char.outfits = [defaultOutfit]
  char.activeOutfitId = defaultOutfit.id
  return char
}

function getActiveOutfit(char: CharAppearance): OutfitVariant {
  if (char.outfits && char.outfits.length > 0) {
    return char.outfits.find(o => o.id === char.activeOutfitId) || char.outfits[0]!
  }
  // Fallback: build transient outfit from legacy fields
  return createDefaultOutfit(char.id, char.tags, char.description, char.views)
}

function getShotOutfitForChar(shot: Shot, char: CharAppearance): OutfitVariant {
  const outfitId = shot.characterOutfitSelections?.[String(char.id)]
  if (outfitId && char.outfits) {
    const found = char.outfits.find(o => o.id === outfitId)
    if (found) return found
  }
  return getActiveOutfit(char)
}

function addOutfit(char: CharAppearance) {
  const newOutfit: OutfitVariant = {
    id: nextOutfitId(char.id),
    name: '新造型',
    tags: [],
    newTag: '',
    description: '',
    views: createEmptyViews(),
    generating: false,
  }
  if (!char.outfits) char.outfits = []
  char.outfits.push(newOutfit)
  char.activeOutfitId = newOutfit.id
}

function removeOutfit(char: CharAppearance, outfitId: string) {
  if (!char.outfits || char.outfits.length <= 1) return
  const idx = char.outfits.findIndex(o => o.id === outfitId)
  if (idx === -1) return
  char.outfits.splice(idx, 1)
  if (char.activeOutfitId === outfitId) {
    char.activeOutfitId = char.outfits[0]!.id
  }
}

function switchOutfit(char: CharAppearance, outfitId: string) {
  char.activeOutfitId = outfitId
}

function setShotOutfit(shot: Shot, charId: string | number, outfitId: string) {
  if (!shot.characterOutfitSelections) shot.characterOutfitSelections = {}
  shot.characterOutfitSelections[String(charId)] = outfitId
}

// 角色数据：初始为空，从项目库加载或 AI 提取
const characterAppearances = ref<CharAppearance[]>([])

// 角色搜索/筛选（应对大量角色）
const characterSearch = ref('')
const filteredCharacters = computed(() => {
  const q = characterSearch.value.trim().toLowerCase()
  if (!q) return characterAppearances.value
  return characterAppearances.value.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.role.toLowerCase().includes(q)
    || c.tags.some(t => t.toLowerCase().includes(q))
  )
})

// 项目资产库状态
const projectCharactersLoaded = ref(false)
const projectScenesLoaded = ref(false)

const extracting = ref(false)
const extractError = ref('')

async function extractCharacters() {
  if (extracting.value) return
  extracting.value = true
  extractError.value = ''

  const text = uploadedText.value.trim()
  const AVATARS = ['🧑', '👩', '👴', '🧙', '🧒', '👨', '👧', '🧓']

  if (!text) {
    extractError.value = '请先在步骤 1 输入小说文本，再点击提取'
    extracting.value = false
    return
  }

  // 检查登录状态
  const token = getToken()
  if (!token) {
    extractError.value = '请先登录后再使用 AI 提取功能'
    extracting.value = false
    return
  }

  try {
    const result = await generateText({
      systemPrompt:
        '你是一个专业的小说角色分析师。从给定的小说文本中提取主要角色信息，返回 JSON 数组。\n' +
        '每个角色包含：\n' +
        '- name：名字，带身份前缀如"主角·xxx"\n' +
        '- role：角色定位，2-4字\n' +
        '- tags：外貌特征标签数组，3-6个中文标签\n' +
        '- description：一段50-80字的角色外貌描述（包括身高体型、肤色、五官、发型、穿着、气质等，用于AI绘图提示词）\n' +
        (worldviewContext.value ? `\n【世界观背景】\n${worldviewContext.value}\n请确保提取的角色描述、外貌特征、服饰风格都与上述世界观一致。\n` : '') +
        '最多提取6个角色，按重要程度排序。\n' +
        '只返回 JSON 数组，不要其他文字。格式示例：\n' +
        '[{"name":"主角·张三","role":"剑修","tags":["黑发","高挑","冷峻"],"description":"二十出头的高挑青年，剑眉星目，肤色偏铜，黑色长发束于脑后，身穿青灰色道袍，气质清冷孤傲"}]',
      prompt: `请从以下小说文本中提取主要角色：\n\n${text.slice(0, 4000)}`,
    })

    // 解析 JSON（兼容 markdown code block 包裹 + 容错修复）
    const parsed: Array<{ name: string; role: string; tags: string[]; description?: string }> = parseAIJson(result)

    if (Array.isArray(parsed) && parsed.length > 0) {
      characterAppearances.value = parsed.slice(0, 6).map((c, i) => {
        const role = (c.role || '').toLowerCase()
        const name = (c.name || '')
        const isFemale = /女|母|姐|妹|娘|妃|后|婆|嫂|仙姑|夫人|公主|女主|校花|美女/.test(role + name)
        const defaultVoice = isFemale
          ? VOICE_PRESETS.find(v => v.gender === 'female')!
          : VOICE_PRESETS.find(v => v.gender === 'male')!
        return migrateCharacter({
          id: i + 1,
          name: c.name || `角色${i + 1}`,
          role: c.role || '未知',
          avatar: AVATARS[i % AVATARS.length]!,
          tags: Array.isArray(c.tags) ? c.tags : [],
          newTag: '',
          showDetail: false,
          views: createEmptyViews(),
          description: c.description || '',
          outfits: [],
          activeOutfitId: null,
          voiceId: defaultVoice?.id,
          voiceName: defaultVoice?.name,
        })
      })
    }
    markCompleted(2) // character step (index 2 in 8-step flow)
    // 保存到项目角色库（DB 持久化）
    saveCharactersToProject()
  } catch (e: any) {
    console.warn('[角色提取] API 调用失败', e)
    extractError.value = `AI 提取失败：${e?.message || '未知错误'}，请重试`
    // 不在失败时标记步骤完成（与 extractScenes 保持一致）
  } finally {
    extracting.value = false
  }
}

/**
 * 将当前角色数据保存到项目角色库（DB 持久化）
 * 提取/编辑角色后自动调用，支持跨集复用
 */
async function saveCharactersToProject() {
  const pid = projectId.value
  if (!pid || pid === '1' || characterAppearances.value.length === 0) return

  try {
    const { useCharacterStore } = await import('@/stores/characterStore')
    const charStore = useCharacterStore()

    // 确保 store 已加载项目数据
    if (charStore.projectId !== pid) {
      await charStore.load(pid)
    }

    for (const char of characterAppearances.value) {
      // 检查是否已存在（通过名字匹配）
      const existing = charStore.characters.find(c => c.name === char.name)

      const thumbnailUrl = char.views.find(v => v.key === 'front-upper')?.imageUrl
        || char.views.find(v => v.key === 'front-full')?.imageUrl
        || char.avatar

      if (existing) {
        // 已存在的角色：更新描述和缩略图
        // characterStore 当前没有 update 方法，跳过
        console.log('[角色库] 角色已存在，跳过:', char.name)
      } else {
        // 新角色：创建到 DB
        try {
          await charStore.create({
            name: char.name,
            archetype: char.role,
            description: char.description || char.tags.join(', '),
          })
          console.log('[角色库] 保存角色:', char.name)
        } catch (createErr: any) {
          console.warn('[角色库] 保存失败:', char.name, createErr?.message)
        }
      }
    }
  } catch (err: any) {
    console.warn('[角色库] 保存失败（store 不可用）:', err?.message)
  }
}

/**
 * 从项目角色库加载已有角色（跨集复用）
 */
async function loadProjectCharacters() {
  const pid = projectId.value
  if (!pid || pid === '1' || projectCharactersLoaded.value) return

  try {
    const { useCharacterStore } = await import('@/stores/characterStore')
    const charStore = useCharacterStore()
    await charStore.load(pid)

    if (charStore.characters.length > 0 && characterAppearances.value.length === 0) {
      const AVATARS = ['🧑', '👩', '👴', '🧙', '🧒', '👨', '👧', '🧓']
      characterAppearances.value = charStore.characters.map((c, i) => {
        const role = (c.archetype || '').toLowerCase()
        const name = (c.name || '')
        const isFemale = /女|母|姐|妹|娘|妃|后|婆|嫂|仙姑|夫人|公主|女主|校花|美女/.test(role + name)
        const defaultVoice = isFemale
          ? VOICE_PRESETS.find(v => v.gender === 'female')!
          : VOICE_PRESETS.find(v => v.gender === 'male')!
        return migrateCharacter({
          id: i + 1,
          name: c.name,
          role: c.archetype || '未知',
          avatar: AVATARS[i % AVATARS.length]!,
          tags: c.tags || [],
          newTag: '',
          showDetail: false,
          views: createEmptyViews(),
          description: c.description || '',
          outfits: [],
          activeOutfitId: null,
          voiceId: defaultVoice?.id,
          voiceName: defaultVoice?.name,
        })
      })
      console.log('[角色库] 从项目加载了', charStore.characters.length, '个角色')
    }
  } catch (err: any) {
    console.warn('[角色库] 加载失败:', err?.message)
  } finally {
    projectCharactersLoaded.value = true
  }
}

function addAppearanceTag(char: CharAppearance) {
  if (char.newTag.trim() && !char.tags.includes(char.newTag.trim())) {
    char.tags.push(char.newTag.trim())
    char.newTag = ''
  }
}

function removeAppearanceTag(char: CharAppearance, idx: number) {
  char.tags.splice(idx, 1)
}

// 检测角色是否为"非人形"（球体、灵体、物件、AI等）
const NON_HUMAN_KEYWORDS = [
  // 形态描述
  '无实体', '光球', '球体', '光体', '灵体', '智能体', '意识体', '能量体',
  '无固定形态', '无形', '无形体', '不定形',
  // 生物类
  '精灵', '幽灵', '鬼魂', '灵魂', '怪物', '动物', '兽', '龙', '神兽',
  // 机械/AI
  '机械', '机器人', 'AI', '人工智能', '智脑', '程序', '数字生命',
  // 非人标记
  '非人', '非生物',
  // 物件/自然
  '剑', '刀', '法宝', '神器', '阵法', '符文', '元素', '火焰', '水流',
  '云', '雾', '影', '树', '花', '星球', '飞船', '载具', '建筑',
]
function isNonHumanChar(char: CharAppearance): boolean {
  const outfit = getActiveOutfit(char)
  // 检测范围：名称 + 角色定位 + 标签 + 所有描述
  const allText = [
    char.name,
    char.role,
    ...outfit.tags, ...char.tags,
    outfit.description, char.description,
  ].join(' ').toLowerCase()
  return NON_HUMAN_KEYWORDS.some(kw => allText.includes(kw.toLowerCase()))
}

// 非人形角色的视角后缀：已被 buildNonHumanGeometryPrompt 内部处理
// 此函数保留作为 regenerateView 的兼容层（viewSuffix 拼接点）
// 注意：新引擎已在 prompt 内包含视角构图，此后缀仅作安全兜底
function nonHumanViewSuffix(view: CharView): string {
  // 纯空间角度描述，零 body/back/rear/figure 语义
  switch (view.key) {
    case 'front-full':  return 'front-facing view angle, direct observation'
    case 'side-full':   return 'side profile angle, curved contour visible'
    // "back view" / "rear" 在图像模型里直接触发人体解剖联想（肩膀/脊椎/后颈）
    // 必须用纯几何方位词替代
    case 'back-full':   return 'reverse viewing angle, opposite-side perspective, equatorial curvature detail'
    case 'front-upper': return 'close-up surface detail, texture macro shot'
    default:            return 'centered abstract composition, detailed observation'
  }
}

async function generateCharRefImage(char: CharAppearance, charIdx: number, viewKey?: string) {
  // 获取当前激活造型
  const outfit = getActiveOutfit(char)
  const outfitViews = outfit.views

  // 使用结构化 prompt 引擎构建基础 prompt + negativePrompt
  const { prompt: basePrompt, negativePrompt } = buildCharacterPrompt(char, outfit, viewKey || 'front-upper')

  // 检测是否为非人形角色
  const nonHuman = isNonHumanChar(char)

  // Helper to generate a single view（支持可选 referenceImage 用于人物一致性）
  // 容错策略：参考图 URL 若被 API 拒绝（invalid url 等），自动降级为无参考图重试一次
  // 注意：prompt 始终完整构建（basePrompt + viewSuffix），参考图只是额外一致性锚点，不替代提示词
  const generateOneView = async (viewIdx: number, refUrl?: string) => {
    const view = outfitViews[viewIdx]!
    if (view.generating) return
    view.generating = true
    view.imageUrl = undefined
    view.error = undefined
    characterAppearances.value = [...characterAppearances.value]

    const viewSuffix = nonHuman ? nonHumanViewSuffix(view) : view.promptSuffix
    const prompt = `${basePrompt}, ${viewSuffix}`
    console.log('[角色图] view=%s prompt=%s', view.key, prompt)

    // 判断是否传入参考图（人形 + 非localhost URL）
    const shouldUseRef = !nonHuman && !!refUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(refUrl)

    // 内部执行器：支持重试时剥离 referenceImages
    const doGenerate = async (useRef: boolean): Promise<string[]> => {
      return generateImage({
        prompt,
        size: '1024x1024' as any,
        n: 1        ,
        referenceImages: useRef && shouldUseRef ? [refUrl!] : undefined,
        negativePrompt,
        seed: Math.floor(Math.random() * 2147483647),
      })
    }

    try {
      // 第一次尝试：带参考图（如果可用）
      let urls = await doGenerate(/* useRef */ true)

      // 如果带参考图失败且错误与 URL 相关 → 自动降级为无参考图重试
      if (!urls || urls.length === 0) {
        throw new Error('empty response')
      }
      view.imageUrl = urls[0]
    } catch (e: any) {
      const errData = e?.response?.data
      const errMsg = errData?.message || errData?.error?.message || e?.message || ''
      const isUrlError = /invalid\s+url|url\s+(required|specified|invalid)|bad\s+url|malformed/i.test(errMsg)

      if (shouldUseRef && isUrlError) {
        console.warn('[角色图] 参考图URL被API拒绝(%s)，降级为无参考图重试 view=%s', errMsg, view.key)
        try {
          const retryUrls = await doGenerate(/* useRef */ false)
          if (retryUrls && retryUrls.length > 0) {
            view.imageUrl = retryUrls[0]
            return
          }
        } catch (retryErr: any) {
          console.error('[角色图] 降级重试也失败 view=%s:', view.key, retryErr?.message)
        }
      }

      // 所有尝试都失败了，展示最终错误
      console.error('[角色图] full error view=%s status=%s body=%s',
        view.key,
        e?.response?.status ?? e?.status ?? '?',
        JSON.stringify(errData ?? e?.message ?? e))
      view.error = errMsg || '生成失败'
    } finally {
      view.generating = false
      characterAppearances.value = [...characterAppearances.value]
    }
  }

  // Regenerate a single view
  if (viewKey) {
    const viewIdx = outfitViews.findIndex(v => v.key === viewKey)
    if (viewIdx === -1) return

    // 单视角重生成：人形非正面 → 以正面图为锚点；其他 fallback 无参考或自身旧图
    const view = outfitViews[viewIdx]!
    let refUrl: string | undefined
    if (!nonHuman && view.key !== 'front-full') {
      const anchor = outfitViews.find(v => v.key === 'front-full')
      if (anchor?.imageUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(anchor.imageUrl)) {
        refUrl = anchor.imageUrl
      }
    }
    await generateOneView(viewIdx, refUrl)
    return
  }

  // ── 批量生成全部视图：人形角色采用「先正面后其余」策略保证一致性 ──
  const missingIndices = outfitViews
    .map((v, i) => i)
    .filter(i => !outfitViews[i]!.imageUrl)

  if (missingIndices.length === 0) return

  if (!nonHuman) {
    // 人形角色：① 先生成正面全身（无参考）→ ② 用正面图做锚点并行生成其余视角
    const frontFullIdx = missingIndices.findIndex(i => outfitViews[i]!.key === 'front-full')
    const restIndices = missingIndices.filter(i => outfitViews[i]!.key !== 'front-full')

    if (frontFullIdx !== -1) {
      // 步骤 1：先生成正面全身（锚点）
      await generateOneView(frontFullIdx)
      // 步骤 2：拿到正面 URL 后并行生成剩余视角（以正面为参考基准）
      const frontUrl = outfitViews.find(v => v.key === 'front-full')?.imageUrl
      if (restIndices.length > 0 && frontUrl) {
        await Promise.all(restIndices.map(idx => generateOneView(idx, frontUrl)))
      } else if (restIndices.length > 0) {
        // 正面生成失败时 fallback：剩余视角无参考独立生成
        await Promise.all(restIndices.map(idx => generateOneView(idx)))
      }
    } else {
      // 正面已存在，直接用正面图做锚点并行生成缺失的其余视角
      const existingFront = outfitViews.find(v => v.key === 'front-full')
      const frontUrl = existingFront?.imageUrl
      if (frontUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(frontUrl)) {
        await Promise.all(missingIndices.map(idx => generateOneView(idx, frontUrl)))
      } else {
        await Promise.all(missingIndices.map(idx => generateOneView(idx)))
      }
    }
  } else {
    // 非人形角色：全部并行、无参考图（避免人形污染）
    await Promise.all(missingIndices.map(idx => generateOneView(idx)))
  }
}

const anyViewGenerating = (char: CharAppearance) => getActiveOutfit(char).views.some(v => v.generating)
const allViewsDone = (char: CharAppearance) => getActiveOutfit(char).views.every(v => v.imageUrl)
const anyViewError = (char: CharAppearance) => getActiveOutfit(char).views.some(v => v.error)

function deleteCharacter(charId: number) {
  characterAppearances.value = characterAppearances.value.filter(c => c.id !== charId)
}

function onVoiceChange(char: CharAppearance, voiceId: string) {
  if (!voiceId) {
    char.voiceId = undefined
    char.voiceName = undefined
    return
  }
  const preset = VOICE_PRESETS.find(v => v.id === voiceId)
  char.voiceId = voiceId
  char.voiceName = preset?.name || voiceId
}

// 独立的重新生成单个角度函数 - 直接修改 + 浅拷贝触发更新
async function regenerateView(charIdx: number, viewIdx: number) {
  console.log('[regen] clicked', { charIdx, viewIdx })
  const char = characterAppearances.value[charIdx]
  if (!char) { console.warn('[regen] no char at idx', charIdx); return }
  // 统一读写活跃造型的 views（char.views 是旧位置，outfit 系统后数据在 outfits[].views）
  const outfit = getActiveOutfit(char)
  const view = outfit.views[viewIdx]
  if (!view) { console.warn('[regen] no view at idx', viewIdx); return }
  if (view.generating) { console.log('[regen] already generating, skip'); return }

  // 构建 prompt — 全部走 buildCharacterPrompt 以保证中文翻译，防止 Seedream 400
  const nonHuman = isNonHumanChar(char)
  const { prompt: basePrompt, negativePrompt } = buildCharacterPrompt(char, outfit, view.key)
  const viewSuffix = nonHuman ? nonHumanViewSuffix(view) : (view.promptSuffix ?? '')
  const prompt = `${basePrompt}, ${viewSuffix}`

  // 找锚点图做参考（从活跃造型的 views 读取）
  // F-04 前端就绪：当已生成图为非 localhost 公网 URL 时，作为参考图传入，提升重生成一致性；
  // localhost-only 旧数据则跳过（Seedream API 无法访问本地回环地址，需后端转存对象存储后自动生效）。
  // ⚠️ 非人形角色禁用参考图：旧图若含残留人形元素，会作为图生图基准强烈诱导模型复制人形，
  //   导致 prompt 层的 non-human 防护（NOT a human / negative prompt）完全失效。
  // 🎯 人形角色一致性策略：所有视角（除正面自身）统一以「正面全身」为参考基准，
  //   保证同一张脸、同一发型、同一套服装。正面全身自身则用自己旧图或无参考。
  // 🔄 容错：若 API 拒绝参考图URL（invalid url），自动降级为无参考图重试，prompt 不变。
  const isFrontFull = view.key === 'front-full'
  const anchorView = outfit.views.find(v => v.key === 'front-full')
  const anchorUrl = anchorView?.imageUrl
  const hasValidAnchor = !nonHuman && !isFrontFull && !!anchorUrl
    && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(anchorUrl)
  const hasValidSelf = !isFrontFull && !!view.imageUrl
    && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(view.imageUrl)

  // 设置生成状态 — 直接修改属性 + 浅拷贝数组触发响应式
  view.generating = true
  view.imageUrl = undefined
  view.error = undefined
  characterAppearances.value = [...characterAppearances.value]

  console.log('[regen] calling API...', { prompt: prompt.slice(0, 80), hasAnchor: hasValidAnchor })

  // 内部执行器
  const doRegen = async (useRef: boolean): Promise<string[]> => {
    let refImgs: string[] | undefined
    if (useRef) {
      if (hasValidAnchor) refImgs = [anchorUrl!]
      else if (hasValidSelf) refImgs = [view.imageUrl!]
    }
    return generateImage({ prompt, size: '1024x1024' as any, n: 1, referenceImages: refImgs, negativePrompt })
  }

  try {
    // 第一次尝试：带参考图（如果可用）
    let urls = await doRegen(/* useRef */ true)

    // 参考图被拒 → 自动降级无参考图
    if (!urls || urls.length === 0) {
      throw new Error('empty response')
    }
    view.imageUrl = urls[0]
  } catch (e: any) {
    const errMsg = e?.response?.data?.message || e?.response?.data?.error?.message || e?.message || ''
    const isUrlError = /invalid\s+url|url\s+(required|specified|invalid)|bad\s+url|malformed/i.test(errMsg)
    const hadRef = hasValidAnchor || hasValidSelf

    if (hadRef && isUrlError) {
      console.warn('[regen] 参考图URL被API拒绝(%s)，降级重试 view=%s', errMsg, view.key)
      try {
        const retryUrls = await doRegen(/* useRef */ false)
        if (retryUrls && retryUrls.length > 0) {
          view.imageUrl = retryUrls[0]
          return
        }
      } catch (retryErr: any) {
        console.error('[regen] 降级重试也失败:', retryErr?.message)
      }
    }

    // 所有尝试都失败了
    view.error = errMsg || '生成失败'
    console.error('[regen] API error:', errMsg)
  } finally {
    view.generating = false
    characterAppearances.value = [...characterAppearances.value]
    console.log('[regen] done, imageUrl:', !!view.imageUrl, 'error:', view.error || 'none')
  }
}

// ── 图片预览模态框 ──
const previewModalVisible = ref(false)
const previewModalUrl = ref('')
const previewModalTitle = ref('')
const previewModalRegenerating = ref(false)
const previewModalShotId = ref<string | null>(null)
let previewModalOnRegenerate: (() => Promise<void>) | null = null

function openImagePreview(url: string, title: string, onRegenerate?: () => Promise<void>, shotId?: string) {
  previewModalUrl.value = url
  previewModalTitle.value = title
  previewModalOnRegenerate = onRegenerate || null
  previewModalShotId.value = shotId || null
  previewModalRegenerating.value = false
  previewModalVisible.value = true
}

function closeImagePreview() {
  previewModalVisible.value = false
  previewModalOnRegenerate = null
  previewModalRegenerating.value = false
  previewModalShotId.value = null
}

async function regenerateFromModal() {
  if (!previewModalOnRegenerate || previewModalRegenerating.value) return
  previewModalRegenerating.value = true
  try {
    await previewModalOnRegenerate()
    // 如果是分镜预览，自动刷新模态框图片
    if (previewModalShotId.value) {
      const newUrl = shotPreviewUrls.value.get(previewModalShotId.value)
      if (newUrl) previewModalUrl.value = newUrl
    }
  } finally {
    previewModalRegenerating.value = false
  }
}

// ── 角色素材库 ──
const ASSET_LIBRARY_KEY = 'mhw:character-library'

interface SavedCharacter {
  id: string
  name: string
  role: string
  tags: string[]
  avatar: string
  views: Array<{ key: string; label: string; imageUrl?: string }>
  outfits?: Array<{ id: string; name: string; tags: string[]; description: string; views: Array<{ key: string; label: string; imageUrl?: string }> }>
  savedAt: string
}

const characterLibrary = ref<SavedCharacter[]>([])
const showLibraryPanel = ref(false)
const libraryMessage = ref('')

// 从 localStorage 加载素材库
function loadCharacterLibrary() {
  try {
    const raw = localStorage.getItem(ASSET_LIBRARY_KEY)
    if (raw) {
      characterLibrary.value = JSON.parse(raw)
    }
  } catch (e) {
    console.warn('[素材库] 加载失败', e)
    characterLibrary.value = []
  }
}

// 保存素材库到 localStorage
function saveCharacterLibrary() {
  try {
    localStorage.setItem(ASSET_LIBRARY_KEY, JSON.stringify(characterLibrary.value))
  } catch (e) {
    console.warn('[素材库] 保存失败', e)
  }
}

// 将当前角色保存到素材库
function saveCharToLibrary(char: CharAppearance) {
  // 从活跃造型的 views 读取（outfit 系统后数据在 outfits[].views，char.views 是旧位置）
  const activeOutfit = getActiveOutfit(char)
  const savedViews = activeOutfit.views.map(v => ({
    key: v.key,
    label: v.label,
    imageUrl: v.imageUrl,
  }))
  const savedOutfits = (char.outfits || []).map(o => ({
    id: o.id,
    name: o.name,
    tags: [...o.tags],
    description: o.description,
    views: o.views.map(v => ({ key: v.key, label: v.label, imageUrl: v.imageUrl })),
  }))
  const savedChar: SavedCharacter = {
    id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: char.name,
    role: char.role,
    tags: [...char.tags],
    avatar: char.avatar,
    views: savedViews,
    outfits: savedOutfits,
    savedAt: new Date().toISOString(),
  }

  // 检查是否已存在同名角色，如存在则更新
  const existIdx = characterLibrary.value.findIndex(c => c.name === char.name)
  if (existIdx >= 0) {
    characterLibrary.value[existIdx] = savedChar
  } else {
    characterLibrary.value.push(savedChar)
  }
  saveCharacterLibrary()
  libraryMessage.value = `已保存「${char.name}」到素材库`
  setTimeout(() => { libraryMessage.value = '' }, 3000)
}

// 将所有已生成图片的角色保存到素材库
function saveAllCharsToLibrary() {
  let count = 0
  for (const char of characterAppearances.value) {
    if (getActiveOutfit(char).views.some(v => v.imageUrl)) {
      saveCharToLibrary(char)
      count++
    }
  }
  libraryMessage.value = `已保存 ${count} 个角色到素材库`
  setTimeout(() => { libraryMessage.value = '' }, 3000)
}

// 从素材库导入角色到当前项目
function importCharFromLibrary(saved: SavedCharacter) {
  const importedViews = createEmptyViews().map(v => {
    const savedView = saved.views.find(sv => sv.key === v.key)
    return { ...v, imageUrl: savedView?.imageUrl }
  })
  const importedOutfits: OutfitVariant[] = saved.outfits
    ? saved.outfits.map(o => ({
        id: o.id || nextOutfitId(Date.now()),
        name: o.name,
        tags: [...o.tags],
        newTag: '',
        description: o.description,
        views: createEmptyViews().map(v => {
          const sv = o.views.find(sv => sv.key === v.key)
          return { ...v, imageUrl: sv?.imageUrl }
        }),
        generating: false,
      }))
    : []
  const newChar: CharAppearance = migrateCharacter({
    id: Date.now() + Math.random(),
    name: saved.name,
    role: saved.role,
    avatar: saved.avatar,
    tags: [...saved.tags],
    newTag: '',
    showDetail: true,
    views: importedViews,
    description: '',
    outfits: importedOutfits,
    activeOutfitId: importedOutfits.length > 0 ? importedOutfits[0].id : null,
  })
  characterAppearances.value.push(newChar)
  showLibraryPanel.value = false
  libraryMessage.value = `已导入「${saved.name}」`
  setTimeout(() => { libraryMessage.value = '' }, 3000)
}

// 从素材库删除角色
function removeFromLibrary(id: string) {
  characterLibrary.value = characterLibrary.value.filter(c => c.id !== id)
  saveCharacterLibrary()
}

// 初始化加载素材库
onMounted_SB(() => {
  detectLightweightMode()
  loadCharacterLibrary()

  // ── 从项目库加载已有角色和场景（跨集复用）──
  loadProjectCharacters()
  loadProjectScenes()
  loadAvailableProjects()

  // ── 从小说编辑器接收 bridge 数据 ──
  if (route.query.from === 'story') {
    try {
      const raw = sessionStorage.getItem('mhw:bridge:story::animation')
      if (raw) {
        const storyData = JSON.parse(raw)
        // 填充项目名
        if (storyData.title) projectName.value = storyData.title
        // 从章节拼接小说文本
        if (Array.isArray(storyData.chapters) && storyData.chapters.length > 0) {
          uploadedText.value = storyData.chapters
            .map((ch: any) => `【${ch.title || `第${ch.number || ''}章`}】\n${ch.content || ''}`)
            .join('\n\n')
        } else if (storyData.outline) {
          uploadedText.value = storyData.outline
        }
        // 从角色列表填充 characterAppearances
        if (Array.isArray(storyData.characters) && storyData.characters.length > 0) {
          const AVATARS = ['🧑', '👩', '👴', '🧙', '🧒', '👨', '👧', '🧓']
          characterAppearances.value = storyData.characters.map((char: any, i: number) => {
            const role = (char.archetype || '').toLowerCase()
            const name = (char.name || '')
            const isFemale = /女|母|姐|妹|娘|妃|后|婆|嫂|仙姑|夫人|公主|女主|校花|美女/.test(role + name)
            const defaultVoice = isFemale
              ? VOICE_PRESETS.find(v => v.gender === 'female')
              : VOICE_PRESETS.find(v => v.gender === 'male')
            return {
              id: i + 1,
              name: char.name || `角色${i + 1}`,
              role: char.archetype || '未知',
              avatar: AVATARS[i % AVATARS.length],
              tags: char.appearance
                ? char.appearance.split(/[,，、\s]+/).filter(Boolean).slice(0, 6)
                : [],
              newTag: '',
              showDetail: false,
              views: createEmptyViews(),
              description: '',
              voiceId: defaultVoice?.id,
              voiceName: defaultVoice?.name,
            }
          })
        }
        // 从世界观/类型信息设置世界观预设
        if (storyData.genre) {
          const genreMap: Record<string, string> = {
            '古风': 'ancient', '仙侠': 'xianxia', '都市': 'modern', '科幻': 'scifi',
            '武侠': 'wuxia', '奇幻': 'fantasy-west', '恐怖': 'horror',
          }
          if (genreMap[storyData.genre]) {
            selectedWorldview.value.primary = genreMap[storyData.genre]!
          }
        }
        if (storyData.worldview) {
          customWorldviewText.value = storyData.worldview
          if (!selectedWorldview.value.primary) selectedWorldview.value.primary = 'custom'
        }
        // 注意：不删除 sessionStorage，用户可能回退
        console.info('[StoryboardEditor] 已从小说编辑器接收 bridge 数据')
      }
    } catch (e) {
      console.warn('[StoryboardEditor] 解析 bridge 数据失败:', e)
    }
  }
})

// ── Step 3: 场景提取 ──
interface SceneView {
  angle: string
  imageUrl: string
}

interface SceneItem {
  id: number
  name: string
  icon: string
  mood: string
  environmentDesc: string
  imageUrl?: string
  imageGenerating: boolean
  timeOfDay?: string
  colorTone?: string
  sceneType?: string
  views: SceneView[]
  currentAngle: string
  /** AI 为每个视角量身定制的英文提示词 */
  viewDescriptions?: Record<string, string>
}

const SCENE_ICONS = ['🏯', '🏠', '🌳', '⛰️', '🌊', '🏙️', '🌙', '☀️', '🔥', '❄️', '🌸', '⚫']

const SCENE_ANGLE_OPTIONS = [
  { id: 'wide', label: '全景', promptHint: 'wide establishing shot, full environment view, panoramic' },
  { id: 'detail', label: '细节', promptHint: 'detail shot, close-up view of environment features and textures' },
  { id: 'high', label: '俯瞰', promptHint: 'aerial/bird\'s eye view, looking down at the environment' },
  { id: 'low', label: '仰视', promptHint: 'low angle shot, looking up, emphasizing height and scale' },
]

const COLOR_TONE_MAP: Record<string, string> = {
  '暖色调': 'warm color palette, golden-orange tones',
  '冷色调': 'cool color palette, blue-cyan tones',
  '中性色调': 'neutral balanced color palette',
  '高对比度': 'high contrast, bold light-shadow separation',
  '低饱和度': 'desaturated muted colors, faded tones',
}
const TIME_OF_DAY_MAP: Record<string, string> = {
  '白天': 'daytime, bright sunlight',
  '夜晚': 'nighttime, moonlight and stars',
  '黄昏': 'dusk, golden hour, long shadows',
  '黎明': 'dawn, early morning light, pink sky',
  '全天': 'any time of day',
}

const extractedScenes = ref<SceneItem[]>([])
const extractingScenes = ref(false)
const extractScenesError = ref('')

/** 保存到素材库的状态（按本地 scene.id 记录） */
const savingToLib = ref<Record<number, boolean>>({})
const savedToLib = ref<Record<number, boolean>>({})
const saveLibError = ref('')

async function extractScenes() {
  if (extractingScenes.value) return
  extractingScenes.value = true
  extractScenesError.value = ''

  const text = uploadedText.value.trim()
  if (!text) {
    extractScenesError.value = '请先在步骤 1 输入小说文本，再点击提取'
    extractingScenes.value = false
    return
  }

  const token = getToken()
  if (!token) {
    extractScenesError.value = '请先登录后再使用 AI 提取功能'
    extractingScenes.value = false
    return
  }

  try {
    const result = await generateText({
      systemPrompt:
        '你是一个专业的影视取景规划师。从小说文本中提取故事发生的场景/地点。\n' +
        '注意：每个场景是对一个地点的环境描述，不包含角色动作或剧情。\n' +
        '就像电影开拍前的取景工作，只描述环境本身：建筑、地形、光线、氛围、空间特征。\n\n' +
        '每个场景包含：\n' +
        '- name：地点名称（如"考古工地·荒野裂隙"、"幽冥深渊·入口"）\n' +
        '- mood：氛围关键词（2-4字，如"压抑""壮观""神秘"）\n' +
        '- environmentDesc：环境描述（15-40字，纯环境，不含角色动作。描述这个地点长什么样）\n' +
        '- timeOfDay：时间段（白天/夜晚/黄昏/黎明，择一）\n' +
        '- sceneType：空间类型（室外/室内/地下/天空/水下/宇宙/虚拟空间，择一）\n' +
        '- colorTone：色调（暖色调/冷色调/中性色调/高对比度/低饱和度，择一）\n' +
        '- viewDescriptions：4个视角的英文图片生成提示词（用于AI绘图），每个是针对该场景量身定制的：\n' +
        '  - wide：全景/远景，展示整个场景的全貌和环境氛围\n' +
        '  - detail：细节特写，聚焦该场景中最有特色的局部元素（比如考古工地的陶片、深渊的岩壁纹理）\n' +
        '  - high：俯瞰/鸟瞰，从上方看场景的布局和空间结构\n' +
        '  - low：仰视/低角度，从地面向上看，展示场景的高度和天际线\n' +
        '  每个提示词30-60个英文单词，纯英文，包含具体的视觉元素，不含人物，末尾加"no humans, no people, no characters"。\n' +
        (worldviewContext.value ? `\n【世界观背景】\n${worldviewContext.value}\n请确保场景环境与上述世界观一致。\n` : '') +
        '最多提取8个地点，按故事时间线排序。\n' +
        '只返回 JSON 数组，不要其他文字。格式示例：\n' +
        '[{"name":"考古工地·龟裂荒原","mood":"压抑","environmentDesc":"荒野中的发掘现场，龟裂大地延伸至远处废墟，黄沙漫天","timeOfDay":"黄昏","sceneType":"室外","colorTone":"暖色调","viewDescriptions":{"wide":"Wide establishing shot of an archaeological excavation site in cracked wilderness, ancient ruins in background, yellow dust swirling in golden hour light, desolate atmosphere, no humans, no people, no characters","detail":"Extreme close-up of cracked earth surface at excavation site, pottery fragments and ancient debris scattered on dry ground, weathered soil texture, warm dusk light, no humans, no people, no characters","high":"Aerial top-down view of archaeological dig site layout, grid patterns of excavation trenches cut into cracked earth, scattered ruins and equipment placement visible from above, golden hour, no humans, no people, no characters","low":"Ground-level view looking up from excavation trench, crumbling earth walls framing dramatic dusk sky, dust particles floating in warm light, sense of depth and scale, no humans, no people, no characters"}}]',
      prompt: `请从以下小说文本中提取主要场景地点：\n\n${text.slice(0, 4000)}`,
    })

    // 解析 JSON（兼容 markdown code block 包裹 + 容错修复）
    const parsed: Array<{ name: string; mood: string; environmentDesc: string; description?: string; timeOfDay?: string; sceneType?: string; colorTone?: string; viewDescriptions?: Record<string, string> }> = parseAIJson(result)

    if (Array.isArray(parsed) && parsed.length > 0) {
      extractedScenes.value = parsed.slice(0, 8).map((s, i) => ({
        id: i + 1,
        name: s.name || `场景${i + 1}`,
        icon: SCENE_ICONS[i % SCENE_ICONS.length]!,
        mood: s.mood || '未知',
        environmentDesc: s.environmentDesc || s.description || '',
        timeOfDay: s.timeOfDay || '',
        sceneType: s.sceneType || '',
        colorTone: s.colorTone || '',
        imageGenerating: false,
        views: [],
        currentAngle: 'wide',
        viewDescriptions: s.viewDescriptions,
      }))
    }
    markCompleted(3) // scene step (index 3 in 8-step flow)
    // 保存到项目场景库（DB 持久化）
    saveScenesToProject()
  } catch (e: any) {
    console.warn('[场景提取] API 调用失败', e)
    extractScenesError.value = `AI 提取失败：${e?.message || '未知错误'}，请重试`
  } finally {
    extractingScenes.value = false
  }
}

/**
 * 将当前场景数据保存到项目场景库（DB 持久化）
 */
async function saveScenesToProject() {
  const pid = effectiveProjectId()
  if (!pid || extractedScenes.value.length === 0) return

  try {
    const { useSceneStore } = await import('@/stores/sceneStore')
    const sceneStore = useSceneStore()

    if (sceneStore.projectId !== pid) {
      await sceneStore.load(pid)
    }

    for (const scene of extractedScenes.value) {
      const existing = sceneStore.scenes.find(s => s.name === scene.name)
      if (!existing) {
        try {
          await sceneStore.create({
            name: scene.name,
            description: scene.environmentDesc || '',
            scene_type: scene.sceneType,
            light_color_temp: scene.colorTone,
            tags: scene.mood ? [scene.mood] : [],
          })
          console.log('[场景库] 保存场景:', scene.name)
        } catch (createErr: any) {
          console.warn('[场景库] 保存失败:', scene.name, createErr?.message)
        }
      }
    }
  } catch (err: any) {
    console.warn('[场景库] 保存失败（store 不可用）:', err?.message)
  }
}

/**
 * 从项目场景库加载已有场景（跨集复用）
 */
async function loadProjectScenes() {
  const pid = effectiveProjectId()
  if (!pid || projectScenesLoaded.value) return

  try {
    const { useSceneStore } = await import('@/stores/sceneStore')
    const sceneStore = useSceneStore()
    await sceneStore.load(pid)

    if (sceneStore.scenes.length > 0 && extractedScenes.value.length === 0) {
      const SCENE_ICONS_LOCAL = ['🏔️', '🏛️', '🌊', '🌲', '🏙️', '🏯', '🌋', '🏜️']
      extractedScenes.value = sceneStore.scenes.map((s, i) => ({
        id: i + 1,
        name: s.name,
        icon: SCENE_ICONS_LOCAL[i % SCENE_ICONS_LOCAL.length]!,
        mood: s.tags?.[0] || '',
        environmentDesc: s.description || '',
        timeOfDay: '',
        sceneType: s.scene_type || '',
        colorTone: s.light_color_temp || '',
        imageGenerating: false,
        views: [],
        currentAngle: 'wide',
      }))
      console.log('[场景库] 从项目加载了', sceneStore.scenes.length, '个场景')
    }
    } catch (err: any) {
    console.warn('[场景库] 加载失败:', err?.message)
  } finally {
    projectScenesLoaded.value = true
  }
}

/**
 * 将已生成的场景图「保存到素材库」（project-service scenes 资源，携带 thumbnail_url）
 * - 同名场景已存在 → PATCH 回填 thumbnail_url（及描述/类型），实现「引用 + 可改」
 * - 不存在 → POST 新建（携带 thumbnail_url）
 * 路径对齐 project-service 真实路由 /api/v1/scenes（见 sceneStore）
 */
async function saveSceneToLibrary(scene: SceneItem) {
  const pid = effectiveProjectId()
  if (!pid) {
    saveLibError.value = '请先在右上角选择「素材归属项目」，再保存到素材库'
    return
  }
  if (!scene.imageUrl) {
    saveLibError.value = '请先生成场景图，再保存到素材库'
    return
  }
  savingToLib.value = { ...savingToLib.value, [scene.id]: true }
  saveLibError.value = ''
  try {
    const { useSceneStore } = await import('@/stores/sceneStore')
    const sceneStore = useSceneStore()
    if (sceneStore.projectId !== pid) await sceneStore.load(pid)

    const payload = {
      name: scene.name,
      description: scene.environmentDesc || '',
      scene_type: scene.sceneType,
      light_color_temp: scene.colorTone,
      thumbnail_url: scene.imageUrl,
      tags: scene.mood ? [scene.mood] : [],
    }

    const existing = sceneStore.scenes.find(s => s.name === scene.name)
    if (existing) {
      await sceneStore.update(existing.id, payload)
    } else {
      await sceneStore.create(payload)
    }
    savedToLib.value = { ...savedToLib.value, [scene.id]: true }
  } catch (e: any) {
    saveLibError.value = `保存到素材库失败：${e?.message || '未知错误'}`
  } finally {
    savingToLib.value = { ...savingToLib.value, [scene.id]: false }
  }
}

/* ================================================================== */
/* 📦 设定资产生成（武器 / 道具 / 饰品 / 特效·技能）                      */
/* 流程：场景图生成成功后 AI 自动识别本场景提及的素材 → 用户点「生成」→   */
/*   · 静态(武器/道具/饰品): 复用动画画风引擎(getStylePrompt)+持久 seed    */
/*     出固定样式四宫格(4 角度: 正面/侧面/细节/俯视)，保证整部一致          */
/*   · 特效·技能: 先出静帧缩略图，再走 generateVideo 出参考动图(clip)       */
/*   生成结果存入 assetStore(项目归属) → 素材中心按项目查看 / 视频引用(#67) */
/* ================================================================== */

/** 每个场景/角色识别到的素材清单：key = `scene:${id}` / `char:${id}` */
const sceneAssets = ref<Record<number, DetectedAsset[]>>({})
const charAssets = ref<Record<number, DetectedAsset[]>>({})
/** 正在识别中的标记 */
const assetExtracting = ref<Record<string, boolean>>({})

interface AssetView { angle: string; imageUrl: string }
interface DetectedAsset {
  key: string
  category: AssetCategory
  name: string
  reason: string
  generating?: boolean
  generated?: boolean
  thumbnailUrl?: string
  videoUrl?: string
  views?: AssetView[]
  error?: string
}

/** 四宫格四角度（与场景视角一致：全景/细节/俯/仰，道具改为更贴产品的角度） */
const ASSET_ANGLES = [
  { id: 'front', label: '正面', hint: 'front view, centered, full object visible, product shot' },
  { id: 'side', label: '侧面', hint: 'side profile view, three-quarter angle' },
  { id: 'detail', label: '细节', hint: 'extreme close-up detail shot, macro texture, surface material' },
  { id: 'top', label: '俯视', hint: 'top-down view, object laid flat on surface' },
] as const

/** 复用动画统一画风前缀，保证道具/特效与正片同风格 */
function buildAssetPrompt(asset: DetectedAsset, angleHint: string): string {
  const style = getStylePrompt('scene')
  const catWord: Record<AssetCategory, string> = {
    weapon: 'weapon, armament, held item',
    prop: 'prop, object, item, artifact',
    accessory: 'accessory, ornament, jewelry, wearable gear',
    effect: 'magic effect, skill visual, energy burst, aura',
  }
  const subject = `${catWord[asset.category]}, "${asset.name}", ${asset.reason || ''}, isolated on plain neutral background, clean studio lighting, highly detailed`
  let p = `${style.prefix}, ${subject}, ${angleHint}, ${style.suffix}`
  // 零 CJK 残留（Seedream 会把中文渲染成图内文字）
  p = p.replace(/[一-鿿　-〿＀-￯]+/g, '').replace(/,\s*,/g, ',').trim()
  return p
}

/** 由名称派生稳定 seed，保证同一素材多次生成风格一致 */
function seedFromText(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h) % 2147483647
}

/** 确保 assetStore 已加载当前项目的资产（用于去重） */
async function ensureAssetStoreLoaded(): Promise<boolean> {
  const pid = effectiveProjectId()
  if (!pid) return false
  if (assetStore.projectId !== pid) {
    try { await assetStore.load(pid) } catch { /* 失败回退本地，不阻塞 */ }
  }
  return true
}

/** 从场景/小说文本 AI 识别关联素材（半自动：识别后等用户点生成） */
async function extractAssetsFromScene(scene: SceneItem) {
  const key = `scene:${scene.id}`
  if (assetExtracting.value[key]) return
  assetExtracting.value = { ...assetExtracting.value, [key]: true }
  try {
    const novelSnippet = uploadedText.value.trim().slice(0, 2000)
    const worldCtx = (typeof worldviewContext !== 'undefined' && (worldviewContext as any).value)
      ? (worldviewContext as any).value : ''
    const prompt =
      `场景名：${scene.name}\n` +
      `场景环境描述：${scene.environmentDesc || ''}\n` +
      `情绪/类型：${scene.mood || ''} ${scene.sceneType || ''}\n` +
      (worldCtx ? `【世界观】${worldCtx}\n` : '') +
      (novelSnippet ? `【小说片段】${novelSnippet}\n` : '') +
      `请识别该场景（及上下文）中值得提前生成的「设定资产」，用于保证整部作品视觉一致性。\n` +
      `返回 JSON：{ "props":[{name,reason}], "weapons":[{name,reason}], "accessories":[{name,reason}], "effects":[{name,reason}] }。\n` +
      `只列具体可视觉化的物体/效果；每项 name 用中文(≤8字)，reason 简述为何出现(≤20字)。某类未出现就给空数组。只返回 JSON。`
    const res = await generateText({ systemPrompt: '你是动画设定资产分析师，擅长从场景与小说中识别应提前生成以保证一致性的道具、武器、饰品与特效。', prompt })
    const parsed = (parseAIJson(res) || {}) as { props?: any[]; weapons?: any[]; accessories?: any[]; effects?: any[] }
    const list: DetectedAsset[] = []
    const push = (cat: AssetCategory, arr?: any[]) => {
      if (!Array.isArray(arr)) return
      for (const x of arr) {
        if (x && x.name) list.push({ key: `${cat}:${x.name}`, category: cat, name: String(x.name), reason: String(x.reason || '') })
      }
    }
    push('prop', parsed.props)
    push('weapon', parsed.weapons)
    push('accessory', parsed.accessories)
    push('effect', parsed.effects)
    await ensureAssetStoreLoaded()
    for (const a of list) {
      const exists = assetStore.assets.find(x => x.name === a.name && x.category === a.category)
      if (exists) { a.generated = true; a.thumbnailUrl = exists.thumbnail_url; a.videoUrl = exists.video_url }
    }
    sceneAssets.value = { ...sceneAssets.value, [scene.id]: list }
  } catch (e: any) {
    console.warn('[素材识别] 场景失败', e?.message)
  } finally {
    const n = { ...assetExtracting.value }; delete n[key]; assetExtracting.value = n
  }
}

/** 从角色设定 AI 识别其武器/饰品（半自动） */
async function extractAssetsFromCharacter(char: CharAppearance) {
  const key = `char:${char.id}`
  if (assetExtracting.value[key]) return
  assetExtracting.value = { ...assetExtracting.value, [key]: true }
  try {
    const novelSnippet = uploadedText.value.trim().slice(0, 1500)
    const prompt =
      `角色名：${char.name}\n角色定位：${char.role || ''}\n` +
      `外貌/穿着描述：${char.description || ''}\n` +
      `特征标签：${(char.tags || []).join('、')}\n` +
      (novelSnippet ? `【小说片段】${novelSnippet}\n` : '') +
      `请识别该角色在故事中「使用或佩戴」的武器与饰品（用于提前生成保证一致性）。\n` +
      `返回 JSON：{ "weapons":[{name,reason}], "accessories":[{name,reason}] }。\n` +
      `只列具体可视觉化的武器/饰品；name 中文(≤8字)，reason 简述(≤20字)。无则空数组。只返回 JSON。`
    const res = await generateText({ systemPrompt: '你是动画设定资产分析师，擅长识别角色使用的武器与佩戴的饰品。', prompt })
    const parsed = (parseAIJson(res) || {}) as { props?: any[]; weapons?: any[]; accessories?: any[]; effects?: any[] }
    const list: DetectedAsset[] = []
    const push = (cat: AssetCategory, arr?: any[]) => {
      if (!Array.isArray(arr)) return
      for (const x of arr) {
        if (x && x.name) list.push({ key: `${cat}:${x.name}`, category: cat, name: String(x.name), reason: String(x.reason || '') })
      }
    }
    push('weapon', parsed.weapons)
    push('accessory', parsed.accessories)
    await ensureAssetStoreLoaded()
    for (const a of list) {
      const exists = assetStore.assets.find(x => x.name === a.name && x.category === a.category)
      if (exists) { a.generated = true; a.thumbnailUrl = exists.thumbnail_url; a.videoUrl = exists.video_url }
    }
    charAssets.value = { ...charAssets.value, [char.id]: list }
  } catch (e: any) {
    console.warn('[素材识别] 角色失败', e?.message)
  } finally {
    const n = { ...assetExtracting.value }; delete n[key]; assetExtracting.value = n
  }
}

/** 生成单个素材（静态四宫格 / 特效动图），并入库 */
async function generateAsset(asset: DetectedAsset) {
  if (asset.generating || asset.generated) return
  const pid = effectiveProjectId()
  if (!pid) { asset.error = '请先在顶部选择「素材归属项目」'; return }
  asset.generating = true
  asset.error = undefined
  try {
    await ensureAssetStoreLoaded()
    // 去重：同名同分类已存在则复用
    const existing = assetStore.assets.find(x => x.name === asset.name && x.category === asset.category)
    if (existing) {
      asset.generated = true
      asset.thumbnailUrl = existing.thumbnail_url
      asset.videoUrl = existing.video_url
      if (existing.thumbnail_url) asset.views = [{ angle: 'front', imageUrl: existing.thumbnail_url }]
      return
    }

    if (asset.category === 'effect') {
      // 静帧 → 参考动图
      const thumbPrompt = buildAssetPrompt(asset, 'centered energy burst, keyframe frame')
      const urls = await generateImage({ prompt: thumbPrompt, size: '1024x1024' as any, n: 1, seed: seedFromText(asset.name) })
      const thumb = urls?.[0]
      if (!thumb) throw new Error('特效静帧生成失败')
      asset.thumbnailUrl = thumb
      asset.views = [{ angle: 'front', imageUrl: thumb }]
      let videoUrl: string | undefined
      try {
        const v = await generateVideo({
          referenceImages: [thumb],
          durationSeconds: 4,
          ratio: '1:1',
          prompt: `${asset.name} magic skill effect animation, looping, cinematic, energy moving`,
          seed: seedFromText(asset.name),
        })
        videoUrl = (v as any)?.url
      } catch (ve: any) {
        console.warn('[特效动图] 视频生成失败，保留静帧', ve?.message)
      }
      asset.videoUrl = videoUrl
      await assetStore.create({
        category: asset.category,
        name: asset.name,
        description: asset.reason,
        prompt: thumbPrompt,
        thumbnail_url: thumb,
        video_url: videoUrl,
        tags: [],
      })
    } else {
      // 静态：固定样式四宫格（4 角度）
      const views: AssetView[] = []
      const seed = seedFromText(asset.name)
      for (const ang of ASSET_ANGLES) {
        const p = buildAssetPrompt(asset, ang.hint)
        const urls = await generateImage({
          prompt: p,
          size: '1024x1024' as any,
          n: 1,
          seed,
          negativePrompt: 'text, words, watermark, logo, blurry, low quality, deformed, extra objects, people',
        })
        const u = urls?.[0]
        if (u) views.push({ angle: ang.id, imageUrl: u })
      }
      if (views.length === 0) throw new Error('素材图生成失败')
      asset.views = views
      asset.thumbnailUrl = views[0]!.imageUrl
      await assetStore.create({
        category: asset.category,
        name: asset.name,
        description: asset.reason,
        prompt: buildAssetPrompt(asset, ASSET_ANGLES[0].hint),
        thumbnail_url: views[0]!.imageUrl,
        tags: [],
      })
    }
    asset.generated = true
  } catch (e: any) {
    asset.error = e?.message || '生成失败'
  } finally {
    asset.generating = false
  }
}

/** 批量生成某场景的全部素材 */
async function generateAllSceneAssets(scene: SceneItem) {
  const list = sceneAssets.value[scene.id] || []
  if (list.length === 0) return
  for (const a of list) {
    await generateAsset(a)
    sceneAssets.value = { ...sceneAssets.value }
  }
}

/** 批量生成某角色的全部装备 */
async function generateAllCharAssets(char: CharAppearance) {
  const list = charAssets.value[char.id] || []
  if (list.length === 0) return
  for (const a of list) {
    await generateAsset(a)
    charAssets.value = { ...charAssets.value }
  }
}

async function generateSceneImage(scene: SceneItem) {
  if (scene.imageGenerating) return
  scene.imageGenerating = true
  // 清除旧的脏数据：防止上一次失败/超时的残留 views（空URL或过期远程地址）干扰本次渲染
  scene.imageUrl = ''
  scene.views = []
  scene.currentAngle = 'wide'
  if (genErrorMap.value[scene.id]) {
    delete genErrorMap.value[scene.id]
    genErrorMap.value = { ...genErrorMap.value }
  }
  extractedScenes.value = [...extractedScenes.value]

  // 使用持久化 seed，保证同一场景重新生成时风格一致
  const sceneSeed = getSceneSeed(scene.name)

  try {
    // 第 1 步：生成全景主图（使用 viewDescriptions.wide 如果有，否则用通用 prompt）
    const rawWidePrompt = scene.viewDescriptions?.wide
    let prompt: string, negativePrompt: string

    if (rawWidePrompt) {
      // AI 定制的全景提示词可能含中文，需清洗后才能传给 Seedream
      const hasCJK = /[一-鿿]/.test(rawWidePrompt)
      if (hasCJK) {
        // 先用 buildScenePrompt 得到完整的英文 prompt（包含场景 mood/lighting 等），
        // 再把 AI 定制描述里已知关键词翻译结果追加进去作为补充
        const built = buildScenePrompt(scene)
        const translated = translateEnvDesc(rawWidePrompt)
        prompt = translated
          ? `${built.prompt}, ${translated}`.replace(/,\s*,/g, ',')
          : built.prompt
        negativePrompt = built.negativePrompt
      } else {
        // 纯英文，直接用
        prompt = rawWidePrompt.replace(/[一-鿿]+/g, '').replace(/,\s*,/g, ',').trim()
        negativePrompt = 'people, person, human, figure, silhouette, character, text, words, letters, watermark, logo, blurry, low quality, deformed'
      }
    } else {
      // 兜底：用通用构建器
      const built = buildScenePrompt(scene)
      prompt = built.prompt
      negativePrompt = built.negativePrompt
    }

    // 最终防线：确保零 CJK 残留
    prompt = prompt.replace(/[一-鿿　-〿＀-￯]+/g, '').replace(/,\s*,/g, ',').trim()

    const wideUrls = await generateImage({
      prompt,
      size: '1024x1024' as any,
      n: 1,
      negativePrompt,
      seed: sceneSeed,
    })

    if (!wideUrls || wideUrls.length === 0) throw new Error('AI 未返回图片')
    const wideUrl = wideUrls[0]!
    scene.imageUrl = wideUrl
    scene.views = [{ angle: 'wide', imageUrl: wideUrl }]
    extractedScenes.value = [...extractedScenes.value]

    // 第 2 步：用 AI 定制的视角提示词生成其他 3 个视角
    // 🎯 容错策略：wideUrl 作为 referenceImage 可能被 API 拒绝（临时 URL 不支持回传），
    //   检测到 invalid url 类错误时自动降级为无参考图重试，prompt 不变
    const viewAngles = ['detail', 'high', 'low'] as const

    for (const angle of viewAngles) {
      const rawViewPrompt = scene.viewDescriptions?.[angle]
      if (!rawViewPrompt) {
        // 没有定制提示词就用全景图兜底
        scene.views.push({ angle, imageUrl: wideUrl })
        continue
      }

      // 与 wide 一致：中文 viewPrompt 需清洗
      let viewPrompt: string
      if (/[一-鿿]/.test(rawViewPrompt)) {
        const translated = translateEnvDesc(rawViewPrompt)
        viewPrompt = translated || buildScenePrompt(scene).prompt
      } else {
        viewPrompt = rawViewPrompt
      }
      viewPrompt = viewPrompt.replace(/[一-鿿　-〿＀-￯]+/g, '').replace(/,\s*,/g, ',').trim()

      // 内部执行器：支持带参/不带参考图
      const doGenerateView = async (useRef: boolean): Promise<string | null> => {
        try {
          const urls = await generateImage({
            prompt: viewPrompt,
            size: '1024x1024' as any,
            n: 1,
            negativePrompt,
            seed: sceneSeed,
            referenceImages: useRef ? [wideUrl] : undefined,
          })
          return (urls && urls.length > 0) ? urls[0]! : null
        } catch (err: any) {
          // 向上抛出让外层做容错判断
          throw err
        }
      }

      try {
        // 第一次尝试：带全景图作为风格参考
        let url = await doGenerateView(/* useRef */ true)

        // 参考图被拒 → 自动降级无参考图
        if (!url) {
          scene.views.push({ angle, imageUrl: wideUrl })
          continue
        }

        scene.views.push({ angle, imageUrl: url })
      } catch (viewErr: any) {
        const errMsg = viewErr?.response?.data?.message || viewErr?.response?.data?.error?.message || viewErr?.message || ''
        const isUrlError = /invalid\s+url|url\s+(required|specified|invalid)|bad\s+url|malformed/i.test(errMsg)

        if (isUrlError) {
          console.warn(`[场景图] ${angle} 参考图URL被拒(%s)，降级无参考重试`, errMsg)
          try {
            const fallbackUrl = await doGenerateView(/* useRef */ false)
            scene.views.push({ angle, imageUrl: fallbackUrl || wideUrl })
          } catch (fallbackErr: any) {
            console.warn(`[场景图] ${angle} 降级也失败，用wide兜底`)
            scene.views.push({ angle, imageUrl: wideUrl })
          }
        } else {
          console.warn(`[场景图] ${angle} 视角生成失败(非URL类错误):`, errMsg)
          scene.views.push({ angle, imageUrl: wideUrl })
        }
      }
      extractedScenes.value = [...extractedScenes.value]
    }

    scene.currentAngle = 'wide'
    console.log('[场景图] 完成:', scene.name, '共', scene.views.length, '个视角')
    // 🎯 场景图完成后自动识别关联素材资产（武器/道具/饰品/特效），供用户一键生成
    extractAssetsFromScene(scene).catch(() => {})
  } catch (e: any) {
    console.error('[场景图生成] 失败:', e)
    // 将错误展示给用户（页面可见，替代 alert），而非静默吞掉
    const status = e?.response?.status
    const errMsg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || '场景图生成失败'
    const fullErr = `[${status || 'ERR'}] ${errMsg}`
    genErrorMap.value[scene.id] = fullErr
    genErrorMap.value = { ...genErrorMap.value }
    console.error(`[场景图生成] 场景"${scene.name}"失败: ${fullErr}`, {
      status,
      data: e?.response?.data,
      url: e?.config?.url,
      prompt: buildScenePrompt(scene).prompt.slice(0, 80),
    })
    // 保留 alert 作为二次提醒（但主要信息已在页面显示）
    // alert(`场景"${scene.name}"图片生成失败：${fullErr}`)
  } finally {
    scene.imageGenerating = false
    extractedScenes.value = [...extractedScenes.value]
  }
}

/** 获取场景的指定视角视图（仍供分镜 getSceneViewForShot 等内部逻辑使用） */
function getSceneView(scene: SceneItem, angle: string): SceneView | undefined {
  return scene.views.find(v => v.angle === angle)
}

/* ================================================================== */
/* 🎯 场景图渲染 v2 —— 最简方案                                        */
/*   原则：有 imageUrl 就直接 <img> 渲染，点击角度标签就换 imageUrl    */
/*   不再使用 background-image / previewErrorMap / debug-overlay       */
/* ================================================================== */

/** 点击角度标签 → 直接替换 scene.imageUrl，Vue 检测到 :key 变化自动重建 <img> */
function switchSceneAngle(scene: SceneItem, view: SceneView) {
  if (view.imageUrl && view.imageUrl !== scene.imageUrl) {
    scene.imageUrl = view.imageUrl
    scene.currentAngle = view.angle
  }
}

/** <img> 加载失败时的兜底：尝试从 views 中找另一个可用 URL */
function handleSceneImgError(e: Event, scene: SceneItem) {
  const img = e.target as HTMLImageElement
  console.error('[场景图v2] <img> 加载失败:', {
    src: scene.imageUrl?.slice(0, 120),
    name: scene.name,
    viewsCount: scene.views.length,
    allUrls: scene.views.map(v => ({ angle: v.angle, url: v.imageUrl?.slice(0, 60) })),
  })
  // 尝试用 views 中第一个不同于当前 URL 的视图
  const fallback = scene.views.find(v => v.imageUrl && v.imageUrl !== scene.imageUrl)
  if (fallback?.imageUrl) {
    console.log('[场景图v2] 兜底切换到:', fallback.angle, fallback.imageUrl.slice(0, 80))
    scene.imageUrl = fallback.imageUrl
    scene.currentAngle = fallback.angle
  }
}

/** 生成失败的错误信息（显示在页面上） */
const genErrorMap = ref<Record<string, string>>({})

/** 给持久化 URL 加缓存破坏参数 */
function bustCache(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}_cb=3`
}

/* ================================================================== */
/* 🔄 单视角重新生成（保留功能，供未来从分镜面板调用）                      */
/* ================================================================== */

/** 重新生成单个视角 — 容错：参考图URL被拒时自动降级无参考图重试 */
async function regenerateSceneView(scene: SceneItem, angle: string) {
  if (scene.imageGenerating) return  // 防止重复点击
  const rawPrompt = scene.viewDescriptions?.[angle]
  if (!rawPrompt) {
    console.warn('[场景图] 无视角提示词:', angle)
    return
  }

  // 若 viewDescriptions 中含有中文（手动编辑或 AI 返回中文），先翻译再传 Seedream
  const hasCJK = /[一-鿿㐀-䶿]/.test(rawPrompt)
  const prompt = hasCJK
    ? (translateEnvDesc(rawPrompt) || rawPrompt.replace(/[一-鿿㐀-䶿　-〿＀-￯]/g, '').trim() || 'environment scene')
    : rawPrompt

  scene.imageGenerating = true
  extractedScenes.value = [...extractedScenes.value]
  const negativePrompt = 'people, person, human, figure, silhouette, character, text, words, letters, watermark, logo, blurry, low quality, deformed, chinese characters'
  const wideView = scene.views.find(v => v.angle === 'wide')
  const hasValidRef = angle !== 'wide' && !!wideView?.imageUrl
    && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(wideView.imageUrl)

  // 内部执行器
  const doRegen = async (useRef: boolean): Promise<string[]> => {
    return generateImage({
      prompt,
      size: '1024x1024' as any,
      n: 1,
      negativePrompt,
      seed: getSceneSeed(scene.name),
      referenceImages: useRef && hasValidRef ? [wideView!.imageUrl] : undefined,
    })
  }

  try {
    let urls = await doRegen(/* useRef */ true)

    if (!urls || urls.length === 0) throw new Error('empty response')

    const idx = scene.views.findIndex(v => v.angle === angle)
    if (idx >= 0) {
      scene.views[idx] = { angle, imageUrl: urls[0]! }
    } else {
      scene.views.push({ angle, imageUrl: urls[0]! })
    }
    if (angle === 'wide') scene.imageUrl = urls[0]!
    // backgroundImage 通过 :style 绑定，imageUrl 变化 Vue 自动更新 style
    extractedScenes.value = [...extractedScenes.value]
  } catch (e: any) {
    const errMsg = e?.response?.data?.message || e?.response?.data?.error?.message || e?.message || ''
    const isUrlError = /invalid\s+url|url\s+(required|specified|invalid)|bad\s+url|malformed/i.test(errMsg)

    if (hasValidRef && isUrlError) {
      console.warn(`[场景图] 重生成 ${angle} 参考图被拒(%s)，降级无参考重试`, errMsg)
      try {
        const fallbackUrls = await doRegen(/* useRef */ false)
        if (fallbackUrls && fallbackUrls.length > 0) {
          const idx = scene.views.findIndex(v => v.angle === angle)
          if (idx >= 0) scene.views[idx] = { angle, imageUrl: fallbackUrls[0]! }
          else scene.views.push({ angle, imageUrl: fallbackUrls[0]! })
          if (angle === 'wide') scene.imageUrl = fallbackUrls[0]!
          extractedScenes.value = [...extractedScenes.value]
          return
        }
      } catch (fallbackErr: any) {
        console.warn(`[场景图] 重生成 ${angle} 降级也失败:`, fallbackErr?.message)
      }
    }

    console.error(`[场景图] 重新生成 ${angle} 失败:`, errMsg)
    alert(`视角"${angle}"重新生成失败：${errMsg}`)
  } finally {
    scene.imageGenerating = false
    extractedScenes.value = [...extractedScenes.value]
  }
}

/** 更新视角提示词 */
function updateViewDescription(scene: SceneItem, angle: string, value: string) {
  if (!scene.viewDescriptions) scene.viewDescriptions = {}
  scene.viewDescriptions[angle] = value
}

function deleteScene(sceneId: number) {
  extractedScenes.value = extractedScenes.value.filter(s => s.id !== sceneId)
}

const sceneImageDoneCount = computed(() => extractedScenes.value.filter(s => s.imageUrl).length)

// 批量场景图 — 进度 & 取消（参考 batchVideoCancelled 模式）
const batchSceneRunning = ref(false)
const batchSceneCancelled = ref(false)
const batchSceneProgress = ref({ done: 0, total: 0 })

async function generateAllSceneImages() {
  const pending = extractedScenes.value.filter(s => !s.imageUrl && !s.imageGenerating)
  if (pending.length === 0) return

  batchSceneRunning.value = true
  batchSceneCancelled.value = false
  batchSceneProgress.value = { done: 0, total: pending.length }

  // [性能优化 B7] 并发限制 3 个（Seedream 单次 10-30s，无限并发会打爆后端）
  const CONCURRENCY = 3
  let idx = 0
  const worker = async () => {
    while (idx < pending.length) {
      if (batchSceneCancelled.value) break
      const scene = pending[idx++]
      if (!scene) break
      await generateSceneImage(scene)
      batchSceneProgress.value = {
        ...batchSceneProgress.value,
        done: batchSceneProgress.value.done + 1,
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker))
  } finally {
    batchSceneRunning.value = false
  }
}

function cancelBatchSceneGeneration() {
  batchSceneCancelled.value = true
}

const regeneratingSceneDescId = ref<number | null>(null)

async function regenerateSceneDescription(scene: SceneItem) {
  const token = getToken()
  if (!token) return
  regeneratingSceneDescId.value = scene.id
  try {
    const result = await generateText({
      systemPrompt:
        '你是一个专业的影视取景规划师。根据场景地点名称和已有信息，生成一段纯环境描述（15-40字）。\n' +
        '注意：只描述环境本身（建筑、地形、光线、氛围），不包含角色动作或剧情。\n' +
        (worldviewContext.value ? `【世界观背景】\n${worldviewContext.value}\n请确保描述与上述世界观一致。\n` : '') +
        '只输出描述文本，不要其他内容。',
      prompt: `地点名称：${scene.name}\n氛围：${scene.mood || '未知'}\n时间段：${scene.timeOfDay || '未指定'}\n空间类型：${scene.sceneType || '未指定'}\n请生成一段环境描述：`,
    })
    scene.environmentDesc = result.trim().replace(/^["""]/g, '').replace(/["""]/g, '')
  } catch (e: any) {
    console.warn('[环境描述重生成] 失败', e)
  } finally {
    regeneratingSceneDescId.value = null
  }
}

// ── 多宫格参考图合成 ──
interface RefGridCell {
  index: number
  label: string
  imageUrl: string
  type: 'character' | 'scene'
  sourceId: string
}

const referenceGrid = ref<RefGridCell[]>([])

function buildReferenceGrid() {
  const cells: RefGridCell[] = []
  let idx = 1
  // 角色: 每个角色取 front-upper + side-full 两个视角
  for (const c of characterAppearances.value) {
    const outfit = getActiveOutfit(c)
    for (const viewKey of ['front-upper', 'side-full']) {
      const view = outfit.views.find(v => v.key === viewKey)
      if (view?.imageUrl && idx <= 9) {
        cells.push({
          index: idx++,
          label: `${c.name.replace(/^[^·]+·/, '')}·${view.label}`,
          imageUrl: view.imageUrl,
          type: 'character',
          sourceId: String(c.id),
        })
      }
    }
  }
  // 场景: 每个场景取四宫格图
  for (const s of extractedScenes.value) {
    if (s.imageUrl && idx <= 9) {
      cells.push({
        index: idx++,
        label: s.name,
        imageUrl: s.imageUrl,
        type: 'scene',
        sourceId: s.name,
      })
    }
  }
  referenceGrid.value = cells
  return cells
}

// ── ENH-4: 分镜模板库 ──
interface StoryboardTemplate {
  id: string
  name: string
  icon: string
  desc: string
  structure: string
  bestFor: string
}

const selectedStoryboardTemplate = ref<string | null>(null)

const STORYBOARD_TEMPLATES: StoryboardTemplate[] = [
  { id: 'opening', name: '开篇引入', icon: '🎬', desc: '由远及近，逐步揭示场景与角色', structure: '远景→中景→特写→角色亮相', bestFor: '故事开篇、新品发布、场景介绍' },
  { id: 'dialogue', name: '对话交锋', icon: '💬', desc: '正反打镜头，聚焦角色情绪与台词', structure: '两人中景→正打→反打→反应特写', bestFor: '双人对话、辩论、情感对峙' },
  { id: 'action', name: '战斗动作', icon: '⚔️', desc: '快节奏切换，强化动作张力与冲击力', structure: '准备→出击→碰撞→慢镜头→结果', bestFor: '战斗场景、体育竞技、动作演示' },
  { id: 'emotion', name: '情感渲染', icon: '💔', desc: '慢镜头+特写，营造情绪沉浸感', structure: '全景→特写→回忆闪回→情感爆发→留白', bestFor: '情感戏、离别、关键抉择' },
  { id: 'montage', name: '蒙太奇', icon: '🎞️', desc: '快速拼接多个片段，时间与空间跳跃', structure: '片段A→片段B→片段C→主题汇聚', bestFor: '成长历程、时间流逝、对比叙事' },
  { id: 'product', name: '产品展示', icon: '📦', desc: '渐进式展示产品细节与功能亮点', structure: '环境→产品全景→转盘→细节特写→使用场景', bestFor: '产品广告、开箱展示、功能介绍' },
  { id: 'suspense', name: '悬疑推拉', icon: '🔍', desc: '逐步揭示线索，制造紧张与好奇', structure: '空镜→线索→细节→发现→揭示', bestFor: '悬疑片段、揭秘、探案' },
  { id: 'free', name: '自由发挥', icon: '✨', desc: '不使用模板，AI根据内容自由编排', structure: '由AI智能编排', bestFor: '不确定时选这个，AI灵活处理' },
]

function selectStoryboardTpl(id: string) {
  selectedStoryboardTemplate.value = selectedStoryboardTemplate.value === id ? null : id
}

// ── ENH-5: 生成进度可视化 ──
interface ProgressPhase {
  key: string
  label: string
  icon: string
  detail: string
}

const progressPhases: ProgressPhase[] = [
  { key: 'extract', label: '分镜提取', icon: '📋', detail: '从文本中提取分镜头脚本' },
  { key: 'match', label: '角色匹配', icon: '👥', detail: '为每个分镜匹配合适的角色' },
  { key: 'render', label: '场景渲染', icon: '🎨', detail: 'AI渲染每个分镜的画面' },
  { key: 'compose', label: '合成输出', icon: '🎥', detail: '合成视频、配乐和字幕' },
]

const currentProgressPhase = ref(-1)
const progressPhaseMessages = ref<string[]>([])

/** 增强预览动画：按阶段推进进度，展示每个阶段的名称和图标。
 *  Phase 1（分镜提取）和 Phase 3（场景渲染）接入真实 AI API；
 *  Phase 2、4 保持进度动画。API 失败时 fallback 到纯假进度条。
 */
async function startEnhancedPreview() {
  if (previewGenerating.value) return
  clearPreviewTimer()
  previewGenerating.value = true
  previewProgress.value = 0
  currentProgressPhase.value = 0
  progressPhaseMessages.value = []

  const totalPhases = progressPhases.length

  // ── 辅助：推送进度消息 ──
  function pushMsg(text: string) {
    progressPhaseMessages.value.push(text)
    const MAX_MESSAGES = 12
    if (progressPhaseMessages.value.length > MAX_MESSAGES) {
      progressPhaseMessages.value = progressPhaseMessages.value.slice(-MAX_MESSAGES)
    }
  }

  // ── 辅助：等待指定时间，期间保持进度动画 ──
  function waitMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  try {
    // ===== Phase 1: 分镜提取（真实 API） =====
    currentProgressPhase.value = 0
    pushMsg(`${progressPhases[0].icon} 正在${progressPhases[0].label}...`)

    let craftPrompt = ''
    try {
      const novelSnippet = uploadedText.value.trim().slice(0, 4000)
      if (novelSnippet.length < 20) throw new Error('novel text too short')

      craftPrompt = await generateText({
        systemPrompt:
          '你是一个专业的动画分镜脚本师。根据小说文本，提取第一个分镜头的详细画面描述（英文，适合 AI 绘图），' +
          '包括：场景环境、角色外貌与动作、光影氛围。控制在100词以内。只返回画面描述，不要其他文字。',
        prompt: `小说文本片段：\n${novelSnippet}`,
        maxTokens: 400,
      })
      pushMsg(`${progressPhases[0].icon} ${progressPhases[0].label}完成`)
    } catch (apiErr) {
      console.warn('[startEnhancedPreview] Phase 1 API 失败，使用 fallback prompt:', apiErr)
      craftPrompt = 'A dramatic opening shot: a lone warrior standing on a misty mountain cliff at dawn, flowing robes, cinematic lighting'
      pushMsg(`${progressPhases[0].icon} ${progressPhases[0].label}完成（离线模式）`)
    }
    previewProgress.value = Math.round((1 / totalPhases) * 90)
    await waitMs(600)

    // ===== Phase 2: 角色匹配（动画） =====
    currentProgressPhase.value = 1
    pushMsg(`${progressPhases[1].icon} 初始化...`)
    await waitMs(800)
    pushMsg(`${progressPhases[1].icon} 正在${progressPhases[1].label}...`)
    await waitMs(1200)
    pushMsg(`${progressPhases[1].icon} ${progressPhases[1].label}完成`)
    previewProgress.value = Math.round((2 / totalPhases) * 90)
    await waitMs(400)

    // ===== Phase 3: 场景渲染（真实 API） =====
    currentProgressPhase.value = 2
    pushMsg(`${progressPhases[2].icon} 正在${progressPhases[2].label}...`)

    try {
      const imageUrls = await generateImage({
        prompt: buildPrompt(craftPrompt, 'storyboard'),
        size: '1024x576',
        n: 1,
      })
      if (imageUrls && imageUrls.length > 0) {
        pushMsg(`${progressPhases[2].icon} ${progressPhases[2].label}完成`)
      } else {
        pushMsg(`${progressPhases[2].icon} ${progressPhases[2].label}完成（无图片返回）`)
      }
    } catch (apiErr) {
      console.warn('[startEnhancedPreview] Phase 3 API 失败:', apiErr)
      pushMsg(`${progressPhases[2].icon} ${progressPhases[2].label}完成（离线模式）`)
    }
    previewProgress.value = Math.round((3 / totalPhases) * 90)
    await waitMs(600)

    // ===== Phase 4: 合成输出（动画） =====
    currentProgressPhase.value = 3
    pushMsg(`${progressPhases[3].icon} 初始化...`)
    await waitMs(800)
    pushMsg(`${progressPhases[3].icon} 正在${progressPhases[3].label}...`)
    await waitMs(1200)
    pushMsg(`${progressPhases[3].icon} ${progressPhases[3].label}完成`)

    // 全部阶段完成
    previewProgress.value = 100
    currentProgressPhase.value = totalPhases
    previewGenerating.value = false

  } catch (err) {
    console.error('[startEnhancedPreview] 意外错误:', err)
    // fallback: 快速完成进度条
    previewProgress.value = 100
    currentProgressPhase.value = totalPhases
    previewGenerating.value = false
  }
}

// ── 草稿自动保存（完整版：覆盖所有步骤的数据） ──
const DRAFT_KEY_SB = 'mhw:draft:storyboard'
const HISTORY_KEY_SB = 'mhw:storyboard:shot-history'
// F-03 整改：草稿自动保存失败时向用户显式告警（不再静默降级覆盖完整草稿导致已生成图丢失）
const draftSaveWarning = ref(false)
// [性能优化 B8] draft 保存加 1000ms debounce：避免每次细微改动都全量序列化 sessionStorage
let _draftSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [characterAppearances, selectedStyle, shots, episodeCount, episodeDurationMin,
   selectedAspect, selectedResolution, extractedScenes, projectName, shotSatisfaction,
   selectedWorldview, customWorldviewText, sbWorldviewMode, sbCustomWorldview,
   shotPreviewUrls, shotVideoUrls,
   composedVideoUrl, enhancedVideoUrl, dubSegments, finalVideoUrl, completedSteps],
  () => {
  if (_draftSaveTimer) clearTimeout(_draftSaveTimer)
  _draftSaveTimer = setTimeout(() => {
    _draftSaveTimer = null
    try {
    localStorage.setItem(DRAFT_KEY_SB, JSON.stringify({
      projectName: projectName.value,
      characterAppearances: characterAppearances.value.map(c => ({
        id: c.id, name: c.name, role: c.role, avatar: c.avatar,
        tags: c.tags, description: c.description,
        activeOutfitId: c.activeOutfitId,
        voiceId: c.voiceId, voiceName: c.voiceName,
        views: c.views.map(v => ({ key: v.key, label: v.label, promptSuffix: v.promptSuffix, imageUrl: v.imageUrl })),
        outfits: (c.outfits || []).map(o => ({
          id: o.id, name: o.name, tags: o.tags, description: o.description,
          views: o.views.map(v => ({ key: v.key, label: v.label, promptSuffix: v.promptSuffix, imageUrl: v.imageUrl })),
        })),
      })),
      selectedStyle: selectedStyle.value,
      selectedWorldview: selectedWorldview.value,
      customWorldviewText: customWorldviewText.value,
      sbWorldviewMode: sbWorldviewMode.value,
      sbCustomWorldview: sbCustomWorldview.value,
      shots: shots.value.slice(0, 500),
      episodeCount: episodeCount.value,
      episodeDurationMin: episodeDurationMin.value,
      durationMode: durationMode.value,
      selectedAspect: selectedAspect.value,
      selectedResolution: selectedResolution.value,
      extractedScenes: extractedScenes.value.map(s => ({
        id: s.id, name: s.name, icon: s.icon, mood: s.mood,
        environmentDesc: s.environmentDesc, imageUrl: s.imageUrl,
        timeOfDay: s.timeOfDay, colorTone: s.colorTone, sceneType: s.sceneType,
        views: s.views, currentAngle: s.currentAngle,
        viewDescriptions: s.viewDescriptions,
      })),
      shotPreviewUrls: Object.fromEntries(shotPreviewUrls.value),
      shotVideoUrls: Object.fromEntries(shotVideoUrls.value),
      sceneSeeds: Object.fromEntries(sceneSeeds.value),
      shotSatisfaction: Object.fromEntries(shotSatisfaction.value),
      activeEpisode: activeEpisode.value,
      referenceGrid: referenceGrid.value,
      // ── Steps 7-10 数据 ──
      composedVideoUrl: composedVideoUrl.value,
      enhancedVideoUrl: enhancedVideoUrl.value,
      enhanceMethod: enhanceMethod.value,
      dubSegments: dubSegments.value,
      finalVideoUrl: finalVideoUrl.value,
      exportFormat: exportFormat.value,
      exportFps: exportFps.value,
      exportBitrate: exportBitrate.value,
      exportSubtitle: exportSubtitle.value,
      completedSteps: Array.from(completedSteps.value),
      savedAt: new Date().toISOString(),
    }))
  } catch (storageErr: any) {
    // [异常边界 4.2] localStorage 配额不足时，不再静默降级覆盖完整草稿（会导致已生成图丢失且用户无感知）。
    // 改为显式告警：保留上次成功的完整草稿，并提示用户尽快导出，避免数据丢失。
    draftSaveWarning.value = true
    console.warn('[草稿] 自动保存失败（可能超出本地存储上限）：', storageErr?.message || storageErr)
  }
  }, 1000)
}, { deep: true })
// 恢复草稿
onMounted_SB(() => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_SB)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.projectName) projectName.value = d.projectName
      if (d.selectedStyle) selectedStyle.value = d.selectedStyle
      if (d.selectedWorldview) {
        // 兼容旧版单字符串草稿（迁移为 {primary, tags}）
        if (typeof d.selectedWorldview === 'string') {
          selectedWorldview.value = { primary: d.selectedWorldview, tags: [] }
        } else {
          selectedWorldview.value = {
            primary: d.selectedWorldview.primary || '',
            tags: Array.isArray(d.selectedWorldview.tags) ? d.selectedWorldview.tags : [],
          }
        }
      }
      if (d.customWorldviewText) customWorldviewText.value = d.customWorldviewText
      if (d.sbWorldviewMode) sbWorldviewMode.value = d.sbWorldviewMode
      if (d.sbCustomWorldview) sbCustomWorldview.value = d.sbCustomWorldview
      if (d.episodeCount) episodeCount.value = d.episodeCount
      if (d.episodeDurationMin) episodeDurationMin.value = d.episodeDurationMin
      if (d.durationMode) durationMode.value = d.durationMode
      if (d.selectedAspect) selectedAspect.value = d.selectedAspect
      if (d.selectedResolution) selectedResolution.value = d.selectedResolution
      if (d.activeEpisode) activeEpisode.value = d.activeEpisode
      if (Array.isArray(d.shots) && d.shots.length > 0) shots.value = d.shots
      if (Array.isArray(d.referenceGrid) && d.referenceGrid.length > 0) referenceGrid.value = d.referenceGrid
      // 恢复场景数据（优先使用项目库 DB 数据）
      if (Array.isArray(d.extractedScenes) && d.extractedScenes.length > 0 && extractedScenes.value.length === 0) {
        extractedScenes.value = d.extractedScenes.map((s: any) => ({
          ...s,
          environmentDesc: s.environmentDesc || s.description || '',
          views: Array.isArray(s.views) ? s.views : [],
          currentAngle: s.currentAngle || 'wide',
          imageGenerating: false,
        }))
      }
      // 恢复角色数据（含参考图和造型）
      // 优先使用项目库（DB）数据，仅在 DB 未加载时从 sessionStorage 恢复
      if (Array.isArray(d.characterAppearances) && d.characterAppearances.length > 0 && characterAppearances.value.length === 0) {
        characterAppearances.value = d.characterAppearances.map((c: any) => {
          const restoredViews = Array.isArray(c.views)
            ? c.views.map((v: any) => ({
                key: v.key, label: v.label, promptSuffix: v.promptSuffix || '',
                imageUrl: v.imageUrl, generating: false,
              }))
            : createEmptyViews()
          const restoredOutfits: OutfitVariant[] = Array.isArray(c.outfits)
            ? c.outfits.map((o: any) => ({
                id: o.id, name: o.name,
                tags: o.tags || [], newTag: '', description: o.description || '',
                views: Array.isArray(o.views)
                  ? o.views.map((v: any) => ({
                      key: v.key, label: v.label, promptSuffix: v.promptSuffix || '',
                      imageUrl: v.imageUrl, generating: false,
                    }))
                  : createEmptyViews(),
                generating: false,
              }))
            : []
          return migrateCharacter({
            id: c.id, name: c.name, role: c.role, avatar: c.avatar,
            tags: c.tags || [], description: c.description || '',
            newTag: '', showDetail: false,
            views: restoredViews,
            outfits: restoredOutfits,
            activeOutfitId: c.activeOutfitId || null,
            voiceId: c.voiceId, voiceName: c.voiceName,
          })
        })
      }
      // 恢复预览图 URL
      if (d.shotPreviewUrls && typeof d.shotPreviewUrls === 'object') {
        shotPreviewUrls.value = new Map(Object.entries(d.shotPreviewUrls))
      }
      // 恢复视频 URL
      if (d.shotVideoUrls && typeof d.shotVideoUrls === 'object') {
        shotVideoUrls.value = new Map(Object.entries(d.shotVideoUrls))
      }
      // 恢复场景种子
      if (d.sceneSeeds && typeof d.sceneSeeds === 'object') {
        sceneSeeds.value = new Map(Object.entries(d.sceneSeeds).map(([k, v]) => [k, Number(v)]))
      }
      // 恢复满意度标记
      if (d.shotSatisfaction && typeof d.shotSatisfaction === 'object') {
        shotSatisfaction.value = new Map(Object.entries(d.shotSatisfaction))
      }
      // ── 恢复 Steps 7-10 数据 ──
      if (d.composedVideoUrl) composedVideoUrl.value = d.composedVideoUrl
      if (d.enhancedVideoUrl) enhancedVideoUrl.value = d.enhancedVideoUrl
      if (d.enhanceMethod) enhanceMethod.value = d.enhanceMethod
      if (Array.isArray(d.dubSegments) && d.dubSegments.length > 0) dubSegments.value = d.dubSegments
      if (d.finalVideoUrl) finalVideoUrl.value = d.finalVideoUrl
      if (d.exportFormat) exportFormat.value = d.exportFormat
      if (d.exportFps) exportFps.value = d.exportFps
      if (d.exportBitrate) exportBitrate.value = d.exportBitrate
      if (typeof d.exportSubtitle === 'boolean') exportSubtitle.value = d.exportSubtitle
      if (Array.isArray(d.completedSteps)) completedSteps.value = new Set(d.completedSteps)
      console.info('[草稿] 已恢复 storyboard 草稿，保存时间:', d.savedAt)
    }
    // 恢复分镜版本历史
    const histRaw = sessionStorage.getItem(HISTORY_KEY_SB)
    if (histRaw) {
      try { shotHistory.value = JSON.parse(histRaw) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
})

// ── Item 15: customDurationMin 范围校验 ──
const customDurationError = ref('')
watch(customDurationMin, (val) => {
  if (val < 1 || val > 60) {
    customDurationError.value = '时长需在 1–60 分钟之间'
    customDurationMin.value = Math.min(60, Math.max(1, val))
  } else {
    customDurationError.value = ''
  }
})

// ── Item 17: beforeunload 提醒——有未保存的进度时拦截关闭 ──
const _hasUnsavedProgress = computed(() =>
  shots.value.length > 0 ||
  characterAppearances.value.length > 0 ||
  extractedScenes.value.length > 0 ||
  !!uploadedText.value.trim()
)
function _handleBeforeUnload(e: BeforeUnloadEvent) {
  if (_hasUnsavedProgress.value) {
    e.preventDefault()
    // Chrome 要求必须设置 returnValue（现代浏览器会显示通用提示语）
    e.returnValue = ''
  }
}
// [UX 修复] 全局拦截「从系统拖入文件」导致的浏览器新标签打开行为
// 仅当拖拽源为真实文件（来自操作系统，dataTransfer.types 含 'Files'）时拦截，
// 不影响应用内分镜的 HTML5 拖拽重排（其 types 不含 'Files'）。
let _fileDragGuardCleanup: (() => void) | null = null
function installFileDragGuard() {
  const block = (e: DragEvent) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
    }
  }
  window.addEventListener('dragover', block)
  window.addEventListener('drop', block)
  _fileDragGuardCleanup = () => {
    window.removeEventListener('dragover', block)
    window.removeEventListener('drop', block)
  }
}

onMounted_SB(() => {
  window.addEventListener('beforeunload', _handleBeforeUnload)
  window.addEventListener('keydown', _handleKeyDown)
  installFileDragGuard()
  loadProjectOptions()
})
onUnmounted_SB(() => {
  window.removeEventListener('beforeunload', _handleBeforeUnload)
  window.removeEventListener('keydown', _handleKeyDown)
  _fileDragGuardCleanup?.()
})

// ── [功能体验 7.5] 全局快捷键 ──
function _handleKeyDown(e: KeyboardEvent) {
  // 在输入框/文本域内打字时不拦截
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  const inStoryboard = currentStep.value.key === 'storyboard'
  const inVideo = currentStep.value.key === 'video'

  // ← / → 切换焦点分镜（Step 5）
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && inStoryboard) {
    e.preventDefault()
    const list = episodeShots.value
    if (list.length === 0) return
    const idx = editingShotId.value ? list.findIndex(s => s.id === editingShotId.value) : -1
    if (e.key === 'ArrowLeft') {
      editingShotId.value = list[Math.max(0, idx - 1)]?.id ?? list[0]!.id
    } else {
      editingShotId.value = list[Math.min(list.length - 1, idx + 1)]?.id ?? list[list.length - 1]!.id
    }
    return
  }

  // Ctrl+G — 生成当前焦点镜头的预览图（Step 5）
  if (e.key === 'g' && e.ctrlKey && !e.shiftKey && inStoryboard && editingShotId.value) {
    e.preventDefault()
    const shot = episodeShots.value.find(s => s.id === editingShotId.value)
    if (shot) generateShotPreview(shot)
    return
  }

  // Ctrl+Shift+G — 批量生成所有预览图（Step 5）
  if (e.key === 'G' && e.ctrlKey && e.shiftKey && inStoryboard) {
    e.preventDefault()
    generateAllShotPreviews()
    return
  }

  // Ctrl+D — 复制当前焦点镜头（Step 5）
  if (e.key === 'd' && e.ctrlKey && inStoryboard && editingShotId.value) {
    e.preventDefault()
    insertShot(editingShotId.value)
    return
  }

  // Delete — 删除当前焦点镜头（Step 5）
  if (e.key === 'Delete' && inStoryboard && editingShotId.value) {
    e.preventDefault()
    const shot = episodeShots.value.find(s => s.id === editingShotId.value)
    if (shot && window.confirm(`确定删除镜头 #${shot.index} "${shot.title}"？`)) {
      deleteShot(editingShotId.value)
    }
    return
  }

  // Space — 播放/暂停当前视频（Step 6）
  if (e.key === ' ' && inVideo) {
    e.preventDefault()
    const video = document.querySelector<HTMLVideoElement>('.sbe-vid-player video, video[controls]')
    if (video) {
      video.paused ? video.play() : video.pause()
    }
    return
  }
}
</script>

<template>
  <!-- 单一元素根：修复被 <Transition name="page"> 包裹时因 v-if/v-else 双根(fragment)
       导致 "Component inside <Transition> renders non-element root node" 警告与
       BaseTransition 崩溃(prompt? is not a function)。包裹后路由过渡也恢复正常工作。 -->
  <div class="sbe-app-root">
    <!-- P4-1: First-visit empty state -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">🎞</div>
      <h2 class="qe-empty__title">暂无动画项目</h2>
      <p class="qe-empty__desc">上传小说文本，AI自动提取角色场景、设定风格并生成动画预览</p>
      <button class="qe-empty__btn" @click="hasStarted = true">🎞 开始创作</button>
    </div>
    <div class="sbe-root" v-else>
    <!-- ═══════════ 顶部标题栏 ═══════════ -->
    <header class="sbe-header">
      <div class="sbe-header-left">
        <button class="sbe-back-btn" @click="router.push('/dashboard')">← 返回</button>
        <span class="sbe-project-name">{{ projectName }}</span>
        <span class="sbe-header-sep">·</span>
        <span class="sbe-header-sub">动画编辑器</span>
      </div>
      <div class="sbe-header-right">
        <label class="sbe-proj-picker" :title="projectError || '选择场景/角色素材归属的项目'">
          <span class="sbe-proj-picker__label">素材归属</span>
          <select v-model="selectedProjectId" :disabled="projectLoading" @change="onProjectChange">
            <option v-if="projectOptions.length === 0" value="">
              {{ projectLoading ? '加载项目…' : (projectError ? '项目加载失败' : '无项目') }}
            </option>
            <option v-for="p in projectOptions" :key="p.id" :value="p.id">{{ p.title }}</option>
          </select>
        </label>
        <span class="sbe-step-indicator">步骤 {{ currentStepIndex + 1 }} / {{ STEPS.length }}</span>
      </div>
    </header>

    <!-- ═══════════ 步骤栏 ═══════════ -->
    <nav class="sbe-stepbar" role="tablist" aria-label="漫改创作步骤">
      <div
        v-for="(step, idx) in STEPS"
        :key="step.key"
        class="sbe-step-item"
        role="tab"
        :aria-selected="stepState(idx) === 'active'"
        :aria-current="stepState(idx) === 'active' ? 'step' : undefined"
        tabindex="0"
        :aria-label="`第 ${idx + 1} 步：${step.label}`"
        @click="goToStep(idx)"
        @keydown="onStepKey(idx, $event)"
        :title="step.description"
      >
        <div class="sbe-step-dot">
          <span v-if="stepState(idx) === 'done'" class="sbe-step-check">✓</span>
          <span v-else class="sbe-step-num">{{ idx + 1 }}</span>
        </div>
        <div class="sbe-step-text">
          <span class="sbe-step-icon">{{ step.icon }}</span>
          <span class="sbe-step-label">{{ step.label }}</span>
          <span v-if="stepProgressData[step.key]" class="sbe-step-progress-badge">{{ stepProgressData[step.key] }}</span>
        </div>
        <div v-if="idx < STEPS.length - 1" class="sbe-step-line" :class="{ 'sbe-step-line--done': stepState(idx) === 'done' }"></div>
      </div>
      <div class="sbe-stepbar__progress">
        <span class="sbe-stepbar__pct">{{ completedStepsCount }}/{{ STEPS.length }}</span>
      </div>
    </nav>

    <!-- ═══════════ 步骤内容区 ═══════════ -->
    <div class="sbe-body">
      <Transition name="sbe-slide" mode="out-in">

        <!-- ── Step 1: 项目设置 ── -->
        <div v-if="currentStep.key === 'setup'" key="setup" class="sbe-panel">
          <div class="sbe-panel-inner sbe-setup">
            <h2 class="sbe-panel-title">📋 项目设置</h2>
            <p class="sbe-panel-desc">配置动画项目的基本参数</p>

            <!-- 项目名 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">项目名称</label>
              <input v-model="projectName" class="sbe-setup-input" placeholder="输入项目名称" />
            </div>

            <!-- 继承自历史项目 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">
                📦 继承自历史项目
                <span class="sbe-setup-label-hint">（可选，自动拉取角色和场景）</span>
              </label>
              <div class="sbe-setup-inherit">
                <select v-model="inheritFromProjectId" class="sbe-setup-select" @change="inheritFromProjectId && inheritFromProject()">
                  <option value="">— 新建空项目 —</option>
                  <option v-for="p in availableProjects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <span v-if="inheritingAssets" class="sbe-setup-inherit-status">⏳ 拉取中...</span>
                <span v-else-if="inheritStatus" class="sbe-setup-inherit-status" :class="{ 'sbe-setup-inherit-status--ok': inheritStatus.startsWith('✅'), 'sbe-setup-inherit-status--warn': inheritStatus.startsWith('⚠️'), 'sbe-setup-inherit-status--err': inheritStatus.startsWith('❌') }">
                  {{ inheritStatus }}
                </span>
              </div>
            </div>

            <!-- 集数 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">集数 <span class="sbe-setup-value">{{ episodeCount }} 集</span></label>
              <input type="range" v-model.number="episodeCount" min="1" max="100" step="1" class="sbe-setup-range" />
              <div class="sbe-setup-range-labels">
                <span>1集</span><span>50集</span><span>100集</span>
              </div>
            </div>

            <!-- 每集时长 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">每集时长</label>
              <div class="sbe-setup-chips">
                <button
                  v-for="d in durationOptions"
                  :key="d"
                  class="sbe-setup-chip"
                  :class="{ 'sbe-setup-chip--active': durationMode === 'preset' && episodeDurationMin === d }"
                  @click="durationMode = 'preset'; episodeDurationMin = d"
                >{{ d }} 分钟</button>
                <button
                  class="sbe-setup-chip sbe-setup-chip--custom"
                  :class="{ 'sbe-setup-chip--active': durationMode === 'custom' }"
                  @click="durationMode = 'custom'"
                >
                  自定义
                  <input
                    v-if="durationMode === 'custom'"
                    v-model.number="customDurationMin"
                    type="number"
                    min="1"
                    max="60"
                    class="sbe-setup-chip-input"
                    :class="{ 'sbe-setup-chip-input--error': customDurationError }"
                    @click.stop
                    placeholder="分钟"
                  />
                </button>
                <span v-if="customDurationError && durationMode === 'custom'" class="sbe-setup-chip-error">{{ customDurationError }}</span>
                <button
                  class="sbe-setup-chip"
                  :class="{ 'sbe-setup-chip--active': durationMode === 'actual' }"
                  @click="durationMode = 'actual'"
                  title="以实际分镜拼接后的总时长为准"
                >
                  📐 以实际为主
                  <span v-if="durationMode === 'actual' && actualDurationMin > 0" class="sbe-setup-chip-desc">
                    当前 {{ actualDurationMin }} 分钟
                  </span>
                </button>
              </div>
              <p v-if="durationMode === 'actual'" class="sbe-setup-hint">
                实际模式下，总时长由分镜编排中每个镜头的时长累加决定，生成分镜后自动计算。
              </p>
            </div>

            <!-- 画幅比例 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">画幅比例</label>
              <div class="sbe-setup-aspect-grid">
                <button
                  v-for="a in aspectOptions"
                  :key="a.value"
                  class="sbe-setup-aspect-card"
                  :class="{ 'sbe-setup-aspect-card--active': selectedAspect === a.value }"
                  @click="selectedAspect = a.value"
                >
                  <span class="sbe-setup-aspect-icon">{{ a.icon }}</span>
                  <span class="sbe-setup-aspect-label">{{ a.label }}</span>
                  <span class="sbe-setup-aspect-desc">{{ a.desc }}</span>
                </button>
              </div>
            </div>

            <!-- 分辨率 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">分辨率</label>
              <div class="sbe-setup-chips">
                <button
                  v-for="r in resolutionOptions"
                  :key="r.value"
                  class="sbe-setup-chip"
                  :class="{ 'sbe-setup-chip--active': selectedResolution === r.value }"
                  @click="selectedResolution = r.value"
                >
                  {{ r.label }}
                  <span class="sbe-setup-chip-desc">{{ r.desc }}</span>
                </button>
              </div>
            </div>

            <!-- 世界观类型 -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">
                🌍 世界观类型
                <span v-if="selectedWorldview.primary" class="sbe-setup-label-hint">
                  — {{ worldviewPresets.find(w => w.id === selectedWorldview.primary)?.label }}
                </span>
              </label>
              <!-- 主基调（单选） -->
              <div class="sbe-worldview-grid" role="radiogroup" aria-label="主基调世界观（单选）">
                <div
                  v-for="wv in worldviewPresets.filter(w => !w.isTag)"
                  :key="wv.id"
                  class="sbe-worldview-card"
                  :class="{ 'sbe-worldview-card--selected': selectedWorldview.primary === wv.id }"
                  role="radio"
                  :aria-checked="selectedWorldview.primary === wv.id"
                  :aria-label="wv.label"
                  @click="selectedWorldview.primary = wv.id"
                >
                  <span class="sbe-worldview-card__icon">{{ wv.icon }}</span>
                  <span class="sbe-worldview-card__label">{{ wv.label }}</span>
                  <span class="sbe-worldview-card__desc">{{ wv.description }}</span>
                </div>
              </div>
              <!-- 副元素标签（可多选） -->
              <div class="sbe-worldview-tags">
                <span class="sbe-worldview-tags__title">混合元素（可多选）</span>
                <div class="sbe-worldview-tags__row" role="group" aria-label="副元素标签（可多选）">
                  <button
                    v-for="wv in worldviewPresets.filter(w => w.isTag)"
                    :key="wv.id"
                    type="button"
                    class="sbe-worldview-tag"
                    :class="{ 'sbe-worldview-tag--active': selectedWorldview.tags.includes(wv.id) }"
                    role="checkbox"
                    :aria-checked="selectedWorldview.tags.includes(wv.id)"
                    :aria-label="wv.label"
                    @click="toggleWorldviewTag(wv.id)"
                  >
                    <span v-if="selectedWorldview.tags.includes(wv.id)" class="sbe-worldview-tag__check">✓</span>
                    {{ wv.label }}
                  </button>
                </div>
              </div>
              <!-- 补充描述 -->
              <div v-if="selectedWorldview.primary" class="sbe-worldview-supplement">
                <label class="sbe-setup-label">补充世界观描述（可选）</label>
                <textarea
                  v-model="customWorldviewText"
                  class="sbe-setup-textarea"
                  placeholder="补充你的世界观细节，如：近未来东京、魔法学院、蒸汽朋克维多利亚时代..."
                  rows="2"
                />
                <p class="sbe-setup-hint" v-if="recommendedStyleIds.length">
                  推荐画风：{{ recommendedStyleIds.map(id => styleOptions.find(s => s.id === id)?.label || id).join('、') }}
                </p>
              </div>
            </div>

            <!-- 画风选择（20种内置 + 自定义上传） -->
            <div class="sbe-setup-field">
              <label class="sbe-setup-label">
                画风
                <span v-if="selectedStyle" class="sbe-setup-label-hint">
                  — 已选：{{ [...styleOptions, ...customStyles].find(s => s.id === selectedStyle)?.label || selectedStyle }}
                </span>
              </label>

              <template v-for="(groupId, gIdx) in ['animation', 'realistic', 'artistic']" :key="groupId">
                <div class="sbe-style-group-label">{{ styleGroupLabels[groupId] }}</div>
                <div class="sbe-style-grid sbe-style-grid--compact">
                  <div
                    v-for="opt in styleOptions.filter(s => s.group === groupId)"
                    :key="opt.id"
                    class="sbe-style-card"
                    :class="{
                      'sbe-style-card--selected': selectedStyle === opt.id,
                      'sbe-style-card--has-img': !!opt.img,
                      'sbe-style-card--recommended': recommendedStyleIds.includes(opt.id),
                    }"
                    @click="selectedStyle = opt.id"
                  >
                    <span v-if="recommendedStyleIds.includes(opt.id)" class="sbe-style-card__recommend">推荐</span>
                    <img v-if="opt.img" :src="opt.img" :alt="opt.label" class="sbe-style-card__img" loading="lazy" />
                    <div v-else class="sbe-style-icon">{{ opt.icon }}</div>
                    <div class="sbe-style-name">{{ opt.label }}</div>
                    <div class="sbe-style-desc">{{ opt.desc }}</div>
                  </div>
                </div>
              </template>

              <!-- 自定义画风 -->
              <div class="sbe-style-group-label">📎 自定义画风（上传参考图）</div>
              <div class="sbe-style-grid sbe-style-grid--compact">
                <!-- 已上传的自定义画风 -->
                <div
                  v-for="cs in customStyles"
                  :key="cs.id"
                  class="sbe-style-card sbe-style-card--has-img sbe-style-card--custom"
                  :class="{ 'sbe-style-card--selected': selectedStyle === cs.id }"
                  @click="selectedStyle = cs.id"
                >
                  <img :src="bustCache(cs.imageUrl)" :alt="cs.label" class="sbe-style-card__img" />
                  <div class="sbe-style-name">{{ cs.label }}</div>
                  <div class="sbe-style-desc">{{ cs.desc }}</div>
                  <button class="sbe-style-card__del" @click.stop="deleteCustomStyle(cs.id)" title="删除">×</button>
                </div>
                <!-- 上传按钮 -->
                <div
                  class="sbe-style-card sbe-style-card--upload"
                  @click="showCustomUpload = !showCustomUpload"
                >
                  <div class="sbe-style-upload-icon">+</div>
                  <div class="sbe-style-name">上传参考图</div>
                  <div class="sbe-style-desc">自定义画风</div>
                </div>
              </div>

              <!-- 上传面板 -->
              <div v-if="showCustomUpload" class="sbe-custom-upload-panel">
                <div class="sbe-custom-upload-row">
                  <input v-model="customStyleName" class="sbe-char-edit-input" placeholder="画风名称（可选）" style="flex:1" />
                  <input v-model="customStyleDesc" class="sbe-char-edit-input" placeholder="描述（可选）" style="flex:1" />
                </div>
                <div class="sbe-custom-upload-row">
                  <input ref="customStyleInput" type="file" accept="image/*" style="display:none" @change="onCustomStyleFileSelected" />
                  <button class="sbe-action-btn" @click="customStyleInput?.click()">📁 选择图片文件</button>
                  <button class="sbe-action-btn sbe-action-btn--secondary" @click="showCustomUpload = false">取消</button>
                </div>
                <p class="sbe-setup-hint">上传一张风格参考图作为自定义画风，AI 将模仿该风格生成画面。图片存储在本地浏览器中。</p>
              </div>
            </div>

            <!-- 自动计算 -->
            <div class="sbe-setup-summary">
              <div class="sbe-setup-summary-item">
                <span class="sbe-setup-summary-label">预计镜头数</span>
                <span class="sbe-setup-summary-value">~{{ estimatedShotCount }} 个</span>
              </div>
              <div class="sbe-setup-summary-item">
                <span class="sbe-setup-summary-label">总时长</span>
                <span class="sbe-setup-summary-value">{{ Math.round(episodeCount * effectiveDurationMin) }} 分钟</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 2: 上传小说 ── -->
        <div v-else-if="currentStep.key === 'upload'" key="upload" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">📖 上传小说</h2>
            <p class="sbe-panel-desc">粘贴小说文本、上传 .txt 文件，或选择已有剧本模板</p>
            <div class="sbe-upload-zone">
              <div
                class="sbe-upload-drop"
                :class="{ 'sbe-upload-drop--active': isDraggingFile }"
                role="button"
                tabindex="0"
                aria-label="拖拽或点击上传小说文件，支持 .txt / .docx / .epub"
                @click="openFilePicker"
                @keydown.enter.prevent="openFilePicker"
                @keydown.space.prevent="openFilePicker"
                @dragover.prevent
                @dragenter.prevent="onFileDragEnter"
                @dragleave.prevent="onFileDragLeave"
                @drop="onFileDrop"
              >
                <div class="sbe-upload-icon">📄</div>
                <div class="sbe-upload-text">拖拽文件到此处，或点击选择</div>
                <div class="sbe-upload-hint">支持 .txt / .docx / .epub，最大 10MB</div>
                <input ref="fileInput" type="file" accept=".txt,.docx,.epub" style="display:none" @change="onFileSelected" />
              </div>
              <textarea
                v-model="uploadedText"
                class="sbe-text-input"
                placeholder="或直接粘贴小说文本..."
                rows="6"
              ></textarea>
              <div v-if="uploadedText.trim()" class="sbe-text-counter">已输入 {{ uploadedText.trim().length }} 字</div>
            </div>
          </div>
        </div>

        <!-- ── Step 3: 角色设定（增强） ── -->
        <div v-else-if="currentStep.key === 'character'" key="character" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">👤 角色设定</h2>
            <p class="sbe-panel-desc">AI 从文本中提取角色，设定主视觉图和属性</p>

            <!-- 项目角色库状态 -->
            <div v-if="projectCharactersLoaded && characterAppearances.length > 0" class="sbe-project-lib-badge">
              📦 已从项目角色库加载 {{ characterAppearances.length }} 个角色（跨集复用）
            </div>
            <div v-else-if="projectCharactersLoaded && characterAppearances.length === 0" class="sbe-project-lib-badge sbe-project-lib-badge--empty">
              📦 项目角色库为空，请点击下方按钮提取角色
            </div>

            <!-- ENH-3: AI角色自动描图 -->
            <div v-if="characterAppearances.length > 6" class="sbe-char-search">
              <input v-model="characterSearch" class="sbe-char-search__input" placeholder="🔍 搜索角色名/定位/标签..." />
              <span class="sbe-char-search__count">
                {{ filteredCharacters.length }}/{{ characterAppearances.length }} 个角色
              </span>
            </div>
            <div class="sbe-char-grid">
              <div v-for="(char, cIdx) in filteredCharacters" :key="char.id" class="sbe-char-card" :class="{ 'sbe-char-card--expanded': char.showDetail }">
                <div class="sbe-char-card__header" @click="char.showDetail = !char.showDetail">
                  <span class="sbe-char-card__avatar">{{ char.avatar }}</span>
                  <span class="sbe-char-card__name">{{ char.name }}</span>
                  <span class="sbe-char-card__role">{{ char.role }}</span>
                  <span class="sbe-char-card__arrow">{{ char.showDetail ? '▾' : '▸' }}</span>
                </div>
                <button class="sbe-char-card__delete" @click.stop="deleteCharacter(char.id)" title="删除此角色">×</button>
                <div v-if="char.showDetail" class="sbe-char-card__body">
                  <!-- 可编辑角色名和角色定位 -->
                  <div class="sbe-char-edit-row">
                    <div class="sbe-char-edit-field">
                      <label class="sbe-char-edit-label">角色名</label>
                      <input v-model="char.name" class="sbe-char-edit-input" placeholder="角色名称" />
                    </div>
                    <div class="sbe-char-edit-field">
                      <label class="sbe-char-edit-label">角色定位</label>
                      <input v-model="char.role" class="sbe-char-edit-input" placeholder="如：剑修、医仙" />
                    </div>
                  </div>
                  <!-- 音色设定 -->
                  <div class="sbe-char-voice-row">
                    <label class="sbe-char-edit-label">🎙️ 音色</label>
                    <select
                      class="sbe-char-voice-select"
                      :value="char.voiceId || ''"
                      @change.stop="onVoiceChange(char, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">未设置</option>
                      <optgroup label="女声">
                        <option v-for="v in VOICE_PRESETS.filter(p => p.gender === 'female')" :key="v.id" :value="v.id">{{ v.name }}</option>
                      </optgroup>
                      <optgroup label="男声">
                        <option v-for="v in VOICE_PRESETS.filter(p => p.gender === 'male')" :key="v.id" :value="v.id">{{ v.name }}</option>
                      </optgroup>
                    </select>
                  </div>

                  <!-- ── 造型管理 ── -->
                  <div class="sbe-outfit-section">
                    <div class="sbe-outfit-tabs">
                      <button
                        v-for="outfit in char.outfits"
                        :key="outfit.id"
                        class="sbe-outfit-tab"
                        :class="{ 'sbe-outfit-tab--active': char.activeOutfitId === outfit.id }"
                        @click.stop="switchOutfit(char, outfit.id)"
                      >
                        {{ outfit.name }}
                        <span v-if="char.outfits.length > 1" class="sbe-outfit-tab__del" @click.stop="removeOutfit(char, outfit.id)">×</span>
                      </button>
                      <button class="sbe-outfit-tab sbe-outfit-tab--add" @click.stop="addOutfit(char)" title="新增造型">+ 造型</button>
                    </div>

                    <!-- 当前造型编辑 -->
                    <template v-if="getActiveOutfit(char)">
                      <div class="sbe-char-edit-field" style="margin-top:8px">
                        <label class="sbe-char-edit-label">造型名称</label>
                        <input v-model="getActiveOutfit(char).name" class="sbe-char-edit-input" placeholder="如：默认造型、战甲、便装" />
                      </div>
                      <!-- 造型描述 -->
                      <div class="sbe-char-edit-field">
                        <label class="sbe-char-edit-label">造型描述（服装、外貌细节）</label>
                        <textarea v-model="getActiveOutfit(char).description" class="sbe-char-edit-textarea" placeholder="描述该造型的外貌、服装、特征（将用于 AI 生成提示词）" rows="2"></textarea>
                      </div>
                      <!-- 造型标签 -->
                      <div v-if="getActiveOutfit(char).views.some(v => v.imageUrl)" class="sbe-char-ref-tag">
                        <span class="sbe-char-ref-tag__icon">🔗</span>
                        <span class="sbe-char-ref-tag__text">此造型参考图将自动绑定到选择该造型的分镜</span>
                      </div>
                      <div class="sbe-char-tags">
                        <span v-for="(tag, tIdx) in getActiveOutfit(char).tags" :key="tIdx" class="sbe-char-tag">
                          {{ tag }}
                          <button class="sbe-char-tag__remove" @click.stop="getActiveOutfit(char).tags.splice(tIdx, 1)">×</button>
                        </span>
                        <div class="sbe-char-tag-input-wrap">
                          <input
                            v-model="getActiveOutfit(char).newTag"
                            class="sbe-char-tag-input"
                            placeholder="添加标签..."
                            @keyup.enter="(() => { const o = getActiveOutfit(char); if (o.newTag.trim() && !o.tags.includes(o.newTag.trim())) { o.tags.push(o.newTag.trim()); o.newTag = '' } })()"
                          />
                          <button class="sbe-char-tag-add" @click.stop="(() => { const o = getActiveOutfit(char); if (o.newTag.trim() && !o.tags.includes(o.newTag.trim())) { o.tags.push(o.newTag.trim()); o.newTag = '' } })()" :disabled="!getActiveOutfit(char).newTag?.trim()">+</button>
                        </div>
                      </div>

                      <!-- Multi-angle outfit reference images -->
                      <div v-if="allViewsDone(char) || getActiveOutfit(char).views.some(v => v.imageUrl || v.error)" class="sbe-char-views-grid">
                        <div v-for="(view, vIdx) in getActiveOutfit(char).views" :key="view.key" class="sbe-char-view-item">
                          <template v-if="view.generating">
                            <div class="sbe-char-view-loading">
                              <div class="sbe-spinner"></div>
                              <span>{{ view.label }}</span>
                            </div>
                          </template>
                          <template v-else-if="view.imageUrl">
                            <img :src="bustCache(view.imageUrl)" :alt="`${char.name} ${view.label}`" class="sbe-char-view-img sbe-char-view-img--clickable" @click.stop="openImagePreview(view.imageUrl!, `${char.name} - ${getActiveOutfit(char).name} - ${view.label}`)" />
                            <div class="sbe-char-view-label">{{ view.label }}</div>
                            <button class="sbe-char-view-regen" @click.stop="generateCharRefImage(char, cIdx, view.key)" title="重新生成此角度">🔄</button>
                          </template>
                          <template v-else-if="view.error">
                            <div class="sbe-char-view-error">
                              <span>{{ view.label }}: {{ view.error }}</span>
                              <button class="sbe-char-view-regen" @click.stop="generateCharRefImage(char, cIdx, view.key)" style="position:static;opacity:1;width:auto;height:auto;padding:4px 10px;border-radius:4px;font-size:11px">🔄 重试</button>
                            </div>
                          </template>
                          <template v-else>
                            <div class="sbe-char-view-empty">{{ view.label }}</div>
                          </template>
                        </div>
                      </div>

                      <!-- Action buttons for outfit images -->
                      <div class="sbe-char-img-actions">
                        <button v-if="!allViewsDone(char) && !anyViewGenerating(char)" class="sbe-char-gen-btn" @click.stop="generateCharRefImage(char, cIdx)">
                          ✨ 生成「{{ getActiveOutfit(char).name }}」参考图
                        </button>
                        <button v-if="getActiveOutfit(char).views.some(v => v.imageUrl)" class="sbe-char-save-lib-btn" @click.stop="saveCharToLibrary(char)" title="保存此角色到素材库">
                          💾 保存到素材库
                        </button>
                      </div>
                    </template>
                  </div>

                  <!-- 📦 角色装备素材（武器 / 饰品，半自动：点识别后生成四宫格入库） -->
                  <div class="sbe-asset-panel">
                    <div class="sbe-asset-panel__head">
                      <span class="sbe-asset-panel__title">📦 角色装备素材</span>
                      <div class="sbe-asset-panel__ops">
                        <button
                          v-if="(charAssets[char.id] || []).length"
                          class="sbe-asset-mini-btn"
                          :disabled="(charAssets[char.id] || []).some(a => a.generating)"
                          @click="generateAllCharAssets(char)"
                        >⚡ 生成全部</button>
                        <button
                          class="sbe-asset-mini-btn sbe-asset-mini-btn--ghost"
                          :disabled="assetExtracting[`char:${char.id}`]"
                          @click="extractAssetsFromCharacter(char)"
                        >🔍 {{ assetExtracting[`char:${char.id}`] ? '识别中…' : '识别装备' }}</button>
                      </div>
                    </div>
                    <div v-if="assetExtracting[`char:${char.id}`] && !(charAssets[char.id] || []).length" class="sbe-asset-hint">AI 正在识别该角色的武器 / 饰品…</div>
                    <div v-else-if="!(charAssets[char.id] || []).length" class="sbe-asset-hint">点「识别装备」让 AI 提取该角色使用的武器与饰品，生成后供视频引用。</div>
                    <div v-else class="sbe-asset-list">
                      <div v-for="a in charAssets[char.id]" :key="a.key" class="sbe-asset-item">
                        <span class="sbe-asset-badge" :class="`sbe-asset-badge--${a.category}`">{{ ASSET_CATEGORY_LABELS[a.category] }}</span>
                        <div class="sbe-asset-meta">
                          <div class="sbe-asset-name">{{ a.name }}</div>
                          <div class="sbe-asset-reason">{{ a.reason }}</div>
                        </div>
                        <div v-if="a.generated && a.views && a.views.length" class="sbe-asset-grid">
                          <img v-for="v in a.views" :key="v.angle" :src="bustCache(v.imageUrl)" class="sbe-asset-grid__img" :alt="`${a.name} ${v.angle}`" />
                        </div>
                        <video v-else-if="a.generated && a.videoUrl" :src="a.videoUrl" class="sbe-asset-video" controls />
                        <button
                          v-if="!a.generated"
                          class="sbe-asset-gen-btn"
                          :disabled="a.generating"
                          @click="generateAsset(a)"
                        >{{ a.generating ? '⏳ 生成中…' : (a.category === 'effect' ? '🎬 生成动图' : '🖼️ 生成四宫格') }}</button>
                        <span v-if="a.error" class="sbe-asset-err">{{ a.error }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="extractError" class="sbe-extract-error">{{ extractError }}</div>
            <div v-if="libraryMessage" class="sbe-library-message">{{ libraryMessage }}</div>
            <div class="sbe-char-actions-row">
              <button class="sbe-action-btn" :disabled="extracting" @click="extractCharacters">
                {{ extracting ? '⏳ AI 正在提取角色...' : '✨ AI 自动提取角色' }}
              </button>
              <button class="sbe-action-btn sbe-action-btn--secondary" @click.stop="showLibraryPanel = !showLibraryPanel">
                📚 素材库 ({{ characterLibrary.length }})
              </button>
              <button v-if="characterAppearances.some(c => c.views.some(v => v.imageUrl))" class="sbe-action-btn sbe-action-btn--secondary" @click.stop="saveAllCharsToLibrary">
                💾 全部保存到素材库
              </button>
            </div>

            <!-- 素材库面板 -->
            <div v-if="showLibraryPanel" class="sbe-library-panel">
              <h3 class="sbe-sub-title">📚 角色素材库</h3>
              <div v-if="characterLibrary.length === 0" class="sbe-library-empty">
                素材库为空，生成角色参考图后可保存到素材库，方便后续章节复用。
              </div>
              <div v-else class="sbe-library-grid">
                <div v-for="saved in characterLibrary" :key="saved.id" class="sbe-library-card">
                  <div class="sbe-library-card__header">
                    <span class="sbe-library-card__avatar">{{ saved.avatar }}</span>
                    <div>
                      <div class="sbe-library-card__name">{{ saved.name }}</div>
                      <div class="sbe-library-card__role">{{ saved.role }}</div>
                    </div>
                    <button class="sbe-library-card__del" @click="removeFromLibrary(saved.id)" title="从素材库删除">×</button>
                  </div>
                  <div class="sbe-library-card__thumbs">
                    <template v-for="sv in saved.views" :key="sv.key">
                      <img v-if="sv.imageUrl" :src="bustCache(sv.imageUrl)" :alt="sv.label" class="sbe-library-thumb"
                        @click="openImagePreview(sv.imageUrl!, `${saved.name} - ${sv.label}`)"
                        @error="($event.target as HTMLImageElement).style.display='none'; ($event.target as HTMLImageElement).nextElementSibling?.classList.remove('sbe-library-thumb-fallback-hidden')"
                      />
                      <div class="sbe-library-thumb-fallback sbe-library-thumb-fallback-hidden" :class="{ 'sbe-library-thumb-fallback-visible': !sv.imageUrl }">
                        <span class="sbe-library-thumb-expired">⚠️ 图片已过期</span>
                        <span class="sbe-library-thumb-label">{{ sv.label }}</span>
                      </div>
                      <div v-if="!sv.imageUrl" class="sbe-library-thumb-empty">{{ sv.label }}</div>
                    </template>
                  </div>
                  <div class="sbe-library-card__tags">
                    <span v-for="tag in saved.tags" :key="tag" class="sbe-library-tag">{{ tag }}</span>
                  </div>
                  <button class="sbe-library-card__import" @click="importCharFromLibrary(saved)">📥 导入到当前项目</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 4: 场景设定（增强） ── -->
        <div v-else-if="currentStep.key === 'scene'" key="scene" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🏞️ 场景设定</h2>
            <p class="sbe-panel-desc">AI 提取小说中的场景地点，生成多角度环境取景图（不含角色动作）</p>

            <!-- 项目场景库状态 -->
            <div v-if="projectScenesLoaded && extractedScenes.length > 0" class="sbe-project-lib-badge">
              📦 已从项目场景库加载 {{ extractedScenes.length }} 个场景（跨集复用）
            </div>
            <div v-else-if="projectScenesLoaded && extractedScenes.length === 0" class="sbe-project-lib-badge sbe-project-lib-badge--empty">
              📦 项目场景库为空，请点击下方按钮提取场景
            </div>

            <!-- 顶部工具栏 -->
            <div v-if="extractedScenes.length > 0" class="sbe-scene-toolbar">
              <button
                class="sbe-action-btn sbe-scene-toolbar__batch"
                :disabled="batchSceneRunning || extractedScenes.every(s => s.imageUrl || s.imageGenerating)"
                @click="generateAllSceneImages"
              >
                {{ batchSceneRunning ? `⏳ 生成中 ${batchSceneProgress.done}/${batchSceneProgress.total}` : '✨ 一键生成所有场景图' }}
              </button>
              <button
                v-if="batchSceneRunning"
                class="sbe-action-btn sbe-vid-cancel-btn"
                @click="cancelBatchSceneGeneration"
              >⏹ 取消</button>
              <span class="sbe-scene-toolbar__count">
                已生成 <strong>{{ sceneImageDoneCount }}</strong> / {{ extractedScenes.length }}
              </span>
            </div>

            <!-- 场景横条列表 -->
            <div v-if="extractedScenes.length > 0" class="sbe-scene-list">
              <div v-for="s in extractedScenes" :key="s.id" class="sbe-scene-row">
                <!-- 左侧：场景图预览（v2 最简渲染：有图就直接 img，点击标签换图） -->
                <div class="sbe-scene-row__visual">
                  <!-- 状态1：正在生成 -->
                  <template v-if="s.imageGenerating">
                    <div class="sbe-scene-row__loading">
                      <div class="sbe-spinner"></div>
                      <span class="sbe-scene-row__gen-hint">生成中，预计 30-50 秒...</span>
                    </div>
                  </template>

                  <!-- 状态2：有图片 —— 直接 <img> 渲染，不搞 background-image / 嵌套 v-if / debug-overlay -->
                  <template v-else-if="s.imageUrl">
                    <!-- 多视角切换标签（2个以上视角才显示） -->
                    <div v-if="s.views.length > 1" class="sbe-scene-row__tabs">
                      <button
                        v-for="sv in s.views" :key="sv.angle + ':' + sv.imageUrl"
                        class="sbe-scene-row__tab"
                        :class="{ 'sbe-scene-row__tab--active': sv.imageUrl === s.imageUrl }"
                        @click="switchSceneAngle(s, sv)"
                      >
                        {{ SCENE_ANGLE_OPTIONS.find(a => a.id === sv.angle)?.label || sv.angle }}
                      </button>
                    </div>
                    <!-- 核心：一个纯粹的 <img> 标签，:key 绑定 URL 强制 Vue 在 URL 变化时重建 DOM -->
                    <img
                      :key="'si-' + s.id + '-' + s.imageUrl"
                      :src="s.imageUrl"
                      :alt="s.name"
                      class="sbe-scene-row__img"
                      @click="openImagePreview(s.imageUrl!, s.name)"
                      @error="(e) => handleSceneImgError(e, s)"
                    />
                    <!-- 悬浮重新生成按钮 -->
                    <button
                      class="sbe-scene-row__regen-btn"
                      @click.stop="generateSceneImage(s)"
                      title="重新生成场景图"
                    >🔄</button>
                  </template>

                  <!-- 状态3：生成出错 -->
                  <div v-else-if="genErrorMap[s.id]" class="sbe-scene-row__visual--error">
                    <div class="sbe-scene-row__gen-error-msg">
                      ❌ 生成失败<br><code>{{ genErrorMap[s.id] }}</code>
                    </div>
                    <button class="sbe-scene-row__retry-btn" @click.stop="generateSceneImage(s)">🔄 重试</button>
                  </div>

                  <!-- 状态4：空 —— 占位符，点击即生成 -->
                  <div v-else class="sbe-scene-row__placeholder" @click="generateSceneImage(s)">
                    <span class="sbe-scene-row__placeholder-icon">{{ s.icon || '🖼️' }}</span>
                    <span class="sbe-scene-row__placeholder-hint">点击生成场景图</span>
                  </div>
                </div>

                <!-- 右侧设置区 -->
                <div class="sbe-scene-row__body">
                  <!-- 第一行：地点名称 + 氛围 -->
                  <div class="sbe-scene-row__field-row">
                    <div class="sbe-scene-row__field sbe-scene-row__field--name">
                      <label>地点名称</label>
                      <input v-model="s.name" class="sbe-scene-text-input" placeholder="如：考古工地·荒野裂隙" />
                    </div>
                    <div class="sbe-scene-row__field sbe-scene-row__field--mood">
                      <label>氛围</label>
                      <input v-model="s.mood" class="sbe-scene-text-input" placeholder="如：压抑、壮观" />
                    </div>
                  </div>

                  <!-- 第二行：时间段 + 色调 + 空间类型 -->
                  <div class="sbe-scene-row__field-row">
                    <div class="sbe-scene-row__field">
                      <label>时间段</label>
                      <input v-model="s.timeOfDay" class="sbe-scene-text-input" placeholder="如：黄昏" />
                    </div>
                    <div class="sbe-scene-row__field">
                      <label>色调</label>
                      <input v-model="s.colorTone" class="sbe-scene-text-input" placeholder="如：暖色调" />
                    </div>
                    <div class="sbe-scene-row__field">
                      <label>空间类型</label>
                      <input v-model="s.sceneType" class="sbe-scene-text-input" placeholder="如：室外" />
                    </div>
                  </div>

                  <!-- 第三行：环境描述 + 重新生成 -->
                  <div class="sbe-scene-row__field-row sbe-scene-row__desc-row">
                    <div class="sbe-scene-row__field sbe-scene-row__field--desc">
                      <label>环境描述</label>
                      <textarea v-model="s.environmentDesc" class="sbe-char-edit-textarea" rows="2" placeholder="纯环境描述，不含角色动作..."></textarea>
                    </div>
                    <button
                      class="sbe-scene-desc-regen"
                      :disabled="regeneratingSceneDescId === s.id"
                      @click="regenerateSceneDescription(s)"
                      title="AI 重新生成环境描述"
                    >
                      {{ regeneratingSceneDescId === s.id ? '⏳' : '🔄' }}
                    </button>
                  </div>

                  <!-- 底部操作 -->
                  <div class="sbe-scene-row__actions">
                    <button
                      class="sbe-scene-gen-btn sbe-scene-gen-btn--sm"
                      :disabled="s.imageGenerating"
                      @click="generateSceneImage(s)"
                    >
                      {{ s.imageUrl ? '🔄 重新生成场景图' : '✨ 生成场景图' }}
                    </button>
                    <button
                      v-if="s.imageUrl"
                      class="sbe-scene-save-lib"
                      :class="{ 'sbe-scene-save-lib--done': savedToLib[s.id] }"
                      :disabled="savingToLib[s.id]"
                      @click="saveSceneToLibrary(s)"
                      :title="savedToLib[s.id] ? '已保存到素材库（可重新保存以更新）' : '将当前场景图保存到素材库，供后续章节引用'"
                    >
                      {{ savedToLib[s.id] ? '✅ 已保存素材库' : (savingToLib[s.id] ? '⏳ 保存中…' : '📚 保存到素材库') }}
                    </button>
                    <button class="sbe-scene-row__del" @click="deleteScene(s.id)" title="删除">🗑️</button>
                  </div>
                  <!-- 📦 关联素材资产（半自动：场景图生成后自动识别，点生成入库） -->
                  <div class="sbe-asset-panel">
                    <div class="sbe-asset-panel__head">
                      <span class="sbe-asset-panel__title">📦 关联素材资产</span>
                      <div class="sbe-asset-panel__ops">
                        <button
                          v-if="(sceneAssets[s.id] || []).length"
                          class="sbe-asset-mini-btn"
                          :disabled="(sceneAssets[s.id] || []).some(a => a.generating)"
                          @click="generateAllSceneAssets(s)"
                        >⚡ 生成全部</button>
                        <button
                          class="sbe-asset-mini-btn sbe-asset-mini-btn--ghost"
                          :disabled="assetExtracting[`scene:${s.id}`]"
                          @click="extractAssetsFromScene(s)"
                        >🔍 {{ assetExtracting[`scene:${s.id}`] ? '识别中…' : '重新识别' }}</button>
                      </div>
                    </div>
                    <div v-if="assetExtracting[`scene:${s.id}`] && !(sceneAssets[s.id] || []).length" class="sbe-asset-hint">AI 正在识别本场景的道具 / 武器 / 饰品 / 特效…</div>
                    <div v-else-if="!(sceneAssets[s.id] || []).length" class="sbe-asset-hint">场景图生成后会自动识别关联素材；或点「重新识别」。</div>
                    <div v-else class="sbe-asset-list">
                      <div v-for="a in sceneAssets[s.id]" :key="a.key" class="sbe-asset-item">
                        <span class="sbe-asset-badge" :class="`sbe-asset-badge--${a.category}`">{{ ASSET_CATEGORY_LABELS[a.category] }}</span>
                        <div class="sbe-asset-meta">
                          <div class="sbe-asset-name">{{ a.name }}</div>
                          <div class="sbe-asset-reason">{{ a.reason }}</div>
                        </div>
                        <div v-if="a.generated && a.views && a.views.length" class="sbe-asset-grid">
                          <img v-for="v in a.views" :key="v.angle" :src="bustCache(v.imageUrl)" class="sbe-asset-grid__img" :alt="`${a.name} ${v.angle}`" />
                        </div>
                        <video v-else-if="a.generated && a.videoUrl" :src="a.videoUrl" class="sbe-asset-video" controls />
                        <button
                          v-if="!a.generated"
                          class="sbe-asset-gen-btn"
                          :disabled="a.generating"
                          @click="generateAsset(a)"
                        >{{ a.generating ? '⏳ 生成中…' : (a.category === 'effect' ? '🎬 生成动图' : '🖼️ 生成四宫格') }}</button>
                        <span v-if="a.error" class="sbe-asset-err">{{ a.error }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="saveLibError" class="sbe-savelib-error">{{ saveLibError }}</div>
                </div>
              </div>
            </div>
            <div v-else-if="!extractingScenes" class="sbe-scene-empty">
              <div class="sbe-scene-empty__icon">🏞️</div>
              <div class="sbe-scene-empty__text">点击下方按钮，AI 将从小说文本中提取场景地点和环境描述</div>
            </div>

            <div v-if="extractScenesError" class="sbe-extract-error">{{ extractScenesError }}</div>

            <button class="sbe-action-btn" :disabled="extractingScenes" @click="extractScenes">
              {{ extractingScenes ? '⏳ AI 正在提取场景...' : extractedScenes.length > 0 ? '🔄 重新提取场景' : '✨ AI 自动提取场景' }}
            </button>
          </div>
        </div>

        <!-- ── Step 5: 分镜编排（全新核心步骤） ── -->
        <div v-else-if="currentStep.key === 'storyboard'" key="storyboard" class="sbe-panel">
          <div class="sbe-panel-inner sbe-storyboard">
            <h2 class="sbe-panel-title">🎬 分镜编排</h2>
            <p class="sbe-panel-desc">AI 拆分小说为结构化分镜，编辑提示词，绑定角色和场景参考图</p>

            <!-- 工具栏 -->
            <div class="sbe-sb-toolbar">
              <button class="sbe-action-btn" :disabled="shotsGenerating || !hasUploadedNovel" @click="generateShots">
                {{ shotsGenerating ? '⏳ AI 正在生成分镜...' : shots.length > 0 ? '🔄 重新生成分镜' : '✨ AI 生成分镜' }}
              </button>
              <!-- [UX改进 7.3] 幻灯片预览按钮 -->
              <button v-if="episodeShots.length > 0"
                class="sbe-action-btn sbe-action-btn--ghost"
                :class="{ 'sbe-action-btn--active': slideshowActive }"
                :title="slideshowActive ? '停止幻灯片预览' : '幻灯片预览（按 duration 轮播分镜图）'"
                @click="slideshowActive ? stopSlideshow() : startSlideshow()">
                {{ slideshowActive ? '⏹ 停止预览' : '▶ 幻灯片预览' }}
              </button>
              <div class="sbe-sb-toolbar-info">
                <span v-if="shots.length > 0">共 {{ shots.length }} 个镜头</span>
                <span v-else-if="!shotsGenerating">尚未生成分镜</span>
                <span v-if="lockedShots.size > 0" class="sbe-sb-toolbar-info__locked">🔒 {{ lockedShots.size }} 个已锁定</span>
              </div>
            </div>

            <!-- [P1] 全局制作规范面板（工业级一致性锚点，注入每镜头） -->
            <div class="sbe-gd-panel" v-if="globalDirective || globalDirectiveGenerating || globalDirectiveError || injectGlobalDirective">
              <div class="sbe-gd-panel__head">
                <span class="sbe-gd-panel__title">🎯 全局制作规范（锁定风格/色调/一致性，注入每个镜头）</span>
                <div class="sbe-gd-panel__actions">
                  <label class="sbe-gd-check">
                    <input type="checkbox" v-model="injectGlobalDirective" />
                    <span>注入</span>
                  </label>
                  <button class="sbe-action-btn sbe-action-btn--ghost" :disabled="globalDirectiveGenerating" @click="regenerateGlobalDirective">
                    {{ globalDirectiveGenerating ? '生成中...' : '↻ 重新生成' }}
                  </button>
                  <button class="sbe-gd-panel__collapse" @click="gdPanelOpen = !gdPanelOpen">{{ gdPanelOpen ? '收起 ▲' : '展开 ▼' }}</button>
                </div>
              </div>
              <p v-if="globalDirectiveError" class="sbe-gd-panel__err">{{ globalDirectiveError }}</p>
              <template v-if="gdPanelOpen">
                <div v-if="globalDirective" class="sbe-gd-panel__body">
                  <label class="sbe-gd-field"><span>风格锁定</span><input v-model="globalDirective.styleLock" @input="onGdEdit" /></label>
                  <label class="sbe-gd-field"><span>全局色调</span><input v-model="globalDirective.colorTone" @input="onGdEdit" /></label>
                  <label class="sbe-gd-field"><span>氛围基调</span><input v-model="globalDirective.mood" @input="onGdEdit" /></label>
                  <label class="sbe-gd-field"><span>环境音效</span><input v-model="globalDirective.ambientSound" @input="onGdEdit" /></label>
                  <label class="sbe-gd-field sbe-gd-field--full"><span>全局约束</span><input v-model="globalDirective.constraints" @input="onGdEdit" /></label>
                  <p class="sbe-gd-panel__preview">注入锚点：{{ globalDirective.anchor }}</p>
                </div>
                <p v-else class="sbe-gd-panel__hint">
                  点击「✨ AI 生成分镜」时将自动生成全局规范并注入每个镜头（可在此手动编辑后重新生成分镜）。
                </p>
              </template>
            </div>

            <div v-if="shotsError" class="sbe-extract-error">{{ shotsError }}</div>

            <!-- 分镜版本历史面板（Task 4） -->
            <div v-if="shotHistory.length > 0" class="sbe-shot-history">
              <button
                class="sbe-shot-history__toggle"
                @click="showShotHistory = !showShotHistory"
              >
                🕘 版本历史（{{ shotHistory.length }}）
                <span class="sbe-shot-history__chevron">{{ showShotHistory ? '▲' : '▼' }}</span>
              </button>
              <div v-if="showShotHistory" class="sbe-shot-history__list">
                <div
                  v-for="(snap, idx) in shotHistory"
                  :key="snap.timestamp"
                  class="sbe-shot-history__item"
                >
                  <span class="sbe-shot-history__label">{{ snap.label }}</span>
                  <span class="sbe-shot-history__meta">{{ snap.shots.length }} 镜 · {{ new Date(snap.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
                  <button class="sbe-shot-history__restore" @click="restoreShotSnapshot(idx)">↩ 恢复</button>
                </div>
              </div>
            </div>

            <!-- 2A: 对白拆分建议面板 -->
            <div v-if="dialogueSuggestions.length > 0" class="sbe-dialogue-suggestions">
              <div class="sbe-dialogue-suggestions__header">
                💡 AI 拆分建议（{{ dialogueSuggestions.length }} 处对白较长）
                <button class="sbe-dialogue-suggestions__dismiss" @click="dialogueSuggestions = []">忽略全部</button>
              </div>
              <div v-for="sg in dialogueSuggestions" :key="sg.shotId" class="sbe-dialogue-suggestions__item">
                <span class="sbe-dialogue-suggestions__text">{{ sg.suggestion }}</span>
                <button class="sbe-dialogue-suggestions__accept" @click="insertReactionShot(sg.shotId)">➕ 插入反应镜头</button>
                <button class="sbe-dialogue-suggestions__skip" @click="dialogueSuggestions = dialogueSuggestions.filter(x => x.shotId !== sg.shotId)">跳过</button>
              </div>
            </div>
            <div class="sbe-sb-worldview-bar">
              <span class="sbe-sb-worldview-bar__label">🌍 预览图世界观</span>
              <select v-model="sbWorldviewMode" class="sbe-sb-worldview-bar__select">
                <option v-for="opt in sbWorldviewOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <span class="sbe-sb-worldview-bar__hint">{{ sbWorldviewOptions.find(o => o.value === sbWorldviewMode)?.desc }}</span>
              <input
                v-if="sbWorldviewMode === 'custom'"
                v-model="sbCustomWorldview"
                class="sbe-sb-worldview-bar__input"
                type="text"
                placeholder="输入自定义世界观描述，如：蒸汽朋克维多利亚时代…"
              />
              <span v-if="sbWorldviewMode === 'global' && worldviewContext" class="sbe-sb-worldview-bar__preview">
                "{{ worldviewContext.length > 60 ? worldviewContext.slice(0, 60) + '…' : worldviewContext }}"
              </span>
            </div>

            <!-- 多宫格参考图面板 -->
            <div v-if="referenceGrid.length > 0" class="sbe-ref-grid-panel">
              <div class="sbe-ref-grid__header">
                <span class="sbe-ref-grid__title">📐 多宫格参考图（{{ referenceGrid.length }}格）</span>
                <button class="sbe-ref-grid__refresh" @click="buildReferenceGrid" title="刷新参考图">🔄</button>
              </div>
              <div class="sbe-ref-grid">
                <div v-for="cell in referenceGrid" :key="cell.index" class="sbe-ref-grid-cell" :title="cell.label">
                  <img :src="bustCache(cell.imageUrl)" :alt="cell.label" class="sbe-ref-grid-cell__img" />
                  <span class="sbe-ref-grid-cell__idx">{{ cell.index }}</span>
                  <span class="sbe-ref-grid-cell__label">{{ cell.label }}</span>
                </div>
              </div>
            </div>

            <!-- 集数 Tab -->
            <div v-if="shots.length > 0" class="sbe-sb-tabs">
              <button
                v-for="ep in episodeTabs"
                :key="ep"
                class="sbe-sb-tab"
                :class="{ 'sbe-sb-tab--active': activeEpisode === ep }"
                @click="activeEpisode = ep"
              >
                第{{ ep }}集
                <span class="sbe-sb-tab-count">({{ shots.filter(s => ((s as any).episode ?? 1) === ep).length }})</span>
              </button>
            </div>

            <!-- 分镜卡片网格（支持拖拽排序） -->
            <draggable
              v-if="episodeShots.length > 0"
              v-model="draggableEpisodeShots"
              item-key="id"
              tag="div"
              class="sbe-sb-grid sbe-sb-grid--v2"
              handle=".sbe-sb-card__drag-handle"
              :animation="150"
              ghost-class="sbe-sb-card--dragging"
              @end="onShotDragEnd"
            >
              <template #item="{ element: shot }">
              <div
                class="sbe-sb-card sbe-sb-card--v2"
                :class="{ 'sbe-sb-card--editing': editingShotId === shot.id }"
                @click="editingShotId = editingShotId === shot.id ? null : shot.id"
              >
                <!-- 拖拽手柄 -->
                <div class="sbe-sb-card__drag-handle" @click.stop title="拖拽排序">⠿</div>
                <!-- 预览图 + 时间范围 -->
                <div class="sbe-sb-card__visual"
                  :style="!shotPreviewUrls.get(shot.id) && getShotSceneRef(shot)?.imageUrl
                    ? { backgroundImage: `url(${getShotSceneRef(shot)!.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : {}">
                  <template v-if="shotPreviewGenerating.has(shot.id)">
                    <div class="sbe-sb-card__loading"><div class="sbe-spinner"></div></div>
                  </template>
                  <template v-else-if="shotPreviewUrls.get(shot.id)">
                    <img :src="bustCache(shotPreviewUrls.get(shot.id)!)" class="sbe-sb-card__img"
                      @error="handleShotPreviewExpired(shot.id)"
                      @click.stop="openImagePreview(shotPreviewUrls.get(shot.id)!, shot.title || `Shot ${shot.index}`, async () => { await generateShotPreview(shot) }, shot.id)" />
                  </template>
                  <template v-else>
                    <div class="sbe-sb-card__no-img" :class="{ 'sbe-sb-card__no-img--has-scene': getShotSceneRef(shot)?.imageUrl }">
                      <span v-if="expiredPreviewIds.has(shot.id)" class="sbe-sb-card__expired">⚠️ 已过期</span>
                      <span v-else class="sbe-sb-card__idx">#{{ shot.index }}</span>
                    </div>
                  </template>
                  <!-- 时间范围角标 -->
                  <span class="sbe-sb-card__time-badge">{{ (shot as any)._timeRange || `${shot.duration}s` }}</span>
                  <!-- 预览生成状态 -->
                  <span v-if="shotPreviewErrors.get(shot.id)" class="sbe-sb-card__err-badge">⚠️</span>
                </div>
                <!-- 提示词文本 -->
                <div class="sbe-sb-card__prompt-text">
                  {{ (shot.description || '').length > 80 ? (shot.description || '').slice(0, 80) + '…' : (shot.description || '') }}
                </div>
                <!-- 电影语言标签条 -->
                <div class="sbe-sb-card__cine-bar">
                  <span class="sbe-sb-card__cine-tag sbe-sb-card__cine-tag--shot">
                    {{ SHOT_TYPE_LABELS[shot.shotType || 'medium'] || shot.shotType || '中景' }}
                  </span>
                  <span class="sbe-sb-card__cine-tag sbe-sb-card__cine-tag--cam" :title="getShotCameraSummary(shot)">
                    🎥 {{ getShotCameraSummary(shot) }}
                  </span>
                  <span v-if="shot.pacing" class="sbe-sb-card__cine-tag sbe-sb-card__cine-tag--pacing">
                    {{ PACING_LABELS[shot.pacing] || shot.pacing }}
                  </span>
                  <span v-if="shot.actionSpeed && shot.actionSpeed !== 'normal'" class="sbe-sb-card__cine-tag sbe-sb-card__cine-tag--speed">
                    ⚡{{ ACTION_SPEED_LABELS[shot.actionSpeed] || shot.actionSpeed }}
                  </span>
                  <span v-if="shot.transition && shot.transition !== 'cut'" class="sbe-sb-card__cine-tag sbe-sb-card__cine-tag--trans">
                    →{{ TRANSITION_LABELS[shot.transition] || shot.transition }}
                  </span>
                </div>
                <!-- 参考图缩略条 -->
                <div v-if="getShotRefThumbs(shot).length" class="sbe-sb-card__ref-strip">
                  <img v-for="(thumb, ti) in getShotRefThumbs(shot)" :key="ti" :src="thumb" class="sbe-sb-card__ref-thumb sbe-sb-card__ref-thumb--clickable"
                    @click.stop="openImagePreview(thumb, `参考图 ${ti + 1}`)" />
                </div>
                <!-- 角色 -->
                <div v-if="getShotCharacterRefs(shot).length" class="sbe-sb-card__chars">
                  <span v-for="c in getShotCharacterRefs(shot)" :key="c.id" class="sbe-sb-card__char-ref">
                    {{ c.avatar }} {{ c.name.replace(/^[^·]+·/, '') }}
                  </span>
                </div>
                <!-- 满意度打分 -->
                <div class="sbe-sb-card__satisfaction">
                  <button
                    class="sbe-satisfaction-btn sbe-satisfaction-btn--approve"
                    :class="{ 'sbe-satisfaction-btn--active': shotSatisfaction.get(shot.id) === 'approved' }"
                    title="满意（将优先生成视频）"
                    @click.stop="markShotSatisfaction(shot.id, 'approved')"
                  >👍</button>
                  <button
                    class="sbe-satisfaction-btn sbe-satisfaction-btn--reject"
                    :class="{ 'sbe-satisfaction-btn--active': shotSatisfaction.get(shot.id) === 'rejected' }"
                    title="不满意（批量生成时跳过）"
                    @click.stop="markShotSatisfaction(shot.id, 'rejected')"
                  >👎</button>
                  <!-- [UX改进 B14] 镜头锁定：锁定后跳过批量预览/视频重生成 -->
                  <button
                    class="sbe-satisfaction-btn sbe-satisfaction-btn--lock"
                    :class="{ 'sbe-satisfaction-btn--active': lockedShots.has(shot.id) }"
                    :title="lockedShots.has(shot.id) ? '已锁定（点击解锁）' : '锁定（批量生成时跳过此镜头）'"
                    @click.stop="toggleShotLock(shot.id)"
                  >{{ lockedShots.has(shot.id) ? '🔒' : '🔓' }}</button>
                </div>
              </div>
              </template>
            </draggable>
            <div v-else-if="!shotsGenerating && shots.length > 0" class="sbe-sb-empty-ep">
              第{{ activeEpisode }}集暂无分镜
            </div>

            <!-- 编辑面板（Overlay） — 简化版 -->
            <Teleport to="body">
              <div v-if="editingShotId && shots.find(s => s.id === editingShotId)" class="sbe-sb-edit-overlay" @click.self="editingShotId = null">
                <div class="sbe-sb-edit-panel sbe-sb-edit-panel--simple" v-if="shots.find(s => s.id === editingShotId)" @click.stop>
                  <template v-for="shot in [shots.find(s => s.id === editingShotId)!]" :key="shot.id">
                    <div class="sbe-sb-edit-header">
                      <h3>#{{ shot.index }} {{ shot.title }}</h3>
                      <button class="sbe-sb-edit-close" @click="editingShotId = null">✕</button>
                    </div>
                    <div class="sbe-sb-edit-simple">
                      <!-- 预览图 -->
                      <div class="sbe-sb-edit-preview-hero">
                        <div v-if="shotPreviewGenerating.has(shot.id)" class="sbe-sb-edit-loading">
                          <div class="sbe-spinner"></div>
                          <span>AI 生成中…</span>
                        </div>
                        <img v-else-if="shotPreviewUrls.get(shot.id)" :src="bustCache(shotPreviewUrls.get(shot.id)!)" class="sbe-sb-edit-preview-hero__img sbe-sb-edit-preview-hero__img--clickable"
                          @error="handleShotPreviewExpired(shot.id)"
                          @click.stop="openImagePreview(shotPreviewUrls.get(shot.id)!, `#${shot.index} ${shot.title}`, async () => { await generateShotPreview(shot) }, shot.id)" />
                        <div v-else class="sbe-sb-edit-no-preview">
                          <span class="sbe-sb-edit-no-preview__icon">{{ expiredPreviewIds.has(shot.id) ? '⚠️' : '🖼️' }}</span>
                          <span>{{ expiredPreviewIds.has(shot.id) ? '图片已过期，请重新生成' : '暂无预览' }}</span>
                        </div>
                        <div v-if="shotPreviewErrors.get(shot.id)" class="sbe-sb-edit-preview-hero__err">⚠️ {{ shotPreviewErrors.get(shot.id) }}</div>
                        <div class="sbe-sb-edit-preview-hero__actions">
                          <button class="sbe-sb-edit-preview-hero__btn" @click="generateShotPreview(shot)" :disabled="shotPreviewGenerating.has(shot.id)">
                            {{ shotPreviewGenerating.has(shot.id) ? '⏳ 生成中…' : shotPreviewUrls.get(shot.id) ? '🔄 重新生成' : '✨ 生成预览' }}
                          </button>
                        </div>
                      </div>
                      <!-- 参考图缩略 -->
                      <div v-if="getShotRefThumbs(shot).length" class="sbe-sb-edit-refstrip">
                        <div v-for="(thumb, ti) in getShotRefThumbs(shot)" :key="ti" class="sbe-sb-edit-refstrip__item sbe-sb-edit-refstrip__item--clickable"
                          @click.stop="openImagePreview(thumb, `#${shot.index} 参考图 ${ti + 1}`)">
                          <img :src="thumb" />
                        </div>
                      </div>
                      <!-- 时间 + 时长 -->
                      <div class="sbe-sb-edit-simple__meta">
                        <span class="sbe-sb-edit-simple__time">{{ (shot as any)._timeRange || '0-' + shot.duration + '秒' }}</span>
                        <span class="sbe-sb-edit-simple__dur">{{ shot.duration }}s</span>
                        <span v-if="shot.sceneTemplate" class="sbe-sb-edit-simple__scene">📍 {{ shot.sceneTemplate }}</span>
                      </div>
                      <!-- 提示词编辑（核心） -->
                      <div class="sbe-sb-edit-field sbe-sb-edit-field--main">
                        <label>📝 分镜提示词</label>
                        <textarea
                          :value="shot.description"
                          @input="updateShot(shot.id, 'description', ($event.target as HTMLTextAreaElement).value)"
                          class="sbe-char-edit-textarea sbe-sb-edit-prompt-main"
                          rows="5"
                          placeholder="描述这个镜头的画面内容、镜头运动、角色动作和对白…"
                        ></textarea>
                      </div>
                      <!-- 电影语言控件 -->
                      <div class="sbe-sb-edit-cine">
                        <div class="sbe-sb-edit-cine__row">
                          <label>🎬 景别</label>
                          <select class="sbe-sb-edit-cine__select" :value="shot.shotType || 'medium'" @change="updateShot(shot.id, 'shotType', ($event.target as HTMLSelectElement).value)">
                            <option v-for="(lbl, key) in SHOT_TYPE_LABELS" :key="key" :value="key">{{ lbl }}</option>
                          </select>
                        </div>
                        <div class="sbe-sb-edit-cine__row">
                          <label>🎥 运镜</label>
                          <select class="sbe-sb-edit-cine__select" :value="shot.cameraMove || 'static'" @change="updateShot(shot.id, 'cameraMove', ($event.target as HTMLSelectElement).value)">
                            <option v-for="(lbl, key) in CAMERA_MOVE_LABELS" :key="key" :value="key">{{ lbl }}</option>
                          </select>
                        </div>
                        <div class="sbe-sb-edit-cine__row">
                          <label>🔀 转场</label>
                          <select class="sbe-sb-edit-cine__select" :value="shot.transition || 'cut'" @change="updateShot(shot.id, 'transition', ($event.target as HTMLSelectElement).value)">
                            <option v-for="(lbl, key) in TRANSITION_LABELS" :key="key" :value="key">{{ lbl }}</option>
                          </select>
                        </div>
                        <div class="sbe-sb-edit-cine__row">
                          <label>🎵 节奏</label>
                          <select class="sbe-sb-edit-cine__select" :value="shot.pacing || ''" @change="updateShot(shot.id, 'pacing', ($event.target as HTMLSelectElement).value)">
                            <option value="">自动</option>
                            <option v-for="(lbl, key) in PACING_LABELS" :key="key" :value="key">{{ lbl }}</option>
                          </select>
                        </div>
                        <div class="sbe-sb-edit-cine__row">
                          <label>⚡ 速度</label>
                          <select class="sbe-sb-edit-cine__select" :value="shot.actionSpeed || 'normal'" @change="updateShot(shot.id, 'actionSpeed', ($event.target as HTMLSelectElement).value)">
                            <option v-for="(lbl, key) in ACTION_SPEED_LABELS" :key="key" :value="key">{{ lbl }}</option>
                          </select>
                        </div>
                        <div class="sbe-sb-edit-cine__row">
                          <label>⏱ 时长</label>
                          <input type="number" class="sbe-sb-edit-cine__num" :value="shot.duration" min="1" max="10" step="1"
                            @input="updateShot(shot.id, 'duration', Number(($event.target as HTMLInputElement).value) || 4)" />
                          <span class="sbe-sb-edit-cine__unit">秒</span>
                        </div>
                      </div>
                      <!-- 多段运镜显示 -->
                      <div v-if="shot.generation?.cameraActions?.length" class="sbe-sb-edit-cine__cam-actions">
                        <label>🎥 多段运镜</label>
                        <div class="sbe-sb-edit-cine__cam-list">
                          <div v-for="(ca, ci) in shot.generation.cameraActions" :key="ci" class="sbe-sb-edit-cine__cam-item">
                            <span class="sbe-sb-edit-cine__cam-step">{{ ci + 1 }}.</span>
                            <span>{{ CAMERA_MOVE_LABELS[ca.move] || ca.move }}</span>
                            <span class="sbe-sb-edit-cine__cam-speed">{{ ca.speed === 'slow' ? '慢' : ca.speed === 'fast' ? '快' : '正常' }}</span>
                            <span v-if="ca.description" class="sbe-sb-edit-cine__cam-desc">{{ ca.description }}</span>
                          </div>
                        </div>
                      </div>
                      <!-- 对白 -->
                      <div class="sbe-sb-edit-field">
                        <label>💬 对白</label>
                        <input type="text" class="sbe-sb-edit-cine__input" :value="shot.dialogue || ''"
                          @input="updateShot(shot.id, 'dialogue', ($event.target as HTMLInputElement).value)"
                          placeholder="角色对白…" />
                      </div>
                      <!-- 拍摄角度 -->
                      <div class="sbe-sb-edit-field">
                        <label>📐 拍摄角度</label>
                        <select class="sbe-sb-edit-cine__input" :value="shot.cameraViewAngle || ''"
                          @change="updateShot(shot.id, 'cameraViewAngle', ($event.target as HTMLSelectElement).value)">
                          <option value="">未设置</option>
                          <option value="平视">平视</option>
                          <option value="俯视">俯视</option>
                          <option value="仰视">仰视</option>
                          <option value="鸟瞰">鸟瞰</option>
                          <option value="倾斜">倾斜</option>
                        </select>
                      </div>
                      <!-- 微表情 -->
                      <div class="sbe-sb-edit-field">
                        <label>😊 微表情</label>
                        <textarea class="sbe-char-edit-textarea" rows="2" :value="shot.microExpression || ''"
                          @input="updateShot(shot.id, 'microExpression', ($event.target as HTMLTextAreaElement).value)"
                          placeholder="角色面部细节：眼神变化、嘴角弧度、眉头动作…"></textarea>
                      </div>
                      <!-- 站位 -->
                      <div class="sbe-sb-edit-field">
                        <label>📍 站位</label>
                        <input type="text" class="sbe-sb-edit-cine__input" :value="shot.positioning || ''"
                          @input="updateShot(shot.id, 'positioning', ($event.target as HTMLInputElement).value)"
                          placeholder="角色在画面中的位置关系…" />
                      </div>
                      <!-- 空间锚点 -->
                      <div class="sbe-sb-edit-field">
                        <label>🏷 空间锚点</label>
                        <input type="text" class="sbe-sb-edit-cine__input" :value="shot.spatialAnchor || ''"
                          @input="updateShot(shot.id, 'spatialAnchor', ($event.target as HTMLInputElement).value)"
                          placeholder="场景中的固定参照物…" />
                      </div>
                      <!-- 出场角色（只读） -->
                      <div v-if="getShotCharacterRefs(shot).length" class="sbe-sb-edit-simple__chars">
                        <span v-for="c in getShotCharacterRefs(shot)" :key="c.id" class="sbe-sb-edit-simple__char">
                          {{ c.avatar }} {{ c.name.replace(/^[^·]+·/, '') }}
                        </span>
                      </div>
                      <!-- 操作 -->
                      <div class="sbe-sb-edit-simple__actions">
                        <button class="sbe-action-btn sbe-action-btn--secondary" @click="insertShot(shot.id)">➕ 插入镜头</button>
                        <button class="sbe-sb-edit-delete" @click="deleteShot(shot.id)">🗑 删除</button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </Teleport>
          </div>
        </div>

        <!-- ── Step 6: 镜头视频 ── -->
        <div v-else-if="currentStep.key === 'video'" key="video" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🎞️ 镜头视频</h2>
            <p class="sbe-panel-desc">{{ videoGenMode === 'reference' ? '参考图模式：用角色/场景参考图 + 文本驱动视频生成，不传首帧（可避开真人审核）' : '逐镜头生成短视频，首尾帧链式衔接，不满意的单独重新生成' }}</p>

            <!-- 参数行 -->
            <div class="sbe-vid-params">
              <label class="sbe-vid-param">
                <span>时长</span>
                <select v-model.number="videoDuration">
                  <option :value="3">3s</option>
                  <option :value="5">5s</option>
                  <option :value="8">8s</option>
                  <option :value="10">10s</option>
                </select>
              </label>
              <label class="sbe-vid-param">
                <span>分辨率</span>
                <select v-model="videoResolution">
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
              <label class="sbe-vid-param sbe-vid-param--mode">
                <span>生成模式</span>
                <select v-model="videoGenMode">
                  <option value="firstframe">首帧模式（I2V链式）</option>
                  <option value="reference">参考图模式（避真人审核）</option>
                </select>
              </label>
            </div>

            <!-- 角色一致性关键帧 -->
            <div class="sbe-vid-consistency">
              <div class="sbe-vid-consistency__header">
                <label class="sbe-vid-consistency__toggle">
                  <input type="checkbox" v-model="enableConsistency" />
                  <span>🔒 角色一致性关键帧</span>
                </label>
                <span class="sbe-vid-consistency__hint" v-if="enableConsistency">
                  生成视频前用 AI 锁定角色人脸，减少角色漂移
                </span>
              </div>
              <div v-if="enableConsistency" class="sbe-vid-consistency__options">
                <label class="sbe-vid-param">
                  <span>一致性模型</span>
                  <select v-model="consistencyModel">
                    <option v-for="opt in consistencyModelOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label class="sbe-vid-param sbe-vid-param--checkbox">
                  <input type="checkbox" v-model="enableFaceSwap" />
                  <span>Face-Swap 增强（+$0.006，更精准）</span>
                </label>
                <span class="sbe-vid-consistency__desc">
                  {{ consistencyModelOptions.find(o => o.value === consistencyModel)?.desc }}
                </span>
              </div>
              <p v-if="consistencyWarning" class="sbe-vid-consistency__warn">{{ consistencyWarning }}</p>
              <div v-if="consistencyWarning" class="sbe-vid-consistency__retry">
                <button
                  class="sbe-action-btn sbe-action-btn--ghost"
                  :disabled="!consistencyFailedShotId || (consistencyFailedShotId ? shotVideoGenerating.has(consistencyFailedShotId) : false)"
                  @click="retryShotVideo(consistencyFailedShotId)"
                >🔄 重试该镜头（含一致性关键帧）</button>
                <span class="sbe-vid-consistency__status">提示：持续失败请检查 Replicate Key 是否有效、是否已绑卡解除限流（未绑卡限流 1 次/分钟）</span>
              </div>
            </div>

            <!-- 📦 素材资产引用面板（武器/道具/饰品/特效·技能） -->
            <div class="sbe-asset-ref">
              <div class="sbe-asset-ref__head" @click="assetRefPanelOpen = !assetRefPanelOpen">
                <span class="sbe-asset-ref__title">📦 引用素材资产（{{ assetRefSelected.size }}/{{ assetRefItems.length }}）</span>
                <span class="sbe-asset-ref__toggle">{{ assetRefPanelOpen ? '收起 ▲' : '展开 ▼' }}</span>
              </div>
              <div v-if="assetRefPanelOpen" class="sbe-asset-ref__body">
                <div class="sbe-asset-ref__bar">
                  <label class="sbe-vid-param sbe-vid-param--checkbox">
                    <input type="checkbox" :checked="assetRefAuto" @change="setAssetRefAll(($event.target as HTMLInputElement).checked)" />
                    <span>全自动（默认全选，调用错可手动取消）</span>
                  </label>
                  <span class="sbe-asset-ref__hint">生成镜头视频时，选中的武器/道具/饰品/特效会作为参考图注入</span>
                </div>
                <div v-if="assetRefItems.length === 0" class="sbe-asset-ref__empty">
                  暂无素材资产。请到「素材库 → 素材资产」tab 提前生成武器/道具/饰品/特效。
                </div>
                <div v-else class="sbe-asset-ref__chips">
                  <button
                    v-for="it in assetRefItems"
                    :key="it.id"
                    class="sbe-asset-chip"
                    :class="{ 'sbe-asset-chip--on': assetRefSelected.has(it.id) }"
                    @click="toggleAssetRef(it.id)"
                  >
                    <img v-if="it.thumbnail" :src="it.thumbnail" class="sbe-asset-chip__img" />
                    <span v-else class="sbe-asset-chip__ph">{{ ASSET_CATEGORY_LABELS[it.category] }}</span>
                    <span class="sbe-asset-chip__name">{{ it.name }}</span>
                    <span class="sbe-asset-chip__badge">{{ ASSET_CATEGORY_LABELS[it.category] }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- BYOK + 批量生成 -->
            <div class="sbe-vid-actions">
              <label class="sbe-vid-byok">
                <input type="checkbox" v-model="useByok" />
                <span>🔑 使用我的 API Key</span>
              </label>
              <button class="sbe-action-btn sbe-vid-batch-btn"
                :disabled="(videoGenMode === 'firstframe' && episodeShots.filter(s => shotPreviewUrls.has(s.id)).length === 0) || batchVideoRunning"
                @click="generateAllShotVideos">
                <template v-if="batchVideoRunning">
                  ⏳ {{ batchVideoProgress.done }}/{{ batchVideoProgress.total }} · {{ batchVideoProgress.elapsed }}
                </template>
                <template v-else>🎞️ 按顺序生成所有镜头视频（{{ episodeShots.length }} 个）</template>
              </button>
              <button v-if="batchVideoRunning" class="sbe-action-btn sbe-vid-cancel-btn" @click="cancelBatchVideoGeneration">
                ⏹ 停止生成
              </button>
            </div>

            <!-- 批量进度条 -->
            <div v-if="batchVideoRunning" class="sbe-vid-progress">
              <div class="sbe-vid-progress__bar">
                <div class="sbe-vid-progress__fill"
                  :style="{ width: (batchVideoProgress.total > 0 ? (batchVideoProgress.done / batchVideoProgress.total * 100) : 0) + '%' }">
                </div>
              </div>
              <span class="sbe-vid-progress__text">
                {{ batchVideoProgress.done }}/{{ batchVideoProgress.total }} 已完成
                <span v-if="batchVideoProgress.succeeded > 0" style="color:#4ade80"> · ✅ {{ batchVideoProgress.succeeded }} 成功</span>
                <span v-if="batchVideoProgress.failed > 0" style="color:#f87171"> · ❌ {{ batchVideoProgress.failed }} 失败</span>
                · 已用时 {{ batchVideoProgress.elapsed }}
              </span>
            </div>

            <!-- 镜头视频链式列表 -->
            <div v-if="episodeShots.length > 0" class="sbe-vid-chain">
              <div v-for="shot in episodeShots" :key="'vid-' + shot.id" class="sbe-vid-chain-item"
                :class="{
                  'sbe-vid-chain-item--done': shotVideoUrls.has(shot.id),
                  'sbe-vid-chain-item--generating': shotVideoGenerating.has(shot.id),
                  'sbe-vid-chain-item--error': shotVideoErrors.has(shot.id),
                  'sbe-vid-chain-item--locked': videoGenMode === 'firstframe' && !shotPreviewUrls.has(shot.id),
                }">
                <!-- 首尾帧衔接行（仅首帧模式） -->
                <div v-if="videoGenMode === 'firstframe'" class="sbe-vid-chain__frames">
                  <div class="sbe-vid-chain__frame sbe-vid-chain__frame--first">
                    <span class="sbe-vid-chain__frame-label">首帧</span>
                    <div class="sbe-vid-chain__thumb">
                      <img v-if="shotPreviewUrls.get(shot.id)" :src="bustCache(shotPreviewUrls.get(shot.id)!)" class="sbe-vid-chain__img" />
                      <div v-else class="sbe-vid-chain__thumb-empty">无预览</div>
                    </div>
                  </div>
                  <div class="sbe-vid-chain__arrow">
                    <div class="sbe-vid-chain__arrow-line"></div>
                    <div class="sbe-vid-chain__arrow-info">
                      <span class="sbe-vid-chain__camera">{{ getShotCameraSummary(shot) }}</span>
                      <span class="sbe-vid-chain__duration">{{ shot.duration || videoDuration }}s</span>
                    </div>
                    <div class="sbe-vid-chain__arrow-line"></div>
                  </div>
                  <div class="sbe-vid-chain__frame sbe-vid-chain__frame--last">
                    <span class="sbe-vid-chain__frame-label">尾帧</span>
                    <div class="sbe-vid-chain__thumb">
                      <div class="sbe-vid-chain__thumb-empty sbe-vid-chain__thumb-auto">自动</div>
                    </div>
                  </div>
                </div>
                <!-- 参考图模式标签 -->
                <div v-else class="sbe-vid-chain__ref-badge">
                  <span class="sbe-vid-chain__ref-icon">🖼️</span>
                  <span>参考图模式 · {{ getShotCameraSummary(shot) }} · {{ shot.duration || videoDuration }}s</span>
                </div>
                <!-- 生成中叠层 -->
                <div v-if="shotVideoGenerating.has(shot.id)" class="sbe-vid-chain__overlay">
                  <div class="sbe-vid-chain__spinner"></div>
                  <span>⏳ 生成中…</span>
                </div>
                <!-- 视频播放器 + 操作 -->
                <div class="sbe-vid-chain__body">
                  <div class="sbe-vid-chain__title">
                    Shot #{{ shot.index }} · {{ shot.title }}
                    <span v-if="shotVideoUrls.has(shot.id)" class="sbe-vid-chain__badge sbe-vid-chain__badge--ok">✓ 已生成</span>
                  </div>
                  <video v-if="shotVideoUrls.get(shot.id)" :src="shotVideoUrls.get(shot.id)!" class="sbe-vid-chain__video" controls loop preload="metadata"></video>
                  <div v-if="shotVideoErrors.get(shot.id)" class="sbe-vid-chain__error">{{ shotVideoErrors.get(shot.id) }}</div>
                  <div class="sbe-vid-chain__actions">
                    <button v-if="shotPreviewUrls.has(shot.id) || videoGenMode === 'reference'" class="sbe-pv-btn sbe-pv-btn--regen"
                      :disabled="shotVideoGenerating.has(shot.id)" @click="generateShotVideo(shot)">
                      {{ shotVideoUrls.has(shot.id) ? '🔄 重新生成' : '🎞️ 生成视频' }}
                    </button>
                    <span v-else class="sbe-vid-chain__hint">请先在分镜编排步骤生成预览图</span>
                  </div>
                </div>
                <!-- 链式连接线（仅首帧模式） -->
                <div v-if="videoGenMode === 'firstframe' && getNextShot(shot)" class="sbe-vid-chain__connector">
                  <div class="sbe-vid-chain__connector-line"></div>
                  <span class="sbe-vid-chain__connector-label">尾帧 → 首帧</span>
                  <div class="sbe-vid-chain__connector-line"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 7: 合成视频 ── -->
        <div v-else-if="currentStep.key === 'compose'" key="compose" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🎬 合成视频</h2>
            <p class="sbe-panel-desc">将所有已生成的镜头视频按顺序拼接为整集视频</p>

            <div class="sbe-compose-status">
              <div class="sbe-compose-status__bar">
                <span class="sbe-compose-status__done">已生成视频：{{ shotVideoDoneCount }} / {{ episodeShots.length }}</span>
                <span v-if="allVideosReady" class="sbe-compose-status__ready">✅ 所有镜头视频已就绪</span>
                <span v-else class="sbe-compose-status__warn">⚠️ 还有 {{ episodeShots.length - shotVideoDoneCount }} 个镜头未生成视频</span>
              </div>
            </div>

            <div v-if="composeError" class="sbe-compose-error">{{ composeError }}</div>

            <div v-if="composedVideoUrl" class="sbe-compose-preview">
              <h3>合成预览</h3>
              <video :src="composedVideoUrl" class="sbe-compose-video" controls preload="metadata"></video>
            </div>

            <div class="sbe-compose-actions">
              <button class="sbe-action-btn sbe-action-btn--lg" :disabled="composingVideo || shotVideoDoneCount === 0" @click="composeEpisodeVideo">
                {{ composingVideo ? `⏳ 合成中… ${composeElapsed}` : composedVideoUrl ? '🔄 重新合成' : '🎬 开始合成视频' }}
              </button>
              <p v-if="shotVideoDoneCount === 0" class="sbe-compose-actions__hint">请先在"镜头视频"步骤生成至少一个镜头视频</p>
            </div>
          </div>
        </div>

        <!-- ── Step 8: 画质提升 ── -->
        <div v-else-if="currentStep.key === 'enhance'" key="enhance" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">✨ 画质提升</h2>
            <p class="sbe-panel-desc">对合成视频进行 AI 超分辨率增强与锐化修复，消除涂抹感，达到大片级质感</p>

            <div v-if="!composedVideoUrl" class="sbe-enhance-empty">
              ⚠️ 请先在上一步"合成视频"中完成视频合成
            </div>

            <template v-else>
              <div class="sbe-enhance-options">
                <label class="sbe-enhance-option">
                  <input type="radio" v-model="enhanceMethod" value="upscale" />
                  <span>超分辨率（2x 放大）</span>
                </label>
                <label class="sbe-enhance-option">
                  <input type="radio" v-model="enhanceMethod" value="sharpen" />
                  <span>锐化修复</span>
                </label>
                <label class="sbe-enhance-option">
                  <input type="radio" v-model="enhanceMethod" value="both" />
                  <span>超分 + 锐化（推荐）</span>
                </label>
              </div>

              <!-- 原片 vs 增强对比 -->
              <div class="sbe-enhance-compare">
                <div class="sbe-enhance-compare__item">
                  <span class="sbe-enhance-compare__label">原片</span>
                  <video :src="composedVideoUrl" class="sbe-enhance-compare__video" controls preload="metadata"></video>
                </div>
                <div class="sbe-enhance-compare__item" v-if="enhancedVideoUrl">
                  <span class="sbe-enhance-compare__label sbe-enhance-compare__label--ok">✨ 增强后</span>
                  <video :src="enhancedVideoUrl" class="sbe-enhance-compare__video" controls preload="metadata"></video>
                </div>
              </div>

              <div v-if="enhanceError" class="sbe-compose-error">{{ enhanceError }}</div>

              <div class="sbe-compose-actions">
                <button
                  class="sbe-action-btn sbe-action-btn--lg"
                  :disabled="enhancingVideo || !composedVideoUrl"
                  @click="enhanceEpisodeVideo"
                >
                  {{ enhancingVideo ? `⏳ 增强中… ${enhanceElapsed}` : enhancedVideoUrl ? '🔄 重新增强' : '✨ 开始画质提升' }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Step 9: AI 配音 ── -->
        <div v-else-if="currentStep.key === 'dubbing'" key="dubbing" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">🎙️ AI 配音</h2>
            <p class="sbe-panel-desc">为每个镜头分段配音，支持 AI 生成或导入自定义音频文件</p>

            <div class="sbe-dub-toolbar">
              <button class="sbe-action-btn" @click="buildDubSegments" :disabled="episodeShots.length === 0">
                📋 {{ dubSegments.length > 0 ? '刷新' : '生成' }}配音列表
              </button>
              <button v-if="dubSegments.length > 0" class="sbe-action-btn"
                :disabled="dubGenerating" @click="generateAllDubSegments">
                {{ dubGenerating ? '⏳ 批量配音中…' : '🎙️ 一键 AI 配音' }}
              </button>
              <span class="sbe-dub-toolbar__count">已完成 {{ dubDoneCount }} / {{ dubSegments.length }}</span>
            </div>

            <!-- 配音列表 -->
            <div v-if="dubSegments.length > 0" class="sbe-dub-list">
              <div v-for="seg in dubSegments" :key="seg.shotId" class="sbe-dub-item"
                :class="{ 'sbe-dub-item--done': seg.status === 'done' || seg.status === 'imported', 'sbe-dub-item--error': seg.status === 'error' }">
                <div class="sbe-dub-item__header">
                  <span class="sbe-dub-item__shot">#{{ seg.shotIndex }} {{ seg.title }}</span>
                  <span class="sbe-dub-item__status"
                    :class="{
                      'sbe-dub-item__status--done': seg.status === 'done' || seg.status === 'imported',
                      'sbe-dub-item__status--gen': seg.status === 'generating',
                      'sbe-dub-item__status--err': seg.status === 'error',
                    }">
                    {{ seg.status === 'done' ? '✅' : seg.status === 'imported' ? '📂' : seg.status === 'generating' ? '⏳' : seg.status === 'error' ? '❌' : '⬜' }}
                  </span>
                </div>
                <div class="sbe-dub-item__text">{{ seg.text || '（无对白/旁白文本）' }}</div>
                <div class="sbe-dub-item__controls">
                  <select class="sbe-sb-edit-cine__select" v-model="seg.voiceId" style="max-width:180px"
                    @change="onDubVoiceChange(seg, ($event.target as HTMLSelectElement).value)">
                    <option v-for="v in VOICE_PRESETS" :key="v.id" :value="v.id">{{ v.name }}</option>
                  </select>
                  <button class="sbe-pv-btn sbe-pv-btn--regen" :disabled="seg.status === 'generating' || !seg.text"
                    @click="generateDubSegment(seg)">
                    {{ seg.status === 'generating' ? '⏳' : seg.audioUrl ? '🔄 重新配音' : '🎙️ AI 配音' }}
                  </button>
                  <label class="sbe-dub-item__import">
                    📂 导入音频
                    <input type="file" accept="audio/*" style="display:none" @change="(($event.target as HTMLInputElement).files?.[0]) ? importDubAudio(seg, ($event.target as HTMLInputElement).files![0]) : null" />
                  </label>
                </div>
                <audio v-if="seg.audioUrl" :src="seg.audioUrl" controls class="sbe-dub-item__audio" preload="metadata"></audio>
                <div v-if="seg.error" class="sbe-dub-item__error">{{ seg.error }}</div>
              </div>
            </div>
            <div v-else class="sbe-dub-empty">点击"生成配音列表"开始。系统会从每个镜头的对白/旁白文本中提取配音内容。</div>
          </div>
        </div>

        <!-- ── Step 9: 合成导出 ── -->
        <div v-else-if="currentStep.key === 'final'" key="final" class="sbe-panel">
          <div class="sbe-panel-inner">
            <h2 class="sbe-panel-title">📦 合成导出</h2>
            <p class="sbe-panel-desc">合成视频 + 配音，预览确认后导出成品</p>

            <div class="sbe-final-status">
              <div class="sbe-final-status__item">
                <span>镜头视频</span>
                <span :class="allVideosReady ? 'sbe-final-ok' : 'sbe-final-warn'">{{ allVideosReady ? '✅ 就绪' : '⚠️ 未完成' }}</span>
              </div>
              <div class="sbe-final-status__item">
                <span>合成视频</span>
                <span :class="composedVideoUrl ? 'sbe-final-ok' : 'sbe-final-warn'">{{ composedVideoUrl ? '✅ 就绪' : '⚠️ 未合成' }}</span>
              </div>
              <div class="sbe-final-status__item">
                <span>画质提升</span>
                <span :class="enhancedVideoUrl ? 'sbe-final-ok' : 'sbe-final-warn'">{{ enhancedVideoUrl ? '✅ 已增强' : '⚠️ 未增强' }}</span>
              </div>
              <div class="sbe-final-status__item">
                <span>配音</span>
                <span :class="allDubReady ? 'sbe-final-ok' : 'sbe-final-warn'">{{ allDubReady ? '✅ 就绪' : `⚠️ ${dubDoneCount}/${dubSegments.length}` }}</span>
              </div>
            </div>

            <div v-if="finalError" class="sbe-compose-error">{{ finalError }}</div>

            <!-- 导出参数设置 -->
            <div class="sbe-export-settings">
              <h3 class="sbe-export-settings__title">导出设置</h3>
              <div class="sbe-export-settings__grid">
                <label class="sbe-export-settings__item">
                  <span>格式</span>
                  <select v-model="exportFormat" class="sbe-export-settings__select">
                    <option v-for="opt in exportFormatOptions" :key="opt.value" :value="opt.value">
                      {{ opt.icon }} {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label class="sbe-export-settings__item">
                  <span>帧率</span>
                  <select v-model.number="exportFps" class="sbe-export-settings__select">
                    <option v-for="fps in fpsOptions" :key="fps" :value="fps">{{ fps }} fps</option>
                  </select>
                </label>
                <label class="sbe-export-settings__item">
                  <span>码率</span>
                  <select v-model="exportBitrate" class="sbe-export-settings__select">
                    <option v-for="opt in bitrateOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }} — {{ opt.desc }}
                    </option>
                  </select>
                </label>
                <label class="sbe-export-settings__item sbe-export-settings__item--checkbox">
                  <input type="checkbox" v-model="exportSubtitle" />
                  <span>内嵌字幕</span>
                </label>
                <label v-if="exportSubtitle" class="sbe-export-settings__item">
                  <span>字幕方式</span>
                  <select v-model="exportSubtitleMode" class="sbe-export-settings__select">
                    <option value="embedded">内嵌（硬字幕）</option>
                    <option value="srt">SRT 外挂</option>
                  </select>
                </label>
              </div>
              <div class="sbe-export-settings__estimate">
                预估大小 {{ estimatedExportSize }} · 预估耗时 {{ estimatedExportTime }}
              </div>
            </div>

            <div v-if="finalVideoUrl" class="sbe-final-preview">
              <h3>最终预览</h3>
              <video :src="finalVideoUrl" class="sbe-compose-video" controls preload="metadata"></video>
            </div>

            <div class="sbe-final-actions">
              <button class="sbe-action-btn sbe-action-btn--lg" :disabled="finalComposing || !composedVideoUrl" @click="composeFinalVideo">
                {{ finalComposing ? `⏳ 合成中… ${finalElapsed}` : finalVideoUrl ? '🔄 重新合成' : '🎬 合成最终视频' }}
              </button>
              <button v-if="finalVideoUrl" class="sbe-action-btn sbe-action-btn--lg" @click="startExport">
                📤 导出成品
              </button>
            </div>
          </div>
        </div>

      </Transition>
    </div>

    <!-- ═══════════ 底部导航 ═══════════ -->
    <footer class="sbe-footer">
      <div class="sbe-footer-left">
        <button
          v-if="currentStepIndex > 0"
          class="sbe-nav-btn"
          @click="goPrev"
        >← 上一步</button>
      </div>
      <div class="sbe-footer-center">
        <span class="sbe-footer-step-info">
          {{ currentStep.icon }} {{ currentStep.label }} — {{ currentStep.description }}
        </span>
      </div>
      <div class="sbe-footer-right">
        <button
          v-if="currentStepIndex < STEPS.length - 1"
          class="sbe-nav-btn sbe-nav-btn--primary"
          :class="{ 'sbe-nav-btn--blocked': !currentGate.ok }"
          @click="onNextClick"
        >下一步 →</button>
        <button
          v-else
          class="sbe-nav-btn sbe-nav-btn--primary"
          @click="startExport"
        >📤 完成导出</button>
        <p v-if="!currentGate.ok" class="sbe-gate-tip" role="alert" aria-live="assertive">
          ⚠ {{ currentGate.reason }}
        </p>
      </div>
    </footer>
    <Transition name="sbe-fade">
      <div v-if="draftSaveWarning" class="sbe-draft-warn" role="alert" aria-live="polite">
        <span>⚠ 草稿自动保存失败（本地存储可能已满）。当前内容仍在内存中，请尽快导出项目以免丢失。</span>
        <button class="sbe-draft-warn__close" @click="draftSaveWarning = false" aria-label="关闭提示">✕</button>
      </div>
    </Transition>
  </div>

  <!-- Image Preview Modal -->
  <Teleport to="body">
    <div v-if="previewModalVisible" class="sbe-preview-modal" @click.self="closeImagePreview">
      <div class="sbe-preview-modal__content">
        <button class="sbe-preview-modal__close" @click="closeImagePreview">✕</button>
        <h3 class="sbe-preview-modal__title">{{ previewModalTitle }}</h3>
        <div class="sbe-preview-modal__img-wrap">
          <div v-if="previewModalRegenerating" class="sbe-preview-modal__regen-overlay">
            <div class="sbe-spinner"></div>
            <span>正在重新生成…</span>
          </div>
          <img :src="bustCache(previewModalUrl)" :alt="previewModalTitle" class="sbe-preview-modal__img" />
        </div>
        <div v-if="previewModalOnRegenerate" class="sbe-preview-modal__actions">
          <button class="sbe-preview-modal__regen-btn" @click="regenerateFromModal" :disabled="previewModalRegenerating">
            {{ previewModalRegenerating ? '⏳ 生成中…' : '🔄 重新生成' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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

.sbe-root {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 52px);
  background: var(--bg-primary, var(--bg-primary, var(--bg-primary, #0E0F12)));
  color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED)));
}

/* ═══════════ 顶部标题栏 ═══════════ */
.sbe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  flex-shrink: 0;
}
.sbe-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sbe-back-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}
.sbe-back-btn:hover { border-color: var(--accent, #818cf8); color: var(--accent, #818cf8); }
.sbe-project-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED)));
}
.sbe-header-sep { color: var(--text-muted, var(--text-muted, #64748B)); }
.sbe-header-sub { font-size: 13px; color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF))); }
.sbe-header-right { display: flex; align-items: center; gap: 8px; }
.sbe-proj-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #aab);
}
.sbe-proj-picker__label {
  opacity: 0.8;
  white-space: nowrap;
}
.sbe-proj-picker select {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-secondary, #181B21);
  color: var(--text, #e8e8ea);
  max-width: 180px;
}
.sbe-step-indicator {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
  font-weight: 600;
}

/* ═══════════ 步骤栏 ═══════════ */
.sbe-stepbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 0;
  border-bottom: 1px solid var(--border, #2E3139);
  background: var(--bg-secondary, #1A1C21);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.sbe-stepbar::-webkit-scrollbar { display: none; }

.sbe-step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  cursor: pointer;
  padding: 4px 0;
  position: relative;
  transition: opacity 200ms;
}
.sbe-step-item:hover { opacity: 0.85; }

.sbe-step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 200ms;
}
.sbe-step-item--pending .sbe-step-dot {
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #64748B);
  border: 1px solid var(--border, #2E3139);
}
.sbe-step-item--active .sbe-step-dot {
  background: var(--accent, #818cf8);
  color: #fff;
  box-shadow: 0 0 12px rgba(129, 140, 248, 0.4);
  transform: scale(1.1);
}
.sbe-step-item--done .sbe-step-dot {
  background: #34d399;
  color: #fff;
}
.sbe-step-check { font-size: 11px; }
.sbe-step-num { font-size: 11px; }

.sbe-step-text {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.sbe-step-icon { font-size: 13px; }
.sbe-step-label {
  font-size: 11px;
  font-weight: 600;
}
.sbe-step-item--pending .sbe-step-label { color: var(--text-muted, #64748B); }
.sbe-step-item--active .sbe-step-label { color: var(--accent, #818cf8); }
.sbe-step-item--done .sbe-step-label { color: #34d399; }
.sbe-step-progress-badge {
  font-size: 9px;
  color: var(--text-muted, #64748B);
  background: rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 1px 5px;
  white-space: nowrap;
}
.sbe-action-btn--ghost {
  background: transparent;
  border: 1px solid var(--border-color, #334155);
  color: var(--text-secondary, #9CA3AF);
}
.sbe-action-btn--ghost:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary, #E2E8F0);
}
.sbe-action-btn--active {
  border-color: var(--accent, #818cf8) !important;
  color: var(--accent, #818cf8) !important;
}
.sbe-sb-toolbar-info__locked {
  font-size: 11px;
  color: #facc15;
  margin-left: 6px;
}

.sbe-step-line {
  width: 18px;
  height: 2px;
  background: var(--border, #2E3139);
  margin: 0 3px;
  flex-shrink: 0;
  transition: background 200ms;
}
.sbe-step-line--done { background: #34d399; }

.sbe-stepbar__progress {
  margin-left: auto;
  padding-left: 12px;
  flex-shrink: 0;
}
.sbe-stepbar__pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  background: var(--bg-tertiary, #1a2332);
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

/* ═══════════ 步骤内容区 ═══════════ */
.sbe-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.sbe-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sbe-panel--flush {
  overflow: hidden;
}
.sbe-panel-inner {
  flex: 1;
  padding: 28px 32px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sbe-panel-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED)));
  margin: 0 0 6px;
  text-align: center;
}
.sbe-panel-desc {
  font-size: 13px;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  margin: 0 0 24px;
  text-align: center;
}

/* ── 项目资产库状态徽章 ── */
.sbe-project-lib-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
}
.sbe-project-lib-badge--empty {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
}

/* 角色搜索栏 */
.sbe-char-search {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.sbe-char-search__input {
  flex: 1;
  padding: 8px 14px;
  background: var(--bg-card, #1E1E2E);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  color: var(--text-primary, #E0E0E0);
  font-size: 13px;
}
.sbe-char-search__input:focus { border-color: var(--accent, #818cf8); outline: none; }
.sbe-char-search__count {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  white-space: nowrap;
}

/* ── 上传区 ── */
.sbe-upload-zone {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.sbe-upload-drop {
  width: 100%;
  border: 2px dashed var(--border, #2E3139);
  border-radius: 12px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary, #1A1C21);
  cursor: pointer;
  transition: border-color 200ms, background 200ms;
}
.sbe-upload-drop:hover,
.sbe-upload-drop:focus-visible { border-color: var(--accent, #818cf8); outline: none; }
.sbe-upload-drop--active {
  border-color: var(--accent, #00BFA5);
  background: var(--accent-muted, rgba(0, 191, 165, 0.12));
}
.sbe-upload-icon { font-size: 40px; opacity: 0.4; }
.sbe-upload-text { font-size: 14px; font-weight: 600; color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED))); }
.sbe-upload-hint { font-size: 11px; color: var(--text-muted, var(--text-muted, #64748B)); }
.sbe-text-input {
  width: 100%;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED)));
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 200ms;
}
.sbe-text-input:focus { border-color: var(--accent, #818cf8); }
.sbe-text-counter { font-size: 12px; color: var(--accent, #00BFA5); margin-top: 6px; text-align: right; }

/* ── 占位卡片 ── */
.sbe-placeholder-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
}
.sbe-placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 10px;
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  border-radius: 10px;
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  transition: border-color 150ms;
}
.sbe-placeholder-card:hover { border-color: var(--accent, #818cf8); }
.sbe-placeholder-avatar { font-size: 28px; }
.sbe-placeholder-name { font-size: 11px; font-weight: 600; color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED))); text-align: center; }
.sbe-placeholder-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}
.sbe-scene-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 20px;
  margin-bottom: 20px;
  border: 1px dashed var(--border, #2E3139);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
}
.sbe-scene-empty__icon { font-size: 36px; opacity: 0.5; }
.sbe-scene-empty__text { font-size: 13px; color: var(--text-muted, #64748B); text-align: center; }

/* ── 风格卡片 ── */
.sbe-style-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 900px;
}
.sbe-style-card {
  padding: 18px 14px;
  border: 2px solid var(--border, var(--border, var(--border, #2E3139)));
  border-radius: 10px;
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  cursor: pointer;
  text-align: center;
  transition: all 200ms;
}
.sbe-style-card:hover { border-color: var(--border-strong, #334155); transform: translateY(-2px); }
.sbe-style-card--selected { border-color: var(--accent, #818cf8); background: rgba(129, 140, 248, 0.05); }
.sbe-style-icon { font-size: 28px; margin-bottom: 6px; }
.sbe-style-name { font-size: 13px; font-weight: 700; color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED))); }
.sbe-style-desc { font-size: 11px; color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF))); margin-top: 4px; }

/* ── 预览区 ── */
.sbe-preview-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 480px;
}
.sbe-preview-placeholder {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-preview-empty-icon { font-size: 48px; opacity: 0.3; }
.sbe-preview-done-icon { font-size: 48px; }
.sbe-preview-progress-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: sbe-pulse 1.5s ease-in-out infinite;
}
.sbe-preview-progress-text { font-size: 16px; font-weight: 700; color: var(--accent, #818cf8); }
@keyframes sbe-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.sbe-preview-bar {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary, #1a2332);
  overflow: hidden;
}
.sbe-preview-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #00BFA5), #7C3AED);
  transition: width 80ms linear;
  border-radius: 2px;
}

/* ── 导出选项 ── */
.sbe-export-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
}
.sbe-export-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px;
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  border-radius: 10px;
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  cursor: pointer;
  transition: border-color 150ms;
}
.sbe-export-card:hover { border-color: var(--accent, #818cf8); }
.sbe-export-icon { font-size: 24px; }
.sbe-export-name { font-size: 11px; font-weight: 600; color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED))); }

/* ── 公共按钮 ── */
.sbe-action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent, #00BFA5) 0%, #7C3AED 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 200ms;
}
.sbe-action-btn:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }
.sbe-action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.sbe-extract-error { color: #FBBF24; font-size: 13px; text-align: center; margin-bottom: 10px; padding: 8px 14px; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 8px; }

/* ═══════════ 底部导航 ═══════════ */
.sbe-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  background: var(--bg-secondary, var(--bg-secondary, #1A1C21));
  flex-shrink: 0;
}
.sbe-footer-left,
.sbe-footer-right {
  flex-shrink: 0;
  min-width: 100px;
}
.sbe-footer-right { text-align: right; }
.sbe-footer-center {
  flex: 1;
  text-align: center;
}
.sbe-footer-step-info {
  font-size: 12px;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
}

.sbe-nav-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--border, var(--border, var(--border, #2E3139)));
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
}
.sbe-nav-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, var(--text-primary, var(--text-primary, #E8EAED))); }
.sbe-nav-btn--primary {
  background: linear-gradient(135deg, var(--accent, #00BFA5) 0%, #7C3AED 100%);
  color: white;
  border: none;
  font-weight: 600;
}
.sbe-nav-btn--primary:hover { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transform: translateY(-1px); }

/* ═══════════ 过渡动画 ═══════════ */
.sbe-slide-enter-active,
.sbe-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.sbe-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.sbe-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .sbe-stepbar { padding: 8px 12px; }
  .sbe-step-label { display: none; }
  .sbe-step-line { width: 12px; }
  .sbe-placeholder-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-style-grid { grid-template-columns: repeat(3, 1fr); }
  .sbe-export-options { grid-template-columns: repeat(2, 1fr); }
  .sbe-panel-inner { padding: 20px 16px; }
  .sbe-sbt-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-char-grid { grid-template-columns: 1fr; }
  .sbe-sb-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-pv-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-pv-modes { grid-template-columns: 1fr; }
  .sbe-export-format-grid { grid-template-columns: repeat(2, 1fr); }
  .sbe-export-row { grid-template-columns: 1fr; }
  .sbe-setup-aspect-grid { grid-template-columns: 1fr; }
  .sbe-scene-grid { grid-template-columns: 1fr; }
  .sbe-sb-edit-row { grid-template-columns: 1fr; }
  .sbe-sb-edit-panel { width: 95vw; }
  .sbe-sb-edit-panel--workspace { width: 98vw; }
  .sbe-sb-edit-workspace { flex-direction: column; }
  .sbe-sb-edit-visual { width: 100%; min-width: 0; border-right: none; border-bottom: 1px solid var(--border, #2E3139); max-height: none; }
  .sbe-sb-edit-form { max-height: none; }
  .sbe-char-edit-row { grid-template-columns: 1fr; }
}

/* ===== ENH-3: AI角色自动描图 ===== */
.sbe-char-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.sbe-char-card {
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 200ms ease;
}

.sbe-char-card--expanded {
  border-color: var(--accent, #6366f1);
}

.sbe-char-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: var(--text-primary, #f1f5f9);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 150ms ease;
}

.sbe-char-card__header:hover {
  background: var(--bg-tertiary, #23262e);
}

.sbe-char-card__avatar {
  font-size: 24px;
  flex-shrink: 0;
}

.sbe-char-card__name {
  font-weight: 600;
  font-size: 14px;
  flex: 1;
}

.sbe-char-card__role {
  font-size: 11px;
  color: var(--text-muted, #555);
  background: var(--bg-tertiary, #23262e);
  padding: 2px 8px;
  border-radius: 8px;
}

.sbe-char-card__arrow {
  color: var(--text-muted, #555);
  font-size: 12px;
}

.sbe-char-card__body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sbe-char-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.sbe-char-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent, #6366f1);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.sbe-char-tag__remove {
  background: transparent;
  border: none;
  color: var(--accent, #6366f1);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 150ms ease;
}

.sbe-char-tag__remove:hover {
  opacity: 1;
}

.sbe-char-tag-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sbe-char-tag-input {
  width: 80px;
  padding: 3px 8px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 12px;
  color: var(--text-primary, #f1f5f9);
  font-size: 11px;
  font-family: inherit;
  outline: none;
}

.sbe-char-tag-input:focus {
  border-color: var(--accent, #6366f1);
}

.sbe-char-tag-add {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent, #6366f1);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sbe-char-gen-btn {
  padding: 8px 14px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.sbe-char-gen-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.sbe-char-gen-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Multi-angle character views grid */
.sbe-char-views-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.sbe-char-view-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-subtle, #2a2a3e);
  background: rgba(255, 255, 255, 0.03);
}

.sbe-char-view-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.sbe-char-view-label {
  font-size: 11px;
  text-align: center;
  padding: 4px 0;
  color: var(--text-secondary, #94a3b8);
  background: rgba(0, 0, 0, 0.3);
}

.sbe-char-view-regen {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: #fff;
}

.sbe-char-view-item:hover .sbe-char-view-regen {
  opacity: 1;
}

.sbe-char-view-loading {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
}

.sbe-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: sbe-spin 0.8s linear infinite;
}

@keyframes sbe-spin {
  to { transform: rotate(360deg); }
}

.sbe-char-view-error {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  color: #f87171;
  font-size: 11px;
  text-align: center;
}

.sbe-char-view-error .sbe-char-view-regen {
  position: static;
  opacity: 1;
  width: auto;
  height: auto;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
}

.sbe-char-view-empty {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #64748b);
  font-size: 12px;
}

/* ===== ENH-4: 分镜模板库 ===== */
.sbe-sbt-section {
  margin-bottom: 20px;
}

.sbe-sub-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
  margin: 0 0 12px;
}

.sbe-sub-optional {
  font-weight: 400;
  font-size: 12px;
  color: var(--text-muted, #555);
}

.sbe-sbt-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.sbe-sbt-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  text-align: center;
  transition: all 200ms ease;
}

.sbe-sbt-card:hover {
  border-color: var(--accent, #6366f1);
  background: var(--bg-tertiary, #23262e);
}

.sbe-sbt-card--selected {
  border-color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.sbe-sbt-card__icon {
  font-size: 28px;
}

.sbe-sbt-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
}

.sbe-sbt-card__structure {
  font-size: 10px;
  color: var(--accent, #6366f1);
  line-height: 1.3;
}

.sbe-sbt-card__best {
  font-size: 10px;
  color: var(--text-muted, #555);
  line-height: 1.3;
}

.sbe-section-divider {
  height: 1px;
  background: var(--border, #2a2d35);
  margin: 20px 0;
}

/* ===== ENH-5: 生成进度可视化 ===== */
.sbe-progress-viz {
  max-width: 560px;
  margin: 0 auto;
}

.sbe-progress-phase {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 18px;
  margin-bottom: 8px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
  transition: all 300ms ease;
}

.sbe-progress-phase--active {
  border-color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.06);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.1);
}

.sbe-progress-phase--done {
  border-color: var(--border, #2a2d35);
  opacity: 0.7;
}

.sbe-progress-phase--pending {
  opacity: 0.35;
}

.sbe-progress-phase__status {
  font-size: 20px;
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.sbe-progress-phase__spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

.sbe-progress-phase__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sbe-progress-phase__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
}

.sbe-progress-phase__detail {
  font-size: 12px;
  color: var(--text-muted, #555);
}

.sbe-progress-overall {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  margin-top: 4px;
}

.sbe-progress-overall-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary, #1a1c21);
  border-radius: 3px;
  overflow: hidden;
}

.sbe-progress-overall-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  border-radius: 3px;
  transition: width 500ms ease;
}

.sbe-progress-overall-pct {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #6366f1);
  min-width: 36px;
  text-align: right;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== ENH-13: 移动端轻量模式 ===== */
.storyboard-root--lightweight * {
  transition-duration: 0ms !important;
  animation-duration: 0ms !important;
}
.storyboard-root--lightweight .step-indicator::after {
  animation: none !important;
}
@media (max-width: 768px) {
  .storyboard-root--lightweight .step-panel {
    padding: 12px;
  }
  .storyboard-root--lightweight .preview-canvas {
    transform: scale(0.7);
  }
}

/* ================================================================ */
/*  Image Preview Modal                                              */
/* ================================================================ */
.sbe-preview-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.sbe-preview-modal__content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sbe-preview-modal__close {
  position: absolute;
  top: -40px;
  right: -10px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  font-size: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.sbe-preview-modal__close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.sbe-preview-modal__title {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  text-align: center;
}

.sbe-preview-modal__img {
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.sbe-preview-modal__img-wrap {
  position: relative;
  display: inline-block;
}
.sbe-preview-modal__regen-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 12px;
  z-index: 2;
  color: #fff;
  font-size: 14px;
}
.sbe-preview-modal__actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
.sbe-preview-modal__regen-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(99, 102, 241, 0.7);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.sbe-preview-modal__regen-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
}
.sbe-preview-modal__regen-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ================================================================ */
/*  Character Actions Row                                            */
/* ================================================================ */
.sbe-char-actions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.sbe-action-btn--secondary {
  background: linear-gradient(135deg, #374151, #4b5563) !important;
}

.sbe-action-btn--secondary:hover {
  background: linear-gradient(135deg, #4b5563, #6b7280) !important;
}

/* ================================================================ */
/*  Character Image - Clickable + Regen Button                       */
/* ================================================================ */
.sbe-char-view-img--clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.sbe-char-view-img--clickable:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

/* ================================================================ */
/*  Character Save to Library Button                                 */
/* ================================================================ */
.sbe-char-save-lib-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.sbe-char-save-lib-btn:hover {
  background: linear-gradient(135deg, #10b981, #34d399);
  transform: translateY(-1px);
}

/* ================================================================ */
/*  Library Message Toast                                            */
/* ================================================================ */
.sbe-library-message {
  margin-top: 8px;
  padding: 8px 16px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  color: #6ee7b7;
  font-size: 13px;
  text-align: center;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ================================================================ */
/*  Library Panel                                                    */
/* ================================================================ */
.sbe-library-panel {
  margin-top: 16px;
  padding: 16px;
  background: rgba(30, 30, 50, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  animation: slideDown 0.3s ease;
}

.sbe-library-empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.sbe-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.sbe-library-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  transition: border-color 0.2s;
}

.sbe-library-card:hover {
  border-color: rgba(124, 58, 237, 0.4);
}

.sbe-library-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.sbe-library-card__avatar {
  font-size: 24px;
  flex-shrink: 0;
}

.sbe-library-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.sbe-library-card__role {
  font-size: 12px;
  color: #94a3b8;
}

.sbe-library-card__del {
  margin-left: auto;
  background: rgba(239, 68, 68, 0.15);
  border: none;
  color: #f87171;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.sbe-library-card:hover .sbe-library-card__del {
  opacity: 1;
}

.sbe-library-card__del:hover {
  background: rgba(239, 68, 68, 0.3);
}

.sbe-library-card__thumbs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.sbe-library-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
}

.sbe-library-thumb:hover {
  transform: scale(1.05);
  border-color: rgba(124, 58, 237, 0.5);
}

.sbe-library-thumb-empty {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 9px;
  color: #64748b;
  text-align: center;
  padding: 2px;
}

/* 图片过期回退 */
.sbe-library-thumb-fallback {
  width: 100%;
  aspect-ratio: 1;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px;
}
.sbe-library-thumb-fallback-visible { display: flex; }
.sbe-library-thumb-expired { font-size: 16px; }
.sbe-library-thumb-label { font-size: 9px; color: var(--text-muted, #64748B); }

.sbe-library-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.sbe-library-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.15);
  color: #c4b5fd;
}

.sbe-library-card__import {
  width: 100%;
  padding: 8px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.sbe-library-card__import:hover {
  background: linear-gradient(135deg, #8b5cf6, #c084fc);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ================================================================ */
/*  Step 1: Project Setup                                            */
/* ================================================================ */
.sbe-setup {
  max-width: 640px !important;
}
.sbe-setup-field {
  width: 100%;
  margin-bottom: 20px;
}
.sbe-setup-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 8px;
}
.sbe-setup-value {
  font-weight: 400;
  color: var(--accent, #818cf8);
  margin-left: 8px;
}
.sbe-setup-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 200ms;
}
.sbe-setup-input:focus { border-color: var(--accent, #818cf8); }

/* 项目继承下拉 */
.sbe-setup-inherit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-setup-select {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-card, #1E1E2E);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  color: var(--text-primary, #E0E0E0);
  font-size: 14px;
  cursor: pointer;
  appearance: auto;
}
.sbe-setup-select:focus { border-color: var(--accent, #818cf8); outline: none; }
.sbe-setup-inherit-status {
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--text-secondary, #94A3B8);
}
.sbe-setup-inherit-status--ok {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}
.sbe-setup-inherit-status--warn {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.sbe-setup-inherit-status--err {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.sbe-setup-label-hint {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  font-weight: 400;
}

.sbe-setup-range {
  width: 100%;
  accent-color: var(--accent, #818cf8);
  cursor: pointer;
}
.sbe-setup-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted, #64748B);
  margin-top: 4px;
}
.sbe-setup-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sbe-setup-chip {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
  font-family: inherit;
}
.sbe-setup-chip:hover { border-color: var(--accent, #818cf8); }
.sbe-setup-chip--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}
.sbe-setup-chip-desc {
  display: block;
  font-size: 10px;
  color: var(--text-muted, #64748B);
  margin-top: 2px;
}
.sbe-setup-aspect-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.sbe-setup-aspect-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  background: var(--bg-secondary, #1A1C21);
  cursor: pointer;
  transition: all 200ms;
  font-family: inherit;
  color: var(--text-primary, #E8EAED);
}
.sbe-setup-aspect-card:hover { border-color: var(--accent, #818cf8); }
.sbe-setup-aspect-card--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.08);
}
.sbe-setup-aspect-icon { font-size: 24px; }
.sbe-setup-aspect-label { font-size: 12px; font-weight: 600; }
.sbe-setup-aspect-desc { font-size: 10px; color: var(--text-muted, #64748B); }
.sbe-setup-summary {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 10px;
  margin-top: 8px;
}
.sbe-setup-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sbe-setup-summary-label { font-size: 11px; color: var(--text-muted, #64748B); }
.sbe-setup-summary-value { font-size: 16px; font-weight: 700; color: var(--accent, #818cf8); }

/* ================================================================ */
/*  Step 3: Character Edit Enhancements                              */
/* ================================================================ */
.sbe-char-card {
  position: relative;
}
.sbe-char-card__delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  border: none;
  color: #f87171;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 200ms;
  z-index: 2;
}
.sbe-char-card:hover .sbe-char-card__delete { opacity: 1; }
.sbe-char-card__delete:hover { background: rgba(239, 68, 68, 0.25); }
.sbe-char-edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.sbe-char-edit-field {
  margin-bottom: 8px;
}
.sbe-char-edit-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 4px;
}
.sbe-char-edit-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 200ms;
}
.sbe-char-edit-input:focus { border-color: var(--accent, #818cf8); }
.sbe-char-voice-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.sbe-char-voice-row .sbe-char-edit-label {
  margin-bottom: 0;
  white-space: nowrap;
  min-width: 52px;
}
.sbe-char-voice-select {
  flex: 1;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 200ms;
}
.sbe-char-voice-select:focus { border-color: var(--accent, #818cf8); }
.sbe-char-voice-select optgroup { font-weight: 600; color: var(--text-secondary, #9CA3AF); }
.sbe-char-edit-textarea {
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color 200ms;
}
.sbe-char-edit-textarea:focus { border-color: var(--accent, #818cf8); }
.sbe-char-ref-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  margin-bottom: 8px;
}
.sbe-char-ref-tag__icon { font-size: 14px; }
.sbe-char-ref-tag__text { font-size: 11px; color: #6ee7b7; }

/* ================================================================ */
/*  Step 4: Scene Cards (Enhanced)                                   */
/* ================================================================ */
.sbe-scene-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  width: 100%;
  max-width: 640px;
  margin-bottom: 20px;
}
.sbe-scene-card {
  position: relative;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 200ms;
}
.sbe-scene-card:hover { border-color: var(--accent, #818cf8); }
.sbe-scene-card__delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  border: none;
  color: #f87171;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 200ms;
  z-index: 2;
}
.sbe-scene-card:hover .sbe-scene-card__delete { opacity: 1; }
.sbe-scene-card__visual {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--bg-tertiary, #1a2332);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-scene-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.sbe-scene-card__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted, #64748B);
  font-size: 12px;
}
.sbe-scene-card__placeholder { font-size: 36px; }
.sbe-scene-card__icon { opacity: 0.5; }
.sbe-scene-card__fields {
  padding: 10px 12px;
}
.sbe-scene-card__field {
  margin-bottom: 6px;
}
.sbe-scene-card__actions {
  padding: 8px 12px 12px;
}
.sbe-scene-gen-btn {
  width: 100%;
  padding: 7px 12px;
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  font-family: inherit;
}
.sbe-scene-gen-btn:hover { background: linear-gradient(135deg, #10b981, #34d399); }
.sbe-scene-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ================================================================ */
/*  Step 5: Storyboard                                               */
/* ================================================================ */
.sbe-storyboard {
  max-width: 900px !important;
}
.sbe-sb-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  width: 100%;
}
.sbe-sb-toolbar-info {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
/* 分镜级世界观选择器 */
.sbe-sb-worldview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: 10px;
  background: var(--surface-2, #1a1d24);
  border: 1px solid var(--border, #2E3139);
}
.sbe-sb-worldview-bar__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E5E7EB);
  white-space: nowrap;
}
.sbe-sb-worldview-bar__select {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--surface-3, #22252d);
  color: var(--text-primary, #E5E7EB);
  font-size: 13px;
  cursor: pointer;
  outline: none;
}
.sbe-sb-worldview-bar__select:focus {
  border-color: var(--accent, #6366F1);
}
.sbe-sb-worldview-bar__hint {
  font-size: 12px;
  color: var(--text-tertiary, #6B7280);
}
.sbe-sb-worldview-bar__input {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--surface-3, #22252d);
  color: var(--text-primary, #E5E7EB);
  font-size: 13px;
  outline: none;
}
.sbe-sb-worldview-bar__input:focus {
  border-color: var(--accent, #6366F1);
}
.sbe-sb-worldview-bar__preview {
  font-size: 12px;
  color: var(--text-tertiary, #6B7280);
  font-style: italic;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sbe-sb-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  width: 100%;
  scrollbar-width: none;
}
.sbe-sb-tabs::-webkit-scrollbar { display: none; }
.sbe-sb-tab {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-secondary, #9CA3AF);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 200ms;
  font-family: inherit;
}
.sbe-sb-tab:hover { border-color: var(--accent, #818cf8); }
.sbe-sb-tab--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}
.sbe-sb-tab-count {
  font-weight: 400;
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.7;
}
.sbe-sb-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
}
.sbe-sb-card {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
}
.sbe-sb-card:hover {
  border-color: var(--accent, #818cf8);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.sbe-sb-card--editing {
  border-color: var(--accent, #818cf8);
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2);
}
.sbe-sb-card__visual {
  width: 100%;
  aspect-ratio: 16/10;
  background: var(--bg-tertiary, #1a2332);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-sb-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sbe-sb-card__loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-sb-card__no-img {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  opacity: 0.4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  justify-content: center;
}
.sbe-sb-card__no-img--has-scene {
  opacity: 1;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}
.sbe-sb-card__idx {
  font-size: 22px;
  font-weight: 800;
  color: rgba(255,255,255,0.7);
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.sbe-sb-card__expired {
  font-size: 11px;
  color: #fbbf24;
  text-align: center;
  padding: 4px;
}
.sbe-sb-card__scene-name {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255,255,255,0.6);
  max-width: 90%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-sb-card__error {
  font-size: 12px;
  color: #f87171;
  text-align: center;
}
.sbe-sb-card__info {
  padding: 8px 10px;
}
.sbe-sb-card__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-sb-card__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.sbe-sb-card__tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--accent, #818cf8);
}
.sbe-sb-card__duration {
  font-size: 10px;
  color: var(--text-muted, #64748B);
}
.sbe-sb-card__chars {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.sbe-sb-card__char-ref {
  font-size: 10px;
  color: var(--text-secondary, #9CA3AF);
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 6px;
}
.sbe-sb-empty-ep {
  text-align: center;
  color: var(--text-muted, #64748B);
  font-size: 14px;
  padding: 32px;
}

/* ── Shot Edit Overlay Panel ── */
.sbe-sb-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  animation: fadeIn 0.15s ease;
  overflow-y: auto;
}
.sbe-sb-edit-panel {
  width: 580px;
  max-height: calc(100vh - 100px);
  background: var(--bg-primary, #0E0F12);
  border: 1px solid var(--border, #2E3139);
  border-radius: 14px;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.sbe-sb-edit-panel--workspace {
  width: 920px;
  max-width: 96vw;
}
.sbe-sb-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border, #2E3139);
  position: sticky;
  top: 0;
  background: var(--bg-primary, #0E0F12);
  z-index: 1;
}
.sbe-sb-edit-header h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #E8EAED);
  margin: 0;
}
.sbe-sb-edit-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sbe-sb-edit-header__score {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 12px;
}
.sbe-sb-edit-header__score.good { background: rgba(52, 211, 153, 0.2); color: #34d399; }
.sbe-sb-edit-header__score.warn { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
.sbe-sb-edit-header__score.bad { background: rgba(248, 113, 113, 0.2); color: #f87171; }
.sbe-sb-edit-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  font-size: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-sb-edit-close:hover { background: rgba(255, 255, 255, 0.2); }
/* ── Workspace 双栏布局 ── */
.sbe-sb-edit-workspace {
  display: flex;
  gap: 0;
  min-height: 500px;
}
.sbe-sb-edit-visual {
  width: 340px;
  min-width: 340px;
  border-right: 1px solid var(--border, #2E3139);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  background: var(--bg-tertiary, #121318);
}
.sbe-sb-edit-form {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
}
/* 预览图 Hero */
.sbe-sb-edit-preview-hero {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: #1a1c22;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-sb-edit-preview-hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sbe-sb-edit-no-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary, #555);
  font-size: 13px;
}
.sbe-sb-edit-no-preview__icon { font-size: 28px; opacity: 0.4; }
.sbe-sb-edit-preview-hero__err {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  font-size: 11px;
  color: #f87171;
  background: rgba(0,0,0,0.7);
  padding: 4px 8px;
  border-radius: 6px;
}
.sbe-sb-edit-preview-hero__actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
}
.sbe-sb-edit-preview-hero__btn {
  background: rgba(99, 102, 241, 0.85);
  color: #fff;
  border: none;
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
.sbe-sb-edit-preview-hero__btn:hover { background: rgba(99, 102, 241, 1); }
.sbe-sb-edit-preview-hero__btn:disabled { opacity: 0.5; cursor: not-allowed; }
/* 完整度条 */
.sbe-sb-edit-comp-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sbe-sb-edit-comp-bar__item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-tertiary, #666);
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
}
.sbe-sb-edit-comp-bar__item--ok {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}
.sbe-sb-edit-comp-bar__dot { font-size: 8px; }
.sbe-sb-edit-comp-bar__label { font-size: 11px; }
/* 参考区块 */
.sbe-sb-edit-ref-section { display: flex; flex-direction: column; gap: 6px; }
.sbe-sb-edit-ref-section__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary, #9CA3AF);
  display: flex;
  align-items: center;
  gap: 6px;
}
.sbe-sb-edit-ref-section__empty {
  font-size: 12px;
  color: var(--text-tertiary, #555);
  padding: 8px;
  text-align: center;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}
.sbe-ref-ok { color: #34d399; font-size: 11px; font-weight: 600; }
.sbe-ref-warn { color: #fbbf24; font-size: 11px; font-weight: 600; }
.sbe-ref-count { color: var(--text-tertiary, #666); font-size: 11px; font-weight: 400; }
/* 场景预览 */
.sbe-sb-edit-scene-preview {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1c22;
}
.sbe-sb-edit-scene-preview__img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.sbe-sb-edit-scene-preview__name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  padding: 16px 10px 6px;
  font-size: 11px;
  color: #fff;
  font-weight: 600;
}
/* 角色卡片 */
.sbe-sb-edit-char-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sbe-sb-edit-char-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
}
.sbe-sb-edit-char-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #1a1c22;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.sbe-sb-edit-char-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sbe-sb-edit-char-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sbe-sb-edit-char-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-sb-edit-char-card__outfit {
  font-size: 11px;
  color: var(--text-tertiary, #888);
}
.sbe-sb-edit-char-card__outfit-sel {
  font-size: 11px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-primary, #E8EAED);
  border-radius: 4px;
  padding: 1px 4px;
  margin-top: 2px;
}
.sbe-sb-edit-char-card__status {
  font-size: 14px;
  font-weight: 700;
}
.sbe-sb-edit-char-card__status.ok { color: #34d399; }
.sbe-sb-edit-char-card__status.warn { color: #fbbf24; }
/* 参考图网格条 */
.sbe-sb-edit-refgrid-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.sbe-sb-edit-refgrid-cell {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}
.sbe-sb-edit-refgrid-cell:hover { border-color: rgba(99, 102, 241, 0.6); }
.sbe-sb-edit-refgrid-cell img { width: 100%; height: 100%; object-fit: cover; }
.sbe-sb-edit-refgrid-cell__idx {
  position: absolute;
  top: 1px;
  left: 1px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-sb-edit-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sbe-sb-edit-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 4px;
}
.sbe-sb-edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.sbe-sb-edit-prompt {
  font-family: 'Courier New', monospace;
  font-size: 11px;
}
.sbe-sb-edit-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sbe-sb-edit-char-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-primary, #E8EAED);
}
.sbe-sb-edit-char-ref-ok {
  font-size: 10px;
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.15);
  padding: 1px 6px;
  border-radius: 6px;
}
.sbe-sb-edit-no-char {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}
.sbe-sb-edit-scene-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary, #E8EAED);
}
.sbe-sb-edit-scene-ref-ok {
  font-size: 10px;
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.15);
  padding: 1px 6px;
  border-radius: 6px;
}
.sbe-sb-edit-preview {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border, #2E3139);
}
.sbe-sb-edit-preview-img {
  width: 100%;
  display: block;
}
.sbe-sb-edit-no-preview {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #64748B);
  font-size: 13px;
}
.sbe-sb-edit-loading {
  aspect-ratio: 16/9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-muted, #94a3b8);
  font-size: 13px;
}
.sbe-sb-edit-error {
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  line-height: 1.4;
}
.sbe-sb-edit-prompt-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.15);
  font-size: 13px;
  color: var(--text-primary, #E8EAED);
  transition: background 0.15s;
}
.sbe-sb-edit-prompt-toggle:hover { background: rgba(129, 140, 248, 0.12); }
.sbe-sb-edit-prompt-hint { font-size: 11px; color: var(--text-muted, #64748B); }
.sbe-sb-edit-prompt-preview {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sbe-sb-edit-prompt-label {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  margin-top: 4px;
}
.sbe-sb-edit-prompt-text {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px !important;
  line-height: 1.5 !important;
}
.sbe-sb-edit-prompt-neg {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 10px !important;
  line-height: 1.4 !important;
  color: #f87171 !important;
  background: rgba(239, 68, 68, 0.05) !important;
}
.sbe-sb-edit-prompt-reset {
  align-self: flex-start;
  margin-top: 4px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid rgba(129, 140, 248, 0.3);
  background: transparent;
  color: #818cf8;
  font-size: 11px;
  cursor: pointer;
}
.sbe-sb-edit-prompt-reset:hover { background: rgba(129, 140, 248, 0.1); }
.sbe-sb-edit-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--border, #2E3139);
}
.sbe-sb-edit-delete {
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}
.sbe-sb-edit-delete:hover { background: rgba(239, 68, 68, 0.2); }

/* ── 简化版编辑面板 ── */
.sbe-sb-edit-panel--simple {
  width: 520px;
  max-width: 96vw;
}
.sbe-sb-edit-simple {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sbe-sb-edit-simple__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sbe-sb-edit-simple__time {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
  padding: 2px 10px;
  border-radius: 8px;
}
.sbe-sb-edit-simple__dur {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}
.sbe-sb-edit-simple__scene {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-sb-edit-field--main {
  flex: 1;
}
.sbe-sb-edit-prompt-main {
  width: 100%;
  min-height: 100px;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}
.sbe-sb-edit-simple__chars {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sbe-sb-edit-simple__char {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--text-secondary, #9CA3AF);
}
.sbe-sb-edit-simple__actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border, #2E3139);
}
.sbe-sb-edit-refstrip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.sbe-sb-edit-refstrip__item {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border, #2E3139);
}
.sbe-sb-edit-refstrip__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* ── 简化版卡片 ── */
.sbe-sb-card--v2 .sbe-sb-card__info {
  padding: 8px 10px 6px;
}
.sbe-sb-card__time-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  z-index: 1;
}
.sbe-sb-card__err-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 14px;
  z-index: 1;
}
.sbe-sb-card__prompt-text {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
  line-height: 1.5;
  padding: 0 10px 6px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* ── 电影语言标签条 ── */
.sbe-sb-card__cine-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 10px 6px;
}
.sbe-sb-card__cine-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  font-weight: 500;
  line-height: 1.6;
}
.sbe-sb-card__cine-tag--shot {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
}
.sbe-sb-card__cine-tag--cam {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}
.sbe-sb-card__cine-tag--pacing {
  background: rgba(251, 191, 36, 0.15);
  color: #fcd34d;
}
.sbe-sb-card__cine-tag--speed {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
.sbe-sb-card__cine-tag--trans {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
}
/* ── 编辑面板电影语言控件 ── */
.sbe-sb-edit-cine {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.sbe-sb-edit-cine__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sbe-sb-edit-cine__row label {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
  min-width: 56px;
  white-space: nowrap;
}
.sbe-sb-edit-cine__select {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  cursor: pointer;
}
.sbe-sb-edit-cine__select:focus {
  border-color: var(--accent, #818cf8);
  outline: none;
}
.sbe-sb-edit-cine__num {
  width: 60px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  text-align: center;
}
.sbe-sb-edit-cine__num:focus {
  border-color: var(--accent, #818cf8);
  outline: none;
}
.sbe-sb-edit-cine__unit {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-sb-edit-cine__cam-actions {
  margin-bottom: 8px;
}
.sbe-sb-edit-cine__cam-actions > label {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
  display: block;
  margin-bottom: 4px;
}
.sbe-sb-edit-cine__cam-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sbe-sb-edit-cine__cam-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 8px;
  background: rgba(99, 102, 241, 0.08);
  border-radius: 4px;
  color: var(--text-primary, #E8EAED);
}
.sbe-sb-edit-cine__cam-step {
  color: var(--accent, #818cf8);
  font-weight: 600;
}
.sbe-sb-edit-cine__cam-speed {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(251, 191, 36, 0.15);
  color: #fcd34d;
}
.sbe-sb-edit-cine__cam-desc {
  color: var(--text-secondary, #9CA3AF);
  font-style: italic;
}
.sbe-sb-edit-cine__input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
}
.sbe-sb-edit-cine__input:focus {
  border-color: var(--accent, #818cf8);
  outline: none;
}
.sbe-sb-card__ref-strip {
  display: flex;
  gap: 3px;
  padding: 0 10px 6px;
  overflow-x: auto;
}
.sbe-sb-card__ref-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
}
.sbe-sb-card__ref-thumb--clickable {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.sbe-sb-card__ref-thumb--clickable:hover {
  transform: scale(1.2);
  border-color: var(--accent, #818cf8);
}
.sbe-sb-edit-preview-hero__img--clickable {
  cursor: zoom-in;
  transition: opacity 0.15s;
}
.sbe-sb-edit-preview-hero__img--clickable:hover {
  opacity: 0.85;
}
.sbe-sb-edit-refstrip__item--clickable {
  cursor: pointer;
  transition: transform 0.15s;
}
.sbe-sb-edit-refstrip__item--clickable:hover {
  transform: scale(1.15);
}
.sbe-sb-card__img {
  cursor: zoom-in;
}

/* ================================================================ */
/*  Step 7: Progressive Preview                                      */
/* ================================================================ */
.sbe-preview-v2 {
  max-width: 900px !important;
}
.sbe-pv-modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  margin-bottom: 20px;
}
.sbe-pv-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  background: var(--bg-secondary, #1A1C21);
  cursor: pointer;
  transition: all 200ms;
  font-family: inherit;
  color: var(--text-primary, #E8EAED);
}
.sbe-pv-mode:hover { border-color: var(--accent, #818cf8); }
.sbe-pv-mode--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.08);
}
.sbe-pv-mode-icon { font-size: 28px; }
.sbe-pv-mode-label { font-size: 13px; font-weight: 600; }
.sbe-pv-mode-desc { font-size: 10px; color: var(--text-muted, #64748B); }
.sbe-pv-section { width: 100%; }
.sbe-pv-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.sbe-pv-stats {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-pv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.sbe-pv-shot-card {
  background: var(--bg-secondary, #1A1C21);
  border: 2px solid var(--border, #2E3139);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 200ms;
}
.sbe-pv-shot--approved { border-color: #10b981; }
.sbe-pv-shot--rejected { border-color: #ef4444; }
.sbe-pv-shot-visual {
  width: 100%;
  aspect-ratio: 16/10;
  background: var(--bg-tertiary, #1a2332);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-pv-shot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.sbe-pv-shot-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbe-pv-shot-empty {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  opacity: 0.4;
}
.sbe-pv-shot-error {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  text-align: center;
}
.sbe-pv-shot-error-msg {
  font-size: 10px;
  color: #f87171;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.sbe-pv-shot-info { padding: 8px 10px; }
.sbe-pv-shot-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-pv-shot-actions {
  display: flex;
  gap: 4px;
}
.sbe-pv-btn {
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #9CA3AF);
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms;
}
.sbe-pv-btn:hover { border-color: var(--accent, #818cf8); }
.sbe-pv-btn--ok { color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3); }
.sbe-pv-btn--ok:hover { background: rgba(16, 185, 129, 0.1); }
.sbe-pv-btn--no { color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
.sbe-pv-btn--no:hover { background: rgba(239, 68, 68, 0.1); }
.sbe-pv-btn--regen { font-size: 12px; }
.sbe-pv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sbe-pv-info-box {
  padding: 16px 20px;
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 10px;
  margin-bottom: 16px;
}
.sbe-pv-info-box p {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0 0 4px;
}
.sbe-pv-empty {
  text-align: center;
  color: var(--text-muted, #64748B);
  font-size: 14px;
  padding: 40px;
}

/* ── Step 7 perShot: I2V 视频卡片 ─────────────────────── */
.sbe-vid-params {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 12px 0 16px;
  flex-wrap: wrap;
}
.sbe-vid-param {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #475569);
}
.sbe-vid-param select {
  padding: 4px 8px;
  border: 1px solid var(--border, #CBD5E1);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-surface, #fff);
}
.sbe-vid-batch-btn {
  margin-left: auto;
  flex-shrink: 0;
}

/* 一致性关键帧面板 */
.sbe-vid-consistency {
  margin: 12px 0;
  padding: 12px 16px;
  background: var(--bg-card, rgba(99, 102, 241, 0.04));
  border: 1px solid var(--border, rgba(99, 102, 241, 0.15));
  border-radius: 10px;
}
.sbe-vid-consistency__header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sbe-vid-consistency__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  cursor: pointer;
}
.sbe-vid-consistency__hint {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}
.sbe-vid-consistency__warn {
  margin: 8px 0 0;
  padding: 8px 12px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
}
.sbe-vid-consistency__retry {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.sbe-vid-consistency__status {
  font-size: 11.5px;
  color: var(--text-secondary, #64748b);
  opacity: 0.85;
}

/* [P1] 全局制作规范面板 — 玻璃拟态卡片 */
.sbe-gd-panel {
  margin: 14px 0 4px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}
.sbe-gd-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.sbe-gd-panel__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
}
.sbe-gd-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sbe-gd-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--text-secondary, #94a3b8);
}
.sbe-gd-panel__collapse {
  background: transparent;
  border: none;
  color: var(--accent, #ff7a45);
  cursor: pointer;
  font-size: 12.5px;
}
.sbe-gd-panel__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  margin-top: 12px;
}
.sbe-gd-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}
.sbe-gd-field input {
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(15, 23, 42, 0.55);
  color: var(--text-primary, #e2e8f0);
  font-size: 12.5px;
}
.sbe-gd-field input:focus {
  outline: none;
  border-color: var(--accent, #ff7a45);
}
.sbe-gd-field--full {
  grid-column: 1 / -1;
}
.sbe-gd-panel__preview {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary, #64748b);
  word-break: break-all;
  background: rgba(15, 23, 42, 0.4);
  padding: 8px 10px;
  border-radius: 8px;
}
.sbe-gd-panel__err {
  margin: 8px 0 0;
  color: #f87171;
  font-size: 12.5px;
}
.sbe-gd-panel__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  opacity: 0.85;
}
.sbe-vid-consistency__options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.sbe-vid-consistency__desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}
.sbe-vid-param--checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

/* BYOK + 操作栏 */
.sbe-vid-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  flex-wrap: wrap;
}
.sbe-vid-byok {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
}
.sbe-vid-cancel-btn {
  background: rgba(239, 68, 68, 0.1) !important;
  color: #ef4444 !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
}

/* 批量进度条 */
.sbe-vid-progress {
  margin: 8px 0 16px;
}
.sbe-vid-progress__bar {
  height: 6px;
  background: var(--bg-surface, #e2e8f0);
  border-radius: 3px;
  overflow: hidden;
}
.sbe-vid-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.sbe-vid-progress__text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.sbe-vid-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.sbe-vid-card {
  border: 1px solid var(--border, #E2E8F0);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-surface, #fff);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.sbe-vid-card--done      { border-color: #10B981; }
.sbe-vid-card--generating{ border-color: #3B82F6; }
.sbe-vid-card--error     { border-color: #EF4444; }
.sbe-vid-card--locked    { opacity: 0.55; }
.sbe-vid-card__thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #1E293B;
  overflow: hidden;
}
.sbe-vid-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sbe-vid-card__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #94A3B8;
  font-size: 13px;
}
.sbe-vid-card__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 13px;
}
.sbe-vid-card__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sbe-spin 0.8s linear infinite;
}
@keyframes sbe-spin { to { transform: rotate(360deg); } }
.sbe-vid-card__body {
  padding: 10px 12px 12px;
}
.sbe-vid-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1E293B);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-vid-card__video {
  width: 100%;
  border-radius: 6px;
  background: #000;
  margin-bottom: 8px;
}
.sbe-vid-card__error {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: #B91C1C;
  margin-bottom: 8px;
  word-break: break-all;
}
.sbe-vid-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.sbe-vid-card__hint {
  font-size: 12px;
  color: #94A3B8;
}

/* ================================================================ */
/*  Step 8: Export Config                                            */
/* ================================================================ */
.sbe-export-v2 {
  max-width: 640px !important;
}
.sbe-export-field {
  width: 100%;
  margin-bottom: 16px;
}
.sbe-export-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 8px;
}
.sbe-export-format-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.sbe-export-format-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  background: var(--bg-secondary, #1A1C21);
  cursor: pointer;
  transition: all 200ms;
  font-family: inherit;
  color: var(--text-primary, #E8EAED);
}
.sbe-export-format-card:hover { border-color: var(--accent, #818cf8); }
.sbe-export-format-card--active {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.08);
}
.sbe-export-format-icon { font-size: 24px; }
.sbe-export-format-label { font-size: 12px; font-weight: 600; }
.sbe-export-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  width: 100%;
}
.sbe-export-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.sbe-export-select:focus { border-color: var(--accent, #818cf8); }
.sbe-export-select--sm {
  width: auto;
  padding: 4px 8px;
  font-size: 11px;
  margin-left: 8px;
}
.sbe-export-options-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.sbe-export-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary, #E8EAED);
  cursor: pointer;
}
.sbe-export-check input[type="checkbox"],
.sbe-export-check input[type="radio"] {
  accent-color: var(--accent, #818cf8);
}
.sbe-export-check--sub {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-export-range {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-export-range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary, #E8EAED);
  margin-top: 4px;
  padding-left: 24px;
}
.sbe-export-range-input {
  width: 60px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  text-align: center;
}
.sbe-export-range-input:focus { border-color: var(--accent, #818cf8); }
.sbe-export-estimate {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.15);
  border-radius: 10px;
  margin-bottom: 20px;
}
.sbe-export-estimate-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sbe-export-estimate-label { font-size: 11px; color: var(--text-muted, #64748B); }
.sbe-export-estimate-value { font-size: 16px; font-weight: 700; color: var(--accent, #818cf8); }
.sbe-export-actions {
  display: flex;
  gap: 12px;
}
.sbe-action-btn--lg {
  padding: 12px 32px !important;
  font-size: 15px !important;
}

/* ── Style grid compact variant (for Step 1) ── */
.sbe-style-grid--compact {
  max-width: 100%;
}

/* ── Custom duration chip ── */
.sbe-setup-chip--custom {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sbe-setup-chip-input {
  width: 52px;
  padding: 2px 6px;
  border: 1px solid var(--accent, #818cf8);
  border-radius: 4px;
  background: rgba(129, 140, 248, 0.15);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  font-family: inherit;
  text-align: center;
  outline: none;
}
.sbe-setup-chip-input:focus {
  border-color: var(--accent, #818cf8);
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.25);
}
.sbe-setup-chip-input--error {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.1) !important;
}
.sbe-setup-chip-error {
  font-size: 11px;
  color: #f87171;
  align-self: center;
  white-space: nowrap;
}
.sbe-setup-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted, #64748B);
  line-height: 1.5;
}

/* ── Style cards with preview images ── */
.sbe-style-card__img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 8px 8px 0 0;
  display: block;
}
.sbe-style-card--has-img {
  padding: 0;
  overflow: hidden;
}
.sbe-style-card--has-img .sbe-style-icon {
  display: none;
}
.sbe-style-card--has-img .sbe-style-name,
.sbe-style-card--has-img .sbe-style-desc {
  padding: 0 8px;
}
.sbe-style-card--has-img .sbe-style-name {
  padding-top: 6px;
}
.sbe-style-card--has-img .sbe-style-desc {
  padding-bottom: 8px;
}

/* ── Style group labels ── */
.sbe-style-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 16px;
  margin-bottom: 8px;
  padding-left: 2px;
}
.sbe-style-group-label:first-child { margin-top: 0; }

/* ── Label hint (selected style name) ── */
.sbe-setup-label-hint {
  font-weight: 400;
  color: var(--accent, #818cf8);
  font-size: 12px;
}

/* ── Upload card (+) ── */
.sbe-style-card--upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border, #2E3139);
  background: transparent;
  cursor: pointer;
  min-height: 120px;
  transition: all 0.2s;
}
.sbe-style-card--upload:hover {
  border-color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.05);
}
.sbe-style-upload-icon {
  font-size: 32px;
  line-height: 1;
  color: var(--text-muted, #64748B);
  margin-bottom: 4px;
}
.sbe-style-card--upload:hover .sbe-style-upload-icon {
  color: var(--accent, #818cf8);
}

/* ── Custom style card ── */
.sbe-style-card--custom {
  position: relative;
}
.sbe-style-card__del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
  padding: 0;
}
.sbe-style-card--custom:hover .sbe-style-card__del {
  opacity: 1;
}
.sbe-style-card--custom:hover .sbe-style-card__del:hover {
  background: #ef4444;
}

/* ── Custom upload panel ── */
.sbe-custom-upload-panel {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  background: var(--bg-secondary, #181B21);
}
.sbe-custom-upload-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.sbe-custom-upload-row:last-child { margin-bottom: 0; }

/* ── 造型管理 ── */
.sbe-outfit-section {
  margin-top: 12px;
  padding: 10px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
}
.sbe-outfit-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 4px;
}
.sbe-outfit-tab {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid var(--border, #2E3139);
  background: transparent;
  color: var(--text-secondary, #94A3B8);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sbe-outfit-tab:hover {
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
}
.sbe-outfit-tab--active {
  background: rgba(129, 140, 248, 0.15);
  border-color: var(--accent, #818cf8);
  color: var(--accent, #818cf8);
  font-weight: 600;
}
.sbe-outfit-tab--add {
  border-style: dashed;
  opacity: 0.7;
}
.sbe-outfit-tab--add:hover { opacity: 1; }
.sbe-outfit-tab__del {
  font-size: 14px;
  line-height: 1;
  margin-left: 2px;
  opacity: 0.5;
  cursor: pointer;
}
.sbe-outfit-tab__del:hover {
  opacity: 1;
  color: #ef4444;
}

/* ── 分镜造型选择 ── */
.sbe-sb-outfit-select {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-secondary, #181B21);
  color: var(--text-primary, #E2E8F0);
  font-size: 11px;
  cursor: pointer;
  max-width: 120px;
}
.sbe-sb-outfit-select:hover {
  border-color: var(--accent, #818cf8);
}
.sbe-sb-outfit-name {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  font-style: italic;
}

/* ── 参考素材区 ── */
.sbe-sb-edit-refs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-sb-edit-refs-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.sbe-sb-edit-refs-count {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  background: rgba(99, 102, 241, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
}
.sbe-sb-edit-refs-auto {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.sbe-sb-edit-refs-label {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}
.sbe-sb-edit-ref-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
  font-size: 11px;
  color: var(--text-primary, #E8EAED);
}
.sbe-ref-chip-ok {
  font-size: 10px;
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.15);
  padding: 0 4px;
  border-radius: 4px;
}
.sbe-sb-edit-refs-add {
  display: flex;
  gap: 6px;
}
.sbe-sb-edit-refs-add .sbe-char-edit-input {
  flex: 1;
}
.sbe-sb-edit-refs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sbe-sb-edit-ref-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  max-width: 220px;
}
.sbe-sb-edit-ref-thumb {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.sbe-sb-edit-ref-label {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.sbe-sb-edit-ref-del {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.6;
}
.sbe-sb-edit-ref-del:hover {
  opacity: 1;
}

/* ── 视频参数 checkbox ── */
.sbe-sb-edit-checkbox {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400 !important;
  color: var(--text-primary, #E8EAED) !important;
  cursor: pointer;
}
.sbe-sb-edit-checkbox input[type="checkbox"] {
  accent-color: var(--accent, #818cf8);
  width: 14px;
  height: 14px;
}

/* ── 链式尾帧 badge ── */
.sbe-chain-badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border-radius: 8px;
  margin-left: 8px;
}
.sbe-vid-param--check {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}
.sbe-vid-param--check input[type="checkbox"] {
  accent-color: #10B981;
  width: 14px;
  height: 14px;
}

/* ── 链式视频列表 ── */
.sbe-vid-chain {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sbe-vid-chain-item {
  position: relative;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  padding: 14px;
  background: var(--bg-secondary, #181B21);
  transition: border-color 0.2s;
}
.sbe-vid-chain-item--done       { border-color: #10B981; }
.sbe-vid-chain-item--generating{ border-color: #3B82F6; }
.sbe-vid-chain-item--error     { border-color: #EF4444; }
.sbe-vid-chain-item--locked    { opacity: 0.5; }

/* 首尾帧衔接行 */
.sbe-vid-chain__frames {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.sbe-vid-chain__frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.sbe-vid-chain__frame-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sbe-vid-chain__thumb {
  width: 72px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
}
.sbe-vid-chain__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sbe-vid-chain__thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-muted, #64748B);
}
.sbe-vid-chain__thumb-auto {
  background: rgba(129, 140, 248, 0.08);
  color: var(--accent, #818cf8);
}
.sbe-vid-chain__frame-source {
  font-size: 10px;
  color: var(--text-muted, #64748B);
  max-width: 90px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 箭头 + 运镜信息 */
.sbe-vid-chain__arrow {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
}
.sbe-vid-chain__arrow-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, var(--border, #2E3139), var(--accent, #818cf8), var(--border, #2E3139));
  border-radius: 1px;
  min-width: 16px;
}
.sbe-vid-chain__arrow-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  flex-shrink: 0;
}
.sbe-vid-chain__camera {
  font-size: 11px;
  color: var(--text-primary, #E8EAED);
  font-weight: 500;
  white-space: nowrap;
}
.sbe-vid-chain__duration {
  font-size: 10px;
  color: var(--accent, #818cf8);
  background: rgba(129, 140, 248, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

/* 生成中叠层 */
.sbe-vid-chain__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: #fff;
  z-index: 2;
}
.sbe-vid-chain__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sbe-spin 0.8s linear infinite;
}

/* 视频 + 操作 */
.sbe-vid-chain__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-vid-chain__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  display: flex;
  align-items: center;
  gap: 8px;
}
.sbe-vid-chain__badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 500;
}
.sbe-vid-chain__badge--ok {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}
.sbe-vid-chain__badge--rej {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
.sbe-vid-chain__video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  max-height: 240px;
}
.sbe-vid-chain__error {
  font-size: 12px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
}
.sbe-vid-chain__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.sbe-vid-chain__hint {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

/* 镜头间连接器 */
.sbe-vid-chain__connector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  margin: 4px 0;
}
.sbe-vid-chain__connector-line {
  flex: 1;
  height: 1px;
  background: var(--border, #2E3139);
}
.sbe-vid-chain__connector-label {
  font-size: 10px;
  color: #10B981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
/* 参考图模式标签 */
.sbe-vid-chain__ref-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #A78BFA;
  background: rgba(167, 139, 250, 0.08);
  border-radius: 8px;
  margin-bottom: 4px;
}
.sbe-vid-chain__ref-icon {
  font-size: 14px;
}
/* 生成模式选择器 */
.sbe-vid-param--mode select {
  min-width: 180px;
}

@keyframes sbe-spin {
  to { transform: rotate(360deg); }
}

/* ── 世界观选择 ── */
.sbe-worldview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-top: 6px;
}
.sbe-worldview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background: var(--bg-secondary, #181B21);
}
.sbe-worldview-card:hover {
  border-color: var(--accent, #818cf8);
  background: rgba(99, 102, 241, 0.06);
}
.sbe-worldview-card--selected {
  border-color: var(--accent, #818cf8) !important;
  background: rgba(99, 102, 241, 0.12) !important;
  box-shadow: 0 0 0 1px var(--accent, #818cf8);
}
.sbe-worldview-card__icon {
  font-size: 24px;
  line-height: 1;
}
.sbe-worldview-card__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}
.sbe-worldview-card__desc {
  font-size: 10px;
  color: var(--text-muted, #64748B);
  line-height: 1.3;
}
.sbe-worldview-supplement {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sbe-worldview-tags {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sbe-worldview-tags__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #A0A8B8);
}
.sbe-worldview-tags__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sbe-worldview-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 16px;
  background: var(--bg-secondary, #181B21);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.sbe-worldview-tag:hover {
  border-color: var(--accent, #818cf8);
}
.sbe-worldview-tag--active {
  border-color: var(--accent, #818cf8) !important;
  background: rgba(99, 102, 241, 0.16) !important;
  color: var(--text-primary, #E8EAED);
  font-weight: 600;
}
.sbe-worldview-tag__check {
  color: var(--accent, #818cf8);
}
.sbe-setup-textarea {
  width: 100%;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  color: var(--text-primary, #E8EAED);
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}
.sbe-setup-textarea:focus {
  outline: none;
  border-color: var(--accent, #818cf8);
}
.sbe-setup-hint {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  margin: 4px 0 0;
}

/* 画风推荐标记 */
.sbe-style-card {
  position: relative;
}
.sbe-style-card--recommended {
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.5);
}
.sbe-style-card__recommend {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  background: #10B981;
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
  z-index: 1;
  line-height: 1.4;
}

/* ── 场景横条布局 ── */
.sbe-scene-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--bg-secondary, #181B21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
}
.sbe-scene-toolbar__batch {
  flex-shrink: 0;
}
.sbe-scene-toolbar__count {
  font-size: 13px;
  color: var(--text-muted, #64748B);
}
.sbe-scene-toolbar__count strong {
  color: #10B981;
}

.sbe-scene-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.sbe-scene-row {
  display: flex;
  gap: 14px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  background: var(--bg-secondary, #181B21);
  padding: 12px;
  transition: border-color 0.2s;
}
.sbe-scene-row:hover {
  border-color: var(--accent, #818cf8);
}

/* 左侧缩略图 */
.sbe-scene-row__visual {
  width: 200px;
  min-height: 200px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #2E3139);
  display: flex;
  flex-direction: column; /* 标签栏在上，图片在下 */
  align-items: stretch;
  position: relative;
}
.sbe-scene-row__img {
  width: 100%;
  min-height: 160px;
  flex: 1; /* 在 flex column 中自动填充剩余空间 */
  object-fit: cover;
  display: block;
  cursor: pointer;
}
.sbe-scene-row__grid-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.sbe-scene-row__grid-label {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 2px 4px;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  background: linear-gradient(135deg, rgba(0,0,0,0.4) 0%, transparent 60%);
}
.sbe-scene-row__grid-label--tl { }
.sbe-scene-row__grid-label--tr { justify-content: flex-start; }
.sbe-scene-row__grid-label--bl { align-items: flex-end; }
.sbe-scene-row__grid-label--br { align-items: flex-end; }

/* 视角标签栏 */
.sbe-scene-row__tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 6px 6px 0 0;
}
.sbe-scene-row__tab {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted, #64748B);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms;
}
.sbe-scene-row__tab:hover { color: var(--text-primary, #E0E0E0); background: rgba(255,255,255,0.05); }
.sbe-scene-row__tab--active {
  color: #fff;
  background: var(--accent, #6366f1);
}

/* 当前视角预览 */
.sbe-scene-row__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  /* 深色背景：图片加载前/失败时显示，不会是空白 */
  background-color: var(--bg-tertiary, #1a2332);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 0 0 6px 6px;
  /* 确保点击区域覆盖整个预览框 */
  cursor: pointer;
}
.sbe-scene-row__preview--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  text-align: center;
  color: var(--text-muted, #64748B);
  font-size: 13px;
}
.sbe-scene-row__gen-error-msg {
  color: #f87171;
  font-size: 12px;
  line-height: 1.4;
  max-width: 100%;
  word-break: break-word;
}
.sbe-scene-row__gen-error-msg code {
  display: block;
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 4px;
  font-size: 11px;
  color: #fca5a5;
  max-height: 80px;
  overflow-y: auto;
  text-align: left;
}
.sbe-scene-row__retry-btn {
  margin-top: 4px;
  padding: 4px 12px;
  background: var(--accent, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.sbe-scene-row__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
}
/* 调试覆盖层：显示当前图片 URL，方便排查不显示问题 */
.sbe-scene-row__debug-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 6px;
  font-size: 10px;
  line-height: 1.3;
  color: #fff;
  background: rgba(0, 0, 0, 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  max-height: 36px;
  overflow-y: auto;
  white-space: normal;
  word-break: break-all;
}
.sbe-scene-row__regen-view {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms;
  backdrop-filter: blur(4px);
}
.sbe-scene-row__regen-view:hover { background: rgba(99,102,241,0.8); }

/* ===== 场景图渲染 v2 样式（最简方案）===== */
/* 错误状态容器 */
.sbe-scene-row__visual--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  aspect-ratio: 1;
  padding: 16px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 6px;
  text-align: center;
}
/* 图片上的悬浮重新生成按钮 */
.sbe-scene-row__regen-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 150ms, background 150ms;
  z-index: 10;
}
.sbe-scene-row__visual:hover .sbe-scene-row__regen-btn { opacity: 1; }
.sbe-scene-row__regen-btn:hover { background: rgba(99,102,241,0.85); }
/* 占位符增强 */
.sbe-scene-row__placeholder {
  cursor: pointer !important;
}
.sbe-scene-row__placeholder-icon {
  font-size: 36px;
  display: block;
  opacity: 0.4;
  transition: transform 200ms, opacity 200ms;
}
.sbe-scene-row__placeholder:hover .sbe-scene-row__placeholder-icon {
  transform: scale(1.15);
  opacity: 0.7;
}
.sbe-scene-row__placeholder-hint {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  opacity: 0.5;
  margin-top: 4px;
  display: block;
}

/* 视角提示词编辑面板 */
.sbe-scene-row__prompts {
  margin-top: 8px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  overflow: hidden;
}
.sbe-scene-row__prompts-toggle {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-secondary, #94A3B8);
  cursor: pointer;
  background: rgba(255,255,255,0.02);
  list-style: none;
}
.sbe-scene-row__prompts-toggle::-webkit-details-marker { display: none; }
.sbe-scene-row__prompts-toggle:hover { color: var(--text-primary, #E0E0E0); }
.sbe-scene-row__prompts-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sbe-scene-row__prompt-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sbe-scene-row__prompt-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent, #818cf8);
  text-transform: uppercase;
}
.sbe-scene-row__prompt-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 11px;
  font-family: monospace;
  color: var(--text-primary, #E0E0E0);
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #2E3139);
  border-radius: 4px;
  resize: vertical;
  line-height: 1.4;
}
.sbe-scene-row__prompt-input:focus {
  border-color: var(--accent, #6366f1);
  outline: none;
}

.sbe-scene-row__gen-hint {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  margin-left: 8px;
}

.sbe-scene-row__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.sbe-scene-row__placeholder {
  font-size: 36px;
  opacity: 0.5;
}

/* 右侧设置区 */
.sbe-scene-row__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.sbe-scene-row__field-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.sbe-scene-row__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sbe-scene-row__field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-scene-row__field--name {
  flex: 2;
  min-width: 140px;
}
.sbe-scene-row__field--mood {
  flex: 1;
  min-width: 100px;
}
.sbe-scene-row__field--desc {
  flex: 1;
  width: 100%;
}
.sbe-scene-row__field--check {
  display: flex;
  align-items: center;
  flex-direction: row;
}
.sbe-scene-row__field--chars {
  flex: 2;
  min-width: 200px;
}

/* 纯文本输入框 */
.sbe-scene-text-input {
  padding: 4px 8px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.sbe-scene-text-input:hover {
  border-color: var(--accent, #818cf8);
}
.sbe-scene-text-input:focus {
  outline: none;
  border-color: var(--accent, #818cf8);
}
.sbe-scene-text-input::placeholder {
  color: var(--text-tertiary, #4B5563);
  font-size: 11px;
}

/* 描述行（含重生成按钮） */
.sbe-scene-row__desc-row {
  align-items: flex-end;
  position: relative;
}
.sbe-scene-desc-regen {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: var(--bg-tertiary, #1a2332);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  margin-bottom: 1px;
}
.sbe-scene-desc-regen:hover {
  border-color: var(--accent, #818cf8);
  background: rgba(99, 102, 241, 0.1);
}
.sbe-scene-desc-regen:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 视角选择器 */
.sbe-scene-row__angles-row {
  align-items: center;
  gap: 8px;
}
.sbe-scene-angles-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  flex-shrink: 0;
}
.sbe-scene-angle-btns {
  display: flex;
  gap: 6px;
}
.sbe-scene-angle-btn {
  padding: 3px 12px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 14px;
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #9CA3AF);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.sbe-scene-angle-btn:hover {
  border-color: var(--accent, #818cf8);
  color: var(--text-primary, #E8EAED);
}
.sbe-scene-angle-btn--active {
  border-color: var(--accent, #818cf8) !important;
  background: rgba(99, 102, 241, 0.15);
  color: var(--text-primary, #E8EAED);
}
.sbe-scene-angle-btn--has {
  border-color: var(--success, #34d399);
}
.sbe-scene-angle-btn__check {
  font-size: 10px;
  color: var(--success, #34d399);
}
.sbe-scene-angle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sbe-scene-angle-thumbs {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
.sbe-scene-angle-thumb {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  border: 2px solid var(--border, #2E3139);
  cursor: pointer;
  transition: border-color 0.15s;
}
.sbe-scene-angle-thumb:hover {
  border-color: var(--accent, #818cf8);
}
.sbe-scene-angle-thumb--active {
  border-color: var(--accent, #818cf8) !important;
}

/* 角色选择 chips */
.sbe-scene-check-label {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400 !important;
  color: var(--text-primary, #E8EAED) !important;
  cursor: pointer;
}
.sbe-scene-check-label input[type="checkbox"] {
  accent-color: var(--accent, #818cf8);
}
.sbe-scene-char-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sbe-scene-char-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.sbe-scene-char-chip:hover {
  border-color: var(--accent, #818cf8);
}
.sbe-scene-char-chip--active {
  border-color: var(--accent, #818cf8) !important;
  background: rgba(99, 102, 241, 0.15);
  color: var(--text-primary, #E8EAED);
}

/* 底部操作 */
.sbe-scene-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}
.sbe-scene-gen-btn--sm {
  font-size: 12px;
  padding: 5px 14px;
  width: auto;
}
.sbe-scene-row__del {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  opacity: 0.5;
  transition: opacity 0.2s;
}
.sbe-scene-row__del:hover {
  opacity: 1;
}
.sbe-scene-save-lib {
  font-size: 12px;
  padding: 5px 14px;
  width: auto;
  border: 1px solid var(--accent, #6C8CFF);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent, #6C8CFF) 14%, transparent);
  color: var(--accent, #6C8CFF);
  cursor: pointer;
  transition: all 0.2s ease;
}
.sbe-scene-save-lib:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent, #6C8CFF) 26%, transparent);
}
.sbe-scene-save-lib:disabled {
  opacity: 0.6;
  cursor: default;
}
.sbe-scene-save-lib--done {
  border-color: #3ec97a;
  color: #3ec97a;
  background: color-mix(in srgb, #3ec97a 16%, transparent);
}
.sbe-savelib-error {
  margin-top: 6px;
  font-size: 12px;
  color: #ff6b6b;
}

/* ── 多宫格参考图面板 ── */
.sbe-ref-grid-panel {
  margin: 8px 0 12px;
  padding: 10px 14px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  background: var(--bg-secondary, #181B21);
}
.sbe-ref-grid__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sbe-ref-grid__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-ref-grid__refresh {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.sbe-ref-grid__refresh:hover { opacity: 1; }
.sbe-ref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}
.sbe-ref-grid-cell {
  position: relative;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-tertiary, #1a2332);
  aspect-ratio: 1;
}
.sbe-ref-grid-cell__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sbe-ref-grid-cell__idx {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  background: rgba(0,0,0,0.4);
  padding: 0 4px;
  border-radius: 3px;
}
.sbe-ref-grid-cell__label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 9px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  padding: 4px 4px 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 分镜卡片增强 ── */
.sbe-sb-card__completeness {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  font-size: 10px;
}
.sbe-sb-card__comp-dot {
  font-size: 8px;
  color: var(--text-tertiary, #4B5563);
  line-height: 1;
}
.sbe-sb-card__comp-dot--ok {
  color: var(--success, #34d399);
}
.sbe-sb-card__comp-score {
  font-size: 10px;
  font-weight: 600;
  margin-left: 2px;
}
.sbe-sb-card__completeness--good .sbe-sb-card__comp-score { color: var(--success, #34d399); }
.sbe-sb-card__completeness--warn .sbe-sb-card__comp-score { color: var(--warning, #fbbf24); }
.sbe-sb-card__completeness--bad .sbe-sb-card__comp-score { color: var(--error, #f87171); }

.sbe-sb-card__dialogue {
  font-size: 10px;
  color: var(--text-muted, #64748B);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

.sbe-sb-card__scene-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.3);
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.sbe-sb-card__scene-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── 编辑面板引用检查区 ── */
.sbe-sb-edit-refcheck {
  padding: 8px 16px;
  background: var(--bg-tertiary, #1a2332);
  border-bottom: 1px solid var(--border, #2E3139);
}
.sbe-sb-edit-refcheck__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 6px;
}
.sbe-sb-edit-refcheck__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sbe-sb-edit-refcheck__item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: var(--bg-secondary, #181B21);
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-sb-edit-refcheck__item--ok {
  border-color: rgba(52, 211, 153, 0.3);
  color: var(--text-primary, #E8EAED);
}
.sbe-sb-edit-refcheck__icon {
  font-size: 12px;
}
.sbe-sb-edit-refcheck__thumb {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  object-fit: cover;
  margin-left: 4px;
}

/* ── 合成视频面板 ── */
.sbe-compose-status {
  padding: 12px 16px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 8px;
  margin-bottom: 12px;
}
.sbe-compose-status__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-compose-status__done {
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}
.sbe-compose-status__ready {
  color: #34d399;
  font-weight: 600;
}
.sbe-compose-status__warn {
  color: #fbbf24;
}
.sbe-compose-error {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 13px;
  margin-bottom: 12px;
}
.sbe-compose-preview,
.sbe-final-preview {
  margin: 12px 0;
  border-radius: 10px;
  overflow: hidden;
  background: #000;
  border: 1px solid var(--border, #2E3139);
}
.sbe-compose-video {
  width: 100%;
  max-height: 480px;
  display: block;
  background: #000;
}
.sbe-compose-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

/* ── 画质提升面板 ── */
.sbe-enhance-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted, #64748B);
  font-size: 13px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}
.sbe-enhance-options {
  display: flex;
  gap: 16px;
  margin: 12px 0;
  padding: 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}
.sbe-enhance-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #94A3B8);
}
.sbe-enhance-option input[type="radio"] {
  accent-color: var(--accent, #6366f1);
}
.sbe-enhance-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}
.sbe-enhance-compare__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sbe-enhance-compare__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
}
.sbe-enhance-compare__label--ok {
  color: var(--success, #22c55e);
}
.sbe-enhance-compare__video {
  width: 100%;
  border-radius: 6px;
  background: #000;
  max-height: 200px;
  object-fit: contain;
}

/* ── AI 配音面板 ── */
.sbe-dub-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.sbe-dub-toolbar__count {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  margin-left: auto;
}
.sbe-dub-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-dub-item {
  padding: 10px 14px;
  background: var(--bg-secondary, #181B21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  transition: border-color 0.2s;
}
.sbe-dub-item--done {
  border-color: rgba(52, 211, 153, 0.3);
}
.sbe-dub-item--error {
  border-color: rgba(239, 68, 68, 0.3);
}
.sbe-dub-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.sbe-dub-item__shot {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}
.sbe-dub-item__status {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.sbe-dub-item__status--pending {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}
.sbe-dub-item__status--done {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.sbe-dub-item__status--gen {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.sbe-dub-item__status--err {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.sbe-dub-item__text {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  margin-bottom: 8px;
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-dub-item__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sbe-dub-item__voice-select {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-primary, #0D1117);
  color: var(--text-primary, #E8EAED);
  min-width: 140px;
}
.sbe-dub-item__import {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #2E3139);
  background: var(--bg-tertiary, #1a2332);
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  transition: all 0.2s;
}
.sbe-dub-item__import:hover {
  border-color: var(--accent, #ff7a45);
  color: var(--accent, #ff7a45);
}
.sbe-dub-item__import input[type="file"] {
  display: none;
}
.sbe-dub-item__audio {
  width: 100%;
  height: 32px;
  margin-top: 6px;
  border-radius: 6px;
}
.sbe-dub-item__error {
  font-size: 11px;
  color: #f87171;
  margin-top: 4px;
}
.sbe-dub-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted, #64748B);
  font-size: 13px;
}

/* ── 满意度按钮 (Step 5 分镜卡片) ── */
.sbe-sb-card__satisfaction {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.sbe-satisfaction-btn {
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #334155);
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
  line-height: 1.4;
}
.sbe-satisfaction-btn:hover {
  opacity: 1;
}
.sbe-satisfaction-btn--approve.sbe-satisfaction-btn--active {
  background: rgba(34, 197, 94, 0.15);
  border-color: #22c55e;
  opacity: 1;
}
.sbe-satisfaction-btn--reject.sbe-satisfaction-btn--active {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  opacity: 1;
}
.sbe-satisfaction-btn--lock.sbe-satisfaction-btn--active {
  background: rgba(250, 204, 21, 0.15);
  border-color: #facc15;
  opacity: 1;
}

/* ── 拖拽手柄 & 排序 ── */
.sbe-sb-card__drag-handle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 10;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  user-select: none;
}
.sbe-sb-card__drag-handle:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
}
.sbe-sb-card__drag-handle:active {
  cursor: grabbing;
}
.sbe-sb-card--dragging {
  opacity: 0.4;
  box-shadow: 0 0 0 2px var(--accent, #60a5fa);
}

/* ── 2A: 对白拆分建议面板 ── */
.sbe-dialogue-suggestions {
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sbe-dialogue-suggestions__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fbbf24;
}
.sbe-dialogue-suggestions__dismiss {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: rgba(251, 191, 36, 0.7);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}
.sbe-dialogue-suggestions__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}
.sbe-dialogue-suggestions__text {
  color: var(--text-secondary, #9CA3AF);
  flex: 1;
}
.sbe-dialogue-suggestions__accept {
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #60a5fa;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.sbe-dialogue-suggestions__accept:hover { background: rgba(96, 165, 250, 0.22); }
.sbe-dialogue-suggestions__skip {
  background: transparent;
  border: 1px solid var(--border, #2E3139);
  color: var(--text-tertiary, #6B7280);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

/* ── 分镜版本历史 ── */
.sbe-shot-history {
  margin: 8px 0;
  background: var(--bg-tertiary, #1a2332);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  overflow: hidden;
}
.sbe-shot-history__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #9CA3AF);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.sbe-shot-history__toggle:hover { color: var(--text-primary, #E0E0E0); }
.sbe-shot-history__chevron { margin-left: auto; }
.sbe-shot-history__list {
  border-top: 1px solid var(--border, #2E3139);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sbe-shot-history__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-secondary, #1A1C21);
}
.sbe-shot-history__label {
  font-size: 12px;
  color: var(--text-primary, #E0E0E0);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sbe-shot-history__meta {
  font-size: 11px;
  color: var(--text-tertiary, #6B7280);
  white-space: nowrap;
}
.sbe-shot-history__restore {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #60a5fa;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.sbe-shot-history__restore:hover {
  background: rgba(96, 165, 250, 0.2);
}

/* ── 导出设置面板 (Step 10) ── */
.sbe-export-settings {
  background: var(--bg-tertiary, #1a2332);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.sbe-export-settings__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.sbe-export-settings__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
}
.sbe-export-settings__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-export-settings__item--checkbox {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.sbe-export-settings__select {
  background: var(--bg-secondary, #0f172a);
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
  color: var(--text-primary, #E2E8F0);
  font-size: 13px;
  padding: 4px 8px;
  cursor: pointer;
}
.sbe-export-settings__estimate {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

/* ── 合成导出台阶 ── */
.sbe-final-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-tertiary, #1a2332);
  border-radius: 8px;
  margin-bottom: 12px;
}
.sbe-final-status__item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
.sbe-final-ok {
  color: #34d399;
  font-weight: 600;
}
.sbe-final-warn {
  color: #fbbf24;
}
.sbe-final-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}


/* ── F-01/F-03 整改：步骤校验拦截提示 & 草稿保存告警 ── */
.sbe-nav-btn--blocked {
  opacity: 0.55;
  cursor: not-allowed;
  border-color: #ffb84d;
}
.sbe-gate-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #ffb84d;
  max-width: 320px;
}
.sbe-draft-warn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px auto 0;
  max-width: 920px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 184, 77, 0.12);
  border: 1px solid #ffb84d;
  color: #ffb84d;
  font-size: 13px;
}
.sbe-draft-warn__close {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.sbe-fade-enter-active,
.sbe-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sbe-fade-enter-from,
.sbe-fade-leave-to {
  opacity: 0;
}

/* ============ 📦 素材资产引用面板（武器/道具/饰品/特效·技能） ============ */
.sbe-asset-ref {
  margin-top: 14px;
  border: 1px solid var(--border, #2a2f45);
  border-radius: 12px;
  background: var(--surface-2, #161a2b);
  overflow: hidden;
}
.sbe-asset-ref__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; cursor: pointer; user-select: none;
}
.sbe-asset-ref__title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.sbe-asset-ref__toggle { font-size: 12px; color: var(--text-secondary); }
.sbe-asset-ref__body { padding: 0 14px 14px; border-top: 1px solid var(--border, #2a2f45); }
.sbe-asset-ref__bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 0; }
.sbe-asset-ref__hint { font-size: 12px; color: var(--text-secondary); }
.sbe-asset-ref__empty { font-size: 13px; color: var(--text-secondary); padding: 10px 0 4px; line-height: 1.6; }
.sbe-asset-ref__chips { display: flex; flex-wrap: wrap; gap: 10px; }
.sbe-asset-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px 6px 6px; border-radius: 10px;
  border: 1px solid var(--border, #2a2f45); background: var(--surface, #0e111c);
  cursor: pointer; transition: all 160ms ease; color: var(--text-primary);
}
.sbe-asset-chip:hover { border-color: var(--accent, #8b5cf6); }
.sbe-asset-chip--on { border-color: var(--accent, #8b5cf6); background: rgba(139,92,246,0.14); }
.sbe-asset-chip__img { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; display: block; }
.sbe-asset-chip__ph {
  width: 34px; height: 34px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
  background: #1c2138; color: var(--text-secondary); font-size: 11px; text-align: center;
}
.sbe-asset-chip__name { font-size: 13px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbe-asset-chip__badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,0.08); color: var(--text-secondary); }

/* ── 关联素材资产面板（场景/角色卡内） ── */
.sbe-asset-panel {
  margin-top: 12px; padding: 12px; border-radius: 12px;
  border: 1px solid var(--border, #2a2f45);
  background: rgba(255,255,255,0.02);
}
.sbe-asset-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.sbe-asset-panel__title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.sbe-asset-panel__ops { display: flex; gap: 6px; }
.sbe-asset-mini-btn {
  font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--accent, #8b5cf6); background: var(--accent, #8b5cf6); color: #fff;
  transition: all 160ms ease;
}
.sbe-asset-mini-btn:hover:not(:disabled) { filter: brightness(1.08); }
.sbe-asset-mini-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sbe-asset-mini-btn--ghost { background: transparent; color: var(--text-secondary); border-color: var(--border, #2a2f45); }
.sbe-asset-mini-btn--ghost:hover:not(:disabled) { color: var(--text-primary); border-color: var(--accent, #8b5cf6); }
.sbe-asset-hint { font-size: 12px; color: var(--text-secondary); opacity: 0.85; line-height: 1.5; }
.sbe-asset-list { display: flex; flex-direction: column; gap: 10px; }
.sbe-asset-item {
  display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "badge meta action" "grid grid grid";
  gap: 6px 10px; align-items: center;
  padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.03);
  border: 1px solid var(--border, #2a2f45);
}
.sbe-asset-badge {
  grid-area: badge; font-size: 11px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  background: rgba(139,92,246,0.16); color: #c4b5fd;
}
.sbe-asset-badge--weapon { background: rgba(239,68,68,0.16); color: #fca5a5; }
.sbe-asset-badge--prop { background: rgba(34,197,94,0.16); color: #86efac; }
.sbe-asset-badge--accessory { background: rgba(56,189,248,0.16); color: #7dd3fc; }
.sbe-asset-badge--effect { background: rgba(245,158,11,0.16); color: #fcd34d; }
.sbe-asset-meta { grid-area: meta; min-width: 0; }
.sbe-asset-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.sbe-asset-reason { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbe-asset-gen-btn {
  grid-area: action; font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--accent, #8b5cf6); background: rgba(139,92,246,0.12); color: #c4b5fd;
  transition: all 160ms ease;
}
.sbe-asset-gen-btn:hover:not(:disabled) { background: rgba(139,92,246,0.24); }
.sbe-asset-gen-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.sbe-asset-grid { grid-area: grid; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.sbe-asset-grid__img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 6px; background: #1c2138; }
.sbe-asset-video { grid-area: grid; width: 100%; max-height: 180px; border-radius: 8px; background: #000; }
.sbe-asset-err { grid-area: grid; font-size: 11px; color: #fca5a5; }
</style>
