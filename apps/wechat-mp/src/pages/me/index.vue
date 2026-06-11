<template>
  <view class="page">
    <!-- 用户信息卡 (L5-B: 真用户名 + 真 email) -->
    <view class="profile">
      <view class="avatar">
        <text class="avatar-emoji">{{ avatarEmoji }}</text>
      </view>
      <view class="profile-info">
        <text class="profile-name">{{ displayName }}</text>
        <text class="profile-email">{{ subtitle }}</text>
        <view class="profile-tags">
          <view class="tag">
            <text class="tag-text">{{ planLabel }}</text>
          </view>
          <view class="tag" v-if="!loadingKeys">
            <text class="tag-text">🔑 {{ apiKeyCount }} 个 Key</text>
          </view>
          <view class="tag tag-warn" v-else>
            <text class="tag-text">⏳ 加载中</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 4 入口 -->
    <view class="entries">
      <view
        v-for="entry in entries"
        :key="entry.key"
        class="entry"
        @tap="onTapEntry(entry.key, entry.label)"
      >
        <view class="entry-icon" :style="{ background: entry.iconBg }">
          <text class="entry-emoji">{{ entry.emoji }}</text>
        </view>
        <view class="entry-body">
          <text class="entry-label">{{ entry.label }}</text>
          <text class="entry-desc">{{ entry.desc }}</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 (L5-B: 真 logout) -->
    <view class="logout" @tap="onLogout">
      <text class="logout-text">退出登录</text>
    </view>

    <!-- 底部版权 -->
    <text class="footer">ManhuaWorks · L5-B 真实接入</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { listApiKeys } from '../../api/client'

/**
 * L5-B 真实接入:
 *   - 用户: 来自 auth store (持久化到 uni storage)
 *   - API Key 数量: 真实调 GET /api/v1/user/api-keys
 *   - 失败兜底: 列表取不到时, 展示 0 不崩
 */

const authStore = useAuthStore()

/* 头像 emoji: 用 email/phone 的首字符哈希映射 */
const avatarEmoji = computed<string>(() => {
  if (!authStore.user) return '👤'
  const seed = authStore.user.email || authStore.user.phone || authStore.user.id
  const emojis = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐳', '🐝', '🦉']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return emojis[Math.abs(h) % emojis.length]!
})

const displayName = computed<string>(() => authStore.displayName)

const subtitle = computed<string>(() => {
  if (!authStore.user) return '未登录'
  return authStore.user.email || authStore.user.phone || `ID: ${authStore.user.id.slice(0, 8)}`
})

const planLabel = computed<string>(() => {
  const role = authStore.userRole
  if (role === 0) return '免费用户'
  if (role === 1) return '读者'
  if (role === 2) return 'Pro 创作者'
  if (role === 3) return '编辑'
  if (role >= 4) return '管理员'
  return '免费用户'
})

/* API Key 数量 - 真实从后端拉 */
const apiKeyCount = ref<number>(0)
const loadingKeys = ref<boolean>(false)

async function loadApiKeyCount(): Promise<void> {
  if (!authStore.isLoggedIn) {
    apiKeyCount.value = 0
    return
  }
  loadingKeys.value = true
  try {
    const list = await listApiKeys()
    apiKeyCount.value = list.filter((k) => !k.revokedAt).length
  } catch (e) {
    // 兜底: 拉取失败不崩, 保持 0
    console.warn('[wechat-mp] listApiKeys failed, fallback 0:', e)
    apiKeyCount.value = 0
  } finally {
    loadingKeys.value = false
  }
}

onMounted(() => {
  loadApiKeyCount()
})

/* 4 入口 */
interface Entry {
  key: 'byok' | 'team' | 'works' | 'settings'
  label: string
  desc: string
  emoji: string
  iconBg: string
}

const entries = ref<Entry[]>([
  {
    key: 'byok',
    label: 'BYOK 密钥',
    desc: '管理你自己的 AI 模型 API Key',
    emoji: '🔑',
    iconBg: 'linear-gradient(135deg, #F59E0B, #EF4444)'
  },
  {
    key: 'team',
    label: '我的团队',
    desc: '协作成员 / 权限管理',
    emoji: '👥',
    iconBg: 'linear-gradient(135deg, #0EA5E9, #6366F1)'
  },
  {
    key: 'works',
    label: '我的作品',
    desc: '历史作品 / 已发布',
    emoji: '🎨',
    iconBg: 'linear-gradient(135deg, #10B981, #0EA5E9)'
  },
  {
    key: 'settings',
    label: '设置',
    desc: '通知 / 主题 / 关于',
    emoji: '⚙️',
    iconBg: 'linear-gradient(135deg, #64748B, #0F172A)'
  }
])

const onTapEntry = (key: string, label: string): void => {
  console.log(`[wechat-mp] tap entry: ${key} (${label})`)
  // eslint-disable-next-line no-alert
  alert(`${label} · M3 阶段开放`)
}

const onLogout = (): void => {
  // eslint-disable-next-line no-alert
  if (!confirm('确认退出登录?')) return
  authStore.logout()
  apiKeyCount.value = 0
  // 跳登录页
  try {
    // @ts-expect-error - Taro 全局
    const Taro = (typeof globalThis !== 'undefined' ? (globalThis as any).Taro : undefined)
    if (Taro?.redirectTo) Taro.redirectTo({ url: '/pages/login/login' })
  } catch {
    /* ignore */
  }
}
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #F8FAFC;
  padding: 32rpx 32rpx 64rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

/* 用户卡 */
.profile {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.06);
}
.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #0EA5E9, #6366F1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;
}
.avatar-emoji {
  font-size: 72rpx;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.profile-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #0F172A;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-email {
  display: block;
  font-size: 24rpx;
  color: #64748B;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
.tag {
  background: #F1F5F9;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
.tag-warn { background: #FEF3C7; }
.tag-text {
  font-size: 22rpx;
  color: #475569;
}
.tag-warn .tag-text { color: #92400E; }

/* 入口列表 */
.entries {
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.06);
}
.entry {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #F1F5F9;
}
.entry:last-child { border-bottom: none; }
.entry-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
}
.entry-emoji {
  font-size: 40rpx;
}
.entry-body {
  flex: 1;
  min-width: 0;
}
.entry-label {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: #0F172A;
  margin-bottom: 4rpx;
}
.entry-desc {
  display: block;
  font-size: 22rpx;
  color: #94A3B8;
}
.entry-arrow {
  font-size: 36rpx;
  color: #CBD5E1;
  font-weight: 300;
}

/* 退出登录 */
.logout {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 28rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.06);
}
.logout-text {
  font-size: 30rpx;
  color: #EF4444;
  font-weight: 500;
}

/* 版权 */
.footer {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: #94A3B8;
  margin-top: 32rpx;
}
</style>
