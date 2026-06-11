<script setup lang="ts">
/**
 * OrderTable — 订单列表
 */
import type { Order } from '@/api/admin'

defineProps<{ orders: Order[]; loading?: boolean }>()
const emit = defineEmits<{ (e: 'refund', order: Order): void; (e: 'invoice', order: Order): void }>()

function statusTag(s: string) {
  return `ost-${s}`
}
</script>

<template>
  <div class="ot-wrap">
    <div v-if="loading" class="ot-loading">加载中…</div>
    <table v-else class="ot-table">
      <thead>
        <tr>
          <th>订单号</th>
          <th>用户</th>
          <th>商品</th>
          <th class="num">金额</th>
          <th>状态</th>
          <th>时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in orders" :key="o.id">
          <td class="mono">{{ o.id }}</td>
          <td>{{ o.userName }}</td>
          <td>{{ o.product }}</td>
          <td class="num">¥{{ o.amount }} <span class="cur">{{ o.currency }}</span></td>
          <td><span class="ot-pill" :class="statusTag(o.status)">{{ o.status }}</span></td>
          <td class="dim">{{ new Date(o.createdAt).toLocaleString() }}</td>
          <td>
            <div class="ot-actions">
              <button v-if="o.status === 'paid' && !o.invoiceId" class="ot-btn" @click="emit('invoice', o)">开票</button>
              <button v-if="o.status === 'paid'" class="ot-btn danger" @click="emit('refund', o)">退款</button>
              <span v-if="o.invoiceId" class="ot-inv">📄 {{ o.invoiceId }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ot-wrap { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; }
.ot-loading { padding: 40px; text-align: center; opacity: 0.6; }
.ot-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ot-table th { text-align: left; padding: 12px 14px; background: var(--bg-primary); font-weight: 500; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
.ot-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.ot-table tr:last-child td { border-bottom: none; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.dim { color: var(--text-secondary); font-size: 12px; }
.mono { font-family: monospace; font-size: 12px; }
.cur { color: var(--text-secondary); font-size: 11px; margin-left: 2px; }

.ot-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: var(--bg-primary); border: 1px solid var(--border); text-transform: uppercase; }
.ot-pill.ost-paid { color: var(--success); border-color: var(--success); }
.ot-pill.ost-refunded { color: var(--warning); border-color: var(--warning); }
.ot-pill.ost-pending { color: var(--info); border-color: var(--info); }
.ot-pill.ost-failed { color: var(--danger); border-color: var(--danger); }

.ot-actions { display: flex; gap: 6px; align-items: center; }
.ot-btn { padding: 4px 10px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); font-size: 12px; cursor: pointer; }
.ot-btn:hover { border-color: var(--accent); color: var(--accent); }
.ot-btn.danger:hover { border-color: var(--danger); color: var(--danger); }
.ot-inv { font-size: 11px; color: var(--text-secondary); font-family: monospace; }
</style>
