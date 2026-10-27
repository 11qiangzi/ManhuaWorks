<script setup lang="ts">
/**
 * ProjectSettingsView.vue — 项目设置 (1:1 复刻 studio-project-settings.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@manhuaworks/ui'
import { useProjectStore } from '../stores/project'
import { getApi } from '../api-bridge'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const store = useProjectStore()
const api = getApi()

// Form fields — defaults are fallbacks for fields not present in ProjectDTO
const projectName = ref('')
const coverEmoji = ref('🌙')
const description = ref('')
const genre = ref('古风')
const targetEpisodes = ref(24)
const defaultStyle = ref('动漫')
const aspectRatio = ref('16:9')
const activeTab = ref('basic')
const ratios = ['16:9', '9:16', '4:3', '1:1']

const collaborators = ref<{ name: string; email: string; role: string; emoji: string; color: string }[]>([])

// Role color/emoji mapping for collaborators
const ROLE_STYLES: Record<string, { emoji: string; color: string }> = {
  'owner':  { emoji: '🧑', color: 'linear-gradient(135deg,#667eea,#764ba2)' },
  'editor': { emoji: '👨', color: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  'viewer': { emoji: '👤', color: 'linear-gradient(135deg,#60a5fa,#3b82f6)' },
}
const ROLE_LABELS: Record<string, string> = {
  'owner': '所有者',
  'editor': '编辑',
  'viewer': '查看者',
}
const DEFAULT_MEMBER_STYLE = { emoji: '👤', color: 'linear-gradient(135deg,#60a5fa,#3b82f6)' }

onMounted(async () => {
  const id = (route.params.id as string) || 'current'

  // Load project data from store
  try {
    await store.loadOne(id)
    const p = store.current
    if (p) {
      projectName.value = p.name || projectName.value
      description.value = p.description || description.value
      // coverEmoji, genre, targetEpisodes, defaultStyle, aspectRatio
      // are not in ProjectDTO — keep their hardcoded defaults
    }
  } catch {
    toast.error('加载项目信息失败')
  }

  // Load collaborators from members API
  try {
    const members = await api.projects.listMembers(id)
    collaborators.value = members.map((m) => {
      const style = ROLE_STYLES[m.role] || DEFAULT_MEMBER_STYLE
      return {
        name: m.display_name || m.email?.split('@')[0] || '未知成员',
        email: m.email || '',
        role: ROLE_LABELS[m.role] || m.role || '编辑',
        emoji: style.emoji,
        color: style.color,
      }
    })
  } catch {
    // Members API may not be ready yet; silently keep empty list
  }
})

// Confirm modal state
const showConfirm = ref(false)
const confirmMessage = ref('')
const onConfirm = ref<(() => void) | null>(null)

function confirmAction(message: string, action: () => void) {
  confirmMessage.value = message
  onConfirm.value = action
  showConfirm.value = true
}

function executeConfirm() {
  if (onConfirm.value) onConfirm.value()
  showConfirm.value = false
  onConfirm.value = null
}

// Invite modal state
const showInviteModal = ref(false)
const inviteEmail = ref('')

function openInviteModal() {
  inviteEmail.value = ''
  showInviteModal.value = true
}

async function submitInvite() {
  const email = inviteEmail.value.trim()
  if (!email || !email.includes('@')) return
  const projectId = (route.params.id as string) || 'current'
  try {
    await api.http.post(`/projects/${encodeURIComponent(projectId)}/members`, {
      email, role: 'editor',
    })
    // Only add locally AFTER successful API call
    collaborators.value.push({
      name: email.split('@')[0] || email,
      email,
      role: '编辑',
      emoji: '👤',
      color: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
    })
    showInviteModal.value = false
    toast.success(`已邀请 ${email}`)
  } catch (e) {
    toast.error(`邀请失败: ${(e as Error).message}`)
  }
}

// Collaborator edit mode — clicking edit shows a confirm dialog to remove the collaborator
const editingCollabEmail = ref<string | null>(null)

async function onEditCollaborator(email: string) {
  confirmAction(`确定移除协作者 ${email} 吗？`, async () => {
    const projectId = (route.params.id as string) || 'current'
    try {
      await api.http.delete(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(email)}`, {})
    } catch {
      // API may not be ready — remove locally as optimistic update
    }
    collaborators.value = collaborators.value.filter(c => c.email !== email)
    toast.success(`已移除协作者 ${email}`)
  })
}

function goBack() {
  const pid = route.params.id
  router.push(pid ? `/project/${pid}` : '/project')
}
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveSettings() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const projectId = (route.params.id as string) || 'current'
    const r = await api.http.patch(`/projects/${encodeURIComponent(projectId)}`, {
      name: projectName.value, description: description.value,
      genre: genre.value, default_style: defaultStyle.value,
      aspect_ratio: aspectRatio.value, target_episodes: targetEpisodes.value,
    })
    if (!r || (r as any).code !== 0) {
      throw new Error((r as any)?.message || '保存失败')
    }
    saveSuccess.value = true
    toast.success('保存成功')
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : '保存失败'
    toast.error(saveError.value)
  } finally {
    saving.value = false
  }
}

function onArchive() {
  confirmAction('确认归档此项目？归档后项目将变为只读。', async () => {
    try {
      const projectId = (route.params.id as string) || 'current'
      await store.archive(projectId)
      toast.success('项目已归档')
      router.push('/')
    } catch {
      toast.error('归档失败')
    }
  })
}

function onDeleteProject() {
  confirmAction('确认永久删除此项目？所有数据将不可恢复！', async () => {
    try {
      const projectId = (route.params.id as string) || 'current'
      await api.http.delete(`/projects/${encodeURIComponent(projectId)}`, {})
      toast.success('项目已删除')
      router.push('/')
    } catch {
      toast.error('删除失败')
    }
  })
}
</script>

<template>
  <div class="project-settings">
    <div class="ps-back"><a href="#" @click.prevent="goBack">← 返回项目</a><span class="page-title">🌙 {{ projectName }} · 项目设置</span></div>
    <div class="tabs">
      <span class="tab" :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">📋 基本信息</span>
      <span class="tab" :class="{ active: activeTab === 'collab' }" @click="activeTab = 'collab'">👥 协作成员</span>
      <span class="tab" :class="{ active: activeTab === 'perm' }" @click="activeTab = 'perm'">🔐 权限</span>
      <span class="tab" :class="{ active: activeTab === 'danger' }" @click="activeTab = 'danger'">🗑 危险操作</span>
    </div>
    <template v-if="activeTab === 'basic'">
      <div class="ps-card">
        <div class="form-grid">
          <div><label class="form-label">项目名称</label><input class="input" v-model="projectName"></div>
          <div><label class="form-label">封面 Emoji</label><input class="input" v-model="coverEmoji" style="width:80px;font-size:24px;text-align:center"></div>
          <div><label class="form-label">简介</label><textarea class="input" rows="3" v-model="description"></textarea></div>
          <div class="form-row-3">
            <div><label class="form-label">题材</label><select class="input" v-model="genre"><option>古风</option><option>仙侠</option><option>都市</option><option>科幻</option></select></div>
            <div><label class="form-label">目标集数</label><input class="input" v-model.number="targetEpisodes"></div>
            <div><label class="form-label">默认风格</label><select class="input" v-model="defaultStyle"><option>动漫</option><option>真人写实</option></select></div>
          </div>
          <div><label class="form-label">默认画幅</label><div class="ratio-chips"><span v-for="r in ratios" :key="r" class="chip" :class="{ active: aspectRatio === r }" @click="aspectRatio = r">{{ r }}</span></div></div>
        </div>
        <div class="ps-save-row"><button class="btn btn-primary" @click="saveSettings" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存设置' }}</button></div>
      </div>
    </template>
    <template v-if="activeTab === 'collab'">
      <div class="section-title">👥 协作成员</div>
      <div class="ps-card">
        <div v-for="c in collaborators" :key="c.email" class="collab-row">
          <div class="collab-avatar" :style="{ background: c.color }">{{ c.emoji }}</div>
          <div class="collab-info"><div class="collab-name">{{ c.name }}</div><div class="collab-email">{{ c.email }}</div></div>
          <span class="badge" :class="c.role === '所有者' ? 'badge-red' : c.role === '管理员' ? 'badge-purple' : 'badge-green'">{{ c.role }}</span>
          <button v-if="c.role !== '所有者'" class="btn btn-xs btn-ghost" @click="onEditCollaborator(c.email)">✏️</button>
        </div>
        <button class="btn btn-sm btn-secondary mt-4" @click="openInviteModal">➕ 邀请成员</button>
      </div>
    </template>
    <template v-if="activeTab === 'perm'">
      <div class="section-title">🔐 权限设置</div>
      <div class="ps-card">
        <div class="perm-row">
          <div class="perm-info">
            <div class="perm-name">公开可见</div>
            <div class="perm-desc">项目成员可查看项目基本信息和素材库</div>
          </div>
          <span class="badge badge-green">已开启</span>
        </div>
        <div class="perm-row">
          <div class="perm-info">
            <div class="perm-name">素材下载</div>
            <div class="perm-desc">允许编辑者下载项目素材文件</div>
          </div>
          <span class="badge badge-green">已开启</span>
        </div>
        <div class="perm-row">
          <div class="perm-info">
            <div class="perm-name">外部共享</div>
            <div class="perm-desc">允许生成外部分享链接（只读）</div>
          </div>
          <span class="badge badge-red">未开启</span>
        </div>
        <div class="perm-row">
          <div class="perm-info">
            <div class="perm-name">API 访问</div>
            <div class="perm-desc">允许通过 API 密钥访问项目数据</div>
          </div>
          <span class="badge badge-red">未开启</span>
        </div>
        <div class="perm-note">权限配置将在后续版本中支持自定义编辑</div>
      </div>
    </template>
    <template v-if="activeTab === 'danger'">
      <div class="section-title">🗑 危险操作</div>
      <div class="ps-card ps-card--danger">
        <div class="danger-row">
          <div><div class="danger-title">归档项目</div><div class="danger-desc">归档后项目变为只读，可随时恢复</div></div>
          <button class="btn btn-danger btn-sm" @click="onArchive">归档</button>
        </div>
        <div class="danger-row">
          <div><div class="danger-title">删除项目</div><div class="danger-desc">永久删除所有数据，不可恢复</div></div>
          <button class="btn btn-sm btn-delete" @click="onDeleteProject">删除项目</button>
        </div>
      </div>
    </template>

    <!-- Confirm Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showConfirm" class="modal-overlay" @click.self="showConfirm = false">
          <div class="modal-dialog modal-dialog--sm">
            <div class="modal-head">
              <h3>确认操作</h3>
              <button class="modal-close" @click="showConfirm = false">✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-message">{{ confirmMessage }}</p>
            </div>
            <div class="modal-foot">
              <button class="ml-btn" @click="showConfirm = false">取消</button>
              <button class="ml-btn ml-btn--danger" @click="executeConfirm">确认</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Invite Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showInviteModal" class="modal-overlay" @click.self="showInviteModal = false">
          <div class="modal-dialog modal-dialog--sm">
            <div class="modal-head">
              <h3>➕ 邀请成员</h3>
              <button class="modal-close" @click="showInviteModal = false">✕</button>
            </div>
            <div class="modal-body">
              <label class="ml-field">
                <span class="ml-field-label">邮箱地址</span>
                <input
                  v-model="inviteEmail"
                  class="ml-input"
                  type="email"
                  placeholder="name@example.com"
                  @keydown.enter="submitInvite"
                  autofocus
                />
              </label>
            </div>
            <div class="modal-foot">
              <button class="ml-btn" @click="showInviteModal = false">取消</button>
              <button class="ml-btn ml-btn--primary" :disabled="!inviteEmail.trim()" @click="submitInvite">发送邀请</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.project-settings { padding: 20px 32px; flex: 1; overflow-y: auto; }
.ps-back { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.ps-back a { color: var(--text-secondary, #94a3b8); text-decoration: none; font-size: 13px; }
.page-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border, #1e293b); margin-bottom: 20px; }
.tab { padding: 10px 20px; font-size: 13px; font-weight: 500; color: var(--text-secondary, #94a3b8); cursor: pointer; border-bottom: 2px solid transparent; transition: all .2s; }
.tab.active { color: var(--accent, #818cf8); border-bottom-color: var(--accent, #818cf8); }
.tab:hover { color: var(--text-primary, #e2e8f0); }
.ps-card { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 20px; max-width: 800px; }
.ps-card--danger { border-color: rgba(239,68,68,.25); }
.form-grid { display: flex; flex-direction: column; gap: 16px; }
.form-row-3 { display: flex; gap: 16px; }
.form-row-3 > div { flex: 1; }
.ratio-chips { display: flex; gap: 8px; }
.chip { padding: 6px 14px; border-radius: 12px; border: 1px solid var(--border, #1e293b); background: var(--bg-tertiary, #1a2332); font-size: 12px; color: var(--text-secondary, #94a3b8); cursor: pointer; }
.chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.ps-save-row { display: flex; justify-content: flex-end; margin-top: 16px; }
.collab-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border, #1e293b); }
.collab-row:last-child { border-bottom: none; }
.collab-avatar { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
.collab-info { flex: 1; }
.collab-name { font-weight: 600; font-size: 13px; color: var(--text-primary, #e2e8f0); }
.collab-email { font-size: 11px; color: var(--text-muted, #64748b); }
.danger-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.danger-row + .danger-row { margin-top: 16px; }
.danger-title { font-weight: 600; color: #fca5a5; }
.danger-desc { font-size: 12px; color: var(--text-muted, #64748b); }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.perm-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border, #1e293b); }
.perm-row:last-of-type { border-bottom: none; }
.perm-name { font-weight: 600; font-size: 13px; color: var(--text-primary, #e2e8f0); }
.perm-desc { font-size: 12px; color: var(--text-muted, #64748b); margin-top: 2px; }
.perm-note { margin-top: 12px; font-size: 11px; color: var(--text-muted, #64748b); font-style: italic; }
.mt-4 { margin-top: 16px; }
.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.modal-dialog { background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1e293b); border-radius: 14px; width: 90vw; max-width: 400px; display: flex; flex-direction: column; }
.modal-dialog--sm { max-width: 360px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border, #1e293b); }
.modal-head h3 { margin: 0; font-size: 15px; color: var(--text-primary, #e2e8f0); }
.modal-close { border: none; background: transparent; color: var(--text-secondary, #94a3b8); font-size: 18px; cursor: pointer; padding: 4px; }
.modal-close:hover { color: #ef4444; }
.modal-body { padding: 20px; }
.modal-message { font-size: 13px; color: var(--text-secondary, #94a3b8); line-height: 1.6; margin: 0; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border, #1e293b); }
.ml-field { display: flex; flex-direction: column; gap: 4px; }
.ml-field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary, #94a3b8); }
.ml-input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border, #1e293b); background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); font-size: 13px; width: 100%; box-sizing: border-box; }
.ml-input:focus { border-color: var(--accent, #818cf8); outline: none; }
.ml-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border, #1e293b); background: var(--bg-tertiary, #1a2332); color: var(--text-secondary, #94a3b8); font-size: 13px; cursor: pointer; transition: all 200ms; }
.ml-btn:hover { border-color: var(--accent, #818cf8); color: var(--text-primary, #e2e8f0); }
.ml-btn--primary { background: var(--accent, #818cf8); color: white; border: none; font-weight: 600; }
.ml-btn--primary:hover { background: var(--accent-strong, #6366f1); }
.ml-btn--danger { background: rgba(239,68,68,.8); color: white; border: none; font-weight: 600; }
.ml-btn--danger:hover { background: #dc2626; }
.ml-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 200ms ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
