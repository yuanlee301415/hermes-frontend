<!--
对话（@2026-07-30 21:41:44）
- 批量选择 & 删除
- 新建对话
- 配置文件过滤器
- 会话列表
- 删除会话
- 右键
- 会话标题
- 会话大纲
- 复制会话ID
- 消息列表
- 输入框

Todo:
- [x] DrawerPanel（暂缓）
-->
<script lang="ts">
import { SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { Session } from '@/models/Session.ts'
import { getCodingAgentsStatusApi } from '@/api/coding-agent.ts'
import { TOOL_CODING_AGENTS_ROUTE_NAME } from '@/router/routes/modules/tool.ts'
import { batchDeleteSessions } from '@/api/sessions.ts'
import { deleteSessionApi } from '@/api/sessions.ts'
import { NewChatModel } from './modules/NewChatForm/NewChatModel.ts'
</script>

<script setup lang="ts">
import { CheckboxOutline, AddOutline, GridOutline, MenuOutline, CopyOutline, TrashBinOutline, CloseOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { useSessionPrefsStore } from '@/store/modules/session-prefs.ts'
import MessageList from '../MessageList.vue'
import SessionListItem from '../SessionListItem.vue'
import ChatInput from '../ChatInput/index.vue'
import NewChatForm from './modules/NewChatForm/index.vue'
import OutlinePanel from './modules/OutlinePanel/index.vue'
import SessionContextmenu from './modules/SessionContextmenu/index.vue'

defineOptions({ name: 'ChatPanel' })

const router = useRouter()
const chatStore = useChatStore()
const profileStore = useProfilesStore()
const appStore = useAppStore()
const sessionPrefsStore = useSessionPrefsStore()


/*
* ========================================
* 会话列表
* ========================================
* */

const showSessions = ref(true)
const outlineVisible = ref(false)

// 已置顶的会话列表（按更新时间排序）
const pinnedSessions = computed(() => sortSessionsWithActiveFirst(chatStore.sessions.filter(sess => sessionPrefsStore.isPinned(sess.id))))

// 未置顶的会话列表（按更新时间排序）
const unpinnedSessions = computed(() => sortSessionsWithActiveFirst(chatStore.sessions.filter(sess => !sessionPrefsStore.isPinned(sess.id))))


/*
* ========================================
* 新建对话
* ========================================
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

// 会话列表右键
const sessionContextmenuRef = useTemplateRef<InstanceType<typeof SessionContextmenu>>('sessionContextmenuRef')

// 批量选择
const batchSelection = reactive({
  // 启用
  enable: false,
  // 选择的会话 ID
  selectedSids: new Set<Session['id']>(),
  // 显示确认
  confirmVisible: false,
  // 删除中
  isDeleting: false
})

// 配置文件过滤器
const profileOptions = computed(() => [
    { label: '全部配置', value: ''},
    ...profileStore.profiles.map(_ => ({
      label: _.name, value: _.name
    }))
  ]
)

/**
 * 监听会话加载状态和会话ID变化，清理不存在的置顶会话记录
 */
watch(() => [chatStore.sessionsLoaded, ...chatStore.sessions.map(_ => _.id)], (value) => {
  const sids = value.slice(1) as Session['id'][]
  if (!value[0] || !sids.length) return
  sessionPrefsStore.pruneMissingSessions(sids)
}, { immediate: true })


/*
* ========================================
* 会话列表
* ========================================
* */

/**
 * 切换会话
 * - 跳转到会话页面
 * @param sessionId
 */
async function handleSwitchSession(sessionId: string) {
  await router.push({
    name: SESSION_ROUTE_NAME,
    params: {
      sessionId
    }
  })
}

/**
 * 删除会话
 * @param sid 会话 ID
 */
async function onDeleteSession(sid: Session['id']) {
  const target = chatStore.sessions.find(_ => _.id === sid)
  const ok = await deleteSessionApi(sid, target?.profile)
  if (!ok) {
    window.$message?.error('删除失败')
    return false
  }
  void chatStore.removeSession(sid)
  window.$message?.success('会话已删除')
  // 从置顶列表中移除
  sessionPrefsStore.removePinneds([sid])
}

/**
 * 处理配置文件过滤器变化
 * @param value 选中的配置文件值
 */
async function handleProfileFilterChange(value: string) {
  chatStore.sessionProfileFilter = value
  await chatStore.loadSessions(chatStore.sessionProfileFilter)
}

/**
 * 打开右键菜单
 * @param evt
 * @param sid
 */
function onSessionContextmenu(evt: MouseEvent, sid: Session['id']) {
  sessionContextmenuRef.value?.openContextmenu(evt, sid)
}

/**
 * 导航到 Markdown 中的标题
 * @param targetId DOM `id`
 */
function handleNavigate(targetId: string) {
  document.querySelector('#' + targetId)?.scrollIntoView(true)
}


/*
* ========================================
* 新建对话
* ========================================
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


/*
* ==================== 批量选择 ====================
* */

// 切换批量选择模式
function handleToggleBatchMode() {
  batchSelection.enable = !batchSelection.enable
  if (!batchSelection.enable) {
    batchSelection.confirmVisible = false
    batchSelection.selectedSids.clear()
  }
}

// 全选所有会话（排除当前活跃会话）
function handleSelectAllSessions() {
  if (batchSelection.isDeleting) return
  batchSelection.selectedSids = new Set(chatStore.sessions.flatMap(_ => chatStore.isSessionLive(_.id) ? [] : [_.id]))
}

// 确认删除
function handleBatchDeleteConfirm() {
  void batchDelete()
  return false
}

// 执行批量删除
async function batchDelete() {
  try {
    const targets = Array.from(batchSelection.selectedSids).flatMap(id => {
      const sess = chatStore.sessions.find(sess => sess.id === id)
      return sess ? [{ id: sess.id, profile: sess.profile }] : []
    })
    if (!targets.length) return

    batchSelection.isDeleting = true
    const result = await batchDeleteSessions(targets)
    if (result.deleted) {
      // 从固定列表中移除已删除的会话
      sessionPrefsStore.removePinneds([...batchSelection.selectedSids])
      // 从本地存储中移除已删除的会话（通过重新加载而非手动过滤）
      await chatStore.loadSessions(chatStore.sessionProfileFilter)
      window.$message?.success(`已删除 ${result.deleted} 个会话`)
      if (result.failed) {
        window.$message?.error(`${result.failed} 个会话删除失败`)
      }
    } else {
      throw result
    }
  } catch (e) {
    console.error(e)
    window.$message?.error(`批量删除失败`)
  } finally {
    // 重置状态
    batchSelection.isDeleting = false
    batchSelection.confirmVisible = false
    batchSelection.enable = false
    batchSelection.selectedSids.clear()
  }
}

/**
 * 切换单个会话的选择状态
 * @param sid 会话 ID
 */
function onToggleSelection(sid: Session['id']) {
  const next = new Set([...batchSelection.selectedSids])
  if (next.has(sid)) {
    next.delete(sid)
  } else {
    next.add(sid)
  }
  batchSelection.selectedSids = next
}


/*
* ========================================
* 工具方法
* ========================================
* */

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
          <!--============ >>>[批量选择] ============-->
          <n-button v-if="!batchSelection.enable" title="批量选择" quaternary circle size="tiny" @click="handleToggleBatchMode">
            <template #icon>
              <n-icon>
                <CheckboxOutline />
              </n-icon>
            </template>
          </n-button>

          <template v-else>
            <n-button :disabled="batchSelection.isDeleting" title="全选" quaternary circle size="tiny" @click="handleSelectAllSessions">
              <template #icon>
                <n-icon>
                  <CheckboxOutline />
                </n-icon>
              </template>
            </n-button>

            <n-popconfirm
              v-if="batchSelection.selectedSids.size"
              v-model:show="batchSelection.confirmVisible"
              :positive-button-props="{loading: batchSelection.isDeleting}"
              @positive-click="handleBatchDeleteConfirm"
            >
              <template #trigger>
                <n-button title="批量删除" quaternary circle size="tiny" type="error">
                  <template #icon>
                    <n-icon>
                      <TrashBinOutline />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              确定删除选择的 {{ batchSelection.selectedSids.size }} 个会话吗？
            </n-popconfirm>

            <n-button v-if="batchSelection.enable" quaternary circle size="tiny" @click="handleToggleBatchMode">
              <template #icon>
                <n-icon>
                  <CloseOutline />
                </n-icon>
              </template>
            </n-button>
          </template>
          <!--============ [批量选择]<<< ============-->

          <n-button quaternary circle size="tiny" title="新建对话" @click="handleOpenNewChat()">
            <template #icon>
              <n-icon>
                <AddOutline />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </div>

      <div class="session-profile">
        <n-select :default-value="profileOptions[0].value" :options="profileOptions" size="small" :loading="profileStore.loading" @update:value="handleProfileFilterChange" />
      </div>

      <div v-if="showSessions" class="session-items flex-1">
        <n-empty v-if="!chatStore.sessions.length"/>
        <template v-else>
          <template v-if="pinnedSessions.length">
            <div class="session-group-header session-group-header--static">
              <span class="session-group-label">已置顶</span>
              <span class="session-group-count">({{ pinnedSessions.length }})</span>
            </div>
            <SessionListItem
              v-for="session of pinnedSessions"
              :key="`pinned-${session.id}`"
              :session="session"
              :active="session.id === chatStore.activeSessionId"
              :pinned="true"
              :selectable="batchSelection.enable"
              :streaming="chatStore.isSessionLive(session.id)"
              :selected="batchSelection.selectedSids.has(session.id)"
              @switch-session="handleSwitchSession(session.id)"
              @contextmenu="onSessionContextmenu($event, session.id)"
              @toggle-select="onToggleSelection(session.id)"
              @delete="onDeleteSession(session.id)"
            />
          </template>
          <SessionListItem
            v-for="session of unpinnedSessions"
            :key="session.id"
            :session="session"
            :active="session.id === chatStore.activeSessionId"
            :pinned="false"
            :selectable="batchSelection.enable"
            :streaming="chatStore.isSessionLive(session.id)"
            :selected="batchSelection.selectedSids.has(session.id)"
            @switch-session="handleSwitchSession(session.id)"
            @contextmenu="onSessionContextmenu($event, session.id)"
            @toggle-select="onToggleSelection(session.id)"
            @delete="onDeleteSession(session.id)"
          />

        </template>
      </div>
    </aside>
    <!--================ [Session list]<<< ================-->

    <!--================ >>>[Chat main] ================-->
    <div class="chat-main">

      <!--============ >>>[Chat header] ============-->
      <header class="chat-header">
        <div class="header-left">
          <n-button quaternary circle size="small" @click="showSessions = !showSessions">
            <template #icon>
              <n-icon size="small"><GridOutline/></n-icon>
            </template>
          </n-button>
          <h3 class="header-session-title">{{ chatStore.activeSession?.title }}</h3>
          <span v-if="chatStore.activeSession?.workspace" class="workspace-badge">📁{{chatStore.activeSession.workspace.split('/').pop() || chatStore.activeSession.workspace}}</span>
        </div>

        <n-flex class="header-actions" align="center" :size="8">
          <n-button quaternary circle size="small" title="会话大纲" @click="outlineVisible = !outlineVisible">
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
        <div class="chat-outline" v-if="outlineVisible">
          <OutlinePanel @navigate="handleNavigate"/>
        </div>
      </div>
      <!--============ [Chat content]<<< ============-->

      <!--============ >>>[Chat input] ============-->
      <ChatInput/>
      <!--============ [Chat input]<<< ============-->

    </div>
    <!--================ [Chat main]<<< ================-->


    <!--================ >>>[新建对话》抽屉] ================-->
    <n-drawer v-model:show="newChatVisible" width="min(440px, 100vw)" placement="right">
      <n-drawer-content closable>
        <template #header>新建对话</template>
        <div class="new-chat-content">
          <NewChatForm :model="newChatModel" ref="newChatFormRef"/>
        </div>
        <template #footer>
          <n-flex :size="10">
            <n-button @click="newChatVisible = false">取消</n-button>
            <n-button type="primary" size="medium" :disabled="!canConfirmNewChat" @click="handleConfirmNewChat">新建对话</n-button>
          </n-flex>
        </template>
      </n-drawer-content>
    </n-drawer>
    <!--================ [新建对话》抽屉]<<< ================-->

    <!--================ >>>[右键菜单] ================-->
    <SessionContextmenu ref="sessionContextmenuRef" />
    <!--================ [右键菜单]]<<< ================-->

  </div>
</template>

<style scoped lang="less">
@import "style";
</style>
