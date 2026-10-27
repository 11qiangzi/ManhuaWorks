<script setup lang="ts">
/**
 * SettingsView · 设置
 * 千机工坊 · W4 用户后台
 *
 * 功能：
 *1.4标签页：账号 /订阅 /BYOK /通知
 *2.主题切换（复用 ThemeSwitcher）
 *3.通知开关矩阵
 *4. BYOK 多 provider密钥管理（显示掩码 +增删）
 *5.订阅档位展示（free/pro/studio/team）
 */

import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import PlanBadge from '@/components/PlanBadge.vue'
import UserCard from '@/components/UserCard.vue'
import { useUser } from '@/composables/useUser'
import { useTheme } from '@/composables/useTheme'
import type { PlanId } from '@/components/PlanBadge.vue'

const router = useRouter()
const { profile, load: loadUser, logout, updateProfile } = useUser()
const { themeId, themes } = useTheme()

const activeTab = ref<'account' | 'subscription' | 'byok' | 'notification'>('account')

onMounted(async () => {
 await loadUser()
})

function onLogout() {
 logout()
 router.push('/login')
}

/* =====账号表单 ===== */
const editName = ref('')
const editBio = ref('')
const editAvatar = ref('🎨')
const savingAccount = ref(false)
const accountSaved = ref(false)

function loadAccountForm() {
 editName.value = profile.value?.name ?? ''
 editBio.value = profile.value?.bio ?? ''
 editAvatar.value = profile.value?.avatar ?? '🎨'
}

watch(profile, loadAccountForm, { immediate: true })

async function saveAccount() {
 savingAccount.value = true
 accountSaved.value = false
 try {
 await updateProfile({
 name: editName.value.trim() || undefined,
 bio: editBio.value.trim() || undefined,
 avatar: editAvatar.value || undefined
 })
 accountSaved.value = true
 setTimeout(() => (accountSaved.value = false),2200)
 } finally {
 savingAccount.value = false
 }
}

const AVATAR_OPTIONS = ['🎨', '🦊', '🐱', '🐉', '🌙', '⚡', '🌸', '🔥', '🌊', '🚀']

/* =====订阅 ===== */
const PLANS: { id: PlanId; name: string; price: string; period: string; features: string[]; highlight?: boolean }[] = [
 {
 id: 'free',
 name: 'Free',
 price: '¥0',
 period: '/永久',
 features: ['3 个项目', '10 次/天 AI 生成', '社区素材库访问', '基础主题']
 },
 {
 id: 'pro',
 name: 'Pro',
 price: '¥39',
 period: '/月',
 features: ['无限项目', '500 次/天 AI 生成', '4K视频导出', '全部主题', '优先队列'],
 highlight: true
 },
 {
 id: 'studio',
 name: 'Studio',
 price: '¥99',
 period: '/月',
 features: ['Pro全部功能', 'BYOK 多 provider', '商用授权', '团队协作5 人', 'API访问']
 },
 {
 id: 'team',
 name: 'Team',
 price: '¥299',
 period: '/月',
 features: ['Studio全部功能', '无限成员', 'SSO +审计日志', '专属客户经理', 'SLA99.9%']
 }
]

const currentPlan = computed<PlanId>(() => (profile.value?.plan as PlanId) ?? 'free')

/* ===== BYOK ===== */
interface ByokKey {
 id: string
 provider: string
 label: string
 masked: string
 last4: string
 createdAt: string
 status: 'active' | 'invalid'
}

const PROVIDERS = [
 { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
 { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
 { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza...' },
 { id: 'stability', name: 'Stability AI', placeholder: 'sk-...' },
 { id: 'runway', name: 'Runway', placeholder: 'rw-...' },
 { id: 'elevenlabs', name: 'ElevenLabs', placeholder: 'el-...' }
]

const byokKeys = ref<ByokKey[]>([
 { id: 'k1', provider: 'openai', label: 'OpenAI 主用', masked: 'sk-************ABcd', last4: 'ABcd', createdAt: '2026-05-10', status: 'active' },
 { id: 'k2', provider: 'anthropic', label: 'Anthropic备用', masked: 'sk-ant-*********EFgh', last4: 'EFgh', createdAt: '2026-05-22', status: 'active' }
])

const newProvider = ref('openai')
const newKey = ref('')
const newLabel = ref('')
const addingKey = ref(false)
const keyError = ref('')

async function addByok() {
 if (!newKey.value.trim()) {
 keyError.value = '请输入 API Key'
 return
 }
 addingKey.value = true
 keyError.value = ''
 try {
 const last4 = newKey.value.trim().slice(-4)
 const masked = newKey.value.trim().slice(0,6) + '************' + last4
 byokKeys.value.push({
 id: 'k' + Date.now(),
 provider: newProvider.value,
 label: newLabel.value.trim() || `${newProvider.value} Key`,
 masked,
 last4,
 createdAt: new Date().toISOString().slice(0,10),
 status: 'active'
 })
 newKey.value = ''
 newLabel.value = ''
 } finally {
 addingKey.value = false
 }
}

function deleteByok(id: string) {
 if (!window.confirm('确认删除该 API Key？')) return
 byokKeys.value = byokKeys.value.filter((k) => k.id !== id)
}

const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id
const providerPlaceholder = computed(() => PROVIDERS.find((p) => p.id === newProvider.value)?.placeholder ?? '')

/* =====通知 ===== */
interface NotifPref {
 key: string
 label: string
 desc: string
 email: boolean
 inapp: boolean
}

const notifs = ref<NotifPref[]>([
 { key: 'render_done', label: '🎬渲染完成', desc: '视频 /图片生成完毕时通知', email: true, inapp: true },
 { key: 'render_fail', label: '⚠️渲染失败', desc: '任务出错或失败时通知', email: true, inapp: true },
 { key: 'collab_invite', label: '👥协作邀请', desc: '有人邀请你加入项目', email: true, inapp: true },
 { key: 'comment', label: '💬 评论 /批注', desc: '作品收到新评论', email: false, inapp: true },
 { key: 'weekly', label: '📊 周报', desc: '每周创作数据汇总', email: true, inapp: false },
 { key: 'product', label: '🚀 产品更新', desc: '新功能 /主题上线', email: false, inapp: false }
])

const notifSaved = ref(false)

function saveNotifs() {
 notifSaved.value = true
 setTimeout(() => (notifSaved.value = false),2200)
}

/* =====危险区 ===== */
const showDanger = ref(false)
function deleteAccount() {
 if (!window.confirm('⚠ 此操作不可恢复！确认注销账号？')) return
 if (!window.confirm('再次确认：所有项目、作品、素材将被永久删除。继续？')) return
 alert('账号注销请求已提交（演示）')
 logout()
 router.push('/login')
}
</script>

<template>
 <main class="st">
 <!--顶栏 -->
 <header class="st__nav">
 <div class="st__nav-left">
 <button class="st__back" @click="router.push('/dashboard')" title="返回首页">←</button>
 <span class="st__logo">M</span>
 <span class="st__brand-name">设置</span>
 </div>
 <nav class="st__nav-links">
 <RouterLink to="/dashboard" class="st__nav-link">首页</RouterLink>
 <RouterLink to="/projects" class="st__nav-link">项目</RouterLink>
 <RouterLink to="/works" class="st__nav-link">作品</RouterLink>
 <RouterLink to="/assets" class="st__nav-link">素材</RouterLink>
 <RouterLink to="/settings" class="st__nav-link st__nav-link--active">设置</RouterLink>
 </nav>
 <div class="st__nav-right">
 <ThemeSwitcher mode="compact" />
 <UserCard :user="profile" compact />
 </div>
 </header>

 <div class="st__content">
 <!-- =====头部 ===== -->
 <section class="st__header">
 <h1>⚙ 设置</h1>
 <p>管理账号、订阅、API密钥 与通知偏好</p>
 </section>

 <div class="st__layout">
 <!-- =====侧栏 tabs ===== -->
 <aside class="st__sidebar">
 <button
 v-for="t in [
 { id: 'account', label: '账号', icon: '👤' },
 { id: 'subscription', label: '订阅', icon: '💎' },
 { id: 'byok', label: 'BYOK', icon: '🔑' },
 { id: 'notification', label: '通知', icon: '🔔' }
]"
 :key="t.id"
 type="button"
 class="st__side-item"
 :class="{ 'st__side-item--active': activeTab === t.id }"
 @click="activeTab = t.id as typeof activeTab.value"
 >
 <span class="st__side-icon">{{ t.icon }}</span>
 <span>{{ t.label }}</span>
 </button>

 <div class="st__sidebar-divider"></div>

 <button type="button" class="st__side-item st__side-item--danger" @click="onLogout">
 <span class="st__side-icon">↩</span>
 <span>退出登录</span>
 </button>
 </aside>

 <!-- =====主体 ===== -->
 <section class="st__main">
 <!-- ===========================账号 =========================== -->
 <div v-if="activeTab === 'account'" class="st__panel">
 <h2 class="st__panel-title">👤账号信息</h2>
 <p class="st__panel-desc">个人资料、头像、简介</p>

 <div class="st__form">
 <!--头像选择 -->
 <div class="st__field">
 <label class="st__label">头像</label>
 <div class="st__avatar-grid">
 <button
 v-for="emoji in AVATAR_OPTIONS"
 :key="emoji"
 type="button"
 class="st__avatar-btn"
 :class="{ 'st__avatar-btn--active': editAvatar === emoji }"
 @click="editAvatar = emoji"
 >{{ emoji }}</button>
 </div>
 </div>

 <div class="st__field">
 <label class="st__label" for="st-name">显示名称</label>
 <input
 id="st-name"
 v-model="editName"
 type="text"
 class="st__input"
 placeholder="你的昵称"
 maxlength="32"
 />
 </div>

 <div class="st__field">
 <label class="st__label" for="st-bio">个人简介</label>
 <textarea
 id="st-bio"
 v-model="editBio"
 class="st__input st__textarea"
 rows="3"
 placeholder="一句话介绍你自己…"
 maxlength="200"
 ></textarea>
 <div class="st__hint">{{ editBio.length }} /200</div>
 </div>

 <div class="st__field">
 <label class="st__label">邮箱</label>
 <div class="st__readonly">{{ profile?.email ?? '—' }}</div>
 <div class="st__hint">邮箱不可修改，如需更换请联系客服</div>
 </div>

 <div class="st__field">
 <label class="st__label">用户 ID</label>
 <div class="st__readonly st__readonly--mono">{{ profile?.id ?? '—' }}</div>
 </div>

 <div class="st__actions">
 <button type="button" class="st__btn st__btn--primary" :disabled="savingAccount" @click="saveAccount">
 {{ savingAccount ? '保存中…' : '💾 保存' }}
 </button>
 <span v-if="accountSaved" class="st__save-toast">✓ 已保存</span>
 </div>

 <div class="st__danger-zone">
 <button type="button" class="st__btn st__btn--ghost-danger" @click="showDanger = !showDanger">
 {{ showDanger ? '取消注销' : '注销账号' }}
 </button>
 <div v-if="showDanger" class="st__danger-panel">
 <p>⚠注销后所有项目、作品、素材将<strong>永久删除</strong>，不可恢复。</p>
 <button type="button" class="st__btn st__btn--danger" @click="deleteAccount">我已了解，确认注销</button>
 </div>
 </div>
 </div>
 </div>

 <!-- ===========================订阅 =========================== -->
 <div v-else-if="activeTab === 'subscription'" class="st__panel">
 <h2 class="st__panel-title">💎订阅</h2>
 <p class="st__panel-desc">当前档位与可用方案</p>

 <div class="st__current-plan">
 <div class="st__current-info">
 <div class="st__current-label">当前订阅</div>
 <div class="st__current-name">
 <PlanBadge :plan="currentPlan" size="lg" />
 <span>{{ PLANS.find((p) => p.id === currentPlan)?.name }}</span>
 </div>
 <div class="st__current-meta">
 到期时间：{{ profile?.subscription?.expiresAt ?? '—' }} · 月用量 {{ profile?.usage?.monthlyQuotaUsed ??0 }}/{{ profile?.usage?.monthlyQuota ??0 }}
 </div>
 </div>
 </div>

 <div class="st__plans">
 <article
 v-for="p in PLANS"
 :key="p.id"
 class="st__plan"
 :class="{ 'st__plan--highlight': p.highlight, 'st__plan--current': currentPlan === p.id }"
 >
 <div v-if="p.highlight" class="st__plan-ribbon">推荐</div>
 <div class="st__plan-name">{{ p.name }}</div>
 <div class="st__plan-price">
 <span class="st__plan-amount">{{ p.price }}</span>
 <span class="st__plan-period">{{ p.period }}</span>
 </div>
 <ul class="st__plan-features">
 <li v-for="f in p.features" :key="f">✓ {{ f }}</li>
 </ul>
 <button
 type="button"
 class="st__btn"
 :class="currentPlan === p.id ? 'st__btn--ghost' : 'st__btn--primary'"
 :disabled="currentPlan === p.id"
 >
 {{ currentPlan === p.id ? '当前档位' : (PLANS.indexOf(p) > PLANS.findIndex((x) => x.id === currentPlan) ? '升级' : '切换') }}
 </button>
 </article>
 </div>
 </div>

 <!-- =========================== BYOK =========================== -->
 <div v-else-if="activeTab === 'byok'" class="st__panel">
 <h2 class="st__panel-title">🔑 BYOK · 自带密钥</h2>
 <p class="st__panel-desc">使用你自己的 API Key 调用第三方 AI 服务，平台不存储明文</p>
 <p style="margin-top:8px;font-size:12px;">
 <RouterLink to="/settings/api-keys" style="color:var(--accent);font-weight:600;">🆕 试试新版 (派单 17 · 6 provider 卡片 + 测试)</RouterLink>
 </p>

 <div class="st__byok-form">
 <div class="st__byok-row">
 <div class="st__field">
 <label class="st__label">Provider</label>
 <select v-model="newProvider" class="st__input">
 <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option>
 </select>
 </div>
 <div class="st__field st__field--flex">
 <label class="st__label">标签（可选）</label>
 <input
 v-model="newLabel"
 type="text"
 class="st__input"
 placeholder="如：主用 /备用"
 maxlength="20"
 />
 </div>
 </div>
 <div class="st__field">
 <label class="st__label">API Key</label>
 <input
 v-model="newKey"
 type="password"
 class="st__input"
 :placeholder="providerPlaceholder"
 @keyup.enter="addByok"
 />
 <div v-if="keyError" class="st__error">{{ keyError }}</div>
 <div class="st__hint">仅显示最后4 位 · 以密文保存</div>
 </div>
 <button type="button" class="st__btn st__btn--primary" :disabled="addingKey" @click="addByok">
 {{ addingKey ? '添加中…' : '＋ 添加密钥' }}
 </button>
 </div>

 <div v-if="byokKeys.length ===0" class="st__empty">
 <div class="st__empty-icon">🔑</div>
 <div>还没有添加任何 BYOK密钥</div>
 </div>

 <div v-else class="st__key-list">
 <div v-for="k in byokKeys" :key="k.id" class="st__key-row">
 <div class="st__key-info">
 <div class="st__key-label">
 <span class="st__key-provider">{{ providerName(k.provider) }}</span>
 <span class="st__key-name">{{ k.label }}</span>
 <span class="st__key-status" :class="`st__key-status--${k.status}`">{{ k.status === 'active' ? '✓有效' : '✗失效' }}</span>
 </div>
 <div class="st__key-meta">
 <code class="st__key-masked">{{ k.masked }}</code>
 <span class="st__key-date">添加于 {{ k.createdAt }}</span>
 </div>
 </div>
 <div class="st__key-actions">
 <button type="button" class="st__btn st__btn--ghost st__btn--sm">测试</button>
 <button type="button" class="st__btn st__btn--ghost-danger st__btn--sm" @click="deleteByok(k.id)">删除</button>
 </div>
 </div>
 </div>
 </div>

 <!-- ===========================通知 =========================== -->
 <div v-else class="st__panel">
 <h2 class="st__panel-title">🔔通知偏好</h2>
 <p class="st__panel-desc">选择你希望接收的通知类型与渠道</p>

 <div class="st__notif-table">
 <div class="st__notif-head">
 <div>事件</div>
 <div class="st__notif-col">邮件</div>
 <div class="st__notif-col">站内</div>
 </div>
 <div v-for="n in notifs" :key="n.key" class="st__notif-row">
 <div class="st__notif-info">
 <div class="st__notif-label">{{ n.label }}</div>
 <div class="st__notif-desc">{{ n.desc }}</div>
 </div>
 <label class="st__switch">
 <input v-model="n.email" type="checkbox" />
 <span></span>
 </label>
 <label class="st__switch">
 <input v-model="n.inapp" type="checkbox" />
 <span></span>
 </label>
 </div>
 </div>

 <div class="st__actions">
 <button type="button" class="st__btn st__btn--primary" @click="saveNotifs">💾 保存通知设置</button>
 <span v-if="notifSaved" class="st__save-toast">✓ 已保存</span>
 </div>

 <!-- =====主题 ===== -->
 <div class="st__subpanel">
 <h3>🎨主题</h3>
 <p class="st__panel-desc">切换全局视觉风格</p>
 <div class="st__themes">
 <button
 v-for="t in themes"
 :key="t.id"
 type="button"
 class="st__theme-card"
 :class="{ 'st__theme-card--active': themeId === t.id }"
 @click="themeId = t.id"
 >
 <div class="st__theme-preview" :style="{ background: t.preview }"></div>
 <div class="st__theme-name">{{ t.name }}</div>
 </button>
 </div>
 </div>
 </div>
 </section>
 </div>
 </div>
 </main>
</template>

<style scoped>
/* ============================================================
 SettingsView · 完全复用主题 CSS变量
 ============================================================ */
.st {
 min-height:100vh;
 background: var(--mw-bg);
 color: var(--mw-text);
 font-family: var(--mw-font, system-ui, -apple-system, "Segoe UI", sans-serif);
 transition: background0.3s, color0.3s;
}

/* =====顶栏 ===== */
.st__nav {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap:1rem;
 padding:0.75rem1.5rem;
 background: var(--mw-surface);
 border-bottom:1px solid var(--mw-border);
 position: sticky;
 top:0;
 z-index:50;
}
.st__nav-left { display: flex; align-items: center; gap:0.75rem; }
.st__back {
 width:32px; height:32px;
 border-radius:8px;
 background: transparent;
 border:1px solid var(--mw-border);
 color: var(--mw-text);
 cursor: pointer;
 font-size:1rem;
 transition: background0.15s;
}
.st__back:hover { background: var(--mw-bg-soft); }
.st__logo {
 width:32px; height:32px;
 border-radius:8px;
 background: var(--mw-primary);
 color: var(--mw-primary-contrast, #fff);
 display: grid; place-items: center;
 font-weight:700; font-size:1.1rem;
}
.st__brand-name { font-size:1.05rem; font-weight:600; }
.st__nav-links { display: flex; gap:0.25rem; flex:1; justify-content: center; }
.st__nav-link {
 padding:0.5rem0.85rem;
 border-radius:8px;
 font-size:0.92rem;
 color: var(--mw-text-muted);
 text-decoration: none;
 transition: background0.2s, color0.2s;
}
.st__nav-link:hover { background: var(--mw-bg-soft); color: var(--mw-text); }
.st__nav-link--active {
 background: var(--mw-primary-soft);
 color: var(--mw-primary);
 font-weight:600;
}
.st__nav-right { display: flex; align-items: center; gap:0.75rem; }

/* ===== 内容 ===== */
.st__content {
 max-width:1200px;
 margin:0 auto;
 padding:1.5rem;
 display: flex;
 flex-direction: column;
 gap:1.25rem;
}
.st__header h1 { font-size:1.6rem; font-weight:700; margin:000.25rem; }
.st__header p { margin:0; color: var(--mw-text-muted); font-size:0.9rem; }

/* ===== 双栏 ===== */
.st__layout {
 display: grid;
 grid-template-columns:220px1fr;
 gap:1.5rem;
}

/* =====侧栏 ===== */
.st__sidebar {
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 border-radius:10px;
 padding:0.5rem;
 height: fit-content;
 position: sticky;
 top:5rem;
}
.st__side-item {
 width:100%;
 display: flex;
 align-items: center;
 gap:0.6rem;
 padding:0.6rem0.75rem;
 background: transparent;
 border: none;
 border-radius:8px;
 color: var(--mw-text-muted);
 font-size:0.92rem;
 cursor: pointer;
 text-align: left;
 transition: background0.15s, color0.15s;
}
.st__side-item:hover { background: var(--mw-bg-soft); color: var(--mw-text); }
.st__side-item--active {
 background: var(--mw-primary-soft);
 color: var(--mw-primary);
 font-weight:600;
}
.st__side-item--danger { color: var(--mw-danger, #ef4444); }
.st__side-item--danger:hover { background: color-mix(in srgb, var(--mw-danger, #ef4444)12%, transparent); }
.st__side-icon { font-size:1.1rem; }
.st__sidebar-divider {
 height:1px;
 background: var(--mw-border);
 margin:0.5rem0.25rem;
}

/* =====主体面板 ===== */
.st__main {
 background: var(--mw-surface);
 border:1px solid var(--mw-border);
 border-radius:10px;
 padding:1.5rem1.75rem;
 min-height:480px;
}
.st__panel-title { font-size:1.35rem; font-weight:600; margin:000.25rem; }
.st__panel-desc { color: var(--mw-text-muted); margin:00.5rem0; font-size:0.9rem; }

/* ===== 表单 ===== */
.st__form { display: flex; flex-direction: column; gap:1.25rem; margin-top:1rem; }
.st__field { display: flex; flex-direction: column; gap:0.35rem; }
.st__field--flex { flex:1; }
.st__label { font-size:0.85rem; font-weight:600; color: var(--mw-text-muted); }
.st__input {
 padding:0.6rem0.85rem;
 background: var(--mw-bg);
 border:1px solid var(--mw-border);
 border-radius:8px;
 color: var(--mw-text);
 font-size:0.95rem;
 font-family: inherit;
 outline: none;
 transition: border0.2s, box-shadow0.2s;
}
.st__input:focus {
 border-color: var(--mw-primary);
 box-shadow:0003px var(--mw-primary-soft);
}
.st__textarea { resize: vertical; min-height:70px; }
.st__readonly {
 padding:0.6rem0.85rem;
 background: var(--mw-bg-soft);
 border:1px solid var(--mw-border);
 border-radius:8px;
 color: var(--mw-text-muted);
 font-size:0.9rem;
}
.st__readonly--mono { font-family: ui-monospace, monospace; font-size:0.8rem; }
.st__hint { font-size:0.78rem; color: var(--mw-text-muted); }
.st__error { font-size:0.82rem; color: var(--mw-danger, #ef4444); }

.st__avatar-grid {
 display: grid;
 grid-template-columns: repeat(auto-fill, minmax(48px,1fr));
 gap:0.4rem;
}
.st__avatar-btn {
 aspect-ratio:1;
 font-size:1.5rem;
 background: var(--mw-bg-soft);
 border:2px solid var(--mw-border);
 border-radius:8px;
 cursor: pointer;
 transition: border0.15s, transform0.1s;
}
.st__avatar-btn:hover { border-color: var(--mw-primary); transform: scale(1.05); }
.st__avatar-btn--active {
 border-color: var(--mw-primary);
 background: var(--mw-primary-soft);
}

.st__actions { display: flex; align-items: center; gap:0.75rem; padding-top:0.5rem; }
.st__save-toast {
 color: var(--mw-success, #10b981);
 font-size:0.9rem;
 font-weight:500;
 animation: st-fade-in0.3s;
}
@keyframes st-fade-in { from { opacity:0; transform: translateY(-4px); } to { opacity:1; transform: translateY(0); } }

/* =====按钮 ===== */
.st__btn {
 padding:0.6rem1.1rem;
 background: var(--mw-bg-soft);
 border:1px solid var(--mw-border);
 border-radius:8px;
 color: var(--mw-text);
 font-size:0.92rem;
 cursor: pointer;
 font-family: inherit;
 transition: background0.15s, transform0.1s, border0.15s;
}
.st__btn:hover { background: var(--mw-surface); }
.st__btn:active { transform: scale(0.98); }
.st__btn:disabled { opacity:0.55; cursor: not-allowed; }
.st__btn--primary {
 background: var(--mw-primary);
 color: var(--mw-primary-contrast, #fff);
 border-color: var(--mw-primary);
}
.st__btn--primary:hover:not(:disabled) { filter: brightness(1.08); }
.st__btn--ghost { background: transparent; }
.st__btn--danger {
 background: var(--mw-danger, #ef4444);
 color: #fff;
 border-color: var(--mw-danger, #ef4444);
}
.st__btn--ghost-danger {
 color: var(--mw-danger, #ef4444);
 border-color: var(--mw-danger, #ef4444);
 background: transparent;
}
.st__btn--ghost-danger:hover { background: color-mix(in srgb, var(--mw-danger, #ef4444)10%, transparent); }
.st__btn--sm { padding:0.35rem0.7rem; font-size:0.82rem; }

/* =====危险区 ===== */
.st__danger-zone {
 margin-top:2rem;
 padding-top:1.5rem;
 border-top:1px solid var(--mw-border);
}
.st__danger-panel {
 margin-top:0.75rem;
 padding:1rem;
 background: color-mix(in srgb, var(--mw-danger, #ef4444)8%, transparent);
 border:1px solid var(--mw-danger, #ef4444);
 border-radius:8px;
}
.st__danger-panel p { margin:00.75rem0; font-size:0.88rem; color: var(--mw-text); }

/* =====订阅 ===== */
.st__current-plan {
 display: flex;
 align-items: center;
 gap:1rem;
 padding:1rem1.25rem;
 background: var(--mw-bg-soft);
 border-radius:10px;
 margin:1rem0;
}
.st__current-info { flex:1; }
.st__current-label { font-size:0.8rem; color: var(--mw-text-muted); }
.st__current-name { display: flex; align-items: center; gap:0.6rem; font-size:1.15rem; font-weight:600; margin:0.25rem0; }
.st__current-meta { font-size:0.82rem; color: var(--mw-text-muted); }

.st__plans {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
 gap:1rem;
 margin-top:1rem;
}
.st__plan {
 position: relative;
 background: var(--mw-bg);
 border:1px solid var(--mw-border);
 border-radius:10px;
 padding:1.25rem;
 display: flex;
 flex-direction: column;
 gap:0.5rem;
 transition: border0.15s, transform0.15s;
}
.st__plan:hover { transform: translateY(-2px); }
.st__plan--highlight { border-color: var(--mw-primary); }
.st__plan--current { background: var(--mw-primary-soft); border-color: var(--mw-primary); }
.st__plan-ribbon {
 position: absolute;
 top:-10px; right:1rem;
 background: var(--mw-primary);
 color: var(--mw-primary-contrast, #fff);
 font-size:0.7rem;
 padding:0.15rem0.5rem;
 border-radius:999px;
 font-weight:600;
}
.st__plan-name { font-size:1.15rem; font-weight:600; }
.st__plan-price { display: flex; align-items: baseline; gap:0.25rem; }
.st__plan-amount { font-size:1.6rem; font-weight:700; color: var(--mw-primary); }
.st__plan-period { font-size:0.85rem; color: var(--mw-text-muted); }
.st__plan-features {
 list-style: none;
 padding:0;
 margin:0.5rem0;
 display: flex;
 flex-direction: column;
 gap:0.3rem;
 font-size:0.85rem;
 color: var(--mw-text-muted);
 flex:1;
}

/* ===== BYOK ===== */
.st__byok-form {
 display: flex;
 flex-direction: column;
 gap:0.75rem;
 padding:1rem;
 background: var(--mw-bg-soft);
 border-radius:10px;
 margin-top:1rem;
}
.st__byok-row { display: flex; gap:0.75rem; }
.st__key-list { display: flex; flex-direction: column; gap:0.5rem; margin-top:1rem; }
.st__key-row {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap:1rem;
 padding:0.85rem1rem;
 background: var(--mw-bg);
 border:1px solid var(--mw-border);
 border-radius:8px;
}
.st__key-info { flex:1; min-width:0; }
.st__key-label { display: flex; align-items: center; gap:0.6rem; font-size:0.92rem; }
.st__key-provider {
 font-weight:600;
 color: var(--mw-primary);
 padding:0.1rem0.4rem;
 background: var(--mw-primary-soft);
 border-radius:4px;
 font-size:0.78rem;
}
.st__key-name { font-weight:500; }
.st__key-status {
 font-size:0.72rem;
 padding:0.1rem0.4rem;
 border-radius:999px;
}
.st__key-status--active { background: color-mix(in srgb, var(--mw-success, #10b981)15%, transparent); color: var(--mw-success, #10b981); }
.st__key-status--invalid { background: color-mix(in srgb, var(--mw-danger, #ef4444)15%, transparent); color: var(--mw-danger, #ef4444); }
.st__key-meta { display: flex; align-items: center; gap:0.75rem; font-size:0.8rem; color: var(--mw-text-muted); margin-top:0.25rem; }
.st__key-masked { font-family: ui-monospace, monospace; font-size:0.78rem; }
.st__key-date { font-size:0.75rem; }
.st__key-actions { display: flex; gap:0.4rem; }

.st__empty {
 display: flex;
 flex-direction: column;
 align-items: center;
 gap:0.75rem;
 padding:2rem;
 background: var(--mw-bg-soft);
 border:2px dashed var(--mw-border);
 border-radius:10px;
 margin-top:1rem;
 color: var(--mw-text-muted);
}
.st__empty-icon { font-size:2.5rem; opacity:0.5; }

/* =====通知 ===== */
.st__notif-table {
 display: flex;
 flex-direction: column;
 margin-top:1rem;
 border:1px solid var(--mw-border);
 border-radius:10px;
 overflow: hidden;
}
.st__notif-head, .st__notif-row {
 display: grid;
 grid-template-columns:1fr80px80px;
 align-items: center;
 gap:1rem;
 padding:0.75rem1rem;
}
.st__notif-head {
 background: var(--mw-bg-soft);
 font-size:0.82rem;
 font-weight:600;
 color: var(--mw-text-muted);
 text-transform: uppercase;
 letter-spacing:0.5px;
}
.st__notif-row { border-top:1px solid var(--mw-border); }
.st__notif-row:hover { background: var(--mw-bg-soft); }
.st__notif-col { text-align: center; }
.st__notif-info { display: flex; flex-direction: column; gap:0.15rem; }
.st__notif-label { font-size:0.95rem; font-weight:500; }
.st__notif-desc { font-size:0.8rem; color: var(--mw-text-muted); }

/*开关 */
.st__switch {
 position: relative;
 display: inline-block;
 width:40px;
 height:22px;
 cursor: pointer;
}
.st__switch input { opacity:0; width:0; height:0; }
.st__switch span {
 position: absolute;
 inset:0;
 background: var(--mw-bg-soft);
 border:1px solid var(--mw-border);
 border-radius:999px;
 transition: background0.2s;
}
.st__switch span::before {
 content: '';
 position: absolute;
 top:2px; left:2px;
 width:16px; height:16px;
 background: var(--mw-text-muted);
 border-radius:50%;
 transition: transform0.2s, background0.2s;
}
.st__switch input:checked + span { background: var(--mw-primary); border-color: var(--mw-primary); }
.st__switch input:checked + span::before { transform: translateX(18px); background: #fff; }

/* =====主题选择 ===== */
.st__subpanel { margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--mw-border); }
.st__subpanel h3 { font-size:1.1rem; font-weight:600; margin:000.25rem; }
.st__themes {
 display: grid;
 grid-template-columns: repeat(auto-fill, minmax(120px,1fr));
 gap:0.75rem;
 margin-top:1rem;
}
.st__theme-card {
 padding:0.5rem;
 background: var(--mw-bg-soft);
 border:2px solid var(--mw-border);
 border-radius:8px;
 cursor: pointer;
 transition: border0.15s, transform0.1s;
 text-align: center;
}
.st__theme-card:hover { transform: translateY(-2px); }
.st__theme-card--active { border-color: var(--mw-primary); }
.st__theme-preview {
 width:100%;
 height:60px;
 border-radius:6px;
 margin-bottom:0.4rem;
}
.st__theme-name { font-size:0.82rem; color: var(--mw-text-muted); }

/* =====响应式 ===== */
@media (max-width:768px) {
 .st__nav-links { display: none; }
 .st__layout { grid-template-columns:1fr; }
 .st__sidebar {
 display: flex;
 flex-wrap: wrap;
 gap:0.25rem;
 position: static;
 }
 .st__side-item { flex:1; min-width:80px; }
}
</style>
