<script setup lang="ts">
/**
 * ReferenceImagesView.vue — 参考图管理
 * ManhuaWorks P0 · 参考图数据库前端
 *
 * 功能: 按实体类型(角色/场景/产品/风格)管理多角度参考图
 * 后端: api.referenceImages (6 endpoints @ /v1/reference-images)
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReferenceImageStore } from '../stores/referenceImageStore'
import type { RefEntityType, RefImageType, ReferenceImageDTO } from '@manhuaworks/api-client'

const route = useRoute()
const router = useRouter()
const store = useReferenceImageStore()

const projectId = computed(() => route.params.id as string)

// ============ 实体类型 Tab ============
const ENTITY_TYPES: { id: RefEntityType; label: string; icon: string }[] = [
  { id: 'character', label: '角色', icon: '👤' },
  { id: 'scene', label: '场景', icon: '🏞' },
  { id: 'product', label: '产品', icon: '📦' },
  { id: 'style', label: '风格', icon: '🎨' },
]

const activeType = ref<RefEntityType | 'all'>('all')

// ============ 图片类型常量 ============
const IMAGE_TYPES: { id: RefImageType; label: string }[] = [
  { id: 'front', label: '正面' },
  { id: 'side_left', label: '左侧' },
  { id: 'side_right', label: '右侧' },
  { id: 'three_quarter', label: '3/4侧面' },
  { id: 'back', label: '背面' },
  { id: 'full_body', label: '全身' },
  { id: 'close_up', label: '特写' },
  { id: 'detail', label: '细节' },
  { id: 'full_scene', label: '全景' },
  { id: 'atmosphere', label: '氛围' },
  { id: 'style_ref', label: '风格参考' },
]

const IMAGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  IMAGE_TYPES.map(t => [t.id, t.label])
)

// ============ 筛选 ============
const searchKeyword = ref('')
const selectedEntityId = ref<string | null>(null)

const entityIds = computed(() => {
  const ids = new Set<string>()
  for (const img of store.images) {
    if (activeType.value === 'all' || img.entity_type === activeType.value) {
      ids.add(img.entity_id)
    }
  }
  return Array.from(ids).sort()
})

const filteredImages = computed(() => {
  let list = store.images
  if (activeType.value !== 'all') {
    list = list.filter(i => i.entity_type === activeType.value)
  }
  if (selectedEntityId.value) {
    list = list.filter(i => i.entity_id === selectedEntityId.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(i =>
      (i.description ?? '').toLowerCase().includes(kw) ||
      i.entity_id.toLowerCase().includes(kw) ||
      i.image_type.toLowerCase().includes(kw)
    )
  }
  return list
})

// ============ 创建弹窗 ============
const showCreateModal = ref(false)
const createEntityType = ref<RefEntityType>('character')
const createEntityId = ref('')
const createImageUrl = ref('')
const createImageType = ref<RefImageType>('front')
const createDescription = ref('')
const creating = ref(false)

// 批量上传状态
const batchMode = ref(false)
const batchImages = ref<Array<{ imageUrl: string; imageType: RefImageType; description: string }>>([])

function openCreateModal() {
  showCreateModal.value = true
  createEntityType.value = activeType.value === 'all' ? 'character' : activeType.value
  createEntityId.value = selectedEntityId.value ?? ''
  createImageUrl.value = ''
  createImageType.value = 'front'
  createDescription.value = ''
  batchMode.value = false
  batchImages.value = []
}

function closeCreateModal() {
  showCreateModal.value = false
}

function addBatchImage() {
  batchImages.value.push({ imageUrl: '', imageType: 'front', description: '' })
}

function removeBatchImage(idx: number) {
  batchImages.value.splice(idx, 1)
}

async function onSubmitCreate() {
  if (!projectId.value) return
  creating.value = true
  try {
    if (batchMode.value && batchImages.value.length > 0) {
      const valid = batchImages.value.filter(b => b.imageUrl.trim())
      if (valid.length === 0) return
      await store.batchCreate({
        projectId: projectId.value,
        entityType: createEntityType.value,
        entityId: createEntityId.value.trim(),
        images: valid,
      })
    } else {
      if (!createImageUrl.value.trim()) return
      await store.create({
        projectId: projectId.value,
        entityType: createEntityType.value,
        entityId: createEntityId.value.trim(),
        imageUrl: createImageUrl.value.trim(),
        imageType: createImageType.value,
        description: createDescription.value.trim() || undefined,
      })
    }
    closeCreateModal()
    await store.loadSummary(projectId.value)
  } catch {
    // error already set in store
  } finally {
    creating.value = false
  }
}

// ============ 编辑弹窗 ============
const editingImage = ref<ReferenceImageDTO | null>(null)
const editDescription = ref('')
const editImageType = ref<RefImageType>('front')

function openEditModal(img: ReferenceImageDTO) {
  editingImage.value = img
  editDescription.value = img.description ?? ''
  editImageType.value = img.image_type
}

function closeEditModal() {
  editingImage.value = null
}

async function onSubmitEdit() {
  if (!editingImage.value) return
  try {
    await store.update(editingImage.value.id, {
      description: editDescription.value.trim() || null,
      imageType: editImageType.value,
    })
    closeEditModal()
  } catch {
    // error already set in store
  }
}

// ============ 删除确认 ============
const deletingId = ref<string | null>(null)

async function confirmDelete(img: ReferenceImageDTO) {
  deletingId.value = img.id as string
  try {
    await store.remove(img.id)
    await store.loadSummary(projectId.value)
  } catch {
    // error already set in store
  } finally {
    deletingId.value = null
  }
}

// ============ Tab 切换 ============
function onTypeClick(t: RefEntityType | 'all') {
  activeType.value = t
  selectedEntityId.value = null
}

function goBack() {
  router.push(`/projects/${projectId.value}`)
}

// ============ 生命周期 ============
onMounted(async () => {
  if (projectId.value) {
    await Promise.all([
      store.loadList(projectId.value),
      store.loadSummary(projectId.value),
    ])
  }
})
</script>

<template>
  <div class="ri-root">
    <!-- ===== 顶栏 ===== -->
    <header class="ri-header">
      <div class="ri-header-left">
        <button class="ri-back-btn" @click="goBack" title="返回项目">&larr;</button>
        <div class="ri-header-info">
          <h1 class="ri-title">🖼️ 参考图管理</h1>
          <p class="ri-subtitle">{{ store.count }} 张参考图 · 角色 / 场景 / 产品 / 风格</p>
        </div>
      </div>
      <div class="ri-header-actions">
        <button class="ri-btn ri-btn--ghost" @click="store.loadList(projectId); store.loadSummary(projectId)">
          🔄 刷新
        </button>
        <button class="ri-btn ri-btn--primary" @click="openCreateModal">
          ＋ 添加参考图
        </button>
      </div>
    </header>

    <!-- ===== 实体类型 Tab ===== -->
    <nav class="ri-tabs">
      <button
        class="ri-tab"
        :class="{ 'ri-tab--active': activeType === 'all' }"
        @click="onTypeClick('all')"
      >
        <span class="ri-tab-icon">🗂</span>
        <span>全部</span>
        <span class="ri-tab-count">{{ store.counts.total }}</span>
      </button>
      <button
        v-for="et in ENTITY_TYPES"
        :key="et.id"
        class="ri-tab"
        :class="{ 'ri-tab--active': activeType === et.id }"
        @click="onTypeClick(et.id)"
      >
        <span class="ri-tab-icon">{{ et.icon }}</span>
        <span>{{ et.label }}</span>
        <span class="ri-tab-count">{{ store.counts[et.id] }}</span>
      </button>
    </nav>

    <!-- ===== 筛选栏 ===== -->
    <div class="ri-toolbar">
      <input
        v-model="searchKeyword"
        type="search"
        placeholder="🔍 搜索描述 / 实体ID / 角度类型"
        class="ri-search"
      />
      <select
        v-if="entityIds.length > 0"
        v-model="selectedEntityId"
        class="ri-select"
      >
        <option :value="null">全部实体</option>
        <option v-for="eid in entityIds" :key="eid" :value="eid">{{ eid }}</option>
      </select>
    </div>

    <!-- ===== 错误提示 ===== -->
    <div v-if="store.error" class="ri-error">
      ⚠ {{ store.error }}
      <button class="ri-error-close" @click="store.clearError()">&times;</button>
    </div>

    <!-- ===== 加载状态 ===== -->
    <div v-if="store.loading && store.count === 0" class="ri-loading">
      <div class="ri-skeleton-grid">
        <div v-for="n in 6" :key="n" class="ri-skeleton-card" />
      </div>
    </div>

    <!-- ===== 空状态 ===== -->
    <div v-else-if="filteredImages.length === 0" class="ri-empty">
      <span class="ri-empty-icon">🖼️</span>
      <h3>暂无参考图</h3>
      <p>{{ activeType === 'all' ? '点击「+ 添加参考图」开始上传' : '当前分类下还没有参考图' }}</p>
      <button class="ri-btn ri-btn--primary" @click="openCreateModal">＋ 添加参考图</button>
    </div>

    <!-- ===== 图片网格 ===== -->
    <div v-else class="ri-grid">
      <div
        v-for="img in filteredImages"
        :key="img.id"
        class="ri-card"
      >
        <div class="ri-card-image">
          <img :src="img.image_url" :alt="img.description || img.entity_id" loading="lazy" />
          <span class="ri-card-type-badge">{{ IMAGE_TYPE_LABELS[img.image_type] ?? img.image_type }}</span>
        </div>
        <div class="ri-card-body">
          <div class="ri-card-meta">
            <span class="ri-card-entity">{{ ENTITY_TYPES.find(e => e.id === img.entity_type)?.icon }} {{ img.entity_id }}</span>
          </div>
          <p v-if="img.description" class="ri-card-desc">{{ img.description }}</p>
          <p v-else class="ri-card-desc ri-card-desc--empty">暂无描述</p>
        </div>
        <div class="ri-card-actions">
          <button class="ri-card-action" @click="openEditModal(img)" title="编辑">✏️</button>
          <button
            class="ri-card-action ri-card-action--danger"
            :disabled="deletingId === img.id"
            @click="confirmDelete(img)"
            title="删除"
          >
            {{ deletingId === img.id ? '⏳' : '🗑️' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 创建弹窗 ===== -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="ri-modal-overlay" @click.self="closeCreateModal">
        <div class="ri-modal">
          <div class="ri-modal-head">
            <h3>{{ batchMode ? '📦 批量添加参考图' : '✨ 添加参考图' }}</h3>
            <button class="ri-modal-close" @click="closeCreateModal">&times;</button>
          </div>

          <div class="ri-modal-body">
            <!-- 实体类型 -->
            <div class="ri-field">
              <label>实体类型</label>
              <select v-model="createEntityType" class="ri-select">
                <option v-for="et in ENTITY_TYPES" :key="et.id" :value="et.id">{{ et.icon }} {{ et.label }}</option>
              </select>
            </div>

            <!-- 实体 ID -->
            <div class="ri-field">
              <label>实体 ID（角色名/场景名/产品名）</label>
              <input v-model="createEntityId" type="text" placeholder="例如: 主角-李明" class="ri-input" />
            </div>

            <!-- 模式切换 -->
            <div class="ri-field ri-field--row">
              <button
                class="ri-btn ri-btn--sm"
                :class="{ 'ri-btn--primary': !batchMode }"
                @click="batchMode = false"
              >单张</button>
              <button
                class="ri-btn ri-btn--sm"
                :class="{ 'ri-btn--primary': batchMode }"
                @click="batchMode = true"
              >批量</button>
            </div>

            <!-- 单张模式 -->
            <template v-if="!batchMode">
              <div class="ri-field">
                <label>图片 URL</label>
                <input v-model="createImageUrl" type="url" placeholder="https://..." class="ri-input" />
              </div>
              <div class="ri-field">
                <label>角度类型</label>
                <select v-model="createImageType" class="ri-select">
                  <option v-for="it in IMAGE_TYPES" :key="it.id" :value="it.id">{{ it.label }}</option>
                </select>
              </div>
              <div class="ri-field">
                <label>描述（可选）</label>
                <textarea v-model="createDescription" placeholder="参考图描述..." class="ri-textarea" rows="2" />
              </div>
            </template>

            <!-- 批量模式 -->
            <template v-else>
              <div v-for="(b, idx) in batchImages" :key="idx" class="ri-batch-item">
                <div class="ri-batch-item-head">
                  <span>#{{ idx + 1 }}</span>
                  <button class="ri-btn ri-btn--sm ri-btn--danger" @click="removeBatchImage(idx)">移除</button>
                </div>
                <input v-model="b.imageUrl" type="url" placeholder="图片 URL" class="ri-input" />
                <div class="ri-batch-item-row">
                  <select v-model="b.imageType" class="ri-select ri-select--sm">
                    <option v-for="it in IMAGE_TYPES" :key="it.id" :value="it.id">{{ it.label }}</option>
                  </select>
                  <input v-model="b.description" type="text" placeholder="描述" class="ri-input ri-input--sm" />
                </div>
              </div>
              <button class="ri-btn ri-btn--ghost ri-btn--block" @click="addBatchImage">＋ 添加一张</button>
            </template>
          </div>

          <div class="ri-modal-foot">
            <button class="ri-btn ri-btn--ghost" @click="closeCreateModal">取消</button>
            <button class="ri-btn ri-btn--primary" :disabled="creating" @click="onSubmitCreate">
              {{ creating ? '提交中...' : (batchMode ? '批量创建' : '创建') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== 编辑弹窗 ===== -->
    <Teleport to="body">
      <div v-if="editingImage" class="ri-modal-overlay" @click.self="closeEditModal">
        <div class="ri-modal ri-modal--sm">
          <div class="ri-modal-head">
            <h3>✏️ 编辑参考图</h3>
            <button class="ri-modal-close" @click="closeEditModal">&times;</button>
          </div>
          <div class="ri-modal-body">
            <div class="ri-edit-preview">
              <img :src="editingImage.image_url" alt="preview" />
            </div>
            <div class="ri-field">
              <label>角度类型</label>
              <select v-model="editImageType" class="ri-select">
                <option v-for="it in IMAGE_TYPES" :key="it.id" :value="it.id">{{ it.label }}</option>
              </select>
            </div>
            <div class="ri-field">
              <label>描述</label>
              <textarea v-model="editDescription" placeholder="参考图描述..." class="ri-textarea" rows="3" />
            </div>
          </div>
          <div class="ri-modal-foot">
            <button class="ri-btn ri-btn--ghost" @click="closeEditModal">取消</button>
            <button class="ri-btn ri-btn--primary" @click="onSubmitEdit">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ri-root {
  min-height: 100vh;
  background: var(--bg-primary, #09090b);
  color: var(--text-primary, #fafafa);
  display: flex;
  flex-direction: column;
}

/* ===== Header ===== */
.ri-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: color-mix(in srgb, var(--bg-primary, #09090b) 92%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border, #27272a);
}
.ri-header-left { display: flex; align-items: center; gap: 12px; }
.ri-header-actions { display: flex; gap: 8px; }
.ri-back-btn {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  color: var(--text-primary, #fafafa);
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
}
.ri-back-btn:hover { background: var(--bg-tertiary, #27272a); }
.ri-title { font-size: 20px; font-weight: 700; margin: 0; }
.ri-subtitle { font-size: 13px; color: var(--text-secondary, #a1a1aa); margin: 2px 0 0; }

/* ===== Tabs ===== */
.ri-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 28px;
  flex-wrap: wrap;
}
.ri-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-secondary, #a1a1aa);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.ri-tab:hover { color: var(--text-primary, #fafafa); border-color: var(--accent, #00d4aa); }
.ri-tab--active {
  background: var(--accent, #00d4aa);
  color: #fff;
  border-color: var(--accent, #00d4aa);
}
.ri-tab-icon { font-size: 14px; }
.ri-tab-count {
  padding: 1px 7px;
  background: color-mix(in srgb, var(--text-primary, #fafafa) 10%, transparent);
  border-radius: 10px;
  font-size: 11px;
}
.ri-tab--active .ri-tab-count {
  background: color-mix(in srgb, #fff 25%, transparent);
}

/* ===== Toolbar ===== */
.ri-toolbar {
  display: flex;
  gap: 8px;
  padding: 0 28px 12px;
  align-items: center;
}
.ri-search {
  flex: 1;
  padding: 9px 14px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-primary, #fafafa);
  font-family: inherit;
  font-size: 13px;
}
.ri-search:focus { outline: none; border-color: var(--accent, #00d4aa); }
.ri-select {
  padding: 9px 14px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-primary, #fafafa);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ri-select:focus { outline: none; border-color: var(--accent, #00d4aa); }
.ri-select--sm { padding: 6px 10px; font-size: 12px; }

/* ===== Error ===== */
.ri-error {
  margin: 0 28px 12px;
  padding: 10px 14px;
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #fca5a5;
  border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ri-error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #fca5a5;
  font-size: 18px;
  cursor: pointer;
  font-family: inherit;
}

/* ===== Loading skeleton ===== */
.ri-loading { padding: 0 28px; }
.ri-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.ri-skeleton-card {
  aspect-ratio: 3/4;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--bg-secondary, #18181b), var(--bg-tertiary, #27272a));
  animation: ri-pulse 1.5s ease-in-out infinite;
}
@keyframes ri-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

/* ===== Empty ===== */
.ri-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 28px;
  color: var(--text-secondary, #a1a1aa);
}
.ri-empty-icon { font-size: 48px; opacity: 0.5; }
.ri-empty h3 { margin: 0; font-size: 18px; color: var(--text-primary, #fafafa); }
.ri-empty p { margin: 0; font-size: 14px; }

/* ===== Image Grid ===== */
.ri-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 0 28px 28px;
}
.ri-card {
  border-radius: 12px;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}
.ri-card:hover {
  border-color: var(--accent, #00d4aa);
  transform: translateY(-2px);
}
.ri-card-image {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
  background: var(--bg-tertiary, #27272a);
}
.ri-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ri-card-type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, #000 70%, transparent);
  color: #fff;
  font-size: 11px;
  backdrop-filter: blur(4px);
}
.ri-card-body {
  padding: 10px 12px;
}
.ri-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.ri-card-entity {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #fafafa);
}
.ri-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #a1a1aa);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ri-card-desc--empty { font-style: italic; opacity: 0.5; }
.ri-card-actions {
  display: flex;
  gap: 4px;
  padding: 0 12px 10px;
}
.ri-card-action {
  padding: 4px 8px;
  background: var(--bg-tertiary, #27272a);
  border: 1px solid var(--border, #27272a);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.ri-card-action:hover { background: var(--border, #3f3f46); }
.ri-card-action--danger:hover { background: color-mix(in srgb, #ef4444 20%, transparent); }
.ri-card-action:disabled { opacity: 0.5; cursor: not-allowed; }

/* ===== Buttons ===== */
.ri-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border, #27272a);
  background: var(--bg-secondary, #18181b);
  color: var(--text-primary, #fafafa);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.ri-btn:hover { background: var(--bg-tertiary, #27272a); }
.ri-btn--primary {
  background: var(--accent, #00d4aa);
  color: #000;
  border-color: var(--accent, #00d4aa);
  font-weight: 600;
}
.ri-btn--primary:hover { opacity: 0.9; }
.ri-btn--ghost { background: transparent; border-color: transparent; }
.ri-btn--ghost:hover { background: var(--bg-secondary, #18181b); }
.ri-btn--danger { color: #f87171; border-color: #7f1d1d; }
.ri-btn--sm { padding: 5px 10px; font-size: 12px; }
.ri-btn--block { width: 100%; text-align: center; margin-top: 8px; }
.ri-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ===== Modal ===== */
.ri-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 60%, transparent);
  backdrop-filter: blur(4px);
}
.ri-modal {
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--bg-secondary, #18181b);
  border: 1px solid var(--border, #27272a);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}
.ri-modal--sm { width: 420px; }
.ri-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #27272a);
}
.ri-modal-head h3 { margin: 0; font-size: 16px; }
.ri-modal-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a1a1aa);
  font-size: 22px;
  cursor: pointer;
  font-family: inherit;
}
.ri-modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.ri-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border, #27272a);
}

/* ===== Form ===== */
.ri-field { display: flex; flex-direction: column; gap: 5px; }
.ri-field label { font-size: 12px; color: var(--text-secondary, #a1a1aa); font-weight: 500; }
.ri-field--row { flex-direction: row; gap: 8px; }
.ri-input {
  padding: 9px 14px;
  background: var(--bg-primary, #09090b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-primary, #fafafa);
  font-family: inherit;
  font-size: 13px;
}
.ri-input:focus { outline: none; border-color: var(--accent, #00d4aa); }
.ri-input--sm { padding: 6px 10px; font-size: 12px; }
.ri-textarea {
  padding: 9px 14px;
  background: var(--bg-primary, #09090b);
  border: 1px solid var(--border, #27272a);
  border-radius: 8px;
  color: var(--text-primary, #fafafa);
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}
.ri-textarea:focus { outline: none; border-color: var(--accent, #00d4aa); }

/* ===== Batch items ===== */
.ri-batch-item {
  padding: 12px;
  background: var(--bg-primary, #09090b);
  border: 1px solid var(--border, #27272a);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ri-batch-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
}
.ri-batch-item-row {
  display: flex;
  gap: 8px;
}

/* ===== Edit preview ===== */
.ri-edit-preview {
  border-radius: 10px;
  overflow: hidden;
  max-height: 200px;
  background: var(--bg-tertiary, #27272a);
}
.ri-edit-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
}
</style>
