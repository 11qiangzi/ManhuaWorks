<template>
  <div class="sdk-view">
    <div class="view-header">
      <h1 class="view-title">SDK 下载</h1>
      <p class="view-desc">
        官方维护的 SDK，封装了认证、重试和类型定义，让你更快集成千机工坊 API 到你的项目中。
      </p>
    </div>

    <div class="sdk-grid">
      <div v-for="sdk in sdkList" :key="sdk.name" class="sdk-card">
        <div class="sdk-icon" :style="{ background: sdk.iconBg }">
          {{ sdk.icon }}
        </div>
        <div class="sdk-info">
          <div class="sdk-name-row">
            <h3 class="sdk-name">{{ sdk.name }}</h3>
            <span v-if="sdk.hasAudio" class="audio-badge" title="包含音频模块">
              Audio NEW
            </span>
          </div>
          <div class="sdk-version">v{{ sdk.version }}</div>
          <div class="sdk-install">
            <code class="install-cmd">{{ sdk.install }}</code>
          </div>
          <p class="sdk-desc">{{ sdk.description }}</p>
        </div>
        <div class="sdk-actions">
          <a :href="sdk.repoUrl" target="_blank" class="btn-repo">
            查看源码
          </a>
          <button class="btn-download" @click="copyInstall(sdk.install)">
            {{ copiedSdk === sdk.name ? '已复制!' : '复制安装命令' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="usage-section">
      <h2 class="section-title">快速使用</h2>
      <div class="usage-tabs">
        <div class="usage-tab-bar">
          <button
            v-for="lang in usageLanguages"
            :key="lang.id"
            class="usage-tab"
            :class="{ active: activeUsageTab === lang.id }"
            @click="activeUsageTab = lang.id"
          >
            {{ lang.label }}
          </button>
        </div>
        <pre class="code-block">{{ usageCode[activeUsageTab] }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const copiedSdk = ref('')

interface SdkItem {
  name: string
  icon: string
  iconBg: string
  version: string
  install: string
  description: string
  repoUrl: string
  hasAudio: boolean
}

const sdkList: SdkItem[] = [
  {
    name: 'Node.js',
    icon: '🟢',
    iconBg: 'rgba(52, 211, 153, 0.15)',
    version: '2.4.0',
    install: 'npm install @manhuaworks/sdk-node',
    description: 'TypeScript 原生支持，包含完整的类型定义和自动重试逻辑。',
    repoUrl: '#',
    hasAudio: true,
  },
  {
    name: 'Python',
    icon: '🐍',
    iconBg: 'rgba(96, 165, 250, 0.15)',
    version: '2.3.1',
    install: 'pip install manhuaworks-sdk',
    description: '支持 asyncio 异步调用，兼容 Python 3.9+。',
    repoUrl: '#',
    hasAudio: true,
  },
  {
    name: 'Go',
    icon: '🐹',
    iconBg: 'rgba(56, 189, 248, 0.15)',
    version: '1.8.0',
    install: 'go get github.com/manhuaworks/sdk-go',
    description: ' idiomatic Go 客户端，支持 context 超时和并发安全。',
    repoUrl: '#',
    hasAudio: true,
  },
  {
    name: 'Java',
    icon: '☕',
    iconBg: 'rgba(251, 191, 36, 0.15)',
    version: '2.1.0',
    install: 'implementation "com.manhuaworks:sdk-java:2.1.0"',
    description: '支持 Spring Boot 自动配置，兼容 Java 11+。',
    repoUrl: '#',
    hasAudio: false,
  },
  {
    name: 'iOS (Swift)',
    icon: '🍎',
    iconBg: 'rgba(248, 113, 113, 0.15)',
    version: '1.5.2',
    install: 'pod "ManhuaWorksSDK", "~> 1.5"',
    description: 'Swift 5.9+，支持 async/await 和 Combine 框架。',
    repoUrl: '#',
    hasAudio: false,
  },
  {
    name: 'Android (Kotlin)',
    icon: '🤖',
    iconBg: 'rgba(167, 139, 250, 0.15)',
    version: '1.6.0',
    install: 'implementation "com.manhuaworks:sdk-android:1.6.0"',
    description: 'Kotlin Coroutines 原生支持，兼容 Android API 26+。',
    repoUrl: '#',
    hasAudio: false,
  },
]

function copyInstall(cmd: string) {
  navigator.clipboard?.writeText(cmd).catch(() => {})
  copiedSdk.value = cmd.split(' ').pop() || ''
  setTimeout(() => { copiedSdk.value = '' }, 2000)
}

const activeUsageTab = ref('nodejs')
const usageLanguages = [
  { id: 'nodejs', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
]

const usageCode: Record<string, string> = {
  nodejs: `import { ManhuaClient } from '@manhuaworks/sdk-node';

const client = new ManhuaClient({ apiKey: 'sk-your-api-key' });

// 文生音乐
const music = await client.audio.generate({
  prompt: '一首轻快的中国风古筝曲',
  style: 'chinese_traditional',
  duration_seconds: 30,
});

console.log('音频地址:', music.audio_url);

// 创建漫剧
const comic = await client.comics.create({
  title: '春日奇遇',
  style: 'watercolor',
});

console.log('漫剧 ID:', comic.id);`,

  python: `from manhuaworks import ManhuaClient

client = ManhuaClient(api_key="sk-your-api-key")

# 文生音乐
music = client.audio.generate(
    prompt="一首轻快的中国风古筝曲",
    style="chinese_traditional",
    duration_seconds=30,
)

print(f"音频地址: {music.audio_url}")

# 创建漫剧
comic = client.comics.create(
    title="春日奇遇",
    style="watercolor",
)

print(f"漫剧 ID: {comic.id}")`,

  go: `package main

import (
    "fmt"
    manhua "github.com/manhuaworks/sdk-go"
)

func main() {
    client := manhua.NewClient("sk-your-api-key")

    // 文生音乐
    music, err := client.Audio.Generate(ctx, &manhua.AudioGenerateReq{
        Prompt:          "一首轻快的中国风古筝曲",
        Style:           "chinese_traditional",
        DurationSeconds: 30,
    })
    if err != nil {
        panic(err)
    }

    fmt.Println("音频地址:", music.AudioURL)
}`,
}
</script>

<style scoped>
.sdk-view {
  max-width: 1100px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 28px;
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
  max-width: 600px;
  line-height: 1.5;
}

/* SDK 卡片 */
.sdk-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}

.sdk-card {
  background: #1a1d2e;
  border: 1px solid #2d3348;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color 0.2s;
}

.sdk-card:hover {
  border-color: #3d4460;
}

.sdk-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.sdk-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.sdk-name {
  font-size: 17px;
  font-weight: 700;
  color: #e5e7eb;
}

.audio-badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 4px;
  background: linear-gradient(135deg, #7C3AED, #a855f7);
  color: white;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sdk-version {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
  margin-bottom: 8px;
}

.sdk-install {
  margin-bottom: 8px;
}

.install-cmd {
  display: inline-block;
  padding: 6px 10px;
  background: #0f1117;
  border: 1px solid #2d3348;
  border-radius: 6px;
  font-size: 12px;
  color: #00BFA5;
  font-family: 'JetBrains Mono', monospace;
}

.sdk-desc {
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.5;
}

.sdk-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #2d3348;
}

.btn-repo {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #9ca3af;
  border: 1px solid #2d3348;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-repo:hover {
  background: #1e2235;
  color: #e5e7eb;
}

.btn-download {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #00BFA5;
  background: rgba(0, 191, 165, 0.1);
  border: 1px solid rgba(0, 191, 165, 0.2);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-download:hover {
  background: rgba(0, 191, 165, 0.15);
}

/* 使用说明 */
.usage-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3348;
}

.usage-tabs {
  border: 1px solid #2d3348;
  border-radius: 12px;
  overflow: hidden;
}

.usage-tab-bar {
  display: flex;
  background: #131627;
  border-bottom: 1px solid #2d3348;
}

.usage-tab {
  padding: 10px 20px;
  font-size: 13px;
  color: #6b7280;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.usage-tab:hover {
  color: #d1d5db;
}

.usage-tab.active {
  color: #00BFA5;
  background: #1e2235;
  border-bottom: 2px solid #00BFA5;
}

.usage-tabs .code-block {
  margin: 0;
  border: none;
  border-radius: 0;
}

@media (max-width: 768px) {
  .sdk-grid {
    grid-template-columns: 1fr;
  }
}
</style>
