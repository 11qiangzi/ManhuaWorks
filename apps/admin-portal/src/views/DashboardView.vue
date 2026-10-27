<script setup lang="ts">
/**
 * DashboardView — 仪表板
 * 4 个 KPI + 7 日收入 + 7 日活跃 + 异常告警 + 服务监控
 */
import { onMounted, computed, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { getApi } from '../api-bridge'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import RevenueChart from '@/components/dashboard/RevenueChart.vue'
import ActivityChart from '@/components/dashboard/ActivityChart.vue'

const http = () => getApi().http

const store = useAdminStore()
onMounted(() => store.loadDashboard())

const k = computed(() => store.kpi)
const fmtMrr = computed(() => k.value ? `¥${(k.value.mrr / 1000).toFixed(1)}k` : '—')
const fmtArpu = computed(() => k.value ? `¥${k.value.arpu.toFixed(1)}` : '—')

/* ===== 配乐统计 (从 admin analytics 获取，合并到音频面板 onMounted) ===== */
const todayMusicGen = ref(0)
const monthMusicTotal = ref(0)
const todayMusicDelta = ref(0)
const monthMusicDelta = ref(0)

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

/* ===== 服务监控 ===== */
interface ServiceInfo {
  id: string
  name: string
  label: string
  port: number
  status: 'running' | 'degraded' | 'down'
  cpu: number
  mem: number
  todayCount: number
  countLabel: string
  modelVersion: string
  uptime: string
}

const servicesLoading = ref(true)
const services = ref<ServiceInfo[]>([])

const SERVICE_LABELS: Record<string, string> = {
  'user-service': '用户服务',
  'project-service': '项目服务',
  'collab-service': '协作服务',
  'billing-service': '计费服务',
  'ai-orchestrator': 'AI 编排服务',
}
const SERVICE_PORTS: Record<string, number> = {
  'user-service': 8088,
  'project-service': 8089,
  'collab-service': 8091,
  'billing-service': 8090,
  'ai-orchestrator': 8087,
}

onMounted(async () => {
  try {
    const [health, overview] = await Promise.allSettled([
      http().get('/ops/health') as Promise<any>,
      http().get('/ops/overview') as Promise<any>,
    ])
    const healthData = health.status === 'fulfilled' ? health.value : {}
    const items = healthData?.services || []
    services.value = items.map((s: any) => ({
      id: s.service || s.name,
      name: s.service || s.name,
      label: SERVICE_LABELS[s.service] || s.service || '',
      port: SERVICE_PORTS[s.service] || 0,
      status: s.up ? 'running' as const : 'down' as const,
      cpu: 0,
      mem: 0,
      todayCount: 0,
      countLabel: '今日请求',
      modelVersion: '—',
      uptime: s.latencyMs ? `${s.latencyMs}ms` : '—',
    }))
  } catch {
    services.value = []
  }
  servicesLoading.value = false
})

const statusColor = (s: string) => s === 'running' ? '#10b981' : s === 'degraded' ? '#f59e0b' : '#ef4444'
const statusLabel = (s: string) => s === 'running' ? '运行中' : s === 'degraded' ? '性能降级' : '已停止'
const statusIcon = (s: string) => s === 'running' ? '🟢' : s === 'degraded' ? '🟡' : '🔴'

/* ===== 音频数据面板 (从 admin analytics 获取) ===== */
const audioLoading = ref(true)
const audioHasData = ref(false)
const todayMusicCount = ref(0)
const musicDelta = ref(0)
const hotTrack = ref({ name: '—', usageCount: 0 })
const sparklineData = ref([0, 0, 0, 0, 0, 0, 0])
const sparklineLabels = ref(['周一', '周二', '周三', '周四', '周五', '周六', '周日'])
const modulePieData = ref([
  { label: '漫改', pct: 0, color: '#6366f1' },
  { label: '宣传片', pct: 0, color: '#f59e0b' },
  { label: '广告', pct: 0, color: '#10b981' },
])

const sparklineMax = computed(() => Math.max(...sparklineData.value, 1))

onMounted(async () => {
  try {
    const analytics = await http().get('/admin/analytics').catch((err) => { console.warn('[Dashboard] 统计数据获取失败，面板显示默认值:', err.message); return null })
    if (analytics) {
      // 配乐 KPI 统计
      const content = analytics.contentBreakdown || analytics.content || {}
      todayMusicGen.value = content.todayMusic ?? content.musicToday ?? 0
      monthMusicTotal.value = content.monthMusic ?? content.musicMonth ?? 0
      todayMusicDelta.value = content.musicDelta ?? 0
      monthMusicDelta.value = content.musicMonthDelta ?? 0
      // 音频数据面板
      const audio = analytics.audio || analytics.music || {}
      todayMusicCount.value = audio.todayCount ?? 0
      musicDelta.value = audio.delta ?? 0
      if (audio.hotTrack) hotTrack.value = audio.hotTrack
      if (Array.isArray(audio.sparkline)) sparklineData.value = audio.sparkline
      if (Array.isArray(audio.moduleBreakdown)) {
        modulePieData.value = audio.moduleBreakdown.map((m: any) => ({
          label: m.label || m.name,
          pct: m.pct ?? m.percentage ?? 0,
          color: m.color || '#6366f1',
        }))
      }
      audioHasData.value = todayMusicCount.value > 0 || sparklineData.value.some(v => v > 0)
    }
  } catch { /* keep 0 defaults */ }
  audioLoading.value = false
})
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
        <KpiCard label="今日配乐生成" :value="todayMusicGen" unit="首" :delta="todayMusicDelta" icon="🎵" />
        <KpiCard label="本月配乐总量" :value="monthMusicTotal" unit="首" :delta="monthMusicDelta" icon="🎼" />
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

    <!-- ===== 服务监控 ===== -->
    <div class="dash-card">
      <div class="dash-card-head">
        <h3 class="dash-h3">🖥 服务状态</h3>
        <span class="dash-tag">{{ services.length }} 个服务</span>
      </div>

      <div v-if="servicesLoading" class="dash-loading">加载服务数据...</div>
      <div v-else class="svc-grid">
        <div v-for="svc in services" :key="svc.id" class="svc-card"
          :class="{ 'svc-card--degraded': svc.status === 'degraded', 'svc-card--down': svc.status === 'down' }">
          <div class="svc-card__head">
            <span class="svc-card__status-dot" :style="{ background: statusColor(svc.status) }"></span>
            <span class="svc-card__label">{{ svc.label }}</span>
            <span class="svc-card__status-label" :style="{ color: statusColor(svc.status) }">
              {{ statusIcon(svc.status) }} {{ statusLabel(svc.status) }}
            </span>
          </div>

          <div class="svc-card__name">{{ svc.name }} <span class="svc-card__port">:{{ svc.port }}</span></div>

          <div class="svc-card__metrics">
            <div class="svc-card__metric">
              <span class="svc-card__metric-label">CPU</span>
              <div class="svc-card__bar">
                <div class="svc-card__bar-fill" :style="{ width: svc.cpu + '%', background: svc.cpu > 50 ? '#f59e0b' : '#10b981' }"></div>
              </div>
              <span class="svc-card__metric-val">{{ svc.cpu }}%</span>
            </div>
            <div class="svc-card__metric">
              <span class="svc-card__metric-label">内存</span>
              <span class="svc-card__metric-val">{{ svc.mem }}MB</span>
            </div>
          </div>

          <div class="svc-card__footer">
            <div class="svc-card__stat-row">
              <span class="svc-card__stat-label">{{ svc.countLabel }}</span>
              <span class="svc-card__stat-val">{{ svc.todayCount.toLocaleString() }}</span>
            </div>
            <div class="svc-card__stat-row">
              <span class="svc-card__stat-label">版本</span>
              <span class="svc-card__stat-val svc-card__stat-val--mono">{{ svc.modelVersion }}</span>
            </div>
            <div class="svc-card__stat-row">
              <span class="svc-card__stat-label">运行</span>
              <span class="svc-card__stat-val svc-card__stat-val--mono">{{ svc.uptime }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 音频数据面板 ===== -->
    <div class="dash-card">
      <div class="dash-card-head">
        <h3 class="dash-h3">🎵 音频数据</h3>
        <span class="dash-tag">{{ audioHasData ? '实时' : '待激活' }}</span>
      </div>

      <div v-if="audioLoading" class="dash-loading">加载音频数据...</div>

      <div v-else-if="!audioHasData" class="audio-empty">
        <span class="audio-empty__icon">🎵</span>
        <p class="audio-empty__text">音频数据面板将在有作品使用配乐后自动开启</p>
      </div>

      <div v-else class="audio-grid">
        <!-- Card 1: 今日配乐生成数 -->
        <div class="audio-stat">
          <div class="audio-stat__head">
            <span class="audio-stat__label">今日配乐生成数</span>
            <span class="audio-stat__delta" :class="musicDelta >= 0 ? 'delta-up' : 'delta-down'">
              {{ musicDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(musicDelta) }}%
            </span>
          </div>
          <div class="audio-stat__value">{{ todayMusicCount }}<span class="audio-stat__unit">首</span></div>
          <div class="audio-stat__bar">
            <div class="audio-stat__bar-fill" :style="{ width: (todayMusicCount / 60 * 100) + '%' }"></div>
          </div>
        </div>

        <!-- Card 2: 热门配乐 -->
        <div class="audio-stat">
          <div class="audio-stat__head">
            <span class="audio-stat__label">热门配乐</span>
            <span class="audio-stat__tag">🔥 HOT</span>
          </div>
          <div class="audio-stat__value audio-stat__value--text">{{ hotTrack.name }}</div>
          <div class="audio-stat__sub">使用 {{ hotTrack.usageCount }} 次</div>
        </div>

        <!-- Card 3: 音乐生成趋势 (sparkline) -->
        <div class="audio-stat audio-stat--wide">
          <div class="audio-stat__head">
            <span class="audio-stat__label">音乐生成趋势</span>
            <span class="audio-stat__tag">7 天</span>
          </div>
          <div class="audio-sparkline">
            <div
              v-for="(val, i) in sparklineData"
              :key="i"
              class="audio-sparkline__col"
            >
              <div
                class="audio-sparkline__bar"
                :style="{ height: (val / sparklineMax * 100) + '%' }"
                :title="sparklineLabels[i] + ': ' + val + '首'"
              />
              <span class="audio-sparkline__label">{{ sparklineLabels[i] }}</span>
            </div>
          </div>
        </div>

        <!-- Card 4: 各模块配乐占比 -->
        <div class="audio-stat">
          <div class="audio-stat__head">
            <span class="audio-stat__label">各模块配乐占比</span>
          </div>
          <div class="audio-pie-legend">
            <div v-for="seg in modulePieData" :key="seg.label" class="audio-pie-legend__row">
              <span class="audio-pie-legend__dot" :style="{ background: seg.color }" />
              <span class="audio-pie-legend__name">{{ seg.label }}</span>
              <div class="audio-pie-legend__bar-wrap">
                <div class="audio-pie-legend__bar" :style="{ width: seg.pct + '%', background: seg.color }" />
              </div>
              <span class="audio-pie-legend__pct">{{ seg.pct }}%</span>
            </div>
          </div>
        </div>
      </div>
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

/* ===== Service Monitoring ===== */
.svc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.svc-card {
  background: var(--bg-primary, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 200ms;
}

.svc-card:hover {
  border-color: var(--accent, #3b82f6);
  transform: translateY(-1px);
}

.svc-card--degraded {
  border-color: #f59e0b;
  background: color-mix(in srgb, #f59e0b 3%, var(--bg-primary, var(--bg-secondary)));
}

.svc-card--down {
  border-color: #ef4444;
  background: color-mix(in srgb, #ef4444 3%, var(--bg-primary, var(--bg-secondary)));
}

.svc-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-card__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.svc-card__label {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.svc-card__status-label {
  font-size: 11px;
  font-weight: 500;
}

.svc-card__name {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text-secondary);
}

.svc-card__port {
  color: var(--accent, #3b82f6);
}

.svc-card__metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.svc-card__metric {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-card__metric-label {
  font-size: 11px;
  color: var(--text-secondary);
  width: 28px;
  flex-shrink: 0;
}

.svc-card__bar {
  flex: 1;
  height: 4px;
  background: var(--border, #1f2937);
  border-radius: 2px;
  overflow: hidden;
}

.svc-card__bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 500ms ease;
}

.svc-card__metric-val {
  font-size: 11px;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.svc-card__footer {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 8px;
  border-top: 1px solid var(--border, #1f2937);
}

.svc-card__stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.svc-card__stat-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.svc-card__stat-val {
  font-size: 11px;
  font-weight: 600;
}

.svc-card__stat-val--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ===== Audio Metrics Section ===== */
.audio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.audio-stat {
  background: var(--bg-primary, var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 200ms;
}

.audio-stat:hover {
  border-color: var(--accent, #6366f1);
  transform: translateY(-1px);
}

.audio-stat--wide {
  grid-column: span 2;
}

@media (max-width: 600px) {
  .audio-stat--wide { grid-column: span 1; }
}

.audio-stat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.audio-stat__label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.audio-stat__delta {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.delta-up {
  color: #10b981;
  background: color-mix(in srgb, #10b981 12%, transparent);
}

.delta-down {
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 12%, transparent);
}

.audio-stat__tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent, #6366f1) 15%, transparent);
  color: var(--accent, #6366f1);
}

.audio-stat__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.audio-stat__value--text {
  font-size: 20px;
}

.audio-stat__unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 4px;
}

.audio-stat__sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.audio-stat__bar {
  height: 4px;
  background: var(--border, #1f2937);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}

.audio-stat__bar-fill {
  height: 100%;
  background: var(--accent, #6366f1);
  border-radius: 2px;
  transition: width 500ms ease;
}

/* Sparkline */
.audio-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 80px;
  padding-top: 8px;
}

.audio-sparkline__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  gap: 4px;
}

.audio-sparkline__bar {
  width: 100%;
  max-width: 28px;
  background: linear-gradient(to top, var(--accent, #6366f1), #8b5cf6);
  border-radius: 3px 3px 0 0;
  min-height: 4px;
  transition: height 400ms ease;
}

.audio-sparkline__label {
  font-size: 10px;
  color: var(--text-secondary);
}

/* Pie legend */
.audio-pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.audio-pie-legend__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-pie-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.audio-pie-legend__name {
  font-size: 13px;
  color: var(--text-primary);
  min-width: 48px;
}

.audio-pie-legend__bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--border, #1f2937);
  border-radius: 3px;
  overflow: hidden;
}

.audio-pie-legend__bar {
  height: 100%;
  border-radius: 3px;
  transition: width 500ms ease;
}

.audio-pie-legend__pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: right;
}

/* Empty state */
.audio-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
}

.audio-empty__icon {
  font-size: 36px;
  opacity: 0.4;
}

.audio-empty__text {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}
</style>
