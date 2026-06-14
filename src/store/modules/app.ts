/*
 * App store
 * */
import { defineStore } from 'pinia'

const SIDEBAR_COLLAPSED_KEY = 'hermes_sidebar_collapsed'

export const useAppStore = defineStore('appStore', () => {
  const sidebarCollapsed = ref(!!Number(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)))

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  }
  return {
    sidebarCollapsed,
    toggleSidebarCollapsed,
  }
})
