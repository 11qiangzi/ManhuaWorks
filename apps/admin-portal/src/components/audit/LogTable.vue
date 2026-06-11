<script setup lang="ts">
/**
 * LogTable — 审计日志表格
 */
import type { AuditLog } from '@/api/admin'
import { ref } from 'vue'

defineProps<{ logs: AuditLog[]; loading?: boolean }>()

const expanded = ref<string | null>(null)
function toggle(id: string) { expanded.value = expanded.value === id ? null : id }

function levelClass(l: string) { return `lv-${l}` }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div class="lt-wrap">
    <div v-if="loading" class="lt-loading">加载中…</div>
    <table v-else-if="logs.length" class="lt-table">
      <thead>
        <tr>
          <th class="w-time">时间</th>
          <th class="w-lv">级别</th>
          <th>操作</th>
          <th>操作人</th>
          <th>目标</th>
          <th>IP</th>
          <th class="w-act">详情</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="l in logs" :key="l.id">
          <tr class="lt-row" @click="toggle(l.id)">
            <td class="mono dim">{{ fmtTime(l.ts) }}</td>
            <td><span class="lt-pill" :class="levelClass(l.level)">{{ l.level }}</span></td>
            <td class="mono">{{ l.action }}</td>
            <td>{{ l.actor }}</td>
            <td class="mono dim">{{ l.target }}</td>
            <td class="mono dim">{{ l.ip }}</td>
            <td><button class="lt-btn">{{ expanded === l.id ? '收起' : '展开' }}</button></td>
          </tr>
          <tr v-if="expanded === l.id" class="lt-detail">
            <td colspan="7">
              <pre class="lt-pre">{{ l.detail }}</pre>
              <div class="lt-meta">日志 ID: {{ l.id }} · 时间戳: {{ l.ts }}</div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-else class="lt-empty">无匹配日志</div>
  </div>
</template>

<style scoped>
.lt-wrap { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.lt-loading, .lt-empty { padding: 40px; text-align: center; opacity: 0.6; }

.lt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lt-table th { text-align: left; padding: 10px 12px; background: var(--bg-primary); font-weight: 500; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
.lt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.w-time { width: 160px; }
.w-lv { width: 70px; }
.w-act { width: 80px; }

.lt-row { cursor: pointer; transition: background 120ms; }
.lt-row:hover { background: var(--bg-primary); }

.mono { font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }
.dim { color: var(--text-secondary); }

.lt-pill { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.lt-pill.lv-info { color: var(--info); background: rgba(96, 165, 250, 0.12); }
.lt-pill.lv-warn { color: var(--warning); background: rgba(251, 191, 36, 0.12); }
.lt-pill.lv-error { color: var(--danger); background: rgba(248, 113, 113, 0.12); }

.lt-btn { padding: 3px 8px; border-radius: 4px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); font-size: 11px; cursor: pointer; }
.lt-btn:hover { color: var(--accent); border-color: var(--accent); }

.lt-detail { background: var(--bg-primary); }
.lt-pre { margin: 0; padding: 10px 12px; background: var(--code-bg, #14161a); border-radius: 6px; color: var(--text-primary); font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.lt-meta { font-size: 11px; color: var(--text-secondary); padding: 6px 12px 0; font-family: monospace; }
</style>
