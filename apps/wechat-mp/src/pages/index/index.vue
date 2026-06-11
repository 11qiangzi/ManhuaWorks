<template>
  <view class="page">
    <!-- 顶部登录态卡 -->
    <view class="hero">
      <view class="hero-top">
        <text class="hero-label">当前登录态</text>
        <view :class="['badge', isLoggedIn ? 'badge-on' : 'badge-off']">
          <text class="badge-text">{{ isLoggedIn ? '已登录' : '未登录' }}</text>
        </view>
      </view>
      <text class="hero-name">{{ mockUser.name }}</text>
      <text class="hero-sub">{{ mockUser.email }}</text>
      <view class="hero-stats">
        <view class="stat">
          <text class="stat-num">{{ mockUser.projects }}</text>
          <text class="stat-label">项目</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ mockUser.credits }}</text>
          <text class="stat-label">积分</text>
        </view>
        <view class="stat">
          <text class="stat-num">{{ mockUser.teams }}</text>
          <text class="stat-label">团队</text>
        </view>
      </view>
    </view>

    <!-- 最近项目 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">最近项目</text>
        <text class="section-more" @tap="onTapMore">查看全部 ›</text>
      </view>

      <view
        v-for="p in recentProjects"
        :key="p.id"
        class="card"
        @tap="onTapProject(p.id)"
      >
        <view class="card-cover" :style="{ background: p.cover }">
          <text class="card-cover-emoji">{{ p.emoji }}</text>
        </view>
        <view class="card-body">
          <text class="card-title">{{ p.title }}</text>
          <text class="card-desc">{{ p.description }}</text>
          <view class="card-meta">
            <view :class="['pill', `pill-${p.status}`]">
              <text class="pill-text">{{ statusLabel(p.status) }}</text>
            </view>
            <text class="card-updated">{{ p.updatedAt }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/**
 * M2 脚手架 - 纯本地 mock, 不接 user-service:8088
 * 真实接入由 L5-B 任务完成, 计划用 axios 调:
 *   - POST /auth/login
 *   - GET  /me
 *   - GET  /projects (project-service)
 */

// 登录态
const isLoggedIn = ref(false)

// Mock 用户 (登录后会被 /me 返回值替换)
const mockUser = ref({
  name: '游客',
  email: 'guest@manhuaworks.local',
  projects: 0,
  credits: 0,
  teams: 0
})

// Mock 登录方法 (M2 阶段不接 8088)
const mockLogin = () => {
  isLoggedIn.value = true
  mockUser.value = {
    name: '林启',
    email: 'linqi@manhuaworks.local',
    projects: 3,
    credits: 1280,
    teams: 1
  }
}

// 最近 3 个项目 (M2 mock)
interface MockProject {
  id: string
  title: string
  description: string
  emoji: string
  cover: string
  status: 'draft' | 'running' | 'done'
  updatedAt: string
}

const recentProjects = ref<MockProject[]>([
  {
    id: 'p-001',
    title: '星轨物语 · 第一话',
    description: '开场镜头, 群星列阵, 林启独白',
    emoji: '🌌',
    cover: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
    status: 'running',
    updatedAt: '2 小时前'
  },
  {
    id: 'p-002',
    title: '灰星废墟·分镜 03',
    description: '考古组突入 B 区, 智脑预警',
    emoji: '🏛️',
    cover: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    status: 'draft',
    updatedAt: '昨天'
  },
  {
    id: 'p-003',
    title: '主题封面 · 星河远征',
    description: '主视觉, 巨型舰首仰望星云',
    emoji: '🚀',
    cover: 'linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)',
    status: 'done',
    updatedAt: '3 天前'
  }
])

// 状态映射
const statusLabel = (s: MockProject['status']): string => {
  switch (s) {
    case 'draft': return '草稿'
    case 'running': return '生成中'
    case 'done': return '已完成'
  }
}

// 点击事件 - M2 阶段只打 console, M3 接跳转
const onTapProject = (id: string) => {
  console.log('[wechat-mp] tap project', id)
  // TODO M3: Taro.navigateTo({ url: `/pages/project-detail/index?id=${id}` })
}

const onTapMore = () => {
  console.log('[wechat-mp] tap more')
  // TODO M3: Taro.switchTab({ url: '/pages/projects/index' })
}

// 暴露给页面初始 (M2 模拟点击登录入口)
mockLogin()
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #F8FAFC;
  padding: 24rpx 32rpx 64rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

/* 顶部 hero */
.hero {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.12);
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.hero-label {
  font-size: 22rpx;
  color: #94A3B8;
  letter-spacing: 1rpx;
}
.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}
.badge-on  { background: rgba(16, 185, 129, 0.2); }
.badge-off { background: rgba(239, 68, 68, 0.2); }
.badge-text { color: #FFFFFF; }
.hero-name {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 6rpx;
}
.hero-sub {
  display: block;
  font-size: 24rpx;
  color: #94A3B8;
  margin-bottom: 24rpx;
}
.hero-stats {
  display: flex;
  gap: 32rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
}
.stat { display: flex; flex-direction: column; }
.stat-num {
  font-size: 36rpx;
  font-weight: 600;
  color: #0EA5E9;
  line-height: 1.2;
}
.stat-label {
  font-size: 22rpx;
  color: #94A3B8;
  margin-top: 4rpx;
}

/* 区块 */
.section { margin-top: 16rpx; }
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #0F172A;
}
.section-more {
  font-size: 24rpx;
  color: #0EA5E9;
}

/* 卡片 */
.card {
  display: flex;
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.06);
}
.card-cover {
  width: 144rpx;
  height: 144rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-cover-emoji {
  font-size: 64rpx;
}
.card-body {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #0F172A;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  font-size: 24rpx;
  color: #64748B;
  line-height: 1.4;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pill {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}
.pill-draft   { background: #F1F5F9; }
.pill-running { background: #DBEAFE; }
.pill-done    { background: #D1FAE5; }
.pill-text {
  color: #0F172A;
}
.card-updated {
  font-size: 22rpx;
  color: #94A3B8;
}
</style>
