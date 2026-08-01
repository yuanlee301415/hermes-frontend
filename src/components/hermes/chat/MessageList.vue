<!--
Todo:
- 使用 虚拟滚动 后，同步滚动消息的逻辑
-->
<script setup lang="ts">
import type { Session } from '@/models/Session.ts'
import { useChatStore } from '@/store/modules/chat.ts'
import { Message } from '@/models/Message.ts'
import { useToolTraceVisibility } from '@/composables/useToolTraceVisibility.ts'
import MessageItem from './MessageItem.vue'
import VirtualMessageList from './VirtualMessageList.vue'

defineOptions({ name: 'MessageList' })

const chatStore = useChatStore()
const { toolTraceVisible } = useToolTraceVisibility()
const listRef = ref<InstanceType<typeof VirtualMessageList>| null>(null)

const currentToolCalls = computed(() => {
  const msgs = chatStore.messages
  let lastIndex = -1
  for (let i = msgs.length - 1; i >=0; i--) {
    if (msgs[i].role === Message.ROLE.User) {
      lastIndex = i
      break
    }
  }
  const tools = msgs.filter((msg, idx) => msg.role === Message.ROLE.Tool && idx > lastIndex)
  return [...tools].reverse()
})

const displayMessages = computed(() => {
  const currentToolIds = new Set(currentToolCalls.value.map(_ => _.id))
  return chatStore.messages.filter(msg => {
    if (msg.role === Message.ROLE.Tool) return toolTraceVisible.value && !!msg.toolName && !(chatStore.isRunActive && currentToolIds.has(msg.id))
    return !(msg.role === Message.ROLE.Assistant && msg.isStreaming && !msg.content?.trim() && !!msg.reasoning?.trim() && currentToolCalls.value.length === 0)
  })
})

/*
* 监听会话切换：滚动到新会话的位置
* */
watch(() => chatStore.activeSessionId, async (id) => {
  await nextTick()
  applyInitialSessionScroll(id!)
}, { immediate: true })

/*
 * 监听运行状态开始：当用户发送消息后，强制滚动到底部一次
 */
watch(() => chatStore.isRunActive, () => {
  scrollToBottom()
})

/*
 * 监听消息数量变化：在消息加载完成后确保滚动位置正确
 * 使用 flush: "post" 确保 DOM 更新后再执行滚动
 */
watch(() => [chatStore.activeSessionId, chatStore.messages.length] as const, ([id, length]) => {
  // 如果没有会话、滚动尚未完成或没有消息，跳过
  if (!id || length === 0) return
  applyInitialSessionScroll(id)
}, { flush: 'post'})

/*
* 监听最后一条消息内容变化（流式传输）
*/
watch(() => chatStore.messages.at(-1)?.content, () => {
  scrollToBottom()
})

// 滚动到底部
function scrollToBottom() {
  listRef.value?.scrollToBottom();
}

/**
 * 应用初始会话滚动：在切换到新会话后恢复滚动位置
 * @param sessionId - 目标会话 ID
 */
function applyInitialSessionScroll(sessionId: Session['id']) {
  if (chatStore.activeSessionId !== sessionId) return
  scrollToBottom()
}
</script>

<template>
  <div class="message-list-shell">
    <VirtualMessageList
      :key="chatStore.activeSessionId || 'chat-empty'"
      :messages="displayMessages" v-slot="{item}"
      ref="listRef"
    >
      <MessageItem :message="item" :highlight="chatStore.focusSessionId === item.id" />
    </VirtualMessageList>
  </div>
</template>

<style scoped lang="less">
.message-list-shell {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
</style>
