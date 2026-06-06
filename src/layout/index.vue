<template>
  <section class="layout-container">
    <LayoutSide class="side-container" />

    <section class="main-container">
      <LayoutMain />
    </section>
  </section>
</template>

<script setup lang="ts">
import LayoutSide from './modules/LayoutSide/index.vue'
import LayoutMain from './modules/LayoutMain/index.vue'

defineOptions({ name: 'LayoutContainer' })
</script>

<style scoped lang="less">
@sideWidth: 240px;

.layout-container {
  display: flex;
  width: 100%;
  height: 100%;

  .side-container {
    width: @sideWidth;
    height: 100vh;
    overflow: hidden;
  }
  .main-container {
    height: 100%;
    flex: 1;
  }
}
</style>
