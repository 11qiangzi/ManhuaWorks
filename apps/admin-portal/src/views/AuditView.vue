<script setup lang="ts">
/**
 * AuditView — 审计日志
 * 操作流 + 筛选 + 详情
 */
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import LogFilter from '@/components/audit/LogFilter.vue'
import LogTable from '@/components/audit/LogTable.vue'

const store = useAdminStore()
onMounted(() => store.loadLogs())

function reset() {
  store.logFilter.level = ''
  store.logFilter.action = ''
  store.logFilter.actor = ''
}
</script>

<template>
  <div class="av">
    <LogFilter
      :level="store.logFilter.level"
      :action="store.logFilter.action"
      :actor="store.logFilter.actor"
      @update:level="(v) => (store.logFilter.level = v)"
      @update:action="(v) => (store.logFilter.action = v)"
      @update:actor="(v) => (store.logFilter.actor = v)"
      @reset="reset"
    />

    <div class="av-summary">
      <span>共 <b>{{ store.filteredLogs.length }}</b> 条</span>
      <span v-if="store.logFilter.level || store.logFilter.action || store.logFilter.actor" class="av-applied">已应用筛选</span>
    </div>

    <LogTable :logs="store.filteredLogs" :loading="store.logsLoading" />
  </div>
</template>

<style scoped>
.av { display: flex; flex-direction: column; gap: 14px; }
.av-summary { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
.av-summary b { color: var(--text-primary); }
.av-applied { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg-secondary); border: 1px solid var(--accent); color: var(--accent); }
</style>
