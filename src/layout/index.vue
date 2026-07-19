<!--
Layout
-->
<script setup lang="ts">
import LayoutSide from './modules/LayoutSide/index.vue'
import LayoutMain from './modules/LayoutMain/index.vue'

defineOptions({ name: 'LayoutContainer' })
</script>

<template>
  <section class="layout-container">
    <LayoutSide />

    <section class="main-container">
      <LayoutMain />
    </section>
  </section>
</template>

<style scoped lang="less">
.layout-container {
  display: flex;
  width: 100%;
  height: 100%;

  .main-container {
    min-width: 0;
    height: 100%;
    flex: 1;
  }
}
</style>
