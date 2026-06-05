<template>
  <section class="layout-container">
    <LayoutSide class="side" />

    <section class="main-container">
      <LayoutHeader />
      <LayoutMain />
    </section>
  </section>
</template>

<script setup lang="ts">
import LayoutSide from './modules/LayoutSide/index.vue'
import LayoutHeader from './modules/LayoutHeader/index.vue'
import LayoutMain from './modules/LayoutMain/index.vue'

defineOptions({ name: 'LayoutContainer' })
</script>

<style scoped lang="less">
@sideWidth: 210px;

.layout-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .side {
    position: fixed;
    width: @sideWidth;
    height: 100vh;
  }
  .main-container {
    height: 100%;
    margin-left: @sideWidth;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
</style>
