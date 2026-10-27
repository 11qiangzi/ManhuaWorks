<script setup lang="ts">
/**
 * HomeView.vue - 千机工坊官网首页 v3
 *
 * 区块结构：
 * 1. 顶部导航
 * 2. Hero 轮播（4张幻灯片自动轮播 + 交互Demo）
 * 3. 数据背书（创作者/作品/生成次数）
 * 4. 六大创作模块（带悬停预览）
 * 5. 产品演示（3步流程可视化）
 * 6. 用户评价
 * 7. 定价预览
 * 8. CTA + Footer
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LoginModal from '@/components/LoginModal.vue'
import ModuleDemoModal from '@/components/ModuleDemoModal.vue'

const showLogin = ref(false)
const showModuleDemo = ref(false)
const activeModuleId = ref('')
const activeTestimonial = ref(0)

function openModuleDemo(moduleId: string) {
  activeModuleId.value = moduleId
  showModuleDemo.value = true
}

// ── 粒子背景 ──
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId = 0
const particles: { x: number; y: number; vx: number; vy: number; r: number; opacity: number }[] = []

function initParticles() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  particles.length = 0
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    })
  }
  function draw() {
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 212, 170, ${p.opacity})`
      ctx.fill()
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(0, 212, 170, ${0.08 * (1 - dist / 120)})`
          ctx.stroke()
        }
      }
    }
    animId = requestAnimationFrame(draw)
  }
  draw()
}

// ── Hero Carousel ──
const activeSlide = ref(0)
const isPaused = ref(false)
const isInteracting = ref(false)
const slideCount = 6
const slideInterval = 6000
let carouselTimer: ReturnType<typeof setInterval> | null = null
let interactionTimer: ReturnType<typeof setTimeout> | null = null
const progressKey = ref(0) // forces progress bar re-animation

function startCarousel() {
  stopCarousel()
  carouselTimer = setInterval(() => {
    if (!isPaused.value && !isInteracting.value) {
      activeSlide.value = (activeSlide.value + 1) % slideCount
      progressKey.value++
    }
  }, slideInterval)
}

function stopCarousel() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null }
}

function goToSlide(index: number) {
  activeSlide.value = index
  progressKey.value++
}

function prevSlide() {
  activeSlide.value = (activeSlide.value - 1 + slideCount) % slideCount
  progressKey.value++
}

function nextSlide() {
  activeSlide.value = (activeSlide.value + 1) % slideCount
  progressKey.value++
}

function onHeroEnter() {
  isPaused.value = true
}

function onHeroLeave() {
  isPaused.value = false
}

function onDemoInteract() {
  isInteracting.value = true
  if (interactionTimer) clearTimeout(interactionTimer)
  interactionTimer = setTimeout(() => {
    isInteracting.value = false
  }, 5000)
}

// ── Slide 1: 动画生成器 ──
const characterStyles = [
  { name: '赛博朋克', gradient: 'linear-gradient(135deg, #0ff, #f0f, #00f)' },
  { name: '国风水墨', gradient: 'linear-gradient(135deg, #2d2d2d, #8B7355, #d4c5a9)' },
  { name: '像素复古', gradient: 'linear-gradient(135deg, #4a0, #ff0, #f80)' },
  { name: '3D卡通', gradient: 'linear-gradient(135deg, #ff6b9d, #c44dff, #6ec6ff)' },
]
const selectedStyle = ref(0)
const animDescription = ref('深夜的废弃工厂，主角独自探索，突然一道黑影闪过...')
const animGenerating = ref(false)
const animGenerated = ref(false)
const animStep = ref(-1)
const animStepLabels = ['分析文本', '拆解分镜', '生成角色', '合成动画']
const animFrameMoods = ['紧张', '悬疑', '高潮']
const animPlaying = ref(false)
const animPlayProgress = ref(0)
let animTimers: ReturnType<typeof setTimeout>[] = []
let animPlayTimer: ReturnType<typeof setInterval> | null = null

function selectStyle(index: number) {
  selectedStyle.value = index
  onDemoInteract()
}

function startAnimGeneration() {
  animTimers.forEach(clearTimeout)
  animTimers = []
  if (animPlayTimer) { clearInterval(animPlayTimer); animPlayTimer = null }
  animGenerating.value = true
  animGenerated.value = false
  animStep.value = 0
  animPlaying.value = false
  animPlayProgress.value = 0
  onDemoInteract()
  animStepLabels.forEach((_, i) => {
    animTimers.push(setTimeout(() => { animStep.value = i + 1 }, (i + 1) * 500))
  })
  animTimers.push(setTimeout(() => { animGenerating.value = false; animGenerated.value = true }, animStepLabels.length * 500 + 300))
}

function playAnimPreview() {
  if (animPlayTimer) { clearInterval(animPlayTimer); animPlayTimer = null }
  animPlaying.value = true
  animPlayProgress.value = 0
  animPlayTimer = setInterval(() => {
    animPlayProgress.value += 4
    if (animPlayProgress.value >= 100) {
      if (animPlayTimer) { clearInterval(animPlayTimer); animPlayTimer = null }
      animPlaying.value = false
      animPlayProgress.value = 100
    }
  }, 120)
}

// ── Slide 2: 短视频生成器 ──
const videoPlatforms = [
  { name: '抖音', ratio: '9:16' },
  { name: '小红书', ratio: '3:4' },
  { name: 'B站', ratio: '16:9' },
  { name: '快手', ratio: '9:16' },
]
const selectedPlatform = ref(0)
const videoTopic = ref('猫咪的一天')
const videoFilters = [
  { name: '胶片', color: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)' },
  { name: '复古', color: 'linear-gradient(180deg, #f093fb 0%, #f5576c 100%)' },
  { name: '电影', color: 'linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)' },
]
const selectedFilter = ref(0)
const videoGenerating = ref(false)
const videoGenerated = ref(false)
const videoStep = ref(-1)
const videoStepLabels = ['选择素材', 'AI剪辑', '添加字幕', '配乐匹配', '合成输出']
let videoTimers: ReturnType<typeof setTimeout>[] = []

function selectFilter(index: number) {
  selectedFilter.value = index
  onDemoInteract()
}

function startVideoGeneration() {
  videoTimers.forEach(clearTimeout)
  videoTimers = []
  videoGenerating.value = true
  videoGenerated.value = false
  videoStep.value = 0
  onDemoInteract()
  videoStepLabels.forEach((_, i) => {
    videoTimers.push(setTimeout(() => { videoStep.value = i + 1 }, (i + 1) * 450))
  })
  videoTimers.push(setTimeout(() => { videoGenerating.value = false; videoGenerated.value = true }, videoStepLabels.length * 450 + 300))
}

function getPhoneScreenGradient(): string {
  if (!videoGenerated.value) return 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)'
  return videoFilters[selectedFilter.value].color
}

// ── Slide 3: 故事生成器 ──
const storyKeywords = ref(['奇幻', '古剑', '少年'])
const storyTypes = [
  { name: '奇幻冒险', story: '在云层之上的浮空城里，少年铸剑师发现了一把会说话的古剑。剑中封印着千年前灭亡王国的最后记忆……' },
  { name: '都市悬疑', story: '凌晨三点，刑警陈默收到一条来自自己手机号码的短信——"别回头"。他缓缓转身，办公室的灯突然全灭了……' },
  { name: '甜蜜恋爱', story: '她在图书馆的旧书里发现了一封未寄出的情书，收件人的名字，和她一模一样。窗外，有人在等她……' },
]
const selectedStory = ref(0)
const storyGenerating = ref(false)
const storyGenerated = ref(false)
const storyStep = ref(-1)
const storyStepLabels = ['分析关键词', '构建世界观', '生成开篇']
const storyOutputText = ref('')
let storyTimers: ReturnType<typeof setTimeout>[] = []
let storyTypeTimer: ReturnType<typeof setInterval> | null = null

function selectStoryType(index: number) {
  selectedStory.value = index
  storyGenerated.value = false
  storyOutputText.value = ''
  onDemoInteract()
}

function startStoryGeneration() {
  storyTimers.forEach(clearTimeout)
  storyTimers = []
  if (storyTypeTimer) { clearInterval(storyTypeTimer); storyTypeTimer = null }
  storyGenerating.value = true
  storyGenerated.value = false
  storyStep.value = 0
  storyOutputText.value = ''
  onDemoInteract()
  storyStepLabels.forEach((_, i) => {
    storyTimers.push(setTimeout(() => { storyStep.value = i + 1 }, (i + 1) * 600))
  })
  storyTimers.push(setTimeout(() => {
    storyGenerating.value = false
    storyGenerated.value = true
    const fullText = storyTypes[selectedStory.value].story
    let idx = 0
    storyTypeTimer = setInterval(() => {
      if (idx < fullText.length) { storyOutputText.value += fullText[idx]; idx++ }
      else { if (storyTypeTimer) clearInterval(storyTypeTimer) }
    }, 40)
  }, storyStepLabels.length * 600 + 300))
}

// ── Slide 4: 宣传片生成器 ──
const shotTypes = [
  { name: '航拍', icon: '🛰️', duration: '5s' },
  { name: '特写', icon: '🔍', duration: '3s' },
  { name: '慢动作', icon: '🎞️', duration: '8s' },
  { name: '延时', icon: '⏱️', duration: '6s' },
]
const timeline = ref<number[]>([])
const showPreview = ref(false)
const promoScript = ref('科技创新企业，展示产品研发过程和团队实力')
const promoVoiceover = ref(false)
const promoGenerating = ref(false)
const promoGenerated = ref(false)
const promoStep = ref(-1)
const promoStepLabels = ['生成画面', 'AI配音', '匹配配乐', '合成成片']
let promoTimers: ReturnType<typeof setTimeout>[] = []

function addShotToTimeline(index: number) {
  if (timeline.value.length < 6) { timeline.value.push(index) }
  promoGenerated.value = false
  onDemoInteract()
}

function removeFromTimeline(pos: number) {
  timeline.value.splice(pos, 1)
  promoGenerated.value = false
  onDemoInteract()
}

function getTimelineDuration(): string {
  const total = timeline.value.reduce((s, i) => s + parseInt(shotTypes[i].duration), 0)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function startPromoGeneration() {
  promoTimers.forEach(clearTimeout)
  promoTimers = []
  promoGenerating.value = true
  promoGenerated.value = false
  promoStep.value = 0
  showPreview.value = false
  onDemoInteract()
  promoStepLabels.forEach((_, i) => {
    promoTimers.push(setTimeout(() => { promoStep.value = i + 1 }, (i + 1) * 500))
  })
  promoTimers.push(setTimeout(() => { promoGenerating.value = false; promoGenerated.value = true; showPreview.value = true }, promoStepLabels.length * 500 + 300))
}

// ── Slide 5: 广告图生成器 ──
const adTemplates = [
  { name: '电商主图', ratio: '1:1', gradient: 'linear-gradient(135deg, #ff6b6b, #ee5a24)' },
  { name: '小红书', ratio: '3:4', gradient: 'linear-gradient(135deg, #ff9ff3, #f368e0)' },
  { name: '公众号封面', ratio: '16:9', gradient: 'linear-gradient(135deg, #54a0ff, #2e86de)' },
  { name: '抖音竖版', ratio: '9:16', gradient: 'linear-gradient(135deg, #ff9ff3, #feca57)' },
]
const selectedAdTemplate = ref(0)
const adProductName = ref('保湿面霜')
const adSellingPoints = ref(['天然成分', '深层保湿'])
const adGenerating = ref(false)
const adGenerated = ref(false)
const adStep = ref(-1)
const adStepLabels = ['分析商品', '生成画面', '多尺寸适配']
const adPreviewSizes = [
  { label: '1:1', width: '80px', height: '80px' },
  { label: '3:4', width: '68px', height: '90px' },
  { label: '9:16', width: '54px', height: '96px' },
]
let adTimers: ReturnType<typeof setTimeout>[] = []

function selectAdTemplate(index: number) {
  selectedAdTemplate.value = index
  adGenerated.value = false
  onDemoInteract()
}

function startAdGeneration() {
  adTimers.forEach(clearTimeout)
  adTimers = []
  adGenerating.value = true
  adGenerated.value = false
  adStep.value = 0
  onDemoInteract()
  adStepLabels.forEach((_, i) => {
    adTimers.push(setTimeout(() => { adStep.value = i + 1 }, (i + 1) * 600))
  })
  adTimers.push(setTimeout(() => { adGenerating.value = false; adGenerated.value = true }, adStepLabels.length * 600 + 300))
}

// ── Slide 6: 配乐生成器 ──
const musicMoods = [
  { name: '紧张', color: '#EF4444', bpm: 140 },
  { name: '温馨', color: '#F59E0B', bpm: 90 },
  { name: '热血', color: '#8B5CF6', bpm: 150 },
  { name: '舒缓', color: '#10B981', bpm: 70 },
]
const selectedMood = ref(-1)
const musicDescription = ref('紧张悬疑的探险场景，逐步升级')
const musicDurations = ['15秒', '30秒', '60秒']
const selectedMusicDuration = ref(1)
const musicGenerating = ref(false)
const musicGenerated = ref(false)
const musicStep = ref(-1)
const musicStepLabels = ['分析情绪', '匹配BPM', '选择乐器', '合成音频']
const musicPlaying = ref(false)
const musicPlayProgress = ref(0)
let musicTimers: ReturnType<typeof setTimeout>[] = []
let musicPlayTimer: ReturnType<typeof setInterval> | null = null

function selectMood(index: number) {
  selectedMood.value = index
  musicGenerated.value = false
  onDemoInteract()
}

function selectMusicDuration(index: number) {
  selectedMusicDuration.value = index
  onDemoInteract()
}

function startMusicGeneration() {
  musicTimers.forEach(clearTimeout)
  musicTimers = []
  if (musicPlayTimer) { clearInterval(musicPlayTimer); musicPlayTimer = null }
  musicGenerating.value = true
  musicGenerated.value = false
  musicStep.value = 0
  musicPlaying.value = false
  musicPlayProgress.value = 0
  onDemoInteract()
  musicStepLabels.forEach((_, i) => {
    musicTimers.push(setTimeout(() => { musicStep.value = i + 1 }, (i + 1) * 500))
  })
  musicTimers.push(setTimeout(() => {
    musicGenerating.value = false
    musicGenerated.value = true
    musicPlaying.value = true
    musicPlayProgress.value = 0
    musicPlayTimer = setInterval(() => {
      musicPlayProgress.value += 2
      if (musicPlayProgress.value >= 100) {
        if (musicPlayTimer) { clearInterval(musicPlayTimer); musicPlayTimer = null }
        musicPlaying.value = false
      }
    }, 100)
  }, musicStepLabels.length * 500 + 300))
}

function toggleMusicPlay() {
  if (musicPlaying.value) {
    if (musicPlayTimer) { clearInterval(musicPlayTimer); musicPlayTimer = null }
    musicPlaying.value = false
  } else {
    if (musicPlayProgress.value >= 100) musicPlayProgress.value = 0
    musicPlaying.value = true
    musicPlayTimer = setInterval(() => {
      musicPlayProgress.value += 2
      if (musicPlayProgress.value >= 100) {
        if (musicPlayTimer) { clearInterval(musicPlayTimer); musicPlayTimer = null }
        musicPlaying.value = false
      }
    }, 100)
  }
}

// Reset slide state when leaving
watch(activeSlide, () => {
  showPreview.value = false
})

// ── 定价 ──
const plans = [
  { name: '免费版', price: '¥0', period: '/月', quota: '9次/月', features: ['基础AI模型', '720p导出', '社区支持'], highlight: false },
  { name: '基础版', price: '¥39', period: '/月', quota: '50次/月', features: ['高级AI模型', '1080p导出', '优先客服', '角色库50个'], highlight: false },
  { name: '专业版', price: '¥149', period: '/月', quota: '280次/月', features: ['顶级AI模型', '4K导出', '专属客服', '无限角色', '团队协作5人', 'API接入'], highlight: true },
  { name: '企业版', price: '定制', period: '', quota: '无限制', features: ['定制AI训练', '8K导出', '7×24支持', '白标定制', '无限团队'], highlight: false },
]

// ── 数据背书 ──
const stats = [
  { value: '12,847', label: '创作者', icon: '👤' },
  { value: '58,392', label: '作品生成', icon: '🎬' },
  { value: '1.2M', label: 'AI调用次数', icon: '⚡' },
  { value: '6', label: '创作模块', icon: '🧩' },
]

// ── 六大模块 ──
const modules = [
  { key: 'animation', icon: '🎬', title: '动画生成器', desc: '粘贴小说文本，AI自动拆解分镜、生成连贯动画序列', color: '#7DD3FC', preview: '小说 → 分镜脚本 → 角色动画 → 连贯视频' },
  { key: 'story', icon: '📖', title: '故事生成器', desc: 'AI智能拆解章节与人物关系，结构化输出可直接转入动画', color: '#F472B6', preview: '大纲 → 章节拆解 → 人物提取 → 结构化输出' },
  { key: 'promo', icon: '🎥', title: '宣传片生成器', desc: '品牌宣传视频一键生成，专业级画面节奏与配乐', color: '#A78BFA', preview: '品牌Brief → 脚本 → 分镜 → 配音配乐 → 成片' },
  { key: 'ad-short', icon: '📹', title: '短视频生成器', desc: '竖屏短视频，平台适配自动裁切，品类配乐匹配', color: '#34D399', preview: '选平台 → 上传素材 → AI剪辑 → 品类配乐 → 导出' },
  { key: 'ad-image', icon: '🖼️', title: '广告图生成器', desc: '电商广告图多尺寸一键生成，AI文案+画面', color: '#FB923C', preview: '选模板 → 上传商品图 → AI生成 → 多尺寸导出' },
  { key: 'music', icon: '🎵', title: '配乐生成器', desc: 'AI配乐情绪匹配，自动同步画面节奏', color: '#FBBF24', preview: '文字描述 → 情绪匹配 → AI生成 → 多风格变奏' },
]

// ── 三步流程 ──
const steps = [
  { num: '01', title: '粘贴你的故事', desc: '输入小说文本或故事大纲', icon: '📝' },
  { num: '02', title: 'AI生成画面', desc: '自动拆解分镜，匹配画风', icon: '🎨' },
  { num: '03', title: '配乐导出成片', desc: 'AI配乐，一键导出高清视频', icon: '🎬' },
]

// ── 用户评价 ──
const testimonials = [
  { name: '小鱼', role: '独立创作者', avatar: '🐟', text: '以前做一部漫改动画要花两周，现在粘贴小说文本，半小时就能出第一版。配乐也是AI自动匹配的，省了太多时间。', rating: 5 },
  { name: '张运营', role: '电商运营', avatar: '📊', text: '我们团队每天要出几十条短视频素材，千机工坊的批量生成+品类配乐功能直接帮我们提效3倍。', rating: 5 },
  { name: 'Emily', role: '内容创业者', avatar: '✨', text: '从故事到成片一站式完成，最惊喜的是AI配乐，情绪匹配非常准，比我手动找BGM好多了。', rating: 4 },
]

let testimonialTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  initParticles()
  startCarousel()
  testimonialTimer = setInterval(() => {
    activeTestimonial.value = (activeTestimonial.value + 1) % testimonials.length
  }, 5000)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  stopCarousel()
  if (testimonialTimer) clearInterval(testimonialTimer)
  if (storyTypeTimer) clearInterval(storyTypeTimer)
  if (interactionTimer) clearTimeout(interactionTimer)
  if (animPlayTimer) clearInterval(animPlayTimer)
  if (musicPlayTimer) clearInterval(musicPlayTimer)
  animTimers.forEach(clearTimeout)
  videoTimers.forEach(clearTimeout)
  storyTimers.forEach(clearTimeout)
  promoTimers.forEach(clearTimeout)
  adTimers.forEach(clearTimeout)
  musicTimers.forEach(clearTimeout)
})
</script>

<template>
  <div class="home">
    <!-- ===== 1. Nav ===== -->
    <header class="nav">
      <RouterLink to="/" class="nav__brand">
        <span class="nav__logo">千</span>
        <span class="nav__name">千机工坊</span>
      </RouterLink>
      <nav class="nav__links">
        <RouterLink to="/showcase" class="nav__link">作品展示</RouterLink>
        <RouterLink to="/pricing" class="nav__link">定价</RouterLink>
        <button class="nav__login" @click="showLogin = true">登录</button>
      </nav>
    </header>

    <!-- ===== 2. Hero Carousel ===== -->
    <section class="hero" @mouseenter="onHeroEnter" @mouseleave="onHeroLeave">
      <canvas ref="canvasRef" class="hero__canvas"></canvas>
      <div class="hero__glow"></div>

      <!-- Left Arrow -->
      <button class="hero__arrow hero__arrow--left" @click="prevSlide">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <!-- Right Arrow -->
      <button class="hero__arrow hero__arrow--right" @click="nextSlide">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>

      <!-- Slides Container -->
      <div class="hero__slides">
        <!-- SLIDE 1: 动画生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 0 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">还在花大钱请动画师？</p>
              <h1 class="hero__title">一句话，生成你的<span class="hero__gradient">专属动画角色</span></h1>
              <p class="hero__desc">选择风格，点击生成。赛博朋克、国风水墨、像素复古……12种艺术风格，3秒出片。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">免费创建动画 →</button>
              </div>
              <p class="hero__proof">✦ 上周 3,280 个动画角色被创建</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--character">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">动画生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">场景描述</p>
                  <textarea class="demo-textarea" v-model="animDescription" rows="2" placeholder="描述你的动画场景..."></textarea>
                  <p class="demo__label">选择艺术风格</p>
                  <div class="demo-pill-row">
                    <button
                      v-for="(s, i) in characterStyles"
                      :key="s.name"
                      class="demo-pill"
                      :class="{ 'demo-pill--active': selectedStyle === i }"
                      @click="selectStyle(i)"
                    >
                      <span class="demo-pill__dot" :style="{ background: s.gradient }"></span>
                      {{ s.name }}
                    </button>
                  </div>
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': animGenerating }"
                    :disabled="animGenerating"
                    @click="startAnimGeneration"
                  >
                    <span v-if="animGenerating" class="demo-btn-spinner"></span>
                    <span v-else>🎬 生成动画</span>
                  </button>
                  <div v-if="animGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in animStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': animStep > i, 'step-progress__item--active': animStep === i }">
                        <div class="step-progress__dot">{{ animStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="animGenerated" class="anim-result">
                    <div class="anim-frames">
                      <div v-for="(mood, i) in animFrameMoods" :key="i" class="anim-frame" :style="{ background: characterStyles[selectedStyle].gradient }">
                        <span class="anim-frame__num">F{{ i + 1 }}</span>
                        <span class="anim-frame__mood">{{ mood }}</span>
                      </div>
                    </div>
                    <button class="demo-play-btn" @click="playAnimPreview">
                      {{ animPlaying ? '⏸ 播放中...' : '▶ 播放预览' }}
                    </button>
                    <div v-if="animPlaying || animPlayProgress > 0" class="mini-player">
                      <div class="mini-player__track">
                        <div class="mini-player__fill" :style="{ width: animPlayProgress + '%' }"></div>
                      </div>
                      <span class="mini-player__time">{{ Math.floor(animPlayProgress * 0.15) }}s / 15s</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">下载动画 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 2: 短视频生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 1 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">想法很多，不会剪辑？</p>
              <h1 class="hero__title">给我一个创意，还你一条<span class="hero__gradient">爆款短视频</span></h1>
              <p class="hero__desc">AI自动编排镜头、配乐、字幕。从灵感到成片，不超过60秒。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">开始制作短视频 →</button>
              </div>
              <p class="hero__proof">✦ 平台创作者已发布 50万+ 条短视频</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--video">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">短视频生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">发布平台</p>
                  <div class="demo-pill-row">
                    <button
                      v-for="(p, i) in videoPlatforms"
                      :key="p.name"
                      class="demo-pill"
                      :class="{ 'demo-pill--active': selectedPlatform === i }"
                      @click="selectedPlatform = i; onDemoInteract()"
                    >{{ p.name }} {{ p.ratio }}</button>
                  </div>
                  <p class="demo__label">视频主题</p>
                  <input class="demo-input" v-model="videoTopic" placeholder="输入视频主题..." />
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': videoGenerating }"
                    :disabled="videoGenerating"
                    @click="startVideoGeneration"
                  >
                    <span v-if="videoGenerating" class="demo-btn-spinner"></span>
                    <span v-else>📹 一键成片</span>
                  </button>
                  <div v-if="videoGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in videoStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': videoStep > i, 'step-progress__item--active': videoStep === i }">
                        <div class="step-progress__dot">{{ videoStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="videoGenerated" class="video-result">
                    <div class="phone-mockup">
                      <div class="phone-frame">
                        <div class="phone-notch"></div>
                        <div class="phone-screen" :style="{ background: getPhoneScreenGradient() }">
                          <div class="phone-video-preview">
                            <div class="phone-play-btn">▶</div>
                            <p class="phone-video-title">{{ videoTopic }}</p>
                          </div>
                        </div>
                      </div>
                      <div class="phone-filters">
                        <button
                          v-for="(f, i) in videoFilters"
                          :key="f.name"
                          class="filter-btn"
                          :class="{ 'filter-btn--active': selectedFilter === i }"
                          @click="selectFilter(i)"
                        >{{ f.name }}</button>
                      </div>
                    </div>
                    <div class="video-engagement">
                      <span>❤ 2.3K</span>
                      <span>💬 156</span>
                      <span>🔄 89</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">发布短视频 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 3: 故事生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 2 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">写不出好故事？</p>
              <h1 class="hero__title">三个关键词，AI帮你写出<span class="hero__gradient">电影级剧本</span></h1>
              <p class="hero__desc">奇幻冒险、都市悬疑、甜蜜恋爱……选定类型，AI实时生成引人入胜的故事开篇。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">开始创作故事 →</button>
              </div>
              <p class="hero__proof">✦ 已生成 120万+ 个原创故事</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--story">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">故事生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">关键词</p>
                  <div class="keyword-inputs">
                    <input v-for="(kw, i) in storyKeywords" :key="i" class="demo-input demo-input--sm" v-model="storyKeywords[i]" :placeholder="['奇幻', '古剑', '少年'][i]" />
                  </div>
                  <p class="demo__label">故事类型</p>
                  <div class="demo-pill-row">
                    <button
                      v-for="(st, i) in storyTypes"
                      :key="st.name"
                      class="demo-pill"
                      :class="{ 'demo-pill--active': selectedStory === i }"
                      @click="selectStoryType(i)"
                    >{{ st.name }}</button>
                  </div>
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': storyGenerating }"
                    :disabled="storyGenerating"
                    @click="startStoryGeneration"
                  >
                    <span v-if="storyGenerating" class="demo-btn-spinner"></span>
                    <span v-else>📖 生成故事</span>
                  </button>
                  <div v-if="storyGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in storyStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': storyStep > i, 'step-progress__item--active': storyStep === i }">
                        <div class="step-progress__dot">{{ storyStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="storyGenerated" class="story-result">
                    <div class="story-output">
                      <p class="story-output__text">{{ storyOutputText }}<span v-if="storyOutputText.length < storyTypes[selectedStory].story.length" class="story-cursor">|</span></p>
                    </div>
                    <div class="story-stats">
                      <span>字数: {{ storyOutputText.length }}</span>
                      <span>预计阅读: {{ Math.max(1, Math.ceil(storyOutputText.length / 4)) }}秒</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">继续写下去 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 4: 宣传片生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 3 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">品牌宣传，预算不够？</p>
              <h1 class="hero__title">AI导演出马，<span class="hero__gradient">企业宣传片一键开拍</span></h1>
              <p class="hero__desc">选择镜头、排列时间线、自动配音配乐。专业级品牌宣传片，告别天价制作费。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">制作我的宣传片 →</button>
              </div>
              <p class="hero__proof">✦ 2,000+ 企业正在使用</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--promo">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">宣传片生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">宣传脚本</p>
                  <textarea class="demo-textarea" v-model="promoScript" rows="2" placeholder="描述你的宣传片..."></textarea>
                  <p class="demo__label">镜头选择</p>
                  <div class="shot-grid">
                    <button
                      v-for="(shot, i) in shotTypes"
                      :key="shot.name"
                      class="shot-thumb"
                      @click="addShotToTimeline(i)"
                    >
                      <span class="shot-thumb__icon">{{ shot.icon }}</span>
                      <span class="shot-thumb__name">{{ shot.name }}</span>
                      <span class="shot-thumb__dur">{{ shot.duration }}</span>
                    </button>
                  </div>
                  <div class="timeline-area">
                    <p class="demo__label">时间线 <span v-if="timeline.length > 0" class="timeline-count">{{ timeline.length }}/6 · {{ getTimelineDuration() }}</span></p>
                    <div class="timeline-track">
                      <div v-if="timeline.length === 0" class="timeline-empty">点击镜头添加到时间线</div>
                      <div
                        v-for="(shotIdx, pos) in timeline"
                        :key="pos"
                        class="timeline-clip"
                        @click="removeFromTimeline(pos)"
                        :title="'点击移除: ' + shotTypes[shotIdx].name"
                      >
                        <span>{{ shotTypes[shotIdx].icon }}</span>
                        <span class="timeline-clip__name">{{ shotTypes[shotIdx].name }}</span>
                        <span class="timeline-clip__dur">{{ shotTypes[shotIdx].duration }}</span>
                      </div>
                    </div>
                    <div class="promo-toggle-row">
                      <button class="promo-toggle" :class="{ 'promo-toggle--active': promoVoiceover }" @click="promoVoiceover = !promoVoiceover; onDemoInteract()">
                        🎙️ 配音 {{ promoVoiceover ? 'ON' : 'OFF' }}
                      </button>
                    </div>
                  </div>
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': promoGenerating }"
                    :disabled="timeline.length === 0 || promoGenerating"
                    @click="startPromoGeneration"
                  >
                    <span v-if="promoGenerating" class="demo-btn-spinner"></span>
                    <span v-else>🎥 生成宣传片</span>
                  </button>
                  <div v-if="promoGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in promoStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': promoStep > i, 'step-progress__item--active': promoStep === i }">
                        <div class="step-progress__dot">{{ promoStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="promoGenerated" class="promo-result">
                    <div class="cinema-preview">
                      <div class="cinema-letterbox cinema-letterbox--top"></div>
                      <div class="cinema-screen">
                        <div class="cinema-gradient"></div>
                        <div class="cinema-play-btn">▶</div>
                        <p class="cinema-title">品牌宣传片</p>
                      </div>
                      <div class="cinema-letterbox cinema-letterbox--bottom"></div>
                    </div>
                    <div class="promo-stats">
                      <span>时长: {{ getTimelineDuration() }}</span>
                      <span>分辨率: 4K</span>
                      <span v-if="promoVoiceover">配音: AI</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">下载宣传片 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 5: 广告图生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 4 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">电商出图，效率为王</p>
              <h1 class="hero__title">上传商品图，<span class="hero__gradient">AI一键生成多尺寸广告图</span></h1>
              <p class="hero__desc">电商主图、小红书、公众号封面、抖音竖版……选模板，传商品图，AI自动生成多尺寸广告素材。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">免费生成广告图 →</button>
              </div>
              <p class="hero__proof">✦ 日均生成 8,000+ 张广告图</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--ad">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">广告图生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">商品名称</p>
                  <input class="demo-input" v-model="adProductName" placeholder="输入商品名称..." />
                  <p class="demo__label">卖点</p>
                  <div class="selling-points-row">
                    <input v-for="(sp, i) in adSellingPoints" :key="i" class="demo-input demo-input--sm" v-model="adSellingPoints[i]" :placeholder="['卖点 ' + (i+1)]" />
                  </div>
                  <p class="demo__label">广告模板</p>
                  <div class="ad-template-grid">
                    <button
                      v-for="(at, i) in adTemplates"
                      :key="at.name"
                      class="ad-template-card"
                      :class="{ 'ad-template-card--active': selectedAdTemplate === i }"
                      @click="selectAdTemplate(i)"
                    >
                      <div class="ad-template-preview ad-template-preview--tall" :style="{ background: at.gradient }">
                        <span class="ad-template-ratio">{{ at.ratio }}</span>
                      </div>
                      <span class="ad-template-name">{{ at.name }}</span>
                    </button>
                  </div>
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': adGenerating }"
                    :disabled="adGenerating"
                    @click="startAdGeneration"
                  >
                    <span v-if="adGenerating" class="demo-btn-spinner"></span>
                    <span v-else>🖼️ 生成广告图</span>
                  </button>
                  <div v-if="adGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in adStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': adStep > i, 'step-progress__item--active': adStep === i }">
                        <div class="step-progress__dot">{{ adStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="adGenerated" class="ad-result-multi">
                    <div class="ad-size-previews">
                      <div v-for="(sz, i) in adPreviewSizes" :key="sz.label" class="ad-size-preview" :style="{ width: sz.width, height: sz.height, background: adTemplates[i % adTemplates.length].gradient }">
                        <div class="ad-size-overlay">
                          <span class="ad-size-name">{{ adProductName }}</span>
                          <span class="ad-size-label">{{ sz.label }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="ad-export-info">
                      <span>已生成 {{ adPreviewSizes.length }} 个尺寸</span>
                      <span>可导出 PSD/PNG</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">下载全部尺寸 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SLIDE 6: 配乐生成器 -->
        <div class="hero__slide" :class="{ 'hero__slide--active': activeSlide === 5 }">
          <div class="hero__split">
            <div class="hero__left">
              <p class="hero__badge">配乐难？AI来搞定</p>
              <h1 class="hero__title">选个情绪，<span class="hero__gradient">AI自动生成专属配乐</span></h1>
              <p class="hero__desc">紧张、温馨、热血、舒缓……选定情绪，AI自动匹配BPM和乐器，生成独一无二的原创配乐。</p>
              <div class="hero__cta">
                <button class="btn-primary" @click="showLogin = true">免费生成配乐 →</button>
              </div>
              <p class="hero__proof">✦ 已生成 32万+ 首原创配乐</p>
            </div>
            <div class="hero__right">
              <div class="demo demo--music">
                <div class="demo__header">
                  <span class="demo__dot demo__dot--red"></span>
                  <span class="demo__dot demo__dot--yellow"></span>
                  <span class="demo__dot demo__dot--green"></span>
                  <span class="demo__title">配乐生成器</span>
                </div>
                <div class="demo__body">
                  <p class="demo__label">场景描述</p>
                  <textarea class="demo-textarea" v-model="musicDescription" rows="2" placeholder="描述配乐场景..."></textarea>
                  <p class="demo__label">情绪风格</p>
                  <div class="mood-grid">
                    <button
                      v-for="(m, i) in musicMoods"
                      :key="m.name"
                      class="mood-card"
                      :class="{ 'mood-card--active': selectedMood === i }"
                      :style="selectedMood === i ? { borderColor: m.color, background: m.color + '18' } : {}"
                      @click="selectMood(i)"
                    >
                      <span class="mood-card__indicator" :style="{ background: m.color }"></span>
                      <span class="mood-card__name">{{ m.name }}</span>
                      <span class="mood-card__bpm">{{ m.bpm }} BPM</span>
                    </button>
                  </div>
                  <p class="demo__label">时长</p>
                  <div class="demo-pill-row">
                    <button
                      v-for="(d, i) in musicDurations"
                      :key="d"
                      class="demo-pill"
                      :class="{ 'demo-pill--active': selectedMusicDuration === i }"
                      @click="selectMusicDuration(i)"
                    >{{ d }}</button>
                  </div>
                  <button
                    class="demo-generate-btn"
                    :class="{ 'demo-generate-btn--loading': musicGenerating }"
                    :disabled="selectedMood < 0 || musicGenerating"
                    @click="startMusicGeneration"
                  >
                    <span v-if="musicGenerating" class="demo-btn-spinner"></span>
                    <span v-else>🎵 生成配乐</span>
                  </button>
                  <div v-if="musicGenerating" class="step-progress">
                    <div class="step-progress__track">
                      <div v-for="(label, i) in musicStepLabels" :key="label" class="step-progress__item" :class="{ 'step-progress__item--done': musicStep > i, 'step-progress__item--active': musicStep === i }">
                        <div class="step-progress__dot">{{ musicStep > i ? '✓' : i + 1 }}</div>
                        <span class="step-progress__label">{{ label }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="musicGenerated" class="music-result-full">
                    <div class="music-wave-player">
                      <div class="music-wave-bars">
                        <span v-for="n in 16" :key="n" class="music-wave-bar" :style="{ animationDelay: (n * 0.07) + 's', height: (10 + Math.random() * 24) + 'px' }" :class="{ 'music-wave-bar--paused': !musicPlaying }"></span>
                      </div>
                      <button class="music-play-btn" @click="toggleMusicPlay">
                        {{ musicPlaying ? '⏸' : '▶' }}
                      </button>
                    </div>
                    <div class="music-progress-bar">
                      <div class="music-progress-fill" :style="{ width: musicPlayProgress + '%' }"></div>
                    </div>
                    <div class="music-stats">
                      <span>时长: {{ musicDurations[selectedMusicDuration] }}</span>
                      <span>BPM: {{ musicMoods[selectedMood].bpm }}</span>
                      <span>风格: {{ musicMoods[selectedMood].name }}</span>
                    </div>
                    <button class="demo-download-btn" @click="showLogin = true">下载配乐 →</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Carousel Indicators -->
      <div class="hero__indicators">
        <button
          v-for="i in slideCount"
          :key="i"
          class="hero__indicator"
          :class="{ 'hero__indicator--active': activeSlide === i - 1 }"
          @click="goToSlide(i - 1)"
        >
          <div
            v-if="activeSlide === i - 1"
            class="hero__indicator-fill"
            :key="progressKey"
          ></div>
        </button>
      </div>
    </section>

    <!-- ===== 3. 数据背书 ===== -->
    <section class="proof">
      <div class="proof__row">
        <div v-for="s in stats" :key="s.label" class="proof__item">
          <span class="proof__icon">{{ s.icon }}</span>
          <span class="proof__value">{{ s.value }}</span>
          <span class="proof__label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ===== 4. 六大模块 ===== -->
    <section class="modules">
      <h2 class="section-title">六大创作模块</h2>
      <p class="section-sub">从文字创意到成品导出，AI覆盖全流程</p>
      <div class="modules__grid">
        <div v-for="m in modules" :key="m.title" class="mod-card" @click="openModuleDemo(m.key)">
          <div class="mod-card__header">
            <div class="mod-card__icon" :style="{ background: m.color + '18', borderColor: m.color + '40' }">
              <span>{{ m.icon }}</span>
            </div>
            <span class="mod-card__arrow">→</span>
          </div>
          <h3 class="mod-card__title">{{ m.title }}</h3>
          <p class="mod-card__desc">{{ m.desc }}</p>
          <div class="mod-card__flow"><span>{{ m.preview }}</span></div>
        </div>
      </div>
    </section>

    <!-- ===== 5. 三步流程 ===== -->
    <section class="flow">
      <h2 class="section-title">三步完成你的作品</h2>
      <p class="section-sub">简单三步，从文字到影像</p>
      <div class="flow__row">
        <div v-for="(s, i) in steps" :key="s.num" class="flow__card">
          <span class="flow__icon">{{ s.icon }}</span>
          <span class="flow__num">{{ s.num }}</span>
          <h3 class="flow__title">{{ s.title }}</h3>
          <p class="flow__desc">{{ s.desc }}</p>
          <span v-if="i < steps.length - 1" class="flow__connector">→</span>
        </div>
      </div>
    </section>

    <!-- ===== 6. 用户评价 ===== -->
    <section class="reviews">
      <h2 class="section-title">创作者这样说</h2>
      <div class="reviews__track">
        <TransitionGroup name="review-fade">
          <div v-for="(t, i) in testimonials" :key="t.name" v-show="i === activeTestimonial" class="review-card">
            <div class="review-card__header">
              <span class="review-card__avatar">{{ t.avatar }}</span>
              <div>
                <strong class="review-card__name">{{ t.name }}</strong>
                <span class="review-card__role">{{ t.role }}</span>
              </div>
              <span class="review-card__stars">{{ '★'.repeat(t.rating) }}{{ '☆'.repeat(5 - t.rating) }}</span>
            </div>
            <p class="review-card__text">"{{ t.text }}"</p>
          </div>
        </TransitionGroup>
      </div>
      <div class="reviews__dots">
        <button v-for="(t, i) in testimonials" :key="t.name" class="reviews__dot" :class="{ active: i === activeTestimonial }" @click="activeTestimonial = i"></button>
      </div>
    </section>

    <!-- ===== 7. 定价 ===== -->
    <section class="pricing">
      <h2 class="section-title">透明定价</h2>
      <p class="section-sub">从免费版到企业版，满足不同规模的创作需求</p>
      <div class="pricing__grid">
        <div v-for="p in plans" :key="p.name" class="plan-card" :class="{ 'plan-card--hl': p.highlight }">
          <div v-if="p.highlight" class="plan-card__badge">推荐</div>
          <h3 class="plan-card__name">{{ p.name }}</h3>
          <div class="plan-card__price"><span class="plan-card__val">{{ p.price }}</span><span class="plan-card__per">{{ p.period }}</span></div>
          <div class="plan-card__quota">{{ p.quota }}</div>
          <ul class="plan-card__feats"><li v-for="f in p.features" :key="f">✓ {{ f }}</li></ul>
          <button class="plan-card__btn" :class="{ 'plan-card__btn--hl': p.highlight }" @click="showLogin = true">{{ p.name === '企业版' ? '联系客服' : '开始使用' }}</button>
        </div>
      </div>
    </section>

    <!-- ===== 8. CTA + Footer ===== -->
    <section class="cta">
      <div class="cta__glow"></div>
      <h2 class="cta__title">准备好开始创作了吗？</h2>
      <p class="cta__sub">免费版每月9次生成机会，无需信用卡</p>
      <button class="btn-primary btn-primary--lg" @click="showLogin = true">立即免费注册</button>
    </section>

    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__brand">
          <span class="nav__logo">千</span>
          <span class="footer__name">千机工坊</span>
          <p class="footer__tagline">AI驱动的一站式创作平台</p>
        </div>
        <div class="footer__links">
          <div class="footer__col"><h4>产品</h4><RouterLink to="/showcase">作品展示</RouterLink><RouterLink to="/pricing">定价</RouterLink><a href="#" @click.prevent="showLogin = true">登录</a></div>
          <div class="footer__col"><h4>资源</h4><a href="#">帮助中心</a><a href="#">API文档</a><a href="#">更新日志</a></div>
          <div class="footer__col"><h4>法律</h4><a href="#">服务条款</a><a href="#">隐私政策</a><a href="#">版权声明</a></div>
        </div>
      </div>
      <div class="footer__bottom"><p>© 2026 千机工坊 · qianjigongfang.com</p></div>
    </footer>

    <LoginModal v-model="showLogin" />
    <ModuleDemoModal v-model="showModuleDemo" :moduleId="activeModuleId" />
  </div>
</template>

<style scoped>
.home { min-height: 100vh; background: #09090B; color: #FAFAFA; font-family: 'Plus Jakarta Sans', 'Noto Sans SC', system-ui, sans-serif; overflow-x: hidden; }

/* ── Nav ── */
.nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 56px; background: rgba(9,9,11,0.88); backdrop-filter: blur(16px); border-bottom: 1px solid #1a1a1f; }
.nav__brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #FAFAFA; }
.nav__logo { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #00D4AA, #8B5CF6); display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 15px; }
.nav__name { font-size: 16px; font-weight: 700; }
.nav__links { display: flex; align-items: center; gap: 24px; }
.nav__link { color: #71717A; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 150ms; }
.nav__link:hover { color: #FAFAFA; }
.nav__login { padding: 7px 20px; border-radius: 8px; background: #00D4AA; color: #09090B; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms; }
.nav__login:hover { background: #00E8BB; transform: translateY(-1px); }

/* ── Hero Carousel ── */
.hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 80px 48px 80px; overflow: hidden; }
.hero__canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.hero__glow { position: absolute; top: 30%; left: 25%; transform: translate(-50%, -50%); width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(0,212,170,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%); pointer-events: none; z-index: 0; }

.hero__slides { position: relative; z-index: 1; width: 100%; max-width: 1200px; margin: 0 auto; min-height: 520px; }

.hero__slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateX(30px);
  transition: opacity 600ms ease, transform 600ms ease;
  pointer-events: none;
}
.hero__slide--active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
  position: relative;
}

.hero__split { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; width: 100%; align-items: center; }
.hero__left { display: flex; flex-direction: column; gap: 0; }
.hero__right { display: flex; justify-content: center; }

.hero__badge { display: inline-block; padding: 6px 16px; border-radius: 20px; background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.2); color: #00D4AA; font-size: 13px; font-weight: 600; letter-spacing: 0.03em; margin-bottom: 20px; align-self: flex-start; }
.hero__title { font-size: 42px; font-weight: 800; line-height: 1.15; margin: 0 0 16px; letter-spacing: -0.02em; }
.hero__gradient { background: linear-gradient(135deg, #00D4AA 20%, #8B5CF6 80%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero__desc { font-size: 15px; color: #A1A1AA; line-height: 1.7; margin: 0 0 28px; max-width: 460px; }
.hero__cta { display: flex; gap: 12px; margin-bottom: 20px; }
.hero__proof { font-size: 13px; color: #71717A; padding-top: 16px; border-top: 1px solid #1a1a1f; }

/* ── Arrows ── */
.hero__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #FAFAFA;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 300ms, background 200ms;
}
.hero:hover .hero__arrow { opacity: 1; }
.hero__arrow:hover { background: rgba(255,255,255,0.12); }
.hero__arrow--left { left: 8px; }
.hero__arrow--right { right: 8px; }

/* ── Indicators ── */
.hero__indicators {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 8px;
}
.hero__indicator {
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.12);
  border: none;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: background 200ms;
}
.hero__indicator--active { background: rgba(255,255,255,0.12); }
.hero__indicator-fill {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, #00D4AA, #8B5CF6);
  border-radius: 2px;
  animation: indicatorFill 6s linear forwards;
}
@keyframes indicatorFill {
  from { width: 0%; }
  to { width: 100%; }
}

/* ── Demo shared ── */
.demo { width: 100%; max-width: 440px; background: #111113; border: 1px solid #2E2E33; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04); }
.demo__header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #0d0d10; border-bottom: 1px solid #1E1E22; }
.demo__dot { width: 10px; height: 10px; border-radius: 50%; }
.demo__dot--red { background: #EF4444; }
.demo__dot--yellow { background: #FBBF24; }
.demo__dot--green { background: #10B981; }
.demo__title { font-size: 12px; color: #71717A; margin-left: 8px; font-weight: 500; }
.demo__body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.demo__label { font-size: 11px; color: #71717A; font-weight: 600; margin: 0 0 4px; }

/* ── Slide 1: Character Style Grid ── */
.style-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  background: #0d0d10;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms;
}
.style-card:hover { border-color: rgba(0,212,170,0.3); }
.style-card--active { border-color: #00D4AA; background: rgba(0,212,170,0.06); }
.style-card__preview { width: 100%; aspect-ratio: 1; border-radius: 6px; }
.style-card__name { font-size: 10px; color: #A1A1AA; font-weight: 600; }

.character-preview { border-radius: 10px; overflow: hidden; margin-top: 4px; }
.character-preview__bg {
  position: relative;
  width: 100%;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 400ms ease;
}
.character-silhouette { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); }
.character-preview__label {
  position: absolute;
  bottom: 10px;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  font-weight: 600;
  background: rgba(0,0,0,0.4);
  padding: 3px 10px;
  border-radius: 6px;
}

/* ── Slide 2: Video / Phone ── */
.video-presets { display: flex; gap: 8px; }
.video-preset-btn {
  flex: 1;
  padding: 8px 6px;
  border-radius: 8px;
  background: #0d0d10;
  border: 1px solid #2E2E33;
  color: #A1A1AA;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
}
.video-preset-btn:hover { border-color: rgba(0,212,170,0.4); color: #FAFAFA; }
.video-preset-btn--active { border-color: #00D4AA; color: #00D4AA; background: rgba(0,212,170,0.06); }

.phone-mockup { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.phone-frame {
  width: 160px;
  height: 280px;
  border-radius: 24px;
  border: 3px solid #3F3F46;
  background: #1a1a2e;
  position: relative;
  overflow: hidden;
}
.phone-notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 18px;
  background: #3F3F46;
  border-radius: 0 0 10px 10px;
  z-index: 2;
}
.phone-screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 400ms ease;
}
.phone-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.phone-placeholder span { font-size: 32px; }
.phone-placeholder p { font-size: 11px; color: #71717A; margin: 0; }
.phone-video-preview { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.phone-play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
}
.phone-video-title { font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 600; margin: 0; }

.phone-filters { display: flex; gap: 6px; }
.filter-btn {
  padding: 5px 14px;
  border-radius: 6px;
  background: #0d0d10;
  border: 1px solid #2E2E33;
  color: #A1A1AA;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
}
.filter-btn:hover { border-color: rgba(139,92,246,0.4); color: #FAFAFA; }
.filter-btn--active { border-color: #8B5CF6; color: #8B5CF6; background: rgba(139,92,246,0.08); }

/* ── Slide 3: Story Gacha ── */
.story-type-row { display: flex; gap: 8px; }
.story-type-btn {
  flex: 1;
  padding: 8px 6px;
  border-radius: 8px;
  background: #0d0d10;
  border: 1px solid #2E2E33;
  color: #A1A1AA;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
}
.story-type-btn:hover { border-color: rgba(244,114,182,0.4); color: #FAFAFA; }
.story-type-btn--active { border-color: #F472B6; color: #F472B6; background: rgba(244,114,182,0.08); }

.gacha-machine {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 0;
}
.gacha-machine--shake { animation: gachaShake 0.6s ease-in-out; }
@keyframes gachaShake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-6px) rotate(-2deg); }
  20% { transform: translateX(6px) rotate(2deg); }
  30% { transform: translateX(-5px) rotate(-1deg); }
  40% { transform: translateX(5px) rotate(1deg); }
  50% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  90% { transform: translateX(-1px); }
}

.gacha-dome {
  width: 180px;
  height: 120px;
  border-radius: 90px 90px 0 0;
  background: rgba(255,255,255,0.04);
  border: 2px solid #2E2E33;
  border-bottom: none;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
}
.gacha-capsule {
  width: 28px;
  height: 34px;
  border-radius: 50%;
}
.gacha-capsule--1 { background: linear-gradient(180deg, #EF4444 50%, #FCA5A5 50%); }
.gacha-capsule--2 { background: linear-gradient(180deg, #3B82F6 50%, #93C5FD 50%); }
.gacha-capsule--3 { background: linear-gradient(180deg, #10B981 50%, #6EE7B7 50%); }
.gacha-capsule--4 { background: linear-gradient(180deg, #F59E0B 50%, #FCD34D 50%); }
.gacha-capsule--5 { background: linear-gradient(180deg, #8B5CF6 50%, #C4B5FD 50%); }

.gacha-slot {
  width: 180px;
  height: 50px;
  background: #0d0d10;
  border: 2px solid #2E2E33;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.gacha-drop-capsule {
  width: 32px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(180deg, #8B5CF6 50%, #C4B5FD 50%);
  animation: capsuleDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes capsuleDrop {
  0% { transform: translateY(-60px); opacity: 0; }
  40% { transform: translateY(0); opacity: 1; }
  60% { transform: translateY(-12px); }
  80% { transform: translateY(0); }
  90% { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}

.gacha-base {
  width: 200px;
  height: 16px;
  background: #1E1E22;
  border-radius: 0 0 8px 8px;
  border: 2px solid #2E2E33;
  border-top: none;
}

.story-output {
  background: #0d0d10;
  border-radius: 10px;
  padding: 14px;
  border: 1px solid #1E1E22;
}
.story-output__text {
  font-size: 13px;
  color: #D4D4D8;
  line-height: 1.7;
  margin: 0;
  font-style: italic;
}
.story-cursor {
  animation: cursorBlink 0.8s step-end infinite;
  color: #00D4AA;
  font-weight: 700;
}
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ── Slide 4: Promo Director ── */
.shot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.shot-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: #0d0d10;
  border: 1px solid #2E2E33;
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms;
}
.shot-thumb:hover { border-color: rgba(167,139,250,0.4); transform: translateY(-2px); }
.shot-thumb__icon { font-size: 22px; }
.shot-thumb__name { font-size: 10px; color: #A1A1AA; font-weight: 600; }

.timeline-area { margin-top: 4px; }
.timeline-count { color: #00D4AA; margin-left: 8px; }
.timeline-track {
  display: flex;
  gap: 6px;
  min-height: 44px;
  background: #0d0d10;
  border-radius: 8px;
  padding: 6px;
  border: 1px solid #1E1E22;
  align-items: center;
}
.timeline-empty { font-size: 11px; color: #52525B; padding: 4px 8px; width: 100%; text-align: center; }
.timeline-clip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(139,92,246,0.1);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 200ms;
  font-size: 11px;
  color: #C4B5FD;
}
.timeline-clip:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #FCA5A5; }
.timeline-clip__name { font-weight: 600; }

.preview-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 200ms;
  margin-top: 4px;
}
.preview-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.preview-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.preview-btn--active { background: #2E2E33; }

.cinema-preview {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #2E2E33;
  margin-top: 4px;
}
.cinema-letterbox { height: 20px; background: #000; }
.cinema-screen {
  height: 120px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.cinema-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 30%, #533483 60%, #1a1a2e 100%);
  z-index: 0;
}
.cinema-title {
  position: relative;
  z-index: 1;
  font-size: 14px;
  font-weight: 700;
  color: #FAFAFA;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.cinema-shots {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.cinema-shot-label {
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.4);
  padding: 3px 8px;
  border-radius: 4px;
}

/* ── Buttons ── */
.btn-primary { padding: 14px 36px; border-radius: 10px; background: #00D4AA; color: #09090B; font-size: 16px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms; }
.btn-primary:hover { background: #00E8BB; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,212,170,0.25); }
.btn-primary--lg { padding: 16px 44px; font-size: 18px; }

/* ── Proof ── */
.proof { padding: 48px 32px; border-top: 1px solid #1a1a1f; border-bottom: 1px solid #1a1a1f; background: #0d0d10; }
.proof__row { display: flex; justify-content: center; gap: 56px; max-width: 800px; margin: 0 auto; }
.proof__item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.proof__icon { font-size: 24px; }
.proof__value { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #00D4AA, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.proof__label { font-size: 13px; color: #71717A; font-weight: 500; }

/* ── Section common ── */
.section-title { font-size: 40px; font-weight: 800; text-align: center; margin: 0 0 8px; letter-spacing: -0.02em; }
.section-sub { font-size: 16px; color: #71717A; text-align: center; margin: 0 0 48px; }

/* ── Modules ── */
.modules { padding: 96px 32px; }
.modules__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1000px; margin: 0 auto; }
.mod-card { padding: 28px; background: #111113; border: 1px solid #1E1E22; border-radius: 16px; cursor: pointer; transition: all 300ms; position: relative; }
.mod-card:hover { border-color: #00D4AA; transform: translateY(-6px); box-shadow: 0 12px 40px rgba(0,212,170,0.1); }
.mod-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.mod-card__icon { width: 52px; height: 52px; border-radius: 14px; border: 1px solid; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.mod-card__arrow { font-size: 20px; color: #3F3F46; transition: all 200ms; }
.mod-card:hover .mod-card__arrow { color: #00D4AA; transform: translateX(4px); }
.mod-card__title { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
.mod-card__desc { font-size: 14px; color: #A1A1AA; margin: 0 0 16px; line-height: 1.5; }
.mod-card__flow { padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 12px; color: #71717A; }

/* ── Flow ── */
.flow { padding: 96px 32px; background: #0d0d10; }
.flow__row { display: flex; justify-content: center; gap: 24px; max-width: 900px; margin: 0 auto; align-items: flex-start; }
.flow__card { flex: 1; text-align: center; padding: 32px 20px; background: #111113; border: 1px solid #1E1E22; border-radius: 16px; position: relative; }
.flow__icon { font-size: 36px; display: block; margin-bottom: 8px; }
.flow__num { font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #00D4AA, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.flow__title { font-size: 18px; font-weight: 700; margin: 8px 0 6px; }
.flow__desc { font-size: 14px; color: #71717A; margin: 0; }
.flow__connector { position: absolute; right: -20px; top: 50%; transform: translateY(-50%); font-size: 24px; color: #3F3F46; }

/* ── Reviews ── */
.reviews { padding: 96px 32px; }
.reviews__track { max-width: 600px; margin: 0 auto; min-height: 180px; position: relative; }
.review-card { padding: 28px; background: #111113; border: 1px solid #1E1E22; border-radius: 16px; }
.review-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.review-card__avatar { font-size: 32px; }
.review-card__name { font-size: 15px; font-weight: 700; display: block; }
.review-card__role { font-size: 12px; color: #71717A; }
.review-card__stars { margin-left: auto; color: #FBBF24; font-size: 14px; }
.review-card__text { font-size: 15px; color: #D4D4D8; line-height: 1.7; margin: 0; font-style: italic; }
.reviews__dots { display: flex; justify-content: center; gap: 8px; margin-top: 24px; }
.reviews__dot { width: 8px; height: 8px; border-radius: 50%; background: #3F3F46; border: none; cursor: pointer; transition: all 200ms; padding: 0; }
.reviews__dot.active { background: #00D4AA; transform: scale(1.3); }
.review-fade-enter-active, .review-fade-leave-active { transition: all 400ms ease; position: absolute; width: 100%; }
.review-fade-enter-from { opacity: 0; transform: translateX(30px); }
.review-fade-leave-to { opacity: 0; transform: translateX(-30px); }

/* ── Pricing ── */
.pricing { padding: 96px 32px; background: #0d0d10; }
.pricing__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1000px; margin: 0 auto; }
.plan-card { position: relative; padding: 24px; background: #111113; border: 1px solid #1E1E22; border-radius: 16px; display: flex; flex-direction: column; gap: 8px; }
.plan-card--hl { border-color: #8B5CF6; box-shadow: 0 0 24px rgba(139,92,246,0.12); }
.plan-card__badge { position: absolute; top: -1px; right: 16px; padding: 2px 10px; background: #8B5CF6; color: #fff; font-size: 11px; font-weight: 600; border-radius: 0 0 6px 6px; }
.plan-card__name { font-size: 18px; font-weight: 700; margin: 0; }
.plan-card__price { display: flex; align-items: baseline; gap: 4px; }
.plan-card__val { font-size: 32px; font-weight: 800; }
.plan-card__per { font-size: 14px; color: #71717A; }
.plan-card__quota { font-size: 13px; color: #00D4AA; font-weight: 600; }
.plan-card__feats { list-style: none; padding: 0; margin: 8px 0; flex: 1; }
.plan-card__feats li { font-size: 12px; color: #A1A1AA; padding: 3px 0; }
.plan-card__btn { display: block; text-align: center; padding: 10px; border-radius: 8px; background: #1E1E22; color: #FAFAFA; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 200ms; }
.plan-card__btn:hover { background: #27272A; }
.plan-card__btn--hl { background: #8B5CF6; }
.plan-card__btn--hl:hover { background: #7C3AED; }

/* ── CTA ── */
.cta { position: relative; padding: 96px 32px; text-align: center; overflow: hidden; }
.cta__glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(0,212,170,0.08) 0%, rgba(139,92,246,0.04) 50%, transparent 70%); pointer-events: none; }
.cta__title { font-size: 40px; font-weight: 800; margin: 0 0 12px; position: relative; z-index: 1; }
.cta__sub { font-size: 16px; color: #71717A; margin: 0 0 32px; position: relative; z-index: 1; }

/* ── Footer ── */
.footer { padding: 64px 32px 32px; border-top: 1px solid #1a1a1f; }
.footer__inner { display: flex; justify-content: space-between; gap: 48px; max-width: 960px; margin: 0 auto 32px; }
.footer__brand { display: flex; flex-direction: column; gap: 8px; }
.footer__name { font-size: 16px; font-weight: 700; }
.footer__tagline { font-size: 13px; color: #52525B; margin: 0; }
.footer__links { display: flex; gap: 48px; }
.footer__col { display: flex; flex-direction: column; gap: 8px; }
.footer__col h4 { font-size: 13px; font-weight: 600; color: #71717A; margin: 0; }
.footer__col a { font-size: 13px; color: #52525B; text-decoration: none; transition: color 150ms; }
.footer__col a:hover { color: #FAFAFA; }
.footer__bottom { text-align: center; padding-top: 24px; border-top: 1px solid #1a1a1f; }
.footer__bottom p { font-size: 12px; color: #3F3F46; margin: 0; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .hero { padding: 60px 24px 80px; }
  .hero__split { grid-template-columns: 1fr; text-align: center; }
  .hero__left { align-items: center; }
  .hero__badge { align-self: center; }
  .hero__title { font-size: 32px; }
  .hero__desc { max-width: 100%; }
  .hero__cta { justify-content: center; }
  .hero__proof { text-align: center; }
  .hero__right { display: none; }
  .hero__arrow { display: none; }
  .hero__slides { min-height: auto; }
  .modules__grid { grid-template-columns: repeat(2, 1fr); }
  .pricing__grid { grid-template-columns: repeat(2, 1fr); }
  .proof__row { gap: 32px; }
  .flow__row { flex-direction: column; align-items: center; }
  .flow__connector { display: none; }
  .section-title { font-size: 32px; }
}
@media (max-width: 768px) {
  .modules__grid { grid-template-columns: 1fr; }
  .pricing__grid { grid-template-columns: 1fr; }
  .proof__row { flex-wrap: wrap; gap: 24px; }
  .hero__title { font-size: 28px; }
  .hero__cta { flex-direction: column; align-items: center; }
  .hero__indicator { width: 40px; }
  .footer__inner { flex-direction: column; gap: 32px; }
  .nav { padding: 0 16px; }
}
/* ── Slide 5: Ad Image Generator ── */
.ad-template-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.ad-template-card { padding: 8px; background: #0d0d10; border: 1px solid #1E1E22; border-radius: 10px; cursor: pointer; transition: all 200ms; text-align: center; }
.ad-template-card:hover { border-color: #3F3F46; }
.ad-template-card--active { border-color: #00D4AA; background: rgba(0,212,170,0.06); }
.ad-template-preview { height: 48px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.ad-template-ratio { font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; }
.ad-template-name { font-size: 11px; color: #A1A1AA; }
.ad-upload-area { background: #0d0d10; border: 2px dashed #2E2E33; border-radius: 10px; min-height: 100px; display: flex; align-items: center; justify-content: center; transition: all 200ms; }
.ad-upload-area--has-template { border-color: #00D4AA; }
.ad-upload-inner { text-align: center; color: #52525B; }
.ad-upload-icon { font-size: 28px; display: block; margin-bottom: 4px; }
.ad-upload-inner p { font-size: 12px; margin: 0; }
.ad-generating { text-align: center; color: #00D4AA; }
.ad-generating-spinner { width: 24px; height: 24px; border: 3px solid #1E1E22; border-top-color: #00D4AA; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 6px; }
@keyframes spin { to { transform: rotate(360deg); } }
.ad-generating p { font-size: 12px; margin: 0; }
.ad-result { display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 10px; }
.ad-result-preview { height: 80px; border-radius: 8px; position: relative; overflow: hidden; }
.ad-result-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); }
.ad-result-badge { font-size: 10px; font-weight: 700; color: #00D4AA; background: rgba(0,212,170,0.15); padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; }
.ad-result-text { font-size: 13px; color: #fff; font-weight: 600; margin: 0 0 2px; }
.ad-result-ratio { font-size: 10px; color: rgba(255,255,255,0.6); }
.btn-primary--sm { padding: 8px 16px; font-size: 13px; }

/* ── Slide 6: Music Generator ── */
.mood-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.mood-card { padding: 10px 8px; background: #0d0d10; border: 1px solid #1E1E22; border-radius: 10px; cursor: pointer; transition: all 200ms; text-align: center; }
.mood-card:hover { border-color: #3F3F46; }
.mood-card--active { border-width: 2px; }
.mood-card__name { display: block; font-size: 13px; font-weight: 700; color: #FAFAFA; margin-bottom: 2px; }
.mood-card__bpm { font-size: 10px; color: #71717A; }
.generate-music-btn { width: 100%; padding: 12px; border-radius: 10px; background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B; font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms; display: flex; align-items: center; justify-content: center; gap: 8px; }
.generate-music-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,212,170,0.25); }
.generate-music-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.generate-music-btn--loading { background: #1E1E22; color: #00D4AA; }
.generate-music-spinner { width: 18px; height: 18px; border: 2px solid #1E1E22; border-top-color: #00D4AA; border-radius: 50%; animation: spin 0.8s linear infinite; }
.music-result { margin-top: 10px; }
.music-wave-demo { display: flex; align-items: center; gap: 3px; height: 32px; padding: 6px 10px; background: #0d0d10; border-radius: 8px; border: 1px solid #1E1E22; margin-bottom: 6px; }
.music-wave-bar { width: 4px; border-radius: 2px; background: #00D4AA; animation: musicWave 0.6s ease-in-out infinite alternate; }
@keyframes musicWave { from { transform: scaleY(1); } to { transform: scaleY(0.3); } }
.music-result-info { display: flex; gap: 12px; font-size: 11px; color: #71717A; padding: 0 4px; }

/* ── Enhanced Demo Components ── */

/* Textarea & Inputs */
.demo-textarea { width: 100%; padding: 8px 10px; background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px; color: #FAFAFA; font-size: 12px; font-family: inherit; resize: none; outline: none; transition: border-color 200ms; box-sizing: border-box; }
.demo-textarea:focus { border-color: #00D4AA; }
.demo-textarea::placeholder { color: #52525B; }
.demo-input { width: 100%; padding: 8px 10px; background: #0d0d10; border: 1px solid #2E2E33; border-radius: 8px; color: #FAFAFA; font-size: 12px; font-family: inherit; outline: none; transition: border-color 200ms; box-sizing: border-box; }
.demo-input:focus { border-color: #00D4AA; }
.demo-input::placeholder { color: #52525B; }
.demo-input--sm { flex: 1; min-width: 0; }

/* Pill Buttons Row */
.demo-pill-row { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-pill { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; background: #0d0d10; border: 1px solid #2E2E33; color: #A1A1AA; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 200ms; white-space: nowrap; }
.demo-pill:hover { border-color: rgba(0,212,170,0.4); color: #FAFAFA; }
.demo-pill--active { border-color: #00D4AA; color: #00D4AA; background: rgba(0,212,170,0.08); }
.demo-pill__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Generate Button */
.demo-generate-btn { width: 100%; padding: 10px; border-radius: 10px; background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms; display: flex; align-items: center; justify-content: center; gap: 8px; }
.demo-generate-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,212,170,0.25); }
.demo-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.demo-generate-btn--loading { background: #1E1E22; }
.demo-btn-spinner { width: 18px; height: 18px; border: 2px solid rgba(0,212,170,0.3); border-top-color: #00D4AA; border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Step Progress */
.step-progress { margin-top: 4px; }
.step-progress__track { display: flex; align-items: center; gap: 0; justify-content: space-between; }
.step-progress__item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; position: relative; }
.step-progress__item::after { content: ''; position: absolute; top: 10px; left: 50%; width: 100%; height: 2px; background: #1E1E22; z-index: 0; }
.step-progress__item:last-child::after { display: none; }
.step-progress__item--done::after { background: #00D4AA; }
.step-progress__item--active::after { background: linear-gradient(90deg, #00D4AA 50%, #1E1E22 50%); }
.step-progress__dot { width: 20px; height: 20px; border-radius: 50%; background: #1E1E22; border: 2px solid #2E2E33; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #52525B; transition: all 300ms; position: relative; z-index: 1; }
.step-progress__item--done .step-progress__dot { background: #00D4AA; border-color: #00D4AA; color: #09090B; }
.step-progress__item--active .step-progress__dot { background: #0d0d10; border-color: #00D4AA; color: #00D4AA; box-shadow: 0 0 8px rgba(0,212,170,0.3); animation: stepPulse 1s ease-in-out infinite; }
@keyframes stepPulse { 0%, 100% { box-shadow: 0 0 4px rgba(0,212,170,0.2); } 50% { box-shadow: 0 0 12px rgba(0,212,170,0.5); } }
.step-progress__label { font-size: 9px; color: #52525B; font-weight: 600; white-space: nowrap; transition: color 300ms; }
.step-progress__item--done .step-progress__label { color: #00D4AA; }
.step-progress__item--active .step-progress__label { color: #FAFAFA; }

/* Download Button */
.demo-download-btn { width: 100%; padding: 9px; border-radius: 8px; background: linear-gradient(135deg, #00D4AA, #8B5CF6); color: #09090B; font-size: 12px; font-weight: 700; border: none; cursor: pointer; transition: all 200ms; }
.demo-download-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,212,170,0.25); }

/* Slide 1: Animation Result */
.anim-result { display: flex; flex-direction: column; gap: 8px; }
.anim-frames { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.anim-frame { height: 72px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; position: relative; overflow: hidden; animation: frameAppear 0.4s ease-out both; }
.anim-frame:nth-child(2) { animation-delay: 0.1s; }
.anim-frame:nth-child(3) { animation-delay: 0.2s; }
@keyframes frameAppear { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.anim-frame__num { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.9); text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.anim-frame__mood { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.35); padding: 2px 6px; border-radius: 4px; }
.demo-play-btn { width: 100%; padding: 8px; border-radius: 8px; background: #1E1E22; border: 1px solid #2E2E33; color: #00D4AA; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.demo-play-btn:hover { background: #27272A; border-color: #00D4AA; }

/* Mini Player */
.mini-player { display: flex; align-items: center; gap: 8px; }
.mini-player__track { flex: 1; height: 4px; background: #1E1E22; border-radius: 2px; overflow: hidden; }
.mini-player__fill { height: 100%; background: linear-gradient(90deg, #00D4AA, #8B5CF6); border-radius: 2px; transition: width 120ms linear; }
.mini-player__time { font-size: 10px; color: #71717A; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Slide 2: Video Result */
.video-result { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.video-engagement { display: flex; gap: 16px; font-size: 11px; color: #A1A1AA; font-weight: 500; padding: 6px 0; }
.video-engagement span { display: flex; align-items: center; gap: 3px; }

/* Slide 3: Story Result */
.keyword-inputs { display: flex; gap: 6px; }
.story-result { display: flex; flex-direction: column; gap: 8px; }
.story-stats { display: flex; gap: 16px; font-size: 10px; color: #71717A; font-weight: 500; }

/* Slide 4: Promo Result */
.promo-toggle-row { margin-top: 6px; }
.promo-toggle { padding: 6px 14px; border-radius: 8px; background: #0d0d10; border: 1px solid #2E2E33; color: #A1A1AA; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 200ms; }
.promo-toggle:hover { border-color: rgba(167,139,250,0.4); color: #FAFAFA; }
.promo-toggle--active { border-color: #8B5CF6; color: #8B5CF6; background: rgba(139,92,246,0.08); }
.shot-thumb__dur { font-size: 9px; color: #52525B; margin-top: 1px; }
.timeline-clip__dur { font-size: 9px; color: rgba(196,181,253,0.5); margin-left: 2px; }
.promo-result { display: flex; flex-direction: column; gap: 8px; }
.promo-stats { display: flex; gap: 12px; font-size: 10px; color: #71717A; font-weight: 500; flex-wrap: wrap; }
.cinema-play-btn { position: relative; z-index: 1; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; cursor: pointer; }

/* Slide 5: Ad Multi-Size Preview */
.selling-points-row { display: flex; gap: 6px; }
.ad-template-preview--tall { height: 60px; }
.ad-result-multi { display: flex; flex-direction: column; gap: 8px; }
.ad-size-previews { display: flex; gap: 10px; justify-content: center; align-items: flex-end; padding: 8px 0; }
.ad-size-preview { border-radius: 6px; position: relative; overflow: hidden; flex-shrink: 0; animation: frameAppear 0.4s ease-out both; }
.ad-size-preview:nth-child(2) { animation-delay: 0.1s; }
.ad-size-preview:nth-child(3) { animation-delay: 0.2s; }
.ad-size-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); padding: 4px; }
.ad-size-name { font-size: 8px; color: rgba(255,255,255,0.9); font-weight: 700; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.5); line-height: 1.2; }
.ad-size-label { font-size: 9px; color: rgba(255,255,255,0.6); font-weight: 600; margin-top: 2px; }
.ad-export-info { display: flex; justify-content: space-between; font-size: 10px; color: #71717A; padding: 0 4px; }

/* Slide 6: Enhanced Music */
.mood-card__indicator { display: block; width: 24px; height: 4px; border-radius: 2px; margin: 0 auto 6px; }
.music-result-full { display: flex; flex-direction: column; gap: 8px; }
.music-wave-player { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #0d0d10; border-radius: 10px; border: 1px solid #1E1E22; }
.music-wave-bars { display: flex; align-items: center; gap: 3px; flex: 1; height: 36px; }
.music-wave-bar--paused { animation-play-state: paused !important; }
.music-play-btn { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #00D4AA, #8B5CF6); border: none; color: #09090B; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 200ms; }
.music-play-btn:hover { transform: scale(1.1); }
.music-progress-bar { height: 4px; background: #1E1E22; border-radius: 2px; overflow: hidden; }
.music-progress-fill { height: 100%; background: linear-gradient(90deg, #00D4AA, #8B5CF6); border-radius: 2px; transition: width 100ms linear; }
.music-stats { display: flex; gap: 12px; font-size: 10px; color: #71717A; font-weight: 500; }

</style>
