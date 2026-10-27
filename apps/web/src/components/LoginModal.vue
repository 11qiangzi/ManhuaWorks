<script setup lang="ts">
/**
 * LoginModal.vue · 登录弹窗
 * 千机工坊 · 统一登录模态框
 *
 * 支持两种登录方式：
 * 1. 手机验证码（中国大陆 11 位手机号 + 6 位短信码 + 60s 倒计时）
 * 2. 邮箱密码（标准邮箱格式 + 至少 8 位密码）
 *
 * 用法：<LoginModal v-model="showLogin" />
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

type Tab = 'phone' | 'email'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>()

const router = useRouter()

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
  // 发送短信验证码
  try {
    const res = await fetch('/api/v1/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.value })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.message || '验证码发送失败'
      countdown.value = 0
      return
    }
  } catch {
    errorMsg.value = '网络异常，请稍后重试'
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
    close()
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
    close()
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = '登录失败，请重试'
  } finally {
    submitting.value = false
  }
}

function switchTab(t: Tab) {
  tab.value = t
  errorMsg.value = ''
}

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('login-modal__backdrop')) {
    close()
  }
}

// Reset form state when modal opens
watch(() => props.modelValue, (val) => {
  if (val) {
    errorMsg.value = ''
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="login-modal">
      <div
        v-if="modelValue"
        class="login-modal__backdrop"
        @click="onBackdropClick"
        @wheel.stop
      >
        <div class="login-modal__card">
          <!-- Close button -->
          <button
            type="button"
            class="login-modal__close"
            aria-label="关闭"
            @click="close"
          >
            ✕
          </button>

          <!-- Brand -->
          <div class="login-modal__brand">
            <span class="login-modal__logo">千</span>
            <h1 class="login-modal__title">登录你的账号</h1>
            <p class="login-modal__subtitle">千机工坊 · AI 漫剧创作平台</p>
          </div>

          <!-- Tab switcher -->
          <div class="login-modal__tabs" role="tablist">
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
          <div v-if="errorMsg" class="login-modal__error" role="alert">
            {{ errorMsg }}
          </div>

          <!-- Tab 1: Phone + verification code -->
          <form v-if="tab === 'phone'" class="login-modal__form" @submit.prevent="onPhoneLogin">
            <label class="login-modal__field">
              <span class="login-modal__label">手机号</span>
              <input
                v-model="phone"
                type="tel"
                maxlength="11"
                placeholder="请输入 11 位手机号"
                class="login-modal__input"
                autocomplete="tel"
              />
            </label>

            <label class="login-modal__field">
              <span class="login-modal__label">验证码</span>
              <div class="login-modal__code-row">
                <input
                  v-model="phoneCode"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="6 位短信验证码"
                  class="login-modal__input login-modal__input--code"
                  autocomplete="one-time-code"
                />
                <button
                  type="button"
                  class="login-modal__code-btn"
                  :disabled="countdown > 0 || !phoneValid"
                  @click="startCountdown"
                >
                  {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
                </button>
              </div>
            </label>

            <label class="login-modal__agree">
              <input v-model="phoneAgree" type="checkbox" />
              <span>我已阅读并同意 <a href="#" @click.prevent="showToast('服务条款页面即将上线')">《服务条款》</a> 与 <a href="#" @click.prevent="showToast('隐私政策页面即将上线')">《隐私政策》</a></span>
            </label>

            <button type="submit" class="login-modal__submit" :disabled="submitting">
              {{ submitting ? '登录中...' : '登录' }}
            </button>
          </form>

          <!-- Tab 2: Email + password -->
          <form v-else class="login-modal__form" @submit.prevent="onEmailLogin">
            <label class="login-modal__field">
              <span class="login-modal__label">邮箱</span>
              <input
                v-model="email"
                type="email"
                placeholder="your@email.com"
                class="login-modal__input"
                autocomplete="email"
              />
            </label>

            <label class="login-modal__field">
              <span class="login-modal__label">密码</span>
              <div class="login-modal__pwd-row">
                <input
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  placeholder="至少 8 位"
                  class="login-modal__input"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="login-modal__pwd-toggle"
                  :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                  @click="showPwd = !showPwd"
                >
                  {{ showPwd ? '🙈' : '👁' }}
                </button>
              </div>
            </label>

            <div class="login-modal__extras">
              <label class="login-modal__remember">
                <input type="checkbox" />
                <span>记住我</span>
              </label>
              <a href="#" class="login-modal__forgot" @click.prevent="showToast('忘记密码功能即将上线')">忘记密码？</a>
            </div>

            <button type="submit" class="login-modal__submit" :disabled="submitting">
              {{ submitting ? '登录中...' : '登录' }}
            </button>
          </form>

          <!-- Footer -->
          <div class="login-modal__footer">
            <span>还没有账号？</span>
            <a href="#" class="login-modal__register" @click.prevent="showToast('注册功能即将上线')">立即注册</a>
          </div>

        </div>
      </div>
    </Transition>

    <!-- Toast notification -->
    <Transition name="toast-fade">
      <div v-if="toastMsg" class="login-modal-toast">{{ toastMsg }}</div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== Backdrop ===== */
.login-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  padding: 20px;
  overflow: hidden;
  overscroll-behavior: contain;
}

/* ===== Card ===== */
.login-modal__card {
  width: 100%;
  max-width: 420px;
  background: #1A1C21;
  border: 1px solid #2E3139;
  border-radius: 16px;
  padding: 36px 32px 28px;
  position: relative;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* ===== Close button ===== */
.login-modal__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
  font-family: inherit;
}

.login-modal__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

/* ===== Brand ===== */
.login-modal__brand {
  text-align: center;
  margin-bottom: 24px;
}

.login-modal__logo {
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

.login-modal__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #E4E6EB;
}

.login-modal__subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

/* ===== Tabs ===== */
.login-modal__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #2E3139;
  border-radius: 10px;
  margin-bottom: 20px;
}

.login-modal__tabs button {
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

.login-modal__tabs button:hover {
  color: rgba(255, 255, 255, 0.8);
}

.login-modal__tabs button.active {
  background: linear-gradient(135deg, #00BFA5, #7C3AED);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 191, 165, 0.25);
}

/* ===== Error ===== */
.login-modal__error {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  margin-bottom: 16px;
}

/* ===== Form ===== */
.login-modal__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-modal__label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.02em;
}

.login-modal__input {
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

.login-modal__input:focus {
  outline: none;
  border-color: #00BFA5;
  box-shadow: 0 0 0 3px rgba(0, 191, 165, 0.12);
}

.login-modal__input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.login-modal__code-row,
.login-modal__pwd-row {
  display: flex;
  gap: 8px;
}

.login-modal__input--code {
  flex: 1;
}

.login-modal__code-btn {
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

.login-modal__code-btn:disabled {
  color: rgba(255, 255, 255, 0.35);
  cursor: not-allowed;
  opacity: 0.6;
}

.login-modal__code-btn:not(:disabled):hover {
  background: rgba(0, 191, 165, 0.08);
  border-color: rgba(0, 191, 165, 0.3);
}

.login-modal__pwd-toggle {
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

.login-modal__pwd-toggle:hover {
  background: rgba(0, 191, 165, 0.08);
}

/* ===== Agree / Remember ===== */
.login-modal__agree,
.login-modal__remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.login-modal__agree a,
.login-modal__remember a {
  color: #00BFA5;
  text-decoration: none;
}

.login-modal__agree a:hover,
.login-modal__remember a:hover {
  text-decoration: underline;
}

.login-modal__agree input[type="checkbox"],
.login-modal__remember input[type="checkbox"] {
  accent-color: #00BFA5;
  cursor: pointer;
}

.login-modal__extras {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.login-modal__forgot {
  color: #00BFA5;
  text-decoration: none;
  font-size: 12px;
}

.login-modal__forgot:hover {
  text-decoration: underline;
}

/* ===== Submit button ===== */
.login-modal__submit {
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

.login-modal__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 30px rgba(0, 191, 165, 0.3), 0 4px 12px rgba(124, 58, 237, 0.2);
}

.login-modal__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ===== Footer ===== */
.login-modal__footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.login-modal__register {
  color: #00BFA5;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.login-modal__register:hover {
  text-decoration: underline;
}

/* ===== Transition ===== */
.login-modal-enter-active {
  transition: opacity 250ms ease;
}

.login-modal-enter-active .login-modal__card {
  transition: opacity 250ms ease, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.login-modal-leave-active {
  transition: opacity 200ms ease;
}

.login-modal-leave-active .login-modal__card {
  transition: opacity 200ms ease, transform 200ms ease;
}

.login-modal-enter-from {
  opacity: 0;
}

.login-modal-enter-from .login-modal__card {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

.login-modal-leave-to {
  opacity: 0;
}

.login-modal-leave-to .login-modal__card {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}

/* ===== Toast notification ===== */
.login-modal-toast {
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
  z-index: 99999;
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
