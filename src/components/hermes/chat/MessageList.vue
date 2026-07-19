<script setup lang="ts">
import { useChatStore } from '@/store/modules/chat.ts'
import { Message } from '@/models/Session.ts'
import { useToolTraceVisibility } from '@/composables/useToolTraceVisibility.ts'
import MessageItem from './MessageItem.vue'
import VirtualMessageList from './VirtualMessageList.vue'

defineOptions({ name: 'MessageList' })

const chatStore = useChatStore()
const { toolTraceVisible } = useToolTraceVisibility()
const currentToolCalls = computed(() => {
  const msgs = chatStore.messages
  let lastIndex = -1
  for (let i = msgs.length - 1; i >=0; i--) {
    if (msgs[i].role === Message.ROLE_USER) {
      lastIndex = i
      break
    }
  }
  const tools = msgs.filter((msg, idx) => msg.role === Message.ROLE_TOOL && idx > lastIndex)
  return [...tools].reverse()
})

const displayMessages = computed(() => {
  const currentToolIds = new Set(currentToolCalls.value.map(_ => _.id))
  const result = chatStore.messages.filter(msg => {
    if (msg.role === Message.ROLE_TOOL) return toolTraceVisible.value && !!msg.toolName && !(chatStore.isRunActive && currentToolIds.has(msg.id))
    return !(msg.role === Message.ROLE_ASSISTANT && msg.isStreaming && !msg.content?.trim() && !!msg.reasoning?.trim() && currentToolCalls.value.length === 0)
  })
  console.log('MessageList>displayMessages:\n', result)
  return result
})

</script>

<template>
  <div class="message-list-shell">
    <VirtualMessageList
      :key="chatStore.activeSessionId || 'chat-empty'"
      :messages="displayMessages" v-slot="{item}"
      ref="listRef"
    >
      <MessageItem :message="item" :highlight="chatStore.focusSessionId" />
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
