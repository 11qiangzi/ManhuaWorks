<script setup lang="ts">
/**
 * PageTransition - Vue <Transition> 包装
 * 用法:
 *   <PageTransition name="page-fade" mode="out-in">
 *     <component :is="..." />
 *   </PageTransition>
 */
interface Props {
  name?: string
  mode?: 'in-out' | 'out-in' | 'default'
  appear?: boolean
}

withDefaults(defineProps<Props>(), {
  name: 'page-fade',
  mode: 'out-in',
  appear: true
})
</script>

<template>
  <Transition :name="name" :mode="mode" :appear="appear">
    <slot />
  </Transition>
</template>
