<script setup lang="ts">
import type { Message } from '@/models/Session.ts'

defineProps<{ messages: Message[] }>()
</script>

<template>
  <div class="virtual-message-list-host" style="--virtual-list-padding: 20px;--virtual-row-gap: 16px;">
    <div class="virtual-message-list">
      <div v-for="(item, idx) of messages" :key="item.id" class="virtual-row">
        <slot :item="item" :idx="idx"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.virtual-message-list-host {
  flex: 1;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  display: flex;
  position: relative;
  .virtual-message-list {
    background-color: var(--bg-card);
    flex: 1;
    min-height: 0;
    min-width: 0;
    max-width: 100%;
    padding: var(--virtual-list-padding);
    overflow-y: auto;
    .virtual-row {
      min-width: 0;
      max-width: 100%;
      padding-bottom: var(--virtual-row-gap);
    }
  }
}
</style>
