import { defineStore } from 'pinia'
import { ref } from 'vue'
import { store } from '@/store'
import User from '@/models/User.ts'

export const useUserStore = defineStore('userStore', () => {
  const info = ref<User | null>(null)
  const token = ref('')
  const lastUpdateTime = ref<number>()

  async function getUserInfo() {
    const user = new User({ id: '1100', name: 'Guest', roles: ['Guest'] })
    setUserInfo(user)
    return user
  }

  function setUserInfo(user: User) {
    info.value = user
  }

  return {
    info,
    token,
    lastUpdateTime,
    getUserInfo,
  }
})

export function useUserStoreWithOut() {
  return useUserStore(store)
}
