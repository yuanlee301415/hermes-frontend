<script setup lang="ts">

defineProps<{
  content?: string
}>()
</script>

<template>
  <div class="markdown-body">
    <pre>{{ content }}</pre>
  </div>
</template>

<style scoped lang="less">

</style>
