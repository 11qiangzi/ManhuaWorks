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

const route = useRoute()
const router = useRouter()

// ============ Types ============
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
  type: 'characters' | 'scenes' | 'props' | 'voices'
  images: MaterialImage[]     // 多张图片 (主视觉图 + 设定图)
  tags: string[]
  description: string
  projectId: string           // 🆕 所属作品
  createdAt: number
  updatedAt: number
}

// 🆕 作品/项目
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

// ============ Tabs ============
type MaterialTab = 'characters' | 'scenes' | 'props' | 'voices'
const activeTab = ref<MaterialTab>( (route.query.tab as MaterialTab) || 'characters' )

const tabs: { id: MaterialTab; label: string; icon: string; addLabel: string }[] = [
  { id: 'characters', label: '角色', icon: '👤', addLabel: '新角色' },
  { id: 'scenes', label: '场景', icon: '🎬', addLabel: '新场景' },
  { id: 'props', label: '道具', icon: '🗡️', addLabel: '新道具' },
  { id: 'voices', label: '音色', icon: '🎙️', addLabel: '新音色' },
]

watch(activeTab, tab => { router.replace({ query: { tab } }) })

// ============ 素材数据 ============
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

onMounted(() => { seedItems(); const t = route.query.tab as MaterialTab|undefined; if (t) activeTab.value = t })

// ============ 筛选 ============
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

// ============ 新建素材 模态框 ============
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

  // 模拟 AI 生成三张图 (实际调 API 三次)
  await new Promise(r => setTimeout(r, 800))
  generatedPreviews.value = [
    { id: 'prev_1', url: null, seed: Math.floor(Math.random() * 1000000) },
  ]
  await new Promise(r => setTimeout(r, 600))
  generatedPreviews.value = [
    ...generatedPreviews.value,
    { id: 'prev_2', url: null, seed: Math.floor(Math.random() * 1000000) },
  ]
  await new Promise(r => setTimeout(r, 600))
  generatedPreviews.value = [
    ...generatedPreviews.value,
    { id: 'prev_3', url: null, seed: Math.floor(Math.random() * 1000000) },
  ]
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

// ============ 选中 & 详情 ============
const selectedId = ref<string | null>(null)
const selectedItem = computed(() => items.value.find(i => i.id === selectedId.value) ?? null)

function selectItem(id: string) { selectedId.value = id }

// ============ 图片操作 ============
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
  await new Promise(r => setTimeout(r, 1500))
  imageGenerating.value = false
  // TODO: 接入真 AI API
  const item = items.value.find(i => i.id === selectedId.value)
  if (item) {
    item.images[editImageIndex.value].prompt = editImageForm.value.prompt
    item.images[editImageIndex.value].negativePrompt = editImageForm.value.negativePrompt
    item.images[editImageIndex.value].style = editImageForm.value.style
    item.images[editImageIndex.value].status = 'idle'
    item.updatedAt = Date.now()
  }
  showImageModal.value = false
}

function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const item = items.value.find(i => i.id === selectedId.value)
    if (item) {
      item.images[editImageIndex.value].url = reader.result as string
      item.images[editImageIndex.value].status = 'ready'
      item.updatedAt = Date.now()
      showImageModal.value = false
    }
  }
  reader.readAsDataURL(file)
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

// ============ 样式常量 ============
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
        <button class="ml-btn ml-btn--primary" @click="openCreateModal">+ 新建</button>
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
        <span class="ml-tab-count"> ({{ tab.id === 'characters' ? projectStats.characters : tab.id === 'scenes' ? projectStats.scenes : tab.id === 'props' ? projectStats.props : projectStats.voices }})</span>
      </button>
    </nav>

    <!-- ===== Tags 筛选 ===== -->
    <div v-if="allTags.length > 0" class="ml-tags-bar">
      <button class="ml-tag-chip" :class="{ 'ml-tag-chip--active': !activeTag }" @click="activeTag = null">全部</button>
      <button v-for="t in allTags" :key="t" class="ml-tag-chip" :class="{ 'ml-tag-chip--active': activeTag === t }" @click="activeTag = activeTag === t ? null : t">{{ t }}</button>
    </div>

    <!-- ===== Body ===== -->
    <div class="ml-body">
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
            <!-- 🆕 图片预览区 -->
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
            <span class="ml-field-label">Prompt</span>
            <p class="ml-field-text ml-field-mono">{{ selectedItem.images[0]?.prompt || '未设置' }}</p>
          </label>
        </div>
      </div>

      <div v-else class="ml-detail-empty">
        <span>👈 选择素材查看详情</span>
      </div>
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
                  <span class="ml-field-label">提示词 (Prompt) *</span>
                  <textarea v-model="createForm.prompt" class="ml-input ml-textarea" rows="4" placeholder="描述你想要的画面…&#10;例：少年剑修，白衣黑发，眼神坚定，仙侠风格"></textarea>
                </label>
                <label class="ml-field">
                  <span class="ml-field-label">反向提示词 (Negative)</span>
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
</style>
