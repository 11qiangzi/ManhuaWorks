<template>
  <div class="min-h-screen bg-base-100 text-base-content p-8">
    <div class="max-w-2xl mx-auto">
      <div class="card bg-base-200 p-6">
        <h1 class="text-3xl font-bold mb-4">{{ title }}</h1>
        <div class="badge badge-warning mb-4">{{ pending }} 待补</div>
        <p class="opacity-70">{{ description }}</p>
        <div class="mt-6 flex gap-2">
          <router-link to="/workflow" class="btn btn-primary btn-sm">
            🔀 去工作流设计面板
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '占位')
const pending = computed(() => (route.meta.pending as string) || 'W3')
const description = computed(() => `W3 林染在 apps/studio/ 应交付此页面。W5 阶段 1 修补版用占位页代替，等后续补全。`)
</script>
