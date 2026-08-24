<!--
对话输入框（v1@2026年8月2日）
- 发送消息
- 停止输出
- 上下文使用统计
- 选择文件（暂缓）
- 文件预览（暂缓）
- 语音播放（暂缓）
- 语音输入（暂缓）

Todo:
- [ ] 推理强度
- [ ] 草稿
- [ ] 显示/隐藏工具调用
- [ ] 编辑上下文长度
-->
<script setup lang="ts">
import {NInput} from 'naive-ui'
import { Send } from '@vicons/tabler'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { Attachment } from '@/models/Message.ts'
import { Session } from '@/models/Session.ts'
import { formatTokens } from '@/utils/format.ts'
import { getContextLengthApi } from '@/api/sessions.ts'
import { type BridgeCommand, BRIDGE_COMMANDS} from '../../shared/bridge-commands.ts'

defineOptions({ name: 'ChatInput' })

const chatStore = useChatStore()
const profilesStore = useProfilesStore()
const appStore = useAppStore()
const inputText = ref('')
const inputRef = ref<InstanceType<typeof NInput> |null>(null)
const attachments = ref<Attachment[]>([])

/**
 * 是否可以发送消息
 * - 输入框有非空白文本 或 有附件
 */
const canSend = computed(() => inputText.value.trim() || attachments.value.length > 0)

// ============ 上下文使用统计 ============
// 上下文长度的默认回退值
const FALLBACK_CONTEXT = 256_000

// 当前模型的上下文窗口长度（token 数）
const contextLength = ref(FALLBACK_CONTEXT)

// 已加载的上下文长度的缓存键（用于避免重复请求）
let contextLengthLoadedKey = ''

// 当前正在请求的上下文长度的键
let contextLengthRequestKey = ''

// 上下文长度请求的 Promise（用于去重）
let contextLengthRequest: Promise<void> | null = null

// 是否为编码代理会话（编码代理会话不支持上下文编辑）
const isCodingAgentSession = computed(() => chatStore.activeSession?.source === Session.SOURCE.CodingAgent)

/**
 * 计算当前会话使用的总 token 数
 * - 优先使用 contextTokens，其次使用 inputTokens + outputTokens
 */
const totalTokens = computed(() => {
  if (isCodingAgentSession.value) return 0
  const context = chatStore.activeSession?.contextTokens
  if (typeof context === 'number' && Number.isFinite(context) && context > 0) return context
  const input = chatStore.activeSession?.inputTokens ?? 0
  const output = chatStore.activeSession?.outputTokens ?? 0
  return input + output
})

// 剩余可用 token 数
const remainingTokens = computed(() => Math.max(0, contextLength.value - totalTokens.value))

// 上下文使用率百分比
const usagePercent = computed(() => Math.min((totalTokens.value / contextLength.value) * 100, 100))

// ============ Slash 命令 ============

// Slash 命令下拉菜单是否激活
const slashActive = ref(false)

// 当前选中的命令索引
const slashActiveIndex = ref(0)

// 当前 Slash 命令搜索词（去掉开头的 /）
const slashQuery = ref('')

const commandDropdownRef = ref<HTMLDivElement|null>(null)

// 根据搜索词过滤后的命令列表
const filteredBridgeCommands = computed(() => {
  const query = slashQuery.value.toLowerCase()
  return BRIDGE_COMMANDS.filter(_ => _.name.includes(query) || _.insertText?.includes(query))
})

// 是否为 Bridge（CLI）会话
const isBridgeSession = computed(() => chatStore.activeSession?.source === Session.SOURCE.Cli)


// ============ Watch ============

/**
 * 监听影响上下文长度的变化，重新加载上下文长度
 * - 监听的状态包括：profile、provider、model、session 信息
 */
watch(() => [
  profilesStore.activeProfileName,
  appStore.selectedProvider,
  appStore.selectedModel,
  chatStore.activeSession?.id,
  chatStore.activeSession?.profile,
  chatStore.activeSession?.provider,
  chatStore.activeSession?.model,
  chatStore.activeSession?.source,
],
  loadContextLength,
  { flush: 'post' }
)

// ============ Mounted ============

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMousedown)
})

// ============ Slash 命令 ============

/**
 * 处理文档鼠标按下事件
 * - 点击下拉菜单外部时关闭命令下拉菜单
 */
function onDocumentMousedown(evt: MouseEvent) {
  if (!slashActive.value) return

  const target = evt.target as HTMLElement
  if (!target.closest('.slash-command-dropdown') && !target.closest('.input-wrapper')) {
    slashActive.value = false
  }
}

/**
 * 更新 Slash 命令状态
 * - 检查光标位置是否在以 / 开头的单词中，若是则激活命令下拉菜单
 */
function updateSlashState() {
  if (!isBridgeSession) {
    slashActive.value = false
    return
  }

  const el = inputRef.value?.$el?.querySelector('textarea')
  if (!el) return

  const cursorPos = el.selectionStart
  const beforeCursor = inputText.value.slice(0, cursorPos)

  // 检查条件：必须以 / 开头，且不包含空格或换行
  if (!beforeCursor.startsWith('/') || beforeCursor.includes(' ') || beforeCursor.includes('\n')) {
    slashActive.value = false
    return
  }

  // 提取搜索词（去掉开头的 /）
  slashQuery.value = beforeCursor.slice(1)
  slashActiveIndex.value = 0

  //仅在有匹配命令时才激活下拉菜单
  slashActive.value = !!filteredBridgeCommands.value.length
}

/**
 * 选择并插入 Slash 命令到输入框
 */
function selectBridgeCommand(command: BridgeCommand) {
  // 使用 insertText（完整命令）或 name（命令名），后面加空格
  inputText.value = `/${command.insertText || command.name} `
  slashActive.value = false

  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('textarea')
    if (!el) return

    const pos = inputText.value.length
    // 将光标定位到命令末尾
    el.setSelectionRange(pos, pos)
    el.focus()
  })
}

/**
 * 将选中的 Slash 命令滚动到可视区域
 */
function scrollCommandIntoView() {
  nextTick(() => {
    if (!commandDropdownRef.value) return
    const active = commandDropdownRef.value.querySelector('.active') as HTMLDivElement | null
    active?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  })
}

/**
 * 处理键盘按下事件
 * - Slash 命令导航
 * - Enter 发送消息
 */
function handeKeydown(evt: KeyboardEvent) {
  if (slashActive.value && filteredBridgeCommands.value.length) {
    // Slash 命令下拉菜单激活时的键盘导航
    switch (evt.key) {
      case 'ArrowDown':
        evt.preventDefault()
        slashActiveIndex.value = (slashActiveIndex.value + 1) % filteredBridgeCommands.value.length
        scrollCommandIntoView()
        return

      case 'ArrowUp':
        evt.preventDefault()
        slashActiveIndex.value = (slashActiveIndex.value - 1 + filteredBridgeCommands.value.length) % filteredBridgeCommands.value.length
        scrollCommandIntoView()
        return

      case 'Escape':
        evt.preventDefault()
        slashActive.value = false
        return

      case 'Enter':
      case 'Tab':
        // Enter/Tab：选中当前命令
        evt.preventDefault()
        selectBridgeCommand(filteredBridgeCommands.value[slashActiveIndex.value])
        return
    }
  }

  // 非 Slash 命令模式下，Enter 键发送消息（Shift+Enter 换行）
  if (evt.key !== 'Enter' || evt.shiftKey) return
  evt.preventDefault()
  handeSend()
}

/**
 * 处理输入事件
 */
function handleInput() {
  updateSlashState()
}

/**
 * 加载上下文长度（带缓存和去重）
 * - 避免重复请求相同参数的上下文长度
 */
function loadContextLength() {
  // 编码代理会话不显示上下文信息
  if (isCodingAgentSession.value) return

  const key = currentContextLengthKey()

  // 如果已加载过相同的键，直接返回
  if (key === contextLengthLoadedKey) return

  // 如果正在请求相同的键，返回已有请求的 Promise
  if (key === contextLengthRequestKey && contextLengthRequest) return contextLengthRequest

  contextLengthRequestKey = key

  contextLengthRequest = (async () => {
      const params = currentContextLengthParams()
      try {
        const value = await getContextLengthApi(params.profile, params.provider, params.model)
        // 检查键是否已变更（会话切换等情况）
        if (currentContextLengthKey() !== key) return
        contextLength.value = value
        contextLengthLoadedKey = key
      } catch (e) {
        // 请求失败时使用默认回退值
        if (currentContextLengthKey() !== key) return
        contextLength.value = FALLBACK_CONTEXT
        contextLengthLoadedKey = key
      } finally {
        // 清理请求状态
        if (contextLengthRequestKey === key) {
          contextLengthRequest = null
          contextLengthRequestKey = ''
        }
      }
    }
  )()

  return contextLengthRequest
}

/**
 * 生成上下文长度缓存键
 * - 格式：profile|provider|model
 */
function currentContextLengthKey() {
  const params = currentContextLengthParams()
  return [params.profile || '', params.provider || '', params.model || ''].join('|')
}

/**
 * 获取当前上下文长度查询参数
 */
function currentContextLengthParams() {
  const activeSession = chatStore.activeSession
  return {
    profile: activeSession?.profile || profilesStore.activeProfileName,
    provider: activeSession?.provider,
    model: activeSession?.model
  }
}

/**
 * 发送消息
 */
function handeSend() {
  const text = inputText.value.trim()
  if (!text && !attachments.value.length) return
  chatStore.sendMessage(text, attachments.value)
  // 清空输入框和附件列表
  inputText.value = ''
  attachments.value = []
  slashActive.value = false
}

</script>

<template>
  <div class="chat-input-area">
    <n-flex class="input-top-bar" align="center" :size="8">
      <!--Todo: 推理强度-->
      <!--Todo: 显示/隐藏工具调用-->

      <template v-if="totalTokens > 0">
        <div class="context-info">
          <!--Todo: 编辑上下文长度-->
          {{ formatTokens(totalTokens) }} / {{ formatTokens(contextLength) }} · 剩余 {{ formatTokens(remainingTokens) }}
        </div>

        <div class="context-bar">
          <n-progress :percentage="usagePercent"  :show-indicator="false" :height="5" :status="usagePercent > 80 ? 'warning' : 'info'"></n-progress>
        </div>
      </template>
    </n-flex>

    <div class="input-wrapper">
      <!--Textarea-->
      <n-input
        v-model:value="inputText"
        :autosize="{
          minRows: 1,
          maxRows: 5,
        }"
        type="textarea"
        ref="inputRef"
        placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
        @keydown="handeKeydown"
        @input="handleInput"
      >
        <template #suffix>
          <n-button v-if="chatStore.isStreaming" size="small" type="error" style="margin-right: 8px;" @click="chatStore.stopStreaming()">
            停止
          </n-button>
          <n-button :disabled="!canSend" size="small" type="primary" @click="handeSend">
            <template #icon><Send/></template>
            发送
          </n-button>
        </template>
      </n-input>
      <!--Textarea End-->

      <!--Slash command-->
      <transition name="dropdown-fade">
        <div v-if="slashActive" class="slash-command-dropdown" ref="commandDropdownRef">
          <div
            v-for="(command, idx) of filteredBridgeCommands"
            :key="command.name + command.args + command.description"
            :class="{active: slashActiveIndex === idx}"
            class="slash-command-item"
            @mouseenter="() => slashActiveIndex = idx"
            @mousedown.prevent="selectBridgeCommand(command)"
          >
            <span class="slash-command-name">/{{ command.name }}</span>
            <span v-if="command.args" class="slash-command-args">{{ command.args }}</span>
            <span class="slash-command-desc">{{ command.description }}</span>
          </div>
        </div>
      </transition>
      <!--Slash command End-->

    </div>


  </div>
</template>

<style scoped lang="less">
.chat-input-area {
  flex-shrink: 0;
  padding: 10px 15px;
  border-top: 1px solid var(--border-color);

  :deep(.n-input--textarea) {
    padding: 10px;
  }

  .input-top-bar {
    height: 30px;
    .context-bar {
      width: 60px;
    }
  }

  .input-wrapper {
    position: relative;
    .slash-command-dropdown {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: calc(100% + 8px);
      max-height: 240px;
      overflow-y: auto;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
      z-index: 20;
      padding: 4px;
      .slash-command-item {
        display: grid;
        grid-template-columns: auto auto 1fr;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        min-height: 36px;
        &.active,
        &:hover {
          background: rgba(var(--accent-primary-rgb), 0.1);
        }
        .slash-command-name {
          font-size: 13px;
          font-family: var(--font-code);
          color: var(--accent-primary);
          white-space: nowrap;
        }
        .slash-command-args {
          font-size: 12px;
          font-family: var(--font-code);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .slash-command-desc {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-secondary);
          font-size: 12px;
        }
      }
    }
  }

  .dropdown-fade-enter-active,
  .dropdown-fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .dropdown-fade-enter-from,
  .dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }
}
</style>
