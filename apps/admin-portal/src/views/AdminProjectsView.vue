<script setup lang="ts">
/**
 * AdminProjectsView.vue — 项目审核 (1:1 复刻 admin-projects.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'

const filter = ref('全部')
const searchQuery = ref('')
const projects = ref([
  { name: '长安月下', author: '梁总', genre: '古风宫廷', episodes: 24, shots: 8, status: 'pending', cover: '🌙', color: 'linear-gradient(135deg,rgba(102,126,234,.2),rgba(118,75,162,.1))', created: '5 分钟前' },
  { name: '剑破苍穹', author: '林染', genre: '仙侠', shots: 96, status: 'approved', cover: '⚔️', color: 'linear-gradient(135deg,rgba(240,147,251,.2),rgba(245,87,108,.1))', created: '2 小时前' },
  { name: '逆袭少女', author: '张三', genre: '都市', status: 'rejected', cover: '🔥', color: 'linear-gradient(135deg,rgba(239,68,68,.2),rgba(239,68,68,.05))', created: '昨天', reason: '内容涉及敏感题材' },
])
const selectedProject = ref(projects.value[0])
const reviewNote = ref('')

const filteredProjects = ref(projects.value)

const acting = ref(false); const actionError = ref('')
async function approve() {
  acting.value = true; actionError.value = ''
  try {
    const token = localStorage.getItem('mhw.access_token') || ''
    const r = await fetch('/api/v1/projects/' + (selectedProject.value as any).id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ status: 'approved' }) })
    if (r.ok) { selectedProject.value.status = 'approved' as any }
    else { const e = await r.json().catch(()=>({})); throw new Error(e.message || '操作失败') }
  } catch (err: any) { actionError.value = err.message || '操作失败' }
  finally { acting.value = false }
}
async function reject() {
  acting.value = true; actionError.value = ''
  try {
    const token = localStorage.getItem('mhw.access_token') || ''
    const r = await fetch('/api/v1/projects/' + (selectedProject.value as any).id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ status: 'rejected', review_note: reviewNote.value }) })
    if (r.ok) { selectedProject.value.status = 'rejected' as any }
    else { const e = await r.json().catch(()=>({})); throw new Error(e.message || '操作失败') }
  } catch (err: any) { actionError.value = err.message || '操作失败' }
  finally { acting.value = false }
}
</script>

<template>
  <div class="admin-projects">
    <div class="ap-main">
      <div class="ap-header">
        <div><span class="page-title">📁 项目审核</span><span class="ap-count">待审 12 · 今日 3</span></div>
        <div class="search-box"><input class="input" v-model="searchQuery" placeholder="搜索项目…" style="width:180px;font-size:12px;padding:6px 10px"></div>
      </div>
      <div class="ap-filters">
        <span v-for="f in ['全部','⏳ 待审核','✅ 已通过','❌ 已驳回']" :key="f" class="chip" :class="{ active: filter === f }" @click="filter = f">{{ f }}</span>
      </div>
      <div v-for="p in filteredProjects" :key="p.name" class="review-card" :class="{ 'review-card--pending': p.status === 'pending', 'review-card--rejected': p.status === 'rejected' }">
        <div class="review-cover" :style="{ background: p.color }">{{ p.cover }}</div>
        <div class="review-info">
          <div class="review-name">{{ p.name }}
            <span class="badge" :class="p.status === 'pending' ? 'badge-amber' : p.status === 'approved' ? 'badge-green' : 'badge-red'">
              {{ p.status === 'pending' ? '待审核' : p.status === 'approved' ? '已通过' : '已驳回' }}
            </span>
          </div>
          <div class="review-meta">{{ p.author }} · {{ p.genre }}<template v-if="p.episodes"> · {{ p.episodes }} 集</template><template v-if="p.shots"> · 含 {{ p.shots }} 章分镜</template> · 创建 {{ p.created }}<template v-if="p.reason"> · 驳回原因：{{ p.reason }}</template></div>
        </div>
        <div class="review-actions">
          <button v-if="p.status === 'pending'" class="btn btn-sm btn-approve" @click="approve">通过</button>
          <button v-if="p.status === 'pending'" class="btn btn-sm btn-danger" @click="reject">驳回</button>
          <button class="btn btn-sm btn-ghost">查看详情</button>
        </div>
      </div>
    </div>
    <div class="ap-detail">
      <div class="ap-detail-name">{{ selectedProject.name }}</div>
      <div class="ap-detail-status">{{ selectedProject.status === 'pending' ? '待审核' : selectedProject.status === 'approved' ? '已通过' : '已驳回' }} · 提交 {{ selectedProject.created }}</div>
      <div class="ap-detail-info">
        <div class="ap-detail-row"><span>作者</span><span>{{ selectedProject.author }}</span></div>
        <div class="ap-detail-row"><span>题材</span><span>{{ selectedProject.genre }}</span></div>
        <div class="ap-detail-row"><span>分镜数</span><span>{{ selectedProject.shots || 24 }}</span></div>
        <div class="ap-detail-row"><span>角色数</span><span>6</span></div>
        <div class="ap-detail-row"><span>内容检查</span><span class="ap-check-ok">✅ 无违规</span></div>
      </div>
      <div class="mt-4"><label class="form-label">审核备注</label><textarea class="input" rows="2" v-model="reviewNote" placeholder="输入备注…" style="font-size:12px"></textarea></div>
      <div class="ap-detail-actions">
        <button class="btn btn-sm btn-approve btn-full">✅ 通过</button>
        <button class="btn btn-sm btn-danger btn-full">❌ 驳回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-projects { display: flex; gap: 16px; flex: 1; padding: 20px 28px; overflow: hidden; }
.ap-main { flex: 1; overflow-y: auto; }
.ap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.ap-count { font-size: 13px; color: var(--text-muted, #64748b); margin-left: 8px; }
.ap-filters { display: flex; gap: 8px; margin-bottom: 16px; }
.chip { padding: 4px 10px; border-radius: 12px; font-size: 11px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-secondary, #94a3b8); cursor: pointer; }
.chip.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.08); color: var(--accent, #818cf8); }
.review-card { padding: 18px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); margin-bottom: 10px; display: flex; gap: 16px; align-items: center; }
.review-card:hover { border-color: var(--accent, #818cf8); }
.review-card--pending { border-color: rgba(245,158,11,.3); }
.review-card--rejected { border-color: rgba(239,68,68,.2); }
.review-cover { width: 80px; height: 56px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; }
.review-info { flex: 1; }
.review-name { font-size: 15px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.review-meta { font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px; }
.review-actions { display: flex; gap: 8px; }
.ap-detail { width: 280px; background: var(--bg-secondary, #111827); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 16px; flex-shrink: 0; }
.ap-detail-name { font-size: 14px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 8px; }
.ap-detail-status { font-size: 12px; color: var(--text-muted, #64748b); margin-bottom: 12px; }
.ap-detail-info { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
.ap-detail-row { display: flex; justify-content: space-between; }
.ap-detail-row span:first-child { color: var(--text-muted, #64748b); }
.ap-detail-row span:last-child { color: var(--text-primary, #e2e8f0); }
.ap-check-ok { color: #34d399 !important; }
.ap-detail-actions { display: flex; gap: 8px; margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.form-label { font-size: 11px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.page-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.search-box { position: relative; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-amber { background: rgba(245,158,11,.15); color: #fbbf24; }
.badge-green { background: rgba(16,185,129,.15); color: #34d399; }
.badge-red { background: rgba(239,68,68,.15); color: #fca5a5; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-approve { background: #10b981; color: #fff; }
.btn-danger { background: rgba(239,68,68,.15); color: #fca5a5; }
.btn-ghost { background: transparent; color: var(--text-secondary, #94a3b8); }
.btn-full { flex: 1; justify-content: center; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
</style>
