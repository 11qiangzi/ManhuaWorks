<script setup lang="ts">
/**
 * DashboardView — 仪表板
 * 4 个 KPI + 7 日收入 + 7 日活跃 + 异常告警
 */
import { onMounted, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import RevenueChart from '@/components/dashboard/RevenueChart.vue'
import ActivityChart from '@/components/dashboard/ActivityChart.vue'

const store = useAdminStore()
onMounted(() => store.loadDashboard())

const k = computed(() => store.kpi)
const fmtMrr = computed(() => k.value ? `¥${(k.value.mrr / 1000).toFixed(1)}k` : '—')
const fmtArpu = computed(() => k.value ? `¥${k.value.arpu.toFixed(1)}` : '—')

const alertClass = (l: string) => l === 'error' ? 'al-err' : l === 'warn' ? 'al-warn' : 'al-info'

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
</script>

<template>
  <div class="dash">
    <div class="dash-section">
      <h2 class="dash-h2">核心指标</h2>
      <div v-if="store.kpiLoading && !k" class="dash-loading">加载中…</div>
      <div v-else class="dash-kpi-grid">
        <KpiCard label="总用户" :value="k?.totalUsers ?? 0" :delta="k?.deltaUsers" icon="👥" />
        <KpiCard label="付费用户" :value="k?.payingUsers ?? 0" icon="💎" />
        <KpiCard label="MRR" :value="fmtMrr" :delta="k?.deltaMrr" icon="💰" />
        <KpiCard label="ARPU" :value="fmtArpu" icon="📊" />
        <KpiCard label="7 日流失" :value="k?.churn7d ?? 0" unit="%" :delta="k?.deltaChurn" icon="📉" />
        <KpiCard label="当前在线" :value="k?.activeNow ?? 0" unit="人" icon="🟢" />
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-head">
          <h3 class="dash-h3">7 日收入曲线</h3>
          <span class="dash-tag">{{ store.revenue.length }} 数据点</span>
        </div>
        <RevenueChart :data="store.revenue" />
      </div>
      <div class="dash-card">
        <div class="dash-card-head">
          <h3 class="dash-h3">7 日活跃用户</h3>
          <span class="dash-tag">{{ store.active.length }} 数据点</span>
        </div>
        <ActivityChart :data="store.active" />
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-head">
        <h3 class="dash-h3">异常告警</h3>
        <span class="dash-tag warn">{{ store.alerts.length }} 条</span>
      </div>
      <div v-if="!store.alerts.length" class="dash-empty">暂无告警</div>
      <ul v-else class="dash-alert-list">
        <li v-for="a in store.alerts" :key="a.id" class="dash-alert" :class="alertClass(a.level)">
          <span class="dash-alert-dot" />
          <div class="dash-alert-body">
            <div class="dash-alert-title">{{ a.title }}</div>
            <div class="dash-alert-detail">{{ a.detail }}</div>
          </div>
          <span class="dash-alert-ts">{{ relTime(a.ts) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 20px; }
.dash-h2 { font-size: 14px; font-weight: 600; color: var(--text-secondary); margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
.dash-h3 { font-size: 15px; font-weight: 600; margin: 0; }
.dash-section { display: flex; flex-direction: column; gap: 10px; }
.dash-loading { padding: 20px; opacity: 0.6; }
.dash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
.dash-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }

.dash-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
}
.dash-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.dash-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}
.dash-tag.warn { color: var(--warning); border-color: var(--warning); }

.dash-empty { padding: 20px; text-align: center; opacity: 0.5; }
.dash-alert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.dash-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.dash-alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dash-alert.al-err .dash-alert-dot { background: var(--danger); }
.dash-alert.al-warn .dash-alert-dot { background: var(--warning); }
.dash-alert.al-info .dash-alert-dot { background: var(--info); }
.dash-alert-body { flex: 1; }
.dash-alert-title { font-size: 14px; font-weight: 500; }
.dash-alert-detail { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.dash-alert-ts { font-size: 11px; color: var(--text-secondary); }
</style>
