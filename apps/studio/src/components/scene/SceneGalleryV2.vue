<script setup lang="ts">
/**
 * SceneGalleryV2 · 场景画廊 v2
 * 千机工坊 · W5 任务 5
 *
 * 12 类场景 4-6 子场景网格 + 一致性预览
 */
import { ref, computed, watch } from 'vue'
import type { SceneTemplate, SceneTemplateMeta, SceneSubScene, SceneV2 } from '../../types/scene'
import { SCENE_TEMPLATES_V2, getSceneTemplateMeta } from '../../data/scene-templates-v2'
import { useSceneMatch, tokenize } from '../../composables/useSceneMatch'

const props = defineProps<{
  /** 初始 query */
  initialQuery?: string
  /** 风格 ID（5 主题） */
  styleId?: string
  /** 已存在场景列表（用于一致性预览） */
  existingScenes?: SceneV2[]
  /** 网格列数（默认 3） */
  columns?: number
  /** 每模板子场景数（默认 5） */
  subSceneCount?: number
}>()

const emit = defineEmits<{
  (e: 'select', template: SceneTemplate, subSceneId: string): void
  (e: 'preview', template: SceneTemplate, subSceneId: string): void
  (e: 'query', q: string): void
  (e: 'apply', template: SceneTemplate, subSceneId: string): void
}>()

const matcher = useSceneMatch({
  styleId: props.styleId ?? 'minimal-light',
  subSceneCount: props.subSceneCount ?? 5,
})

const localQuery = ref<string>(props.initialQuery ?? '')

watch(() => props.initialQuery, (q) => {
  if (q !== undefined) {
    localQuery.value = q
    if (q.trim()) matcher.match(q)
  }
}, { immediate: true })

/** 12 类模板（按匹配分数排序） */
const orderedTemplates = computed<SceneTemplateMeta[]>(() => {
  const map = new Map<string, number>()
  for (const r of matcher.results.value) {
    map.set(r.template, r.totalScore)
  }
  return [...SCENE_TEMPLATES_V2].sort((a, b) => {
    const sa = map.get(a.id) ?? 0
    const sb = map.get(b.id) ?? 0
    return sb - sa
  })
})

/** 取某个 template 下的子场景（来自 match 结果） */
function getSubScenesForTemplate(tpl: SceneTemplate): Array<SceneSubScene & { score: number }> {
  const r = matcher.results.value.find(x => x.template === tpl)
  if (r) return r.subScenes
  // 没有 query 时用默认（按 sub scene id 顺序）
  const meta = getSceneTemplateMeta(tpl)
  return meta.subScenes.slice(0, props.subSceneCount ?? 5).map(s => ({ ...s, score: 0.5 }))
}

/** 模板级的相似度（top match 时的高亮） */
function getTemplateScore(tpl: SceneTemplate): number {
  return matcher.results.value.find(x => x.template === tpl)?.totalScore ?? 0
}

/** 模板对应的已有场景 */
function getExistingForSubScene(tpl: SceneTemplate, subSceneId: string): SceneV2 | undefined {
  return (props.existingScenes ?? []).find(s => s.template === tpl && s.id === subSceneId)
}

async function onSearch() {
  if (!localQuery.value.trim()) {
    matcher.reset()
    return
  }
  await matcher.match(localQuery.value)
  emit('query', localQuery.value)
}

function onClear() {
  localQuery.value = ''
  matcher.reset()
}

function onPick(tpl: SceneTemplate, subId: string) {
  emit('select', tpl, subId)
}

function onPreview(tpl: SceneTemplate, subId: string, e: Event) {
  e.stopPropagation()
  emit('preview', tpl, subId)
}

function onApply(tpl: SceneTemplate, subId: string, e: Event) {
  e.stopPropagation()
  emit('apply', tpl, subId)
}

function onRecommend() {
  // 推荐（清空 query 时使用）
  matcher.reset()
  const recs = matcher.recommend(12)
  matcher.results.value = recs
}

function getScoreColor(score: number): string {
  if (score >= 0.7) return 'var(--success)'
  if (score >= 0.5) return 'var(--warning)'
  return 'var(--text-secondary)'
}

function formatScore(score: number): string {
  return score.toFixed(2)
}

function colorClass(token: string) {
  return `text-${token}-500`
}
</script>

<template>
  <div class="scene-gallery-v2">
    <!-- 搜索栏 -->
    <header class="scene-gallery-v2__head">
      <h3>场景画廊 <small>({{ orderedTemplates.length }} 类 · 12 模板)</small></h3>
      <div class="scene-gallery-v2__search">
        <input
          v-model="localQuery"
          type="text"
          placeholder="输入关键词（如：雨夜霓虹改造人 / 雪山极光 / 黄包车旗袍）"
          class="scene-gallery-v2__input"
          @keyup.enter="onSearch"
        />
        <button type="button" class="scene-gallery-v2__btn scene-gallery-v2__btn--primary" @click="onSearch">搜索</button>
        <button type="button" class="scene-gallery-v2__btn" @click="onRecommend">推荐</button>
        <button v-if="localQuery" type="button" class="scene-gallery-v2__btn" @click="onClear">清空</button>
      </div>
      <div v-if="matcher.error.value" class="scene-gallery-v2__err">⚠ {{ matcher.error.value }}</div>
      <div v-else-if="matcher.matching.value" class="scene-gallery-v2__hint">🔍 匹配中…</div>
      <div v-else-if="matcher.results.value.length > 0 && localQuery" class="scene-gallery-v2__hint">
        ✅ 找到 {{ matcher.results.value.length }} 类场景 · top: <strong>{{ orderedTemplates[0]?.label }}</strong>
      </div>
    </header>

    <!-- 12 类模板网格 -->
    <div class="scene-gallery-v2__grid" :style="{ gridTemplateColumns: `repeat(${columns ?? 3}, 1fr)` }">
      <section
        v-for="meta in orderedTemplates"
        :key="meta.id"
        class="scene-gallery-v2__tpl"
      >
        <header class="scene-gallery-v2__tpl-head">
          <span class="scene-gallery-v2__tpl-icon">{{ meta.icon }}</span>
          <h4 :class="colorClass(meta.colorAccent)">{{ meta.label }}</h4>
          <span
            v-if="localQuery"
            class="scene-gallery-v2__tpl-score"
            :style="{ background: getScoreColor(getTemplateScore(meta.id)) }"
            :title="`匹配度 ${formatScore(getTemplateScore(meta.id))}`"
          >
            {{ formatScore(getTemplateScore(meta.id)) }}
          </span>
        </header>
        <p class="scene-gallery-v2__tpl-tagline">{{ meta.tagline }}</p>

        <!-- 子场景网格（4-6） -->
        <div class="scene-gallery-v2__sub-grid">
          <article
            v-for="sub in getSubScenesForTemplate(meta.id)"
            :key="sub.id"
            class="scene-gallery-v2__sub"
            :class="{ 'scene-gallery-v2__sub--existing': !!getExistingForSubScene(meta.id, sub.id) }"
            @click="onPick(meta.id, sub.id)"
          >
            <div class="scene-gallery-v2__sub-thumb">
              <span class="scene-gallery-v2__sub-placeholder">{{ meta.icon }}</span>
              <span v-if="localQuery" class="scene-gallery-v2__sub-subscore" :title="`子场景分 ${formatScore(sub.score)}`">
                {{ formatScore(sub.score) }}
              </span>
              <span
                v-if="getExistingForSubScene(meta.id, sub.id)"
                class="scene-gallery-v2__sub-existing-badge"
                :title="`已存在: ${getExistingForSubScene(meta.id, sub.id)?.name}`"
              >
                ✓
              </span>
            </div>
            <div class="scene-gallery-v2__sub-body">
              <strong>{{ sub.name }}</strong>
              <small>{{ sub.description }}</small>
              <div class="scene-gallery-v2__sub-meta">
                <span>🌡 {{ sub.colorTemp }}K</span>
                <span>☀ {{ sub.intensity * 100 }}%</span>
              </div>
            </div>
            <div class="scene-gallery-v2__sub-actions" @click.stop>
              <button type="button" title="预览" @click="onPreview(meta.id, sub.id, $event)">👁</button>
              <button type="button" title="应用到镜头" @click="onApply(meta.id, sub.id, $event)">✨</button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <footer v-if="matcher.results.value.length > 0 && localQuery" class="scene-gallery-v2__foot">
      <small>已用 {{ tokenize(localQuery).length }} 个 token 匹配 · 风格: {{ props.styleId ?? 'minimal-light' }}</small>
    </footer>
  </div>
</template>

<style scoped>
.scene-gallery-v2 {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
}

/* head */
.scene-gallery-v2__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.scene-gallery-v2__head h3 small {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 11px;
  margin-left: 6px;
}

.scene-gallery-v2__search {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.scene-gallery-v2__input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
}

.scene-gallery-v2__input:focus {
  outline: none;
  border-color: var(--accent);
}

.scene-gallery-v2__btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}

.scene-gallery-v2__btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.scene-gallery-v2__btn--primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.scene-gallery-v2__btn--primary:hover {
  opacity: 0.9;
  color: white;
}

.scene-gallery-v2__hint,
.scene-gallery-v2__err {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.scene-gallery-v2__err {
  color: var(--danger);
}

.scene-gallery-v2__hint strong {
  color: var(--accent);
}

/* 网格 */
.scene-gallery-v2__grid {
  display: grid;
  gap: 10px;
}

@media (max-width: 1024px) {
  .scene-gallery-v2__grid {
    grid-template-columns: 1fr !important;
  }
}

/* 模板 */
.scene-gallery-v2__tpl {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
}

.scene-gallery-v2__tpl-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.scene-gallery-v2__tpl-icon {
  font-size: 20px;
}

.scene-gallery-v2__tpl-head h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.scene-gallery-v2__tpl-score {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
}

.scene-gallery-v2__tpl-tagline {
  margin: 0 0 8px 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

/* 子场景 */
.scene-gallery-v2__sub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
}

.scene-gallery-v2__sub {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  transition: all 150ms;
}

.scene-gallery-v2__sub:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.scene-gallery-v2__sub--existing {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 5%, var(--bg-secondary));
}

.scene-gallery-v2__sub-thumb {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  opacity: 0.7;
}

.scene-gallery-v2__sub-placeholder {
  filter: grayscale(0.3);
}

.scene-gallery-v2__sub-subscore {
  position: absolute;
  top: 4px;
  right: 4px;
  font-family: monospace;
  font-size: 9px;
  font-weight: 700;
  color: white;
  background: var(--bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid var(--border);
}

.scene-gallery-v2__sub-existing-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--success);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.scene-gallery-v2__sub-body {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scene-gallery-v2__sub-body strong {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-gallery-v2__sub-body small {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.scene-gallery-v2__sub-meta {
  display: flex;
  gap: 6px;
  font-size: 9px;
  color: var(--text-secondary);
  font-family: monospace;
  margin-top: 2px;
}

.scene-gallery-v2__sub-actions {
  display: flex;
  border-top: 1px solid var(--border);
}

.scene-gallery-v2__sub-actions button {
  flex: 1;
  border: none;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  padding: 3px 0;
  cursor: pointer;
  transition: all 150ms;
}

.scene-gallery-v2__sub-actions button + button {
  border-left: 1px solid var(--border);
}

.scene-gallery-v2__sub-actions button:hover {
  background: var(--accent);
  color: white;
}

/* foot */
.scene-gallery-v2__foot {
  text-align: right;
  color: var(--text-secondary);
  font-size: 10px;
}
</style>
