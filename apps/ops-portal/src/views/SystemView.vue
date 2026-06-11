<script setup lang="ts">
/**
 * SystemView · 系统管理
 * ManhuaWorks · M1-W4 · L4-B
 *
 * 模块:
 *   1. 服务版本信息
 *   2. 环境配置概览
 *   3. 数据库状态
 *   4. 缓存状态
 *   5. 任务队列
 */
import { ref, onMounted } from 'vue'

const loading = ref(true)

onMounted(async () => {
  // API 数据待接 — 目前展示骨架屏
  await new Promise(r => setTimeout(r, 1000))
  loading.value = false
})
</script>

<template>
  <div class="system">
    <div class="system-header">
      <h1 class="system-title">⚙️ 系统管理</h1>
      <span class="system-tag">管理</span>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading" class="skeleton-grid">
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-bar skeleton-bar--value" />
        <div class="skeleton-bar skeleton-bar--desc" />
      </div>
      <div class="skeleton-card skeleton-card--wide">
        <div class="skeleton-bar skeleton-bar--title" />
        <div class="skeleton-table">
          <div class="skeleton-row" />
          <div class="skeleton-row" />
          <div class="skeleton-row" />
        </div>
      </div>
    </div>

    <!-- 真实内容 -->
    <div v-else>
      <!-- 服务版本 -->
      <section class="system-section">
        <h2 class="system-h2">服务版本</h2>
        <div class="version-grid">
          <div class="version-card">
            <span class="version-icon">🖥️</span>
            <div>
              <strong>user-service</strong>
              <p class="version-meta">:8088 · v1.3.2 · Express</p>
            </div>
            <span class="version-status version-status--ok">✅</span>
          </div>
          <div class="version-card">
            <span class="version-icon">📋</span>
            <div>
              <strong>project-service</strong>
              <p class="version-meta">:8089 · v1.2.0 · Express</p>
            </div>
            <span class="version-status version-status--ok">✅</span>
          </div>
          <div class="version-card">
            <span class="version-icon">💰</span>
            <div>
              <strong>billing-service</strong>
              <p class="version-meta">:8090 · v1.1.5 · Express</p>
            </div>
            <span class="version-status version-status--ok">✅</span>
          </div>
          <div class="version-card">
            <span class="version-icon">🤖</span>
            <div>
              <strong>ai-orchestrator</strong>
              <p class="version-meta">:8087 · v0.9.1 · Express</p>
            </div>
            <span class="version-status version-status--warn">⚠️</span>
          </div>
          <div class="version-card">
            <span class="version-icon">🔗</span>
            <div>
              <strong>collab-service</strong>
              <p class="version-meta">:8091 · v1.0.0 · Express</p>
            </div>
            <span class="version-status version-status--ok">✅</span>
          </div>
        </div>
      </section>

      <!-- 环境配置 -->
      <section class="system-section">
        <h2 class="system-h2">环境配置</h2>
        <div class="config-grid">
          <div class="config-card">
            <span class="config-label">运行环境</span>
            <span class="config-value">development</span>
          </div>
          <div class="config-card">
            <span class="config-label">Node.js</span>
            <span class="config-value">v24.14.0</span>
          </div>
          <div class="config-card">
            <span class="config-label">数据库</span>
            <span class="config-value">SQLite (dev)</span>
          </div>
          <div class="config-card">
            <span class="config-label">缓存</span>
            <span class="config-value">内存 (dev)</span>
          </div>
          <div class="config-card">
            <span class="config-label">任务队列</span>
            <span class="config-value">内存 (dev)</span>
          </div>
          <div class="config-card">
            <span class="config-label">日志级别</span>
            <span class="config-value">debug</span>
          </div>
        </div>
      </section>

      <!-- 数据库状态 -->
      <section class="system-section">
        <h2 class="system-h2">数据库</h2>
        <div class="db-grid">
          <div class="db-card db-card--ok">
            <span class="db-dot">🟢</span>
            <strong>连接</strong>
            <span class="db-meta">正常 · 0ms</span>
          </div>
          <div class="db-card">
            <span class="db-dot">📊</span>
            <strong>表数量</strong>
            <span class="db-meta">12</span>
          </div>
          <div class="db-card">
            <span class="db-dot">📦</span>
            <strong>大小</strong>
            <span class="db-meta">2.4 MB</span>
          </div>
        </div>
      </section>

      <!-- 空状态 — 等接真 API -->
      <div class="empty-state">
        <span class="empty-icon">🛠️</span>
        <p>系统数据待接入 API</p>
        <p class="empty-hint">后端管理端点就绪后将自动填充运行时数据</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system {
  padding: 24px;
  color: var(--text-primary);
}

.system-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.system-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.system-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  font-weight: 600;
}

/* ===== 骨架屏 ===== */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.skeleton-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card--wide {
  grid-column: span 3;
}

.skeleton-bar {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-primary) 0%, var(--border) 50%, var(--bg-primary) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-bar--title { width: 40%; height: 12px; }
.skeleton-bar--value { width: 65%; height: 20px; }
.skeleton-bar--desc { width: 80%; height: 10px; }

.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-primary) 0%, var(--border) 50%, var(--bg-primary) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 真实内容 ===== */
.system-section {
  margin-bottom: 28px;
}

.system-h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 12px;
}

/* 版本 */
.version-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.version-icon {
  font-size: 18px;
  width: 32px;
  text-align: center;
}

.version-card strong {
  font-size: 13px;
}

.version-meta {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.version-status {
  margin-left: auto;
  font-size: 16px;
}

/* 配置 */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.config-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-size: 13px;
}

.config-label {
  color: var(--text-secondary);
}

.config-value {
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 12px;
}

/* 数据库 */
.db-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.db-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-size: 13px;
}

.db-card strong {
  font-size: 12px;
}

.db-dot { font-size: 12px; }

.db-meta {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
}

.db-card--ok { border-color: color-mix(in srgb, #10b981 40%, transparent); }

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  margin-top: 16px;
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
