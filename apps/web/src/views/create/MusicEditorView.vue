<script setup lang="ts">
/**
 * MusicEditorView.vue - 配乐生成器 (双模式)
 *
 * Mode A: 独立配乐生成
 *   Step 1: 选择生成方式（文字描述 / 歌词+曲风 / 参考音频）
 *   Step 2: 参数调整（时长/BPM/调式/乐器/情绪曲线）
 *   Step 3: 生成 + 试听（4 候选 + 变奏）
 *   Step 4: 导出
 *
 * Mode B: 为画面配乐（跨模块联动）
 *   Step 1: 接收镜头列表
 *   Step 2: AI 匹配配乐
 *   Step 3: 整体混音
 *   Step 4: 导出
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useFileDrop } from '../../composables/useFileDrop'
import { generateText, generateMusic } from '@/api/ai-router'
import { useToast } from '@manhuaworks/ui'

const toast = useToast()

/* ------------------------------------------------------------------ */
/*  First-visit empty state                                             */
/* ------------------------------------------------------------------ */

const hasStarted = ref(true)

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EditorMode = 'standalone' | 'scene'
type GenMethod = 'text' | 'lyrics' | 'reference'

interface Candidate {
  id: number
  title: string
  duration: string
  tags: string[]
  selected: boolean
  audioUrl?: string
}

interface Variation {
  id: number
  title: string
  duration: string
  tags: string[]
  audioUrl?: string
}

interface ShotItem {
  id: number
  name: string
  duration: string
  mood: string
  musicGenerated: boolean
  volume: number
  fadeIn: number
  fadeOut: number
  audioUrl?: string
}

interface MoodPoint {
  label: string
  mood: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODE_LABELS: Record<EditorMode, string> = {
  standalone: '独立创作',
  scene: '为画面配乐',
}

const GENRES = ['流行', '古风', '电子', 'R&B', '民谣', '摇滚', '国风', '纯音乐', '影视配乐'] as const
const INSTRUMENTS = ['钢琴', '吉他', '弦乐', '鼓', '贝斯', '合成器', '管乐', '民族乐器'] as const
const KEYS = ['自动', '大调', '小调'] as const
const MOODS = ['欢快', '忧伤', '激昂', '舒缓', '悬疑', '宏大', '温馨', '紧张', '梦幻', '史诗'] as const
const FORMAT_OPTIONS = ['MP3', 'WAV', 'FLAC'] as const
const QUALITY_OPTIONS = ['标准 128kbps', '高 320kbps', '无损'] as const

const MOOD_COLORS: Record<string, string> = {
  欢快: '#10B981',
  忧伤: '#3B82F6',
  激昂: '#EF4444',
  舒缓: '#06B6D4',
  悬疑: '#7C3AED',
  宏大: '#F59E0B',
  温馨: '#EC4899',
  紧张: '#DC2626',
  梦幻: '#8B5CF6',
  史诗: '#D97706',
}

const STANDALONE_STEPS = ['生成方式', '参数调整', '生成试听', '导出']
const SCENE_STEPS = ['镜头列表', 'AI匹配', '混音', '导出']

const SEND_TARGETS = ['动画生成器', '宣传片生成器', '短视频生成器']

/* ------------------------------------------------------------------ */
/*  Shared state                                                       */
/* ------------------------------------------------------------------ */

const mode = ref<EditorMode>('standalone')

/* ------------------------------------------------------------------ */
/*  Mode A: Standalone state                                           */
/* ------------------------------------------------------------------ */

const saStep = ref(1)

// Step 1
const genMethod = ref<GenMethod>('text')
const textDescription = ref('')
const lyricsInput = ref('')
const selectedGenre = ref('古风')

// ENH-10: AI写词
const showAiLyricsModal = ref(false)
const aiLyricsTheme = ref('')
const aiLyricsMood = ref('')
const aiLyricsGenerating = ref(false)
const aiLyricsCandidates = ref<string[]>([])

const MOOD_SUGGESTIONS = ['失恋伤感', '热血励志', '温馨治愈', '暗黑深沉', '甜蜜恋爱', '古风武侠', '治愈系', '暗黑哥特']

async function generateAiLyrics() {
  if (!aiLyricsTheme.value.trim()) return
  aiLyricsGenerating.value = true
  try {
    const result = await generateText({
      prompt: `为以下主题创作3个不同版本的歌词（每版8-12行），主题：${aiLyricsTheme.value}，情感方向：${aiLyricsMood.value || '不限'}。请用数字编号区分三个版本。`,
      systemPrompt: '你是一位专业作词人，擅长各种风格的歌词创作。',
      maxTokens: 800,
    })
    const parts = result.split(/\n\s*(?=(?:版本)?\d+[.、]|[一二三][.、])/).filter(s => s.trim().length > 20)
    aiLyricsCandidates.value = parts.slice(0, 3)
  } catch {
    aiLyricsCandidates.value = [
      `[主歌]\n风起时我想起了你\n雨落时我还在原地\n\n[副歌]\n如果时光可以倒流\n我会把每一句再见都说成你好`,
      `[主歌]\n夜空中最亮的星\n是否能听清 那仰望的人\n\n[副歌]\n我祈祷拥有一颗透明的心灵\n和会流泪的眼睛`,
      `[主歌]\n灯火阑珊处回眸\n万千人海中寻你\n\n[副歌]\n愿你归来仍是少年\n看遍世间美好`,
    ]
  } finally {
    aiLyricsGenerating.value = false
  }
}

function selectAiLyrics(lyrics: string) {
  lyricsInput.value = lyrics
  showAiLyricsModal.value = false
}

const referenceFile = ref<File | null>(null)
const referenceFileName = ref('')
const similarity = ref(80)

// Step 2
const duration = ref(60)
const bpm = ref(120)
const selectedKey = ref('自动')
const selectedInstruments = ref<string[]>(['钢琴'])
const moodCurve = ref<MoodPoint[]>([
  { label: '开头', mood: '舒缓' },
  { label: '高潮', mood: '激昂' },
  { label: '结尾', mood: '舒缓' },
])
const customDurationEnabled = ref(false)

// Step 3
const generating = ref(false)
const candidates = ref<Candidate[]>([])
const selectedCandidateId = ref<number | null>(null)
const variations = ref<Variation[]>([])
const generatingVariation = ref(false)
const isPlaying = ref(false)
const playingId = ref<number | null>(null)
const playbackProgress = ref(0)
const currentAudio = ref<HTMLAudioElement | null>(null)

// Step 4
const exportFormat = ref('MP3')
const exportQuality = ref('高 320kbps')
const sendTarget = ref('')

/* ------------------------------------------------------------------ */
/*  Mode B: Scene state                                                */
/* ------------------------------------------------------------------ */

const scStep = ref(1)

// Step 1
const shotList = ref<ShotItem[]>([])
const hasShotData = ref(false)
const manualShotInput = ref('')

// Step 3 (scene mix)
// ENH-20: BGM嵌入式选择器
interface BgmTrack {
  id: string
  name: string
  category: string
  duration: string
  bpm: number
  mood: string
  waveform: string  // placeholder waveform pattern
  icon: string
  previewUrl?: string
  isPlaying: boolean
}

const bgmTracks = ref<BgmTrack[]>([
  { id: 'bgm-1', name: '清晨阳光', category: '轻松/清新', duration: '2:34', bpm: 90, mood: '轻快', icon: '🌅', waveform: 'light', isPlaying: false },
  { id: 'bgm-2', name: '都市节拍', category: '电子/现代', duration: '3:12', bpm: 128, mood: '动感', icon: '🏙️', waveform: 'electronic', isPlaying: false },
  { id: 'bgm-3', name: '史诗征程', category: '史诗/管弦', duration: '4:05', bpm: 72, mood: '宏伟', icon: '🎺', waveform: 'epic', isPlaying: false },
  { id: 'bgm-4', name: '治愈钢琴', category: '治愈/温情', duration: '3:45', bpm: 60, mood: '温馨', icon: '🎹', waveform: 'soft', isPlaying: false },
  { id: 'bgm-5', name: '悬疑氛围', category: '悬疑/紧张', duration: '2:18', bpm: 110, mood: '紧张', icon: '🔍', waveform: 'tension', isPlaying: false },
  { id: 'bgm-6', name: '国风雅韵', category: '民族/传统', duration: '3:28', bpm: 85, mood: '典雅', icon: '🏮', waveform: 'chinese', isPlaying: false },
  { id: 'bgm-7', name: '科技未来', category: '科技/赛博', duration: '2:55', bpm: 140, mood: '科技感', icon: '🤖', waveform: 'tech', isPlaying: false },
  { id: 'bgm-8', name: '爵士之夜', category: '爵士/复古', duration: '3:50', bpm: 95, mood: '优雅', icon: '🎷', waveform: 'jazz', isPlaying: false },
])

const selectedBgmTrack = ref<BgmTrack | null>(null)
const bgmSearchQuery = ref('')
const bgmCategoryFilter = ref('')
const showBgmSelector = ref(false)

const filteredBgmTracks = computed(() => {
  let tracks = bgmTracks.value
  if (bgmSearchQuery.value) {
    const q = bgmSearchQuery.value.toLowerCase()
    tracks = tracks.filter(t => t.name.toLowerCase().includes(q) || t.mood.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
  }
  if (bgmCategoryFilter.value) {
    tracks = tracks.filter(t => t.category === bgmCategoryFilter.value)
  }
  return tracks
})

const bgmCategories = computed(() => [...new Set(bgmTracks.value.map(t => t.category))])

function selectBgm(track: BgmTrack) {
  // Stop any playing preview
  bgmTracks.value.forEach(t => t.isPlaying = false)
  selectedBgmTrack.value = track
  track.isPlaying = true
  // Simulate preview stop after 5s
  setTimeout(() => { track.isPlaying = false }, 5000)
}

function clearBgm() {
  if (selectedBgmTrack.value) selectedBgmTrack.value.isPlaying = false
  selectedBgmTrack.value = null
}

function toggleBgmPreview(track: BgmTrack, e: Event) {
  e.stopPropagation()
  bgmTracks.value.forEach(t => { if (t.id !== track.id) t.isPlaying = false })
  track.isPlaying = !track.isPlaying
}

// ENH-21: 配乐波形可视化
const waveformAnimationId = ref<number | null>(null)
const waveformCanvas = ref<HTMLCanvasElement | null>(null)

function getWaveformPattern(type: string): number[] {
  const patterns: Record<string, number[]> = {
    light:       [0.3, 0.5, 0.7, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3, 0.2, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3, 0.4, 0.6, 0.8],
    electronic:  [0.8, 0.4, 0.9, 0.3, 1.0, 0.2, 0.9, 0.4, 0.8, 0.5, 0.3, 0.9, 0.6, 0.2, 1.0, 0.3, 0.9, 0.5, 0.8, 0.4],
    epic:        [0.2, 0.4, 0.7, 0.9, 0.5, 0.3, 0.6, 1.0, 0.8, 0.4, 0.2, 0.5, 0.9, 0.7, 0.3, 0.6, 1.0, 0.8, 0.4, 0.2],
    soft:        [0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.3],
    tension:     [0.2, 0.3, 0.9, 0.4, 0.2, 0.8, 0.3, 1.0, 0.5, 0.2, 0.7, 0.3, 0.9, 0.4, 0.2, 1.0, 0.5, 0.3, 0.8, 0.4],
    chinese:     [0.3, 0.5, 0.4, 0.7, 0.3, 0.6, 0.8, 0.4, 0.3, 0.5, 0.7, 0.6, 0.4, 0.3, 0.5, 0.8, 0.7, 0.4, 0.3, 0.6],
    tech:        [0.6, 0.9, 0.4, 0.8, 0.3, 1.0, 0.5, 0.9, 0.4, 0.8, 0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.3, 1.0, 0.5, 0.9],
    jazz:        [0.4, 0.5, 0.3, 0.6, 0.7, 0.5, 0.3, 0.4, 0.6, 0.5, 0.3, 0.7, 0.6, 0.4, 0.3, 0.5, 0.7, 0.6, 0.4, 0.3],
  }
  return patterns[type] || patterns.light
}

function drawWaveform(track: BgmTrack | null) {
  const canvas = waveformCanvas.value
  if (!canvas || !track) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  const w = rect.width; const h = rect.height
  ctx.clearRect(0, 0, w, h)

  const pattern = getWaveformPattern(track.waveform)
  const barWidth = (w / pattern.length) * 0.7
  const gap = (w / pattern.length) * 0.3
  const maxBarH = h * 0.8
  const isPlaying = track.isPlaying

  let offset = isPlaying ? (Date.now() * 0.05) % pattern.length : 0

  ctx.fillStyle = 'rgba(0, 191, 165, 0.6)'
  for (let i = 0; i < pattern.length; i++) {
    const idx = Math.floor((i + offset) % pattern.length)
    const barH = pattern[idx] * maxBarH
    const x = i * (barWidth + gap)
    const y = (h - barH) / 2
    const alpha = isPlaying ? 0.4 + pattern[idx] * 0.6 : 0.5
    ctx.fillStyle = `rgba(0, 191, 165, ${alpha})`
    ctx.fillRect(x, y, barWidth, barH)
  }
}

function startWaveformAnimation() {
  let frameId: number
  function animate() {
    if (selectedBgmTrack.value?.isPlaying) {
      drawWaveform(selectedBgmTrack.value)
    }
    frameId = requestAnimationFrame(animate)
  }
  frameId = requestAnimationFrame(animate)
  waveformAnimationId.value = frameId
}

function stopWaveformAnimation() {
  if (waveformAnimationId.value) {
    cancelAnimationFrame(waveformAnimationId.value)
    waveformAnimationId.value = null
  }
}

const bgmVolume = ref(80)
const voiceoverVolume = ref(100)
const sfxVolume = ref(70)
const crossfadeDuration = ref(2)

// Step 4 (scene export)
const sceneExportMode = ref('完整')
const sceneExportFormat = ref('MP3')
const sceneGeneratingProgress = ref(0)

/* ------------------------------------------------------------------ */
/*  Computed                                                           */
/* ------------------------------------------------------------------ */

const stepLabels = computed(() =>
  mode.value === 'standalone' ? STANDALONE_STEPS : SCENE_STEPS,
)

const currentStep = computed(() =>
  mode.value === 'standalone' ? saStep.value : scStep.value,
)

const canProceedSA1 = computed(() => {
  if (genMethod.value === 'text') return textDescription.value.trim().length > 0
  if (genMethod.value === 'lyrics') return lyricsInput.value.trim().length > 0
  if (genMethod.value === 'reference') return referenceFile.value !== null
  return false
})

const selectedCandidate = computed(() =>
  candidates.value.find(c => c.id === selectedCandidateId.value) ?? null,
)

const selectedShotCount = computed(() =>
  shotList.value.filter(s => s.musicGenerated).length,
)

const allShotsGenerated = computed(() =>
  shotList.value.length > 0 && shotList.value.every(s => s.musicGenerated),
)

/* ------------------------------------------------------------------ */
/*  Mode switch                                                        */
/* ------------------------------------------------------------------ */

function switchMode(m: EditorMode) {
  mode.value = m
}

/* ------------------------------------------------------------------ */
/*  Mode A Step 1: Gen method                                          */
/* ------------------------------------------------------------------ */

const { isDragging: isDraggingRef, onDragEnter, onDragLeave, onDrop } = useFileDrop((files) => {
  const f = files[0]
  if (f && (f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i))) {
    setRefFile(f)
  }
})

function onRefFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) setRefFile(input.files[0])
}

function setRefFile(file: File) {
  referenceFile.value = file
  referenceFileName.value = file.name
}

function removeRefFile() {
  referenceFile.value = null
  referenceFileName.value = ''
}

function toggleInstrument(inst: string) {
  const idx = selectedInstruments.value.indexOf(inst)
  if (idx >= 0) {
    selectedInstruments.value.splice(idx, 1)
  } else {
    selectedInstruments.value.push(inst)
  }
}

/* ------------------------------------------------------------------ */
/*  Mode A Step 3: Generate                                            */
/* ------------------------------------------------------------------ */

async function generateCandidates() {
  generating.value = true
  try {
    const prompt = `生成一首${selectedGenre.value}风格的${moodCurve.value[1]?.mood || '中性'}情绪配乐，BPM约${bpm.value}，时长${duration.value}秒，${selectedKey.value || ''}调`
    const results = await Promise.all([
      generateMusic({ prompt: `${prompt}，版本A`, duration: duration.value }),
      generateMusic({ prompt: `${prompt}，版本B`, duration: duration.value }),
      generateMusic({ prompt: `${prompt}，变奏版A`, duration: duration.value }),
      generateMusic({ prompt: `${prompt}，变奏版B`, duration: duration.value }),
    ])
    candidates.value = [
      { id: 1, title: `${selectedGenre.value}配乐 #1`, duration: `${Math.floor(duration.value / 60)}:${(duration.value % 60).toString().padStart(2, '0')}`, tags: [selectedGenre.value, moodCurve.value[1]?.mood || ''], selected: false, audioUrl: results[0].url },
      { id: 2, title: `${selectedGenre.value}配乐 #2`, duration: `${Math.floor(duration.value / 60)}:${(duration.value % 60).toString().padStart(2, '0')}`, tags: [selectedGenre.value, moodCurve.value[0]?.mood || ''], selected: false, audioUrl: results[1].url },
      { id: 3, title: `${selectedGenre.value}变奏 A`, duration: `${Math.floor(duration.value / 60)}:${(duration.value % 60).toString().padStart(2, '0')}`, tags: [selectedGenre.value, '变奏'], selected: false, audioUrl: results[2].url },
      { id: 4, title: `${selectedGenre.value}变奏 B`, duration: `${Math.floor(duration.value / 60)}:${(duration.value % 60).toString().padStart(2, '0')}`, tags: [selectedGenre.value, moodCurve.value[2]?.mood || ''], selected: false, audioUrl: results[3].url },
    ]
  } catch (err) {
    console.error('音乐生成失败', err)
    candidates.value = [
      { id: 1, title: `${selectedGenre.value}配乐 #1`, duration: `${Math.floor(duration.value / 60)}:${(duration.value % 60).toString().padStart(2, '0')}`, tags: [selectedGenre.value], selected: false, audioUrl: '' },
    ]
  } finally {
    generating.value = false
  }
}

function regenerateCandidates() {
  candidates.value = []
  selectedCandidateId.value = null
  variations.value = []
  generateCandidates()
}

function selectCandidate(id: number) {
  selectedCandidateId.value = id
  candidates.value.forEach(c => { c.selected = c.id === id })
}

function stopAudio() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value.currentTime = 0
    currentAudio.value = null
  }
  isPlaying.value = false
  playingId.value = null
  playbackProgress.value = 0
}

function togglePlay(id: number) {
  // If already playing this track, stop it
  if (isPlaying.value && playingId.value === id) {
    stopAudio()
    return
  }

  // Stop any current playback first
  stopAudio()

  // Find the candidate to get its audioUrl
  const candidate = candidates.value.find(c => c.id === id)
  const audioUrl = candidate?.audioUrl

  isPlaying.value = true
  playingId.value = id
  playbackProgress.value = 0

  if (audioUrl) {
    // Real audio playback using HTML5 Audio
    const audio = new Audio(audioUrl)
    currentAudio.value = audio

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        playbackProgress.value = (audio.currentTime / audio.duration) * 100
      }
    })

    audio.addEventListener('ended', () => {
      isPlaying.value = false
      playingId.value = null
      playbackProgress.value = 0
      currentAudio.value = null
    })

    audio.addEventListener('error', () => {
      console.error('Audio playback failed for URL:', audioUrl)
      isPlaying.value = false
      playingId.value = null
      playbackProgress.value = 0
      currentAudio.value = null
    })

    audio.play().catch((err) => {
      console.error('Failed to start audio playback:', err)
      isPlaying.value = false
      playingId.value = null
      playbackProgress.value = 0
      currentAudio.value = null
    })
  } else {
    // No audio URL available — mock playback progress for UI demo
    const interval = setInterval(() => {
      if (!isPlaying.value || playingId.value !== id) {
        clearInterval(interval)
        return
      }
      playbackProgress.value += 2
      if (playbackProgress.value >= 100) {
        isPlaying.value = false
        playingId.value = null
        playbackProgress.value = 0
        clearInterval(interval)
      }
    }, 100)
  }
}

onUnmounted(() => {
  stopAudio()
})

async function generateVariations() {
  if (!selectedCandidateId.value) return
  generatingVariation.value = true

  const selected = candidates.value.find(c => c.id === selectedCandidateId.value)
  const baseTags = selected?.tags ?? []
  const baseMood = baseTags[1] || baseTags[0] || '中性'
  const baseStyle = baseTags[0] || selectedGenre.value

  const variationDefs = [
    { title: '爵士变奏', style: '爵士', mood: '即兴', duration: 45 },
    { title: '交响变奏', style: '交响', mood: '宏大', duration: 60 },
    { title: '电子混音', style: '电子', mood: '节奏', duration: 50 },
    { title: '原声吉他版', style: '民谣', mood: '温暖', duration: 55 },
  ]

  try {
    const results = await Promise.all(
      variationDefs.map(v =>
        generateMusic({
          prompt: `基于${baseStyle}风格、${baseMood}情绪的配乐，改编为${v.style}版本，${v.mood}氛围`,
          duration: v.duration,
          style: v.style,
        })
      )
    )

    variations.value = variationDefs.map((v, i) => ({
      id: 101 + i,
      title: v.title,
      duration: `${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, '0')}`,
      tags: [v.style, v.mood],
      audioUrl: results[i].url,
    }))
  } catch (err) {
    console.error('变奏生成失败', err)
    variations.value = variationDefs.map((v, i) => ({
      id: 101 + i,
      title: v.title,
      duration: `${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, '0')}`,
      tags: [v.style, v.mood],
      audioUrl: '',
    }))
  } finally {
    generatingVariation.value = false
  }
}

/* ------------------------------------------------------------------ */
/*  Mode A Step 4: Export                                              */
/* ------------------------------------------------------------------ */

function downloadMusic() {
  const audioUrl = selectedCandidate.value?.audioUrl
  const title = selectedCandidate.value?.title ?? '配乐'
  if (audioUrl) {
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `${title}.${exportFormat.value.toLowerCase()}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`正在导出：${title} - ${exportFormat.value} (${exportQuality.value})`)
  } else {
    toast.info('暂无可导出的音频，请先生成配乐')
  }
}

function sendToEditor() {
  const candidate = selectedCandidate.value
  if (!candidate) {
    toast.info('请先选择一首配乐')
    return
  }
  const payload = {
    title: candidate.title,
    audioUrl: candidate.audioUrl ?? '',
    duration: candidate.duration,
    tags: candidate.tags,
    format: exportFormat.value,
    quality: exportQuality.value,
    timestamp: Date.now(),
  }
  sessionStorage.setItem('mhw:music→editor', JSON.stringify(payload))
  toast.success(`已将配乐「${candidate.title}」发送到「${sendTarget.value}」`)
}

/* ------------------------------------------------------------------ */
/*  Mode B Step 1: Shot list                                           */
/* ------------------------------------------------------------------ */

onMounted(() => {
  // 检查 useModuleBridge 的跨模块数据（优先）
  const bridgeKeys = ['mhw:bridge:animation→music', 'mhw:bridge:promo→music', 'mhw:bridge:ad-short→music', 'mhw:bridge:video→music']
  let bridgeData: any = null
  for (const key of bridgeKeys) {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      try { bridgeData = JSON.parse(raw); sessionStorage.removeItem(key); break } catch { /* ignore */ }
    }
  }
  if (bridgeData && bridgeData.shots && bridgeData.shots.length > 0) {
    shotList.value = bridgeData.shots.map((s: any, i: number) => ({
      id: i + 1,
      name: s.title || `镜头 ${s.shotNumber || i + 1}`,
      duration: `${s.durationSec || 5}s`,
      mood: s.mood || '中性',
      musicGenerated: false,
      volume: 80,
      fadeIn: 1,
      fadeOut: 1,
    }))
    hasShotData.value = true
    // 自动切换到 Mode B（为画面配乐）
    mode.value = 'scene'
  } else {
    // 检查旧格式 key
    const storedShots = sessionStorage.getItem('crossEditor_shotList')
    if (storedShots) {
      try {
        shotList.value = JSON.parse(storedShots)
        hasShotData.value = true
      } catch {
        hasShotData.value = false
      }
    } else {
    // Provide mock data for demo
    shotList.value = [
      { id: 1, name: '开场 - 城市全景', duration: '5s', mood: '宏大', musicGenerated: false, volume: 80, fadeIn: 1, fadeOut: 1 },
      { id: 2, name: '主角登场', duration: '8s', mood: '欢快', musicGenerated: false, volume: 85, fadeIn: 0.5, fadeOut: 0.5 },
      { id: 3, name: '冲突爆发', duration: '12s', mood: '激昂', musicGenerated: false, volume: 90, fadeIn: 0.3, fadeOut: 1 },
      { id: 4, name: '情感转折', duration: '10s', mood: '忧伤', musicGenerated: false, volume: 75, fadeIn: 1.5, fadeOut: 1.5 },
      { id: 5, name: '高潮决战', duration: '15s', mood: '史诗', musicGenerated: false, volume: 95, fadeIn: 0.5, fadeOut: 2 },
      { id: 6, name: '结尾余韵', duration: '8s', mood: '舒缓', musicGenerated: false, volume: 70, fadeIn: 2, fadeOut: 3 },
    ]
    hasShotData.value = true
    }
  }
})

function addManualShot() {
  if (!manualShotInput.value.trim()) return
  const id = shotList.value.length + 1
  shotList.value.push({
    id,
    name: manualShotInput.value.trim(),
    duration: '10s',
    mood: '舒缓',
    musicGenerated: false,
    volume: 80,
    fadeIn: 1,
    fadeOut: 1,
  })
  manualShotInput.value = ''
}

function removeShot(id: number) {
  shotList.value = shotList.value.filter(s => s.id !== id)
}

/* ------------------------------------------------------------------ */
/*  Mode B Step 2: AI match                                            */
/* ------------------------------------------------------------------ */

async function generateAllShotMusic() {
  const shots = shotList.value
  const total = shots.length
  if (total === 0) return

  sceneGeneratingProgress.value = 0

  // Generate music for all shots in parallel, updating progress as each completes
  const promises = shots.map(async (shot, idx) => {
    try {
      const durationSec = parseInt(shot.duration) || 10
      const result = await generateMusic({
        prompt: `为「${shot.name}」镜头配乐，情绪：${shot.mood}，时长约${durationSec}秒`,
        duration: durationSec,
        style: shot.mood,
      })
      shot.audioUrl = result.url
      shot.musicGenerated = true
    } catch (err) {
      console.error(`镜头 ${shot.name} 配乐生成失败`, err)
      shot.musicGenerated = true // Mark as done even on failure so UI can proceed
      shot.audioUrl = ''
    } finally {
      sceneGeneratingProgress.value = Math.round(((idx + 1) / total) * 100)
    }
  })

  await Promise.all(promises)
  sceneGeneratingProgress.value = 100
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

function nextStep() {
  if (mode.value === 'standalone') {
    if (saStep.value < 4) saStep.value += 1
  } else {
    if (scStep.value < 4) scStep.value += 1
  }
}

function prevStep() {
  if (mode.value === 'standalone') {
    if (saStep.value > 1) saStep.value -= 1
  } else {
    if (scStep.value > 1) scStep.value -= 1
  }
}

function goToStep(n: number) {
  if (mode.value === 'standalone') {
    if (n < saStep.value) saStep.value = n
  } else {
    if (n < scStep.value) scStep.value = n
  }
}

/* ------------------------------------------------------------------ */
/*  Mode B Step 4: Export                                              */
/* ------------------------------------------------------------------ */

function exportSceneAudio() {
  const shotsWithAudio = shotList.value.filter(s => s.audioUrl)
  if (shotsWithAudio.length === 0) {
    toast.info('暂无可导出的音频，请先生成镜头配乐')
    return
  }
  if (sceneExportMode.value === '完整') {
    // For full export, trigger download of the first available audio URL
    // (a real implementation would mix all tracks; here we download the primary one)
    const url = shotsWithAudio[0].audioUrl!
    const a = document.createElement('a')
    a.href = url
    a.download = `scene-mix.${sceneExportFormat.value.toLowerCase()}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`正在导出：${sceneExportMode.value}音频 - ${sceneExportFormat.value}`)
  } else {
    // Segmented mode — trigger download for each shot's audio
    exportSegments()
  }
}

function sendBackToEditor() {
  const audioData = shotList.value.map(shot => ({
    shotId: shot.id,
    name: shot.name,
    duration: shot.duration,
    mood: shot.mood,
    audioUrl: shot.audioUrl ?? '',
    volume: shot.volume,
    fadeIn: shot.fadeIn,
    fadeOut: shot.fadeOut,
  }))
  const payload = {
    mode: 'scene',
    shots: audioData,
    exportMode: sceneExportMode.value,
    exportFormat: sceneExportFormat.value,
    timestamp: Date.now(),
  }
  sessionStorage.setItem('mhw:music→editor:scene', JSON.stringify(payload))
  toast.success('已将音频数据发送回编辑器')
}

function exportSegments() {
  const shotsWithAudio = shotList.value.filter(s => s.audioUrl)
  if (shotsWithAudio.length === 0) {
    toast.info('暂无可导出的分段音频，请先生成镜头配乐')
    return
  }
  shotsWithAudio.forEach(shot => {
    const a = document.createElement('a')
    a.href = shot.audioUrl!
    a.download = `${shot.name.replace(/[\\/:*?"<>|]/g, '_')}.${sceneExportFormat.value.toLowerCase()}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
  toast.success(`已导出 ${shotsWithAudio.length} 个分段音频`)
}

// ── 草稿自动保存 ──
const DRAFT_KEY_MU = 'mhw:draft:music'
watch([mode, genMethod, textDescription, lyricsInput, selectedGenre, candidates], () => {
  try {
    sessionStorage.setItem(DRAFT_KEY_MU, JSON.stringify({
      mode: mode.value,
      genMethod: genMethod.value,
      textDescription: textDescription.value,
      lyricsInput: lyricsInput.value,
      selectedGenre: selectedGenre.value,
      candidateUrls: candidates.value.filter(c => c.audioUrl).map(c => ({
        id: c.id, title: c.title, audioUrl: c.audioUrl
      })),
      savedAt: new Date().toISOString()
    }))
  } catch { /* storage full */ }
}, { deep: true })
// 恢复草稿
onMounted(() => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY_MU)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.textDescription) textDescription.value = d.textDescription
      if (d.lyricsInput) lyricsInput.value = d.lyricsInput
      if (d.selectedGenre) selectedGenre.value = d.selectedGenre
    }
  } catch { /* ignore */ }
})
</script>

<template>
  <!-- ══════ P4-1: 首访空态 ══════ -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">🎵</div>
      <h2 class="qe-empty__title">暂无配乐项目</h2>
      <p class="qe-empty__desc">开始创作第一支配乐，AI将根据你的描述生成独特配乐</p>
      <button class="qe-empty__btn" @click="hasStarted = true">🎵 开始创作</button>
    </div>
    <div class="music-editor" v-else>

    <!-- ==================== Mode Toggle ==================== -->
    <div class="mode-toggle">
      <button
        v-for="m in (['standalone', 'scene'] as EditorMode[])"
        :key="m"
        class="mode-toggle__btn"
        :class="{ 'mode-toggle__btn--active': mode === m }"
        @click="switchMode(m)"
      >
        {{ MODE_LABELS[m] }}
      </button>
    </div>

    <!-- ==================== Step Indicator ==================== -->
    <div class="step-indicator">
      <div
        v-for="(label, idx) in stepLabels"
        :key="idx"
        class="step-indicator__item"
        :class="{
          'step-indicator__item--active': currentStep === idx + 1,
          'step-indicator__item--done': currentStep > idx + 1,
        }"
        @click="goToStep(idx + 1)"
      >
        <div class="step-indicator__dot">
          <span v-if="currentStep > idx + 1" class="step-indicator__check">&#10003;</span>
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <span class="step-indicator__label">{{ label }}</span>
        <div v-if="idx < stepLabels.length - 1" class="step-indicator__line" />
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- ==================== MODE A ============================= -->
    <!-- ======================================================== -->

    <!-- Step 1: 选择生成方式 -->
    <div v-if="mode === 'standalone' && saStep === 1" class="step-content">
      <header class="step-header">
        <h1 class="step-title">选择生成方式</h1>
        <p class="step-subtitle">选择你偏好的音乐描述方式，AI 将据此生成配乐</p>
      </header>

      <!-- Method cards -->
      <div class="method-grid">
        <button
          class="method-card"
          :class="{ 'method-card--active': genMethod === 'text' }"
          @click="genMethod = 'text'"
        >
          <div class="method-card__icon">&#9998;</div>
          <h3 class="method-card__title">文字描述生成</h3>
          <p class="method-card__desc">用自然语言描述你想要的音乐风格和氛围</p>
        </button>
        <button
          class="method-card"
          :class="{ 'method-card--active': genMethod === 'lyrics' }"
          @click="genMethod = 'lyrics'"
        >
          <div class="method-card__icon">&#9835;</div>
          <h3 class="method-card__title">歌词 + 曲风生成</h3>
          <p class="method-card__desc">输入歌词并选择曲风，AI 谱曲配唱</p>
        </button>
        <button
          class="method-card"
          :class="{ 'method-card--active': genMethod === 'reference' }"
          @click="genMethod = 'reference'"
        >
          <div class="method-card__icon">&#9836;</div>
          <h3 class="method-card__title">参考音频生成</h3>
          <p class="method-card__desc">上传参考音频，生成相似风格的全新配乐</p>
        </button>
      </div>

      <!-- Input area based on method -->
      <section class="section">
        <!-- Text mode -->
        <div v-if="genMethod === 'text'">
          <h2 class="section__label">描述你想要的音乐</h2>
          <textarea
            v-model="textDescription"
            class="textarea"
            rows="5"
            placeholder="例如：一首轻快的电子流行曲，带有明亮的合成器音色和跳跃的节奏，适合科技产品展示视频..."
          />
        </div>

        <!-- Lyrics mode -->
        <div v-if="genMethod === 'lyrics'">
          <div class="lyrics-header">
            <h2 class="section__label">输入歌词</h2>
            <button class="ai-lyrics-btn" @click="showAiLyricsModal = true">🎤 AI写词</button>
          </div>
          <textarea
            v-model="lyricsInput"
            class="textarea"
            rows="6"
            placeholder="[主歌]&#10;在这里输入你的歌词...&#10;&#10;[副歌]&#10;继续输入..."
          />
          <h2 class="section__label" style="margin-top: 20px">选择曲风</h2>
          <div class="genre-grid">
            <button
              v-for="g in GENRES"
              :key="g"
              class="genre-btn"
              :class="{ 'genre-btn--active': selectedGenre === g }"
              @click="selectedGenre = g"
            >
              {{ g }}
            </button>
          </div>
        </div>

        <!-- Reference mode -->
        <div v-if="genMethod === 'reference'">
          <h2 class="section__label">上传参考音频</h2>
          <div
            v-if="!referenceFile"
            class="ref-upload-zone"
            :class="{ 'ref-upload-zone--drag': isDraggingRef }"
            role="button"
            tabindex="0"
            aria-label="拖拽或点击上传参考音频"
            @dragover.prevent
            @dragenter.prevent="onDragEnter"
            @dragleave.prevent="onDragLeave"
            @drop="onDrop"
            @click="($refs.refFileInput as HTMLInputElement).click()"
            @keydown.enter.prevent="($refs.refFileInput as HTMLInputElement).click()"
            @keydown.space.prevent="($refs.refFileInput as HTMLInputElement).click()"
          >
            <input ref="refFileInput" type="file" accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a" hidden @change="onRefFileInput" />
            <svg class="ref-upload-zone__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M24 32V12m0 0l-8 8m8-8l8 8" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="4" y="4" width="40" height="40" rx="8" stroke-dasharray="4 4" opacity="0.3"/>
            </svg>
            <p class="ref-upload-zone__text">拖放音频文件到此处，或 <span>点击上传</span></p>
            <p class="ref-upload-zone__hint">支持 MP3 / WAV / FLAC / OGG</p>
          </div>
          <div v-else class="ref-file-info">
            <div class="ref-file-info__name">&#9835; {{ referenceFileName }}</div>
            <button class="btn btn--ghost btn--sm" @click="removeRefFile">移除</button>
          </div>

          <h2 class="section__label" style="margin-top: 20px">相似度</h2>
          <div class="slider-row">
            <input
              v-model.number="similarity"
              type="range"
              min="60"
              max="100"
              class="slider"
            />
            <span class="slider-val">{{ similarity }}%</span>
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--primary btn--lg" :disabled="!canProceedSA1" @click="nextStep">
          下一步
        </button>
      </div>
    </div>

    <!-- Step 2: 参数调整 -->
    <div v-if="mode === 'standalone' && saStep === 2" class="step-content">
      <header class="step-header">
        <h1 class="step-title">参数调整</h1>
        <p class="step-subtitle">精细调节音乐参数，获得更精准的生成结果</p>
      </header>

      <!-- Duration -->
      <section class="section">
        <h2 class="section__label">时长</h2>
        <div class="duration-chips">
          <button
            v-for="d in [15, 30, 60]"
            :key="d"
            class="chip"
            :class="{ 'chip--active': duration === d && !customDurationEnabled }"
            @click="duration = d; customDurationEnabled = false"
          >
            {{ d }}s
          </button>
          <button
            class="chip"
            :class="{ 'chip--active': customDurationEnabled }"
            @click="customDurationEnabled = true"
          >
            自定义
          </button>
        </div>
        <div v-if="customDurationEnabled" class="slider-row" style="margin-top: 12px">
          <input v-model.number="duration" type="range" min="10" max="180" class="slider" />
          <span class="slider-val">{{ duration }}s</span>
        </div>
      </section>

      <!-- BPM -->
      <section class="section">
        <h2 class="section__label">BPM (节拍速度)</h2>
        <div class="slider-row">
          <input v-model.number="bpm" type="range" min="40" max="200" class="slider" />
          <span class="slider-val">{{ bpm }} BPM</span>
        </div>
      </section>

      <!-- Key/Mode -->
      <section class="section">
        <h2 class="section__label">调式</h2>
        <div class="chip-row">
          <button
            v-for="k in KEYS"
            :key="k"
            class="chip"
            :class="{ 'chip--active': selectedKey === k }"
            @click="selectedKey = k"
          >
            {{ k }}
          </button>
        </div>
      </section>

      <!-- Instruments -->
      <section class="section">
        <h2 class="section__label">乐器选择</h2>
        <div class="instrument-grid">
          <button
            v-for="inst in INSTRUMENTS"
            :key="inst"
            class="inst-btn"
            :class="{ 'inst-btn--active': selectedInstruments.includes(inst) }"
            @click="toggleInstrument(inst)"
          >
            {{ inst }}
          </button>
        </div>
      </section>

      <!-- Mood Curve -->
      <section class="section">
        <h2 class="section__label">情绪曲线（开头 → 高潮 → 结尾）</h2>
        <div class="mood-curve">
          <div v-for="(point, idx) in moodCurve" :key="idx" class="mood-curve__point">
            <span class="mood-curve__label">{{ point.label }}</span>
            <select v-model="point.mood" class="mood-curve__select">
              <option v-for="mood in MOODS" :key="mood" :value="mood">{{ mood }}</option>
            </select>
            <div
              class="mood-curve__dot"
              :style="{ background: MOOD_COLORS[point.mood] ?? '#71717A' }"
            />
          </div>
          <div class="mood-curve__line" />
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button class="btn btn--primary btn--lg" @click="nextStep">下一步</button>
      </div>
    </div>

    <!-- Step 3: 生成 + 试听 -->
    <div v-if="mode === 'standalone' && saStep === 3" class="step-content">
      <header class="step-header">
        <h1 class="step-title">生成 + 试听</h1>
        <p class="step-subtitle">AI 已生成 4 个候选版本，试听后选择最佳</p>
      </header>

      <!-- Generate button (if no candidates yet) -->
      <section v-if="candidates.length === 0" class="section">
        <div class="generate-area">
          <button
            class="btn btn--primary btn--xl"
            :disabled="generating"
            @click="generateCandidates"
          >
            <span v-if="generating" class="btn__spinner" />
            {{ generating ? 'AI 生成中...' : '生成配乐' }}
          </button>
          <p class="generate-hint">将生成 4 个候选版本供试听</p>
        </div>
      </section>

      <!-- Candidate list -->
      <section v-if="candidates.length > 0" class="section">
        <h2 class="section__label">候选版本</h2>
        <div class="candidate-list">
          <div
            v-for="c in candidates"
            :key="c.id"
            class="candidate-item"
            :class="{ 'candidate-item--selected': selectedCandidateId === c.id }"
          >
            <button class="candidate-item__play" @click="togglePlay(c.id)">
              <span v-if="isPlaying && playingId === c.id">&#9646;&#9646;</span>
              <span v-else>&#9654;</span>
            </button>
            <div class="candidate-item__info">
              <span class="candidate-item__title">{{ c.title }}</span>
              <div class="candidate-item__tags">
                <span
                  v-for="tag in c.tags"
                  :key="tag"
                  class="mini-tag"
                  :style="{ background: (MOOD_COLORS[tag] ?? '#3F3F46') }"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <span class="candidate-item__dur">{{ c.duration }}</span>
            <!-- Waveform placeholder --><!-- ENH-20: BGM嵌入式选择器 -->
            <div class="music-bgm-section">
              <div class="music-bgm-header" @click="showBgmSelector = !showBgmSelector">
                <h3 class="music-section-title">🎵 选择背景音乐</h3>
                <span v-if="selectedBgmTrack" class="music-bgm-current">
                  {{ selectedBgmTrack.icon }} {{ selectedBgmTrack.name }} · {{ selectedBgmTrack.bpm }}BPM
                </span>
                <span class="music-section-toggle">{{ showBgmSelector ? '收起' : '展开' }}</span>
              </div>

              <div v-if="showBgmSelector" class="music-bgm-body">
                <!-- Search + filter -->
                <div class="music-bgm-controls">
                  <input
                    v-model="bgmSearchQuery"
                    type="text"
                    class="form-input"
                    placeholder="搜索BGM名称、风格、情绪..."
                  />
                  <select v-model="bgmCategoryFilter" class="form-select">
                    <option value="">全部分类</option>
                    <option v-for="cat in bgmCategories" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                </div>

                <!-- Track list -->
                <div class="music-bgm-grid" v-if="filteredBgmTracks.length > 0">
                  <div
                    v-for="track in filteredBgmTracks"
                    :key="track.id"
                    class="music-bgm-card"
                    :class="{ 'music-bgm-card--selected': selectedBgmTrack?.id === track.id, 'music-bgm-card--playing': track.isPlaying }"
                    @click="selectBgm(track)"
                  >
                    <div class="music-bgm-card__top">
                      <span class="music-bgm-card__icon">{{ track.icon }}</span>
                      <div class="music-bgm-card__info">
                        <span class="music-bgm-card__name">{{ track.name }}</span>
                        <span class="music-bgm-card__meta">{{ track.category }} · {{ track.bpm }}BPM · {{ track.duration }}</span>
                      </div>
                      <button
                        class="music-bgm-card__preview"
                        :class="{ 'music-bgm-card__preview--active': track.isPlaying }"
                        @click="toggleBgmPreview(track, $event)"
                      >
                        {{ track.isPlaying ? '⏸' : '▶' }}
                      </button>
                    </div>
                    <div class="music-bgm-card__mood">
                      <span class="music-bgm-card__mood-tag">{{ track.mood }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="music-bgm-empty">没有找到匹配的BGM</div>

                <!-- Clear selection -->
                <div v-if="selectedBgmTrack" class="music-bgm-selected-footer">
                  <span>已选择: {{ selectedBgmTrack.icon }} {{ selectedBgmTrack.name }}</span>
                  <button class="music-bgm-clear" @click="clearBgm">清除</button>
                </div>
              </div>
            </div>

            <!-- ENH-21: 波形可视化 -->
            <div v-if="selectedBgmTrack" class="music-waveform-section">
              <div class="music-waveform-header">
                <h3 class="music-section-title">📊 {{ selectedBgmTrack.isPlaying ? '正在预览波形' : '波形预览' }}</h3>
                <span class="music-waveform-info">{{ selectedBgmTrack.bpm }} BPM · {{ selectedBgmTrack.mood }}</span>
              </div>
              <div class="music-waveform-canvas-wrap">
                <canvas ref="waveformCanvas" class="music-waveform-canvas" />
              </div>
              <div v-if="!selectedBgmTrack.isPlaying" class="music-waveform-static">
                <!-- Static waveform bars -->
                <div class="music-waveform-bars">
                  <span
                    v-for="(v, idx) in getWaveformPattern(selectedBgmTrack.waveform)"
                    :key="idx"
                    class="music-waveform-bar"
                    :style="{ height: (v * 100) + '%' }"
                  />
                </div>
              </div>
            </div>


            <div class="candidate-item__wave">
              <div v-for="i in 24" :key="i" class="wave-bar" :style="{ height: `${20 + Math.random() * 60}%` }" />
              <div
                v-if="isPlaying && playingId === c.id"
                class="wave-progress"
                :style="{ width: `${playbackProgress}%` }"
              />
            </div>
            <button
              class="btn btn--sm"
              :class="selectedCandidateId === c.id ? 'btn--primary' : 'btn--outline'"
              @click="selectCandidate(c.id)"
            >
              {{ selectedCandidateId === c.id ? '已选' : '选择' }}
            </button>
          </div>
        </div>

        <div class="candidate-actions">
          <button class="btn btn--outline btn--sm" @click="regenerateCandidates">
            重新生成
          </button>
          <button
            class="btn btn--ghost btn--sm"
            :disabled="!selectedCandidateId || generatingVariation"
            @click="generateVariations"
          >
            <span v-if="generatingVariation" class="btn__spinner" />
            {{ generatingVariation ? '变奏生成中...' : '变奏' }}
          </button>
        </div>
      </section>

      <!-- Variations -->
      <section v-if="variations.length > 0" class="section">
        <h2 class="section__label">变奏版本</h2>
        <div class="variation-grid">
          <div v-for="v in variations" :key="v.id" class="variation-card">
            <button class="variation-card__play" @click="togglePlay(v.id)">&#9654;</button>
            <div class="variation-card__info">
              <span class="variation-card__title">{{ v.title }}</span>
              <div class="variation-card__tags">
                <span v-for="tag in v.tags" :key="tag" class="mini-tag" :style="{ background: (MOOD_COLORS[tag] ?? '#3F3F46') }">{{ tag }}</span>
              </div>
            </div>
            <span class="variation-card__dur">{{ v.duration }}</span>
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button
          class="btn btn--primary btn--lg"
          :disabled="!selectedCandidateId"
          @click="nextStep"
        >
          下一步
        </button>
      </div>
    </div>

    <!-- Step 4: 导出 (Mode A) -->
    <div v-if="mode === 'standalone' && saStep === 4" class="step-content">
      <header class="step-header">
        <h1 class="step-title">导出配乐</h1>
        <p class="step-subtitle">选择格式和质量，下载或发送到其他编辑器</p>
      </header>

      <section class="section">
        <h2 class="section__label">导出格式</h2>
        <div class="export-options">
          <button
            v-for="fmt in FORMAT_OPTIONS"
            :key="fmt"
            class="export-opt"
            :class="{ 'export-opt--active': exportFormat === fmt }"
            @click="exportFormat = fmt"
          >
            {{ fmt }}
          </button>
        </div>
      </section>

      <section class="section">
        <h2 class="section__label">音质</h2>
        <div class="export-options">
          <button
            v-for="q in QUALITY_OPTIONS"
            :key="q"
            class="export-opt"
            :class="{ 'export-opt--active': exportQuality === q }"
            @click="exportQuality = q"
          >
            {{ q }}
          </button>
        </div>
      </section>

      <section class="section">
        <h2 class="section__label">发送到编辑器（可选）</h2>
        <div class="send-row">
          <select v-model="sendTarget" class="form-select">
            <option value="">-- 选择目标编辑器 --</option>
            <option v-for="t in SEND_TARGETS" :key="t" :value="t">{{ t }}</option>
          </select>
          <button class="btn btn--outline btn--sm" :disabled="!sendTarget" @click="sendToEditor">发送</button>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">返回编辑</button>
        <button class="btn btn--primary btn--xl" @click="downloadMusic">
          下载配乐
        </button>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- ==================== MODE B ============================= -->
    <!-- ======================================================== -->

    <!-- Step 1: 接收镜头列表 -->
    <div v-if="mode === 'scene' && scStep === 1" class="step-content">
      <header class="step-header">
        <h1 class="step-title">接收镜头列表</h1>
        <p class="step-subtitle">从动画/宣传片/短视频编辑器导入的镜头列表</p>
      </header>

      <div v-if="hasShotData && shotList.length > 0" class="section">
        <h2 class="section__label">镜头列表（{{ shotList.length }} 个镜头）</h2>
        <div class="shot-list">
          <div v-for="shot in shotList" :key="shot.id" class="shot-item">
            <div class="shot-item__num">#{{ shot.id }}</div>
            <div class="shot-item__info">
              <span class="shot-item__name">{{ shot.name }}</span>
              <span class="shot-item__dur">{{ shot.duration }}</span>
            </div>
            <span
              class="shot-item__mood"
              :style="{ background: MOOD_COLORS[shot.mood] ?? '#3F3F46' }"
            >
              {{ shot.mood }}
            </span>
            <button class="btn btn--ghost btn--sm" @click="removeShot(shot.id)">移除</button>
          </div>
        </div>
      </div>

      <div v-else class="section">
        <div class="empty-state">
          <p class="empty-state__text">未检测到镜头数据</p>
          <p class="empty-state__hint">请从动画/宣传片/短视频编辑器跳转过来，或手动输入镜头信息</p>
        </div>
      </div>

      <!-- Manual add -->
      <section class="section">
        <h2 class="section__label">手动添加镜头</h2>
        <div class="manual-add-row">
          <input
            v-model="manualShotInput"
            class="form-field__input"
            type="text"
            placeholder="输入镜头描述，例如：主角奔跑穿过街道"
            @keyup.enter="addManualShot"
          />
          <button class="btn btn--outline btn--sm" @click="addManualShot">添加</button>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--primary btn--lg" :disabled="shotList.length === 0" @click="nextStep">
          下一步
        </button>
      </div>
    </div>

    <!-- Step 2: AI 匹配配乐 -->
    <div v-if="mode === 'scene' && scStep === 2" class="step-content">
      <header class="step-header">
        <h1 class="step-title">AI 匹配配乐</h1>
        <p class="step-subtitle">为每个镜头自动生成匹配的音乐片段</p>
      </header>

      <!-- Timeline view -->
      <section class="section">
        <h2 class="section__label">镜头 + 音乐时间线</h2>
        <div class="timeline-view">
          <!-- Shot row -->
          <div class="timeline-row timeline-row--shots">
            <span class="timeline-row__label">镜头</span>
            <div class="timeline-track">
              <div
                v-for="shot in shotList"
                :key="shot.id"
                class="timeline-segment"
                :style="{
                  flex: parseInt(shot.duration) || 10,
                  background: MOOD_COLORS[shot.mood] + '33',
                  borderColor: MOOD_COLORS[shot.mood] + '66',
                }"
              >
                <span class="timeline-segment__name">{{ shot.name }}</span>
                <span class="timeline-segment__mood">{{ shot.mood }}</span>
              </div>
            </div>
          </div>
          <!-- Music row -->
          <div class="timeline-row timeline-row--music">
            <span class="timeline-row__label">音乐</span>
            <div class="timeline-track">
              <div
                v-for="shot in shotList"
                :key="'m-' + shot.id"
                class="timeline-segment timeline-segment--music"
                :class="{ 'timeline-segment--generated': shot.musicGenerated }"
                :style="{
                  flex: parseInt(shot.duration) || 10,
                  background: shot.musicGenerated ? (MOOD_COLORS[shot.mood] ?? '#3F3F46') + '44' : 'rgba(255,255,255,0.03)',
                  borderColor: shot.musicGenerated ? (MOOD_COLORS[shot.mood] ?? '#3F3F46') + '88' : '#27272A',
                }"
              >
                <span v-if="shot.musicGenerated" class="timeline-segment__check">&#10003;</span>
                <span v-else class="timeline-segment__pending">待生成</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Per-shot controls -->
      <section v-if="allShotsGenerated" class="section">
        <h2 class="section__label">逐镜头调整</h2>
        <div class="shot-adjust-list">
          <div v-for="shot in shotList" :key="shot.id" class="shot-adjust">
            <div class="shot-adjust__header">
              <span class="shot-adjust__name">#{{ shot.id }} {{ shot.name }}</span>
              <span
                class="shot-adjust__mood"
                :style="{ background: MOOD_COLORS[shot.mood] ?? '#3F3F46' }"
              >
                {{ shot.mood }}
              </span>
            </div>
            <div class="shot-adjust__controls">
              <label class="shot-adjust__field">
                <span>音量</span>
                <input v-model.number="shot.volume" type="range" min="0" max="100" class="slider slider--sm" />
                <span class="slider-val slider-val--sm">{{ shot.volume }}%</span>
              </label>
              <label class="shot-adjust__field">
                <span>淡入</span>
                <input v-model.number="shot.fadeIn" type="range" min="0" max="5" step="0.5" class="slider slider--sm" />
                <span class="slider-val slider-val--sm">{{ shot.fadeIn }}s</span>
              </label>
              <label class="shot-adjust__field">
                <span>淡出</span>
                <input v-model.number="shot.fadeOut" type="range" min="0" max="5" step="0.5" class="slider slider--sm" />
                <span class="slider-val slider-val--sm">{{ shot.fadeOut }}s</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <!-- Generate button -->
      <section v-if="!allShotsGenerated" class="section">
        <div class="generate-area">
          <button class="btn btn--primary btn--xl" @click="generateAllShotMusic">
            AI 为所有镜头生成配乐
          </button>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button
          class="btn btn--primary btn--lg"
          :disabled="!allShotsGenerated"
          @click="nextStep"
        >
          下一步
        </button>
      </div>
    </div>

    <!-- Step 3: 整体混音 -->
    <div v-if="mode === 'scene' && scStep === 3" class="step-content">
      <header class="step-header">
        <h1 class="step-title">整体混音</h1>
        <p class="step-subtitle">调整全局音量和过渡效果，预览完整混音</p>
      </header>

      <!-- Full timeline -->
      <section class="section">
        <h2 class="section__label">完整时间线</h2>
        <div class="full-timeline">
          <div class="full-timeline__track">
            <div
              v-for="shot in shotList"
              :key="shot.id"
              class="full-timeline__segment"
              :style="{
                flex: parseInt(shot.duration) || 10,
                background: (MOOD_COLORS[shot.mood] ?? '#3F3F46') + '55',
                borderColor: MOOD_COLORS[shot.mood] ?? '#3F3F46',
              }"
            >
              <span class="full-timeline__seg-label">{{ shot.name }}</span>
            </div>
          </div>
          <div class="full-timeline__playhead" />
        </div>
      </section>

      <!-- Global volume controls -->
      <section class="section">
        <h2 class="section__label">全局音量控制</h2>
        <div class="volume-controls">
          <div class="volume-control">
            <span class="volume-control__label">BGM 总音量</span>
            <input v-model.number="bgmVolume" type="range" min="0" max="100" class="slider" />
            <span class="slider-val">{{ bgmVolume }}%</span>
          </div>
          <div class="volume-control">
            <span class="volume-control__label">配音音量</span>
            <input v-model.number="voiceoverVolume" type="range" min="0" max="100" class="slider" />
            <span class="slider-val">{{ voiceoverVolume }}%</span>
          </div>
          <div class="volume-control">
            <span class="volume-control__label">音效音量</span>
            <input v-model.number="sfxVolume" type="range" min="0" max="100" class="slider" />
            <span class="slider-val">{{ sfxVolume }}%</span>
          </div>
        </div>
      </section>

      <!-- Cross-fade -->
      <section class="section">
        <h2 class="section__label">片段间交叉淡入淡出</h2>
        <div class="slider-row">
          <input v-model.number="crossfadeDuration" type="range" min="0" max="5" step="0.5" class="slider" />
          <span class="slider-val">{{ crossfadeDuration }}s</span>
        </div>
      </section>

      <!-- Preview -->
      <section class="section">
        <div class="generate-area">
          <button class="btn btn--primary btn--lg" @click="isPlaying = !isPlaying">
            {{ isPlaying ? '停止预览' : '预览完整混音' }}
          </button>
          <p class="generate-hint">混音预览功能开发中</p>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button class="btn btn--primary btn--lg" @click="nextStep">下一步</button>
      </div>
    </div>

    <!-- Step 4: 导出 (Mode B) -->
    <div v-if="mode === 'scene' && scStep === 4" class="step-content">
      <header class="step-header">
        <h1 class="step-title">导出画面配乐</h1>
        <p class="step-subtitle">导出混音结果或分段音频，发送回编辑器</p>
      </header>

      <section class="section">
        <h2 class="section__label">导出方式</h2>
        <div class="export-options">
          <button
            class="export-opt"
            :class="{ 'export-opt--active': sceneExportMode === '完整' }"
            @click="sceneExportMode = '完整'"
          >
            完整音频轨道
          </button>
          <button
            class="export-opt"
            :class="{ 'export-opt--active': sceneExportMode === '分段' }"
            @click="sceneExportMode = '分段'"
          >
            分段音频
          </button>
        </div>
      </section>

      <section class="section">
        <h2 class="section__label">导出格式</h2>
        <div class="export-options">
          <button
            v-for="fmt in ['MP3', 'WAV']"
            :key="fmt"
            class="export-opt"
            :class="{ 'export-opt--active': sceneExportFormat === fmt }"
            @click="sceneExportFormat = fmt"
          >
            {{ fmt }}
          </button>
        </div>
      </section>

      <!-- Segment list (if segment mode) -->
      <section v-if="sceneExportMode === '分段'" class="section">
        <h2 class="section__label">分段清单</h2>
        <div class="segment-list">
          <div v-for="shot in shotList" :key="shot.id" class="segment-item">
            <span class="segment-item__name">#{{ shot.id }} {{ shot.name }}</span>
            <span class="segment-item__dur">{{ shot.duration }}</span>
            <span
              class="segment-item__mood"
              :style="{ background: MOOD_COLORS[shot.mood] ?? '#3F3F46' }"
            >
              {{ shot.mood }}
            </span>
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">返回编辑</button>
        <button class="btn btn--primary btn--lg" @click="exportSceneAudio">
          {{ sceneExportMode === '完整' ? '导出完整音频' : '导出分段音频' }}
        </button>
        <button class="btn btn--outline" @click="sendBackToEditor">
          发送回编辑器
        </button>
      </div>
    </div>
  </div>

  <!-- ENH-10: AI写词弹窗 -->
  <Teleport to="body">
    <div v-if="showAiLyricsModal" class="ai-lyrics-overlay" @click.self="showAiLyricsModal = false">
      <div class="ai-lyrics-modal">
        <div class="ai-lyrics-modal__header">
          <h3>🎤 AI写词</h3>
          <button class="ai-lyrics-modal__close" @click="showAiLyricsModal = false">×</button>
        </div>
        <div class="ai-lyrics-modal__body">
          <div class="form-field">
            <label>歌词主题</label>
            <input v-model="aiLyricsTheme" class="form-input" placeholder="例如：关于失恋的伤感歌词..." @keyup.enter="generateAiLyrics" />
          </div>
          <div class="form-field">
            <label>情感方向（可选）</label>
            <div class="mood-tags">
              <button
                v-for="m in MOOD_SUGGESTIONS"
                :key="m"
                class="mood-tag"
                :class="{ 'mood-tag--active': aiLyricsMood === m }"
                @click="aiLyricsMood = aiLyricsMood === m ? '' : m"
              >{{ m }}</button>
            </div>
          </div>
          <button class="btn btn--gradient btn--lg" @click="generateAiLyrics" :disabled="aiLyricsGenerating || !aiLyricsTheme.trim()">
            <span v-if="aiLyricsGenerating" class="spinner" />
            {{ aiLyricsGenerating ? 'AI创作中...' : '✨ 生成歌词' }}
          </button>

          <!-- 3版歌词卡片 -->
          <div v-if="aiLyricsCandidates.length" class="lyrics-candidates">
            <div v-for="(lyrics, idx) in aiLyricsCandidates" :key="idx" class="lyrics-candidate" @click="selectAiLyrics(lyrics)">
              <div class="lyrics-candidate__header">
                <span class="lyrics-candidate__num">版本 {{ idx + 1 }}</span>
                <button class="lyrics-candidate__select">✅ 选用</button>
              </div>
              <pre class="lyrics-candidate__text">{{ lyrics }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ================================================================ */
/*  Root                                                               */
/* ================================================================ */

.music-editor {
  min-height: 100%;
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  padding: 32px 24px 80px;
  max-width: 900px;
  margin: 0 auto;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #FAFAFA;
}

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

/* ================================================================ */
/*  Mode toggle                                                        */
/* ================================================================ */

.mode-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
  background: var(--bg-secondary, #1A1C21);
  border-radius: 12px;
  padding: 4px;
  border: 1px solid #1C1C1E;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
}

.mode-toggle__btn {
  flex: 1;
  padding: 10px 24px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748B);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;
  font-family: inherit;
}

.mode-toggle__btn:hover {
  color: #D4D4D8;
}

.mode-toggle__btn--active {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.15), rgba(99, 102, 241, 0.15));
  color: var(--accent, var(--accent, #00BFA5));
  box-shadow: 0 0 0 1px rgba(0, 212, 170, 0.3);
}

/* ================================================================ */
/*  Step indicator                                                     */
/* ================================================================ */

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.step-indicator__item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.step-indicator__dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary, #1A1C21);
  border: 2px solid var(--border, #27272A);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  transition: all 0.25s;
  flex-shrink: 0;
}

.step-indicator__item--active .step-indicator__dot {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.15);
  color: var(--accent, var(--accent, #00BFA5));
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.3);
}

.step-indicator__item--done .step-indicator__dot {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: var(--accent, var(--accent, #00BFA5));
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
}

.step-indicator__check {
  font-size: 14px;
  font-weight: 700;
}

.step-indicator__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #64748B);
  white-space: nowrap;
}

.step-indicator__item--active .step-indicator__label,
.step-indicator__item--done .step-indicator__label {
  color: #A1A1AA;
}

.step-indicator__line {
  width: 32px;
  height: 2px;
  background: var(--border, #27272A);
  margin: 0 4px;
  flex-shrink: 0;
}

.step-indicator__item--done .step-indicator__line {
  background: var(--accent, var(--accent, #00BFA5));
}

/* ================================================================ */
/*  Step content                                                       */
/* ================================================================ */

.step-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.step-header {
  margin-bottom: 32px;
}

.step-title {
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 6px;
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.step-subtitle {
  font-size: 14px;
  color: var(--text-muted, #64748B);
  margin: 0;
}

/* ================================================================ */
/*  Sections                                                           */
/* ================================================================ */

.section {
  margin-bottom: 28px;
}

.section__label {
  font-size: 13px;
  font-weight: 600;
  color: #D4D4D8;
  margin: 0 0 14px;
  letter-spacing: 0.02em;
}

/* ================================================================ */
/*  Method cards (Mode A Step 1)                                       */
/* ================================================================ */

.method-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.method-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  background: var(--bg-secondary, #1A1C21);
  border: 1.5px solid var(--border, #27272A);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.25s;
  text-align: center;
}

.method-card:hover {
  border-color: #3F3F46;
  background: #18181B;
}

.method-card--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.05) !important;
  box-shadow: 0 0 0 1px rgba(0, 212, 170, 0.25), 0 4px 24px rgba(0, 212, 170, 0.08);
}

.method-card__icon {
  font-size: 32px;
  line-height: 1;
}

.method-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #FAFAFA;
  margin: 0;
}

.method-card__desc {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  margin: 0;
  line-height: 1.5;
}

/* ================================================================ */
/*  Textarea                                                           */
/* ================================================================ */

.textarea {
  width: 100%;
  padding: 14px 16px;
  font-size: 14px;
  border-radius: 12px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #FAFAFA;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  line-height: 1.7;
  resize: vertical;
  min-height: 100px;
  box-sizing: border-box;
}

.textarea::placeholder {
  color: var(--text-muted, #64748B);
}

.textarea:focus {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.03);
}

/* ================================================================ */
/*  Genre grid                                                         */
/* ================================================================ */

.genre-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.genre-btn {
  padding: 8px 18px;
  border-radius: 20px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.genre-btn:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.genre-btn--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.1) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 700;
}

/* ================================================================ */
/*  Reference upload                                                   */
/* ================================================================ */

.ref-upload-zone {
  border: 2px dashed var(--border, #27272A);
  border-radius: 14px;
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s;
  background: rgba(255, 255, 255, 0.015);
}

.ref-upload-zone:hover,
.ref-upload-zone--drag {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.04);
}

.ref-upload-zone__icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted, #64748B);
  margin-bottom: 12px;
}

.ref-upload-zone__text {
  font-size: 14px;
  color: #A1A1AA;
  margin: 0 0 4px;
}

.ref-upload-zone__text span {
  color: var(--accent, var(--accent, #00BFA5));
  font-weight: 500;
}

.ref-upload-zone__hint {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  margin: 0;
}

.ref-file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
}

.ref-file-info__name {
  flex: 1;
  font-size: 14px;
  color: #D4D4D8;
  font-weight: 500;
}

/* ================================================================ */
/*  Slider                                                             */
/* ================================================================ */

.slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border, #27272A);
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent, var(--accent, #00BFA5));
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 212, 170, 0.4);
}

.slider--sm {
  height: 4px;
}

.slider--sm::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
}

.slider-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent, var(--accent, #00BFA5));
  min-width: 60px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.slider-val--sm {
  font-size: 12px;
  min-width: 40px;
}

/* ================================================================ */
/*  Chips                                                              */
/* ================================================================ */

.chip-row,
.duration-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 8px 20px;
  border-radius: 20px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #A1A1AA;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.chip:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.chip--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.1) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 700;
}

/* ================================================================ */
/*  Instrument grid                                                    */
/* ================================================================ */

.instrument-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.inst-btn {
  padding: 12px;
  border-radius: 12px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  font-family: inherit;
}

.inst-btn:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.inst-btn--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.08) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 700;
}

/* ================================================================ */
/*  Mood curve                                                         */
/* ================================================================ */

.mood-curve {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  padding: 20px 24px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 14px;
  position: relative;
}

.mood-curve__point {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mood-curve__label {
  font-size: 12px;
  font-weight: 600;
  color: #A1A1AA;
}

.mood-curve__select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  color: #D4D4D8;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  text-align: center;
}

.mood-curve__select:focus {
  outline: none;
  border-color: var(--accent, var(--accent, #00BFA5));
}

.mood-curve__dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: background 0.3s;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}

.mood-curve__line {
  position: absolute;
  top: 50%;
  left: 15%;
  right: 15%;
  height: 2px;
  background: linear-gradient(90deg, var(--border, #27272A), #3F3F46, var(--border, #27272A));
  z-index: 0;
}

/* ================================================================ */
/*  Generate area                                                      */
/* ================================================================ */

.generate-area {
  text-align: center;
  padding: 24px 0;
}

.generate-hint {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted, #64748B);
}

/* ================================================================ */
/*  Candidate list (Mode A Step 3)                                     */
/* ================================================================ */

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.candidate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary, #1A1C21);
  border: 1.5px solid var(--border, #27272A);
  border-radius: 14px;
  transition: all 0.2s;
}

.candidate-item:hover {
  border-color: #3F3F46;
}

.candidate-item--selected {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.04) !important;
}

.candidate-item__play {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  color: var(--accent, var(--accent, #00BFA5));
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.candidate-item__play:hover {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.1);
}

.candidate-item__info {
  flex: 1;
  min-width: 0;
}

.candidate-item__title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #FAFAFA;
  margin-bottom: 4px;
}

.candidate-item__tags {
  display: flex;
  gap: 4px;
}

.mini-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  color: #fff;
  font-weight: 500;
}

.candidate-item__dur {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.candidate-item__wave {
  width: 120px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 2px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.wave-bar {
  flex: 1;
  background: var(--border, #27272A);
  border-radius: 1px;
  min-width: 2px;
}

.wave-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(0, 212, 170, 0.2);
  transition: width 0.1s linear;
}

.candidate-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

/* ================================================================ */
/*  Variations                                                         */
/* ================================================================ */

.variation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.variation-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
}

.variation-card__play {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border, #27272A);
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  color: #A1A1AA;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.variation-card__play:hover {
  border-color: var(--accent, var(--accent, #00BFA5));
  color: var(--accent, var(--accent, #00BFA5));
}

.variation-card__info {
  flex: 1;
  min-width: 0;
}

.variation-card__title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #D4D4D8;
  margin-bottom: 4px;
}

.variation-card__tags {
  display: flex;
  gap: 4px;
}

.variation-card__dur {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  flex-shrink: 0;
}

/* ================================================================ */
/*  Export (Mode A Step 4)                                             */
/* ================================================================ */

.export-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.export-opt {
  padding: 10px 24px;
  border-radius: 10px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #A1A1AA;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.export-opt:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.export-opt--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.08) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 700;
}

.send-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-select {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #D4D4D8;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

.form-select:focus {
  outline: none;
  border-color: var(--accent, var(--accent, #00BFA5));
}

/* ================================================================ */
/*  Mode B: Shot list                                                  */
/* ================================================================ */

.shot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
}

.shot-item__num {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  min-width: 28px;
}

.shot-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shot-item__name {
  font-size: 14px;
  font-weight: 600;
  color: #FAFAFA;
}

.shot-item__dur {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.shot-item__mood {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: var(--bg-secondary, #1A1C21);
  border: 1.5px dashed var(--border, #27272A);
  border-radius: 16px;
}

.empty-state__text {
  font-size: 16px;
  font-weight: 600;
  color: #A1A1AA;
  margin: 0 0 8px;
}

.empty-state__hint {
  font-size: 13px;
  color: var(--text-muted, #64748B);
  margin: 0;
}

.manual-add-row {
  display: flex;
  gap: 10px;
}

.manual-add-row .form-field__input {
  flex: 1;
}

/* ================================================================ */
/*  Mode B Step 2: Timeline view                                       */
/* ================================================================ */

.timeline-view {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-row__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748B);
  min-width: 40px;
  flex-shrink: 0;
}

.timeline-track {
  flex: 1;
  display: flex;
  gap: 3px;
  min-height: 48px;
}

.timeline-segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid;
  min-width: 0;
  overflow: hidden;
}

.timeline-segment__name {
  font-size: 10px;
  font-weight: 600;
  color: #D4D4D8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.timeline-segment__mood {
  font-size: 9px;
  color: #A1A1AA;
}

.timeline-segment--music {
  border-style: dashed;
}

.timeline-segment--generated {
  border-style: solid;
}

.timeline-segment__check {
  font-size: 14px;
  color: var(--accent, var(--accent, #00BFA5));
}

.timeline-segment__pending {
  font-size: 10px;
  color: var(--text-muted, #64748B);
}

/* ================================================================ */
/*  Shot adjust list                                                   */
/* ================================================================ */

.shot-adjust-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shot-adjust {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
  padding: 14px 16px;
}

.shot-adjust__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.shot-adjust__name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #FAFAFA;
}

.shot-adjust__mood {
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 11px;
  color: #fff;
  font-weight: 600;
}

.shot-adjust__controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shot-adjust__field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #A1A1AA;
}

.shot-adjust__field span:first-child {
  min-width: 36px;
}

.shot-adjust__field .slider {
  flex: 1;
}

/* ================================================================ */
/*  Mode B Step 3: Full timeline                                       */
/* ================================================================ */

.full-timeline {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 14px;
  padding: 20px;
  position: relative;
}

.full-timeline__track {
  display: flex;
  gap: 3px;
  min-height: 56px;
}

.full-timeline__segment {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  border-radius: 8px;
  border: 1px solid;
  min-width: 0;
  overflow: hidden;
}

.full-timeline__seg-label {
  font-size: 10px;
  font-weight: 600;
  color: #D4D4D8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.full-timeline__playhead {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 20px;
  width: 2px;
  background: var(--accent, var(--accent, #00BFA5));
  border-radius: 1px;
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.5);
}

/* ================================================================ */
/*  Volume controls                                                    */
/* ================================================================ */

.volume-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 14px;
}

.volume-control__label {
  font-size: 14px;
  font-weight: 500;
  color: #D4D4D8;
  min-width: 100px;
  flex-shrink: 0;
}

.volume-control .slider {
  flex: 1;
}

/* ================================================================ */
/*  Mode B Step 4: Segment list                                        */
/* ================================================================ */

.segment-list {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 14px;
  overflow: hidden;
}

.segment-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid #1C1C1E;
}

.segment-item:last-child {
  border-bottom: none;
}

.segment-item__name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #D4D4D8;
}

.segment-item__dur {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.segment-item__mood {
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 11px;
  color: #fff;
  font-weight: 600;
}

/* ================================================================ */
/*  Form fields                                                        */
/* ================================================================ */

.form-field__input {
  padding: 10px 14px;
  font-size: 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #FAFAFA;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.form-field__input::placeholder {
  color: var(--text-muted, #64748B);
}

.form-field__input:focus {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.03);
}

/* ================================================================ */
/*  Step navigation                                                     */
/* ================================================================ */

.step-nav {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid #1C1C1E;
}

/* ================================================================ */
/*  Buttons                                                            */
/* ================================================================ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn--primary {
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  color: #fff;
}

.btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 20px rgba(0, 212, 170, 0.3);
}

.btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn--outline {
  background: transparent;
  border: 1.5px solid var(--border, #27272A);
  color: #D4D4D8;
}

.btn--outline:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: #3F3F46;
}

.btn--ghost {
  background: rgba(255, 255, 255, 0.04);
  color: #A1A1AA;
  padding: 6px 14px;
  font-size: 12px;
}

.btn--ghost:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #FAFAFA;
}

.btn--lg {
  padding: 14px 40px;
  font-size: 16px;
  border-radius: 12px;
}

.btn--xl {
  padding: 16px 56px;
  font-size: 18px;
  border-radius: 14px;
}

.btn--sm {
  padding: 6px 14px;
  font-size: 12px;
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ================================================================ */
/*  Responsive                                                         */
/* ================================================================ */

@media (max-width: 700px) {
  .method-grid {
    grid-template-columns: 1fr;
  }
  .instrument-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .candidate-item__wave {
    display: none;
  }
  .variation-grid {
    grid-template-columns: 1fr;
  }
  .step-indicator__label {
    display: none;
  }
  .step-indicator__line {
    width: 20px;
  }
}

/* ===== ENH-10: AI写词 ===== */
.lyrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-lyrics-btn {
  padding: 6px 16px;
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

.ai-lyrics-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.ai-lyrics-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.ai-lyrics-modal {
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.ai-lyrics-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border, #2a2d35);
}

.ai-lyrics-modal__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
}

.ai-lyrics-modal__close {
  background: transparent;
  border: none;
  color: var(--text-muted, #555);
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
}

.ai-lyrics-modal__close:hover {
  color: var(--text-primary, #f1f5f9);
}

.ai-lyrics-modal__body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
}

.form-input {
  padding: 8px 12px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 8px;
  color: var(--text-primary, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.form-input:focus {
  border-color: var(--accent, #6366f1);
}

.mood-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mood-tag {
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

.mood-tag:hover {
  border-color: var(--accent, #6366f1);
}

.mood-tag--active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

.lyrics-candidates {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.lyrics-candidate {
  padding: 16px;
  background: var(--bg-tertiary, #23262e);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms ease;
}

.lyrics-candidate:hover {
  border-color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.06);
}

.lyrics-candidate__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.lyrics-candidate__num {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #6366f1);
  background: rgba(99, 102, 241, 0.12);
  padding: 2px 10px;
  border-radius: 8px;
}

.lyrics-candidate__select {
  background: transparent;
  border: none;
  color: #10B981;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  opacity: 0;
  transition: opacity 150ms ease;
}

.lyrics-candidate:hover .lyrics-candidate__select {
  opacity: 1;
}

.lyrics-candidate__text {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
  line-height: 1.6;
  white-space: pre-wrap;
  font-family: inherit;
}

/* ===== ENH-20: BGM嵌入式选择器 ===== */
.music-bgm-section {
  margin: 12px 0; padding: 14px;
  background: var(--bg-surface, var(--bg-primary, #0E0F12));
  border: 1px solid var(--border-default, var(--border, #2E3139));
  border-radius: 10px;
}
.music-bgm-header {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
}
.music-section-title { font-size: 14px; font-weight: 600; margin: 0; }
.music-bgm-current { font-size: 12px; color: var(--accent, var(--accent, #00BFA5)); font-weight: 500; }
.music-section-toggle { font-size: 12px; color: var(--text-muted, var(--text-muted, #64748B)); margin-left: auto; }
.music-bgm-body { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.music-bgm-controls { display: flex; gap: 10px; }
.music-bgm-controls .form-input { flex: 1; }
.music-bgm-controls .form-select { width: 140px; }
.music-bgm-grid { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
.music-bgm-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px; background: var(--bg-elevated, #23262E);
  border: 1px solid var(--border-subtle, #1E1E22);
  border-radius: 8px; cursor: pointer;
  transition: all 150ms ease;
}
.music-bgm-card:hover { border-color: var(--accent, var(--accent, #00BFA5)); }
.music-bgm-card--selected { border-color: var(--accent, var(--accent, #00BFA5)); background: rgba(0,191,165,0.06); }
.music-bgm-card--playing { border-color: #7C3AED; }
.music-bgm-card__top { display: flex; align-items: center; gap: 10px; }
.music-bgm-card__icon { font-size: 20px; }
.music-bgm-card__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.music-bgm-card__name { font-size: 13px; font-weight: 600; }
.music-bgm-card__meta { font-size: 11px; color: var(--text-secondary, var(--text-secondary, #9CA3AF)); }
.music-bgm-card__preview {
  width: 32px; height: 32px; border: 1px solid var(--border-default, var(--border, #2E3139));
  border-radius: 50%; background: var(--bg-surface, var(--bg-primary, #0E0F12));
  color: var(--text-secondary); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.music-bgm-card__preview--active { border-color: #7C3AED; background: rgba(124,58,237,0.1); color: #7C3AED; }
.music-bgm-card__mood { }
.music-bgm-card__mood-tag {
  font-size: 10px; padding: 2px 6px; background: rgba(0,191,165,0.1);
  color: var(--accent, var(--accent, #00BFA5)); border-radius: 4px;
}
.music-bgm-empty { text-align: center; padding: 20px; font-size: 13px; color: var(--text-muted); }
.music-bgm-selected-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: rgba(0,191,165,0.06);
  border: 1px solid var(--accent, var(--accent, #00BFA5)); border-radius: 8px;
  font-size: 13px; font-weight: 500;
}
.music-bgm-clear {
  padding: 4px 12px; border: 1px solid var(--text-muted); background: transparent;
  color: var(--text-muted); font-size: 12px; border-radius: 4px; cursor: pointer; font-family: inherit;
}

/* ===== ENH-21: 波形可视化 ===== */
.music-waveform-section {
  margin: 12px 0; padding: 14px;
  background: var(--bg-surface, var(--bg-primary, #0E0F12));
  border: 1px solid var(--border-default, var(--border, #2E3139));
  border-radius: 10px;
}
.music-waveform-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.music-waveform-info { font-size: 12px; color: var(--text-secondary, var(--text-secondary, #9CA3AF)); }
.music-waveform-canvas-wrap {
  width: 100%; height: 60px; border-radius: 6px;
  background: var(--bg-muted, var(--border, #2E3139));
  overflow: hidden;
}
.music-waveform-canvas { width: 100%; height: 100%; }
.music-waveform-static { margin-top: 6px; }
.music-waveform-bars {
  display: flex; align-items: flex-end; gap: 2px;
  height: 40px; padding: 0 4px;
}
.music-waveform-bar {
  flex: 1; min-width: 3px;
  background: var(--accent, var(--accent, #00BFA5));
  border-radius: 2px 2px 0 0;
  opacity: 0.6;
  transition: height 200ms ease;
}
.music-waveform-bars .music-waveform-bar:nth-child(odd) { opacity: 0.8; }
.music-waveform-bars .music-waveform-bar:nth-child(5n) { opacity: 1; background: #7C3AED; }

</style>
