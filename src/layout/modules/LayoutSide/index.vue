<template>
  <aside>
    <nav>
      <Menu />
    </nav>
  </aside>
</template>

<script setup lang="ts">
import Menu from '@/layout/modules/Menu/index.vue'

defineOptions({ name: 'LayoutSide' })
</script>

<style scoped lang="less">
nav {
  margin: 10px 0;
  overflow-y: auto;
  user-select: none;
}
</style>
