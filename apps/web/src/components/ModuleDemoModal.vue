<script setup lang="ts">
/**
 * ModuleDemoModal.vue - Interactive demo modals matching ACTUAL workspace flows
 * Modules: animation | story | promo | ad-short | ad-image | music
 */

import { ref, watch, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import LoginModal from '@/components/LoginModal.vue'

const props = defineProps<{ modelValue: boolean; moduleId: string }>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>()
const router = useRouter()

const showLoginModal = ref(false)
const showBalanceWarning = ref(false)

const moduleInfo: Record<string, { icon: string; title: string; color: string; route: string }> = {
  animation:  { icon: '🎬', title: '动画生成器',   color: '#7DD3FC', route: '/create/animation' },
  story:      { icon: '📖', title: '故事生成器',   color: '#F472B6', route: '/create/novel' },
  promo:      { icon: '🎥', title: '宣传片生成器', color: '#A78BFA', route: '/create/promo' },
  'ad-short': { icon: '📹', title: '短视频生成器', color: '#34D399', route: '/create/ad-short' },
  'ad-image': { icon: '🖼️', title: '广告图生成器', color: '#FB923C', route: '/create/ad-image' },
  music:      { icon: '🎵', title: '配乐生成器',   color: '#FBBF24', route: '/create/music' },
}
const currentModule = computed(() => moduleInfo[props.moduleId] || moduleInfo.animation)

// ══════════════════════════════════════════════════════
//  ANIMATION MODULE STATE
// ══════════════════════════════════════════════════════
const animStepLabels = ['上传小说', '角色设定', '风格选择', '配乐设定', '生成导出']
const animCurrentStep = ref(0)
const animText = ref('')
const animTemplates = [
  { name: '甜宠', desc: '都市甜蜜恋爱故事' },
  { name: '奇幻', desc: '异世界冒险史诗' },
  { name: '悬疑', desc: '犯罪悬疑探案剧情' },
]
const animCharacters = ref([
  { name: '林晓月', archetype: '女主', appearance: '长发、清冷气质', prompt: '年轻女性，黑色长发，清冷气质' },
  { name: '陈天明', archetype: '男主', appearance: '高大、阳光', prompt: '年轻男性，高大帅气，阳光开朗' },
  { name: '苏小小', archetype: '闺蜜', appearance: '可爱、圆脸', prompt: '可爱女孩，圆脸大眼，活泼开朗' },
])
const animStyles = [
  { id: 'anime-realistic', name: '动漫写实', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { id: 'anime-classic',   name: '经典动漫', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { id: 'chinese-ink',     name: '中国水墨', gradient: 'linear-gradient(135deg, #2d2d2d, #8B7355, #d4c5a9)' },
  { id: 'comic-graphic',   name: '漫画平面', gradient: 'linear-gradient(135deg, #ff6b6b, #ffa502)' },
  { id: '3d-cinematic',    name: '3D电影',           gradient: 'linear-gradient(135deg, #0c3483, #a855f7)' },
  { id: 'sketch-line',     name: '素描线稿', gradient: 'linear-gradient(135deg, #ddd, #888)' },
]
const animSelectedStyle = ref(0)
const animAspectRatio = ref(0)
const animAspectRatios = ['16:9', '9:16']
const animEpisodes = ref(1)
const animTracks = ref([
  { name: 'BGM',     mood: '温馨',    volume: 80 },
  { name: 'SFX',     mood: '环境音', volume: 60 },
  { name: 'Narration', mood: '女声',  volume: 100 },
])
const animShots = ref([
  { id: 1, label: '镜头 1', status: 'pending'  as 'pending' | 'processing' | 'done' },
  { id: 2, label: '镜头 2', status: 'pending'  as 'pending' | 'processing' | 'done' },
  { id: 3, label: '镜头 3', status: 'pending'  as 'pending' | 'processing' | 'done' },
  { id: 4, label: '镜头 4', status: 'pending'  as 'pending' | 'processing' | 'done' },
  { id: 5, label: '镜头 5', status: 'pending'  as 'pending' | 'processing' | 'done' },
  { id: 6, label: '镜头 6', status: 'pending'  as 'pending' | 'processing' | 'done' },
])
const animExportFormat = ref(0)
const animExportFormats = ['MP4', 'GIF', 'PNG']
const animResolution = ref(1)
const animResolutions = ['720p', '1080p', '4K']
const animGenerating = ref(false)
const animGenStep = ref(-1)
const animGenStepLabels = ['分析文本', '拆解分镜', '生成角色', '合成动画', '渲染导出']
const animGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  STORY MODULE STATE
// ══════════════════════════════════════════════════════
const storyStepLabels = ['输入故事', '结构化编辑', '预览确认', '导出关联']
const storyCurrentStep = ref(0)
const storyText = ref('')
const storyTemplates = [
  { name: '奇幻冒险', desc: '在云层之上的浮空城里……' },
  { name: '都市悬疑', desc: '凌晨三点，收到来自自己号码的短信……' },
  { name: '甜蜜恋爱', desc: '她在旧书里发现了一封未寄出的情书……' },
]
const storyRefWorksOpen = ref(false)
const storyMoodOptions = [
  { name: '紧张', color: '#EF4444' }, { name: '温馨', color: '#F59E0B' },
  { name: '悬疑', color: '#8B5CF6' }, { name: '悲伤', color: '#3B82F6' },
  { name: '欢乐', color: '#10B981' }, { name: '恐怖', color: '#1F2937' },
  { name: '史诗', color: '#D97706' }, { name: '日常', color: '#6B7280' },
]
const storyArchetypes = ['主角', '反派', '导师', '伙伴', '恋人', '神秘人']
const storyActiveTab = ref(0)
const storyChapters = ref([
  { title: '第一章：开端', mood: 0, content: '' },
  { title: '第二章：发展', mood: 2, content: '' },
  { title: '第三章：高潮', mood: 6, content: '' },
])
const storyCharacters = ref([
  { name: '主角', archetype: 0, appearance: '', prompt: '', hasImage: false },
  { name: '反派', archetype: 1, appearance: '', prompt: '', hasImage: false },
])
const storyScenes = ref([
  { name: '场景一', location: '', atmosphere: '', prompt: '' },
])
const storyNarrativePerspective = ref(0)
const storyNarrativeOptions = ['第一人称', '第三人称', '全知视角']
const storyExpandedSections = ref({ outline: true, characters: false, scenes: false, style: false })
const storyExportFormat = ref(0)
const storyExportFormats = ['TXT', 'JSON', '分镜JSON']
const storyGenerating = ref(false)
const storyGenStep = ref(-1)
const storyGenStepLabels = ['分析文本', '构建结构', '生成内容', '整理输出']
const storyGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  PROMO MODULE STATE
// ══════════════════════════════════════════════════════
const promoStepLabels = ['品牌Brief', 'AI生成脚本', '镜头生成', '逐镜头视频', '配音配乐', '合成导出']
const promoCurrentStep = ref(0)
const promoBrandName = ref('')
const promoProductDesc = ref('')
const promoAudiences = ['年轻人', '家庭用户', '商务人士', '学生', '中老年']
const promoSelectedAudience = ref(0)
const promoSubTags = ref('')
const promoDurations = ['15s', '30s', '45s', '60s']
const promoSelectedDuration = ref(1)
const promoCameraMovements = ['固定', '推进', '拉远', '环绕', '航拍', '手持']
const promoScenes = ref([
  { title: '开场', timeStart: '0:00', timeEnd: '0:05', description: '', voiceover: '', camera: 0 },
  { title: '产品展示', timeStart: '0:05', timeEnd: '0:20', description: '', voiceover: '', camera: 1 },
  { title: '结尾', timeStart: '0:20', timeEnd: '0:30', description: '', voiceover: '', camera: 0 },
])
const promoShots = ref([
  { id: 1, label: '镜头 1', camera: 0, hasImage: false, craft: ['', '', '', '', ''] },
  { id: 2, label: '镜头 2', camera: 1, hasImage: false, craft: ['', '', '', '', ''] },
  { id: 3, label: '镜头 3', camera: 0, hasImage: false, craft: ['', '', '', '', ''] },
])
const promoShotProgress = ref([0, 0, 0])
const promoShotStatus = ref<'pending' | 'processing' | 'done'[]>(['pending', 'pending', 'pending'])
const promoOverallProgress = ref(0)
const promoVoices = ['男声没磁', '女声温柔', '男声激情', '女声活泼', '童声', '旁白风']
const promoSelectedVoice = ref(0)
const promoVoiceSpeed = ref(50)
const promoMusicStyles = ['史诗', '温馨', '科技', '流行', '古典', '电子']
const promoSelectedMusic = ref(0)
const promoMusicVolume = ref(50)
const promoExportFormat = ref(0)
const promoExportFormats = ['MP4', 'MOV']
const promoExportResolution = ref(1)
const promoExportResolutions = ['720p', '1080p', '4K']
const promoExportVoiceover = ref(true)
const promoExportMusic = ref(true)
const promoExportWatermark = ref(false)
const promoExportSubtitles = ref(true)
const promoGenerating = ref(false)
const promoGenStep = ref(-1)
const promoGenStepLabels = ['生成脚本', '拆分镜头', '生成视频', '配音混音', '合成导出']
const promoGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  AD-SHORT MODULE STATE
// ══════════════════════════════════════════════════════
const adShortStepLabels = ['选平台品类', '上传素材', 'AI生成分镜', '逐镜头生成', '配乐字幕', '多版本导出']
const adShortCurrentStep = ref(0)
const adShortPlatforms = [
  { name: '抖音',  ratio: '9:16',  h: 90, w: 51 },
  { name: '小红书', ratio: '3:4', h: 80, w: 60 },
  { name: 'B站',     ratio: '16:9', h: 51, w: 90 },
  { name: '快手',  ratio: '9:16',  h: 90, w: 51 },
  { name: '淘宝',  ratio: '1:1',   h: 70, w: 70 },
]
const adShortSelectedPlatform = ref(0)
const adShortCategories = [
  { name: '美妆', emoji: '💄', music: '流行' },
  { name: '食品', emoji: '🍜', music: '欢快' },
  { name: '服饰', emoji: '👗', music: '时尚' },
  { name: '数码', emoji: '📱', music: '科技' },
  { name: '家居', emoji: '🏠', music: '温馨' },
  { name: '母婴', emoji: '👶', music: '温柔' },
  { name: '运动', emoji: '⚽',   music: '激情' },
  { name: '宠物', emoji: '🐱', music: '活泼' },
  { name: '教育', emoji: '📚', music: '古典' },
]
const adShortSelectedCategory = ref(0)
const adShortUploadedImages = ref(0)
const adShortProductName = ref('')
const adShortSellingPoints = ref(['', '', ''])
const adShortShots = ref([
  { duration: 3, prompt: '', voiceover: '', camera: 0 },
  { duration: 4, prompt: '', voiceover: '', camera: 1 },
  { duration: 3, prompt: '', voiceover: '', camera: 0 },
  { duration: 4, prompt: '', voiceover: '', camera: 2 },
  { duration: 3, prompt: '', voiceover: '', camera: 1 },
])
const adShortShotProgress = ref([0, 0, 0, 0, 0])
const adShortShotStatus = ref<'pending' | 'processing' | 'done'[]>(['pending', 'pending', 'pending', 'pending', 'pending'])
const adShortOverallProgress = ref(0)
const adShortCameraMovements = ['固定', '推进', '拉远', '环绕']
const adShortSubtitlePosition = ref(0)
const adShortSubtitleFontSize = ref(50)
const adShortSubtitleColor = ref('#FFFFFF')
const adShortExportFormat = ref(0)
const adShortExportFormats = ['MP4', 'MOV']
const adShortGenerating = ref(false)
const adShortGenStep = ref(-1)
const adShortGenStepLabels = ['分析素材', '生成分镜', '渲染视频', '加字幕配乐', '合成导出']
const adShortGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  AD-IMAGE MODULE STATE
// ══════════════════════════════════════════════════════
const adImageStepLabels = ['选模板上传', 'AI生成广告图', '文案排版', '多尺寸生成', '导出']
const adImageCurrentStep = ref(0)
const adImageStyles = [
  { name: '电商主图', gradient: 'linear-gradient(135deg, #ff6b6b, #ee5a24)', tags: ['电商', '产品'] },
  { name: '小红书',     gradient: 'linear-gradient(135deg, #ff9ff3, #f368e0)', tags: ['种草', '美妆'] },
  { name: '公众号',     gradient: 'linear-gradient(135deg, #54a0ff, #2e86de)', tags: ['文章', '资讯'] },
  { name: '朋友圈',     gradient: 'linear-gradient(135deg, #26de81, #20bf6b)', tags: ['社交', '分享'] },
  { name: '户外广告', gradient: 'linear-gradient(135deg, #fd79a8, #e17055)', tags: ['海报', '展架'] },
  { name: '极简白底', gradient: 'linear-gradient(135deg, #f5f5f5, #ddd)', tags: ['白底', '简约'] },
]
const adImageSelectedStyle = ref(0)
const adImageProductImages = ref(0)
const adImageProductName = ref('')
const adImageTagline = ref('')
const adImageCtaOptions = ['立即购买', '了解更多', '免费试用', '限时优惠', '扫码下单']
const adImageSelectedCta = ref(0)
const adImageTextPosition = ref(4)
const adImageHeadline = ref('')
const adImageSubHeadline = ref('')
const adImageFontColor = ref('#FFFFFF')
const adImageCandidates = ref(4)
const adImageSizes = [
  { label: '1:1',    dim: '1080×1080', platform: '电商主图',   checked: true },
  { label: '3:4',    dim: '1080×1440', platform: '小红书',    checked: true },
  { label: '9:16',   dim: '1080×1920', platform: '抖音/快手', checked: false },
  { label: '16:9',   dim: '1920×1080', platform: '公众号/B站', checked: false },
  { label: '2.35:1', dim: '2350×1000', platform: '户外广告',   checked: false },
]
const adImageExportFormat = ref(0)
const adImageExportFormats = ['PNG', 'JPG', 'WebP']
const adImageQuality = ref(1)
const adImageQualityOptions = ['标准', '高清', '超清']
const adImageWatermark = ref(false)
const adImageGenerating = ref(false)
const adImageGenStep = ref(-1)
const adImageGenStepLabels = ['分析商品', '生成画面', '文案排版', '多尺寸', '导出']
const adImageGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  MUSIC MODULE STATE
// ══════════════════════════════════════════════════════
const musicStepLabelsA = ['生成方式', '参数调整', '生成预览', '导出']
const musicStepLabelsB = ['接收镜头', 'AI匹配配乐', '全局混音', '导出']
const musicMode = ref<'A' | 'B'>('A')
const musicCurrentStep = ref(0)
const musicMethods = [
  { name: '文字描述', icon: '✍️' },
  { name: '歌词+曲风', icon: '🎶' },
  { name: '参考音频', icon: '🎧' },
]
const musicSelectedMethod = ref(0)
const musicGenres = ['流行', '摇滚', '电子', '古典', '爵士', '嘻哈', '中国风', '氛围', '影视']
const musicSelectedGenre = ref(0)
const musicSimilarity = ref(50)
const musicDurations = ['15s', '30s', '60s']
const musicSelectedDuration = ref(1)
const musicCustomDuration = ref(30)
const musicBpm = ref(120)
const musicKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const musicSelectedKey = ref(0)
const musicModes_scale = ['大调', '小调']
const musicSelectedModeScale = ref(0)
const musicInstruments = ['钢琴', '吉他', '贝斯', '鼓', '小提琴', '长笛', '合成器', '古筝']
const musicSelectedInstruments = ref<number[]>([0, 3])
const musicMoodCurve = ref([
  { mood: '平静', color: '#3B82F6' },
  { mood: '高潮', color: '#EF4444' },
  { mood: '收束', color: '#10B981' },
])
const musicCandidates = ref([
  { playing: false, progress: 0 },
  { playing: false, progress: 0 },
  { playing: false, progress: 0 },
  { playing: false, progress: 0 },
])
const musicSelectedCandidate = ref(-1)
const musicBgmTracks = ref([
  { name: 'Track 1', selected: false }, { name: 'Track 2', selected: false },
  { name: 'Track 3', selected: false }, { name: 'Track 4', selected: false },
  { name: 'Track 5', selected: false }, { name: 'Track 6', selected: false },
  { name: 'Track 7', selected: false }, { name: 'Track 8', selected: false },
])
const musicVariations = ref([
  { name: '变奏 A', playing: false },
  { name: '变奏 B', playing: false },
  { name: '变奏 C', playing: false },
  { name: '变奏 D', playing: false },
])
const musicExportFormat = ref(0)
const musicExportFormats = ['MP3', 'WAV', 'FLAC']
const musicExportQuality = ref(1)
const musicExportQualityOptions = ['128kbps', '320kbps', '无损']
// Mode B
const musicBShots = ref([
  { label: '镜头 1', mood: '紧张', volume: 80, fade: 50 },
  { label: '镜头 2', mood: '温馨', volume: 70, fade: 50 },
  { label: '镜头 3', mood: '史诗', volume: 90, fade: 50 },
])
const musicBGlobalBgm = ref(80)
const musicBGlobalVoiceover = ref(100)
const musicBGlobalSfx = ref(60)
const musicBCrossFade = ref(50)
const musicBExportMode = ref(0)
const musicBExportModes = ['完整', '分段']
const musicGenerating = ref(false)
const musicGenStep = ref(-1)
const musicGenStepLabelsA = ['分析需求', '匹配风格', '生成音频', '混音处理']
const musicGenStepLabelsB = ['导入镜头', 'AI匹配', '混音处理', '导出']
const musicGenerated = ref(false)

// ══════════════════════════════════════════════════════
//  COMPUTED
// ══════════════════════════════════════════════════════
const currentStepLabels = computed(() => {
  switch (props.moduleId) {
    case 'animation':  return animStepLabels
    case 'story':      return storyStepLabels
    case 'promo':      return promoStepLabels
    case 'ad-short':   return adShortStepLabels
    case 'ad-image':   return adImageStepLabels
    case 'music':      return musicMode.value === 'A' ? musicStepLabelsA : musicStepLabelsB
    default:           return []
  }
})
const currentStep = computed(() => {
  if (props.moduleId === 'animation')  return animCurrentStep.value
  if (props.moduleId === 'story')      return storyCurrentStep.value
  if (props.moduleId === 'promo')      return promoCurrentStep.value
  if (props.moduleId === 'ad-short')   return adShortCurrentStep.value
  if (props.moduleId === 'ad-image')   return adImageCurrentStep.value
  if (props.moduleId === 'music')      return musicCurrentStep.value
  return 0
})
const promoShotDone = computed(() => promoShotStatus.value.filter(s => s === 'done').length)
const adShortShotDone = computed(() => adShortShotStatus.value.filter(s => s === 'done').length)
const adImageCheckedCount = computed(() => adImageSizes.filter(s => s.checked).length)

// ══════════════════════════════════════════════════════
//  NAVIGATION & ACTIONS
// ══════════════════════════════════════════════════════
function goToStep(step: number) {
  switch (props.moduleId) {
    case 'animation':  animCurrentStep.value = step; break
    case 'story':      storyCurrentStep.value = step; break
    case 'promo':      promoCurrentStep.value = step; break
    case 'ad-short':   adShortCurrentStep.value = step; break
    case 'ad-image':   adImageCurrentStep.value = step; break
    case 'music':      musicCurrentStep.value = step; break
  }
}

let allTimers: ReturnType<typeof setTimeout>[] = []
let allIntervals: ReturnType<typeof setInterval>[] = []

function handleGenerate() {
  showBalanceWarning.value = false
  const token = localStorage.getItem('mhw.access_token')
  if (!token) { showLoginModal.value = true; return }
  const userStr = localStorage.getItem('mhw.user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      if (user.quota_remaining <= 0) { showBalanceWarning.value = true; return }
    } catch { /* ignore */ }
  }
  startGeneration()
}

function startGeneration() {
  clearAllTimers()
  switch (props.moduleId) {
    case 'animation':  genAnimation(); break
    case 'story':      genStory(); break
    case 'promo':      genPromo(); break
    case 'ad-short':   genAdShort(); break
    case 'ad-image':   genAdImage(); break
    case 'music':      genMusic(); break
  }
}

function clearAllTimers() {
  allTimers.forEach(clearTimeout); allTimers = []
  allIntervals.forEach(clearInterval); allIntervals = []
}

function genAnimation() {
  animGenerating.value = true; animGenerated.value = false; animGenStep.value = 0
  animShots.value.forEach(s => { s.status = 'pending' })
  animGenStepLabels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { animGenStep.value = i + 1 }, (i + 1) * 600))
  })
  animGenStepLabels.forEach((_, i) => {
    if (i < animShots.value.length) {
      allTimers.push(setTimeout(() => { animShots.value[i].status = 'processing' }, 1500 + i * 300))
      allTimers.push(setTimeout(() => { animShots.value[i].status = 'done' }, 2200 + i * 300))
    }
  })
  allTimers.push(setTimeout(() => {
    animShots.value.forEach(s => { s.status = 'done' })
    animGenerating.value = false; animGenerated.value = true
  }, animGenStepLabels.length * 600 + 400))
}

function genStory() {
  storyGenerating.value = true; storyGenerated.value = false; storyGenStep.value = 0
  storyGenStepLabels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { storyGenStep.value = i + 1 }, (i + 1) * 600))
  })
  allTimers.push(setTimeout(() => {
    storyGenerating.value = false; storyGenerated.value = true
    if (!storyChapters.value[0].content) storyChapters.value[0].content = '在云层之上的浮空城里，少年铸剑师发现了一把会说话的古剑……'
  }, storyGenStepLabels.length * 600 + 400))
}

function genPromo() {
  promoGenerating.value = true; promoGenerated.value = false; promoGenStep.value = 0
  promoOverallProgress.value = 0; promoShotStatus.value = ['pending', 'pending', 'pending']
  promoShotProgress.value = [0, 0, 0]
  promoGenStepLabels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { promoGenStep.value = i + 1 }, (i + 1) * 600))
  })
  promoShots.value.forEach((_, i) => {
    allTimers.push(setTimeout(() => { promoShotStatus.value[i] = 'processing' }, 1800 + i * 500))
    const iv = setInterval(() => {
      if (promoShotProgress.value[i] < 100) promoShotProgress.value[i] += 4
      else { promoShotStatus.value[i] = 'done'; clearInterval(iv) }
    }, 60)
    allIntervals.push(iv)
  })
  allTimers.push(setTimeout(() => {
    promoShotStatus.value = promoShotStatus.value.map(() => 'done')
    promoShotProgress.value = promoShotProgress.value.map(() => 100)
    promoOverallProgress.value = 100
    promoGenerating.value = false; promoGenerated.value = true
  }, promoGenStepLabels.length * 600 + 1200))
}

function genAdShort() {
  adShortGenerating.value = true; adShortGenerated.value = false; adShortGenStep.value = 0
  adShortOverallProgress.value = 0
  adShortShotStatus.value = adShortShotStatus.value.map(() => 'pending')
  adShortShotProgress.value = adShortShotProgress.value.map(() => 0)
  adShortGenStepLabels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { adShortGenStep.value = i + 1 }, (i + 1) * 500))
  })
  adShortShots.value.forEach((_, i) => {
    allTimers.push(setTimeout(() => { adShortShotStatus.value[i] = 'processing' }, 1500 + i * 400))
    const iv = setInterval(() => {
      if (adShortShotProgress.value[i] < 100) adShortShotProgress.value[i] += 5
      else { adShortShotStatus.value[i] = 'done'; clearInterval(iv) }
    }, 60)
    allIntervals.push(iv)
  })
  allTimers.push(setTimeout(() => {
    adShortShotStatus.value = adShortShotStatus.value.map(() => 'done')
    adShortShotProgress.value = adShortShotProgress.value.map(() => 100)
    adShortOverallProgress.value = 100
    adShortGenerating.value = false; adShortGenerated.value = true
  }, adShortGenStepLabels.length * 500 + 1000))
}

function genAdImage() {
  adImageGenerating.value = true; adImageGenerated.value = false; adImageGenStep.value = 0
  adImageGenStepLabels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { adImageGenStep.value = i + 1 }, (i + 1) * 500))
  })
  allTimers.push(setTimeout(() => {
    adImageGenerating.value = false; adImageGenerated.value = true; adImageCandidates.value = 4
  }, adImageGenStepLabels.length * 500 + 400))
}

function genMusic() {
  musicGenerating.value = true; musicGenerated.value = false; musicGenStep.value = 0
  const labels = musicMode.value === 'A' ? musicGenStepLabelsA : musicGenStepLabelsB
  labels.forEach((_, i) => {
    allTimers.push(setTimeout(() => { musicGenStep.value = i + 1 }, (i + 1) * 500))
  })
  allTimers.push(setTimeout(() => {
    musicGenerating.value = false; musicGenerated.value = true
    musicCandidates.value.forEach(c => { c.playing = false; c.progress = 0 })
  }, labels.length * 500 + 400))
}

function toggleMusicCandidate(idx: number) {
  const c = musicCandidates.value[idx]
  if (c.playing) { c.playing = false; return }
  musicCandidates.value.forEach((cc, i) => { if (i !== idx) cc.playing = false })
  c.playing = true; c.progress = 0; musicSelectedCandidate.value = idx
  const iv = setInterval(() => {
    if (c.playing && c.progress < 100) c.progress += 2
    else { c.playing = false; clearInterval(iv) }
  }, 80)
  allIntervals.push(iv)
}

function toggleInstrument(idx: number) {
  const pos = musicSelectedInstruments.value.indexOf(idx)
  if (pos >= 0) musicSelectedInstruments.value.splice(pos, 1)
  else musicSelectedInstruments.value.push(idx)
}

function selectTemplate(module: string, idx: number) {
  if (module === 'animation') {
    const texts = [
      '她在咖啡店的窗边等他，雨滴打在玻璃上，像无数小小的心跳……',
      '异世界的门在月圆之夜打开，少年握着父亲留下的断剑，踏入未知……',
      '深夜的法医实验室，一具尸体的手指突然动了……',
    ]
    animText.value = texts[idx] || ''
  } else if (module === 'story') {
    const texts = [
      '在云层之上的浮空城里，少年铸剑师发现了一把会说话的古剑……',
      '凌晨三点，刑警收到一条来自自己号码的短信——“别回头”……',
      '她在图书馆的旧书里发现了一封未寄出的情书……',
    ]
    storyText.value = texts[idx] || ''
  }
}

function goUpgrade() { close(); router.push('/pricing') }

function genCharPrompt(char: typeof storyCharacters.value[0]) {
  char.prompt = char.appearance + ', 动漫风格, 全身像'
}
function genScenePrompt(sc: typeof storyScenes.value[0]) {
  sc.prompt = sc.location + ', ' + sc.atmosphere + ', 场景描绘'
}
function addChapter() {
  storyChapters.value.push({ title: '新章节', mood: 7, content: '' })
}
function addCharacter() {
  storyCharacters.value.push({ name: '新角色', archetype: 3, appearance: '', prompt: '', hasImage: false })
}
function addScene() {
  storyScenes.value.push({ name: '新场景', location: '', atmosphere: '', prompt: '' })
}
function addMusicBShot() {
  musicBShots.value.push({ label: '镜头 ' + (musicBShots.value.length + 1), mood: '日常', volume: 80, fade: 50 })
}

function onLoginModalClose(val: boolean) {
  showLoginModal.value = val
  if (!val) {
    const token = localStorage.getItem('mhw.access_token')
    if (token) { close(); router.push(currentModule.value.route) }
  }
}

function handleActionRedirect() {
  const token = localStorage.getItem('mhw.access_token')
  if (!token) { showLoginModal.value = true; return }
  close(); router.push(currentModule.value.route)
}

function close() { emit('update:modelValue', false) }
function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('mdm-backdrop')) close()
}

// ══════════════════════════════════════════════════════
//  WATCHERS & LIFECYCLE
// ══════════════════════════════════════════════════════
watch(() => props.modelValue, (val) => {
  if (val) {
    showBalanceWarning.value = false; resetAllState()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

function resetAllState() {
  animCurrentStep.value = 0; animText.value = ''; animSelectedStyle.value = 0
  animCharacters.value.forEach(c => { c.prompt = '' })
  animAspectRatio.value = 0; animEpisodes.value = 1
  animTracks.value.forEach(t => { t.volume = t.name === 'Narration' ? 100 : t.name === 'BGM' ? 80 : 60 })
  animShots.value.forEach(s => { s.status = 'pending' })
  animExportFormat.value = 0; animResolution.value = 1
  animGenerating.value = false; animGenerated.value = false; animGenStep.value = -1

  storyCurrentStep.value = 0; storyText.value = ''; storyActiveTab.value = 0
  storyChapters.value.forEach(c => { c.content = '' })
  storyCharacters.value.forEach(c => { c.prompt = ''; c.hasImage = false })
  storyScenes.value.forEach(s => { s.prompt = '' })
  storyNarrativePerspective.value = 0; storyExportFormat.value = 0
  storyExpandedSections.value = { outline: true, characters: false, scenes: false, style: false }
  storyGenerating.value = false; storyGenerated.value = false; storyGenStep.value = -1

  promoCurrentStep.value = 0; promoBrandName.value = ''; promoProductDesc.value = ''
  promoSelectedAudience.value = 0; promoSelectedDuration.value = 1
  promoScenes.value.forEach(s => { s.description = ''; s.voiceover = '' })
  promoShots.value.forEach(s => { s.craft = ['', '', '', '', ''] })
  promoShotProgress.value = [0, 0, 0]; promoShotStatus.value = ['pending', 'pending', 'pending']
  promoOverallProgress.value = 0; promoSelectedVoice.value = 0; promoSelectedMusic.value = 0
  promoExportFormat.value = 0; promoExportResolution.value = 1
  promoGenerating.value = false; promoGenerated.value = false; promoGenStep.value = -1

  adShortCurrentStep.value = 0; adShortSelectedPlatform.value = 0; adShortSelectedCategory.value = 0
  adShortUploadedImages.value = 0; adShortProductName.value = ''
  adShortSellingPoints.value = ['', '', '']
  adShortShots.value.forEach(s => { s.prompt = ''; s.voiceover = '' })
  adShortShotProgress.value = [0, 0, 0, 0, 0]
  adShortShotStatus.value = adShortShotStatus.value.map(() => 'pending')
  adShortOverallProgress.value = 0
  adShortGenerating.value = false; adShortGenerated.value = false; adShortGenStep.value = -1

  adImageCurrentStep.value = 0; adImageSelectedStyle.value = 0; adImageProductImages.value = 0
  adImageProductName.value = ''; adImageTagline.value = ''
  adImageHeadline.value = ''; adImageSubHeadline.value = ''
  adImageSelectedCta.value = 0; adImageTextPosition.value = 4; adImageFontColor.value = '#FFFFFF'
  adImageSizes.forEach((s, i) => { s.checked = i < 2 })
  adImageExportFormat.value = 0; adImageQuality.value = 1; adImageWatermark.value = false
  adImageGenerating.value = false; adImageGenerated.value = false; adImageGenStep.value = -1

  musicMode.value = 'A'; musicCurrentStep.value = 0
  musicSelectedMethod.value = 0; musicSelectedGenre.value = 0; musicSimilarity.value = 50
  musicSelectedDuration.value = 1; musicBpm.value = 120
  musicSelectedKey.value = 0; musicSelectedModeScale.value = 0
  musicSelectedInstruments.value = [0, 3]
  musicCandidates.value.forEach(c => { c.playing = false; c.progress = 0 })
  musicSelectedCandidate.value = -1
  musicBgmTracks.value.forEach(t => { t.selected = false })
  musicExportFormat.value = 0; musicExportQuality.value = 1
  musicBShots.value.forEach(s => { s.volume = 80; s.fade = 50 })
  musicBGlobalBgm.value = 80; musicBGlobalVoiceover.value = 100; musicBGlobalSfx.value = 60
  musicGenerating.value = false; musicGenerated.value = false; musicGenStep.value = -1

  clearAllTimers()
}

onUnmounted(() => { clearAllTimers(); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="mdm-fade">
      <div v-if="modelValue" class="mdm-backdrop" @click="onBackdropClick" @wheel.stop>
        <div class="mdm-card">
          <!-- ═══ HEADER ═══ -->
          <div class="mdm-header">
            <div class="mdm-header__left">
              <span class="mdm-header__icon" :style="{ background: currentModule.color + '18', borderColor: currentModule.color + '40' }">{{ currentModule.icon }}</span>
              <h2 class="mdm-header__title">{{ currentModule.title }}</h2>
            </div>
            <button class="mdm-close" @click="close">&times;</button>
          </div>

          <!-- Balance warning -->
          <div v-if="showBalanceWarning" class="mdm-balance-warning">
            <span class="mdm-balance-warning__icon">&#9888;&#65039;</span>
            <div class="mdm-balance-warning__text">
              <strong>&#20313;&#39069;&#19981;&#36275;</strong>
              <p>&#24403;&#21069;&#22871;&#39184;&#21097;&#20313; 0 &#27425;&#29983;&#25104;&#26426;&#20250;&#65292;&#35831;&#21319;&#32423;&#22871;&#39184;</p>
            </div>
            <button class="mdm-balance-warning__btn" @click="goUpgrade">&#21319;&#32423;&#22871;&#39184; &rarr;</button>
          </div>

          <!-- ═══ STEP NAV BAR ═══ -->
          <div class="mdm-step-nav">
            <div v-for="(label, i) in currentStepLabels" :key="i"
              class="mdm-step-nav__item"
              :class="{ 'mdm-step-nav__item--active': currentStep === i, 'mdm-step-nav__item--done': currentStep > i }"
              @click="goToStep(i)">
              <div class="mdm-step-nav__circle">{{ currentStep > i ? '✓' : i + 1 }}</div>
              <span class="mdm-step-nav__label">{{ label }}</span>
              <div v-if="i < currentStepLabels.length - 1" class="mdm-step-nav__line"
                :class="{ 'mdm-step-nav__line--done': currentStep > i }"></div>
            </div>
          </div>

          <!-- ═══ BODY ═══ -->
          <div class="mdm-body">

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║       ANIMATION MODULE               ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'animation'">

              <!-- Step 1: 上传小说 -->
              <div v-if="animCurrentStep === 0" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">&#36755;&#20837;&#23567;&#35828;&#25991;&#26412;</label>
                  <textarea class="mdm-textarea" v-model="animText" rows="5"
                    placeholder="&#31359;&#36234;&#26102;&#31354;&#30340;&#23569;&#22899;&#65292;&#22312;&#26143;&#31354;&#19979;&#23547;&#25214;&#22833;&#33853;&#30340;&#35760;&#24518;&#8230;&#8230;"
                    maxlength="10000"></textarea>
                  <span class="mdm-char-count">{{ animText.length }} / 10000</span>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">&#25925;&#20107;&#27169;&#26495;</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(t, i) in animTemplates" :key="t.name"
                      class="mdm-tpl-card" :class="{ 'mdm-tpl-card--active': animText && i === 0 }"
                      @click="selectTemplate('animation', i)">
                      <span class="mdm-tpl-card__name">{{ t.name }}</span>
                      <span class="mdm-tpl-card__desc">{{ t.desc }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Step 2: 角色设定 -->
              <div v-if="animCurrentStep === 1" class="mdm-step-content">
                <button class="mdm-ai-btn" @click="animCharacters.forEach(c => c.prompt = c.appearance)">&#10024; AI提取角色</button>
                <div class="mdm-char-list">
                  <div v-for="(char, i) in animCharacters" :key="i" class="mdm-char-card">
                    <div class="mdm-char-card__header">
                      <span class="mdm-char-card__avatar">{{ char.name.charAt(0) }}</span>
                      <div>
                        <div class="mdm-char-card__name">{{ char.name }}</div>
                        <div class="mdm-char-card__archetype">{{ char.archetype }}</div>
                      </div>
                    </div>
                    <div class="mdm-char-card__field">
                      <label class="mdm-label">&#22806;&#35268;</label>
                      <input class="mdm-input" v-model="char.appearance" />
                    </div>
                    <div class="mdm-char-card__field">
                      <label class="mdm-label">&#25552;&#31034;&#35789;</label>
                      <textarea class="mdm-textarea mdm-textarea--sm" v-model="char.prompt" rows="2"></textarea>
                    </div>
                    <div class="mdm-upload-zone mdm-upload-zone--sm">
                      <span>&#128247; 上传参考图</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 3: 风格选择 -->
              <div v-if="animCurrentStep === 2" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">艺术风格</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(s, i) in animStyles" :key="s.id"
                      class="mdm-style-card" :class="{ 'mdm-style-card--active': animSelectedStyle === i }"
                      @click="animSelectedStyle = i">
                      <div class="mdm-style-card__preview" :style="{ background: s.gradient }"></div>
                      <span class="mdm-style-card__name">{{ s.name }}</span>
                    </button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">画面比例</label>
                  <div class="mdm-chip-row">
                    <button v-for="(r, i) in animAspectRatios" :key="r"
                      class="mdm-chip" :class="{ 'mdm-chip--active': animAspectRatio === i }"
                      @click="animAspectRatio = i">{{ r }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">集数 ({{ animEpisodes }})</label>
                  <input type="range" min="1" max="6" v-model.number="animEpisodes" class="mdm-slider" />
                  <div class="mdm-slider-labels"><span>1</span><span>6</span></div>
                </div>
              </div>

              <!-- Step 4: 配乐设定 -->
              <div v-if="animCurrentStep === 3" class="mdm-step-content">
                <div class="mdm-track-panel">
                  <div v-for="(track, i) in animTracks" :key="track.name" class="mdm-track-row">
                    <div class="mdm-track-row__info">
                      <span class="mdm-track-row__name">{{ track.name }}</span>
                      <span class="mdm-track-row__mood">{{ track.mood }}</span>
                    </div>
                    <div class="mdm-track-row__controls">
                      <input type="range" min="0" max="100" v-model.number="track.volume" class="mdm-slider mdm-slider--sm" />
                      <span class="mdm-track-row__vol">{{ track.volume }}%</span>
                    </div>
                  </div>
                </div>
                <div class="mdm-section" style="margin-top:12px">
                  <label class="mdm-label">情绪时间线</label>
                  <div class="mdm-mood-timeline">
                    <div v-for="(point, i) in musicMoodCurve" :key="i" class="mdm-mood-point">
                      <span class="mdm-mood-dot" :style="{ background: point.color }"></span>
                      <span class="mdm-mood-label">{{ point.mood }}</span>
                    </div>
                  </div>
                </div>
                <button class="mdm-ai-btn" style="margin-top:8px">&#10024; AI自动配乐</button>
              </div>

              <!-- Step 5: 生成导出 -->
              <div v-if="animCurrentStep === 4" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">镜头预览</label>
                  <div class="mdm-shot-grid-6">
                    <div v-for="shot in animShots" :key="shot.id" class="mdm-shot-preview"
                      :style="{ background: animStyles[animSelectedStyle].gradient }">
                      <span class="mdm-shot-preview__label">{{ shot.label }}</span>
                      <span class="mdm-shot-badge" :class="'mdm-shot-badge--' + shot.status">
                        {{ shot.status === 'done' ? '✓' : shot.status === 'processing' ? '●' : '○' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">导出格式</label>
                  <div class="mdm-chip-row">
                    <button v-for="(f, i) in animExportFormats" :key="f"
                      class="mdm-chip" :class="{ 'mdm-chip--active': animExportFormat === i }"
                      @click="animExportFormat = i">{{ f }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">分辨率</label>
                  <div class="mdm-chip-row">
                    <button v-for="(r, i) in animResolutions" :key="r"
                      class="mdm-chip" :class="{ 'mdm-chip--active': animResolution === i }"
                      @click="animResolution = i">{{ r }}</button>
                  </div>
                </div>
                <!-- Generation progress -->
                <div v-if="animGenerating" class="mdm-gen-progress">
                  <div v-for="(label, i) in animGenStepLabels" :key="label" class="mdm-gen-progress__item"
                    :class="{ 'mdm-gen-progress__item--done': animGenStep > i, 'mdm-gen-progress__item--active': animGenStep === i }">
                    <div class="mdm-gen-progress__dot">{{ animGenStep > i ? '✓' : '●' }}</div>
                    <span class="mdm-gen-progress__label">{{ label }}{{ animGenStep === i ? '...' : '' }}</span>
                  </div>
                </div>
                <!-- Generated result -->
                <div v-if="animGenerated" class="mdm-result-box">
                  <div class="mdm-result-box__banner">✅ 动画生成完成</div>
                  <button class="mdm-action-btn" @click="handleActionRedirect">🎬 进入工作台 &rarr;</button>
                </div>
              </div>

              <!-- Generate button (always visible) -->
              <button class="mdm-gen-btn" :disabled="animGenerating" @click="handleGenerate">
                <span v-if="animGenerating" class="mdm-spinner"></span>
                <span v-else>🎬 生成动画</span>
              </button>
            </template>

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║        STORY MODULE                  ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'story'">

              <!-- Step 1: 输入故事 -->
              <div v-if="storyCurrentStep === 0" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">输入故事</label>
                  <textarea class="mdm-textarea" v-model="storyText" rows="5"
                    placeholder="从前有一座浮空城……" maxlength="10000"></textarea>
                  <span class="mdm-char-count">{{ storyText.length }} / 10000</span>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">故事模板</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(t, i) in storyTemplates" :key="t.name"
                      class="mdm-tpl-card" @click="selectTemplate('story', i)">
                      <span class="mdm-tpl-card__name">{{ t.name }}</span>
                      <span class="mdm-tpl-card__desc">{{ t.desc }}</span>
                    </button>
                  </div>
                </div>
                <button class="mdm-ai-btn">&#10024; AI灵感</button>
                <details class="mdm-collapsible" :open="storyRefWorksOpen">
                  <summary @click.prevent="storyRefWorksOpen = !storyRefWorksOpen">参考作品</summary>
                  <div class="mdm-collapsible__body">
                    <input class="mdm-input" placeholder="输入参考作品名称" />
                  </div>
                </details>
              </div>

              <!-- Step 2: 结构化编辑 -->
              <div v-if="storyCurrentStep === 1" class="mdm-step-content">
                <div class="mdm-tabs">
                  <button v-for="(tab, i) in ['章节', '角色', '场景']" :key="tab"
                    class="mdm-tab" :class="{ 'mdm-tab--active': storyActiveTab === i }"
                    @click="storyActiveTab = i">{{ tab }}</button>
                </div>

                <!-- 章节 Tab -->
                <div v-if="storyActiveTab === 0" class="mdm-tab-content">
                  <div v-for="(ch, i) in storyChapters" :key="i" class="mdm-chapter-card">
                    <div class="mdm-chapter-card__header">
                      <input class="mdm-input mdm-input--inline" v-model="ch.title" />
                      <div class="mdm-chapter-card__actions">
                        <button class="mdm-icon-btn" @click="i > 0 && storyChapters.splice(i, 1)" title="删除">&times;</button>
                      </div>
                    </div>
                    <div class="mdm-chapter-card__body">
                      <label class="mdm-label">情绪</label>
                      <select class="mdm-select" v-model.number="ch.mood">
                        <option v-for="(m, mi) in storyMoodOptions" :key="mi" :value="mi">
                          {{ m.name }}
                        </option>
                      </select>
                      <div class="mdm-mood-badge" :style="{ background: storyMoodOptions[ch.mood]?.color + '30', color: storyMoodOptions[ch.mood]?.color }">
                        {{ storyMoodOptions[ch.mood]?.name }}
                      </div>
                      <label class="mdm-label" style="margin-top:8px">内容</label>
                      <textarea class="mdm-textarea" v-model="ch.content" rows="3" placeholder="章节内容..."></textarea>
                    </div>
                  </div>
                  <button class="mdm-add-btn" @click="addChapter()">+ &#28155;&#21152;&#31456;&#33410;</button>
                </div>

                <!-- 角色 Tab -->
                <div v-if="storyActiveTab === 1" class="mdm-tab-content">
                  <div v-for="(char, i) in storyCharacters" :key="i" class="mdm-char-card">
                    <div class="mdm-char-card__header">
                      <span class="mdm-char-card__avatar">{{ char.name.charAt(0) }}</span>
                      <input class="mdm-input mdm-input--inline" v-model="char.name" />
                    </div>
                    <div class="mdm-char-card__field">
                      <label class="mdm-label">角色类型</label>
                      <select class="mdm-select" v-model.number="char.archetype">
                        <option v-for="(a, ai) in storyArchetypes" :key="ai" :value="ai">{{ a }}</option>
                      </select>
                    </div>
                    <div class="mdm-char-card__field">
                      <label class="mdm-label">外观描述</label>
                      <textarea class="mdm-textarea mdm-textarea--sm" v-model="char.appearance" rows="2"></textarea>
                    </div>
                    <button class="mdm-ai-btn mdm-ai-btn--sm" @click="genCharPrompt(char)">&#29983;&#25104;&#21442;&#32771;&#22270;&#25552;&#31034;&#35789;</button>
                    <div class="mdm-char-card__field">
                      <label class="mdm-label">提示词</label>
                      <textarea class="mdm-textarea mdm-textarea--sm" v-model="char.prompt" rows="2"></textarea>
                    </div>
                    <div class="mdm-upload-zone mdm-upload-zone--sm"><span>&#128247; 上传参考图</span></div>
                  </div>
                  <button class="mdm-add-btn" @click="addCharacter()">+ &#28155;&#21152;&#35282;&#33394;</button>
                </div>

                <!-- 场景 Tab -->
                <div v-if="storyActiveTab === 2" class="mdm-tab-content">
                  <div v-for="(sc, i) in storyScenes" :key="i" class="mdm-scene-card">
                    <input class="mdm-input" v-model="sc.name" placeholder="场景名称" />
                    <input class="mdm-input" v-model="sc.location" placeholder="地点" />
                    <input class="mdm-input" v-model="sc.atmosphere" placeholder="氛围" />
                    <button class="mdm-ai-btn mdm-ai-btn--sm" @click="genScenePrompt(sc)">&#29983;&#25104;&#22270;&#29255;&#25552;&#31034;&#35789;</button>
                    <textarea class="mdm-textarea mdm-textarea--sm" v-model="sc.prompt" rows="2"></textarea>
                  </div>
                  <button class="mdm-add-btn" @click="addScene()">+ &#28155;&#21152;&#22330;&#26223;</button>
                </div>
              </div>

              <!-- Step 3: 预览确认 -->
              <div v-if="storyCurrentStep === 2" class="mdm-step-content">
                <div class="mdm-preview-sections">
                  <details class="mdm-collapsible" :open="storyExpandedSections.outline">
                    <summary @click.prevent="storyExpandedSections.outline = !storyExpandedSections.outline">📋 大纲 ({{ storyChapters.length }}章)</summary>
                    <div class="mdm-collapsible__body">
                      <div v-for="(ch, i) in storyChapters" :key="i" class="mdm-preview-item">
                        {{ ch.title }} - <span class="mdm-mood-badge-sm" :style="{ color: storyMoodOptions[ch.mood]?.color }">{{ storyMoodOptions[ch.mood]?.name }}</span>
                      </div>
                    </div>
                  </details>
                  <details class="mdm-collapsible" :open="storyExpandedSections.characters">
                    <summary @click.prevent="storyExpandedSections.characters = !storyExpandedSections.characters">👤 角色 ({{ storyCharacters.length }})</summary>
                    <div class="mdm-collapsible__body">
                      <div v-for="(c, i) in storyCharacters" :key="i" class="mdm-preview-item">
                        {{ c.name }} ({{ storyArchetypes[c.archetype] }})
                      </div>
                    </div>
                  </details>
                  <details class="mdm-collapsible" :open="storyExpandedSections.scenes">
                    <summary @click.prevent="storyExpandedSections.scenes = !storyExpandedSections.scenes">🎬 场景 ({{ storyScenes.length }})</summary>
                    <div class="mdm-collapsible__body">
                      <div v-for="(s, i) in storyScenes" :key="i" class="mdm-preview-item">{{ s.name }} - {{ s.location }}</div>
                    </div>
                  </details>
                  <details class="mdm-collapsible" :open="storyExpandedSections.style">
                    <summary @click.prevent="storyExpandedSections.style = !storyExpandedSections.style">🎨 风格</summary>
                    <div class="mdm-collapsible__body">
                      <label class="mdm-label">叙事视角</label>
                      <div class="mdm-chip-row">
                        <button v-for="(n, ni) in storyNarrativeOptions" :key="n"
                          class="mdm-chip" :class="{ 'mdm-chip--active': storyNarrativePerspective === ni }"
                          @click="storyNarrativePerspective = ni">{{ n }}</button>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <!-- Step 4: 导出关联 -->
              <div v-if="storyCurrentStep === 3" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">导出格式</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(f, i) in storyExportFormats" :key="f"
                      class="mdm-export-card" :class="{ 'mdm-export-card--active': storyExportFormat === i }"
                      @click="storyExportFormat = i">
                      <span class="mdm-export-card__icon">{{ ['📄', '📊', '🎬'][i] }}</span>
                      <span class="mdm-export-card__name">{{ f }}</span>
                    </button>
                  </div>
                </div>
                <div class="mdm-cta-box">
                  <span class="mdm-cta-box__text">完成后可直接转入动画生成器</span>
                  <button class="mdm-action-btn mdm-action-btn--sm">🎬 转入动画生成器 &rarr;</button>
                </div>
                <div v-if="storyGenerating" class="mdm-gen-progress">
                  <div v-for="(label, i) in storyGenStepLabels" :key="label" class="mdm-gen-progress__item"
                    :class="{ 'mdm-gen-progress__item--done': storyGenStep > i, 'mdm-gen-progress__item--active': storyGenStep === i }">
                    <div class="mdm-gen-progress__dot">{{ storyGenStep > i ? '✓' : '●' }}</div>
                    <span class="mdm-gen-progress__label">{{ label }}{{ storyGenStep === i ? '...' : '' }}</span>
                  </div>
                </div>
                <div v-if="storyGenerated" class="mdm-result-box">
                  <div class="mdm-result-box__banner">✅ 故事生成完成</div>
                  <button class="mdm-action-btn" @click="handleActionRedirect">📖 进入工作台 &rarr;</button>
                </div>
              </div>

              <button class="mdm-gen-btn" :disabled="storyGenerating" @click="handleGenerate">
                <span v-if="storyGenerating" class="mdm-spinner"></span>
                <span v-else>📖 AI生成完整故事</span>
              </button>
            </template>

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║        PROMO MODULE                  ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'promo'">

              <!-- Step 1: 品牌Brief -->
              <div v-if="promoCurrentStep === 0" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">品牌名称</label>
                  <input class="mdm-input" v-model="promoBrandName" placeholder="例: 星辰科技" />
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">产品描述</label>
                  <textarea class="mdm-textarea" v-model="promoProductDesc" rows="3" placeholder="描述你的产品..."></textarea>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">目标受众</label>
                  <div class="mdm-chip-row">
                    <button v-for="(a, i) in promoAudiences" :key="a"
                      class="mdm-chip" :class="{ 'mdm-chip--active': promoSelectedAudience === i }"
                      @click="promoSelectedAudience = i">{{ a }}</button>
                  </div>
                  <input class="mdm-input" v-model="promoSubTags" placeholder="细分标签 (可选)" style="margin-top:8px" />
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">视频时长</label>
                  <div class="mdm-chip-row">
                    <button v-for="(d, i) in promoDurations" :key="d"
                      class="mdm-chip" :class="{ 'mdm-chip--active': promoSelectedDuration === i }"
                      @click="promoSelectedDuration = i">{{ d }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">品牌素材</label>
                  <div class="mdm-upload-row">
                    <div class="mdm-upload-zone mdm-upload-zone--sm"><span>📦 产品图</span></div>
                    <div class="mdm-upload-zone mdm-upload-zone--sm"><span>🏷️ Logo</span></div>
                    <div class="mdm-upload-zone mdm-upload-zone--sm"><span>🎨 风格参考</span></div>
                  </div>
                </div>
              </div>

              <!-- Step 2: AI生成脚本 -->
              <div v-if="promoCurrentStep === 1" class="mdm-step-content">
                <button class="mdm-ai-btn">&#10024; AI生成脚本</button>
                <div class="mdm-timeline-bar">
                  <div v-for="(sc, i) in promoScenes" :key="i" class="mdm-timeline-segment"
                    :style="{ flex: 1, background: ['#7DD3FC', '#A78BFA', '#F472B6'][i % 3] + '40' }">
                    <span class="mdm-timeline-segment__label">{{ sc.title }}</span>
                  </div>
                </div>
                <div v-for="(sc, i) in promoScenes" :key="i" class="mdm-scene-card">
                  <div class="mdm-scene-card__header">
                    <input class="mdm-input mdm-input--inline" v-model="sc.title" />
                    <span class="mdm-scene-card__time">{{ sc.timeStart }} - {{ sc.timeEnd }}</span>
                  </div>
                  <textarea class="mdm-textarea mdm-textarea--sm" v-model="sc.description" rows="2" placeholder="场景描述"></textarea>
                  <textarea class="mdm-textarea mdm-textarea--sm" v-model="sc.voiceover" rows="2" placeholder="旁白文案"></textarea>
                  <select class="mdm-select" v-model.number="sc.camera">
                    <option v-for="(c, ci) in promoCameraMovements" :key="ci" :value="ci">{{ c }}</option>
                  </select>
                </div>
              </div>

              <!-- Step 3: 镜头生成 -->
              <div v-if="promoCurrentStep === 2" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">自动拆分镜头 (每镜头≤15s)</label>
                </div>
                <div v-for="(shot, i) in promoShots" :key="i" class="mdm-craft-card">
                  <div class="mdm-craft-card__header">
                    <span class="mdm-craft-card__title">{{ shot.label }}</span>
                    <select class="mdm-select mdm-select--sm" v-model.number="shot.camera">
                      <option v-for="(c, ci) in promoCameraMovements" :key="ci" :value="ci">{{ c }}</option>
                    </select>
                  </div>
                  <div class="mdm-craft-grid">
                    <textarea v-for="(_, ci) in shot.craft" :key="ci" class="mdm-textarea mdm-textarea--xs"
                      v-model="shot.craft[ci]" rows="1" :placeholder="'CRAFT ' + (ci + 1)"></textarea>
                  </div>
                  <div class="mdm-upload-zone mdm-upload-zone--xs"><span>&#128247; 参考图</span></div>
                </div>
              </div>

              <!-- Step 4: 逐镜头视频 -->
              <div v-if="promoCurrentStep === 3" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">总体进度</label>
                  <div class="mdm-progress-bar"><div class="mdm-progress-bar__fill" :style="{ width: promoOverallProgress + '%' }"></div></div>
                </div>
                <div v-for="(shot, i) in promoShots" :key="i" class="mdm-gen-card">
                  <div class="mdm-gen-card__header">
                    <span>{{ shot.label }}</span>
                    <span class="mdm-shot-badge" :class="'mdm-shot-badge--' + promoShotStatus[i]">
                      {{ promoShotStatus[i] === 'done' ? '✓' : promoShotStatus[i] === 'processing' ? '生成中' : '等待' }}
                    </span>
                  </div>
                  <div class="mdm-progress-bar mdm-progress-bar--sm"><div class="mdm-progress-bar__fill" :style="{ width: promoShotProgress[i] + '%' }"></div></div>
                  <div v-if="promoShotStatus[i] === 'done'" class="mdm-gen-card__preview">🎬 视频预览</div>
                </div>
              </div>

              <!-- Step 5: 配音配乐 -->
              <div v-if="promoCurrentStep === 4" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">配音</label>
                  <div class="mdm-chip-row">
                    <button v-for="(v, i) in promoVoices" :key="v"
                      class="mdm-chip" :class="{ 'mdm-chip--active': promoSelectedVoice === i }"
                      @click="promoSelectedVoice = i">{{ v }}</button>
                  </div>
                  <div style="margin-top:8px">
                    <label class="mdm-label">语速 ({{ promoVoiceSpeed }}%)</label>
                    <input type="range" min="0" max="100" v-model.number="promoVoiceSpeed" class="mdm-slider" />
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">配乐</label>
                  <div class="mdm-chip-row">
                    <button v-for="(m, i) in promoMusicStyles" :key="m"
                      class="mdm-chip" :class="{ 'mdm-chip--active': promoSelectedMusic === i }"
                      @click="promoSelectedMusic = i">{{ m }}</button>
                  </div>
                  <div style="margin-top:8px">
                    <label class="mdm-label">音量 ({{ promoMusicVolume }}%)</label>
                    <input type="range" min="0" max="100" v-model.number="promoMusicVolume" class="mdm-slider" />
                  </div>
                  <button class="mdm-ai-btn" style="margin-top:8px">&#10024; AI生成品牌配乐</button>
                </div>
                <div class="mdm-waveform-mix">
                  <div class="mdm-waveform-track"><span class="mdm-waveform-track__label">BGM</span><div class="mdm-waveform-bars"><span v-for="n in 30" :key="n" class="mdm-waveform-bar" :style="{ height: (8 + Math.random() * 20) + 'px' }"></span></div></div>
                  <div class="mdm-waveform-track"><span class="mdm-waveform-track__label">VO</span><div class="mdm-waveform-bars"><span v-for="n in 30" :key="n" class="mdm-waveform-bar mdm-waveform-bar--vo" :style="{ height: (6 + Math.random() * 18) + 'px' }"></span></div></div>
                </div>
              </div>

              <!-- Step 6: 合成导出 -->
              <div v-if="promoCurrentStep === 5" class="mdm-step-content">
                <div class="mdm-preview-screen">
                  <div class="mdm-preview-screen__inner">
                    <span class="mdm-preview-screen__play">&#9654;</span>
                    <span class="mdm-preview-screen__title">{{ promoBrandName || '品牌宣传片' }}</span>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">导出格式</label>
                  <div class="mdm-chip-row">
                    <button v-for="(f, i) in promoExportFormats" :key="f" class="mdm-chip" :class="{ 'mdm-chip--active': promoExportFormat === i }" @click="promoExportFormat = i">{{ f }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">分辨率</label>
                  <div class="mdm-chip-row">
                    <button v-for="(r, i) in promoExportResolutions" :key="r" class="mdm-chip" :class="{ 'mdm-chip--active': promoExportResolution === i }" @click="promoExportResolution = i">{{ r }}</button>
                  </div>
                </div>
                <div class="mdm-check-row">
                  <label class="mdm-check"><input type="checkbox" v-model="promoExportVoiceover" /> 配音</label>
                  <label class="mdm-check"><input type="checkbox" v-model="promoExportMusic" /> 配乐</label>
                  <label class="mdm-check"><input type="checkbox" v-model="promoExportWatermark" /> 水印</label>
                  <label class="mdm-check"><input type="checkbox" v-model="promoExportSubtitles" /> 字幕</label>
                </div>
                <div v-if="promoGenerating" class="mdm-gen-progress">
                  <div v-for="(label, i) in promoGenStepLabels" :key="label" class="mdm-gen-progress__item"
                    :class="{ 'mdm-gen-progress__item--done': promoGenStep > i, 'mdm-gen-progress__item--active': promoGenStep === i }">
                    <div class="mdm-gen-progress__dot">{{ promoGenStep > i ? '✓' : '●' }}</div>
                    <span class="mdm-gen-progress__label">{{ label }}{{ promoGenStep === i ? '...' : '' }}</span>
                  </div>
                </div>
                <div v-if="promoGenerated" class="mdm-result-box">
                  <div class="mdm-result-box__banner">✅ 宣传片生成完成</div>
                  <button class="mdm-action-btn" @click="handleActionRedirect">🎥 进入工作台 &rarr;</button>
                </div>
              </div>

              <button class="mdm-gen-btn" :disabled="promoGenerating" @click="handleGenerate">
                <span v-if="promoGenerating" class="mdm-spinner"></span>
                <span v-else>🎥 生成宣传片</span>
              </button>
            </template>

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║       AD-SHORT MODULE                ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'ad-short'">

              <!-- Step 1: 选平台品类 -->
              <div v-if="adShortCurrentStep === 0" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">发布平台</label>
                  <div class="mdm-platform-grid">
                    <button v-for="(p, i) in adShortPlatforms" :key="p.name"
                      class="mdm-platform-card" :class="{ 'mdm-platform-card--active': adShortSelectedPlatform === i }"
                      @click="adShortSelectedPlatform = i">
                      <div class="mdm-platform-card__ratio" :style="{ width: p.w + 'px', height: p.h + 'px' }"></div>
                      <span class="mdm-platform-card__name">{{ p.name }}</span>
                      <span class="mdm-platform-card__dim">{{ p.ratio }}</span>
                    </button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">商品品类</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(c, i) in adShortCategories" :key="c.name"
                      class="mdm-cat-card" :class="{ 'mdm-cat-card--active': adShortSelectedCategory === i }"
                      @click="adShortSelectedCategory = i">
                      <span class="mdm-cat-card__emoji">{{ c.emoji }}</span>
                      <span class="mdm-cat-card__name">{{ c.name }}</span>
                      <span class="mdm-cat-card__music">🎵 {{ c.music }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Step 2: 上传素材 -->
              <div v-if="adShortCurrentStep === 1" class="mdm-step-content">
                <div class="mdm-upload-zone mdm-upload-zone--lg">
                  <span>📁 拖拽图片到此处，或点击上传</span>
                  <span class="mdm-upload-zone__hint">最多9张</span>
                </div>
                <div class="mdm-uploaded-grid">
                  <div v-for="n in adShortUploadedImages" :key="n" class="mdm-uploaded-thumb">
                    <span>{{ n }}</span>
                  </div>
                  <button v-if="adShortUploadedImages < 9" class="mdm-uploaded-add"
                    @click="adShortUploadedImages++">+</button>
                </div>
                <div class="mdm-section" style="margin-top:12px">
                  <label class="mdm-label">产品名称</label>
                  <input class="mdm-input" v-model="adShortProductName" placeholder="例: 美白精华液" />
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">卖点</label>
                  <input v-for="(_, i) in adShortSellingPoints" :key="i"
                    class="mdm-input" v-model="adShortSellingPoints[i]"
                    :placeholder="'卖点 ' + (i + 1)" style="margin-bottom:6px" />
                </div>
              </div>

              <!-- Step 3: AI生成分镜 -->
              <div v-if="adShortCurrentStep === 2" class="mdm-step-content">
                <button class="mdm-ai-btn">&#10024; AI生成分镜</button>
                <div v-for="(shot, i) in adShortShots" :key="i" class="mdm-craft-card">
                  <div class="mdm-craft-card__header">
                    <span class="mdm-craft-card__title">镜头 {{ i + 1 }}</span>
                    <div class="mdm-craft-card__duration">
                      <input type="number" class="mdm-input mdm-input--xs" v-model.number="shot.duration" min="1" max="15" />
                      <span>s</span>
                    </div>
                  </div>
                  <textarea class="mdm-textarea mdm-textarea--sm" v-model="shot.prompt" rows="2" placeholder="CRAFT 提示词"></textarea>
                  <textarea class="mdm-textarea mdm-textarea--xs" v-model="shot.voiceover" rows="1" placeholder="旁白文案"></textarea>
                  <select class="mdm-select mdm-select--sm" v-model.number="shot.camera">
                    <option v-for="(c, ci) in adShortCameraMovements" :key="ci" :value="ci">{{ c }}</option>
                  </select>
                </div>
              </div>

              <!-- Step 4: 逐镜头生成 -->
              <div v-if="adShortCurrentStep === 3" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">总体进度</label>
                  <div class="mdm-progress-bar"><div class="mdm-progress-bar__fill" :style="{ width: adShortOverallProgress + '%' }"></div></div>
                </div>
                <div v-for="(shot, i) in adShortShots" :key="i" class="mdm-gen-card">
                  <div class="mdm-gen-card__header">
                    <span>镜头 {{ i + 1 }} ({{ shot.duration }}s)</span>
                    <span class="mdm-shot-badge" :class="'mdm-shot-badge--' + adShortShotStatus[i]">
                      {{ adShortShotStatus[i] === 'done' ? '✓' : adShortShotStatus[i] === 'processing' ? '生成中' : '等待' }}
                    </span>
                  </div>
                  <div class="mdm-progress-bar mdm-progress-bar--sm"><div class="mdm-progress-bar__fill" :style="{ width: adShortShotProgress[i] + '%' }"></div></div>
                </div>
              </div>

              <!-- Step 5: 配乐字幕 -->
              <div v-if="adShortCurrentStep === 4" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">自动匹配音乐 ({{ adShortCategories[adShortSelectedCategory].name }})</label>
                  <div class="mdm-music-track-card">
                    <div class="mdm-waveform-mini">
                      <span v-for="n in 20" :key="n" class="mdm-waveform-bar" :style="{ height: (6 + Math.random() * 16) + 'px' }"></span>
                    </div>
                    <span class="mdm-music-track-card__name">{{ adShortCategories[adShortSelectedCategory].music }} BGM 1</span>
                  </div>
                  <div class="mdm-music-track-card">
                    <div class="mdm-waveform-mini">
                      <span v-for="n in 20" :key="n" class="mdm-waveform-bar" :style="{ height: (6 + Math.random() * 16) + 'px' }"></span>
                    </div>
                    <span class="mdm-music-track-card__name">{{ adShortCategories[adShortSelectedCategory].music }} BGM 2</span>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">字幕预览</label>
                  <div class="mdm-subtitle-preview">
                    <div class="mdm-subtitle-preview__frame">
                      <span class="mdm-subtitle-preview__text"
                        :style="{ color: adShortSubtitleColor, fontSize: (12 + adShortSubtitleFontSize / 10) + 'px', bottom: adShortSubtitlePosition === 0 ? '12px' : 'auto', top: adShortSubtitlePosition === 1 ? '12px' : 'auto' }">
                        {{ adShortProductName || '字幕预览' }}
                      </span>
                    </div>
                  </div>
                  <div class="mdm-chip-row" style="margin-top:8px">
                    <button class="mdm-chip" :class="{ 'mdm-chip--active': adShortSubtitlePosition === 0 }" @click="adShortSubtitlePosition = 0">底部</button>
                    <button class="mdm-chip" :class="{ 'mdm-chip--active': adShortSubtitlePosition === 1 }" @click="adShortSubtitlePosition = 1">顶部</button>
                  </div>
                  <div style="margin-top:8px">
                    <label class="mdm-label">字号 ({{ adShortSubtitleFontSize }})</label>
                    <input type="range" min="20" max="80" v-model.number="adShortSubtitleFontSize" class="mdm-slider" />
                  </div>
                  <div style="margin-top:8px">
                    <label class="mdm-label">颜色</label>
                    <div class="mdm-chip-row">
                      <button v-for="c in ['#FFFFFF', '#FFD700', '#FF4444', '#00D4AA']" :key="c"
                        class="mdm-color-chip" :style="{ background: c }"
                        :class="{ 'mdm-color-chip--active': adShortSubtitleColor === c }"
                        @click="adShortSubtitleColor = c"></button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 6: 多版本导出 -->
              <div v-if="adShortCurrentStep === 5" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">跟踪标签</label>
                  <div class="mdm-chip-row">
                    <span class="mdm-chip mdm-chip--tag">#{{ adShortCategories[adShortSelectedCategory].name }}</span>
                    <span class="mdm-chip mdm-chip--tag">#{{ adShortPlatforms[adShortSelectedPlatform].name }}</span>
                    <span class="mdm-chip mdm-chip--tag">#短视频</span>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">A/B 版本</label>
                  <div class="mdm-card-grid mdm-card-grid--2">
                    <div class="mdm-version-card">
                      <span class="mdm-version-card__label">A 版本</span>
                      <div class="mdm-version-card__preview"></div>
                    </div>
                    <div class="mdm-version-card">
                      <span class="mdm-version-card__label">B 版本</span>
                      <div class="mdm-version-card__preview"></div>
                    </div>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">导出格式</label>
                  <div class="mdm-chip-row">
                    <button v-for="(f, i) in adShortExportFormats" :key="f"
                      class="mdm-chip" :class="{ 'mdm-chip--active': adShortExportFormat === i }"
                      @click="adShortExportFormat = i">{{ f }}</button>
                  </div>
                </div>
                <div v-if="adShortGenerating" class="mdm-gen-progress">
                  <div v-for="(label, i) in adShortGenStepLabels" :key="label" class="mdm-gen-progress__item"
                    :class="{ 'mdm-gen-progress__item--done': adShortGenStep > i, 'mdm-gen-progress__item--active': adShortGenStep === i }">
                    <div class="mdm-gen-progress__dot">{{ adShortGenStep > i ? '✓' : '●' }}</div>
                    <span class="mdm-gen-progress__label">{{ label }}{{ adShortGenStep === i ? '...' : '' }}</span>
                  </div>
                </div>
                <div v-if="adShortGenerated" class="mdm-result-box">
                  <div class="mdm-result-box__banner">✅ 短视频生成完成</div>
                  <button class="mdm-action-btn" @click="handleActionRedirect">📹 进入工作台 &rarr;</button>
                </div>
              </div>

              <button class="mdm-gen-btn" :disabled="adShortGenerating" @click="handleGenerate">
                <span v-if="adShortGenerating" class="mdm-spinner"></span>
                <span v-else>📹 一键成片</span>
              </button>
            </template>

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║       AD-IMAGE MODULE                ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'ad-image'">

              <!-- Step 1: 选模板上传 -->
              <div v-if="adImageCurrentStep === 0" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">风格模板</label>
                  <div class="mdm-card-grid mdm-card-grid--3">
                    <button v-for="(s, i) in adImageStyles" :key="s.name"
                      class="mdm-style-card" :class="{ 'mdm-style-card--active': adImageSelectedStyle === i }"
                      @click="adImageSelectedStyle = i">
                      <div class="mdm-style-card__preview" :style="{ background: s.gradient }">
                        <div class="mdm-style-card__tags">
                          <span v-for="tag in s.tags" :key="tag" class="mdm-style-card__tag">{{ tag }}</span>
                        </div>
                      </div>
                      <span class="mdm-style-card__name">{{ s.name }}</span>
                    </button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">产品图片 (1-3张)</label>
                  <div class="mdm-upload-zone">
                    <span>&#128247; 上传产品图片</span>
                    <button class="mdm-upload-zone__btn" @click="adImageProductImages = Math.min(3, adImageProductImages + 1)">+ 添加</button>
                    <span v-if="adImageProductImages > 0" class="mdm-upload-zone__count">已选 {{ adImageProductImages }} 张</span>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">产品名称</label>
                  <input class="mdm-input" v-model="adImageProductName" placeholder="例: 保湿面霜" />
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">标语</label>
                  <input class="mdm-input" v-model="adImageTagline" placeholder="例: 深层保湿，焕发光彩" />
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">品牌套件</label>
                  <div class="mdm-brand-kit">
                    <button class="mdm-chip mdm-chip--active">默认</button>
                    <button class="mdm-chip">+ 新建</button>
                  </div>
                </div>
              </div>

              <!-- Step 2: AI生成广告图 -->
              <div v-if="adImageCurrentStep === 1" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">CRAFT 提示词预览</label>
                  <div class="mdm-craft-preview">
                    <code>{{ adImageProductName }}{{ adImageTagline ? ' - ' + adImageTagline : '' }}, {{ adImageStyles[adImageSelectedStyle].name }}风格, 商业广告摄影</code>
                  </div>
                </div>
                <button class="mdm-ai-btn">&#10024; 生成</button>
                <div class="mdm-candidate-grid">
                  <div v-for="n in adImageCandidates" :key="n" class="mdm-candidate-card"
                    :style="{ background: adImageStyles[adImageSelectedStyle].gradient }">
                    <span class="mdm-candidate-card__overlay">{{ adImageProductName || '产品' }}</span>
                    <span class="mdm-candidate-card__num">#{{ n }}</span>
                  </div>
                </div>
                <button class="mdm-refresh-btn">&#x21BB; 换一批</button>
              </div>

              <!-- Step 3: 文案排版 -->
              <div v-if="adImageCurrentStep === 2" class="mdm-step-content">
                <div class="mdm-layout-split">
                  <div class="mdm-layout-split__preview">
                    <div class="mdm-canvas-preview" :style="{ background: adImageStyles[adImageSelectedStyle].gradient }">
                      <span class="mdm-canvas-text"
                        :style="{ color: adImageFontColor, top: adImageTextPosition < 3 ? '15%' : adImageTextPosition < 6 ? '45%' : '75%', left: (adImageTextPosition % 3 === 0 ? '10%' : adImageTextPosition % 3 === 1 ? '45%' : '80%'), textAlign: adImageTextPosition % 3 === 0 ? 'left' : adImageTextPosition % 3 === 1 ? 'center' : 'right' }">
                        {{ adImageHeadline || '标题' }}<br/>
                        <small>{{ adImageSubHeadline || '副标题' }}</small>
                      </span>
                    </div>
                  </div>
                  <div class="mdm-layout-split__controls">
                    <button class="mdm-ai-btn mdm-ai-btn--sm">&#10024; AI生成文案</button>
                    <div class="mdm-section">
                      <label class="mdm-label">主标题</label>
                      <input class="mdm-input" v-model="adImageHeadline" placeholder="主标题" />
                    </div>
                    <div class="mdm-section">
                      <label class="mdm-label">副标题</label>
                      <input class="mdm-input" v-model="adImageSubHeadline" placeholder="副标题" />
                    </div>
                    <div class="mdm-section">
                      <label class="mdm-label">CTA</label>
                      <div class="mdm-chip-row mdm-chip-row--wrap">
                        <button v-for="(c, i) in adImageCtaOptions" :key="c"
                          class="mdm-chip" :class="{ 'mdm-chip--active': adImageSelectedCta === i }"
                          @click="adImageSelectedCta = i">{{ c }}</button>
                      </div>
                    </div>
                    <div class="mdm-section">
                      <label class="mdm-label">文字位置</label>
                      <div class="mdm-position-grid">
                        <button v-for="n in 9" :key="n"
                          class="mdm-position-cell" :class="{ 'mdm-position-cell--active': adImageTextPosition === n - 1 }"
                          @click="adImageTextPosition = n - 1"></button>
                      </div>
                    </div>
                    <div class="mdm-section">
                      <label class="mdm-label">字色</label>
                      <div class="mdm-chip-row">
                        <button v-for="c in ['#FFFFFF', '#000000', '#FFD700', '#FF4444']" :key="c"
                          class="mdm-color-chip" :style="{ background: c, border: c === '#000000' ? '1px solid #555' : 'none' }"
                          :class="{ 'mdm-color-chip--active': adImageFontColor === c }"
                          @click="adImageFontColor = c"></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 4: 多尺寸生成 -->
              <div v-if="adImageCurrentStep === 3" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">目标尺寸</label>
                  <div class="mdm-size-list">
                    <label v-for="(s, i) in adImageSizes" :key="s.label" class="mdm-size-row">
                      <input type="checkbox" v-model="s.checked" />
                      <span class="mdm-size-row__ratio">{{ s.label }}</span>
                      <span class="mdm-size-row__dim">{{ s.dim }}</span>
                      <span class="mdm-size-row__platform">{{ s.platform }}</span>
                    </label>
                  </div>
                </div>
                <button class="mdm-gen-btn mdm-gen-btn--sm" @click="adImageGenerated = true; adImageGenerating = false">
                  生成 {{ adImageCheckedCount }} 个尺寸
                </button>
                <div v-if="adImageGenerated" class="mdm-size-result-grid">
                  <div v-for="s in adImageSizes.filter(s => s.checked)" :key="s.label" class="mdm-size-result-card"
                    :style="{ background: adImageStyles[adImageSelectedStyle].gradient }">
                    <span class="mdm-size-result-card__label">{{ s.label }} {{ s.dim }}</span>
                  </div>
                </div>
              </div>

              <!-- Step 5: 导出 -->
              <div v-if="adImageCurrentStep === 4" class="mdm-step-content">
                <div class="mdm-section">
                  <label class="mdm-label">导出格式</label>
                  <div class="mdm-chip-row">
                    <button v-for="(f, i) in adImageExportFormats" :key="f"
                      class="mdm-chip" :class="{ 'mdm-chip--active': adImageExportFormat === i }"
                      @click="adImageExportFormat = i">{{ f }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-label">质量</label>
                  <div class="mdm-chip-row">
                    <button v-for="(q, i) in adImageQualityOptions" :key="q"
                      class="mdm-chip" :class="{ 'mdm-chip--active': adImageQuality === i }"
                      @click="adImageQuality = i">{{ q }}</button>
                  </div>
                </div>
                <div class="mdm-section">
                  <label class="mdm-check"><input type="checkbox" v-model="adImageWatermark" /> 添加水印</label>
                </div>
                <div v-if="adImageGenerating" class="mdm-gen-progress">
                  <div v-for="(label, i) in adImageGenStepLabels" :key="label" class="mdm-gen-progress__item"
                    :class="{ 'mdm-gen-progress__item--done': adImageGenStep > i, 'mdm-gen-progress__item--active': adImageGenStep === i }">
                    <div class="mdm-gen-progress__dot">{{ adImageGenStep > i ? '✓' : '●' }}</div>
                    <span class="mdm-gen-progress__label">{{ label }}{{ adImageGenStep === i ? '...' : '' }}</span>
                  </div>
                </div>
                <div v-if="adImageGenerated" class="mdm-result-box">
                  <div class="mdm-result-box__banner">✅ 广告图生成完成</div>
                  <button class="mdm-action-btn" @click="handleActionRedirect">🖼️ 进入工作台 &rarr;</button>
                </div>
              </div>

              <button class="mdm-gen-btn" :disabled="adImageGenerating" @click="handleGenerate">
                <span v-if="adImageGenerating" class="mdm-spinner"></span>
                <span v-else>🖼️ 生成广告图</span>
              </button>
            </template>

            <!-- ╔══════════════════════════════════════╗ -->
            <!-- ║        MUSIC MODULE                  ║ -->
            <!-- ╚══════════════════════════════════════╝ -->
            <template v-if="moduleId === 'music'">

              <!-- Mode Toggle -->
              <div class="mdm-mode-toggle">
                <button class="mdm-mode-btn" :class="{ 'mdm-mode-btn--active': musicMode === 'A' }"
                  @click="musicMode = 'A'; musicCurrentStep = 0; musicGenerated = false">独立创作</button>
                <button class="mdm-mode-btn" :class="{ 'mdm-mode-btn--active': musicMode === 'B' }"
                  @click="musicMode = 'B'; musicCurrentStep = 0; musicGenerated = false">为画面配乐</button>
              </div>

              <!-- ═══ MODE A: 独立创作 ═══ -->
              <template v-if="musicMode === 'A'">

                <!-- Step 1: 生成方式 -->
                <div v-if="musicCurrentStep === 0" class="mdm-step-content">
                  <div class="mdm-section">
                    <label class="mdm-label">生成方式</label>
                    <div class="mdm-card-grid mdm-card-grid--3">
                      <button v-for="(m, i) in musicMethods" :key="m.name"
                        class="mdm-method-card" :class="{ 'mdm-method-card--active': musicSelectedMethod === i }"
                        @click="musicSelectedMethod = i">
                        <span class="mdm-method-card__icon">{{ m.icon }}</span>
                        <span class="mdm-method-card__name">{{ m.name }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">曲风</label>
                    <div class="mdm-genre-grid">
                      <button v-for="(g, i) in musicGenres" :key="g"
                        class="mdm-genre-chip" :class="{ 'mdm-genre-chip--active': musicSelectedGenre === i }"
                        @click="musicSelectedGenre = i">{{ g }}</button>
                    </div>
                  </div>
                  <div v-if="musicSelectedMethod === 2" class="mdm-section">
                    <label class="mdm-label">&#21442;&#32771;&#38899;&#39057;</label>
                    <div class="mdm-upload-zone mdm-upload-zone--sm"><span>&#127911; &#19978;&#20256;&#21442;&#32771;&#38899;&#39057;</span></div>
                    <div style="margin-top:8px">
                      <label class="mdm-label">&#30456;&#20284;&#24230; ({{ musicSimilarity }}%)</label>
                      <input type="range" min="0" max="100" v-model.number="musicSimilarity" class="mdm-slider" />
                    </div>
                  </div>
                </div>

                <!-- Step 2: 参数调整 -->
                <div v-if="musicCurrentStep === 1" class="mdm-step-content">
                  <div class="mdm-section">
                    <label class="mdm-label">&#26102;&#38271;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(d, i) in musicDurations" :key="d"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicSelectedDuration === i }"
                        @click="musicSelectedDuration = i">{{ d }}</button>
                    </div>
                    <div style="margin-top:8px">
                      <label class="mdm-label">&#33258;&#23450;&#20041; ({{ musicCustomDuration }}s)</label>
                      <input type="range" min="5" max="300" v-model.number="musicCustomDuration" class="mdm-slider" />
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">BPM ({{ musicBpm }})</label>
                    <input type="range" min="40" max="200" v-model.number="musicBpm" class="mdm-slider" />
                    <div class="mdm-slider-labels"><span>40</span><span>200</span></div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#35843;&#24335;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(k, i) in musicKeys" :key="k"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicSelectedKey === i }"
                        @click="musicSelectedKey = i">{{ k }}</button>
                    </div>
                    <div class="mdm-chip-row" style="margin-top:6px">
                      <button v-for="(m, i) in musicModes_scale" :key="m"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicSelectedModeScale === i }"
                        @click="musicSelectedModeScale = i">{{ m }}</button>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#20048;&#22120;</label>
                    <div class="mdm-genre-grid">
                      <button v-for="(inst, i) in musicInstruments" :key="inst"
                        class="mdm-genre-chip" :class="{ 'mdm-genre-chip--active': musicSelectedInstruments.includes(i) }"
                        @click="toggleInstrument(i)">{{ inst }}</button>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#24773;&#32490;&#26354;&#32447;</label>
                    <div class="mdm-mood-timeline">
                      <div v-for="(point, i) in musicMoodCurve" :key="i" class="mdm-mood-point">
                        <span class="mdm-mood-dot" :style="{ background: point.color }"></span>
                        <span class="mdm-mood-label">{{ point.mood }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Step 3: 生成预览 -->
                <div v-if="musicCurrentStep === 2" class="mdm-step-content">
                  <button class="mdm-gen-btn mdm-gen-btn--sm" :disabled="musicGenerating" @click="handleGenerate">
                    <span v-if="musicGenerating" class="mdm-spinner"></span>
                    <span v-else>&#127925; &#30083;&#25104;&#37197;&#20048;</span>
                  </button>
                  <div v-if="musicGenerating" class="mdm-gen-progress">
                    <div v-for="(label, i) in musicGenStepLabelsA" :key="label" class="mdm-gen-progress__item"
                      :class="{ 'mdm-gen-progress__item--done': musicGenStep > i, 'mdm-gen-progress__item--active': musicGenStep === i }">
                      <div class="mdm-gen-progress__dot">{{ musicGenStep > i ? '✓' : '●' }}</div>
                      <span class="mdm-gen-progress__label">{{ label }}{{ musicGenStep === i ? '...' : '' }}</span>
                    </div>
                  </div>
                  <div v-if="musicGenerated" class="mdm-section">
                    <label class="mdm-label">&#20505;&#36873;&#26354;&#30446;</label>
                    <div class="mdm-candidate-list">
                      <div v-for="(c, i) in musicCandidates" :key="i"
                        class="mdm-music-candidate" :class="{ 'mdm-music-candidate--active': musicSelectedCandidate === i }"
                        @click="toggleMusicCandidate(i)">
                        <button class="mdm-play-btn-sm">{{ c.playing ? '⏸' : '▶' }}</button>
                        <div class="mdm-waveform-mini mdm-waveform-mini--sm">
                          <span v-for="n in 15" :key="n" class="mdm-waveform-bar" :style="{ height: (6 + Math.random() * 14) + 'px' }"></span>
                        </div>
                        <span class="mdm-music-candidate__label">Track {{ i + 1 }}</span>
                      </div>
                    </div>
                    <div class="mdm-section" style="margin-top:12px">
                      <label class="mdm-label">BGM &#36873;&#25321;</label>
                      <div class="mdm-bgm-grid">
                        <button v-for="(t, i) in musicBgmTracks" :key="i"
                          class="mdm-bgm-btn" :class="{ 'mdm-bgm-btn--active': t.selected }"
                          @click="musicBgmTracks.forEach(tt => tt.selected = false); t.selected = true">
                          {{ t.name }}
                        </button>
                      </div>
                    </div>
                    <button class="mdm-ai-btn" style="margin-top:8px">&#10024; &#21464;&#22863;</button>
                    <div class="mdm-variation-list">
                      <div v-for="v in musicVariations" :key="v.name" class="mdm-variation-card">
                        <span>{{ v.name }}</span>
                        <button class="mdm-play-btn-sm">&#9654;</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Step 4: 导出 -->
                <div v-if="musicCurrentStep === 3" class="mdm-step-content">
                  <div class="mdm-section">
                    <label class="mdm-label">&#23548;&#20986;&#26684;&#24335;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(f, i) in musicExportFormats" :key="f"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicExportFormat === i }"
                        @click="musicExportFormat = i">{{ f }}</button>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#36136;&#37327;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(q, i) in musicExportQualityOptions" :key="q"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicExportQuality === i }"
                        @click="musicExportQuality = i">{{ q }}</button>
                    </div>
                  </div>
                  <button class="mdm-action-btn">&#128229; &#19979;&#36733;&#37197;&#20048;</button>
                  <button class="mdm-action-btn mdm-action-btn--outline" @click="handleActionRedirect">&#128228; &#21457;&#36865;&#21040;&#32534;&#36753;&#22120;</button>
                </div>
              </template>

              <!-- ═══ MODE B: 为画面配乐 ═══ -->
              <template v-if="musicMode === 'B'">

                <!-- Step 1: 接收镜头 -->
                <div v-if="musicCurrentStep === 0" class="mdm-step-content">
                  <div class="mdm-section">
                    <label class="mdm-label">&#38236;&#22836;&#21015;&#34920; (&#20174;&#32534;&#36753;&#22120;&#23548;&#20837;)</label>
                    <div class="mdm-shot-list-b">
                      <div v-for="(s, i) in musicBShots" :key="i" class="mdm-shot-item-b">
                        <span class="mdm-shot-item-b__label">{{ s.label }}</span>
                        <span class="mdm-mood-badge-sm" :style="{ background: '#8B5CF630', color: '#8B5CF6' }">{{ s.mood }}</span>
                      </div>
                    </div>
                    <button class="mdm-add-btn" @click="addMusicBShot()">+ &#28155;&#21152;&#38236;&#22836;</button>
                  </div>
                </div>

                <!-- Step 2: AI匹配配乐 -->
                <div v-if="musicCurrentStep === 1" class="mdm-step-content">
                  <div class="mdm-timeline-view">
                    <div class="mdm-timeline-row">
                      <span class="mdm-timeline-row__label">&#38236;&#22836;</span>
                      <div class="mdm-timeline-segments">
                        <div v-for="(s, i) in musicBShots" :key="i" class="mdm-timeline-seg" :style="{ flex: 1, background: ['#7DD3FC40', '#A78BFA40', '#F472B640'][i % 3] }">
                          {{ s.label }}
                        </div>
                      </div>
                    </div>
                    <div class="mdm-timeline-row">
                      <span class="mdm-timeline-row__label">&#38899;&#20048;</span>
                      <div class="mdm-timeline-segments">
                        <div v-for="(s, i) in musicBShots" :key="i" class="mdm-timeline-seg mdm-timeline-seg--music" :style="{ flex: 1 }">
                          &#127925;
                        </div>
                      </div>
                    </div>
                  </div>
                  <button class="mdm-ai-btn">&#10024; AI&#20026;&#20840;&#37096;&#38236;&#22836;&#29983;&#25104;&#37197;&#20048;</button>
                  <div v-for="(s, i) in musicBShots" :key="i" class="mdm-shot-mixer-card">
                    <span class="mdm-shot-mixer-card__label">{{ s.label }}</span>
                    <div class="mdm-shot-mixer-card__controls">
                      <label class="mdm-label">&#38899;&#37327;</label>
                      <input type="range" min="0" max="100" v-model.number="s.volume" class="mdm-slider mdm-slider--sm" />
                      <label class="mdm-label">&#28129;&#20837;&#28129;&#20986;</label>
                      <input type="range" min="0" max="100" v-model.number="s.fade" class="mdm-slider mdm-slider--sm" />
                    </div>
                  </div>
                </div>

                <!-- Step 3: 全局混音 -->
                <div v-if="musicCurrentStep === 2" class="mdm-step-content">
                  <div class="mdm-full-timeline">
                    <div class="mdm-full-timeline__playhead"></div>
                    <div class="mdm-full-timeline__tracks">
                      <div v-for="(s, i) in musicBShots" :key="i" class="mdm-full-timeline__track" :style="{ background: ['#7DD3FC30', '#A78BFA30', '#F472B630'][i % 3] }">
                        {{ s.label }}
                      </div>
                    </div>
                  </div>
                  <div class="mdm-section" style="margin-top:12px">
                    <label class="mdm-label">&#20840;&#23616;&#38899;&#37327;&#25511;&#21046;</label>
                    <div class="mdm-global-controls">
                      <div class="mdm-global-control">
                        <span>BGM</span>
                        <input type="range" min="0" max="100" v-model.number="musicBGlobalBgm" class="mdm-slider mdm-slider--sm" />
                        <span>{{ musicBGlobalBgm }}%</span>
                      </div>
                      <div class="mdm-global-control">
                        <span>&#26049;&#30333;</span>
                        <input type="range" min="0" max="100" v-model.number="musicBGlobalVoiceover" class="mdm-slider mdm-slider--sm" />
                        <span>{{ musicBGlobalVoiceover }}%</span>
                      </div>
                      <div class="mdm-global-control">
                        <span>SFX</span>
                        <input type="range" min="0" max="100" v-model.number="musicBGlobalSfx" class="mdm-slider mdm-slider--sm" />
                        <span>{{ musicBGlobalSfx }}%</span>
                      </div>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#20132;&#21449;&#28129;&#20837;&#28129;&#20986; ({{ musicBCrossFade }}%)</label>
                    <input type="range" min="0" max="100" v-model.number="musicBCrossFade" class="mdm-slider" />
                  </div>
                </div>

                <!-- Step 4: 导出 -->
                <div v-if="musicCurrentStep === 3" class="mdm-step-content">
                  <div class="mdm-section">
                    <label class="mdm-label">&#23548;&#20986;&#27169;&#24335;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(m, i) in musicBExportModes" :key="m"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicBExportMode === i }"
                        @click="musicBExportMode = i">{{ m }}</button>
                    </div>
                  </div>
                  <div class="mdm-section">
                    <label class="mdm-label">&#23548;&#20986;&#26684;&#24335;</label>
                    <div class="mdm-chip-row">
                      <button v-for="(f, i) in musicExportFormats" :key="f"
                        class="mdm-chip" :class="{ 'mdm-chip--active': musicExportFormat === i }"
                        @click="musicExportFormat = i">{{ f }}</button>
                    </div>
                  </div>
                  <div v-if="musicBExportMode === 1" class="mdm-section">
                    <label class="mdm-label">&#20998;&#27573;&#21015;&#34920;</label>
                    <div v-for="(s, i) in musicBShots" :key="i" class="mdm-segment-item">
                      <span>{{ s.label }}</span>
                      <span class="mdm-segment-item__mood">{{ s.mood }}</span>
                    </div>
                  </div>
                  <button class="mdm-action-btn">&#128229; &#23548;&#20986;</button>
                  <button class="mdm-action-btn mdm-action-btn--outline" @click="handleActionRedirect">&#128228; &#21457;&#36865;&#22238;&#32534;&#36753;&#22120;</button>
                  <div v-if="musicGenerating" class="mdm-gen-progress">
                    <div v-for="(label, i) in musicGenStepLabelsB" :key="label" class="mdm-gen-progress__item"
                      :class="{ 'mdm-gen-progress__item--done': musicGenStep > i, 'mdm-gen-progress__item--active': musicGenStep === i }">
                      <div class="mdm-gen-progress__dot">{{ musicGenStep > i ? '✓' : '●' }}</div>
                      <span class="mdm-gen-progress__label">{{ label }}{{ musicGenStep === i ? '...' : '' }}</span>
                    </div>
                  </div>
                  <div v-if="musicGenerated" class="mdm-result-box">
                    <div class="mdm-result-box__banner">&#9989; &#37197;&#20048;&#29983;&#25104;&#23436;&#25104;</div>
                  </div>
                </div>
              </template>

              <!-- Music generate button (Mode A uses inline button in step 3, this is for Mode B) -->
              <button v-if="musicMode === 'B'" class="mdm-gen-btn" :disabled="musicGenerating" @click="handleGenerate">
                <span v-if="musicGenerating" class="mdm-spinner"></span>
                <span v-else>&#127925; AI&#21305;&#37197;&#37197;&#20048;</span>
              </button>
            </template>

          </div><!-- end mdm-body -->
        </div><!-- end mdm-card -->
      </div>
    </Transition>

    <LoginModal :modelValue="showLoginModal" @update:modelValue="onLoginModalClose" />
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ── */
.mdm-backdrop {
  position: fixed; inset: 0; z-index: 9998;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
  padding: 20px; overflow: hidden; overscroll-behavior: contain;
}
.mdm-card {
  width: 100%; max-width: 960px; max-height: 90vh;
  background: #111113; border: 1px solid #2E2E33; border-radius: 16px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* ── Header ── */
.mdm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px; border-bottom: 1px solid #1E1E22; flex-shrink: 0;
}
.mdm-header__left { display: flex; align-items: center; gap: 14px; }
.mdm-header__icon {
  width: 42px; height: 42px; border-radius: 12px; border: 1px solid;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.mdm-header__title { font-size: 18px; font-weight: 700; color: #FAFAFA; margin: 0; }
.mdm-close {
  width: 34px; height: 34px; border-radius: 8px; border: none;
  background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.5);
  font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 200ms; font-family: inherit;
}
.mdm-close:hover { background: rgba(255, 255, 255, 0.12); color: #FAFAFA; }

/* ── Balance Warning ── */
.mdm-balance-warning {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 24px; background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25); flex-shrink: 0;
}
.mdm-balance-warning__icon { font-size: 22px; flex-shrink: 0; }
.mdm-balance-warning__text { flex: 1; }
.mdm-balance-warning__text strong { font-size: 13px; color: #FBBF24; display: block; }
.mdm-balance-warning__text p { font-size: 12px; color: #A1A1AA; margin: 2px 0 0; }
.mdm-balance-warning__btn {
  padding: 7px 14px; border-radius: 8px; background: #F59E0B; color: #09090B;
  font-size: 12px; font-weight: 700; border: none; cursor: pointer; white-space: nowrap;
}

/* ── Step Nav Bar ── */
.mdm-step-nav {
  display: flex; align-items: center; padding: 14px 24px; gap: 0;
  border-bottom: 1px solid #1E1E22; flex-shrink: 0; overflow-x: auto;
}
.mdm-step-nav__item {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  position: relative; flex-shrink: 0;
}
.mdm-step-nav__circle {
  width: 26px; height: 26px; border-radius: 50%; background: #1E1E22;
  border: 2px solid #2E2E33; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #52525B; transition: all 300ms;
}
.mdm-step-nav__label { font-size: 11px; color: #52525B; font-weight: 600; white-space: nowrap; }
.mdm-step-nav__line { width: 24px; height: 2px; background: #2E2E33; margin: 0 6px; flex-shrink: 0; }
.mdm-step-nav__line--done { background: #00D4AA; }
.mdm-step-nav__item--active .mdm-step-nav__circle {
  border-color: #00D4AA; color: #00D4AA; background: rgba(0, 212, 170, 0.1);
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.3);
}
.mdm-step-nav__item--active .mdm-step-nav__label { color: #FAFAFA; }
.mdm-step-nav__item--done .mdm-step-nav__circle { background: #00D4AA; border-color: #00D4AA; color: #09090B; }
.mdm-step-nav__item--done .mdm-step-nav__label { color: #00D4AA; }

/* ── Body ── */
.mdm-body {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  display: flex; flex-direction: column; gap: 14px;
}
.mdm-body::-webkit-scrollbar { width: 6px; }
.mdm-body::-webkit-scrollbar-track { background: transparent; }
.mdm-body::-webkit-scrollbar-thumb { background: #2E2E33; border-radius: 3px; }

/* ── Common ── */
.mdm-step-content { display: flex; flex-direction: column; gap: 14px; }
.mdm-section { display: flex; flex-direction: column; gap: 6px; }
.mdm-label { font-size: 12px; color: #71717A; font-weight: 600; margin: 0; }
.mdm-char-count { font-size: 11px; color: #52525B; text-align: right; }

/* Textarea & Input */
.mdm-textarea {
  width: 100%; padding: 10px 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 8px; color: #FAFAFA; font-size: 13px; font-family: inherit;
  resize: none; outline: none; transition: border-color 200ms; box-sizing: border-box;
}
.mdm-textarea:focus { border-color: #00D4AA; }
.mdm-textarea::placeholder { color: #52525B; }
.mdm-textarea--sm { padding: 8px 10px; font-size: 12px; }
.mdm-textarea--xs { padding: 6px 8px; font-size: 11px; }
.mdm-input {
  width: 100%; padding: 10px 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 8px; color: #FAFAFA; font-size: 13px; font-family: inherit;
  outline: none; transition: border-color 200ms; box-sizing: border-box;
}
.mdm-input:focus { border-color: #00D4AA; }
.mdm-input::placeholder { color: #52525B; }
.mdm-input--inline { flex: 1; min-width: 0; }
.mdm-input--xs { width: 48px; padding: 4px 6px; text-align: center; font-size: 12px; }

/* Select */
.mdm-select {
  padding: 8px 10px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 8px; color: #FAFAFA; font-size: 12px; outline: none; width: 100%;
}
.mdm-select--sm { padding: 4px 8px; font-size: 11px; width: auto; }

/* Slider */
.mdm-slider {
  width: 100%; -webkit-appearance: none; appearance: none; height: 4px;
  background: #2E2E33; border-radius: 2px; outline: none;
}
.mdm-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: #00D4AA; cursor: pointer;
}
.mdm-slider--sm { width: 100px; }
.mdm-slider-labels { display: flex; justify-content: space-between; font-size: 10px; color: #52525B; }

/* Chips */
.mdm-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
.mdm-chip-row--wrap { flex-wrap: wrap; }
.mdm-chip {
  padding: 6px 14px; border-radius: 20px; background: #0d0d10;
  border: 1px solid #2E2E33; color: #A1A1AA; font-size: 12px;
  font-weight: 600; cursor: pointer; transition: all 200ms; white-space: nowrap;
}
.mdm-chip:hover { border-color: rgba(0, 212, 170, 0.4); color: #FAFAFA; }
.mdm-chip--active { border-color: #00D4AA; color: #00D4AA; background: rgba(0, 212, 170, 0.08); }
.mdm-chip--tag { border-color: #3F3F46; cursor: default; }
.mdm-color-chip {
  width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: all 200ms;
}
.mdm-color-chip--active { border-color: #00D4AA; box-shadow: 0 0 6px rgba(0, 212, 170, 0.4); }

/* Card grids */
.mdm-card-grid { display: grid; gap: 8px; }
.mdm-card-grid--2 { grid-template-columns: repeat(2, 1fr); }
.mdm-card-grid--3 { grid-template-columns: repeat(3, 1fr); }

/* Template cards */
.mdm-tpl-card {
  padding: 14px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; transition: all 200ms; text-align: left;
}
.mdm-tpl-card:hover { border-color: #3F3F46; }
.mdm-tpl-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-tpl-card__name { display: block; font-size: 14px; font-weight: 700; color: #FAFAFA; margin-bottom: 4px; }
.mdm-tpl-card__desc { font-size: 11px; color: #71717A; }

/* Style cards */
.mdm-style-card {
  padding: 8px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; transition: all 200ms; text-align: center;
}
.mdm-style-card:hover { border-color: #3F3F46; }
.mdm-style-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-style-card__preview {
  height: 56px; border-radius: 6px; margin-bottom: 6px; position: relative;
  display: flex; align-items: flex-end; padding: 4px;
}
.mdm-style-card__tags { display: flex; gap: 3px; }
.mdm-style-card__tag {
  font-size: 9px; background: rgba(0, 0, 0, 0.5); color: rgba(255, 255, 255, 0.8);
  padding: 1px 5px; border-radius: 3px;
}
.mdm-style-card__name { font-size: 11px; color: #A1A1AA; }

/* Character cards */
.mdm-char-list { display: flex; flex-direction: column; gap: 10px; }
.mdm-char-card {
  padding: 14px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; display: flex; flex-direction: column; gap: 8px;
}
.mdm-char-card__header { display: flex; align-items: center; gap: 10px; }
.mdm-char-card__avatar {
  width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #00D4AA, #8B5CF6);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #09090B; flex-shrink: 0;
}
.mdm-char-card__name { font-size: 14px; font-weight: 700; color: #FAFAFA; }
.mdm-char-card__archetype { font-size: 11px; color: #71717A; }
.mdm-char-card__field { display: flex; flex-direction: column; gap: 4px; }

/* Upload zones */
.mdm-upload-zone {
  padding: 20px; border: 2px dashed #2E2E33; border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; color: #52525B; font-size: 13px; cursor: pointer; transition: all 200ms;
}
.mdm-upload-zone:hover { border-color: #00D4AA; color: #A1A1AA; }
.mdm-upload-zone--sm { padding: 12px; font-size: 11px; }
.mdm-upload-zone--xs { padding: 8px; font-size: 10px; border-width: 1px; }
.mdm-upload-zone--lg { padding: 32px; }
.mdm-upload-zone__hint { font-size: 11px; color: #3F3F46; }
.mdm-upload-zone__btn {
  padding: 4px 12px; border-radius: 6px; background: rgba(0, 212, 170, 0.1);
  border: 1px solid #00D4AA; color: #00D4AA; font-size: 12px; cursor: pointer;
}
.mdm-upload-zone__count { font-size: 11px; color: #00D4AA; }
.mdm-upload-row { display: flex; gap: 8px; }
.mdm-upload-row > * { flex: 1; }

/* AI button */
.mdm-ai-btn {
  padding: 8px 16px; border-radius: 8px;
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(0, 212, 170, 0.3); color: #00D4AA;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 200ms;
}
.mdm-ai-btn:hover { background: linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(139, 92, 246, 0.25)); }
.mdm-ai-btn--sm { padding: 5px 12px; font-size: 11px; }

/* Add button */
.mdm-add-btn {
  padding: 8px; border-radius: 8px; border: 1px dashed #2E2E33;
  background: transparent; color: #52525B; font-size: 12px; cursor: pointer;
  transition: all 200ms;
}
.mdm-add-btn:hover { border-color: #00D4AA; color: #00D4AA; }

/* Icon button */
.mdm-icon-btn {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: rgba(239, 68, 68, 0.1); color: #EF4444; font-size: 16px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}

/* Tabs */
.mdm-tabs { display: flex; gap: 0; border-bottom: 1px solid #2E2E33; }
.mdm-tab {
  padding: 8px 16px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: #71717A; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms;
}
.mdm-tab--active { color: #00D4AA; border-bottom-color: #00D4AA; }
.mdm-tab-content { padding-top: 10px; display: flex; flex-direction: column; gap: 10px; }

/* Chapter cards */
.mdm-chapter-card {
  padding: 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px;
}
.mdm-chapter-card__header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mdm-chapter-card__actions { display: flex; gap: 4px; }
.mdm-chapter-card__body { display: flex; flex-direction: column; gap: 4px; }

/* Scene cards */
.mdm-scene-card {
  padding: 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; display: flex; flex-direction: column; gap: 6px;
}
.mdm-scene-card__header { display: flex; align-items: center; gap: 8px; }
.mdm-scene-card__time { font-size: 11px; color: #71717A; white-space: nowrap; }

/* Mood badges */
.mdm-mood-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 600;
}
.mdm-mood-badge-sm { font-size: 11px; font-weight: 600; }

/* Collapsible */
.mdm-collapsible {
  border: 1px solid #2E2E33; border-radius: 10px; overflow: hidden;
}
.mdm-collapsible summary {
  padding: 10px 14px; background: #0d0d10; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #A1A1AA; list-style: none;
}
.mdm-collapsible summary::-webkit-details-marker { display: none; }
.mdm-collapsible__body { padding: 10px 14px; border-top: 1px solid #1E1E22; }

/* Preview items */
.mdm-preview-item { padding: 6px 0; font-size: 13px; color: #A1A1AA; border-bottom: 1px solid #1E1E22; }
.mdm-preview-item:last-child { border-bottom: none; }
.mdm-preview-sections { display: flex; flex-direction: column; gap: 8px; }

/* Export cards */
.mdm-export-card {
  padding: 16px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; text-align: center; transition: all 200ms;
}
.mdm-export-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-export-card__icon { font-size: 28px; display: block; margin-bottom: 6px; }
.mdm-export-card__name { font-size: 13px; font-weight: 700; color: #FAFAFA; }

/* CTA box */
.mdm-cta-box {
  padding: 16px; background: rgba(0, 212, 170, 0.05); border: 1px solid rgba(0, 212, 170, 0.2);
  border-radius: 10px; display: flex; flex-direction: column; gap: 10px; align-items: center;
}
.mdm-cta-box__text { font-size: 13px; color: #A1A1AA; text-align: center; }

/* Track panel (animation) */
.mdm-track-panel { display: flex; flex-direction: column; gap: 10px; }
.mdm-track-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: #0d0d10; border: 1px solid #2E2E33; border-radius: 10px;
}
.mdm-track-row__info { display: flex; flex-direction: column; min-width: 80px; }
.mdm-track-row__name { font-size: 13px; font-weight: 700; color: #FAFAFA; }
.mdm-track-row__mood { font-size: 11px; color: #71717A; }
.mdm-track-row__controls { display: flex; align-items: center; gap: 8px; flex: 1; }
.mdm-track-row__vol { font-size: 11px; color: #71717A; min-width: 32px; text-align: right; }

/* Mood timeline */
.mdm-mood-timeline { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; position: relative; }
.mdm-mood-timeline::before {
  content: ''; position: absolute; top: 50%; left: 10%; right: 10%;
  height: 2px; background: linear-gradient(90deg, #3B82F6, #EF4444, #10B981); border-radius: 1px;
}
.mdm-mood-point { display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 1; }
.mdm-mood-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #111113; }
.mdm-mood-label { font-size: 10px; color: #71717A; }

/* Shot grid 6 */
.mdm-shot-grid-6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mdm-shot-preview {
  height: 64px; border-radius: 8px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px; position: relative;
}
.mdm-shot-preview__label { font-size: 11px; color: rgba(255, 255, 255, 0.8); font-weight: 600; }
.mdm-shot-badge {
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
}
.mdm-shot-badge--pending { background: #2E2E33; color: #71717A; }
.mdm-shot-badge--processing { background: rgba(251, 191, 36, 0.2); color: #FBBF24; }
.mdm-shot-badge--done { background: rgba(16, 185, 129, 0.2); color: #10B981; }

/* Generate button */
.mdm-gen-btn {
  width: 100%; padding: 12px; border-radius: 10px;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B;
  font-size: 14px; font-weight: 700; border: none; cursor: pointer;
  transition: all 200ms; display: flex; align-items: center; justify-content: center; gap: 8px;
}
.mdm-gen-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 212, 170, 0.25); }
.mdm-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mdm-gen-btn--sm { padding: 10px; font-size: 13px; }
.mdm-spinner {
  width: 18px; height: 18px; border: 2px solid rgba(0, 212, 170, 0.3);
  border-top-color: #00D4AA; border-radius: 50%; animation: mdm-spin 0.8s linear infinite;
}
@keyframes mdm-spin { to { transform: rotate(360deg); } }

/* Gen progress */
.mdm-gen-progress {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px; background: #0d0d10; border-radius: 10px; border: 1px solid #1E1E22;
}
.mdm-gen-progress__item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; position: relative; }
.mdm-gen-progress__item::after {
  content: ''; position: absolute; top: 9px; left: 50%; width: 100%;
  height: 2px; background: #1E1E22;
}
.mdm-gen-progress__item:last-child::after { display: none; }
.mdm-gen-progress__item--done::after { background: #00D4AA; }
.mdm-gen-progress__item--active::after { background: linear-gradient(90deg, #00D4AA 50%, #1E1E22 50%); }
.mdm-gen-progress__dot {
  width: 20px; height: 20px; border-radius: 50%; background: #1E1E22;
  border: 2px solid #2E2E33; display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: #52525B; z-index: 1;
}
.mdm-gen-progress__item--done .mdm-gen-progress__dot { background: #00D4AA; border-color: #00D4AA; color: #09090B; }
.mdm-gen-progress__item--active .mdm-gen-progress__dot {
  border-color: #00D4AA; color: #00D4AA;
  animation: mdm-pulse 1s ease-in-out infinite;
}
@keyframes mdm-pulse { 0%, 100% { box-shadow: 0 0 4px rgba(0, 212, 170, 0.2); } 50% { box-shadow: 0 0 12px rgba(0, 212, 170, 0.5); } }
.mdm-gen-progress__label { font-size: 10px; color: #52525B; font-weight: 600; white-space: nowrap; }
.mdm-gen-progress__item--done .mdm-gen-progress__label { color: #00D4AA; }
.mdm-gen-progress__item--active .mdm-gen-progress__label { color: #FAFAFA; }

/* Result box */
.mdm-result-box { display: flex; flex-direction: column; gap: 10px; }
.mdm-result-box__banner {
  padding: 12px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px; text-align: center; font-size: 14px; font-weight: 700; color: #10B981;
}
.mdm-action-btn {
  width: 100%; padding: 11px; border-radius: 8px;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B;
  font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms;
}
.mdm-action-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0, 212, 170, 0.25); }
.mdm-action-btn--sm { padding: 8px; font-size: 12px; }
.mdm-action-btn--outline {
  background: transparent; border: 1px solid #00D4AA; color: #00D4AA;
}

/* Timeline bar */
.mdm-timeline-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
.mdm-timeline-segment { display: flex; align-items: center; justify-content: center; }
.mdm-timeline-segment__label { font-size: 10px; color: rgba(255, 255, 255, 0.8); font-weight: 600; }

/* CRAFT cards */
.mdm-craft-card {
  padding: 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; display: flex; flex-direction: column; gap: 6px;
}
.mdm-craft-card__header { display: flex; align-items: center; justify-content: space-between; }
.mdm-craft-card__title { font-size: 13px; font-weight: 700; color: #FAFAFA; }
.mdm-craft-card__duration { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #71717A; }
.mdm-craft-grid { display: flex; flex-direction: column; gap: 4px; }
.mdm-craft-preview {
  padding: 10px 14px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 8px; font-size: 12px; color: #A1A1AA;
}
.mdm-craft-preview code { color: #00D4AA; font-family: inherit; }

/* Gen cards */
.mdm-gen-card {
  padding: 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; display: flex; flex-direction: column; gap: 8px;
}
.mdm-gen-card__header { display: flex; align-items: center; justify-content: space-between; }
.mdm-gen-card__preview {
  padding: 20px; background: #1E1E22; border-radius: 8px;
  text-align: center; color: #71717A; font-size: 13px;
}

/* Progress bar */
.mdm-progress-bar { height: 6px; background: #1E1E22; border-radius: 3px; overflow: hidden; }
.mdm-progress-bar--sm { height: 4px; }
.mdm-progress-bar__fill {
  height: 100%; background: linear-gradient(90deg, #00D4AA, #8B5CF6);
  border-radius: 3px; transition: width 100ms linear;
}

/* Preview screen (promo) */
.mdm-preview-screen {
  border-radius: 10px; overflow: hidden; border: 1px solid #2E2E33;
  aspect-ratio: 16 / 9; background: #000;
}
.mdm-preview-screen__inner {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  background: linear-gradient(135deg, #1a1a2e, #0f3460, #533483);
}
.mdm-preview-screen__play {
  width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 255, 255, 0.2);
  display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff;
}
.mdm-preview-screen__title { font-size: 15px; font-weight: 700; color: #FAFAFA; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); }

/* Check row */
.mdm-check-row { display: flex; gap: 16px; flex-wrap: wrap; }
.mdm-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #A1A1AA; cursor: pointer; }
.mdm-check input { accent-color: #00D4AA; }

/* Waveform */
.mdm-waveform-mix { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.mdm-waveform-track { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #0d0d10; border-radius: 8px; }
.mdm-waveform-track__label { font-size: 10px; color: #71717A; font-weight: 700; min-width: 28px; }
.mdm-waveform-bars { display: flex; align-items: center; gap: 2px; flex: 1; height: 24px; }
.mdm-waveform-bar { width: 3px; border-radius: 1px; background: #00D4AA; }
.mdm-waveform-bar--vo { background: #A78BFA; }
.mdm-waveform-mini { display: flex; align-items: center; gap: 2px; height: 20px; }
.mdm-waveform-mini--sm { height: 16px; }

/* Platform grid */
.mdm-platform-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.mdm-platform-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 14px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; transition: all 200ms; min-width: 72px;
}
.mdm-platform-card:hover { border-color: #3F3F46; }
.mdm-platform-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-platform-card__ratio { background: #2E2E33; border-radius: 4px; }
.mdm-platform-card__name { font-size: 12px; font-weight: 700; color: #FAFAFA; }
.mdm-platform-card__dim { font-size: 10px; color: #71717A; }

/* Category cards */
.mdm-cat-card {
  padding: 12px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; transition: all 200ms; text-align: center;
}
.mdm-cat-card:hover { border-color: #3F3F46; }
.mdm-cat-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-cat-card__emoji { font-size: 24px; display: block; margin-bottom: 4px; }
.mdm-cat-card__name { font-size: 13px; font-weight: 700; color: #FAFAFA; display: block; }
.mdm-cat-card__music { font-size: 10px; color: #71717A; }

/* Uploaded grid */
.mdm-uploaded-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.mdm-uploaded-thumb {
  width: 60px; height: 60px; border-radius: 8px; background: #2E2E33;
  display: flex; align-items: center; justify-content: center; color: #71717A; font-size: 14px;
}
.mdm-uploaded-add {
  width: 60px; height: 60px; border-radius: 8px; border: 2px dashed #2E2E33;
  background: transparent; color: #52525B; font-size: 20px; cursor: pointer;
}

/* Music track card */
.mdm-music-track-card {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px;
}
.mdm-music-track-card__name { font-size: 12px; color: #A1A1AA; white-space: nowrap; }

/* Subtitle preview */
.mdm-subtitle-preview { border-radius: 8px; overflow: hidden; }
.mdm-subtitle-preview__frame {
  height: 120px; background: linear-gradient(135deg, #1a1a2e, #2d2d4e);
  display: flex; align-items: flex-end; justify-content: center; position: relative;
}
.mdm-subtitle-preview__text {
  position: absolute; font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* Version cards */
.mdm-version-card {
  padding: 10px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; text-align: center;
}
.mdm-version-card__label { font-size: 13px; font-weight: 700; color: #FAFAFA; display: block; margin-bottom: 6px; }
.mdm-version-card__preview { height: 80px; background: #1E1E22; border-radius: 6px; }

/* Candidate grid */
.mdm-candidate-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.mdm-candidate-card {
  height: 80px; border-radius: 10px; display: flex; align-items: center;
  justify-content: center; position: relative; overflow: hidden;
}
.mdm-candidate-card__overlay { font-size: 14px; font-weight: 700; color: rgba(255, 255, 255, 0.9); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); }
.mdm-candidate-card__num { position: absolute; top: 6px; right: 8px; font-size: 10px; color: rgba(255, 255, 255, 0.5); }
.mdm-refresh-btn {
  padding: 8px; border-radius: 8px; background: transparent; border: 1px solid #2E2E33;
  color: #A1A1AA; font-size: 12px; cursor: pointer; text-align: center;
}

/* Layout split (ad-image step 3) */
.mdm-layout-split { display: flex; gap: 16px; }
.mdm-layout-split__preview { flex: 1; min-width: 0; }
.mdm-layout-split__controls { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.mdm-canvas-preview {
  aspect-ratio: 1; border-radius: 10px; position: relative; overflow: hidden;
}
.mdm-canvas-text {
  position: absolute; font-size: 16px; font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); max-width: 80%;
}
.mdm-canvas-text small { font-size: 11px; font-weight: 400; opacity: 0.8; }

/* Position grid */
.mdm-position-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.mdm-position-cell {
  height: 24px; border-radius: 4px; background: #1E1E22; border: 1px solid #2E2E33;
  cursor: pointer; transition: all 200ms;
}
.mdm-position-cell--active { background: #00D4AA; border-color: #00D4AA; }

/* Size list */
.mdm-size-list { display: flex; flex-direction: column; gap: 6px; }
.mdm-size-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px;
  font-size: 12px; cursor: pointer;
}
.mdm-size-row input[type="checkbox"] { accent-color: #00D4AA; }
.mdm-size-row__ratio { font-weight: 700; color: #FAFAFA; min-width: 48px; }
.mdm-size-row__dim { color: #71717A; min-width: 100px; }
.mdm-size-row__platform { color: #52525B; }

/* Size result grid */
.mdm-size-result-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.mdm-size-result-card {
  min-width: 80px; height: 80px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.mdm-size-result-card__label { font-size: 10px; color: rgba(255, 255, 255, 0.8); font-weight: 600; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); }

/* Brand kit */
.mdm-brand-kit { display: flex; gap: 6px; }

/* Mode toggle (music) */
.mdm-mode-toggle { display: flex; gap: 0; margin-bottom: 10px; border-radius: 8px; overflow: hidden; border: 1px solid #2E2E33; }
.mdm-mode-btn {
  flex: 1; padding: 10px; background: #0d0d10; border: none;
  color: #71717A; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 200ms;
}
.mdm-mode-btn--active { background: rgba(0, 212, 170, 0.1); color: #00D4AA; }

/* Method cards */
.mdm-method-card {
  padding: 16px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 10px; cursor: pointer; text-align: center; transition: all 200ms;
}
.mdm-method-card:hover { border-color: #3F3F46; }
.mdm-method-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.06); }
.mdm-method-card__icon { font-size: 24px; display: block; margin-bottom: 6px; }
.mdm-method-card__name { font-size: 13px; font-weight: 700; color: #FAFAFA; }

/* Genre grid */
.mdm-genre-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.mdm-genre-chip {
  padding: 6px 12px; border-radius: 8px; background: #0d0d10;
  border: 1px solid #2E2E33; color: #A1A1AA; font-size: 12px;
  font-weight: 600; cursor: pointer; transition: all 200ms;
}
.mdm-genre-chip:hover { border-color: #3F3F46; }
.mdm-genre-chip--active { border-color: #FBBF24; color: #FBBF24; background: rgba(251, 191, 36, 0.08); }

/* Music candidates */
.mdm-candidate-list { display: flex; flex-direction: column; gap: 6px; }
.mdm-music-candidate {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px;
  cursor: pointer; transition: all 200ms;
}
.mdm-music-candidate:hover { border-color: #3F3F46; }
.mdm-music-candidate--active { border-color: #FBBF24; background: rgba(251, 191, 36, 0.06); }
.mdm-music-candidate__label { font-size: 12px; color: #A1A1AA; white-space: nowrap; }
.mdm-play-btn-sm {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B;
  font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* BGM grid */
.mdm-bgm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.mdm-bgm-btn {
  padding: 6px; border-radius: 6px; background: #0d0d10; border: 1px solid #2E2E33;
  color: #71717A; font-size: 10px; cursor: pointer; transition: all 200ms;
}
.mdm-bgm-btn--active { border-color: #FBBF24; color: #FBBF24; }

/* Variation list */
.mdm-variation-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 8px; }
.mdm-variation-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px;
  font-size: 12px; color: #A1A1AA;
}

/* Music Mode B */
.mdm-shot-list-b { display: flex; flex-direction: column; gap: 6px; }
.mdm-shot-item-b {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px;
}
.mdm-shot-item-b__label { font-size: 13px; font-weight: 600; color: #FAFAFA; }

/* Timeline view */
.mdm-timeline-view { display: flex; flex-direction: column; gap: 6px; }
.mdm-timeline-row { display: flex; align-items: center; gap: 8px; }
.mdm-timeline-row__label { font-size: 10px; color: #71717A; font-weight: 700; min-width: 36px; }
.mdm-timeline-segments { display: flex; gap: 2px; flex: 1; }
.mdm-timeline-seg {
  padding: 8px 4px; border-radius: 4px; text-align: center;
  font-size: 10px; color: rgba(255, 255, 255, 0.7); font-weight: 600;
}
.mdm-timeline-seg--music { background: rgba(251, 191, 36, 0.15); }

/* Shot mixer */
.mdm-shot-mixer-card {
  padding: 10px 14px; background: #0d0d10; border: 1px solid #2E2E33;
  border-radius: 8px; display: flex; align-items: center; gap: 12px;
}
.mdm-shot-mixer-card__label { font-size: 12px; font-weight: 600; color: #FAFAFA; min-width: 50px; }
.mdm-shot-mixer-card__controls { display: flex; align-items: center; gap: 8px; flex: 1; flex-wrap: wrap; }

/* Full timeline */
.mdm-full-timeline { position: relative; padding: 10px 0; }
.mdm-full-timeline__playhead {
  position: absolute; top: 0; bottom: 0; left: 30%; width: 2px;
  background: #EF4444; z-index: 2;
}
.mdm-full-timeline__playhead::before {
  content: ''; position: absolute; top: -4px; left: -4px;
  width: 10px; height: 10px; border-radius: 50%; background: #EF4444;
}
.mdm-full-timeline__tracks { display: flex; flex-direction: column; gap: 4px; }
.mdm-full-timeline__track {
  padding: 10px; border-radius: 4px; font-size: 11px; color: rgba(255, 255, 255, 0.7);
  font-weight: 600; text-align: center;
}

/* Global controls */
.mdm-global-controls { display: flex; flex-direction: column; gap: 8px; }
.mdm-global-control {
  display: flex; align-items: center; gap: 10px; font-size: 12px; color: #A1A1AA;
}
.mdm-global-control span:first-child { min-width: 36px; font-weight: 600; }
.mdm-global-control span:last-child { min-width: 36px; text-align: right; color: #71717A; }

/* Segment item */
.mdm-segment-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #0d0d10; border: 1px solid #2E2E33; border-radius: 6px;
  font-size: 12px; color: #A1A1AA;
}
.mdm-segment-item__mood { font-size: 11px; color: #71717A; }

/* ── Transition ── */
.mdm-fade-enter-active { transition: opacity 250ms ease; }
.mdm-fade-enter-active .mdm-card { transition: opacity 250ms ease, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.mdm-fade-leave-active { transition: opacity 200ms ease; }
.mdm-fade-leave-active .mdm-card { transition: opacity 200ms ease, transform 200ms ease; }
.mdm-fade-enter-from { opacity: 0; }
.mdm-fade-enter-from .mdm-card { opacity: 0; transform: scale(0.92) translateY(12px); }
.mdm-fade-leave-to { opacity: 0; }
.mdm-fade-leave-to .mdm-card { opacity: 0; transform: scale(0.96) translateY(4px); }

/* ── Responsive ── */
@media (max-width: 768px) {
  .mdm-card { max-width: 100%; }
  .mdm-header { padding: 14px 16px; }
  .mdm-body { padding: 14px 16px; }
  .mdm-step-nav { padding: 10px 16px; overflow-x: auto; }
  .mdm-card-grid--3 { grid-template-columns: repeat(2, 1fr); }
  .mdm-shot-grid-6 { grid-template-columns: repeat(2, 1fr); }
  .mdm-platform-grid { overflow-x: auto; }
  .mdm-layout-split { flex-direction: column; }
  .mdm-candidate-grid { grid-template-columns: 1fr; }
  .mdm-bgm-grid { grid-template-columns: repeat(2, 1fr); }
  .mdm-gen-progress { flex-wrap: wrap; gap: 8px; }
}
</style>