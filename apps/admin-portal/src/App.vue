<script setup lang="ts">
// W2 5 主题适配
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

const store = useAdminStore()
onMounted(() => store.initTheme())
</script>

<template>
  <router-view />
</template>
