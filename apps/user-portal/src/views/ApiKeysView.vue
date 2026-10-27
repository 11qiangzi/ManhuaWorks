<script setup lang="ts">
/**
 * ApiKeysView · BYOK API Key 管理页
 * 千机工坊 · W6 用户后台 · L4-A BYOK UI
 *
 * 4 大模块：
 * 1. 顶部 KPI（已用/总额积分 + 已配置/未配置 provider + Key 总数）
 * 2. 添加 Key 表单（provider select + key input + 可选 label）
 * 3. 现有 Key 列表（provider badge + masked + lastUsed + reveal + revoke）
 * 4. Reveal 弹窗（一次性健康度披露，30s 自动关闭，复制按钮）
 *
 * 风格：与 SettingsView / AccountView 一致——顶部 nav + 卡片面板 + 弹窗 mask。
 */

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  PROVIDER_META,
  PROVIDER_IDS,
  maskedDisplay,
  formatLastUsed,
  creditsKpi,
  type ProviderId,
  type ApiKeyRow
} from '@/api/api-keys'
import { useApiKeys, REVEAL_TTL_MS } from '@/composables/apiKeys'
import { useUser } from '@/composables/useUser'

const { profile, load: loadUser } = useUser()
const {
  keys,
  loading,
  error,
  revealing,
  revealText,
  revealSecondsLeft,
  kpi,
  isAuthed,
  load,
  add,
  remove,
  reveal,
  closeReveal
} = useApiKeys()

/* ------------------------------------------------------------------ */
/*                          添加表单 state                              */
/* ------------------------------------------------------------------ */

const formProvider = ref<ProviderId>('openai')
const formKey = ref('')
const formLabel = ref('')
const formSubmitting = ref(false)
const formSaved = ref<string | null>(null)
const formErr = ref<string | null>(null)

const currentMeta = computed(() => PROVIDER_META[formProvider.value])

async function submitAdd(): Promise<void> {
  formErr.value = null
  formSaved.value = null
  if (!formKey.value.trim()) {
    formErr.value = '请填写 Key 值'
    return
  }
  if (formKey.value.trim().length < 8) {
    formErr.value = 'Key 至少 8 位'
    return
  }
  formSubmitting.value = true
  try {
    const ok = await add(formProvider.value, formKey.value.trim(), formLabel.value.trim() || undefined)
    if (ok) {
      formSaved.value = `✅ ${currentMeta.value.name} Key 已保存（仅保存打码 hint）`
      formKey.value = ''
      formLabel.value = ''
      setTimeout(() => (formSaved.value = null), 3000)
    } else {
      formErr.value = error.value ?? '保存失败'
    }
  } finally {
    formSubmitting.value = false
  }
}

/* ------------------------------------------------------------------ */
/*                          列表 / Reveal                              */
/* ------------------------------------------------------------------ */

async function revoke(k: ApiKeyRow): Promise<void> {
  if (!confirm(`确定删除「${PROVIDER_META[k.provider as ProviderId]?.name ?? k.provider} · ${k.api_key_hint}」？此操作不可撤销。`)) return
  await remove(k.id)
}

async function doReveal(k: ApiKeyRow): Promise<void> {
  await reveal(k.id)
}

async function copyReveal(): Promise<void> {
  if (!revealText.value) return
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(revealText.value)
    }
  } catch {
    /* clipboard 不可用时静默 */
  }
}

/* ------------------------------------------------------------------ */
/*                          挂载                                       */
/* ------------------------------------------------------------------ */

onMounted(async () => {
  await Promise.all([loadUser(), load()])
})

const creditKpi = computed(() => creditsKpi(kpi.value.creditsUsed, kpi.value.creditsTotal))
</script>

<template>
  <main class="ak">
    <!-- 顶部 nav（与 AccountView/SettingsView 一致） -->
    <header class="ak__nav">
      <div class="ak__brand">
        <span class="ak__logo">M</span>
        <span class="ak__brand-name">API Key 管理</span>
      </div>
      <nav class="ak__nav-links">
        <RouterLink to="/dashboard" class="ak__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="ak__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="ak__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="ak__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="ak__nav-link">团队</RouterLink>
        <RouterLink to="/settings" class="ak__nav-link">设置</RouterLink>
        <RouterLink to="/byok" class="ak__nav-link ak__nav-link--active">API密钥</RouterLink>
      </nav>
    </header>

    <div class="ak__content">
      <header class="ak__head">
        <h1 class="ak__title">🔑 API密钥管理</h1>
        <p class="ak__sub">使用你自己的 AI 服务商密钥，享受更高额度与更稳定的服务。密钥经 AES-256-GCM 加密存储，明文仅在一次性查看时返回（30s 自动关闭）。</p>
        <div v-if="error" class="ak__toast ak__toast--err">⚠ {{ error }}</div>
      </header>

      <!-- ===== 1. KPI 卡片 ===== -->
      <section class="ak__kpis">
        <article class="ak__kpi">
          <p class="ak__kpi-label">积分 · 已用 / 总额</p>
          <p class="ak__kpi-value">
            <strong>{{ creditKpi.used }}</strong>
            <span class="ak__kpi-sub">/ {{ creditKpi.total || '∞' }}</span>
          </p>
          <div class="ak__kpi-bar">
            <div class="ak__kpi-bar-fill" :style="{ width: creditKpi.percent + '%' }" />
          </div>
        </article>
        <article class="ak__kpi">
          <p class="ak__kpi-label">已配置 provider</p>
          <p class="ak__kpi-value">
            <strong>{{ kpi.configured }}</strong>
            <span class="ak__kpi-sub">/ {{ kpi.configured + kpi.unconfigured }}</span>
          </p>
          <p class="ak__kpi-hint">5 个支持：OpenAI / Anthropic / Google / DeepSeek / MiniMax</p>
        </article>
        <article class="ak__kpi">
          <p class="ak__kpi-label">未配置 provider</p>
          <p class="ak__kpi-value">
            <strong>{{ kpi.unconfigured }}</strong>
          </p>
          <p class="ak__kpi-hint">下方表单可一键补齐</p>
        </article>
        <article class="ak__kpi">
          <p class="ak__kpi-label">Key 总数</p>
          <p class="ak__kpi-value">
            <strong>{{ kpi.totalKeys }}</strong>
          </p>
          <p class="ak__kpi-hint">每个 provider 仅保留最新一条</p>
        </article>
      </section>

      <!-- ===== 2. 添加表单 ===== -->
      <section class="ak__panel">
        <h2 class="ak__panel-title">➕ 添加 / 覆盖 API Key</h2>
        <p class="ak__panel-sub">同 provider 再次保存会覆盖旧 Key（后端 upsert）。Key 不会明文显示，列表只展示打码 hint。</p>
        <form class="ak__form" @submit.prevent="submitAdd">
          <label class="ak__field">
            <span>服务商</span>
            <select v-model="formProvider" :disabled="formSubmitting">
              <option v-for="pid in PROVIDER_IDS" :key="pid" :value="pid">
                {{ PROVIDER_META[pid].logo }} {{ PROVIDER_META[pid].name }}
              </option>
            </select>
          </label>
          <label class="ak__field">
            <span>标签（可选）</span>
            <input v-model="formLabel" type="text" :disabled="formSubmitting" placeholder="例如：主力 GPT-4o" maxlength="50" />
          </label>
          <label class="ak__field ak__field--wide">
            <span>Key 值 · 以 <code>{{ currentMeta.prefix }}</code> 开头</span>
            <input v-model="formKey" type="password" :disabled="formSubmitting" :placeholder="currentMeta.placeholder" autocomplete="off" />
          </label>
          <div class="ak__form-actions">
            <button type="submit" class="ak__btn ak__btn--primary" :disabled="formSubmitting || loading">
              {{ formSubmitting ? '保存中…' : '保存 Key' }}
            </button>
            <span v-if="formSaved" class="ak__form-msg ak__form-msg--ok">{{ formSaved }}</span>
            <span v-if="formErr" class="ak__form-msg ak__form-msg--err">{{ formErr }}</span>
          </div>
        </form>
      </section>

      <!-- ===== 3. 列表 ===== -->
      <section class="ak__panel">
        <h2 class="ak__panel-title">📋 已配置的 Key</h2>
        <div v-if="loading && keys.length === 0" class="ak__empty">加载中…</div>
        <div v-else-if="keys.length === 0" class="ak__empty">还没有 API Key。上面表单加一个试试。</div>
        <ul v-else class="ak__list">
          <li v-for="k in keys" :key="k.id" class="ak__item">
            <div class="ak__item-info">
              <span
                class="ak__item-badge"
                :style="{
                  background: (PROVIDER_META[k.provider as ProviderId]?.color ?? '#6b7280') + '22',
                  color: PROVIDER_META[k.provider as ProviderId]?.color ?? '#6b7280'
                }"
              >
                {{ PROVIDER_META[k.provider as ProviderId]?.logo ?? '?' }}
              </span>
              <div>
                <p class="ak__item-name">
                  {{ PROVIDER_META[k.provider as ProviderId]?.name ?? k.provider }}
                  <span v-if="k.revokedAt" class="ak__item-err">已撤销</span>
                </p>
                <p class="ak__item-masked">{{ maskedDisplay(k) }} · 指纹 {{ k.keyFingerprint }}</p>
                <p class="ak__item-time">
                  上次使用：{{ formatLastUsed(k.lastUsedAt) }} · 创建于 {{ formatLastUsed(k.createdAt) }}
                </p>
              </div>
            </div>
            <div class="ak__item-ops">
              <button type="button" class="ak__btn" :disabled="revealing" @click="doReveal(k)">
                {{ revealing ? '读取中…' : '👁 查看' }}
              </button>
              <button type="button" class="ak__btn ak__btn--danger" :disabled="loading" @click="revoke(k)">
                🗑 撤销
              </button>
            </div>
          </li>
        </ul>
      </section>

      <p v-if="!isAuthed" class="ak__hint">⚠ 当前未登录，部分操作可能受限。</p>
      <p v-if="profile" class="ak__hint">当前用户：{{ profile.nickname }}（{{ profile.email ?? profile.phone ?? '—' }}）</p>
    </div>

    <!-- ===== 4. Reveal 弹窗 (一次性明文 + 30s 倒计时) ===== -->
    <div v-if="revealText" class="ak__mask" @click.self="closeReveal">
      <div class="ak__modal" role="dialog" aria-label="API Key 明文查看">
        <header class="ak__modal-head">
          <h3>👁 一次性查看明文 Key</h3>
          <button type="button" class="ak__modal-close" aria-label="关闭" @click="closeReveal">×</button>
        </header>
        <pre class="ak__modal-body">{{ revealText }}</pre>
        <footer class="ak__modal-foot">
          <span class="ak__modal-timer">⏱ {{ revealSecondsLeft }}s 后自动关闭</span>
          <div class="ak__modal-actions">
            <button type="button" class="ak__btn" @click="copyReveal">📋 复制</button>
            <button type="button" class="ak__btn ak__btn--primary" @click="closeReveal">我已复制,关闭</button>
          </div>
        </footer>
      </div>
    </div>
  </main>
</template>

<style scoped>
.ak { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.ak__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.ak__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.ak__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white; font-weight: 800;
}
.ak__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; flex-wrap: wrap; }
.ak__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.ak__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.ak__nav-link--active { color: white; background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); }

.ak__content { max-width: 1080px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }
.ak__head { position: relative; }
.ak__title { font-size: 22px; font-weight: 800; margin: 0; }
.ak__sub { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; line-height: 1.6; }
.ak__toast--err { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; border: 1px solid #ef4444; margin-top: 8px; display: inline-block; }

/* KPI */
.ak__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 880px) { .ak__kpis { grid-template-columns: repeat(2, 1fr); } }
.ak__kpi { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.ak__kpi-label { font-size: 11px; color: var(--text-secondary); margin: 0 0 8px; }
.ak__kpi-value { font-size: 22px; font-weight: 800; margin: 0; }
.ak__kpi-sub { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-left: 2px; }
.ak__kpi-hint { font-size: 10px; color: var(--text-secondary); margin: 6px 0 0; }
.ak__kpi-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top: 8px; }
.ak__kpi-bar-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #f97316); transition: width 240ms; }

/* Panel */
.ak__panel { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; }
.ak__panel-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
.ak__panel-sub { font-size: 12px; color: var(--text-secondary); margin: 0 0 16px; line-height: 1.6; }

/* Form */
.ak__form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.ak__field { display: flex; flex-direction: column; gap: 4px; }
.ak__field--wide { grid-column: 1 / -1; }
.ak__field span { font-size: 11px; color: var(--text-secondary); }
.ak__field span code { font-size: 11px; padding: 1px 5px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 3px; }
.ak__field input, .ak__field select {
  height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px; font-family: inherit;
}
.ak__form-actions { grid-column: 1 / -1; display: flex; gap: 12px; align-items: center; }
.ak__form-msg { font-size: 12px; font-weight: 600; }
.ak__form-msg--ok { color: #10b981; }
.ak__form-msg--err { color: #ef4444; }

/* List */
.ak__empty { padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px; }
.ak__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ak__item {
  display: flex; align-items: center; gap: 16px; padding: 14px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-primary);
}
.ak__item-info { display: flex; gap: 12px; align-items: flex-start; flex: 1; min-width: 0; }
.ak__item-badge {
  flex-shrink: 0;
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700;
}
.ak__item-name { font-size: 14px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px; }
.ak__item-warn { font-size: 10px; padding: 1px 6px; background: #f59e0b; color: white; border-radius: 4px; font-weight: 600; }
.ak__item-err { font-size: 10px; padding: 1px 6px; background: #ef4444; color: white; border-radius: 4px; font-weight: 600; }
.ak__item-masked { font-size: 12px; color: var(--text-primary); margin: 4px 0 2px; font-family: 'Menlo', 'Consolas', monospace; word-break: break-all; }
.ak__item-time { font-size: 11px; color: var(--text-secondary); margin: 0; }
.ak__item-err-text { font-size: 11px; color: #ef4444; margin: 4px 0 0; word-break: break-all; }
.ak__item-ops { display: flex; gap: 6px; flex-shrink: 0; }

/* Button */
.ak__btn {
  height: 32px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer; font-size: 12px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px;
}
.ak__btn--primary { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border: none; }
.ak__btn--danger { color: #ef4444; border-color: #ef4444; }
.ak__btn--danger:hover { background: #ef4444; color: white; }
.ak__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ak__hint { font-size: 11px; color: var(--text-secondary); margin: 0; }

/* Modal */
.ak__mask { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.ak__modal { background: var(--bg-primary); border-radius: 12px; padding: 0; width: 100%; max-width: 520px; display: flex; flex-direction: column; }
.ak__modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.ak__modal-head h3 { font-size: 16px; font-weight: 700; margin: 0; }
.ak__modal-close { background: none; border: none; font-size: 24px; line-height: 1; cursor: pointer; color: var(--text-secondary); padding: 0 4px; }
.ak__modal-close:hover { color: var(--text-primary); }
.ak__modal-body { padding: 16px 20px; font-family: 'Menlo', 'Consolas', monospace; font-size: 12px; line-height: 1.7; white-space: pre-wrap; word-break: break-all; margin: 0; max-height: 50vh; overflow-y: auto; }
.ak__modal-foot { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.ak__modal-timer { font-size: 11px; color: var(--text-secondary); font-family: monospace; }
.ak__modal-actions { display: flex; gap: 8px; }
</style>
