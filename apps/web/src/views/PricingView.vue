<script setup lang="ts">
/**
 * PricingView · 定价页
 * 公开页面 · 不需要登录
 *
 * 四大套餐 + BYOK 省钱方案 + 功能对比 + 常见问题
 */

import { ref } from 'vue'
import { MODULE_NAMES, UNIT_NAMES, FEATURE_NAMES } from '@/config/naming'
import LoginModal from '@/components/LoginModal.vue'

const showLogin = ref(false)

interface PricingTier {
  id: string
  name: string
  price: string
  priceUnit: string
  desc: string
  episodes: string
  highlight: boolean
  features: string[]
  cta: string
  ctaLink: string
}

const tiers: PricingTier[] = [
  {
    id: 'free',
    name: '免费版',
    price: '免费',
    priceUnit: '',
    desc: '体验 AI 动画创作',
    episodes: '3次/天（90次/月）',
    highlight: false,
    features: [
      '3次/天（90次/月）',
      '基础 AI 模型',
      '720p 视频导出',
      '社区支持',
      '作品展示页',
    ],
    cta: '立即开始',
    ctaLink: '/login',
  },
  {
    id: 'basic',
    name: '基础版',
    price: '¥39',
    priceUnit: '/月',
    desc: '个人创作者首选',
    episodes: '每月 50 次',
    highlight: false,
    features: [
      '每月 50 次动画生成',
      '高级 AI 模型',
      '1080p 视频导出',
      '优先客服支持',
      '作品展示页',
      '角色库 50 个',
      '场景库 100 个',
    ],
    cta: '订阅基础版',
    ctaLink: '/login',
  },
  {
    id: 'pro',
    name: '专业版',
    price: '¥149',
    priceUnit: '/月',
    desc: '团队与企业推荐',
    episodes: '每月 280 次',
    highlight: true,
    features: [
      '每月 280 次动画生成',
      '顶级 AI 模型',
      '4K 视频导出',
      '专属客服经理',
      '作品展示页 + 数据分析',
      '角色库无限',
      '场景库无限',
      '团队协作 5 人',
      'API 接入',
      '商用授权',
    ],
    cta: '订阅专业版',
    ctaLink: '/login',
  },
  {
    id: 'enterprise',
    name: '企业版',
    price: '定制',
    priceUnit: '',
    desc: '大规模内容生产',
    episodes: '无限制',
    highlight: false,
    features: [
      '无限制动画生成',
      '定制 AI 模型训练',
      '8K 视频导出',
      '7x24 技术支持',
      '白标定制',
      '角色库无限',
      '场景库无限',
      '团队协作无限',
      '专属 API + SDK',
      '商用授权 + 版权保护',
      '私有化部署',
    ],
    cta: '联系销售',
    ctaLink: 'mailto:sales@manhuaworks.com',
  },
]

interface FAQ {
  q: string
  a: string
}

const faqs: FAQ[] = [
  {
    q: '免费版有什么限制？',
    a: '免费版每天可生成 3 次动画（月总量 90 次），使用基础 AI 模型，视频导出分辨率为 720p。适合体验和个人学习使用。如需更多次数或更高分辨率，建议升级到基础版或专业版。',
  },
  {
    q: '什么是自备密钥模式？',
    a: '自备密钥模式允许你使用自己的 AI 模型 API Key（如 OpenAI、Claude、Midjourney 等），可节省 40-75% 的费用。你只需在设置中填入你的 API Key，系统会自动调用你的账户，费用直接从你的 API 账户扣除。',
  },
  {
    q: '如何计算自备密钥模式能省多少钱？',
    a: '以专业版为例：官方定价 ¥149/月包含 280 次。如果使用自备密钥模式，你只需支付 API 调用费用。根据我们的测算，使用自有 API Key 生成 280 次的成本约为 ¥37-89，相比官方定价可节省 40-75%。具体节省金额取决于你使用的模型和调用量。',
  },
  {
    q: '可以随时升级或降级套餐吗？',
    a: '可以。升级立即生效，按剩余天数差价补费；降级在下一个计费周期生效。已生成的作品和素材不会受影响。',
  },
  {
    q: '企业版有什么额外功能？',
    a: '企业版提供无限制生成、定制 AI 模型训练、白标定制、私有化部署、7x24 技术支持等。适合大规模内容生产团队和 IP 运营公司。请联系销售获取定制方案。',
  },
  {
    q: '支持哪些支付方式？',
    a: '支持支付宝、微信支付、银行卡、企业对公转账。企业版支持年度合同和发票。',
  },
  {
    q: '生成的一次包含什么内容？',
    a: '一次动画生成包含：AI 拆稿镜头、角色生成、场景生成、镜头动画、配音（可选）、背景音乐、字幕、视频合成导出。整个过程由 AI 自动完成，你只需提供原始小说文本。',
  },
  {
    q: '可以商用吗？',
    a: '专业版和企业版包含商用授权，生成的作品可用于商业发布、广告投放、IP 运营等。免费版和基础版仅限个人学习和非商业用途。',
  },
]

const expandedFaq = ref<string | null>(null)

function toggleFaq(q: string) {
  expandedFaq.value = expandedFaq.value === q ? null : q
}
</script>

<template>
  <main class="pricing">
    <header class="pricing__nav">
      <RouterLink to="/" class="pricing__back">&larr; 返回首页</RouterLink>
      <div class="pricing__nav-center">
        <RouterLink to="/showcase" class="pricing__nav-link">作品展示</RouterLink>
      </div>
      <span class="pricing__brand">千机工坊</span>
    </header>

    <!-- Hero -->
    <section class="pricing__hero">
      <p class="pricing__eyebrow">透明定价 · 按需选择</p>
      <h1 class="pricing__title">
        选择适合你的<span class="pricing__title-accent">创作套餐</span>
      </h1>
      <p class="pricing__subtitle">
        从免费版到企业版，满足不同规模的创作需求<br />
        支持自备密钥模式，可节省 40-75% 费用
      </p>
    </section>

    <!-- 四大套餐 -->
    <section class="pricing__tiers">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        :class="['pricing__card', { 'pricing__card--highlight': tier.highlight }]"
      >
        <div class="pricing__card-header">
          <h3 class="pricing__card-name">{{ tier.name }}</h3>
          <span v-if="tier.highlight" class="pricing__card-badge">推荐</span>
        </div>
        <div class="pricing__card-price">
          <span class="pricing__card-amount">{{ tier.price }}</span>
          <span v-if="tier.priceUnit" class="pricing__card-unit">{{ tier.priceUnit }}</span>
        </div>
        <p class="pricing__card-desc">{{ tier.desc }}</p>
        <div class="pricing__card-episodes">
          <span class="pricing__card-episodes-icon">🎬</span>
          <span class="pricing__card-episodes-text">{{ tier.episodes }}</span>
        </div>
        <ul class="pricing__card-features">
          <li v-for="feature in tier.features" :key="feature" class="pricing__card-feature">
            <span class="pricing__card-check">✓</span>
            <span>{{ feature }}</span>
          </li>
        </ul>
        <a
          v-if="tier.ctaLink.startsWith('mailto')"
          :href="tier.ctaLink"
          :class="['pricing__card-cta', { 'pricing__card-cta--primary': tier.highlight }]"
        >
          {{ tier.cta }}
        </a>
        <button
          v-else
          type="button"
          :class="['pricing__card-cta', { 'pricing__card-cta--primary': tier.highlight }]"
          @click="showLogin = true"
        >
          {{ tier.cta }}
        </button>
      </div>
    </section>

    <!-- BYOK 省钱方案 -->
    <section class="pricing__byok">
      <div class="pricing__byok-content">
        <h2 class="pricing__byok-title">
          <span class="pricing__byok-icon">💰</span>
          自备密钥模式省钱方案
        </h2>
        <p class="pricing__byok-subtitle">自带 API Key，节省 40-75% 费用</p>
        <div class="pricing__byok-desc">
          <p>
            <strong>自备密钥模式</strong>允许你使用自己的 AI 模型 API Key
            （如 OpenAI、Claude、Midjourney 等），费用直接从你的 API 账户扣除。
          </p>
          <p>
            以专业版为例：官方定价 <strong>¥149/月</strong> 包含 280 次。使用自备密钥模式，
            生成 280 次的 API 成本约为 <strong>¥37-89</strong>，可节省 <strong>40-75%</strong>。
          </p>
        </div>
        <div class="pricing__byok-steps">
          <div class="pricing__byok-step">
            <span class="pricing__byok-step-num">1</span>
            <div>
              <h4>获取 API Key</h4>
              <p>在 OpenAI、Claude、Midjourney 等平台注册并获取 API Key</p>
            </div>
          </div>
          <div class="pricing__byok-step">
            <span class="pricing__byok-step-num">2</span>
            <div>
              <h4>填入密钥</h4>
              <p>在「设置 → API 密钥」中填入你的 API Key</p>
            </div>
          </div>
          <div class="pricing__byok-step">
            <span class="pricing__byok-step-num">3</span>
            <div>
              <h4>开始创作</h4>
              <p>系统自动调用你的 API，费用从你的账户扣除</p>
            </div>
          </div>
        </div>
        <button type="button" class="pricing__byok-cta" @click="showLogin = true">立即体验自备密钥模式</button>
      </div>
    </section>

    <!-- 功能对比 -->
    <section class="pricing__compare">
      <h2 class="pricing__compare-title">功能对比</h2>
      <p class="pricing__compare-subtitle">详细对比四大套餐的功能差异</p>
      <div class="pricing__compare-table-wrap">
        <table class="pricing__compare-table">
          <thead>
            <tr>
              <th class="pricing__compare-feature">功能</th>
              <th v-for="tier in tiers" :key="tier.id" class="pricing__compare-tier">
                {{ tier.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="pricing__compare-feature">每月次数</td>
              <td>3次/天<br/>（90次/月）</td>
              <td>50 次</td>
              <td>280 次</td>
              <td>无限制</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">AI 模型</td>
              <td>基础</td>
              <td>高级</td>
              <td>顶级</td>
              <td>定制训练</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">视频分辨率</td>
              <td>720p</td>
              <td>1080p</td>
              <td>4K</td>
              <td>8K</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">角色库</td>
              <td>10 个</td>
              <td>50 个</td>
              <td>无限</td>
              <td>无限</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">场景库</td>
              <td>20 个</td>
              <td>100 个</td>
              <td>无限</td>
              <td>无限</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">团队协作</td>
              <td>—</td>
              <td>—</td>
              <td>5 人</td>
              <td>无限</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">API 接入</td>
              <td>—</td>
              <td>—</td>
              <td>✓</td>
              <td>✓ + SDK</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">商用授权</td>
              <td>—</td>
              <td>—</td>
              <td>✓</td>
              <td>✓ + 版权保护</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">技术支持</td>
              <td>社区</td>
              <td>优先客服</td>
              <td>专属经理</td>
              <td>7x24</td>
            </tr>
            <tr>
              <td class="pricing__compare-feature">自备密钥模式</td>
              <td>—</td>
              <td>✓</td>
              <td>✓</td>
              <td>✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 常见问题 -->
    <section class="pricing__faq">
      <h2 class="pricing__faq-title">常见问题</h2>
      <p class="pricing__faq-subtitle">关于定价和套餐的常见疑问</p>
      <div class="pricing__faq-list">
        <div
          v-for="faq in faqs"
          :key="faq.q"
          :class="['pricing__faq-item', { 'pricing__faq-item--expanded': expandedFaq === faq.q }]"
        >
          <button
            type="button"
            class="pricing__faq-question"
            @click="toggleFaq(faq.q)"
          >
            <span class="pricing__faq-question-text">{{ faq.q }}</span>
            <span class="pricing__faq-toggle">{{ expandedFaq === faq.q ? '−' : '+' }}</span>
          </button>
          <div v-if="expandedFaq === faq.q" class="pricing__faq-answer">
            <p>{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="pricing__cta">
      <h2>还有疑问？</h2>
      <p>联系我们的销售团队，获取定制方案和专属优惠</p>
      <div class="pricing__cta-buttons">
        <button type="button" class="btn-primary" @click="showLogin = true">立即开始</button>
        <a href="mailto:sales@manhuaworks.com" class="btn-secondary">联系销售</a>
      </div>
    </section>

    <footer class="pricing__footer">
      <p>&copy; 2026 千机工坊 · AI 动画创作平台</p>
    </footer>

    <!-- Login Modal -->
    <LoginModal v-model="showLogin" />
  </main>
</template>

<style scoped>
.pricing {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.pricing__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: rgba(10, 14, 26, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.pricing__back {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.pricing__back:hover {
  color: var(--accent);
}

.pricing__nav-center {
  display: flex;
  gap: 16px;
}

.pricing__nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.pricing__nav-link:hover {
  color: var(--accent);
}

.pricing__brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* ===== Hero ===== */
.pricing__hero {
  padding: 80px 32px 48px;
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
}

.pricing__eyebrow {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin: 0 0 16px;
  font-weight: 600;
}

.pricing__title {
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.pricing__title-accent {
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.pricing__subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* ===== Tiers ===== */
.pricing__tiers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
  padding: 0 32px 80px;
  max-width: 1200px;
  margin: 0 auto;
}

.pricing__card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 24px;
  transition: all 300ms;
  display: flex;
  flex-direction: column;
}

.pricing__card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.pricing__card--highlight {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent),
    var(--shadow);
  transform: translateY(-4px);
}

.pricing__card--highlight:hover {
  transform: translateY(-8px);
}

.pricing__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pricing__card-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.pricing__card-badge {
  padding: 4px 12px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.pricing__card-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.pricing__card-amount {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.pricing__card-unit {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.pricing__card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 20px;
}

.pricing__card-episodes {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 10px;
  margin-bottom: 20px;
}

.pricing__card-episodes-icon {
  font-size: 20px;
}

.pricing__card-episodes-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.pricing__card-features {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  flex: 1;
}

.pricing__card-feature {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.pricing__card-check {
  color: var(--accent);
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.pricing__card-cta {
  display: block;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 200ms;
  cursor: pointer;
  font-family: inherit;
}

.pricing__card-cta:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.pricing__card-cta--primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.pricing__card-cta--primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow), var(--glow);
}

/* ===== BYOK ===== */
.pricing__byok {
  padding: 0 32px 80px;
  max-width: 1000px;
  margin: 0 auto;
}

.pricing__byok-content {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px 36px;
}

.pricing__byok-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.pricing__byok-icon {
  font-size: 32px;
}

.pricing__byok-subtitle {
  font-size: 15px;
  color: var(--accent);
  margin: 0 0 20px;
  font-weight: 500;
}

.pricing__byok-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 28px;
}

.pricing__byok-desc p {
  margin: 0 0 12px;
}

.pricing__byok-desc strong {
  color: var(--text-primary);
  font-weight: 600;
}

.pricing__byok-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}

.pricing__byok-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.pricing__byok-step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.pricing__byok-step h4 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
}

.pricing__byok-step p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.pricing__byok-cta {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: all 300ms;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.pricing__byok-cta:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow), var(--glow);
}

/* ===== Compare ===== */
.pricing__compare {
  padding: 0 32px 80px;
  max-width: 1200px;
  margin: 0 auto;
}

.pricing__compare-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  text-align: center;
}

.pricing__compare-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 32px;
  text-align: center;
}

.pricing__compare-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.pricing__compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.pricing__compare-table thead {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.pricing__compare-table th {
  padding: 16px 12px;
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
}

.pricing__compare-feature {
  text-align: left !important;
  padding-left: 20px !important;
  font-weight: 600 !important;
  color: var(--text-primary);
}

.pricing__compare-tier {
  min-width: 120px;
}

.pricing__compare-table tbody tr {
  border-bottom: 1px solid var(--border);
}

.pricing__compare-table tbody tr:last-child {
  border-bottom: none;
}

.pricing__compare-table tbody td {
  padding: 14px 12px;
  text-align: center;
  color: var(--text-secondary);
}

.pricing__compare-table tbody td:first-child {
  text-align: left;
  padding-left: 20px;
  color: var(--text-primary);
  font-weight: 500;
}

/* ===== FAQ ===== */
.pricing__faq {
  padding: 0 32px 80px;
  max-width: 800px;
  margin: 0 auto;
}

.pricing__faq-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  text-align: center;
}

.pricing__faq-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 32px;
  text-align: center;
}

.pricing__faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pricing__faq-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 200ms;
}

.pricing__faq-item--expanded {
  border-color: var(--accent);
}

.pricing__faq-question {
  width: 100%;
  padding: 18px 20px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transition: all 200ms;
}

.pricing__faq-question:hover {
  color: var(--accent);
}

.pricing__faq-question-text {
  flex: 1;
}

.pricing__faq-toggle {
  font-size: 24px;
  font-weight: 300;
  color: var(--accent);
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.pricing__faq-answer {
  padding: 0 20px 18px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.pricing__faq-answer p {
  margin: 0;
}

/* ===== CTA ===== */
.pricing__cta {
  padding: 60px 32px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.pricing__cta h2 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px;
}

.pricing__cta p {
  color: var(--text-secondary);
  margin: 0 0 28px;
  line-height: 1.6;
}

.pricing__cta-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ===== Buttons ===== */
.btn-primary {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: all 300ms;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow), var(--glow);
}

.btn-secondary {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: all 300ms;
}

.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ===== Footer ===== */
.pricing__footer {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}
</style>
