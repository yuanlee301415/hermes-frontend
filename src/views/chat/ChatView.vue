<script setup lang="ts">
import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'

import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'

const chatStore = useChatStore()
const profileStore = useProfilesStore()

onMounted(async () => {
  await Promise.all([
    profileStore.fetchProfiles(),
  ])
  await loadRouteSession()
})

async function loadRouteSession() {
  await chatStore.loadSessions()
}

</script>

<template>
  <div class="chat-view h-full">
    <ChatPanel/>
  </div>
</template>

<style scoped lang="less"></style>
