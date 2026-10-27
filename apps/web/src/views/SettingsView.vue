<script setup lang="ts">
/**
 * SettingsView.vue - 设置页（内嵌全功能）
 * 
 * 6个Tab：账号信息 / 订阅与计费 / API密钥 / 通知设置 / 主题外观 / 团队成员
 * 所有功能内嵌在主站内，不再跳转外部链接
 */
import { ref, computed, onMounted, watch } from 'vue'
import { getClient } from '@manhuaworks/api-client'

/** 统一 HTTP helper */
const http = () => getClient().http

// ══════════════════════════════════════════════════════════
//  Tab 定义
// ══════════════════════════════════════════════════════════
const TABS = [
  { key: 'account', label: '账号信息', icon: '👤' },
  { key: 'billing', label: '订阅与计费', icon: '💳' },
  { key: 'apikeys', label: 'API 密钥', icon: '🔑' },
  { key: 'notifications', label: '通知设置', icon: '🔔' },
  { key: 'theme', label: '主题外观', icon: '🎨' },
  { key: 'team', label: '团队成员', icon: '👥' },
] as const

type TabKey = typeof TABS[number]['key']
const activeTab = ref<TabKey>('account')

// ══════════════════════════════════════════════════════════
//  用户信息
// ══════════════════════════════════════════════════════════
interface UserInfo {
  id: string
  email?: string
  phone?: string
  nickname?: string
  display_name?: string
  avatar_url?: string
  role?: number
  status?: number
}

const user = ref<UserInfo | null>(null)
const toast = ref('')

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}

onMounted(async () => {
  // Load from localStorage first (instant)
  try {
    const raw = localStorage.getItem('user')
    if (raw) user.value = JSON.parse(raw)
  } catch { user.value = null }
  // Refresh from API (async)
  try {
    const me = await http().get('/v1/me') as any
    if (me?.id) {
      user.value = { ...user.value, ...me } as UserInfo
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  } catch { /* use cached localStorage data */ }
})

const userInitial = computed(() => {
  const name = user.value?.display_name || user.value?.nickname || user.value?.email || '?'
  return name[0].toUpperCase()
})

// ══════════════════════════════════════════════════════════
//  Tab 1: 账号信息
// ══════════════════════════════════════════════════════════
const accountForm = ref({ nickname: '', email: '', phone: '' })
const accountSaving = ref(false)

watch(user, (u) => {
  if (u) {
    accountForm.value = {
      nickname: u.display_name || u.nickname || '',
      email: u.email || '',
      phone: u.phone || '',
    }
  }
}, { immediate: true })

async function saveAccount() {
  accountSaving.value = true
  try {
    const updated = await http().patch('/v1/me', {
      display_name: accountForm.value.nickname,
    }) as any
    if (user.value && updated) {
      user.value.display_name = updated.display_name ?? accountForm.value.nickname
      user.value.email = updated.email ?? user.value.email
      user.value.phone = updated.phone ?? user.value.phone
      localStorage.setItem('user', JSON.stringify(user.value))
    }
    showToast('账号信息已保存')
  } catch (e: any) {
    showToast(e?.message || '保存失败，请重试')
  } finally {
    accountSaving.value = false
  }
}

// ══════════════════════════════════════════════════════════
//  Tab 1b: 修改密码
// ══════════════════════════════════════════════════════════
const showPwdChange = ref(false)
const pwdForm = ref({ oldPwd: '', newPwd: '', confirmPwd: '' })
const pwdSaving = ref(false)

async function changePassword() {
  if (!pwdForm.value.oldPwd || !pwdForm.value.newPwd) {
    showToast('请填写旧密码和新密码'); return
  }
  if (pwdForm.value.newPwd.length < 8) {
    showToast('新密码至少 8 位'); return
  }
  if (pwdForm.value.newPwd !== pwdForm.value.confirmPwd) {
    showToast('两次密码不一致'); return
  }
  pwdSaving.value = true
  try {
    await http().post('/v1/me/password', {
      old_password: pwdForm.value.oldPwd,
      new_password: pwdForm.value.newPwd,
    })
    showToast('密码已修改')
    showPwdChange.value = false
    pwdForm.value = { oldPwd: '', newPwd: '', confirmPwd: '' }
  } catch (e: any) {
    const msg = e?.code === 'wrong_old_password' ? '旧密码不正确'
      : e?.code === 'weak_password' ? '密码强度不足（至少 8 位）'
      : e?.message || '修改密码失败'
    showToast(msg)
  } finally {
    pwdSaving.value = false
  }
}

// ══════════════════════════════════════════════════════════
//  Tab 2: 订阅与计费
// ══════════════════════════════════════════════════════════
interface PlanInfo { name: string; price: string; episodes: string; features: string[] }

const PLAN_LABELS: Record<string, string> = { free: '免费版', pro: '专业版', team: '团队版', basic: '基础版', enterprise: '企业版' }

const currentPlan = ref<PlanInfo>({
  name: '免费版',
  price: '¥0/月',
  episodes: '—',
  features: ['基础 AI 模型', '720p 视频导出', '社区支持'],
})

const quotaInfo = ref({ monthlyTokens: 0, usedTokens: 0, monthlyImages: 0, usedImages: 0, monthlyVideos: 0, usedVideos: 0 })

const plans: PlanInfo[] = [
  { name: '免费版', price: '¥0/月', episodes: '9 次/月', features: ['基础 AI 模型', '720p 视频导出', '社区支持', '作品展示页'] },
  { name: '基础版', price: '¥39/月', episodes: '50 次/月', features: ['高级 AI 模型', '1080p 视频导出', '优先客服', '角色库 50 个', '场景库 100 个'] },
  { name: '专业版', price: '¥149/月', episodes: '280 次/月', features: ['顶级 AI 模型', '4K 视频导出', '专属客服', '无限角色/场景', '团队协作 5 人', 'API 接入'] },
  { name: '企业版', price: '定制', episodes: '无限制', features: ['定制 AI 模型训练', '8K 视频导出', '7×24 技术支持', '白标定制', '无限团队协作', '专属 API + SDK'] },
]

const billingHistory = ref<Array<{ date: string; type: string; amount: string; status: string }>>([])

const billingLoading = ref(false)

onMounted(async () => {
  billingLoading.value = true
  try {
    // Load current subscription
    const sub = await http().get('/v1/subscriptions/me') as any
    if (sub?.plan) {
      const label = PLAN_LABELS[sub.plan] || sub.plan
      const matched = plans.find(p => p.name === label)
      currentPlan.value = matched ? { ...matched, name: label } : { ...currentPlan.value, name: label }
    }
    // Load quotas
    const q = await http().get('/v1/quotas/me') as any
    if (q) {
      quotaInfo.value = {
        monthlyTokens: q.monthly_tokens ?? 0,
        usedTokens: q.used_tokens ?? 0,
        monthlyImages: q.monthly_images ?? 0,
        usedImages: q.used_images ?? 0,
        monthlyVideos: q.monthly_videos ?? 0,
        usedVideos: q.used_videos ?? 0,
      }
      currentPlan.value = { ...currentPlan.value, episodes: `${q.monthly_videos - q.used_videos} 次视频 / ${q.monthly_images - q.used_images} 次图片（剩余）` }
    }
    // Load orders/billing history
    try {
      const orders = await http().get('/v1/orders', { limit: 20 }) as any
      const list = orders?.list || orders?.items || (Array.isArray(orders) ? orders : [])
      billingHistory.value = list.map((o: any) => ({
        date: (o.created_at || o.createdAt || '').slice(0, 10),
        type: o.plan ? `订阅 · ${PLAN_LABELS[o.plan] || o.plan}` : '充值',
        amount: o.amount_cents ? `¥${(o.amount_cents / 100).toFixed(2)}` : '¥0',
        status: o.status === 'paid' ? '已支付' : o.status === 'pending' ? '待支付' : o.status || '—',
      }))
    } catch { /* billing-service may not be running */ }
  } catch { /* user-service may not have subscription rows yet */ }
  billingLoading.value = false
})

function upgradePlan(plan: PlanInfo) {
  if (plan.name === '企业版') {
    showToast('请联系客服：sales@qianjigongfang.com')
  } else {
    showToast(`即将升级到 ${plan.name}（支付功能开发中）`)
  }
}

// ══════════════════════════════════════════════════════════
//  Tab 3: API 密钥 (BYOK)
// ══════════════════════════════════════════════════════════
interface ApiKey {
  id: string
  provider: string
  alias: string
  keyPreview: string
  createdAt: string
  lastUsed?: string
  isDefault?: boolean
}

const apiKeys = ref<ApiKey[]>([])
const showAddKey = ref(false)
const newKeyForm = ref({ provider: 'deepseek', alias: '', apiKey: '' })
const keysLoading = ref(false)

const providers = [
  { id: 'deepseek', name: 'DeepSeek', desc: '文本生成 + 剧本创作' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT + DALL-E + TTS' },
  { id: 'zhipu', name: '智谱 AI', desc: 'GLM 文本 + CogView 图片' },
  { id: 'qianwen', name: '通义千问', desc: '阿里云 通义千问 + 通义万相' },
  { id: 'replicate', name: 'Replicate', desc: '开源模型托管平台' },
  { id: 'fal', name: 'fal.ai', desc: '快速推理 API' },
]

async function loadApiKeys() {
  keysLoading.value = true
  try {
    const keys = await http().get('/v1/user/byok-keys') as any
    const list = Array.isArray(keys) ? keys : (keys?.list || keys?.items || [])
    apiKeys.value = list.map((k: any) => ({
      id: k.id,
      provider: k.provider,
      alias: k.nickname || k.alias || '',
      keyPreview: k.key_preview || k.keyPreview || (k.apiKey ? k.apiKey.slice(0, 6) + '****' : '****'),
      createdAt: (k.created_at || k.createdAt || '').slice(0, 10),
      lastUsed: k.last_used || k.lastUsed,
      isDefault: k.isDefault ?? k.is_default,
    }))
  } catch { /* first-time user may have no keys */ }
  keysLoading.value = false
}

onMounted(() => { loadApiKeys() })

async function addApiKey() {
  if (!newKeyForm.value.alias || !newKeyForm.value.apiKey) {
    showToast('请填写别名和 API Key')
    return
  }
  try {
    const created = await http().post('/v1/user/byok-keys', {
      provider: newKeyForm.value.provider,
      apiKey: newKeyForm.value.apiKey,
      nickname: newKeyForm.value.alias,
    }) as any
    apiKeys.value.push({
      id: created?.id || String(Date.now()),
      provider: newKeyForm.value.provider,
      alias: newKeyForm.value.alias,
      keyPreview: newKeyForm.value.apiKey.slice(0, 6) + '****...' + newKeyForm.value.apiKey.slice(-4),
      createdAt: new Date().toISOString().slice(0, 10),
    })
    newKeyForm.value = { provider: 'deepseek', alias: '', apiKey: '' }
    showAddKey.value = false
    showToast('API Key 已添加')
  } catch (e: any) {
    showToast(e?.message || '添加失败，请检查 Key 格式')
  }
}

async function removeApiKey(id: string) {
  try {
    await http().delete(`/v1/user/byok-keys/${id}`)
    apiKeys.value = apiKeys.value.filter(k => k.id !== id)
    showToast('API Key 已删除')
  } catch (e: any) {
    showToast(e?.message || '删除失败')
  }
}

function getProviderName(id: string) {
  return providers.find(p => p.id === id)?.name || id
}

// ══════════════════════════════════════════════════════════
//  Tab 4: 通知设置
// ══════════════════════════════════════════════════════════
const NOTIF_STORAGE_KEY = 'mhw:notification-prefs'

const notifSettings = ref({
  emailGeneration: true,
  emailBilling: true,
  emailMarketing: false,
  webGeneration: true,
  webCollab: true,
  webSystem: true,
})

onMounted(() => {
  try {
    const stored = localStorage.getItem(NOTIF_STORAGE_KEY)
    if (stored) Object.assign(notifSettings.value, JSON.parse(stored))
  } catch { /* use defaults */ }
})

async function saveNotifications() {
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifSettings.value))
    showToast('通知设置已保存')
  } catch (e: any) {
    showToast(e?.message || '保存失败')
  }
}

// ══════════════════════════════════════════════════════════
//  Tab 5: 主题外观
// ══════════════════════════════════════════════════════════
const currentTheme = '暗夜工坊'
const themeOptions = [
  { name: '暗夜工坊', desc: '深色主题，适合长时间创作', locked: true, active: true },
  { name: '极简白', desc: '明亮主题，清晰的白色背景', locked: true, active: false },
  { name: '创作橙', desc: '暖色调，激发创造力', locked: true, active: false },
  { name: '国风墨', desc: '水墨风格，东方美学', locked: true, active: false },
  { name: '赛博霓虹', desc: '赛博朋克，霓虹灯效', locked: true, active: false },
]

// ══════════════════════════════════════════════════════════
//  Tab 6: 团队成员 (collab-service)
// ══════════════════════════════════════════════════════════
interface TeamMember { id: string; name: string; email: string; role: string; joinedAt: string }

const teamMembers = ref<TeamMember[]>([])
const showInvite = ref(false)
const inviteEmail = ref('')
const inviteRole = ref('editor')
const teamId = ref<string | null>(null)
const teamLoading = ref(false)

const roleLabels: Record<string, string> = { owner: '拥有者', admin: '管理员', editor: '编辑者', viewer: '查看者', commenter: '评论者' }

onMounted(async () => {
  teamLoading.value = true
  try {
    // Get user's teams
    const teamsRes = await http().get('/v1/teams') as any
    const teams = teamsRes?.items || teamsRes?.list || (Array.isArray(teamsRes) ? teamsRes : [])
    if (teams.length > 0) {
      teamId.value = teams[0].id
      // Get members of first team
      const membersRes = await http().get(`/v1/teams/${teamId.value}/members`) as any
      const members = membersRes?.members || membersRes?.items || (Array.isArray(membersRes) ? membersRes : [])
      teamMembers.value = members.map((m: any) => ({
        id: m.user_id || m.id,
        name: m.display_name || m.name || m.user_id?.slice(0, 8) || '—',
        email: m.email || '',
        role: m.role || 'viewer',
        joinedAt: (m.joined_at || m.joinedAt || m.created_at || '').slice(0, 10),
      }))
    } else {
      // No team yet — create a default one
      try {
        const created = await http().post('/v1/teams', { name: '我的团队' }) as any
        teamId.value = created?.id || null
        if (created?.id) {
          teamMembers.value = [{
            id: user.value?.id || 'me',
            name: user.value?.display_name || '我',
            email: user.value?.email || '',
            role: 'owner',
            joinedAt: new Date().toISOString().slice(0, 10),
          }]
        }
      } catch { /* team creation may fail if user doesn't have permission */ }
    }
  } catch { /* collab-service may not be running */ }
  teamLoading.value = false
})

async function inviteMember() {
  if (!inviteEmail.value) { showToast('请输入邮箱'); return }
  if (!teamId.value) { showToast('团队尚未创建'); return }
  try {
    await http().post(`/v1/teams/${teamId.value}/invitations`, {
      email: inviteEmail.value,
      role: inviteRole.value,
    })
    inviteEmail.value = ''
    showInvite.value = false
    showToast('邀请已发送')
  } catch (e: any) {
    showToast(e?.message || '邀请发送失败')
  }
}

async function removeMember(userId: string) {
  if (!teamId.value) return
  try {
    await http().delete(`/v1/teams/${teamId.value}/members/${userId}`)
    teamMembers.value = teamMembers.value.filter(m => m.id !== userId)
    showToast('成员已移除')
  } catch (e: any) {
    showToast(e?.message || '移除失败')
  }
}
</script>

<template>
  <div class="settings-page">
    <!-- Toast -->
    <Transition name="toast-fade">
      <div v-if="toast" class="settings-toast">{{ toast }}</div>
    </Transition>

    <!-- Header -->
    <header class="settings-header">
      <h1 class="settings-title">⚙️ 设置</h1>
      <p class="settings-sub">管理你的账号、订阅、API Key 和团队</p>
    </header>

    <!-- Tab bar -->
    <nav class="settings-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="settings-tab"
        :class="{ 'settings-tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="settings-tab-icon">{{ tab.icon }}</span>
        <span class="settings-tab-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Tab content -->
    <div class="settings-content">

      <!-- ═══ Tab 1: 账号信息 ═══ -->
      <section v-if="activeTab === 'account'" class="settings-section">
        <div class="user-profile-card">
          <div class="avatar-large">{{ userInitial }}</div>
          <div class="profile-info">
            <h2>{{ user?.display_name || user?.nickname || '未登录用户' }}</h2>
            <p class="profile-email">{{ user?.email || '未设置邮箱' }}</p>
            <p class="profile-id">ID: <code>{{ user?.id || '—' }}</code></p>
          </div>
        </div>

        <form class="settings-form" @submit.prevent="saveAccount">
          <div class="form-group">
            <label class="form-label">显示名称</label>
            <input v-model="accountForm.nickname" class="form-input" placeholder="你的显示名称" />
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input v-model="accountForm.email" type="email" class="form-input" placeholder="your@email.com" />
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input v-model="accountForm.phone" type="tel" class="form-input" placeholder="13800138000" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="accountSaving">
              {{ accountSaving ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </form>

        <div class="danger-zone">
          <h3>危险操作</h3>
          <div class="danger-item">
            <div>
              <strong>修改密码</strong>
              <p>定期修改密码有助于保护账号安全</p>
            </div>
            <button class="btn-ghost" @click="showPwdChange = !showPwdChange">
              {{ showPwdChange ? '取消' : '修改密码' }}
            </button>
          </div>
          <Transition name="slide-down">
            <div v-if="showPwdChange" class="pwd-change-form">
              <div class="form-group">
                <label class="form-label">旧密码</label>
                <input v-model="pwdForm.oldPwd" type="password" class="form-input" placeholder="当前密码" />
              </div>
              <div class="form-group">
                <label class="form-label">新密码</label>
                <input v-model="pwdForm.newPwd" type="password" class="form-input" placeholder="至少 8 位" />
              </div>
              <div class="form-group">
                <label class="form-label">确认新密码</label>
                <input v-model="pwdForm.confirmPwd" type="password" class="form-input" placeholder="再次输入新密码" />
              </div>
              <button class="btn-primary" :disabled="pwdSaving" @click="changePassword">
                {{ pwdSaving ? '修改中...' : '确认修改' }}
              </button>
            </div>
          </Transition>
          <div class="danger-item">
            <div>
              <strong>删除账号</strong>
              <p>删除后所有数据将无法恢复</p>
            </div>
            <button class="btn-danger" @click="showToast('请联系客服删除账号')">删除账号</button>
          </div>
        </div>
      </section>

      <!-- ═══ Tab 2: 订阅与计费 ═══ -->
      <section v-if="activeTab === 'billing'" class="settings-section">
        <div class="current-plan-card">
          <div class="plan-badge">当前套餐</div>
          <h2 class="plan-name">{{ currentPlan.name }}</h2>
          <p class="plan-price">{{ currentPlan.price }}</p>
          <p class="plan-quota">🎬 {{ currentPlan.episodes }}</p>
          <div v-if="quotaInfo.monthlyTokens || quotaInfo.monthlyImages || quotaInfo.monthlyVideos" class="quota-bars">
            <div class="quota-bar" v-if="quotaInfo.monthlyTokens">
              <span class="quota-label">文本 Token</span>
              <div class="quota-track"><div class="quota-fill" :style="{ width: Math.min(100, (quotaInfo.usedTokens / quotaInfo.monthlyTokens) * 100) + '%' }" /></div>
              <span class="quota-value">{{ quotaInfo.usedTokens.toLocaleString() }} / {{ quotaInfo.monthlyTokens.toLocaleString() }}</span>
            </div>
            <div class="quota-bar" v-if="quotaInfo.monthlyImages">
              <span class="quota-label">图片生成</span>
              <div class="quota-track"><div class="quota-fill" :style="{ width: Math.min(100, (quotaInfo.usedImages / quotaInfo.monthlyImages) * 100) + '%' }" /></div>
              <span class="quota-value">{{ quotaInfo.usedImages }} / {{ quotaInfo.monthlyImages }}</span>
            </div>
            <div class="quota-bar" v-if="quotaInfo.monthlyVideos">
              <span class="quota-label">视频生成</span>
              <div class="quota-track"><div class="quota-fill" :style="{ width: Math.min(100, (quotaInfo.usedVideos / quotaInfo.monthlyVideos) * 100) + '%' }" /></div>
              <span class="quota-value">{{ quotaInfo.usedVideos }} / {{ quotaInfo.monthlyVideos }}</span>
            </div>
          </div>
        </div>

        <h3 class="section-heading">升级套餐</h3>
        <div class="plans-grid">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="plan-card"
            :class="{ 'plan-card--current': plan.name === currentPlan.name, 'plan-card--recommended': plan.name === '专业版' }"
          >
            <div v-if="plan.name === '专业版'" class="plan-recommended-badge">推荐</div>
            <h4 class="plan-card-name">{{ plan.name }}</h4>
            <div class="plan-card-price">{{ plan.price }}</div>
            <div class="plan-card-quota">{{ plan.episodes }}</div>
            <ul class="plan-card-features">
              <li v-for="f in plan.features" :key="f">✓ {{ f }}</li>
            </ul>
            <button
              class="btn-primary"
              :disabled="plan.name === currentPlan.name"
              @click="upgradePlan(plan)"
            >
              {{ plan.name === currentPlan.name ? '当前套餐' : plan.name === '企业版' ? '联系客服' : '升级' }}
            </button>
          </div>
        </div>

        <h3 class="section-heading">账单记录</h3>
        <div class="billing-table">
          <div class="billing-table-header">
            <span>日期</span><span>类型</span><span>金额</span><span>状态</span>
          </div>
          <div v-for="bill in billingHistory" :key="bill.date" class="billing-table-row">
            <span>{{ bill.date }}</span>
            <span>{{ bill.type }}</span>
            <span>{{ bill.amount }}</span>
            <span class="billing-status">{{ bill.status }}</span>
          </div>
        </div>
      </section>

      <!-- ═══ Tab 3: API 密钥 ═══ -->
      <section v-if="activeTab === 'apikeys'" class="settings-section">
        <div class="section-bar">
          <div>
            <h3 class="section-heading" style="margin:0">你的 API 密钥</h3>
            <p class="section-desc">使用自己的 API Key 可节省 40-75% 费用</p>
          </div>
          <button class="btn-primary" @click="showAddKey = !showAddKey">
            {{ showAddKey ? '取消' : '+ 添加密钥' }}
          </button>
        </div>

        <!-- Add key form -->
        <Transition name="slide-down">
          <div v-if="showAddKey" class="add-key-form">
            <div class="form-group">
              <label class="form-label">服务商</label>
              <select v-model="newKeyForm.provider" class="form-input">
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }} — {{ p.desc }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">别名</label>
              <input v-model="newKeyForm.alias" class="form-input" placeholder="例如：主力视频生成" />
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <input v-model="newKeyForm.apiKey" class="form-input" type="password" placeholder="sk-..." />
            </div>
            <button class="btn-primary" @click="addApiKey">保存密钥</button>
          </div>
        </Transition>

        <!-- Key list -->
        <div class="key-list">
          <div v-for="key in apiKeys" :key="key.id" class="key-card">
            <div class="key-info">
              <span class="key-provider">{{ getProviderName(key.provider) }}</span>
              <span class="key-alias">{{ key.alias }}</span>
              <code class="key-preview">{{ key.keyPreview }}</code>
            </div>
            <div class="key-meta">
              <span>创建: {{ key.createdAt }}</span>
              <span v-if="key.lastUsed">最近使用: {{ key.lastUsed }}</span>
            </div>
            <button class="btn-ghost btn-sm" @click="removeApiKey(key.id)">删除</button>
          </div>
          <div v-if="apiKeys.length === 0" class="empty-state">
            <p>还没有 API Key</p>
            <p class="empty-hint">添加你自己的 API Key 可以大幅降低使用成本</p>
          </div>
        </div>
      </section>

      <!-- ═══ Tab 4: 通知设置 ═══ -->
      <section v-if="activeTab === 'notifications'" class="settings-section">
        <h3 class="section-heading">邮件通知</h3>
        <div class="toggle-list">
          <label class="toggle-row">
            <div><strong>生成完成通知</strong><p>动画/视频生成完成时发送邮件</p></div>
            <input type="checkbox" v-model="notifSettings.emailGeneration" class="toggle-switch" />
          </label>
          <label class="toggle-row">
            <div><strong>计费通知</strong><p>扣费、充值、套餐到期提醒</p></div>
            <input type="checkbox" v-model="notifSettings.emailBilling" class="toggle-switch" />
          </label>
          <label class="toggle-row">
            <div><strong>营销邮件</strong><p>新功能、优惠活动推送</p></div>
            <input type="checkbox" v-model="notifSettings.emailMarketing" class="toggle-switch" />
          </label>
        </div>

        <h3 class="section-heading">站内通知</h3>
        <div class="toggle-list">
          <label class="toggle-row">
            <div><strong>生成状态</strong><p>生成进度和完成状态推送</p></div>
            <input type="checkbox" v-model="notifSettings.webGeneration" class="toggle-switch" />
          </label>
          <label class="toggle-row">
            <div><strong>协作通知</strong><p>团队成员操作、评论、邀请</p></div>
            <input type="checkbox" v-model="notifSettings.webCollab" class="toggle-switch" />
          </label>
          <label class="toggle-row">
            <div><strong>系统通知</strong><p>维护公告、安全警告</p></div>
            <input type="checkbox" v-model="notifSettings.webSystem" class="toggle-switch" />
          </label>
        </div>

        <div class="form-actions">
          <button class="btn-primary" @click="saveNotifications">保存设置</button>
        </div>
      </section>

      <!-- ═══ Tab 5: 主题外观 ═══ -->
      <section v-if="activeTab === 'theme'" class="settings-section">
        <p class="section-desc">当前主题：<strong>{{ currentTheme }}</strong>（深色主题，适合长时间创作）</p>
        <div class="theme-grid">
          <div
            v-for="t in themeOptions"
            :key="t.name"
            class="theme-card"
            :class="{ 'theme-card--active': t.active, 'theme-card--locked': t.locked && !t.active }"
          >
            <div class="theme-preview" :class="'theme-preview--' + t.name" />
            <div class="theme-info">
              <h4>{{ t.name }}</h4>
              <p>{{ t.desc }}</p>
            </div>
            <span v-if="t.active" class="theme-badge">当前</span>
            <span v-else-if="t.locked" class="theme-lock">🔒</span>
          </div>
        </div>
        <div class="theme-note">
          <p>💡 主题切换功能将在后续版本开放。当前锁定为「暗夜工坊」深色主题，确保所有创作模块的视觉一致性。</p>
        </div>
      </section>

      <!-- ═══ Tab 6: 团队成员 ═══ -->
      <section v-if="activeTab === 'team'" class="settings-section">
        <div class="section-bar">
          <div>
            <h3 class="section-heading" style="margin:0">团队成员</h3>
            <p class="section-desc">邀请协作者，共同创作项目</p>
          </div>
          <button class="btn-primary" @click="showInvite = !showInvite">
            {{ showInvite ? '取消' : '+ 邀请成员' }}
          </button>
        </div>

        <Transition name="slide-down">
          <div v-if="showInvite" class="invite-form">
            <div class="form-group">
              <label class="form-label">邮箱</label>
              <input v-model="inviteEmail" type="email" class="form-input" placeholder="collaborator@email.com" />
            </div>
            <div class="form-group">
              <label class="form-label">角色</label>
              <select v-model="inviteRole" class="form-input">
                <option value="editor">编辑者 — 可以编辑项目内容</option>
                <option value="viewer">查看者 — 只能查看项目</option>
                <option value="commenter">评论者 — 可以查看和评论</option>
              </select>
            </div>
            <button class="btn-primary" @click="inviteMember">发送邀请</button>
          </div>
        </Transition>

        <div class="member-list">
          <div v-for="m in teamMembers" :key="m.id" class="member-card">
            <div class="member-avatar">{{ m.name[0] }}</div>
            <div class="member-info">
              <strong>{{ m.name }}</strong>
              <span class="member-email">{{ m.email }}</span>
              <span class="member-role">{{ roleLabels[m.role] || m.role }}</span>
            </div>
            <span class="member-joined">加入: {{ m.joinedAt }}</span>
            <button
              v-if="m.role !== 'owner'"
              class="btn-ghost btn-sm"
              @click="removeMember(m.id)"
            >移除</button>
          </div>
          <div v-if="teamMembers.length === 0" class="empty-state">
            <p>还没有团队成员</p>
            <p class="empty-hint">邀请协作者一起创作，免费版支持 1 人，专业版支持 5 人</p>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  min-height: 100vh;
}

/* Toast */
.settings-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 10px;
  background: rgba(0, 212, 170, 0.92);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  z-index: 9999;
  pointer-events: none;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: all 300ms ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* Header */
.settings-header { margin-bottom: 24px; }
.settings-title { font-size: 28px; font-weight: 800; margin: 0 0 6px; color: #FAFAFA; }
.settings-sub { font-size: 14px; color: #A1A1AA; margin: 0; }

/* Tabs */
.settings-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 12px;
  margin-bottom: 28px;
  overflow-x: auto;
}
.settings-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
  white-space: nowrap;
  font-family: inherit;
}
.settings-tab:hover { background: #18181B; color: #FAFAFA; }
.settings-tab--active { background: #00D4AA; color: #09090B; font-weight: 600; }
.settings-tab-icon { font-size: 15px; }

/* Content */
.settings-section { animation: fadeIn 200ms ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.section-heading { font-size: 18px; font-weight: 700; color: #FAFAFA; margin: 28px 0 12px; }
.section-desc { font-size: 13px; color: #A1A1AA; margin: 0 0 16px; }
.section-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }

/* User profile card */
.user-profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 14px;
  margin-bottom: 28px;
}
.avatar-large {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  font-weight: 800;
  flex-shrink: 0;
}
.profile-info h2 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #FAFAFA; }
.profile-email { font-size: 13px; color: #A1A1AA; margin: 2px 0; }
.profile-id { font-size: 12px; color: #52525B; margin: 4px 0 0; }
.profile-id code { background: #18181B; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; }

/* Forms */
.settings-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 12px; font-weight: 600; color: #A1A1AA; letter-spacing: 0.02em; }
.form-input {
  padding: 11px 14px;
  background: #111113;
  border: 1px solid #2E2E33;
  border-radius: 8px;
  color: #FAFAFA;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 200ms;
}
.form-input:focus { outline: none; border-color: #00D4AA; box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.12); }
.form-input::placeholder { color: #52525B; }
select.form-input { cursor: pointer; }
.form-actions { display: flex; gap: 12px; margin-top: 8px; }

/* Buttons */
.btn-primary {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #00D4AA;
  color: #09090B;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}
.btn-primary:hover { background: #00E8BB; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-ghost {
  padding: 8px 16px;
  border: 1px solid #2E2E33;
  border-radius: 8px;
  background: transparent;
  color: #A1A1AA;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms;
}
.btn-ghost:hover { border-color: #00D4AA; color: #00D4AA; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-danger {
  padding: 8px 16px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  background: transparent;
  color: #F87171;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 150ms;
}
.btn-danger:hover { background: rgba(239, 68, 68, 0.1); border-color: #EF4444; }

/* Danger zone */
.danger-zone {
  margin-top: 40px;
  padding: 20px 24px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.04);
}
.danger-zone h3 { font-size: 16px; font-weight: 700; color: #F87171; margin: 0 0 16px; }
.danger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid rgba(239, 68, 68, 0.1);
}
.danger-item strong { font-size: 14px; color: #FAFAFA; }
.danger-item p { font-size: 12px; color: #A1A1AA; margin: 2px 0 0; }
.pwd-change-form {
  padding: 20px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 12px;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Current plan */
.current-plan-card {
  padding: 24px;
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.08), rgba(139, 92, 246, 0.08));
  border: 1px solid rgba(0, 212, 170, 0.2);
  border-radius: 14px;
  margin-bottom: 24px;
}
.plan-badge { font-size: 11px; font-weight: 600; color: #00D4AA; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
.plan-name { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #FAFAFA; }
.plan-price { font-size: 18px; color: #A1A1AA; margin: 0 0 4px; }
.plan-quota { font-size: 14px; color: #00D4AA; margin: 0; }
.quota-bars { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.quota-bar { display: flex; align-items: center; gap: 10px; }
.quota-label { font-size: 12px; color: #A1A1AA; width: 72px; flex-shrink: 0; }
.quota-track { flex: 1; height: 6px; background: #2E2E33; border-radius: 3px; overflow: hidden; }
.quota-fill { height: 100%; background: linear-gradient(90deg, #00D4AA, #8B5CF6); border-radius: 3px; transition: width 400ms ease; }
.quota-value { font-size: 11px; color: #A1A1AA; width: 120px; text-align: right; flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }

/* Plans grid */
.plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 32px; }
.plan-card {
  position: relative;
  padding: 20px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-card--current { border-color: #00D4AA; }
.plan-card--recommended { border-color: #8B5CF6; }
.plan-recommended-badge {
  position: absolute;
  top: -1px;
  right: 16px;
  padding: 2px 10px;
  background: #8B5CF6;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 0 0 6px 6px;
}
.plan-card-name { font-size: 16px; font-weight: 700; margin: 0; color: #FAFAFA; }
.plan-card-price { font-size: 22px; font-weight: 800; color: #FAFAFA; }
.plan-card-quota { font-size: 13px; color: #00D4AA; }
.plan-card-features { list-style: none; padding: 0; margin: 8px 0; flex: 1; }
.plan-card-features li { font-size: 12px; color: #A1A1AA; padding: 3px 0; }

/* Billing table */
.billing-table { background: #111113; border: 1px solid #1E1E22; border-radius: 12px; overflow: hidden; }
.billing-table-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  padding: 12px 16px;
  background: #18181B;
  font-size: 12px;
  font-weight: 600;
  color: #A1A1AA;
}
.billing-table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  padding: 12px 16px;
  font-size: 13px;
  color: #FAFAFA;
  border-top: 1px solid #1E1E22;
}
.billing-status { color: #00D4AA; }

/* API Keys */
.add-key-form {
  padding: 20px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.key-list { display: flex; flex-direction: column; gap: 10px; }
.key-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 10px;
}
.key-info { flex: 1; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.key-provider { font-size: 12px; font-weight: 600; color: #00D4AA; background: rgba(0, 212, 170, 0.1); padding: 2px 8px; border-radius: 4px; }
.key-alias { font-size: 14px; font-weight: 600; color: #FAFAFA; }
.key-preview { font-size: 12px; color: #52525B; font-family: 'JetBrains Mono', monospace; background: #18181B; padding: 2px 6px; border-radius: 4px; }
.key-meta { display: flex; gap: 12px; font-size: 11px; color: #52525B; }

/* Toggle */
.toggle-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 150ms;
}
.toggle-row:hover { border-color: #2E2E33; }
.toggle-row strong { font-size: 14px; color: #FAFAFA; }
.toggle-row p { font-size: 12px; color: #A1A1AA; margin: 2px 0 0; }
.toggle-switch {
  width: 44px;
  height: 24px;
  appearance: none;
  background: #2E2E33;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 200ms;
  flex-shrink: 0;
}
.toggle-switch::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #FAFAFA;
  top: 3px;
  left: 3px;
  transition: transform 200ms;
}
.toggle-switch:checked { background: #00D4AA; }
.toggle-switch:checked::after { transform: translateX(20px); }

/* Theme */
.theme-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.theme-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 10px;
}
.theme-card--active { border-color: #00D4AA; background: rgba(0, 212, 170, 0.04); }
.theme-card--locked { opacity: 0.6; }
.theme-preview { width: 48px; height: 32px; border-radius: 6px; flex-shrink: 0; }
.theme-preview--暗夜工坊 { background: linear-gradient(135deg, #09090B, #18181B); border: 1px solid #2E2E33; }
.theme-preview--极简白 { background: linear-gradient(135deg, #FAFAFA, #E4E4E7); }
.theme-preview--创作橙 { background: linear-gradient(135deg, #F97316, #FBBF24); }
.theme-preview--国风墨 { background: linear-gradient(135deg, #1A1A2E, #374151); }
.theme-preview--赛博霓虹 { background: linear-gradient(135deg, #7C3AED, #06B6D4); }
.theme-info { flex: 1; }
.theme-info h4 { font-size: 14px; font-weight: 700; margin: 0 0 2px; color: #FAFAFA; }
.theme-info p { font-size: 12px; color: #A1A1AA; margin: 0; }
.theme-badge { font-size: 11px; font-weight: 600; color: #00D4AA; background: rgba(0, 212, 170, 0.1); padding: 3px 10px; border-radius: 4px; }
.theme-lock { font-size: 14px; opacity: 0.5; }
.theme-note {
  padding: 16px 20px;
  background: rgba(0, 212, 170, 0.04);
  border: 1px dashed #2E2E33;
  border-radius: 10px;
  font-size: 13px;
  color: #A1A1AA;
}
.theme-note p { margin: 0; line-height: 1.6; }

/* Team */
.invite-form {
  padding: 20px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.member-list { display: flex; flex-direction: column; gap: 10px; }
.member-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: #111113;
  border: 1px solid #1E1E22;
  border-radius: 10px;
}
.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00D4AA, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}
.member-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.member-info strong { font-size: 14px; color: #FAFAFA; }
.member-email { font-size: 12px; color: #A1A1AA; }
.member-role { font-size: 11px; color: #00D4AA; font-weight: 600; }
.member-joined { font-size: 11px; color: #52525B; }

/* Empty state */
.empty-state { text-align: center; padding: 32px; color: #A1A1AA; }
.empty-state p { margin: 4px 0; }
.empty-hint { font-size: 12px; color: #52525B; }

/* Transitions */
.slide-down-enter-active, .slide-down-leave-active { transition: all 200ms ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }

/* Responsive */
@media (max-width: 768px) {
  .settings-page { padding: 20px 16px 48px; }
  .plans-grid { grid-template-columns: 1fr 1fr; }
  .billing-table-header, .billing-table-row { grid-template-columns: 1fr 1fr; gap: 4px; }
  .key-card { flex-wrap: wrap; }
  .key-meta { width: 100%; }
}
</style>
