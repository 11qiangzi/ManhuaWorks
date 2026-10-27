<template>
  <div class="docs-view">
    <!-- 文档侧边栏 -->
    <aside class="docs-sidebar">
      <h3 class="docs-sidebar-title">API 分类</h3>
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="docs-cat-item"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span class="cat-label">{{ cat.label }}</span>
        <span v-if="cat.isNew" class="cat-new">NEW</span>
      </div>
    </aside>

    <!-- 文档主区域 -->
    <div class="docs-main">
      <div v-if="activeCategory" class="endpoint-list">
        <div
          v-for="ep in filteredEndpoints"
          :key="ep.id"
          class="endpoint-card"
          :class="{ expanded: expandedEndpoint === ep.id }"
        >
          <!-- 端点头部 -->
          <div class="endpoint-header" @click="toggleEndpoint(ep.id)">
            <span class="method-badge" :class="methodClass(ep.method)">{{ ep.method }}</span>
            <span class="endpoint-path">{{ ep.path }}</span>
            <span class="endpoint-desc">{{ ep.summary }}</span>
            <span class="expand-icon">{{ expandedEndpoint === ep.id ? '▲' : '▼' }}</span>
          </div>

          <!-- 端点详情 -->
          <div v-if="expandedEndpoint === ep.id" class="endpoint-body">
            <!-- 描述 -->
            <div class="ep-section">
              <h4 class="ep-section-title">描述</h4>
              <p class="ep-description">{{ ep.description }}</p>
            </div>

            <!-- 请求体 -->
            <div v-if="ep.requestBody" class="ep-section">
              <h4 class="ep-section-title">请求体 (Request Body)</h4>
              <pre class="code-block">{{ ep.requestBody }}</pre>
            </div>

            <!-- 响应 -->
            <div v-if="ep.responseBody" class="ep-section">
              <h4 class="ep-section-title">响应示例 (200 OK)</h4>
              <pre class="code-block">{{ ep.responseBody }}</pre>
            </div>

            <!-- 代码示例 -->
            <div class="ep-section">
              <h4 class="ep-section-title">代码示例</h4>
              <div class="code-tabs">
                <div class="code-tab-bar">
                  <button
                    v-for="lang in codeLanguages"
                    :key="lang.id"
                    class="code-tab"
                    :class="{ active: activeTab[ep.id] === lang.id }"
                    @click="activeTab[ep.id] = lang.id"
                  >
                    {{ lang.label }}
                  </button>
                </div>
                <pre class="code-block">{{ getCodeExample(ep, activeTab[ep.id] || 'curl') }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

const activeCategory = ref('music')
const expandedEndpoint = ref<string | null>(null)
const activeTab = reactive<Record<string, string>>({})

const codeLanguages = [
  { id: 'curl', label: 'cURL' },
  { id: 'nodejs', label: 'Node.js' },
  { id: 'python', label: 'Python' },
]

interface Endpoint {
  id: string
  category: string
  method: string
  path: string
  summary: string
  description: string
  requestBody?: string
  responseBody?: string
}

const categories = [
  { id: 'comics', icon: '🎨', label: '漫剧创建/管理', isNew: false },
  { id: 'images', icon: '🖼', label: '图像生成', isNew: false },
  { id: 'video', icon: '🎬', label: '视频生成', isNew: false },
  { id: 'music', icon: '🎵', label: '音乐生成', isNew: true },
  { id: 'tts', icon: '🎙', label: 'TTS/配音', isNew: false },
  { id: 'export', icon: '📤', label: '导出/发布', isNew: false },
  { id: 'byok', icon: '🔐', label: 'BYOK 密钥管理', isNew: false },
]

const endpoints: Endpoint[] = [
  // === 音乐生成 ===
  {
    id: 'audio-generate',
    category: 'music',
    method: 'POST',
    path: '/v1/audio/generate',
    summary: '文生音乐',
    description: '根据文本描述（提示词）生成原创音乐片段。支持指定风格、时长、BPM 和乐器配置。生成的音频格式支持 MP3、WAV 和 FLAC。',
    requestBody: JSON.stringify({
      prompt: '一首轻快的中国风古筝曲，带有春天的气息',
      style: 'chinese_traditional',
      duration_seconds: 30,
      bpm: 120,
      instruments: ['guzheng', 'dizi'],
      output_format: 'mp3',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'aud_gen_x8k2m1',
      status: 'completed',
      audio_url: 'https://cdn.qianjigongfang.com/audio/aud_gen_x8k2m1.mp3',
      duration_seconds: 30,
      bpm: 120,
      style: 'chinese_traditional',
      created_at: '2026-04-10T16:05:12Z',
    }, null, 2),
  },
  {
    id: 'audio-match',
    category: 'music',
    method: 'POST',
    path: '/v1/audio/match',
    summary: '情绪匹配选曲',
    description: '根据输入的情绪标签、场景描述或参考音频，从曲库中智能匹配最合适的背景音乐。支持多情绪组合和权重调节。',
    requestBody: JSON.stringify({
      mood: ['轻松', '温馨'],
      scene: '日常vlog背景音乐',
      energy_level: 0.4,
      max_results: 5,
      reference_audio_url: null,
    }, null, 2),
    responseBody: JSON.stringify({
      matches: [
        { id: 'track_001', title: '晨光微曦', score: 0.95, preview_url: '...' },
        { id: 'track_002', title: '午后阳光', score: 0.88, preview_url: '...' },
        { id: 'track_003', title: '温暖时光', score: 0.82, preview_url: '...' },
      ],
      total: 3,
    }, null, 2),
  },
  {
    id: 'audio-variation',
    category: 'music',
    method: 'POST',
    path: '/v1/audio/variation',
    summary: '风格变奏',
    description: '基于已有音频片段生成风格变奏版本。可以改变乐器编排、节奏风格或音乐流派，同时保留原始旋律结构。',
    requestBody: JSON.stringify({
      source_audio_id: 'aud_gen_x8k2m1',
      target_style: 'jazz_fusion',
      keep_melody: true,
      variation_count: 3,
      instruments_override: ['piano', 'saxophone', 'bass'],
    }, null, 2),
    responseBody: JSON.stringify({
      variations: [
        { id: 'aud_var_001', style: 'jazz_fusion', audio_url: '...' },
        { id: 'aud_var_002', style: 'jazz_fusion', audio_url: '...' },
        { id: 'aud_var_003', style: 'jazz_fusion', audio_url: '...' },
      ],
    }, null, 2),
  },
  {
    id: 'audio-sfx',
    category: 'music',
    method: 'POST',
    path: '/v1/audio/sfx',
    summary: '音效生成',
    description: '根据文字描述生成短音效（Sound Effects）。适用于漫剧配音、视频后期、游戏音效等场景。最长支持 10 秒音效。',
    requestBody: JSON.stringify({
      prompt: '翻书声，纸张较厚，连续翻动三页',
      duration_seconds: 2,
      output_format: 'wav',
      sample_rate: 48000,
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'sfx_7k2m9x',
      status: 'completed',
      audio_url: 'https://cdn.qianjigongfang.com/sfx/sfx_7k2m9x.wav',
      duration_seconds: 2,
      sample_rate: 48000,
    }, null, 2),
  },
  {
    id: 'audio-process',
    category: 'music',
    method: 'POST',
    path: '/v1/audio/process',
    summary: '音频处理',
    description: '对已有音频进行后处理，包括降噪、混响、均衡、音量标准化、格式转换等操作。支持多步骤处理链。',
    requestBody: JSON.stringify({
      audio_id: 'aud_gen_x8k2m1',
      operations: [
        { type: 'denoise', strength: 0.8 },
        { type: 'normalize', target_lufs: -14 },
        { type: 'reverb', room_size: 'small', wet: 0.2 },
      ],
      output_format: 'flac',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'aud_proc_001',
      source_id: 'aud_gen_x8k2m1',
      status: 'completed',
      audio_url: 'https://cdn.qianjigongfang.com/audio/aud_proc_001.flac',
      operations_applied: ['denoise', 'normalize', 'reverb'],
    }, null, 2),
  },
  // === 漫剧创建/管理 ===
  {
    id: 'comics-create',
    category: 'comics',
    method: 'POST',
    path: '/v1/comics',
    summary: '创建漫剧项目',
    description: '创建一个新的漫剧项目，指定标题、风格、分镜脚本等信息。',
    requestBody: JSON.stringify({
      title: '春日奇遇',
      style: 'watercolor',
      panel_count: 12,
      script: '第一话：...',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'mh_8xk21',
      title: '春日奇遇',
      status: 'created',
      created_at: '2026-04-10T12:00:00Z',
    }, null, 2),
  },
  {
    id: 'comics-get',
    category: 'comics',
    method: 'GET',
    path: '/v1/comics/:id',
    summary: '获取漫剧详情',
    description: '根据漫剧 ID 获取项目详情，包括分镜数据、生成状态和下载链接。',
    responseBody: JSON.stringify({
      id: 'mh_8xk21',
      title: '春日奇遇',
      status: 'completed',
      panels: [{ id: 'p1', image_url: '...' }],
    }, null, 2),
  },
  {
    id: 'comics-update',
    category: 'comics',
    method: 'PATCH',
    path: '/v1/comics/:id',
    summary: '更新漫剧项目',
    description: '部分更新漫剧项目的属性，如标题、脚本或风格设置。',
    requestBody: JSON.stringify({ title: '春日奇遇（修订版）' }, null, 2),
    responseBody: JSON.stringify({ id: 'mh_8xk21', title: '春日奇遇（修订版）', updated: true }, null, 2),
  },
  {
    id: 'comics-delete',
    category: 'comics',
    method: 'DELETE',
    path: '/v1/comics/:id',
    summary: '删除漫剧项目',
    description: '永久删除一个漫剧项目及其所有关联资源。此操作不可逆。',
    responseBody: JSON.stringify({ deleted: true, id: 'mh_8xk21' }, null, 2),
  },
  // === 图像生成 ===
  {
    id: 'images-generate',
    category: 'images',
    method: 'POST',
    path: '/v1/images/generate',
    summary: '文本生成图像',
    description: '根据文本提示词生成高质量图像，支持多种风格和尺寸。',
    requestBody: JSON.stringify({
      prompt: '水墨风格的山水画，远山近水，一叶扁舟',
      style: 'ink_wash',
      width: 1024,
      height: 1024,
      count: 1,
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'img_gen_001',
      images: [{ url: 'https://cdn.qianjigongfang.com/images/img_001.png', width: 1024, height: 1024 }],
    }, null, 2),
  },
  // === 视频生成 ===
  {
    id: 'video-generate',
    category: 'video',
    method: 'POST',
    path: '/v1/video/generate',
    summary: '文本/图像生成视频',
    description: '基于文本描述或参考图像生成短视频片段。',
    requestBody: JSON.stringify({
      prompt: '樱花飘落的慢镜头，日式庭院',
      source_image_url: null,
      duration_seconds: 5,
      fps: 24,
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'vid_gen_001',
      status: 'processing',
      estimated_seconds: 120,
    }, null, 2),
  },
  // === TTS ===
  {
    id: 'tts-synthesize',
    category: 'tts',
    method: 'POST',
    path: '/v1/tts/synthesize',
    summary: '文本转语音',
    description: '将文本转换为自然语音，支持多种音色、语速和情感控制。',
    requestBody: JSON.stringify({
      text: '欢迎收听千机工坊有声书',
      voice_id: 'zh_female_01',
      speed: 1.0,
      emotion: 'warm',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'tts_001',
      audio_url: 'https://cdn.qianjigongfang.com/tts/tts_001.mp3',
      duration_seconds: 3.2,
    }, null, 2),
  },
  {
    id: 'tts-voices',
    category: 'tts',
    method: 'GET',
    path: '/v1/tts/voices',
    summary: '获取可用音色列表',
    description: '列出所有可用的 TTS 音色，包括语言、性别和试听链接。',
    responseBody: JSON.stringify({
      voices: [
        { id: 'zh_female_01', name: '晓雅', language: 'zh-CN', gender: 'female' },
        { id: 'zh_male_01', name: '浩然', language: 'zh-CN', gender: 'male' },
      ],
    }, null, 2),
  },
  // === 导出/发布 ===
  {
    id: 'export-create',
    category: 'export',
    method: 'POST',
    path: '/v1/exports',
    summary: '创建导出任务',
    description: '将漫剧项目导出为指定格式（PDF、EPUB、图片包等）。',
    requestBody: JSON.stringify({
      comic_id: 'mh_8xk21',
      format: 'pdf',
      quality: 'high',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'exp_001',
      status: 'processing',
      estimated_seconds: 60,
    }, null, 2),
  },
  // === BYOK ===
  {
    id: 'byok-list',
    category: 'byok',
    method: 'GET',
    path: '/v1/byok/keys',
    summary: '获取 BYOK 密钥列表',
    description: '列出用户配置的自带密钥（Bring Your Own Key），用于调用第三方 AI 服务。',
    responseBody: JSON.stringify({
      keys: [
        { id: 'byok_001', provider: 'openai', prefix: 'sk-...a1b2', status: 'active' },
      ],
    }, null, 2),
  },
  {
    id: 'byok-create',
    category: 'byok',
    method: 'POST',
    path: '/v1/byok/keys',
    summary: '添加 BYOK 密钥',
    description: '添加一个新的自带密钥，用于通过千机工坊代理调用第三方服务。',
    requestBody: JSON.stringify({
      provider: 'openai',
      key: 'sk-***',
      label: '我的 OpenAI Key',
    }, null, 2),
    responseBody: JSON.stringify({
      id: 'byok_002',
      provider: 'openai',
      prefix: 'sk-...c3d4',
      status: 'active',
    }, null, 2),
  },
]

const filteredEndpoints = computed(() =>
  endpoints.filter((ep) => ep.category === activeCategory.value)
)

function toggleEndpoint(id: string) {
  expandedEndpoint.value = expandedEndpoint.value === id ? null : id
}

function methodClass(method: string) {
  return `method-${method.toLowerCase()}`
}

function getCodeExample(ep: Endpoint, lang: string): string {
  const baseUrl = 'https://api.qianjigongfang.com'
  const fullUrl = `${baseUrl}${ep.path}`

  if (lang === 'curl') {
    let cmd = `curl -X ${ep.method} '${fullUrl}' \\\n  -H 'Authorization: Bearer sk-your-api-key' \\\n  -H 'Content-Type: application/json'`
    if (ep.requestBody) {
      cmd += ` \\\n  -d '${ep.requestBody}'`
    }
    return cmd
  }

  if (lang === 'nodejs') {
    let code = `import fetch from 'node-fetch';\n\n`
    code += `const res = await fetch('${fullUrl}', {\n`
    code += `  method: '${ep.method}',\n`
    code += `  headers: {\n`
    code += `    'Authorization': 'Bearer sk-your-api-key',\n`
    code += `    'Content-Type': 'application/json',\n`
    code += `  },\n`
    if (ep.requestBody) {
      code += `  body: JSON.stringify(${ep.requestBody}),\n`
    }
    code += `});\n\nconst data = await res.json();\nconsole.log(data);`
    return code
  }

  if (lang === 'python') {
    let code = `import requests\n\n`
    code += `headers = {\n    "Authorization": "Bearer sk-your-api-key",\n    "Content-Type": "application/json",\n}\n\n`
    if (ep.requestBody) {
      code += `payload = ${ep.requestBody}\n\n`
      code += `resp = requests.${ep.method.toLowerCase()}(\n    "${fullUrl}",\n    headers=headers,\n    json=payload,\n)\n`
    } else {
      code += `resp = requests.${ep.method.toLowerCase()}("${fullUrl}", headers=headers)\n`
    }
    code += `\nprint(resp.json())`
    return code
  }

  return ''
}
</script>

<style scoped>
.docs-view {
  display: flex;
  gap: 0;
  min-height: calc(100vh - 56px - 56px);
  margin: -24px;
}

/* 文档侧边栏 */
.docs-sidebar {
  width: 220px;
  min-width: 220px;
  background: #131627;
  border-right: 1px solid #2d3348;
  padding: 20px 0;
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow-y: auto;
}

.docs-sidebar-title {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 16px;
  margin-bottom: 12px;
}

.docs-cat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  color: #9ca3af;
  font-size: 13px;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}

.docs-cat-item:hover {
  background: #1e2235;
  color: #e5e7eb;
}

.docs-cat-item.active {
  background: rgba(0, 191, 165, 0.08);
  color: #00BFA5;
  border-left-color: #00BFA5;
}

.cat-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.cat-new {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #7C3AED;
  color: white;
  font-weight: 700;
  margin-left: auto;
}

/* 文档主区域 */
.docs-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* 端点卡片 */
.endpoint-card {
  border: 1px solid #2d3348;
  border-radius: 10px;
  margin-bottom: 12px;
  background: #1a1d2e;
  overflow: hidden;
  transition: border-color 0.2s;
}

.endpoint-card:hover {
  border-color: #3d4460;
}

.endpoint-card.expanded {
  border-color: #00BFA5;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
}

.endpoint-path {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #e5e7eb;
  font-weight: 500;
}

.endpoint-desc {
  font-size: 13px;
  color: #6b7280;
  margin-left: auto;
}

.expand-icon {
  font-size: 10px;
  color: #6b7280;
  margin-left: 8px;
}

/* 端点详情 */
.endpoint-body {
  padding: 0 16px 16px;
  border-top: 1px solid #2d3348;
}

.ep-section {
  margin-top: 16px;
}

.ep-section-title {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.ep-description {
  font-size: 14px;
  color: #d1d5db;
  line-height: 1.6;
}

/* 代码标签 */
.code-tabs {
  border: 1px solid #2d3348;
  border-radius: 8px;
  overflow: hidden;
}

.code-tab-bar {
  display: flex;
  background: #131627;
  border-bottom: 1px solid #2d3348;
}

.code-tab {
  padding: 6px 16px;
  font-size: 12px;
  color: #6b7280;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.code-tab:hover {
  color: #d1d5db;
}

.code-tab.active {
  color: #00BFA5;
  background: #1e2235;
  border-bottom: 2px solid #00BFA5;
}

.code-block {
  margin: 0;
  border: none;
  border-radius: 0;
}

/* 方法徽章 */
.method-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.method-get { background: #064e3b; color: #34d399; }
.method-post { background: #1e3a5f; color: #60a5fa; }
.method-patch { background: #4a3728; color: #fbbf24; }
.method-delete { background: #4a1d2e; color: #f87171; }

@media (max-width: 768px) {
  .docs-view {
    flex-direction: column;
  }
  .docs-sidebar {
    width: 100%;
    min-width: unset;
    height: auto;
    position: static;
    display: flex;
    flex-wrap: wrap;
    padding: 12px;
    gap: 4px;
  }
  .docs-sidebar-title {
    width: 100%;
  }
  .docs-cat-item {
    padding: 6px 10px;
    border-radius: 6px;
    border-left: none;
    font-size: 12px;
  }
  .docs-cat-item.active {
    border-left: none;
  }
}
</style>
