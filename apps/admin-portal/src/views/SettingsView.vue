<script setup lang="ts">
/**
 * SettingsView — 系统设置
 * 6 模块：AI / 支付 / 邮件 / 存储 / 限流 / API 路由
 */
import { onMounted, computed, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { getApi } from '../api-bridge'
import SettingModule, { type FieldSchema } from '@/components/settings/SettingModule.vue'

const store = useAdminStore()
onMounted(() => store.loadSettings())

const AI_FIELDS: FieldSchema[] = [
  { key: 'provider', label: '主供应商', type: 'select', options: [
    { label: 'OpenAI', value: 'openai' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Google', value: 'google' },
  ]},
  { key: 'fallback', label: '降级供应商', type: 'select', options: [
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'OpenAI', value: 'openai' },
    { label: '无', value: 'none' },
  ]},
  { key: 'dailyQuota', label: '日配额', type: 'number', hint: '每日最大请求数' },
  { key: 'timeoutMs', label: '超时 (ms)', type: 'number' },
]

const PAY_FIELDS: FieldSchema[] = [
  { key: 'provider', label: '支付渠道', type: 'select', options: [
    { label: '微信支付', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: 'Stripe', value: 'stripe' },
  ]},
  { key: 'currency', label: '币种', type: 'select', options: [
    { label: 'CNY', value: 'CNY' },
    { label: 'USD', value: 'USD' },
  ]},
  { key: 'taxRate', label: '税率', type: 'number', hint: '0-1 之间，如 0.06 = 6%' },
  { key: 'sandbox', label: '沙箱模式', type: 'switch' },
]

const EMAIL_FIELDS: FieldSchema[] = [
  { key: 'smtp', label: 'SMTP 主机', type: 'text', placeholder: 'smtp.example.com' },
  { key: 'port', label: '端口', type: 'number' },
  { key: 'from', label: '发件人', type: 'text' },
  { key: 'ssl', label: 'SSL/TLS', type: 'switch' },
]

const STORAGE_FIELDS: FieldSchema[] = [
  { key: 'driver', label: '存储驱动', type: 'select', options: [
    { label: 'S3', value: 's3' },
    { label: 'OSS', value: 'oss' },
    { label: '本地', value: 'local' },
  ]},
  { key: 'bucket', label: 'Bucket', type: 'text' },
  { key: 'cdn', label: 'CDN 域名', type: 'text' },
  { key: 'maxUploadMB', label: '单文件上限 (MB)', type: 'number' },
]

const RATE_FIELDS: FieldSchema[] = [
  { key: 'rps', label: '全局 RPS', type: 'number' },
  { key: 'burst', label: '突发上限', type: 'number' },
  { key: 'perUser', label: '单用户 RPS', type: 'number' },
  { key: 'windowSec', label: '时间窗 (秒)', type: 'number' },
]

const modules = computed(() => [
  { key: 'ai', title: 'AI 服务', desc: '主供应商 / 降级 / 配额 / 超时', icon: '🤖', fields: AI_FIELDS, value: store.settings.ai ?? {} },
  { key: 'payment', title: '支付配置', desc: '渠道 / 币种 / 税率 / 沙箱', icon: '💳', fields: PAY_FIELDS, value: store.settings.payment ?? {} },
  { key: 'email', title: '邮件服务', desc: 'SMTP / 端口 / 发件人 / SSL', icon: '📧', fields: EMAIL_FIELDS, value: store.settings.email ?? {} },
  { key: 'storage', title: '对象存储', desc: '驱动 / Bucket / CDN / 上传上限', icon: '🗄️', fields: STORAGE_FIELDS, value: store.settings.storage ?? {} },
  { key: 'ratelimit', title: '限流策略', desc: '全局 / 突发 / 单用户 / 时间窗', icon: '⏱️', fields: RATE_FIELDS, value: store.settings.ratelimit ?? {} },
])

async function onSave(payload: { module: string; value: Record<string, unknown> }) {
  await store.saveSetting(payload.module, payload.value)
}

/* ===== API 路由管理 ===== */
interface ApiRoute {
  path: string
  method: string
  target: string
  status: 'active' | 'inactive'
  requestCount: number
  avgLatency: number
  description: string
}

const apiRoutes = ref<ApiRoute[]>([])
const apiRoutesLoading = ref(true)
const routeFilter = ref<'all' | 'active' | 'inactive'>('all')

onMounted(async () => {
  apiRoutesLoading.value = true
  try {
    const http = getApi().http
    // 获取服务健康状态
    const healthRes = await http.get('/ops/services').catch((err) => { console.warn('[Settings] 服务列表获取失败，降级为静态映射:', err.message); return null })
    const services: any[] = healthRes?.items || healthRes?.data?.items || (Array.isArray(healthRes) ? healthRes : [])
    // 如果有真实服务数据则用真实数据，否则用静态路由映射
    if (services.length > 0) {
      apiRoutes.value = services.map((s: any) => ({
        path: s.basePath || s.path || `/v1/${s.name?.replace('-service', '')}/*`,
        method: s.methods || 'ALL',
        target: s.name || s.id || 'unknown',
        status: (s.status === 'healthy' || s.status === 'running') ? 'active' as const : 'inactive' as const,
        requestCount: s.requestCount ?? s.request_count ?? 0,
        avgLatency: s.avgLatency ?? s.avg_latency ?? 0,
        description: s.description || s.label || '',
      }))
    } else {
      // 从 ops/health 推断路由
      const health = await http.get('/ops/health').catch((err) => { console.warn('[Settings] 健康检查失败:', err.message); return null })
      if (health?.services) {
        apiRoutes.value = Object.entries(health.services).map(([name, info]: [string, any]) => ({
          path: `/v1/${name.replace('-service', '')}/*`,
          method: 'ALL',
          target: name,
          status: info?.status === 'healthy' ? 'active' as const : 'inactive' as const,
          requestCount: info?.requestCount ?? 0,
          avgLatency: info?.avgLatency ?? 0,
          description: info?.label || name,
        }))
      }
    }
  } catch {
    // API 不可用时显示空状态
    apiRoutes.value = []
  } finally {
    apiRoutesLoading.value = false
  }
})

const filteredRoutes = computed(() => {
  if (routeFilter.value === 'all') return apiRoutes.value
  return apiRoutes.value.filter(r => r.status === routeFilter.value)
})

function toggleRoute(route: ApiRoute) {
  route.status = route.status === 'active' ? 'inactive' : 'active'
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const methodColor = (m: string) => {
  switch (m) {
    case 'GET': return '#10b981'
    case 'POST': return '#3b82f6'
    case 'PUT': return '#f59e0b'
    case 'DELETE': return '#ef4444'
    default: return '#6b7280'
  }
}
</script>

<template>
  <div class="sv">
    <div v-if="store.settingsLoading && !Object.keys(store.settings).length" class="sv-loading">加载中…</div>
    <SettingModule
      v-for="m in modules"
      :key="m.key"
      :module-key="m.key"
      :title="m.title"
      :desc="m.desc"
      :icon="m.icon"
      :fields="m.fields"
      :value="m.value"
      :loading="store.settingsLoading"
      @save="onSave"
    />

    <!-- ===== API 路由管理 ===== -->
    <section class="api-routes">
      <header class="api-routes__head">
        <div class="api-routes__head-left">
          <span class="api-routes__icon">🔀</span>
          <div>
            <h3 class="api-routes__title">API 路由管理</h3>
            <p class="api-routes__desc">查看和管理所有 API 路由映射、请求统计和延迟</p>
          </div>
        </div>
        <div class="api-routes__head-right">
          <div class="api-routes__filter">
            <button
              v-for="f in (['all', 'active', 'inactive'] as const)"
              :key="f"
              class="api-routes__filter-btn"
              :class="{ 'api-routes__filter-btn--active': routeFilter === f }"
              @click="routeFilter = f"
            >
              {{ f === 'all' ? '全部' : f === 'active' ? '启用' : '停用' }}
            </button>
          </div>
        </div>
      </header>

      <div v-if="apiRoutesLoading" class="api-routes__loading">加载路由数据...</div>

      <div v-else class="api-routes__table-wrap">
        <table class="api-routes__table">
          <thead>
            <tr>
              <th>方法</th>
              <th>路由路径</th>
              <th>目标服务</th>
              <th>说明</th>
              <th>状态</th>
              <th>请求数</th>
              <th>平均延迟</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredRoutes" :key="r.path + r.method"
              :class="{ 'api-routes__row--inactive': r.status === 'inactive' }">
              <td>
                <span class="api-routes__method" :style="{ background: methodColor(r.method) + '22', color: methodColor(r.method) }">
                  {{ r.method }}
                </span>
              </td>
              <td class="api-routes__path">{{ r.path }}</td>
              <td>
                <span class="api-routes__target">{{ r.target }}</span>
              </td>
              <td class="api-routes__desc-cell">{{ r.description }}</td>
              <td>
                <span class="api-routes__status" :class="r.status === 'active' ? 'api-routes__status--active' : 'api-routes__status--inactive'">
                  {{ r.status === 'active' ? '启用' : '停用' }}
                </span>
              </td>
              <td class="api-routes__count">{{ formatCount(r.requestCount) }}</td>
              <td class="api-routes__latency" :class="{ 'api-routes__latency--slow': r.avgLatency > 2000 }">
                {{ formatLatency(r.avgLatency) }}
              </td>
              <td>
                <button class="api-routes__toggle" @click="toggleRoute(r)">
                  {{ r.status === 'active' ? '停用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Audio routes highlight -->
        <div class="api-routes__audio-badge">
          <span class="api-routes__audio-dot"></span>
          音频相关路由：{{ apiRoutes.filter(r => r.path.includes('audio')).length }} 条 ·
          今日请求 {{ formatCount(apiRoutes.filter(r => r.path.includes('audio')).reduce((s, r) => s + r.requestCount, 0)) }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sv { display: flex; flex-direction: column; gap: 16px; }
.sv-loading { padding: 40px; text-align: center; opacity: 0.6; }

/* ===== API Routes Section ===== */
.api-routes {
  background: var(--bg-secondary, #111827);
  border: 1px solid var(--border, #1f2937);
  border-radius: 12px;
  padding: 18px 22px;
}

.api-routes__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border, #1f2937);
}

.api-routes__head-left {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.api-routes__icon {
  font-size: 24px;
  line-height: 1;
}

.api-routes__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.api-routes__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
}

.api-routes__filter {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-primary, #0a0e1a);
  border: 1px solid var(--border, #1f2937);
  border-radius: 8px;
}

.api-routes__filter-btn {
  padding: 5px 12px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary, #9ca3af);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
}

.api-routes__filter-btn:hover {
  color: var(--text-primary, #f3f4f6);
}

.api-routes__filter-btn--active {
  background: var(--accent, #3b82f6);
  color: white;
}

.api-routes__loading {
  padding: 30px;
  text-align: center;
  color: var(--text-secondary, #9ca3af);
  font-size: 13px;
}

.api-routes__table-wrap {
  overflow-x: auto;
}

.api-routes__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.api-routes__table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid var(--border, #1f2937);
  white-space: nowrap;
}

.api-routes__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #1f2937);
  vertical-align: middle;
}

.api-routes__table tr:hover td {
  background: color-mix(in srgb, var(--accent, #3b82f6) 4%, transparent);
}

.api-routes__row--inactive td {
  opacity: 0.5;
}

.api-routes__method {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.5px;
}

.api-routes__path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--text-primary, #f3f4f6);
  font-weight: 500;
}

.api-routes__target {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg-primary, #0a0e1a);
  border: 1px solid var(--border, #1f2937);
  border-radius: 4px;
  color: var(--text-secondary, #9ca3af);
  white-space: nowrap;
}

.api-routes__desc-cell {
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.api-routes__status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.api-routes__status--active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.api-routes__status--inactive {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.api-routes__count {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 500;
}

.api-routes__latency {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #10b981;
}

.api-routes__latency--slow {
  color: #f59e0b;
}

.api-routes__toggle {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--bg-primary, #0a0e1a);
  border: 1px solid var(--border, #1f2937);
  border-radius: 5px;
  color: var(--text-secondary, #9ca3af);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms;
  white-space: nowrap;
}

.api-routes__toggle:hover {
  color: var(--accent, #3b82f6);
  border-color: var(--accent, #3b82f6);
}

.api-routes__audio-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--accent, #3b82f6) 8%, var(--bg-primary, #0a0e1a));
  border: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 30%, var(--border, #1f2937));
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
}

.api-routes__audio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent, #3b82f6);
}
</style>
