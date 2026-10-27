<script setup lang="ts">
/**
 * LoginView · 登录/注册页（直接访问模式）
 * 千机工坊 · W1 交付
 *
 * 当用户通过 URL 直接访问 /login 时（如 auth guard 重定向），
 * 显示居中卡片 + 全屏深色背景，与 LoginModal 保持一致的视觉风格。
 *
 * 支持两种登录方式：
 * 1. 手机验证码（中国大陆 11 位手机号 + 6 位短信码 + 60s 倒计时）
 * 2. 邮箱密码（标准邮箱格式 + 至少 8 位密码）
 *
 * 注册模式：邮箱 + 密码 + 昵称
 */

import { ref, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

type Tab = 'phone' | 'email'
type Mode = 'login' | 'register'

const router = useRouter()
const route = useRoute()

const mode = ref<Mode>('login')
const tab = ref<Tab>('phone')
const submitting = ref(false)
const errorMsg = ref('')

/** Simple toast */
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}

// ===== Tab 1: 手机验证码 =====
const phone = ref('')
const phoneCode = ref('')
const phoneAgree = ref(false)
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

async function startCountdown() {
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
  // 调用真实短信 API
  try {
    const r = await fetch('/api/v1/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.value })
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      errorMsg.value = err.message || '验证码发送失败'
      countdown.value = 0
      return
    }
  } catch {
    errorMsg.value = '验证码发送失败，请重试'
    countdown.value = 0
    return
  }
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
    const r = await fetch('/api/v1/auth/login-with-code', {
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
    const returnUrl = (route.query.return as string) || '/dashboard'
    router.push(returnUrl.startsWith('/') ? returnUrl : '/dashboard')
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
    const returnUrl = (route.query.return as string) || '/dashboard'
    router.push(returnUrl.startsWith('/') ? returnUrl : '/dashboard')
  } catch (err) {
    errorMsg.value = '登录失败，请重试'
  } finally {
    submitting.value = false
  }
}

// ===== 注册模式 =====
const regEmail = ref('')
const regPassword = ref('')
const regConfirm = ref('')
const regDisplayName = ref('')
const regShowPwd = ref(false)
const regAgree = ref(false)

const regEmailValid = computed(() => /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(regEmail.value))
const regPwdValid = computed(() => regPassword.value.length >= 8)
const regConfirmMatch = computed(() => regPassword.value === regConfirm.value)

async function onRegister() {
  errorMsg.value = ''
  if (!regEmailValid.value) {
    errorMsg.value = '请输入正确的邮箱'
    return
  }
  if (!regPwdValid.value) {
    errorMsg.value = '密码至少 8 位'
    return
  }
  if (!regConfirmMatch.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }
  if (!regAgree.value) {
    errorMsg.value = '请先同意服务条款'
    return
  }
  submitting.value = true
  try {
    const displayName = regDisplayName.value.trim() || regEmail.value.split('@')[0]
    const r = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail.value,
        password: regPassword.value,
        display_name: displayName
      })
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      if (r.status === 409) {
        errorMsg.value = '该邮箱已被注册'
      } else {
        errorMsg.value = err.message || `注册失败 (${r.status})`
      }
      return
    }
    const data = await r.json()
    const { token, user: newUser } = data.data
    // 兼容两种返回格式: { token } 或 { access_token }
    const accessToken = token || data.data.access_token
    localStorage.setItem('token', accessToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    localStorage.setItem('mhw.access_token', accessToken)
    localStorage.setItem('mhw.user', JSON.stringify(newUser))
    const returnUrl = (route.query.return as string) || '/dashboard'
    router.push(returnUrl.startsWith('/') ? returnUrl : '/dashboard')
  } catch (err) {
    errorMsg.value = '注册失败，请重试'
  } finally {
    submitting.value = false
  }
}

function switchTab(t: Tab) {
  tab.value = t
  errorMsg.value = ''
}

function switchMode(m: Mode) {
  mode.value = m
  errorMsg.value = ''
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <main class="login-page">
    <!-- Back to home link -->
    <RouterLink to="/" class="login-page__back">← 返回首页</RouterLink>

    <!-- Login/Register card -->
    <div class="login-page__card">
      <!-- Brand -->
      <div class="login-page__brand">
        <span class="login-page__logo">千</span>
        <h1 class="login-page__title">{{ mode === 'register' ? '创建新账号' : '登录你的账号' }}</h1>
        <p class="login-page__subtitle">千机工坊 · AI 漫剧创作平台</p>
      </div>

      <!-- ========== 登录模式 ========== -->
      <template v-if="mode === 'login'">
        <!-- Tab switcher -->
        <div class="login-page__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'phone'"
            :class="{ active: tab === 'phone' }"
            @click="switchTab('phone')"
          >
            手机验证码
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'email'"
            :class="{ active: tab === 'email' }"
            @click="switchTab('email')"
          >
            邮箱密码
          </button>
        </div>

        <!-- Error message -->
        <div v-if="errorMsg" class="login-page__error" role="alert">
          {{ errorMsg }}
        </div>

        <!-- Tab 1: Phone + verification code -->
        <form v-if="tab === 'phone'" class="login-page__form" @submit.prevent="onPhoneLogin">
          <label class="login-page__field">
            <span class="login-page__label">手机号</span>
            <input
              v-model="phone"
              type="tel"
              maxlength="11"
              placeholder="请输入 11 位手机号"
              class="login-page__input"
              autocomplete="tel"
            />
          </label>

          <label class="login-page__field">
            <span class="login-page__label">验证码</span>
            <div class="login-page__code-row">
              <input
                v-model="phoneCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="6 位短信验证码"
                class="login-page__input login-page__input--code"
                autocomplete="one-time-code"
              />
              <button
                type="button"
                class="login-page__code-btn"
                :disabled="countdown > 0 || !phoneValid"
                @click="startCountdown"
              >
                {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
              </button>
            </div>
          </label>

          <label class="login-page__agree">
            <input v-model="phoneAgree" type="checkbox" />
            <span>我已阅读并同意 <a href="#" @click.prevent="showToast('服务条款页面即将上线')">《服务条款》</a> 与 <a href="#" @click.prevent="showToast('隐私政策页面即将上线')">《隐私政策》</a></span>
          </label>

          <button type="submit" class="login-page__submit" :disabled="submitting">
            {{ submitting ? '登录中...' : '登录' }}
          </button>
        </form>

        <!-- Tab 2: Email + password -->
        <form v-else class="login-page__form" @submit.prevent="onEmailLogin">
          <label class="login-page__field">
            <span class="login-page__label">邮箱</span>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="login-page__input"
              autocomplete="email"
            />
          </label>

          <label class="login-page__field">
            <span class="login-page__label">密码</span>
            <div class="login-page__pwd-row">
              <input
                v-model="password"
                :type="showPwd ? 'text' : 'password'"
                placeholder="至少 8 位"
                class="login-page__input"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="login-page__pwd-toggle"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                @click="showPwd = !showPwd"
              >
                {{ showPwd ? '🙈' : '👁' }}
              </button>
            </div>
          </label>

          <div class="login-page__extras">
            <label class="login-page__remember">
              <input type="checkbox" />
              <span>记住我</span>
            </label>
            <a href="#" class="login-page__forgot" @click.prevent="showToast('忘记密码功能即将上线')">忘记密码？</a>
          </div>

          <button type="submit" class="login-page__submit" :disabled="submitting">
            {{ submitting ? '登录中...' : '登录' }}
          </button>
        </form>

        <!-- Footer: switch to register -->
        <div class="login-page__footer">
          <span>还没有账号？</span>
          <a href="#" class="login-page__register" @click.prevent="switchMode('register')">立即注册</a>
        </div>
      </template>

      <!-- ========== 注册模式 ========== -->
      <template v-else>
        <!-- Error message -->
        <div v-if="errorMsg" class="login-page__error" role="alert">
          {{ errorMsg }}
        </div>

        <form class="login-page__form" @submit.prevent="onRegister">
          <label class="login-page__field">
            <span class="login-page__label">邮箱</span>
            <input
              v-model="regEmail"
              type="email"
              placeholder="your@email.com"
              class="login-page__input"
              autocomplete="email"
            />
          </label>

          <label class="login-page__field">
            <span class="login-page__label">昵称 <span style="color:rgba(255,255,255,0.3)">(选填)</span></span>
            <input
              v-model="regDisplayName"
              type="text"
              maxlength="50"
              placeholder="给自己起个名字"
              class="login-page__input"
              autocomplete="name"
            />
          </label>

          <label class="login-page__field">
            <span class="login-page__label">密码</span>
            <div class="login-page__pwd-row">
              <input
                v-model="regPassword"
                :type="regShowPwd ? 'text' : 'password'"
                placeholder="至少 8 位"
                class="login-page__input"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="login-page__pwd-toggle"
                :aria-label="regShowPwd ? '隐藏密码' : '显示密码'"
                @click="regShowPwd = !regShowPwd"
              >
                {{ regShowPwd ? '🙈' : '👁' }}
              </button>
            </div>
          </label>

          <label class="login-page__field">
            <span class="login-page__label">确认密码</span>
            <input
              v-model="regConfirm"
              type="password"
              placeholder="再输入一次密码"
              class="login-page__input"
              autocomplete="new-password"
            />
          </label>

          <label class="login-page__agree">
            <input v-model="regAgree" type="checkbox" />
            <span>我已阅读并同意 <a href="#" @click.prevent="showToast('服务条款页面即将上线')">《服务条款》</a> 与 <a href="#" @click.prevent="showToast('隐私政策页面即将上线')">《隐私政策》</a></span>
          </label>

          <button type="submit" class="login-page__submit" :disabled="submitting">
            {{ submitting ? '注册中...' : '注册' }}
          </button>
        </form>

        <!-- Footer: switch to login -->
        <div class="login-page__footer">
          <span>已有账号？</span>
          <a href="#" class="login-page__register" @click.prevent="switchMode('login')">立即登录</a>
        </div>
      </template>
    </div>

    <!-- Help -->
    <p class="login-page__help">
      遇到问题？<a href="mailto:support@manhuaworks.com">联系客服</a>
    </p>

    <!-- Toast notification -->
    <Transition name="toast-fade">
      <div v-if="toastMsg" class="login-toast">{{ toastMsg }}</div>
    </Transition>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  color: #E4E6EB;
  position: relative;
  z-index: 1;
}

.login-page__back {
  position: absolute;
  top: 20px;
  left: 24px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.login-page__back:hover {
  color: #00BFA5;
}

.login-page__card {
  width: 100%;
  max-width: 420px;
  background: #1A1C21;
  border: 1px solid #2E3139;
  border-radius: 16px;
  padding: 36px 32px 28px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.login-page__brand {
  text-align: center;
  margin-bottom: 24px;
}

.login-page__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: white;
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 12px;
}

.login-page__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #E4E6EB;
}

.login-page__subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

.login-page__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #2E3139;
  border-radius: 10px;
  margin-bottom: 20px;
}

.login-page__tabs button {
  padding: 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.login-page__tabs button:hover {
  color: rgba(255, 255, 255, 0.8);
}

.login-page__tabs button.active {
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 191, 165, 0.25);
}

.login-page__error {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  margin-bottom: 16px;
}

.login-page__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-page__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-page__label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.02em;
}

.login-page__input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #2E3139;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #E4E6EB;
  font-family: inherit;
  font-size: 14px;
  transition: all 200ms;
  box-sizing: border-box;
}

.login-page__input:focus {
  outline: none;
  border-color: #00BFA5;
  box-shadow: 0 0 0 3px rgba(0, 191, 165, 0.12);
}

.login-page__input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.login-page__code-row,
.login-page__pwd-row {
  display: flex;
  gap: 8px;
}

.login-page__input--code {
  flex: 1;
}

.login-page__code-btn {
  flex-shrink: 0;
  padding: 0 14px;
  border: 1px solid #2E3139;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #00BFA5;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
  white-space: nowrap;
}

.login-page__code-btn:disabled {
  color: rgba(255, 255, 255, 0.35);
  cursor: not-allowed;
  opacity: 0.6;
}

.login-page__code-btn:not(:disabled):hover {
  background: rgba(0, 191, 165, 0.08);
  border-color: rgba(0, 191, 165, 0.3);
}

.login-page__pwd-toggle {
  flex-shrink: 0;
  padding: 0 12px;
  border: 1px solid #2E3139;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms;
  color: rgba(255, 255, 255, 0.5);
}

.login-page__pwd-toggle:hover {
  background: rgba(0, 191, 165, 0.08);
}

.login-page__agree,
.login-page__remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.login-page__agree a,
.login-page__remember a {
  color: #00BFA5;
  text-decoration: none;
}

.login-page__agree a:hover,
.login-page__remember a:hover {
  text-decoration: underline;
}

.login-page__agree input[type="checkbox"],
.login-page__remember input[type="checkbox"] {
  accent-color: #00BFA5;
  cursor: pointer;
}

.login-page__extras {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.login-page__forgot {
  color: #00BFA5;
  text-decoration: none;
  font-size: 12px;
}

.login-page__forgot:hover {
  text-decoration: underline;
}

.login-page__submit {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 300ms;
  margin-top: 8px;
  letter-spacing: 0.02em;
}

.login-page__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 30px rgba(0, 191, 165, 0.3), 0 4px 12px rgba(124, 58, 237, 0.2);
}

.login-page__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-page__footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.login-page__register {
  color: #00BFA5;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.login-page__register:hover {
  text-decoration: underline;
}

.login-page__help {
  margin-top: 24px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

.login-page__help a {
  color: #00BFA5;
  text-decoration: none;
}

.login-page__help a:hover {
  text-decoration: underline;
}

/* ===== Toast notification ===== */
.login-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 10px;
  background: rgba(0, 191, 165, 0.92);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  pointer-events: none;
}

.toast-fade-enter-active {
  transition: all 0.3s ease;
}

.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
