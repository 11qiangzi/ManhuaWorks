<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">千机工坊</text>
      <text class="hero-sub">创作者工作台 · 登录</text>
    </view>

    <view class="card">
      <!-- 错误提示 -->
      <view v-if="authStore.error" class="alert">
        <text class="alert-text">⚠️ {{ authStore.error }}</text>
      </view>

      <!-- 邮箱 -->
      <view class="field">
        <text class="label">邮箱</text>
        <input
          v-model="form.email"
          class="input"
          type="text"
          placeholder="you@example.com"
          :maxlength="255"
          :disabled="authStore.loading"
          @input="clearError"
        />
      </view>

      <!-- 密码 -->
      <view class="field">
        <text class="label">密码</text>
        <input
          v-model="form.password"
          class="input"
          :password="!showPwd"
          placeholder="≥ 8 位"
          :maxlength="128"
          :disabled="authStore.loading"
          @input="clearError"
        />
        <view class="toggle" @tap="showPwd = !showPwd">
          <text class="toggle-text">{{ showPwd ? '隐藏' : '显示' }}</text>
        </view>
      </view>

      <!-- 登录 -->
      <view
        class="btn btn-primary"
        :class="{ disabled: authStore.loading }"
        @tap="onSubmit"
      >
        <text class="btn-text">{{ authStore.loading ? '登录中…' : '登录' }}</text>
      </view>

      <!-- 一键注册 -->
      <view
        class="btn btn-secondary"
        :class="{ disabled: authStore.loading }"
        @tap="onRegister"
      >
        <text class="btn-text">还没有账号？一键注册</text>
      </view>

      <!-- 提示 -->
      <text class="hint">
        注册与登录均调用 user-service:8088 的真实接口
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { register } from '../../api/client'

/**
 * 真实登录页
 * - 调 POST /api/v1/auth/login
 * - 一键注册: 调 POST /api/v1/auth/register (用邮箱本地部分做 display_name)
 * - 成功后: 跳到首页 pages/index/index
 */

const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: ''
})

const showPwd = ref<boolean>(false)

/* 邮箱校验 */
const isValidEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

function clearError(): void {
  if (authStore.error) authStore.error = null
}

function showToast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  // 微信小程序里换成 Taro.showToast
  // 此处浏览器/单测环境降级用 alert
  // eslint-disable-next-line no-alert
  alert(`${icon === 'error' ? '❌ ' : ''}${title}`)
}

async function onSubmit(): Promise<void> {
  // 1. 基础校验
  if (!form.email.trim()) {
    showToast('请输入邮箱', 'error')
    return
  }
  if (!isValidEmail(form.email.trim())) {
    showToast('邮箱格式不正确', 'error')
    return
  }
  if (!form.password || form.password.length < 1) {
    showToast('请输入密码', 'error')
    return
  }

  // 2. 调真实登录
  try {
    await authStore.login({ email: form.email.trim(), password: form.password })
    showToast('登录成功', 'success')
    // 跳首页 (Taro 环境) / 浏览器降级
    try {
      // @ts-expect-error - Taro 全局
      const Taro = (typeof globalThis !== 'undefined' ? (globalThis as any).Taro : undefined)
      if (Taro?.switchTab) Taro.switchTab({ url: '/pages/index/index' })
    } catch {
      /* 不是 Taro 环境, 忽略 */
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'login_failed'
    // 后端 401 -> "invalid_credentials"; 409 -> "email_already_used" 等
    const friendly =
      msg === 'invalid_credentials' ? '邮箱或密码错误' :
      msg === 'invalid_or_expired_token' ? '登录已过期, 请重试' :
      msg
    showToast(friendly, 'error')
  }
}

async function onRegister(): Promise<void> {
  // 一键注册: 邮箱必填, 密码 >= 8 位 (后端 register 校验)
  if (!form.email.trim()) {
    showToast('请输入邮箱', 'error')
    return
  }
  if (!isValidEmail(form.email.trim())) {
    showToast('邮箱格式不正确', 'error')
    return
  }
  if (!form.password || form.password.length < 8) {
    showToast('密码至少 8 位', 'error')
    return
  }

  try {
    // 直接调 register, 拿到 token pair 后塞进 store
    const localPart = form.email.trim().split('@')[0] || 'user'
    const pair = await register({
      email: form.email.trim(),
      password: form.password,
      display_name: localPart
    })
    authStore.token = pair.access_token
    authStore.user = pair.user
    showToast('注册成功, 已自动登录', 'success')
    try {
      // @ts-expect-error - Taro 全局
      const Taro = (typeof globalThis !== 'undefined' ? (globalThis as any).Taro : undefined)
      if (Taro?.switchTab) Taro.switchTab({ url: '/pages/index/index' })
    } catch {
      /* ignore */
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'register_failed'
    const friendly =
      msg === 'email_already_used' ? '该邮箱已注册, 请直接登录' :
      msg === 'invalid params' ? '参数校验失败' :
      msg
    showToast(friendly, 'error')
  }
}
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
  padding: 80rpx 48rpx 64rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.hero {
  text-align: center;
  margin-bottom: 64rpx;
}
.hero-title {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 2rpx;
  margin-bottom: 12rpx;
}
.hero-sub {
  display: block;
  font-size: 26rpx;
  color: #94A3B8;
}

.card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.2);
}

.alert {
  background: #FEF2F2;
  border: 1rpx solid #FECACA;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
}
.alert-text {
  font-size: 24rpx;
  color: #B91C1C;
}

.field {
  margin-bottom: 28rpx;
  position: relative;
}
.label {
  display: block;
  font-size: 24rpx;
  color: #475569;
  margin-bottom: 8rpx;
  font-weight: 500;
}
.input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #E2E8F0;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #0F172A;
  background: #F8FAFC;
  box-sizing: border-box;
}
.input:focus {
  border-color: #0EA5E9;
  background: #FFFFFF;
}
.toggle {
  position: absolute;
  right: 16rpx;
  bottom: 18rpx;
  padding: 8rpx 12rpx;
}
.toggle-text {
  font-size: 22rpx;
  color: #0EA5E9;
}

.btn {
  width: 100%;
  height: 96rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  transition: opacity 0.2s;
}
.btn.disabled { opacity: 0.6; }
.btn-primary {
  background: linear-gradient(135deg, #0EA5E9, #6366F1);
  box-shadow: 0 4rpx 12rpx rgba(14, 165, 233, 0.3);
}
.btn-secondary {
  background: #F1F5F9;
  border: 1rpx solid #E2E8F0;
}
.btn-text {
  font-size: 30rpx;
  font-weight: 600;
}
.btn-primary .btn-text { color: #FFFFFF; }
.btn-secondary .btn-text { color: #475569; font-weight: 500; }

.hint {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: #94A3B8;
  margin-top: 32rpx;
}
</style>
