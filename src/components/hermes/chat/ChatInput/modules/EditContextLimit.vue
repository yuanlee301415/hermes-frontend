<!--
编辑上下文长度
-->
<script setup lang="ts">
defineProps<{
  // 保存中
  loading: boolean
}>()
const limit = defineModel<number>('limit')
</script>

<template>
  <div class="editing-context-limit-container">
    <n-p :depth="2">设置当前模型的上下文长度限制（token 数量）</n-p>
    <n-input-number
      v-model:value="limit"
      :min="1000"
      :max="1000 * 1000"
      :step="1000"
      placeholder="请输入上下文长度"
    >
      <template #suffix>tokens</template>
    </n-input-number>
    <n-p :depth="2">常见值：256k (Hermes 默认), 128k (GPT-4), 32k (GPT-3.5)</n-p>
  </div>
</template>
