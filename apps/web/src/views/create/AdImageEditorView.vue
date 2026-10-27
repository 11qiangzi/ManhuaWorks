<script setup lang="ts">
/**
 * AdImageEditorView.vue - 广告图生成器 (img2img模式)
 * 5-step flow:
 *   1) 选择风格模板 + 上传商品图
 *   2) AI生成广告图 (Seedream 5.0 img2img)
 *   3) 文案叠加 + 排版
 *   4) 多尺寸生成
 *   5) 导出
 */
import { ref, computed, watch, onMounted } from 'vue'
import { assetService } from '@/api/asset-service-v2'
import { generateText, generateImage } from '@/api/ai-router'
import { useFileDrop } from '../../composables/useFileDrop'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

const hasStarted = ref(true)

interface AdTemplate {
  id: string
  name: string
  preview: string
  bestFor: string[]
  styleDesc: string
  accentColor: string
}

interface ProductImage {
  id: number
  file: File
  preview: string
  serverUrl?: string
}

interface CandidateImage {
  id: number
  gradient: string
  label: string
  imageUrl?: string
}

interface TextOverlay {
  headline: string
  subHeadline: string
  cta: string
  position: string
  color: string
}

interface TargetSize {
  id: string
  label: string
  name: string
  w: number
  h: number
  platform: string
  selected: boolean
  generated: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TEMPLATES: AdTemplate[] = [
  {
    id: 'minimal-white',
    name: '简约白底',
    preview: 'linear-gradient(135deg, #f8f8f8 0%, #e0e0e0 100%)',
    bestFor: ['电商主图', '产品展示'],
    styleDesc: '纯净白底，极简构图，突出产品本体美感与质感。柔和光影，专业级商品摄影风格。',
    accentColor: '#e0e0e0',
  },
  {
    id: 'scene-blend',
    name: '场景融合',
    preview: 'linear-gradient(135deg, #2d5016 0%, #87ceeb 100%)',
    bestFor: ['户外用品', '家居'],
    styleDesc: '产品自然融入真实场景环境，如生活空间、户外自然风光。营造沉浸式使用体验。',
    accentColor: '#4caf50',
  },
  {
    id: 'magazine',
    name: '杂志风',
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #c9a96e 100%)',
    bestFor: ['美妆护肤', '时尚单品'],
    styleDesc: '高端杂志排版风格，精致的构图与色彩搭配。时尚大片质感，具有强烈的视觉冲击力。',
    accentColor: '#c9a96e',
  },
  {
    id: 'tech',
    name: '科技感',
    preview: 'linear-gradient(135deg, #0a0e27 0%, #00d4ff 100%)',
    bestFor: ['数码产品', '智能硬件'],
    styleDesc: '未来科技风格，冷色调光影效果。产品悬浮于科技空间中，带有光效与粒子点缀。',
    accentColor: '#00d4ff',
  },
  {
    id: 'guochao',
    name: '国潮风',
    preview: 'linear-gradient(135deg, #8b0000 0%, #ffd700 100%)',
    bestFor: ['国货品牌', '文创产品'],
    styleDesc: '中国传统美学融合现代设计，红色金色为主调。水墨、祥云、中国结等国风元素装饰。',
    accentColor: '#ffd700',
  },
  {
    id: 'promo-burst',
    name: '促销爆炸贴',
    preview: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
    bestFor: ['促销活动', '电商大促'],
    styleDesc: '高饱和度色彩，强烈的促销氛围。爆炸贴元素、折扣标签、醒目的视觉冲击力。',
    accentColor: '#ff0844',
  },
]

const TEXT_POSITIONS = [
  { id: 'top-left', name: '左上', gridArea: '1/1' },
  { id: 'top-center', name: '上中', gridArea: '1/2' },
  { id: 'top-right', name: '右上', gridArea: '1/3' },
  { id: 'center-left', name: '左中', gridArea: '2/1' },
  { id: 'center', name: '居中', gridArea: '2/2' },
  { id: 'center-right', name: '右中', gridArea: '2/3' },
  { id: 'bottom-left', name: '左下', gridArea: '3/1' },
  { id: 'bottom-center', name: '下中', gridArea: '3/2' },
  { id: 'bottom-right', name: '右下', gridArea: '3/3' },
]

const CTA_OPTIONS = ['立即购买', '了解更多', '限时优惠', '马上抢购', '免费试用']

const TARGET_SIZES_INITIAL: TargetSize[] = [
  { id: 'sq', label: '1:1', name: '方图', w: 1080, h: 1080, platform: '朋友圈 / Instagram', selected: true, generated: false },
  { id: 'v34', label: '3:4', name: '竖版', w: 1080, h: 1440, platform: '小红书', selected: true, generated: false },
  { id: 'v916', label: '9:16', name: '竖版', w: 1080, h: 1920, platform: '抖音 / 故事', selected: false, generated: false },
  { id: 'h169', label: '16:9', name: '横版', w: 1920, h: 1080, platform: '公众号头图 / B站', selected: false, generated: false },
  { id: 'uw', label: '2.35:1', name: '超宽', w: 2350, h: 1000, platform: 'Banner', selected: false, generated: false },
]

const EXPORT_FORMATS = ['PNG', 'JPG', 'WebP']
const QUALITY_OPTIONS = ['标准', '高', '最高']

const STEP_LABELS = ['风格模板', 'AI生成', '文案排版', '多尺寸', '导出']

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const step = ref(1)

// Step 1 state
// ENH-18: 广告图变体预览对比
interface AdImageVariant {
  id: string
  size: string
  width: number
  height: number
  format: 'png' | 'jpg' | 'webp'
  previewUrl: string
  status: 'generated' | 'pending'
}

const adImageVariants = ref<AdImageVariant[]>([])
const isGeneratingVariants = ref(false)
const showVariantCompare = ref(false)

async function generateVariants() {
  isGeneratingVariants.value = true
  adImageVariants.value = []
  const sizes = [
    { label: '朋友圈 (1080x1920)', w: 1080, h: 1920 },
    { label: '公众号封面 (900x383)', w: 900, h: 383 },
    { label: '小红书 (1080x1440)', w: 1080, h: 1440 },
    { label: 'Banner (1200x628)', w: 1200, h: 628 },
    { label: '开屏 (1080x1920)', w: 1080, h: 1920 },
    { label: '缩略图 (300x300)', w: 300, h: 300 },
  ]
  const stylePrompts = [
    '社交媒体风格，竖版构图，适合朋友圈分享',
    '公众号封面风格，横版构图，醒目吸睛',
    '小红书风格，竖版构图，精致生活感',
    '网页Banner风格，横版构图，简洁大气',
    '开屏广告风格，竖版全屏，视觉冲击力强',
    '缩略图风格，正方形构图，产品特写突出',
  ]
  const formats: Array<'png' | 'jpg' | 'webp'> = ['png', 'jpg', 'webp']
  const refImages = productImages.value
    .filter(p => p.serverUrl)
    .map(p => p.serverUrl!)

  try {
    const results = await Promise.all(
      sizes.map(async (s, i) => {
        const variantPrompt = `${craftPrompt.value}\n${stylePrompts[i]}`
        const urls = await generateImage({
          prompt: variantPrompt,
          size: `${s.w}x${s.h}`,
          referenceImages: refImages.length > 0 ? refImages : undefined,
        })
        return { size: s, url: urls[0], format: formats[i % 3] }
      }),
    )

    results.forEach((r, i) => {
      adImageVariants.value.push({
        id: `var-${i}`,
        size: r.size.label,
        width: r.size.w,
        height: r.size.h,
        format: r.format,
        previewUrl: r.url,
        status: 'generated',
      })
    })
  } catch (error) {
    console.error('Variant generation failed:', error)
    showToast('变体生成失败，请重试')
  } finally {
    isGeneratingVariants.value = false
    showVariantCompare.value = true
  }
}

// ENH-19: 品牌Kit保存
interface BrandKit {
  id: string
  name: string
  logo: string
  primaryColor: string
  accentColor: string
  fontFamily: string
  slogan: string
  brandAssets: string[]
}

const brandKits = ref<BrandKit[]>([])
const showBrandKitPanel = ref(false)
const brandKitName = ref('')
const brandKitPrimary = ref('#00BFA5')
const brandKitAccent = ref('#7C3AED')
const brandKitFont = ref('default')
const brandKitSlogan = ref('')

function loadBrandKits() {
  try {
    const stored = localStorage.getItem('brand-kits')
    if (stored) brandKits.value = JSON.parse(stored)
  } catch { /* ignore */ }
}

function saveBrandKit() {
  if (!brandKitName.value.trim()) return
  const kit: BrandKit = {
    id: Date.now().toString(),
    name: brandKitName.value.trim(),
    logo: '',
    primaryColor: brandKitPrimary.value,
    accentColor: brandKitAccent.value,
    fontFamily: brandKitFont.value,
    slogan: brandKitSlogan.value,
    brandAssets: [],
  }
  brandKits.value.push(kit)
  localStorage.setItem('brand-kits', JSON.stringify(brandKits.value))
  brandKitName.value = ''
  brandKitSlogan.value = ''
}

function deleteBrandKit(id: string) {
  brandKits.value = brandKits.value.filter(k => k.id !== id)
  localStorage.setItem('brand-kits', JSON.stringify(brandKits.value))
}

function applyBrandKit(kit: BrandKit) {
  brandKitPrimary.value = kit.primaryColor
  brandKitAccent.value = kit.accentColor
  brandKitFont.value = kit.fontFamily
  brandKitSlogan.value = kit.slogan
}

const selectedTemplate = ref('minimal-white')
const productImages = ref<ProductImage[]>([])
const productName = ref('')
// POL-6: 广告图文案AI按钮
const isGeneratingCopy = ref(false)
const aiCopyTips = ref('')

async function generateAICopy() {
  isGeneratingCopy.value = true
  aiCopyTips.value = ''
  try {
    const prompt = `为产品"${productName.value}"生成广告文案。
风格：${currentTemplate.value.name} - ${currentTemplate.value.styleDesc}
${tagline.value ? `参考广告语：${tagline.value}` : ''}

请返回JSON格式（不要包含markdown代码块标记）：
{"headline": "主标题（10字以内，吸引眼球）", "subHeadline": "副标题（15字以内，突出卖点）", "cta": "行动号召（4字以内）"}

要求：简洁有力，适合电商广告投放。`

    const result = await generateText({
      prompt,
      systemPrompt: '你是一位资深广告文案策划师，擅长撰写高转化率的电商广告文案。只返回JSON，不要多余文字。',
      maxTokens: 500,
    })

    try {
      const parsed = JSON.parse(result)
      textOverlay.headline = parsed.headline ?? textOverlay.headline
      textOverlay.subHeadline = parsed.subHeadline ?? textOverlay.subHeadline
      textOverlay.cta = parsed.cta ?? textOverlay.cta
    } catch {
      // Fallback: extract lines from raw text if JSON parse fails
      const lines = result.split('\n').filter(l => l.trim())
      if (lines[0]) textOverlay.headline = lines[0].replace(/^["'""「『【]/, '').replace(/["'""」』】]$/, '')
      if (lines[1]) textOverlay.subHeadline = lines[1].replace(/^["'""「『【]/, '').replace(/["'""」』】]$/, '')
      if (lines[2]) textOverlay.cta = lines[2].replace(/^["'""「『【]/, '').replace(/["'""」』】]$/, '')
    }
    aiCopyTips.value = 'AI已生成文案，可手动微调'
    setTimeout(() => { aiCopyTips.value = '' }, 3000)
  } catch (error) {
    console.error('AI copy generation failed:', error)
    aiCopyTips.value = '文案生成失败，请重试'
    setTimeout(() => { aiCopyTips.value = '' }, 3000)
  } finally {
    isGeneratingCopy.value = false
  }
}

const tagline = ref('')
let imgIdCounter = 0

// ENH-9: 纯文案海报模式
const textOnlyMode = ref(false)
const textOnlyTitle = ref('')
const textOnlySubtitle = ref('')
const textOnlyCTA = ref('立即购买')

const POSTER_STYLES = ['活动促销', '品牌形象', '节日祝福', '招聘启事', '新品发布'] as const
const textOnlyPosterStyle = ref<string>('品牌形象')

// Step 2 state
const generating = ref(false)
const candidates = ref<CandidateImage[]>([])
const selectedCandidateId = ref<number | null>(null)

// Step 3 state
const textOverlay = ref<TextOverlay>({
  headline: '',
  subHeadline: '',
  cta: '立即购买',
  position: 'center',
  color: '#FFFFFF',
})

// Step 4 state
const targetSizes = ref<TargetSize[]>(TARGET_SIZES_INITIAL.map(s => ({ ...s })))
const multiGenerating = ref(false)

// Step 5 state
const exportFormat = ref('PNG')
const exportQuality = ref('高')
const withWatermark = ref(true)
const withoutWatermark = ref(true)

// Toast notification system
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

/* ------------------------------------------------------------------ */
/*  Computed                                                           */
/* ------------------------------------------------------------------ */

const currentTemplate = computed(() =>
  TEMPLATES.find(t => t.id === selectedTemplate.value) ?? TEMPLATES[0],
)

const selectedCandidate = computed(() =>
  candidates.value.find(c => c.id === selectedCandidateId.value) ?? null,
)

const canProceedStep1 = computed(() =>
  textOnlyMode.value
    ? textOnlyTitle.value.trim().length > 0
    : productName.value.trim().length > 0 && productImages.value.length > 0,
)

const selectedSizes = computed(() =>
  targetSizes.value.filter(s => s.selected),
)

const allSizesGenerated = computed(() =>
  selectedSizes.value.length > 0 && selectedSizes.value.every(s => s.generated),
)

const craftPrompt = computed(() => {
  const tpl = currentTemplate.value
  return [
    `[Context] ${tpl.styleDesc}`,
    `[Reference] 使用@商品图作为产品外观参考，保持产品外观100%一致`,
    `[Action] 将产品"${productName.value}"放置在${tpl.name}风格场景中`,
    `[Framing] ${tpl.name}构图风格，${tagline.value ? `配合广告语"${tagline.value}"的排版需求` : '标准构图'}`,
  ].join('\n')
})

const positionStyle = computed(() => {
  const pos = textOverlay.value.position
  const map: Record<string, Record<string, string>> = {
    'top-left': { top: '8%', left: '8%' },
    'top-center': { top: '8%', left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: '8%', right: '8%' },
    'center-left': { top: '50%', left: '8%', transform: 'translateY(-50%)' },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'center-right': { top: '50%', right: '8%', transform: 'translateY(-50%)' },
    'bottom-left': { bottom: '8%', left: '8%' },
    'bottom-center': { bottom: '8%', left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '8%', right: '8%' },
  }
  return map[pos] ?? map['center']
})

/* ------------------------------------------------------------------ */
/*  Step 1: Image upload                                               */
/* ------------------------------------------------------------------ */

const { isDragging, onDragEnter, onDragLeave, onDrop } = useFileDrop((files) => {
  for (const f of files) {
    if (productImages.value.length >= 3) break
    if (f.type.startsWith('image/')) addImage(f)
  }
})

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (let i = 0; i < input.files.length; i++) {
    if (productImages.value.length >= 3) break
    addImage(input.files[i])
  }
  input.value = ''
}

function addImage(file: File) {
  const id = ++imgIdCounter
  const reader = new FileReader()
  const img: ProductImage = { id, file, preview: '' }
  reader.onload = () => { img.preview = reader.result as string }
  reader.readAsDataURL(file)
  productImages.value.push(img)
  // 异步上传到 asset-service
  assetService.upload(file, { kind: 'image' }).then(asset => {
    img.serverUrl = asset.url
  }).catch(() => {})
}

function removeImage(id: number) {
  productImages.value = productImages.value.filter(img => img.id !== id)
}

/* ------------------------------------------------------------------ */
/*  Step 2: AI generation                                              */
/* ------------------------------------------------------------------ */

async function generateCandidates() {
  generating.value = true
  try {
    const refImages = productImages.value
      .filter(p => p.serverUrl)
      .map(p => p.serverUrl!)
    const urls = await generateImage({
      prompt: craftPrompt.value,
      size: '1024x1024',
      n: 3,
      referenceImages: refImages.length > 0 ? refImages : undefined,
    })
    candidates.value = urls.map((url, i) => ({
      id: i + 1,
      gradient: `linear-gradient(135deg, ${currentTemplate.value.accentColor}44, #09090B)`,
      label: `方案 ${i + 1}`,
      imageUrl: url,
    }))
    selectedCandidateId.value = 1
  } catch (error) {
    console.error('Candidate generation failed:', error)
    showToast('广告图生成失败，请重试')
  } finally {
    generating.value = false
  }
}

async function regenerateCandidates() {
  candidates.value = []
  selectedCandidateId.value = null
  await generateCandidates()
}

function selectCandidate(id: number) {
  selectedCandidateId.value = id
}

function nextFromStep2() {
  if (selectedCandidateId.value) {
    textOverlay.value.headline = productName.value
    textOverlay.value.subHeadline = tagline.value
    step.value = 3
  }
}

/* ------------------------------------------------------------------ */
/*  Step 4: Multi-size generation                                      */
/* ------------------------------------------------------------------ */

async function generateMultiSize() {
  multiGenerating.value = true
  try {
    const refImages = productImages.value
      .filter(p => p.serverUrl)
      .map(p => p.serverUrl!)
    const selected = targetSizes.value.filter(s => s.selected)

    await Promise.all(
      selected.map(async (sz) => {
        const prompt = `${craftPrompt.value}\n为${sz.label}(${sz.w}x${sz.h})尺寸重新构图，适配${sz.platform}展示需求`
        const urls = await generateImage({
          prompt,
          size: `${sz.w}x${sz.h}`,
          referenceImages: refImages.length > 0 ? refImages : undefined,
        })
        if (urls[0]) {
          // Store generated URL on the size object for preview rendering
          (sz as any).generatedUrl = urls[0]
        }
        sz.generated = true
      }),
    )
  } catch (error) {
    console.error('Multi-size generation failed:', error)
    showToast('多尺寸生成失败，请重试')
  } finally {
    multiGenerating.value = false
  }
}

function toggleSize(id: string) {
  const sz = targetSizes.value.find(s => s.id === id)
  if (sz) sz.selected = !sz.selected
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

function goToStep(n: number) {
  if (n < step.value) step.value = n
}

function nextStep() {
  if (step.value === 1 && canProceedStep1.value) {
    step.value = 2
  } else if (step.value === 3) {
    step.value = 4
  } else if (step.value === 4 && allSizesGenerated.value) {
    step.value = 5
  }
}

function prevStep() {
  if (step.value > 1) step.value -= 1
}

/* ------------------------------------------------------------------ */
/*  Step 5: Export                                                     */
/* ------------------------------------------------------------------ */

async function downloadSingle(size: TargetSize) {
  const candidate = selectedCandidate.value
  if (!candidate?.imageUrl) {
    showToast('请先选择一张候选图')
    return
  }
  const ext = exportFormat.value.toLowerCase()
  const fileName = `ad-${size.label}-${size.w}x${size.h}.${ext}`
  try {
    showToast(`正在导出：${size.label} ${size.w}x${size.h} ${exportFormat.value}`)
    const resp = await fetch(candidate.imageUrl)
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[downloadSingle] 下载失败:', err)
    showToast('下载失败，请重试')
  }
}

async function downloadAll() {
  const sizes = selectedSizes.value
  if (sizes.length === 0) {
    showToast('请先选择至少一个目标尺寸')
    return
  }
  showToast(`正在导出：${sizes.length} 个尺寸 x ${exportFormat.value} (${exportQuality.value})`)
  for (let i = 0; i < sizes.length; i++) {
    await downloadSingle(sizes[i])
    if (i < sizes.length - 1) {
      await new Promise(r => setTimeout(r, 300))
    }
  }
}

// ── 草稿自动保存 ──
const DRAFT_KEY_AI = 'mhw:draft:ad-image'
watch([candidates, selectedTemplate], () => {
  try {
    const urls = candidates.value.filter(c => c.imageUrl).map(c => ({ id: c.id, imageUrl: c.imageUrl, label: c.label }))
    if (urls.length > 0) {
      sessionStorage.setItem(DRAFT_KEY_AI, JSON.stringify({
        candidateUrls: urls,
        selectedTemplate: selectedTemplate.value,
        savedAt: new Date().toISOString()
      }))
    }
  } catch { /* storage full */ }
}, { deep: true })
// 恢复草稿
onMounted(() => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY_AI)
    if (raw) {
      const d = JSON.parse(raw)
      if (d.selectedTemplate) selectedTemplate.value = d.selectedTemplate
    }
  } catch { /* ignore */ }
})
</script>

<template>

  <!-- Toast notification -->
  <Transition name="toast-fade">
    <div v-if="toast" class="ad-toast">{{ toast }}</div>
  </Transition>

    <!-- P4-1: First-visit empty state -->
    <div v-if="!hasStarted" class="qe-empty">
      <div class="qe-empty__icon">🖼</div>
      <h2 class="qe-empty__title">暂无广告图项目</h2>
      <p class="qe-empty__desc">上传商品图选择风格模板，AI自动生成专业广告图并适配多尺寸</p>
      <button class="qe-empty__btn" @click="hasStarted = true">🖼 开始创作</button>
    </div>
    <div class="ad-editor" v-else>
    <!-- ==================== Step Indicator ==================== -->
    <div class="step-indicator">
      <div
        v-for="(label, idx) in STEP_LABELS"
        :key="idx"
        class="step-indicator__item"
        :class="{
          'step-indicator__item--active': step === idx + 1,
          'step-indicator__item--done': step > idx + 1,
        }"
        @click="goToStep(idx + 1)"
      >
        <div class="step-indicator__dot">
          <span v-if="step > idx + 1" class="step-indicator__check">&#10003;</span>
          <span v-else>{{ idx + 1 }}</span>
        </div>
        <span class="step-indicator__label">{{ label }}</span>
        <div v-if="idx < STEP_LABELS.length - 1" class="step-indicator__line" />
      </div>
    </div>

    <!-- ==================== STEP 1 ==================== -->
    <div v-if="step === 1" class="step-content">
      <header class="step-header">
        <h1 class="step-title">选择风格模板 + 上传商品图</h1>
        <p class="step-subtitle">选择广告风格，上传商品图作为 img2img 参考，填写商品信息</p>
      </header>

      <!-- Template Grid -->
      <section class="section">
        <h2 class="section__label">风格模板</h2>
        <div class="template-grid">
          <button
            v-for="tpl in TEMPLATES"
            :key="tpl.id"
            class="tpl-card"
            :class="{ 'tpl-card--active': selectedTemplate === tpl.id }"
            @click="selectedTemplate = tpl.id"
          >
            <div class="tpl-card__thumb" :style="{ background: tpl.preview }">
              <div class="tpl-card__thumb-label">{{ tpl.name }}</div>
            </div>
            <div class="tpl-card__body">
              <span class="tpl-card__name">{{ tpl.name }}</span>
              <div class="tpl-card__tags">
                <span v-for="tag in tpl.bestFor" :key="tag" class="tpl-card__tag">{{ tag }}</span>
              </div>
            </div>
            <div v-if="selectedTemplate === tpl.id" class="tpl-card__badge">已选</div>
          </button>
        </div>
      </section>

      <!-- Product Image Upload -->
      <section class="section">
        <div class="section__header-row">
          <h2 class="section__label">上传商品图（1-3张，作为 img2img 参考图）</h2>
          <label class="text-only-toggle">
            <span class="text-only-toggle__label">🎨 纯文案海报</span>
            <input type="checkbox" v-model="textOnlyMode" class="text-only-toggle__input" />
          </label>
        </div>
        <div v-if="!textOnlyMode" class="upload-area">
          <div
            v-if="productImages.length < 3"
            class="upload-zone"
            :class="{ 'upload-zone--drag': isDragging }"
            role="button"
            tabindex="0"
            aria-label="拖拽或点击上传商品图片，最多 3 张"
            @dragover.prevent
            @dragenter.prevent="onDragEnter"
            @dragleave.prevent="onDragLeave"
            @drop="onDrop"
            @click="($refs.fileInput as HTMLInputElement).click()"
            @keydown.enter.prevent="($refs.fileInput as HTMLInputElement).click()"
            @keydown.space.prevent="($refs.fileInput as HTMLInputElement).click()"
          >
            <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFileInput" />
            <svg class="upload-zone__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M24 32V12m0 0l-8 8m8-8l8 8" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="4" y="4" width="40" height="40" rx="8" stroke-dasharray="4 4" opacity="0.3"/>
            </svg>
            <p class="upload-zone__text">拖放图片到此处，或 <span>点击上传</span></p>
            <p class="upload-zone__hint">支持 JPG / PNG / WebP，最多 3 张</p>
          </div>
          <div class="upload-thumbs">
            <div v-for="img in productImages" :key="img.id" class="upload-thumb">
              <img :src="img.preview" alt="商品图" class="upload-thumb__img" />
              <button class="upload-thumb__remove" @click="removeImage(img.id)">&times;</button>
            </div>
          </div>
        </div>

        <!-- ENH-9: 纯文案海报编辑区 -->
        <div v-else class="text-only-editor">
          <div class="form-field">
            <label class="form-field__label">海报标题 <em>*</em></label>
            <input v-model="textOnlyTitle" class="form-field__input" type="text" placeholder="例如：618年中大促" maxlength="40" />
          </div>
          <div class="form-field">
            <label class="form-field__label">副标题</label>
            <input v-model="textOnlySubtitle" class="form-field__input" type="text" placeholder="例如：全场五折起，错过再等一年" maxlength="60" />
          </div>
          <div class="form-field">
            <label class="form-field__label">行动号召 (CTA)</label>
            <div class="cta-select-row">
              <button
                v-for="cta in CTA_OPTIONS"
                :key="cta"
                class="cta-chip"
                :class="{ 'cta-chip--active': textOnlyCTA === cta }"
                @click="textOnlyCTA = cta"
              >{{ cta }}</button>
            </div>
          </div>
          <div class="form-field">
            <label class="form-field__label">海报风格</label>
            <div class="tpl-list-row">
              <button
                v-for="ps in POSTER_STYLES"
                :key="ps"
                class="tpl-chip"
                :class="{ 'tpl-chip--active': textOnlyPosterStyle === ps }"
                @click="textOnlyPosterStyle = ps"
              >{{ ps }}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Product Info -->
      <section class="section">
        <h2 class="section__label">商品信息</h2>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-field__label" for="product-name">商品名称 <em>*</em></label>
            <input
              id="product-name"
              v-model="productName"
              class="form-field__input"
              type="text"
              placeholder="例如：轻盈保湿面霜"
              maxlength="40"
            />
          </div>
          <div class="form-field">
            <label class="form-field__label" for="product-tagline">广告语</label>
            <input
              id="product-tagline"
              v-model="tagline"
              class="form-field__input"
              type="text"
              placeholder="例如：一抹水润，全天呵护"
              maxlength="60"
            />
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--primary btn--lg" :disabled="!canProceedStep1" @click="nextStep">
          下一步
        </button>
      </div>
    </div>

    <!-- ==================== STEP 2 ==================== -->
    <div v-if="step === 2" class="step-content">
      <header class="step-header">
        <h1 class="step-title">AI 生成广告图</h1>
        <p class="step-subtitle">Seedream 5.0 img2img 模式 &middot; 基于风格模板 "{{ currentTemplate.name }}" 生成</p>
      </header>

      <!-- CRAFT Prompt Preview -->
      <section class="section">
        <h2 class="section__label">CRAFT 提示词（自动生成）</h2>
        <div class="prompt-box">
          <pre class="prompt-box__text">{{ craftPrompt }}</pre>
        </div>
      </section>

      <!-- Generate Button -->
      <section class="section" v-if="candidates.length === 0">
        <div class="generate-area">
          <button
            class="btn btn--primary btn--xl"
            :disabled="generating"
            @click="generateCandidates"
          >
            <span v-if="generating" class="btn__spinner" />
            {{ generating ? 'AI 生成中...' : '生成广告图' }}
          </button>
          <p class="generate-hint">将生成 4 张候选方案供选择</p>
        </div>
      </section>

      <!-- Candidate Grid -->
      <section v-if="candidates.length > 0" class="section">
        <h2 class="section__label">候选方案（点击选择最佳）</h2>
        <div class="candidate-grid">
          <button
            v-for="c in candidates"
            :key="c.id"
            class="candidate-card"
            :class="{ 'candidate-card--selected': selectedCandidateId === c.id }"
            @click="selectCandidate(c.id)"
          >
            <div class="candidate-card__img" :style="c.imageUrl ? { backgroundImage: `url(${c.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: c.gradient }">
              <img
                v-if="productImages[0]"
                :src="productImages[0].preview"
                alt=""
                class="candidate-card__product"
              />
              <div class="candidate-card__overlay">
                <span class="candidate-card__label">{{ c.label }}</span>
              </div>
            </div>
            <div v-if="selectedCandidateId === c.id" class="candidate-card__check">&#10003; 已选</div>
          </button>
        </div>
        <div class="candidate-actions">
          <button class="btn btn--outline btn--sm" @click="regenerateCandidates">
            重新生成
          </button>
          <button class="btn btn--ghost btn--sm" @click="regenerateCandidates">
            换一批
          </button>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button
          class="btn btn--primary btn--lg"
          :disabled="!selectedCandidateId"
          @click="nextFromStep2"
        >
          下一步
        </button>
      </div>
    </div>

    <!-- ==================== STEP 3 ==================== -->
    <div v-if="step === 3" class="step-content">
      <header class="step-header">
        <h1 class="step-title">文案叠加 + 排版</h1>
        <p class="step-subtitle">在生成的广告图上添加文案，调整排版位置</p>
      </header>

      <div class="overlay-layout">
        <!-- Preview -->
        <div class="overlay-preview">
          <div class="overlay-preview__canvas" :style="selectedCandidate?.imageUrl ? { backgroundImage: `url(${selectedCandidate.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: selectedCandidate?.gradient ?? '#222' }">
            <img
              v-if="productImages[0]"
              :src="productImages[0].preview"
              alt=""
              class="overlay-preview__product"
            />
            <div class="overlay-preview__text" :style="positionStyle">
              <h3
                v-if="textOverlay.headline"
                class="overlay-preview__headline"
                :style="{ color: textOverlay.color }"
              >
                {{ textOverlay.headline }}
              </h3>
              <p
                v-if="textOverlay.subHeadline"
                class="overlay-preview__sub"
                :style="{ color: textOverlay.color + 'cc' }"
              >
                {{ textOverlay.subHeadline }}
              </p>
              <button
                v-if="textOverlay.cta"
                class="overlay-preview__cta"
                :style="{ color: textOverlay.color === '#FFFFFF' ? '#09090B' : '#FAFAFA' }"
              >
                {{ textOverlay.cta }}
              </button>
            </div>
          </div>
        </div>

        
        <!-- POL-6: AI文案按钮 -->
        <div class="ai-copy-bar">
          <button
            class="ai-copy-btn"
            :class="{ 'ai-copy-btn--loading': isGeneratingCopy }"
            @click="generateAICopy"
            :disabled="isGeneratingCopy"
          >
            <span v-if="isGeneratingCopy" class="ai-copy-btn__spinner" />
            <span v-else class="ai-copy-btn__icon">🤖</span>
            {{ isGeneratingCopy ? 'AI生成中...' : 'AI生成文案' }}
          </button>
          <span v-if="aiCopyTips" class="ai-copy-tips">{{ aiCopyTips }}</span>
        </div>

<!-- Controls -->
        <div class="overlay-controls">
          <div class="form-field">
            <label class="form-field__label">主标题</label>
            <input v-model="textOverlay.headline" class="form-field__input" type="text" placeholder="输入主标题" maxlength="20" />
          </div>
          <div class="form-field">
            <label class="form-field__label">副标题</label>
            <input v-model="textOverlay.subHeadline" class="form-field__input" type="text" placeholder="输入副标题" maxlength="40" />
          </div>
          <div class="form-field">
            <label class="form-field__label">CTA 按钮文案</label>
            <div class="cta-grid">
              <button
                v-for="cta in CTA_OPTIONS"
                :key="cta"
                class="cta-btn"
                :class="{ 'cta-btn--active': textOverlay.cta === cta }"
                @click="textOverlay.cta = cta"
              >
                {{ cta }}
              </button>
            </div>
          </div>

          <!-- Text position -->
          <div class="form-field">
            <label class="form-field__label">文案位置</label>
            <div class="position-grid">
              <button
                v-for="pos in TEXT_POSITIONS"
                :key="pos.id"
                class="pos-btn"
                :class="{ 'pos-btn--active': textOverlay.position === pos.id }"
                @click="textOverlay.position = pos.id"
              >
                {{ pos.name }}
              </button>
            </div>
          </div>

          <!-- Font color -->
          <div class="form-field">
            <label class="form-field__label">字体颜色（自动适配明暗底）</label>
            <div class="color-row">
              <button
                class="color-swatch"
                :class="{ 'color-swatch--active': textOverlay.color === '#FFFFFF' }"
                style="background: #FFFFFF"
                @click="textOverlay.color = '#FFFFFF'"
              >
                <span class="color-swatch__label">浅色</span>
              </button>
              <button
                class="color-swatch"
                :class="{ 'color-swatch--active': textOverlay.color === '#000000' }"
                style="background: #000000"
                @click="textOverlay.color = '#000000'"
              >
                <span class="color-swatch__label">深色</span>
              </button>
              <button
                class="color-swatch"
                :class="{ 'color-swatch--active': textOverlay.color === '#FFD700' }"
                style="background: #FFD700"
                @click="textOverlay.color = '#FFD700'"
              >
                <span class="color-swatch__label">金色</span>
              </button>
              <button
                class="color-swatch"
                :class="{ 'color-swatch--active': textOverlay.color === '#FF4444' }"
                style="background: #FF4444"
                @click="textOverlay.color = '#FF4444'"
              >
                <span class="color-swatch__label">红色</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button class="btn btn--primary btn--lg" @click="nextStep">下一步</button>
      </div>
    </div>

    <!-- ==================== STEP 4 ==================== -->
    <div v-if="step === 4" class="step-content">
      <header class="step-header">
        <h1 class="step-title">多尺寸生成</h1>
        <p class="step-subtitle">选择目标尺寸，AI 将为每个尺寸重新构图生成（非简单裁切）</p>
      </header>

      <!-- Size Selection -->
      <section class="section">
        <h2 class="section__label">选择目标尺寸</h2>
        <div class="size-list">
          <label
            v-for="sz in targetSizes"
            :key="sz.id"
            class="size-check"
            :class="{ 'size-check--active': sz.selected }"
          >
            <input type="checkbox" :checked="sz.selected" @change="toggleSize(sz.id)" />
            <div class="size-check__visual" :style="{ aspectRatio: `${sz.w}/${sz.h}`, maxHeight: '60px' }" />
            <div class="size-check__info">
              <span class="size-check__ratio">{{ sz.label }} {{ sz.name }}</span>
              <span class="size-check__dim">{{ sz.w }} x {{ sz.h }}</span>
              <span class="size-check__platform">{{ sz.platform }}</span>
            </div>
            <span v-if="sz.generated" class="size-check__done">&#10003; 已生成</span>
          </label>
        </div>
      </section>

      <!-- Generate Button -->
      <section class="section" v-if="!allSizesGenerated">
        <div class="generate-area">
          <button
            class="btn btn--primary btn--xl"
            :disabled="selectedSizes.length === 0 || multiGenerating"
            @click="generateMultiSize"
          >
            <span v-if="multiGenerating" class="btn__spinner" />
            {{ multiGenerating ? '生成中...' : `生成 ${selectedSizes.length} 个尺寸` }}
          </button>
        </div>
      </section>

      <!-- Preview per size -->
      <section v-if="allSizesGenerated" class="section">
        <h2 class="section__label">各尺寸预览</h2>
        <div class="multi-preview-grid">
          <div v-for="sz in selectedSizes" :key="sz.id" class="multi-preview-card">
            <div
              class="multi-preview-card__img"
              :style="{
                aspectRatio: `${sz.w}/${sz.h}`,
                background: (sz as any).generatedUrl
                  ? `url(${(sz as any).generatedUrl})`
                  : selectedCandidate?.imageUrl
                    ? `url(${selectedCandidate.imageUrl})`
                    : '#222',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }"
            >
              <span class="multi-preview-card__label">{{ sz.label }}</span>
              <span class="multi-preview-card__dim">{{ sz.w }}x{{ sz.h }}</span>
            </div>
            <div class="multi-preview-card__info">
              <span>{{ sz.name }} - {{ sz.platform }}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">上一步</button>
        <button
          class="btn btn--primary btn--lg"
          :disabled="!allSizesGenerated"
          @click="nextStep"
        >
          下一步
        </button>
      </div>
    </div>

    <!-- ==================== STEP 5 ==================== -->
    <div v-if="step === 5" class="step-content">
      <header class="step-header">
        <h1 class="step-title">导出</h1>
        <p class="step-subtitle">选择导出格式、质量和水印选项，下载广告图</p>
      </header>

      <!-- Export Options -->
      <section class="section">
        <h2 class="section__label">导出格式</h2>
        <div class="export-options">
          <button
            v-for="fmt in EXPORT_FORMATS"
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
        <h2 class="section__label">输出质量</h2>
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
        <h2 class="section__label">版本</h2>
        <div class="version-checks">
          <label class="version-check">
            <input type="checkbox" v-model="withWatermark" />
            <span>带品牌水印</span>
          </label>
          <label class="version-check">
            <input type="checkbox" v-model="withoutWatermark" />
            <span>无水印</span>
          </label>
        </div>
      </section>

      <!-- Summary -->
      <section class="section">
        <h2 class="section__label">导出清单</h2>
        <div class="export-summary">
          <div v-for="sz in selectedSizes" :key="sz.id" class="export-row">
            <div class="export-row__info">
              <span class="export-row__size">{{ sz.label }} {{ sz.name }}</span>
              <span class="export-row__dim">{{ sz.w }} x {{ sz.h }}</span>
              <span class="export-row__platform">{{ sz.platform }}</span>
            </div>
            <button class="btn btn--ghost btn--sm" @click="downloadSingle(sz)">单独下载</button>
          </div>
        </div>
      </section>

      <div class="step-nav">
        <button class="btn btn--outline" @click="prevStep">返回编辑</button>
        <button class="btn btn--primary btn--xl" @click="downloadAll">
          全部下载（{{ selectedSizes.length }} 个尺寸）
        </button>
      </div>
    </div>
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

/* ================================================================ */
/*  Root                                                               */
/* ================================================================ */

.ad-editor {
  min-height: 100%;
  background: var(--bg-primary, var(--bg-primary, #0E0F12));
  padding: 32px 24px 80px;
  max-width: 900px;
  margin: 0 auto;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #FAFAFA;
}

/* ================================================================ */
/*  Step indicator                                                     */
/* ================================================================ */

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
  gap: 0;
}

.step-indicator__item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
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
  transition: color 0.2s;
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

.step-indicator__item--done + .step-indicator__item .step-indicator__line,
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
/*  Template grid (Step 1)                                             */
/* ================================================================ */

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.tpl-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary, #1A1C21);
  border: 1.5px solid var(--border, #27272A);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s;
  text-align: left;
  padding: 0;
}

.tpl-card:hover {
  border-color: #3F3F46;
  background: #18181B;
}

.tpl-card--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.05) !important;
  box-shadow: 0 0 0 1px rgba(0, 212, 170, 0.25), 0 4px 24px rgba(0, 212, 170, 0.1);
}

.tpl-card__thumb {
  width: 100%;
  aspect-ratio: 16/10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tpl-card__thumb-label {
  font-size: 18px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.tpl-card__body {
  padding: 12px 14px 14px;
}

.tpl-card__name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #FAFAFA;
  margin-bottom: 6px;
}

.tpl-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tpl-card__tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #A1A1AA;
}

.tpl-card__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 8px;
  background: var(--accent, var(--accent, #00BFA5));
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
}

/* ================================================================ */
/*  Upload area                                                        */
/* ================================================================ */

.upload-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.upload-zone {
  border: 2px dashed var(--border, #27272A);
  border-radius: 14px;
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s;
  background: rgba(255, 255, 255, 0.015);
}

.upload-zone:hover,
.upload-zone--drag {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.04);
}

.upload-zone__icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted, #64748B);
  margin-bottom: 12px;
}

.upload-zone__text {
  font-size: 14px;
  color: #A1A1AA;
  margin: 0 0 4px;
}

.upload-zone__text span {
  color: var(--accent, var(--accent, #00BFA5));
  font-weight: 500;
}

.upload-zone__hint {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  margin: 0;
}

.upload-thumbs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-thumb {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border, #27272A);
  width: 120px;
  height: 120px;
}

.upload-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-thumb__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 16px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.2s;
}

.upload-thumb__remove:hover {
  background: rgba(239, 68, 68, 0.8);
}

/* ================================================================ */
/*  Form fields                                                        */
/* ================================================================ */

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 500;
  color: #A1A1AA;
}

.form-field__label em {
  color: #EF4444;
  font-style: normal;
}

.form-field__input {
  width: 100%;
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
/*  Prompt box (Step 2)                                                */
/* ================================================================ */

.prompt-box {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
  padding: 16px 18px;
}

.prompt-box__text {
  font-size: 13px;
  line-height: 1.8;
  color: #A1A1AA;
  margin: 0;
  white-space: pre-wrap;
  font-family: 'SF Mono', 'Fira Code', monospace;
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
/*  Candidate grid (Step 2)                                            */
/* ================================================================ */

.candidate-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.candidate-card {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid var(--border, #27272A);
  cursor: pointer;
  transition: all 0.25s;
  background: none;
  padding: 0;
}

.candidate-card:hover {
  border-color: #3F3F46;
}

.candidate-card--selected {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.2), 0 4px 20px rgba(0, 212, 170, 0.15);
}

.candidate-card__img {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.candidate-card__product {
  width: 50%;
  max-height: 60%;
  object-fit: contain;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.5));
  position: relative;
  z-index: 1;
}

.candidate-card__overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
}

.candidate-card__label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.candidate-card__check {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 8px;
  background: var(--accent, var(--accent, #00BFA5));
  color: var(--bg-primary, var(--bg-primary, #0E0F12));
}

.candidate-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

/* ================================================================ */
/*  Step 3: Overlay layout                                             */
/* ================================================================ */

.overlay-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}

.overlay-preview__canvas {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #27272A);
}

.overlay-preview__product {
  max-width: 45%;
  max-height: 55%;
  object-fit: contain;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5));
  position: relative;
  z-index: 1;
}

.overlay-preview__text {
  position: absolute;
  z-index: 2;
  text-align: center;
  pointer-events: none;
  max-width: 80%;
}

.overlay-preview__headline {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 4px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.overlay-preview__sub {
  font-size: 13px;
  margin: 0 0 10px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.overlay-preview__cta {
  padding: 6px 20px;
  border-radius: 20px;
  background: var(--accent, var(--accent, #00BFA5));
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: default;
}

.overlay-controls {
  display: flex;
  flex-direction: column;
}

/* CTA grid */
.cta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cta-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: #A1A1AA;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.cta-btn:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.cta-btn--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.1) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 600;
}

/* Position grid */
.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.pos-btn {
  padding: 8px;
  border-radius: 8px;
  border: 1.5px solid var(--border, #27272A);
  background: var(--bg-secondary, #1A1C21);
  color: var(--text-muted, #64748B);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.pos-btn:hover {
  border-color: #3F3F46;
  color: #D4D4D8;
}

.pos-btn--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  background: rgba(0, 212, 170, 0.1) !important;
  color: var(--accent, var(--accent, #00BFA5)) !important;
  font-weight: 600;
}

/* Color swatches */
.color-row {
  display: flex;
  gap: 10px;
}

.color-swatch {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 2px solid var(--border, #27272A);
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
  transition: all 0.2s;
  position: relative;
}

.color-swatch:hover {
  border-color: #3F3F46;
}

.color-swatch--active {
  border-color: var(--accent, var(--accent, #00BFA5)) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.3);
}

.color-swatch__label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* ================================================================ */
/*  Step 4: Size selection                                             */
/* ================================================================ */

.size-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.size-check {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: var(--bg-secondary, #1A1C21);
  border: 1.5px solid var(--border, #27272A);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.size-check:hover {
  border-color: #3F3F46;
}

.size-check--active {
  border-color: var(--accent, var(--accent, #00BFA5));
  background: rgba(0, 212, 170, 0.04);
}

.size-check input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent, var(--accent, #00BFA5));
  flex-shrink: 0;
}

.size-check__visual {
  width: 40px;
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(99, 102, 241, 0.2));
  border-radius: 4px;
  flex-shrink: 0;
  min-height: 20px;
}

.size-check__info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.size-check__ratio {
  font-size: 14px;
  font-weight: 700;
  color: #FAFAFA;
  min-width: 80px;
}

.size-check__dim {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  min-width: 90px;
}

.size-check__platform {
  font-size: 12px;
  color: var(--text-muted, #64748B);
}

.size-check__done {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, var(--accent, #00BFA5));
  flex-shrink: 0;
}

/* Multi-preview grid */
.multi-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.multi-preview-card {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 12px;
  overflow: hidden;
}

.multi-preview-card__img {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 80px;
}

.multi-preview-card__label {
  font-size: 20px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.3);
}

.multi-preview-card__dim {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
}

.multi-preview-card__info {
  padding: 10px 14px;
  font-size: 12px;
  color: #A1A1AA;
}

/* ================================================================ */
/*  Step 5: Export                                                     */
/* ================================================================ */

.export-options {
  display: flex;
  gap: 10px;
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

.version-checks {
  display: flex;
  gap: 24px;
}

.version-check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #D4D4D8;
}

.version-check input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent, var(--accent, #00BFA5));
}

.export-summary {
  background: var(--bg-secondary, #1A1C21);
  border: 1px solid var(--border, #27272A);
  border-radius: 14px;
  overflow: hidden;
}

.export-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #1C1C1E;
}

.export-row:last-child {
  border-bottom: none;
}

.export-row__info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.export-row__size {
  font-size: 14px;
  font-weight: 700;
  color: #FAFAFA;
  min-width: 80px;
}

.export-row__dim {
  font-size: 12px;
  color: var(--text-muted, #64748B);
  min-width: 90px;
}

.export-row__platform {
  font-size: 12px;
  color: var(--text-muted, #64748B);
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
  .template-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .candidate-grid {
    grid-template-columns: 1fr;
  }
  .overlay-layout {
    grid-template-columns: 1fr;
  }
  .step-indicator__label {
    display: none;
  }
  .step-indicator__line {
    width: 20px;
  }
}

/* ===== ENH-9: 纯文案海报模式 ===== */
.section__header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-only-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 6px 14px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 20px;
  transition: all 200ms ease;
}

.text-only-toggle:hover {
  border-color: var(--accent, #6366f1);
}

.text-only-toggle__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, var(--text-secondary, var(--text-secondary, #9CA3AF)));
}

.text-only-toggle__input {
  width: 32px;
  height: 18px;
  appearance: none;
  background: var(--bg-tertiary, #23262e);
  border-radius: 9px;
  position: relative;
  cursor: pointer;
  transition: background 200ms ease;
}

.text-only-toggle__input::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform 200ms ease;
}

.text-only-toggle__input:checked {
  background: var(--accent, #6366f1);
}

.text-only-toggle__input:checked::after {
  transform: translateX(14px);
}

.text-only-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary, #1a1c21);
  border: 1px solid var(--border, #2a2d35);
  border-radius: 10px;
}

.cta-select-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cta-chip {
  padding: 5px 14px;
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

.cta-chip:hover {
  border-color: var(--accent, #6366f1);
  color: var(--text-primary, #f1f5f9);
}

.cta-chip--active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

.tpl-list-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tpl-chip {
  padding: 5px 14px;
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

.tpl-chip:hover {
  border-color: var(--accent, #6366f1);
  color: var(--text-primary, #f1f5f9);
}

.tpl-chip--active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--accent, #6366f1);
  color: var(--accent, #6366f1);
}

/* ===== ENH-18: 变体预览对比 ===== */
.ae-variant-panel {
  margin: 12px 0; padding: 12px;
  background: var(--bg-surface, var(--bg-primary, #0E0F12));
  border: 1px solid var(--border-default, var(--border, #2E3139));
  border-radius: 10px;
}
.ae-variant-panel__header {
  display: flex; align-items: center; justify-content: space-between;
}
.ae-variant-panel__title { font-size: 14px; font-weight: 600; margin: 0; }
.ae-variant-panel__toggle {
  font-size: 12px; color: var(--accent, var(--accent, #00BFA5)); background: none; border: none;
  cursor: pointer; font-family: inherit;
}
.ae-variant-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin-top: 10px;
}
.ae-variant-card {
  background: var(--bg-elevated, #23262E);
  border: 1px solid var(--border-subtle, #1E1E22);
  border-radius: 8px; overflow: hidden;
}
.ae-variant-card__preview {
  background: var(--bg-muted, var(--border, #2E3139));
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ae-variant-card__img { width: 100%; height: 100%; object-fit: cover; }
.ae-variant-card__info {
  padding: 6px 10px; display: flex; justify-content: space-between;
  font-size: 11px; color: var(--text-secondary, var(--text-secondary, #9CA3AF));
}
.ae-variant-card__format {
  padding: 1px 5px; background: var(--accent-muted, rgba(0,191,165,0.12));
  color: var(--accent, var(--accent, #00BFA5)); border-radius: 3px; font-weight: 600;
}

/* ===== ENH-19: 品牌Kit ===== */
.ae-brand-kit-panel {
  margin: 12px 0; padding: 12px;
  background: var(--bg-surface, var(--bg-primary, #0E0F12));
  border: 1px solid var(--border-default, var(--border, #2E3139));
  border-radius: 10px;
}
.ae-brand-kit-panel__header {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
}
.ae-brand-kit-panel__title { font-size: 14px; font-weight: 600; margin: 0; }
.ae-brand-kit-panel__count { font-size: 11px; color: var(--accent, var(--accent, #00BFA5)); }
.ae-brand-kit-panel__toggle { font-size: 12px; color: var(--text-muted, var(--text-muted, #64748B)); margin-left: auto; }
.ae-brand-kit-body { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
.ae-brand-kit-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ae-brand-kit-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--bg-elevated, #23262E);
  border: 1px solid var(--border-subtle, #1E1E22);
  border-radius: 8px; cursor: pointer;
  transition: border-color 150ms ease;
}
.ae-brand-kit-item:hover { border-color: var(--accent, var(--accent, #00BFA5)); }
.ae-brand-kit-item__colors { display: flex; gap: 3px; }
.ae-brand-kit-item__swatch { width: 14px; height: 14px; border-radius: 3px; }
.ae-brand-kit-item__name { font-size: 13px; font-weight: 500; }
.ae-brand-kit-item__delete {
  width: 20px; height: 20px; border: none; background: rgba(239,68,68,0.15);
  color: #EF4444; font-size: 14px; font-weight: 700; border-radius: 4px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.ae-brand-kit-form { display: flex; flex-direction: column; gap: 8px; }
.ae-brand-kit-form__row { display: flex; gap: 10px; }
.ae-brand-kit-form__color, .ae-brand-kit-form__font { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.ae-brand-kit-form__label { font-size: 10px; font-weight: 600; color: var(--text-muted, var(--text-muted, #64748B)); text-transform: uppercase; }
.ae-brand-kit-form__picker { width: 100%; height: 28px; border: none; border-radius: 4px; cursor: pointer; }
.ae-brand-kit-form__save {
  padding: 8px 16px; border: none; border-radius: 8px;
  background: var(--accent, var(--accent, #00BFA5)); color: var(--bg-primary, var(--bg-primary, #0E0F12));
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.ae-brand-kit-form__save:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 768px) {
  .ae-variant-grid { grid-template-columns: repeat(2, 1fr); }
}


/* ===== POL-6: AI文案按钮 ===== */
.ai-copy-bar {
  display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
}
.ai-copy-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: 1px solid var(--accent, var(--accent, #00BFA5));
  border-radius: 20px; background: rgba(0, 191, 165, 0.08);
  color: var(--accent, var(--accent, #00BFA5)); font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all 200ms ease;
}
.ai-copy-btn:hover { background: rgba(0, 191, 165, 0.15); transform: translateY(-1px); }
.ai-copy-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.ai-copy-btn__icon { font-size: 15px; }
.ai-copy-btn__spinner {
  width: 14px; height: 14px; border: 2px solid var(--accent);
  border-top-color: transparent; border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }
.ai-copy-tips {
  font-size: 12px; color: var(--accent, var(--accent, #00BFA5)); font-weight: 500;
  animation: ai-fade-in 300ms ease;
}
@keyframes ai-fade-in { from { opacity: 0; transform: translateX(-8px); } }

/* ===== Toast notification ===== */
.ad-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 28px;
  background: linear-gradient(135deg, var(--accent, #00BFA5), #7C3AED);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 212, 170, 0.3);
  z-index: 9999;
  pointer-events: none;
  white-space: nowrap;
}

.toast-fade-enter-active {
  transition: all 0.3s ease;
}
.toast-fade-leave-active {
  transition: all 0.4s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

</style>
