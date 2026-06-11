<script setup lang="ts">
/**
 * SceneView.vue — 场景管理主视图 (L3.B 林染: 真 API 接入)
 *
 * L2: 12 类场景模板 × 卡片 (3D 灯光/子场景编辑)
 * L3.B: 接真 API (apiClient.projects.listTags),加 Pinia store,加 loading/error
 *
 * 数据流:
 *   1. onMounted → useSceneStore().load(projectId, mockFallback)
 *   2. API 成功 → store.scenes = API 数据
 *   3. API 失败/超时 → 自动回退 mock,顶部黄条提示
 *   4. 顶部"新场景"按钮 → 用 prompt 收集名+类型(简化版)
 *   5. 删除走真 API (软失败,降级本地)
 */
import { ref, computed, onMounted, watch } from 'vue'
import { makeMockScenes } from '../data/studio-mock'
import { SCENE_TEMPLATES_V2, getSceneTemplateMeta } from '../data/scene-templates-v2'
import { STUDIO_THEMES, type StudioThemeId } from '../types/studio'
import type { SceneV2, SceneTemplate, SceneSubScene } from '../types/scene'
import { useSceneStore, SCENE_TYPE_META, type SceneType } from '../stores/sceneStore'
import ScenePicker from '../components/scene/ScenePicker.vue'
import SceneCard from '../components/scene/SceneCard.vue'
import SceneForm from '../components/scene/SceneForm.vue'

// ---------- 默认 project (L3.B 暂未接入项目选择) ----------
const DEFAULT_PROJECT_ID = 'proj_default_001'

// ---------- store ----------
const store = useSceneStore()

// ---------- 本地状态 (12 模板视图,保持 L2 功能) ----------
const localScenes = ref<SceneV2[]>(makeMockScenes())
const activeTemplate = ref<SceneTemplate | null>(null)
const selectedId = ref<string | null>(localScenes.value[0]?.id ?? null)
const activeSubSceneId = ref<string | null>(null)
const searchQuery = ref('')
const sceneTypeFilter = ref<SceneType | 'all'>('all')

// 主题
const themeId = ref<StudioThemeId>(
  (localStorage.getItem('studio_theme') as StudioThemeId) ?? 'dark-workshop',
)
function applyTheme() {
  document.documentElement.setAttribute('data-theme', themeId.value)
}
watch(themeId, t => {
  localStorage.setItem('studio_theme', t)
  applyTheme()
}, { immediate: true })

// ---------- 初始化 ----------
onMounted(async () => {
  applyTheme()
  // 拉真 API;失败回退 8 个本地场景(覆盖 8 种类型)
  const mockTags = (() => {
    const now = '0'
    return [
      { id: 'tag_001', name: '🏠 室内客厅',   color: 'amber',  count: 3 },
      { id: 'tag_002', name: '🌳 室外林地',   color: 'green',  count: 5 },
      { id: 'tag_003', name: '⚔️ 战斗擂场',   color: 'red',    count: 2 },
      { id: 'tag_004', name: '🎓 校园教室',   color: 'cyan',   count: 4 },
      { id: 'tag_005', name: '🏙️ 都市街道',   color: 'blue',   count: 6 },
      { id: 'tag_006', name: '🏯 古代宫殿',   color: 'yellow', count: 2 },
      { id: 'tag_007', name: '🚀 未来赛博城', color: 'purple', count: 3 },
      { id: 'tag_008', name: '✨ 幻想幻境',   color: 'pink',   count: 4 },
    ]
  })()
  await store.load(DEFAULT_PROJECT_ID, mockTags)
})

// ---------- 派生 (API 场景视图) ----------
const filteredApiScenes = computed(() => {
  let list = store.scenes
  if (sceneTypeFilter.value !== 'all') {
    const keywords = SCENE_TYPE_META[sceneTypeFilter.value].keywords
    list = list.filter(s => keywords.some(kw => s.name.toLowerCase().includes(kw)))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.color.toLowerCase().includes(q),
    )
  }
  return list
})

// ---------- 派生 (12 模板视图,原 L2) ----------
const countMap = computed(() => {
  const m: Record<string, number> = {}
  for (const s of localScenes.value) m[s.template] = (m[s.template] ?? 0) + 1
  return m as Record<SceneTemplate, number>
})

const filteredScenes = computed(() => {
  let list = localScenes.value
  if (activeTemplate.value) {
    list = list.filter(s => s.template === activeTemplate.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)),
    )
  }
  return list
})

const selected = computed<SceneV2 | null>(
  () => localScenes.value.find(s => s.id === selectedId.value) ?? null,
)

const selectedMeta = computed(() =>
  selected.value ? getSceneTemplateMeta(selected.value.template) : null,
)

const groupedByTemplate = computed(() => {
  const groups: Record<string, SceneV2[]> = {}
  for (const s of filteredScenes.value) {
    if (!groups[s.template]) groups[s.template] = []
    groups[s.template]!.push(s)
  }
  return groups
})

// ---------- 12 模板操作 (原 L2) ----------
function onPickTemplate(id: SceneTemplate) {
  activeTemplate.value = activeTemplate.value === id ? null : id
}

function onSelect(id: string) {
  selectedId.value = id
  const s = localScenes.value.find(x => x.id === id)
  if (s) activeSubSceneId.value = s.lighting.name ?? null
}

function onPatch(updated: SceneV2) {
  const i = localScenes.value.findIndex(s => s.id === updated.id)
  if (i < 0) return
  localScenes.value[i] = updated
}

function onPickSubScene(sub: SceneSubScene) {
  if (!selected.value) return
  activeSubSceneId.value = sub.id
  onPatch({
    ...selected.value,
    lighting: {
      ...selected.value.lighting,
      name: sub.name,
      colorTemp: sub.colorTemp,
      lightDir: sub.lightDir,
      intensity: sub.intensity,
    },
    updatedAt: Date.now(),
  })
}

function onNew() {
  const tpl: SceneTemplate = activeTemplate.value ?? 'cyberpunk'
  const meta = getSceneTemplateMeta(tpl)
  const id = `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const sub = meta.subScenes[0]
  const s: SceneV2 = {
    id,
    name: `${meta.label} · 新场景`,
    template: tpl,
    parentId: null,
    description: meta.description.split('。')[0] ?? meta.tagline,
    assets: { imageUrl: null, thumbnailUrl: null },
    lighting: {
      timeOfDay: 'day',
      lightDir: sub?.lightDir ?? meta.defaultLightDir,
      colorTemp: sub?.colorTemp ?? meta.defaultColorTemp,
      intensity: sub?.intensity ?? meta.defaultIntensity,
      name: sub?.name,
    },
    tags: [meta.code],
    vector: [],
    styleId: meta.styleId,
    themeId: themeId.value,
    reusable: false,
    consistencyScore: 80,
    relatedArchetypes: meta.compatibleArchetypes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  localScenes.value.unshift(s)
  selectedId.value = id
}

function onDelete() {
  if (!selected.value) return
  if (!confirm(`删除场景 "${selected.value.name}"?`)) return
  const i = localScenes.value.findIndex(s => s.id === selected.value!.id)
  if (i < 0) return
  localScenes.value.splice(i, 1)
  selectedId.value = localScenes.value[0]?.id ?? null
}

function onDuplicate() {
  if (!selected.value) return
  const src = selected.value
  const id = `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const copy: SceneV2 = {
    ...src,
    id,
    name: `${src.name} · 副本`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  localScenes.value.push(copy)
  selectedId.value = id
}

// ---------- API 场景操作 (L3.B 新增) ----------
async function onCreateScene() {
  const name = window.prompt('新场景名 (例: 🏙️ 都市夜景):', '🏙️ 新场景')
  if (!name) return
  const typePick = window.prompt(
    `选择场景类型 (indoor=室内 / outdoor=室外 / battle=战斗 / school=校园 / urban=都市 / ancient=古代 / future=未来 / fantasy=幻想):`,
    'urban',
  )
  const validTypes: SceneType[] = ['indoor', 'outdoor', 'battle', 'school', 'urban', 'ancient', 'future', 'fantasy']
  const type: SceneType = (validTypes as string[]).includes(typePick ?? '')
    ? (typePick as SceneType)
    : 'urban'
  try {
    await store.create({ name, type })
  } catch {
    // 错误在 store.error
  }
}

async function onDeleteScene(tagId: string, name: string) {
  if (!window.confirm(`删除场景 "${name}"?`)) return
  try {
    await store.remove(tagId)
  } catch {
    // 错误在 store.error
  }
}

function getSceneTypeOf(name: string): SceneType {
  const lower = name.toLowerCase()
  for (const [key, meta] of Object.entries(SCENE_TYPE_META)) {
    if (meta.keywords.some(kw => lower.includes(kw))) return key as SceneType
  }
  return 'fantasy'
}
</script>

<template>
  <div class="scene-view flex h-full w-full flex-col bg-gray-50 dark:bg-gray-950">
    <!-- 顶部：标题 + 工具条 -->
    <header
      class="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80"
    >
      <div class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-100">
        <span>🎬</span>
        <span>场景管理</span>
        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
          {{ store.count }} 个场景 · {{ localScenes.length }} 个模板
        </span>
        <span
          v-if="store.lastSource === 'api'"
          class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300"
          title="数据来自真 API"
        >● API</span>
        <span
          v-else-if="store.lastSource === 'mock'"
          class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          title="API 不可用,使用本地数据"
        >● 本地</span>
        <span
          v-if="store.loading"
          class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >⟳ 加载中</span>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="searchQuery"
          placeholder="搜索场景…"
          class="w-44 rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800"
        />
        <select
          v-model="themeId"
          class="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-800"
        >
          <option v-for="t in STUDIO_THEMES" :key="t.id" :value="t.id">
            {{ t.icon }} {{ t.label }}
          </option>
        </select>
        <button
          class="rounded bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          :disabled="store.loading"
          @click="onCreateScene"
        >+ 新场景</button>
        <button
          class="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-600"
          @click="onNew"
        >+ 新模板场景</button>
      </div>
    </header>

    <!-- 错误横幅 -->
    <div
      v-if="store.error"
      class="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <span>⚠️ {{ store.error }}</span>
      <button
        class="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700"
        @click="store.clearError()"
      >✕</button>
    </div>

    <!-- API 场景区 (新增) -->
    <section class="border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <div class="mb-2 flex items-center gap-2">
        <h3 class="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
          🌍 场景库 (真 API)
        </h3>
        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            class="rounded border px-2 py-0.5 text-[10px]"
            :class="sceneTypeFilter === 'all'
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'"
            @click="sceneTypeFilter = 'all'"
          >全部 ({{ store.count }})</button>
          <button
            v-for="(meta, key) in SCENE_TYPE_META"
            :key="key"
            type="button"
            class="rounded border px-2 py-0.5 text-[10px]"
            :class="sceneTypeFilter === key
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'"
            @click="sceneTypeFilter = (sceneTypeFilter === key ? 'all' : key)"
          >
            {{ meta.icon }} {{ meta.label }} ({{ store.countByType[key] }})
          </button>
        </div>
      </div>

      <!-- 加载骨架屏 -->
      <div
        v-if="store.loading && store.scenes.length === 0"
        class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="flex animate-pulse flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
        >
          <div class="h-20 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="h-2.5 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div class="h-2 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>

      <!-- 空态 -->
      <div
        v-else-if="filteredApiScenes.length === 0"
        class="flex h-16 items-center justify-center text-[12px] text-gray-400"
      >
        {{ store.lastSource === 'api' ? '该项目暂无场景,点击右上角"+ 新场景"添加' : '本地数据为空' }}
      </div>

      <!-- 场景卡片网格 (支持大量,响应式) -->
      <div
        v-else
        class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      >
        <div
          v-for="s in filteredApiScenes"
          :key="s.id"
          class="group flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
        >
          <!-- 缩略图占位 (L3.B:用纯 CSS gradient 模拟,无图片也能好看) -->
          <div
            class="relative h-20 w-full overflow-hidden rounded-md"
            :style="{
              background: `linear-gradient(135deg, hsl(${(s.name.charCodeAt(0) * 7) % 360} 60% 55%), hsl(${(s.name.charCodeAt(1) || 65) * 11 % 360} 60% 35%))`,
            }"
          >
            <span class="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {{ SCENE_TYPE_META[getSceneTypeOf(s.name)].icon }} {{ SCENE_TYPE_META[getSceneTypeOf(s.name)].label }}
            </span>
            <span
              v-if="s.count > 0"
              class="absolute right-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 dark:bg-gray-800/90 dark:text-gray-200"
            >{{ s.count }} 次</span>
          </div>
          <div>
            <div class="truncate text-[12px] font-semibold text-gray-800 dark:text-gray-100" :title="s.name">
              {{ s.name }}
            </div>
            <p class="mt-0.5 line-clamp-2 text-[10px] text-gray-500 dark:text-gray-400">
              标签色: {{ s.color }} · 关联 {{ s.count }} 个分镜
            </p>
          </div>
          <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
              title="编辑 (TODO)"
              disabled
            >✏️</button>
            <button
              class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
              title="删除场景"
              :disabled="store.loading"
              @click="onDeleteScene(s.id, s.name)"
            >🗑</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 12 模板 picker (原 L2) -->
    <div class="flex-shrink-0 border-b border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex flex-wrap gap-1">
        <button
          v-for="t in SCENE_TEMPLATES_V2"
          :key="t.id"
          type="button"
          class="flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-all"
          :class="activeTemplate === t.id
            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'"
          @click="onPickTemplate(t.id)"
        >
          <span>{{ t.icon }}</span>
          <span>{{ t.label }}</span>
          <span class="rounded bg-gray-200 px-1 text-[9px] font-mono dark:bg-gray-700">{{ countMap[t.id] ?? 0 }}</span>
        </button>
        <button
          v-if="activeTemplate"
          type="button"
          class="rounded border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-400 hover:border-gray-400 dark:border-gray-700"
          @click="activeTemplate = null"
        >✕ 清除筛选</button>
      </div>
    </div>

    <!-- 主体：左场景列表 / 右详情 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 场景卡片网格（按模板分组，原 L2） -->
      <div class="flex-1 overflow-y-auto p-3">
        <div
          v-if="filteredScenes.length === 0"
          class="flex h-32 items-center justify-center text-[12px] text-gray-400"
        >
          {{ activeTemplate ? '此模板暂无场景' : '暂无场景，点击右上角新建' }}
        </div>
        <div v-else class="flex flex-col gap-4">
          <div
            v-for="(list, tpl) in groupedByTemplate"
            :key="tpl"
            class="flex flex-col gap-2"
          >
            <h4 class="flex items-center gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
              <span>{{ getSceneTemplateMeta(tpl as SceneTemplate).icon }}</span>
              <span>{{ getSceneTemplateMeta(tpl as SceneTemplate).label }}</span>
              <span class="text-[10px] text-gray-400">· {{ list.length }} 个</span>
            </h4>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <button
                v-for="s in list"
                :key="s.id"
                type="button"
                class="flex flex-col gap-1 rounded-lg border bg-white p-3 text-left transition-all hover:shadow-md dark:bg-gray-900"
                :class="selectedId === s.id
                  ? 'border-amber-500 ring-2 ring-amber-400/40'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
                @click="onSelect(s.id)"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{{ getSceneTemplateMeta(s.template).icon }}</span>
                    <div>
                      <div class="text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                        {{ s.name }}
                      </div>
                      <div class="text-[10px] text-gray-400">{{ s.styleId }}</div>
                    </div>
                  </div>
                  <span
                    v-if="s.reusable"
                    class="rounded bg-green-100 px-1 py-0.5 text-[9px] text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  >可复用</span>
                </div>
                <p class="line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{{ s.description }}</p>
                <div class="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span class="rounded bg-cyan-100 px-1 py-0.5 font-mono text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                    {{ s.lighting.colorTemp }}K
                  </span>
                  <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ s.lighting.lightDir }}</span>
                  <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ Math.round(s.lighting.intensity * 100) }}%</span>
                  <span class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">{{ s.relatedArchetypes.length }} 角色</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 详情侧边栏 (原 L2) -->
      <aside
        v-if="selected && selectedMeta"
        class="w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <h3 class="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
            {{ selectedMeta.icon }} 场景详情
          </h3>
          <div class="flex items-center gap-1">
            <button
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] hover:bg-gray-200 dark:bg-gray-800"
              title="复制"
              @click="onDuplicate"
            >📋</button>
            <button
              class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
              title="删除"
              @click="onDelete"
            >🗑</button>
          </div>
        </div>
        <div class="p-3">
          <SceneForm
            :model-value="selected"
            readonly-template
            @update:model-value="onPatch"
            @pick-sub-scene="onPickSubScene"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.scene-view {
  min-height: 0;
  flex: 1;
  background: var(--bg-primary, #0a0e1a) !important;
}

/* Dark bg override for sections */
.scene-view header {
  background: var(--bg-secondary, #111827) !important;
  border-color: var(--border, #1f2937) !important;
}
.scene-view section {
  background: var(--bg-secondary, #111827) !important;
  border-color: var(--border, #1f2937) !important;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
