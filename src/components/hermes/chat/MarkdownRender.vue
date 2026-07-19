<script setup lang="ts">

withDefaults(defineProps<{
    content: string
    // 标题 ID 前缀，用于区分不同消息的锚点
    headingIdPrefix?: string
  }>(),
  {
    headingIdPrefix: '',
  }
)
</script>

<template>
  <div class="markdown-body">
    <pre>{{ content }}</pre>
  </div>
</template>

<style scoped lang="less">

</style>
