<template>
  <main>
    <RouterView v-slot="{ Component, route }">
      <transition name="fade-slide" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </RouterView>
  </main>
</template>

<script setup lang="ts">
defineOptions({ name: 'LayoutMain' })
</script>

<style lang="less">
main {
  background-color: var(--color-background);
  padding: 10px;
  height: 100%;
  overflow: auto;
}
</style>
