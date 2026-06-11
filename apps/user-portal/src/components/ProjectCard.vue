<script setup lang="ts">
/**
 * ProjectCard.vue · 项目卡片
 * ManhuaWorks · W4 用户后台
 */

import { computed } from 'vue'
import { STATUS_META, type Project } from '@/api/project-service'

interface Props {
  project: Project
}

const props = defineProps<Props>()

defineEmits<{
  open: [id: string]
  edit: [id: string]
  archive: [id: string]
  remove: [id: string]
}>()

const meta = computed(() => STATUS_META[props.project.status])

/** 时间相对格式化 */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  if (h < 24) return `${h} 小时前`
  if (d < 30) return `${d} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}
</script>

<template>
  <article class="project-card" :class="`project-card--${project.status}`">
    <!-- 封面 -->
    <div class="project-card__cover" @click="$emit('open', project.id)">
      <img v-if="project.cover?.startsWith('http')" :src="project.cover" :alt="project.name" />
      <span v-else class="project-card__cover-emoji">{{ project.cover ?? '📁' }}</span>
      <span class="project-card__status" :style="{ color: meta.color }">
        <span class="project-card__status-dot" :style="{ background: meta.color }"></span>
        {{ meta.label }}
      </span>
    </div>

    <!-- 主体 -->
    <div class="project-card__body">
      <h3 class="project-card__name" :title="project.name">{{ project.name }}</h3>
      <p v-if="project.description" class="project-card__desc">
        {{ project.description }}
      </p>

      <!-- 标签 -->
      <div v-if="project.tags && project.tags.length > 0" class="project-card__tags">
        <span v-for="t in project.tags.slice(0, 3)" :key="t" class="project-card__tag">
          #{{ t }}
        </span>
      </div>

      <!-- 底部 -->
      <div class="project-card__footer">
        <span class="project-card__meta">
          🎬 {{ project.workCount ?? 0 }} · 🗃 {{ project.assetCount ?? 0 }}
        </span>
        <span class="project-card__time">{{ relTime(project.updatedAt) }}</span>
      </div>

      <!-- 操作 -->
      <div class="project-card__actions">
        <button type="button" class="project-card__btn project-card__btn--primary" @click="$emit('open', project.id)">
          打开
        </button>
        <button type="button" class="project-card__btn" @click="$emit('edit', project.id)">编辑</button>
        <button v-if="project.status === 'archived'" type="button" class="project-card__btn" @click="$emit('archive', project.id)">
          取消归档
        </button>
        <button v-else type="button" class="project-card__btn" @click="$emit('archive', project.id)">归档</button>
        <button type="button" class="project-card__btn project-card__btn--danger" @click="$emit('remove', project.id)">删除</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: all 250ms;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.project-card--archived {
  opacity: 0.7;
}

.project-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--accent) 20%, var(--bg-tertiary)),
    color-mix(in srgb, var(--accent-2) 25%, var(--bg-primary)));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.project-card__cover-emoji {
  font-size: 64px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
}

.project-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-card__status {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
  backdrop-filter: blur(6px);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.project-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.project-card__body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.project-card__name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-card__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.project-card__tag {
  font-size: 11px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 1px 7px;
  border-radius: 999px;
}

.project-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-secondary);
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.project-card__meta {
  font-family: monospace;
}

.project-card__time {
  opacity: 0.85;
}

.project-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.project-card__btn {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: all 200ms;
}

.project-card__btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.project-card__btn--primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.project-card__btn--primary:hover {
  background: var(--accent-deep);
  border-color: var(--accent-deep);
  color: white;
}

.project-card__btn--danger:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>