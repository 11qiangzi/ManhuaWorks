<script setup lang="ts">
/**
 * ProjectSettingsView.vue — 项目设置 (1:1 复刻 studio-project-settings.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const projectName = ref('长安月下')
const coverEmoji = ref('🌙')
const description = ref('古风宫廷长篇漫改。一位没落宗门少年，在长安城中卷入了宫廷与江湖的双重漩涡。')
const genre = ref('古风')
const targetEpisodes = ref(24)
const defaultStyle = ref('动漫')
const aspectRatio = ref('16:9')
const activeTab = ref('basic')
const ratios = ['16:9', '9:16', '4:3', '1:1']

const collaborators = ref([
  { name: '我（创作者）', email: 'me@manhuaworks.com', role: '所有者', emoji: '🧑', color: 'linear-gradient(135deg,#667eea,#764ba2)' },
  { name: '林染', email: 'linran@manhuaworks.com', role: '管理员', emoji: '👩', color: 'linear-gradient(135deg,#34d399,#10b981)' },
  { name: '老魏', email: 'laowei@manhuaworks.com', role: '编辑', emoji: '👨', color: 'linear-gradient(135deg,#f59e0b,#d97706)' },
])

function goBack() { router.push('/project') }
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveSettings() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const r = await fetch('/api/v1/projects/' + (history.state?.projectId || 'current'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mhw.access_token') || '') },
      body: JSON.stringify({ name: projectName.value, description: description.value, genre: genre.value, default_style: defaultStyle.value, aspect_ratio: aspectRatio.value, target_episodes: targetEpisodes.value })
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || '保存失败 (' + r.status + ')') }
    saveSuccess.value = true
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
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
          <button v-if="c.role !== '所有者'" class="btn btn-xs btn-ghost">✏️</button>
        </div>
        <button class="btn btn-sm btn-secondary mt-4">➕ 邀请成员</button>
      </div>
    </template>
    <template v-if="activeTab === 'danger'">
      <div class="section-title">🗑 危险操作</div>
      <div class="ps-card ps-card--danger">
        <div class="danger-row">
          <div><div class="danger-title">归档项目</div><div class="danger-desc">归档后项目变为只读，可随时恢复</div></div>
          <button class="btn btn-danger btn-sm">归档</button>
        </div>
        <div class="danger-row">
          <div><div class="danger-title">删除项目</div><div class="danger-desc">永久删除所有数据，不可恢复</div></div>
          <button class="btn btn-sm btn-delete">删除项目</button>
        </div>
      </div>
    </template>
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
.form-label { font-size: 12px; font-weight: 500; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
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
.mt-4 { margin-top: 16px; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-red { background: rgba(239,68,68,.15); color: #fca5a5; }
.badge-purple { background: rgba(139,92,246,.15); color: #a78bfa; }
.badge-green { background: rgba(16,185,129,.15); color: #34d399; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-danger { background: rgba(239,68,68,.15); color: #fca5a5; }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-xs { padding: 4px 8px; font-size: 11px; }
.btn-delete { background: rgba(239,68,68,.2); color: #fca5a5; border: 1px solid rgba(239,68,68,.3); }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
</style>
