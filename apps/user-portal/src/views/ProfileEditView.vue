<script setup lang="ts">
/**
 * ProfileEditView.vue — Profile 编辑 (1:1 复刻 portal-profile-edit.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('profile')
const displayName = ref('创作者')
const bio = ref('漫改创作者，专注古风/仙侠题材。用 AI 把文字变成漫剧。')
const email = ref('creator@manhuaworks.com')
const phone = ref('+86 138****5678')
const socialLinks = ref({ twitter: '', bilibili: '', website: '', zhihu: '' })

const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
async function saveProfile() {
  saving.value = true; saveError.value = ''; saveSuccess.value = false
  try {
    const token = localStorage.getItem('mhw.access_token') || ''
    const r = await fetch('/api/v1/user/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ displayName: displayName.value, bio: bio.value, email: email.value, phone: phone.value, socialLinks: socialLinks.value })
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || '保存失败 (' + r.status + ')') }
    saveSuccess.value = true
    setTimeout(() => router.push('/dashboard'), 1200)
  } catch (err: any) { saveError.value = err.message || '保存失败' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="profile-edit">
    <div class="pf-card">
      <div class="tabs">
        <span class="tab" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">👤 个人资料</span>
        <span class="tab" :class="{ active: activeTab === 'security' }" @click="activeTab = 'security'">🔐 安全</span>
        <span class="tab" :class="{ active: activeTab === 'appearance' }" @click="activeTab = 'appearance'">🎨 外观</span>
      </div>
      <template v-if="activeTab === 'profile'">
        <div class="pf-avatar-section">
          <div class="pf-avatar-preview">🎨<div class="pf-avatar-edit">📷</div></div>
          <div>
            <div class="pf-display-name">{{ displayName }}</div>
            <div class="pf-avatar-hint">点击头像更换 · 支持 JPG/PNG/WebP</div>
            <button class="btn btn-sm btn-secondary mt-4">📤 上传新头像</button>
          </div>
        </div>
        <div class="pf-form-row"><label>显示名称</label><input class="input" v-model="displayName"></div>
        <div class="pf-form-row"><label>简介</label><textarea class="input" rows="3" v-model="bio"></textarea></div>
        <div class="pf-form-row"><label>邮箱</label><input class="input" :value="email" readonly style="opacity:.7"></div>
        <div class="pf-form-row"><label>手机号</label><input class="input" :value="phone" readonly style="opacity:.7"></div>
        <div class="section-title">🔗 社交链接</div>
        <div class="social-grid">
          <div class="pf-link-row"><span class="pf-link-icon">🐦</span><input class="input" v-model="socialLinks.twitter" placeholder="Twitter/X 主页"></div>
          <div class="pf-link-row"><span class="pf-link-icon">📺</span><input class="input" v-model="socialLinks.bilibili" placeholder="B站 主页"></div>
          <div class="pf-link-row"><span class="pf-link-icon">🌐</span><input class="input" v-model="socialLinks.website" placeholder="个人网站"></div>
          <div class="pf-link-row"><span class="pf-link-icon">📖</span><input class="input" v-model="socialLinks.zhihu" placeholder="知乎 主页"></div>
        </div>
        <div class="pf-actions">
          <button class="btn btn-secondary">取消</button>
          <button class="btn btn-primary" @click="saveProfile" :disabled="saving">{{ saving ? '保存中...' : saveSuccess ? '✅ 已保存' : '💾 保存资料' }}</button>
        </div>
      </template>
      <template v-if="activeTab === 'security'">
        <div style="text-align:center;padding:40px;color:var(--text-muted)">🔐 安全设置（待实现）</div>
      </template>
      <template v-if="activeTab === 'appearance'">
        <div style="text-align:center;padding:40px;color:var(--text-muted)">🎨 外观设置（待实现）</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile-edit { flex: 1; padding: 28px 32px; overflow-y: auto; display: flex; justify-content: center; }
.pf-card { width: 680px; background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius-lg, 16px); padding: 32px; }
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border, #1e293b); margin-bottom: 20px; }
.tab { padding: 10px 20px; font-size: 13px; font-weight: 500; color: var(--text-secondary, #94a3b8); cursor: pointer; border-bottom: 2px solid transparent; transition: all .2s; }
.tab.active { color: var(--accent, #818cf8); border-bottom-color: var(--accent, #818cf8); }
.tab:hover { color: var(--text-primary, #e2e8f0); }
.pf-avatar-section { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border, #1e293b); }
.pf-avatar-preview { width: 100px; height: 100px; border-radius: 20px; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 44px; color: #fff; position: relative; }
.pf-avatar-edit { position: absolute; bottom: -4px; right: -4px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent, #818cf8); border: 2px solid var(--bg-card, #141a2e); display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; }
.pf-display-name { font-size: 18px; font-weight: 700; color: var(--text-primary, #e2e8f0); }
.pf-avatar-hint { font-size: 12px; color: var(--text-muted, #64748b); }
.mt-4 { margin-top: 16px; }
.pf-form-row { margin-bottom: 16px; }
.pf-form-row label { display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; }
.social-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pf-link-row { display: flex; align-items: center; gap: 8px; }
.pf-link-icon { width: 28px; text-align: center; }
.pf-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
textarea.input { resize: vertical; }
</style>
