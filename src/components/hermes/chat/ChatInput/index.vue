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
      clearable
      @keydown.enter="handeEnter"
    >
      <template #suffix>
        <n-button size="small" type="primary" @click="handeSend">
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
