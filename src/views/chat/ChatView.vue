<script setup lang="ts">
import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'
import { useChatStore } from '@/store/modules/chat.ts'

const chatStore = useChatStore()

void getSessions()

async function getSessions() {
  await chatStore.loadSessions()
  console.log(chatStore.sessions)
}
</script>

<template>
  <div class="chat-view h-full">
    <ChatPanel/>
  </div>
</template>

<style scoped lang="less"></style>
