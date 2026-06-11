<script setup lang="ts">
/**
 * SettingsView — 系统设置
 * 5 模块：AI / 支付 / 邮件 / 存储 / 限流
 */
import { onMounted, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'
import SettingModule, { type FieldSchema } from '@/components/settings/SettingModule.vue'

const store = useAdminStore()
onMounted(() => store.loadSettings())

const AI_FIELDS: FieldSchema[] = [
  { key: 'provider', label: '主供应商', type: 'select', options: [
    { label: 'OpenAI', value: 'openai' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Google', value: 'google' },
  ]},
  { key: 'fallback', label: '降级供应商', type: 'select', options: [
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'OpenAI', value: 'openai' },
    { label: '无', value: 'none' },
  ]},
  { key: 'dailyQuota', label: '日配额', type: 'number', hint: '每日最大请求数' },
  { key: 'timeoutMs', label: '超时 (ms)', type: 'number' },
]

const PAY_FIELDS: FieldSchema[] = [
  { key: 'provider', label: '支付渠道', type: 'select', options: [
    { label: '微信支付', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: 'Stripe', value: 'stripe' },
  ]},
  { key: 'currency', label: '币种', type: 'select', options: [
    { label: 'CNY', value: 'CNY' },
    { label: 'USD', value: 'USD' },
  ]},
  { key: 'taxRate', label: '税率', type: 'number', hint: '0-1 之间，如 0.06 = 6%' },
  { key: 'sandbox', label: '沙箱模式', type: 'switch' },
]

const EMAIL_FIELDS: FieldSchema[] = [
  { key: 'smtp', label: 'SMTP 主机', type: 'text', placeholder: 'smtp.example.com' },
  { key: 'port', label: '端口', type: 'number' },
  { key: 'from', label: '发件人', type: 'text' },
  { key: 'ssl', label: 'SSL/TLS', type: 'switch' },
]

const STORAGE_FIELDS: FieldSchema[] = [
  { key: 'driver', label: '存储驱动', type: 'select', options: [
    { label: 'S3', value: 's3' },
    { label: 'OSS', value: 'oss' },
    { label: '本地', value: 'local' },
  ]},
  { key: 'bucket', label: 'Bucket', type: 'text' },
  { key: 'cdn', label: 'CDN 域名', type: 'text' },
  { key: 'maxUploadMB', label: '单文件上限 (MB)', type: 'number' },
]

const RATE_FIELDS: FieldSchema[] = [
  { key: 'rps', label: '全局 RPS', type: 'number' },
  { key: 'burst', label: '突发上限', type: 'number' },
  { key: 'perUser', label: '单用户 RPS', type: 'number' },
  { key: 'windowSec', label: '时间窗 (秒)', type: 'number' },
]

const modules = computed(() => [
  { key: 'ai', title: 'AI 服务', desc: '主供应商 / 降级 / 配额 / 超时', icon: '🤖', fields: AI_FIELDS, value: store.settings.ai ?? {} },
  { key: 'payment', title: '支付配置', desc: '渠道 / 币种 / 税率 / 沙箱', icon: '💳', fields: PAY_FIELDS, value: store.settings.payment ?? {} },
  { key: 'email', title: '邮件服务', desc: 'SMTP / 端口 / 发件人 / SSL', icon: '📧', fields: EMAIL_FIELDS, value: store.settings.email ?? {} },
  { key: 'storage', title: '对象存储', desc: '驱动 / Bucket / CDN / 上传上限', icon: '🗄️', fields: STORAGE_FIELDS, value: store.settings.storage ?? {} },
  { key: 'ratelimit', title: '限流策略', desc: '全局 / 突发 / 单用户 / 时间窗', icon: '⏱️', fields: RATE_FIELDS, value: store.settings.ratelimit ?? {} },
])

async function onSave(payload: { module: string; value: Record<string, unknown> }) {
  await store.saveSetting(payload.module, payload.value)
}
</script>

<template>
  <div class="sv">
    <div v-if="store.settingsLoading && !Object.keys(store.settings).length" class="sv-loading">加载中…</div>
    <SettingModule
      v-for="m in modules"
      :key="m.key"
      :module-key="m.key"
      :title="m.title"
      :desc="m.desc"
      :icon="m.icon"
      :fields="m.fields"
      :value="m.value"
      :loading="store.settingsLoading"
      @save="onSave"
    />
  </div>
</template>

<style scoped>
.sv { display: flex; flex-direction: column; gap: 16px; }
.sv-loading { padding: 40px; text-align: center; opacity: 0.6; }
</style>
