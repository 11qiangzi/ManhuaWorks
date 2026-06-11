<script setup lang="ts">
/**
 * UsersView — 用户管理
 * 搜索 + 表格 + 详情抽屉 + 启用/禁用
 */
import { onMounted, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import type { User } from '@/api/admin'
import UserTable from '@/components/users/UserTable.vue'
import UserDetail from '@/components/users/UserDetail.vue'

const store = useAdminStore()
onMounted(() => store.loadUsers())

const selected = ref<User | null>(null)
const drawerOpen = ref(false)

function onSelect(u: User) {
  selected.value = u
  drawerOpen.value = true
}
function onClose() {
  drawerOpen.value = false
}
async function onToggle(u: User) {
  await store.toggleUser(u.id)
  if (selected.value?.id === u.id) {
    selected.value = { ...selected.value, status: u.status === 'active' ? 'disabled' : 'active' }
  }
}
</script>

<template>
  <div class="uv">
    <div class="uv-head">
      <div class="uv-search">
        <span class="uv-search-icon">🔍</span>
        <input
          v-model="store.userQuery"
          placeholder="搜索用户名或邮箱…"
          class="uv-search-input"
        />
      </div>
      <div class="uv-stat">
        共 <b>{{ store.filteredUsers.length }}</b> / {{ store.users.length }} 用户
      </div>
    </div>

    <UserTable
      :users="store.filteredUsers"
      :loading="store.usersLoading"
      @select="onSelect"
      @toggle="onToggle"
    />

    <UserDetail
      :user="selected"
      :open="drawerOpen"
      @close="onClose"
      @toggle="onToggle"
    />
  </div>
</template>

<style scoped>
.uv { display: flex; flex-direction: column; gap: 16px; }
.uv-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.uv-search { position: relative; flex: 1; max-width: 400px; }
.uv-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
.uv-search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border 150ms;
}
.uv-search-input:focus { border-color: var(--accent); }
.uv-stat { font-size: 13px; color: var(--text-secondary); }
.uv-stat b { color: var(--text-primary); }
</style>
