<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { CHAT_ROUTE_NAME } from '@/router/routes/modules/chat.ts'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const profileStore = useProfilesStore()

const routeSessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' && value.trim() ? value : undefined
})

watch(routeSessionId, async (sessionId) => {
  console.log('ChatView>watch>routeSessionId:', sessionId)
  if (!chatStore.sessionsLoaded) return

  if (!sessionId) {
    await chatStore.loadSessions(chatStore.sessionProfileFilter)
    return
  }

  if (chatStore.activeSessionId === sessionId) return

  const exists = chatStore.sessions.some(_ => _.id === sessionId)
  if (!exists) {
    await loadRouteSession()
    return
  }

  await chatStore.switchSession(sessionId)
})

onMounted(async () => {
  console.warn('ChatView>onMounted')
  await Promise.all([
    profileStore.fetchProfiles(),
  ])
  await loadRouteSession()
})

async function loadRouteSession() {
  console.log('ChatView>loadRouteSession:', {
    routeSessionId: routeSessionId.value,
    activeSessionId: chatStore.activeSessionId
  })

  await chatStore.loadSessions(chatStore.sessionProfileFilter, routeSessionId.value)
  if (routeSessionId.value && chatStore.activeSessionId !== routeSessionId.value) {
    await router.replace({
      name: CHAT_ROUTE_NAME
    })
  }
}

</script>

<template>
  <div class="chat-view h-full">
    <ChatPanel/>
  </div>
</template>

<style scoped lang="less"></style>
