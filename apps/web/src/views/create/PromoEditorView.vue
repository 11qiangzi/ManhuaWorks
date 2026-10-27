<script setup lang="ts">
/**
 * PromoEditorView.vue - 宣传片生成器
 * CRAFT-based 6步流水线:
 *   1 品牌Brief  2 AI生成脚本  3 分镜生成+参考图
 *   4 逐镜头生成视频  5 配音配乐  6 合成导出
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFileDrop } from '../../composables/useFileDrop'
import { VolumeSlider } from '@manhuaworks/ui'
import { useCraftPrompt } from '@/composables/useCraftPrompt'
import { CAMERA_MOVEMENTS } from '@/api/craft-prompt'
import type { CraftPrompt } from '@/api/craft-prompt'
import { generateText, generateVideo, generateMusic } from '@/api/ai-router'
import { assetService } from '@/api/asset-service-v2'

// ══════════════════════════════════════════
// CRAFT composable
// ══════════════════════════════════════════

const hasStarted = ref(true)

const craft = useCraftPrompt()

// ══════════════════════════════════════════
// 步骤定义与导航
// ══════════════════════════════════════════

const STEPS = [
  { key: 'brief', label: '品牌Brief' },
  { key: 'script', label: 'AI生成脚本' },
  { key: 'shots', label: '分镜生成' },
  { key: 'generate', label: '逐镜头生成' },
  { key: 'audio', label: '配音配乐' },
  { key: 'export', label: '合成导出' },
]

const currentStep = ref(0)
const maxReachedStep = ref(0)
const completedSteps = ref<Set<number>>(new Set())

function stepState(idx: number): 'done' | 'active' | 'pending' {
  if (completedSteps.value.has(idx)) return 'done'
  if (idx === currentStep.value) return 'active'
  return 'pending'
}

function goToStep(idx: number) {
  if (idx < 0 || idx >= STEPS.length) return
  if (idx > maxReachedStep.value + 1) return
  currentStep.value = idx
}

function goNext() {
  completedSteps.value.add(currentStep.value)
  completedSteps.value = new Set(completedSteps.value)
  const next = currentStep.value + 1
  if (next < STEPS.length) {
    if (next > maxReachedStep.value) maxReachedStep.value = next
    currentStep.value = next
    if (next === 2) autoSplitShots()
  }
}

function goPrev() {
  if (currentStep.value > 0) currentStep.value = currentStep.value - 1
}

// ══════════════════════════════════════════
// Step 1: 品牌 Brief
// ══════════════════════════════════════════

const brandName = ref('')
const productDesc = ref('')
const targetAudience = ref('年轻消费者')
const videoDuration = ref('30s')

const audienceOptions = ['年轻消费者', '商务人士', '家庭用户', '科技爱好者', '学生']

// ENH-6: 目标受众细化
const audienceSubCategories: Record<string, string[]> = {
  '年轻消费者': ['Z世代学生', '初入职场', '潮流达人', '小镇青年', '二次元爱好者'],
  '商务人士': ['创业者', '企业高管', '白领精英', '自由职业者', '中小企业主'],
  '家庭用户': ['全职妈妈', '新手父母', '三代同堂', '独居长辈', '萌宠家庭'],
  '科技爱好者': ['数码发烧友', '极客玩家', 'AI探索者', '开发者', '硬件DIY爱好者'],
  '学生': ['中学生', '大学生', '研究生', '留学生', '考研/考公党'],
}
const selectedSubAudiences = ref<string[]>([])
const customAudience = ref('')

function selectAudience(opt: string) {
  targetAudience.value = opt
  selectedSubAudiences.value = []
}

function toggleSubAudience(sub: string) {
  const idx = selectedSubAudiences.value.indexOf(sub)
  if (idx > -1) selectedSubAudiences.value.splice(idx, 1)
  else selectedSubAudiences.value.push(sub)
}

function addCustomAudience() {
  const val = customAudience.value.trim()
  if (val && !selectedSubAudiences.value.includes(val)) {
    selectedSubAudiences.value.push(val)
    customAudience.value = ''
  }
}

function removeCustomAudience(val: string) {
  const idx = selectedSubAudiences.value.indexOf(val)
  if (idx > -1) selectedSubAudiences.value.splice(idx, 1)
}

const durationOptions = ['15s', '30s', '45s', '60s']

// 品牌素材上传
interface UploadedFile {
  id: number
  name: string
  previewUrl: string
}

const productImages = ref<UploadedFile[]>([])
const brandLogo = ref<UploadedFile | null>(null)
const styleRefImages = ref<UploadedFile[]>([])

let fileUid = 0

function addProductImage(f: File) {
  const localUrl = URL.createObjectURL(f)
  const item: UploadedFile = { id: ++fileUid, name: f.name, previewUrl: localUrl }
  productImages.value.push(item)
  assetService.upload(f, { kind: 'image' }).then(asset => { item.previewUrl = asset.url }).catch(() => {})
}

async function addLogoImage(f: File) {
  const localUrl = URL.createObjectURL(f)
  brandLogo.value = { id: ++fileUid, name: f.name, previewUrl: localUrl }
  try {
    const asset = await assetService.upload(f, { kind: 'image' })
    if (brandLogo.value && brandLogo.value.id === fileUid) brandLogo.value.previewUrl = asset.url
  } catch { /* 保留本地预览 */ }
}

function addStyleImage(f: File) {
  const localUrl = URL.createObjectURL(f)
  const item: UploadedFile = { id: ++fileUid, name: f.name, previewUrl: localUrl }
  styleRefImages.value.push(item)
  assetService.upload(f, { kind: 'image' }).then(asset => { item.previewUrl = asset.url }).catch(() => {})
}

async function handleProductImages(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  for (const f of input.files) addProductImage(f)
  input.value = ''
}

async function handleLogoUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await addLogoImage(input.files[0]!)
  input.value = ''
}

async function handleStyleImages(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  for (const f of input.files) addStyleImage(f)
  input.value = ''
}

// 拖拽上传（与全站上传区一致的「点击 + 拖拽 + 键盘」交互）
const { isDragging: isDraggingProduct, onDragEnter: onDragEnterProduct, onDragLeave: onDragLeaveProduct, onDrop: onDropProduct } =
  useFileDrop((files) => files.forEach(addProductImage))
const { isDragging: isDraggingLogo, onDragEnter: onDragEnterLogo, onDragLeave: onDragLeaveLogo, onDrop: onDropLogo } =
  useFileDrop((files) => { if (files[0]) addLogoImage(files[0]) })
const { isDragging: isDraggingStyle, onDragEnter: onDragEnterStyle, onDragLeave: onDragLeaveStyle, onDrop: onDropStyle } =
  useFileDrop((files) => files.forEach(addStyleImage))

function removeProductImage(id: number) {
  productImages.value = productImages.value.filter(p => p.id !== id)
}

function removeStyleImage(id: number) {
  styleRefImages.value = styleRefImages.value.filter(p => p.id !== id)
}

function clearLogo() {
  brandLogo.value = null
}

const briefValid = computed(() => brandName.value.trim().length > 0 && productDesc.value.trim().length > 0)

// ══════════════════════════════════════════
// Step 2: AI 生成脚本（可编辑）
// ══════════════════════════════════════════

interface Scene {
  id: number
  title: string
  description: string
  startTime: number
  endTime: number
  craftPrompt: CraftPrompt | null
  voiceover: string
  cameraMovementId: string
}

const scriptGenerating = ref(false)
const scriptGenProgress = ref(0)
const scriptGenerated = ref(false)
const scenes = ref<Scene[]>([])

/**
 * AI 脚本生成：调用 generateText 让大模型根据品牌 Brief 生成结构化分镜脚本，
 * 解析返回的 JSON 并填充 scenes。
 */
async function generateScript() {
  if (scriptGenerating.value) return
  scriptGenerating.value = true
  scriptGenProgress.value = 10   // 开始请求
  scenes.value = []

  const dur = parseInt(videoDuration.value) || 30
  const sceneCount = Math.max(2, Math.floor(dur / 10))

  const prompt = [
    `你是一位专业的宣传片编剧。请为以下品牌撰写一段 ${dur} 秒的宣传视频脚本，分为 ${sceneCount} 个场景。`,
    '',
    `品牌名称：${brandName.value || '未命名品牌'}`,
    `产品/服务描述：${productDesc.value || '未提供'}`,
    `目标受众：${targetAudience.value}${selectedSubAudiences.value.length ? '（' + selectedSubAudiences.value.join('、') + '）' : ''}`,
    '',
    '请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：',
    '[',
    '  {',
    '    "title": "场景标题（4-8字）",',
    '    "description": "画面描述，包含镜头运动、光线、主体动作等视觉细节，50-120字",',
    '    "voiceover": "该场景的旁白文案，15-40字",',
    '    "durationRatio": 1.0  // 该场景占总时长的比例，所有场景的 durationRatio 之和必须等于 1',
    '  }',
    ']',
    `共输出 ${sceneCount} 个场景，确保节奏合理：开场引入 → 痛点/需求 → 产品亮点 → 用户价值 → 收尾号召。`,
  ].join('\n')

  try {
    scriptGenProgress.value = 30
    const raw = await generateText({
      prompt,
      systemPrompt: '你是一位资深广告编剧，擅长撰写节奏紧凑、画面感强的宣传片脚本。只输出 JSON 数组，不输出任何其他文字。',
      maxTokens: 4096,
    })

    scriptGenProgress.value = 70

    // 尝试解析 AI 返回的 JSON
    const parsed = parseScriptResponse(raw, dur, sceneCount)

    scriptGenProgress.value = 90
    scenes.value = parsed
    scriptGenProgress.value = 100
    scriptGenerated.value = true
  } catch (err) {
    console.error('[generateScript] AI 脚本生成失败:', err)
    // 降级：使用本地模板兜底，保证流程不中断
    populateFallbackScenes(dur, sceneCount)
    scriptGenProgress.value = 100
    scriptGenerated.value = true
  } finally {
    scriptGenerating.value = false
  }
}

/**
 * 解析 AI 返回的脚本 JSON，容错处理各种格式问题
 */
function parseScriptResponse(raw: string, dur: number, expectedCount: number): Scene[] {
  // 去掉可能的 markdown 代码块包裹
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  let items: Array<{
    title?: string
    description?: string
    voiceover?: string
    durationRatio?: number
  }>

  try {
    items = JSON.parse(text)
    if (!Array.isArray(items)) throw new Error('响应不是数组')
  } catch {
    // JSON 解析失败，尝试提取第一个 [ ... ] 块
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('无法从响应中提取 JSON 数组')
    items = JSON.parse(match[0])
    if (!Array.isArray(items)) throw new Error('提取的内容不是数组')
  }

  // 归一化 durationRatio
  const totalRatio = items.reduce((sum, it) => sum + (Number(it.durationRatio) || 1), 0)
  let cursor = 0

  return items.map((it, i) => {
    const ratio = (Number(it.durationRatio) || 1) / totalRatio
    const sceneDur = Math.max(3, Math.round(dur * ratio))
    const start = cursor
    const end = i === items.length - 1 ? dur : cursor + sceneDur
    cursor = end

    const desc = String(it.description || it.title || '场景画面')
    const camera = CAMERA_MOVEMENTS[i % CAMERA_MOVEMENTS.length]!

    return {
      id: i + 1,
      title: String(it.title || `场景 ${i + 1}`),
      description: desc,
      startTime: start,
      endTime: end,
      craftPrompt: buildCraftPromptFromDesc(desc, start, end - start),
      voiceover: String(it.voiceover || ''),
      cameraMovementId: camera.id,
    }
  })
}

/**
 * AI 调用失败时的本地兜底模板，保证流程可继续
 */
function populateFallbackScenes(dur: number, sceneCount: number) {
  const perScene = Math.floor(dur / sceneCount)
  const fallbacks = [
    { title: '品牌开场', desc: '品牌Logo渐入，配合大气的背景音乐，展现品牌整体形象', vo: `${brandName.value || '我们的品牌'}以创新为驱动，引领行业新未来。` },
    { title: '痛点呈现', desc: '通过生活化场景展现目标用户面临的核心痛点', vo: '你是否也曾为这样的问题而困扰？' },
    { title: '产品亮相', desc: '产品以震撼方式登场，展示核心功能和差异化优势', vo: '现在，一切都有了全新的解决方案。' },
    { title: '用户见证', desc: '真实用户使用场景，展现产品带来的改变和价值', vo: '看看他们，已经开始了全新的体验。' },
    { title: '行动号召', desc: '明确的行动引导，配合限时优惠信息', vo: '现在就加入我们，开启你的全新旅程。' },
    { title: '品牌收尾', desc: '品牌Logo定版，留下深刻印象', vo: `${brandName.value || '品牌名'}，与你共创未来。` },
  ]
  scenes.value = Array.from({ length: sceneCount }, (_, i) => {
    const t = fallbacks[i % fallbacks.length]!
    const start = i * perScene
    const end = i === sceneCount - 1 ? dur : start + perScene
    return {
      id: i + 1,
      title: t.title,
      description: t.desc,
      startTime: start,
      endTime: end,
      craftPrompt: buildCraftPromptFromDesc(t.desc, start, end - start),
      voiceover: t.vo,
      cameraMovementId: CAMERA_MOVEMENTS[i % CAMERA_MOVEMENTS.length]!.id,
    }
  })
}

/**
 * 根据场景描述构建 CRAFT 提示词对象（供脚本生成和分镜拆分复用）
 */
function buildCraftPromptFromDesc(description: string, startSec: number, duration: number): CraftPrompt {
  const camera = CAMERA_MOVEMENTS.find(m => m.id === 'push_in') || CAMERA_MOVEMENTS[0]!
  const timing = Array.from({ length: Math.ceil(duration / 3) }, (_, i) => {
    const s = startSec + i * 3
    const e = Math.min(s + 3, startSec + duration)
    return `${s}-${e}s: ${i === 0 ? 'establishing wide shot' : 'action progression'}`
  }).join('; ')

  const context = `cinematic lighting, ${brandName.value || 'brand'} commercial, ${description}`
  const reference = productImages.value.length
    ? productImages.value.map((_, idx) => `@image ${idx + 1} as product_ref_${idx + 1}`).join(', ')
    : ''
  const action = description
  const framing = `medium shot, ${camera.promptTemplate}, shallow depth of field`

  const blocks: string[] = []
  if (context) blocks.push(`[Context] ${context}`)
  if (reference) blocks.push(`[Reference] ${reference}`)
  if (action) blocks.push(`[Action] ${action}`)
  if (framing) blocks.push(`[Framing] ${framing}`)
  if (timing) blocks.push(`[Timing] ${timing}`)

  return { context, reference, action, framing, timing, fullPrompt: blocks.join('\n') }
}

function regenerateScript() {
  scriptGenerated.value = false
  generateScript()
}

function addScene() {
  const dur = parseInt(videoDuration.value) || 30
  const lastEnd = scenes.value.length ? scenes.value[scenes.value.length - 1]!.endTime : 0
  const newEnd = Math.min(lastEnd + 5, dur)
  const id = scenes.value.length ? Math.max(...scenes.value.map(s => s.id)) + 1 : 1
  scenes.value.push({
    id,
    title: '新场景',
    description: '',
    startTime: lastEnd,
    endTime: newEnd,
    craftPrompt: null,
    voiceover: '',
    cameraMovementId: 'static',
  })
}

function removeScene(id: number) {
  scenes.value = scenes.value.filter(s => s.id !== id)
}

function moveScene(idx: number, dir: -1 | 1) {
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= scenes.value.length) return
  const arr = [...scenes.value]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx]!, arr[idx]!]
  scenes.value = arr
}

function getCraftPreview(scene: Scene): string {
  if (!scene.craftPrompt) return '（尚未生成 CRAFT 提示词）'
  return scene.craftPrompt.fullPrompt
}

// ══════════════════════════════════════════
// Step 3: 分镜生成 + 参考图绑定
// ══════════════════════════════════════════

interface Shot {
  id: number
  sceneId: number
  title: string
  startTime: number
  endTime: number
  craftPrompt: CraftPrompt | null
  referenceImages: UploadedFile[]
  cameraMovementId: string
}

const shots = ref<Shot[]>([])
let shotUid = 0

function autoSplitShots() {
  // TODO: 接入后端自动拆分为 ≤15s 镜头 (video-render-service)
  const arr: Shot[] = []
  for (const scene of scenes.value) {
    const dur = scene.endTime - scene.startTime
    if (dur <= 15) {
      arr.push({
        id: ++shotUid,
        sceneId: scene.id,
        title: scene.title,
        startTime: scene.startTime,
        endTime: scene.endTime,
        craftPrompt: scene.craftPrompt
          ? { ...scene.craftPrompt }
          : buildCraftPromptFromDesc(scene.description, scene.startTime, dur),
        referenceImages: [...productImages.value],
        cameraMovementId: scene.cameraMovementId,
      })
    } else {
      let t = scene.startTime
      let part = 1
      while (t < scene.endTime) {
        const segEnd = Math.min(t + 15, scene.endTime)
        arr.push({
          id: ++shotUid,
          sceneId: scene.id,
          title: `${scene.title} (${part})`,
          startTime: t,
          endTime: segEnd,
          craftPrompt: buildCraftPromptFromDesc(scene.description, t, segEnd - t),
          referenceImages: [...productImages.value],
          cameraMovementId: scene.cameraMovementId,
        })
        t = segEnd
        part++
      }
    }
  }
  shots.value = arr
}

async function addShotRefImage(shotId: number, e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  for (const f of input.files) {
    const localUrl = URL.createObjectURL(f)
    const img = {
      id: ++fileUid,
      name: f.name,
      previewUrl: localUrl,
    }
    shot.referenceImages.push(img)
    assetService.upload(f, { kind: 'image' }).then(asset => {
      img.previewUrl = asset.url
    }).catch(() => {})
  }
  input.value = ''
}

function removeShotRefImage(shotId: number, imgId: number) {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  shot.referenceImages = shot.referenceImages.filter(img => img.id !== imgId)
}

// ══════════════════════════════════════════
// Step 4: 逐镜头生成视频
// ══════════════════════════════════════════

interface ShotGen {
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed'
  progress: number
}

const shotGenStatus = ref<Map<number, ShotGen>>(new Map())
const shotVideoUrls = ref<Map<number, string>>(new Map())

function getShotStatus(id: number): ShotGen {
  return shotGenStatus.value.get(id) || { status: 'pending', progress: 0 }
}

function getShotVideoUrl(id: number): string | undefined {
  return shotVideoUrls.value.get(id)
}

/**
 * 调用 generateVideo API 为指定镜头生成视频，并将结果 URL 存入 shotVideoUrls。
 */
async function generateShotVideo(shotId: number) {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return

  shotGenStatus.value.set(shotId, { status: 'queued', progress: 0 })
  shotGenStatus.value = new Map(shotGenStatus.value)

  try {
    shotGenStatus.value.set(shotId, { status: 'running', progress: 10 })
    shotGenStatus.value = new Map(shotGenStatus.value)

    const prompt = shot.craftPrompt?.fullPrompt || shot.title || 'cinematic brand shot'
    const duration = shot.endTime - shot.startTime

    const url = (await generateVideo({
      prompt,
      durationSeconds: Math.min(duration, 15),
      resolution: '720p',
      referenceImages: shot.referenceImages.map(img => img.previewUrl).filter(Boolean),
    })).url

    shotVideoUrls.value.set(shotId, url)
    shotVideoUrls.value = new Map(shotVideoUrls.value)

    shotGenStatus.value.set(shotId, { status: 'succeeded', progress: 100 })
    shotGenStatus.value = new Map(shotGenStatus.value)
  } catch (err) {
    console.error(`[generateShotVideo] 镜头 ${shotId} 生成失败:`, err)
    shotGenStatus.value.set(shotId, { status: 'failed', progress: 0 })
    shotGenStatus.value = new Map(shotGenStatus.value)
  }
}

function regenerateShotVideo(shotId: number) {
  generateShotVideo(shotId)
}

const completedShotCount = computed(() => {
  let count = 0
  for (const [, v] of shotGenStatus.value) {
    if (v.status === 'succeeded') count++
  }
  return count
})

const totalShotProgress = computed(() => {
  if (!shots.value.length) return 0
  return Math.round((completedShotCount.value / shots.value.length) * 100)
})

// ══════════════════════════════════════════
// Step 5: 配音配乐
// ══════════════════════════════════════════

const voiceStyles = [
  { id: 'corporate', label: '企业大气' },
  { id: 'tech', label: '科技感' },
  { id: 'warm', label: '温馨感动' },
  { id: 'fashion', label: '时尚潮流' },
  { id: 'retro', label: '复古' },
  { id: 'chinese', label: '国风' },
]

const selectedVoice = ref('corporate')
const voiceSpeed = ref(1.0)
const voicePreviewing = ref<number | null>(null)
const voicePreviewResults = ref<Map<number, string>>(new Map())

/**
 * 调用 generateText 根据场景旁白文案和所选配音风格，生成优化后的配音文稿。
 * 由于暂无 TTS 端点，此处生成文本摘要作为配音预览；
 * 后续接入 TTS 后可将 generateText 替换为语音合成调用。
 */
async function previewSceneVoiceover(sceneId: number) {
  // 切换/取消
  if (voicePreviewing.value === sceneId) {
    voicePreviewing.value = null
    return
  }

  const scene = scenes.value.find(s => s.id === sceneId)
  if (!scene) return

  // 如果已有缓存结果，直接播放
  if (voicePreviewResults.value.has(sceneId)) {
    voicePreviewing.value = sceneId
    setTimeout(() => { if (voicePreviewing.value === sceneId) voicePreviewing.value = null }, 4000)
    return
  }

  voicePreviewing.value = sceneId

  const voiceLabel = voiceStyles.find(v => v.id === selectedVoice.value)?.label || selectedVoice.value

  try {
    const result = await generateText({
      prompt: [
        `请为以下宣传片旁白进行播音优化。`,
        `配音风格：${voiceLabel}`,
        `语速：${voiceSpeed.value}x`,
        `原始旁白：${scene.voiceover || '（无旁白文案）'}`,
        `场景描述：${scene.description}`,
        '',
        '请输出一段优化后的配音文稿（不超过80字），使其更适合所选配音风格的口语化表达，',
        '标注停顿（用"…"表示）和重音（用"【】"包裹关键词）。只输出文稿，不要额外说明。',
      ].join('\n'),
      systemPrompt: '你是一位专业的配音导演，擅长将书面文案转化为适合播音的口语化文稿。只输出优化后的文稿。',
      maxTokens: 512,
    })

    voicePreviewResults.value.set(sceneId, result)
    voicePreviewResults.value = new Map(voicePreviewResults.value)

    // 模拟播放时长
    setTimeout(() => { if (voicePreviewing.value === sceneId) voicePreviewing.value = null }, 4000)
  } catch (err) {
    console.error('[previewSceneVoiceover] 配音预览失败:', err)
    voicePreviewing.value = null
  }
}

// 音乐
const musicStyle = ref('corporate')
const musicVolume = ref(40)
const musicMuted = ref(false)
const aiMusicGenerating = ref(false)
const aiMusicProgress = ref(0)
const aiMusicGenerated = ref(false)
const aiMusicName = ref('')

const aiMusicUrl = ref('')

/**
 * 调用 generateMusic API 根据场景氛围和风格生成品牌配乐。
 */
async function generateAiMusic() {
  if (aiMusicGenerating.value) return
  aiMusicGenerating.value = true
  aiMusicProgress.value = 10
  aiMusicGenerated.value = false
  aiMusicName.value = ''
  aiMusicUrl.value = ''

  const style = voiceStyles.find(v => v.id === musicStyle.value)
  const styleLabel = style?.label || musicStyle.value
  const dur = parseInt(videoDuration.value) || 30

  const prompt = [
    `${styleLabel}风格的品牌宣传配乐`,
    `品牌：${brandName.value || '未命名品牌'}`,
    `氛围：${styleLabel}，节奏适中，适合 ${dur} 秒宣传片`,
    productDesc.value ? `产品调性：${productDesc.value.slice(0, 60)}` : '',
  ].filter(Boolean).join('，')

  try {
    aiMusicProgress.value = 30

    const url = await generateMusic({
      prompt,
      durationSeconds: dur,
      style: styleLabel,
    })

    aiMusicUrl.value = url
    aiMusicProgress.value = 100
    aiMusicGenerated.value = true
    aiMusicName.value = `AI生成 - ${styleLabel} 品牌配乐`
  } catch (err) {
    console.error('[generateAiMusic] 配乐生成失败:', err)
    aiMusicProgress.value = 0
  } finally {
    aiMusicGenerating.value = false
  }
}

// 混音
const voiceoverVolume = ref(70)
const voiceoverMuted = ref(false)
const isMixPlaying = ref(false)
const waveformData = ref<number[]>(Array.from({ length: 48 }, () => Math.random() * 60 + 20))
let waveTimer: ReturnType<typeof setInterval> | null = null

watch(isMixPlaying, (playing) => {
  if (playing) {
    waveTimer = setInterval(() => {
      waveformData.value = Array.from({ length: 48 }, () => Math.random() * 70 + 15)
    }, 150)
  } else {
    if (waveTimer) clearInterval(waveTimer)
    waveTimer = null
  }
})

// ══════════════════════════════════════════
// Step 6: 合成导出
// ══════════════════════════════════════════

const isPreviewPlaying = ref(false)
const previewTime = ref(0)
let previewTimer: ReturnType<typeof setInterval> | null = null

const totalDuration = computed(() => {
  return scenes.value.length ? scenes.value[scenes.value.length - 1]!.endTime : 0
})

function togglePreview() {
  isPreviewPlaying.value = !isPreviewPlaying.value
  if (isPreviewPlaying.value) {
    previewTimer = setInterval(() => {
      previewTime.value++
      if (previewTime.value >= totalDuration.value) {
        isPreviewPlaying.value = false
        previewTime.value = 0
        if (previewTimer) clearInterval(previewTimer)
        previewTimer = null
      }
    }, 1000)
  } else {
    if (previewTimer) clearInterval(previewTimer)
    previewTimer = null
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 导出设置
const exportFormat = ref('MP4')
const exportResolution = ref('1080p')
const exportAspects = ref<string[]>(['16:9横版'])
const includeVoiceover = ref(true)
const includeMusic = ref(true)
const includeWatermark = ref(true)
const includeSubtitles = ref(true)
// ENH-14: 宣传片参考视频输入
const referenceVideoUrl = ref('')
const referenceVideoFile = ref<File | null>(null)
const showRefVideoInput = ref(false)

function handleRefVideoUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    referenceVideoFile.value = input.files[0]
    referenceVideoUrl.value = URL.createObjectURL(input.files[0])
  }
}

function clearRefVideo() {
  referenceVideoUrl.value = ''
  referenceVideoFile.value = null
}

// ENH-15: 字幕预览+样式选择器
interface SubtitleStyle {
  id: string
  name: string
  fontFamily: string
  fontSize: string
  color: string
  bgColor: string
  position: 'bottom' | 'top' | 'center'
  preview: string
}

const subtitleStyles: SubtitleStyle[] = [
  { id: 'default', name: '默认样式', fontFamily: 'inherit', fontSize: '14px', color: '#FFFFFF', bgColor: 'rgba(0,0,0,0.5)', position: 'bottom', preview: '简约白字黑底' },
  { id: 'bold', name: '粗体强调', fontFamily: 'inherit', fontSize: '18px', color: '#FFD700', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom', preview: '金色粗体大字' },
  { id: 'minimal', name: '极简无背景', fontFamily: 'inherit', fontSize: '13px', color: '#FFFFFF', bgColor: 'transparent', position: 'bottom', preview: '透明底白字' },
  { id: 'chinese', name: '国风雅韵', fontFamily: "'Noto Serif SC', serif", fontSize: '15px', color: '#F5E6CC', bgColor: 'rgba(30,20,60,0.6)', position: 'bottom', preview: '衬线古风配色' },
  { id: 'neon', name: '霓虹灯效', fontFamily: 'inherit', fontSize: '14px', color: '#00FF88', bgColor: 'rgba(0,0,0,0.5)', position: 'bottom', preview: '霓虹绿发光字' },
  { id: 'corporate', name: '商务正式', fontFamily: 'inherit', fontSize: '13px', color: '#E8E8E8', bgColor: 'rgba(0,20,40,0.7)', position: 'bottom', preview: '商务蓝底灰白字' },
]
const selectedSubtitleStyle = ref<SubtitleStyle>(subtitleStyles[0])
const showSubtitlePreview = ref(false)
const subPreviewText = ref('这里是字幕预览效果')



const aspectOptions = ['16:9横版', '9:16竖版', '1:1方形']

function toggleAspect(ratio: string) {
  const idx = exportAspects.value.indexOf(ratio)
  if (idx >= 0) {
    exportAspects.value.splice(idx, 1)
  } else {
    exportAspects.value.push(ratio)
  }
}

const exporting = ref(false)
const exportProgress = ref(0)
const exportDone = ref(false)

const exportResultUrls = ref<string[]>([])

/**
 * 合成导出：先确保所有镜头视频已生成，然后汇总产物 URL。
 * 后续接入后端合成服务时可在此调用视频拼接/转码 API。
 */
async function startExport() {
  if (exporting.value) return
  exporting.value = true
  exportProgress.value = 0
  exportDone.value = false
  exportResultUrls.value = []

  try {
    // 第一步：为尚未生成的镜头启动视频生成
    const pendingShots = shots.value.filter(
      s => !shotVideoUrls.value.has(s.id) && getShotStatus(s.id).status !== 'running'
    )
    if (pendingShots.length) {
      const total = pendingShots.length
      let done = 0
      // 并行启动所有待生成镜头
      const promises = pendingShots.map(async (shot) => {
        await generateShotVideo(shot.id)
        done++
        exportProgress.value = Math.round((done / total) * 60) // 0-60% 用于生成
      })
      await Promise.allSettled(promises)
    }

    exportProgress.value = 70

    // 第二步：收集所有已生成的视频 URL
    const urls: string[] = []
    for (const shot of shots.value) {
      const url = shotVideoUrls.value.get(shot.id)
      if (url) urls.push(url)
    }

    exportProgress.value = 90
    exportResultUrls.value = urls

    // 第三步：标记完成（后续可在此调用后端合成/转码 API 拼接为单个 MP4）
    exportProgress.value = 100
    exportDone.value = true

    // ── 写入 bridge 数据供配乐编辑器读取 ──
    try {
      sessionStorage.setItem('mhw:bridge:promo→music', JSON.stringify({
        source: 'promo',
        shots: shots.value.map(s => ({ id: s.id, title: s.title, durationSec: s.durationSec || 5 })),
        totalDurationSec: shots.value.reduce((sum, s) => sum + (s.durationSec || 5), 0),
        exportedAt: new Date().toISOString()
      }))
    } catch { /* storage full */ }

    // 自动下载第一个视频产物
    if (urls.length > 0) {
      downloadExportVideo(0)
    }
  } catch (err) {
    console.error('[startExport] 导出失败:', err)
  } finally {
    exporting.value = false
  }
}

async function downloadExportVideo(index: number) {
  const url = exportResultUrls.value[index]
  if (!url) {
    console.warn('[downloadExportVideo] 无效的视频索引:', index)
    return
  }
  const fileName = `promo-export-shot${index + 1}.mp4`
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('[downloadExportVideo] 下载失败:', err)
  }
}

function backToEdit() {
  exportDone.value = false
  exportProgress.value = 0
}

// ══════════════════════════════════════════
// 清理
// ══════════════════════════════════════════

onBeforeUnmount(() => {
  if (waveTimer) clearInterval(waveTimer)
  if (previewTimer) clearInterval(previewTimer)
})

// ── 草稿自动保存 ──
const DRAFT_KEY_PE = 'mhw:draft:promo'
watch([brandName, productDesc, shots], () => {
  try {
    sessionStorage.setItem(DRAFT_KEY_PE, JSON.stringify({
      brandName: brandName.value,
      productDesc: productDesc.value,
      shots: shots.value.map(s => ({ id: s.id, title: s.title, desc: s.desc, vo: s.vo })),
      savedAt: new Date().toISOString()
    }))
  } catch { /* storage full */ }
}, { deep: true })
// 全局拦截「从系统拖入文件」导致的浏览器新标签打开行为（仅真实文件拖入时拦截）
let _fileDragGuardCleanupPE: (() => void) | null = null
function installFileDragGuardPE() {
  const block = (e: DragEvent) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault()
  }
  window.addEventListener('dragover', block)
  window.addEventListener('drop', block)
  _fileDragGuardCleanupPE = () => {
    window.removeEventListener('dragover', block)
    window.removeEventListener('drop', block)
  }
}

// 恢复草稿
onMounted(() => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY_PE)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.brandName) brandName.value = d.brandName
      if (d.productDesc) productDesc.value = d.productDesc
    }
  } catch { /* ignore */ }
  installFileDragGuardPE()
})
onBeforeUnmount(() => { _fileDragGuardCleanupPE?.() })
</script>

<template>
  <!-- P4-1: First-visit empty state -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">🎥</div>
      <h2 class="qe-empty__title">暂无宣传片项目</h2>
      <p class="qe-empty__desc">填写品牌Brief，AI自动生成宣传脚本、分镜、视频与配音</p>
      <button class="qe-empty__btn" @click="hasStarted = true">🎥 开始创作</button>
    </div>
    <div class="pe-root" v-else>

    <!-- ═══════════ 步骤指示器 ═══════════ -->
    <nav class="pe-stepbar">
      <template v-for="(step, idx) in STEPS" :key="step.key">
        <div
          class="pe-step"
          :class="{
            'pe-step--active': stepState(idx) === 'active',
            'pe-step--done': stepState(idx) === 'done',
            'pe-step--pending': stepState(idx) === 'pending',
          }"
          @click="goToStep(idx)"
        >
          <div class="pe-step__dot">
            <span v-if="stepState(idx) === 'done'" class="pe-step__check">&#10003;</span>
            <span v-else class="pe-step__num">{{ idx + 1 }}</span>
          </div>
          <span class="pe-step__label">{{ step.label }}</span>
        </div>
        <div
          v-if="idx < STEPS.length - 1"
          class="pe-step__line"
          :class="{ 'pe-step__line--done': stepState(idx) === 'done' }"
        />
      </template>
    </nav>

    <!-- ═══════════ 步骤内容 ═══════════ -->
    <div class="pe-body">
      <Transition name="pe-fade" mode="out-in">

        <!-- ────────────── Step 1: 品牌 Brief ────────────── -->
        <div v-if="currentStep === 0" key="brief" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">品牌 Brief</h2>
            <p class="pe-panel__desc">填写品牌信息，上传品牌素材，为 AI 脚本生成做准备</p>
          </div>

          <div class="pe-form">
            <div class="pe-field">
              <label class="pe-field__label">品牌名称 <span class="pe-field__req">*</span></label>
              <input v-model="brandName" class="pe-input" placeholder="输入品牌名称..." />
            </div>

            <div class="pe-field">
              <label class="pe-field__label">产品/服务描述 <span class="pe-field__req">*</span></label>
              <textarea v-model="productDesc" class="pe-textarea" rows="4" placeholder="描述产品核心卖点、差异化优势、使用场景..." />
            </div>

            <div class="pe-field">
              <label class="pe-field__label">目标受众</label>
              <div class="pe-chips">
                <button
                  v-for="opt in audienceOptions" :key="opt"
                  class="pe-chip"
                  :class="{ 'pe-chip--active': targetAudience === opt }"
                  @click="selectAudience(opt)"
                >{{ opt }}</button>
              </div>
              <div v-if="audienceSubCategories[targetAudience]" class="pe-sub-audience">
                <div class="pe-sub-chips">
                  <button
                    v-for="sub in audienceSubCategories[targetAudience]"
                    :key="sub"
                    class="pe-sub-chip"
                    :class="{ 'pe-sub-chip--active': selectedSubAudiences.includes(sub) }"
                    @click="toggleSubAudience(sub)"
                  >{{ sub }}</button>
                </div>
                <div v-if="selectedSubAudiences.length" class="pe-selected-subs">
                  <span v-for="sub in selectedSubAudiences" :key="sub" class="pe-selected-sub">
                    {{ sub }}
                    <button @click="removeCustomAudience(sub)">×</button>
                  </span>
                </div>
                <div class="pe-custom-audience">
                  <input
                    v-model="customAudience"
                    class="pe-custom-input"
                    placeholder="自定义受众画像..."
                    @keyup.enter="addCustomAudience"
                  />
                  <button class="pe-custom-add" @click="addCustomAudience" :disabled="!customAudience.trim()">+ 添加</button>
                </div>
              </div>
            </div>

            <div class="pe-field">
              <label class="pe-field__label">视频时长</label>
              <div class="pe-chips">
                <button
                  v-for="opt in durationOptions" :key="opt"
                  class="pe-chip"
                  :class="{ 'pe-chip--active': videoDuration === opt }"
                  @click="videoDuration = opt"
                >{{ opt }}</button>
              </div>
            </div>

            <!-- 品牌素材上传 -->
            <div class="pe-field">
              <label class="pe-field__label">品牌素材</label>
              <div class="pe-upload-section">
                <!-- 产品图片 -->
                <div class="pe-upload-group">
                  <span class="pe-upload-group__label">产品图片（用作各镜头 reference_image）</span>
                  <div class="pe-upload-zone" :class="{ 'pe-upload-zone--drag': isDraggingProduct }"
                    @dragover.prevent @dragenter.prevent="onDragEnterProduct" @dragleave.prevent="onDragLeaveProduct" @drop="onDropProduct">
                    <div v-for="img in productImages" :key="img.id" class="pe-upload-thumb">
                      <img :src="img.previewUrl" :alt="img.name" />
                      <button class="pe-upload-thumb__rm" @click="removeProductImage(img.id)">&#10005;</button>
                    </div>
                    <label class="pe-upload-btn" tabindex="0" role="button"
                      @keydown.enter.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()"
                      @keydown.space.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()">
                      <span>+ 添加图片</span>
                      <input type="file" accept="image/*" multiple hidden @change="handleProductImages" />
                    </label>
                  </div>
                </div>

                <!-- 品牌Logo -->
                <div class="pe-upload-group">
                  <span class="pe-upload-group__label">品牌 Logo（用作 watermark 水印参数）</span>
                  <div class="pe-upload-zone" :class="{ 'pe-upload-zone--drag': isDraggingLogo }"
                    @dragover.prevent @dragenter.prevent="onDragEnterLogo" @dragleave.prevent="onDragLeaveLogo" @drop="onDropLogo">
                    <div v-if="brandLogo" class="pe-upload-thumb">
                      <img :src="brandLogo.previewUrl" :alt="brandLogo.name" />
                      <button class="pe-upload-thumb__rm" @click="clearLogo">&#10005;</button>
                    </div>
                    <label v-else class="pe-upload-btn" tabindex="0" role="button"
                      @keydown.enter.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()"
                      @keydown.space.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()">
                      <span>+ 上传 Logo</span>
                      <input type="file" accept="image/*" hidden @change="handleLogoUpload" />
                    </label>
                  </div>
                </div>

                <!-- 风格参考图 -->
                <div class="pe-upload-group">
                  <span class="pe-upload-group__label">品牌风格参考图</span>
                  <div class="pe-upload-zone" :class="{ 'pe-upload-zone--drag': isDraggingStyle }"
                    @dragover.prevent @dragenter.prevent="onDragEnterStyle" @dragleave.prevent="onDragLeaveStyle" @drop="onDropStyle">
                    <div v-for="img in styleRefImages" :key="img.id" class="pe-upload-thumb">
                      <img :src="img.previewUrl" :alt="img.name" />
                      <button class="pe-upload-thumb__rm" @click="removeStyleImage(img.id)">&#10005;</button>
                    </div>
                    <label class="pe-upload-btn" tabindex="0" role="button"
                      @keydown.enter.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()"
                      @keydown.space.prevent="($event.currentTarget as HTMLElement).querySelector('input')?.click()">
                      <span>+ 添加参考图</span>
                      <input type="file" accept="image/*" multiple hidden @change="handleStyleImages" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ────────────── Step 2: AI 生成脚本 ────────────── -->
        <div v-else-if="currentStep === 1" key="script" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">AI 生成脚本</h2>
            <p class="pe-panel__desc">AI 根据品牌 Brief 自动生成宣传片脚本，支持编辑与调整</p>
          </div>

          <!-- 未生成 -->
          <div v-if="!scriptGenerated && !scriptGenerating" class="pe-empty">
            <div class="pe-empty__icon">&#128221;</div>
            <p class="pe-empty__text">尚未生成脚本</p>
            <p class="pe-empty__hint">点击按钮，AI 将根据品牌 Brief 自动生成完整脚本与分镜</p>
            <button class="pe-btn pe-btn--primary pe-btn--lg" @click="generateScript">AI 生成脚本</button>
          </div>

          <!-- 生成中 -->
          <div v-if="scriptGenerating" class="pe-loading">
            <div class="pe-spinner" />
            <p class="pe-loading__text">AI 正在创作脚本... {{ scriptGenProgress }}%</p>
            <div class="pe-progress"><div class="pe-progress__fill" :style="{ width: scriptGenProgress + '%' }" /></div>
          </div>

          <!-- 已生成 -->
          <div v-if="scriptGenerated && !scriptGenerating" class="pe-script">
            <!-- 操作栏 -->
            <div class="pe-script__toolbar">
              <button class="pe-btn pe-btn--ghost pe-btn--sm" @click="regenerateScript">重新生成</button>
              <button class="pe-btn pe-btn--ghost pe-btn--sm" @click="addScene">+ 添加场景</button>
            </div>

            <!-- 时间线总览 -->
            <div class="pe-timeline-bar">
              <div
                v-for="s in scenes" :key="s.id"
                class="pe-timeline-bar__seg"
                :style="{ flex: (s.endTime - s.startTime) }"
                :title="`${s.title} (${s.startTime}-${s.endTime}s)`"
              >
                <span class="pe-timeline-bar__label">{{ s.title }}</span>
                <span class="pe-timeline-bar__time">{{ s.startTime }}-{{ s.endTime }}s</span>
              </div>
            </div>

            <!-- 场景列表 -->
            <div class="pe-scene-list">
              <div v-for="(s, idx) in scenes" :key="s.id" class="pe-scene-card">
                <div class="pe-scene-card__head">
                  <span class="pe-scene-card__badge">场景 {{ idx + 1 }}</span>
                  <input v-model="s.title" class="pe-scene-card__title-input" placeholder="场景标题" />
                  <span class="pe-scene-card__time">{{ s.startTime }}s - {{ s.endTime }}s</span>
                  <div class="pe-scene-card__actions">
                    <button class="pe-btn-icon" title="上移" :disabled="idx === 0" @click="moveScene(idx, -1)">&#9650;</button>
                    <button class="pe-btn-icon" title="下移" :disabled="idx === scenes.length - 1" @click="moveScene(idx, 1)">&#9660;</button>
                    <button class="pe-btn-icon pe-btn-icon--danger" title="删除" @click="removeScene(s.id)">&#10005;</button>
                  </div>
                </div>

                <div class="pe-scene-card__body">
                  <div class="pe-scene-card__col">
                    <label class="pe-field__label">描述</label>
                    <textarea v-model="s.description" class="pe-textarea pe-textarea--sm" rows="3" placeholder="场景描述..." />

                    <label class="pe-field__label">配音文案</label>
                    <textarea v-model="s.voiceover" class="pe-textarea pe-textarea--sm" rows="2" placeholder="配音文案..." />
                  </div>

                  <div class="pe-scene-card__col">
                    <label class="pe-field__label">镜头运动</label>
                    <select v-model="s.cameraMovementId" class="pe-select">
                      <option v-for="cm in CAMERA_MOVEMENTS" :key="cm.id" :value="cm.id">
                        {{ cm.nameZh }} ({{ cm.nameEn }})
                      </option>
                    </select>

                    <label class="pe-field__label">CRAFT 提示词预览</label>
                    <div class="pe-craft-preview">{{ getCraftPreview(s) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ────────────── Step 3: 分镜生成 + 参考图绑定 ────────────── -->
        <div v-else-if="currentStep === 2" key="shots" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">分镜生成 + 参考图绑定</h2>
            <p class="pe-panel__desc">场景已自动拆分为不超过 15 秒的镜头，可调整 CRAFT 参数和参考图</p>
          </div>

          <div v-if="!shots.length" class="pe-empty">
            <div class="pe-empty__icon">&#127902;</div>
            <p class="pe-empty__text">暂无镜头数据</p>
            <p class="pe-empty__hint">请先完成脚本生成</p>
          </div>

          <div v-else class="pe-shot-list">
            <div v-for="shot in shots" :key="shot.id" class="pe-shot-card">
              <div class="pe-shot-card__head">
                <span class="pe-shot-card__badge">{{ shot.title }}</span>
                <span class="pe-shot-card__time">{{ shot.startTime }}s - {{ shot.endTime }}s</span>
              </div>

              <div class="pe-shot-card__body">
                <!-- CRAFT 编辑 -->
                <div class="pe-shot-card__col">
                  <template v-if="shot.craftPrompt">
                    <div class="pe-field">
                      <label class="pe-field__label">C - 环境/氛围</label>
                      <textarea v-model="shot.craftPrompt.context" class="pe-textarea pe-textarea--xs" rows="2" />
                    </div>
                    <div class="pe-field">
                      <label class="pe-field__label">R - 参考图绑定</label>
                      <div class="pe-craft-ref-readonly">{{ shot.craftPrompt.reference || '（无参考图）' }}</div>
                    </div>
                    <div class="pe-field">
                      <label class="pe-field__label">A - 动作/交互</label>
                      <textarea v-model="shot.craftPrompt.action" class="pe-textarea pe-textarea--xs" rows="2" />
                    </div>
                    <div class="pe-field">
                      <label class="pe-field__label">F - 镜头/构图</label>
                      <textarea v-model="shot.craftPrompt.framing" class="pe-textarea pe-textarea--xs" rows="2" />
                    </div>
                    <div class="pe-field">
                      <label class="pe-field__label">T - 时间节奏</label>
                      <textarea v-model="shot.craftPrompt.timing" class="pe-textarea pe-textarea--xs" rows="2" />
                    </div>
                  </template>
                </div>

                <!-- 参考图 & 镜头运动 -->
                <div class="pe-shot-card__col">
                  <div class="pe-field">
                    <label class="pe-field__label">镜头运动</label>
                    <select v-model="shot.cameraMovementId" class="pe-select">
                      <option v-for="cm in CAMERA_MOVEMENTS" :key="cm.id" :value="cm.id">
                        {{ cm.nameZh }} ({{ cm.nameEn }})
                      </option>
                    </select>
                  </div>

                  <div class="pe-field">
                    <label class="pe-field__label">参考图片 ({{ shot.referenceImages.length }})</label>
                    <div class="pe-upload-zone pe-upload-zone--sm">
                      <div v-for="img in shot.referenceImages" :key="img.id" class="pe-upload-thumb pe-upload-thumb--sm">
                        <img :src="img.previewUrl" :alt="img.name" />
                        <button class="pe-upload-thumb__rm" @click="removeShotRefImage(shot.id, img.id)">&#10005;</button>
                      </div>
                      <label class="pe-upload-btn pe-upload-btn--sm">
                        <span>+ 添加</span>
                        <input type="file" accept="image/*" multiple hidden @change="(e: Event) => addShotRefImage(shot.id, e)" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ────────────── Step 4: 逐镜头生成视频 ────────────── -->
        <div v-else-if="currentStep === 3" key="generate" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">逐镜头生成视频</h2>
            <p class="pe-panel__desc">逐个生成每段镜头视频，可随时重新生成</p>
          </div>

          <!-- 总进度 -->
          <div class="pe-gen-progress">
            <div class="pe-gen-progress__info">
              已完成 {{ completedShotCount }} / {{ shots.length }} 镜头
            </div>
            <div class="pe-progress pe-progress--lg">
              <div class="pe-progress__fill" :style="{ width: totalShotProgress + '%' }" />
            </div>
          </div>

          <div class="pe-gen-list">
            <div v-for="shot in shots" :key="shot.id" class="pe-gen-card">
              <div class="pe-gen-card__head">
                <span class="pe-gen-card__badge">{{ shot.title }}</span>
                <span class="pe-gen-card__time">{{ shot.startTime }}s - {{ shot.endTime }}s</span>
                <span
                  class="pe-gen-card__status"
                  :class="'pe-gen-card__status--' + getShotStatus(shot.id).status"
                >
                  {{
                    getShotStatus(shot.id).status === 'pending' ? '待生成' :
                    getShotStatus(shot.id).status === 'queued' ? '排队中' :
                    getShotStatus(shot.id).status === 'running' ? '生成中' :
                    getShotStatus(shot.id).status === 'succeeded' ? '已完成' : '失败'
                  }}
                </span>
              </div>

              <div class="pe-gen-card__body">
                <!-- CRAFT 提示词摘要 -->
                <div class="pe-gen-card__craft">
                  <span class="pe-gen-card__craft-label">CRAFT 提示词</span>
                  <p class="pe-gen-card__craft-text">{{ shot.craftPrompt?.fullPrompt?.slice(0, 160) || '（无）' }}{{ (shot.craftPrompt?.fullPrompt?.length || 0) > 160 ? '...' : '' }}</p>
                </div>

                <!-- 参考图缩略 -->
                <div v-if="shot.referenceImages.length" class="pe-gen-card__refs">
                  <img v-for="img in shot.referenceImages" :key="img.id" :src="img.previewUrl" :alt="img.name" class="pe-gen-card__ref-thumb" />
                </div>

                <!-- 进度条 -->
                <div v-if="getShotStatus(shot.id).status === 'running'" class="pe-progress">
                  <div class="pe-progress__fill" :style="{ width: getShotStatus(shot.id).progress + '%' }" />
                </div>

                <!-- 视频预览占位 -->
                <div v-if="getShotStatus(shot.id).status === 'succeeded'" class="pe-gen-card__preview">
                  <div class="pe-gen-card__preview-placeholder">
                    <span>&#9654;</span>
                    <span class="pe-gen-card__preview-label">视频预览</span>
                  </div>
                  <!-- 末帧展示（用于下一镜头 first_frame） -->
                  <div class="pe-gen-card__lastframe">
                    <span class="pe-gen-card__lastframe-label">末帧（可用于下一镜头 first_frame）</span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="pe-gen-card__actions">
                  <button
                    v-if="getShotStatus(shot.id).status === 'pending' || getShotStatus(shot.id).status === 'failed'"
                    class="pe-btn pe-btn--primary pe-btn--sm"
                    @click="generateShotVideo(shot.id)"
                  >生成视频</button>
                  <button
                    v-if="getShotStatus(shot.id).status === 'succeeded'"
                    class="pe-btn pe-btn--ghost pe-btn--sm"
                    @click="regenerateShotVideo(shot.id)"
                  >重新生成</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ────────────── Step 5: 配音配乐 ────────────── -->
        <div v-else-if="currentStep === 4" key="audio" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">配音配乐</h2>
            <p class="pe-panel__desc">设置配音风格与语速，选择或生成背景音乐，调整混音平衡</p>
          </div>

          <div class="pe-audio-grid">
            <!-- 左列: 配音 -->
            <div class="pe-audio-col">
              <div class="pe-col-card">
                <div class="pe-col-card__head">
                  <span class="pe-col-card__title">配音设置</span>
                </div>

                <div class="pe-field">
                  <label class="pe-field__label">配音风格</label>
                  <div class="pe-chips">
                    <button
                      v-for="v in voiceStyles" :key="v.id"
                      class="pe-chip"
                      :class="{ 'pe-chip--active': selectedVoice === v.id }"
                      @click="selectedVoice = v.id"
                    >{{ v.label }}</button>
                  </div>
                </div>

                <div class="pe-field">
                  <label class="pe-field__label">语速 {{ voiceSpeed.toFixed(1) }}x</label>
                  <div class="pe-slider-row">
                    <span class="pe-slider-row__label">0.8x</span>
                    <input
                      type="range" min="0.8" max="1.5" step="0.1"
                      :value="voiceSpeed"
                      class="pe-range"
                      @input="voiceSpeed = parseFloat(($event.target as HTMLInputElement).value)"
                    />
                    <span class="pe-slider-row__label">1.5x</span>
                  </div>
                </div>

                <!-- 分场景配音预览 -->
                <div class="pe-field">
                  <label class="pe-field__label">分场景配音预览</label>
                  <div class="pe-vo-preview-list">
                    <div v-for="s in scenes" :key="s.id" class="pe-vo-preview">
                      <span class="pe-vo-preview__title">{{ s.title }}</span>
                      <span class="pe-vo-preview__text">{{ s.voiceover || '（无配音文案）' }}</span>
                      <button
                        class="pe-btn pe-btn--sm"
                        :class="{ 'pe-btn--playing': voicePreviewing === s.id }"
                        @click="previewSceneVoiceover(s.id)"
                      >{{ voicePreviewing === s.id ? '播放中...' : '试听' }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右列: 音乐 -->
            <div class="pe-audio-col">
              <div class="pe-col-card">
                <div class="pe-col-card__head">
                  <span class="pe-col-card__title">背景音乐</span>
                </div>

                <div class="pe-field">
                  <label class="pe-field__label">音乐风格（根据品牌调性自动匹配）</label>
                  <div class="pe-chips">
                    <button
                      v-for="v in voiceStyles" :key="v.id"
                      class="pe-chip"
                      :class="{ 'pe-chip--active': musicStyle === v.id }"
                      @click="musicStyle = v.id"
                    >{{ v.label }}</button>
                  </div>
                </div>

                <div class="pe-field">
                  <label class="pe-field__label">音乐音量</label>
                  <div class="pe-slider-row">
                    <VolumeSlider
                      :value="musicVolume"
                      :muted="musicMuted"
                      size="md"
                      :show-label="true"
                      @update:value="(v: number) => musicVolume = v"
                      @update:muted="(v: boolean) => musicMuted = v"
                    />
                  </div>
                </div>

                <div class="pe-field">
                  <button
                    class="pe-btn pe-btn--primary pe-btn--flex"
                    :class="{ 'pe-btn--loading': aiMusicGenerating }"
                    :disabled="aiMusicGenerating"
                    @click="generateAiMusic"
                  >{{ aiMusicGenerating ? `生成中 ${aiMusicProgress}%` : 'AI 生成品牌配乐' }}</button>

                  <div v-if="aiMusicGenerating" class="pe-progress">
                    <div class="pe-progress__fill" :style="{ width: aiMusicProgress + '%' }" />
                  </div>

                  <div v-if="aiMusicGenerated" class="pe-music-result">
                    <span>&#127925;</span>
                    <span class="pe-music-result__name">{{ aiMusicName }}</span>
                  </div>
                </div>

                <!-- 播放器占位 -->
                <div class="pe-music-player-placeholder">
                  <span class="pe-music-player-placeholder__icon">&#9654;</span>
                  <span class="pe-music-player-placeholder__text">音乐预览播放器</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 混音平衡 -->
          <div class="pe-mix">
            <div class="pe-mix__head">
              <span class="pe-mix__title">混音平衡</span>
              <button
                class="pe-btn pe-btn--sm"
                :class="{ 'pe-btn--playing': isMixPlaying }"
                @click="isMixPlaying = !isMixPlaying"
              >{{ isMixPlaying ? '暂停' : '播放' }}</button>
            </div>

            <div class="pe-mix__tracks">
              <div class="pe-mix__track">
                <span class="pe-mix__track-label">配音</span>
                <VolumeSlider
                  :value="voiceoverVolume"
                  :muted="voiceoverMuted"
                  size="md"
                  :show-label="true"
                  @update:value="(v: number) => voiceoverVolume = v"
                  @update:muted="(v: boolean) => voiceoverMuted = v"
                />
              </div>
              <div class="pe-mix__track">
                <span class="pe-mix__track-label">音乐</span>
                <VolumeSlider
                  :value="musicVolume"
                  :muted="musicMuted"
                  size="md"
                  :show-label="true"
                  @update:value="(v: number) => musicVolume = v"
                  @update:muted="(v: boolean) => musicMuted = v"
                />
              </div>
            </div>

            <!-- 波形 -->
            <div class="pe-waveform">
              <div
                v-for="(val, i) in waveformData" :key="i"
                class="pe-waveform__bar"
                :style="{ height: val + '%' }"
                :class="{ 'pe-waveform__bar--active': isMixPlaying }"
              />
            </div>
          </div>
        </div>

        <!-- ────────────── Step 6: 合成导出 ────────────── -->
        <div v-else-if="currentStep === 5" key="export" class="pe-panel">
          <div class="pe-panel__header">
            <h2 class="pe-panel__title">合成导出</h2>
            <p class="pe-panel__desc">预览成片效果，选择导出格式与分辨率</p>
          </div>

          <!-- 预览区 -->
          <div class="pe-export-preview">
            <div class="pe-export-preview__screen">
              <span class="pe-export-preview__icon">&#127916;</span>
              <span v-if="!isPreviewPlaying" class="pe-export-preview__label">宣传片预览</span>
              <span v-else class="pe-export-preview__label pe-export-preview__label--playing">
                播放中 {{ formatTime(previewTime) }} / {{ formatTime(totalDuration) }}
              </span>
            </div>
            <div class="pe-export-preview__controls">
              <button class="pe-btn pe-btn--primary" @click="togglePreview">
                {{ isPreviewPlaying ? '暂停' : '播放' }}
              </button>
              <span class="pe-export-preview__time">{{ formatTime(previewTime) }} / {{ formatTime(totalDuration) }}</span>
            </div>

            <!-- 时间线 -->
            <div class="pe-export-timeline">
              <div
                v-for="shot in shots" :key="shot.id"
                class="pe-export-timeline__seg"
                :style="{ flex: (shot.endTime - shot.startTime) }"
                :class="{ 'pe-export-timeline__seg--ok': getShotStatus(shot.id).status === 'succeeded' }"
              >
                <span class="pe-export-timeline__label">{{ shot.title }}</span>
              </div>
            </div>
          </div>

          <!-- 导出选项 -->
          <div class="pe-export-opts">
            <div class="pe-export-opts__section">
              <label class="pe-field__label">导出格式</label>
              <div class="pe-chips">
                <button
                  v-for="f in ['MP4', 'MOV']" :key="f"
                  class="pe-chip"
                  :class="{ 'pe-chip--active': exportFormat === f }"
                  @click="exportFormat = f"
                >{{ f }}</button>
              </div>
            </div>

            <div class="pe-export-opts__section">
              <label class="pe-field__label">分辨率</label>
              <div class="pe-chips">
                <button
                  v-for="r in ['720p', '1080p', '4K']" :key="r"
                  class="pe-chip"
                  :class="{ 'pe-chip--active': exportResolution === r }"
                  @click="exportResolution = r"
                >{{ r }}</button>
              </div>
            </div>

            <div class="pe-export-opts__section">
              <label class="pe-field__label">画面比例（支持多版本导出）</label>
              <div class="pe-chips">
                <button
                  v-for="ar in aspectOptions" :key="ar"
                  class="pe-chip"
                  :class="{ 'pe-chip--active': exportAspects.includes(ar) }"
                  @click="toggleAspect(ar)"
                >{{ ar }}</button>
              </div>
            </div>

            <div class="pe-export-opts__section">
              <label class="pe-field__label">内容选项</label>
              <div class="pe-checks">
                <label class="pe-check">
                  <input type="checkbox" v-model="includeVoiceover" />
                  <span class="pe-check__box" :class="{ 'pe-check__box--on': includeVoiceover }">
                    <span v-if="includeVoiceover" class="pe-check__tick">&#10003;</span>
                  </span>
                  <span>包含配音</span>
                </label>
                <label class="pe-check">
                  <input type="checkbox" v-model="includeMusic" />
                  <span class="pe-check__box" :class="{ 'pe-check__box--on': includeMusic }">
                    <span v-if="includeMusic" class="pe-check__tick">&#10003;</span>
                  </span>
                  <span>包含配乐</span>
                </label>
                <label class="pe-check">
                  <input type="checkbox" v-model="includeWatermark" />
                  <span class="pe-check__box" :class="{ 'pe-check__box--on': includeWatermark }">
                    <span v-if="includeWatermark" class="pe-check__tick">&#10003;</span>
                  </span>
                  <span>品牌 Logo 水印</span>
                </label>
                <label class="pe-check">
                  <input type="checkbox" v-model="includeSubtitles" />
                  <span class="pe-check__box" :class="{ 'pe-check__box--on': includeSubtitles }">
                    <span v-if="includeSubtitles" class="pe-check__tick">&#10003;</span>
                  </span>
                  <span>字幕</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 导出按钮 -->
          <div class="pe-export-action">
            <button
              v-if="!exportDone"
              class="pe-btn pe-btn--primary pe-btn--lg"
              :disabled="exporting"
              @click="startExport"
            >{{ exporting ? `合成中 ${exportProgress}%` : '合成导出' }}</button>
            
            <template v-else>
              <div class="pe-export-done">
                <span class="pe-export-done__icon">&#10003;</span>
                <span class="pe-export-done__text">导出完成</span>
                <button class="pe-btn pe-btn--primary" @click="downloadExportVideo(0)">下载视频</button>
                <button class="pe-btn pe-btn--ghost" @click="backToEdit">重新编辑</button>
              </div>
            </template>
          </div>

          <div v-if="exporting" class="pe-progress pe-progress--lg">
            <div class="pe-progress__fill" :style="{ width: exportProgress + '%' }" />
          </div>
        </div>

      </Transition>
    </div>

    <!-- ═══════════ 底部导航 ═══════════ -->
    <footer class="pe-footer">
      <div class="pe-footer__left">
        <button v-if="currentStep > 0" class="pe-btn pe-btn--ghost" @click="goPrev">上一步</button>
      </div>
      <div class="pe-footer__center">
        <span class="pe-footer__info">
          步骤 {{ currentStep + 1 }} / {{ STEPS.length }} — {{ STEPS[currentStep]!.label }}
        </span>
      </div>
      <div class="pe-footer__right">
        <button
          v-if="currentStep === 0"
          class="pe-btn pe-btn--primary"
          :disabled="!briefValid"
          @click="goNext"
        >下一步</button>
        <button
          v-else-if="currentStep === 1"
          class="pe-btn pe-btn--primary"
          :disabled="!scriptGenerated"
          @click="goNext"
        >下一步</button>
        <button
          v-else-if="currentStep === 2"
          class="pe-btn pe-btn--primary"
          :disabled="!shots.length"
          @click="goNext"
        >下一步</button>
        <button
          v-else-if="currentStep === 3"
          class="pe-btn pe-btn--primary"
          :disabled="completedShotCount < shots.length"
          @click="goNext"
        >下一步</button>
        <button
          v-else-if="currentStep === 4"
          class="pe-btn pe-btn--primary"
          @click="goNext"
        >下一步</button>
        <button
          v-else
          class="pe-btn pe-btn--primary"
          :disabled="exporting"
          @click="startExport"
        >合成导出</button>
      </div>
    </footer>
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

/* ══════════════════════════════════════════
   Design Tokens
   ══════════════════════════════════════════ */

.pe-root {
  --pe-bg: var(--bg-primary, var(--bg-primary, #0E0F12));
  --pe-surface: var(--bg-secondary, #1A1C21);
  --pe-surface-2: #18181B;
  --pe-surface-3: #1F1F23;
  --pe-text: var(--text-primary, #E8EAED);
  --pe-text-2: var(--text-secondary, #9CA3AF);
  --pe-text-3: var(--text-muted, #64748B);
  --pe-accent: var(--accent, var(--accent, #00BFA5));
  --pe-accent-soft: rgba(0, 212, 170, 0.12);
  --pe-accent-deep: #00B894;
  --pe-border: var(--border, #27272A);
  --pe-border-strong: #3F3F46;
  --pe-success: #34D399;
  --pe-error: #F87171;
  --pe-warn: #FBBF24;
  --pe-gradient: linear-gradient(135deg, var(--accent, var(--accent, #00BFA5)) 0%, #7C3AED 100%);
  --pe-gradient-btn: linear-gradient(135deg, var(--accent, var(--accent, #00BFA5)) 0%, #00B894 100%);
  --pe-radius: 10px;
  --pe-radius-sm: 6px;
  --pe-radius-lg: 14px;

  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 52px);
  background: var(--pe-bg);
  color: var(--pe-text);
  font-family: inherit;
}

/* ══════════════════════════════════════════
   Step Bar
   ══════════════════════════════════════════ */

.pe-stepbar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  gap: 0;
  border-bottom: 1px solid var(--pe-border);
  background: var(--pe-surface);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.pe-stepbar::-webkit-scrollbar { display: none; }

.pe-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0 4px;
}

.pe-step__dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  transition: all 200ms ease;
  flex-shrink: 0;
}

.pe-step--pending .pe-step__dot {
  background: var(--pe-surface-2);
  color: var(--pe-text-3);
  border: 1.5px solid var(--pe-border);
}
.pe-step--active .pe-step__dot {
  background: var(--pe-accent);
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
  border: 1.5px solid var(--pe-accent);
  box-shadow: 0 0 16px rgba(0, 212, 170, 0.35);
}
.pe-step--done .pe-step__dot {
  background: var(--pe-success);
  color: #fff;
  border: 1.5px solid var(--pe-success);
}

.pe-step__check { font-size: 14px; line-height: 1; }
.pe-step__num { line-height: 1; }

.pe-step__label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.pe-step--pending .pe-step__label { color: var(--pe-text-3); }
.pe-step--active .pe-step__label { color: var(--pe-accent); }
.pe-step--done .pe-step__label { color: var(--pe-success); }

.pe-step__line {
  width: 40px;
  height: 2px;
  background: var(--pe-border);
  flex-shrink: 0;
  margin: 0 2px;
  margin-bottom: 20px;
  transition: background 200ms;
}
.pe-step__line--done { background: var(--pe-success); }

/* ══════════════════════════════════════════
   Body & Panel
   ══════════════════════════════════════════ */

.pe-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.pe-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 32px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.pe-panel__header {
  text-align: center;
  margin-bottom: 28px;
  width: 100%;
}

.pe-panel__title {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 6px;
  background: var(--pe-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.pe-panel__desc {
  font-size: 13px;
  color: var(--pe-text-2);
  margin: 0;
}

/* ══════════════════════════════════════════
   Empty / Loading
   ══════════════════════════════════════════ */

.pe-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  width: 100%;
}
.pe-empty__icon { font-size: 56px; opacity: 0.3; }
.pe-empty__text { font-size: 16px; font-weight: 700; color: var(--pe-text-2); }
.pe-empty__hint { font-size: 12px; color: var(--pe-text-3); text-align: center; max-width: 380px; }

.pe-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 48px 20px;
  width: 100%;
  max-width: 400px;
}
.pe-loading__text { font-size: 13px; color: var(--pe-accent); font-weight: 600; }

/* ══════════════════════════════════════════
   Form Elements
   ══════════════════════════════════════════ */

.pe-form {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.pe-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pe-field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--pe-text-2);
  letter-spacing: 0.3px;
}

.pe-field__req { color: var(--pe-error); }

.pe-input {
  padding: 10px 14px;
  border-radius: var(--pe-radius-sm);
  border: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  color: var(--pe-text);
  font-size: 13px;
  outline: none;
  transition: border-color 200ms;
  font-family: inherit;
}
.pe-input:focus { border-color: var(--pe-accent); }

.pe-textarea {
  padding: 10px 14px;
  border-radius: var(--pe-radius-sm);
  border: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  color: var(--pe-text);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 200ms;
  line-height: 1.6;
}
.pe-textarea:focus { border-color: var(--pe-accent); }
.pe-textarea--sm { font-size: 12px; padding: 8px 10px; }
.pe-textarea--xs { font-size: 11px; padding: 6px 8px; line-height: 1.4; }

.pe-select {
  padding: 8px 12px;
  border-radius: var(--pe-radius-sm);
  border: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  color: var(--pe-text);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.pe-select:focus { border-color: var(--pe-accent); }

.pe-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pe-chip {
  padding: 7px 16px;
  border-radius: var(--pe-radius-sm);
  border: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  color: var(--pe-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
  font-family: inherit;
}
.pe-chip:hover { border-color: var(--pe-accent); }
.pe-chip--active {
  border-color: var(--pe-accent);
  background: var(--pe-accent-soft);
  color: var(--pe-accent);
  font-weight: 600;
}

/* Buttons */
.pe-btn {
  padding: 8px 20px;
  border-radius: var(--pe-radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 200ms;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.pe-btn--primary {
  background: var(--pe-gradient-btn);
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
}
.pe-btn--primary:hover { box-shadow: 0 4px 16px rgba(0, 212, 170, 0.3); transform: translateY(-1px); }
.pe-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.pe-btn--ghost {
  background: var(--pe-surface-2);
  color: var(--pe-text-2);
  border: 1px solid var(--pe-border);
}
.pe-btn--ghost:hover { border-color: var(--pe-accent); color: var(--pe-accent); }

.pe-btn--sm { padding: 5px 12px; font-size: 11px; }
.pe-btn--lg { padding: 12px 32px; font-size: 15px; }
.pe-btn--flex { flex: 1; width: 100%; }
.pe-btn--loading {
  background: var(--pe-surface-2);
  color: var(--pe-accent);
  border: 1px solid var(--pe-accent);
}
.pe-btn--playing {
  border-color: var(--pe-success);
  color: var(--pe-success);
  background: rgba(52, 211, 153, 0.08);
}

.pe-btn-icon {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--pe-text-3);
  cursor: pointer;
  border-radius: 4px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
}
.pe-btn-icon:hover { background: var(--pe-surface-3); color: var(--pe-text); }
.pe-btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
.pe-btn-icon--danger:hover { color: var(--pe-error); }

/* Progress bar */
.pe-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--pe-surface-2);
  overflow: hidden;
  width: 100%;
}
.pe-progress--lg { height: 8px; border-radius: 4px; }
.pe-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--pe-gradient-btn);
  transition: width 80ms linear;
}

/* Spinner */
.pe-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--pe-border);
  border-top-color: var(--pe-accent);
  border-radius: 50%;
  animation: pe-spin 0.8s linear infinite;
}
@keyframes pe-spin { to { transform: rotate(360deg); } }

/* Range slider */
.pe-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pe-slider-row__label {
  font-size: 10px;
  color: var(--pe-text-3);
  min-width: 28px;
  text-align: center;
}
.pe-range {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--pe-border);
  border-radius: 2px;
  outline: none;
}
.pe-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--pe-accent);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.pe-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--pe-accent);
  cursor: pointer;
  border: none;
}

/* ══════════════════════════════════════════
   Upload Components
   ══════════════════════════════════════════ */

.pe-upload-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pe-upload-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pe-upload-group__label {
  font-size: 11px;
  color: var(--pe-text-3);
}

.pe-upload-zone {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  border-radius: var(--pe-radius-sm);
  padding: 4px;
  transition: background 160ms, box-shadow 160ms;
}
.pe-upload-zone--sm { gap: 6px; }
.pe-upload-zone--drag {
  background: var(--pe-accent-muted, rgba(0, 191, 165, 0.12));
  box-shadow: 0 0 0 2px var(--pe-accent, #00BFA5);
}
.pe-upload-btn:focus-visible { outline: 2px solid var(--pe-accent, #00BFA5); outline-offset: 2px; }

.pe-upload-thumb {
  width: 72px;
  height: 72px;
  border-radius: var(--pe-radius-sm);
  border: 1px solid var(--pe-border);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}
.pe-upload-thumb--sm { width: 56px; height: 56px; }
.pe-upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pe-upload-thumb__rm {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pe-upload-btn {
  width: 72px;
  height: 72px;
  border-radius: var(--pe-radius-sm);
  border: 1.5px dashed var(--pe-border);
  background: var(--pe-surface-2);
  color: var(--pe-text-3);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  text-align: center;
  flex-shrink: 0;
}
.pe-upload-btn:hover { border-color: var(--pe-accent); color: var(--pe-accent); }
.pe-upload-btn--sm { width: 56px; height: 56px; font-size: 10px; }

/* ══════════════════════════════════════════
   Step 2: Script Editor
   ══════════════════════════════════════════ */

.pe-script {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pe-script__toolbar {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Timeline bar */
.pe-timeline-bar {
  display: flex;
  width: 100%;
  border-radius: var(--pe-radius-sm);
  overflow: hidden;
  border: 1px solid var(--pe-border);
  height: 48px;
}

.pe-timeline-bar__seg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-right: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  transition: background 150ms;
  min-width: 0;
  padding: 4px 6px;
}
.pe-timeline-bar__seg:last-child { border-right: none; }
.pe-timeline-bar__seg:hover { background: var(--pe-surface-3); }

.pe-timeline-bar__label {
  font-size: 10px;
  font-weight: 600;
  color: var(--pe-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.pe-timeline-bar__time {
  font-size: 9px;
  color: var(--pe-text-3);
  font-variant-numeric: tabular-nums;
}

/* Scene list */
.pe-scene-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.pe-scene-card {
  border-radius: var(--pe-radius);
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  overflow: hidden;
}

.pe-scene-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
}

.pe-scene-card__badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--pe-accent);
  background: var(--pe-accent-soft);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.pe-scene-card__title-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pe-text);
  font-size: 13px;
  font-weight: 600;
  border-radius: 4px;
  outline: none;
  font-family: inherit;
  min-width: 0;
}
.pe-scene-card__title-input:focus { border-color: var(--pe-accent); background: var(--pe-surface-2); }

.pe-scene-card__time {
  font-size: 11px;
  color: var(--pe-text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pe-scene-card__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.pe-scene-card__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
}

.pe-scene-card__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* CRAFT preview */
.pe-craft-preview {
  padding: 10px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-2);
  border: 1px solid var(--pe-border);
  font-size: 11px;
  color: var(--pe-text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}

/* ══════════════════════════════════════════
   Step 3: Shot List
   ══════════════════════════════════════════ */

.pe-shot-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.pe-shot-card {
  border-radius: var(--pe-radius);
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  overflow: hidden;
}

.pe-shot-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
}

.pe-shot-card__badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--pe-text);
}

.pe-shot-card__time {
  font-size: 11px;
  color: var(--pe-accent);
  background: var(--pe-accent-soft);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pe-shot-card__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
}

.pe-shot-card__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pe-craft-ref-readonly {
  padding: 8px 10px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-2);
  border: 1px solid var(--pe-border);
  font-size: 11px;
  color: var(--pe-text-3);
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}

/* ══════════════════════════════════════════
   Step 4: Per-shot Generation
   ══════════════════════════════════════════ */

.pe-gen-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.pe-gen-progress__info {
  font-size: 13px;
  font-weight: 600;
  color: var(--pe-text-2);
}

.pe-gen-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.pe-gen-card {
  border-radius: var(--pe-radius);
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  overflow: hidden;
}

.pe-gen-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
}

.pe-gen-card__badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--pe-text);
}

.pe-gen-card__time {
  font-size: 11px;
  color: var(--pe-text-3);
  font-variant-numeric: tabular-nums;
}

.pe-gen-card__status {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.pe-gen-card__status--pending { color: var(--pe-text-3); background: var(--pe-surface-3); }
.pe-gen-card__status--queued { color: var(--pe-warn); background: rgba(251, 191, 36, 0.1); }
.pe-gen-card__status--running { color: var(--pe-accent); background: var(--pe-accent-soft); }
.pe-gen-card__status--succeeded { color: var(--pe-success); background: rgba(52, 211, 153, 0.1); }
.pe-gen-card__status--failed { color: var(--pe-error); background: rgba(248, 113, 113, 0.1); }

.pe-gen-card__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pe-gen-card__craft {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pe-gen-card__craft-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--pe-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pe-gen-card__craft-text {
  font-size: 11px;
  color: var(--pe-text-2);
  line-height: 1.5;
  margin: 0;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}

.pe-gen-card__refs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pe-gen-card__ref-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--pe-border);
}

.pe-gen-card__preview {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.pe-gen-card__preview-placeholder {
  width: 160px;
  height: 90px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-2);
  border: 1px solid var(--pe-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 20px;
  color: var(--pe-text-3);
  flex-shrink: 0;
}
.pe-gen-card__preview-label { font-size: 10px; }

.pe-gen-card__lastframe {
  flex: 1;
  height: 90px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-3);
  border: 1px dashed var(--pe-border);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}
.pe-gen-card__lastframe-label {
  font-size: 11px;
  color: var(--pe-text-3);
  text-align: center;
}

.pe-gen-card__actions {
  display: flex;
  gap: 8px;
}

/* ══════════════════════════════════════════
   Step 5: Audio
   ══════════════════════════════════════════ */

.pe-audio-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

.pe-audio-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pe-col-card {
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  border-radius: var(--pe-radius-lg);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.pe-col-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--pe-border);
}
.pe-col-card__title { font-size: 14px; font-weight: 700; color: var(--pe-text); }

/* Voiceover preview list */
.pe-vo-preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.pe-vo-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-2);
  border: 1px solid var(--pe-border);
}

.pe-vo-preview__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--pe-accent);
  white-space: nowrap;
  flex-shrink: 0;
}

.pe-vo-preview__text {
  font-size: 11px;
  color: var(--pe-text-2);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Music result */
.pe-music-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-accent-soft);
  border: 1px solid rgba(0, 212, 170, 0.2);
}
.pe-music-result__name { font-size: 12px; font-weight: 600; color: var(--pe-accent); }

/* Music player placeholder */
.pe-music-player-placeholder {
  width: 100%;
  height: 56px;
  border-radius: var(--pe-radius-sm);
  background: var(--pe-surface-2);
  border: 1px solid var(--pe-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--pe-text-3);
  font-size: 12px;
}
.pe-music-player-placeholder__icon { font-size: 18px; }

/* Mix section */
.pe-mix {
  width: 100%;
  margin-top: 20px;
  padding: 18px;
  border-radius: var(--pe-radius);
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
}

.pe-mix__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.pe-mix__title { font-size: 14px; font-weight: 700; color: var(--pe-text); }

.pe-mix__tracks {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.pe-mix__track {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pe-mix__track-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--pe-text-2);
  white-space: nowrap;
}

/* Waveform */
.pe-waveform {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 48px;
  padding: 4px 0;
}
.pe-waveform__bar {
  flex: 1;
  background: var(--pe-border-strong);
  border-radius: 1px 1px 0 0;
  min-height: 4px;
  transition: height 120ms ease;
}
.pe-waveform__bar--active {
  background: var(--pe-accent);
  opacity: 0.8;
}

/* ══════════════════════════════════════════
   Step 6: Export
   ══════════════════════════════════════════ */

.pe-export-preview {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.pe-export-preview__screen {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--pe-radius-lg);
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.pe-export-preview__icon { font-size: 56px; opacity: 0.3; }
.pe-export-preview__label { font-size: 13px; color: var(--pe-text-2); }
.pe-export-preview__label--playing { color: var(--pe-accent); font-weight: 600; }

.pe-export-preview__controls {
  display: flex;
  align-items: center;
  gap: 14px;
}
.pe-export-preview__time {
  font-size: 13px;
  color: var(--pe-text-2);
  font-variant-numeric: tabular-nums;
}

/* Export timeline */
.pe-export-timeline {
  display: flex;
  width: 100%;
  border-radius: var(--pe-radius-sm);
  overflow: hidden;
  border: 1px solid var(--pe-border);
  height: 32px;
}
.pe-export-timeline__seg {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--pe-border);
  background: var(--pe-surface-2);
  padding: 0 6px;
  min-width: 0;
}
.pe-export-timeline__seg:last-child { border-right: none; }
.pe-export-timeline__seg--ok { background: var(--pe-accent-soft); }
.pe-export-timeline__label {
  font-size: 9px;
  font-weight: 600;
  color: var(--pe-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Export options */
.pe-export-opts {
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pe-export-opts__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pe-checks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pe-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--pe-text);
}
.pe-check input { display: none; }
.pe-check__box {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1.5px solid var(--pe-border);
  background: var(--pe-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
  flex-shrink: 0;
}
.pe-check__box--on {
  border-color: var(--pe-accent);
  background: var(--pe-accent);
}
.pe-check__tick {
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
  font-size: 12px;
  font-weight: 700;
}

.pe-export-action {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  width: 100%;
}

.pe-export-done {
  display: flex;
  align-items: center;
  gap: 14px;
}
.pe-export-done__icon {
  font-size: 20px;
  font-weight: 700;
  color: var(--pe-success);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(52, 211, 153, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pe-export-done__text {
  font-size: 16px;
  font-weight: 700;
  color: var(--pe-success);
}

/* ══════════════════════════════════════════
   Footer
   ══════════════════════════════════════════ */

.pe-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--pe-border);
  background: var(--pe-surface);
  flex-shrink: 0;
}
.pe-footer__left,
.pe-footer__right { flex-shrink: 0; min-width: 100px; }
.pe-footer__right { text-align: right; }
.pe-footer__center { flex: 1; text-align: center; }
.pe-footer__info { font-size: 12px; color: var(--pe-text-2); }

/* ══════════════════════════════════════════
   Transitions
   ══════════════════════════════════════════ */

.pe-fade-enter-active,
.pe-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.pe-fade-enter-from { opacity: 0; transform: translateX(16px); }
.pe-fade-leave-to { opacity: 0; transform: translateX(-16px); }

/* ══════════════════════════════════════════
   Responsive
   ══════════════════════════════════════════ */

@media (max-width: 900px) {
  .pe-audio-grid { grid-template-columns: 1fr; }
  .pe-scene-card__body { grid-template-columns: 1fr; }
  .pe-shot-card__body { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .pe-stepbar { padding: 10px 12px; }
  .pe-step__label { display: none; }
  .pe-step__line { width: 20px; }
  .pe-panel { padding: 20px 16px; }
  .pe-scene-card__body { grid-template-columns: 1fr; }
  .pe-shot-card__body { grid-template-columns: 1fr; }
  .pe-mix__tracks { flex-direction: column; align-items: stretch; }
  .pe-gen-card__preview { flex-direction: column; }
}

/* ===== ENH-6: 目标受众细化 ===== */
.pe-sub-audience {
  margin-top: 10px;
  padding: 12px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
}

.pe-sub-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.pe-sub-chip {
  padding: 4px 12px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 14px;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms ease;
}

.pe-sub-chip:hover {
  border-color: var(--accent, #6366f1);
  color: var(--text-primary, #f1f5f9);
}

.pe-sub-chip--active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

.pe-selected-subs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.pe-selected-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent, #6366f1);
  border-radius: 14px;
  font-size: 11px;
  font-weight: 500;
}

.pe-selected-sub button {
  background: transparent;
  border: none;
  color: var(--accent, #6366f1);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  opacity: 0.6;
}

.pe-selected-sub button:hover {
  opacity: 1;
}

.pe-custom-audience {
  display: flex;
  gap: 6px;
}

.pe-custom-input {
  flex: 1;
  padding: 5px 10px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 8px;
  color: var(--text-primary, #f1f5f9);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

.pe-custom-input:focus {
  border-color: var(--accent, #6366f1);
}

.pe-custom-add {
  padding: 5px 10px;
  background: var(--accent, #6366f1);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.pe-custom-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== ENH-14: 参考视频输入 ===== */
.pe-section--ref { margin-top: 16px; }
.pe-ref-input { padding: 12px 0; display: flex; flex-direction: column; gap: 10px; }
.pe-ref-input__hint { font-size: 12px; color: var(--text-secondary, var(--text-secondary, #9CA3AF)); margin: 0; }
.pe-ref-input__upload { }
.pe-ref-input__label {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 20px; border: 2px dashed var(--border-default, var(--border, #2E3139));
  border-radius: 10px; cursor: pointer;
  transition: border-color 150ms ease;
}
.pe-ref-input__label:hover { border-color: var(--accent, var(--accent, #00BFA5)); }
.pe-ref-input__icon { font-size: 28px; }
.pe-ref-input__text { font-size: 13px; font-weight: 600; }
.pe-ref-input__meta { font-size: 11px; color: var(--text-muted, var(--text-muted, #64748B)); }
.pe-ref-input__preview { display: flex; flex-direction: column; gap: 8px; }
.pe-ref-input__video { width: 100%; max-height: 180px; border-radius: 8px; background: #000; }
.pe-ref-input__clear {
  padding: 6px 12px; border: 1px solid #EF4444; background: rgba(239,68,68,0.1);
  color: #EF4444; font-size: 12px; font-weight: 600; border-radius: 6px;
  cursor: pointer; align-self: flex-start; font-family: inherit;
}
.pe-ref-input__divider {
  display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--text-muted);
}
.pe-ref-input__divider::before, .pe-ref-input__divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border-subtle, #1E1E22);
}

/* ===== ENH-15: 字幕样式选择器 ===== */
.pe-section--subtitle { margin-top: 16px; }
.pe-subtitle-styles { display: flex; flex-direction: column; gap: 12px; padding: 12px 0; }
.pe-subtitle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pe-subtitle-card {
  padding: 8px; border: 2px solid var(--border-default, var(--border, #2E3139));
  border-radius: 8px; cursor: pointer; transition: all 150ms ease;
  text-align: center;
}
.pe-subtitle-card:hover { border-color: var(--accent, var(--accent, #00BFA5)); }
.pe-subtitle-card--active { border-color: var(--accent, var(--accent, #00BFA5)); background: rgba(0,191,165,0.06); }
.pe-subtitle-card__preview { padding: 8px 4px; border-radius: 4px; font-size: 12px; margin-bottom: 4px; }
.pe-subtitle-card__name { font-size: 11px; font-weight: 600; }
.pe-subtitle-live {
  padding: 10px; background: #000; border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.pe-subtitle-live__label { font-size: 11px; color: var(--text-muted, var(--text-muted, #64748B)); }
.pe-subtitle-live__stage { min-height: 40px; display: flex; align-items: center; justify-content: center; }
.pe-subtitle-live__text { padding: 6px 16px; border-radius: 4px; }
@media (max-width: 768px) {
  .pe-subtitle-grid { grid-template-columns: repeat(2, 1fr); }
}

</style>
