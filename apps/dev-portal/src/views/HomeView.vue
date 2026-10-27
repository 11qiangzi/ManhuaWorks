<template>
  <div class="home-view">
    <!-- 欢迎区 -->
    <div class="welcome-section">
      <h1 class="welcome-title">欢迎使用千机工坊开发者平台</h1>
      <p class="welcome-desc">
        一站式 API 服务 —— 漫剧创建、图像生成、视频合成、音乐制作、TTS 配音，六艺并行，尽在掌握。
      </p>
    </div>

    <!-- 快速统计 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-icon" :style="{ background: stat.iconBg }">{{ stat.icon }}</div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 快速入门 -->
    <div class="section">
      <h2 class="section-title">快速入门</h2>
      <div class="steps-grid">
        <div class="step-card" v-for="(step, idx) in quickSteps" :key="idx">
          <div class="step-number">{{ idx + 1 }}</div>
          <div class="step-content">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-desc">{{ step.desc }}</p>
            <router-link v-if="step.link" :to="step.link" class="step-link">
              {{ step.linkText }} &rarr;
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近 API 调用 -->
    <div class="section">
      <h2 class="section-title">最近 API 调用</h2>
      <div class="table-wrap">
        <table class="call-table">
          <thead>
            <tr>
              <th>方法</th>
              <th>路径</th>
              <th>状态</th>
              <th>耗时</th>
              <th>时间</th>
              <th>Key</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in recentLogs" :key="log.id">
              <td>
                <span class="method-badge" :class="methodClass(log.method)">{{ log.method }}</span>
              </td>
              <td class="mono">{{ log.path }}</td>
              <td>
                <span class="status-code" :class="statusClass(log.status)">{{ log.status }}</span>
              </td>
              <td class="mono">{{ log.duration }}ms</td>
              <td class="text-secondary">{{ log.timestamp }}</td>
              <td class="mono text-secondary">{{ log.keyPrefix }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMockCallLogs } from '@/composables/useDevApi'

const { logs: recentLogs } = useMockCallLogs()

const stats = [
  {
    icon: '📡',
    iconBg: 'rgba(0, 191, 165, 0.15)',
    value: '17,300',
    label: 'API 调用量 (本月)',
  },
  {
    icon: '🔑',
    iconBg: 'rgba(124, 58, 237, 0.15)',
    value: '3',
    label: '活跃 Key 数',
  },
  {
    icon: '📊',
    iconBg: 'rgba(251, 191, 36, 0.15)',
    value: '82%',
    label: '本月配额剩余',
  },
  {
    icon: '⚡',
    iconBg: 'rgba(96, 165, 250, 0.15)',
    value: '128ms',
    label: '平均响应时间',
  },
]

const quickSteps = [
  {
    title: '获取 API Key',
    desc: '在密钥管理页面创建你的第一个 API Key，用于身份认证。',
    link: '/api-keys',
    linkText: '前往管理',
  },
  {
    title: '查看 API 文档',
    desc: '浏览完整的接口文档，了解请求格式、参数与响应结构。',
    link: '/docs',
    linkText: '查看文档',
  },
  {
    title: '开始调用',
    desc: '使用 Playground 在线调试，或下载 SDK 快速集成到你的项目中。',
    link: '/playground',
    linkText: '开始调试',
  },
]

function methodClass(method: string) {
  return `method-${method.toLowerCase()}`
}

function statusClass(status: number) {
  if (status >= 200 && status < 300) return 'status-ok'
  if (status >= 400 && status < 500) return 'status-client-err'
  if (status >= 500) return 'status-server-err'
  return ''
}
</script>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: 32px;
}

.welcome-title {
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.welcome-desc {
  font-size: 15px;
  color: #9ca3af;
  line-height: 1.6;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s;
}

.stat-card:hover {
  border-color: #00BFA5;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #e5e7eb;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* 区块 */
.section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3348;
}

/* 快速入门 */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.step-card {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 16px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 6px;
}

.step-desc {
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.5;
  margin-bottom: 12px;
}

.step-link {
  font-size: 13px;
  color: #00BFA5;
  text-decoration: none;
  font-weight: 500;
}

.step-link:hover {
  text-decoration: underline;
}

/* 表格 */
.table-wrap {
  overflow-x: auto;
  border: 1px solid #2d3348;
  border-radius: 12px;
  background: #1a1d2e;
}

.call-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.call-table th {
  text-align: left;
  padding: 12px 16px;
  color: #6b7280;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #2d3348;
  background: #131627;
}

.call-table td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(45, 51, 72, 0.5);
  color: #d1d5db;
}

.call-table tr:last-child td {
  border-bottom: none;
}

.call-table tr:hover td {
  background: rgba(0, 191, 165, 0.03);
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.text-secondary {
  color: #6b7280;
}

.method-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  letter-spacing: 0.5px;
}

.method-get { background: #064e3b; color: #34d399; }
.method-post { background: #1e3a5f; color: #60a5fa; }
.method-patch { background: #4a3728; color: #fbbf24; }
.method-delete { background: #4a1d2e; color: #f87171; }

.status-code {
  font-family: monospace;
  font-weight: 600;
  font-size: 12px;
}

.status-ok { color: #34d399; }
.status-client-err { color: #fbbf24; }
.status-server-err { color: #f87171; }

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .steps-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
