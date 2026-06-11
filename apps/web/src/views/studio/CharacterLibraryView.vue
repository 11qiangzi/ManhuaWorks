<script setup lang="ts">
/**
 * CharacterLibraryView · 角色库
 * ManhuaWorks · W3 工坊流程精修
 *
 * 1. 12 个角色卡片
 * 2. 4 角度预览（前/侧/背/3-4）
 * 3. 表情选择
 * 4. 角色锁定 / 编辑 / 删除
 * 5. 搜索 + 标签筛选
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import CharacterCard, { type Character, type CharacterExpression } from '@/components/studio/CharacterCard.vue'

const router = useRouter()

const loading = ref(true)
const characters = ref<Character[]>([])
const selectedId = ref<string | null>(null)
const searchKeyword = ref('')
const activeTag = ref<string | null>(null)
const activeExpressionMap = ref<Record<string, string>>({})

const allTags = computed(() => {
  const set = new Set<string>()
  for (const c of characters.value) {
    c.tags?.forEach((t) => set.add(t))
  }
  return Array.from(set)
})

const filtered = computed(() => {
  return characters.value.filter((c) => {
    if (searchKeyword.value && !c.name.includes(searchKeyword.value) && !(c.description?.includes(searchKeyword.value))) return false
    if (activeTag.value && !c.tags?.includes(activeTag.value)) return false
    return true
  })
})

async function loadCharacters() {
  loading.value = true
  try {
    await new Promise((r) => setTimeout(r, 200))
    characters.value = sampleCharacters(12)
  } finally {
    loading.value = false
  }
}

function sampleCharacters(n: number): Character[] {
  const names = ['林墨', '苏晚', '老周', '江雪', '阿狸', '苍岩', '红袖', '玄青', '云澜', '墨白', '霓凰', '青衫']
  const styles = ['赛博朋克', '古风', '现代都市', '校园', '玄幻', '蒸汽朋克']
  const tagPool = ['主角', '女主', '反派', '配角', '路人', '可攻略', '已解锁', '神秘', '高冷', '热血', '治愈', '暗黑']
  const list: Character[] = []
  for (let i = 0; i < n; i++) {
    const name = names[i] ?? `角色${i + 1}`
    list.push({
      id: `c-${i + 1}`,
      name,
      description: `${name} · 第${i + 1}集关键人物 · 出场时长 ${5 + i}m`,
      artStyle: styles[i % styles.length],
      views: {
        front: `https://picsum.photos/seed/c${i}f/240/240`,
        side: `https://picsum.photos/seed/c${i}s/240/240`,
        back: `https://picsum.photos/seed/c${i}b/240/240`,
        threeQ: `https://picsum.photos/seed/c${i}q/240/240`
      },
      expressions: sampleExpressions(i),
      tags: [tagPool[i % tagPool.length]!, tagPool[(i + 3) % tagPool.length]!],
      locked: i % 5 === 4,
      consistencyScore: Math.round((0.7 + (i % 3) * 0.1) * 10) / 10
    })
  }
  return list
}

function sampleExpressions(seed: number): CharacterExpression[] {
  const base = ['开心', '愤怒', '悲伤', '惊讶', '平静']
  return base.map((label, idx) => ({
    id: `e-${seed}-${idx}`,
    label,
    imageUrl: `https://picsum.photos/seed/e${seed}${idx}/120/120`
  }))
}

function onSelect(id: string) {
  selectedId.value = selectedId.value === id ? null : id
}

function onEdit(id: string) {
  console.log('[角色] 编辑', id)
}

function onRemove(id: string) {
  if (confirm(`确认删除角色「${characters.value.find((c) => c.id === id)?.name}」？`)) {
    characters.value = characters.value.filter((c) => c.id !== id)
  }
}

function onToggleLock(id: string) {
  const c = characters.value.find((x) => x.id === id)
  if (c) c.locked = !c.locked
}

function onSelectExpression(characterId: string, expressionId: string) {
  activeExpressionMap.value = { ...activeExpressionMap.value, [characterId]: expressionId }
}

function onGenerateExpressions(id: string) {
  console.log('[角色] 生成表情包', id)
}

function onAddCharacter() {
  const id = `c-new-${Date.now()}`
  characters.value.push({
    id,
    name: `新角色${characters.value.length + 1}`,
    description: '未描述',
    artStyle: '现代都市',
    views: { front: null, side: null, back: null, threeQ: null },
    expressions: [],
    tags: ['未分类']
  })
}

onMounted(() => {
  loadCharacters()
})
</script>

<template>
  <main class="cl">
    <!-- 顶栏 -->
    <header class="cl__nav">
      <div class="cl__brand">
        <button class="cl__back" @click="router.push('/studio')" title="返回">←</button>
        <span class="cl__logo">M</span>
        <span class="cl__brand-name">角色库</span>
      </div>
      <div class="cl__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="cl__content">
      <!-- 标题 -->
      <section class="cl__header">
        <div>
          <h1>🧑‍🎨 角色库 · {{ filtered.length }} 个角色</h1>
          <p>4 角度预览 · 表情选择 · 一致性保障</p>
        </div>
        <button type="button" class="qh-btn qh-btn--primary" @click="onAddCharacter">＋ 新增角色</button>
      </section>

      <!-- 搜索 + 标签 -->
      <section class="cl__toolbar">
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="🔍 搜索角色名 / 描述"
          class="cl__search"
        />
        <div class="cl__tags">
          <button
            type="button"
            class="cl__tag"
            :class="{ 'cl__tag--active': !activeTag }"
            @click="activeTag = null"
          >
            全部
          </button>
          <button
            v-for="t in allTags"
            :key="t"
            type="button"
            class="cl__tag"
            :class="{ 'cl__tag--active': activeTag === t }"
            @click="activeTag = activeTag === t ? null : t"
          >
            {{ t }}
          </button>
        </div>
      </section>

      <!-- 加载 -->
      <div v-if="loading" class="cl__loading">
        <div class="cl__spinner" />
        <span>加载角色...</span>
      </div>

      <!-- 空 -->
      <div v-else-if="filtered.length === 0" class="cl__empty">
        <span class="cl__empty-icon">🧑‍🎨</span>
        <p>没有匹配的角色</p>
      </div>

      <!-- 角色网格 -->
      <section v-else class="cl__grid">
        <CharacterCard
          v-for="c in filtered"
          :key="c.id"
          :character="c"
          :selected="selectedId === c.id"
          :active-expression-id="activeExpressionMap[c.id]"
          :tags="c.tags"
          :consistency-score="c.consistencyScore"
          :locked="c.locked"
          @select="onSelect"
          @edit="onEdit"
          @remove="onRemove"
          @toggle-lock="onToggleLock"
          @select-expression="onSelectExpression"
          @generate-expressions="onGenerateExpressions"
        />
      </section>
    </div>
  </main>
</template>

<style scoped>
.cl {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.cl__nav {
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

.cl__brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.cl__back {
  width: 30px; height: 30px; border-radius: 7px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); font-size: 16px; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.cl__back:hover { background: var(--bg-tertiary); }
.cl__logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px;
}

.cl__content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cl__header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.cl__header h1 { font-size: 24px; margin: 0 0 4px; }
.cl__header p { color: var(--text-secondary); margin: 0; font-size: 14px; }

.cl__toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.cl__search {
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}
.cl__search:focus { outline: none; border-color: var(--accent); }
.cl__tags { display: flex; gap: 6px; flex-wrap: wrap; }
.cl__tag {
  padding: 4px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all .2s;
}
.cl__tag:hover { color: var(--text-primary); border-color: var(--accent); }
.cl__tag--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.cl__loading {
  display: flex; align-items: center; gap: 12px;
  padding: 40px; justify-content: center;
  color: var(--text-secondary);
}
.cl__spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cl__empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}
.cl__empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

.cl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
</style>
