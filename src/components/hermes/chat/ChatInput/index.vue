<!--
对话输入框
-->
<script setup lang="ts">
import { Send } from '@vicons/tabler'
import { useChatStore } from '@/store/modules/chat.ts'
import { Attachment } from '@/models/Message.ts'

defineOptions({ name: 'ChatInput' })

const chatStore = useChatStore()
const inputText = ref('')
const attachments = ref<Attachment[]>([])

/**
 * 是否可以发送消息
 * 条件：输入框有非空白文本 或 有附件
 */
const canSend = computed(() => inputText.value.trim() || attachments.value.length > 0)

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
    <div class="input-top-bar"><!--Todo--></div>

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
}
</style>
