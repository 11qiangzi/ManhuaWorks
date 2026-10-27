<script setup lang="ts">
/**
 * ExportSettingsView.vue — 导出参数设置 (1:1 复刻 studio-export-settings.html)
 * 林染 🖥️ 2026-06-10 派单 33C
 * 2026-06 refactor: 切换 api-bridge，修复 fetch 错误吞没
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApi } from '@/api-bridge'

const route = useRoute()
const router = useRouter()
const resolution = ref('1080p')
const codec = ref('H.264 (推荐)')
const fps = ref('24 fps')
const bitrate = ref('中 (8 Mbps) 推荐')
const audio = ref('AAC 256kbps')
const filename = ref('')
const watermark = ref(true)
const subtitle = ref(true)
const chapterMark = ref(false)

const resolutions = [
  { id: '1080p', icon: '🖥', name: '1080p', detail: '1920×1080' },
  { id: '720p', icon: '📱', name: '720p', detail: '1280×720' },
  { id: '4k', icon: '🎬', name: '4K', detail: '3840×2160' },
  { id: 'vertical', icon: '📲', name: '竖屏', detail: '1080×1920' },
]

function goBack() {
  router.push('/export')
}
const exporting = ref(false)
const exportError = ref('')
const exportSuccess = ref(false)

async function startExport() {
  if (!filename.value.trim()) {
    exportError.value = '请填写输出文件名'
    return
  }
  exporting.value = true; exportError.value = ''; exportSuccess.value = false
  try {
    const api = getApi()
    const config = {
      resolution: resolution.value, codec: codec.value, fps: fps.value,
      bitrate: bitrate.value, audio: audio.value, filename: filename.value,
      watermark: watermark.value, subtitle: subtitle.value, chapterMark: chapterMark.value,
    }
    localStorage.setItem('mhw.exportConfig', JSON.stringify(config))
    const projectId = route.params.projectId as string || 'default'
    const r = await api.http.post(`/projects/${encodeURIComponent(projectId)}/export`, config)
    if (!r || (r as any).code !== 0) {
      throw new Error((r as any)?.message || '导出请求失败')
    }
    exportSuccess.value = true
    setTimeout(() => { exportSuccess.value = false }, 5000)
  } catch (err: unknown) {
    exportError.value = err instanceof Error ? err.message : '导出失败，请重试'
  } finally {
    exporting.value = false
  }
}

// ── Load saved settings from localStorage on mount ───────────────────────────
onMounted(() => {
  try {
    const saved = localStorage.getItem('mhw.exportConfig')
    if (saved) {
      const cfg = JSON.parse(saved)
      if (cfg.resolution) resolution.value = cfg.resolution
      if (cfg.codec) codec.value = cfg.codec
      if (cfg.fps) fps.value = cfg.fps
      if (cfg.bitrate) bitrate.value = cfg.bitrate
      if (cfg.audio) audio.value = cfg.audio
      if (cfg.filename) filename.value = cfg.filename
      if (typeof cfg.watermark === 'boolean') watermark.value = cfg.watermark
      if (typeof cfg.subtitle === 'boolean') subtitle.value = cfg.subtitle
      if (typeof cfg.chapterMark === 'boolean') chapterMark.value = cfg.chapterMark
    }
  } catch { /* ignore parse errors */ }
})
</script>

<template>
  <div class="export-settings">
    <div class="es-back"><a href="#" @click.prevent="goBack">← 返回导出中心</a><span class="page-title">⚙ 导出参数 · 视频导出 (.mp4)</span></div>
    <div v-if="exportError" class="es-error">{{ exportError }}<span class="es-error-close" @click="exportError = ''">✕</span></div>
    <div v-if="exportSuccess" class="es-success">✅ 导出任务已提交，可在导出中心查看进度</div>
    <div class="es-form">
      <div class="es-card">
        <div class="section-title">📐 分辨率预设</div>
        <div class="preset-row">
          <div v-for="r in resolutions" :key="r.id" class="preset-card" :class="{ active: resolution === r.id }" @click="resolution = r.id">
            <div class="preset-icon">{{ r.icon }}</div>
            <div class="preset-name">{{ r.name }}</div>
            <div class="preset-detail">{{ r.detail }}</div>
          </div>
        </div>
      </div>
      <div class="es-card">
        <div class="section-title">🎥 视频参数</div>
        <div class="param-grid-2">
          <div><label class="form-label">编码格式</label><select class="input" v-model="codec"><option>H.264 (推荐)</option><option>H.265 / HEVC</option><option>AV1</option></select></div>
          <div><label class="form-label">帧率</label><select class="input" v-model="fps"><option>24 fps</option><option>30 fps</option><option>60 fps</option></select></div>
          <div><label class="form-label">码率</label><select class="input" v-model="bitrate"><option>高 (15 Mbps)</option><option>中 (8 Mbps) 推荐</option><option>低 (4 Mbps)</option></select></div>
          <div><label class="form-label">音频编码</label><select class="input" v-model="audio"><option>AAC 256kbps</option><option>AAC 128kbps</option><option>无音频</option></select></div>
        </div>
      </div>
      <div class="es-card">
        <div class="section-title">🏷️ 输出设置</div>
        <div class="form-grid">
          <div><label class="form-label">文件名</label><input class="input" v-model="filename"></div>
          <div class="check-row">
            <input type="checkbox" id="watermark" v-model="watermark"><label for="watermark">添加水印 "千机工坊"</label>
            <input type="checkbox" id="subtitle" v-model="subtitle"><label for="subtitle">嵌入字幕</label>
            <input type="checkbox" id="chapter" v-model="chapterMark"><label for="chapter">章节标记</label>
          </div>
        </div>
      </div>
      <div class="es-actions">
        <button class="btn btn-secondary" @click="goBack">取消</button>
        <button class="btn btn-primary" @click="startExport" :disabled="exporting">{{ exporting ? '导出中...' : exportSuccess ? '✅ 导出已开始' : '📤 开始导出' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-settings { padding: 24px 32px; flex: 1; overflow-y: auto; }
.es-back { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.es-error { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; color: #fca5a5; font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
.es-error-close { cursor: pointer; opacity: .6; font-size: 14px; }
.es-error-close:hover { opacity: 1; }
.es-success { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; color: #86efac; font-size: 13px; }
.es-back a { color: var(--text-secondary, #94a3b8); text-decoration: none; font-size: 13px; }
.page-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text-primary, #e2e8f0); }
.es-form { max-width: 800px; }
.es-card { background: var(--bg-card, #141a2e); border: 1px solid var(--border, #1e293b); border-radius: var(--radius, 12px); padding: 20px; margin-bottom: 16px; }
.section-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #e2e8f0); margin-bottom: 12px; }
.preset-row { display: flex; gap: 12px; }
.preset-card { flex: 1; padding: 12px; border: 2px solid var(--border, #1e293b); border-radius: 8px; cursor: pointer; text-align: center; }
.preset-card.active { border-color: var(--accent, #818cf8); background: rgba(99,102,241,.05); }
.preset-card:hover { border-color: var(--border-strong, #334155); }
.preset-icon { font-size: 24px; }
.preset-name { font-size: 12px; font-weight: 600; color: var(--text-primary, #e2e8f0); margin-top: 4px; }
.preset-detail { font-size: 10px; color: var(--text-muted, #64748b); }
.param-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid { display: flex; flex-direction: column; gap: 12px; }
.form-label { font-size: 12px; font-weight: 500; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; display: block; }
.check-row { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-secondary, #94a3b8); }
.es-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .2s; white-space: nowrap; }
.btn-primary { background: var(--accent, #818cf8); color: #fff; }
.btn-primary:hover { background: var(--accent-strong, #6366f1); box-shadow: 0 0 20px rgba(99,102,241,.3); }
.btn-secondary { background: var(--bg-tertiary, #1a2332); color: var(--text-primary, #e2e8f0); border: 1px solid var(--border, #1e293b); }
.input { padding: 10px 14px; border-radius: 8px; background: var(--bg-tertiary, #1a2332); border: 1px solid var(--border, #1e293b); color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; font-family: var(--font-sans); width: 100%; transition: border .2s; }
.input:focus { border-color: var(--accent, #818cf8); }
select.input { cursor: pointer; }
</style>
