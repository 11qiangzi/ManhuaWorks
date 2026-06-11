<script setup lang="ts">
/**
 * InvoiceForm — 发票表单（弹窗）
 */
import { ref, watch } from 'vue'
import type { Order } from '@/api/admin'

const props = defineProps<{ open: boolean; order: Order | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { orderId: string; title: string; taxRate: number; type: 'company' | 'personal' }): void
}>()

const title = ref('')
const taxRate = ref(0.06)
const type = ref<'company' | 'personal'>('company')

watch(() => props.open, (v) => {
  if (v) {
    title.value = props.order?.userName ? `${props.order.userName} 发票` : ''
    taxRate.value = 0.06
    type.value = 'company'
  }
})

function submit() {
  if (!props.order) return
  emit('submit', { orderId: props.order.id, title: title.value, taxRate: taxRate.value, type: type.value })
}
</script>

<template>
  <transition name="if-fade">
    <div v-if="open && order" class="if-mask" @click.self="emit('close')">
      <div class="if-modal">
        <header class="if-head">
          <h3>开票 — {{ order.id }}</h3>
          <button class="if-close" @click="emit('close')">✕</button>
        </header>
        <div class="if-body">
          <div class="if-summary">
            <div class="if-summary-row"><span>用户</span><b>{{ order.userName }}</b></div>
            <div class="if-summary-row"><span>商品</span><b>{{ order.product }}</b></div>
            <div class="if-summary-row"><span>金额</span><b>¥{{ order.amount }} {{ order.currency }}</b></div>
          </div>

          <label class="if-field">
            <span>抬头</span>
            <input v-model="title" class="if-input" placeholder="公司名 / 个人姓名" />
          </label>

          <label class="if-field">
            <span>类型</span>
            <select v-model="type" class="if-input">
              <option value="company">企业</option>
              <option value="personal">个人</option>
            </select>
          </label>

          <label class="if-field">
            <span>税率</span>
            <input v-model.number="taxRate" type="number" step="0.01" min="0" max="1" class="if-input" />
          </label>

          <div class="if-preview">
            <div>预计税额：¥{{ (order.amount * taxRate).toFixed(2) }}</div>
            <div>价税合计：¥{{ (order.amount * (1 + taxRate)).toFixed(2) }}</div>
          </div>
        </div>
        <footer class="if-foot">
          <button class="if-btn" @click="emit('close')">取消</button>
          <button class="if-btn primary" @click="submit">确认开票</button>
        </footer>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.if-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 60; display: grid; place-items: center;
}
.if-modal {
  width: 440px; max-width: 92vw;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
}
.if-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.if-head h3 { margin: 0; font-size: 15px; }
.if-close { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; }

.if-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.if-summary { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.if-summary-row { display: flex; justify-content: space-between; }
.if-summary-row span { color: var(--text-secondary); }
.if-summary-row b { font-weight: 500; }

.if-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.if-input {
  padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
}
.if-input:focus { border-color: var(--accent); }

.if-preview { background: var(--bg-primary); border: 1px dashed var(--border); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; font-size: 12px; }

.if-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--border); }
.if-btn { padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); font-size: 13px; cursor: pointer; }
.if-btn.primary { background: var(--accent); color: white; border-color: var(--accent); }

.if-fade-enter-active, .if-fade-leave-active { transition: opacity 200ms; }
.if-fade-enter-from, .if-fade-leave-to { opacity: 0; }
</style>
