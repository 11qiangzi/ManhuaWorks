<script setup lang="ts">
/**
 * ProjectEditorView · 项目编辑器
 * ManhuaWorks · W2
 *
 * 流程：
 * 1. 上传小说文本（拖拽 / 选择文件 / 粘贴）
 * 2. 选择艺术风格
 * 3. 选择供应商 / 模型
 * 4. 点击"开始生成" → 跳进度页
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import CostEstimator from '@/components/studio/CostEstimator.vue'
import ProviderCard from '@/components/studio/ProviderCard.vue'
import { PROVIDERS, MODELS, type Provider, type CallType, estimateTokens } from '@/api/ai-router'
import { listKeys, type ByokKey } from '@/api/byok'
import { getToken } from '@/utils/auth'

const toast = useToast()

const route = useRoute()
const router = useRouter()

interface Project {
  id: string
  title: string
  description?: string | null
  art_style?: string | null
  story_type?: string | null
  status: number
  created_at: string
}

const projectId = computed(() => route.params.id as string)

const project = ref<Project | null>(null)
const loading = ref(true)

const novelText = ref('')
const fileName = ref('')
const isDragging = ref(false)

const callType = ref<CallType>('text')
const selectedProvider = ref<Provider | undefined>(route.query.provider as Provider | undefined)
const selectedModel = ref<string | undefined>(route.query.model as string | undefined)
const artStyle = ref('')
const storyType = ref('')
const keys = ref<ByokKey[]>([])

/** 文件输入 */
const fileInput = ref<HTMLInputElement | null>(null)

/** 字符/token 数 */
const charCount = computed(() => novelText.value.length)
const tokenCount = computed(() => estimateTokens(novelText.value))

/** 过滤后的模型 */
const filteredModels = computed(() => {
  return MODELS.filter(
    (m) => m.provider === selectedProvider.value && m.capabilities.includes(callType.value)
  )
})

/** 该 provider 是否有可用 key */
const providerHasKey = computed(() => {
  if (!selectedProvider.value) return false
  return keys.value.some(
    (k) => k.provider === selectedProvider.value && k.status === 'valid'
  )
})

/** 表单是否完整 */
const canGenerate = computed(() => {
  return !!novelText.value.trim() && !!selectedProvider.value && !!selectedModel.value && providerHasKey.value
})

/** 加载项目 */
async function loadProject() {
  loading.value = true
  try {
    const token = getToken()
    if (!token) {
      // 未登录：用占位
      project.value = MOCK_PROJECT(projectId.value)
      return
    }
    const res = await fetch(`/v1/projects/${projectId.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const body = await res.json() as { data?: Project }
      project.value = body.data ?? MOCK_PROJECT(projectId.value)
      artStyle.value = body.data?.art_style ?? ''
      storyType.value = body.data?.story_type ?? ''
    } else {
      project.value = MOCK_PROJECT(projectId.value)
    }
  } catch {
    project.value = MOCK_PROJECT(projectId.value)
  } finally {
    loading.value = false
  }
}

function MOCK_PROJECT(id: string): Project {
  return {
    id,
    title: '《灰星》第 4 章',
    description: '林启在废墟深处发现文明遗迹',
    art_style: '3D_guofeng_cyber',
    story_type: 'Scifi_post_apocalypse',
    status: 0,
    created_at: new Date().toISOString().slice(0, 10)
  }
}

/** 文件处理 */
function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) readFile(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) readFile(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function readFile(file: File) {
  // 限制 5MB
  if (file.size > 5 * 1024 * 1024) {
    toast.error('文件过大（> 5MB），请分章节上传')
    return
  }
  // 仅文本类
  if (!/text|markdown|json/.test(file.type) && !/\.(txt|md|json)$/i.test(file.name)) {
    toast.error('请上传 .txt / .md / .json 文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    novelText.value = String(reader.result ?? '')
    fileName.value = file.name
  }
  reader.readAsText(file, 'utf-8')
}

/** 粘贴文本 */
function useSampleText() {
  novelText.value = SAMPLE_NOVEL
  fileName.value = 'sample.txt'
}

function clearText() {
  novelText.value = ''
  fileName.value = ''
}

/** 切换供应商/类型时，重置 model */
watch([selectedProvider, callType], () => {
  if (selectedProvider.value && !filteredModels.value.find((m) => m.id === selectedModel.value)) {
    selectedModel.value = filteredModels.value[0]?.id
  }
})

/** 启动生成（占位：先跳到进度页） */
function onGenerate() {
  if (!canGenerate.value || !project.value) return
  // 把任务数据塞 sessionStorage，进度页读
  try {
    sessionStorage.setItem('pending-job', JSON.stringify({
      projectId: project.value.id,
      projectTitle: project.value.title,
      callType: callType.value,
      provider: selectedProvider.value,
      model: selectedModel.value,
      artStyle: artStyle.value,
      storyType: storyType.value,
      prompt: novelText.value,
      fileName: fileName.value,
      tokenCount: tokenCount.value
    }))
  } catch { /* noop */ }
  router.push({ name: 'generation-progress' })
}

const SAMPLE_NOVEL = `林启在废墟深处站了很久。

阳光从崩塌的天花板斜斜照下来，落在半截金属立柱上，氧化层反射出暗淡的紫。

他没说话。

手腕上的智脑轻轻震动了一下——这已经是第 47 次提醒了。他知道"上面"在等他的回复，知道 12 个小时后会有第 48 次、第 49 次，知道如果不回，会有人来。

但他没动。

三米外的裂缝里露出一个他见过无数次、却从未真正看清的东西：一个被岁月磨损的符号，嵌在合金表面，泛着银色的光。

那不是地球的工艺。`

onMounted(async () => {
  await loadProject()
  // 默认模型
  if (!selectedProvider.value) {
    const firstWithKey = keys.value.find((k) => k.status === 'valid')
    if (firstWithKey) {
      selectedProvider.value = firstWithKey.provider
    } else {
      selectedProvider.value = PROVIDERS[0]?.id
    }
  }
  // 拉 BYOK 列表
  try {
    const token = getToken()
    if (token) {
      keys.value = await listKeys()
      // 重新应用
      if (selectedProvider.value && !keys.value.some((k) => k.provider === selectedProvider.value && k.status === 'valid')) {
        const first = keys.value.find((k) => k.status === 'valid')
        selectedProvider.value = first?.provider
      }
    }
  } catch {
    keys.value = []
  }
  // 默认 model
  if (!selectedModel.value && selectedProvider.value) {
    selectedModel.value = filteredModels.value[0]?.id
  }
})

const ART_STYLES = [
  { v: '2D_chinese_guofeng', label: '2D 国风' },
  { v: '2D_90s_japanese_anime', label: '2D 日式 90s' },
  { v: '2D_flat_design', label: '2D 扁平' },
  { v: '3D_anime_render', label: '3D 日式渲染' },
  { v: '3D_chinese_traditional', label: '3D 国风传统' },
  { v: '3D_guofeng_cyber', label: '3D 国风赛博' },
  { v: 'realpeople_ancient_chinese', label: '真人·古风' },
  { v: 'realpeople_urban_modern', label: '真人·现代' }
]

const STORY_TYPES = [
  { v: 'Xianxia_fantasy', label: '仙侠玄幻' },
  { v: 'Scifi_post_apocalypse', label: '科幻末世' },
  { v: 'Historical_epic', label: '历史正剧' },
  { v: 'Sweet_romance_novel', label: '甜宠言情' },
  { v: 'Hot_blooded_action', label: '热血动作' },
  { v: 'Mystery_thriller', label: '悬疑推理' }
]
</script>

<template>
  <main class="project-editor">
    <!-- 顶栏 -->
    <header class="pe__nav">
      <div class="pe__brand">
        <button class="pe__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="pe__logo">M</span>
        <span class="pe__brand-name">项目编辑器</span>
      </div>
      <div class="pe__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div v-if="loading" class="pe__loading">
      <div class="pe__spinner" />
      <span>加载项目中...</span>
    </div>

    <div v-else class="pe__content">
      <!-- 标题 + 状态 -->
      <header class="pe__header">
        <div>
          <h1>{{ project?.title ?? '未命名项目' }}</h1>
          <p v-if="project?.description" class="pe__desc">{{ project.description }}</p>
        </div>
        <span class="pe__status" :class="`pe__status--${project?.status}`">
          {{ project?.status === 0 ? '草稿' : project?.status === 1 ? '生成中' : project?.status === 2 ? '完成' : '失败' }}
        </span>
      </header>

      <div class="pe__layout">
        <!-- 左：步骤 1-3 -->
        <div class="pe__main">
          <!-- 步骤 1：上传小说 -->
          <section class="pe__step">
            <header class="pe__step-head">
              <span class="pe__step-num">1</span>
              <div>
                <h2>上传小说 / 提示词</h2>
                <p>支持 .txt / .md / .json · 最大 5MB</p>
              </div>
            </header>

            <div
              class="pe__drop"
              :class="{ 'pe__drop--on': isDragging, 'pe__drop--has': novelText }"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
              @drop="onDrop"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".txt,.md,.json,text/*"
                style="display:none"
                @change="onFileSelected"
              />
              <div v-if="!novelText" class="pe__drop-empty">
                <p class="pe__drop-icon">📄</p>
                <p>拖拽文件到此处，或<button type="button" class="pe__link" @click="fileInput?.click()">选择文件</button></p>
                <p class="pe__drop-sub">支持 TXT / Markdown / JSON · 5MB 以内</p>
                <button type="button" class="qh-btn" @click="useSampleText">使用示例文本</button>
              </div>
              <div v-else class="pe__drop-fill">
                <div class="pe__drop-fill-head">
                  <span>📄 {{ fileName || '粘贴文本' }}</span>
                  <button type="button" class="pe__clear" @click="clearText">清空</button>
                </div>
                <textarea
                  v-model="novelText"
                  rows="12"
                  class="pe__textarea"
                  placeholder="可在此编辑..."
                />
                <div class="pe__drop-stats">
                  <span>字符 {{ charCount.toLocaleString() }}</span>
                  <span>·</span>
                  <span>估算 token {{ tokenCount.toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- 步骤 2：选风格 + 故事类型 -->
          <section class="pe__step">
            <header class="pe__step-head">
              <span class="pe__step-num">2</span>
              <div>
                <h2>选择艺术风格</h2>
                <p>画风与题材</p>
              </div>
            </header>
            <div class="pe__form-row">
              <label class="pe__field">
                <span>画风</span>
                <select v-model="artStyle" class="pe__input">
                  <option value="">不指定（自动）</option>
                  <option v-for="s in ART_STYLES" :key="s.v" :value="s.v">{{ s.label }}</option>
                </select>
              </label>
              <label class="pe__field">
                <span>题材</span>
                <select v-model="storyType" class="pe__input">
                  <option value="">不指定</option>
                  <option v-for="s in STORY_TYPES" :key="s.v" :value="s.v">{{ s.label }}</option>
                </select>
              </label>
            </div>
          </section>

          <!-- 步骤 3：选供应商 + 模型 -->
          <section class="pe__step">
            <header class="pe__step-head">
              <span class="pe__step-num">3</span>
              <div>
                <h2>选择供应商与模型</h2>
                <p>未配置 Key 的供应商不可用</p>
              </div>
            </header>

            <div class="pe__call-type">
              <span>调用类型</span>
              <div class="pe__type-chips">
                <button
                  v-for="t in [['text', '文字'], ['image', '图片'], ['video', '视频']] as const"
                  :key="t[0]"
                  type="button"
                  class="pe__type-chip"
                  :class="{ 'pe__type-chip--on': callType === t[0] }"
                  @click="callType = t[0]"
                >
                  {{ t[1] }}
                </button>
              </div>
            </div>

            <div class="pe__provider-grid">
              <ProviderCard
                v-for="p in PROVIDERS"
                :key="p.id"
                :provider="p"
                :selected="selectedProvider === p.id"
                :disabled="!keys.some((k) => k.provider === p.id && k.status === 'valid')"
                compact
                @select="(id: Provider) => (selectedProvider = id)"
              />
            </div>

            <div v-if="filteredModels.length > 0" class="pe__model-pick">
              <span>模型</span>
              <div class="pe__model-list">
                <button
                  v-for="m in filteredModels"
                  :key="m.id"
                  type="button"
                  class="pe__model-chip"
                  :class="{ 'pe__model-chip--on': selectedModel === m.id }"
                  @click="selectedModel = m.id"
                >
                  <strong>{{ m.name }}</strong>
                  <small>{{ m.description }}</small>
                </button>
              </div>
            </div>

            <p v-if="!providerHasKey && selectedProvider" class="pe__hint">
              ⚠ 该供应商未配置有效 API Key
              <button type="button" @click="router.push('/studio/byok')">去配置 →</button>
            </p>
          </section>
        </div>

        <!-- 右：摘要 + 成本 + 启动 -->
        <aside class="pe__side">
          <div class="pe__summary">
            <h3>📋 项目摘要</h3>
            <ul>
              <li><span>标题</span><strong>{{ project?.title }}</strong></li>
              <li><span>画风</span><strong>{{ artStyle || '自动' }}</strong></li>
              <li><span>题材</span><strong>{{ storyType || '未指定' }}</strong></li>
              <li><span>供应商</span><strong>{{ PROVIDERS.find(p => p.id === selectedProvider)?.name ?? '未选' }}</strong></li>
              <li><span>模型</span><strong>{{ MODELS.find(m => m.id === selectedModel)?.name ?? '未选' }}</strong></li>
              <li><span>文本长度</span><strong>{{ tokenCount.toLocaleString() }} tokens</strong></li>
            </ul>
          </div>

          <CostEstimator
            v-if="selectedProvider && selectedModel"
            :default-provider="selectedProvider"
            :default-model="selectedModel"
            :default-call-type="callType"
            :show-text-input="false"
          />

          <button
            type="button"
            class="pe__generate"
            :disabled="!canGenerate"
            @click="onGenerate"
          >
            🚀 开始生成
          </button>

          <p v-if="!canGenerate" class="pe__generate-hint">
            <span v-if="!novelText.trim()">请先上传小说文本</span>
            <span v-else-if="!selectedProvider">请选择供应商</span>
            <span v-else-if="!selectedModel">请选择模型</span>
            <span v-else-if="!providerHasKey">请先配置 API Key</span>
          </p>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.project-editor {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.pe__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.pe__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.pe__back {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
}

.pe__back:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.pe__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gradient);
  color: white;
  font-size: 14px;
  font-weight: 800;
}

.pe__brand-name {
  font-size: 15px;
  font-weight: 600;
}

.pe__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--text-secondary);
}

.pe__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pe__content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 28px 60px;
}

.pe__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.pe__header h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.pe__desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.pe__status {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.pe__status--0 { background: var(--bg-secondary); color: var(--text-secondary); }
.pe__status--1 { background: var(--warning); color: var(--bg-primary); }
.pe__status--2 { background: var(--success); color: var(--bg-primary); }
.pe__status--3 { background: var(--danger); color: var(--bg-primary); }

.pe__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: flex-start;
}

@media (max-width: 960px) {
  .pe__layout { grid-template-columns: 1fr; }
}

.pe__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pe__step {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.pe__step-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.pe__step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.pe__step-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.pe__step-head p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 拖拽区 */
.pe__drop {
  position: relative;
  border: 2px dashed var(--border-strong);
  border-radius: 10px;
  background: var(--bg-primary);
  padding: 14px;
  transition: all 200ms;
}

.pe__drop--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-primary));
}

.pe__drop--has {
  border-style: solid;
  border-color: var(--border);
}

.pe__drop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.pe__drop-icon {
  font-size: 36px;
  margin: 0;
}

.pe__drop-empty p {
  margin: 0;
  font-size: 13px;
}

.pe__drop-sub {
  font-size: 11px;
  opacity: 0.7;
}

.pe__link {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}

.pe__drop-fill {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pe__drop-fill-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.pe__clear {
  background: transparent;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.pe__clear:hover {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.pe__textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  min-height: 200px;
  box-sizing: border-box;
}

.pe__textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.pe__drop-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

/* 表单行 */
.pe__form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pe__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pe__field > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.pe__input {
  padding: 9px 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}

.pe__input:focus {
  outline: none;
  border-color: var(--accent);
}

/* 调用类型 */
.pe__call-type {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pe__call-type > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.pe__type-chips {
  display: flex;
  gap: 6px;
}

.pe__type-chip {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 200ms;
}

.pe__type-chip--on {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.pe__provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.pe__model-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pe__model-pick > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.pe__model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pe__model-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.pe__model-chip:hover { border-color: var(--accent); }

.pe__model-chip--on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-primary));
}

.pe__model-chip strong {
  font-size: 13px;
  font-weight: 600;
}

.pe__model-chip small {
  font-size: 11px;
  color: var(--text-secondary);
}

.pe__hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--warning);
}

.pe__hint button {
  border: none;
  background: transparent;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

/* 侧边栏 */
.pe__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 76px;
}

.pe__summary {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}

.pe__summary h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.pe__summary ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pe__summary li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  gap: 8px;
}

.pe__summary li span {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.pe__summary li strong {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.pe__generate {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: var(--gradient);
  color: white;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
  box-shadow: var(--shadow);
}

.pe__generate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow), var(--glow);
}

.pe__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

.pe__generate-hint {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.qh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
}

.qh-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 720px) {
  .pe__nav { padding: 12px 16px; }
  .pe__content { padding: 20px 16px 40px; }
  .pe__header h1 { font-size: 20px; }
  .pe__form-row { grid-template-columns: 1fr; }
  .pe__step { padding: 16px; }
}
</style>
