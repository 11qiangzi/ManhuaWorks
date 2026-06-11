<script setup lang="ts">
/**
 * SceneLibraryView · 场景库
 * ManhuaWorks · W3 工坊流程精修
 *
 * 1. 场景分类（室内/室外/城市/自然/奇幻）
 * 2. 光影标签（日出/日落/夜景/雨天/霓虹）
 * 3. 复用标记
 * 4. 搜索 + 分类筛选
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import SceneCard, { type Scene, type SceneLighting } from '@/components/studio/SceneCard.vue'

const router = useRouter()

const loading = ref(true)
const scenes = ref<Scene[]>([])
const selectedId = ref<string | null>(null)
const activeCategory = ref<string>('all')
const activeLighting = ref<string | null>(null)
const searchKeyword = ref('')
const onlyReusable = ref(false)

const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '🗂' },
  { id: 'indoor', label: '室内', icon: '🏠' },
  { id: 'outdoor', label: '室外', icon: '🌳' },
  { id: 'urban', label: '城市', icon: '🏙' },
  { id: 'nature', label: '自然', icon: '⛰' },
  { id: 'fantasy', label: '奇幻', icon: '✨' },
  { id: 'other', label: '其他', icon: '📦' }
]

const LIGHTINGS: { id: SceneLighting; label: string; icon: string }[] = [
  { id: 'sunrise', label: '日出', icon: '🌅' },
  { id: 'noon', label: '正午', icon: '☀️' },
  { id: 'sunset', label: '日落', icon: '🌇' },
  { id: 'night', label: '夜景', icon: '🌙' },
  { id: 'rainy', label: '雨天', icon: '🌧' },
  { id: 'snowy', label: '雪天', icon: '❄️' },
  { id: 'neon', label: '霓虹', icon: '💡' }
]

const filtered = computed(() => {
  return scenes.value.filter((s) => {
    if (activeCategory.value !== 'all' && s.category !== activeCategory.value) return false
    if (activeLighting.value && s.lighting !== activeLighting.value) return false
    if (onlyReusable.value && !s.reusable) return false
    if (searchKeyword.value && !s.name.includes(searchKeyword.value) && !(s.description?.includes(searchKeyword.value))) return false
    return true
  })
})

const stats = computed(() => ({
  total: scenes.value.length,
  reusable: scenes.value.filter((s) => s.reusable).length,
  filtered: filtered.value.length
}))

async function loadScenes() {
  loading.value = true
  try {
    await new Promise((r) => setTimeout(r, 200))
    scenes.value = sampleScenes(20)
  } finally {
    loading.value = false
  }
}

const LIGHTING_DATA: Record<string, { timeOfDay: string; lightDir: string; colorTemp: number; intensity: number }> = {
  sunrise: { timeOfDay: '日出', lightDir: '右下45°', colorTemp: 3200, intensity: 0.6 },
  noon:    { timeOfDay: '正午', lightDir: '顶光',   colorTemp: 5600, intensity: 1.0 },
  sunset:  { timeOfDay: '日落', lightDir: '左下30°', colorTemp: 2800, intensity: 0.7 },
  night:   { timeOfDay: '夜景', lightDir: '顶光偏冷', colorTemp: 4500, intensity: 0.3 },
  rainy:   { timeOfDay: '雨天', lightDir: '散射',   colorTemp: 6000, intensity: 0.4 },
  snowy:   { timeOfDay: '雪天', lightDir: '漫反射', colorTemp: 6500, intensity: 0.8 },
  neon:    { timeOfDay: '霓虹', lightDir: '多向',   colorTemp: 3800, intensity: 0.9 }
}

function sampleScenes(n: number): Scene[] {
  const SCENE_CATALOG: { name: string; category: Scene['category'] }[] = [
    { name: '咖啡馆', category: 'indoor' },
    { name: '雨夜街道', category: 'outdoor' },
    { name: '校园操场', category: 'outdoor' },
    { name: '公司办公室', category: 'indoor' },
    { name: '古风长廊', category: 'fantasy' },
    { name: '未来实验室', category: 'indoor' },
    { name: '山林小溪', category: 'nature' },
    { name: '废弃工厂', category: 'urban' },
    { name: '海底宫殿', category: 'fantasy' },
    { name: '雪山之巅', category: 'nature' },
    { name: '沙漠绿洲', category: 'nature' },
    { name: '霓虹巷子', category: 'urban' },
    { name: '海边码头', category: 'outdoor' },
    { name: '地下酒吧', category: 'indoor' },
    { name: '森林深处', category: 'nature' },
    { name: '屋顶天台', category: 'urban' },
    { name: '地铁站', category: 'urban' },
    { name: '菜市场', category: 'indoor' },
    { name: '寺庙大堂', category: 'fantasy' },
    { name: '外星基地', category: 'fantasy' }
  ]
  const lightKeys = ['sunrise', 'noon', 'sunset', 'night', 'rainy', 'snowy', 'neon']
  const tagPool = ['复用', '关键', '氛围', '过渡', '高潮', '回忆', '梦境']
  const list: Scene[] = []
  for (let i = 0; i < n; i++) {
    const entry = SCENE_CATALOG[i] ?? { name: `场景${i + 1}`, category: 'other' as const }
    const key = lightKeys[i % lightKeys.length]!
    const ld = LIGHTING_DATA[key]!
    list.push({
      id: `sc-${i + 1}`,
      name: entry.name,
      category: entry.category,
      imageUrl: `https://picsum.photos/seed/sc${i}/480/270`,
      description: `${entry.name} · ${i + 1}号场景 · 适合多场戏`,
      lighting: { ...ld, name: key },
      tags: [tagPool[i % tagPool.length]!, tagPool[(i + 2) % tagPool.length]!],
      reusable: i % 3 !== 0
    })
  }
  return list
}

function onSelect(id: string) {
  selectedId.value = selectedId.value === id ? null : id
}

function onEdit(id: string) {
  console.log('[场景] 编辑', id)
}

function onRemove(id: string) {
  scenes.value = scenes.value.filter((s) => s.id !== id)
}

function onAddScene() {
  scenes.value.push({
    id: `sc-new-${Date.now()}`,
    name: `新场景${scenes.value.length + 1}`,
    category: 'other',
    imageUrl: null,
    description: '未描述',
    lighting: 'noon',
    tags: ['未分类']
  })
}

onMounted(() => {
  loadScenes()
})
</script>

<template>
  <main class="sl">
    <!-- 顶栏 -->
    <header class="sl__nav">
      <div class="sl__brand">
        <button class="sl__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="sl__logo">M</span>
        <span class="sl__brand-name">场景库</span>
      </div>
      <div class="sl__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="sl__content">
      <!-- 标题 -->
      <section class="sl__header">
        <div>
          <h1>🏞 场景库 · {{ stats.filtered }} / {{ stats.total }}</h1>
          <p>分类清晰 · 光影标签 · 一键复用</p>
        </div>
        <div class="sl__header-actions">
          <label class="sl__check">
            <input v-model="onlyReusable" type="checkbox" />
            <span>只显示可复用</span>
          </label>
          <button type="button" class="qh-btn qh-btn--primary" @click="onAddScene">＋ 新增场景</button>
        </div>
      </section>

      <!-- 分类 -->
      <nav class="sl__cats">
        <button
          v-for="c in CATEGORIES"
          :key="c.id"
          type="button"
          class="sl__cat"
          :class="{ 'sl__cat--active': activeCategory === c.id }"
          @click="activeCategory = c.id"
        >
          <span class="sl__cat-icon">{{ c.icon }}</span>
          <span>{{ c.label }}</span>
        </button>
      </nav>

      <!-- 工具栏 -->
      <section class="sl__toolbar">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="🔍 搜索场景名 / 描述"
          class="sl__search"
        />
        <div class="sl__lights">
          <span class="sl__lights-label">光影：</span>
          <button
            type="button"
            class="sl__light"
            :class="{ 'sl__light--active': !activeLighting }"
            @click="activeLighting = null"
          >
            全部
          </button>
          <button
            v-for="l in LIGHTINGS"
            :key="l.id"
            type="button"
            class="sl__light"
            :class="{ 'sl__light--active': activeLighting === l.id }"
            @click="activeLighting = activeLighting === l.id ? null : l.id"
          >
            {{ l.icon }} {{ l.label }}
          </button>
        </div>
      </section>

      <!-- 加载 -->
      <div v-if="loading" class="sl__loading">
        <div class="sl__spinner" />
        <span>加载场景...</span>
      </div>

      <!-- 空 -->
      <div v-else-if="filtered.length === 0" class="sl__empty">
        <span class="sl__empty-icon">🏞</span>
        <p>没有匹配的场景</p>
      </div>

      <!-- 场景网格 -->
      <section v-else class="sl__grid">
        <SceneCard
          v-for="s in filtered"
          :key="s.id"
          :scene="s"
          :selected="selectedId === s.id"
          :tags="s.tags"
          @select="onSelect"
          @edit="onEdit"
          @remove="onRemove"
        />
      </section>
    </div>
  </main>
</template>

<style scoped>
.sl {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.sl__nav {
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

.sl__brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.sl__back {
  width: 30px; height: 30px; border-radius: 7px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 16px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.sl__back:hover { background: var(--bg-tertiary); }
.sl__logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px;
}

.sl__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sl__header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.sl__header h1 { font-size: 24px; margin: 0 0 4px; }
.sl__header p { color: var(--text-secondary); margin: 0; font-size: 14px; }
.sl__header-actions { display: flex; gap: 12px; align-items: center; }
.sl__check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }

.sl__cats {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 2px;
}
.sl__cat {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all .2s;
}
.sl__cat:hover { color: var(--text-primary); border-color: var(--accent); }
.sl__cat--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.sl__cat-icon { font-size: 16px; }

.sl__toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.sl__search {
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}
.sl__search:focus { outline: none; border-color: var(--accent); }
.sl__lights { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.sl__lights-label { font-size: 12px; color: var(--text-secondary); margin-right: 4px; }
.sl__light {
  padding: 4px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all .2s;
}
.sl__light:hover { color: var(--text-primary); border-color: var(--accent); }
.sl__light--active {
  background: var(--accent-2);
  color: #fff;
  border-color: var(--accent-2);
}

.sl__loading {
  display: flex; align-items: center; gap: 12px;
  padding: 40px; justify-content: center;
  color: var(--text-secondary);
}
.sl__spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sl__empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}
.sl__empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

.sl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
