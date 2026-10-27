<template>
  <div class="api-keys-view">
    <div class="view-header">
      <div>
        <h1 class="view-title">API Key 管理</h1>
        <p class="view-desc">创建和管理你的 API 密钥，用于请求身份认证。请妥善保管密钥，不要在前端代码中暴露。</p>
      </div>
      <button class="btn-primary" @click="showCreateDialog = true">
        + 创建新 Key
      </button>
    </div>

    <!-- Key 列表 -->
    <div class="keys-list">
      <div
        v-for="key in keys"
        :key="key.id"
        class="key-card"
        :class="{ revoked: key.status === 'revoked' }"
      >
        <div class="key-main">
          <div class="key-info">
            <div class="key-name">{{ key.name }}</div>
            <div class="key-prefix mono">{{ key.prefix }}</div>
          </div>
          <div class="key-meta">
            <div class="meta-item">
              <span class="meta-label">创建时间</span>
              <span class="meta-value">{{ key.createdAt }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">最后使用</span>
              <span class="meta-value">{{ key.lastUsed }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">调用次数</span>
              <span class="meta-value mono">{{ key.usageCount.toLocaleString() }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">状态</span>
              <span class="status-badge" :class="'status-' + key.status">
                {{ statusLabel(key.status) }}
              </span>
            </div>
          </div>
        </div>
        <div class="key-actions">
          <button class="btn-ghost" @click="copyKey(key)" title="复制 Key">
            {{ copiedId === key.id ? '已复制!' : '复制' }}
          </button>
          <button
            v-if="key.status === 'active'"
            class="btn-danger"
            @click="confirmDelete(key)"
          >
            删除
          </button>
        </div>
      </div>

      <div v-if="keys.length === 0" class="empty-state">
        <p>暂无 API Key，点击上方按钮创建。</p>
      </div>
    </div>

    <!-- 创建对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <h3 class="dialog-title">创建新的 API Key</h3>
        <div class="form-group">
          <label class="form-label">Key 名称</label>
          <input
            v-model="newKeyName"
            type="text"
            class="form-input"
            placeholder="例如：生产环境、测试环境"
            @keyup.enter="handleCreate"
          />
        </div>
        <div v-if="createdKey" class="created-key-box">
          <p class="created-key-warn">请立即复制并安全保存此密钥，它不会再次显示！</p>
          <div class="created-key-value mono">sk-{{ createdKeyFull }}</div>
          <button class="btn-primary" @click="copyCreatedKey">复制到剪贴板</button>
        </div>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button v-if="!createdKey" class="btn-primary" :disabled="!newKeyName.trim()" @click="handleCreate">
            创建
          </button>
          <button v-else class="btn-primary" @click="closeDialog">完成</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="dialog-overlay" @click.self="deleteTarget = null">
      <div class="dialog">
        <h3 class="dialog-title">确认删除</h3>
        <p class="dialog-body">
          确定要删除 Key「<strong>{{ deleteTarget.name }}</strong>」吗？使用此 Key 的所有集成将立即失效。
        </p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="deleteTarget = null">取消</button>
          <button class="btn-danger" @click="handleDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMockApiKeys, type ApiKey } from '@/composables/useDevApi'

const { keys, createKey, deleteKey } = useMockApiKeys()

const showCreateDialog = ref(false)
const newKeyName = ref('')
const createdKey = ref<ApiKey | null>(null)
const createdKeyFull = ref('')
const copiedId = ref<string | null>(null)
const deleteTarget = ref<ApiKey | null>(null)

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: '活跃',
    revoked: '已撤销',
    expired: '已过期',
  }
  return map[status] || status
}

function copyKey(key: ApiKey) {
  // 模拟复制
  copiedId.value = key.id
  setTimeout(() => {
    copiedId.value = null
  }, 2000)
}

function handleCreate() {
  if (!newKeyName.value.trim()) return
  const key = createKey(newKeyName.value.trim())
  createdKey.value = key
  // 模拟一次性完整 key 展示
  createdKeyFull.value = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

function copyCreatedKey() {
  // 模拟复制完整 key
  navigator.clipboard?.writeText('sk-' + createdKeyFull.value).catch(() => {})
}

function closeDialog() {
  showCreateDialog.value = false
  newKeyName.value = ''
  createdKey.value = null
  createdKeyFull.value = ''
}

function confirmDelete(key: ApiKey) {
  deleteTarget.value = key
}

function handleDelete() {
  if (deleteTarget.value) {
    deleteKey(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>

<style scoped>
.api-keys-view {
  max-width: 960px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 6px;
}

.view-desc {
  font-size: 14px;
  color: #6b7280;
  max-width: 500px;
  line-height: 1.5;
}

/* Key 卡片 */
.keys-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.key-card {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 12px;
  padding: 20px;
  transition: border-color 0.2s;
}

.key-card:hover {
  border-color: #3d4460;
}

.key-card.revoked {
  opacity: 0.6;
}

.key-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.key-name {
  font-size: 15px;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 4px;
}

.key-prefix {
  font-size: 13px;
  color: #6b7280;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.key-meta {
  display: flex;
  gap: 24px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 13px;
  color: #9ca3af;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-active {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.status-revoked {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.status-expired {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.key-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #2d3348;
}

/* 按钮 */
.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5, #009688);
  color: white;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  padding: 6px 12px;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  border: 1px solid #2d3348;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost:hover {
  background: #1e2235;
  color: #e5e7eb;
}

.btn-danger {
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  font-size: 12px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger:hover {
  background: rgba(248, 113, 113, 0.2);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
  font-size: 14px;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 16px;
  padding: 24px;
  width: 440px;
  max-width: 90vw;
}

.dialog-title {
  font-size: 18px;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 16px;
}

.dialog-body {
  font-size: 14px;
  color: #9ca3af;
  line-height: 1.6;
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 600;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: #0f1117;
  border: 1px solid #2d3348;
  border-radius: 8px;
  color: #e5e7eb;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus {
  border-color: #00BFA5;
}

/* 创建成功 */
.created-key-box {
  background: rgba(0, 191, 165, 0.05);
  border: 1px solid rgba(0, 191, 165, 0.2);
  border-radius: 10px;
  padding: 16px;
  margin-top: 16px;
}

.created-key-warn {
  font-size: 12px;
  color: #fbbf24;
  margin-bottom: 10px;
  font-weight: 500;
}

.created-key-value {
  font-size: 14px;
  color: #00BFA5;
  padding: 10px;
  background: #0f1117;
  border-radius: 6px;
  word-break: break-all;
  margin-bottom: 12px;
}

@media (max-width: 768px) {
  .key-main {
    flex-direction: column;
    align-items: flex-start;
  }
  .key-meta {
    flex-wrap: wrap;
    gap: 12px;
  }
  .meta-item {
    align-items: flex-start;
  }
}
</style>
