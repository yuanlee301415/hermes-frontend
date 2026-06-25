import { defineStore } from 'pinia'
import { getSessionsApi } from '@/api/sessions.ts'
import { Session } from '@/models/Session.ts'

export const useChatStore = defineStore('chatStore', () => {
  const sessions = ref()

  async function loadSessions() {
    try {
      const list = await getSessionsApi()
      const fresh = Session.fromSummary(list)
      sessions.value = fresh
    } catch (e) {
      console.error(e)
    } finally {

    }
  }

  return {
    sessions,
    loadSessions
  }
})
