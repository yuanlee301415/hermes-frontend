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
import { type ContextmenuKey, CONTEXTMENU_KEYS, generateContextmenuOptions, sortSessionsWithActiveFirst } from './index.ts'
import { renameSessionApi, setSessionWorkspaceApi, exportSessionApi } from '@/api/sessions.ts'
</script>

<script setup lang="ts">
import { CheckboxOutline, AddOutline, GridOutline, MenuOutline, CopyOutline } from '@vicons/ionicons5'
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
import FolderPicker from '../FolderPicker.vue'

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
const sessionPrefsStore = useSessionPrefsStore()
const profileFilterValue = ref('')
const showSessions = ref(true)
const outlineVisible = ref(false)

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


/*
* ==================== 会话列表右键 ====================
* */

// 右键数据
const contextmenu = reactive({
  // 会话 ID
  sid: '',
  // 右键菜单是否可见
  visible: false,
  x: 0,
  y: 0
})

// 右键菜单选项
const contextmenuOptions = computed(() => generateContextmenuOptions(!sessionPrefsStore.isPinned(contextmenu.sid)))

// 已置顶的会话列表（按更新时间排序）
const pinnedSessions = computed(() => sortSessionsWithActiveFirst(chatStore.sessions.filter(sess => sessionPrefsStore.isPinned(sess.id))))

// 未置顶的会话列表（按更新时间排序）
const unpinnedSessions = computed(() => sortSessionsWithActiveFirst(chatStore.sessions.filter(sess => !sessionPrefsStore.isPinned(sess.id))))

// 重命名
const ctxMenuRename = reactive({
  // “重命名”弹窗是否可见
  visible: false,
  // 新标题
  value: '',
  // 会话 ID
  sid: ''
})

// 工作区
const ctxMenuWorkspace = reactive({
  // “工作区”弹窗是否可见
  visible: false,
  // 新工作区
  value: '',
  // 会话 ID
  sid: ''
})

/*
* ==================== 会话列表 ====================
* */

/**
 * 单击会话列表项跳转到会话页面
 * @param sessionId
 */
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

/*
* ==================== 会话大纲 ====================
* */

/**
 * 导航到 Markdown 中的标题
 * @param targetId DOM `id`
 */
function handleNavigate(targetId: string) {
  document.querySelector('#' + targetId)?.scrollIntoView(true)
}

/*
* ==================== 会话列表右键 ====================
* */

/**
 * 右击
 * @param evt 鼠标右击事件
 * @param sid 会话ID
 */
function onContextmenu(evt: MouseEvent, sid: Session['id']) {
  evt.preventDefault()
  contextmenu.sid = sid
  contextmenu.x = evt.clientX
  contextmenu.y = evt.clientY
  contextmenu.visible = true
}

function handleClickOutside() {
  contextmenu.visible = false
}

/**
 * 选择菜单项
 * @param key
 */
function handleContextMenuSelect(key: ContextmenuKey) {
  console.warn('handleContextMenuSelect>key:', key)
  contextmenu.visible = false
  if (!contextmenu.sid) return

  switch (key) {
    // 置顶
    case CONTEXTMENU_KEYS.Pin:
    // 取消置顶
    case CONTEXTMENU_KEYS.UnPin:
      sessionPrefsStore.togglePinned(contextmenu.sid)
      break
    // 重命名
    case CONTEXTMENU_KEYS.Rename: {
      const session = chatStore.sessions.find(_ => _.id === contextmenu.sid)
      ctxMenuRename.sid = contextmenu.sid
      ctxMenuRename.value = session?.title ?? ''
      ctxMenuRename.visible = true
      break
    }
    // 工作区
    case CONTEXTMENU_KEYS.Workspace: {
      const session = chatStore.sessions.find(_ => _.id === contextmenu.sid)
      ctxMenuWorkspace.sid = contextmenu.sid
      ctxMenuWorkspace.value = session?.workspace ?? ''
      ctxMenuWorkspace.visible = true
      break
    }
    // 在新标签页打开
    case CONTEXTMENU_KEYS.OpenLink: {
      openSessionInNewTab()
      break
    }
    // 导出会话
    default: {
      exportSession(key)
    }
  }
}

// 重命名
async function confirmRename() {
  if (!ctxMenuRename.sid || !ctxMenuRename.value.trim()) return false
  const ok = await renameSessionApi(ctxMenuRename.sid, ctxMenuRename.value)
  if (ok) {
    const session = chatStore.sessions.find(_ => _.id === ctxMenuRename.sid)
    if (session) {
      session.title = ctxMenuRename.value
    }
    window.$message?.success('已重命名')
  } else {
    window.$message?.error('重命名失败')
  }
  ctxMenuRename.visible = false
}

// 设置工作区
async function confirmWorkspace() {
  if (!ctxMenuWorkspace.sid) return
  const ok = await setSessionWorkspaceApi(ctxMenuWorkspace.sid, ctxMenuWorkspace.value.trim())
  if (ok) {
    const session = chatStore.sessions.find(_ => _.id === ctxMenuWorkspace.sid)
    if (session) {
      session.workspace = ctxMenuWorkspace.value
    }
    window.$message?.success('工作区设置成功')
  } else {
    window.$message?.error('工作区设置失败')
  }
  ctxMenuWorkspace.visible = false
}

/**
 * 解析导出选项的 key，获取导出模式和文件格式
 * @param key 菜单选项 key
 * @returns 导出模式和格式，或 null
 */
function parseExportKey(key: ContextmenuKey): {mode: 'full' | 'compressed'; ext: 'json' | 'txt'} | null {
  switch (key) {
    case CONTEXTMENU_KEYS.ExportFullJson:
      return { mode: 'full', ext: 'json' }
    case CONTEXTMENU_KEYS.ExportFullTxt:
      return { mode: 'full', ext: 'txt' }
    case CONTEXTMENU_KEYS.ExportCompressedJson:
      return { mode: 'compressed', ext: 'json' }
    case CONTEXTMENU_KEYS.ExportCompressedTxt:
      return { mode: 'compressed', ext: 'txt' }
    default:
      return null
  }
}

/**
 * 导出会话
 * @param key
 */
async function exportSession(key: ContextmenuKey) {
  console.log('exportSession:', key)
  const exportInfo = parseExportKey(key)
  if (!exportInfo) return
  const loadingMsg = exportInfo.mode === 'compressed' ? window.$message?.loading('正在压缩上下文，请稍候...') : null
  try {
    await exportSessionApi(contextmenu.sid, exportInfo.mode, exportInfo.ext)
    window.$message?.success('会话已导出')
  } catch (e) {
    console.error(e)
    window.$message?.error('导出失败')
  } finally {
    loadingMsg?.destroy()
  }
}

/**
 * 构建会话的完整URL（包含协议、域名和路径）
 * @param sessionId 会话ID
 * @param profile 配置文件名称（可选）
 * @returns 完整 URL
 */
function buildSessionUrl(sessionId: Session['id'], profile?: Session['profile']) {
  const _router = router.resolve({
    name: SESSION_ROUTE_NAME,
    params: { sessionId },
    query: { profile }
  })
  return new URL(location.pathname + _router.href, location.origin).toString()
}

// 在新标签页打开
function openSessionInNewTab() {
  window.open(buildSessionUrl(contextmenu.sid))
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
            @select="handleSessionClick(session.id)"
            @contextmenu="onContextmenu($event, session.id)"
          />
        </template>
        <SessionListItem
          v-for="session of unpinnedSessions"
          :key="session.id"
          :session="session"
          :active="session.id === chatStore.activeSessionId"
          :pinned="false"
          @select="handleSessionClick(session.id)"
          @contextmenu="onContextmenu($event, session.id)"
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
    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="contextmenu.x"
      :y="contextmenu.y"
      :options="contextmenuOptions"
      :show="contextmenu.visible"
      :on-clickoutside="handleClickOutside"
      @select="handleContextMenuSelect"
    />
    <!--================ [右键菜单]<<< ================-->

    <!--================ >>>[重命名弹窗] ================-->
    <n-modal
      v-model:show="ctxMenuRename.visible"
      title="重命名会话"
      preset="dialog"
      auto-focus
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmRename"
    >
      <n-input v-model:value="ctxMenuRename.value"/>
    </n-modal>
    <!--================ [重命名弹窗]<<< ================-->

    <!--================ >>>[工作区弹窗] ================-->
    <n-modal
      v-model:show="ctxMenuWorkspace.visible"
      title="设置工作区"
      preset="dialog"
      auto-focus
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmWorkspace"
    >
      <FolderPicker v-model:path="ctxMenuWorkspace.value"/>
    </n-modal>
    <!--================ [工作区弹窗]<<< ================-->
  </div>
</template>

<style scoped lang="less">
@import "style";
</style>
