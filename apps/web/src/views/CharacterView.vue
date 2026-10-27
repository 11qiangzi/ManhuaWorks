<script setup lang="ts">
/**
 * CharacterView.vue — 角色管理主视图 (L3.B 林染: 真 API 接入 + UI 改版)
 *
 * L2: archetype 模板化角色系统 (6 类 × 卡片)
 * L3.B: 接真 API (apiClient.projects.listMembers),加 Pinia store,加 loading/error
 * 2026-06-09: 5 个 bug 修 + 4 区块 UI 改版 (梁总点名)
 *
 * 数据流:
 *   1. onMounted → useCharacterStore().load(projectId, mockFallback)
 *   2. API 成功 → store.characters = API 数据
 *   3. API 失败/超时 → 自动回退 mock,顶部黄条提示
 *   4. "+ 新成员"用 modal 收集信息 (非 prompt)
 *   5. 删除走真 API/modal,乐观更新+回滚
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CHARACTER_ARCHETYPES_V2, getArchetypeMeta } from '../data/character-archetypes-v2'
import { STUDIO_THEMES, type StudioThemeId } from '../types/studio'
import type { CharacterV2, CharacterExpression, CharacterArchetype } from '../types/character'
import { useCharacterStore } from '../stores/characterStore'
import type { CharacterItem } from '../stores/characterStore'
import { useTheme } from '../composables/useTheme'

// ---------- 本地类型: 工作室角色 (成员管理, 纯前端) ----------
type StudioRole = 'admin' | 'writer' | 'artist' | 'voice' | 'subtitle' | 'viewer'

const ROLE_BADGE: Record<StudioRole, { icon: string; label: string }> = {
  admin:    { icon: '👑', label: '管理员' },
  writer:   { icon: '✍️', label: '编剧' },
  artist:   { icon: '🎨', label: '画师' },
  voice:    { icon: '🎙️', label: '配音' },
  subtitle: { icon: '📝', label: '字幕' },
  viewer:   { icon: '👁️', label: '观看' },
}
import ArchetypePicker from '../components/character/ArchetypePicker.vue'
import CharacterForm from '../components/character/CharacterForm.vue'

// ---------- 默认 project (开发期用) ----------
const DEFAULT_PROJECT_ID = 'proj_default_001'

// ---------- router ----------
const router = useRouter()

function editCharacter(id: string) {
  router.push(`/characters/${id}/edit`)
}

// ---------- store ----------
const store = useCharacterStore()

// ---------- API → 本地类型转换 ----------
function itemToV2(item: CharacterItem): CharacterV2 {
  return {
    id: item.id,
    name: item.name,
    archetype: (item.archetype || 'youth') as CharacterArchetype,
    description: item.description || '',
    views: { front: item.thumbnail_url || null, side: null, back: null, threeQ: null },
    expressions: [],
    tags: item.tags || [],
    vector: [],
    styleId: 'default',
    themeId: 'dark-workshop',
    locked: false,
    consistencyScore: 80,
    relatedIds: [],
    createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
  }
}

// ---------- 本地状态 (archetype 模板相关) ----------
const localCharacters = ref<CharacterV2[]>([])
const activeArchetype = ref<CharacterArchetype | null>(null)
const selectedId = ref<string | null>(localCharacters.value[0]?.id ?? null)
const searchQuery = ref('')
const studioRoleFilter = ref<StudioRole | 'all'>('all')

// ---------- 本地成员数据 (不走 store, store 只管角色 CRUD) ----------
interface LocalMember {
  user_id: string
  display_name: string
  email: string
  avatar_url?: string
  role: StudioRole
  joined_at: string
}

const members = ref<LocalMember[]>([
  { user_id: 'u_admin',   display_name: '林启',  email: 'admin@mhw.dev',  role: 'admin',   joined_at: new Date().toISOString() },
  { user_id: 'u_writer1', display_name: '王编剧', email: 'writer@mhw.dev', role: 'writer',  joined_at: new Date().toISOString() },
  { user_id: 'u_artist1', display_name: '李画师', email: 'artist@mhw.dev', role: 'artist',  joined_at: new Date().toISOString() },
  { user_id: 'u_voice1',  display_name: '张配音', email: 'voice@mhw.dev',  role: 'voice',   joined_at: new Date().toISOString() },
  { user_id: 'u_sub1',    display_name: '陈字幕', email: 'sub@mhw.dev',    role: 'viewer',  joined_at: new Date().toISOString() },
])

// ---------- 主题 (via useTheme composable) ----------
const { current: theme } = useTheme()
const themeId = ref<StudioThemeId>(theme.value as StudioThemeId ?? 'dark-workshop')

function applyTheme() {
  document.documentElement.setAttribute('data-theme', themeId.value)
  const meta = STUDIO_THEMES.find(t => t.id === themeId.value)
  if (meta) {
    document.documentElement.style.setProperty('--theme-accent', meta.accent)
    document.documentElement.style.setProperty('--theme-primary', meta.primary)
  }
}
watch(themeId, t => {
  theme.value = t as any // sync to composable (handles localStorage persistence)
  applyTheme()
}, { immediate: true })

// Bug A: setTheme 供 5 主题按钮 @click 调用
function setTheme(id: StudioThemeId) {
  themeId.value = id
}

// Bug B: "+ 新成员" modal (替换 window.prompt)
const showMemberModal = ref(false)
const memberForm = ref({ email: '', displayName: '', studioRole: 'writer' as StudioRole })

function openMemberModal() {
  memberForm.value = { email: '', displayName: '', studioRole: 'writer' }
  showMemberModal.value = true
}

function submitMember() {
  const email = memberForm.value.email.trim()
  if (!email) return
  members.value.push({
    user_id: `u_${Date.now().toString(36)}`,
    email,
    display_name: memberForm.value.displayName.trim() || email.split('@')[0] || '',
    role: memberForm.value.studioRole,
    joined_at: new Date().toISOString(),
  })
  showMemberModal.value = false
}

// ---------- 初始化 ----------
onMounted(async () => {
  applyTheme()
  // store 只管角色 CRUD, 成员数据已是本地 ref
  await store.load(DEFAULT_PROJECT_ID, [])
})

// API 数据加载后同步到 localCharacters (防 split-brain: store 与 local 双向合并)
watch(() => store.characters, (storeChars) => {
  if (store.lastSource === 'api') {
    // Full replace from API — authoritative source
    localCharacters.value = storeChars.map(itemToV2)
    selectedId.value = localCharacters.value[0]?.id ?? null
  } else if (store.lastSource === 'empty' && storeChars.length > 0) {
    // Store got new data after a failed/empty load (e.g. post-create) — merge in
    const localIds = new Set(localCharacters.value.map(c => c.id))
    const newItems = storeChars.filter(c => !localIds.has(c.id))
    if (newItems.length > 0) {
      localCharacters.value = [...localCharacters.value, ...newItems.map(itemToV2)]
      if (!selectedId.value) {
        selectedId.value = localCharacters.value[0]?.id ?? null
      }
    }
  }
}, { deep: true })

// ---------- 派生 (本地成员视图) ----------
const filteredApiMembers = computed(() => {
  let list = members.value
  if (studioRoleFilter.value !== 'all') {
    list = list.filter(m => m.role === studioRoleFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(m =>
      m.display_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q),
    )
  }
  return list
})

const memberCountByRole = computed<Record<StudioRole, number>>(() => {
  const counts: Record<string, number> = {}
  for (const r of Object.keys(ROLE_BADGE)) counts[r] = 0
  for (const m of members.value) counts[m.role] = (counts[m.role] ?? 0) + 1
  return counts as Record<StudioRole, number>
})

// ---------- 派生 (archetype 模板视图) ----------
const countMap = computed(() => {
  const m: Record<string, number> = {}
  for (const c of localCharacters.value) m[c.archetype] = (m[c.archetype] ?? 0) + 1
  return m as Record<CharacterArchetype, number>
})

const filteredCharacters = computed(() => {
  let list = localCharacters.value
  if (activeArchetype.value) {
    list = list.filter(c => c.archetype === activeArchetype.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q)),
    )
  }
  return list
})

const selected = computed<CharacterV2 | null>(
  () => localCharacters.value.find(c => c.id === selectedId.value) ?? null,
)

const selectedMeta = computed(() =>
  selected.value ? getArchetypeMeta(selected.value.archetype) : null,
)

// ---------- archetype 模板操作 ----------
function onPickArchetype(id: CharacterArchetype) {
  activeArchetype.value = activeArchetype.value === id ? null : id
}

function onSelect(id: string) {
  selectedId.value = id
}

function onPatch(updated: CharacterV2) {
  const i = localCharacters.value.findIndex(c => c.id === updated.id)
  if (i < 0) return
  localCharacters.value[i] = updated
}

function onAddExpression(exp: CharacterExpression) {
  if (!selected.value) return
  const next: CharacterV2 = { ...selected.value, expressions: [...selected.value.expressions, exp], updatedAt: Date.now() }
  onPatch(next)
}

function onRemoveExpression(id: string) {
  if (!selected.value) return
  const next: CharacterV2 = { ...selected.value, expressions: selected.value.expressions.filter(e => e.id !== id), updatedAt: Date.now() }
  onPatch(next)
}

function onNew() {
  const arch: CharacterArchetype = activeArchetype.value ?? 'youth'
  const meta = getArchetypeMeta(arch)
  const id = `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const c: CharacterV2 = {
    id, name: `${meta.label} · 新角色`, archetype: arch,
    description: meta.description.split('。')[0] ?? meta.tagline,
    views: { front: null, side: null, back: null, threeQ: null },
    expressions: meta.defaultExpressions.slice(0, 3).map((e, k) => ({
      id: `${id}-${e}`, name: e, icon: (['😐', '😠', '😊', '😢', '😲', '😨'][k % 6] ?? '😐'),
    })),
    tags: [meta.code], vector: [], styleId: meta.styleId,
    themeId: themeId.value, locked: false, consistencyScore: 80, relatedIds: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  }
  localCharacters.value.unshift(c)
  selectedId.value = id
  // Persist to API in background
  store.create({ name: c.name, archetype: arch, description: c.description }).catch((e) => { console.warn('create character failed:', e) })
}

// 删除用 modal 确认, 不用 confirm()
const showDeleteModal = ref(false)

function promptDelete() {
  if (!selected.value) return
  showDeleteModal.value = true
}

function confirmDelete() {
  if (!selected.value) return
  const deleteId = selected.value.id
  const i = localCharacters.value.findIndex(c => c.id === deleteId)
  if (i < 0) return
  localCharacters.value.splice(i, 1)
  selectedId.value = localCharacters.value[0]?.id ?? null
  showDeleteModal.value = false
  // Persist to API in background
  store.remove(deleteId).catch((e) => { console.warn('remove character failed:', e) })
}

function onDuplicate() {
  if (!selected.value) return
  const src = selected.value
  const id = `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const copy: CharacterV2 = { ...src, id, name: `${src.name} · 副本`, locked: false, createdAt: Date.now(), updatedAt: Date.now() }
  localCharacters.value.push(copy)
  selectedId.value = id
}

// ---------- 本地成员操作 ----------
const showMemberDeleteModal = ref(false)
const pendingDeleteMember = ref<{ userId: string; displayName: string } | null>(null)

function onDeleteMember(userId: string, displayName: string) {
  pendingDeleteMember.value = { userId, displayName }
  showMemberDeleteModal.value = true
}

function confirmDeleteMember() {
  if (!pendingDeleteMember.value) return
  members.value = members.value.filter(m => m.user_id !== pendingDeleteMember.value!.userId)
  showMemberDeleteModal.value = false
  pendingDeleteMember.value = null
}

// ---------- 成员编辑 (placeholder — 编辑 UI 开发中) ----------
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const toast = {
  info(msg: string) {
    toastMessage.value = msg
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, 3000)
  },
}

function editMember(member: LocalMember) {
  // For now, show member info
  toast.info(`${member.display_name} — ${ROLE_BADGE[member.role]?.label ?? member.role}（编辑功能开发中）`)
}

function formatJoined(iso: string): string {
  try { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  catch { return iso.slice(0, 10) }
}

function getInitial(name: string): string { return (name || '?').slice(0, 1).toUpperCase() }

function avatarColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 60% 50%)`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// 选中卡片对应的当前主题 accent (供 CSS v-bind)
const currentAccent = computed(() => STUDIO_THEMES.find(t => t.id === themeId.value)?.accent ?? '#f59e0b')
</script>

<template>
  <div class="character-view flex h-full w-full flex-col overflow-hidden bg-gray-100 dark:bg-gray-950">
    <!-- ════════════ 1. 顶部工具条 ════════════ -->
    <header class="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <!-- 左: 标题 + 数据源 -->
      <div class="flex items-center gap-2.5 text-sm font-semibold text-gray-700 dark:text-gray-100">
        <span>🎭 角色管理</span>
        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
          {{ members.length }} 成员 · {{ localCharacters.length }} archetype
        </span>
        <span
          v-if="store.lastSource === 'api'"
          class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300"
        >● API</span>
        <span
          v-else-if="store.lastSource === 'mock'"
          class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        >● 本地</span>
        <span
          v-if="store.loading"
          class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >⟳ 加载中</span>
      </div>

      <!-- 右: 搜索 + 主题切换 + 操作按钮 -->
      <div class="flex items-center gap-2">
        <!-- Bug D: placeholder 明确搜角色, archetype 不受影响 -->
        <input
          v-model="searchQuery"
          placeholder="搜索角色名称或标签"
          class="w-48 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] placeholder-gray-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:placeholder-gray-500"
        />

        <!-- Bug A: 5 主题按钮, 绑定 @click="setTheme(t.id)" -->
        <div class="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            v-for="t in STUDIO_THEMES"
            :key="t.id"
            :title="t.label"
            class="theme-opt rounded-md px-2 py-1 text-[13px] leading-none transition-all hover:scale-110"
            :class="{ 'theme-opt--active bg-gray-200 ring-1 ring-gray-300 dark:bg-gray-700': themeId === t.id }"
            @click="setTheme(t.id)"
          >{{ t.icon }}</button>
        </div>

        <button
          class="rounded-lg bg-blue-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow-md active:scale-95 disabled:opacity-50"
          :disabled="store.loading"
          @click="openMemberModal"
        >+ 新成员</button>
        <button
          class="rounded-lg bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-amber-600 hover:shadow-md active:scale-95"
          @click="onNew"
        >+ 新角色</button>
      </div>
    </header>

    <!-- 错误横幅 -->
    <div
      v-if="store.error"
      class="flex items-center justify-between border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <span>⚠️ {{ store.error }}</span>
      <button class="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700" @click="store.clearError()">✕</button>
    </div>

    <!-- ════════════ 2. 团队成员区 ════════════ -->
    <section class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="mb-2.5 flex items-center gap-3">
        <h3 class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">🧑‍🤝‍🧑 团队成员</h3>
        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            class="rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors"
            :class="studioRoleFilter === 'all'
              ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'"
            @click="studioRoleFilter = 'all'"
          >全部 {{ members.length }}</button>
          <button
            v-for="r in (Object.keys(ROLE_BADGE) as StudioRole[])"
            :key="r"
            type="button"
            class="rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors"
            :class="studioRoleFilter === r
              ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'"
            @click="studioRoleFilter = r"
          >{{ ROLE_BADGE[r].icon }} {{ ROLE_BADGE[r].label }} {{ memberCountByRole[r] }}</button>
        </div>
      </div>

      <!-- 加载骨架 -->
      <div v-if="store.loading && store.characters.length === 0" class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div v-for="i in 5" :key="i" class="flex animate-pulse items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div class="h-11 w-11 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div class="flex flex-1 flex-col gap-1.5">
            <div class="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div class="h-2.5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else-if="filteredApiMembers.length === 0" class="flex h-12 items-center justify-center text-[11px] text-gray-400">
        {{ members.length === 0 ? '暂无成员，点击「+ 新成员」添加' : '无匹配成员' }}
      </div>

      <!-- 成员卡片: 横向大卡片, 圆形头像 + 姓名 + 角色徽章 + 邮箱 -->
      <div v-else class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <div
          v-for="m in filteredApiMembers"
          :key="m.user_id"
          class="group flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
        >
          <!-- 圆形头像 (initials + 渐变色) -->
          <img
            v-if="m.avatar_url"
            :src="m.avatar_url"
            :alt="m.display_name"
            class="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-600"
          />
          <div
            v-else
            class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/20 shadow-inner"
            :style="{ background: avatarColor(m.user_id) }"
          >{{ getInitial(m.display_name) }}</div>

          <!-- 信息区 -->
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{{ m.display_name }}</div>
            <div class="truncate text-[10px] text-gray-400">{{ m.email }}</div>
            <div class="mt-1 flex items-center gap-1.5">
              <span
                class="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                :class="{
                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300':    m.role === 'admin',
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300':  m.role === 'writer' || m.role === 'artist' || m.role === 'voice',
                  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300':  m.role === 'viewer' || m.role === 'subtitle',
                }"
              >{{ ROLE_BADGE[m.role]?.icon ?? '👤' }} {{ ROLE_BADGE[m.role]?.label ?? m.role }}</span>
              <span class="text-[9px] text-gray-400">{{ formatJoined(m.joined_at) }}</span>
            </div>
          </div>

          <!-- hover 操作 -->
          <div class="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="rounded-lg bg-gray-100 p-1 text-[10px] hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              title="编辑"
              @click="editMember(m)"
            >✏️</button>
            <button
              class="rounded-lg bg-red-50 p-1 text-[10px] text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              title="删除成员" :disabled="store.loading"
              @click="onDeleteMember(m.user_id, m.display_name)"
            >🗑</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════ 3. 角色库 (archetype 选择 + 角色卡片) ════════════ -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左: 角色列表区 -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <!-- Bug D: archetype 区顶部加"类型选择"标签, 区分下方角色库 -->
        <div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
          <div class="mb-1.5 flex items-center gap-2">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">📂 类型选择（不受搜索影响）</span>
          </div>
          <ArchetypePicker
            :model-value="activeArchetype"
            :theme-id="themeId"
            :count-map="countMap"
            @pick="onPickArchetype"
          />
        </div>

        <!-- 搜索提示条 (有搜索词时显示) -->
        <div
          v-if="searchQuery.trim()"
          class="flex-shrink-0 border-b border-blue-200 bg-blue-50/60 px-4 py-1.5 text-[10px] text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
        >
          🔍 搜索 "{{ searchQuery }}" — 显示 {{ filteredCharacters.length }} 个角色卡片（上方类型选择不参与过滤）
        </div>

        <!-- 角色卡片网格: 4 列大卡 (改版) -->
        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="filteredCharacters.length === 0"
            class="flex h-32 items-center justify-center text-xs text-gray-400"
          >
            {{ activeArchetype ? '此类型暂无角色' : '暂无角色，点击右上角"+ 新角色"新建' }}
          </div>
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div
              v-for="c in filteredCharacters"
              :key="c.id"
              class="character-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
              :class="{ 'archetype-card--selected': selectedId === c.id }"
              @click="onSelect(c.id)"
            >
              <!-- 16:9 占位图区 (渐变 + archetype 图标) -->
              <div
                class="relative flex aspect-video items-center justify-center overflow-hidden"
                :style="{
                  background: `linear-gradient(135deg, ${getArchetypeMeta(c.archetype).color}22 0%, ${getArchetypeMeta(c.archetype).colorAccent || getArchetypeMeta(c.archetype).color}18 100%)`,
                }"
              >
                <span class="text-5xl opacity-40">{{ getArchetypeMeta(c.archetype).icon }}</span>
                <!-- archetype 标签 (左上角) -->
                <span
                  class="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm"
                  :style="{ background: `${getArchetypeMeta(c.archetype).color}22`, color: getArchetypeMeta(c.archetype).color }"
                >{{ getArchetypeMeta(c.archetype).label }}</span>
                <!-- 锁定标记 -->
                <span v-if="c.locked" class="absolute right-2.5 top-2.5 text-sm" title="已锁定">🔒</span>
              </div>

              <!-- 内容区 -->
              <div class="flex flex-1 flex-col gap-1.5 p-3.5">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ c.name }}</div>
                <p class="line-clamp-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{{ c.description }}</p>

                <!-- 标签 chips -->
                <div v-if="c.tags.length" class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in c.tags.slice(0, 3)"
                    :key="tag"
                    class="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >{{ tag }}</span>
                  <span v-if="c.tags.length > 3" class="text-[9px] text-gray-400">+{{ c.tags.length - 3 }}</span>
                </div>

                <!-- 底部统计 -->
                <div class="mt-auto flex items-center gap-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400 dark:border-gray-800">
                  <span class="flex items-center gap-1">
                    <span class="text-green-500">✓</span> {{ c.consistencyScore }}
                  </span>
                  <span class="flex items-center gap-1">😊 {{ c.expressions.length }}</span>
                  <span class="flex items-center gap-1">🏷️ {{ c.tags.length }}</span>
                  <span class="ml-auto text-[9px] opacity-60">{{ formatTime(c.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════ 4. 角色详情面板 (sticky 右侧) ════════════ -->
      <aside
        v-if="selected && selectedMeta"
        class="detail-panel w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <!-- 标题栏 -->
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
          <h3 class="text-xs font-semibold text-gray-800 dark:text-gray-100">
            {{ selectedMeta.icon }} 角色详情
          </h3>
          <div class="flex items-center gap-1">
            <button
              class="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
              title="编辑" @click="editCharacter(selected.id)"
            >✏️ 编辑</button>
            <button
              class="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              title="复制" @click="onDuplicate"
            >📋 复制</button>
            <button
              class="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              title="删除" @click="promptDelete"
            >🗑 删除</button>
          </div>
        </div>

        <div class="p-4">
          <!-- 大占位图 -->
          <div
            class="mb-3 flex aspect-square items-center justify-center rounded-xl"
            :style="{ background: `linear-gradient(135deg, ${selectedMeta.color}22 0%, ${selectedMeta.colorAccent || selectedMeta.color}18 100%)` }"
          >
            <span class="text-6xl opacity-40">{{ selectedMeta.icon }}</span>
          </div>

          <!-- 名字 + archetype 徽章 -->
          <div class="mb-2 flex items-center gap-2">
            <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ selected.name }}</h4>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :style="{ background: `${selectedMeta.color}18`, color: selectedMeta.color }"
            >{{ selectedMeta.label }}</span>
          </div>

          <!-- 描述 -->
          <p class="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{{ selected.description }}</p>

          <!-- 4 视图缩略图 -->
          <div class="mb-3">
            <h5 class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">视图集</h5>
            <div class="grid grid-cols-4 gap-1.5">
              <div
                v-for="view in (['front','side','back','threeQ'] as const)"
                :key="view"
                class="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-[14px] dark:bg-gray-800"
                :title="{ front: '正面', side: '侧面', back: '背面', threeQ: '3/4' }[view]"
              >{{ { front: '🧑', side: '👤', back: '👤', threeQ: '🔄' }[view] }}</div>
            </div>
          </div>

          <!-- 表情列表 -->
          <div class="mb-3">
            <h5 class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">表情 ({{ selected.expressions.length }})</h5>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="e in selected.expressions"
                :key="e.id"
                class="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] dark:bg-gray-800"
              >{{ e.icon }} {{ e.name }}</span>
            </div>
          </div>

          <!-- 标签 -->
          <div v-if="selected.tags.length" class="mb-3">
            <h5 class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">标签</h5>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="tag in selected.tags"
                :key="tag"
                class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
              >{{ tag }}</span>
            </div>
          </div>

          <!-- 统计信息 -->
          <div class="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div class="grid grid-cols-2 gap-2 text-[10px]">
              <div><span class="text-gray-400">风格 ID</span><br><span class="font-medium text-gray-700 dark:text-gray-300">{{ selected.styleId }}</span></div>
              <div><span class="text-gray-400">一致性</span><br><span class="font-medium text-green-600">✓ {{ selected.consistencyScore }}</span></div>
              <div><span class="text-gray-400">创建</span><br><span class="font-medium text-gray-700 dark:text-gray-300">{{ formatTime(selected.createdAt) }}</span></div>
              <div><span class="text-gray-400">更新</span><br><span class="font-medium text-gray-700 dark:text-gray-300">{{ formatTime(selected.updatedAt) }}</span></div>
            </div>
          </div>

          <!-- CharacterForm (编辑) -->
          <details class="mt-3" open>
            <summary class="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">📝 编辑</summary>
            <div class="mt-2">
              <CharacterForm
                :model-value="selected"
                readonly-archetype
                @update:model-value="onPatch"
                @add-expression="onAddExpression"
                @remove-expression="onRemoveExpression"
              />
            </div>
          </details>
        </div>
      </aside>

      <!-- 未选中时占位 -->
      <aside
        v-else
        class="detail-panel flex w-80 flex-shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50/50 p-8 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div class="text-center">
          <div class="mb-2 text-4xl opacity-30">👈</div>
          <p class="text-[11px] leading-relaxed text-gray-400">选择左侧角色卡片<br>查看详情与编辑</p>
        </div>
      </aside>
    </div>

    <!-- ════════════ Bug B: 新成员 Modal ════════════ -->
    <Teleport to="body">
      <div
        v-if="showMemberModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showMemberModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
          <h3 class="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">添加新成员</h3>

          <label class="mb-2 block">
            <span class="mb-1 block text-[11px] font-medium text-gray-500">邮箱</span>
            <input
              v-model="memberForm.email"
              type="email"
              placeholder="name@mhw.dev"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              @keydown.enter="submitMember"
            />
          </label>

          <label class="mb-2 block">
            <span class="mb-1 block text-[11px] font-medium text-gray-500">显示名</span>
            <input
              v-model="memberForm.displayName"
              placeholder="可留空，自动取邮箱前缀"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
              @keydown.enter="submitMember"
            />
          </label>

          <label class="mb-4 block">
            <span class="mb-1 block text-[11px] font-medium text-gray-500">角色</span>
            <select
              v-model="memberForm.studioRole"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800"
            >
              <option v-for="(badge, role) in ROLE_BADGE" :key="role" :value="role">
                {{ badge.icon }} {{ badge.label }}
              </option>
            </select>
          </label>

          <div class="flex justify-end gap-2">
            <button
              class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showMemberModal = false"
            >取消</button>
            <button
              class="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              :disabled="!memberForm.email.trim() || store.loading"
              @click="submitMember"
            >{{ store.loading ? '创建中…' : '确认添加' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ════════════ 删除确认 Modal ════════════ -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showDeleteModal = false"
      >
        <div class="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
          <h3 class="mb-2 text-base font-semibold text-gray-800 dark:text-gray-100">确认删除</h3>
          <p class="mb-4 text-xs text-gray-500">
            删除角色 <strong class="text-gray-700 dark:text-gray-300">{{ selected?.name }}</strong>？此操作不可撤销。
          </p>
          <div class="flex justify-end gap-2">
            <button
              class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showDeleteModal = false"
            >取消</button>
            <button
              class="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
              @click="confirmDelete"
            >确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ════════════ 成员删除确认 Modal ════════════ -->
    <Teleport to="body">
      <div
        v-if="showMemberDeleteModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showMemberDeleteModal = false"
      >
        <div class="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
          <h3 class="mb-2 text-base font-semibold text-gray-800 dark:text-gray-100">确认删除成员</h3>
          <p class="mb-4 text-xs text-gray-500">
            删除成员 <strong class="text-gray-700 dark:text-gray-300">{{ pendingDeleteMember?.displayName }}</strong>？
          </p>
          <div class="flex justify-end gap-2">
            <button
              class="rounded-lg border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="showMemberDeleteModal = false"
            >取消</button>
            <button
              class="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
              @click="confirmDeleteMember"
            >确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ════════════ Toast 通知 ════════════ -->
    <Teleport to="body">
      <Transition name="toast-fade">
        <div
          v-if="toastVisible"
          class="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-gray-200 dark:text-gray-900"
        >
          {{ toastMessage }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.character-view {
  min-height: 0;
  flex: 1;
  background: var(--bg-primary, #0a0e1a) !important;
}

/* Dark bg override for sections */
.character-view header {
  background: var(--bg-secondary, #111827) !important;
  border-color: var(--border, #1f2937) !important;
}
.character-view section {
  background: var(--bg-secondary, #111827) !important;
  border-color: var(--border, #1f2937) !important;
}

/* ── 行截断 ── */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Bug A: 主题按钮 ── */
.theme-opt {
  transition: all 0.15s ease;
}
.theme-opt:not(.theme-opt--active):hover {
  background: rgba(0,0,0,0.04);
}
:root[data-theme="dark-workshop"] .theme-opt:not(.theme-opt--active):hover,
:root[data-theme="neon-cyber"] .theme-opt:not(.theme-opt--active):hover {
  background: rgba(255,255,255,0.06);
}

/* ── Bug C: 角色卡选中态 (主题响应) ── */
.archetype-card--selected {
  border-color: var(--theme-accent, #f59e0b) !important;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08) !important;
  transform: translateY(-1px);
}

/* ── 详情面板 sticky ── */
.detail-panel {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 3rem);
}

/* ── 角色卡片过渡 ── */
.character-card {
  transition: all 0.2s ease;
}

/* ── 按钮通用 active 反馈 ── */
button:active:not(:disabled) {
  transform: scale(0.96);
}

/* ── modal backdrop 动画 ── */
.fixed.inset-0 {
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── Toast 通知 ── */
.toast-fade-enter-active, .toast-fade-leave-active { transition: all 0.25s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
