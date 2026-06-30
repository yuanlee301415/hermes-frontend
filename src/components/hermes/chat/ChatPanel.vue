<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import { CheckboxOutline, AddOutline, GridOutline, MenuOutline, CopyOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/modules/chat.ts'
import { SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'
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

const router = useRouter()
const chatStore = useChatStore()
const profileFilterValue = ref('')
const showSessions = ref(true)


async function handleSessionClick(sessionId: string) {
  console.log(sessionId)
  await router.push({
    name: SESSION_ROUTE_NAME,
    params: {
      sessionId
    }
  })
}
</script>

<template>
  <div class="chat-panel h-full">
    <div class="session-backdrop"></div>

    <!--================ >>>[Session list] ================-->
    <aside class="session-list" :class="{collapsed: !showSessions}">

      <div class="session-header">
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
      </div>

      <div class="session-profile">
        <n-select v-model:value="profileFilterValue" :options="profileOptions" size="small" />
      </div>

      <div v-if="showSessions" class="session-items flex-1">
        <SessionListItem
          v-for="session of chatStore.sessions"
          :key="session.id"
          :session="session"
          @select="handleSessionClick(session.id)"
        />
      </div>
    </aside>
    <!--================ [Session list]<<< ================-->

    <!--================ >>>[Chat main] ================-->
    <div class="chat-main">

      <!--============ >>>[Chat header] ============-->
      <header class="chat-header">
        <n-flex class="header-left" align="center">
          <n-button quaternary circle size="small" @click="showSessions = !showSessions">
            <template #icon>
              <n-icon size="small"><GridOutline/></n-icon>
            </template>
          </n-button>
          <h3 class="header-title">test</h3>
        </n-flex>
        <n-flex class="header-actions" align="center">
          <n-button quaternary circle size="small" title="会话大纲">
            <template #icon>
              <MenuOutline/>
            </template>
          </n-button>

          <n-button quaternary circle size="small" title="复制会话ID">
            <template #icon>
              <CopyOutline/>
            </template>
          </n-button>

          <n-button size="small">
            <template #icon>
              <AddOutline/>
            </template>
            新建对话
          </n-button>
        </n-flex>
      </header>
      <!--============ [Chat header]<<< ============-->

      <!--============ >>>[Chat content] ============-->
      <div class="chat-content-wrapper">
        <div class="chat-main-content">
          chat-main-content
        </div>
      </div>
      <!--============ [Chat content]<<< ============-->

      <!--============ >>>[Chat input] ============-->
      <div class="chat-input-area">
        chat-input-area
      </div>
      <!--============ [Chat input]<<< ============-->

    </div>
    <!--================ [Chat main]<<< ================-->

  </div>
</template>

<style scoped lang="less">
.chat-panel {
  display: flex;
  flex-direction: row;

  .session-list {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 220px;
    border-right: 1px solid var(--border-color);
    transition: width 0.25s ease, opacity 0.25s ease;
    overflow: hidden;
    &.collapsed {
      width: 0;
      border-right: none;
      opacity: 0;
      pointer-events: none;
    }

    .session-header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
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

  .chat-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-width: 0;

    .chat-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 20px;
      height: 70px;
      overflow: hidden;
      border-bottom: 1px solid var(--border-color);
      gap: 0 30px;
      .header-left {
        flex: 1;
        flex-flow: nowrap;
        overflow: hidden;
        gap: 8px;
        min-width: 0;
        .header-title {
          width: 0;
          flex: 1;
          overflow: hidden;
          font-size: 16px;
          color: var(--text-primary);
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }
      .header-actions {
        flex-flow: nowrap;
        flex-shrink: 0;
        gap: 4px;
      }
    }

    .chat-content-wrapper {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;

      .chat-main-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
    }

    .chat-input-area {
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }
  }
}
</style>
