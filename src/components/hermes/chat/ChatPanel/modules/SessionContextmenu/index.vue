<script lang="ts">
import { SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'
import { Session } from '@/models/Session.ts'
import { renameSessionApi, setSessionWorkspaceApi, exportSessionApi } from '@/api/sessions.ts'
import { copyToClipboard } from '@/utils/clipboard.ts'
import { type ContextmenuKey, CONTEXTMENU_KEYS, generateContextmenuOptions } from './index.ts'
</script>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/modules/chat.ts'
import { useSessionPrefsStore } from '@/store/modules/session-prefs.ts'
import FolderPicker from '@/components/hermes/chat/FolderPicker.vue'

defineOptions({ name: 'Contextmenu' })

const router = useRouter()
const chatStore = useChatStore()
const sessionPrefsStore = useSessionPrefsStore()

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
const menuOptions = computed(() => generateContextmenuOptions(!sessionPrefsStore.isPinned(contextmenu.sid)))

// 重命名
const rename = reactive({
  // “重命名”弹窗是否可见
  visible: false,
  // 新标题
  value: '',
  // 会话 ID
  sid: ''
})

// 工作区
const workspace = reactive({
  // “工作区”弹窗是否可见
  visible: false,
  // 新工作区
  value: '',
  // 会话 ID
  sid: ''
})

defineExpose({
  openContextmenu
})

/**
 * 右击
 * @param evt 鼠标右击事件
 * @param sid 会话ID
 */
function openContextmenu(evt: MouseEvent, sid: Session['id']) {
  evt.preventDefault()
  contextmenu.sid = sid
  contextmenu.x = evt.clientX
  contextmenu.y = evt.clientY
  contextmenu.visible = true
}

// 关闭右键菜单
function handleClickOutside() {
  contextmenu.visible = false
}

/**
 * 选择菜单项
 * @param key
 */
function handleContextMenuSelect(key: ContextmenuKey) {
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
      rename.sid = contextmenu.sid
      rename.value = session?.title ?? ''
      rename.visible = true
      break
    }
    // 工作区
    case CONTEXTMENU_KEYS.Workspace: {
      const session = chatStore.sessions.find(_ => _.id === contextmenu.sid)
      workspace.sid = contextmenu.sid
      workspace.value = session?.workspace ?? ''
      workspace.visible = true
      break
    }
    // 在新标签页打开
    case CONTEXTMENU_KEYS.OpenLink: {
      openSessionInNewTab()
      break
    }
    // 复制会话链接
    case CONTEXTMENU_KEYS.CopyLink: {
      copySessionLink(contextmenu.sid)
      break
    }
    // 复制会话ID
    case CONTEXTMENU_KEYS.CopyId: {
      copySessionId(contextmenu.sid)
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
  if (!rename.sid || !rename.value.trim()) return false
  const ok = await renameSessionApi(rename.sid, rename.value)
  if (ok) {
    const session = chatStore.sessions.find(_ => _.id === rename.sid)
    if (session) {
      session.title = rename.value
    }
    window.$message?.success('已重命名')
  } else {
    window.$message?.error('重命名失败')
  }
  rename.visible = false
}

// 设置工作区
async function confirmWorkspace() {
  if (!workspace.sid) return
  const ok = await setSessionWorkspaceApi(workspace.sid, workspace.value.trim())
  if (ok) {
    const session = chatStore.sessions.find(_ => _.id === workspace.sid)
    if (session) {
      session.workspace = workspace.value
    }
    window.$message?.success('工作区设置成功')
  } else {
    window.$message?.error('工作区设置失败')
  }
  workspace.visible = false
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

/**
 * 复制会话链接到剪贴板
 * @param sid 会话 ID
 */
async function copySessionLink(sid: Session['id']) {
  const session = chatStore.sessions.find(_ => _.id === sid)
  if (!session) return
  const ok = await copyToClipboard(buildSessionUrl(session.id, session.profile))
  if (ok) {
    window.$message?.success('复制成功')
  } else {
    window.$message?.error('复制失败')
  }
}

/**
 * 复制会话ID到剪贴板
 * @param sid 会话ID
 */
async function copySessionId(sid: Session['id']) {
  const ok = await copyToClipboard(sid)
  if (ok) {
    window.$message?.success('复制成功')
  } else {
    window.$message?.error('复制失败')
  }
}
</script>

<template>
  <div class="contextmenu-container">
    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="contextmenu.x"
      :y="contextmenu.y"
      :options="menuOptions"
      :show="contextmenu.visible"
      :on-clickoutside="handleClickOutside"
      @select="handleContextMenuSelect"
    />

    <!--================ >>>[重命名弹窗] ================-->
    <n-modal
      v-model:show="rename.visible"
      title="重命名会话"
      preset="dialog"
      auto-focus
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmRename"
    >
      <n-input v-model:value="rename.value"/>
    </n-modal>
    <!--================ [重命名弹窗]<<< ================-->

    <!--================ >>>[工作区弹窗] ================-->
    <n-modal
      v-model:show="workspace.visible"
      title="设置工作区"
      preset="dialog"
      auto-focus
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmWorkspace"
    >
      <FolderPicker v-model:path="workspace.value"/>
    </n-modal>
    <!--================ [工作区弹窗]<<< ================-->
  </div>
</template>

<style scoped lang="less">
</style>
