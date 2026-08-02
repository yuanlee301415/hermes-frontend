<!--
对话输入框
- 选择文件（暂缓）
-->
<script setup lang="ts">
import { Send } from '@vicons/tabler'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { Attachment } from '@/models/Message.ts'
import { Session } from '@/models/Session.ts'
import { formatTokens } from '@/utils/formatTokens.ts'
import { getContextLengthApi } from '@/api/sessions.ts'

defineOptions({ name: 'ChatInput' })

const chatStore = useChatStore()
const profilesStore = useProfilesStore()
const appStore = useAppStore()
const inputText = ref('')
const attachments = ref<Attachment[]>([])

/**
 * 是否可以发送消息
 * 条件：输入框有非空白文本 或 有附件
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
 * 优先使用 contextTokens，其次使用 inputTokens + outputTokens
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

/**
 * 监听影响上下文长度的变化，重新加载上下文长度
 * 监听的状态包括：profile、provider、model、session 信息
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

// Todo: 监听输入文本变化，自动保存草稿

/**
 * 加载上下文长度（带缓存和去重）
 * 避免重复请求相同参数的上下文长度
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
 * 格式：profile|provider|model
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

function handeSend() {
  const text = inputText.value.trim()
  if (!text && !attachments.value.length) return
  chatStore.sendMessage(text, attachments.value)
  inputText.value = ''
  attachments.value = []
}

function handeEnter(evt: KeyboardEvent) {
  if (evt.shiftKey) return
  evt.preventDefault()
  handeSend()
}

</script>

<template>
  <div class="chat-input-area">
    <n-flex class="input-top-bar" align="center" :size="8">
      <!--Todo: 推理强度-->
      <!--Todo: 播放语音-->
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

    <n-input
      v-model:value="inputText"
      :autosize="{
        minRows: 1,
        maxRows: 5,
      }"
      type="textarea"
      placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
      @keydown.enter="handeEnter"
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

}
</style>
