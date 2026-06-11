<script setup lang="ts">
/**
 * AccountView · 账户
 * ManhuaWorks · L3.L 用户后台深耕
 *
 * 4 模块：
 * 1. 基本信息（昵称/邮箱/手机/头像）
 * 2. 安全设置（密码/二步验证/登录设备）
 * 3. 通知偏好（邮件/站内/推送）
 * 4. 订阅管理（当前套餐/账单/取消）
 *
 * 调 apiClient.account.* + BYOK api-keys (来自 L3.D)
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { getApi } from '@/api-bridge'
import { useUser } from '@/composables/useUser'

const router = useRouter()
const api = getApi()
const { profile, nickname, email, phone, plan, load: loadUser, updateProfile, updateNotifications, logout } = useUser()

/* ------------------------------------------------------------------ */
/*                          类型                                       */
/* ------------------------------------------------------------------ */

interface ApiKey {
  id: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'custom'
  label: string
  masked: string
  last4: string
  isDefault: boolean
  createdAt: string
  lastUsedAt: string | null
}

interface SubPlan {
  name: string
  price: string
  period: string
  features: string[]
  current: boolean
}

const PROVIDER_META: Record<ApiKey['provider'], { label: string; color: string; icon: string }> = {
  openai: { label: 'OpenAI', color: '#10a37f', icon: '🟢' },
  anthropic: { label: 'Anthropic', color: '#d97706', icon: '🟠' },
  gemini: { label: 'Gemini', color: '#4285f4', icon: '🔵' },
  mistral: { label: 'Mistral', color: '#ff7000', icon: '🟧' },
  custom: { label: 'Custom', color: '#6b7280', icon: '⚙️' }
}

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */

const loading = ref(false)
const saved = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

const editNick = ref('')
const editEmail = ref('')
const editPhone = ref('')
const avatar = ref<string | null>(null)

const twoFA = ref(false)
const devices = ref<{ id: string; name: string; ip: string; at: string }[]>([
  { id: 'd1', name: '当前浏览器', ip: '127.0.0.1', at: new Date().toISOString() }
])

const notify = ref({
  emailComment: true,
  emailCollab: true,
  emailSystem: false,
  pushComment: true,
  pushCollab: false,
  inapp: true
})

const apiKeys = ref<ApiKey[]>([])
const showAddKey = ref(false)
const newKey = ref({ provider: 'openai' as ApiKey['provider'], label: '', value: '' })

const MOCK_KEYS: ApiKey[] = [
  { id: 'k1', provider: 'openai', label: '主力 GPT-4o', masked: 'sk-•••••••••••••••••••aZ3k', last4: 'aZ3k', isDefault: true, createdAt: '2026-05-15T03:00:00Z', lastUsedAt: new Date(Date.now() - 3600_000).toISOString() },
  { id: 'k2', provider: 'anthropic', label: '备用 Claude', masked: 'sk-ant-•••••••••••qX9p', last4: 'qX9p', isDefault: false, createdAt: '2026-05-22T08:00:00Z', lastUsedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }
]

const PLANS: SubPlan[] = [
  { name: '免费', price: '¥0', period: '永久', features: ['基础项目数 3', '基础素材库', '社区支持'], current: false },
  { name: 'Pro 创作者', price: '¥39', period: '月', features: ['无限项目', '完整素材库', 'BYOK 全部能力', '邮件优先支持'], current: true },
  { name: 'Studio 工作室', price: '¥299', period: '月', features: ['全部 Pro 能力', '团队协作无限成员', '4K 导出', '专属客服'], current: false }
]

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */

async function loadKeys(): Promise<void> {
  try {
    const res = await api.http.request<{ data: { list: ApiKey[] } }>({
      method: 'GET',
      path: '/v1/account/api-keys'
    })
    if (res?.data?.list) {
      apiKeys.value = res.data.list
    } else {
      apiKeys.value = MOCK_KEYS
    }
  } catch {
    apiKeys.value = MOCK_KEYS
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await loadUser()
    editNick.value = nickname.value || ''
    editEmail.value = email.value || ''
    editPhone.value = phone.value || ''
    avatar.value = profile.value?.avatar ?? null
    if (profile.value?.notifications) {
      notify.value = { ...notify.value, ...profile.value.notifications }
    }
    await loadKeys()
  } finally {
    loading.value = false
  }
})

/* ------------------------------------------------------------------ */
/*                          保存基本信息                                */
/* ------------------------------------------------------------------ */

async function saveProfile(): Promise<void> {
  saved.value = null
  errorMsg.value = null
  try {
    await updateProfile({
      nickname: editNick.value.trim(),
      email: editEmail.value.trim(),
      phone: editPhone.value.trim(),
      avatar: avatar.value
    })
    saved.value = '✅ 基本信息已保存'
    setTimeout(() => (saved.value = null), 2500)
  } catch (e) {
    errorMsg.value = '保存失败：' + (e as Error).message
  }
}

function onAvatarChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatar.value = URL.createObjectURL(file)
}

/* ------------------------------------------------------------------ */
/*                          保存通知                                    */
/* ------------------------------------------------------------------ */

async function saveNotify(): Promise<void> {
  saved.value = null
  try {
    await updateNotifications({ ...notify.value })
    saved.value = '✅ 通知偏好已保存'
    setTimeout(() => (saved.value = null), 2500)
  } catch (e) {
    errorMsg.value = '保存失败：' + (e as Error).message
  }
}

/* ------------------------------------------------------------------ */
/*                          订阅                                        */
/* ------------------------------------------------------------------ */

async function cancelSub(): Promise<void> {
  if (!confirm('确定取消订阅？取消后将降级到免费版。')) return
  try {
    await api.billing.cancelSubscription()
    saved.value = '✅ 订阅已取消（演示）'
    setTimeout(() => (saved.value = null), 2500)
  } catch (e) {
    errorMsg.value = '取消失败：' + (e as Error).message
  }
}

/* ------------------------------------------------------------------ */
/*                          API Key 管理                                */
/* ------------------------------------------------------------------ */

function openAddKey(): void {
  newKey.value = { provider: 'openai', label: '', value: '' }
  showAddKey.value = true
}

async function submitAddKey(): Promise<void> {
  if (!newKey.value.label.trim() || !newKey.value.value.trim()) {
    errorMsg.value = '请填写标签和 Key 值'
    return
  }
  const last4 = newKey.value.value.slice(-4)
  const k: ApiKey = {
    id: 'k-' + Date.now(),
    provider: newKey.value.provider,
    label: newKey.value.label.trim(),
    masked: '••••••••••••' + last4,
    last4,
    isDefault: apiKeys.value.length === 0,
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  }
  try {
    await api.http.request({ method: 'POST', path: '/v1/account/api-keys', body: { ...k, value: newKey.value.value } })
  } catch {
    /* mock */
  }
  apiKeys.value.push(k)
  showAddKey.value = false
  saved.value = '✅ API Key 已添加'
  setTimeout(() => (saved.value = null), 2500)
}

async function deleteKey(k: ApiKey): Promise<void> {
  if (!confirm(`确定删除「${k.label}」？`)) return
  try {
    await api.http.request({ method: 'DELETE', path: `/v1/account/api-keys/${k.id}` })
  } catch {
    /* mock */
  }
  apiKeys.value = apiKeys.value.filter((x) => x.id !== k.id)
}

async function setDefault(k: ApiKey): Promise<void> {
  try {
    await api.http.request({ method: 'POST', path: `/v1/account/api-keys/${k.id}/default` })
  } catch {
    /* mock */
  }
  apiKeys.value.forEach((x) => (x.isDefault = x.id === k.id))
}

function onLogout(): void {
  logout()
  router.push('/login')
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}
</script>

<template>
  <main class="ac">
    <header class="ac__nav">
      <div class="ac__brand">
        <span class="ac__logo">M</span>
        <span class="ac__brand-name">账户</span>
      </div>
      <nav class="ac__nav-links">
        <RouterLink to="/dashboard" class="ac__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="ac__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="ac__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="ac__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="ac__nav-link">团队</RouterLink>
        <RouterLink to="/account" class="ac__nav-link ac__nav-link--active">账户</RouterLink>
      </nav>
    </header>

    <div class="ac__content">
      <header class="ac__head">
        <h1 class="ac__title">⚙ 账户</h1>
        <p class="ac__sub">管理基本信息 / 安全 / 通知 / 订阅 / API Key</p>
        <div v-if="saved" class="ac__toast ac__toast--ok">{{ saved }}</div>
        <div v-if="errorMsg" class="ac__toast ac__toast--err">{{ errorMsg }}</div>
      </header>

      <!-- ===== 1. 基本信息 ===== -->
      <section class="ac__panel">
        <h2 class="ac__panel-title">1️⃣ 基本信息</h2>
        <div class="ac__profile">
          <div class="ac__avatar-wrap">
            <div class="ac__avatar">
              <img v-if="avatar" :src="avatar" alt="avatar" />
              <span v-else>🧑</span>
            </div>
            <label class="ac__avatar-btn">
              更换
              <input type="file" accept="image/*" @change="onAvatarChange" />
            </label>
          </div>
          <div class="ac__fields">
            <label class="ac__field">
              <span>昵称</span>
              <input v-model="editNick" type="text" />
            </label>
            <label class="ac__field">
              <span>邮箱</span>
              <input v-model="editEmail" type="email" />
            </label>
            <label class="ac__field">
              <span>手机</span>
              <input v-model="editPhone" type="tel" />
            </label>
            <button type="button" class="ac__btn ac__btn--primary" @click="saveProfile">保存基本信息</button>
          </div>
        </div>
      </section>

      <!-- ===== 2. 安全设置 ===== -->
      <section class="ac__panel">
        <h2 class="ac__panel-title">2️⃣ 安全设置</h2>
        <div class="ac__sec">
          <div class="ac__sec-row">
            <div>
              <p class="ac__sec-label">登录密码</p>
              <p class="ac__sec-hint">定期更换可降低被破解风险</p>
            </div>
            <button type="button" class="ac__btn">修改密码</button>
          </div>
          <div class="ac__sec-row">
            <div>
              <p class="ac__sec-label">二步验证 (2FA)</p>
              <p class="ac__sec-hint">绑定验证器 App 提高安全性</p>
            </div>
            <label class="ac__switch">
              <input v-model="twoFA" type="checkbox" />
              <span class="ac__switch-slider"></span>
            </label>
          </div>
          <div class="ac__sec-row ac__sec-row--col">
            <div class="ac__sec-row-head">
              <p class="ac__sec-label">登录设备</p>
              <button type="button" class="ac__btn ac__btn--danger" @click="onLogout">退出当前</button>
            </div>
            <ul class="ac__devices">
              <li v-for="d in devices" :key="d.id" class="ac__device">
                <span>💻 {{ d.name }}</span>
                <span class="ac__device-ip">{{ d.ip }}</span>
                <span class="ac__device-time">{{ formatDate(d.at) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ===== 3. 通知偏好 ===== -->
      <section class="ac__panel">
        <h2 class="ac__panel-title">3️⃣ 通知偏好</h2>
        <div class="ac__notify">
          <div class="ac__notify-group">
            <p class="ac__notify-title">📧 邮件</p>
            <label class="ac__check">
              <input v-model="notify.emailComment" type="checkbox" />
              <span>有人评论我的作品</span>
            </label>
            <label class="ac__check">
              <input v-model="notify.emailCollab" type="checkbox" />
              <span>团队协作邀请</span>
            </label>
            <label class="ac__check">
              <input v-model="notify.emailSystem" type="checkbox" />
              <span>系统公告与功能更新</span>
            </label>
          </div>
          <div class="ac__notify-group">
            <p class="ac__notify-title">📱 推送 / 站内</p>
            <label class="ac__check">
              <input v-model="notify.pushComment" type="checkbox" />
              <span>推送评论通知</span>
            </label>
            <label class="ac__check">
              <input v-model="notify.pushCollab" type="checkbox" />
              <span>推送协作提醒</span>
            </label>
            <label class="ac__check">
              <input v-model="notify.inapp" type="checkbox" />
              <span>站内消息中心</span>
            </label>
          </div>
          <button type="button" class="ac__btn ac__btn--primary" @click="saveNotify">保存通知偏好</button>
        </div>
      </section>

      <!-- ===== 4. 订阅管理 ===== -->
      <section class="ac__panel">
        <h2 class="ac__panel-title">4️⃣ 订阅管理</h2>
        <div class="ac__plans">
          <article
            v-for="p in PLANS"
            :key="p.name"
            class="ac__plan"
            :class="{ 'ac__plan--current': p.current }"
          >
            <header class="ac__plan-head">
              <h3>{{ p.name }}</h3>
              <span v-if="p.current" class="ac__plan-tag">当前套餐</span>
            </header>
            <p class="ac__plan-price">
              <strong>{{ p.price }}</strong>
              <span class="ac__plan-period">/ {{ p.period }}</span>
            </p>
            <ul class="ac__plan-feats">
              <li v-for="f in p.features" :key="f">✓ {{ f }}</li>
            </ul>
            <button
              v-if="p.current"
              type="button"
              class="ac__btn ac__btn--danger"
              @click="cancelSub"
            >取消订阅</button>
            <button v-else type="button" class="ac__btn ac__btn--primary" disabled>
              {{ p.price === '¥0' ? '降级到此套餐' : '切换套餐' }}
            </button>
          </article>
        </div>
      </section>

      <!-- ===== 4b. BYOK API Keys（来自 L3.D） ===== -->
      <section class="ac__panel">
        <h2 class="ac__panel-title">🔑 BYOK · API Key 管理</h2>
        <p class="ac__panel-sub">使用你自己的 AI 服务商 Key，享受更高额度与更稳定的服务</p>
        <div v-if="apiKeys.length === 0" class="ac__empty">还没有 API Key</div>
        <div v-else class="ac__keys">
          <article v-for="k in apiKeys" :key="k.id" class="ac__key">
            <div class="ac__key-info">
              <span class="ac__key-icon" :style="{ background: PROVIDER_META[k.provider].color + '22', color: PROVIDER_META[k.provider].color }">
                {{ PROVIDER_META[k.provider].icon }}
              </span>
              <div>
                <p class="ac__key-label">
                  {{ k.label }}
                  <span v-if="k.isDefault" class="ac__key-default">默认</span>
                </p>
                <p class="ac__key-masked">{{ k.masked }} · {{ PROVIDER_META[k.provider].label }}</p>
                <p class="ac__key-time">
                  创建 {{ formatDate(k.createdAt) }} · 上次使用 {{ k.lastUsedAt ? formatDate(k.lastUsedAt) : '从未' }}
                </p>
              </div>
            </div>
            <div class="ac__key-ops">
              <button v-if="!k.isDefault" type="button" class="ac__btn" @click="setDefault(k)">设为默认</button>
              <button type="button" class="ac__btn ac__btn--danger" @click="deleteKey(k)">删除</button>
            </div>
          </article>
        </div>
        <button type="button" class="ac__btn ac__btn--primary ac__btn--addkey" @click="openAddKey">+ 添加 API Key</button>
      </section>
    </div>

    <!-- 添加 Key 弹窗 -->
    <div v-if="showAddKey" class="ac__modal-mask" @click.self="showAddKey = false">
      <div class="ac__modal">
        <h3 class="ac__modal-title">添加 API Key</h3>
        <label class="ac__field">
          <span>服务商</span>
          <select v-model="newKey.provider">
            <option v-for="(m, p) in PROVIDER_META" :key="p" :value="p">{{ m.icon }} {{ m.label }}</option>
          </select>
        </label>
        <label class="ac__field">
          <span>标签</span>
          <input v-model="newKey.label" type="text" placeholder="例如：主力 GPT-4o" />
        </label>
        <label class="ac__field">
          <span>Key 值</span>
          <input v-model="newKey.value" type="password" placeholder="sk-..." />
        </label>
        <div class="ac__modal-actions">
          <button type="button" class="ac__btn" @click="showAddKey = false">取消</button>
          <button type="button" class="ac__btn ac__btn--primary" @click="submitAddKey">添加</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.ac { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.ac__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.ac__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.ac__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white; font-weight: 800;
}
.ac__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; }
.ac__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.ac__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.ac__nav-link--active { color: white; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); }

.ac__content { max-width: 900px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }
.ac__head { position: relative; }
.ac__title { font-size: 22px; font-weight: 800; margin: 0; }
.ac__sub { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }
.ac__toast {
  position: absolute; right: 0; top: 0;
  padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
}
.ac__toast--ok { background: color-mix(in srgb, #10b981 12%, transparent); color: #10b981; border: 1px solid #10b981; }
.ac__toast--err { background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; border: 1px solid #ef4444; }

.ac__panel {
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px;
}
.ac__panel-title { font-size: 16px; font-weight: 700; margin: 0 0 16px; }
.ac__panel-sub { font-size: 12px; color: var(--text-secondary); margin: -8px 0 16px; }

.ac__profile { display: grid; grid-template-columns: auto 1fr; gap: 24px; }
.ac__avatar-wrap { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.ac__avatar {
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  display: flex; align-items: center; justify-content: center; font-size: 36px; color: white;
  overflow: hidden;
}
.ac__avatar img { width: 100%; height: 100%; object-fit: cover; }
.ac__avatar-btn {
  font-size: 11px; padding: 3px 8px; border: 1px solid var(--border);
  border-radius: 4px; cursor: pointer; background: var(--bg-primary);
}
.ac__avatar-btn input { display: none; }
.ac__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ac__fields .ac__btn { grid-column: 1 / -1; justify-self: flex-start; }
.ac__field { display: flex; flex-direction: column; gap: 4px; }
.ac__field span { font-size: 11px; color: var(--text-secondary); }
.ac__field input, .ac__field select {
  height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px;
}

.ac__sec { display: flex; flex-direction: column; gap: 12px; }
.ac__sec-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px;
}
.ac__sec-row--col { flex-direction: column; align-items: stretch; }
.ac__sec-row-head { display: flex; justify-content: space-between; align-items: center; }
.ac__sec-label { font-size: 13px; font-weight: 700; margin: 0; }
.ac__sec-hint { font-size: 11px; color: var(--text-secondary); margin: 2px 0 0; }
.ac__switch { position: relative; width: 40px; height: 22px; }
.ac__switch input { display: none; }
.ac__switch-slider {
  position: absolute; inset: 0; background: var(--border); border-radius: 99px; transition: 200ms; cursor: pointer;
}
.ac__switch-slider::before {
  content: ''; position: absolute; left: 2px; top: 2px; width: 18px; height: 18px;
  background: white; border-radius: 50%; transition: 200ms;
}
.ac__switch input:checked + .ac__switch-slider { background: #f59e0b; }
.ac__switch input:checked + .ac__switch-slider::before { transform: translateX(18px); }

.ac__devices { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ac__device {
  display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
  font-size: 12px; padding: 6px 0; border-top: 1px dashed var(--border);
}
.ac__device-ip { color: var(--text-secondary); }
.ac__device-time { color: var(--text-secondary); font-size: 11px; }

.ac__notify { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.ac__notify .ac__btn { grid-column: 1 / -1; justify-self: flex-start; }
.ac__notify-group { display: flex; flex-direction: column; gap: 6px; }
.ac__notify-title { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
.ac__check { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
.ac__check input { cursor: pointer; }

.ac__plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 720px) { .ac__plans { grid-template-columns: 1fr; } }
.ac__plan {
  border: 1px solid var(--border); border-radius: 10px; padding: 16px;
  display: flex; flex-direction: column; gap: 8px; background: var(--bg-primary);
}
.ac__plan--current { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 5%, var(--bg-primary)); }
.ac__plan-head { display: flex; justify-content: space-between; align-items: center; }
.ac__plan-head h3 { font-size: 14px; font-weight: 700; margin: 0; }
.ac__plan-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #f59e0b; color: white; font-weight: 600; }
.ac__plan-price strong { font-size: 24px; font-weight: 800; }
.ac__plan-period { font-size: 12px; color: var(--text-secondary); margin-left: 4px; }
.ac__plan-feats { list-style: none; margin: 0; padding: 0; font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 2px; }
.ac__plan-feats li::first-letter { color: #10b981; }

.ac__empty { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; }
.ac__keys { display: flex; flex-direction: column; gap: 8px; }
.ac__key {
  display: flex; align-items: center; gap: 16px; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-primary);
}
.ac__key-info { display: flex; gap: 12px; align-items: center; flex: 1; }
.ac__key-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.ac__key-label { font-size: 13px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px; }
.ac__key-default { font-size: 10px; padding: 1px 6px; background: #f59e0b; color: white; border-radius: 4px; font-weight: 600; }
.ac__key-masked { font-size: 11px; color: var(--text-secondary); margin: 2px 0; font-family: monospace; }
.ac__key-time { font-size: 10px; color: var(--text-secondary); margin: 0; }
.ac__key-ops { display: flex; gap: 6px; }
.ac__btn--addkey { margin-top: 12px; }

.ac__btn {
  height: 32px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer; font-size: 12px; font-weight: 600;
}
.ac__btn--primary { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border: none; }
.ac__btn--danger { color: #ef4444; border-color: #ef4444; }
.ac__btn--danger:hover { background: #ef4444; color: white; }
.ac__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ac__modal-mask { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; }
.ac__modal { background: var(--bg-primary); border-radius: 12px; padding: 24px; width: 90%; max-width: 480px; }
.ac__modal-title { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
.ac__modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

@media (max-width: 720px) {
  .ac__profile, .ac__fields, .ac__notify { grid-template-columns: 1fr; }
}
</style>
