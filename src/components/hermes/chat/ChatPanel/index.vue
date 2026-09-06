<!--
对话
Todo:
- [ ] header actions
- [ ] 迁移 `/shard` 到 `/chat` 目录下
-->
<script lang="ts">
import type { SelectOption } from 'naive-ui'
import { SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { Session } from '@/models/Session.ts'
import { NewChatModel } from './modules/NewChatForm/index.ts'
import { getCodingAgentsStatusApi } from '@/api/coding-agent.ts'
import { TOOL_CODING_AGENTS_ROUTE_NAME } from '@/router/routes/modules/tool.ts'
</script>

<script setup lang="ts">
import { CheckboxOutline, AddOutline, GridOutline, MenuOutline, CopyOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import MessageList from '../MessageList.vue'
import SessionListItem from '../SessionListItem.vue'
import ChatInput from '../ChatInput/index.vue'
import NewChatForm from './modules/NewChatForm/index.vue'

defineOptions({ name: 'ChatPanel' })

const profileOptions: SelectOption[] = [
  {
    label: '全部配置',
    value: ''
  },
  {
    label: DEFAULT_PROFILE_NAME,
    value: DEFAULT_PROFILE_NAME
  }
]

const router = useRouter()
const chatStore = useChatStore()
const profileStore = useProfilesStore()
const appStore = useAppStore()
const profileFilterValue = ref('')
const showSessions = ref(true)

/*
* ==================== 新建对话 ====================
* */

const newChatVisible = ref(false)
const newChatLoading = ref(true)
const newChatModel = reactive<NewChatModel>({} as NewChatModel)
const newChatFormRef = ref<InstanceType<typeof NewChatForm> | null>()
const canConfirmNewChat = computed(() => {
  if (!newChatModel.profile) return false
  if (!newChatModel.provider) return false
  if (!newChatFormRef.value?.usersProviderModel) return true
  if (!newChatModel.provider || !newChatModel.model) return false
  if (!newChatFormRef.value?.isCodingAgent) return true
  if (!newChatModel.apiMode) return false
  if (!newChatModel.baseUrl.trim()) return false
  if (!newChatModel.apiKey.trim()) return false
  return true
})

async function handleSessionClick(sessionId: string) {
  await router.push({
    name: SESSION_ROUTE_NAME,
    params: {
      sessionId
    }
  })
}

/*
* ==================== 新建对话 ====================
* */

// 打开“新建对话”弹窗
async function handleOpenNewChat() {
  newChatVisible.value = true
  newChatLoading.value = true
  try {
    await Promise.all([
      !profileStore.profiles.length && profileStore.fetchProfiles(),
      !(appStore.modelGroups.length || appStore.profileModelGroups.length) && appStore.loadModels()
    ])
    // 重置工作区
    newChatModel.workspace = ''
    // 设置默认配置文件（优先使用活跃配置文件）
    newChatModel.profile = profileStore.activeProfileName || profileStore.profiles.find(_ => _.active)?.name || profileStore.profiles[0]?.name || DEFAULT_PROFILE_NAME
  } finally {
    newChatLoading.value = false
  }
}

// 确认“新建对话”
async function handleConfirmNewChat() {
  // console.warn('handleConfirmNewChat')
  // console.table(newChatModel)
  // 如果选择的是编码代理（非Hermes），检查是否已安装
  if (newChatModel.agent !== Session.AGENT_TYPE.Hermes) {
    newChatLoading.value = true
    try {
      const agentId = newChatModel.agent
      const status = await getCodingAgentsStatusApi()
      const tool = status.tools.find(_ => _.id === agentId)
      if (!tool?.installed) {
        const fallbackName = agentId === Session.CODING_AGENT_ID.Codex ? 'Codex' : 'Claude Code'
        window.$message?.warning(`${fallbackName} 未安装，请先安装后再创建会话。`)
        newChatVisible.value = false
        await router.push({ name: TOOL_CODING_AGENTS_ROUTE_NAME })
        return
      }
    } catch (e) {
      console.error(e)
    } finally {
      newChatLoading.value = false
    }
  }

  // 构建会话参数
  const group = newChatFormRef.value?.selectedProviderGroup
  const source = newChatModel.agent == Session.AGENT_TYPE.Hermes ? Session.SOURCE.Cli : Session.SOURCE.CodingAgent
  const isCodingAgent = source === Session.SOURCE.CodingAgent
  const isGlobalAgent = isCodingAgent && newChatModel.codingAgentMode === Session.CODING_AGENT_MODE.Global
  const agent = newChatModel.agent === Session.AGENT_TYPE.Codex
    ? Session.AGENT_TYPE.Codex
    : newChatModel.agent === Session.CODING_AGENT_ID.ClaudeCode
      ? Session.CODING_AGENT_ID.ClaudeCode
      : Session.AGENT_TYPE.Hermes

  // 创建新会话
  const session = chatStore.newChat({
      profile: newChatModel.profile,
      provider: isGlobalAgent ? undefined : newChatModel.provider,
      model: isGlobalAgent ? undefined : newChatModel.model,
      source,
      agent,
      codingAgentId: newChatModel.agent === Session.AGENT_TYPE.Hermes ? undefined : newChatModel.agent,
      codingAgentMode: isCodingAgent ? newChatModel.codingAgentMode : undefined,
      workspace: newChatModel.workspace,
      baseUrl: isCodingAgent && !isGlobalAgent ? group?.base_url || newChatModel.baseUrl.trim() || undefined : undefined,
      apiKey: isCodingAgent && !isGlobalAgent ? group?.api_key || newChatModel.apiKey.trim() || undefined : undefined,
      apiMode: isCodingAgent && !isGlobalAgent ? newChatModel.apiMode : undefined
    }
  )

  // 跳转到新会话页面
  await router.push({
    name: SESSION_ROUTE_NAME,
    params: {
      sessionId: session.id
    }
  })

  newChatVisible.value = false
}

/**
 * 将会话按更新时间降序排序（最新的在前）
 * @param items 会话数组
 * @returns 排序后的会话数组
 */
function sortSessionsWithActiveFirst(items: Session[]): Session[] {
  return [...items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
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
          <n-button quaternary circle size="small" @click="handleOpenNewChat()">
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
          v-for="session of sortSessionsWithActiveFirst(chatStore.sessions)"
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
          <h3 class="header-session-title">{{ chatStore.activeSession?.title }}</h3>
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

          <n-button size="small" @click="handleOpenNewChat()">
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


    <!--================ >>>[新建对话》抽屉] ================-->
    <n-drawer v-model:show="newChatVisible" width="min(440px, 100vw)" placement="left">
      <n-drawer-content closable>
        <template #header>新建对话</template>
        <div class="new-chat-content">
          <NewChatForm :model="newChatModel" ref="newChatFormRef"/>
        </div>
        <template #footer>
          <n-flex :size="10">
            <n-button>取消</n-button>
            <n-button type="primary" size="medium" :disabled="!canConfirmNewChat" @click="handleConfirmNewChat">新建对话</n-button>
          </n-flex>
        </template>
      </n-drawer-content>
    </n-drawer>
    <!--================ [新建对话》抽屉]<<< ================-->

  </div>
</template>

<style scoped lang="less">
@import "style";
</style>
