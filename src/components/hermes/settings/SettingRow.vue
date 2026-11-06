<!--
Platform 配置
- Platform 配置名称
- Platform 提示
- Platform 配置表单项插槽
-->
<script setup lang="ts">
defineProps<{
  label: string
  hit?: string
}>()
</script>

<template>
  <n-flex class="setting-row" justify="space-between" align="center">
    <div class="setting-info">
      <label class="setting-label">{{label}}</label>
      <p v-if="hit" class="setting-hit">{{ hit }}</p>
    </div>

    <div class="setting-control">
      <slot/>
    </div>
  </n-flex>
</template>

<style scoped lang="less">
.setting-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);

  .setting-info {
    flex: 1;
    margin-right: 16px;
    .setting-label {
      font-size: 13px;
      color: var(--text-primary);
      display: block;
    }
    .setting-hit {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

  }
  .setting-control {
    flex-shrink: 0;
  }
}
</style>
