<!--
  SettingsApiKeyView · BYOK 用户自带 API Key 设置 (派单 17)
  千机工坊 - user-portal · 路由 /settings/api-keys

  派单 17 字面要求:
    - 6 个 provider 卡片 (DeepSeek / OpenAI / 通义千问 / 智谱 / Replicate / fal.ai)
    - 每张卡片: provider logo + 描述 + "添加 Key" 按钮 + 已添加 key 列表 (脱敏显示)
    - 表单弹窗: provider select / api key input (password) / baseUrl (可选, OpenAI 兼容) /
                nickname / 设为默认
    - 6 大功能使用时: 顶部 dropdown 让用户选"用哪个 provider + 哪个 key"

  实现:
    - 6 provider 卡片 grid 布局 (响应式 3列/2列/1列)
    - 每卡片显示: 已配置的 keys (脱敏 hint + nickname + 默认标记 + 测试状态),
                  + "添加 Key" 按钮 (打开 modal)
    - 弹窗: provider select + apiKey input + baseUrl input + nickname + isDefault checkbox
    - 测试按钮: POST /:id/test, 状态颜色 ok/invalid/rate_limited
    - 401 降级: 后端返 invalid 时, 弹窗提示用户重新填
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BYOK_PROVIDER_META,
  BYOK_PROVIDER_IDS,
  fetchByokKeys,
  createByokKey,
  patchByokKey,
  deleteByokKey,
  testByokKey,
  testStatusText,
  testStatusColor,
  formatDateTime,
  type ByokProviderId,
  type ByokKeyRow,
  type ByokTestResult,
} from '@/api/byok-keys'

/* ------------------------------------------------------------------ */
/*                          状态                                       */
/* ------------------------------------------------------------------ */
const keys = ref<ByokKeyRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const testingId = ref<string | null>(null)
const testResultByKey = ref<Record<string, ByokTestResult | null>>({})

/* 弹窗 */
const modalOpen = ref(false)
const modalProvider = ref<ByokProviderId>('deepseek')
const modalApiKey = ref('')
const modalBaseUrl = ref('')
const modalNickname = ref('')
const modalIsDefault = ref(false)
const modalSubmitting = ref(false)
const modalErr = ref<string | null>(null)
const modalMode = ref<'add' | 'edit'>('add')
const modalEditId = ref<string | null>(null)

const currentMeta = computed(() => BYOK_PROVIDER_META[modalProvider.value])

/* 6 大功能 mock 数据 — 派单 17 字面要求顶部 dropdown
   实际 6 大功能在 L4-A 系列里 (智能对话/图像生成/视频生成/语音合成/翻译/角色定制),
   这里只占位, 等 L4-B 接入真实功能
*/
const sixFeatures = [
  { id: 'chat', name: '💬 智能对话' },
  { id: 'image', name: '🎨 图像生成' },
  { id: 'video', name: '🎬 视频生成' },
  { id: 'audio', name: '🎵 语音合成' },
  { id: 'translate', name: '🌐 翻译' },
  { id: 'role', name: '👤 角色定制' },
]
const selectedFeature = ref('chat')
const selectedProvider = ref<ByokProviderId>('deepseek')

/* ------------------------------------------------------------------ */
/*                          加载                                       */
/* ------------------------------------------------------------------ */
async function load() {
  loading.value = true
  error.value = null
  try {
    keys.value = await fetchByokKeys()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'load_failed'
    keys.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ------------------------------------------------------------------ */
/*                          弹窗                                       */
/* ------------------------------------------------------------------ */
function openAddModal(provider?: ByokProviderId) {
  modalMode.value = 'add'
  modalProvider.value = provider ?? 'deepseek'
  modalApiKey.value = ''
  modalBaseUrl.value = BYOK_PROVIDER_META[modalProvider.value].defaultBaseUrl
  modalNickname.value = ''
  modalIsDefault.value = false
  modalErr.value = null
  modalEditId.value = null
  modalOpen.value = true
}

function openEditModal(key: ByokKeyRow) {
  modalMode.value = 'edit'
  modalProvider.value = key.provider as ByokProviderId
  modalApiKey.value = ''  // 不显示明文
  modalBaseUrl.value = key.baseUrl ?? BYOK_PROVIDER_META[modalProvider.value].defaultBaseUrl
  modalNickname.value = key.nickname
  modalIsDefault.value = key.isDefault === 1
  modalErr.value = null
  modalEditId.value = key.id
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  modalSubmitting.value = false
  modalErr.value = null
}

async function submitModal() {
  modalErr.value = null
  if (modalApiKey.value.trim().length < 4 && modalMode.value === 'add') {
    modalErr.value = 'API Key 至少 4 位'
    return
  }
  if (modalNickname.value.trim().length === 0) {
    modalErr.value = '请给 key 起个名字 (如 "主力 GPT-4o")'
    return
  }
  modalSubmitting.value = true
  try {
    if (modalMode.value === 'add') {
      await createByokKey({
        provider: modalProvider.value,
        apiKey: modalApiKey.value.trim(),
        nickname: modalNickname.value.trim(),
        baseUrl: modalBaseUrl.value.trim() || undefined,
        isDefault: modalIsDefault.value,
      })
    } else if (modalEditId.value) {
      // 编辑模式不能改 key 本身 (派单 17 字面: 不能改 key 本身, 删了重加)
      await patchByokKey(modalEditId.value, {
        nickname: modalNickname.value.trim(),
        isDefault: modalIsDefault.value,
      })
    }
    await load()
    closeModal()
  } catch (e) {
    modalErr.value = e instanceof Error ? e.message : 'save_failed'
  } finally {
    modalSubmitting.value = false
  }
}

/* ------------------------------------------------------------------ */
/*                          列表 / 测试 / 删                           */
/* ------------------------------------------------------------------ */
function keysByProvider(provider: ByokProviderId): ByokKeyRow[] {
  return keys.value.filter((k) => k.provider === provider)
}

function providerConfigured(provider: ByokProviderId): boolean {
  return keysByProvider(provider).length > 0
}

async function removeKey(k: ByokKeyRow) {
  if (!confirm(`确定删除「${BYOK_PROVIDER_META[k.provider as ByokProviderId]?.name ?? k.provider} · ${k.nickname}」？此操作不可撤销。`)) return
  try {
    await deleteByokKey(k.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'delete_failed'
  }
}

async function testKey(k: ByokKeyRow) {
  testingId.value = k.id
  try {
    const result = await testByokKey(k.id)
    testResultByKey.value[k.id] = result
    // 刷新列表拿到 lastTestAt / lastTestStatus
    await load()
  } catch (e) {
    testResultByKey.value[k.id] = {
      status: 'invalid',
      latencyMs: 0,
      provider: k.provider,
      hint: e instanceof Error ? e.message : 'test_failed',
    }
  } finally {
    testingId.value = null
  }
}

async function setDefault(k: ByokKeyRow) {
  if (k.isDefault === 1) return
  try {
    await patchByokKey(k.id, { isDefault: true })
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'set_default_failed'
  }
}

async function clearTestResult() {
  testResultByKey.value = {}
}
</script>

<template>
  <main class="sk">
    <!-- 顶部 nav (与 ApiKeysView/SettingsView 一致) -->
    <header class="sk__nav">
      <div class="sk__brand">
        <span class="sk__logo">⚙</span>
        <span class="sk__brand-name">设置 · API Key</span>
      </div>
      <nav class="sk__nav-links">
        <RouterLink to="/dashboard" class="sk__nav-link">首页</RouterLink>
        <RouterLink to="/projects" class="sk__nav-link">项目</RouterLink>
        <RouterLink to="/works" class="sk__nav-link">作品</RouterLink>
        <RouterLink to="/assets" class="sk__nav-link">素材</RouterLink>
        <RouterLink to="/team" class="sk__nav-link">团队</RouterLink>
        <RouterLink to="/settings" class="sk__nav-link">设置</RouterLink>
        <RouterLink to="/byok" class="sk__nav-link">API密钥</RouterLink>
      </nav>
    </header>

    <div class="sk__content">
      <!-- 顶部: 6 大功能 + provider dropdown (派单 17 字面要求) -->
      <section class="sk__panel sk__feature-bar">
        <h2 class="sk__panel-title">🎯 6 大功能 · 用哪个 Provider + Key</h2>
        <p class="sk__panel-sub">选定功能 + Provider, 系统自动用对应的默认 Key 调用 (派单 17: 1 年后商业化切换路径保留)</p>
        <div class="sk__feature-row">
          <label class="sk__field sk__field--inline">
            <span>功能</span>
            <select v-model="selectedFeature">
              <option v-for="f in sixFeatures" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </label>
          <span class="sk__arrow">→</span>
          <label class="sk__field sk__field--inline">
            <span>Provider</span>
            <select v-model="selectedProvider">
              <option v-for="pid in BYOK_PROVIDER_IDS" :key="pid" :value="pid">
                {{ BYOK_PROVIDER_META[pid].logo }} {{ BYOK_PROVIDER_META[pid].name }}
              </option>
            </select>
          </label>
          <span class="sk__arrow">→</span>
          <span class="sk__field sk__field--inline">
            <span>Key</span>
            <span class="sk__key-name">
              <template v-if="keysByProvider(selectedProvider).length > 0">
                {{ keysByProvider(selectedProvider).find(k => k.isDefault === 1)?.nickname ?? keysByProvider(selectedProvider)[0]!.nickname }}
              </template>
              <template v-else>
                <em class="sk__empty-key">未配置</em>
              </template>
            </span>
          </span>
          <RouterLink to="/byok" class="sk__btn sk__btn--text">📋 旧版 BYOK →</RouterLink>
        </div>
      </section>

      <!-- 头部 + 错误 -->
      <header class="sk__head">
        <h1 class="sk__title">🔑 自带 API Key (BYOK)</h1>
        <p class="sk__sub">
          6 大 provider 自由选择, Key 加密存储 (AES-256-GCM, masterKey 在 Worker Secrets),
          限流 60 次/h/key, 401 失效自动提示重填。
        </p>
        <div v-if="error" class="sk__toast sk__toast--err">
          ⚠ {{ error }}
          <button type="button" class="sk__toast-close" @click="error = null">×</button>
        </div>
      </header>

      <!-- 6 provider 卡片 (派单 17 字面要求) -->
      <section v-if="loading && keys.length === 0" class="sk__loading">加载中…</section>
      <section v-else class="sk__grid">
        <article
          v-for="pid in BYOK_PROVIDER_IDS"
          :key="pid"
          class="sk__card"
          :class="{ 'sk__card--configured': providerConfigured(pid) }"
        >
          <header class="sk__card-head" :style="{ '--card-accent': BYOK_PROVIDER_META[pid].color }">
            <div class="sk__card-logo">{{ BYOK_PROVIDER_META[pid].logo }}</div>
            <div class="sk__card-title">
              <h3>{{ BYOK_PROVIDER_META[pid].name }}</h3>
              <p>{{ BYOK_PROVIDER_META[pid].description }}</p>
            </div>
            <span
              class="sk__card-status"
              :class="{ 'sk__card-status--on': providerConfigured(pid) }"
            >
              {{ providerConfigured(pid) ? '● 已配置' : '○ 未配置' }}
            </span>
          </header>

          <!-- 已配置的 key 列表 -->
          <ul v-if="keysByProvider(pid).length > 0" class="sk__key-list">
            <li v-for="k in keysByProvider(pid)" :key="k.id" class="sk__key-item">
              <div class="sk__key-info">
                <p class="sk__key-name-row">
                  <span class="sk__key-nickname">{{ k.nickname }}</span>
                  <span v-if="k.isDefault === 1" class="sk__badge sk__badge--default">默认</span>
                </p>
                <p class="sk__key-meta">
                  {{ BYOK_PROVIDER_META[pid].prefix }}***·末4位
                  <span class="sk__key-test" :style="{ color: testStatusColor(k.lastTestStatus) }">
                    {{ testStatusText(k.lastTestStatus) }}
                  </span>
                  <span v-if="k.lastTestAt" class="sk__key-testtime">
                    · {{ formatDateTime(k.lastTestAt) }}
                  </span>
                </p>
              </div>
              <div class="sk__key-ops">
                <button
                  type="button"
                  class="sk__mini-btn"
                  :disabled="testingId === k.id"
                  @click="testKey(k)"
                >
                  {{ testingId === k.id ? '…' : '🔧 测试' }}
                </button>
                <button
                  v-if="k.isDefault !== 1"
                  type="button"
                  class="sk__mini-btn"
                  @click="setDefault(k)"
                >
                  ⭐ 默认
                </button>
                <button
                  type="button"
                  class="sk__mini-btn sk__mini-btn--danger"
                  @click="removeKey(k)"
                >
                  🗑
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="sk__card-empty">还没添加 Key</p>

          <button
            type="button"
            class="sk__btn sk__btn--primary sk__btn--full"
            @click="openAddModal(pid)"
          >
            ➕ 添加 {{ BYOK_PROVIDER_META[pid].name }} Key
          </button>
        </article>
      </section>
    </div>

    <!-- ===== 弹窗: 添加/编辑 Key ===== -->
    <div v-if="modalOpen" class="sk__mask" @click.self="closeModal">
      <div class="sk__modal" role="dialog" aria-label="添加 API Key">
        <header class="sk__modal-head">
          <h3>{{ modalMode === 'add' ? '添加 API Key' : '编辑 Key (不能改 Key 值本身)' }}</h3>
          <button type="button" class="sk__modal-close" aria-label="关闭" @click="closeModal">×</button>
        </header>

        <div class="sk__modal-body">
          <p v-if="modalMode === 'edit'" class="sk__modal-warn">
            ⚠ Key 值无法直接修改 (AES-256-GCM 加密存), 如需更换请删除后重新添加。
          </p>

          <label class="sk__field">
            <span>Provider</span>
            <select v-model="modalProvider" :disabled="modalSubmitting || modalMode === 'edit'">
              <option v-for="pid in BYOK_PROVIDER_IDS" :key="pid" :value="pid">
                {{ BYOK_PROVIDER_META[pid].logo }} {{ BYOK_PROVIDER_META[pid].name }}
              </option>
            </select>
          </label>

          <label v-if="modalMode === 'add'" class="sk__field">
            <span>
              API Key · 以 <code>{{ currentMeta.prefix || '(无固定前缀)' }}</code> 开头
            </span>
            <input
              v-model="modalApiKey"
              type="password"
              :placeholder="currentMeta.placeholder"
              autocomplete="off"
              :disabled="modalSubmitting"
            />
          </label>

          <label class="sk__field">
            <span>Base URL (可选, OpenAI 兼容代理)</span>
            <input
              v-model="modalBaseUrl"
              type="url"
              :placeholder="currentMeta.defaultBaseUrl"
              :disabled="modalSubmitting"
            />
            <p class="sk__field-hint">默认: {{ currentMeta.defaultBaseUrl }}</p>
          </label>

          <label class="sk__field">
            <span>昵称 (必填, 用来区分多个 Key)</span>
            <input
              v-model="modalNickname"
              type="text"
              placeholder="如: 主力 GPT-4o / 备用 DeepSeek"
              maxlength="100"
              :disabled="modalSubmitting"
            />
          </label>

          <label class="sk__check">
            <input
              v-model="modalIsDefault"
              type="checkbox"
              :disabled="modalSubmitting"
            />
            <span>设为该 Provider 的默认 Key</span>
          </label>

          <div v-if="modalErr" class="sk__toast sk__toast--err">⚠ {{ modalErr }}</div>
        </div>

        <footer class="sk__modal-foot">
          <button type="button" class="sk__btn" :disabled="modalSubmitting" @click="closeModal">取消</button>
          <button
            type="button"
            class="sk__btn sk__btn--primary"
            :disabled="modalSubmitting"
            @click="submitModal"
          >
            {{ modalSubmitting ? '保存中…' : (modalMode === 'add' ? '保存并加密' : '更新') }}
          </button>
        </footer>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* ====== 基础布局 (与 ApiKeysView/SettingsView 一致) ====== */
.sk { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.sk__nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
}
.sk__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.sk__logo {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white; font-weight: 800;
}
.sk__nav-links { display: flex; gap: 4px; flex: 1; margin-left: 20px; flex-wrap: wrap; }
.sk__nav-link {
  padding: 6px 14px; font-size: 13px; color: var(--text-secondary);
  border-radius: 6px; text-decoration: none; transition: all 180ms;
}
.sk__nav-link:hover { color: var(--text-primary); background: var(--bg-secondary); }
.sk__nav-link.router-link-active { color: white; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); }

.sk__content { max-width: 1200px; margin: 0 auto; padding: 32px 28px 60px; display: flex; flex-direction: column; gap: 20px; }

/* ====== 功能顶部 bar ====== */
.sk__feature-bar { background: linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 80%, var(--accent) 20%) 0%, var(--bg-secondary) 100%); }
.sk__feature-row {
  display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
  margin-top: 12px;
}
.sk__arrow { color: var(--text-secondary); font-size: 18px; padding-bottom: 8px; }
.sk__key-name {
  display: inline-block; padding: 6px 12px; background: var(--bg-primary);
  border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-weight: 600;
  min-width: 140px;
}
.sk__empty-key { color: var(--text-secondary); font-weight: 400; }
.sk__btn--text { background: none; border: none; color: var(--text-secondary); font-size: 12px; }
.sk__btn--text:hover { color: var(--text-primary); }

/* ====== 头部 + 错误 ====== */
.sk__head { position: relative; }
.sk__title { font-size: 22px; font-weight: 800; margin: 0; }
.sk__sub { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; line-height: 1.6; }
.sk__toast--err { padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; border: 1px solid #ef4444; margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; }
.sk__toast-close { background: none; border: none; cursor: pointer; color: inherit; font-size: 18px; padding: 0 4px; }

/* ====== 加载 ====== */
.sk__loading { padding: 60px; text-align: center; color: var(--text-secondary); font-size: 14px; }

/* ====== 6 provider 卡片 grid ====== */
.sk__grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
@media (max-width: 1024px) { .sk__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .sk__grid { grid-template-columns: 1fr; } }

.sk__card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex; flex-direction: column; gap: 12px;
  transition: border-color 200ms;
}
.sk__card--configured { border-color: var(--card-accent, var(--accent)); }
.sk__card-head {
  display: flex; align-items: flex-start; gap: 10px;
  border-bottom: 1px solid var(--border); padding-bottom: 10px;
}
.sk__card-logo {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--card-accent, var(--accent)) 20%, transparent);
  font-size: 18px; flex-shrink: 0;
}
.sk__card-title { flex: 1; min-width: 0; }
.sk__card-title h3 { font-size: 14px; font-weight: 700; margin: 0; }
.sk__card-title p { font-size: 11px; color: var(--text-secondary); margin: 4px 0 0; line-height: 1.5; }
.sk__card-status {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--border); color: var(--text-secondary); font-weight: 600;
  flex-shrink: 0;
}
.sk__card-status--on { background: color-mix(in srgb, #10b981 20%, transparent); color: #10b981; }

/* key 列表 */
.sk__key-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.sk__key-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-primary); font-size: 12px;
}
.sk__key-info { flex: 1; min-width: 0; }
.sk__key-name-row { margin: 0; display: flex; align-items: center; gap: 6px; }
.sk__key-nickname { font-weight: 700; font-size: 13px; }
.sk__badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.sk__badge--default { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; }
.sk__key-meta { font-size: 10px; color: var(--text-secondary); margin: 4px 0 0; }
.sk__key-test { font-weight: 600; margin-left: 6px; }
.sk__key-testtime { margin-left: 4px; }
.sk__key-ops { display: flex; gap: 4px; flex-shrink: 0; }
.sk__mini-btn {
  height: 24px; padding: 0 6px; font-size: 10px; font-weight: 600;
  border: 1px solid var(--border); border-radius: 4px;
  background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer;
}
.sk__mini-btn:hover { background: var(--bg-primary); }
.sk__mini-btn--danger { color: #ef4444; border-color: color-mix(in srgb, #ef4444 60%, transparent); }
.sk__mini-btn--danger:hover { background: #ef4444; color: white; }
.sk__mini-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.sk__card-empty { font-size: 11px; color: var(--text-secondary); padding: 8px 0; margin: 0; font-style: italic; }

/* ====== 通用 button ====== */
.sk__btn {
  height: 32px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);
  cursor: pointer; font-size: 12px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 4px;
  text-decoration: none;
}
.sk__btn--primary { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; }
.sk__btn--full { width: 100%; justify-content: center; }
.sk__btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ====== Panel ====== */
.sk__panel { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; }
.sk__panel-title { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
.sk__panel-sub { font-size: 11px; color: var(--text-secondary); margin: 0; line-height: 1.6; }

/* ====== 表单 field ====== */
.sk__field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.sk__field--inline { flex-direction: row; align-items: center; gap: 8px; }
.sk__field--inline span { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
.sk__field span { font-size: 11px; color: var(--text-secondary); }
.sk__field span code { font-size: 11px; padding: 1px 5px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 3px; }
.sk__field input, .sk__field select {
  height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-primary); color: var(--text-primary); font-size: 13px; font-family: inherit;
}
.sk__field-hint { font-size: 10px; color: var(--text-secondary); margin: 4px 0 0; font-family: monospace; }
.sk__check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 12px; }
.sk__check input { width: 16px; height: 16px; cursor: pointer; }

/* ====== 弹窗 ====== */
.sk__mask { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sk__modal { background: var(--bg-primary); border-radius: 12px; width: 100%; max-width: 480px; display: flex; flex-direction: column; }
.sk__modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.sk__modal-head h3 { font-size: 15px; font-weight: 700; margin: 0; }
.sk__modal-close { background: none; border: none; font-size: 24px; line-height: 1; cursor: pointer; color: var(--text-secondary); padding: 0 4px; }
.sk__modal-close:hover { color: var(--text-primary); }
.sk__modal-body { padding: 16px 20px; max-height: 60vh; overflow-y: auto; }
.sk__modal-warn { font-size: 11px; color: #f59e0b; background: color-mix(in srgb, #f59e0b 12%, transparent); padding: 6px 10px; border-radius: 4px; margin: 0 0 12px; border: 1px solid color-mix(in srgb, #f59e0b 60%, transparent); }
.sk__modal-foot { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }
</style>
