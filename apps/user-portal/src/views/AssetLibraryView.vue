<script setup lang="ts">
/**
 * AssetLibraryView ·素材库
 * ManhuaWorks · W4 用户后台
 *
 * 功能：
 *1.5 类素材（图片/视频/音频/角色/场景）
 *2. 多选标签筛选 +关键字搜索 +收藏筛选
 *3.拖拽 / 点击上传
 *4.收藏 / 重命名 / 删除（单 +批量）
 *5.网格视图
 */

import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import UserCard from '@/components/UserCard.vue'
import { useUser } from '@/composables/useUser'
import { useAssetLibrary } from '@/composables/useAssetLibrary'
import type { AssetCategory } from '@/api/asset-service'

const { profile, load: loadUser, logout } = useUser()
const {
 items, total, loading, error,
 categoryFilter, tagFilter, favoriteOnly, searchKeyword,
 selected, counts, allTags,
 load, upload, remove, removeSelected,
 toggleFavorite, toggleSelect, clearSelection,
 refresh
} = useAssetLibrary({ autoLoad: false })

onMounted(async () => {
 await loadUser()
 await load()
})

function onLogout() {
 logout()
 window.location.href = '/login'
}

/* =====分类 tabs ===== */
const CATEGORY_TABS: { id: AssetCategory | 'all'; label: string; icon: string; accept: string }[] = [
 { id: 'all', label: '全部', icon: '🗂', accept: 'image/*,video/*,audio/*' },
 { id: 'image', label: '图片', icon: '🖼', accept: 'image/*' },
 { id: 'video', label: '视频', icon: '🎬', accept: 'video/*' },
 { id: 'audio', label: '音频', icon: '🎵', accept: 'audio/*' },
 { id: 'character', label: '角色', icon: '🦸', accept: 'image/*' },
 { id: 'scene', label: '场景', icon: '🏞', accept: 'image/*' }
]

/* =====分类图标（缩略图占位） ===== */
const CAT_ICON: Record<AssetCategory, string> = {
 image: '🖼', video: '🎬', audio: '🎵', character: '🦸', scene: '🏞'
}

/* ===== 上传 ===== */
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

function pickFile() {
 fileInput.value?.click()
}

async function onFileChange(e: Event) {
 const input = e.target as HTMLInputElement
 if (!input.files || input.files.length ===0) return
 for (const f of Array.from(input.files)) {
 await upload(f, {
 category: categoryFilter.value === 'all' ? 'image' : (categoryFilter.value as AssetCategory),
 tags: tagFilter.value.length >0 ? tagFilter.value : undefined
 })
 }
 input.value = ''
}

async function onDrop(e: DragEvent) {
 e.preventDefault()
 dragOver.value = false
 if (!e.dataTransfer) return
 for (const f of Array.from(e.dataTransfer.files)) {
 await upload(f, {
 category: categoryFilter.value === 'all' ? 'image' : (categoryFilter.value as AssetCategory),
 tags: tagFilter.value.length >0 ? tagFilter.value : undefined
 })
 }
}

/* ===== 重命名 ===== */
const renaming = ref<string | null>(null)
const renameVal = ref('')

function startRename(id: string, name: string) {
 renaming.value = id
 renameVal.value = name
}

async function commitRename(id: string) {
 if (!renameVal.value.trim()) {
 renaming.value = null
 return
 }
 await rename(id, renameVal.value.trim())
 renaming.value = null
}

/* ===== 删除确认 ===== */
const confirmDelete = ref<string | null>(null)

async function confirmAndDelete(id: string) {
 await remove(id)
 confirmDelete.value = null
}

async function bulkDelete() {
 if (selected.value.size ===0) return
 if (!window.confirm(`确认删除选中的 ${selected.value.size} 项素材？`)) return
 await removeSelected()
}

/* =====标签切换 ===== */
function toggleTag(tag: string) {
 if (tagFilter.value.includes(tag)) {
 tagFilter.value = tagFilter.value.filter((t) => t !== tag)
 } else {
 tagFilter.value = [...tagFilter.value, tag]
 }
}

const hasSelected = computed(() => selected.value.size >0)

const studioHref = `http://${window.location.hostname}:5175`
</script>

<template>
 <main class="al">
 <!--顶栏 -->
 <header class="al__nav">
 <div class="al__nav-left">
 <span class="al__logo">M</span>
 <span class="al__brand-name">素材库</span>
 <span class="al__count">{{ total }} 项</span>
 </div>
 <nav class="al__nav-links">
 <RouterLink to="/dashboard" class="al__nav-link">首页</RouterLink>
 <RouterLink to="/projects" class="al__nav-link">项目</RouterLink>
 <RouterLink to="/works" class="al__nav-link">作品</RouterLink>
 <RouterLink to="/assets" class="al__nav-link al__nav-link--active">素材</RouterLink>
 <RouterLink to="/settings" class="al__nav-link">设置</RouterLink>
 </nav>
 <div class="al__nav-right">
 <ThemeSwitcher mode="compact" />
 <UserCard :user="profile" compact />
 </div>
 </header>

 <div class="al__content">
 <!-- =====工具栏 ===== -->
 <section class="al__toolbar">
 <div class="al__title-block">
 <h1>🎨素材库</h1>
 <p>图片 /视频 /音频 /角色 /场景 一站式管理 · 上传后可拖入<a :href="studioHref" target="_blank">创作者工作台</a>使用</p>
 </div>
 <div class="al__toolbar-right">
 <button type="button" class="al__btn" @click="refresh">🔄刷新</button>
 <button type="button" class="al__btn al__btn--primary" @click="pickFile">⬆ 上传素材</button>
 <input
 ref="fileInput"
 type="file"
 class="al__hidden-input"
 :accept="CATEGORY_TABS.find((t) => t.id === categoryFilter)?.accept ?? '*/*'"
 multiple
 @change="onFileChange"
 />
 </div>
 </section>

 <!-- =====分类 tabs ===== -->
 <nav class="al__tabs">
 <button
 v-for="t in CATEGORY_TABS"
 :key="t.id"
 type="button"
 class="al__tab"
 :class="{ 'al__tab--active': categoryFilter === t.id }"
 @click="categoryFilter = t.id"
 >
 <span class="al__tab-icon">{{ t.icon }}</span>
 <span class="al__tab-label">{{ t.label }}</span>
 <span class="al__tab-count">{{ counts[t.id] ??0 }}</span>
 </button>
 </nav>

 <!-- =====筛选条 ===== -->
 <section class="al__filters">
 <div class="al__search">
 <input
 v-model="searchKeyword"
 type="search"
 placeholder="🔍搜索素材名称…"
 class="al__search-input"
 />
 </div>
 <label class="al__check">
 <input v-model="favoriteOnly" type="checkbox" />
 <span>仅显示收藏</span>
 </label>
 <div v-if="hasSelected" class="al__bulk">
 <span class="al__bulk-info">已选 {{ selected.size }} 项</span>
 <button type="button" class="al__btn al__btn--ghost" @click="clearSelection">取消</button>
 <button type="button" class="al__btn al__btn--danger" @click="bulkDelete">批量删除</button>
 </div>
 </section>

 <!-- =====标签云 ===== -->
 <section v-if="allTags.length >0" class="al__tagcloud">
 <span class="al__tagcloud-label">标签：</span>
 <button
 v-for="t in allTags"
 :key="t"
 type="button"
 class="al__tag"
 :class="{ 'al__tag--active': tagFilter.includes(t) }"
 @click="toggleTag(t)"
 >#{{ t }}</button>
 <button
 v-if="tagFilter.length >0"
 type="button"
 class="al__tag-clear"
 @click="tagFilter = []"
 >清除筛选 ×</button>
 </section>

 <!-- =====错误 ===== -->
 <section v-if="error" class="al__error">⚠ {{ error }}</section>

 <!-- =====网格 ===== -->
 <section
 class="al__grid"
 :class="{ 'al__grid--dragover': dragOver }"
 @dragover.prevent="dragOver = true"
 @dragleave.prevent="dragOver = false"
 @drop="onDrop"
 >
 <!--拖拽提示层 -->
 <div v-if="dragOver" class="al__drop-hint">
 <div class="al__drop-icon">⬇</div>
 <div class="al__drop-text">松开鼠标上传到 {{ CATEGORY_TABS.find((t) => t.id === categoryFilter)?.label }}</div>
 </div>

 <!--加载骨架 -->
 <div v-if="loading && items.length ===0" class="al__skeleton-grid">
 <div v-for="i in12" :key="i" class="al__skeleton-card"></div>
 </div>

 <!-- 空状态 -->
 <div v-else-if="items.length ===0" class="al__empty">
 <div class="al__empty-icon">📦</div>
 <div class="al__empty-text">
 {{ searchKeyword || tagFilter.length >0 || favoriteOnly
 ? '没有匹配的素材，试试清除筛选？'
 : '素材库空空如也，拖拽或点击上传按钮添加素材' }}
 </div>
 <button type="button" class="al__btn al__btn--primary" @click="pickFile">⬆ 上传第一个素材</button>
 </div>

 <!--卡片 -->
 <article
 v-for="item in items"
 :key="item.id"
 class="al__card"
 :class="{ 'al__card--selected': selected.has(item.id) }"
 >
 <!--缩略图 -->
 <div class="al__thumb" :class="`al__thumb--${item.category}`">
 <span class="al__thumb-icon">{{ CAT_ICON[item.category] ?? '📄' }}</span>
 <span class="al__thumb-format">{{ item.format ?? '' }}</span>
 <button
 type="button"
 class="al__fav"
 :class="{ 'al__fav--on': item.favorite }"
 :title="item.favorite ? '取消收藏' : '收藏'"
 @click="toggleFavorite(item.id)"
 >{{ item.favorite ? '★' : '☆' }}</button>
 <label class="al__select" :title="selected.has(item.id) ? '取消选择' : '选择'">
 <input
 type="checkbox"
 :checked="selected.has(item.id)"
 @change="toggleSelect(item.id)"
 />
 </label>
 </div>

 <!-- 信息 -->
 <div class="al__info">
 <div v-if="renaming === item.id" class="al__rename">
 <input
 v-model="renameVal"
 class="al__rename-input"
 @keyup.enter="commitRename(item.id)"
 @keyup.esc="renaming = null"
 autofocus
 />
 <button type="button" class="al__btn al__btn--ghost" @click="commitRename(item.id)">保存</button>
 </div>
 <h3 v-else class="al__name" :title="item.name" @dblclick="startRename(item.id, item.name)">
 {{ item.name }}
 </h3>
 <div class="al__meta">
 <span class="al__meta-cat">{{ CAT_ICON[item.category] }} {{ item.category }}</span>
 <span class="al__meta-size">{{ item.size ?? '—' }}</span>
 </div>
 <div v-if="item.tags && item.tags.length >0" class="al__tags">
 <span v-for="t in item.tags.slice(0,3)" :key="t" class="al__mini-tag">#{{ t }}</span>
 <span v-if="item.tags.length >3" class="al__mini-tag-more">+{{ item.tags.length -3 }}</span>
 </div>
 </div>

 <!-- 操作 -->
 <div class="al__actions">
 <button
 type="button"
 class="al__act"
 title="重命名"
 @click="startRename(item.id, item.name)"
 >✏</button>
 <button
 v-if="confirmDelete === item.id"
 type="button"
 class="al__act al__act--danger"
 title="确认删除？再点一次取消"
 @click="confirmAndDelete(item.id)"
 >✓</button>
 <button
 v-else
 type="button"
 class="al__act"
 title="删除"
 @click="confirmDelete = item.id"
 >🗑</button>
 </div>
 </article>
 </section>
 </div>
 </main>
</template>

<style scoped>
/* ============================================================
 AssetLibraryView · 完全复用主题 CSS变量
 ============================================================ */
.al {
 min-height:100vh;
 background: var(--mw-bg);
 color: var(--mw-text);
 font-family: var(--mw-font, system-ui, -apple-system, "Segoe UI", sans-serif);
 transition: background0.3s, color0.3s;
}

/* =====顶栏 ===== */
.al__nav {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap:1rem;
 padding:0.75rem1.5rem;
 background: var(--mw-surface);
 border-bottom:1px solid var(--mw-border);
 position: sticky;
 top:0;
 z-index:50;
}
.al__nav-left { display: flex; align-items: center; gap:0.75rem; }
.al__logo {
 width:32px; height:32px;
 border-radius:8px;
 background: var(--mw-primary);
 color: var(--mw-primary-contrast, #fff);
 display: grid; place-items: center;
 font-weight:700; font-size:1.1rem;
}
.al__brand-name { font-size:1.05rem; font-weight:600; }
.al__count {
 font-size:0.8rem;
 color: var(--mw-text-muted);
 background: var(--mw-bg-soft);
 padding:0.15rem0.5rem;
 border-radius:999px;
}
.al__nav-links { display: flex; gap:0.25rem; flex:1; justify-content: center; }
.al__nav-link {
 padding:0.5rem0.85rem;
 border-radius:8px;
 font-size:0.92rem;
 color: var(--mw-text-muted);
 text-decoration: none;
 transition: background0.2s, color0.2s;
}
.al__nav-link:hover { background: var(--mw-bg-soft); color: var(--mw-text); }
.al__nav-link--active {
 background: var(--mw-primary-soft);
 color: var(--mw-primary);
 font-weight:600;
}
.al__nav-right { display: flex; align-items: center; gap:0.75rem; }

/* ===== 内容 ===== */
.al__content {
 max-width:1400px;
 margin:0 auto;
 padding:1.5rem;
 display: flex;
 flex-direction: column;
 gap:1.25rem;
}

/* =====工具栏 ===== */
.al__toolbar {
 display: flex;
 align-items: flex-end;
 justify-content: space-between;
 gap:1rem;
 flex-wrap: wrap;
}
.al__title-block h1 { font-size:1.6rem; font-weight:700; margin:000.25rem; }
.al__title-block p { margin:0; color: var(--mw-text-muted); font-size:0.9rem; }
.al__title-block a { color: var(--mw-primary); text-decoration: none; font-weight:500; }
.al__title-block a:hover { text-decoration: underline; }
.al__toolbar-right { display: flex; gap:0.5rem; align-items: center; }
.al__btn {
 display: inline-flex;
 align-items: center;
 gap:0.35rem;
 padding:0.55rem1rem;
 border-radius:8px;
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 color: var(--mw-text);
 font-size:0.9rem;
 cursor: pointer;
 transition: background0.2s, transform0.1s;
}
.al__btn:hover { background: var(--mw-bg-soft); }
.al__btn:active { transform: scale(0.98); }
.al__btn--primary {
 background: var(--mw-primary);
 color: var(--mw-primary-contrast, #fff);
 border-color: var(--mw-primary);
}
.al__btn--primary:hover { background: var(--mw-primary-hover, var(--mw-primary)); filter: brightness(1.08); }
.al__btn--ghost { background: transparent; }
.al__btn--danger {
 background: var(--mw-danger, #ef4444);
 color: #fff;
 border-color: var(--mw-danger, #ef4444);
}
.al__hidden-input { display: none; }

/* ===== Tabs ===== */
.al__tabs {
 display: flex;
 gap:0.5rem;
 overflow-x: auto;
 padding:0.25rem0;
 border-bottom:1px solid var(--mw-border);
}
.al__tab {
 display: inline-flex;
 align-items: center;
 gap:0.4rem;
 padding:0.6rem1rem;
 border-radius:8px8px00;
 background: transparent;
 border:1px solid transparent;
 border-bottom: none;
 color: var(--mw-text-muted);
 font-size:0.92rem;
 cursor: pointer;
 white-space: nowrap;
 transition: background0.2s, color0.2s;
}
.al__tab:hover { background: var(--mw-bg-soft); color: var(--mw-text); }
.al__tab--active {
 background: var(--mw-surface);
 border-color: var(--mw-border);
 color: var(--mw-primary);
 font-weight:600;
 position: relative;
}
.al__tab--active::after {
 content: '';
 position: absolute;
 left:0; right:0; bottom: -1px;
 height:2px;
 background: var(--mw-primary);
}
.al__tab-icon { font-size:1.05rem; }
.al__tab-count {
 font-size:0.75rem;
 padding:0.05rem0.4rem;
 border-radius:999px;
 background: var(--mw-bg-soft);
 color: var(--mw-text-muted);
}

/* =====筛选条 ===== */
.al__filters {
 display: flex;
 align-items: center;
 gap:1rem;
 flex-wrap: wrap;
}
.al__search { flex:1; min-width:220px; }
.al__search-input {
 width:100%;
 padding:0.55rem0.85rem;
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 border-radius:8px;
 color: var(--mw-text);
 font-size:0.9rem;
 outline: none;
 transition: border0.2s;
}
.al__search-input:focus { border-color: var(--mw-primary); }
.al__check {
 display: inline-flex;
 align-items: center;
 gap:0.4rem;
 font-size:0.9rem;
 color: var(--mw-text-muted);
 cursor: pointer;
}
.al__check input { accent-color: var(--mw-primary); }
.al__bulk {
 display: inline-flex;
 align-items: center;
 gap:0.5rem;
 padding:0.4rem0.75rem;
 background: var(--mw-primary-soft);
 border-radius:8px;
}
.al__bulk-info { font-size:0.85rem; color: var(--mw-primary); font-weight:600; }

/* =====标签云 ===== */
.al__tagcloud {
 display: flex;
 flex-wrap: wrap;
 align-items: center;
 gap:0.4rem;
 padding:0.75rem1rem;
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 border-radius:8px;
}
.al__tagcloud-label {
 font-size:0.85rem;
 color: var(--mw-text-muted);
 font-weight:600;
}
.al__tag {
 padding:0.25rem0.6rem;
 font-size:0.82rem;
 border-radius:999px;
 background: var(--mw-bg-soft);
 border:1px solid transparent;
 color: var(--mw-text-muted);
 cursor: pointer;
 transition: background0.2s, color0.2s, border0.2s;
}
.al__tag:hover { color: var(--mw-text); border-color: var(--mw-border); }
.al__tag--active {
 background: var(--mw-primary-soft);
 color: var(--mw-primary);
 border-color: var(--mw-primary);
 font-weight:500;
}
.al__tag-clear {
 padding:0.25rem0.6rem;
 font-size:0.82rem;
 background: transparent;
 border: none;
 color: var(--mw-danger, #ef4444);
 cursor: pointer;
}

/* =====错误 ===== */
.al__error {
 padding:0.75rem1rem;
 background: color-mix(in srgb, var(--mw-danger, #ef4444)12%, transparent);
 border:1px solid var(--mw-danger, #ef4444);
 border-radius:8px;
 color: var(--mw-danger, #ef4444);
 font-size:0.9rem;
}

/* =====网格 ===== */
.al__grid {
 display: grid;
 grid-template-columns: repeat(auto-fill, minmax(180px,1fr));
 gap:1rem;
 position: relative;
 min-height:240px;
}
.al__grid--dragover::after {
 content: '';
 position: absolute;
 inset:0;
 border:2px dashed var(--mw-primary);
 border-radius:12px;
 background: var(--mw-primary-soft);
 pointer-events: none;
 z-index:5;
}
.al__drop-hint {
 position: absolute;
 inset:0;
 display: grid;
 place-items: center;
 z-index:10;
 pointer-events: none;
}
.al__drop-icon { font-size:3rem; color: var(--mw-primary); }
.al__drop-text {
 font-size:1.1rem;
 font-weight:600;
 color: var(--mw-primary);
 margin-top:0.5rem;
}

/* =====卡片 ===== */
.al__card {
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 border-radius:10px;
 overflow: hidden;
 display: flex;
 flex-direction: column;
 transition: transform0.15s, border-color0.15s, box-shadow0.15s;
}
.al__card:hover {
 transform: translateY(-2px);
 border-color: var(--mw-primary);
 box-shadow:06px16px color-mix(in srgb, var(--mw-primary)18%, transparent);
}
.al__card--selected {
 border-color: var(--mw-primary);
 background: var(--mw-primary-soft);
}

/*缩略图 */
.al__thumb {
 position: relative;
 aspect-ratio:1 /1;
 background: var(--mw-bg-soft);
 display: grid;
 place-items: center;
 border-bottom:1px solid var(--mw-border);
}
.al__thumb--image { background: linear-gradient(135deg, color-mix(in srgb, #f59e0b22%, var(--mw-bg-soft)), var(--mw-bg-soft)); }
.al__thumb--video { background: linear-gradient(135deg, color-mix(in srgb, #8b5cf622%, var(--mw-bg-soft)), var(--mw-bg-soft)); }
.al__thumb--audio { background: linear-gradient(135deg, color-mix(in srgb, #06b6d422%, var(--mw-bg-soft)), var(--mw-bg-soft)); }
.al__thumb--character { background: linear-gradient(135deg, color-mix(in srgb, #ec489922%, var(--mw-bg-soft)), var(--mw-bg-soft)); }
.al__thumb--scene { background: linear-gradient(135deg, color-mix(in srgb, #10b98122%, var(--mw-bg-soft)), var(--mw-bg-soft)); }
.al__thumb-icon { font-size:2.8rem; opacity:0.85; }
.al__thumb-format {
 position: absolute;
 bottom:0.4rem;
 right:0.5rem;
 font-size:0.7rem;
 padding:0.1rem0.35rem;
 background: color-mix(in srgb, var(--mw-bg)65%, transparent);
 border-radius:4px;
 color: var(--mw-text-muted);
 text-transform: uppercase;
 letter-spacing:0.5px;
}
.al__fav {
 position: absolute;
 top:0.4rem;
 right:0.5rem;
 width:28px; height:28px;
 border: none;
 background: color-mix(in srgb, var(--mw-bg)70%, transparent);
 border-radius:999px;
 color: var(--mw-text-muted);
 font-size:1rem;
 cursor: pointer;
 transition: color0.15s, transform0.15s;
 display: grid;
 place-items: center;
}
.al__fav:hover { transform: scale(1.1); }
.al__fav--on { color: var(--mw-warning, #f59e0b); }
.al__select {
 position: absolute;
 top:0.4rem;
 left:0.5rem;
 width:22px; height:22px;
 background: color-mix(in srgb, var(--mw-bg)70%, transparent);
 border-radius:4px;
 display: grid;
 place-items: center;
 cursor: pointer;
}
.al__select input { accent-color: var(--mw-primary); cursor: pointer; }

/* 信息 */
.al__info {
 padding:0.6rem0.75rem;
 flex:1;
 display: flex;
 flex-direction: column;
 gap:0.3rem;
}
.al__name {
 margin:0;
 font-size:0.9rem;
 font-weight:500;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 cursor: text;
}
.al__meta {
 display: flex;
 justify-content: space-between;
 font-size:0.75rem;
 color: var(--mw-text-muted);
}
.al__meta-cat { text-transform: capitalize; }
.al__tags { display: flex; flex-wrap: wrap; gap:0.25rem; }
.al__mini-tag {
 font-size:0.7rem;
 padding:0.05rem0.35rem;
 background: var(--mw-bg-soft);
 border-radius:999px;
 color: var(--mw-text-muted);
}
.al__mini-tag-more { font-size:0.7rem; color: var(--mw-text-muted); }
.al__rename {
 display: flex;
 gap:0.25rem;
 align-items: center;
}
.al__rename-input {
 flex:1;
 padding:0.25rem0.4rem;
 font-size:0.85rem;
 background: var(--mw-bg);
 border:1px solid var(--mw-primary);
 border-radius:4px;
 color: var(--mw-text);
 outline: none;
}

/* 操作 */
.al__actions {
 display: flex;
 border-top:1px solid var(--mw-border);
}
.al__act {
 flex:1;
 padding:0.45rem;
 background: transparent;
 border: none;
 color: var(--mw-text-muted);
 cursor: pointer;
 font-size:0.9rem;
 transition: background0.15s, color0.15s;
}
.al__act:hover { background: var(--mw-bg-soft); color: var(--mw-text); }
.al__act--danger { color: var(--mw-danger, #ef4444); font-weight:700; }
.al__act--danger:hover { background: color-mix(in srgb, var(--mw-danger, #ef4444)12%, transparent); }

/* =====骨架 ===== */
.al__skeleton-grid {
 display: contents;
}
.al__skeleton-card {
 aspect-ratio:1 /1.4;
 background: linear-gradient(90deg, var(--mw-bg-soft), var(--mw-surface), var(--mw-bg-soft));
 background-size:200%100%;
 border-radius:10px;
 animation: al-shimmer1.5s infinite;
}
@keyframes al-shimmer {
0% { background-position:200%0; }
100% { background-position: -200%0; }
}

/* ===== 空状态 ===== */
.al__empty {
 grid-column:1 / -1;
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: center;
 gap:1rem;
 padding:3rem1rem;
 background: var(--mw-surface);
 border:2px dashed var(--mw-border);
 border-radius:12px;
}
.al__empty-icon { font-size:3rem; opacity:0.55; }
.al__empty-text { color: var(--mw-text-muted); font-size:0.95rem; text-align: center; }

/* =====响应式 ===== */
@media (max-width:768px) {
 .al__nav-links { display: none; }
 .al__grid { grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); }
}
</style>
