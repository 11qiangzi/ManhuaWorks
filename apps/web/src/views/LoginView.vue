<script setup lang="ts">
/**
 * LoginView · 登录页
 * ManhuaWorks · W1 交付
 *
 * 支持两种登录方式：
 * 1. 手机验证码（中国大陆 11 位手机号 + 6 位短信码 + 60s 倒计时）
 * 2. 邮箱密码（标准邮箱格式 + 至少 8 位密码）
 *
 * 真实接口留给 W2，本期用 mock 演示流程。
 */

import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'

type Tab = 'phone' | 'email'

const router = useRouter()
const { currentMeta } = useTheme()

const tab = ref<Tab>('phone')
const submitting = ref(false)
const errorMsg = ref('')

// ===== Tab 1: 手机验证码 =====
const phone = ref('')
const phoneCode = ref('')
const phoneAgree = ref(false)
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

function startCountdown() {
  if (!phoneValid.value) {
    errorMsg.value = '请输入正确的手机号'
    return
  }
  if (!phoneAgree.value) {
    errorMsg.value = '请先同意服务条款'
    return
  }
  errorMsg.value = ''
  countdown.value = 60
  // mock：真实环境调 /api/auth/send-sms
  console.log('[mock] 发送验证码到', phone.value)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function onPhoneLogin() {
  errorMsg.value = ''
  if (!phoneValid.value) {
    errorMsg.value = '请输入正确的手机号'
    return
  }
  if (!/^\d{6}$/.test(phoneCode.value)) {
    errorMsg.value = '请输入 6 位验证码'
    return
  }
  submitting.value = true
  try {
    // Real API: POST /api/v1/auth/login with {phone, code}
    const r = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.value, code: phoneCode.value })
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      errorMsg.value = err.message || `登录失败 (${r.status})`
      return
    }
    const data = await r.json()
    const { access_token, user: loginUser } = data.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(loginUser))
    localStorage.setItem('mhw.access_token', access_token)
    localStorage.setItem('mhw.user', JSON.stringify(loginUser))
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = '登录失败，请重试'
  } finally {
    submitting.value = false
  }
}

// ===== Tab 2: 邮箱密码 =====
const email = ref('')
const password = ref('')
const showPwd = ref(false)

const emailValid = computed(() => /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email.value))
const pwdValid = computed(() => password.value.length >= 8)

async function onEmailLogin() {
  errorMsg.value = ''
  if (!emailValid.value) {
    errorMsg.value = '请输入正确的邮箱'
    return
  }
  if (!pwdValid.value) {
    errorMsg.value = '密码至少 8 位'
    return
  }
  submitting.value = true
  try {
    const r = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      errorMsg.value = err.message || `登录失败 (${r.status})`
      return
    }
    const data = await r.json()
    const { access_token, user } = data.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('mhw.access_token', access_token)
    localStorage.setItem('mhw.user', JSON.stringify(user))
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = '登录失败，请重试'
    alert('登录失败，请重试')
  } finally {
    submitting.value = false
  }
}

function switchTab(t: Tab) {
  tab.value = t
  errorMsg.value = ''
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <main class="login">
    <!-- 顶部返回 -->
    <header class="login__nav">
      <RouterLink to="/" class="login__back">← 返回首页</RouterLink>
      <span class="login__theme-tip">主题：{{ currentMeta.label }}</span>
    </header>

    <!-- 登录卡片 -->
    <div class="login__card">
      <div class="login__brand">
        <span class="login__logo">M</span>
        <h1 class="login__title">登录 ManhuaWorks</h1>
        <p class="login__subtitle">开启您的漫改创作之旅</p>
      </div>

      <!-- Tab 切换 -->
      <div class="login__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'phone'"
          :class="{ active: tab === 'phone' }"
          @click="switchTab('phone')"
        >
          📱 手机验证码
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'email'"
          :class="{ active: tab === 'email' }"
          @click="switchTab('email')"
        >
          ✉️ 邮箱密码
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="login__error" role="alert">
        ⚠ {{ errorMsg }}
      </div>

      <!-- Tab 1: 手机验证码 -->
      <form v-if="tab === 'phone'" class="login__form" @submit.prevent="onPhoneLogin">
        <label class="login__field">
          <span class="login__label">手机号</span>
          <input
            v-model="phone"
            type="tel"
            maxlength="11"
            placeholder="请输入 11 位手机号"
            class="login__input"
            autocomplete="tel"
          />
        </label>

        <label class="login__field">
          <span class="login__label">验证码</span>
          <div class="login__code-row">
            <input
              v-model="phoneCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="6 位短信验证码"
              class="login__input login__input--code"
              autocomplete="one-time-code"
            />
            <button
              type="button"
              class="login__code-btn"
              :disabled="countdown > 0 || !phoneValid"
              @click="startCountdown"
            >
              {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
            </button>
          </div>
        </label>

        <label class="login__agree">
          <input v-model="phoneAgree" type="checkbox" />
          <span>我已阅读并同意 <a href="#">《服务条款》</a> 与 <a href="#">《隐私政策》</a></span>
        </label>

        <button type="submit" class="login__submit" :disabled="submitting">
          {{ submitting ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- Tab 2: 邮箱密码 -->
      <form v-else class="login__form" @submit.prevent="onEmailLogin">
        <label class="login__field">
          <span class="login__label">邮箱</span>
          <input
            v-model="email"
            type="email"
            placeholder="your@email.com"
            class="login__input"
            autocomplete="email"
          />
        </label>

        <label class="login__field">
          <span class="login__label">密码</span>
          <div class="login__pwd-row">
            <input
              v-model="password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="至少 8 位"
              class="login__input"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="login__pwd-toggle"
              :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              @click="showPwd = !showPwd"
            >
              {{ showPwd ? '🙈' : '👁' }}
            </button>
          </div>
        </label>

        <div class="login__extras">
          <label class="login__remember">
            <input type="checkbox" />
            <span>记住我</span>
          </label>
          <a href="#" class="login__forgot">忘记密码？</a>
        </div>

        <button type="submit" class="login__submit" :disabled="submitting">
          {{ submitting ? '登录中...' : '登录' }}
        </button>
      </form>

    </div>

    <!-- 帮助 -->
    <p class="login__help">
      遇到问题？<a href="mailto:support@manhuaworks.com">联系客服</a>
    </p>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  background: var(--bg-primary);
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.login__nav {
  width: 100%;
  max-width: 440px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 14px;
}

.login__back {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 200ms;
}

.login__back:hover {
  color: var(--accent);
}

.login__theme-tip {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.login__card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  box-shadow: var(--shadow);
}

.login__brand {
  text-align: center;
  margin-bottom: 28px;
}

.login__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--gradient);
  color: white;
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 12px;
}

.login__title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
}

.login__subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.login__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 20px;
}

.login__tabs button {
  padding: 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.login__tabs button.active {
  background: var(--accent);
  color: var(--bg-primary);
  box-shadow: var(--shadow);
}

.login__error {
  padding: 10px 14px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  border-radius: 8px;
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 16px;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.login__input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  transition: all 200ms;
  box-sizing: border-box;
}

.login__input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--glow);
}

.login__code-row,
.login__pwd-row {
  display: flex;
  gap: 8px;
}

.login__input--code {
  flex: 1;
}

.login__code-btn {
  flex-shrink: 0;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
  white-space: nowrap;
}

.login__code-btn:disabled {
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.login__code-btn:not(:disabled):hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.login__pwd-toggle {
  flex-shrink: 0;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms;
}

.login__pwd-toggle:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.login__agree,
.login__remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.login__agree a,
.login__remember a {
  color: var(--accent);
  text-decoration: none;
}

.login__agree input[type="checkbox"],
.login__remember input[type="checkbox"] {
  width: 44px;
  height: 44px;
  margin: 0;
  cursor: pointer;
}

.login__extras {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.login__forgot {
  color: var(--accent);
  text-decoration: none;
}

.login__submit {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 300ms;
  margin-top: 8px;
}

.login__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow), var(--glow);
}

.login__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login__footer {
  text-align: center;
  font-size: 11px;
  color: var(--text-secondary);
  margin: 20px 0 0;
  opacity: 0.7;
}

.login__footer a {
  color: var(--accent);
  text-decoration: none;
}

.login__help {
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-secondary);
}

.login__help a {
  color: var(--accent);
  text-decoration: none;
}
</style>
