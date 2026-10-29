/*
* 设置 Store
* */

import { defineStore } from 'pinia'
import { getConfigApi } from '@/api/config.ts'

export const useSettingsStore = defineStore('SettingsStore', () => {
  const loading = ref(false)
  const platforms = ref<Record<string, any>>({})

  async function fetchSettings() {
    loading.value = true
    try {
      const data = await getConfigApi()
      platforms.value = data.platforms ?? {}
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  return {
    platforms,

    fetchSettings
  }
})
