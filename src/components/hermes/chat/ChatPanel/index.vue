<!--
对话
Todo:
- [ ] header actions
-->
<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import { CheckboxOutline, AddOutline, GridOutline, MenuOutline, CopyOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/modules/chat.ts'
import { SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'
import MessageList from '../MessageList.vue'
import SessionListItem from '../SessionListItem.vue'
import ChatInput from '../ChatInput/index.vue'

defineOptions({ name: 'ChatPanel' })

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

const activeSessionTitle = computed(() => chatStore.activeSession?.title ?? '新对话')

async function handleSessionClick(sessionId: string) {
  console.log('handleSessionClick:', { sessionId })
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
          :active="session.id === chatStore.activeSessionId"
          @select="handleSessionClick(session.id)"
        />
      </div>
    </aside>
    <!--================ [Session list]<<< ================-->

    <!--================ >>>[Chat main] ================-->
    <div class="chat-main">

      <!--============ >>>[Chat header] ============-->
      <header class="chat-header">
        <n-flex class="header-left" align="center" :size="8">
          <n-button quaternary circle size="small" @click="showSessions = !showSessions">
            <template #icon>
              <n-icon size="small"><GridOutline/></n-icon>
            </template>
          </n-button>
          <h3 class="header-session-title">{{ activeSessionTitle }}</h3>
        </n-flex>

        <n-flex class="header-actions" align="center" :size="8">
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
          <MessageList ref="messageListRef" />
        </div>
      </div>
      <!--============ [Chat content]<<< ============-->

      <!--============ >>>[Chat input] ============-->
      <ChatInput/>
      <!--============ [Chat input]<<< ============-->

    </div>
    <!--================ [Chat main]<<< ================-->

  </div>
</template>

<style scoped lang="less">
@import "style";
</style>
