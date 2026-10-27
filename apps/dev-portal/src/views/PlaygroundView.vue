<template>
  <div class="playground-view">
    <div class="view-header">
      <h1 class="view-title">API Playground</h1>
      <p class="view-desc">在线调试 API 接口，实时查看请求与响应。选择预置示例快速开始。</p>
    </div>

    <div class="playground-layout">
      <!-- 左侧：请求配置 -->
      <div class="request-panel">
        <!-- 预置示例 -->
        <div class="examples-bar">
          <span class="examples-label">预置示例：</span>
          <button
            v-for="ex in examples"
            :key="ex.id"
            class="example-chip"
            :class="{ active: activeExample === ex.id }"
            @click="loadExample(ex)"
          >
            {{ ex.label }}
          </button>
        </div>

        <!-- 方法 + URL -->
        <div class="url-bar">
          <select v-model="method" class="method-select">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            v-model="url"
            type="text"
            class="url-input"
            placeholder="https://api.qianjigongfang.com/v1/..."
          />
          <button class="btn-send" :disabled="response.loading" @click="sendRequest">
            {{ response.loading ? '请求中...' : '发送' }}
          </button>
        </div>

        <!-- Headers -->
        <div class="section-block">
          <h3 class="block-title" @click="showHeaders = !showHeaders">
            Headers {{ showHeaders ? '▼' : '▶' }}
          </h3>
          <div v-if="showHeaders" class="headers-editor">
            <div v-for="(h, idx) in headers" :key="idx" class="header-row">
              <input v-model="h.key" type="text" class="header-input" placeholder="Key" />
              <input v-model="h.value" type="text" class="header-input" placeholder="Value" />
              <button class="btn-remove" @click="headers.splice(idx, 1)">&times;</button>
            </div>
            <button class="btn-add" @click="addHeader">+ 添加 Header</button>
          </div>
        </div>

        <!-- Body -->
        <div class="section-block">
          <h3 class="block-title">请求体 (JSON)</h3>
          <textarea
            v-model="body"
            class="body-editor"
            placeholder='{ "key": "value" }'
            rows="10"
          ></textarea>
        </div>
      </div>

      <!-- 右侧：响应 -->
      <div class="response-panel">
        <div class="response-header">
          <h3 class="block-title">响应</h3>
          <div v-if="response.status !== null" class="response-meta">
            <span class="response-status" :class="statusClass(response.status)">
              {{ response.status }}
            </span>
            <span v-if="response.duration !== null" class="response-time">
              {{ response.duration }}ms
            </span>
          </div>
        </div>

        <div v-if="response.loading" class="response-loading">
          <div class="spinner"></div>
          <span>请求发送中...</span>
        </div>

        <div v-else-if="response.error" class="response-error">
          <p>{{ response.error }}</p>
        </div>

        <div v-else-if="response.data !== null" class="response-body">
          <pre class="code-block">{{ formatResponse(response.data) }}</pre>
        </div>

        <div v-else class="response-empty">
          <p>点击「发送」按钮查看响应结果</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useDevFetch } from '@/composables/useDevApi'

const { response, send } = useDevFetch()

const method = ref('POST')
const url = ref('https://api.qianjigongfang.com/v1/audio/generate')
const body = ref(JSON.stringify({
  prompt: '一首轻快的中国风古筝曲',
  style: 'chinese_traditional',
  duration_seconds: 30,
}, null, 2))
const showHeaders = ref(true)
const activeExample = ref('')

interface Header {
  key: string
  value: string
}

const headers = reactive<Header[]>([
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer sk-your-api-key' },
])

function addHeader() {
  headers.push({ key: '', value: '' })
}

interface Example {
  id: string
  label: string
  method: string
  url: string
  body?: string
}

const examples: Example[] = [
  {
    id: 'audio-gen',
    label: '文生音乐',
    method: 'POST',
    url: 'https://api.qianjigongfang.com/v1/audio/generate',
    body: JSON.stringify({ prompt: '一首轻快的中国风古筝曲', style: 'chinese_traditional', duration_seconds: 30 }, null, 2),
  },
  {
    id: 'audio-match',
    label: '情绪选曲',
    method: 'POST',
    url: 'https://api.qianjigongfang.com/v1/audio/match',
    body: JSON.stringify({ mood: ['轻松', '温馨'], scene: '日常vlog', max_results: 5 }, null, 2),
  },
  {
    id: 'audio-sfx',
    label: '音效生成',
    method: 'POST',
    url: 'https://api.qianjigongfang.com/v1/audio/sfx',
    body: JSON.stringify({ prompt: '翻书声，连续翻动三页', duration_seconds: 2, output_format: 'wav' }, null, 2),
  },
  {
    id: 'img-gen',
    label: '图像生成',
    method: 'POST',
    url: 'https://api.qianjigongfang.com/v1/images/generate',
    body: JSON.stringify({ prompt: '水墨风格山水画', style: 'ink_wash', width: 1024, height: 1024 }, null, 2),
  },
  {
    id: 'comics-list',
    label: '获取漫剧',
    method: 'GET',
    url: 'https://api.qianjigongfang.com/v1/comics/mh_8xk21',
  },
  {
    id: 'tts',
    label: 'TTS 配音',
    method: 'POST',
    url: 'https://api.qianjigongfang.com/v1/tts/synthesize',
    body: JSON.stringify({ text: '欢迎收听千机工坊有声书', voice_id: 'zh_female_01', speed: 1.0 }, null, 2),
  },
]

function loadExample(ex: Example) {
  activeExample.value = ex.id
  method.value = ex.method
  url.value = ex.url
  body.value = ex.body || ''
}

async function sendRequest() {
  const headerObj: Record<string, string> = {}
  for (const h of headers) {
    if (h.key.trim()) {
      headerObj[h.key.trim()] = h.value
    }
  }
  await send(method.value, url.value, headerObj, body.value || undefined)
}

function formatResponse(data: unknown): string {
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'status-ok'
  if (status >= 400 && status < 500) return 'status-warn'
  return 'status-err'
}
</script>

<style scoped>
.playground-view {
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 20px;
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 6px;
}

.view-desc {
  font-size: 14px;
  color: #6b7280;
}

.playground-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

/* 请求面板 */
.request-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 预置示例 */
.examples-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 0;
}

.examples-label {
  font-size: 12px;
  color: #6b7280;
  margin-right: 4px;
}

.example-chip {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #9ca3af;
  background: #1a1d2e;
  border: 1px solid #2d3348;
  cursor: pointer;
  transition: all 0.15s;
}

.example-chip:hover {
  border-color: #00BFA5;
  color: #e5e7eb;
}

.example-chip.active {
  background: rgba(0, 191, 165, 0.1);
  border-color: #00BFA5;
  color: #00BFA5;
}

/* URL 栏 */
.url-bar {
  display: flex;
  gap: 8px;
}

.method-select {
  padding: 8px 12px;
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 8px;
  color: #00BFA5;
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
  cursor: pointer;
  outline: none;
  appearance: auto;
}

.url-input {
  flex: 1;
  padding: 8px 12px;
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 8px;
  color: #e5e7eb;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  transition: border-color 0.15s;
}

.url-input:focus {
  border-color: #00BFA5;
}

.btn-send {
  padding: 8px 20px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00BFA5, #009688);
  color: white;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.btn-send:hover {
  opacity: 0.9;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 区块 */
.section-block {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 10px;
  overflow: hidden;
}

.block-title {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
  background: #131627;
  border-bottom: 1px solid #2d3348;
}

/* Headers */
.headers-editor {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-row {
  display: flex;
  gap: 6px;
}

.header-input {
  flex: 1;
  padding: 6px 10px;
  background: #0f1117;
  border: 1px solid #2d3348;
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 12px;
  font-family: monospace;
  outline: none;
}

.header-input:focus {
  border-color: #00BFA5;
}

.btn-remove {
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
}

.btn-remove:hover {
  color: #f87171;
}

.btn-add {
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: #00BFA5;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

/* Body */
.body-editor {
  width: 100%;
  padding: 14px;
  background: #0f1117;
  border: none;
  color: #c9d1d9;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

/* 响应面板 */
.response-panel {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 12px;
  overflow: hidden;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 80px;
}

.response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
}

.response-header .block-title {
  border-radius: 0;
}

.response-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
}

.response-status {
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
}

.response-time {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.status-ok { color: #34d399; }
.status-warn { color: #fbbf24; }
.status-err { color: #f87171; }

.response-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  color: #6b7280;
  font-size: 14px;
  flex: 1;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #2d3348;
  border-top-color: #00BFA5;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.response-error {
  padding: 20px;
  color: #f87171;
  font-size: 14px;
  flex: 1;
}

.response-body {
  flex: 1;
  overflow: auto;
}

.response-body .code-block {
  margin: 0;
  border: none;
  border-radius: 0;
  min-height: 300px;
}

.response-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #4b5563;
  font-size: 14px;
  flex: 1;
}

@media (max-width: 1024px) {
  .playground-layout {
    grid-template-columns: 1fr;
  }
  .response-panel {
    position: static;
    min-height: 300px;
  }
}
</style>
