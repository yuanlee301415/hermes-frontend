<!--
LayoutMain
-->
<script setup lang="ts">
defineOptions({ name: 'LayoutMain' })
</script>

<template>
  <main>
    <RouterView v-slot="{ Component, route }">
      <transition name="fade-slide" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </RouterView>
  </main>
</template>

<style lang="less">
main {
  height: 100%;
  flex: 1;
  background-color: var(--bg-primary);
  padding: 10px;
  overflow: hidden;
}
</style>
