<script setup lang="ts">
/**
 * MusicManagementView — 配乐管理
 * P3-3: 配乐榜单列表 + 下架操作
 * 对接 GET /admin/content 获取音乐/音频类内容
 */
import { ref, onMounted } from 'vue'
import { getApi } from '../api-bridge'

interface MusicTrack {
  id: number
  name: string
  tags: string[]
  usageCount: number
  status: '上架' | '下架'
  duration: string
  genre: string
  creator: string
  createdAt: string
}

const loading = ref(true)
const loadError = ref('')
const tracks = ref<MusicTrack[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const http = getApi().http
    const res = await http.get('/admin/content', { limit: 100 })
    const items: any[] = res?.items || res?.data?.items || (Array.isArray(res) ? res : [])
    // 筛选音乐/音频类内容
    const musicItems = items.filter((i: any) => {
      const t = (i.type || i.category || '').toLowerCase()
      return t.includes('music') || t.includes('audio') || t.includes('sound')
    })
    tracks.value = musicItems.map((m: any, idx: number) => ({
      id: idx + 1,
      name: m.title || m.name || '未命名曲目',
      tags: Array.isArray(m.tags) ? m.tags : (m.genre ? [m.genre] : []),
      usageCount: m.usage_count ?? m.usageCount ?? 0,
      status: m.status === 'active' || m.status === 1 ? '上架' as const : '下架' as const,
      duration: m.duration || '—',
      genre: m.genre || m.category || '—',
      creator: m.creator || m.author || 'AI-GEN',
      createdAt: m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : '—',
    }))
  } catch (err: any) {
    loadError.value = err?.message || '加载失败'
    tracks.value = []
  } finally {
    loading.value = false
  }
})

async function removeTrack(id: number) {
  // 下架操作: 本地先更新状态
  const track = tracks.value.find(t => t.id === id)
  if (track) track.status = '下架'
}
</script>

<template>
  <div class="mm">
    <div class="mm-header">
      <div class="mm-header-left">
        <h2 class="mm-title">🎵 配乐管理</h2>
        <div class="mm-stats">
          <span class="mm-stat">上架 <strong>{{ tracks.filter(t => t.status === '上架').length }}</strong></span>
          <span class="mm-stat">下架 <strong>{{ tracks.filter(t => t.status === '下架').length }}</strong></span>
          <span class="mm-stat">总计 <strong>{{ tracks.length }}</strong> 首</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="mm-loading">加载配乐列表…</div>
    <div v-else-if="loadError" class="mm-loading">加载失败: {{ loadError }}</div>

    <table v-else-if="tracks.length" class="mm-table">
      <thead>
        <tr>
          <th class="mm-th--sm">#</th>
          <th>曲名</th>
          <th>标签</th>
          <th class="mm-th--num">使用次数</th>
          <th class="mm-th--num">时长</th>
          <th>风格</th>
          <th>来源</th>
          <th>创建时间</th>
          <th>状态</th>
          <th class="mm-th--action">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in tracks" :key="t.id" class="mm-row" :class="{ 'mm-row--down': t.status === '下架' }">
          <td class="mm-cell--sm">{{ t.id }}</td>
          <td class="mm-cell--name">{{ t.name }}</td>
          <td>
            <span v-for="tag in t.tags" :key="tag" class="mm-tag">{{ tag }}</span>
          </td>
          <td class="mm-cell--num">{{ t.usageCount.toLocaleString() }}</td>
          <td class="mm-cell--num mm-cell--mono">{{ t.duration }}</td>
          <td>{{ t.genre }}</td>
          <td><span class="mm-creator">{{ t.creator }}</span></td>
          <td class="mm-cell--mono">{{ t.createdAt }}</td>
          <td>
            <span class="mm-status" :class="t.status === '上架' ? 'mm-status--up' : 'mm-status--down'">
              {{ t.status }}
            </span>
          </td>
          <td class="mm-cell--action">
            <button
              v-if="t.status === '上架'"
              class="mm-btn-remove"
              @click="removeTrack(t.id)"
            >
              下架
            </button>
            <span v-else class="mm-removed">—</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !loadError && !tracks.length" class="mm-empty">
      暂无配乐数据，用户创建音乐作品后将在此显示
    </div>
  </div>
</template>

<style scoped>
.mm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mm-header-left {
  display: flex;
  align-items: baseline;
  gap: 20px;
}

.mm-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.mm-stats {
  display: flex;
  gap: 14px;
}

.mm-stat {
  font-size: 12px;
  color: var(--text-secondary);
}

.mm-stat strong {
  color: var(--text-primary);
  font-weight: 700;
}

.mm-loading {
  padding: 28px;
  text-align: center;
  opacity: 0.6;
  font-size: 14px;
}

.mm-empty {
  padding: 32px;
  text-align: center;
  opacity: 0.5;
  font-size: 14px;
}

/* ---- Table ---- */
.mm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
  overflow: hidden;
}

.mm-table thead {
  background: var(--bg-primary, #0a0e1a);
  border-bottom: 1px solid var(--border);
}

.mm-table th {
  padding: 12px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.mm-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  white-space: nowrap;
}

.mm-row:hover {
  background: var(--bg-hover, rgba(99, 102, 241, 0.04));
}

.mm-row--down {
  opacity: 0.55;
}

.mm-th--sm { width: 48px; }
.mm-th--num { text-align: right; }
.mm-th--action { text-align: center; }

.mm-cell--sm { text-align: center; color: var(--text-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.mm-cell--num { text-align: right; }
.mm-cell--mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.mm-cell--name { font-weight: 600; }
.mm-cell--action { text-align: center; }

/* ---- Tags ---- */
.mm-tag {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 4px;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 999px;
  background: var(--bg-primary, #0a0e1a);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

/* ---- Status Badge ---- */
.mm-status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.mm-status--up {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #34d399;
}

.mm-status--down {
  background: color-mix(in srgb, #6b7280 15%, transparent);
  color: #9ca3af;
}

.mm-creator {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in srgb, var(--accent, #6366f1) 12%, transparent);
  color: var(--accent, #818cf8);
  padding: 1px 8px;
  border-radius: 4px;
}

/* ---- Remove Button ---- */
.mm-btn-remove {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #fca5a5;
  background: color-mix(in srgb, #ef4444 12%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms;
}

.mm-btn-remove:hover {
  background: color-mix(in srgb, #ef4444 25%, transparent);
  color: #fecaca;
}

.mm-removed {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
