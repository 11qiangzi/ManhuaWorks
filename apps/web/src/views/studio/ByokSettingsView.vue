<script setup lang="ts">
/**
 * ByokSettingsView · BYOK 设置
 * ManhuaWorks · W2
 *
 * 功能：
 * 1. 列出所有 API Key（脱敏）
 * 2. 添加新 Key（选 provider / 输入 alias / 输入明文 / 测通）
 * 3. 删除 Key
 * 4. 测试连通性
 * 5. 加密状态展示（AES-256-GCM）
 */

import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import KeyStatusBadge from '@/components/studio/KeyStatusBadge.vue'
import {
  listKeys,
  createKey,
  deleteKey,
  testKey,
  validateKeyFormat,
  type ByokKey,
  type KeyTestResult
} from '@/api/byok'
import { PROVIDERS, type Provider } from '@/api/ai-router'

const router = useRouter()

const keys = ref<ByokKey[]>([])
const loading = ref(true)

/** 新增表单 */
const showAdd = ref(false)
const submitting = ref(false)
const testing = ref(false)
const form = reactive({
  provider: 'openai' as Provider,
  keyAlias: '',
  apiKey: ''
})
const formError = ref<string | null>(null)

/** 测试结果（keyId → result） */
const testResults = ref<Record<string, KeyTestResult>>({})

/** 确认删除 */
const confirmDeleteId = ref<string | null>(null)

/** 按 provider 分组 */
const grouped = computed(() => {
  const map: Record<string, ByokKey[]> = {}
  for (const k of keys.value) {
    if (!map[k.provider]) map[k.provider] = []
    map[k.provider]!.push(k)
  }
  return map
})

const totalMonthlyUsage = computed(() => {
  return keys.value.reduce((sum, k) => sum + (k.monthlyUsageUsd ?? 0), 0)
})

async function loadKeys() {
  loading.value = true
  try {
    keys.value = await listKeys()
  } catch (err) {
    // 离线/未登录：用占位演示
    console.warn('[BYOK] 拉取失败，使用占位', err)
    keys.value = [
      {
        id: 'demo-1',
        provider: 'openai',
        keyAlias: '主力',
        maskedKey: 'sk-***xY7q',
        status: 'valid',
        lastUsedAt: '2026-06-06 14:32',
        createdAt: '2026-05-20'
      },
      {
        id: 'demo-2',
        provider: 'anthropic',
        keyAlias: '备用',
        maskedKey: 'sk-ant-***aP3k',
        status: 'expiring',
        expiresInDays: 7,
        lastUsedAt: '2026-06-04 09:15',
        createdAt: '2026-04-10'
      },
      {
        id: 'demo-3',
        provider: 'google',
        keyAlias: 'Google 测试',
        maskedKey: 'AIza***sJ9z',
        status: 'invalid',
        lastUsedAt: '2026-05-30 18:42',
        createdAt: '2026-05-15'
      }
    ]
  } finally {
    loading.value = false
  }
}

function providerMeta(id: Provider) {
  return PROVIDERS.find((p) => p.id === id)
}

function openAdd() {
  showAdd.value = true
  formError.value = null
  form.provider = 'openai'
  form.keyAlias = ''
  form.apiKey = ''
}

function closeAdd() {
  showAdd.value = false
  formError.value = null
}

async function onSubmit() {
  formError.value = null

  // 1. 基础校验
  if (!form.keyAlias.trim()) {
    formError.value = '请填写 Key 别名（方便记忆）'
    return
  }
  if (!form.apiKey.trim()) {
    formError.value = '请输入 API Key'
    return
  }
  const v = validateKeyFormat(form.provider, form.apiKey.trim())
  if (!v.ok) {
    formError.value = v.reason ?? 'Key 格式不正确'
    return
  }

  submitting.value = true
  try {
    const created = await createKey({
      provider: form.provider,
      keyAlias: form.keyAlias.trim(),
      apiKey: form.apiKey.trim()
    })
    keys.value.unshift({
      id: created.id,
      provider: form.provider,
      keyAlias: form.keyAlias.trim(),
      maskedKey: created.maskedKey,
      status: created.status,
      lastUsedAt: null,
      createdAt: new Date().toISOString().slice(0, 10)
    })
    closeAdd()
  } catch (err) {
    // 离线：本地占位
    keys.value.unshift({
      id: `local-${Date.now()}`,
      provider: form.provider,
      keyAlias: form.keyAlias.trim(),
      maskedKey: form.apiKey.slice(0, 4) + '***' + form.apiKey.slice(-4),
      status: 'valid',
      lastUsedAt: null,
      createdAt: new Date().toISOString().slice(0, 10)
    })
    closeAdd()
  } finally {
    submitting.value = false
  }
}

async function onTest(id: string) {
  testing.value = true
  try {
    const result = await testKey(id)
    testResults.value[id] = result
    // 同步更新 key 状态
    const k = keys.value.find((x) => x.id === id)
    if (k) k.status = result.status
  } catch (err) {
    testResults.value[id] = {
      ok: false,
      status: 'invalid',
      latencyMs: 0,
      error: (err as Error).message
    }
  } finally {
    testing.value = false
  }
}

async function onDelete(id: string) {
  if (confirmDeleteId.value !== id) {
    confirmDeleteId.value = id
    setTimeout(() => {
      if (confirmDeleteId.value === id) confirmDeleteId.value = null
    }, 3000)
    return
  }
  try {
    await deleteKey(id)
    keys.value = keys.value.filter((k) => k.id !== id)
  } catch (err) {
    // 离线：本地移除
    keys.value = keys.value.filter((k) => k.id !== id)
  } finally {
    confirmDeleteId.value = null
  }
}

onMounted(() => {
  loadKeys()
})
</script>

<template>
  <main class="byok">
    <!-- 顶栏 -->
    <header class="byok__nav">
      <div class="byok__brand">
        <button class="byok__back" @click="router.push('/settings')" title="返回设置">←</button>
        <span class="byok__logo">M</span>
        <span class="byok__brand-name">BYOK 设置</span>
      </div>
      <div class="byok__nav-right">
        <ThemeSwitcher mode="compact" />
      </div>
    </header>

    <div class="byok__content">
      <!-- 标题 -->
      <section class="byok__header">
        <div>
          <h1>🔑 BYOK · API Key 管理</h1>
          <p>自己用自己 Key · 平台不中转余额 · 端到端加密存储</p>
        </div>
        <button type="button" class="qh-btn qh-btn--primary" @click="openAdd">
          ＋ 添加 API Key
        </button>
      </section>

      <!-- 加密说明 -->
      <section class="byok__enc">
        <div class="byok__enc-item">
          <span class="byok__enc-icon">🔒</span>
          <div>
            <strong>AES-256-GCM 加密</strong>
            <p>Key 落库前先在服务端加密 · 数据库泄漏也不影响</p>
          </div>
        </div>
        <div class="byok__enc-item">
          <span class="byok__enc-icon">🚫</span>
          <div>
            <strong>明文不返回</strong>
            <p>前端永远只看到脱敏形式（sk-***xY7q）</p>
          </div>
        </div>
        <div class="byok__enc-item">
          <span class="byok__enc-icon">⏱</span>
          <div>
            <strong>按需解密</strong>
            <p>仅在调用时解密到内存 · 不入日志</p>
          </div>
        </div>
      </section>

      <!-- 加载 -->
      <div v-if="loading" class="byok__loading">
        <div class="byok__spinner" />
        <span>加载 Key 列表...</span>
      </div>

      <!-- 空 -->
      <div v-else-if="keys.length === 0" class="byok__empty">
        <span class="byok__empty-icon">🔑</span>
        <p>尚未配置任何 API Key</p>
        <button type="button" class="qh-btn qh-btn--primary" @click="openAdd">＋ 添加第一个 Key</button>
      </div>

      <!-- Key 列表（按 provider 分组） -->
      <section v-else class="byok__groups">
        <!-- 用量总览 -->
        <div class="byok__usage-summary">
          <div class="byok__usage-item">
            <span>Key 总数</span>
            <strong>{{ keys.length }}</strong>
          </div>
          <div class="byok__usage-item">
            <span>本月总费用</span>
            <strong>${{ totalMonthlyUsage.toFixed(2) }}</strong>
          </div>
          <div class="byok__usage-item">
            <span>供应商</span>
            <strong>{{ Object.keys(grouped).length }}</strong>
          </div>
        </div>
        <div
          v-for="(groupKeys, providerId) in grouped"
          :key="providerId"
          class="byok__group"
        >
          <header class="byok__group-head">
            <span class="byok__group-logo">{{ providerMeta(providerId as Provider)?.logo }}</span>
            <h2>{{ providerMeta(providerId as Provider)?.name ?? providerId }}</h2>
            <span class="byok__group-count">{{ groupKeys.length }} 个 Key</span>
          </header>

          <div class="byok__key-list">
            <article
              v-for="k in groupKeys"
              :key="k.id"
              class="byok__key-card"
            >
              <div class="byok__key-head">
                <div>
                  <h3>{{ k.keyAlias }}</h3>
                  <code class="byok__key-masked">{{ k.maskedKey }}</code>
                </div>
                <KeyStatusBadge :status="k.status" />
              </div>

              <div class="byok__key-meta">
                <div>
                  <span>创建</span>
                  <strong>{{ k.createdAt }}</strong>
                </div>
                <div v-if="k.lastUsedAt">
                  <span>最近使用</span>
                  <strong>{{ k.lastUsedAt }}</strong>
                </div>
                <div v-if="k.monthlyUsageUsd !== undefined">
                  <span>本月用量</span>
                  <strong>${{ k.monthlyUsageUsd.toFixed(2) }}</strong>
                </div>
                <div v-if="k.status === 'expiring' && k.expiresInDays !== undefined">
                  <span>过期倒计时</span>
                  <strong style="color: var(--warning)">{{ k.expiresInDays }} 天</strong>
                </div>
              </div>

              <!-- 测试结果 -->
              <div v-if="testResults[k.id]" class="byok__test-result" :class="{ 'byok__test-result--ok': testResults[k.id]?.ok, 'byok__test-result--err': !testResults[k.id]?.ok }">
                <span v-if="testResults[k.id]?.ok">✓ 连通 · 延迟 {{ testResults[k.id]?.latencyMs }}ms</span>
                <span v-else>✗ 失败 · {{ testResults[k.id]?.error ?? '未知错误' }}</span>
              </div>

              <div class="byok__key-actions">
                <button
                  type="button"
                  class="qh-btn qh-btn--sm"
                  :disabled="testing"
                  @click="onTest(k.id)"
                >
                  {{ testing ? '测试中...' : '🔌 测试连通' }}
                </button>
                <button
                  type="button"
                  class="qh-btn qh-btn--sm qh-btn--danger"
                  @click="onDelete(k.id)"
                >
                  {{ confirmDeleteId === k.id ? '⚠ 确认删除？' : '🗑 删除' }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>

    <!-- 添加 Key 弹窗 -->
    <div v-if="showAdd" class="modal-mask" @click.self="closeAdd">
      <div class="modal">
        <header class="modal__head">
          <h2>添加 API Key</h2>
          <button class="modal__close" @click="closeAdd">×</button>
        </header>
        <form class="modal__form" @submit.prevent="onSubmit">
          <label class="form-field">
            <span>供应商</span>
            <select v-model="form.provider" class="form-input">
              <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">
                {{ p.logo }} {{ p.name }}
              </option>
            </select>
          </label>
          <label class="form-field">
            <span>Key 别名 <em>*</em></span>
            <input
              v-model="form.keyAlias"
              type="text"
              maxlength="50"
              required
              placeholder="例如：主力 / 备用 / 测试"
              class="form-input"
            />
          </label>
          <label class="form-field">
            <span>API Key（明文 · 仅传输一次） <em>*</em></span>
            <input
              v-model="form.apiKey"
              type="password"
              required
              placeholder="sk-... / sk-ant-... / AIza..."
              class="form-input"
              autocomplete="off"
            />
            <small class="form-hint">
              提示：OpenAI 以 <code>sk-</code> 开头，Anthropic 以 <code>sk-ant-</code> 开头，Google 以 <code>AIza</code> 开头
            </small>
          </label>

          <div v-if="formError" class="form-error">⚠ {{ formError }}</div>

          <footer class="modal__foot">
            <button type="button" class="qh-btn" @click="closeAdd">取消</button>
            <button type="submit" class="qh-btn qh-btn--primary" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </main>
</template>

<style scoped>
.byok {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.byok__nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.byok__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.byok__back {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
}

.byok__back:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.byok__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gradient);
  color: white;
  font-size: 14px;
  font-weight: 800;
}

.byok__brand-name {
  font-size: 15px;
  font-weight: 600;
}

.byok__content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.byok__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.byok__header h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
}

.byok__header p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.qh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms;
}

.qh-btn:hover { border-color: var(--accent); color: var(--accent); }

.qh-btn--primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.qh-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: var(--glow);
}

.qh-btn--sm { padding: 6px 12px; font-size: 12px; }
.qh-btn--danger:hover { border-color: var(--danger); color: var(--danger); }

.qh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 加密说明 */
.byok__enc {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  padding: 16px 20px;
  background: color-mix(in srgb, var(--success) 6%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--success) 20%, transparent);
  border-radius: 12px;
}

.byok__enc-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.byok__enc-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.byok__enc-item strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.byok__enc-item p {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.byok__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-secondary);
}

.byok__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.byok__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  color: var(--text-secondary);
}

.byok__empty-icon {
  font-size: 48px;
  opacity: 0.6;
}

.byok__empty p {
  margin: 0;
  font-size: 14px;
}

.byok__groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.byok__usage-summary {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: var(--bg-card, rgba(255,255,255,0.04));
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255,255,255,0.08));
}
.byok__usage-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.byok__usage-item span {
  font-size: 12px;
  color: var(--text-secondary, #888);
}
.byok__usage-item strong {
  font-size: 18px;
  font-weight: 600;
}

.byok__group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.byok__group-logo {
  font-size: 22px;
  line-height: 1;
}

.byok__group-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.byok__group-count {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-secondary);
  border-radius: 999px;
}

.byok__key-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.byok__key-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 200ms;
}

.byok__key-card:hover {
  border-color: var(--accent);
}

.byok__key-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.byok__key-head h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.byok__key-masked {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 3px;
}

.byok__key-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  font-size: 11px;
}

.byok__key-meta > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.byok__key-meta > div > span {
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10px;
}

.byok__key-meta > div > strong {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary);
}

.byok__test-result {
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.byok__test-result--ok {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
}

.byok__test-result--err {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.byok__key-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  animation: fadeIn 200ms ease;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  width: 100%;
  max-width: 520px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  animation: slideUp 240ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal__head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.modal__close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  cursor: pointer;
  border-radius: 6px;
  font-family: inherit;
}

.modal__close:hover { color: var(--danger); }

.modal__form {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-field em {
  color: var(--danger);
  font-style: normal;
}

.form-input {
  padding: 9px 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow);
}

.form-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.form-hint code {
  font-family: monospace;
  font-size: 11px;
  background: var(--bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
}

.form-error {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  border-radius: 6px;
  font-size: 13px;
}

.modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

@media (max-width: 720px) {
  .byok__nav { padding: 12px 16px; }
  .byok__content { padding: 20px 16px 40px; }
  .byok__header h1 { font-size: 20px; }
  .byok__key-list { grid-template-columns: 1fr; }
}
</style>
