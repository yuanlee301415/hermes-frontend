<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import { CheckboxOutline, AddOutline } from '@vicons/ionicons5'
import { useChatStore } from '@/store/modules/chat.ts'
import SessionListItem from './SessionListItem.vue'

const profileOptions: SelectOption[] = [
  {
    label: '全部配置',
    value: ''
  },
  {
    label: 'default',
    value: 'default'
  }
]

const chatStore = useChatStore()
const profileFilterValue = ref('')

</script>

<template>
  <div class="chat-panel flex-row h-full">
    <div class="session-backdrop"></div>
    <aside class="session-list flex-col">

      <n-flex class="session-header" justify="space-between" align="center">
        <n-text strong>会话</n-text>
        <n-flex justify="center" align="center" :size="5">
          <n-button quaternary circle size="small">
            <template #icon>
              <n-icon size="15">
                <CheckboxOutline />
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle size="small">
            <template #icon>
              <n-icon size="15">
                <AddOutline />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>

      <div class="session-profile">
        <n-select v-model:value="profileFilterValue" :options="profileOptions" size="small" />
      </div>

      <div class="session-items flex-1">
        <SessionListItem
          v-for="session of chatStore.sessions"
          :key="session.id"
          :session="session"
        />
      </div>
    </aside>

    <div class="chat-main flex-1 flex-col">
      <header class="chat-header">
        Header
      </header>

      <div class="chat-content-wrapper flex-1">
        Wrapper
      </div>

      <div class="chat-input-area">
        Input
      </div>

    </div>
  </div>
</template>

<style scoped lang="less">
.chat-panel {
  .session-list {
    width: 220px;
    border-right: 1px solid var(--border-color);
    flex-shrink: 0;
    transition: width 0.25s ease, opacity 0.25s ease;
    overflow: hidden;

    .session-header {
      padding: 10px;

    }

    .session-profile {
      padding: 0 10px;
      margin-bottom: 10px;
    }

    .session-items {
      overflow-y: auto;
      padding: 0 6px 10px;
      margin-bottom: 3px;
    }
  }

}
</style>
