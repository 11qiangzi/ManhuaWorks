<script setup lang="ts">
/**
 * UserDetail — 用户详情侧滑抽屉
 */
import type { User } from '@/api/admin'

const props = defineProps<{ user: User | null; open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle', user: User): void
}>()

function close() { emit('close') }
function toggle() { if (props.user) emit('toggle', props.user) }
</script>

<template>
  <transition name="ud-slide">
    <div v-if="open && user" class="ud-mask" @click.self="close">
      <aside class="ud-drawer">
        <header class="ud-head">
          <div class="ud-head-left">
            <span class="ud-avatar">{{ user.name.charAt(0) }}</span>
            <div>
              <h3 class="ud-name">{{ user.name }}</h3>
              <p class="ud-id">ID · {{ user.id }}</p>
            </div>
          </div>
          <button class="ud-close" @click="close">✕</button>
        </header>

        <section class="ud-section">
          <h4 class="ud-h">账号</h4>
          <div class="ud-row"><span>邮箱</span><b>{{ user.email }}</b></div>
          <div class="ud-row"><span>套餐</span><b class="accent">{{ user.plan.toUpperCase() }}</b></div>
          <div class="ud-row"><span>状态</span><b :class="user.status === 'active' ? 'ok' : 'bad'">{{ user.status }}</b></div>
        </section>

        <section class="ud-section">
          <h4 class="ud-h">资产</h4>
          <div class="ud-row"><span>积分</span><b>{{ user.credits.toLocaleString() }}</b></div>
          <div class="ud-row"><span>累计消费</span><b>¥{{ user.totalSpent }}</b></div>
        </section>

        <section class="ud-section">
          <h4 class="ud-h">时间</h4>
          <div class="ud-row"><span>注册时间</span><b>{{ new Date(user.createdAt).toLocaleString() }}</b></div>
          <div class="ud-row"><span>最近登录</span><b>{{ new Date(user.lastLogin).toLocaleString() }}</b></div>
        </section>

        <footer class="ud-foot">
          <button class="ud-btn primary" @click="toggle">
            {{ user.status === 'active' ? '禁用账号' : '启用账号' }}
          </button>
        </footer>
      </aside>
    </div>
  </transition>
</template>

<style scoped>
.ud-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}
.ud-drawer {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
}
.ud-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.ud-head-left { display: flex; align-items: center; gap: 12px; }
.ud-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: white; display: grid; place-items: center; font-size: 16px; font-weight: 600; }
.ud-name { margin: 0; font-size: 16px; }
.ud-id { margin: 2px 0 0; font-size: 11px; color: var(--text-secondary); font-family: monospace; }
.ud-close { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 18px; padding: 4px 8px; }
.ud-close:hover { color: var(--text-primary); }

.ud-section { padding: 16px 20px; border-bottom: 1px solid var(--border); }
.ud-h { font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin: 0 0 10px; letter-spacing: 0.5px; }
.ud-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.ud-row span { color: var(--text-secondary); }
.ud-row b { font-weight: 500; }
.ud-row .accent { color: var(--accent); }
.ud-row .ok { color: var(--success); }
.ud-row .bad { color: var(--danger); }

.ud-foot { padding: 18px 20px; margin-top: auto; border-top: 1px solid var(--border); }
.ud-btn { width: 100%; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 14px; }
.ud-btn.primary { background: var(--accent); color: white; border-color: var(--accent); }
.ud-btn:hover { opacity: 0.9; }

.ud-slide-enter-active, .ud-slide-leave-active { transition: opacity 200ms; }
.ud-slide-enter-from, .ud-slide-leave-to { opacity: 0; }
.ud-slide-enter-active .ud-drawer, .ud-slide-leave-active .ud-drawer { transition: transform 240ms; }
.ud-slide-enter-from .ud-drawer, .ud-slide-leave-to .ud-drawer { transform: translateX(100%); }
</style>
