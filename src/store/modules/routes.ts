/*
 * 路由 Store
 * */

import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { ref } from 'vue'

import { router } from '@/router'
import { basicRoutes } from '@/router/routes'
import { HOME_ROUTE_NAME, LOGIN_ROUTE_NAME } from '@/router/constant'
import { Menu } from '@/models/Menu.ts'
import { genMenus } from '../shared'

export const useRoutesStore = defineStore('routes', () => {
  const route = useRoute()

  /**
   * 菜单列表
   */
  const menus = ref<Menu[]>([])

  getMenus()

  /**
   * 生成菜单列表
   */
  function getMenus() {
    menus.value = genMenus([...basicRoutes])
  }

  function toLogin() {
    router.push({ name: LOGIN_ROUTE_NAME, query: { redirect: route.path } })
  }

  function toHome() {
    router.push({ name: HOME_ROUTE_NAME })
  }

  function redirectFormLogin() {
    const { redirect } = route.query
    if (redirect) {
      router.push(redirect as string)
    } else {
      toHome()
    }
  }

  return {
    menus,
    toLogin,
    toHome,
    redirectFormLogin,
  }
})
