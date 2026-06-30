<!--
Todo:
- [ ] 会话创建时间
-->
<script setup lang="ts">
import type { Session } from '@/models/Session.ts'

const props = defineProps<{
  session: Session
  to?: string
}>()

const emit = defineEmits<{
  (e: 'select'): void
}>()

function handleClick(event: MouseEvent) {
  if (props.to) event?.preventDefault()
  emit('select')
}

</script>

<template>
  <a
    class="session-item flex-row"
    @click="handleClick"
  >
    <div class="session-item-content flex-1">
      <n-text strong class="session-title">
        <n-ellipsis>{{ session.title }}</n-ellipsis>
      </n-text>

      <n-flex class="session-agent" align="center" :size="6">
        <n-avatar src="/coding-agents/hermes.png" round :size="18" />
        <n-text :title="session.agent" depth="3" class="flex-1 overflow-hidden">
          <n-ellipsis :tooltip="false">{{ session.agent }}</n-ellipsis>
        </n-text>
      </n-flex>

      <n-flex class="session-meta" align="center" :size="6">
        <n-text :title="session.model" depth="2" class="flex-1 overflow-hidden" style="max-width: 100px;">
          <n-ellipsis :tooltip="false">{{ session.model }}</n-ellipsis>
        </n-text>
        <n-text depth="3">{{ session.createdAt }}</n-text>
      </n-flex>

      <n-flex class="session-profile" align="center" :size="5">
        <SvgIcon icon="Profile" />
        <n-text :title="session.profile" depth="3" class="flex-1 overflow-hidden">
          <n-ellipsis :tooltip="false">{{ session.profile }}</n-ellipsis>
        </n-text>
      </n-flex>
    </div>

    <n-text depth="2" class="session-item-delete">&times;</n-text>
  </a>
</template>

<style scoped lang="less">
.session-item {
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover, &.active {
    background-color: rgba(var(--accent-primary-rgb), .12);
  }

  .session-item-content {
    overflow: hidden;

    .session-agent, .session-meta, .session-profile {
      font-size: 12px;
    }

    .session-title {

    }

    .session-agent {
      margin-top: 4px;
    }

    .session-meta {
      margin-top: 2px;
    }

    .session-profile {
      margin-top: 4px;
    }
  }

  .session-item-delete {
    font-size: 12px;

    &:hover {
      color: var(--error);
    }
  }
}
</style>
