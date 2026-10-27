<script setup lang="ts">
/**
 * HelpView.vue · 帮助中心
 * P1-1 · 文档与帮助资源
 */

import { ref } from 'vue'

const expandedItem = ref<string | null>(null)

/** Simple toast */
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2500)
}

function toggleHelpItem(label: string) {
  if (expandedItem.value === label) {
    expandedItem.value = null
  } else {
    expandedItem.value = label
    showToast('帮助文章即将上线')
  }
}

const sections = [
  {
    title: '快速开始',
    icon: '🚀',
    items: [
      { label: '新手引导', desc: '5 分钟了解千机工坊核心功能' },
      { label: '创建第一个项目', desc: '从选题到发布的完整流程' },
      { label: '常见问题', desc: '高频问题与解答汇总' },
    ]
  },
  {
    title: '创作工具',
    icon: '🎨',
    items: [
      { label: '动画生成器使用指南', desc: '镜头编辑、角色设定、AI 绘图' },
      { label: '故事生成器使用指南', desc: '剧本创作、AI 续写、对话生成' },
      { label: '配乐生成器使用指南', desc: 'AI 配乐、音色选择、混音导出' },
    ]
  },
  {
    title: '账户与订阅',
    icon: '💳',
    items: [
      { label: '订阅方案说明', desc: '免费版、专业版、企业版对比' },
      { label: 'BYOK 自带密钥', desc: '配置自有 AI 模型密钥' },
      { label: '团队管理', desc: '邀请成员、权限分配、协作设置' },
    ]
  },
]
</script>

<template>
  <div class="help-page">
    <!-- Header -->
    <header class="help-page__header">
      <div class="help-page__header-inner">
        <h1>帮助中心</h1>
        <p>查找帮助文档、使用教程和常见问题解答</p>
        <div class="help-page__search">
          <span>🔍</span>
          <input type="text" placeholder="搜索帮助文档..." />
        </div>
      </div>
    </header>

    <!-- Sections -->
    <div class="help-page__body">
      <section v-for="section in sections" :key="section.title" class="help-section">
        <h2>
          <span>{{ section.icon }}</span>
          {{ section.title }}
        </h2>
        <div class="help-section__list">
          <a
            v-for="item in section.items"
            :key="item.label"
            href="#"
            class="help-item"
            :class="{ 'help-item--expanded': expandedItem === item.label }"
            @click.prevent="toggleHelpItem(item.label)"
          >
            <div>
              <h3>{{ item.label }}</h3>
              <p>{{ item.desc }}</p>
              <p v-if="expandedItem === item.label" class="help-item__coming-soon">
                帮助文章即将上线，敬请期待
              </p>
            </div>
            <span class="help-item__arrow" :class="{ 'help-item__arrow--open': expandedItem === item.label }">→</span>
          </a>
        </div>
      </section>
    </div>

    <!-- Toast notification -->
    <Transition name="toast-fade">
      <div v-if="toastMsg" class="help-toast">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.help-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.help-page__header {
  background: linear-gradient(135deg, rgba(0, 191, 165, 0.12), rgba(124, 58, 237, 0.12));
  border-bottom: 1px solid var(--border);
  padding: 48px 32px 36px;
  text-align: center;
}

.help-page__header-inner {
  max-width: 900px;
  margin: 0 auto;
}

.help-page__header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
}

.help-page__header p {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 20px;
}

.help-page__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 16px;
  height: 42px;
  max-width: 480px;
  margin: 0 auto;
}

.help-page__search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.help-page__search input::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.help-page__body {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.help-section {
  margin-bottom: 36px;
}

.help-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-section h2 span:first-child {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-elevated, #23262E);
  font-size: 16px;
  flex-shrink: 0;
}

.help-section__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: all 200ms;
}

.help-item:hover {
  border-color: var(--accent, #00BFA5);
  transform: translateX(4px);
}

.help-item h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 3px;
}

.help-item p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.help-item__arrow {
  margin-left: auto;
  font-size: 16px;
  color: var(--text-secondary);
  transition: color 200ms;
}

.help-item:hover .help-item__arrow {
  color: var(--accent, #00BFA5);
}

.help-item--expanded {
  border-color: var(--accent, #00BFA5);
  background: color-mix(in srgb, var(--accent, #00BFA5) 6%, var(--bg-secondary));
}

.help-item__arrow--open {
  transform: rotate(90deg);
  color: var(--accent, #00BFA5);
}

.help-item__coming-soon {
  margin-top: 8px !important;
  padding: 8px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent, #00BFA5) 10%, transparent);
  color: var(--accent, #00BFA5) !important;
  font-size: 12px;
  font-weight: 500;
}

/* ===== Toast notification ===== */
.help-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 10px;
  background: rgba(0, 191, 165, 0.92);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  pointer-events: none;
}

.toast-fade-enter-active {
  transition: all 0.3s ease;
}

.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
