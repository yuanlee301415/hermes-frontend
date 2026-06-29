import { defineStore } from 'pinia'
import { getSessionsApi } from '@/api/sessions.ts'
import { Session } from '@/models/Session.ts'


export const useChatStore = defineStore('chatStore', () => {
  const sessions = ref<Session[]>([])
  const sessionProfileFilter = ref<string | null>(null)
  const isLoadingSessions = ref(false)
  const sessionsLoaded = ref(false)

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      const list = await getSessionsApi()
      const fresh = Session.fromSummary(list)
      sessions.value = fresh
    } catch (e) {
      console.error(e)
    } finally {
      isLoadingSessions.value = false
      sessionsLoaded.value = true
    }
  }

  return {
    sessions,
    loadSessions,
    sessionProfileFilter
  }
})
