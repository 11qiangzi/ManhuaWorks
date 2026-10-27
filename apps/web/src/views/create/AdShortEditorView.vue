<script setup lang="ts">
/**
 * AdShortEditorView.vue — 短视频生成器（Short Video Generator）
 * 千机工坊 · 6 步短视频广告创作流水线
 *
 * Step 1: 选择平台 + 品类
 * Step 2: 上传产品素材
 * Step 3: AI生成脚本（分镜式）
 * Step 4: 逐镜头生成视频
 * Step 5: 配乐 + 字幕
 * Step 6: 多版本导出
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { type CameraMovement } from '@/api/craft-prompt'
import { assetService } from '@/api/asset-service-v2'
import { generateText, generateVideo } from '@/api/ai-router'
import { useFileDrop } from '../../composables/useFileDrop'

/* ── Mock CAMERA_MOVEMENTS (from shared-types / craft-prompt API) ── */
const CAMERA_MOVEMENTS: CameraMovement[] = [
  { id: 'push_in', nameZh: '推进', nameEn: 'Dolly In', description: '镜头向主体靠近', promptTemplate: 'slow dolly push-in, getting closer to the subject' },
  { id: 'pull_out', nameZh: '拉远', nameEn: 'Dolly Out', description: '镜头远离主体', promptTemplate: 'slow dolly pull-out, revealing the wider scene' },
  { id: 'orbit', nameZh: '环绕', nameEn: 'Orbit', description: '镜头围绕主体旋转', promptTemplate: 'slow 180-degree orbit around the subject' },
  { id: 'tracking', nameZh: '跟拍', nameEn: 'Tracking Shot', description: '镜头跟随运动主体', promptTemplate: 'tracking shot following the subject from behind' },
  { id: 'zoom_in', nameZh: '特写', nameEn: 'Zoom In', description: '镜头变焦推近', promptTemplate: 'slow optical zoom in, compressing the background' },
  { id: 'static', nameZh: '固定', nameEn: 'Static', description: '固定机位不动', promptTemplate: 'locked-off static shot, no camera movement' },
  { id: 'tilt_up', nameZh: '上摇', nameEn: 'Tilt Up', description: '镜头垂直向上', promptTemplate: 'slow tilt up, revealing the height' },
  { id: 'pan_left', nameZh: '左摇', nameEn: 'Pan Left', description: '镜头水平向左移动', promptTemplate: 'smooth pan left, following the action' },
  { id: 'pan_right', nameZh: '右摇', nameEn: 'Pan Right', description: '镜头水平向右移动', promptTemplate: 'smooth pan right, revealing new elements' },
  { id: 'crane_up', nameZh: '升降', nameEn: 'Crane Up', description: '镜头升起', promptTemplate: 'crane shot rising from ground level to overhead' },
  { id: 'handheld', nameZh: '手持', nameEn: 'Handheld', description: '手持摄影的轻微晃动', promptTemplate: 'subtle handheld movement, documentary feel' },
  { id: 'tilt_down', nameZh: '下摇', nameEn: 'Tilt Down', description: '镜头垂直向下', promptTemplate: 'slow tilt down, grounding the scene' },
]

/* ══════════════════════════════════════════════════════════════════
 *  Step management
 * ══════════════════════════════════════════════════════════════════ */
const currentStep = ref(0)
const steps = [
  { label: '选择平台 + 品类', icon: '📱' },
  { label: '上传产品素材', icon: '📦' },
  { label: 'AI生成脚本', icon: '🎬' },
  { label: '逐镜头生成', icon: '🎥' },
  { label: '配乐 + 字幕', icon: '🎵' },
  { label: '多版本导出', icon: '📤' },
]

const hasStarted = ref(true)

function goToStep(idx: number) {
  if (idx >= 0 && idx < steps.length) currentStep.value = idx
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ① 选择平台 + 品类
 * ══════════════════════════════════════════════════════════════════ */
type PlatformKey = 'douyin' | 'xiaohongshu' | 'bilibili' | 'kuaishou' | 'taobao'

interface Platform {
  key: PlatformKey
  name: string
  ratio: string
  ratioLabel: string
  resolution: string
  aspectW: number
  aspectH: number
}

const platforms: Platform[] = [
  { key: 'douyin', name: '抖音', ratio: '9:16', ratioLabel: '竖版', resolution: '1080x1920', aspectW: 9, aspectH: 16 },
  { key: 'xiaohongshu', name: '小红书', ratio: '3:4', ratioLabel: '3:4', resolution: '1080x1440', aspectW: 3, aspectH: 4 },
  { key: 'bilibili', name: 'B站', ratio: '16:9', ratioLabel: '横版', resolution: '1920x1080', aspectW: 16, aspectH: 9 },
  { key: 'kuaishou', name: '快手', ratio: '9:16', ratioLabel: '竖版', resolution: '1080x1920', aspectW: 9, aspectH: 16 },
  { key: 'taobao', name: '淘宝', ratio: '1:1', ratioLabel: '方图', resolution: '1080x1080', aspectW: 1, aspectH: 1 },
]

const selectedPlatform = ref<PlatformKey>('douyin')
const activePlatform = computed(() => platforms.find(p => p.key === selectedPlatform.value)!)

type CategoryKey = 'beauty' | 'digital' | 'food' | 'fashion' | 'daily' | 'home' | 'baby' | 'sports' | 'pets'

interface Category {
  key: CategoryKey
  name: string
  icon: string
  color: string
  musicStyle: string
  visualTone: string
}

const categories: Category[] = [
  { key: 'beauty', name: '美妆', icon: '💄', color: '#E879A0', musicStyle: '轻快电子/舒缓氛围', visualTone: '柔光/高级感' },
  { key: 'digital', name: '数码', icon: '📱', color: '#60A5FA', musicStyle: '科技感Upbeat/极简节奏', visualTone: '科技感/极简' },
  { key: 'food', name: '食品', icon: '🍜', color: '#FB923C', musicStyle: '温暖民谣/治愈钢琴', visualTone: '暖色调/治愈' },
  { key: 'fashion', name: '服饰', icon: '👗', color: '#A78BFA', musicStyle: '时尚Trap/轻R&B', visualTone: '时尚/街拍' },
  { key: 'daily', name: '日用', icon: '🧴', color: '#34D399', musicStyle: '温馨日常/轻快Bossa', visualTone: '清新/生活' },
  { key: 'home', name: '家居', icon: '🏠', color: '#F472B6', musicStyle: '舒缓爵士/温暖弦乐', visualTone: '温馨/质感' },
  { key: 'baby', name: '母婴', icon: '👶', color: '#FBBF24', musicStyle: '轻柔童谣/甜美钢琴', visualTone: '柔和/可爱' },
  { key: 'sports', name: '运动', icon: '⚽', color: '#38BDF8', musicStyle: '热血摇滚/电子舞曲', visualTone: '动感/活力' },
  { key: 'pets', name: '宠物', icon: '🐾', color: '#A3E635', musicStyle: '俏皮尤克里里/轻快口哨', visualTone: '萌系/活泼' },
]

const selectedCategory = ref<CategoryKey | null>(null)
const activeCategory = computed(() => categories.find(c => c.key === selectedCategory.value))

/* ══════════════════════════════════════════════════════════════════
 *  Step ② 上传产品素材
 * ══════════════════════════════════════════════════════════════════ */
interface ProductImage {
  id: string
  name: string
  size: string
  color: string
  previewUrl?: string
  file?: File
}

const productImages = ref<ProductImage[]>([])

const productInfo = reactive({
  name: '',
  sellingPoints: ['', '', ''],
})

let imgCounter = 0
const imageColors = ['#60A5FA', '#A78BFA', '#E879A0', '#34D399', '#FB923C', '#FBBF24', '#38BDF8', '#F472B6', '#A3E635']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function addImageFile(file: File) {
  if (productImages.value.length >= 9) return
  if (!file.type.startsWith('image/')) return
  imgCounter++
  const color = imageColors[(imgCounter - 1) % imageColors.length]
  const img: ProductImage = {
    id: `img-${imgCounter}`,
    name: file.name,
    size: formatFileSize(file.size),
    color,
    previewUrl: URL.createObjectURL(file),
    file,
  }
  productImages.value.push(img)
  // 异步上传到 asset-service
  assetService.upload(file, { kind: 'image' }).then(asset => {
    img.previewUrl = asset.url
  }).catch(() => {})
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  for (const f of input.files) {
    addImageFile(f)
  }
  input.value = ''
}

function removeImage(id: string) {
  productImages.value = productImages.value.filter(img => img.id !== id)
}

const { isDragging, onDragEnter: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop } = useFileDrop((files) => {
  for (const f of files) {
    addImageFile(f)
  }
})

const canProceedStep2 = computed(() => productImages.value.length >= 1 && productInfo.name.trim() !== '')

/* ══════════════════════════════════════════════════════════════════
 *  Step ③ AI生成脚本（分镜式）
 * ══════════════════════════════════════════════════════════════════ */
interface Shot {
  id: string
  number: number
  duration: number
  craftPrompt: string
  voiceover: string
  cameraMovementId: string
  musicTags: string[]
}

const shots = ref<Shot[]>([])
const isGeneratingScript = ref(false)
const scriptGenerated = ref(false)

const productShowcaseMovements = computed(() => {
  const preferred = ['orbit', 'push_in', 'zoom_in', 'tracking', 'static']
  return CAMERA_MOVEMENTS.filter(m => preferred.includes(m.id))
})

/* ── AI 生成脚本（真实 API 调用） ── */
async function mockGenerateScript() {
  isGeneratingScript.value = true

  try {
    const cat = activeCategory.value
    const plat = activePlatform.value
    const pName = productInfo.name || '产品'
    const sp = productInfo.sellingPoints.filter(s => s.trim())

    const systemPrompt = `你是一位专业的短视频广告分镜脚本编剧。
请根据以下产品信息，生成一个 ${plat.ratio} ${plat.ratioLabel} 格式、${cat?.name || '通用'}品类广告的分镜脚本。
视觉风格: ${cat?.visualTone || '高级感'}
音乐风格参考: ${cat?.musicStyle || '轻快流行'}

请严格以 JSON 数组格式返回，每个元素代表一个镜头，包含以下字段:
- duration: 秒数 (整数)
- movement: 镜头运动方式，从以下选项中选一个: push_in, pull_out, orbit, tracking, zoom_in, static, tilt_up, pan_left, pan_right, crane_up, handheld, tilt_down
- sceneDesc: 场景描述（简短中文）
- voiceover: 旁白/配音文案
- craftPrompt: 用于 AI 视频生成的英文提示词（描述画面内容、镜头运动、光线、风格等）
- musicTags: 音乐标签数组（2-3个中文标签）

总共生成 5 个镜头：开场特写、环绕展示、卖点展示、场景演示、品牌收尾+CTA。
仅返回 JSON 数组，不要其他说明文字。`

    const userPrompt = `产品名称: ${pName}
卖点: ${sp.length > 0 ? sp.join('；') : '高品质产品'}
品类: ${cat?.name || '通用'}
平台: ${plat.name} (${plat.ratio})
请生成分镜脚本。`

    const responseText = await generateText({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 4096,
    })

    // 从响应中提取 JSON 数组
    let shotData: any[]
    try {
      // 尝试直接解析
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('未能从响应中提取 JSON 数组')
      shotData = JSON.parse(jsonMatch[0])
    } catch {
      // 回退：使用默认模板
      shotData = [
        { duration: 5, movement: 'zoom_in', sceneDesc: '产品特写开场', voiceover: `${pName}来了！`, craftPrompt: `Close-up zoom-in shot of ${pName}, product showcase, studio lighting`, musicTags: (cat?.musicStyle || '轻快,流行').split(/[\/,]/) },
        { duration: 8, movement: 'orbit', sceneDesc: '360度环绕展示', voiceover: `来看看${pName}`, craftPrompt: `360-degree orbit shot around ${pName}, product on display, cinematic`, musicTags: (cat?.musicStyle || '轻快,流行').split(/[\/,]/) },
        { duration: 10, movement: 'push_in', sceneDesc: '产品卖点展示', voiceover: sp[0] || `${pName}，品质之选`, craftPrompt: `Slow push-in on ${pName} highlighting key features, soft bokeh background`, musicTags: (cat?.musicStyle || '轻快,流行').split(/[\/,]/) },
        { duration: 8, movement: 'tracking', sceneDesc: '使用场景演示', voiceover: sp[1] || '让你爱不释手', craftPrompt: `Tracking shot showing ${pName} in real-life usage scenario, natural lighting`, musicTags: (cat?.musicStyle || '轻快,流行').split(/[\/,]/) },
        { duration: 5, movement: 'static', sceneDesc: '品牌收尾 + CTA', voiceover: '点击链接，限时优惠中！', craftPrompt: `Static branded outro frame with ${pName}, call-to-action overlay`, musicTags: (cat?.musicStyle || '轻快,流行').split(/[\/,]/) },
      ]
    }

    shots.value = shotData.map((tpl: any, i: number) => {
      const movement = CAMERA_MOVEMENTS.find(m => m.id === tpl.movement)
      return {
        id: `shot-${i + 1}`,
        number: i + 1,
        duration: tpl.duration ?? 5,
        craftPrompt: tpl.craftPrompt || `[Action] ${tpl.sceneDesc}: ${pName}居中展示\n[Framing] ${movement?.promptTemplate || 'medium shot'}, product showcase`,
        voiceover: tpl.voiceover || `${pName}，品质之选`,
        cameraMovementId: tpl.movement || 'static',
        musicTags: Array.isArray(tpl.musicTags) ? tpl.musicTags : (cat?.musicStyle || '轻快,流行').split(/[\/,]/).map((t: string) => t.trim()),
      }
    })

    scriptGenerated.value = true
  } catch (err) {
    console.error('[AdShortEditor] 脚本生成失败:', err)
  } finally {
    isGeneratingScript.value = false
  }
}

function updateShotField(shotId: string, field: keyof Shot, value: any) {
  const shot = shots.value.find(s => s.id === shotId)
  if (shot) (shot as any)[field] = value
}

function getMovementName(id: string): string {
  return CAMERA_MOVEMENTS.find(m => m.id === id)?.nameZh || id
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ④ 逐镜头生成视频
 * ══════════════════════════════════════════════════════════════════ */
interface ShotGeneration {
  shotId: string
  status: 'pending' | 'generating' | 'done' | 'error'
  progress: number
  previewUrl: string | null
}

const shotGenerations = ref<ShotGeneration[]>([])
const overallProgress = computed(() => {
  if (shotGenerations.value.length === 0) return 0
  const total = shotGenerations.value.reduce((sum, sg) => sum + sg.progress, 0)
  return Math.round(total / shotGenerations.value.length)
})
const allShotsDone = computed(() => shotGenerations.value.length > 0 && shotGenerations.value.every(sg => sg.status === 'done'))

function initShotGenerations() {
  shotGenerations.value = shots.value.map(s => ({
    shotId: s.id,
    status: 'pending',
    progress: 0,
    previewUrl: null,
  }))
}

/* ── AI 生成单个镜头视频（真实 API 调用） ── */
async function generateShot(shotId: string) {
  const sg = shotGenerations.value.find(s => s.shotId === shotId)
  if (!sg || sg.status === 'generating') return

  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return

  sg.status = 'generating'
  sg.progress = 10

  try {
    const plat = activePlatform.value
    sg.progress = 25

    const videoUrl = (await generateVideo({
      prompt: shot.craftPrompt,
      durationSeconds: shot.duration,
      resolution: plat.resolution === '1080x1920' ? '720p' : '1080p',
      referenceImages: productImages.value
        .filter(img => img.previewUrl)
        .map(img => img.previewUrl!)
        .slice(0, 1),
    })).url

    sg.progress = 100
    sg.status = 'done'
    sg.previewUrl = videoUrl
  } catch (err) {
    console.error(`[AdShortEditor] 镜头 ${shotId} 生成失败:`, err)
    sg.status = 'error'
    sg.progress = 0
  }
}

function generateAllShots() {
  initShotGenerations()
  shots.value.forEach((s, i) => {
    setTimeout(() => {
      generateShot(s.id).catch((err) => {
        console.error(`[AdShortEditor] 批量生成镜头 ${s.id} 失败:`, err)
      })
    }, i * 1000)
  })
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ⑤ 配乐 + 字幕
 * ══════════════════════════════════════════════════════════════════ */
interface MusicTrack {
  id: string
  title: string
  genre: string
  bpm: number
  duration: string
  bars: number[]
  color: string
}

const categoryMusicMap: Record<string, { styles: string[]; tracks: MusicTrack[] }> = {
  beauty: {
    styles: ['轻快电子', '舒缓氛围'],
    tracks: [
      { id: 'm-beauty-1', title: '樱花物语', genre: '轻快电子', bpm: 118, duration: '0:35', bars: [6, 8, 5, 9, 7, 4, 8, 6, 5, 7, 9, 6, 8, 5, 7, 6], color: '#E879A0' },
      { id: 'm-beauty-2', title: '柔光漫步', genre: '舒缓氛围', bpm: 88, duration: '0:32', bars: [4, 5, 6, 3, 7, 5, 4, 6, 5, 4, 3, 6, 5, 7, 4, 5], color: '#F9A8D4' },
    ],
  },
  digital: {
    styles: ['科技感Upbeat', '极简节奏'],
    tracks: [
      { id: 'm-digi-1', title: '量子脉冲', genre: '科技感Upbeat', bpm: 130, duration: '0:30', bars: [9, 7, 8, 6, 9, 8, 7, 5, 8, 9, 7, 6, 8, 9, 7, 8], color: '#60A5FA' },
      { id: 'm-digi-2', title: '极简空间', genre: '极简节奏', bpm: 100, duration: '0:28', bars: [5, 4, 5, 6, 4, 5, 3, 6, 5, 4, 6, 5, 4, 5, 6, 4], color: '#93C5FD' },
    ],
  },
  food: {
    styles: ['温暖民谣', '治愈钢琴'],
    tracks: [
      { id: 'm-food-1', title: '阳光厨房', genre: '温暖民谣', bpm: 82, duration: '0:34', bars: [4, 6, 5, 7, 4, 6, 8, 5, 4, 7, 6, 5, 4, 6, 5, 7], color: '#FB923C' },
      { id: 'm-food-2', title: '午后甜点', genre: '治愈钢琴', bpm: 72, duration: '0:30', bars: [3, 5, 4, 6, 5, 3, 7, 4, 5, 6, 4, 3, 5, 6, 4, 5], color: '#FDBA74' },
    ],
  },
  fashion: {
    styles: ['时尚Trap', '轻R&B'],
    tracks: [
      { id: 'm-fash-1', title: 'T台节拍', genre: '时尚Trap', bpm: 138, duration: '0:28', bars: [8, 9, 7, 8, 9, 6, 8, 7, 9, 8, 7, 6, 9, 8, 7, 8], color: '#A78BFA' },
      { id: 'm-fash-2', title: '街头韵律', genre: '轻R&B', bpm: 95, duration: '0:32', bars: [5, 6, 4, 7, 5, 6, 4, 5, 7, 6, 5, 4, 6, 7, 5, 6], color: '#C4B5FD' },
    ],
  },
  daily: {
    styles: ['温馨日常', '轻快Bossa'],
    tracks: [
      { id: 'm-daily-1', title: '清晨微风', genre: '温馨日常', bpm: 100, duration: '0:30', bars: [5, 6, 4, 7, 5, 6, 7, 4, 5, 6, 4, 7, 5, 6, 7, 5], color: '#34D399' },
      { id: 'm-daily-2', title: '阳光Bossa', genre: '轻快Bossa', bpm: 112, duration: '0:28', bars: [6, 5, 7, 4, 6, 5, 7, 6, 4, 5, 7, 6, 5, 4, 6, 7], color: '#6EE7B7' },
    ],
  },
  home: {
    styles: ['舒缓爵士', '温暖弦乐'],
    tracks: [
      { id: 'm-home-1', title: '家的温度', genre: '舒缓爵士', bpm: 90, duration: '0:32', bars: [4, 5, 6, 5, 7, 4, 6, 5, 4, 7, 5, 6, 4, 5, 6, 4], color: '#F472B6' },
      { id: 'm-home-2', title: '温馨角落', genre: '温暖弦乐', bpm: 78, duration: '0:30', bars: [3, 5, 4, 6, 5, 4, 3, 6, 5, 4, 6, 5, 3, 4, 5, 6], color: '#F9A8D4' },
    ],
  },
  baby: {
    styles: ['轻柔童谣', '甜美钢琴'],
    tracks: [
      { id: 'm-baby-1', title: '星星摇篮曲', genre: '轻柔童谣', bpm: 76, duration: '0:30', bars: [3, 4, 5, 4, 6, 5, 4, 3, 5, 4, 6, 5, 4, 3, 5, 4], color: '#FBBF24' },
      { id: 'm-baby-2', title: '童年旋律', genre: '甜美钢琴', bpm: 84, duration: '0:28', bars: [4, 5, 3, 6, 5, 4, 5, 3, 6, 4, 5, 3, 4, 6, 5, 4], color: '#FDE68A' },
    ],
  },
  sports: {
    styles: ['热血摇滚', '电子舞曲'],
    tracks: [
      { id: 'm-sport-1', title: '极限冲刺', genre: '热血摇滚', bpm: 150, duration: '0:26', bars: [9, 8, 9, 7, 8, 9, 8, 7, 9, 8, 7, 9, 8, 9, 7, 8], color: '#38BDF8' },
      { id: 'm-sport-2', title: '能量爆发', genre: '电子舞曲', bpm: 140, duration: '0:28', bars: [8, 9, 7, 8, 9, 8, 7, 9, 8, 7, 9, 8, 9, 7, 8, 9], color: '#7DD3FC' },
    ],
  },
  pets: {
    styles: ['俏皮尤克里里', '轻快口哨'],
    tracks: [
      { id: 'm-pet-1', title: '萌宠乐园', genre: '俏皮尤克里里', bpm: 120, duration: '0:28', bars: [6, 7, 5, 8, 6, 7, 5, 8, 6, 7, 8, 5, 6, 7, 5, 8], color: '#A3E635' },
      { id: 'm-pet-2', title: '快乐小爪', genre: '轻快口哨', bpm: 110, duration: '0:26', bars: [5, 6, 7, 5, 8, 6, 7, 5, 6, 8, 7, 5, 6, 7, 8, 5], color: '#BEF264' },
    ],
  },
}

const currentMusicData = computed(() => {
  const catKey = selectedCategory.value
  if (catKey && categoryMusicMap[catKey]) return categoryMusicMap[catKey]
  return categoryMusicMap['daily']
})

const selectedMusicId = ref<string | null>(null)
const playingMusicId = ref<string | null>(null)
const musicVolume = ref(65)

function togglePlayMusic(id: string) {
  playingMusicId.value = playingMusicId.value === id ? null : id
}

/* ── Subtitle settings ── */
const subtitleSettings = reactive({
  autoGenerated: true,
  position: 'bottom' as 'bottom' | 'top',
  fontSize: 16,
  color: '#FFFFFF',
})

const generatedSubtitles = computed(() => {
  const sp = productInfo.sellingPoints.filter(s => s.trim())
  const name = productInfo.name || '产品'
  if (sp.length > 0) return sp.map((s, i) => `${i + 1}. ${s}`)
  return [`${name} — 品质之选`, '限时优惠进行中', '点击下方链接购买']
})

const subtitleColorOptions = ['#FFFFFF', '#00BFA5', '#FBBF24', '#E879A0', '#60A5FA', '#A78BFA']

/* ══════════════════════════════════════════════════════════════════
 *  Step ⑥ 多版本导出
 * ══════════════════════════════════════════════════════════════════ */
interface ExportVersion {
  id: string
  label: string
  type: 'A/B' | 'multi-platform'
  description: string
  duration: string
  platform: string
  resolution: string
  color: string
  previewUrl: string | null
}

const exportVersions = ref<ExportVersion[]>([])
const isGeneratingVersions = ref(false)
const versionsProgress = ref(0)

const exportFormat = ref('mp4-audio')
const exportFormats = [
  { key: 'mp4-audio', label: 'MP4（含音频）', desc: '完整视频，音频与画面同步' },
  { key: 'mp4-video', label: 'MP4（纯画面）', desc: '仅视频画面，不含音频' },
]

const selectedResolution = ref('platform')
const resolutionOptions = [
  { key: 'platform', label: '平台适配', desc: '自动匹配所选平台分辨率' },
  { key: '1080p', label: '1080P 高清', desc: '1920x1080 全高清' },
  { key: '4k', label: '4K 超清', desc: '3840x2160 超高清' },
]

/* ── AI 生成多版本导出（真实 API 调用） ── */
async function generateExportVersions() {
  isGeneratingVersions.value = true
  versionsProgress.value = 0

  const cat = activeCategory.value
  const plat = activePlatform.value
  const pName = productInfo.name || '产品'
  const colors = ['#7C3AED', '#00BFA5', '#60A5FA', '#FB923C', '#E879A0']
  const totalDuration = shots.value.reduce((s, sh) => s + sh.duration, 0)

  try {
    const versions: ExportVersion[] = []

    // 收集已生成镜头的预览 URL，用作首帧参考
    const firstShotPreview = shotGenerations.value.find(sg => sg.previewUrl)?.previewUrl

    /* A版本 — 产品特写开场 */
    versionsProgress.value = 10
    let urlA: string | null = null
    try {
      urlA = (await generateVideo({
        prompt: `${cat?.visualTone || 'cinematic'} style ad for ${pName}, close-up zoom-in opening, product showcase, studio lighting, ${plat.ratio} aspect ratio`,
        durationSeconds: Math.min(totalDuration, 15),
        resolution: '720p',
        firstFrameUrl: firstShotPreview ?? undefined,
      })).url
    } catch (err) {
      console.warn('[AdShortEditor] A版本生成失败:', err)
    }
    versionsProgress.value = 35

    versions.push({
      id: 'ver-ab-a',
      label: 'A版本 — 产品特写开场',
      type: 'A/B',
      description: `前3秒: ${pName}特写推进，强视觉冲击`,
      duration: `${totalDuration}s`,
      platform: plat.name,
      resolution: plat.resolution,
      color: colors[0],
      previewUrl: urlA,
    })

    /* B版本 — 场景全景开场 */
    let urlB: string | null = null
    try {
      urlB = (await generateVideo({
        prompt: `${cat?.visualTone || 'cinematic'} style ad for ${pName}, wide establishing shot opening, lifestyle scene, ambient lighting, ${plat.ratio} aspect ratio`,
        durationSeconds: Math.min(totalDuration, 15),
        resolution: '720p',
      })).url
    } catch (err) {
      console.warn('[AdShortEditor] B版本生成失败:', err)
    }
    versionsProgress.value = 60

    versions.push({
      id: 'ver-ab-b',
      label: 'B版本 — 场景全景开场',
      type: 'A/B',
      description: `前3秒: 使用场景全景展示，营造氛围`,
      duration: `${totalDuration}s`,
      platform: plat.name,
      resolution: plat.resolution,
      color: colors[1],
      previewUrl: urlB,
    })

    /* 多平台适配版本 */
    const otherPlatforms = platforms.filter(p => p.key !== selectedPlatform.value).slice(0, 3)
    for (let i = 0; i < otherPlatforms.length; i++) {
      const op = otherPlatforms[i]
      let mpUrl: string | null = null
      try {
        mpUrl = (await generateVideo({
          prompt: `${cat?.visualTone || 'cinematic'} style ad for ${pName}, product showcase optimized for ${op.ratio} ${op.ratioLabel} format, ${op.name} platform style`,
          durationSeconds: Math.min(totalDuration, 15),
          resolution: '720p',
        })).url
      } catch (err) {
        console.warn(`[AdShortEditor] ${op.name}适配版生成失败:`, err)
      }

      versionsProgress.value = 60 + Math.round(((i + 1) / otherPlatforms.length) * 35)

      versions.push({
        id: `ver-mp-${op.key}`,
        label: `${op.name}适配版`,
        type: 'multi-platform',
        description: `自动裁切适配 ${op.ratio} ${op.ratioLabel}`,
        duration: `${totalDuration}s`,
        platform: op.name,
        resolution: op.resolution,
        color: colors[(i + 2) % colors.length],
        previewUrl: mpUrl,
      })
    }

    versionsProgress.value = 100
    exportVersions.value = versions
  } catch (err) {
    console.error('[AdShortEditor] 多版本导出失败:', err)
  } finally {
    isGeneratingVersions.value = false
  }
}

/* ── Export (mock download) ── */
const isExporting = ref(false)
const exportProgress = ref(0)
const exportComplete = ref(false)

async function startBatchExport() {
  isExporting.value = true
  exportProgress.value = 0
  exportComplete.value = false

  try {
    const versionsWithUrl = exportVersions.value.filter(v => v.previewUrl)
    const total = versionsWithUrl.length
    if (total === 0) {
      console.warn('[AdShortEditor] 没有可导出的版本')
      isExporting.value = false
      return
    }

    for (let i = 0; i < total; i++) {
      const ver = versionsWithUrl[i]
      try {
        const response = await fetch(ver.previewUrl!)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `${ver.label.replace(/\s+/g, '_')}_${ver.platform}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      } catch (err) {
        console.warn(`[AdShortEditor] 导出 ${ver.label} 失败，尝试直接打开:`, err)
        // 回退：直接在新标签页打开 URL
        window.open(ver.previewUrl!, '_blank')
      }
      exportProgress.value = Math.round(((i + 1) / total) * 100)
    }

    exportComplete.value = true

    // ── 写入 bridge 数据供配乐编辑器读取 ──
    try {
      sessionStorage.setItem('mhw:bridge:ad-short→music', JSON.stringify({
        source: 'ad-short',
        shots: shots.value.map(s => ({ id: s.id, title: s.title, durationSec: s.duration || 5 })),
        totalDurationSec: shots.value.reduce((sum, s) => sum + (s.duration || 5), 0),
        exportedAt: new Date().toISOString()
      }))
    } catch { /* storage full */ }
  } catch (err) {
    console.error('[AdShortEditor] 批量导出失败:', err)
  } finally {
    isExporting.value = false
  }
}

/* ══════════════════════════════════════════════════════════════════
 *  Watches
 * ══════════════════════════════════════════════════════════════════ */
watch(currentStep, (val) => {
  if (val === 3 && shots.value.length > 0 && shotGenerations.value.length === 0) {
    initShotGenerations()
  }
})

/* ══════════════════════════════════════════════════════════════════
 *  Navigation helpers
 * ══════════════════════════════════════════════════════════════════ */
const canGoNext = computed(() => {
  switch (currentStep.value) {
    case 0: return selectedCategory.value !== null
    case 1: return canProceedStep2.value
    case 2: return scriptGenerated.value && shots.value.length > 0
    case 3: return allShotsDone.value
    case 4: return selectedMusicId.value !== null
    case 5: return exportVersions.value.length > 0
    default: return false
  }
})


// ENH-16: 热点模板Tab
const showHotTemplates = ref(false)

interface HotTemplate {
  id: string
  icon: string
  name: string
  desc: string
  deadline: string
  expired: boolean
  platform: PlatformKey
  category: CategoryKey
}

const HOT_TEMPLATES: HotTemplate[] = [
  { id: 'ht-618', icon: '🔥', name: '618大促爆款模板', desc: '电商大促专属脚本+视觉', deadline: '6月20日截止', expired: true, platform: 'douyin', category: 'beauty' },
  { id: 'ht-dragon', icon: '🐉', name: '端午节国风好礼', desc: '传统节日+国潮风格', deadline: '6月25日截止', expired: false, platform: 'douyin', category: 'food' },
  { id: 'ht-summer', icon: '☀️', name: '夏日清凉好物', desc: '清凉色调+场景化展示', deadline: '7月15日截止', expired: false, platform: 'xiaohongshu', category: 'beauty' },
  { id: 'ht-newproduct', icon: '🆕', name: '新品首发悬念式', desc: '渐进悬念+产品亮相', deadline: '7月1日截止', expired: false, platform: 'bilibili', category: 'electronics' },
  { id: 'ht-baby', icon: '👶', name: '亲子好物种草', desc: '温情叙事+场景还原', deadline: '6月30日截止', expired: false, platform: 'xiaohongshu', category: 'baby' },
  { id: 'ht-tiktok', icon: '🎵', name: 'TikTok海外爆款', desc: '海外流行风格+简洁视觉', deadline: '7月10日截止', expired: false, platform: 'tiktok', category: 'fashion' },
]

function selectHotTemplate(ht: HotTemplate) {
  if (ht.expired) return
  selectedPlatform.value = ht.platform
  selectedCategory.value = ht.category
  showHotTemplates.value = false
}

// ENH-17: 视频追踪标签
interface TrackingTags {
  campaign: string
  channel: string
  group: string
  utmSource: string
  utmMedium: string
}

const trackingTags = reactive<TrackingTags>({
  campaign: '',
  channel: '',
  group: '',
  utmSource: '',
  utmMedium: '',
})

const generatedTrackingTags = computed(() => {
  const parts: string[] = []
  if (trackingTags.campaign) parts.push(`campaign=${trackingTags.campaign}`)
  if (trackingTags.channel) parts.push(`channel=${trackingTags.channel}`)
  if (trackingTags.group) parts.push(`group=${trackingTags.group}`)
  if (trackingTags.utmSource) parts.push(`utm_source=${trackingTags.utmSource}`)
  if (trackingTags.utmMedium) parts.push(`utm_medium=${trackingTags.utmMedium}`)
  return parts.length > 0 ? parts.join(' & ') : '未配置追踪标签'
})

// ── 草稿自动保存 ──
const DRAFT_KEY_AS = 'mhw:draft:ad-short'
watch([selectedPlatform, selectedCategory, productInfo, shots], () => {
  try {
    sessionStorage.setItem(DRAFT_KEY_AS, JSON.stringify({
      selectedPlatform: selectedPlatform.value,
      selectedCategory: selectedCategory.value,
      productInfo: { name: productInfo.name, sellingPoints: productInfo.sellingPoints },
      shots: shots.value.map(s => ({ id: s.id, title: s.title, duration: s.duration })),
      savedAt: new Date().toISOString()
    }))
  } catch { /* storage full */ }
}, { deep: true })
// 恢复草稿
onMounted(() => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY_AS)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.selectedPlatform) selectedPlatform.value = d.selectedPlatform
      if (d.selectedCategory) selectedCategory.value = d.selectedCategory
      if (d.productInfo?.name) {
        productInfo.name = d.productInfo.name
        if (Array.isArray(d.productInfo.sellingPoints)) {
          productInfo.sellingPoints = d.productInfo.sellingPoints
        }
      }
    }
  } catch { /* ignore */ }
})
</script>

<template>
  
    <!-- P4-1: First-visit empty state -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">🎬</div>
      <h2 class="qe-empty__title">暂无短片项目</h2>
      <p class="qe-empty__desc">输入文案一键生成短视频广告，AI自动完成脚本、分镜、配乐与字幕</p>
      <button class="qe-empty__btn" @click="hasStarted = true">🎬 开始创作</button>
    </div>
    <div class="ad-short-editor" v-else>
    <!-- ─── Step bar ─── -->
    <header class="step-bar">
      <div class="step-bar__inner">
        <div
          v-for="(step, idx) in steps"
          :key="idx"
          class="step-dot"
          :class="{
            'step-dot--active': idx === currentStep,
            'step-dot--done': idx < currentStep,
          }"
          @click="goToStep(idx)"
        >
          <div class="step-dot__circle">
            <span v-if="idx < currentStep" class="step-dot__check">&#10003;</span>
            <span v-else class="step-dot__num">{{ idx + 1 }}</span>
          </div>
          <span class="step-dot__label">{{ step.label }}</span>
          <div
            v-if="idx < steps.length - 1"
            class="step-dot__line"
            :class="{ 'step-dot__line--done': idx < currentStep }"
          />
        </div>
      </div>
    </header>

    <!-- ─── Content area ─── -->
    <main class="editor-main">

      <!-- ══════════ Step ① 选择平台 + 品类 ══════════ -->
      <section v-show="currentStep === 0" class="step-panel">
        <h2 class="panel-title">选择平台 + 品类</h2>
        <p class="panel-desc">根据投放平台和商品品类自动适配画面比例与创作风格</p>

        <!-- Platform cards -->
        <h3 class="section-title">投放平台</h3>
        <div class="platform-grid">
          <div
            v-for="p in platforms"
            :key="p.key"
            class="platform-card"
            :class="{ 'platform-card--active': selectedPlatform === p.key }"
            @click="selectedPlatform = p.key"
          >
            <!-- Aspect ratio visual -->
            <div class="platform-card__visual">
              <div
                class="platform-card__ratio-box"
                :style="{
                  width: Math.min(p.aspectW / Math.max(p.aspectW, p.aspectH) * 48, 48) + 'px',
                  height: Math.min(p.aspectH / Math.max(p.aspectW, p.aspectH) * 48, 48) + 'px',
                }"
              />
            </div>
            <div class="platform-card__info">
              <div class="platform-card__name">{{ p.name }}</div>
              <div class="platform-card__ratio">{{ p.ratio }} {{ p.ratioLabel }}</div>
              <div class="platform-card__res">{{ p.resolution }}</div>
            </div>
            <div class="platform-card__check" v-if="selectedPlatform === p.key">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Category grid -->
        <h3 class="section-title">商品品类</h3>
        <div class="category-grid">
          <div
            v-for="cat in categories"
            :key="cat.key"
            class="category-card"
            :class="{ 'category-card--active': selectedCategory === cat.key }"
            @click="selectedCategory = cat.key"
          >
            <div class="category-card__icon" :style="{ background: cat.color + '18', color: cat.color }">
              {{ cat.icon }}
            </div>
            <div class="category-card__name">{{ cat.name }}</div>
            <div v-if="selectedCategory === cat.key" class="category-card__tags">
              <span class="category-card__tag" :style="{ color: cat.color }">
                {{ cat.musicStyle }}
              </span>
              <span class="category-card__tag category-card__tag--tone" :style="{ color: cat.color }">
                {{ cat.visualTone }}
              </span>
            </div>
          </div>
        </div>

        <!-- Auto-recommend info -->
        <div v-if="activeCategory" class="recommend-info">
          <div class="recommend-info__header">
            <span class="recommend-info__icon">&#9889;</span>
            自动推荐配置
          </div>
          <div class="recommend-info__items">
            <div class="recommend-info__item">
              <span class="recommend-info__label">音乐风格</span>
              <span class="recommend-info__value">{{ activeCategory.musicStyle }}</span>
            </div>
            <div class="recommend-info__item">
              <span class="recommend-info__label">视觉调性</span>
              <span class="recommend-info__value">{{ activeCategory.visualTone }}</span>
            </div>
            <div class="recommend-info__item">
              <span class="recommend-info__label">画面比例</span>
              <span class="recommend-info__value">{{ activePlatform.ratio }} {{ activePlatform.ratioLabel }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════ Step ② 上传产品素材 ══════════ -->
      <section v-show="currentStep === 1" class="step-panel">
        <h2 class="panel-title">上传产品素材</h2>
        <p class="panel-desc">上传1-9张产品图片作为参考素材（reference_image），并填写产品信息</p>

        <!-- Image upload area -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone--dragging': isDragging }"
          role="button"
          tabindex="0"
          aria-label="拖拽或点击上传产品图片，最多 9 张"
          @dragover.prevent
          @dragenter.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop="handleDrop"
          @click="($refs.adShortFileInput as HTMLInputElement).click()"
          @keydown.enter.prevent="($refs.adShortFileInput as HTMLInputElement).click()"
          @keydown.space.prevent="($refs.adShortFileInput as HTMLInputElement).click()"
        >
          <input ref="adShortFileInput" type="file" accept="image/*" multiple hidden @change="handleFileInput" />
          <div class="drop-zone__icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>
          <div class="drop-zone__text">拖拽产品图片到此处，或点击上传</div>
          <div class="drop-zone__hint">支持 JPG / PNG，最多9张 · 已上传 {{ productImages.length }}/9</div>
        </div>

        <!-- Uploaded images grid -->
        <div v-if="productImages.length" class="images-grid">
          <div v-for="img in productImages" :key="img.id" class="image-card">
            <div class="image-card__thumb" :style="img.previewUrl ? { background: `url(${img.previewUrl}) center/cover` } : { background: `linear-gradient(135deg, ${img.color}33, ${img.color}11)` }">
              <span v-if="!img.previewUrl" class="image-card__label" :style="{ color: img.color }">IMG</span>
            </div>
            <div class="image-card__info">
              <div class="image-card__name">{{ img.name }}</div>
              <div class="image-card__size">{{ img.size }}</div>
            </div>
            <button class="image-card__del" @click="removeImage(img.id)">&#10005;</button>
          </div>
        </div>

        <!-- Product info form -->
        <div class="product-form">
          <h3 class="form-section-title">产品信息</h3>
          <div class="form-group">
            <label class="form-label">产品名称</label>
            <input v-model="productInfo.name" class="form-input" placeholder="输入产品名称" />
          </div>
          <div class="form-group">
            <label class="form-label">三大卖点</label>
            <div class="selling-points">
              <div v-for="(sp, i) in productInfo.sellingPoints" :key="i" class="selling-point-row">
                <span class="selling-point__num">{{ i + 1 }}</span>
                <input
                  v-model="productInfo.sellingPoints[i]"
                  class="form-input"
                  :placeholder="`卖点 ${i + 1}（简短描述）`"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════ Step ③ AI生成脚本（分镜式） ══════════ -->
      <section v-show="currentStep === 2" class="step-panel">
        <h2 class="panel-title">AI生成脚本（分镜式）</h2>
        <p class="panel-desc">
          基于 {{ activePlatform.name }} · {{ activeCategory?.name || '通用' }} · {{ productInfo.name || '产品' }}
          自动生成分镜脚本，每个镜头可单独编辑
        </p>

        <!-- Generate button -->
        <button
          v-if="!scriptGenerated"
          class="btn-generate"
          @click="mockGenerateScript"
          :disabled="isGeneratingScript"
        >
          <span v-if="isGeneratingScript" class="btn-generate__spinner" />
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {{ isGeneratingScript ? 'AI正在生成脚本...' : 'AI 生成分镜脚本' }}
        </button>

        <!-- Regenerate button -->
        <button
          v-if="scriptGenerated"
          class="btn-regenerate"
          @click="mockGenerateScript"
          :disabled="isGeneratingScript"
        >
          <span v-if="isGeneratingScript" class="btn-generate__spinner" />
          {{ isGeneratingScript ? '重新生成中...' : '重新生成脚本' }}
        </button>

        <!-- Shots list -->
        <div v-if="shots.length" class="shots-list">
          <div v-for="shot in shots" :key="shot.id" class="shot-card">
            <div class="shot-card__header">
              <div class="shot-card__number">镜头 {{ shot.number }}</div>
              <div class="shot-card__duration">
                <input
                  type="number"
                  :value="shot.duration"
                  @input="updateShotField(shot.id, 'duration', Number(($event.target as HTMLInputElement).value))"
                  class="shot-duration-input"
                  min="1"
                  max="15"
                />
                <span>s（&le;15s）</span>
              </div>
            </div>

            <!-- CRAFT prompt -->
            <div class="shot-card__section">
              <div class="shot-card__label">CRAFT 提示词</div>
              <textarea
                class="shot-card__textarea"
                :value="shot.craftPrompt"
                @input="updateShotField(shot.id, 'craftPrompt', ($event.target as HTMLTextAreaElement).value)"
                rows="4"
              />
            </div>

            <!-- Voiceover -->
            <div class="shot-card__section">
              <div class="shot-card__label">配音文案</div>
              <input
                class="form-input"
                :value="shot.voiceover"
                @input="updateShotField(shot.id, 'voiceover', ($event.target as HTMLInputElement).value)"
              />
            </div>

            <!-- Camera movement + music tags -->
            <div class="shot-card__footer">
              <div class="shot-card__movement">
                <span class="shot-card__label-inline">镜头运动</span>
                <select
                  class="shot-card__select"
                  :value="shot.cameraMovementId"
                  @change="updateShotField(shot.id, 'cameraMovementId', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="m in CAMERA_MOVEMENTS" :key="m.id" :value="m.id">
                    {{ m.nameZh }}（{{ m.nameEn }}）
                  </option>
                </select>
              </div>
              <div class="shot-card__tags">
                <span class="shot-card__label-inline">音乐标签</span>
                <div class="tag-list">
                  <span
                    v-for="(tag, ti) in shot.musicTags"
                    :key="ti"
                    class="music-tag"
                  >{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════ Step ④ 逐镜头生成视频 ══════════ -->
      <section v-show="currentStep === 3" class="step-panel">
        <h2 class="panel-title">逐镜头生成视频</h2>
        <p class="panel-desc">每个镜头自动绑定产品参考图 + CRAFT提示词，逐镜头生成视频片段</p>

        <!-- Overall progress -->
        <div class="overall-progress">
          <div class="overall-progress__bar">
            <div class="overall-progress__fill" :style="{ width: overallProgress + '%' }" />
          </div>
          <span class="overall-progress__text">总进度 {{ overallProgress }}%</span>
        </div>

        <!-- Generate all button -->
        <button class="btn-generate btn-generate--sm" @click="generateAllShots">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          一键生成全部镜头
        </button>

        <!-- Shot generation cards -->
        <div class="gen-shots-list">
          <div
            v-for="(sg, idx) in shotGenerations"
            :key="sg.shotId"
            class="gen-shot-card"
            :class="{
              'gen-shot-card--done': sg.status === 'done',
              'gen-shot-card--generating': sg.status === 'generating',
            }"
          >
            <div class="gen-shot-card__left">
              <div class="gen-shot-card__num">{{ idx + 1 }}</div>
            </div>
            <div class="gen-shot-card__body">
              <div class="gen-shot-card__header">
                <span class="gen-shot-card__title">镜头 {{ idx + 1 }}</span>
                <span class="gen-shot-card__dur">{{ shots[idx]?.duration }}s</span>
                <span class="gen-shot-card__movement">
                  {{ getMovementName(shots[idx]?.cameraMovementId || '') }}
                </span>
              </div>
              <div class="gen-shot-card__prompt">
                {{ shots[idx]?.craftPrompt?.split('\n')[2] || '' }}
              </div>
              <div class="gen-shot-card__ref">
                <span class="gen-shot-card__ref-badge">参考图已绑定</span>
                <span class="gen-shot-card__ref-count">{{ productImages.length }} 张</span>
              </div>
              <!-- Progress bar -->
              <div v-if="sg.status === 'generating' || sg.status === 'done'" class="gen-shot-card__progress">
                <div class="gen-shot-card__progress-fill" :style="{ width: sg.progress + '%' }" />
                <span class="gen-shot-card__progress-text">{{ Math.round(sg.progress) }}%</span>
              </div>
            </div>
            <div class="gen-shot-card__right">
              <div v-if="sg.status === 'done'" class="gen-shot-card__preview">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
              <button
                v-else
                class="btn-sm btn-sm--cyan"
                @click="generateShot(sg.shotId)"
                :disabled="sg.status === 'generating'"
              >
                {{ sg.status === 'generating' ? '生成中...' : '生成' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════ Step ⑤ 配乐 + 字幕 ══════════ -->
      <section v-show="currentStep === 4" class="step-panel">
        <h2 class="panel-title">配乐 + 字幕</h2>
        <p class="panel-desc">
          根据 {{ activeCategory?.name || '通用' }} 品类自动匹配背景音乐，并从卖点生成字幕
        </p>

        <!-- Music section -->
        <h3 class="section-title">
          <span class="section-title__icon">&#9835;</span>
          品类音乐自动匹配 — {{ activeCategory?.name || '通用' }}
        </h3>
        <div class="music-styles-row">
          <span
            v-for="style in currentMusicData.styles"
            :key="style"
            class="music-style-badge"
          >{{ style }}</span>
        </div>

        <div class="music-grid">
          <div
            v-for="track in currentMusicData.tracks"
            :key="track.id"
            class="music-card"
            :class="{ 'music-card--selected': selectedMusicId === track.id }"
          >
            <!-- Waveform -->
            <div class="music-card__wave">
              <span
                v-for="(h, bi) in track.bars"
                :key="bi"
                class="music-card__bar"
                :class="{ 'music-card__bar--playing': playingMusicId === track.id }"
                :style="{ height: h * 3 + 'px', background: track.color, animationDelay: bi * 0.08 + 's' }"
              />
            </div>
            <div class="music-card__info">
              <div class="music-card__title">{{ track.title }}</div>
              <div class="music-card__meta">
                <span class="music-card__tag" :style="{ background: track.color + '22', color: track.color }">
                  {{ track.genre }}
                </span>
                <span class="music-card__detail">{{ track.bpm }} BPM</span>
                <span class="music-card__detail">{{ track.duration }}</span>
              </div>
            </div>
            <div class="music-card__actions">
              <button class="btn-sm btn-sm--ghost" @click="togglePlayMusic(track.id)">
                {{ playingMusicId === track.id ? '暂停' : '试听' }}
              </button>
              <button
                class="btn-sm"
                :class="selectedMusicId === track.id ? 'btn-sm--active' : 'btn-sm--cyan'"
                @click="selectedMusicId = track.id"
              >
                {{ selectedMusicId === track.id ? '已选' : '使用' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Volume slider -->
        <div class="volume-section">
          <span class="volume-label">音乐音量</span>
          <input type="range" v-model.number="musicVolume" min="0" max="100" class="volume-slider" />
          <span class="volume-value">{{ musicVolume }}%</span>
        </div>

        <!-- Subtitle section -->
        <h3 class="section-title section-title--mt">
          <span class="section-title__icon">&#128396;</span>
          字幕自动生成
        </h3>

        <!-- Generated subtitles preview -->
        <div class="subtitle-preview">
          <div
            class="subtitle-preview__frame"
            :class="{
              'subtitle-preview__frame--top': subtitleSettings.position === 'top',
              'subtitle-preview__frame--bottom': subtitleSettings.position === 'bottom',
            }"
          >
            <div class="subtitle-preview__screen">
              <div class="subtitle-preview__center-text">视频预览画面</div>
              <div
                class="subtitle-preview__text"
                :class="{
                  'subtitle-preview__text--top': subtitleSettings.position === 'top',
                  'subtitle-preview__text--bottom': subtitleSettings.position === 'bottom',
                }"
                :style="{ fontSize: subtitleSettings.fontSize + 'px', color: subtitleSettings.color }"
              >
                {{ generatedSubtitles[0] }}
              </div>
            </div>
          </div>
        </div>

        <!-- Subtitle content -->
        <div class="subtitle-list">
          <div v-for="(sub, si) in generatedSubtitles" :key="si" class="subtitle-item">
            <span class="subtitle-item__idx">{{ si + 1 }}</span>
            <span class="subtitle-item__text">{{ sub }}</span>
          </div>
        </div>

        <!-- Subtitle style controls -->
        <div class="subtitle-controls">
          <div class="subtitle-control-row">
            <span class="subtitle-control-label">字幕位置</span>
            <div class="subtitle-pos-btns">
              <button
                class="subtitle-pos-btn"
                :class="{ 'subtitle-pos-btn--active': subtitleSettings.position === 'bottom' }"
                @click="subtitleSettings.position = 'bottom'"
              >底部</button>
              <button
                class="subtitle-pos-btn"
                :class="{ 'subtitle-pos-btn--active': subtitleSettings.position === 'top' }"
                @click="subtitleSettings.position = 'top'"
              >顶部</button>
            </div>
          </div>
          <div class="subtitle-control-row">
            <span class="subtitle-control-label">字体大小</span>
            <input
              type="range"
              v-model.number="subtitleSettings.fontSize"
              min="12"
              max="28"
              class="volume-slider"
            />
            <span class="volume-value">{{ subtitleSettings.fontSize }}px</span>
          </div>
          <div class="subtitle-control-row">
            <span class="subtitle-control-label">字体颜色</span>
            <div class="color-options">
              <button
                v-for="c in subtitleColorOptions"
                :key="c"
                class="color-dot"
                :class="{ 'color-dot--active': subtitleSettings.color === c }"
                :style="{ background: c }"
                @click="subtitleSettings.color = c"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════ Step ⑥ 多版本导出 ══════════ -->
      <section v-show="currentStep === 5" class="step-panel">
        <h2 class="panel-title">多版本导出</h2>
        <p class="panel-desc">生成A/B测试版本和多平台适配版本，一键批量导出</p>

        <!-- ENH-17: 视频追踪标签 -->
        <div class="tracking-tags-section">
          <h3 class="section-title">追踪标签</h3>
          <p class="panel-desc">为导出视频添加追踪标签，方便投放端分析效果</p>
          <div class="tracking-tags-input">
            <input v-model="trackingTags.campaign" type="text" class="form-input" placeholder="广告系列名称（如：618大促主推）" />
            <div class="tracking-tag-row">
              <div class="tracking-tag-field">
                <label class="tracking-tag-label">投放渠道</label>
                <select v-model="trackingTags.channel" class="form-select"><option value="">自动识别</option><option value="douyin">抖音</option><option value="kuaishou">快手</option><option value="xiaohongshu">小红书</option><option value="bilibili">B站</option><option value="wechat">微信视频号</option><option value="tiktok">TikTok</option></select>
              </div>
              <div class="tracking-tag-field">
                <label class="tracking-tag-label">素材组</label>
                <input v-model="trackingTags.group" type="text" class="form-input" placeholder="A/B测试组A" />
              </div>
            </div>
            <div class="tracking-tag-row">
              <div class="tracking-tag-field">
                <label class="tracking-tag-label">UTM Source</label>
                <input v-model="trackingTags.utmSource" type="text" class="form-input" placeholder="douyin_feed" />
              </div>
              <div class="tracking-tag-field">
                <label class="tracking-tag-label">UTM Medium</label>
                <input v-model="trackingTags.utmMedium" type="text" class="form-input" placeholder="video_ad" />
              </div>
            </div>
            <div class="tracking-tags-preview">
              <span class="tracking-tags-preview__label">预览标签:</span>
              <code class="tracking-tags-preview__code">{{ generatedTrackingTags }}</code>
            </div>
          </div>
        </div>

<!-- Version type info -->
        <div class="version-types">
          <div class="version-type-card">
            <div class="version-type-card__badge version-type-card__badge--ab">A/B</div>
            <div class="version-type-card__title">A/B版本</div>
            <div class="version-type-card__desc">不同开场钩子（前3秒差异），用于效果对比测试</div>
          </div>
          <div class="version-type-card">
            <div class="version-type-card__badge version-type-card__badge--mp">多平台</div>
            <div class="version-type-card__title">多平台适配</div>
            <div class="version-type-card__desc">自动裁切分辨率，适配所选投放平台</div>
          </div>
        </div>

        <!-- Generate versions button -->
        <button
          class="btn-generate"
          @click="generateExportVersions"
          :disabled="isGeneratingVersions"
        >
          <span v-if="isGeneratingVersions" class="btn-generate__spinner" />
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {{ isGeneratingVersions ? '正在生成多版本...' : '生成多版本' }}
        </button>

        <!-- Progress -->
        <div v-if="isGeneratingVersions" class="progress-bar">
          <div class="progress-bar__fill" :style="{ width: versionsProgress + '%' }" />
          <span class="progress-bar__text">{{ Math.round(versionsProgress) }}%</span>
        </div>

        <!-- Generated versions list -->
        <div v-if="exportVersions.length" class="export-versions-grid">
          <div
            v-for="ver in exportVersions"
            :key="ver.id"
            class="export-version-card"
          >
            <div class="export-version-card__preview" :style="{ background: `linear-gradient(135deg, ${ver.color}33, ${ver.color}11)` }">
              <div class="export-version-card__play">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
              <span class="export-version-card__type-badge" :class="ver.type === 'A/B' ? 'export-version-card__type-badge--ab' : 'export-version-card__type-badge--mp'">
                {{ ver.type }}
              </span>
            </div>
            <div class="export-version-card__body">
              <div class="export-version-card__title">{{ ver.label }}</div>
              <div class="export-version-card__desc">{{ ver.description }}</div>
              <div class="export-version-card__meta">
                <span>{{ ver.platform }}</span>
                <span>{{ ver.resolution }}</span>
                <span>{{ ver.duration }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Export format -->
        <div v-if="exportVersions.length" class="export-settings">
          <h3 class="section-title">导出格式</h3>
          <div class="export-format-cards">
            <div
              v-for="fmt in exportFormats"
              :key="fmt.key"
              class="export-format-card"
              :class="{ 'export-format-card--active': exportFormat === fmt.key }"
              @click="exportFormat = fmt.key"
            >
              <div class="export-format-card__radio">
                <span class="export-format-card__dot" :class="{ 'export-format-card__dot--active': exportFormat === fmt.key }" />
              </div>
              <div class="export-format-card__info">
                <div class="export-format-card__label">{{ fmt.label }}</div>
                <div class="export-format-card__desc">{{ fmt.desc }}</div>
              </div>
            </div>
          </div>

          <h3 class="section-title section-title--mt">分辨率</h3>
          <div class="resolution-options">
            <button
              v-for="res in resolutionOptions"
              :key="res.key"
              class="resolution-btn"
              :class="{ 'resolution-btn--active': selectedResolution === res.key }"
              @click="selectedResolution = res.key"
            >
              <div class="resolution-btn__label">{{ res.label }}</div>
              <div class="resolution-btn__desc">{{ res.desc }}</div>
            </button>
          </div>
        </div>

        <!-- Batch export button -->
        <button
          v-if="exportVersions.length"
          class="btn-export"
          @click="startBatchExport"
          :disabled="isExporting"
        >
          <svg v-if="!isExporting" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span v-if="isExporting" class="btn-generate__spinner" />
          {{ isExporting ? '导出中...' : '批量导出' }}
        </button>

        <!-- Export progress -->
        <div v-if="isExporting || exportComplete" class="progress-bar">
          <div class="progress-bar__fill progress-bar__fill--green" :style="{ width: exportProgress + '%' }" />
          <span class="progress-bar__text">{{ Math.round(exportProgress) }}%</span>
        </div>

        <!-- Export complete -->
        <div v-if="exportComplete" class="export-complete">
          <span class="export-complete__icon">&#10003;</span>
          <div>
            <div class="export-complete__title">导出完成！</div>
            <div class="export-complete__links">
              <a v-for="ver in exportVersions" :key="ver.id" class="export-complete__link" href="#" @click.prevent>
                {{ ver.label }}.mp4
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ─── Navigation bar ─── -->
    <footer class="nav-bar">
      <button class="nav-btn nav-btn--ghost" :disabled="currentStep === 0" @click="goToStep(currentStep - 1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        上一步
      </button>
      <span class="nav-bar__indicator">{{ currentStep + 1 }} / {{ steps.length }}</span>
      <button
        v-if="currentStep < steps.length - 1"
        class="nav-btn nav-btn--cyan"
        :disabled="!canGoNext"
        @click="goToStep(currentStep + 1)"
      >
        下一步
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </button>
      <button
        v-else
        class="nav-btn nav-btn--cyan"
        :disabled="!exportComplete"
        @click="goToStep(0)"
      >
        开始新创作
      </button>
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

/* ══════════════════════════════════════════════════════════════════
 *  Root layout
 * ══════════════════════════════════════════════════════════════════ */
.ad-short-editor {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 52px);
  background: var(--bg-primary, #0E0F12);
  color: var(--text-primary, #E8EAED);
  font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

/* ══════════════════════════════════════════════════════════════════
 *  Step bar
 * ══════════════════════════════════════════════════════════════════ */
.step-bar {
  flex-shrink: 0;
  padding: 20px 24px 16px;
  background: var(--bg-secondary, #1A1C21);
  border-bottom: 1px solid var(--border, #2E3139);
}

.step-bar__inner {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  max-width: 960px;
  margin: 0 auto;
}

.step-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: pointer;
  flex: 0 0 auto;
  min-width: 72px;
}

.step-dot__circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: #1A1C21;
  border: 2px solid var(--border, #2E3139);
  color: var(--text-secondary, #9CA3AF);
  transition: all 0.25s ease;
  position: relative;
  z-index: 1;
}

.step-dot--active .step-dot__circle {
  background: var(--accent, #00BFA5);
  border-color: var(--accent, #00BFA5);
  color: #fff;
  box-shadow: 0 0 14px rgba(0, 191, 165, 0.45);
}

.step-dot--done .step-dot__circle {
  background: #7C3AED;
  border-color: #7C3AED;
  color: #fff;
}

.step-dot__check { font-size: 14px; }
.step-dot__num { font-size: 13px; }

.step-dot__label {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted, #64748B);
  white-space: nowrap;
  transition: color 0.2s;
}

.step-dot--active .step-dot__label {
  color: var(--accent, #00BFA5);
  font-weight: 600;
}

.step-dot--done .step-dot__label {
  color: #A78BFA;
}

.step-dot__line {
  position: absolute;
  top: 18px;
  left: calc(50% + 22px);
  width: 40px;
  height: 2px;
  background: var(--border, #2E3139);
  z-index: 0;
}

.step-dot__line--done {
  background: #7C3AED;
}

/* ══════════════════════════════════════════════════════════════════
 *  Main content area
 * ══════════════════════════════════════════════════════════════════ */
.editor-main {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
  scrollbar-width: thin;
  scrollbar-color: var(--border, #2E3139) transparent;
}

.editor-main::-webkit-scrollbar { width: 6px; }
.editor-main::-webkit-scrollbar-track { background: transparent; }
.editor-main::-webkit-scrollbar-thumb { background: var(--border, #2E3139); border-radius: 3px; }

.step-panel {
  max-width: 960px;
  margin: 0 auto;
}

.panel-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.panel-desc {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0 0 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin: 0 0 14px;
}

.section-title__icon { font-size: 16px; }
.section-title--mt { margin-top: 28px; }

/* ══════════════════════════════════════════════════════════════════
 *  Step ① Platform cards
 * ══════════════════════════════════════════════════════════════════ */
.platform-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}

.platform-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 12px 14px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.platform-card:hover {
  border-color: #3B3E47;
  transform: translateY(-1px);
}

.platform-card--active {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.06);
  box-shadow: 0 0 16px rgba(0, 191, 165, 0.15);
}

.platform-card__visual {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.platform-card__ratio-box {
  border: 2px solid var(--border, #2E3139);
  border-radius: 6px;
  background: rgba(0, 191, 165, 0.05);
  transition: all 0.2s;
}

.platform-card--active .platform-card__ratio-box {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.12);
}

.platform-card__info { text-align: center; }

.platform-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 2px;
}

.platform-card--active .platform-card__name { color: var(--accent, #00BFA5); }

.platform-card__ratio {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 1px;
}

.platform-card__res {
  font-size: 10px;
  color: #4B5563;
}

.platform-card__check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent, #00BFA5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Category grid */
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.category-card:hover {
  border-color: #3B3E47;
  transform: translateY(-1px);
}

.category-card--active {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.04);
  box-shadow: 0 0 12px rgba(0, 191, 165, 0.12);
}

.category-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.category-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}

.category-card__tags {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-card__tag {
  font-size: 10px;
  font-weight: 500;
}

.category-card__tag--tone { opacity: 0.7; }

/* Recommend info */
.recommend-info {
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  padding: 16px 20px;
}

.recommend-info__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #FBBF24;
  margin-bottom: 12px;
}

.recommend-info__icon { font-size: 16px; }

.recommend-info__items {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.recommend-info__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recommend-info__label {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

.recommend-info__value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #E8EAED);
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ② Upload
 * ══════════════════════════════════════════════════════════════════ */
.drop-zone {
  border: 2px dashed var(--border, #2E3139);
  border-radius: 14px;
  padding: 36px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s;
  margin-bottom: 20px;
}

.drop-zone:hover,
.drop-zone--dragging {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.04);
}

.drop-zone__icon { color: var(--text-muted, #64748B); margin-bottom: 10px; }
.drop-zone:hover .drop-zone__icon { color: var(--accent, #00BFA5); }

.drop-zone__text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 4px;
}

.drop-zone__hint {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

/* Images grid */
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}

.image-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
}

.image-card__thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.image-card__label {
  font-size: 10px;
  font-weight: 700;
}

.image-card__info { flex: 1; min-width: 0; }

.image-card__name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #E8EAED);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-card__size {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

.image-card__del {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.image-card__del:hover { background: rgba(239, 68, 68, 0.2); }

/* Product form */
.product-form {
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  padding: 20px;
}

.form-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin: 0 0 16px;
}

.form-group { margin-bottom: 14px; }

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus { border-color: var(--accent, #00BFA5); }
.form-input::placeholder { color: #4B5563; }

.selling-points {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selling-point-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selling-point__num {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(0, 191, 165, 0.12);
  color: var(--accent, #00BFA5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ③ Script
 * ══════════════════════════════════════════════════════════════════ */
.btn-generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  margin-bottom: 20px;
  font-family: inherit;
}

.btn-generate--sm { max-width: 280px; }

.btn-generate:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(0, 191, 165, 0.3), 0 0 20px rgba(124, 58, 237, 0.3);
  transform: translateY(-1px);
}

.btn-generate:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-generate__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spinAnim 0.7s linear infinite;
}

@keyframes spinAnim { to { transform: rotate(360deg); } }

.btn-regenerate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 20px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #9CA3AF);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
  font-family: inherit;
}

.btn-regenerate:hover { border-color: #7C3AED; color: #A78BFA; }
.btn-regenerate:disabled { opacity: 0.5; cursor: not-allowed; }

/* Shots list */
.shots-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shot-card {
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 14px;
  padding: 16px 20px;
  transition: border-color 0.2s;
}

.shot-card:hover { border-color: #3B3E47; }

.shot-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.shot-card__number {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent, #00BFA5);
}

.shot-card__duration {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
}

.shot-duration-input {
  width: 40px;
  padding: 4px 6px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  font-family: inherit;
}

.shot-duration-input:focus { border-color: var(--accent, #00BFA5); }

.shot-card__section { margin-bottom: 12px; }

.shot-card__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.shot-card__textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  font-family: 'Menlo', 'Consolas', monospace;
  box-sizing: border-box;
}

.shot-card__textarea:focus { border-color: var(--accent, #00BFA5); }

.shot-card__footer {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.shot-card__movement {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
}

.shot-card__label-inline {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  font-weight: 500;
}

.shot-card__select {
  padding: 6px 10px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-primary, #E8EAED);
  font-size: 12px;
  outline: none;
  font-family: inherit;
  cursor: pointer;
}

.shot-card__select:focus { border-color: var(--accent, #00BFA5); }

.shot-card__tags {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tag-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.music-tag {
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(124, 58, 237, 0.12);
  color: #A78BFA;
  font-size: 11px;
  font-weight: 500;
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ④ Shot generation
 * ══════════════════════════════════════════════════════════════════ */
.overall-progress {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.overall-progress__bar {
  flex: 1;
  height: 8px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 4px;
  overflow: hidden;
}

.overall-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #00BFA5), #7C3AED);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.overall-progress__text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #00BFA5);
  min-width: 80px;
  text-align: right;
}

.gen-shots-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}

.gen-shot-card {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  transition: all 0.2s;
}

.gen-shot-card--done {
  border-color: rgba(0, 191, 165, 0.3);
  background: rgba(0, 191, 165, 0.02);
}

.gen-shot-card--generating {
  border-color: rgba(124, 58, 237, 0.3);
}

.gen-shot-card__left {
  flex-shrink: 0;
}

.gen-shot-card__num {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 191, 165, 0.12);
  color: var(--accent, #00BFA5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}

.gen-shot-card--done .gen-shot-card__num {
  background: var(--accent, #00BFA5);
  color: #fff;
}

.gen-shot-card__body {
  flex: 1;
  min-width: 0;
}

.gen-shot-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.gen-shot-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}

.gen-shot-card__dur {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.gen-shot-card__movement {
  font-size: 11px;
  color: #A78BFA;
  font-weight: 500;
}

.gen-shot-card__prompt {
  font-size: 11px;
  color: var(--text-muted, #64748B);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.gen-shot-card__ref {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.gen-shot-card__ref-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 191, 165, 0.1);
  color: var(--accent, #00BFA5);
  font-weight: 500;
}

.gen-shot-card__ref-count {
  font-size: 10px;
  color: var(--text-muted, #64748B);
}

.gen-shot-card__progress {
  position: relative;
  height: 6px;
  background: var(--bg-secondary, #1A1C21);
  border-radius: 3px;
  overflow: hidden;
}

.gen-shot-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #00BFA5), #7C3AED);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.gen-shot-card__progress-text {
  position: absolute;
  right: 0;
  top: -16px;
  font-size: 10px;
  color: var(--text-secondary, #9CA3AF);
}

.gen-shot-card__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.gen-shot-card__preview {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 191, 165, 0.12);
  color: var(--accent, #00BFA5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding-left: 2px;
}

.gen-shot-card__preview:hover {
  background: rgba(0, 191, 165, 0.2);
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ⑤ Music + Subtitle
 * ══════════════════════════════════════════════════════════════════ */
.music-styles-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.music-style-badge {
  padding: 5px 14px;
  border-radius: 20px;
  background: rgba(124, 58, 237, 0.1);
  color: #A78BFA;
  font-size: 12px;
  font-weight: 500;
}

.music-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.music-card {
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  padding: 14px;
  transition: all 0.2s;
}

.music-card:hover { border-color: #3B3E47; }

.music-card--selected {
  border-color: var(--accent, #00BFA5);
  box-shadow: 0 0 14px rgba(0, 191, 165, 0.18);
}

.music-card__wave {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 30px;
  margin-bottom: 10px;
}

.music-card__bar {
  width: 4px;
  border-radius: 2px;
  transition: height 0.3s;
}

.music-card__bar--playing {
  animation: waveAnim 0.6s ease-in-out infinite alternate;
}

@keyframes waveAnim {
  0% { transform: scaleY(0.5); }
  100% { transform: scaleY(1.3); }
}

.music-card__info { margin-bottom: 10px; }

.music-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 6px;
}

.music-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.music-card__tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.music-card__detail { color: var(--text-muted, #64748B); }

.music-card__actions {
  display: flex;
  gap: 8px;
}

/* Volume section */
.volume-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  margin-bottom: 24px;
}

.volume-label {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  min-width: 70px;
}

.volume-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: var(--border, #2E3139);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent, #00BFA5);
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 191, 165, 0.4);
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent, #00BFA5);
  cursor: pointer;
  border: none;
}

.volume-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #00BFA5);
  min-width: 40px;
  text-align: right;
}

/* Subtitle preview */
.subtitle-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.subtitle-preview__frame {
  width: 220px;
  height: 180px;
  border: 2px solid var(--border, #2E3139);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary, #1A1C21);
}

.subtitle-preview__screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.subtitle-preview__center-text {
  font-size: 11px;
  color: #4B5563;
}

.subtitle-preview__text {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  padding: 4px 8px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
}

.subtitle-preview__text--top { top: 10px; }
.subtitle-preview__text--bottom { bottom: 10px; }

/* Subtitle list */
.subtitle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 18px;
}

.subtitle-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
}

.subtitle-item__idx {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.12);
  color: #A78BFA;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.subtitle-item__text {
  font-size: 13px;
  color: var(--text-primary, #E8EAED);
}

/* Subtitle controls */
.subtitle-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subtitle-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #2E3139);
  border-radius: 8px;
}

.subtitle-control-label {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  min-width: 70px;
}

.subtitle-pos-btns {
  display: flex;
  gap: 6px;
}

.subtitle-pos-btn {
  padding: 6px 16px;
  border: 1px solid var(--border, #2E3139);
  border-radius: 6px;
  background: #1A1C21;
  color: var(--text-secondary, #9CA3AF);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.subtitle-pos-btn:hover { border-color: #3B3E47; color: var(--text-primary, #E8EAED); }

.subtitle-pos-btn--active {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.1);
  color: var(--accent, #00BFA5);
}

.color-options {
  display: flex;
  gap: 8px;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-dot:hover { transform: scale(1.15); }

.color-dot--active {
  border-color: var(--accent, #00BFA5);
  box-shadow: 0 0 8px rgba(0, 191, 165, 0.4);
}

/* ══════════════════════════════════════════════════════════════════
 *  Step ⑥ Export
 * ══════════════════════════════════════════════════════════════════ */
.version-types {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.version-type-card {
  padding: 16px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
}

.version-type-card__badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 8px;
}

.version-type-card__badge--ab {
  background: rgba(124, 58, 237, 0.15);
  color: #A78BFA;
}

.version-type-card__badge--mp {
  background: rgba(0, 191, 165, 0.12);
  color: var(--accent, #00BFA5);
}

.version-type-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 4px;
}

.version-type-card__desc {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  line-height: 1.4;
}

/* Progress bar */
.progress-bar {
  position: relative;
  height: 24px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #00BFA5), #7C3AED);
  border-radius: 12px;
  transition: width 0.3s ease;
}

.progress-bar__fill--green {
  background: linear-gradient(90deg, #10B981, var(--accent, #00BFA5));
}

.progress-bar__text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
}

/* Export versions grid */
.export-versions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.export-version-card {
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.export-version-card:hover {
  border-color: #3B3E47;
  transform: translateY(-1px);
}

.export-version-card__preview {
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.export-version-card__play {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary, #E8EAED);
  cursor: pointer;
  padding-left: 2px;
}

.export-version-card__type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.export-version-card__type-badge--ab {
  background: rgba(124, 58, 237, 0.8);
  color: #fff;
}

.export-version-card__type-badge--mp {
  background: rgba(0, 191, 165, 0.8);
  color: #fff;
}

.export-version-card__body {
  padding: 12px 14px;
}

.export-version-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 4px;
}

.export-version-card__desc {
  font-size: 11px;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 8px;
  line-height: 1.4;
}

.export-version-card__meta {
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: var(--text-muted, #64748B);
}

/* Export settings */
.export-settings {
  margin-bottom: 20px;
}

.export-format-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.export-format-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.export-format-card:hover { border-color: #3B3E47; }

.export-format-card--active {
  border-color: var(--accent, #00BFA5);
  background: rgba(0, 191, 165, 0.04);
}

.export-format-card__radio { flex-shrink: 0; }

.export-format-card__dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border, #2E3139);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.export-format-card__dot--active { border-color: var(--accent, #00BFA5); }

.export-format-card__dot--active::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent, #00BFA5);
}

.export-format-card__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 2px;
}

.export-format-card__desc {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

/* Resolution options */
.resolution-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.resolution-btn {
  padding: 14px;
  background: #1A1C21;
  border: 1px solid var(--border, #2E3139);
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.resolution-btn:hover { border-color: #3B3E47; }

.resolution-btn--active {
  border-color: #7C3AED;
  background: rgba(124, 58, 237, 0.06);
}

.resolution-btn__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #E8EAED);
  margin-bottom: 2px;
}

.resolution-btn--active .resolution-btn__label { color: #A78BFA; }

.resolution-btn__desc {
  font-size: 11px;
  color: var(--text-muted, #64748B);
}

/* Export button */
.btn-export {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0E0F12);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  margin-bottom: 20px;
  font-family: inherit;
}

.btn-export:hover:not(:disabled) {
  background: #0D9488;
  box-shadow: 0 0 20px rgba(0, 191, 165, 0.3);
}

.btn-export:disabled { opacity: 0.7; cursor: not-allowed; }

/* Export complete */
.export-complete {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 12px;
}

.export-complete__icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #10B981;
  flex-shrink: 0;
}

.export-complete__title {
  font-size: 14px;
  font-weight: 600;
  color: #10B981;
  margin-bottom: 6px;
}

.export-complete__links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.export-complete__link {
  font-size: 12px;
  color: var(--accent, #00BFA5);
  text-decoration: underline;
  cursor: pointer;
}

.export-complete__link:hover { color: #5EEAD4; }

/* ══════════════════════════════════════════════════════════════════
 *  Navigation bar
 * ══════════════════════════════════════════════════════════════════ */
.nav-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 32px;
  background: var(--bg-secondary, #1A1C21);
  border-top: 1px solid var(--border, #2E3139);
}

.nav-bar__indicator {
  font-size: 13px;
  color: var(--text-muted, #64748B);
  font-weight: 500;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.nav-btn--ghost {
  background: transparent;
  color: var(--text-secondary, #9CA3AF);
  border: 1px solid var(--border, #2E3139);
}

.nav-btn--ghost:hover:not(:disabled) {
  border-color: #3B3E47;
  color: var(--text-primary, #E8EAED);
}

.nav-btn--cyan {
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0E0F12);
}

.nav-btn--cyan:hover:not(:disabled) {
  background: #0D9488;
}

/* ══════════════════════════════════════════════════════════════════
 *  Shared small buttons
 * ══════════════════════════════════════════════════════════════════ */
.btn-sm {
  padding: 5px 14px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: inherit;
}

.btn-sm--cyan {
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0E0F12);
}

.btn-sm--cyan:hover { background: #0D9488; }

.btn-sm--ghost {
  background: transparent;
  color: var(--text-secondary, #9CA3AF);
  border: 1px solid var(--border, #2E3139);
}

.btn-sm--ghost:hover {
  border-color: #3B3E47;
  color: var(--text-primary, #E8EAED);
}

.btn-sm--active {
  background: var(--accent, #00BFA5);
  color: var(--bg-primary, #0E0F12);
}

/* ══════════════════════════════════════════════════════════════════
 *  Responsive
 * ══════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .platform-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .category-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .music-grid {
    grid-template-columns: 1fr;
  }
  .version-types {
    grid-template-columns: 1fr;
  }
  .resolution-options {
    grid-template-columns: 1fr;
  }
  .step-dot__line { width: 20px; }
  .step-dot { min-width: 48px; }
  .editor-main { padding: 20px 16px; }
  .nav-bar { padding: 12px 16px; }
}

@media (max-width: 480px) {
  .platform-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .category-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .export-versions-grid {
    grid-template-columns: 1fr;
  }
}


/* ===== ENH-16: 热点模板Tab ===== */
.hot-template-tabs { display: flex; gap: 6px; margin-bottom: 16px; background: var(--bg-surface, var(--bg-primary, #0E0F12)); padding: 4px; border-radius: 10px; }
.hot-tab { flex: 1; padding: 8px 16px; border: none; border-radius: 8px; background: transparent; color: var(--text-secondary, var(--text-secondary, #9CA3AF)); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 150ms ease; }
.hot-tab:hover { color: var(--text-primary, var(--text-primary, #E8EAED)); }
.hot-tab--active { background: var(--accent, var(--accent, #00BFA5)); color: var(--bg-primary, var(--bg-primary, #0E0F12)); }
.hot-templates-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.hot-template-card { background: var(--bg-surface, var(--bg-primary, #0E0F12)); border: 1px solid var(--border-default, var(--border, #2E3139)); border-radius: 10px; padding: 14px; cursor: pointer; transition: all 200ms ease; display: flex; flex-direction: column; gap: 6px; }
.hot-template-card:hover { border-color: var(--accent, var(--accent, #00BFA5)); transform: translateY(-2px); }
.hot-template-card--expired { opacity: 0.45; cursor: not-allowed; }
.hot-template-card__header { display: flex; align-items: center; justify-content: space-between; }
.hot-template-card__icon { font-size: 18px; }
.hot-template-card__deadline { font-size: 11px; color: var(--text-muted, var(--text-muted, #64748B)); }
.hot-template-card__name { font-size: 14px; font-weight: 600; }
.hot-template-card__desc { font-size: 12px; color: var(--text-secondary, var(--text-secondary, #9CA3AF)); line-height: 1.4; }
.hot-template-card__expired-badge { display: inline-block; padding: 2px 8px; background: rgba(239, 68, 68, 0.15); color: #EF4444; font-size: 11px; font-weight: 600; border-radius: 4px; align-self: flex-start; }

/* ===== ENH-17: 追踪标签 ===== */
.tracking-tags-section { margin-bottom: 20px; padding: 16px; background: var(--bg-surface, var(--bg-primary, #0E0F12)); border: 1px solid var(--border-default, var(--border, #2E3139)); border-radius: 10px; }
.tracking-tags-input { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.tracking-tag-row { display: flex; gap: 12px; }
.tracking-tag-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.tracking-tag-label { font-size: 11px; font-weight: 600; color: var(--text-muted, var(--text-muted, #64748B)); text-transform: uppercase; letter-spacing: 0.04em; }
.tracking-tags-preview { padding: 8px 12px; background: var(--bg-elevated, #23262E); border: 1px solid var(--border-subtle, #1E1E22); border-radius: 6px; display: flex; align-items: center; gap: 8px; }
.tracking-tags-preview__label { font-size: 11px; color: var(--text-muted, var(--text-muted, #64748B)); flex-shrink: 0; }
.tracking-tags-preview__code { font-size: 12px; color: var(--accent, var(--accent, #00BFA5)); font-family: var(--font-mono, monospace); }

@media (max-width: 768px) { .hot-templates-grid { grid-template-columns: repeat(2, 1fr); } }

</style>
