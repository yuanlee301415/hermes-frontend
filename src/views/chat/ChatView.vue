<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import ChatPanel from '@/components/hermes/chat/ChatPanel/index.vue'
import { useChatStore } from '@/store/modules/chat.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { CHAT_ROUTE_NAME } from '@/router/routes/modules/chat.ts'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const profileStore = useProfilesStore()
const appStore = useAppStore()

const routeSessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' && value.trim() ? value : undefined
})

let refreshTimer: ReturnType<typeof setTimeout> | undefined

watch(routeSessionId, async (sessionId) => {
  // console.warn('ChatView>routeSessionId:', sessionId)
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
  await Promise.all([
    appStore.loadModels(),
    profileStore.fetchProfiles(),
  ])
  await loadRouteSession()
  void refreshSessionList()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  clearTimeout(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function loadRouteSession() {
  await chatStore.loadSessions(chatStore.sessionProfileFilter, routeSessionId.value)
  if (routeSessionId.value && chatStore.activeSessionId !== routeSessionId.value) {
    await router.replace({
      name: CHAT_ROUTE_NAME
    })
  }
}

/**
 * 轻度后台轮询用于会话列表实时同步（覆盖通过 CLI/Telegram 在 VM 上创建的会话）。
 * - 仅在标签可见且非流式传输时运行，因此开销低且不会中断活跃运行。
 * - visibilitychange 处理从隐藏唤醒的情况；此处理"保持打开并观察"的情况。
 * */
async function refreshSessionList() {
  try {
    if (document?.visibilityState !== 'visible' || chatStore.isStreaming) return
    if (!refreshTimer) return // 初始加载时，首次不执行
    await chatStore.refreshSessionListOnly()
  } finally {
    refreshTimer = setTimeout(() => {
      refreshSessionList()
    }, 1000 * 10)
  }
}

// 标签页可见性：返回前台时重新同步
function onVisibilityChange() {
  // 刷新会话列表（CLI、Telegram、其他设备创建的会话）
  if (document.visibilityState !== 'visible') return
  chatStore.reloadActivatedSession()
}
</script>

<template>
  <div class="chat-view h-full">
    <ChatPanel/>
  </div>
</template>

<style scoped lang="less"></style>
